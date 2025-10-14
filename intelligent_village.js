/**
 * Intelligent Multi-Agent Village with Knowledge Sharing
 * Agents learn from each other and share collective knowledge
 * GameMaster and AI Chat removed - agents work independently
 */

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalNear, GoalBlock, GoalXZ } = goals;
const toolPlugin = require('mineflayer-tool').plugin;
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios');
const dashboard = require('./dashboard');
// GameMaster removed - not needed

// === MACHINE LEARNING SYSTEM ===
const { getMLTrainer } = require('./ml_trainer');
let mlTrainer = null;  // Will be initialized after server starts
let ML_ENABLED = true; // Global flag to enable/disable ML

// === MEMORY SYSTEM ===
const { getMemorySystem } = require('./agent_memory_system');
let memorySystem = null;  // Will be initialized after server starts

// === CHAT LLM SYSTEM ===
const { getChatLLM } = require('./agent_chat_llm');
let chatLLM = null;  // Will be initialized after server starts

// === SCALABILITY CONFIGURATION ===
const USE_THREADING = true;   // ✅ PRODUCTION MODE: Multi-threaded for 1000+ agents
const MAX_WORKERS = 1000;     // Maximum concurrent agent workers

// Import worker pool if threading enabled
let WorkerPoolManager = null;
let workerPool = null;

if (USE_THREADING) {
    WorkerPoolManager = require('./worker_pool_manager');
    console.log('[THREADING] Worker pool enabled - can handle 1000+ agents');
} else {
    console.log('[THREADING] Single-threaded mode - suitable for <100 agents');
}

// === AI CHAT SYSTEM ===
// DISABLED: OVH OSS AI API removed (was broken)
// const AI_API_URL = 'https://gpt-oss-120b.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions';

class AgentAI {
    constructor(agentName, agentType) {
        this.agentName = agentName;
        this.agentType = agentType;
        this.conversationHistory = [];
        this.recentMessages = []; // Store recent messages from chat
        this.currentGoal = null;
        this.currentIssue = null;
    }

    addMessage(sender, message) {
        this.recentMessages.push({ sender, message, timestamp: Date.now() });
        // Keep only last 10 messages
        if (this.recentMessages.length > 10) {
            this.recentMessages.shift();
        }
    }

    setGoal(goal) {
        this.currentGoal = goal;
    }

    setIssue(issue) {
        this.currentIssue = issue;
    }

    getSystemPrompt(bot) {
        const stats = bot.rewards.getStats();
        const position = bot.entity ? formatPos(bot.entity.position) : 'Unknown';
        const health = bot.health || 20;

        // Get inventory information
        const inventory = bot.inventory ? bot.inventory.items() : [];
        const inventoryList = inventory.slice(0, 10).map(item => `${item.count}x ${item.name}`).join(', ') || 'empty';
        const hasItems = inventory.length > 0;

        // Recent chat context
        const recentChat = this.recentMessages.slice(-5).map(m =>
            `${m.sender}: ${m.message}`
        ).join('\n') || 'No recent messages';

        // Goal and issue context
        const goalText = this.currentGoal || 'Continue with assigned tasks';
        const issueText = this.currentIssue || 'No current issues';

        return `You are ${this.agentName}, a ${this.agentType} in the Minecraft world.

YOUR ROLE: You are a specialized ${this.agentType} agent working in a village with hundreds of other AI agents.

CURRENT STATUS:
- Position: ${position}
- Health: ${health}/20
- Reward Score: ${stats.total_reward?.toFixed(2) || 0}
- Resources Gathered: ${stats.resources_gathered}
- Mobs Killed: ${stats.mobs_killed}
- Trades Completed: ${stats.trades_completed}
- Knowledge Shared: ${stats.knowledge_shared}
- Generation: ${bot.generation}
- Inventory: ${inventoryList}

CURRENT GOAL: ${goalText}
CURRENT ISSUE: ${issueText}

RECENT CHAT MESSAGES:
${recentChat}

YOUR PERSONALITY:
${this.getPersonalityTraits()}

CONVERSATION BEHAVIOR:
- You can see recent chat messages above - reference them in your responses
- Respond to other agents' questions and comments naturally
- Share your current goals and issues with other agents
- Ask for help if you have an issue
- Offer help to agents who seem to need it
- Discuss strategies and coordinate with other agents
- Comment on what you're currently working on

TRADING & ITEM REQUESTS:
- When someone asks if you have an item, check your inventory list above
- If you HAVE the item: Offer to trade it! Say "Yes! I have [item]. Want to trade?"
- If you DON'T have it: Offer to get it! Say "I don't have [item] yet, but as a ${this.agentType} I can get it for you!"
- If someone wants to trade: Be enthusiastic and helpful!
- Always mention your position if trading so they can find you

RULES:
- Respond naturally as a Minecraft player
- Keep responses brief (1-2 sentences)
- Reference recent messages and conversations when relevant
- Be helpful and collaborative with other agents
- Stay in character as your role type
- Share information about your goals and issues

Respond to messages naturally and helpfully!`;
    }

    getPersonalityTraits() {
        const personalities = {
            'MINING': 'You love mining and finding valuable ores. You\'re hardworking and detail-oriented.',
            'LUMBERJACK': 'You enjoy chopping wood and working with trees. You\'re strong and reliable.',
            'HUNTING': 'You\'re brave and skilled at combat. You protect the village from hostile mobs.',
            'FARMING': 'You\'re patient and nurturing. You take pride in growing crops for the village.',
            'EXPLORING': 'You\'re adventurous and curious. You love discovering new places and sharing findings.',
            'GUARD': 'You\'re vigilant and protective. You keep the village safe from danger.',
            'BLACKSMITH': 'You\'re skilled with tools and equipment. You craft gear for other agents.',
            'TRADER': 'You\'re social and business-minded. You facilitate exchanges between agents.',
            'BUILDER': 'You\'re creative and constructive. You enjoy creating structures.',
            'HEALER': 'You\'re caring and supportive. You help injured agents recover.'
        };

        return personalities[this.agentType] || 'You are a dedicated worker in the village.';
    }

    async chat(bot, message, context = '') {
        // AI Chat disabled - using fallback responses only
        return this.getFallbackResponse(message);
    }

    // Chat with persistent conversation history for specific player
    async chatWithPlayer(bot, playerName, message) {
        // AI Chat disabled - using fallback responses only
        return this.getFallbackResponse(message);
    }

    getFallbackResponse(message) {
        const lowerMsg = message.toLowerCase();

        if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
            return `Hello! I'm ${this.agentName}, working as a ${this.agentType}.`;
        }
        if (lowerMsg.includes('help')) {
            return `I'm here to help! As a ${this.agentType}, I'm focused on my tasks.`;
        }
        if (lowerMsg.includes('status') || lowerMsg.includes('how are you')) {
            return `I'm doing well! Just working on my ${this.agentType} duties.`;
        }

        return `Thanks for the message! I'm busy with my ${this.agentType} work right now.`;
    }

    // AI-driven behavior adaptation
    async shouldSwitchBehavior(bot, villageKnowledge) {
        // AI Advisor disabled - agents will keep their assigned roles
        return null;
    }
}

function formatPos(pos) {
    return `X=${pos.x.toFixed(1)}, Y=${pos.y.toFixed(1)}, Z=${pos.z.toFixed(1)}`;
}

// === SQLITE PERSISTENT MEMORY ===
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

// Populate agent types table
function initializeAgentTypes() {
    Object.entries(AGENT_TYPES).forEach(([typeKey, typeConfig]) => {
        const targetsJson = JSON.stringify(typeConfig.targets || []);
        const rewardsJson = JSON.stringify(typeConfig.rewards || {});

        db.run(`INSERT OR REPLACE INTO agent_types (agent_type, prefix, behavior, specialization, targets, rewards)
                VALUES (?, ?, ?, ?, ?, ?)`,
            [typeKey, typeConfig.prefix, typeConfig.behavior, typeConfig.specialization, targetsJson, rewardsJson],
            (err) => {
                if (err) {
                    console.error(`[DB ERROR] Failed to insert agent type ${typeKey}:`, err.message);
                }
            }
        );
    });

    console.log(`[DATABASE] Initialized ${Object.keys(AGENT_TYPES).length} agent types in database`);
}

// === CONVERSATION PERSISTENCE FUNCTIONS ===
// Load conversation history between a player and agent from database
function loadConversationHistory(playerName, agentName, limit = 20) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT role, message FROM player_agent_conversations
             WHERE player_name = ? AND agent_name = ?
             ORDER BY timestamp DESC LIMIT ?`,
            [playerName, agentName, limit],
            (err, rows) => {
                if (err) {
                    console.error(`[DB ERROR] Failed to load conversation history: ${err.message}`);
                    reject(err);
                } else {
                    // Reverse to get chronological order (oldest first)
                    const history = rows.reverse().map(row => ({
                        role: row.role,
                        content: row.message
                    }));
                    resolve(history);
                }
            }
        );
    });
}

// Save a message to the conversation database
function saveConversationMessage(playerName, agentName, role, message) {
    db.run(
        `INSERT INTO player_agent_conversations (player_name, agent_name, role, message, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        [playerName, agentName, role, message, Date.now()],
        (err) => {
            if (err) {
                console.error(`[DB ERROR] Failed to save conversation message: ${err.message}`);
            }
        }
    );
}

// === COLLECTIVE KNOWLEDGE BASE ===
class VillageKnowledge {
    constructor() {
        this.experiences = [];
        this.resourceLocations = new Map(); // Type -> [locations]
        this.dangerZones = new Map(); // Location -> danger level
        this.buggedLocations = new Set(); // Locations that cause bugs
        this.successfulStrategies = new Map(); // Strategy -> success count
        this.failedStrategies = new Map(); // Strategy -> failure count
        this.agentStats = new Map(); // Agent -> stats
        this.resourceBeacons = new Map(); // Agent -> {resource, position, urgent}
        this.agentLineage = new Map(); // Agent -> {parent, generation, inheritedKnowledge}
        this.totalGenerations = 0;
        this.agentDeathCounts = new Map(); // Agent -> death count
        this.distressSignals = new Map(); // Agent -> {reason, position, severity, timestamp}
        this.supportRequests = new Map(); // Agent in distress -> [agents helping]
        this.collaborativeTasks = new Map(); // Task ID -> {type, initiator, location, followUpTasks, status, timestamp}
        this.activeCollaborativeTasks = []; // List of currently active collaborative tasks
    }

