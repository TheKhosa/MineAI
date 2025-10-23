/**
 * Intelligent Multi-Agent Village Server - Refactored Modular Version
 *
 * This is a clean, modular version of intelligent_village.js that uses
 * the new agent_ai.js and village_knowledge.js modules.
 *
 * Features:
 * - Multi-agent system with 29+ specialized agent types
 * - Machine learning (PPO) for agent decision-making
 * - Evolutionary system: offspring inherit from fittest parents
 * - Knowledge sharing and collective learning
 * - McMMO-style skill progression
 * - Personality system with genetic inheritance
 * - Multi-threaded worker pool for 1000+ agents
 * - Optional web dashboard for monitoring
 */

// ============================================================================
// CORE DEPENDENCIES
// ============================================================================

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalNear, GoalBlock, GoalXZ } = goals;
const toolPlugin = require('mineflayer-tool').plugin;
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios');

// ============================================================================
// CUSTOM MODULES
// ============================================================================

const { AgentAI, formatPos } = require('./agent_ai');
const { VillageKnowledge } = require('./village_knowledge');
const { SubagentManager } = require('./subagents');
const { PluginSensorClient } = require('./plugin_sensor_client');
const { AgentActionChat } = require('./agent_action_chat');
const config = require('./config');
const ActionSpace = require('./ml_action_space');
const StateEncoder = require('./ml_state_encoder');

// ML System
const { getMLTrainer } = require('./ml_trainer');
let mlTrainer = null;
let ML_ENABLED = config.ml.enabled;

// Memory System
const { getMemorySystem } = require('./agent_memory_system');
let memorySystem = null;

// Chat LLM System
const { getChatLLM } = require('./agent_chat_llm');
const { DownloadManager } = require('./llm_download_manager');
const { getChatManager } = require('./chat_manager');
let chatLLM = null;
let downloadManager = null;
let chatManager = null;

// Personality System
const { getPersonalitySystem } = require('./agent_personality_system');
const { getMLPersonality } = require('./ml_personality');
let personalitySystem = null;
let mlPersonality = null;

// Dashboard (optional)
let dashboard = null;
if (config.dashboard.enabled) {
    dashboard = require('./dashboard');
}

// Worker Pool (conditional on threading enabled)
let WorkerPoolManager = null;
let workerPool = null;
if (config.threading.enabled) {
    WorkerPoolManager = require('./worker_pool_manager');
    console.log('[THREADING] Worker pool enabled - can handle 1000+ agents');
} else {
    console.log('[THREADING] Single-threaded mode - suitable for <100 agents');
}

// ============================================================================
// DATABASE SETUP
// ============================================================================

const dbPath = path.join(__dirname, 'AIKnowledge.sqlite');
const db = new sqlite3.Database(dbPath);

// Initialize database schema
db.serialize(() => {
    // Experiences table
    db.run(`CREATE TABLE IF NOT EXISTS experiences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_name TEXT,
        agent_type TEXT,
        experience_type TEXT,
        data TEXT,
        outcome TEXT,
        timestamp INTEGER,
        generation INTEGER
    )`);

    // Agent lineage table
    db.run(`CREATE TABLE IF NOT EXISTS lineage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_name TEXT UNIQUE,
        agent_type TEXT,
        agent_number INTEGER,
        parent_name TEXT,
        generation INTEGER,
        birth_time INTEGER,
        death_time INTEGER,
        final_reward REAL,
        total_experiences INTEGER
    )`);

    // Resource locations table
    db.run(`CREATE TABLE IF NOT EXISTS resource_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resource_type TEXT,
        x INTEGER,
        y INTEGER,
        z INTEGER,
        discovered_by TEXT,
        timestamp INTEGER
    )`);

    // Agent counters table (for sequential numbering)
    db.run(`CREATE TABLE IF NOT EXISTS agent_counters (
        agent_type TEXT PRIMARY KEY,
        counter INTEGER DEFAULT 0
    )`);

    // Agent types table (store all agent type configurations)
    db.run(`CREATE TABLE IF NOT EXISTS agent_types (
        agent_type TEXT PRIMARY KEY,
        prefix TEXT,
        behavior TEXT,
        specialization TEXT,
        targets TEXT,
        rewards TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`);

    // Agent UUIDs table (cache UUIDs for reuse on restart)
    db.run(`CREATE TABLE IF NOT EXISTS agent_uuids (
        agent_type TEXT NOT NULL,
        uuid TEXT PRIMARY KEY,
        player_name TEXT NOT NULL,
        in_use BOOLEAN DEFAULT 0,
        last_used INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`);

    // Create index for faster UUID lookups by type
    db.run(`CREATE INDEX IF NOT EXISTS idx_uuid_type ON agent_uuids(agent_type, in_use)`);

    // Player-agent conversations table (persist conversation history)
    db.run(`CREATE TABLE IF NOT EXISTS player_agent_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_name TEXT,
        agent_name TEXT,
        role TEXT,
        message TEXT,
        timestamp INTEGER
    )`);

    // Create index for faster lookups
    db.run(`CREATE INDEX IF NOT EXISTS idx_conversations ON player_agent_conversations(player_name, agent_name, timestamp)`);

    console.log('[DATABASE] AIKnowledge.sqlite initialized');
});

// ============================================================================
// VILLAGE KNOWLEDGE SYSTEM
// ============================================================================

// Initialize village knowledge with database
const villageKnowledge = new VillageKnowledge(db);

// ============================================================================
// AGENT TYPES CONFIGURATION
// ============================================================================

