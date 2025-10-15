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
let chatLLM = null;
let downloadManager = null;

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
                existing.fitness = fitness;
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
                bot.stuckDetector = new StuckDetector(bot);
                bot.villageKnowledge = villageKnowledge;

                // ML Systems
                bot.actionSpace = new ActionSpace();
                bot.stateEncoder = new StateEncoder();

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

                    // Setup event handlers AFTER spawn
                    setupAgentEvents(bot);

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
    bot.once('spawn', () => {
        console.log(`[AGENT] ${bot.agentName} joined the server`);

        // Initialize pathfinder
        const movements = new Movements(bot);
        bot.pathfinder.setMovements(movements);

        // Start agent behavior loop
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
    });

    bot.on('death', () => {
        console.log(`[DEATH] ${bot.agentName} died`);

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

    // Chat handler
    bot.on('chat', (username, message) => {
        if (username === bot.username) return;

        console.log(`[CHAT] ${username}: ${message}`);

        // Add to AI context
        bot.ai.addMessage(username, message);

        const lowerMessage = message.toLowerCase();
        const myName = bot.agentName.toLowerCase();

        // Filter out name-only messages (just mentioning the agent name)
        const isNameOnly = lowerMessage.trim() === myName.trim();
        if (isNameOnly) {
            // Simple acknowledgment for name-only mentions
            setTimeout(() => {
                bot.chat(`Yes, ${username}?`);
                console.log(`[CHAT] ${bot.agentName} → ${username}: "Yes, ${username}?"`);
            }, 500 + Math.random() * 1000);
            return;
        }

        // Respond if:
        // 1. Mentioned by name
        // 2. General greeting to everyone
        // 3. Another agent talking (30% chance to join conversation)
        const isMentioned = lowerMessage.includes(myName);
        const isGreeting = lowerMessage.includes('hello') || lowerMessage.includes('hi ') || lowerMessage.includes('hey');
        const isAgent = activeAgents.has(username); // Check if speaker is another agent
        const shouldRespond = isMentioned ||
                             (isGreeting && !lowerMessage.includes('there')) || // "Hi" but not "Hi there"
                             (isAgent && Math.random() < 0.3); // 30% chance to respond to agents

        if (shouldRespond) {
            const listener = {
                name: username,
                message: message,
                inventory: 'unknown',
                mood: 'unknown'
            };

            // Check if this is a real player or another agent
            const targetBot = activeAgents.get(username);
            if (targetBot) {
                // It's another agent - add more context
                listener.needs = targetBot.moods || {};
                listener.inventory = targetBot.inventory ? targetBot.inventory.items().slice(0, 3).map(item => item.name).join(', ') : 'unknown';
                listener.mood = targetBot.moods ? getMoodDescription(targetBot.moods) : 'neutral';
            }

            // Build enriched speaker profile with thought process and conversation history
            (async () => {
                try {
                    // Load conversation history from database
                    let conversationHistory = [];
                    try {
                        conversationHistory = await loadConversationHistory(username, bot.agentName, 10);
                    } catch (err) {
                        console.error(`[CHAT] Failed to load conversation history: ${err.message}`);
                    }

                    // Get relationship data from memory system
                    let relationshipData = null;
                    if (memorySystem && bot.uuid && targetBot && targetBot.uuid) {
                        try {
                            const relationships = await memorySystem.getRelationships(bot.uuid, 20);
                            relationshipData = relationships.find(r => r.other_agent_uuid === targetBot.uuid);
                        } catch (err) {
                            console.error(`[CHAT] Failed to load relationships: ${err.message}`);
                        }
                    }

                    // Build speaker profile with ALL context
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
                        conversationHistory: conversationHistory,
                        relationshipWithListener: relationshipData
                    };

                    const response = await bot.ai.chatWithPlayer(bot, username, message, chatLLM, enrichedSpeaker);
                    if (response) {
                        // Save conversation to database
                        saveConversationMessage(username, bot.agentName, 'user', message);
                        saveConversationMessage(username, bot.agentName, 'assistant', response);

                        // Add small random delay to make conversations feel more natural
                        const delay = 500 + Math.random() * 1500; // 0.5-2 seconds
                        setTimeout(() => {
                            bot.chat(response);
                            console.log(`[CHAT] ${bot.agentName} → ${username}: "${response}"`);
                        }, delay);
                    }
                } catch (err) {
                    console.error(`[CHAT] Error responding to ${username}: ${err.message}`);
                }
            })();
        }
    });

    // Player join handler - Welcome new players and bots using LLM
    bot.on('playerJoined', (player) => {
        if (player.username === bot.username) return; // Don't greet yourself

        // 50% chance to greet newcomers
        if (Math.random() < 0.5) {
            // Wait a bit before welcoming (more natural)
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
                    const greeting = await chatLLM.generateDialogue(speaker, listener, 'player_conversation');

                    if (greeting) {
                        bot.chat(greeting);
                        console.log(`[WELCOME] ${bot.agentName} welcomed ${player.username}: "${greeting}"`);
                    }
                } catch (error) {
                    console.error(`[WELCOME] Error generating welcome for ${player.username}: ${error.message}`);
                    // Simple fallback only on error
                    bot.chat(`Welcome ${player.username}!`);
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

    // Periodic survival reward and stuck detection
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
    }, config.agents.rewardUpdateInterval);

    // ML Decision-Making Loop - Every 3 seconds, let ML choose an action
    if (ML_ENABLED && mlTrainer && bot.actionSpace) {
        setInterval(async () => {
            try {
                if (bot.health > 0 && bot.entity && bot.entity.position) {
                    // Encode current state
                    const state = bot.stateEncoder.encodeState(bot);

                    // Get ML action from trainer
                    const actionResult = mlTrainer.selectActionForAgent(bot.agentName, bot.agentType, state);
                    const actionId = actionResult.action;

                    // Apply personality bias if available
                    let finalActionId = actionId;
                    let thoughtProcess = 'Deciding next action...';

                    if (bot.personality && mlPersonality) {
                        const actions = [{ id: actionId, type: bot.actionSpace.getActionName(actionId), probability: 1.0 }];
                        const biasedActions = mlPersonality.getPersonalityBiasedActions(bot.personality, actions);
                        if (biasedActions.length > 0) {
                            finalActionId = biasedActions[0].id;
                            thoughtProcess = `My personality drives me to ${bot.actionSpace.getActionName(finalActionId)}`;
                        }
                    }

                    // Execute the action
                    const actionName = bot.actionSpace.getActionName(finalActionId);

                    // Update bot's thought process and current action
                    bot.lastAction = actionName;
                    bot.lastThought = thoughtProcess;

                    const success = await bot.actionSpace.executeAction(finalActionId, bot);

                    // Give reward for action
                    if (success) {
                        const actionReward = REWARD_CONFIG.MOVEMENT;
                        bot.rewards.addReward(actionReward, `action: ${actionName}`);
                        bot.lastThought = `Successfully completed ${actionName}! Reward: +${actionReward.toFixed(2)}`;

                        // Record experience for ML learning
                        // NOTE: Experience tracking is already handled by mlTrainer.agentStep()
                        // No need to manually store experiences here

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
                        bot.lastThought = `Failed to execute ${actionName}. Trying something else...`;
                    }
                }
            } catch (error) {
                // Silently handle ML errors - agent continues with basic behavior
                bot.lastThought = `Error during decision making: ${error.message}`;
                console.error(`[ML] ${bot.agentName} decision error: ${error.message}`);
            }
        }, 3000); // Every 3 seconds
    }
}

// ============================================================================
// OFFSPRING SYSTEM
// ============================================================================

function spawnOffspringFromDead(parentInfo) {
    console.log(`[OFFSPRING] Preparing offspring for ${parentInfo.name}...`);

    // Get genetic template (fittest agent of this type)
    const fittestTemplate = fitnessTracker.getGeneticTemplate(parentInfo.type);
    const geneticParentUUID = fittestTemplate ? fittestTemplate.uuid : parentInfo.uuid;
    const geneticParentName = fittestTemplate ? fittestTemplate.name : parentInfo.name;
    const nextGeneration = parentInfo.generation + 1;

    if (fittestTemplate) {
        console.log(`[OFFSPRING] Using genetic template: ${fittestTemplate.name} (Fitness: ${fittestTemplate.fitness.toFixed(2)})`);
    }

    // Spawn offspring
    createAgent(
        parentInfo.type,
        config.server,
        geneticParentName,
        nextGeneration,
        geneticParentUUID
    ).then(bot => {
        activeAgents.set(bot.agentName, bot);
        console.log(`[OFFSPRING] ${bot.agentName} Gen ${nextGeneration} spawned successfully`);
    }).catch(err => {
        console.error(`[OFFSPRING] Failed to spawn offspring: ${err.message}`);
    });
}

// ============================================================================
// VILLAGE MANAGEMENT
// ============================================================================

const activeAgents = new Map();
const agentPopulation = new Map();

const lineageTracker = {
    agents: new Map(), // agentType -> [{name, generation, parentName, parentUUID}]

    registerAgent(agentType, agentName, generation, parentName, parentUUID) {
        if (!this.agents.has(agentType)) {
            this.agents.set(agentType, []);
        }
        this.agents.get(agentType).push({
            name: agentName,
            generation,
            parentName,
            parentUUID,
            birthTime: Date.now()
        });
    },

    removeAgent(agentType, agentName) {
        if (!this.agents.has(agentType)) return;
        const agents = this.agents.get(agentType);
        const index = agents.findIndex(a => a.name === agentName);
        if (index !== -1) {
            agents.splice(index, 1);
        }
    },

    getSpawnGeneration(agentType) {
        if (!this.agents.has(agentType)) {
            return { generation: 1, parentInfo: null };
        }

        const agents = this.agents.get(agentType);
        if (agents.length === 0) {
            return { generation: 1, parentInfo: null };
        }

        // Get highest generation
        const maxGen = Math.max(...agents.map(a => a.generation));
        const parentAgent = agents.find(a => a.generation === maxGen);

        return {
            generation: maxGen + 1,
            parentInfo: parentAgent
        };
    }
};

/**
 * Start the village with batch spawning
 */
async function startVillage(serverConfig, agentTypes = ['EXPLORING', 'MINING']) {
    console.log('\n' + '='.repeat(70));
    console.log('INTELLIGENT VILLAGE WITH KNOWLEDGE SHARING');
    console.log('='.repeat(70));
    console.log('Agents will learn from each other\'s experiences');
    console.log('Agents operate autonomously');
    console.log('='.repeat(70));

    // Batch spawning configuration
    const BATCH_SIZE = config.agents.batchSpawnSize;
    const BATCH_DELAY = config.agents.batchSpawnDelay;
    const MAX_RETRIES = 5;

    let spawnQueue = [...agentTypes];
    let failedSpawns = [];
    let totalTarget = agentTypes.length;
    let successCount = 0;
    let attemptCount = new Map();

    console.log(`[BATCH SPAWN] Target: ${totalTarget} agents | Batch size: ${BATCH_SIZE} | Delay: ${BATCH_DELAY}ms`);

    // Process batches
    while (spawnQueue.length > 0 || failedSpawns.length > 0) {
        if (spawnQueue.length === 0 && failedSpawns.length > 0) {
            console.log(`[BATCH SPAWN] Retrying ${failedSpawns.length} failed spawns...`);
            await sleep(30000);
            spawnQueue = [...failedSpawns];
            failedSpawns = [];
        }

        const batch = spawnQueue.splice(0, BATCH_SIZE);
        if (batch.length === 0) break;

        console.log(`[BATCH SPAWN] Processing batch of ${batch.length} agents (${successCount}/${totalTarget} spawned)`);

        const batchPromises = batch.map(async (type) => {
            const attempts = attemptCount.get(type) || 0;
            attemptCount.set(type, attempts + 1);

            try {
                const bot = await createAgent(type, serverConfig, null, 1, null);
                activeAgents.set(bot.agentName, bot);
                agentPopulation.set(bot.agentName, successCount);
                successCount++;
                console.log(`[BATCH SPAWN] ${bot.agentName} spawned successfully (${successCount}/${totalTarget})`);
                return { success: true, type };
            } catch (error) {
                const attemptNum = attemptCount.get(type);
                console.error(`[BATCH SPAWN] Failed to spawn ${type} (attempt ${attemptNum}): ${error.message}`);

                if (attemptNum < MAX_RETRIES) {
                    return { success: false, type, retry: true };
                } else {
                    console.error(`[BATCH SPAWN] ${type} exceeded max retries, skipping`);
                    return { success: false, type, retry: false };
                }
            }
        });

        const results = await Promise.all(batchPromises);

        results.forEach(result => {
            if (!result.success && result.retry) {
                failedSpawns.push(result.type);
            }
        });

        const remaining = spawnQueue.length + failedSpawns.length;
        if (remaining > 0) {
            console.log(`[BATCH SPAWN] Progress: ${successCount}/${totalTarget} | Remaining: ${remaining}`);
            await sleep(BATCH_DELAY);
        }
    }

    console.log(`[BATCH SPAWN] Batch spawn complete! Successfully spawned ${successCount}/${totalTarget} agents`);

    // Village status updates
    setInterval(() => {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`VILLAGE STATUS - ${activeAgents.size} agents`);
        console.log(`${'='.repeat(70)}`);

        const knowledge = villageKnowledge.getSummary();
        console.log(`Collective Knowledge:`);
        console.log(`  Experiences: ${knowledge.totalExperiences} | Generations: ${knowledge.totalGenerations}`);
        console.log(`  Resource Locations: ${knowledge.totalResourceLocations}`);
        console.log(`  Distress Signals: ${knowledge.agentsInDistress}`);

        // Update fitness
        activeAgents.forEach((bot) => {
            fitnessTracker.updateFitness(bot);
        });

        // Show top 5 fittest
        const rankings = fitnessTracker.getAllRankings();
        if (rankings.length > 0) {
            console.log(`\nTop Fitness Rankings:`);
            rankings.slice(0, 5).forEach((rank, index) => {
                console.log(`  ${index + 1}. ${rank.name} [${rank.type}] Gen${rank.generation} - Fitness: ${rank.fitness.toFixed(2)}`);
            });
        }

        console.log(`${'='.repeat(70)}`);
    }, 60000);
}