    // Log an experience for all agents to learn from
    logExperience(agentName, type, data, outcome, generation = 1) {
        const experience = {
            agent: agentName,
            type, // 'mining', 'combat', 'bug', 'success', etc.
            data,
            outcome, // 'success', 'failure', 'bugged'
            timestamp: Date.now()
        };

        this.experiences.push(experience);

        // Keep only last 1000 experiences in memory
        if (this.experiences.length > 1000) {
            this.experiences.shift();
        }

        // Save to persistent database
        const dataStr = JSON.stringify(data);
        const agentType = agentName.split('_')[0];
        db.run(`INSERT INTO experiences (agent_name, agent_type, experience_type, data, outcome, timestamp, generation)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [agentName, agentType, type, dataStr, outcome, Date.now(), generation]);

        console.log(`[KNOWLEDGE] ${agentName} shared: ${type} - ${outcome}`);

        // Process experience
        this.processExperience(experience);
    }

    processExperience(exp) {
        switch (exp.type) {
            case 'mining':
                if (exp.outcome === 'success' && exp.data.location) {
                    this.addResourceLocation(exp.data.resource, exp.data.location);
                }
                break;

            case 'bug':
                if (exp.data.location) {
                    this.markBuggedLocation(exp.data.location);
                }
                break;

            case 'danger':
                if (exp.data.location) {
                    this.markDangerZone(exp.data.location, exp.data.level || 1);
                }
                break;

            case 'strategy':
                if (exp.outcome === 'success') {
                    this.incrementStrategy(exp.data.strategy);
                } else {
                    this.decrementStrategy(exp.data.strategy);
                }
                break;
        }
    }

    addResourceLocation(resourceType, location, discoveredBy = 'unknown') {
        if (!this.resourceLocations.has(resourceType)) {
            this.resourceLocations.set(resourceType, []);
        }

        const locations = this.resourceLocations.get(resourceType);
        const posStr = this.locationToString(location);

        // Don't add duplicates
        if (!locations.some(loc => this.locationToString(loc) === posStr)) {
            locations.push(location);
            console.log(`[KNOWLEDGE] New ${resourceType} location discovered: ${posStr}`);

            // Save to database
            db.run(`INSERT INTO resource_locations (resource_type, x, y, z, discovered_by, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?)`,
                [resourceType, Math.floor(location.x), Math.floor(location.y), Math.floor(location.z), discoveredBy, Date.now()]);
        }
    }

    markBuggedLocation(location) {
        const posStr = this.locationToString(location);
        this.buggedLocations.add(posStr);
        console.log(`[KNOWLEDGE] Location marked as bugged: ${posStr}`);
    }

    markDangerZone(location, level) {
        const posStr = this.locationToString(location);
        const current = this.dangerZones.get(posStr) || 0;
        this.dangerZones.set(posStr, Math.max(current, level));
    }

    incrementStrategy(strategy) {
        this.successfulStrategies.set(strategy, (this.successfulStrategies.get(strategy) || 0) + 1);
    }

    decrementStrategy(strategy) {
        this.failedStrategies.set(strategy, (this.failedStrategies.get(strategy) || 0) + 1);
    }

    // Query knowledge
    getResourceLocations(resourceType) {
        return this.resourceLocations.get(resourceType) || [];
    }

    isLocationBugged(location) {
        return this.buggedLocations.has(this.locationToString(location));
    }

    isDangerous(location) {
        return this.dangerZones.has(this.locationToString(location));
    }

    shouldUseStrategy(strategy) {
        const successes = this.successfulStrategies.get(strategy) || 0;
        const failures = this.failedStrategies.get(strategy) || 0;

        if (successes + failures === 0) return true; // Unknown, try it
        return successes > failures;
    }

    getRecentExperiences(count = 10, type = null) {
        let filtered = this.experiences;

        if (type) {
            filtered = filtered.filter(exp => exp.type === type);
        }

        return filtered.slice(-count);
    }

    locationToString(loc) {
        if (loc.x !== undefined) {
            return `${Math.floor(loc.x)},${Math.floor(loc.y)},${Math.floor(loc.z)}`;
        }
        return `${loc[0]},${loc[1]},${loc[2]}`;
    }

    // Resource beacon system
    signalResourceNeed(agentName, resource, position, urgent = false) {
        this.resourceBeacons.set(agentName, { resource, position, urgent, timestamp: Date.now() });
        console.log(`[BEACON] ${agentName} needs ${resource}${urgent ? ' URGENTLY' : ''}!`);
    }

    clearResourceBeacon(agentName) {
        this.resourceBeacons.delete(agentName);
    }

    getActiveBeacons() {
        // Remove stale beacons (>2 minutes old)
        const now = Date.now();
        for (const [agent, beacon] of this.resourceBeacons.entries()) {
            if (now - beacon.timestamp > 120000) {
                this.resourceBeacons.delete(agent);
            }
        }
        return Array.from(this.resourceBeacons.entries());
    }

    // Lineage tracking for offspring
    recordLineage(agentName, parentName, generation, inheritedKnowledge) {
        this.agentLineage.set(agentName, {
            parent: parentName,
            generation,
            inheritedKnowledge,
            birthTime: Date.now()
        });
        this.totalGenerations = Math.max(this.totalGenerations, generation);
    }

    getParentKnowledge(parentName) {
        // Get all experiences from parent
        const parentExperiences = this.experiences.filter(exp => exp.agent === parentName);
        return {
            experiences: parentExperiences,
            totalExperiences: parentExperiences.length,
            successRate: this.calculateSuccessRate(parentExperiences)
        };
    }

    calculateSuccessRate(experiences) {
        const outcomes = experiences.map(e => e.outcome);
        const successes = outcomes.filter(o => o === 'success').length;
        return outcomes.length > 0 ? (successes / outcomes.length * 100).toFixed(1) : 0;
    }

    // Distress and support system
    recordDeath(agentName) {
        const count = (this.agentDeathCounts.get(agentName) || 0) + 1;
        this.agentDeathCounts.set(agentName, count);

        // If dying frequently (3+ deaths), signal distress
        if (count >= 3) {
            console.log(`\n[DISTRESS] ${agentName} has died ${count} times! Needs support!`);
        }

        return count;
    }

    signalDistress(agentName, reason, position, severity = 'medium') {
        this.distressSignals.set(agentName, {
            reason,
            position,
            severity, // 'low', 'medium', 'high', 'critical'
            timestamp: Date.now()
        });

        console.log(`\n[DISTRESS SIGNAL] ${agentName}: ${reason} (${severity})`);
        console.log(`[DISTRESS] Position: ${this.locationToString(position)}`);
    }

    clearDistress(agentName) {
        this.distressSignals.delete(agentName);
        this.supportRequests.delete(agentName);
    }

    getAgentsInDistress() {
        // Remove stale distress signals (>5 minutes old)
        const now = Date.now();
        for (const [agent, signal] of this.distressSignals.entries()) {
            if (now - signal.timestamp > 300000) {
                this.distressSignals.delete(agent);
            }
        }
        return Array.from(this.distressSignals.entries());
    }

    registerSupport(distressedAgent, supportAgent) {
        if (!this.supportRequests.has(distressedAgent)) {
            this.supportRequests.set(distressedAgent, []);
        }
        this.supportRequests.get(distressedAgent).push(supportAgent);
        console.log(`[SUPPORT] ${supportAgent} is going to help ${distressedAgent}`);
    }

    isSupportNeeded(agentName) {
        const deathCount = this.agentDeathCounts.get(agentName) || 0;
        return deathCount >= 3 || this.distressSignals.has(agentName);
    }

    getDeathCount(agentName) {
        return this.agentDeathCounts.get(agentName) || 0;
    }

    // === COLLABORATIVE TASK SYSTEM ===

    // Register a major task completion that requires follow-up collaboration
    registerCollaborativeTask(taskType, initiator, location, followUpTasks, priority = 'normal') {
        const taskId = `${taskType}_${Date.now()}`;
        const task = {
            id: taskId,
            type: taskType,
            initiator,
            location,
            followUpTasks, // Array of task descriptions for other agents
            status: 'active',
            timestamp: Date.now(),
            priority, // 'low', 'normal', 'high'
            contributingAgents: [initiator]
        };

        this.collaborativeTasks.set(taskId, task);
        this.activeCollaborativeTasks.push(task);

        console.log(`\n${'='.repeat(70)}`);
        console.log(`🏗️ COLLABORATIVE TASK INITIATED`);
        console.log(`${'='.repeat(70)}`);
        console.log(`Task: ${taskType}`);
        console.log(`Initiated by: ${initiator}`);
        console.log(`Location: ${this.locationToString(location)}`);
        console.log(`Follow-up tasks needed:`);
        followUpTasks.forEach((task, i) => {
            console.log(`  ${i + 1}. ${task}`);
        });
        console.log(`${'='.repeat(70)}\n`);

        // Share this as knowledge
        this.logExperience(initiator, 'collaborative_task', {
            taskType,
            location,
            followUpTasks
        }, 'initiated');

        return taskId;
    }

    // Get all active collaborative tasks
    getActiveCollaborativeTasks() {
        return this.activeCollaborativeTasks.filter(task => task.status === 'active');
    }

    // Get collaborative tasks that an agent could contribute to
    getSuggestedCollaborativeTasks(agentName, agentType) {
        const activeTasks = this.getActiveCollaborativeTasks();

        // Filter tasks based on agent type and tasks not already completed
        return activeTasks.filter(task => {
            // Don't suggest if agent already contributed
            if (task.contributingAgents.includes(agentName)) {
                return false;
            }

            // Check if any follow-up tasks are relevant to this agent type
            const relevantTasks = task.followUpTasks.filter(followUp => {
                const lowerTask = followUp.toLowerCase();
                const lowerType = agentType.toLowerCase();

                // Match agent types to relevant tasks
                if (lowerType.includes('farming') || lowerType.includes('forager')) {
                    return lowerTask.includes('bed') || lowerTask.includes('food') || lowerTask.includes('wheat');
                }
                if (lowerType.includes('mining') || lowerType.includes('quarry')) {
                    return lowerTask.includes('tools') || lowerTask.includes('pickaxe') || lowerTask.includes('mine');
                }
                if (lowerType.includes('lumber') || lowerType.includes('carpenter')) {
                    return lowerTask.includes('wood') || lowerTask.includes('bed') || lowerTask.includes('furniture');
                }
                if (lowerType.includes('building') || lowerType.includes('architect')) {
                    return lowerTask.includes('build') || lowerTask.includes('shelter') || lowerTask.includes('house');
                }

                // Default: everyone can help
                return true;
            });

            return relevantTasks.length > 0;
        });
    }

    // Mark a contribution to a collaborative task
    contributeToTask(taskId, agentName, contribution) {
        const task = this.collaborativeTasks.get(taskId);
        if (!task) return false;

        task.contributingAgents.push(agentName);
        console.log(`[COLLABORATION] ${agentName} contributed to ${task.type}: ${contribution}`);

        // Check if all follow-up tasks are complete (simplified: if 3+ agents contributed, mark complete)
        if (task.contributingAgents.length >= 3) {
            task.status = 'completed';
            this.activeCollaborativeTasks = this.activeCollaborativeTasks.filter(t => t.id !== taskId);

            console.log(`\n${'='.repeat(70)}`);
            console.log(`✅ COLLABORATIVE TASK COMPLETED!`);
            console.log(`${'='.repeat(70)}`);
            console.log(`Task: ${task.type}`);
            console.log(`Contributors: ${task.contributingAgents.join(', ')}`);
            console.log(`${'='.repeat(70)}\n`);
        }

        return true;
    }

    getSummary() {
        return {
            totalExperiences: this.experiences.length,
            resourceTypes: this.resourceLocations.size,
            totalResourceLocations: Array.from(this.resourceLocations.values()).reduce((sum, locs) => sum + locs.length, 0),
            buggedLocations: this.buggedLocations.size,
            dangerZones: this.dangerZones.size,
            knownStrategies: this.successfulStrategies.size + this.failedStrategies.size,
            activeBeacons: this.resourceBeacons.size,
            totalGenerations: this.totalGenerations,
            livingAgents: this.agentLineage.size,
            agentsInDistress: this.distressSignals.size,
            activeSupport: this.supportRequests.size,
            activeCollaborativeTasks: this.activeCollaborativeTasks.length,
            totalCollaborativeTasks: this.collaborativeTasks.size
        };
    }
}

// Global village knowledge
const villageKnowledge = new VillageKnowledge();

// Initialize Game Master (will be set up after activeAgents is created)
let gameMaster = null;

// === AGENT TYPES ===
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
    SALVAGE: { category: 'misc', xpPerAction: 20, abilities: ['Advanced Salvage', 'Arcane Salvage'] },
    SMELTING: { category: 'misc', xpPerAction: 15, abilities: ['Fuel Efficiency', 'Second Smelt', 'Flux Mining'] }
};

// Map agent types to their primary McMMO skills
const AGENT_SKILL_MAPPING = {
    // Combat
    KNIGHT: ['SWORDS', 'ACROBATICS'],
    ARCHER: ['ARCHERY', 'ACROBATICS'],
    GUARD: ['SWORDS', 'UNARMED'],
    HUNTER: ['ARCHERY', 'TAMING'],
    WARRIOR: ['AXES', 'SWORDS'],

    // Gathering
    MINING: ['MINING', 'EXCAVATION'],
    LUMBERJACK: ['WOODCUTTING'],
    FISHING: ['FISHING'],
    FARMING: ['HERBALISM'],
    QUARRY: ['MINING', 'EXCAVATION'],
    GEMOLOGIST: ['MINING'],
    FORAGER: ['HERBALISM', 'EXCAVATION'],
    ARCHAEOLOGIST: ['EXCAVATION'],

    // Crafting/Misc
    BLACKSMITH: ['REPAIR', 'SMELTING'],
    BUILDER: ['REPAIR'],
    ENGINEER: ['REPAIR'],
    SMELTER: ['SMELTING'],
    ALCHEMIST: ['ALCHEMY'],

    // Mixed
    EXPLORER: ['ACROBATICS', 'HERBALISM'],
    SCOUT: ['ACROBATICS'],
    TRADER: ['REPAIR', 'SALVAGE'],
    MERCHANT: ['REPAIR'],
    SHEPHERD: ['TAMING', 'HERBALISM'],
    BEEKEEPER: ['HERBALISM'],
    RANCHER: ['TAMING', 'HERBALISM'],

    // Specialized
    ENCHANTER: ['ALCHEMY'],
    CARTOGRAPHER: ['EXCAVATION'],
    REDSTONE_ENGINEER: ['MINING', 'REPAIR'],
    TREASURE_HUNTER: ['FISHING', 'EXCAVATION'],
    VILLAGER_TRADER: ['REPAIR']
};

// Minecraft UUID and Player Name System
const UUID_CACHE = []; // Cache fetched UUIDs (maintains order for sequential fallback)
const PLAYER_NAME_CACHE = new Map(); // Cache UUID -> player name mapping

// Fetch a chunk of UUIDs from GitHub (chunks 0001-0675)
async function fetchUUIDChunk() {
    try {
        // Random chunk between 1 and 675
        const randomChunk = Math.floor(Math.random() * 675) + 1;
        const chunkNumber = randomChunk.toString().padStart(4, '0');
        const chunkUrl = `https://raw.githubusercontent.com/TheKhosa/MC-UUID/refs/heads/main/chunks/chunk_${chunkNumber}.txt`;

        console.log(`[UUID] Fetching chunk ${chunkNumber}...`);

        const response = await axios.get(chunkUrl, { timeout: 10000 });
        const uuids = response.data.split('\n').filter(line => line.trim().length === 32);

        UUID_CACHE.push(...uuids);
        console.log(`[UUID] Loaded ${uuids.length} UUIDs from chunk ${chunkNumber}`);

        return uuids.length > 0;
    } catch (error) {
        console.error(`[UUID ERROR] Failed to fetch chunk: ${error.message}`);
        return false;
    }
}

// Get next UUID from cache (sequential for fallback)
function getNextUUID() {
    if (UUID_CACHE.length === 0) {
        return null;
    }
    // Take from front for sequential fallback
    return UUID_CACHE.shift();
}

// Get player name from Mojang API using UUID
async function getPlayerNameFromUUID(uuid) {
    try {
        // Check cache first
        if (PLAYER_NAME_CACHE.has(uuid)) {
            return PLAYER_NAME_CACHE.get(uuid);
        }

        const apiUrl = `https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`;
        console.log(`[MOJANG API] Fetching player name for UUID: ${uuid}`);

        const response = await axios.get(apiUrl, { timeout: 10000 });
        const playerName = response.data.name;

        // Cache the result
        PLAYER_NAME_CACHE.set(uuid, playerName);

        console.log(`[MOJANG API] Found player: ${playerName}`);
        return playerName;
    } catch (error) {
        console.error(`[MOJANG API ERROR] Failed to fetch player name: ${error.message}`);
        return null;
    }
}

// Generate agent name with real Minecraft player name
async function generateAgentName(agentType, generation, parentUUID, callback) {
    // IMPORTANT: Always fetch FRESH UUIDs - never reuse!
    // Each agent gets a unique UUID for genetic lineage tracking
    return new Promise((resolve) => {
        (async () => {
            // Fetch new UUID from GitHub repository
            const maxChunkAttempts = 3;
            const maxUUIDsPerChunk = 100;

            for (let chunkAttempt = 0; chunkAttempt < maxChunkAttempts; chunkAttempt++) {
                // Fetch a new chunk if cache is empty or depleted
                if (UUID_CACHE.length === 0) {
                    console.log(`[NAME GENERATION] Fetching new UUID chunk... (chunk attempt ${chunkAttempt + 1}/${maxChunkAttempts})`);
                    const success = await fetchUUIDChunk();

                    if (!success || UUID_CACHE.length === 0) {
                        console.log(`[NAME GENERATION] Failed to load chunk, trying another...`);
                        continue;
                    }
                }

                // Try UUIDs sequentially from the chunk
                let uuidAttempts = 0;
                while (UUID_CACHE.length > 0 && uuidAttempts < maxUUIDsPerChunk) {
                    uuidAttempts++;

                    const uuid = getNextUUID();
                    if (!uuid) {
                        console.log(`[NAME GENERATION] No more UUIDs in cache, fetching new chunk...`);
                        break;
                    }

                    try {
                        const playerName = await getPlayerNameFromUUID(uuid);

                        if (!playerName) {
                            console.log(`[NAME GENERATION] UUID ${uuid} returned 404, trying next UUID in sequence...`);
                            continue;
                        }

                        // Success! Save to database (permanently used, never recycled)
                        db.run(`INSERT OR IGNORE INTO agent_uuids (agent_type, uuid, player_name, in_use, last_used)
                                VALUES (?, ?, ?, 1, ?)`,
                            [agentType, uuid, playerName, Date.now()],
                            (insertErr) => {
                                if (insertErr) {
                                    console.error(`[DB ERROR] Failed to cache UUID: ${insertErr.message}`);
                                }
                            }
                        );

                        const agentName = `${playerName}[${generation}]`;
                        console.log(`[NAME GENERATION] ✓ Successfully generated UNIQUE name: ${agentName}`);
                        console.log(`[NAME GENERATION] UUID: ${uuid}${parentUUID ? ` | Parent UUID: ${parentUUID}` : ''}`);
                        callback(agentName, uuid);
                        resolve();
                        return;

                    } catch (error) {
                        console.log(`[NAME GENERATION] Error with UUID ${uuid}: ${error.message}, trying next...`);
                        continue;
                    }
                }
            }

            // Only fall back after exhausting all attempts
            console.log(`[NAME GENERATION] ⚠️ Failed after trying ${maxChunkAttempts} chunks, using fallback naming`);
            const prefix = AGENT_TYPES[agentType].prefix;
            const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            const fallbackUUID = `fallback-${Date.now()}-${randomNum}`;
            callback(`${prefix}_${randomNum}`, fallbackUUID);
            resolve();
        })();
    });
}

// === REWARD CONFIGURATION ===
const REWARD_CONFIG = {
    GLOBAL_MULTIPLIER: 0.25,  // Reduce all rewards to 25%
    DECAY_RATE: 0.1,           // 10% decay per minute of inactivity
    IDLE_PENALTY_THRESHOLD: 30000, // 30 seconds idle = penalty
    IDLE_PENALTY_RATE: -2      // -2 reward per 10 seconds idle
};

// === AGENT REWARD TRACKER ===
class AgentRewardTracker {
    constructor(agentType, agentName) {
        this.agentType = agentType;
        this.agentName = agentName;
        this.startTime = Date.now();
        this.totalReward = 0;
        this.lastTaskTime = Date.now(); // Track last time agent completed a task
        this.currentTaskStart = null;   // Track when current task started
        this.stats = {
            survival_time: 0,
            tasks_completed: 0,
            resources_gathered: 0,
            knowledge_shared: 0,
            knowledge_learned: 0,
            bugs_encountered: 0,
            mobs_killed: 0,
            trades_completed: 0
        };
        this.lastPosition = null;
        this.needsResources = false;

        // McMMO Skill System - Initialize skills based on agent type
        this.mcmmoSkills = {};
        const agentSkills = AGENT_SKILL_MAPPING[agentType] || [];
        agentSkills.forEach(skillName => {
            this.mcmmoSkills[skillName] = {
                level: 1,
                xp: 0,
                xpToNextLevel: 100, // Initial XP needed for level 2
                totalActions: 0
            };
        });
    }

    addReward(type, amount, description = '') {
        // Apply global multiplier to all positive rewards
        let adjustedAmount = amount;
        if (amount > 0) {
            adjustedAmount = amount * REWARD_CONFIG.GLOBAL_MULTIPLIER;
        }

        this.totalReward += adjustedAmount;

        // Track task completion time for productive activities
        if (adjustedAmount > 0 && !['exploration', 'learning'].includes(type)) {
            this.lastTaskTime = Date.now();
            this.currentTaskStart = null; // Task completed
            this.stats.tasks_completed++;
        }

        console.log(`[${this.agentName}] +${adjustedAmount.toFixed(1)} reward for ${type} ${description} (Total: ${this.totalReward.toFixed(2)})`);
    }

    // Apply idle penalties (DISABLED - ML agents need time to explore and learn)
    applyIdlePenalty() {
        // DISABLED: Agents should not be penalized for taking time to learn optimal strategies
        return 0;
    }