const AGENT_TYPES = {
    // === RESOURCE GATHERING ===
    MINING: {
        prefix: 'Miner',
        behavior: 'mining',
        targets: ['coal_ore', 'iron_ore', 'diamond_ore', 'stone', 'deepslate_iron_ore', 'deepslate_diamond_ore'],
        specialization: 'resource_gathering',
        rewards: { ore_found: 10, rare_ore: 50 }
    },
    LUMBERJACK: {
        prefix: 'Lumberjack',
        behavior: 'lumberjack',
        targets: ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log', 'mangrove_log'],
        specialization: 'resource_gathering',
        rewards: { wood_gathered: 5 }
    },
    FISHING: {
        prefix: 'Fisher',
        behavior: 'fishing',
        targets: ['water'],
        specialization: 'resource_gathering',
        rewards: { fish_caught: 8, rare_fish: 25 }
    },
    FARMING: {
        prefix: 'Farmer',
        behavior: 'farming',
        targets: ['wheat', 'carrot', 'potato', 'beetroot'],
        specialization: 'resource_gathering',
        rewards: { crop_harvested: 15, farm_planted: 20, seed_planted: 10 }
    },
    QUARRY: {
        prefix: 'Quarryman',
        behavior: 'quarry',
        targets: ['stone', 'cobblestone', 'granite', 'diorite', 'andesite'],
        specialization: 'resource_gathering',
        rewards: { stone_gathered: 2 }
    },

    // === COMBAT & DEFENSE ===
    HUNTING: {
        prefix: 'Hunter',
        behavior: 'hunting',
        targets: ['zombie', 'skeleton', 'spider', 'creeper', 'enderman'],
        specialization: 'combat',
        rewards: { mob_kill: 50, rare_mob: 100 }
    },
    GUARD: {
        prefix: 'Guard',
        behavior: 'guard',
        targets: ['zombie', 'skeleton', 'spider', 'creeper'],
        specialization: 'defense',
        rewards: { defense: 60, area_secured: 30 }
    },
    ARCHER: {
        prefix: 'Archer',
        behavior: 'archer',
        targets: ['skeleton', 'zombie', 'spider'],
        specialization: 'ranged_combat',
        rewards: { ranged_kill: 55 }
    },
    KNIGHT: {
        prefix: 'Knight',
        behavior: 'knight',
        targets: ['zombie', 'skeleton', 'creeper', 'enderman', 'blaze'],
        specialization: 'elite_combat',
        rewards: { elite_kill: 75, boss_kill: 200 }
    },

    // === EXPLORATION & SCOUTING ===
    EXPLORING: {
        prefix: 'Explorer',
        behavior: 'exploring',
        specialization: 'discovery',
        rewards: { distance: 0.15, discovery: 30 }
    },
    SCOUT: {
        prefix: 'Scout',
        behavior: 'scout',
        specialization: 'reconnaissance',
        rewards: { area_mapped: 20, danger_spotted: 25 }
    },
    SPELUNKER: {
        prefix: 'Spelunker',
        behavior: 'spelunking',
        specialization: 'cave_exploration',
        rewards: { cave_explored: 35, ore_vein_found: 40 }
    },

    // === CRAFTING & PRODUCTION ===
    BLACKSMITH: {
        prefix: 'Blacksmith',
        behavior: 'blacksmith',
        targets: ['iron_ingot', 'diamond', 'netherite_ingot'],
        specialization: 'tool_crafting',
        rewards: { tool_crafted: 25, weapon_crafted: 30, armor_crafted: 35 }
    },
    BAKER: {
        prefix: 'Baker',
        behavior: 'baking',
        targets: ['wheat', 'sugar', 'egg', 'milk'],
        specialization: 'food_production',
        rewards: { food_crafted: 15, cake_made: 25 }
    },
    BUILDER: {
        prefix: 'Builder',
        behavior: 'building',
        targets: ['stone', 'wood', 'brick'],
        specialization: 'construction',
        rewards: { block_placed: 2, structure_built: 50 }
    },
    TOOLMAKER: {
        prefix: 'Toolmaker',
        behavior: 'toolmaking',
        targets: ['stick', 'iron_ingot', 'diamond'],
        specialization: 'tool_production',
        rewards: { tool_made: 20 }
    },

    // === SUPPORT & UTILITY ===
    TRADER: {
        prefix: 'Trader',
        behavior: 'trading',
        specialization: 'commerce',
        rewards: { trade_completed: 30, profit: 15 }
    },
    HEALER: {
        prefix: 'Healer',
        behavior: 'healing',
        specialization: 'support',
        rewards: { agent_healed: 40, potion_brewed: 20 }
    },
    SHEPHERD: {
        prefix: 'Shepherd',
        behavior: 'shepherding',
        targets: ['sheep', 'cow', 'pig', 'chicken'],
        specialization: 'animal_husbandry',
        rewards: { animal_bred: 15, wool_collected: 5 }
    },
    ALCHEMIST: {
        prefix: 'Alchemist',
        behavior: 'alchemy',
        targets: ['nether_wart', 'blaze_powder', 'glowstone'],
        specialization: 'potion_brewing',
        rewards: { potion_brewed: 25, rare_potion: 50 }
    },

    // === SPECIALIZED ROLES ===
    ENCHANTER: {
        prefix: 'Enchanter',
        behavior: 'enchanting',
        targets: ['lapis_lazuli', 'enchanting_table'],
        specialization: 'magic',
        rewards: { item_enchanted: 40, rare_enchant: 80 }
    },
    REDSTONE_ENGINEER: {
        prefix: 'Engineer',
        behavior: 'redstone',
        targets: ['redstone', 'repeater', 'comparator'],
        specialization: 'automation',
        rewards: { contraption_built: 60 }
    },
    CARTOGRAPHER: {
        prefix: 'Cartographer',
        behavior: 'mapping',
        specialization: 'navigation',
        rewards: { map_created: 30, landmark_found: 25 }
    },
    NETHER_EXPLORER: {
        prefix: 'NetherExplorer',
        behavior: 'nether_exploring',
        specialization: 'dangerous_exploration',
        rewards: { nether_explored: 50, fortress_found: 100 }
    },
    END_RAIDER: {
        prefix: 'EndRaider',
        behavior: 'end_raiding',
        specialization: 'end_dimension',
        rewards: { enderman_kill: 60, dragon_damage: 200 }
    },

    // === RESOURCE SPECIALISTS ===
    GEMOLOGIST: {
        prefix: 'Gemologist',
        behavior: 'gem_mining',
        targets: ['diamond_ore', 'emerald_ore', 'lapis_ore', 'redstone_ore'],
        specialization: 'rare_resources',
        rewards: { gem_found: 40 }
    },
    FOSSIL_HUNTER: {
        prefix: 'Paleontologist',
        behavior: 'fossil_hunting',
        targets: ['bone', 'bone_block'],
        specialization: 'archaeology',
        rewards: { fossil_found: 35 }
    },
    TREASURE_HUNTER: {
        prefix: 'TreasureHunter',
        behavior: 'treasure_hunting',
        specialization: 'loot_finding',
        rewards: { chest_found: 50, buried_treasure: 100 }
    },

    // === AGRICULTURAL ===
    BEEKEEPER: {
        prefix: 'Beekeeper',
        behavior: 'beekeeping',
        targets: ['bee_nest', 'beehive'],
        specialization: 'honey_production',
        rewards: { honey_collected: 25, bee_bred: 30, hive_built: 40 }
    },
    RANCHER: {
        prefix: 'Rancher',
        behavior: 'ranching',
        targets: ['cow', 'pig', 'chicken', 'sheep'],
        specialization: 'livestock',
        rewards: { animal_fed: 10, animal_bred: 25, pen_built: 35 }
    },
    FORAGER: {
        prefix: 'Forager',
        behavior: 'foraging',
        targets: ['mushroom', 'flower', 'berry'],
        specialization: 'wild_gathering',
        rewards: { item_foraged: 12, rare_item: 20 }
    }
};

