/**
 * Agent Worker - Runs individual agent in isolated thread
 * Each worker manages one mineflayer bot instance
 * Communicates with main thread via message passing
 */

const { parentPort, workerData } = require('worker_threads');
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalNear, GoalBlock, GoalXZ } = goals;
const toolPlugin = require('mineflayer-tool').plugin;
const StateEncoder = require('./ml_state_encoder');
const ActionSpace = require('./ml_action_space');

// Worker state
let bot = null;
let stateEncoder = null;
let actionSpace = null;
let isActive = false;
let lastState = null;
let stepCount = 0;
let lastReward = 0;

// Error suppression
const suppressedErrors = new Set(['PartialReadError']);

/**
 * Initialize the agent worker
 */
function initialize() {
    const { agentName, agentType, serverConfig, generation, parentName, parentUUID, uuid } = workerData;

    console.log(`[WORKER ${agentName}] Initializing in worker thread...`);

    // Create ML components
    stateEncoder = new StateEncoder();
    actionSpace = new ActionSpace();

    // Create bot configuration
    const config = {
        ...serverConfig,
        username: agentName,
        hideErrors: false // We'll handle errors ourselves
    };

    try {
        // Create bot
        bot = mineflayer.createBot(config);
        bot.agentType = agentType;
        bot.agentName = agentName;
        bot.generation = generation;
        bot.parentName = parentName;
        bot.parentUUID = parentUUID;
        bot.uuid = uuid;

        // Load plugins
        bot.loadPlugin(pathfinder);
        bot.loadPlugin(toolPlugin);

        // Setup event handlers
        setupBotEvents();

        console.log(`[WORKER ${agentName}] Bot created, waiting for spawn...`);
    } catch (error) {
        sendMessage('error', { message: `Failed to create bot: ${error.message}`, fatal: true });
    }
}

/**
 * Setup bot event handlers
 */
function setupBotEvents() {
    // Spawn event
    bot.once('spawn', () => {
        console.log(`[WORKER ${bot.agentName}] Spawned successfully`);
        isActive = true;

        // Initialize pathfinder
        const mcData = require('minecraft-data')(bot.version);
        const defaultMove = new Movements(bot, mcData);
        bot.pathfinder.setMovements(defaultMove);

        sendMessage('spawned', {
            position: bot.entity.position,
            health: bot.health,
            food: bot.food
        });

        // Start behavior loop
        startBehaviorLoop();
    });

    // Health updates
    bot.on('health', () => {
        if (bot.health < 5) {
            sendMessage('lowHealth', { health: bot.health, food: bot.food });
        }
    });

    // Death event
    bot.on('death', () => {
        console.log(`[WORKER ${bot.agentName}] Died`);
        isActive = false;

        // Send final episode data
        sendMessage('death', {
            stepCount,
            lastReward,
            finalHealth: bot.health,
            finalFood: bot.food
        });
    });

    // Error handling - suppress known harmless errors
    bot.on('error', (err) => {
        if (suppressedErrors.has(err.name)) {
            return; // Silently ignore
        }

        // Check if it's SlotComponent related
        if (err.stack && (err.stack.includes('SlotComponent') || err.stack.includes('VarInt'))) {
            return; // Silently ignore protocol parsing errors
        }

        console.error(`[WORKER ${bot.agentName}] Error: ${err.message}`);
        sendMessage('error', { message: err.message, fatal: false });
    });

    // Kicked event
    bot.on('kicked', (reason) => {
        console.log(`[WORKER ${bot.agentName}] Kicked: ${reason}`);
        sendMessage('kicked', { reason });
        isActive = false;
    });

    // End event
    bot.on('end', () => {
        console.log(`[WORKER ${bot.agentName}] Disconnected`);
        isActive = false;
        sendMessage('disconnected', {});
    });
}

/**
 * Main behavior loop - executes ML actions
 */