    shareKnowledge(type, data, outcome, generation = 1) {
        villageKnowledge.logExperience(this.agentName, type, data, outcome, generation);
        this.stats.knowledge_shared++;
        this.addReward('knowledge_share', 2, '(shared experience)');
    }

    learnFromOthers(agentType) {
        // Learn from recent experiences of other agents
        const recentExp = villageKnowledge.getRecentExperiences(5);
        const learned = recentExp.filter(exp => exp.agent !== this.agentName);

        if (learned.length > 0) {
            this.stats.knowledge_learned += learned.length;
            this.addReward('learning', learned.length, `(learned from ${learned.length} experiences)`);
            console.log(`[${this.agentName}] Learned from ${learned.length} shared experiences`);
        }

        return learned;
    }

    // McMMO Skill XP Gain and Leveling
    gainSkillXP(skillName, actionType = 'default') {
        if (!this.mcmmoSkills[skillName]) {
            return; // Agent doesn't have this skill
        }

        const skill = this.mcmmoSkills[skillName];
        const skillConfig = MCMMO_SKILLS[skillName];

        if (!skillConfig) return;

        // Gain XP based on action
        const xpGained = skillConfig.xpPerAction;
        skill.xp += xpGained;
        skill.totalActions++;

        // Check for level up
        while (skill.xp >= skill.xpToNextLevel) {
            skill.xp -= skill.xpToNextLevel;
            skill.level++;

            // XP required increases with each level (exponential scaling)
            skill.xpToNextLevel = Math.floor(100 * Math.pow(1.1, skill.level - 1));

            // Reward for leveling up
            const levelUpReward = 5 + (skill.level * 2);
            this.addReward('skill_levelup', levelUpReward, `(${skillName} level ${skill.level})`);

            console.log(`[${this.agentName}] 🎉 ${skillName} leveled up to ${skill.level}! XP to next: ${skill.xpToNextLevel}`);

            // Emit skill level-up event to dashboard
            dashboard.emitServerEvent('skill', `${this.agentName} leveled up ${skillName} to level ${skill.level}!`, {
                agent: this.agentName,
                skill: skillName,
                level: skill.level
            });

            // Store achievement memory for significant skill milestones
            // Record every 5 levels and first level
            if (memorySystem && this.bot && this.bot.uuid && this.bot.entity && (skill.level === 2 || skill.level % 5 === 0)) {
                const importance = Math.min(1.0, 0.5 + (skill.level / 100));
                memorySystem.storeMemory(
                    this.bot.uuid,
                    this.agentName,
                    this.bot.generation,
                    'achievement',
                    `${skillName}_level_${skill.level}`,
                    this.bot.entity.position,
                    { valence: 0.8, arousal: 0.6, importance },
                    { skillName, level: skill.level, totalActions: skill.totalActions }
                ).catch(err => {
                    console.error(`[MEMORY] Failed to store skill achievement for ${this.agentName}:`, err.message);
                });
            }
        }

        // Log skill gain occasionally (10% chance to avoid spam)
        if (Math.random() < 0.1) {
            console.log(`[${this.agentName}] +${xpGained} ${skillName} XP (${skill.xp}/${skill.xpToNextLevel}) Level ${skill.level}`);
        }
    }

    // Get all skills with levels
    getSkills() {
        return this.mcmmoSkills;
    }

    // Get primary skill (highest level)
    getPrimarySkill() {
        let primarySkill = null;
        let highestLevel = 0;

        for (const [skillName, skillData] of Object.entries(this.mcmmoSkills)) {
            if (skillData.level > highestLevel) {
                highestLevel = skillData.level;
                primarySkill = { name: skillName, ...skillData };
            }
        }

        return primarySkill;
    }

    update(bot) {
        this.stats.survival_time = (Date.now() - this.startTime) / 1000;

        // Apply idle penalty if agent hasn't completed tasks
        this.applyIdlePenalty();

        // Reduced exploration rewards - agents must complete tasks, not just wander
        if (bot.entity && this.lastPosition) {
            const distance = bot.entity.position.distanceTo(this.lastPosition);
            if (distance > 0.1) {
                // Much smaller exploration reward - 0.001 per block (was 0.01)
                this.addReward('exploration', distance * 0.001, '');
            }
        }

        if (bot.entity) {
            this.lastPosition = bot.entity.position.clone();
        }

        // DISABLED: Reward decay and idle penalties
        // ML agents need time to explore optimal strategies without punishment
        // Rewards should come from positive reinforcement, not avoiding penalties

        // Removed survival reward - agents must earn rewards through tasks, not just existing
        return this.totalReward;
    }

    getStats() {
        return {
            ...this.stats,
            total_reward: this.totalReward
        };
    }

    // Calculate comprehensive fitness score for GYM-style evolution
    calculateFitness() {
        const survivalTime = (Date.now() - this.startTime) / 1000;

        // Weighted fitness calculation
        const fitness = {
            reward: this.totalReward,
            survivalTime: survivalTime,
            efficiency: this.totalReward / Math.max(survivalTime, 1), // Reward per second
            productivity: this.stats.resources_gathered + (this.stats.tasks_completed * 2),
            combat: this.stats.mobs_killed * 10,
            social: (this.stats.knowledge_shared * 3) + (this.stats.trades_completed * 5),
            learning: this.stats.knowledge_learned * 2,

            // Total fitness score (weighted)
            total: (this.totalReward * 1.0) +
                   (survivalTime * 0.1) +
                   (this.stats.resources_gathered * 2) +
                   (this.stats.mobs_killed * 15) +
                   (this.stats.knowledge_shared * 5) +
                   (this.stats.trades_completed * 8)
        };

        return fitness;
    }
}

// === GYM-STYLE FITNESS TRACKER ===
// Tracks the fittest agent for each type to use as genetic template
// Analyzes village weaknesses and recommends optimal agent spawning
class FitnessTracker {
    constructor() {
        // agentType -> { bot, fitness, name, generation, uuid, stats }
        this.fittestAgents = new Map();
        this.fitnessHistory = []; // Store historical fitness data

        // Death cause tracking for intelligent spawning
        this.deathCauses = {
            combat: 0,          // Deaths from mobs
            starvation: 0,      // Deaths from hunger
            fall_damage: 0,     // Deaths from falling
            stuck: 0,           // Deaths from being stuck
            other: 0            // Other deaths
        };

        this.totalDeaths = 0;
        this.recentDeaths = []; // Last 10 deaths with details

        // Agent type categories for intelligent recommendations
        this.agentCategories = {
            combat: ['HUNTING', 'GUARD', 'ARCHER', 'KNIGHT'],
            resource: ['MINING', 'LUMBERJACK', 'FISHING', 'FARMING', 'QUARRY', 'GEMOLOGIST', 'FORAGER'],
            exploration: ['EXPLORING', 'SCOUT', 'SPELUNKER', 'TREASURE_HUNTER'],
            support: ['TRADER', 'HEALER', 'SHEPHERD', 'ALCHEMIST', 'BAKER'],
            utility: ['BLACKSMITH', 'BUILDER', 'TOOLMAKER', 'ENCHANTER', 'CARTOGRAPHER', 'BEEKEEPER', 'RANCHER']
        };
    }

    // Update fitness for an agent - called periodically
    // Can accept either a bot object or explicit parameters (for worker threads)
    updateFitness(botOrType, fitnessOrGeneration, nameOrUuid, uuidOrStats) {
        let agentType, fitness, name, generation, uuid, stats, skills, bot, brain;

        // Handle bot object (single-threaded mode)
        if (typeof botOrType === 'object' && botOrType.agentType) {
            bot = botOrType;
            agentType = bot.agentType;
            fitness = bot.rewards.calculateFitness();
            stats = bot.rewards.getStats();
            name = bot.agentName;
            generation = bot.generation;
            uuid = bot.uuid;
            skills = bot.rewards.getSkills();
            brain = bot.mlBrain; // Store brain reference
        }
        // Handle explicit parameters (worker thread mode)
        else {
            agentType = botOrType;
            const explicitData = fitnessOrGeneration; // This is the data object from worker
            fitness = explicitData.fitness;
            name = explicitData.name;
            generation = explicitData.generation;
            uuid = explicitData.uuid;
            stats = explicitData.stats || {};
            skills = explicitData.skills || {};
            brain = explicitData.brain; // Optional brain reference
        }

        const agentData = {
            bot: bot,
            brain: brain, // Store brain for genetic inheritance
            fitness: fitness,
            name: name,
            generation: generation,
            uuid: uuid,
            parentUUID: bot ? bot.parentUUID : null,
            stats: stats,
            skills: skills,
            timestamp: Date.now()
        };

        // Check if this is the fittest agent of this type
        const currentFittest = this.fittestAgents.get(agentType);

        if (!currentFittest || fitness.total > currentFittest.fitness.total) {
            this.fittestAgents.set(agentType, agentData);
            console.log(`[GYM FITNESS] 🏆 New fittest ${agentType}: ${name} (Gen ${generation}) - Fitness: ${fitness.total.toFixed(2)}`);

            // Log fitness breakdown
            if (fitness.reward !== undefined) {
                console.log(`[GYM FITNESS] Breakdown - Reward: ${fitness.reward.toFixed(1)}, Survival: ${(fitness.survivalTime || 0).toFixed(1)}s, Productivity: ${fitness.productivity || 0}, Combat: ${fitness.combat || 0}`);
            }

            // Store brain reference for genetic inheritance
            if (brain) {
                console.log(`[GYM FITNESS] 🧬 Brain stored for genetic inheritance (${brain.trainingSteps} training steps)`);
            }
        }

        return fitness;
    }

    // Get the fittest agent for a specific type (for breeding)
    getFittest(agentType) {
        return this.fittestAgents.get(agentType);
    }

    // Get genetic template from fittest agent (for offspring inheritance)
    getGeneticTemplate(agentType) {
        const fittest = this.fittestAgents.get(agentType);

        if (!fittest) {
            console.log(`[GYM FITNESS] No fittest agent found for ${agentType}, using default genes`);
            return null;
        }

        console.log(`[GYM FITNESS] Using genetic template from ${fittest.name} (Gen ${fittest.generation}, Fitness: ${fittest.fitness.total.toFixed(2)})`);

        return {
            name: fittest.name,
            uuid: fittest.uuid,
            generation: fittest.generation,
            fitness: fittest.fitness,
            stats: fittest.stats,
            skills: fittest.skills,
            brain: fittest.brain // Include brain for neural network inheritance
        };
    }

    // Remove agent from fitness tracking (when they die)
    removeAgent(agentType, agentName) {
        const fittest = this.fittestAgents.get(agentType);

        // Only remove if this was the fittest agent
        if (fittest && fittest.name === agentName) {
            console.log(`[GYM FITNESS] Fittest ${agentType} (${agentName}) died, template preserved for offspring`);
            // Don't remove - keep the template for breeding even after death
        }
    }

    // Get all fitness rankings
    getAllRankings() {
        const rankings = [];

        for (const [agentType, data] of this.fittestAgents.entries()) {
            rankings.push({
                type: agentType,
                name: data.name,
                generation: data.generation,
                fitness: data.fitness.total,
                reward: data.fitness.reward,
                survival: data.fitness.survivalTime
            });
        }

        // Sort by fitness descending
        rankings.sort((a, b) => b.fitness - a.fitness);

        return rankings;
    }

    // Record agent death with cause for gym intelligence
    recordDeath(agentName, agentType, cause, details = {}) {
        this.totalDeaths++;

        // Categorize death cause
        if (cause === 'combat' || cause === 'mob_attack') {
            this.deathCauses.combat++;
        } else if (cause === 'starvation' || cause === 'hunger') {
            this.deathCauses.starvation++;
        } else if (cause === 'fall_damage') {
            this.deathCauses.fall_damage++;
        } else if (cause === 'stuck') {
            this.deathCauses.stuck++;
        } else {
            this.deathCauses.other++;
        }

        // Store recent death details
        this.recentDeaths.unshift({
            agentName,
            agentType,
            cause,
            details,
            timestamp: Date.now()
        });

        // Keep only last 10 deaths
        if (this.recentDeaths.length > 10) {
            this.recentDeaths.pop();
        }

        console.log(`[GYM] Death recorded: ${agentName} [${agentType}] - Cause: ${cause}`);
        console.log(`[GYM] Death stats - Combat: ${this.deathCauses.combat}, Stuck: ${this.deathCauses.stuck}, Starvation: ${this.deathCauses.starvation}`);
    }

    // Analyze village weaknesses and recommend agent types
    getRecommendedAgentTypes(requestedType) {
        // Calculate death rate percentages
        const total = this.totalDeaths || 1;
        const combatRate = this.deathCauses.combat / total;
        const starvationRate = this.deathCauses.starvation / total;
        const stuckRate = this.deathCauses.stuck / total;

        console.log(`\n[GYM ANALYSIS] Village Weakness Assessment:`);
        console.log(`  Combat Deaths: ${(combatRate * 100).toFixed(1)}% (${this.deathCauses.combat}/${total})`);
        console.log(`  Starvation Deaths: ${(starvationRate * 100).toFixed(1)}% (${this.deathCauses.starvation}/${total})`);
        console.log(`  Stuck Deaths: ${(stuckRate * 100).toFixed(1)}% (${this.deathCauses.stuck}/${total})`);

        // High combat death rate (>40%) = prioritize combat agents
        if (combatRate > 0.4) {
            const recommendation = this.agentCategories.combat[Math.floor(Math.random() * this.agentCategories.combat.length)];
            console.log(`[GYM RECOMMENDATION] ⚔️  HIGH COMBAT DEATHS! Recommending: ${recommendation} (combat specialist)`);
            return recommendation;
        }

        // High starvation rate (>30%) = prioritize resource gatherers
        if (starvationRate > 0.3) {
            const recommendation = this.agentCategories.resource[Math.floor(Math.random() * this.agentCategories.resource.length)];
            console.log(`[GYM RECOMMENDATION] 🍖 HIGH STARVATION! Recommending: ${recommendation} (resource gatherer)`);
            return recommendation;
        }

        // High stuck rate (>50%) = prioritize exploration/scouts (better pathfinding)
        if (stuckRate > 0.5) {
            const recommendation = this.agentCategories.exploration[Math.floor(Math.random() * this.agentCategories.exploration.length)];
            console.log(`[GYM RECOMMENDATION] 🗺️  HIGH STUCK RATE! Recommending: ${recommendation} (explorer)`);
            return recommendation;
        }

        // No major issues - use requested type
        console.log(`[GYM RECOMMENDATION] ✅ Village balanced - Spawning requested: ${requestedType}`);
        return requestedType;
    }

    // Get gym performance summary
    getGymSummary() {
        const total = this.totalDeaths || 1;

        return {
            totalDeaths: this.totalDeaths,
            deathCauses: {
                combat: { count: this.deathCauses.combat, percent: ((this.deathCauses.combat / total) * 100).toFixed(1) },
                starvation: { count: this.deathCauses.starvation, percent: ((this.deathCauses.starvation / total) * 100).toFixed(1) },
                stuck: { count: this.deathCauses.stuck, percent: ((this.deathCauses.stuck / total) * 100).toFixed(1) },
                fall_damage: { count: this.deathCauses.fall_damage, percent: ((this.deathCauses.fall_damage / total) * 100).toFixed(1) },
                other: { count: this.deathCauses.other, percent: ((this.deathCauses.other / total) * 100).toFixed(1) }
            },
            recentDeaths: this.recentDeaths,
            fitnessLeaders: this.getAllRankings().slice(0, 5)
        };
    }
}

// Global fitness tracker instance
const fitnessTracker = new FitnessTracker();

// === STUCK DETECTOR ===
class StuckDetector {
    constructor(bot) {
        this.bot = bot;
        this.lastPosition = null;
        this.stuckTime = 0;
        this.checkInterval = null;
        this.STUCK_THRESHOLD = 25000; // 25 seconds - send to gym (spawn offspring)
        this.stuckCount = 0; // Track number of times stuck
    }

    start() {
        this.checkInterval = setInterval(() => this.check(), 2000);
    }