// McMMO Skill System - Based on https://wiki.mcmmo.org/skills
const MCMMO_SKILLS = {
    // Combat Skills
    ARCHERY: { category: 'combat', xpPerAction: 10, abilities: ['Skill Shot', 'Daze', 'Retrieve'] },
    AXES: { category: 'combat', xpPerAction: 10, abilities: ['Skull Splitter', 'Critical Strikes', 'Armor Impact'] },
    SWORDS: { category: 'combat', xpPerAction: 10, abilities: ['Serrated Strikes', 'Counter Attack', 'Bleed'] },
    TAMING: { category: 'combat', xpPerAction: 15, abilities: ['Beast Lore', 'Call of the Wild', 'Gore'] },
    UNARMED: { category: 'combat', xpPerAction: 8, abilities: ['Berserk', 'Disarm', 'Iron Arm'] },

    // Gathering Skills
    EXCAVATION: { category: 'gathering', xpPerAction: 12, abilities: ['Giga Drill Breaker', 'Treasure Hunter'] },
    FISHING: { category: 'gathering', xpPerAction: 20, abilities: ['Treasure Hunter', 'Ice Fishing', 'Master Angler'] },
    HERBALISM: { category: 'gathering', xpPerAction: 10, abilities: ['Green Terra', 'Green Thumb', 'Hylian Luck'] },
    MINING: { category: 'gathering', xpPerAction: 10, abilities: ['Super Breaker', 'Double Drops', 'Blast Mining'] },
    WOODCUTTING: { category: 'gathering', xpPerAction: 10, abilities: ['Tree Feller', 'Leaf Blower', 'Double Drops'] },

    // Misc Skills
    ACROBATICS: { category: 'misc', xpPerAction: 5, abilities: ['Roll', 'Graceful Roll', 'Dodge'] },
    ALCHEMY: { category: 'misc', xpPerAction: 15, abilities: ['Catalysis', 'Concoctions'] },
    REPAIR: { category: 'misc', xpPerAction: 20, abilities: ['Repair Mastery', 'Super Repair', 'Arcane Forging'] },
    SMELTING: { category: 'misc', xpPerAction: 15, abilities: ['Fuel Efficiency', 'Second Smelt'] },
    SALVAGE: { category: 'misc', xpPerAction: 18, abilities: ['Advanced Salvage', 'Arcane Salvage'] }
};

// Agent skill mapping - which McMMO skills apply to each agent type
const AGENT_SKILL_MAPPING = {
    MINING: ['MINING', 'EXCAVATION'],
    LUMBERJACK: ['WOODCUTTING'],
    FISHING: ['FISHING'],
    FARMING: ['HERBALISM'],
    QUARRY: ['MINING', 'EXCAVATION'],
    HUNTING: ['SWORDS', 'ARCHERY', 'AXES'],
    GUARD: ['SWORDS', 'AXES', 'UNARMED'],
    ARCHER: ['ARCHERY'],
    KNIGHT: ['SWORDS', 'AXES'],
    EXPLORING: ['ACROBATICS'],
    SCOUT: ['ACROBATICS'],
    SPELUNKER: ['MINING', 'ACROBATICS'],
    BLACKSMITH: ['REPAIR', 'SMELTING'],
    BAKER: ['ALCHEMY'],
    BUILDER: ['REPAIR'],
    TOOLMAKER: ['REPAIR', 'SALVAGE'],
    TRADER: [],
    HEALER: ['ALCHEMY'],
    SHEPHERD: ['TAMING'],
    ALCHEMIST: ['ALCHEMY'],
    ENCHANTER: [],
    REDSTONE_ENGINEER: [],
    CARTOGRAPHER: [],
    NETHER_EXPLORER: ['ACROBATICS', 'SWORDS'],
    END_RAIDER: ['SWORDS', 'ARCHERY'],
    GEMOLOGIST: ['MINING'],
    FOSSIL_HUNTER: ['EXCAVATION'],
    TREASURE_HUNTER: ['EXCAVATION'],
    BEEKEEPER: ['HERBALISM'],
    RANCHER: ['TAMING'],
    FORAGER: ['HERBALISM']
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Populate agent types table
function initializeAgentTypes() {
    Object.entries(AGENT_TYPES).forEach(([typeKey, typeConfig]) => {
        const targetsJson = JSON.stringify(typeConfig.targets || []);
        const rewardsJson = JSON.stringify(typeConfig.rewards || {});

        db.run(`INSERT OR REPLACE INTO agent_types (agent_type, prefix, behavior, specialization, targets, rewards)
                VALUES (?, ?, ?, ?, ?, ?)`,
            [typeKey, typeConfig.prefix, typeConfig.behavior, typeConfig.specialization, targetsJson, rewardsJson]);
    });
}

// Load conversation history from database
function loadConversationHistory(playerName, agentName, limit = 20) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT role, message FROM player_agent_conversations
                WHERE player_name = ? AND agent_name = ?
                ORDER BY timestamp DESC
                LIMIT ?`,
            [playerName, agentName, limit],
            (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Reverse to get chronological order
                    resolve(rows.reverse());
                }
            });
    });
}

// Save conversation message to database
function saveConversationMessage(playerName, agentName, role, message) {
    db.run(`INSERT INTO player_agent_conversations (player_name, agent_name, role, message, timestamp)
            VALUES (?, ?, ?, ?, ?)`,
        [playerName, agentName, role, message, Date.now()]);
}

// Sleep helper
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// UUID MANAGEMENT SYSTEM
// ============================================================================

const UUID_CACHE = []; // Cache fetched UUIDs (maintains order for sequential fallback)
const PLAYER_NAME_CACHE = new Map(); // Cache UUID -> player name mapping

/**
 * Fetch a chunk of UUIDs from TheKhosa/MC-UUID repository
 * Chunks are numbered chunk_0001.txt to chunk_0675.txt
 */
async function fetchUUIDChunk() {
    const chunkNum = Math.floor(Math.random() * 675) + 1; // Random chunk 1-675
    const chunkStr = `chunk_${String(chunkNum).padStart(4, '0')}`;
    const url = `https://raw.githubusercontent.com/TheKhosa/MC-UUID/main/chunks/${chunkStr}.txt`;

    console.log(`[UUID] Fetching UUIDs from ${chunkStr}...`);

    try {
        const response = await axios.get(url, { timeout: 10000 });
        const uuids = response.data.trim().split('\n').filter(uuid => uuid.length > 0);

        console.log(`[UUID] Loaded ${uuids.length} UUIDs from ${chunkStr}`);

        // Add to cache
        UUID_CACHE.push(...uuids);

        return uuids;
    } catch (error) {
        console.error(`[UUID] Failed to fetch ${chunkStr}: ${error.message}`);
        return [];
    }
}

