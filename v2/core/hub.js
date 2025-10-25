/**
 * Central Intelligence Hub
 * Main entry point for the V2 architecture
 */

const config = require('../config/default');
const PluginBridge = require('./plugin-bridge');
const AgentManager = require('./agent-manager');

class CentralHub {
    constructor() {
        this.config = config;
        this.pluginBridge = null;
        this.agentManager = null;
        this.mlTrainer = null; // Will be initialized after migrating ML systems

        // State
        this.isRunning = false;
        this.startTime = null;
        this.serverTick = 0;
        this.lastTPS = 20.0;

        // Statistics
        this.stats = {
            totalSensorUpdates: 0,
            totalActions: 0,
            totalMLDecisions: 0,
            averageDecisionTime: 0
        };

        // Timers
        this.statusInterval = null;
    }

    /**
     * Start the hub
     */
    async start() {
        console.log('\n======================================================================');
        console.log('CENTRAL INTELLIGENCE HUB - V2');
        console.log('======================================================================');
        console.log('Architecture: Hub-based with plugin NPCs');
        console.log('Max Agents: ' + this.config.hub.maxAgents);
        console.log('Tick Rate: ' + this.config.hub.tickRate + '/sec');
        console.log('======================================================================\n');

        this.startTime = Date.now();

        try {
            // Initialize components
            await this.initializeComponents();

            // Set up event handlers
            this.setupEventHandlers();

            // Start status updates
            this.startStatusUpdates();

            this.isRunning = true;
            console.log('\n[HUB] System ready - waiting for plugin connection...\n');

        } catch (error) {
            console.error('[HUB] Startup error:', error);
            process.exit(1);
        }
    }

    /**
     * Initialize all components
     */
    async initializeComponents() {
        console.log('[HUB] Initializing components...\n');

        // 1. Plugin Bridge
        console.log('[HUB] Starting Plugin Bridge...');
        this.pluginBridge = new PluginBridge(this.config);
        this.pluginBridge.start();

        // 2. Agent Manager
        console.log('[HUB] Initializing Agent Manager...');
        this.agentManager = new AgentManager(this.config);

        // 3. ML Trainer (placeholder - will be migrated)
        console.log('[HUB] ML Trainer: Pending migration');
        // this.mlTrainer = new MLTrainer(this.config);

        console.log('\n[HUB] All components initialized\n');
    }

    /**
     * Set up event handlers
     */
    setupEventHandlers() {
        // Plugin Bridge events
        this.pluginBridge.on('authenticated', (serverInfo) => {
            this.handlePluginAuthenticated(serverInfo);
        });

        this.pluginBridge.on('sensor_update', (update) => {
            this.handleSensorUpdate(update);
        });

        this.pluginBridge.on('server_tick', (tickData) => {
            this.handleServerTick(tickData);
        });

        this.pluginBridge.on('checkpoint', (data) => {
            this.handleCheckpoint(data);
        });

        this.pluginBridge.on('evolution', (data) => {
            this.handleEvolution(data);
        });

        this.pluginBridge.on('agent_death', (data) => {
            this.handleAgentDeath(data);
        });

        this.pluginBridge.on('spawn_confirm', (data) => {
            this.handleSpawnConfirm(data);
        });

        this.pluginBridge.on('disconnect', (data) => {
            this.handlePluginDisconnect(data);
        });

        // Agent Manager events
        this.agentManager.on('agent_created', (agent) => {
            console.log(`[HUB] Agent created: ${agent.name} (${agent.type})`);
        });

        this.agentManager.on('agent_died', (data) => {
            console.log(`[HUB] Agent died: ${data.agent.name} - ${data.cause}`);
            // TODO: Spawn offspring based on fitness
        });

        // Graceful shutdown
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
    }

    /**
     * Handle plugin authentication
     */
    handlePluginAuthenticated(serverInfo) {
        console.log('[HUB] Plugin authenticated successfully');
        console.log('[HUB] Server:', serverInfo);

        // Auto-spawn initial agents
        if (this.config.agents.types.length > 0) {
            console.log('\n[HUB] Auto-spawning initial agents...\n');
            this.spawnInitialAgents();
        }
    }

    /**
     * Spawn initial batch of agents
     */
    spawnInitialAgents() {
        const { types, spawnBatchSize, spawnDelay, spawnLocation } = this.config.agents;
        let spawned = 0;

        const spawnNext = () => {
            if (spawned >= Math.min(spawnBatchSize, types.length)) {
                console.log(`\n[HUB] Initial spawn complete: ${spawned} agents\n`);
                return;
            }

            const agentType = types[spawned % types.length];
            const agent = this.agentManager.createAgent(agentType, null, 1);

            // Request plugin to spawn NPC
            this.pluginBridge.spawnAgent(agent.name, agent.type, spawnLocation);

            spawned++;

            // Schedule next spawn
            setTimeout(spawnNext, spawnDelay);
        };

        spawnNext();
    }