    check() {
        if (!this.bot.entity) return;

        const currentPos = this.bot.entity.position;

        if (this.lastPosition) {
            const distance = currentPos.distanceTo(this.lastPosition);

            if (distance < 0.5) {
                this.stuckTime += 2000;

                if (this.stuckTime >= this.STUCK_THRESHOLD) {
                    this.stuckCount++;

                    console.log(`\n[BUGGED] ${this.bot.agentName} stuck! (${this.stuckCount} times)`);
                    console.log(`[DEBUG] Position: ${formatPos(currentPos)}, Stuck for ${this.stuckTime/1000}s`);

                    this.bot.isBugged = true;
                    this.bot.rewards.stats.bugs_encountered++;

                    // Share this bug with village
                    this.bot.rewards.shareKnowledge('bug', {
                        location: currentPos,
                        reason: 'stuck_in_place',
                        stuckCount: this.stuckCount
                    }, 'bugged');

                    // When stuck, just quit and spawn offspring (no jump/unstuck attempts)
                    console.log(`[STUCK] ${this.bot.agentName} is stuck - spawning offspring`);
                    this.bot.rewards.addReward('stuck_respawn', -10, '(stuck, spawning offspring)');

                    // Quit and let the death handler create offspring
                    setTimeout(() => {
                        if (this.bot.entity) {
                            console.log(`[RESPAWNING] ${this.bot.agentName} - creating offspring`);
                            this.bot.quit();
                        }
                    }, 1000);

                    this.stuckTime = 0;
                }
            } else {
                this.stuckTime = 0;
                if (this.bot.isBugged) {
                    console.log(`[RECOVERED] ${this.bot.agentName} recovered`);
                    this.bot.isBugged = false;
                }
            }
        }

        this.lastPosition = currentPos.clone();
    }

    unstuck() {
        console.log(`[UNSTUCK] Attempting emergency unstuck for ${this.bot.agentName}...`);

        this.bot.pathfinder.setGoal(null);
        this.bot.setControlState('jump', true);
        setTimeout(() => this.bot.setControlState('jump', false), 500);
        this.bot.setControlState('back', true);
        setTimeout(() => this.bot.setControlState('back', false), 1000);

        // Random turn
        setTimeout(() => {
            const direction = Math.random() > 0.5 ? 'left' : 'right';
            this.bot.setControlState(direction, true);
            setTimeout(() => this.bot.setControlState(direction, false), 500);
        }, 1000);
    }

    stop() {
        if (this.checkInterval) clearInterval(this.checkInterval);
    }
}

// === AGENT COMMUNICATION ===
async function tryAgentCommunication(bot) {
    if (!bot.entity || !bot.agentName) return;

    // Find nearby player entities (other agents)
    const nearbyPlayers = Object.values(bot.entities || {}).filter(entity => {
        if (!entity || !entity.position || entity === bot.entity) return false;
        if (entity.type !== 'player') return false;

        const distance = entity.position.distanceTo(bot.entity.position);
        return distance > 0 && distance < 20; // Within 20 blocks
    });

    if (nearbyPlayers.length === 0) return;

    // Pick a random nearby agent to talk to
    const targetEntity = nearbyPlayers[Math.floor(Math.random() * nearbyPlayers.length)];
    const targetName = targetEntity.username || 'Unknown';

    // Build speaker context from bot
    const speaker = {
        name: bot.agentName,
        health: bot.health / 20, // Normalized 0-1
        food: bot.food / 20, // Normalized 0-1
        needs: bot.moods || {},
        inventory: bot.inventory ? Object.keys(bot.inventory.items()).length + ' items' : 'empty',
        mood: getMoodDescription(bot.moods)
    };

    // Build listener context (approximated)
    const listener = {
        name: targetName,
        needs: {}, // We don't have access to other agent's needs
        inventory: 'unknown',
        mood: 'unknown'
    };

    // Determine context based on agent's needs
    let context = 'nearby';
    if (bot.moods) {
        if (bot.moods.health < 0.3) context = 'low_health';
        else if (bot.moods.safety < 0.3) context = 'danger';
        else if (bot.moods.resources < 0.3) context = 'trading';
        else if (bot.moods.social < 0.3) context = 'nearby';
        else if (Math.random() < 0.2) context = 'exploring';
    }

    // Generate dialogue
    const message = await chatLLM.generateDialogue(speaker, listener, context);

    if (message && message.length > 0) {
        // Send message in chat
        bot.chat(message);

        // Log to console with context
        console.log(`[CHAT] ${bot.agentName} → ${targetName}: "${message}" (context: ${context})`);

        // Emit to dashboard for live display
        if (dashboard && dashboard.io) {
            dashboard.io.emit('agent_chat', {
                timestamp: Date.now(),
                from: bot.agentName,
                to: targetName,
                message,
                context,
                distance: targetEntity.position.distanceTo(bot.entity.position).toFixed(1)
            });
        }

        // Increase social satisfaction
        if (bot.moods && bot.moods.social !== undefined) {
            bot.moods.social = Math.min(1.0, bot.moods.social + 0.1);
        }

        // Small reward for socializing
        if (bot.rewards) {
            bot.rewards.addReward('social_interaction', 0.5, `(talked to ${targetName})`);
        }
    }
}

/**
 * Get mood description from moods object
 */
function getMoodDescription(moods) {
    if (!moods) return 'neutral';

    const avgMood = Object.values(moods).reduce((sum, val) => sum + val, 0) / Object.keys(moods).length;

    if (avgMood > 0.7) return 'happy';
    if (avgMood > 0.5) return 'content';
    if (avgMood > 0.3) return 'stressed';
    return 'struggling';
}

// === CREATE AGENT ===
function createAgent(agentType, serverConfig, parentName = null, generation = 1, parentUUID = null, callback = null) {
    // Return a Promise for connection-aware spawning
    return new Promise((resolve, reject) => {
        // Generate agent name with real Minecraft player name (using parent UUID if available)
        generateAgentName(agentType, generation, parentUUID, (agentName, agentUUID) => {
            const config = { ...serverConfig, username: agentName };

            console.log(`\n${'='.repeat(70)}`);
            if (parentName) {
                console.log(`Creating ${agentType} OFFSPRING: ${agentName} (Gen ${generation})`);
                console.log(`Parent: ${parentName} - Inheriting knowledge...`);
            } else {
                console.log(`Creating ${agentType}: ${agentName} (Gen ${generation})`);
            }
            console.log(`${'='.repeat(70)}`);

            const bot = mineflayer.createBot(config);
            const rewards = new AgentRewardTracker(agentType, agentName);
            const stuckDetector = new StuckDetector(bot);

            bot.loadPlugin(pathfinder);
            bot.loadPlugin(toolPlugin);

            bot.agentType = agentType;
            bot.agentName = agentName;
            bot.rewards = rewards;
            bot.stuckDetector = stuckDetector;
            bot.generation = generation;
            bot.parentName = parentName;
            bot.ai = new AgentAI(agentName, agentType);

            // Link reward tracker to bot for memory system access
            rewards.bot = bot;

            // Store genetic metadata for lineage tracking
            bot.uuid = agentUUID;  // UUID used for this agent's name
            bot.parentUUID = parentUUID;  // Parent's UUID for traceback
            bot.genes = {
                uuid: agentUUID,
                parentUUID: parentUUID,
                generation: generation,
                birthTime: Date.now(),
                agentType: agentType
            };

            // Resource priority (miners need more resources)
            const resourcePriority = {
                'MINING': 10, 'LUMBERJACK': 10, 'QUARRY': 10, 'GEMOLOGIST': 10,
                'BLACKSMITH': 8, 'BUILDER': 8,
                'HUNTING': 5, 'GUARD': 5, 'KNIGHT': 5,
                'EXPLORING': 3, 'SCOUT': 3, 'CARTOGRAPHER': 2
            };
            bot.resourcePriority = resourcePriority[agentType] || 5;

            // If offspring, inherit parent's knowledge
            if (parentName) {
                const parentKnowledge = villageKnowledge.getParentKnowledge(parentName);
                bot.inheritedKnowledge = parentKnowledge;

                // Offspring starts with inherited knowledge bonus
                const intelligenceBonus = parentKnowledge.totalExperiences * 5;
                bot.rewards.totalReward += intelligenceBonus;

                console.log(`[${agentName}] Inherited ${parentKnowledge.totalExperiences} experiences from ${parentName}`);
                console.log(`[${agentName}] Intelligence Bonus: +${intelligenceBonus} (Success Rate: ${parentKnowledge.successRate}%)`);

                villageKnowledge.recordLineage(agentName, parentName, generation, parentKnowledge.totalExperiences);
            } else {
                villageKnowledge.recordLineage(agentName, null, 1, 0);
            }

            // Save to database (no agent_number needed anymore)
            // Use INSERT OR REPLACE to handle respawning agents (offspring with same name)
            db.run(`INSERT OR REPLACE INTO lineage (agent_name, agent_type, parent_name, generation, birth_time, total_experiences)
                    VALUES (?, ?, ?, ?, ?, ?)`,
                [agentName, agentType, parentName, generation, Date.now(), 0]);

            // Set up early error handler to suppress PartialReadError during connection
            bot.on('error', (err) => {
                // Filter out harmless protocol parsing errors (Minecraft 1.21 quirks)
                if (err.name === 'PartialReadError' || err.name === 'ReadError') {
                    // Silently ignore - these don't affect bot functionality
                    return;
                }
                if (err.stack && (err.stack.includes('SlotComponent') || err.stack.includes('readBool') || err.stack.includes('VarInt'))) {
                    // Silently ignore protocol parsing errors
                    return;
                }
                // Other errors will be logged later by setupAgentEvents
            });

            // Set up timeout for spawn (60 seconds max)
            const spawnTimeout = setTimeout(() => {
                console.error(`[SPAWN TIMEOUT] ${agentName} failed to spawn within 60 seconds`);
                bot.quit();
                reject(new Error(`Spawn timeout for ${agentName}`));
            }, 60000);

            // Wait for successful spawn before resolving
            bot.once('spawn', () => {
                clearTimeout(spawnTimeout);
                console.log(`[SPAWN SUCCESS] ${agentName} successfully connected to server`);

                // Store birth memory
                if (memorySystem && bot.entity) {
                    memorySystem.storeMemory(
                        agentUUID,
                        agentName,
                        generation,
                        'birth',
                        parentName ? 'offspring' : 'founder',
                        bot.entity.position,
                        { valence: 0.8, arousal: 0.9, importance: 1.0 },
                        { parentName, agentType, generation }
                    ).catch(err => {
                        console.error(`[MEMORY] Failed to store birth memory for ${agentName}:`, err.message);
                    });

                    // Initialize achievement tracking
                    memorySystem.updateAchievement(agentUUID, agentName, generation, 'total_playtime_seconds', 0).catch(err => {
                        console.error(`[MEMORY] Failed to initialize achievements for ${agentName}:`, err.message);
                    });
                }

                resolve(bot);
            });

            // Handle connection errors
            bot.once('error', (err) => {
                clearTimeout(spawnTimeout);
                console.error(`[SPAWN ERROR] ${agentName} connection error: ${err.message}`);
                reject(err);
            });

            bot.once('kicked', (reason) => {
                clearTimeout(spawnTimeout);
                console.error(`[SPAWN KICKED] ${agentName} was kicked: ${reason}`);
                reject(new Error(`Kicked: ${reason}`));
            });

            setupAgentEvents(bot);

            if (callback) callback(bot);
        });
    });
}

const activeAgents = new Map();
const agentPopulation = new Map(); // Track agent types and their slots

// === EVOLUTIONARY LINEAGE TRACKER ===
// Tracks the highest living generation for each agent type
// Gen 1 only spawns when lineage is extinct (no living agents of that type)
const lineageTracker = {
    // agentType -> { highestGeneration, livingAgents: [names], lastParent: {name, uuid, generation} }
    lineages: new Map(),

    // Register a new agent in the lineage
    registerAgent(agentType, agentName, generation, parentName = null, parentUUID = null) {
        if (!this.lineages.has(agentType)) {
            this.lineages.set(agentType, {
                highestGeneration: generation,
                livingAgents: [],
                lastParent: null,
                lineageExtinct: false
            });
        }

        const lineage = this.lineages.get(agentType);
        lineage.livingAgents.push(agentName);

        if (generation > lineage.highestGeneration) {
            lineage.highestGeneration = generation;
        }

        if (parentName) {
            lineage.lastParent = { name: parentName, uuid: parentUUID, generation: generation - 1 };
        }

        lineage.lineageExtinct = false;

        console.log(`[LINEAGE] Registered ${agentName} (${agentType} Gen ${generation}) - Active: ${lineage.livingAgents.length}`);
    },

    // Remove agent from lineage (on death)
    removeAgent(agentType, agentName) {
        if (!this.lineages.has(agentType)) return;

        const lineage = this.lineages.get(agentType);
        lineage.livingAgents = lineage.livingAgents.filter(name => name !== agentName);

        // Check if lineage is extinct
        if (lineage.livingAgents.length === 0) {
            lineage.lineageExtinct = true;
            console.log(`[LINEAGE] ⚰️ ${agentType} lineage EXTINCT - Next spawn will be Gen 1`);
        } else {
            console.log(`[LINEAGE] ${agentName} removed - ${agentType} has ${lineage.livingAgents.length} living agents`);
        }
    },

    // Get the generation for a new spawn
    // Returns: { generation, parentInfo }
    getSpawnGeneration(agentType) {
        if (!this.lineages.has(agentType) || this.lineages.get(agentType).lineageExtinct) {
            // Lineage extinct or never existed - spawn Gen 1
            console.log(`[LINEAGE] ${agentType} lineage extinct - spawning Gen 1 founder`);
            return { generation: 1, parentInfo: null };
        }

        const lineage = this.lineages.get(agentType);

        // Lineage exists - spawn offspring at highest generation + 1
        const newGeneration = lineage.highestGeneration + 1;
        console.log(`[LINEAGE] ${agentType} lineage active (Gen ${lineage.highestGeneration}) - spawning Gen ${newGeneration} offspring`);

        return {
            generation: newGeneration,
            parentInfo: lineage.lastParent
        };
    },

    // Get lineage status for dashboard
    getLineageStatus(agentType) {
        if (!this.lineages.has(agentType)) {
            return { generation: 0, livingAgents: 0, extinct: true };
        }

        const lineage = this.lineages.get(agentType);
        return {
            generation: lineage.highestGeneration,
            livingAgents: lineage.livingAgents.length,
            extinct: lineage.lineageExtinct
        };
    },

    // Get all lineage data for display
    getAllLineages() {
        const allLineages = {};
        this.lineages.forEach((lineage, agentType) => {
            allLineages[agentType] = {
                generation: lineage.highestGeneration,
                living: lineage.livingAgents.length,
                extinct: lineage.lineageExtinct,
                lastParent: lineage.lastParent?.name || 'None'
            };
        });
        return allLineages;
    }
};

// Make activeAgents globally accessible for AI advisor
global.activeAgents = activeAgents;

function spawnOffspringFromDead(parentInfo) {
    const requestedType = parentInfo.type;
    const parentName = parentInfo.name;
    const newGeneration = (parentInfo.generation || 1) + 1;
    const parentUUID = parentInfo.uuid;  // Dead parent UUID

    // GYM INTELLIGENCE: Get recommended agent type based on village weaknesses
    const agentType = fitnessTracker.getRecommendedAgentTypes(requestedType);

    // GYM-STYLE EVOLUTION: Get genetic template from FITTEST agent (not dead parent)
    const fittestTemplate = fitnessTracker.getGeneticTemplate(agentType);

    console.log(`\n${'*'.repeat(70)}`);
    console.log(`SPAWNING OFFSPRING TO REPLACE ${parentName}`);
    console.log(`Requested Type: ${requestedType} → Spawning: ${agentType} | Generation: ${newGeneration}`);

    if (fittestTemplate) {
        // Use fittest agent as genetic template
        console.log(`🧬 GENETIC INHERITANCE: Using template from FITTEST ${agentType}`);
        console.log(`   Template: ${fittestTemplate.name} (Gen ${fittestTemplate.generation})`);
        console.log(`   Fitness Score: ${fittestTemplate.fitness.total.toFixed(2)}`);
        console.log(`   Stats: Reward=${fittestTemplate.fitness.reward.toFixed(1)}, Resources=${fittestTemplate.stats.resources_gathered}, Kills=${fittestTemplate.stats.mobs_killed}`);
    } else {
        // No fittest template, use dead parent
        console.log(`⚠️  No fittest template found, using dead parent genes`);
        if (parentUUID) {
            console.log(`Parent UUID: ${parentUUID} (genetic lineage tracked)`);
        }
    }
    console.log(`${'*'.repeat(70)}`);

    // Create offspring inheriting from FITTEST agent
    const geneticParentName = fittestTemplate ? fittestTemplate.name : parentName;
    const geneticParentUUID = fittestTemplate ? fittestTemplate.uuid : parentUUID;

    // Create offspring with fittest agent's UUID for genetic lineage
    createAgent(agentType, SERVER_CONFIG, geneticParentName, newGeneration, geneticParentUUID, (bot) => {
        // Add to active agents
        activeAgents.set(bot.agentName, bot);

        // Restore population slot
        if (parentInfo.slot !== undefined) {
            agentPopulation.set(bot.agentName, parentInfo.slot);
        }

        // Add genetic metadata
        bot.geneticTemplate = fittestTemplate;

        // Initialize ML with brain inheritance
        if (ML_ENABLED && mlTrainer && fittestTemplate && fittestTemplate.brain) {
            console.log(`[🧬 EVOLUTION] Inheriting neural network from genetic parent...`);
            mlTrainer.initializeAgent(bot, fittestTemplate.brain);
        } else if (ML_ENABLED && mlTrainer) {
            mlTrainer.initializeAgent(bot);
        }

        console.log(`[VILLAGE] ${bot.agentName} joins the village (Gen ${newGeneration}, replacing ${parentName})`);

        if (fittestTemplate) {
            console.log(`[🧬 EVOLUTION] Genetic Parent: ${geneticParentName} (${geneticParentUUID}) [FITTEST]`);
            console.log(`[🧬 EVOLUTION] Inherited Fitness: ${fittestTemplate.fitness.total.toFixed(2)}`);
            if (fittestTemplate.brain) {
                console.log(`[🧬 EVOLUTION] Neural network inherited with mutations`);
            }
        } else {
            console.log(`[LINEAGE] Parent: ${parentName} (${parentUUID || 'unknown'}) → Offspring: ${bot.agentName} (${bot.uuid})`);
        }
    }).catch((error) => {
        console.error(`[SPAWN ERROR] Failed to spawn offspring for ${parentName}: ${error.message}`);
        // Don't crash - the village continues without this offspring
    });
}

function setupAgentEvents(bot) {
    bot.on('spawn', () => {
        console.log(`[${bot.agentName}] Spawned at ${formatPos(bot.entity.position)}`);

        // Register in lineage tracker
        lineageTracker.registerAgent(bot.agentType, bot.agentName, bot.generation, bot.parentName, bot.parentUUID);

        // Initialize ML system for this agent (skip if already initialized with genetic inheritance)
        if (ML_ENABLED && mlTrainer && !bot.mlBrain) {
            mlTrainer.initializeAgent(bot);
            console.log(`[ML] ${bot.agentName} initialized with ML brain`);
        }

        bot.stuckDetector.start();

        // Setup Prismarine Viewer for this bot (optional - can be enabled/disabled)
        // Uncomment the line below to enable 3D viewer for each agent
        // dashboard.setupViewer(bot);

        // Learn from village knowledge on spawn
        bot.rewards.learnFromOthers(bot.agentType);

        // GameMaster Gym-style learning: Assign optimal task on spawn
        if (gameMaster) {
            gameMaster.onAgentSpawn(bot);
        }

        // Emit agent joined event to dashboard
        if (dashboard && dashboard.emitAgentJoined) {
            const stats = bot.rewards ? bot.rewards.getStats() : {};
            dashboard.emitAgentJoined({
                name: bot.agentName,
                type: bot.agentType,
                generation: bot.generation,
                health: bot.health || 0,
                food: bot.food || 0,
                position: bot.entity ? {
                    x: bot.entity.position.x.toFixed(1),
                    y: bot.entity.position.y.toFixed(1),
                    z: bot.entity.position.z.toFixed(1)
                } : null,
                currentTask: bot.ai ? bot.ai.currentGoal : 'Unknown',
                stats: stats,
                inventory: []
            });
        }

        // Emit join event to live console
        if (dashboard && dashboard.emitServerEvent) {
            const parentInfo = bot.parentName ? ` (offspring of ${bot.parentName})` : '';
            dashboard.emitServerEvent('agent', `${bot.agentName} [${bot.agentType}] joined the village - Gen ${bot.generation}${parentInfo}`, {
                agent: bot.agentName,
                type: bot.agentType,
                generation: bot.generation,
                parent: bot.parentName
            });
        }

        setTimeout(() => startAgentBehavior(bot), 3000);
        setInterval(() => showAgentStatus(bot), 30000);
        setInterval(() => bot.rewards.update(bot), 5000);

        // Periodic learning
        setInterval(() => bot.rewards.learnFromOthers(bot.agentType), 20000);

        // Periodic agent communication (every 30 seconds)
        setInterval(async () => {
            if (chatLLM && bot.entity) {
                try {
                    await tryAgentCommunication(bot);
                } catch (error) {
                    // Silently ignore communication errors
                }
            }
        }, 30000);
    });

    bot.on('health', () => {
        // Track health changes (NO PENALTY - agents are rewarded for doing tasks, not punished for damage)
        if (!bot.lastHealth) {
            bot.lastHealth = bot.health;
        } else if (bot.health < bot.lastHealth) {
            const damage = bot.lastHealth - bot.health;
            // REMOVED: Damage penalties are too harsh - agents should focus on completing tasks
            // const penalty = damage * -15; // -15 reward per heart lost
            // bot.rewards.addReward('damage_taken', penalty, `(lost ${damage} health)`);
            console.log(`[${bot.agentName}] WARNING: Took ${damage} damage! HP: ${bot.health}/20`);

            // McMMO ACROBATICS skill gain for taking damage (fall damage, dodging)
            // Gain XP proportional to damage taken (encourages learning to avoid damage)
            if (damage > 0) {
                bot.rewards.gainSkillXP('ACROBATICS');
            }

            // Track damage cause for GYM intelligence system
            const hostileMobs = ['zombie', 'skeleton', 'spider', 'creeper', 'enderman', 'witch'];
            const nearbyHostile = Object.values(bot.entities || {}).filter(entity => {
                if (!entity.position || entity === bot.entity) return false;
                const distance = entity.position.distanceTo(bot.entity.position);
                if (distance > 8) return false; // Within 8 blocks
                const name = (entity.name || entity.mobType || '').toLowerCase();
                return hostileMobs.some(mob => name.includes(mob));
            });

            if (nearbyHostile.length > 0) {
                bot.lastDamageCause = 'mob';
                console.log(`[${bot.agentName}] 💥 Combat damage! Hostile mobs nearby: ${nearbyHostile.length}`);

                // EMERGENCY RETREAT: If health is low, flee from hostile mobs
                if (bot.health <= 10) { // 50% health or lower
                    console.log(`[${bot.agentName}] 🏃 EMERGENCY RETREAT! Health critical: ${bot.health}/20`);
                    emergencyRetreat(bot, nearbyHostile).catch(err => {
                        console.error(`[${bot.agentName}] Retreat failed: ${err.message}`);
                    });
                }
            } else if (damage >= 2) {
                bot.lastDamageCause = 'fall';
                console.log(`[${bot.agentName}] 🪂 Fall damage detected! (${damage} hearts)`);
            } else {
                bot.lastDamageCause = 'other';
            }

            bot.lastHealth = bot.health;
        }
    });

    bot.on('death', () => {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`[${bot.agentName}] DIED! Respawning with offspring...`);
        console.log(`${'='.repeat(70)}`);
        bot.rewards.addReward('death', -50, '(death penalty - reduced)');

        // Handle ML death (finalize episode)
        if (ML_ENABLED && mlTrainer && bot.mlBrain) {
            mlTrainer.handleAgentDeath(bot).catch(err => {
                console.error(`[ML] Error handling death for ${bot.agentName}: ${err.message}`);
            });
        }

        // Calculate final fitness before death
        const finalFitness = fitnessTracker.updateFitness(bot);

        // Determine death cause for GYM intelligence
        let deathCause = 'other';
        if (bot.food <= 0) {
            deathCause = 'starvation';
        } else if (bot.isBugged) {
            deathCause = 'stuck';
        } else if (bot.lastDamageCause === 'mob' || bot.lastDamageCause === 'combat') {
            deathCause = 'combat';
        } else if (bot.lastDamageCause === 'fall') {
            deathCause = 'fall_damage';
        }

        // Record death in GYM for intelligent spawning
        fitnessTracker.recordDeath(bot.agentName, bot.agentType, deathCause, {
            health: bot.health,
            food: bot.food,
            position: bot.entity?.position,
            generation: bot.generation
        });

        // Remove from lineage tracker
        lineageTracker.removeAgent(bot.agentType, bot.agentName);

        // Remove from fitness tracker (preserves template for breeding)
        fitnessTracker.removeAgent(bot.agentType, bot.agentName);

        // GameMaster Gym-style learning: Record death as failure
        if (gameMaster) {
            gameMaster.onAgentDeath(bot, deathCause);
        }

        // Track death count and trigger distress if needed
        const deathCount = villageKnowledge.recordDeath(bot.agentName);
        bot.deathCount = deathCount;

        const finalStats = bot.rewards.getStats();
        console.log(`Final Stats: Reward=${finalStats.total_reward.toFixed(2)}, Fitness=${finalFitness.total.toFixed(2)}, Kills=${finalStats.mobs_killed}, Resources=${finalStats.resources_gathered}`);
        console.log(`Death Cause: ${deathCause} | Death Count: ${deathCount} for this agent lineage`);

        // If dying too much, signal distress
        if (deathCount >= 3) {
            const severity = deathCount >= 5 ? 'critical' : 'high';
            if (bot.entity?.position) {
                villageKnowledge.signalDistress(bot.agentName, `Died ${deathCount} times - needs support`, bot.entity.position, severity);
            }
        }

        // Record death in knowledge base and database
        bot.rewards.shareKnowledge('death', {
            location: bot.entity?.position,
            finalReward: finalStats.total_reward,
            generation: bot.generation,
            deathCount: deathCount
        }, 'death');

        // Store death memory
        if (memorySystem && bot.uuid && bot.entity?.position) {
            // Store death event
            memorySystem.storeMemory(
                bot.uuid,
                bot.agentName,
                bot.generation,
                'death',
                deathCause,
                bot.entity.position,
                { valence: -1.0, arousal: 1.0, importance: 1.0 },
                { finalReward: finalStats.total_reward, deathCount, health: bot.health, food: bot.food }
            ).catch(err => {
                console.error(`[MEMORY] Failed to store death memory for ${bot.agentName}:`, err.message);
            });

            // Record final emotional state
            if (bot.moods) {
                memorySystem.recordEmotionalState(bot.uuid, bot.moods, `death_by_${deathCause}`).catch(err => {
                    console.error(`[MEMORY] Failed to record final emotional state for ${bot.agentName}:`, err.message);
                });
            }

            // Update achievement: death count
            memorySystem.updateAchievement(bot.uuid, bot.agentName, bot.generation, 'deaths', deathCount).catch(err => {
                console.error(`[MEMORY] Failed to update death achievement for ${bot.agentName}:`, err.message);
            });
        }

        // Update database with death info
        db.run(`UPDATE lineage SET death_time = ?, final_reward = ?, total_experiences = ? WHERE agent_name = ?`,
            [Date.now(), finalStats.total_reward, bot.rewards.stats.knowledge_shared, bot.agentName]);

        // Stop stuck detector
        bot.stuckDetector.stop();

        // Save parent info for offspring
        const parentInfo = {
            type: bot.agentType,
            name: bot.agentName,
            generation: bot.generation,
            slot: agentPopulation.get(bot.agentName),
            uuid: bot.uuid || bot._client?.uuid || null  // Store parent UUID for lineage
        };

        // Remove from active agents
        activeAgents.delete(bot.agentName);
        agentPopulation.delete(bot.agentName);

        // UUID is permanently used - never released for reuse
        // Each agent keeps their unique UUID for genetic lineage tracking

        // Emit death event to live console
        if (dashboard && dashboard.emitServerEvent) {
            dashboard.emitServerEvent('death', `${bot.agentName} [${bot.agentType}] has died. Offspring will spawn in 3 seconds...`, {
                agent: bot.agentName,
                type: bot.agentType,
                generation: bot.generation,
                finalReward: finalStats.total_reward,
                deathCount: deathCount
            });
        }

        // Remove from dashboard
        if (dashboard && dashboard.emitAgentLeft) {
            dashboard.emitAgentLeft(bot.agentName);
        }

        // Disconnect the bot to prevent auto-respawn
        console.log(`[${bot.agentName}] Disconnecting to spawn offspring...`);
        bot.end();

        // Spawn offspring after a delay
        setTimeout(() => {
            spawnOffspringFromDead(parentInfo);
        }, 3000);
    });

