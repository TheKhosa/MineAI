/**
 * ML Brain Live Monitor
 * Single agent with detailed logging of:
 * - ML state vector (694 dimensions)
 * - Neural network decision-making
 * - Action selection probabilities
 * - Reward calculation
 * - Learning updates
 */

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const config = require('./config');
const StateEncoder = require('./ml_state_encoder');
const AgentBrain = require('./ml_agent_brain');
const ActionSpace = require('./ml_action_space');

// Configuration
const BOT_CONFIG = {
    host: config.server.host,
    port: config.server.port,
    username: 'MLDebugBot',
    auth: 'offline',
    version: config.server.version
};

// Logging configuration
const LOG_CONFIG = {
    stateVector: true,          // Log full 694-dimensional state
    actionProbabilities: true,  // Log top 10 action probabilities
    neuralNetworkOutputs: true, // Log raw NN outputs
    rewardCalculation: true,    // Log reward components
    learningUpdates: true,      // Log gradient updates
    actionExecution: true,      // Log action results
    shortStateVector: false     // Log condensed state (first 50 dims)
};

class MLBrainMonitor {
    constructor() {
        this.bot = null;
        this.brain = null;
        this.stateEncoder = null;
        this.actionSpace = null;
        this.stepCount = 0;
        this.totalReward = 0;
        this.lastState = null;
        this.lastAction = null;
    }

    async start() {
        console.log('=== ML BRAIN LIVE MONITOR ===');
        console.log('Connecting to server:', BOT_CONFIG.host + ':' + BOT_CONFIG.port);

        // Create bot
        this.bot = mineflayer.createBot(BOT_CONFIG);

        // Initialize ML components
        this.stateEncoder = new StateEncoder();
        this.actionSpace = new ActionSpace();

        // Initialize brain with correct parameters (stateSize, actionCount)
        this.brain = new AgentBrain(this.stateEncoder.STATE_SIZE, this.actionSpace.ACTION_COUNT);

        // Load pathfinder
        this.bot.loadPlugin(pathfinder);

        // Setup event handlers
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.bot.on('login', () => {
            console.log('\n[LOGIN] Connected as:', this.bot.username);
            console.log('[INFO] Position will be set on spawn');
        });

        this.bot.on('spawn', () => {
            console.log('\n[SPAWN] Bot spawned in world');
            console.log('[POS]', this.formatPosition(this.bot.entity.position));

            // Initialize pathfinder movements
            const mcData = require('minecraft-data')(this.bot.version);
            const defaultMove = new Movements(this.bot, mcData);
            this.bot.pathfinder.setMovements(defaultMove);

            // Start ML loop
            console.log('\n=== STARTING ML LOOP ===\n');
            this.startMLLoop();
        });

        this.bot.on('health', () => {
            if (this.bot.health <= 0) {
                console.log('\n[DEATH] Agent died!');
                console.log('[STATS] Total steps:', this.stepCount);
                console.log('[STATS] Total reward:', this.totalReward.toFixed(2));
            }
        });

        this.bot.on('kicked', (reason) => {
            console.log('\n[KICKED]', reason);
        });

        this.bot.on('error', (err) => {
            console.error('\n[ERROR]', err.message);
        });

        this.bot.on('end', () => {
            console.log('\n[DISCONNECT] Connection ended');
            process.exit(0);
        });
    }

    async startMLLoop() {
        // Wait a bit for world to stabilize
        await this.sleep(2000);

        while (this.bot && !this.bot._client.ended) {
            try {
                await this.mlStep();
                await this.sleep(1000); // 1 step per second for readability
            } catch (err) {
                console.error('\n[ML ERROR]', err.message);
                console.error(err.stack);
            }
        }
    }

    async mlStep() {
        this.stepCount++;

        console.log('\n' + '='.repeat(80));
        console.log(`STEP ${this.stepCount} - ${new Date().toLocaleTimeString()}`);
        console.log('='.repeat(80));

        // 1. ENCODE STATE
        console.log('\n[1] ENCODING STATE (694 dimensions)...');
        const state = this.stateEncoder.encodeState(this.bot);

        if (LOG_CONFIG.stateVector) {
            this.logStateVector(state);
        } else if (LOG_CONFIG.shortStateVector) {
            this.logShortStateVector(state);
        }

        // 2. NEURAL NETWORK FORWARD PASS
        console.log('\n[2] NEURAL NETWORK DECISION...');
        const { action, value, actionProbs } = await this.brain.selectAction(state);

        if (LOG_CONFIG.neuralNetworkOutputs) {
            console.log('   Value Estimate:', value.toFixed(4));
        }

        if (LOG_CONFIG.actionProbabilities) {
            this.logActionProbabilities(actionProbs, action);
        }

        // 3. EXECUTE ACTION
        console.log('\n[3] EXECUTING ACTION...');
        const actionObj = this.actionSpace.actions[action];
        console.log(`   Action ID: ${action}`);
        console.log(`   Action Name: ${actionObj.name}`);
        console.log(`   Action Type: ${actionObj.type}`);

        const actionResult = await this.actionSpace.executeAction(action, this.bot);

        if (LOG_CONFIG.actionExecution) {
            console.log('   Result:', actionResult ? 'SUCCESS ✓' : 'FAILED ✗');
        }

        // 4. CALCULATE REWARD
        console.log('\n[4] CALCULATING REWARD...');
        const reward = this.calculateReward(actionResult);
        this.totalReward += reward;

        if (LOG_CONFIG.rewardCalculation) {
            this.logRewardBreakdown(reward);
        }

        // 5. LEARNING (DISABLED FOR MONITORING)
        // Note: This monitor focuses on inference only
        // For training, use the full multi-agent system in server.js
        if (this.lastState && this.lastAction !== null) {
            console.log('\n[5] LEARNING STATUS');
            console.log('   Mode: INFERENCE ONLY (monitoring)');
            console.log('   Using pre-trained weights from: ml_models/brain_SHARED_COLLECTIVE.json');
            console.log('   Steps Observed:', this.stepCount);
        }

        // 6. STATUS SUMMARY
        console.log('\n[6] STATUS SUMMARY');
        console.log('   Health:', this.bot.health.toFixed(1) + '/20');
        console.log('   Food:', this.bot.food.toFixed(1) + '/20');
        console.log('   Position:', this.formatPosition(this.bot.entity.position));
        console.log('   Total Reward:', this.totalReward.toFixed(2));
        console.log('   Average Reward:', (this.totalReward / this.stepCount).toFixed(3));

        // Save for next iteration
        this.lastState = state;
        this.lastAction = action;
    }