/**
 * Get next UUID sequentially from cache
 * Fetches new chunk if cache is empty
 */
function getNextUUID() {
    if (UUID_CACHE.length === 0) {
        return null; // Caller should fetch new chunk
    }
    return UUID_CACHE.shift(); // Get first UUID and remove from cache
}

/**
 * Get player name from UUID using Mojang session server
 * Returns null if UUID doesn't exist (404) - allows fallback to next UUID
 */
async function getPlayerNameFromUUID(uuid) {
    const url = `https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`;

    try {
        const response = await axios.get(url, { timeout: 5000 });
        if (response.data && response.data.name) {
            const playerName = response.data.name;
            PLAYER_NAME_CACHE.set(uuid, playerName);
            return playerName;
        }
        return null;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            // UUID doesn't exist - return null to try next one
            return null;
        }
        console.error(`[UUID] Error fetching player name for ${uuid}: ${error.message}`);
        return null;
    }
}

/**
 * Generate agent name with UUID-based real Minecraft player names
 * Uses sequential fallback through UUIDs until a valid name is found
 */
async function generateAgentName(agentType, generation, parentUUID, callback) {
    const typeConfig = AGENT_TYPES[agentType];
    if (!typeConfig) {
        throw new Error(`Unknown agent type: ${agentType}`);
    }

    const prefix = typeConfig.prefix;
    let finalName = null;
    let finalUUID = null;

    // Try up to 3 chunks (300 UUIDs total) before falling back
    const maxChunks = 3;
    let chunksFetched = 0;

    while (!finalName && chunksFetched < maxChunks) {
        // Fetch chunk if cache is empty
        if (UUID_CACHE.length === 0) {
            await fetchUUIDChunk();
            chunksFetched++;
        }

        // Try UUIDs sequentially from cache
        while (UUID_CACHE.length > 0 && !finalName) {
            const uuid = getNextUUID();
            if (!uuid) break;

            // Query Mojang API
            const playerName = await getPlayerNameFromUUID(uuid);

            if (playerName) {
                finalName = playerName;
                finalUUID = uuid;
                console.log(`[UUID] Found valid player: ${playerName} (UUID: ${uuid})`);
                break;
            } else {
                // 404 or invalid - try next UUID in sequence
                console.log(`[UUID] UUID ${uuid} invalid or not found, trying next...`);
            }
        }
    }

    // Fallback to generated name if all chunks exhausted
    if (!finalName) {
        console.log(`[UUID] WARNING: Exhausted ${chunksFetched} chunks, falling back to generated name`);

        // Get next counter for this type
        const counter = await new Promise((resolve, reject) => {
            db.get(`SELECT counter FROM agent_counters WHERE agent_type = ?`, [agentType], (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.counter + 1 : 1);
            });
        });

        // Update counter
        await new Promise((resolve, reject) => {
            db.run(`INSERT OR REPLACE INTO agent_counters (agent_type, counter) VALUES (?, ?)`,
                [agentType, counter],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                });
        });

        finalName = `${prefix}_${counter}`;
        finalUUID = null; // No real UUID for fallback names
    }

    // Call callback with final name and UUID
    callback(finalName, finalUUID);
}

// ============================================================================
// REWARD SYSTEM
// ============================================================================

const REWARD_CONFIG = {
    SURVIVAL_PER_STEP: config.ml.rewards.survival,
    INVENTORY_PICKUP: config.ml.rewards.inventoryPickup,
    TOOL_CRAFTING: config.ml.rewards.toolCrafting,
    EXPLORATION: config.ml.rewards.exploration,
    MOVEMENT: config.ml.rewards.movement,
    SOCIAL_INTERACTION: config.ml.rewards.socialInteraction,
    KNOWLEDGE_SHARE: config.ml.rewards.knowledgeShare,
    LEARNING: config.ml.rewards.learning
};

class AgentRewardTracker {
    constructor(agentName) {
        this.agentName = agentName;
        this.totalReward = 0;
        this.stats = {
            survival_time: 0,
            resources_gathered: 0,
            mobs_killed: 0,
            trades_completed: 0,
            knowledge_shared: 0,
            distance_traveled: 0
        };
    }