// ============================================================================
// SYSTEM INITIALIZATION
// ============================================================================

async function initializeSystems() {
    console.log('\n' + '='.repeat(70));
    console.log('MEGA VILLAGE - EVOLUTIONARY AGENT SYSTEM');
    console.log('='.repeat(70));
    console.log('Features:');
    console.log('  - 29 specialized agent types');
    console.log('  - Offspring inherit from fittest parents');
    console.log('  - ML training with PPO');
    console.log('  - Knowledge sharing and collective learning');
    console.log('='.repeat(70) + '\n');

    // Initialize agent types in database
    initializeAgentTypes();

    // Initialize Dashboard (if enabled)
    if (dashboard) {
        dashboard.initDashboard(activeAgents, lineageTracker);
        dashboard.setSpawnCallback(async (agentType) => {
            const { generation, parentInfo } = lineageTracker.getSpawnGeneration(agentType);
            const bot = await createAgent(agentType, config.server, parentInfo?.name || null, generation, parentInfo?.uuid || null);
            activeAgents.set(bot.agentName, bot);
            return bot;
        });
        dashboard.startDashboard();
    }

    // Initialize ML System
    console.log('\n' + '='.repeat(70));
    console.log('[ML SYSTEM] Initializing Machine Learning...');
    console.log('[ML SYSTEM] Algorithm: PPO');
    console.log('[ML SYSTEM] State Space: ' + config.ml.stateSpace);
    console.log('[ML SYSTEM] Action Space: ' + config.ml.actionSpace);
    console.log('='.repeat(70) + '\n');

    try {
        mlTrainer = getMLTrainer();
        console.log('[ML SYSTEM] ML Trainer initialized successfully');

        if (dashboard && dashboard.io) {
            setInterval(() => {
                const stats = mlTrainer.getStats();
                dashboard.io.emit('mlStats', stats);
            }, 5000);
        }
    } catch (error) {
        console.error('[ML SYSTEM] Failed to initialize:', error.message);
        ML_ENABLED = false;
    }

    // Initialize Memory System
    console.log('\n' + '='.repeat(70));
    console.log('[MEMORY] Initializing Episodic Memory System...');
    memorySystem = getMemorySystem();
    await memorySystem.initialize();
    console.log('[MEMORY] Memory system initialized');
    console.log('='.repeat(70) + '\n');

    // Memory decay
    if (config.memory.enabled) {
        setInterval(() => {
            memorySystem.decayMemories(config.memory.decayRate).catch(err => {
                console.error('[MEMORY] Decay error:', err.message);
            });
        }, config.memory.decayInterval);
    }

    // Initialize Chat LLM
    if (config.llm.enabled) {
        console.log('\n' + '='.repeat(70));
        console.log('[CHAT LLM] Initializing Agent Communication...');
        console.log('[CHAT LLM] Backend: ' + config.llm.backend.toUpperCase());
        console.log('='.repeat(70));

        downloadManager = new DownloadManager();
        const prereqsMet = await downloadManager.checkPrerequisites(config.llm.backend);

        if (!prereqsMet) {
            console.error('[CHAT LLM] Prerequisites not met - exiting');
            process.exit(1);
        }

        chatLLM = getChatLLM(config.llm.backend);
        await downloadManager.initializeWithProgress(config.llm.backend, async () => {
            await chatLLM.initialize();
        });

        console.log('[CHAT LLM] Chat system ready');
        console.log('='.repeat(70) + '\n');
    } else {
        console.log('\n' + '='.repeat(70));
        console.log('[CHAT LLM] Agent chat DISABLED in config');
        console.log('[CHAT LLM] Agents will use simple fallback responses');
        console.log('='.repeat(70) + '\n');
        chatLLM = null;  // Set to null when disabled
    }

    // Initialize Personality System
    console.log('\n' + '='.repeat(70));
    console.log('[PERSONALITY] Initializing Personality System...');
    personalitySystem = getPersonalitySystem();
    mlPersonality = getMLPersonality();
    console.log('[PERSONALITY] Personality system active');
    console.log('[PERSONALITY] ML-Personality integration ready');
    console.log('='.repeat(70) + '\n');

    // Initialize Worker Pool (if threading enabled)
    if (config.threading.enabled && mlTrainer && WorkerPoolManager) {
        console.log('\n' + '='.repeat(70));
        console.log('[WORKER POOL] Initializing Multi-Threading...');
        console.log('[WORKER POOL] Max Workers: ' + config.threading.maxWorkers);
        console.log('='.repeat(70) + '\n');

        try {
            workerPool = new WorkerPoolManager(mlTrainer, config.threading.maxWorkers);
            console.log('[WORKER POOL] Worker pool initialized');
        } catch (error) {
            console.error('[WORKER POOL] Failed to initialize:', error.message);
            workerPool = null;
        }
    }
}