    /**
     * Handle sensor data update
     */
    handleSensorUpdate(update) {
        const { agentName, timestamp, tick, data } = update;

        // Update agent state
        this.agentManager.updateSensorData(agentName, data, timestamp, tick);

        this.stats.totalSensorUpdates++;

        // TODO: Process with ML system
        // const state = this.mlTrainer.encodeState(data);
        // const action = this.mlTrainer.selectAction(agentName, state);
        // this.sendActionToAgent(agentName, action);

        // For now, send a simple action (move randomly)
        if (Math.random() < 0.1) { // 10% chance per update
            const randomAction = {
                type: 'move',
                params: {
                    x: data.position.x + (Math.random() * 10 - 5),
                    y: data.position.y,
                    z: data.position.z + (Math.random() * 10 - 5)
                }
            };

            this.pluginBridge.sendAction(agentName, randomAction);
            this.stats.totalActions++;
        }
    }

    /**
     * Handle server tick
     */
    handleServerTick(tickData) {
        this.serverTick = tickData.tick;
        this.lastTPS = tickData.tps;
    }

    /**
     * Handle checkpoint event
     */
    handleCheckpoint(data) {
        console.log(`\n[HUB] Checkpoint at tick ${data.tick}`);
        console.log('[HUB] Saving models...');

        // TODO: Save ML models
        // this.mlTrainer.saveModels();

        console.log('[HUB] Checkpoint complete\n');
    }

    /**
     * Handle evolution event
     */
    handleEvolution(data) {
        console.log(`\n[HUB] Evolution at tick ${data.tick}`);
        console.log('[HUB] Evaluating population...');

        // TODO: Evolve population
        // const fitness = this.mlTrainer.evaluatePopulation();
        // const offspring = this.mlTrainer.spawnOffspring(fitness);

        console.log('[HUB] Evolution complete\n');
    }

    /**
     * Handle agent death
     */
    handleAgentDeath(data) {
        const { agentName, cause, killer, location } = data;

        this.agentManager.handleDeath(agentName, cause, killer, location);

        // TODO: Decide whether to spawn offspring
        // Based on agent fitness, spawn new generation
    }

    /**
     * Handle spawn confirmation
     */
    handleSpawnConfirm(data) {
        const { agentName, entityUUID, location } = data;

        this.agentManager.confirmSpawn(agentName, entityUUID, location);

        console.log(`[HUB] ${agentName} is now active`);
    }

    /**
     * Handle plugin disconnect
     */
    handlePluginDisconnect(data) {
        console.warn('\n[HUB] Plugin disconnected');
        console.warn('[HUB] All agents paused - waiting for reconnection...\n');

        // Agents remain in memory but are inactive
    }

    /**
     * Start status updates
     */
    startStatusUpdates() {
        this.statusInterval = setInterval(() => {
            this.printStatus();
        }, 30000); // Every 30 seconds
    }

    /**
     * Print hub status
     */
    printStatus() {
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        const agentStats = this.agentManager.getStats();
        const bridgeStats = this.pluginBridge.getStats();

        console.log('\n======================================================================');
        console.log('HUB STATUS');
        console.log('======================================================================');
        console.log(`Uptime: ${uptime}s | Server Tick: ${this.serverTick} | TPS: ${this.lastTPS.toFixed(1)}`);
        console.log(`Plugin: ${bridgeStats.isConnected ? 'Connected' : 'Disconnected'} | Auth: ${bridgeStats.isAuthenticated ? 'Yes' : 'No'}`);
        console.log(`Agents: ${agentStats.activeAgents} active / ${agentStats.currentAgents} total`);
        console.log(`Sensor Updates: ${this.stats.totalSensorUpdates} | Actions Sent: ${this.stats.totalActions}`);
        console.log(`Messages: ↓${bridgeStats.messagesReceived} ↑${bridgeStats.messagesSent}`);
        console.log('======================================================================\n');
    }

    /**
     * Shutdown hub
     */
    async shutdown() {
        console.log('\n[HUB] Shutting down...\n');

        this.isRunning = false;

        if (this.statusInterval) {
            clearInterval(this.statusInterval);
        }

        // Shutdown components
        if (this.agentManager) {
            this.agentManager.shutdown();
        }

        if (this.pluginBridge) {
            this.pluginBridge.shutdown();
        }

        // TODO: Save ML models
        // if (this.mlTrainer) {
        //     await this.mlTrainer.saveModels();
        // }

        console.log('[HUB] Shutdown complete\n');
        process.exit(0);
    }
}

// Start the hub
if (require.main === module) {
    const hub = new CentralHub();
    hub.start().catch(error => {
        console.error('[HUB] Fatal error:', error);
        process.exit(1);
    });
}

module.exports = CentralHub;