    addReward(amount, reason = '') {
        this.totalReward += amount;
        if (config.debug.logRewards && reason) {
            console.log(`[REWARD] ${this.agentName}: +${amount.toFixed(2)} (${reason}) Total: ${this.totalReward.toFixed(2)}`);
        }
    }

    incrementStat(statName, amount = 1) {
        if (this.stats[statName] !== undefined) {
            this.stats[statName] += amount;
        }
    }

    getStats() {
        return {
            total_reward: this.totalReward,
            ...this.stats
        };
    }
}

// ============================================================================
// FITNESS TRACKER (FOR GENETIC EVOLUTION)
// ============================================================================

class FitnessTracker {
    constructor() {
        this.agentFitness = new Map(); // agentType -> {name, fitness, brain}
    }

    updateFitness(agentTypeOrBot, fitnessData = null) {
        // Handle both bot objects and raw fitness data
        if (typeof agentTypeOrBot === 'object' && agentTypeOrBot.agentType) {
            // It's a bot object
            const bot = agentTypeOrBot;
            const fitness = this.calculateFitness(bot);
            const agentType = bot.agentType;

            if (!this.agentFitness.has(agentType)) {
                this.agentFitness.set(agentType, []);
            }

            const fitnessArray = this.agentFitness.get(agentType);
            const existing = fitnessArray.find(f => f.name === bot.agentName);

            if (existing) {
                existing.fitness = fitness.total;
                existing.fitnessData = fitness;
            } else {
                fitnessArray.push({
                    name: bot.agentName,
                    type: agentType,
                    uuid: bot.uuid,
                    generation: bot.generation,
                    fitness: fitness.total,
                    fitnessData: fitness,
                    brain: bot.brain || null
                });
            }
        } else {
            // It's raw data (agentType string + fitnessData object)
            const agentType = agentTypeOrBot;
            if (!this.agentFitness.has(agentType)) {
                this.agentFitness.set(agentType, []);
            }

            const fitnessArray = this.agentFitness.get(agentType);
            fitnessArray.push(fitnessData);
        }
    }

    calculateFitness(bot) {
        const stats = bot.rewards.getStats();
        const health = bot.health || 0;

        // Fitness = weighted sum of:
        // - Reward (primary metric)
        // - Survival time
        // - Health
        const fitness = {
            reward: stats.total_reward,
            survival: stats.survival_time * 0.1,
            health: health * 0.5,
            total: stats.total_reward + (stats.survival_time * 0.1) + (health * 0.5)
        };

        return fitness;
    }

    getGeneticTemplate(agentType) {
        const fitnessArray = this.agentFitness.get(agentType);
        if (!fitnessArray || fitnessArray.length === 0) {
            return null;
        }

        // Return fittest agent of this type
        return fitnessArray.reduce((best, current) => {
            return current.fitness > best.fitness ? current : best;
        });
    }

    getAllRankings() {
        const allAgents = [];
        for (const [type, agents] of this.agentFitness.entries()) {
            allAgents.push(...agents);
        }

        return allAgents.sort((a, b) => b.fitness - a.fitness);
    }
}

const fitnessTracker = new FitnessTracker();

// ============================================================================
// STUCK DETECTION
// ============================================================================

class StuckDetector {
    constructor(bot) {
        this.bot = bot;
        this.lastPosition = null;
        this.stuckTime = 0;
        this.lastMoveTime = Date.now();
        this.enabled = config.features.enableStuckDetection;
    }

    update() {
        if (!this.enabled) return false;

        const currentPos = this.bot.entity.position;
        const now = Date.now();

        if (!this.lastPosition) {
            this.lastPosition = currentPos.clone();
            return false;
        }

        const distance = currentPos.distanceTo(this.lastPosition);

        if (distance < 0.5) {
            // Agent hasn't moved much
            this.stuckTime += (now - this.lastMoveTime);
        } else {
            // Agent moved
            this.stuckTime = 0;
        }

        this.lastPosition = currentPos.clone();
        this.lastMoveTime = now;

        // Check if stuck for too long
        if (this.stuckTime > config.agents.stuckDetectionTime) {
            return true;
        }

        return false;
    }

    reset() {
        this.stuckTime = 0;
        this.lastPosition = null;
        this.lastMoveTime = Date.now();
    }
}

// ============================================================================
// MOOD SYSTEM
// ============================================================================

function getMoodDescription(moods) {
    const { happiness, stress, motivation } = moods;

    if (happiness > 0.7) return 'happy';
    if (stress > 0.7) return 'stressed';
    if (motivation < 0.3) return 'unmotivated';
    if (happiness < 0.3) return 'sad';

    return 'neutral';
}

// ============================================================================
// AGENT CREATION & LIFECYCLE
// ============================================================================

/**
 * Create a new agent bot
 * @param {string} agentType - Type of agent (MINING, LUMBERJACK, etc.)
 * @param {object} serverConfig - Server connection config
 * @param {string} parentName - Parent agent name (for offspring)
 * @param {number} generation - Generation number
 * @param {string} parentUUID - Parent UUID (for lineage tracking)
 * @param {function} callback - Callback when agent is ready
 */