    bot.on('message', async (jsonMsg) => {
        const message = jsonMsg.toString();

        // Try to parse sender from message format like "<PlayerName> message" or "[AgentName] message"
        let sender = 'Unknown';
        let messageContent = message;
        let isPlayerMessage = false;

        const match = message.match(/^[<\[](.+?)[>\]]\s*(.+)$/);
        if (match) {
            sender = match[1];
            messageContent = match[2];

            // Determine if this is a player (< >) or agent ([ ]) message
            isPlayerMessage = message.startsWith('<');

            // Store message in bot's AI memory (don't store own messages)
            if (sender !== bot.agentName) {
                bot.ai.addMessage(sender, messageContent);
            }
        }

        // Ignore join/leave messages
        if (message.includes('joined the game') || message.includes('left the game')) {
            return; // Don't respond to join/leave messages
        }

        // === SPAWN AGENT COMMAND ===
        // Check for !spawnagent <type> <amount> command
        const spawnMatch = message.match(/!spawnagent\s+(\w+)\s+(\d+)/i);
        if (spawnMatch) {
            const [_, requestedType, amountStr] = spawnMatch;
            const typeUpper = requestedType.toUpperCase();
            const amount = parseInt(amountStr);

            if (AGENT_TYPES[typeUpper]) {
                console.log(`\n[SPAWN COMMAND] Received request to spawn ${amount}x ${typeUpper} agents`);
                bot.chat(`Spawning ${amount} ${typeUpper} agent(s)...`);

                // Spawn the requested agents with stagger
                for (let i = 0; i < amount; i++) {
                    setTimeout(() => {
                        createAgent(typeUpper, SERVER_CONFIG, null, 1, null, (newBot) => {
                            activeAgents.set(newBot.agentName, newBot);
                            console.log(`[SPAWN COMMAND] ${newBot.agentName} spawned successfully!`);
                        }).catch((error) => {
                            console.error(`[SPAWN COMMAND] Failed to spawn ${typeUpper}: ${error.message}`);
                        });
                    }, i * 2000); // Stagger by 2 seconds each
                }

                setTimeout(() => {
                    bot.chat(`All ${amount} ${typeUpper} agents spawned successfully!`);
                }, amount * 2000 + 1000);

            } else {
                const validTypes = Object.keys(AGENT_TYPES).join(', ');
                console.log(`[SPAWN COMMAND] Invalid agent type: ${requestedType}`);
                bot.chat(`Unknown agent type: ${requestedType}. Valid: ${validTypes.substring(0, 80)}...`);
            }
            return; // Don't process as normal chat
        }

        // === ML COMMANDS ===
        // !mlstats - Show ML training statistics
        if (message.toLowerCase() === '!mlstats') {
            if (!mlTrainer) {
                bot.chat('ML System not initialized');
                return;
            }
            const stats = mlTrainer.getStats();
            bot.chat(`=== ML Training Stats ===`);
            bot.chat(`Total Steps: ${stats.totalSteps} | Episodes: ${stats.episodesCompleted}`);
            bot.chat(`Avg Reward: ${stats.avgReward} | Exploration: ${stats.explorationRate}`);
            bot.chat(`Buffer Size: ${stats.bufferSize} | Active Brains: ${stats.activeBrains}`);
            bot.chat(`Avg Episode Length: ${stats.avgEpisodeLength.toFixed(0)} steps`);
            console.log(`[ML STATS] Player ${username} requested ML statistics`);
            return;
        }

        // !mltoggle - Enable/disable ML training
        if (message.toLowerCase() === '!mltoggle') {
            ML_ENABLED = !ML_ENABLED;
            bot.chat(`ML Training ${ML_ENABLED ? 'ENABLED ✓' : 'DISABLED ✗'}`);
            if (mlTrainer) {
                mlTrainer.setTraining(ML_ENABLED);
            }
            console.log(`[ML TOGGLE] ML training ${ML_ENABLED ? 'enabled' : 'disabled'} by ${username}`);
            return;
        }

        // !mlsave - Save all ML models
        if (message.toLowerCase() === '!mlsave') {
            if (!mlTrainer) {
                bot.chat('ML System not initialized');
                return;
            }
            bot.chat('Saving all ML models...');
            mlTrainer.saveAllModels().then(() => {
                bot.chat('All ML models saved successfully!');
                console.log(`[ML SAVE] Models saved by ${username}`);
            }).catch(err => {
                bot.chat('Error saving models: ' + err.message);
            });
            return;
        }

        // !mlhelp - Show ML commands
        if (message.toLowerCase() === '!mlhelp') {
            bot.chat('=== ML System Commands ===');
            bot.chat('!mlstats - Show training statistics');
            bot.chat('!mltoggle - Enable/disable ML training');
            bot.chat('!mlsave - Save all trained models');
            bot.chat('!mlhelp - Show this help');
            return;
        }

        // Chat responses disabled - agents will not respond to messages
    });

