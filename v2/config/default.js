/**
 * Central Hub Configuration
 * All settings for the V2 architecture
 */

module.exports = {
    // ===== HUB SERVER =====
    hub: {
        port: 3002,                    // WebSocket server port for plugin
        authToken: 'mineagent-sensor-2024',
        maxAgents: 1000,               // Maximum concurrent NPCs
        tickRate: 20,                  // Decisions per second (match Minecraft ticks)
    },

    // ===== PLUGIN CONNECTION =====
    plugin: {
        reconnectInterval: 5000,       // Reconnect attempt interval (ms)
        reconnectMaxAttempts: 10,
        heartbeatInterval: 30000,      // Keep-alive ping interval
        timeout: 60000,                // Connection timeout
    },

    // ===== AGENT CONFIGURATION =====
    agents: {
        // Agent types - each spawned NPC will have a type
        types: [
            'MINING', 'LUMBERJACK', 'FISHING', 'FARMING', 'QUARRY',
            'GEMOLOGIST', 'FORAGER', 'HUNTING', 'BUILDER', 'EXPLORING',
            'TRADER', 'GUARD', 'HEALER', 'BLACKSMITH', 'ALCHEMIST',
            'ENCHANTER', 'REDSTONE_ENGINEER', 'CARTOGRAPHER', 'NETHER_EXPLORER',
            'END_RAIDER'
        ],

        // Spawn settings
        spawnBatchSize: 10,            // NPCs to spawn per batch
        spawnDelay: 1000,              // Delay between spawns (ms)
        spawnLocation: {
            world: 'survival',
            x: 0,
            y: 64,
            z: 0
        },

        // Behavior
        stuckDetectionTime: 30000,     // Time before agent is considered stuck
        deathPenalty: -200.0,          // Reward penalty for death
    },

    // ===== ML CONFIGURATION =====
    ml: {
        enabled: true,

        // Neural network architecture
        stateSpace: 429,               // State vector dimensions
        actionSpace: 216,              // Number of possible actions

        // PPO parameters
        algorithm: 'PPO',
        learningRate: 0.0003,
        gamma: 0.99,                   // Discount factor
        epsilon: 0.2,                  // PPO clip parameter
        batchSize: 64,                 // Training batch size

        // GPU acceleration
        useGPU: true,                  // Enable TensorFlow.js GPU backend
        gpuMemoryLimit: 4096,          // GPU memory limit (MB)

        // Batch processing
        batchInference: true,          // Process multiple agents at once
        maxBatchSize: 100,             // Max agents per inference batch

        // Reward shaping
        rewards: {
            survival: 0.1,             // Per-step survival
            inventoryPickup: 5.0,      // Item collection
            toolCrafting: 10.0,        // Crafting tools
            exploration: 15.0,         // New chunk discovery
            movement: 0.5,             // Movement reward
            socialInteraction: 0.5,    // Talking to others
            knowledgeShare: 0.5,       // Sharing experiences
            learning: 0.3,             // Learning from others
        },

        // Model persistence
        modelPath: './data/models',
        saveInterval: 60000,           // Save models every minute
        checkpointInterval: 300000,    // Full checkpoint every 5 minutes

        // Memory
        experienceReplaySize: 10000,
        episodicMemorySize: 1000,
    },

    // ===== PERSONALITY SYSTEM =====
    personality: {
        enabled: true,

        categories: ['activities', 'biomes', 'items', 'behaviors', 'social'],
        likesPerCategory: 2,
        dislikesPerCategory: 2,

        // Genetic inheritance
        mutationRate: 0.2,             // 20% mutation in offspring
        compatibilityThreshold: 0.5,   // Min compatibility for friendship
        rivalryThreshold: -0.3,        // Below this = rivalry
    },

    // ===== MEMORY SYSTEM =====
    memory: {
        enabled: true,
        databasePath: './data/memories/agent_memories.sqlite',

        // Memory decay
        decayInterval: 300000,         // Decay every 5 minutes
        decayRate: 0.01,

        // Limits
        maxConversationHistory: 10,
        maxEpisodicMemories: 1000,
        maxSocialRelationships: 100,
        maxLocationMemories: 500,
    },

    // ===== KNOWLEDGE SHARING =====
    knowledge: {
        enabled: true,
        databasePath: './data/knowledge/village_knowledge.sqlite',
        shareInterval: 30000,          // Share knowledge every 30s
        learningInterval: 20000,       // Learn from others every 20s
    },

    // ===== MCMMO SKILLS =====
    mcmmo: {
        enabled: true,
        xpMultiplier: 1.0,
        baseXP: 100,
        xpGrowthFactor: 1.5,

        skills: [
            'mining', 'woodcutting', 'fishing', 'farming', 'excavation',
            'combat', 'archery', 'defense', 'swords', 'axes',
            'unarmed', 'acrobatics', 'repair', 'alchemy', 'smelting',
            'herbalism', 'taming', 'brewing', 'enchanting', 'salvage'
        ],
    },

    // ===== FEATURE FLAGS =====
    features: {
        enableIdlePenalty: true,
        idlePenaltyAmount: -2.0,
        idleCheckInterval: 3000,
        idleThreshold: 6000,

        enableStuckDetection: true,
        enableKnowledgeSharing: true,
        enableSocialRewards: true,
        enableMoodSystem: true,
        enableLineageTracking: true,

        // Death/respawn
        enableRewardThresholdDeath: true,
        deathRewardThreshold: -20.0,
        checkDeathInterval: 5000,
    },

    // ===== LOGGING =====
    logging: {
        level: 'info',                 // debug, info, warn, error
        logML: true,                   // Log ML decisions
        logActions: true,              // Log agent actions
        logRewards: true,              // Log reward calculations
        logSocial: true,               // Log social interactions
        logFile: './logs/hub.log',
        maxLogSize: 10485760,          // 10MB
    },

    // ===== DASHBOARD =====
    dashboard: {
        enabled: true,
        port: 3000,
        updateInterval: 1000,          // Dashboard refresh rate
    },
};