    logStateVector(state) {
        console.log('   Total dimensions:', state.length);

        // Show some key dimensions
        console.log('   Position (dims 0-2):', [
            state[0].toFixed(3),
            state[1].toFixed(3),
            state[2].toFixed(3)
        ].join(', '));

        console.log('   Health/Food (dims 3-4):', [
            state[3].toFixed(3),
            state[4].toFixed(3)
        ].join(', '));

        // Count non-zero values
        const nonZero = state.filter(v => Math.abs(v) > 0.001).length;
        console.log('   Non-zero values:', nonZero, '(' + (nonZero/state.length*100).toFixed(1) + '%)');

        // Show range
        const min = Math.min(...state);
        const max = Math.max(...state);
        console.log('   Value range:', min.toFixed(3), 'to', max.toFixed(3));

        // Check for invalid values
        const hasNaN = state.some(v => isNaN(v));
        const hasInf = state.some(v => !isFinite(v));
        if (hasNaN || hasInf) {
            console.log('   ⚠️  WARNING: Invalid values detected!');
        }
    }

    logShortStateVector(state) {
        console.log('   State preview (first 50 dims):');
        const preview = Array.from(state.slice(0, 50)).map(v => v.toFixed(2));
        for (let i = 0; i < 50; i += 10) {
            console.log('   ' + preview.slice(i, i + 10).join(' '));
        }
    }

    logActionProbabilities(actionProbs, selectedAction) {
        // Get top 10 actions by probability
        const actionProbArray = Array.from(actionProbs).map((prob, idx) => ({
            id: idx,
            prob: prob,
            name: this.actionSpace.actions[idx].name,
            type: this.actionSpace.actions[idx].type
        }));

        actionProbArray.sort((a, b) => b.prob - a.prob);
        const top10 = actionProbArray.slice(0, 10);

        console.log('   Top 10 Action Probabilities:');
        console.log('   ' + '-'.repeat(70));
        console.log('   Rank | ID  | Probability | Action Name');
        console.log('   ' + '-'.repeat(70));

        top10.forEach((action, idx) => {
            const selected = action.id === selectedAction ? '→' : ' ';
            const rank = (idx + 1).toString().padStart(4);
            const id = action.id.toString().padStart(3);
            const prob = (action.prob * 100).toFixed(2).padStart(6) + '%';
            const name = action.name.padEnd(30);

            console.log(`   ${selected}${rank} | ${id} | ${prob}    | ${name}`);
        });

        // Show selected action if not in top 10
        const selectedRank = actionProbArray.findIndex(a => a.id === selectedAction) + 1;
        if (selectedRank > 10) {
            const selected = actionProbArray[selectedRank - 1];
            console.log('   ...');
            console.log(`   →${selectedRank.toString().padStart(4)} | ${selected.id.toString().padStart(3)} | ${(selected.prob * 100).toFixed(2).padStart(6)}%    | ${selected.name.padEnd(30)}`);
        }
    }

    async executeAction(actionId) {
        try {
            const result = await this.actionSpace.execute(this.bot, actionId);
            return result;
        } catch (err) {
            console.log('   Error:', err.message);
            return false;
        }
    }

    calculateReward(actionSuccess) {
        let reward = 0;
        const components = {};

        // Survival reward
        components.survival = 0.1;
        reward += components.survival;

        // Action success bonus
        if (actionSuccess) {
            components.actionSuccess = 0.5;
            reward += components.actionSuccess;
        }

        // Health penalty
        if (this.bot.health < 10) {
            components.lowHealth = -0.2;
            reward += components.lowHealth;
        }

        // Food penalty
        if (this.bot.food < 10) {
            components.lowFood = -0.1;
            reward += components.lowFood;
        }

        // Movement reward (encourage exploration)
        if (this.lastState && this.bot.entity.velocity) {
            const speed = Math.sqrt(
                this.bot.entity.velocity.x ** 2 +
                this.bot.entity.velocity.y ** 2 +
                this.bot.entity.velocity.z ** 2
            );
            if (speed > 0.01) {
                components.movement = 0.1;
                reward += components.movement;
            }
        }

        this.rewardComponents = components;
        return reward;
    }

    logRewardBreakdown(totalReward) {
        console.log('   Total Reward:', totalReward.toFixed(3));
        console.log('   Breakdown:');

        for (const [component, value] of Object.entries(this.rewardComponents)) {
            const sign = value >= 0 ? '+' : '';
            console.log(`     ${component.padEnd(20)}: ${sign}${value.toFixed(3)}`);
        }
    }

    formatPosition(pos) {
        return `(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Start monitoring
const monitor = new MLBrainMonitor();
monitor.start().catch(err => {
    console.error('Failed to start monitor:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n[SHUTDOWN] Stopping monitor...');
    if (monitor.bot) {
        monitor.bot.quit();
    }
    process.exit(0);
});
