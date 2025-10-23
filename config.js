/**
 * Configuration for Intelligent Village Minecraft Bot System
 *
 * Centralized configuration for all system parameters including:
 * - Server connection
 * - Agent limits and behavior
 * - ML training parameters
 * - LLM backend selection
 * - Feature flags
 */

module.exports = {
    // ===== SERVER CONFIGURATION =====
    server: {
        host: 'localhost',  // Connect to BungeeCord lobby
        port: 25565  // BungeeCord lobby port - then use /server survival to switch
    },

    // ===== PLUGIN SENSOR CONFIGURATION =====
    plugin: {
        enabled: true,  // Enable AgentSensorPlugin WebSocket integration
        host: 'localhost',
        port: 3002,
        authToken: 'mineagent-sensor-2024',
        reconnectInterval: 5000,
        reconnectMaxAttempts: 10
    },

    // ===== AGENT CONFIGURATION =====
    agents: {
        maxAgents: 20,  // Maximum number of concurrent agents
        batchSpawnSize: 10,  // Number of agents to spawn per batch
        batchSpawnDelay: 15000,  // Delay between batches (ms)

        // Commands to execute when joining server (for BungeeCord server switching)
        joinCommands: ['/server survival'],  // Switch to survival server after joining lobby
        joinCommandDelay: 1000,  // Delay between executing join commands (ms)

        // Agent types - one agent of each type will be spawned
        types: [
            'MINING', 'LUMBERJACK', 'FISHING', 'FARMING', 'QUARRY',
            'GEMOLOGIST', 'FORAGER', 'HUNTING', 'BUILDER', 'EXPLORING',
            'TRADER', 'GUARD', 'HEALER', 'BLACKSMITH', 'ALCHEMIST',
            'ENCHANTER', 'REDSTONE_ENGINEER', 'CARTOGRAPHER', 'NETHER_EXPLORER',
            'END_RAIDER'
        ],

        // Survival settings
        stuckDetectionTime: 30000,  // Time before agent is considered stuck (ms)
        stuckPenalty: -10.0,  // Reward penalty for getting stuck
        deathPenalty: -200.0,  // Massive penalty to incentivize survival

        // Communication settings
        chatInterval: 30000,  // How often agents try to communicate (ms)
        chatRange: 50,  // Maximum distance for agent-to-agent chat (blocks)
        introductionDelay: 2000,  // Delay before agent introduces itself (ms)

        // Status update intervals
        statusUpdateInterval: 30000,  // How often to show agent status (ms)
        rewardUpdateInterval: 5000,  // How often to update rewards (ms)
        learningInterval: 20000  // How often agents learn from others (ms)
    },

    // ===== ML CONFIGURATION =====
    ml: {
        enabled: true,  // Enable ML training

        // Neural network architecture
        stateSpace: 429,  // Dimensions in state vector
        actionSpace: 216,  // Number of possible actions (expanded from 76 to 216 in v1.1.0)

        // PPO (Proximal Policy Optimization) parameters
        algorithm: 'PPO',
        learningRate: 0.0003,
        gamma: 0.99,  // Discount factor
        epsilon: 0.2,  // PPO clip parameter

        // Reward shaping
        rewards: {
            survival: 0.1,  // Per-step survival reward
            inventoryPickup: 5.0,  // Reward for collecting items
            toolCrafting: 10.0,  // Reward for crafting tools
            exploration: 15.0,  // Reward for discovering new chunks
            movement: 0.5,  // Reward per block traveled
            socialInteraction: 0.5,  // Reward for talking to others
            knowledgeShare: 0.5,  // Reward for sharing experiences
            learning: 0.3  // Reward for learning from others
        },

        // Model persistence
        modelPath: './ml_models',
        saveInterval: 60000,  // How often to save models (ms)

        // Memory systems
        experienceReplaySize: 10000,
        episodicMemorySize: 1000
    },

    // ===== LLM CONFIGURATION =====
    llm: {
        enabled: true,  // Enable action-aware chat system

        // Backend options: 'mock', 'transformers', 'llamacpp', 'ollama', 'gemini', 'python'
        backend: 'ollama',  // Using Ollama with smollm2:135m

        // Model settings per backend
        transformers: {
            model: 'onnx-community/Qwen2.5-Coder-1.5B-Instruct',
            dtype: 'q4',  // Quantization: 'q4', 'q8', 'fp16'
            maxTokens: 150,  // More tokens for creative responses
            temperature: 1.4,  // Higher = more creative/varied
            topP: 0.85,
            repetitionPenalty: 1.15
        },

        llamacpp: {
            model: 'UserLM-8b-GGUF',
            modelPath: './models/UserLM-8b.Q4_K_M.gguf',
            contextSize: 2048,
            threads: 4
        },

        ollama: {
            host: 'localhost',
            port: 11434,
            model: 'smollm2:135m'  // ✅ WORKING - Upgrade to qwen2.5:3b or llama3.2:3b for better responses
        },

        gemini: {
            apiKey: 'AQ.Ab8RN6Je15Z-APrrM5DJ7WkCZ4qqxRO4hdJjDPa7BXbF9A1u3w',
            model: 'gemini-2.5-flash-lite',
            endpoint: 'https://aiplatform.googleapis.com/v1',
            maxTokens: 50,
            temperature: 0.8
        },

        mock: {
            // Mock uses rule-based templates, no config needed
        }
    },

    // ===== PERSONALITY SYSTEM =====
    personality: {
        enabled: true,

        // Categories for preferences
        categories: ['activities', 'biomes', 'items', 'behaviors', 'social'],

        // Preference counts per category
        likesPerCategory: 2,
        dislikesPerCategory: 2,

        // Genetic inheritance
        mutationRate: 0.2,  // 20% chance for mutation in offspring

        // Compatibility thresholds
        compatibilityThreshold: 0.5,  // Minimum compatibility for friendship
        rivalryThreshold: -0.3  // Below this = rivalry
    },

    // ===== MEMORY SYSTEM =====
    memory: {
        enabled: true,
        databasePath: './agent_memories.sqlite',

        // Memory decay
        decayInterval: 300000,  // How often to decay memories (ms)
        decayRate: 0.01,  // How much to decay per interval

        // Conversation history
        maxConversationHistory: 10,  // Number of past messages to remember

        // Episodic memory limits
        maxEpisodicMemories: 1000,
        maxSocialRelationships: 100,
        maxLocationMemories: 500
    },

    // ===== DASHBOARD CONFIGURATION =====
    dashboard: {
        enabled: false,  // DISABLED - Dashboard removed to prevent config interference
        port: 3000,

        // Features
        enablePrismarineViewer: false,  // 3D visualization (disabled)
        enableTTYConsole: false,  // Real-time console output (disabled)
        enableLiveUpdates: false,  // Socket.IO live updates (disabled)

        // Update intervals
        updateInterval: 1000,  // Dashboard refresh rate (ms)
        consoleBufferSize: 500  // Number of console lines to keep
    },

    // ===== GRAPHQL VISUALIZATION =====
    visualization: {
        enabled: true,  // Enable GraphQL-powered live graph visualization
        port: 4000,  // Port for GraphQL server and dashboard
        pollInterval: 2000  // How often dashboard polls for updates (ms)
    },

    // ===== THREADING CONFIGURATION =====
    threading: {
        enabled: true,  // Multi-threaded agent isolation
        maxWorkers: 1000,  // Maximum concurrent worker threads
        workerTimeout: 60000  // Worker timeout (ms)
    },

    // ===== MCMMO SKILLS SYSTEM =====
    mcmmo: {
        enabled: true,

        // XP multipliers
        xpMultiplier: 1.0,

        // Level requirements
        baseXP: 100,  // XP needed for level 1
        xpGrowthFactor: 1.5,  // XP multiplier per level

        // Skills
        skills: [
            'mining', 'woodcutting', 'fishing', 'farming', 'excavation',
            'combat', 'archery', 'defense', 'swords', 'axes',
            'unarmed', 'acrobatics', 'repair', 'alchemy', 'smelting',
            'herbalism', 'taming', 'brewing', 'enchanting', 'salvage'
        ]
    },

    // ===== FEATURE FLAGS =====
    features: {
        enableIdlePenalty: true,  // Enable idle penalties - if you ain't learning, you dying
        idlePenaltyAmount: -2.0,  // Penalty per idle check (-2 reward)
        idleCheckInterval: 3000,  // Check every 3 seconds
        idleThreshold: 6000,  // Consider idle after 6 seconds without significant action
        enableRewardDecay: false,  // Disable reward decay
        enableStuckDetection: true,  // Enable stuck detection and respawning
        enableKnowledgeSharing: true,  // Enable agents sharing experiences
        enableSocialRewards: true,  // Reward social interactions
        enableMoodSystem: true,  // Sims-like needs and moods
        enableLineageTracking: true,  // Track parent→offspring relationships
        enableGameMaster: false,  // Disable GameMaster (agents are autonomous)

        // Death/Respawn System
        enableRewardThresholdDeath: true,  // Kill agents when cumulative reward drops below threshold
        deathRewardThreshold: -20.0,  // Death threshold: cumulative reward < -20
        checkDeathInterval: 5000  // Check death condition every 5 seconds
    },

    // ===== DEBUGGING =====
    debug: {
        logLevel: 'info',  // 'debug', 'info', 'warn', 'error'
        logMLDecisions: true,  // Log ML action selections
        logChatMessages: true,  // Log agent conversations
        logRewards: true,  // Log reward calculations
        logSpawning: true,  // Log agent spawning
        logErrors: true  // Log errors and warnings
    }
};