function createAgent(agentType, serverConfig, parentName = null, generation = 1, parentUUID = null, callback = null) {
    return new Promise((resolve, reject) => {
        generateAgentName(agentType, generation, parentUUID, (agentName, agentUUID) => {
            console.log(`[SPAWN] Creating ${agentName} (Gen ${generation})${parentName ? ` from ${parentName}` : ''}`);

            // Create bot
            console.log(`[SPAWN] Connecting to ${serverConfig.host}:${serverConfig.port} as ${agentName}...`);
            const bot = mineflayer.createBot({
                host: serverConfig.host,
                port: serverConfig.port,
                username: agentName,
                version: '1.21',  // Fix protocol version detection for Spigot 1.21.10
                auth: 'offline',
                hideErrors: false,
                logErrors: true,
                checkTimeoutInterval: 60000
            });

                // Agent metadata
                bot.agentName = agentName;
                bot.agentType = agentType;
                bot.generation = generation;
                bot.parentName = parentName;
                bot.uuid = agentUUID;
                bot.parentUUID = parentUUID;

                // Initialize systems
                bot.rewards = new AgentRewardTracker(agentName);
                bot.ai = new AgentAI(agentName, agentType);
                bot.actionChat = new AgentActionChat(agentName, agentType);
                bot.stuckDetector = new StuckDetector(bot);
                bot.villageKnowledge = villageKnowledge;

                // ML Systems
                bot.actionSpace = new ActionSpace();
                bot.stateEncoder = new StateEncoder();

                // Initialize Plugin Sensor Client (if enabled)
                if (config.plugin.enabled) {
                    bot.pluginSensorClient = new PluginSensorClient(config.plugin);
                    bot.pluginSensorData = null; // Will store latest sensor data
                }

                // Initialize subagent system (DISABLED FOR DEBUGGING)
                // bot.subagentManager = new SubagentManager(bot, agentType, {
                //     agentTypes: AGENT_TYPES
                // });

                // McMMO skills
                bot.skills = {};
                const agentSkills = AGENT_SKILL_MAPPING[agentType] || [];
                agentSkills.forEach(skill => {
                    bot.skills[skill] = {
                        level: 1,
                        xp: 0,
                        totalActions: 0
                    };
                });

                // Generate personality for agent
                if (mlPersonality) {
                    let parentPersonality = null;

                    // Try to get parent personality if this is an offspring
                    if (parentName && parentUUID && generation > 1) {
                        const parentData = agentPopulation.get(parentName);
                        if (parentData && parentData.personality) {
                            parentPersonality = parentData.personality;
                            console.log(`[ML_PERSONALITY] ${agentName} inheriting from ${parentName}`);
                        }
                    }

                    bot.personality = mlPersonality.generateAgentPersonality(
                        agentUUID || agentName,
                        agentName,
                        generation,
                        parentPersonality,
                        0.3 // mutation rate
                    );

                    // Store personality snapshot in memory system
                    if (memorySystem && agentUUID) {
                        memorySystem.savePersonalitySnapshot(
                            agentUUID,
                            agentName,
                            generation,
                            bot.personality,
                            parentUUID,
                            0.3
                        ).catch(err => console.error('[ML_PERSONALITY] Failed to save snapshot:', err.message));
                    }
                }

                // Load plugins
                bot.loadPlugin(pathfinder);
                bot.loadPlugin(toolPlugin);

                // Set up spawn timeout
                const spawnTimeout = setTimeout(() => {
                    console.error(`[SPAWN TIMEOUT] ${agentName} failed to spawn within 60 seconds`);
                    bot.quit();
                    reject(new Error(`Spawn timeout for ${agentName}`));
                }, 60000);

                // Resolve on spawn
                bot.once('spawn', () => {
                    clearTimeout(spawnTimeout);
                    console.log(`[SPAWN SUCCESS] ${agentName} spawned successfully`);

                    // Register in lineage tracker
                    if (lineageTracker) {
                        lineageTracker.registerAgent(agentType, agentName, generation, parentName, parentUUID);
                    }

                    // Initialize pathfinder
                    const movements = new Movements(bot);
                    bot.pathfinder.setMovements(movements);

                    // Connect to Plugin Sensor Server (if enabled)
                    if (config.plugin.enabled && bot.pluginSensorClient) {
                        console.log(`[PLUGIN SENSOR] ${bot.agentName} connecting to WebSocket...`);

                        bot.pluginSensorClient.on('connected', () => {
                            console.log(`[PLUGIN SENSOR] ${bot.agentName} WebSocket connected`);
                        });

                        bot.pluginSensorClient.on('authenticated', () => {
                            console.log(`[PLUGIN SENSOR] ${bot.agentName} authenticated, registering...`);
                            bot.pluginSensorClient.registerBot(bot.agentName);
                        });

                        bot.pluginSensorClient.on('registered', (botName) => {
                            console.log(`[PLUGIN SENSOR] ${bot.agentName} registered for sensor updates`);
                        });

                        bot.pluginSensorClient.on('sensor_update', ({ botName, timestamp, data }) => {
                            bot.pluginSensorData = data; // Store latest sensor data for ML state encoding

                            // Optional: Log first update as confirmation
                            if (!bot._firstSensorUpdate) {
                                bot._firstSensorUpdate = true;
                                console.log(`[PLUGIN SENSOR] ${bot.agentName} receiving sensor data (${data.blocks?.length || 0} blocks, ${data.entities?.length || 0} entities)`);
                            }
                        });

                        bot.pluginSensorClient.on('error', (error) => {
                            console.error(`[PLUGIN SENSOR] ${bot.agentName} error: ${error.message}`);
                        });

                        // Connect after setting up event handlers
                        bot.pluginSensorClient.connect();
                    }

                    // Setup event handlers (death, health, etc.)
                    setupAgentEvents(bot);

                    // Start ML behavior loop NOW
                    startAgentBehavior(bot);

                    // Emit to dashboard
                    if (dashboard && dashboard.emitAgentJoined) {
                        dashboard.emitAgentJoined({
                            name: bot.agentName,
                            type: bot.agentType,
                            generation: bot.generation,
                            uuid: bot.uuid,
                            parentUUID: bot.parentUUID
                        });
                    }

                    if (callback) callback(bot);
                    resolve(bot);
                });

                // Handle errors
                bot.once('error', (err) => {
                    clearTimeout(spawnTimeout);
                    console.error(`[SPAWN ERROR] ${agentName}: ${err.message}`);
                    reject(err);
                });

                bot.once('kicked', (reason) => {
                    clearTimeout(spawnTimeout);
                    console.error(`[SPAWN KICKED] ${agentName}: ${reason}`);
                    reject(new Error(`Kicked: ${reason}`));
                });
            });
    });
}

// ============================================================================
// AGENT EVENT HANDLERS
// ============================================================================