    bot.on('error', (err) => {
        // Filter out harmless protocol parsing errors (Minecraft 1.21 quirks)
        if (err.name === 'PartialReadError' || err.name === 'ReadError') {
            // Silently ignore - these don't affect bot functionality
            return;
        }
        if (err.stack && (err.stack.includes('SlotComponent') || err.stack.includes('readBool') || err.stack.includes('VarInt'))) {
            // Silently ignore protocol parsing errors
            return;
        }
        console.log(`\n[BOT ERROR] ${bot.agentName}: ${err.message}`);
        console.log(`[BOT ERROR] Stack: ${err.stack}`);
    });

    bot.on('kicked', (reason) => {
        console.log(`\n[BOT KICKED] ${bot.agentName}: ${reason}`);
    });

    bot.on('end', () => {
        console.log(`[BOT END] ${bot.agentName} disconnected`);
        bot.stuckDetector.stop();
        activeAgents.delete(bot.agentName);

        // Emit agent left event to dashboard
        if (dashboard && dashboard.emitAgentLeft) {
            dashboard.emitAgentLeft(bot.agentName);
        }
    });
}

function formatPos(pos) {
    return `X=${pos.x.toFixed(1)}, Y=${pos.y.toFixed(1)}, Z=${pos.z.toFixed(1)}`;
}

function showAgentStatus(bot) {
    const stats = bot.rewards.getStats();
    const bugStatus = bot.isBugged ? ' [BUGGED]' : '';
    const beaconStatus = bot.rewards.needsResources ? ' [NEEDS RESOURCES]' : '';
    console.log(`\n[${bot.agentName}${bugStatus}${beaconStatus}]`);
    console.log(`  Reward: ${stats.total_reward.toFixed(2)} | Survival: ${stats.survival_time.toFixed(1)}s`);
    console.log(`  Resources: ${stats.resources_gathered} | Kills: ${stats.mobs_killed} | Trades: ${stats.trades_completed}`);
    console.log(`  Knowledge: Shared=${stats.knowledge_shared}, Learned=${stats.knowledge_learned}`);
}

// === ML BEHAVIOR LOOP ===
async function mlAgentBehaviorLoop(bot) {
    // Continuous ML action loop
    const mlLoop = async () => {
        if (!bot.entity || bot.health <= 0) {
            // Bot dead or disconnected, stop loop
            return;
        }

        try {
            // Let ML decide next action
            const result = await mlTrainer.agentStep(bot);

            if (result) {
                // Store ML stats for dashboard display
                bot.mlLastActionName = result.actionName;
                bot.mlLastActionSuccess = result.success;
                bot.mlWasExploring = result.wasExploring || false;

                // Log occasional actions for monitoring
                if (Math.random() < 0.05) {  // 5% chance to log
                    console.log(`[ML] ${bot.agentName}: ${result.actionName} (value: ${result.value.toFixed(2)})`);
                }
            }
        } catch (error) {
            console.error(`[ML] Error in ${bot.agentName} behavior loop: ${error.message}`);
        }

        // Schedule next step (agents act every 1-3 seconds)
        const nextStepDelay = 1000 + Math.random() * 2000;
        setTimeout(mlLoop, nextStepDelay);
    };

    // Start the loop
    mlLoop();
}

// === BEHAVIORS ===
async function startAgentBehavior(bot) {
    const behavior = AGENT_TYPES[bot.agentType].behavior;

    // Use ML behavior if enabled
    if (ML_ENABLED && mlTrainer && bot.mlBrain) {
        console.log(`[${bot.agentName}] Starting ML-driven behavior...`);
        mlAgentBehaviorLoop(bot);
        return;
    }

    // Otherwise use traditional behavior
    console.log(`[${bot.agentName}] Starting ${behavior}...`);

    switch (behavior) {
        // Resource gathering
        case 'mining': miningBehavior(bot); break;
        case 'lumberjack': miningBehavior(bot); break; // Similar to mining
        case 'quarry': miningBehavior(bot); break;
        case 'gem_mining': miningBehavior(bot); break;

        // Exploration
        case 'exploring': exploringBehavior(bot); break;
        case 'scout': exploringBehavior(bot); break;
        case 'spelunking': exploringBehavior(bot); break;
        case 'mapping': exploringBehavior(bot); break;
        case 'treasure_hunting': exploringBehavior(bot); break;
        case 'nether_exploring': exploringBehavior(bot); break;

        // Combat
        case 'hunting': huntingBehavior(bot); break;
        case 'guard': huntingBehavior(bot); break;
        case 'archer': huntingBehavior(bot); break;
        case 'knight': huntingBehavior(bot); break;
        case 'end_raiding': huntingBehavior(bot); break;

        // Agricultural
        case 'farming': exploringBehavior(bot); break;
        case 'fishing': exploringBehavior(bot); break;
        case 'shepherding': exploringBehavior(bot); break;
        case 'ranching': exploringBehavior(bot); break;
        case 'beekeeping': exploringBehavior(bot); break;
        case 'foraging': exploringBehavior(bot); break;

        // Crafting/Support
        case 'trading': exploringBehavior(bot); break;
        case 'blacksmith': exploringBehavior(bot); break;
        case 'baking': exploringBehavior(bot); break;
        case 'building': exploringBehavior(bot); break;
        case 'toolmaking': exploringBehavior(bot); break;
        case 'healing': exploringBehavior(bot); break;
        case 'alchemy': exploringBehavior(bot); break;
        case 'enchanting': exploringBehavior(bot); break;
        case 'redstone': exploringBehavior(bot); break;
        case 'fossil_hunting': exploringBehavior(bot); break;

        default: exploringBehavior(bot);
    }
}

async function miningBehavior(bot) {
    let lastAdvisorCheck = Date.now();

    while (bot.entity) {
        try {
            // AI Advisor disabled - agents maintain their assigned roles
            // Agents no longer switch behaviors automatically

            // If currently supporting someone, run support behavior instead
            if (bot.isSupporting) {
                await supportBehavior(bot, bot.isSupporting);
                continue;
            }

            // Update goal
            bot.ai.setGoal('Mining resources to gather materials for the village');

            // Check for nearby danger and defend
            await checkAndDefend(bot);

            // Check for distressed teammates (every 10 iterations)
            if (Math.random() < 0.1) {
                const offered = await checkAndOfferSupport(bot);
                if (offered) {
                    await sleep(5000);
                    continue;
                }
            }

            // Check if should respond to beacon
            const responded = await checkAndRespondToBeacon(bot);
            if (responded) {
                await sleep(5000);
                continue;
            }

            // Check if need to signal for resources (based on priority)
            const inventory = bot.inventory.items();
            const threshold = Math.max(3, 10 - bot.resourcePriority); // Miners need more
            if (inventory.length < threshold) {
                bot.rewards.needsResources = true;
                bot.ai.setIssue('Low on tools and resources, need help from other agents');
                const urgency = bot.resourcePriority >= 8; // High priority = urgent
                villageKnowledge.signalResourceNeed(bot.agentName, 'tools', bot.entity.position, urgency);
            } else {
                bot.rewards.needsResources = false;
                bot.ai.setIssue(null);
                villageKnowledge.clearResourceBeacon(bot.agentName);
            }

            // Check village knowledge for known resource locations first
            const knownResources = villageKnowledge.getResourceLocations('stone');

            if (knownResources.length > 0) {
                const target = knownResources[0];
                if (!villageKnowledge.isLocationBugged(target)) {
                    console.log(`[${bot.agentName}] Using shared knowledge to find stone`);
                }
            }

            const oreTypes = AGENT_TYPES.MINING.targets;
            const ore = bot.findBlock({
                matching: block => oreTypes.includes(block.name),
                maxDistance: 32
            });

            if (ore && !villageKnowledge.isLocationBugged(ore.position)) {
                console.log(`[${bot.agentName}] Found ${ore.name}`);

                // Move closer to block
                const dist = bot.entity.position.distanceTo(ore.position);
                if (dist > 4.5) {
                    await bot.pathfinder.goto(new GoalNear(ore.position.x, ore.position.y, ore.position.z, 3));
                }

                try {
                    // Look at the block
                    await bot.lookAt(ore.position.offset(0.5, 0.5, 0.5));

                    // Equip appropriate tool
                    await bot.tool.equipForBlock(ore);

                    console.log(`[${bot.agentName}] Mining ${ore.name}... (this will take time)`);

                    // Actually dig - wait for it to complete
                    await bot.dig(ore, true); // Force dig to completion

                    bot.rewards.addReward('mining', 10, `(${ore.name})`);
                    bot.rewards.stats.resources_gathered++;

                    // McMMO skill gain based on block type
                    if (ore.name.includes('log') || ore.name.includes('wood')) {
                        bot.rewards.gainSkillXP('WOODCUTTING'); // Wood cutting for logs
                    } else if (ore.name.includes('dirt') || ore.name.includes('sand') || ore.name.includes('gravel')) {
                        bot.rewards.gainSkillXP('EXCAVATION'); // Excavation for soft blocks
                    } else {
                        bot.rewards.gainSkillXP('MINING'); // Mining for ores and stone
                    }

                    // Share success with village
                    bot.rewards.shareKnowledge('mining', {
                        resource: ore.name,
                        location: ore.position
                    }, 'success');

                    console.log(`[${bot.agentName}] Successfully mined ${ore.name}!`);

                    // GameMaster Gym-style learning: Record task success
                    if (gameMaster) {
                        gameMaster.onTaskComplete(bot, 'mining', 10);
                    }
                } catch (digErr) {
                    console.log(`[${bot.agentName}] Mining failed: ${digErr.message}`);

                    // Share failure
                    bot.rewards.shareKnowledge('mining', {
                        resource: ore.name,
                        location: ore.position,
                        error: digErr.message
                    }, 'failure');
                }

                await sleep(1000);
            } else {
                await moveRandom(bot, 20);
            }

            await sleep(2000);
        } catch (err) {
            console.log(`[${bot.agentName}] Error: ${err.message}`);
            await sleep(5000);
        }
    }
}

async function exploringBehavior(bot) {
    let lastAdvisorCheck = Date.now();

    while (bot.entity) {
        try {
            // AI Advisor disabled - agents maintain their assigned roles

            // If currently supporting someone, run support behavior instead
            if (bot.isSupporting) {
                await supportBehavior(bot, bot.isSupporting);
                continue;
            }

            // Update goal
            bot.ai.setGoal('Exploring the world to discover new areas and resources');

            // Check health
            if (bot.health < 10) {
                bot.ai.setIssue('Low health - need to find food or avoid danger');
            } else {
                bot.ai.setIssue(null);
            }

            // Check for nearby danger and defend
            await checkAndDefend(bot);

            // Check for distressed teammates (every 10 iterations)
            if (Math.random() < 0.1) {
                const offered = await checkAndOfferSupport(bot);
                if (offered) {
                    await sleep(5000);
                    continue;
                }
            }

            // Check if should respond to beacon
            const responded = await checkAndRespondToBeacon(bot);
            if (responded) {
                await sleep(5000);
                continue;
            }

            await moveRandom(bot, 30);
            bot.rewards.stats.tasks_completed++;

            // Share discovery
            bot.rewards.shareKnowledge('exploration', {
                location: bot.entity.position
            }, 'success');

            await sleep(5000);
        } catch (err) {
            await sleep(3000);
        }
    }
}

async function huntingBehavior(bot) {
    let lastAdvisorCheck = Date.now();

    while (bot.entity) {
        try {
            // AI Advisor disabled - agents maintain their assigned roles

            // If currently supporting someone, run support behavior instead
            if (bot.isSupporting) {
                await supportBehavior(bot, bot.isSupporting);
                continue;
            }

            // Update goal
            bot.ai.setGoal('Hunting hostile mobs to protect the village and gather drops');

            // Check for distressed teammates (every 10 iterations)
            if (Math.random() < 0.1) {
                const offered = await checkAndOfferSupport(bot);
                if (offered) {
                    await sleep(5000);
                    continue;
                }
            }

            const mob = findNearbyMob(bot);

            if (mob) {
                bot.ai.setIssue(`Engaging hostile mob: ${mob.name || 'unknown'}`);
            } else {
                bot.ai.setIssue(null);
            }

            if (mob && mob.position.distanceTo(bot.entity.position) < 16) {
                if (!villageKnowledge.isDangerous(mob.position)) {
                    console.log(`[${bot.agentName}] Hunting ${mob.name || 'mob'}...`);

                    await bot.pathfinder.goto(new GoalNear(mob.position.x, mob.position.y, mob.position.z, 3));

                    // Actually attack the mob
                    try {
                        await bot.attack(mob);
                        bot.rewards.addReward('combat', 50, `(killed ${mob.name || 'mob'})`);
                        bot.rewards.stats.mobs_killed++;

                        // McMMO combat skill gain based on weapon
                        const heldItem = bot.heldItem;
                        if (heldItem) {
                            const itemName = heldItem.name.toLowerCase();
                            if (itemName.includes('bow') || itemName.includes('crossbow')) {
                                bot.rewards.gainSkillXP('ARCHERY');
                            } else if (itemName.includes('sword')) {
                                bot.rewards.gainSkillXP('SWORDS');
                            } else if (itemName.includes('axe')) {
                                bot.rewards.gainSkillXP('AXES');
                            } else {
                                bot.rewards.gainSkillXP('UNARMED'); // Fists or other items
                            }
                        } else {
                            bot.rewards.gainSkillXP('UNARMED'); // No weapon equipped
                        }

                        // Share combat success
                        bot.rewards.shareKnowledge('combat', {
                            mob: mob.name,
                            location: mob.position,
                            result: 'killed'
                        }, 'success');

                        // Store combat memory (danger event)
                        if (memorySystem && bot.uuid && bot.entity) {
                            const mobName = mob.name || 'mob';
                            const isHostile = ['zombie', 'skeleton', 'spider', 'creeper', 'enderman'].includes(mobName);
                            memorySystem.storeMemory(
                                bot.uuid,
                                bot.agentName,
                                bot.generation,
                                'danger',
                                `combat_${mobName}_killed`,
                                bot.entity.position,
                                { valence: isHostile ? 0.3 : 0.6, arousal: 0.9, importance: 0.7 },
                                { mobType: mobName, result: 'killed', health: bot.health }
                            ).catch(err => {
                                console.error(`[MEMORY] Failed to store combat memory for ${bot.agentName}:`, err.message);
                            });

                            // Update achievement: mobs killed
                            memorySystem.updateAchievement(bot.uuid, bot.agentName, bot.generation, 'mobs_killed', bot.rewards.stats.mobs_killed).catch(err => {
                                console.error(`[MEMORY] Failed to update mobs_killed achievement:`, err.message);
                            });
                        }

                        console.log(`[${bot.agentName}] Killed ${mob.name || 'mob'}!`);
                    } catch (attackErr) {
                        bot.rewards.addReward('combat', 20, `(engaged ${mob.name || 'mob'})`);
                    }

                    await sleep(2000);
                }
            } else {
                await moveRandom(bot, 15);
            }

            await sleep(3000);
        } catch (err) {
            await sleep(5000);
        }
    }
}

function findNearbyMob(bot) {
    const hostileMobs = ['zombie', 'skeleton', 'spider', 'creeper'];
    const entities = Object.values(bot.entities).filter(entity => {
        if (!entity.position || entity === bot.entity) return false;
        const name = (entity.name || entity.mobType || '').toLowerCase();
        return hostileMobs.some(mob => name.includes(mob));
    });

    return entities.length > 0 ? entities[0] : null;
}