// ============================================================================
// EXPRESS API SERVER
// ============================================================================

const express = require('express');
const app = express();
const BRAIN_PORT = 3001; // Use 3001 to avoid conflict with dashboard on 3000

// Middleware
app.use(express.json());

// Brain endpoint - shows all connected agents with their thought process and tasks
app.get('/brain', (req, res) => {
    const agentCards = [];

    activeAgents.forEach((bot, name) => {
        const card = {
            name: bot.agentName,
            type: bot.agentType,
            generation: bot.generation,
            uuid: bot.uuid,
            health: bot.health || 0,
            food: bot.food || 0,
            position: bot.entity?.position ? {
                x: Math.floor(bot.entity.position.x),
                y: Math.floor(bot.entity.position.y),
                z: Math.floor(bot.entity.position.z)
            } : null,
            inventory: bot.inventory ? bot.inventory.items().map(item => ({
                name: item.name,
                count: item.count
            })) : [],
            rewards: bot.rewards ? bot.rewards.getStats() : {},
            skills: bot.skills || {},
            personality: bot.personality ? mlPersonality.getPersonalitySummary(bot.personality) : null,
            currentAction: bot.lastAction || 'idle',
            thoughtProcess: bot.lastThought || 'Exploring the world...',
            tasks: bot.currentTasks || []
        };

        agentCards.push(card);
    });

    // HTML card view
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Agent Brain Monitor</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        .header {
            text-align: center;
            color: white;
            margin-bottom: 30px;
        }
        .header h1 {
            font-size: 3em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .header p {
            font-size: 1.2em;
            opacity: 0.9;
        }
        .stats-bar {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }
        .stat-box {
            background: rgba(255,255,255,0.2);
            backdrop-filter: blur(10px);
            padding: 15px 30px;
            border-radius: 12px;
            color: white;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }
        .stat-box h3 {
            font-size: 0.9em;
            opacity: 0.8;
            margin-bottom: 5px;
        }
        .stat-box p {
            font-size: 2em;
            font-weight: bold;
        }
        .cards-container {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
            gap: 20px;
            max-width: 1600px;
            margin: 0 auto;
        }
        .agent-card {
            background: white;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .agent-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 50px rgba(0,0,0,0.3);
        }
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            padding-bottom: 16px;
            border-bottom: 2px solid #f0f0f0;
        }
        .card-title {
            font-size: 1.5em;
            font-weight: bold;
            color: #333;
        }
        .card-type {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 600;
        }
        .card-section {
            margin-bottom: 16px;
        }
        .section-title {
            font-size: 0.85em;
            font-weight: 600;
            color: #888;
            text-transform: uppercase;
            margin-bottom: 8px;
            letter-spacing: 0.5px;
        }
        .thought-bubble {
            background: #f8f9fa;
            padding: 12px 16px;
            border-radius: 12px;
            border-left: 4px solid #667eea;
            font-style: italic;
            color: #555;
            line-height: 1.5;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
        }
        .stat-item {
            display: flex;
            justify-content: space-between;
            padding: 8px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .stat-label {
            color: #888;
            font-size: 0.9em;
        }
        .stat-value {
            font-weight: bold;
            color: #333;
        }
        .health-bar {
            width: 100%;
            height: 8px;
            background: #f0f0f0;
            border-radius: 4px;
            overflow: hidden;
            margin-top: 4px;
        }
        .health-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #f093fb 0%, #f5576c 100%);
            transition: width 0.3s ease;
        }
        .tasks-list {
            list-style: none;
        }
        .task-item {
            padding: 8px 12px;
            background: #fff3cd;
            border-left: 3px solid #ffc107;
            border-radius: 6px;
            margin-bottom: 6px;
            font-size: 0.9em;
        }
        .personality-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        .personality-tag {
            padding: 4px 10px;
            background: #e3f2fd;
            color: #1976d2;
            border-radius: 12px;
            font-size: 0.8em;
            font-weight: 500;
        }
        .no-agents {
            text-align: center;
            color: white;
            font-size: 1.5em;
            margin-top: 100px;
        }
        .refresh-btn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: white;
            color: #667eea;
            border: none;
            padding: 16px 24px;
            border-radius: 50px;
            font-size: 1em;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        }
        .refresh-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 15px 40px rgba(0,0,0,0.4);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧠 Agent Brain Monitor</h1>
        <p>Real-time view of all connected AI agents</p>
    </div>

    <div class="stats-bar">
        <div class="stat-box">
            <h3>Active Agents</h3>
            <p>${agentCards.length}</p>
        </div>
        <div class="stat-box">
            <h3>Total Generations</h3>
            <p>${Math.max(...agentCards.map(a => a.generation), 0)}</p>
        </div>
        <div class="stat-box">
            <h3>Average Reward</h3>
            <p>${agentCards.length > 0 ? (agentCards.reduce((sum, a) => sum + (a.rewards.total_reward || 0), 0) / agentCards.length).toFixed(1) : 0}</p>
        </div>
    </div>

    <div class="cards-container">
        ${agentCards.length === 0 ? '<div class="no-agents">No agents connected yet...</div>' : ''}
        ${agentCards.map(agent => `
            <div class="agent-card">
                <div class="card-header">
                    <div class="card-title">${agent.name}</div>
                    <div class="card-type">${agent.type} Gen${agent.generation}</div>
                </div>

                <div class="card-section">
                    <div class="section-title">💭 Thought Process</div>
                    <div class="thought-bubble">${agent.thoughtProcess}</div>
                </div>

                <div class="card-section">
                    <div class="section-title">🎯 Current Action</div>
                    <div class="stat-item">
                        <span class="stat-label">Action</span>
                        <span class="stat-value">${agent.currentAction}</span>
                    </div>
                </div>

                ${agent.tasks && agent.tasks.length > 0 ? `
                <div class="card-section">
                    <div class="section-title">📋 Tasks Queue</div>
                    <ul class="tasks-list">
                        ${agent.tasks.map(task => `<li class="task-item">${task}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}

                <div class="card-section">
                    <div class="section-title">📊 Stats</div>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Health</span>
                            <span class="stat-value">${agent.health}/20</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Food</span>
                            <span class="stat-value">${agent.food}/20</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Reward</span>
                            <span class="stat-value">${(agent.rewards.total_reward || 0).toFixed(1)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Items</span>
                            <span class="stat-value">${agent.inventory.length}</span>
                        </div>
                    </div>
                    <div class="health-bar">
                        <div class="health-bar-fill" style="width: ${(agent.health / 20) * 100}%"></div>
                    </div>
                </div>

                ${agent.position ? `
                <div class="card-section">
                    <div class="section-title">📍 Position</div>
                    <div class="stat-item">
                        <span class="stat-label">XYZ</span>
                        <span class="stat-value">${agent.position.x}, ${agent.position.y}, ${agent.position.z}</span>
                    </div>
                </div>
                ` : ''}

                ${agent.personality ? `
                <div class="card-section">
                    <div class="section-title">✨ Personality</div>
                    <div class="personality-tags">
                        ${agent.personality.traits ? agent.personality.traits.split(', ').slice(0, 3).map(trait =>
                            `<span class="personality-tag">${trait}</span>`
                        ).join('') : ''}
                    </div>
                </div>
                ` : ''}
            </div>
        `).join('')}
    </div>

    <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>

    <script>
        // Auto-refresh every 5 seconds
        setTimeout(() => location.reload(), 5000);
    </script>
</body>
</html>
    `;

    res.send(html);
});

// JSON endpoint for programmatic access
app.get('/brain/json', (req, res) => {
    const agentData = [];

    activeAgents.forEach((bot, name) => {
        agentData.push({
            name: bot.agentName,
            type: bot.agentType,
            generation: bot.generation,
            uuid: bot.uuid,
            health: bot.health || 0,
            food: bot.food || 0,
            position: bot.entity?.position,
            inventory: bot.inventory ? bot.inventory.items().map(item => ({
                name: item.name,
                count: item.count
            })) : [],
            rewards: bot.rewards ? bot.rewards.getStats() : {},
            skills: bot.skills || {},
            personality: bot.personality ? mlPersonality.getPersonalitySummary(bot.personality) : null,
            currentAction: bot.lastAction || 'idle',
            thoughtProcess: bot.lastThought || 'Exploring the world...',
            tasks: bot.currentTasks || []
        });
    });

    res.json({
        timestamp: new Date().toISOString(),
        agentCount: agentData.length,
        agents: agentData
    });
});

// Start Express server
function startBrainServer() {
    app.listen(BRAIN_PORT, () => {
        console.log('\n' + '='.repeat(70));
        console.log(`[BRAIN API] Server running at http://localhost:${BRAIN_PORT}/brain`);
        console.log(`[BRAIN API] JSON endpoint at http://localhost:${BRAIN_PORT}/brain/json`);
        console.log('='.repeat(70) + '\n');
    });
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

(async () => {
    try {
        // Initialize all systems
        await initializeSystems();

        // Start Brain API server
        startBrainServer();

        console.log('\n' + '='.repeat(70));
        console.log('[STARTUP] All systems initialized - starting village');
        console.log('='.repeat(70) + '\n');

        // Start the village
        const agentTypes = config.agents.types.slice(0, config.agents.maxAgents);
        await startVillage(config.server, agentTypes);

    } catch (error) {
        console.error('[STARTUP] Fatal error:', error);
        process.exit(1);
    }
})();

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

process.on('SIGINT', () => {
    console.log('\n\nShutting down village...');

    // Save ML models
    if (mlTrainer) {
        console.log('[ML SYSTEM] Saving models...');
        mlTrainer.saveAllModels().then(() => {
            console.log('[ML SYSTEM] Models saved');
            mlTrainer.dispose();
        }).catch(err => {
            console.error('[ML SYSTEM] Error saving models:', err.message);
        });
    }

    // Disconnect all agents
    activeAgents.forEach((bot) => {
        db.run(`UPDATE lineage SET death_time = ?, final_reward = ? WHERE agent_name = ?`,
            [Date.now(), bot.rewards.totalReward, bot.agentName]);
        bot.quit();
    });

    // Close database
    setTimeout(() => {
        db.close(() => {
            console.log('[DATABASE] Closed AIKnowledge.sqlite');
            process.exit(0);
        });
    }, 2000);
});

console.log('\nPress Ctrl+C to stop');
console.log('[DATABASE] Persistent memory active: AIKnowledge.sqlite');