function setupAgentEvents(bot) {
    // Note: Spawn event initialization moved to createAgent() to avoid race condition
    console.log(`[AGENT] ${bot.agentName} setting up event handlers`);

    bot.on('death', () => {
        console.log(`[DEATH] ${bot.agentName} died`);

        // Disconnect plugin sensor client
        if (bot.pluginSensorClient) {
            bot.pluginSensorClient.disconnect();
        }

        // Save personality for offspring inheritance
        if (bot.personality && bot.uuid) {
            if (!agentPopulation.has(bot.agentName)) {
                agentPopulation.set(bot.agentName, {});
            }
            const agentData = agentPopulation.get(bot.agentName);
            agentData.personality = bot.personality;
            console.log(`[ML_PERSONALITY] Saved ${bot.agentName}'s personality for offspring`);
        }

        // Record death in village knowledge
        villageKnowledge.recordDeath(bot.agentName);

        // Update lineage tracker
        if (lineageTracker) {
            lineageTracker.removeAgent(bot.agentType, bot.agentName);
        }

        // Emit to dashboard
        if (dashboard && dashboard.emitAgentLeft) {
            dashboard.emitAgentLeft(bot.agentName);
        }

        // Spawn offspring
        spawnOffspringFromDead({
            name: bot.agentName,
            type: bot.agentType,
            generation: bot.generation,
            uuid: bot.uuid,
            fitness: fitnessTracker.calculateFitness(bot),
            brain: bot.brain,
            personality: bot.personality
        });
    });

    bot.on('health', () => {
        if (bot.health < 5) {
            console.warn(`[HEALTH] ${bot.agentName} low health: ${bot.health}/20`);
        }
    });

    // Chat handler (using ChatManager for queue/rate limiting)
    bot.on('chat', (username, message) => {
        if (username === bot.username) return;

        console.log(`[CHAT] ${username}: ${message}`);

        // Add to AI context
        bot.ai.addMessage(username, message);

        // Check if speaker is another agent
        const isAgent = activeAgents.has(username);

        // Use ChatManager to determine if we should respond
        const responseDecision = chatManager.shouldRespond(bot, username, message, isAgent);

        if (responseDecision.shouldRespond) {
            // Handle quick replies (like "Yes, username?")
            if (responseDecision.quickReply) {
                chatManager.queueMessage(bot, responseDecision.quickReply, {
                    channel: responseDecision.channel,
                    target: responseDecision.target,
                    priority: responseDecision.priority
                });
                return;
            }

            // Build listener context
            const listener = {
                name: username,
                message: message,
                inventory: 'unknown',
                mood: 'unknown'
            };

            const targetBot = activeAgents.get(username);
            if (targetBot) {
                listener.needs = targetBot.moods || {};
                listener.inventory = targetBot.inventory ? targetBot.inventory.items().slice(0, 3).map(item => item.name).join(', ') : 'unknown';
                listener.mood = targetBot.moods ? getMoodDescription(targetBot.moods) : 'neutral';
            }

            // Generate and queue response (async)
            (async () => {
                try {
                    // Load conversation history
                    let conversationHistory = [];
                    try {
                        conversationHistory = await loadConversationHistory(username, bot.agentName, 10);
                    } catch (err) {
                        console.error(`[CHAT] Failed to load conversation history: ${err.message}`);
                    }

                    // Get relationship data
                    let relationshipData = null;
                    if (memorySystem && bot.uuid && targetBot && targetBot.uuid) {
                        try {
                            const relationships = await memorySystem.getRelationships(bot.uuid, 20);
                            relationshipData = relationships.find(r => r.other_agent_uuid === targetBot.uuid);
                        } catch (err) {
                            console.error(`[CHAT] Failed to load relationships: ${err.message}`);
                        }
                    }

                    // Build enriched speaker profile with action context
                    const recentActions = bot.actionChat ? bot.actionChat.recentActions.slice(-5).map(a => ({
                        name: a.name,
                        success: a.success,
                        timeAgo: Math.floor((Date.now() - a.timestamp) / 1000)
                    })) : [];

                    const currentActivity = bot.actionChat ? bot.actionChat.determineActivityPattern() : 'working';

                    const enrichedSpeaker = {
                        name: bot.agentName,
                        type: bot.agentType,
                        role: bot.agentType,
                        health: bot.health || 20,
                        food: bot.food || 20,
                        inventory: bot.inventory ? bot.inventory.items().slice(0, 5) : [],
                        position: bot.entity?.position ? bot.entity.position : null,
                        currentGoal: bot.ai.currentGoal || 'working on assigned tasks',
                        personality: bot.personality || null,
                        needs: bot.moods || {},
                        mood: 'neutral',
                        generation: bot.generation || 1,
                        thoughtProcess: bot.lastThought || 'Exploring the world...',
                        lastThought: bot.lastThought,
                        recentActions: recentActions,
                        currentActivity: currentActivity,
                        conversationHistory: conversationHistory,
                        relationshipWithListener: relationshipData
                    };

                    // Generate response using LLM
                    const response = await bot.ai.chatWithPlayer(bot, username, message, chatLLM, enrichedSpeaker);

                    if (response) {
                        // Save to database
                        saveConversationMessage(username, bot.agentName, 'user', message);
                        saveConversationMessage(username, bot.agentName, 'assistant', response);

                        // Queue message with ChatManager
                        chatManager.queueMessage(bot, response, {
                            channel: responseDecision.channel,
                            target: responseDecision.target,
                            priority: responseDecision.priority
                        });
                    }
                } catch (err) {
                    console.error(`[CHAT] Error responding to ${username}: ${err.message}`);
                }
            })();
        }
    });

    // Player join handler - Welcome new players using ChatManager
    bot.on('playerJoined', (player) => {
        if (player.username === bot.username) return; // Don't greet yourself

        // Use ChatManager's greetingResponseChance
        if (Math.random() < chatManager.config.greetingResponseChance) {
            // Generate greeting asynchronously
            setTimeout(async () => {
                try {
                    // Build speaker profile for LLM
                    const speaker = {
                        name: bot.agentName,
                        type: bot.agentType,
                        role: bot.agentType,
                        health: bot.health || 20,
                        food: bot.food || 20,
                        inventory: bot.inventory ? bot.inventory.items().slice(0, 5) : [],
                        position: bot.entity?.position ? bot.entity.position : null,
                        currentGoal: bot.ai.currentGoal || 'working on assigned tasks',
                        personality: bot.personality || null,
                        needs: bot.moods || {},
                        mood: 'neutral',
                        generation: bot.generation || 1
                    };

                    // Build listener profile
                    const listener = {
                        name: player.username,
                        message: `${player.username} has just joined the server`,
                        inventory: 'unknown',
                        mood: 'unknown',
                        needs: {}
                    };

                    // Generate welcome message using LLM
                    let greeting = null;
                    if (chatLLM) {
                        greeting = await chatLLM.generateDialogue(speaker, listener, 'player_conversation');
                    } else {
                        greeting = `Welcome ${player.username}!`;
                    }

                    if (greeting) {
                        // Queue message via ChatManager
                        chatManager.queueMessage(bot, greeting, {
                            channel: 'global',
                            priority: 3
                        });
                    }
                } catch (error) {
                    console.error(`[WELCOME] Error generating welcome for ${player.username}: ${error.message}`);
                }
            }, 2000 + Math.random() * 3000); // 2-5 second delay
        }
    });
}