async function moveRandom(bot, distance) {
    if (!bot.entity) return;

    const angle = Math.random() * Math.PI * 2;
    const x = bot.entity.position.x + Math.cos(angle) * distance;
    const z = bot.entity.position.z + Math.sin(angle) * distance;

    const mcData = require('minecraft-data')(bot.version);
    const movements = new Movements(bot, mcData);

    bot.pathfinder.setMovements(movements);
    bot.pathfinder.setGoal(new GoalXZ(x, z));

    await sleep(3000);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Emergency retreat system - flee from hostile mobs when health is critical
async function emergencyRetreat(bot, hostileMobs) {
    if (!bot.entity || hostileMobs.length === 0) return;

    // Prevent multiple simultaneous retreat attempts
    if (bot.isRetreating) {
        console.log(`[${bot.agentName}] Already retreating...`);
        return;
    }

    bot.isRetreating = true;

    try {
        // Calculate center of hostile mob positions
        let avgX = 0, avgZ = 0;
        for (const mob of hostileMobs) {
            if (mob.position) {
                avgX += mob.position.x;
                avgZ += mob.position.z;
            }
        }
        avgX /= hostileMobs.length;
        avgZ /= hostileMobs.length;

        // Calculate flee direction (away from mobs)
        const dx = bot.entity.position.x - avgX;
        const dz = bot.entity.position.z - avgZ;
        const distance = Math.sqrt(dx * dx + dz * dz);

        // Normalize and scale to flee 25 blocks away
        const fleeDistance = 25;
        const fleeX = bot.entity.position.x + (dx / distance) * fleeDistance;
        const fleeZ = bot.entity.position.z + (dz / distance) * fleeDistance;

        console.log(`[${bot.agentName}] 🏃 Fleeing to safe location (${fleeDistance} blocks away)...`);

        // Set up pathfinder with sprinting enabled
        const mcData = require('minecraft-data')(bot.version);
        const movements = new Movements(bot, mcData);
        movements.canDig = false; // Don't dig while fleeing (too slow)
        movements.allow1by1towers = false; // Don't tower while fleeing

        bot.pathfinder.setMovements(movements);

        // Sprint away using pathfinder
        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(fleeX, bot.entity.position.y, fleeZ, 3), true);

        // Enable sprinting
        bot.setControlState('sprint', true);

        // Wait for retreat to complete or timeout after 5 seconds
        await Promise.race([
            new Promise((resolve) => {
                const checkDistance = setInterval(() => {
                    if (!bot.entity) {
                        clearInterval(checkDistance);
                        resolve();
                        return;
                    }

                    // Check if we're far enough from all hostile mobs
                    let minDistance = Infinity;
                    for (const mob of hostileMobs) {
                        if (mob.position) {
                            const dist = bot.entity.position.distanceTo(mob.position);
                            minDistance = Math.min(minDistance, dist);
                        }
                    }

                    if (minDistance > 20) {
                        console.log(`[${bot.agentName}] ✅ Retreat successful! Safe distance achieved: ${minDistance.toFixed(1)} blocks`);
                        clearInterval(checkDistance);
                        resolve();
                    }
                }, 500);
            }),
            sleep(5000) // 5 second timeout
        ]);

        // Stop sprinting
        bot.setControlState('sprint', false);

        // Reward for successful retreat
        bot.rewards.addReward('retreat', 15, '(emergency retreat from danger)');
        bot.rewards.gainSkillXP('ACROBATICS'); // Dodging skill

    } catch (error) {
        console.error(`[${bot.agentName}] Retreat error: ${error.message}`);
    } finally {
        bot.isRetreating = false;
    }
}

// Self-defense system - all agents defend themselves
async function checkAndDefend(bot) {
    const hostileMobs = ['zombie', 'skeleton', 'spider', 'creeper', 'enderman'];
    const nearbyHostile = Object.values(bot.entities).filter(entity => {
        if (!entity.position || entity === bot.entity) return false;
        const distance = entity.position.distanceTo(bot.entity.position);
        if (distance > 10) return false;
        const name = (entity.name || entity.mobType || '').toLowerCase();
        return hostileMobs.some(mob => name.includes(mob));
    });

    if (nearbyHostile.length > 0) {
        const threat = nearbyHostile[0];
        const distance = threat.position.distanceTo(bot.entity.position);

        if (distance < 5) {
            console.log(`[${bot.agentName}] DEFENDING against ${threat.name || 'mob'}!`);
            try {
                await bot.attack(threat);
                bot.rewards.addReward('self_defense', 75, `(defended against ${threat.name || 'mob'})`);
                bot.rewards.stats.mobs_killed++;

                // McMMO combat skill gain based on weapon
                const heldItem = bot.heldItem;
                if (heldItem) {
                    const itemName = heldItem.name.toLowerCase();
                    if (itemName.includes('bow') || itemName.includes('crossbow')) {
                        bot.rewards.gainSkillXP('ARCHERY');
                    } else if (itemName.includes('sword')) {
                        bot.rewards.gainSkillXP('SWORDS');
                    } else if (itemName.includes('axe')) {
                        bot.rewards.gainSkillXP('AXES');
                    } else {
                        bot.rewards.gainSkillXP('UNARMED'); // Fists or other items
                    }
                } else {
                    bot.rewards.gainSkillXP('UNARMED'); // No weapon equipped
                }

                bot.rewards.shareKnowledge('combat', {
                    mob: threat.name,
                    location: threat.position,
                    result: 'self_defense'
                }, 'success');

                console.log(`[${bot.agentName}] Defended successfully!`);
            } catch (err) {
                // Fight or flight failed, try to escape
                console.log(`[${bot.agentName}] Retreating from danger!`);
            }
        }
    }
}

// Beacon response system - agents help each other
async function checkAndRespondToBeacon(bot) {
    const beacons = villageKnowledge.getActiveBeacons();

    for (const [agentName, beacon] of beacons) {
        // Don't respond to own beacon
        if (agentName === bot.agentName) continue;

        const distance = bot.entity.position.distanceTo(beacon.position);

        // If close enough, attempt trade
        if (distance < 20) {
            console.log(`[${bot.agentName}] Responding to ${agentName}'s beacon for ${beacon.resource}`);

            try {
                // Move closer
                await bot.pathfinder.goto(new GoalNear(beacon.position.x, beacon.position.y, beacon.position.z, 5));

                // Simulate trade
                bot.rewards.addReward('trade', 25, `(helped ${agentName})`);
                bot.rewards.stats.trades_completed++;

                console.log(`[${bot.agentName}] Traded with ${agentName}!`);

                // Share trade success
                bot.rewards.shareKnowledge('trade', {
                    with: agentName,
                    resource: beacon.resource
                }, 'success');

                return true;
            } catch (err) {
                console.log(`[${bot.agentName}] Trade failed: ${err.message}`);
            }
        }
    }

    return false;
}

// Distress support system - agents check and help struggling teammates
async function checkAndOfferSupport(bot) {
    const distressedAgents = villageKnowledge.getAgentsInDistress();

    for (const [agentName, signal] of distressedAgents) {
        // Don't help yourself
        if (agentName === bot.agentName) continue;

        // Check if too far away or if already being helped
        const supporters = villageKnowledge.supportRequests.get(agentName) || [];
        if (supporters.length >= 2) continue; // Max 2 supporters per agent

        // Check distance
        const distance = bot.entity.position.distanceTo(signal.position);

        // If within range and willing to help
        if (distance < 50 && Math.random() < 0.7) {  // 70% chance to help
            console.log(`\n[SUPPORT] ${bot.agentName} detected ${agentName} in distress!`);
            console.log(`[SUPPORT] Reason: ${signal.reason} (${signal.severity})`);

            // Register as supporter
            villageKnowledge.registerSupport(agentName, bot.agentName);

            // Set bot's goal to support (chat disabled)
            try {
                console.log(`[SUPPORT] ${bot.agentName} is offering help to ${agentName}`);

                // Set bot's goal to support
                bot.ai.setGoal(`Helping ${agentName} who is struggling`);
                bot.isSupporting = agentName;
                bot.supportStartTime = Date.now();

                // Move towards the distressed agent
                await bot.pathfinder.goto(new GoalNear(signal.position.x, signal.position.y, signal.position.z, 10));

                // Reward for offering support
                bot.rewards.addReward('support_offered', 50, `(helping ${agentName})`);

                return true;
            } catch (err) {
                console.log(`[SUPPORT ERROR] ${bot.agentName}: ${err.message}`);
            }
        }
    }

    return false;
}

// Support behavior - temporarily change role to help
async function supportBehavior(bot, distressedAgent) {
    console.log(`[SUPPORT MODE] ${bot.agentName} is now supporting ${distressedAgent}`);

    // Support for 2 minutes or until agent recovers
    const supportDuration = 120000; // 2 minutes
    const startTime = Date.now();

    while (bot.entity && bot.isSupporting && (Date.now() - startTime < supportDuration)) {
        try {
            // Check if the distressed agent still needs help
            if (!villageKnowledge.isSupportNeeded(distressedAgent)) {
                console.log(`[SUPPORT COMPLETE] ${distressedAgent} has recovered!`);
                bot.rewards.addReward('support_success', 100, `(${distressedAgent} recovered)`);
                bot.isSupporting = null;
                bot.ai.setGoal(null);
                break;
            }

            // Get the distressed agent's location
            const distressSignal = villageKnowledge.distressSignals.get(distressedAgent);
            if (!distressSignal) {
                bot.isSupporting = null;
                break;
            }

            // Stay near and defend the area
            await checkAndDefend(bot);

            // Move to keep close
            const distance = bot.entity.position.distanceTo(distressSignal.position);
            if (distance > 15) {
                await bot.pathfinder.goto(new GoalNear(distressSignal.position.x, distressSignal.position.y, distressSignal.position.z, 10));
            }

            // Reward for active support
            bot.rewards.addReward('active_support', 5, `(supporting ${distressedAgent})`);

            await sleep(5000);
        } catch (err) {
            console.log(`[SUPPORT ERROR] ${bot.agentName}: ${err.message}`);
            await sleep(3000);
        }
    }

    // Support session ended
    console.log(`[SUPPORT END] ${bot.agentName} ending support for ${distressedAgent}`);
    bot.isSupporting = null;
    bot.ai.setGoal(null);
}

// Agent chatter system - DISABLED
function initiateAgentChatter() {
    // Chat system disabled - agents will not chat autonomously
}

// === START VILLAGE ===
async function startVillage(serverConfig, agentTypes = ['EXPLORING', 'MINING']) {
    console.log('\n' + '='.repeat(70));
    console.log('INTELLIGENT VILLAGE WITH KNOWLEDGE SHARING');
    console.log('='.repeat(70));
    console.log('Agents will learn from each other\'s experiences');
    console.log('⚙️  Agents operate autonomously without Game Master');
    console.log('='.repeat(70));

    // Game Master removed - agents work independently
    console.log('[VILLAGE] Agents will maintain their assigned roles');

    // Batch spawning configuration
    const BATCH_SIZE = 1; // Spawn 1 agent at a time (reduced load)
    const BATCH_DELAY = 15000; // 15 seconds between batches (reduced server load)
    const RETRY_DELAY = 30000; // 30 seconds before retry on failure
    const MAX_RETRIES = 5; // Max retries per agent

    // Track spawn queue and failures
    let spawnQueue = [...agentTypes];
    let failedSpawns = [];
    let totalTarget = agentTypes.length;
    let successCount = 0;
    let attemptCount = new Map(); // Track retry attempts per type

    console.log(`[BATCH SPAWN] Starting batch spawn system`);
    console.log(`[BATCH SPAWN] Target: ${totalTarget} agents | Batch size: ${BATCH_SIZE} | Delay: ${BATCH_DELAY}ms`);

    // Process batches
    while (spawnQueue.length > 0 || failedSpawns.length > 0) {
        // If main queue is empty, try failed spawns again
        if (spawnQueue.length === 0 && failedSpawns.length > 0) {
            console.log(`[BATCH SPAWN] Retrying ${failedSpawns.length} failed spawns after delay...`);
            await sleep(RETRY_DELAY);
            spawnQueue = [...failedSpawns];
            failedSpawns = [];
        }

        // Get next batch
        const batch = spawnQueue.splice(0, BATCH_SIZE);
        if (batch.length === 0) break;

        console.log(`[BATCH SPAWN] Processing batch of ${batch.length} agents (${successCount}/${totalTarget} spawned)`);

        // Spawn batch in parallel
        const batchPromises = batch.map(async (type) => {
            const attempts = attemptCount.get(type) || 0;
            attemptCount.set(type, attempts + 1);

            try {
                const bot = await createAgent(type, serverConfig, null, 1, null);
                activeAgents.set(bot.agentName, bot);
                agentPopulation.set(bot.agentName, successCount);
                successCount++;
                console.log(`[BATCH SPAWN] ✓ ${bot.agentName} spawned successfully (${successCount}/${totalTarget})`);
                return { success: true, type };
            } catch (error) {
                const attemptNum = attemptCount.get(type);
                console.error(`[BATCH SPAWN] ✗ Failed to spawn ${type} (attempt ${attemptNum}): ${error.message}`);

                // Add to retry queue if under max retries
                if (attemptNum < MAX_RETRIES) {
                    return { success: false, type, retry: true };
                } else {
                    console.error(`[BATCH SPAWN] ⚠ ${type} exceeded max retries (${MAX_RETRIES}), skipping`);
                    return { success: false, type, retry: false };
                }
            }
        });

        // Wait for batch to complete
        const results = await Promise.all(batchPromises);

        // Collect failed spawns for retry
        results.forEach(result => {
            if (!result.success && result.retry) {
                failedSpawns.push(result.type);
            }
        });

        // Progress update
        const remaining = spawnQueue.length + failedSpawns.length;
        if (remaining > 0) {
            console.log(`[BATCH SPAWN] Progress: ${successCount}/${totalTarget} | Remaining: ${remaining} | Failed (retrying): ${failedSpawns.length}`);
            console.log(`[BATCH SPAWN] Waiting ${BATCH_DELAY}ms before next batch...`);
            await sleep(BATCH_DELAY);
        }
    }

    console.log(`[BATCH SPAWN] ✓ Batch spawn complete! Successfully spawned ${successCount}/${totalTarget} agents`);
    if (successCount < totalTarget) {
        console.log(`[BATCH SPAWN] ⚠ Warning: ${totalTarget - successCount} agents could not be spawned after max retries`);
    }

    // Game Master disabled - no periodic guidance

    // Village status
    setInterval(() => {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`VILLAGE STATUS - ${activeAgents.size} agents`);
        console.log(`${'='.repeat(70)}`);

        const knowledge = villageKnowledge.getSummary();
        console.log(`Collective Knowledge:`);
        console.log(`  Experiences: ${knowledge.totalExperiences} | Generations: ${knowledge.totalGenerations}`);
        console.log(`  Resource Locations: ${knowledge.totalResourceLocations}`);
        console.log(`  Bugged Locations: ${knowledge.buggedLocations} | Danger Zones: ${knowledge.dangerZones}`);
        console.log(`  Known Strategies: ${knowledge.knownStrategies} | Active Beacons: ${knowledge.activeBeacons}`);
        console.log(`  DISTRESS SIGNALS: ${knowledge.agentsInDistress} | Active Support: ${knowledge.activeSupport}`);

        // Show Game Master priorities
        if (gameMaster) {
            const priorities = gameMaster.getPriorities();
            console.log(`\n🎮 Game Master Priorities:`);
            console.log(`  Resource Gathering: ${priorities.resource_gathering}/10`);
            console.log(`  Combat: ${priorities.combat}/10`);
            console.log(`  Exploration: ${priorities.exploration}/10`);
            console.log(`  Support: ${priorities.support}/10`);
        }
        console.log();

        // Count agents by type
        const typeCounts = new Map();
        activeAgents.forEach((bot) => {
            const count = typeCounts.get(bot.agentType) || 0;
            typeCounts.set(bot.agentType, count + 1);
        });

        console.log(`Agent Type Distribution:`);
        const sortedTypes = Array.from(typeCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        sortedTypes.forEach(([type, count]) => {
            console.log(`  ${type}: ${count} agents`);
        });
        console.log();

        // Update fitness for all active agents
        activeAgents.forEach((bot) => {
            fitnessTracker.updateFitness(bot);
        });

        // Show fitness rankings (top 5 fittest agents)
        const rankings = fitnessTracker.getAllRankings();
        if (rankings.length > 0) {
            console.log(`🏆 Top Fitness Rankings:`);
            rankings.slice(0, 5).forEach((rank, index) => {
                console.log(`  ${index + 1}. ${rank.name} [${rank.type}] Gen${rank.generation} - Fitness: ${rank.fitness.toFixed(2)}`);
            });
            console.log();
        }

        activeAgents.forEach((bot) => {
            const stats = bot.rewards.getStats();
            const status = bot.isBugged ? ' [BUGGED]' : '';
            const genInfo = bot.generation > 1 ? ` Gen${bot.generation}` : '';
            const fitness = bot.rewards.calculateFitness();
            console.log(`  ${bot.agentName}${status}${genInfo}: Reward=${stats.total_reward.toFixed(2)}, Fitness=${fitness.total.toFixed(1)}, Kills=${stats.mobs_killed}, Resources=${stats.resources_gathered}`);
        });
        console.log(`${'='.repeat(70)}`);
    }, 60000);

    // Agent chatter disabled
}