async function startBehaviorLoop() {
    while (isActive) {
        try {
            await executeMlStep();

            // Variable delay between actions (1-3 seconds)
            await sleep(1000 + Math.random() * 2000);
        } catch (error) {
            console.error(`[WORKER ${bot.agentName}] Behavior loop error: ${error.message}`);
            await sleep(2000); // Wait before retry
        }
    }
}

/**
 * Execute one ML step
 */
async function executeMlStep() {
    if (!bot || !bot.entity || bot.health <= 0) {
        return;
    }

    try {
        // Encode current state
        const state = stateEncoder.encodeState(bot);

        // Send state to main thread for action decision
        sendMessage('stateReady', { state: Array.from(state), stepCount });

        // Wait for action from main thread (handled via message)
        // Action will be executed when received via message handler

        stepCount++;
    } catch (error) {
        // Silently handle encoding errors
        if (error.message && !error.message.includes('Cannot read')) {
            console.error(`[WORKER ${bot.agentName}] ML step error: ${error.message}`);
        }
    }
}

/**
 * Execute an action received from main thread
 */
async function executeAction(actionId) {
    if (!bot || !bot.entity) {
        return { success: false };
    }

    try {
        const success = await actionSpace.executeAction(actionId, bot);

        // Calculate immediate reward
        const reward = calculateReward();
        lastReward = reward;

        return { success, reward };
    } catch (error) {
        // Silently handle action execution errors
        return { success: false, reward: 0 };
    }
}

/**
 * Calculate reward for this step
 */
function calculateReward() {
    let reward = 0.01; // Small survival reward

    if (!bot || !bot.entity) return reward;

    // Health change
    const healthChange = bot.health - (bot._lastHealth || 20);
    bot._lastHealth = bot.health;
    if (healthChange < 0) {
        reward += healthChange * 0.5;
    }

    // Food change
    const foodChange = bot.food - (bot._lastFood || 20);
    bot._lastFood = bot.food;
    if (foodChange > 0) {
        reward += foodChange * 0.2;
    }

    // Movement reward
    if (bot.entity && bot._lastPosition) {
        const dist = bot.entity.position.distanceTo(bot._lastPosition);
        reward += Math.min(dist * 0.01, 0.5);
    }
    bot._lastPosition = bot.entity ? bot.entity.position.clone() : null;

    return reward;
}

/**
 * Get bot status for main thread
 */
function getStatus() {
    if (!bot || !bot.entity) {
        return {
            alive: false,
            health: 0,
            food: 0,
            position: null,
            stepCount: 0
        };
    }

    return {
        alive: isActive,
        health: bot.health,
        food: bot.food,
        position: {
            x: bot.entity.position.x,
            y: bot.entity.position.y,
            z: bot.entity.position.z
        },
        stepCount,
        lastReward
    };
}

/**
 * Send message to main thread
 */
function sendMessage(type, data) {
    if (parentPort) {
        parentPort.postMessage({ type, data, agentName: bot ? bot.agentName : 'unknown' });
    }
}

/**
 * Handle messages from main thread
 */
if (parentPort) {
    parentPort.on('message', async (message) => {
        const { type, data } = message;

        switch (type) {
            case 'executeAction':
                const result = await executeAction(data.actionId);
                sendMessage('actionComplete', { ...result, stepCount });
                break;

            case 'getStatus':
                sendMessage('status', getStatus());
                break;

            case 'shutdown':
                console.log(`[WORKER ${bot ? bot.agentName : 'unknown'}] Shutting down...`);
                if (bot) {
                    bot.quit();
                }
                isActive = false;
                process.exit(0);
                break;

            default:
                console.warn(`[WORKER] Unknown message type: ${type}`);
        }
    });
}

/**
 * Helper: sleep function
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize worker
initialize();

// Graceful shutdown on uncaught errors
process.on('uncaughtException', (error) => {
    console.error(`[WORKER ${bot ? bot.agentName : 'unknown'}] Uncaught exception:`, error.message);
    sendMessage('error', { message: error.message, fatal: true });
    process.exit(1);
});

console.log(`[WORKER] Agent worker initialized`);