// ============================================================================
// AGENT BEHAVIOR LOOP
// ============================================================================

async function startAgentBehavior(bot) {
    console.log(`[BEHAVIOR] ${bot.agentName} behavior loop started`);

    // Initialize idle tracking
    bot.lastActionTime = Date.now();
    bot.totalIdleTime = 0;

    // Periodic survival reward, stuck detection, and idle penalty
    setInterval(() => {
        if (bot.health > 0) {
            bot.rewards.addReward(REWARD_CONFIG.SURVIVAL_PER_STEP, 'survival');
            bot.rewards.incrementStat('survival_time', 1);
        }

        // Check if stuck
        if (bot.stuckDetector.update()) {
            console.warn(`[STUCK] ${bot.agentName} is stuck! Attempting to unstuck...`);
            bot.rewards.addReward(config.agents.stuckPenalty, 'stuck penalty');

            // Simple unstuck: jump
            bot.setControlState('jump', true);
            setTimeout(() => {
                bot.setControlState('jump', false);
            }, 500);

            bot.stuckDetector.reset();
        }

        // IF YOU AIN'T LEARNING, YOU DYING - Idle penalty system
        if (config.features.enableIdlePenalty) {
            const now = Date.now();
            const timeSinceLastAction = now - bot.lastActionTime;

            if (timeSinceLastAction > config.features.idleThreshold) {
                // Agent is idle - apply penalty
                bot.totalIdleTime += config.agents.rewardUpdateInterval;
                bot.rewards.addReward(config.features.idlePenaltyAmount, 'IDLE PENALTY - move or die!');

                if (bot.totalIdleTime % 30000 === 0) { // Log every 30 seconds
                    console.warn(`[IDLE] ${bot.agentName} has been idle for ${(bot.totalIdleTime / 1000).toFixed(0)}s! Reward: ${bot.rewards.totalReward.toFixed(1)}`);
                }
            } else {
                bot.totalIdleTime = 0; // Reset if agent took action
            }
        }
    }, config.agents.rewardUpdateInterval);

    // ML Decision-Making Loop - Every 3 seconds, let ML choose an action
    console.log(`[ML LOOP CHECK] ${bot.agentName} - ML_ENABLED: ${ML_ENABLED}, mlTrainer: ${!!mlTrainer}, actionSpace: ${!!bot.actionSpace}`);
    if (ML_ENABLED && mlTrainer && bot.actionSpace) {
        console.log(`[ML LOOP] Starting ML decision loop for ${bot.agentName}`);
        setInterval(async () => {
            try {
                console.log(`[ML LOOP] Tick for ${bot.agentName} - Health: ${bot.health}, Has entity: ${!!bot.entity}, Has position: ${!!bot.entity?.position}`);
                if (bot.health > 0 && bot.entity && bot.entity.position) {
                    // Use mlTrainer.agentStep() - the CORRECT entry point for ML decision loop
                    // This method handles:
                    // - State encoding
                    // - Hierarchical brain action selection (SQLite + Shared + Personal)
                    // - Action execution via ActionSpace
                    // - Experience recording for training
                    // - Periodic training updates
                    const stepResult = await mlTrainer.agentStep(bot);

                    if (stepResult) {
                        const { action, actionName, value, success, wasExploring } = stepResult;

                        // Update bot's thought process
                        if (wasExploring) {
                            bot.lastThought = `Exploring new strategies... trying ${actionName}`;
                        } else {
                            bot.lastThought = `My training suggests ${actionName} (value: ${(value || 0).toFixed(2)})`;
                        }

                        bot.lastAction = actionName;

                        // Record action for enriched chat system
                        if (bot.actionChat && success) {
                            bot.actionChat.recordAction(action, actionName, success, {
                                position: bot.entity?.position,
                                health: bot.health,
                                inventory: bot.inventory?.items().length || 0
                            });
                        }

                        // Update last action time for idle detection
                        if (success) {
                            bot.lastActionTime = Date.now();

                            // Record experience for personality evolution
                            if (mlPersonality && bot.personality) {
                                const activityMap = {
                                    'mine': 'mining',
                                    'chop': 'gathering',
                                    'dig': 'mining',
                                    'attack': 'fighting',
                                    'craft': 'crafting',
                                    'fish': 'fishing'
                                };

                                for (const [key, activity] of Object.entries(activityMap)) {
                                    if (actionName.includes(key)) {
                                        mlPersonality.recordExperience(
                                            bot.uuid || bot.agentName,
                                            bot.personality,
                                            'activities',
                                            activity,
                                            true,
                                            0.02
                                        );
                                        break;
                                    }
                                }
                            }
                        } else {
                            bot.lastThought = `${actionName} didn't work out. Learning from this...`;
                        }
                    }
                }
            } catch (error) {
                // Handle ML errors gracefully
                bot.lastThought = `Error during decision making: ${error.message}`;
                console.error(`[ML] ${bot.agentName} decision error: ${error.message}`);
                console.error(error.stack);
            }
        }, 3000); // Every 3 seconds
    }