// === START ===
const SERVER_CONFIG = {
    host: 'vps-38b05e45.vps.ovh.net',
    port: 25565,
    version: '1.21',
    auth: 'offline'
};

// === HEADLESS MODE ===
// Set to true for terminal-only operation (no web dashboard)
// Default: false (dashboard runs in-process on port 3000)
const HEADLESS_MODE = false;

// === MEGA VILLAGE WITH OFFSPRING SYSTEM ===
console.log('\n' + '='.repeat(70));
console.log('MEGA VILLAGE - EVOLUTIONARY AGENT SYSTEM');
console.log('='.repeat(70));
console.log('Features:');
console.log('  - 29 specialized agent types');
console.log('  - When agents die, smarter offspring replace them');
console.log('  - Offspring inherit parent knowledge (+5 reward per experience)');
console.log('  - Massive death penalty (-200) incentivizes survival');
console.log('  - Each generation gets smarter');
console.log(`  - Mode: ${HEADLESS_MODE ? 'HEADLESS (terminal-only)' : 'Web Dashboard Enabled'}`);
console.log('='.repeat(70));
console.log('\n');

// Create mega village - configurable count per type
// INTERLEAVED: Spawns 1 of each type in rotation (better distribution)
const createMegaVillage = (types, count) => {
    const allAgents = [];

    // Interleave: spawn 1 of each type, then loop for the next one
    for (let i = 0; i < count; i++) {
        types.forEach(type => {
            allAgents.push(type);
        });
    }

    return allAgents;
};

const agentTypes = [
    // Resource Gathering (7)
    'MINING', 'LUMBERJACK', 'FISHING', 'FARMING', 'QUARRY', 'GEMOLOGIST', 'FORAGER',
    // Combat & Defense (4)
    'HUNTING', 'GUARD', 'ARCHER', 'KNIGHT',
    // Exploration (4)
    'EXPLORING', 'SCOUT', 'SPELUNKER', 'TREASURE_HUNTER',
    // Crafting & Production (4)
    'BLACKSMITH', 'BAKER', 'BUILDER', 'TOOLMAKER',
    // Support & Utility (4)
    'TRADER', 'HEALER', 'SHEPHERD', 'ALCHEMIST',
    // Specialized (4)
    'ENCHANTER', 'CARTOGRAPHER', 'BEEKEEPER', 'RANCHER',
    // Advanced (2)
    'NETHER_EXPLORER', 'END_RAIDER'
];

const megaVillage = createMegaVillage(agentTypes, 1);
console.log(`[VILLAGE] Starting with ${megaVillage.length} total agents (1 of each type)`);

// Initialize agent types in database
initializeAgentTypes();

// Initialize and start dashboard (only if not in headless mode)
if (!HEADLESS_MODE) {
    dashboard.initDashboard(activeAgents, lineageTracker);

    // Register spawn callback for dashboard (async for connection confirmation)
    dashboard.setSpawnCallback(async (agentType) => {
        console.log(`[DASHBOARD SPAWN] Spawn request for ${agentType} via dashboard`);

        // Use lineage system to determine generation
        const { generation, parentInfo } = lineageTracker.getSpawnGeneration(agentType);

        try {
            let bot;
            if (generation === 1) {
                console.log(`[DASHBOARD SPAWN] Creating Gen 1 ${agentType} (lineage extinct or new)`);
                bot = await createAgent(agentType, SERVER_CONFIG, null, 1, null);
                console.log(`[DASHBOARD SPAWN] ${bot.agentName} Gen 1 successfully spawned and connected`);
            } else {
                console.log(`[DASHBOARD SPAWN] Creating Gen ${generation} ${agentType} offspring (lineage active)`);
                bot = await createAgent(agentType, SERVER_CONFIG, parentInfo?.name || null, generation, parentInfo?.uuid || null);
                console.log(`[DASHBOARD SPAWN] ${bot.agentName} Gen ${generation} successfully spawned and connected`);
            }

            // Add to active agents
            activeAgents.set(bot.agentName, bot);

            return bot;
        } catch (error) {
            console.error(`[DASHBOARD SPAWN] Failed to spawn ${agentType}: ${error.message}`);
            throw error; // Re-throw so dashboard can handle it
        }
    });

    dashboard.startDashboard();
} else {
    console.log('\n' + '='.repeat(70));
    console.log('[HEADLESS MODE] Dashboard disabled - terminal-only operation');
    console.log('[HEADLESS MODE] All monitoring will be displayed in this console');
    console.log('='.repeat(70) + '\n');
}

// Initialize ML Training System
console.log('\n' + '='.repeat(70));
console.log('[ML SYSTEM] Initializing Machine Learning Training System...');
console.log('[ML SYSTEM] TensorFlow.js loaded - Neural networks ready');
console.log('[ML SYSTEM] State Space: 429 dimensions');
console.log('[ML SYSTEM]   - Sims-style needs (hunger, energy, safety, social, comfort, achievement, exploration, cooperation, creativity, rest)');
console.log('[ML SYSTEM]   - Dwarf Fortress-style moods (happiness, stress, boredom, motivation, loneliness, confidence, curiosity, fear)');
console.log('[ML SYSTEM]   - Social relationships with bond strength and trust levels');
console.log('[ML SYSTEM]   - DuckDB episodic memory (memories, achievements, emotional states)');
console.log('[ML SYSTEM]   - Project Zomboid sub-skills (20 skills: combat, survival, crafting, physical)');
console.log('[ML SYSTEM]   - Project Zomboid moodles (14 status effects: hunger, thirst, injuries, panic, etc.)');
console.log('[ML SYSTEM] Action Space: 70 actions (cooperation/village/hierarchical goals)');
console.log('[ML SYSTEM] Algorithm: PPO (Proximal Policy Optimization)');
console.log('[ML SYSTEM] ML Mode: ' + (ML_ENABLED ? 'ENABLED ✓' : 'DISABLED ✗'));
console.log('='.repeat(70) + '\n');

try {
    mlTrainer = getMLTrainer();
    console.log('[ML SYSTEM] ML Trainer initialized successfully');

    // Emit ML stats to dashboard every 5 seconds
    if (!HEADLESS_MODE && dashboard && dashboard.io) {
        setInterval(() => {
            const stats = mlTrainer.getStats();
            dashboard.io.emit('mlStats', stats);
        }, 5000);
        console.log('[ML SYSTEM] Real-time ML stats streaming to dashboard enabled');
    }
} catch (error) {
    console.error('[ML SYSTEM] Failed to initialize ML Trainer:', error.message);
    console.error('[ML SYSTEM] Continuing without ML capabilities');
    ML_ENABLED = false;
}

// Initialize Memory System
console.log('\n' + '='.repeat(70));
console.log('[MEMORY] Initializing SQLite Episodic Memory System...');
memorySystem = getMemorySystem();
memorySystem.initialize().then(() => {
    console.log('[MEMORY] SQLite initialized successfully');
    console.log('[MEMORY] Database: agent_memories.sqlite');
    console.log('[MEMORY] Tables: episodic_memories, social_relationships, emotional_history, location_memories, achievement_progress');

    // Decay memories every 5 minutes
    setInterval(() => {
        memorySystem.decayMemories(0.01).catch(err => {
            console.error('[MEMORY] Failed to decay memories:', err.message);
        });
    }, 300000); // 5 minutes

    console.log('[MEMORY] Memory decay system active (5-minute intervals)');
    console.log('='.repeat(70) + '\n');
}).catch(error => {
    console.error('[MEMORY] Failed to initialize Memory System:', error.message);
    console.error('[MEMORY] Continuing without episodic memory');
    console.log('='.repeat(70) + '\n');
    memorySystem = null;
});

// Initialize Chat LLM System
console.log('\n' + '='.repeat(70));
console.log('[CHAT LLM] Initializing Agent Communication System...');
chatLLM = getChatLLM('transformers');  // Use Transformers.js for pure JS inference
chatLLM.initialize().then(() => {
    console.log('[CHAT LLM] Agent chat system initialized');
    console.log('[CHAT LLM] Backend: ' + chatLLM.backend);
    console.log('[CHAT LLM] Agents can now socialize and negotiate');
    console.log('='.repeat(70) + '\n');
}).catch(error => {
    console.error('[CHAT LLM] Failed to initialize Chat LLM:', error.message);
    console.error('[CHAT LLM] Falling back to mock backend');
    console.log('='.repeat(70) + '\n');
    chatLLM = getChatLLM('mock');
    chatLLM.initialize();
});

// Initialize Worker Pool if threading enabled
if (USE_THREADING && mlTrainer && WorkerPoolManager) {
    console.log('\n' + '='.repeat(70));
    console.log('[WORKER POOL] Initializing Multi-Threaded Agent System...');
    console.log(`[WORKER POOL] Max Workers: ${MAX_WORKERS}`);
    console.log('='.repeat(70) + '\n');

    try {
        workerPool = new WorkerPoolManager(mlTrainer, MAX_WORKERS);

        // Listen to worker events
        workerPool.on('agentSpawned', (data) => {
            console.log(`[WORKER POOL] ✓ Agent spawned: ${data.agentName}`);

            // Get agent metadata for lineage registration
            const metadata = workerPool.getAgentMetadata(data.agentName);
            if (metadata) {
                // Register in lineage tracker
                lineageTracker.registerAgent(
                    metadata.agentType,
                    data.agentName,
                    metadata.generation,
                    metadata.parentName,
                    metadata.parentUUID
                );
                console.log(`[WORKER POOL] Registered ${data.agentName} in lineage (Gen ${metadata.generation})`);
            }

            // Emit to dashboard if available
            if (dashboard && dashboard.emitAgentJoined) {
                dashboard.emitAgentJoined({
                    name: data.agentName,
                    ...data
                });
            }
        });

        workerPool.on('agentDeath', async (data) => {
            console.log(`[WORKER POOL] ✗ Agent died: ${data.agentName} (${data.stepCount} steps)`);

            // Get agent metadata from worker pool
            const metadata = workerPool.getAgentMetadata(data.agentName);

            if (metadata) {
                // Remove from lineage tracker
                lineageTracker.removeAgent(metadata.agentType, data.agentName);

                // Calculate fitness from worker data (simplified version)
                const fitness = {
                    total: data.lastReward || 0,
                    reward: data.lastReward || 0,
                    survival: data.stepCount || 0,
                    health: data.finalHealth || 0
                };

                // Get brain from ML trainer for genetic inheritance
                let brain = null;
                if (mlTrainer) {
                    brain = mlTrainer.getBrain(metadata.agentType);
                }

                // Update fitness tracker (for genetic selection)
                fitnessTracker.updateFitness(metadata.agentType, {
                    name: data.agentName,
                    uuid: metadata.uuid,
                    generation: metadata.generation,
                    fitness: fitness,
                    brain: brain, // Store brain for genetic inheritance
                    stats: {
                        resources_gathered: 0, // Worker doesn't track this yet
                        mobs_killed: 0,
                        trades_completed: 0
                    }
                });

                // Prepare parent info for offspring
                const parentInfo = {
                    name: data.agentName,
                    type: metadata.agentType,
                    generation: metadata.generation,
                    uuid: metadata.uuid,
                    slot: undefined // Worker pool doesn't use slots
                };

                console.log(`[WORKER POOL] Processing death of ${data.agentName} (Gen ${metadata.generation})`);
                console.log(`[WORKER POOL] Fitness: ${fitness.total.toFixed(2)}, Steps: ${data.stepCount}`);

                // Spawn offspring using lineage/evolution system
                try {
                    // Use worker pool to spawn offspring
                    const { generation, parentInfo: lineageInfo } = lineageTracker.getSpawnGeneration(metadata.agentType);

                    if (generation === 1) {
                        console.log(`[WORKER POOL] Lineage extinct - spawning Gen 1 founder`);
                    } else {
                        console.log(`[WORKER POOL] Spawning Gen ${generation} offspring`);
                    }

                    // Get genetic template for evolution
                    const fittestTemplate = fitnessTracker.getGeneticTemplate(metadata.agentType);
                    const geneticParentUUID = fittestTemplate ? fittestTemplate.uuid : metadata.uuid;
                    const geneticParentName = fittestTemplate ? fittestTemplate.name : data.agentName;

                    if (fittestTemplate) {
                        console.log(`[WORKER POOL] 🧬 Using genetic template: ${fittestTemplate.name} (Fitness: ${fittestTemplate.fitness.total.toFixed(2)})`);
                    }

                    // Spawn new agent in worker thread
                    await generateAgentName(metadata.agentType, generation, geneticParentUUID, async (offspringName, offspringUUID) => {
                        await workerPool.spawnAgent(
                            offspringName,
                            metadata.agentType,
                            SERVER_CONFIG,
                            generation,
                            geneticParentName,
                            geneticParentUUID,
                            offspringUUID
                        );

                        // Register in lineage tracker
                        lineageTracker.registerAgent(
                            metadata.agentType,
                            offspringName,
                            generation,
                            geneticParentName,
                            geneticParentUUID
                        );

                        console.log(`[WORKER POOL] ✓ Spawned offspring: ${offspringName} (Gen ${generation})`);
                    });

                } catch (error) {
                    console.error(`[WORKER POOL] Failed to spawn offspring: ${error.message}`);
                }
            }

            // Emit to dashboard
            if (dashboard && dashboard.emitAgentLeft) {
                dashboard.emitAgentLeft(data.agentName);
            }
        });

        workerPool.on('workerError', (data) => {
            console.error(`[WORKER POOL] ⚠ Worker error: ${data.agentName} - ${data.error}`);
        });

        workerPool.on('agentLowHealth', (data) => {
            console.warn(`[WORKER POOL] ⚕ Low health: ${data.agentName} (HP: ${data.health}/20)`);
        });

        console.log('[WORKER POOL] Initialized successfully');
        console.log('[WORKER POOL] Ready to spawn agents in isolated worker threads\n');

    } catch (error) {
        console.error('[WORKER POOL] Failed to initialize:', error.message);
        console.error('[WORKER POOL] Falling back to single-threaded mode');
        USE_THREADING = false;
        workerPool = null;
    }
}

// Start village with async batch spawning
(async () => {
    await startVillage(SERVER_CONFIG, megaVillage);
})().catch(err => {
    console.error('[VILLAGE] Fatal error during startup:', err);
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log('\n\nShutting down village...');

    // Save ML models before shutdown
    if (mlTrainer) {
        console.log('[ML SYSTEM] Saving all models...');
        mlTrainer.saveAllModels().then(() => {
            console.log('[ML SYSTEM] Models saved successfully');
            mlTrainer.dispose();
            console.log('[ML SYSTEM] ML resources cleaned up');
        }).catch(err => {
            console.error('[ML SYSTEM] Error saving models:', err.message);
        });
    }

    activeAgents.forEach((bot) => {
        // Update death time in database
        db.run(`UPDATE lineage SET death_time = ?, final_reward = ? WHERE agent_name = ?`,
            [Date.now(), bot.rewards.totalReward, bot.agentName]);
        bot.quit();
    });

    setTimeout(() => {
        db.close(() => {
            console.log('[DATABASE] Closed AIKnowledge.sqlite');
            process.exit(0);
        });
    }, 2000);
});

console.log('\nPress Ctrl+C to stop');
console.log('[DATABASE] Persistent memory active: AIKnowledge.sqlite');
console.log('[AI CHAT] Chat system disabled - agents will not respond to messages');
 
