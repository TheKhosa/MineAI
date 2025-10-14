/**
 * Worker Pool Manager - Manages agent workers in separate threads
 * Handles thousands of concurrent agents with isolated mineflayer instances
 * Coordinates with ML trainer for brain decisions
 */

const { Worker } = require('worker_threads');
const path = require('path');
const EventEmitter = require('events');

class WorkerPoolManager extends EventEmitter {
    constructor(mlTrainer, maxWorkers = 1000) {
        super();
        this.mlTrainer = mlTrainer;
        this.maxWorkers = maxWorkers;

        // Worker registry
        this.workers = new Map(); // agentName -> Worker instance
        this.workerMetadata = new Map(); // agentName -> metadata

        // Pending state/action tracking
        this.pendingStates = new Map(); // agentName -> state data
        this.actionCallbacks = new Map(); // agentName -> callback

        // Statistics
        this.stats = {
            totalSpawned: 0,
            currentActive: 0,
            totalDeaths: 0,
            totalErrors: 0,
            totalSteps: 0
        };

        console.log('[WORKER POOL] Manager initialized');
    }

    /**
     * Spawn a new agent in a worker thread
     */
    async spawnAgent(agentName, agentType, serverConfig, generation = 1, parentName = null, parentUUID = null, uuid = null) {
        // Check capacity
        if (this.workers.size >= this.maxWorkers) {
            throw new Error(`Worker pool at capacity (${this.maxWorkers} workers)`);
        }

        // Check if agent already exists
        if (this.workers.has(agentName)) {
            throw new Error(`Agent ${agentName} already exists`);
        }

        console.log(`[WORKER POOL] Spawning ${agentName} (${agentType}) in worker thread...`);

        try {
            // Create worker with agent data
            const worker = new Worker(path.join(__dirname, 'agent_worker.js'), {
                workerData: {
                    agentName,
                    agentType,
                    serverConfig,
                    generation,
                    parentName,
                    parentUUID,
                    uuid
                }
            });

            // Store worker
            this.workers.set(agentName, worker);
            this.workerMetadata.set(agentName, {
                agentName,
                agentType,
                generation,
                parentName,
                parentUUID,
                uuid,
                spawnTime: Date.now(),
                alive: true
            });

            this.stats.totalSpawned++;
            this.stats.currentActive++;

            // Setup message handler
            this.setupWorkerMessageHandler(agentName, worker);

            // Setup error handler
            worker.on('error', (error) => {
                console.error(`[WORKER POOL] Worker error for ${agentName}:`, error.message);
                this.stats.totalErrors++;
                this.handleWorkerError(agentName, error);
            });

            // Setup exit handler
            worker.on('exit', (code) => {
                console.log(`[WORKER POOL] Worker ${agentName} exited with code ${code}`);
                this.cleanupWorker(agentName);
            });

            return { success: true, agentName };
        } catch (error) {
            console.error(`[WORKER POOL] Failed to spawn ${agentName}:`, error.message);
            this.stats.totalErrors++;
            throw error;
        }
    }

    /**
     * Setup message handler for worker
     */
    setupWorkerMessageHandler(agentName, worker) {
        worker.on('message', async (message) => {
            const { type, data } = message;

            try {
                switch (type) {
                    case 'spawned':
                        console.log(`[WORKER POOL] ${agentName} spawned successfully`);
                        this.emit('agentSpawned', { agentName, ...data });

                        // Initialize ML for this agent
                        if (this.mlTrainer) {
                            const metadata = this.workerMetadata.get(agentName);
                            this.mlTrainer.initializeRemoteAgent(agentName, metadata.agentType);
                        }
                        break;

                    case 'stateReady':
                        // Agent has encoded state, needs action from brain
                        await this.handleStateReady(agentName, data);
                        break;

                    case 'actionComplete':
                        // Action executed, reward received
                        this.handleActionComplete(agentName, data);
                        break;

                    case 'death':
                        console.log(`[WORKER POOL] ${agentName} died (${data.stepCount} steps)`);
                        this.stats.totalDeaths++;
                        this.stats.currentActive--;
                        this.emit('agentDeath', { agentName, ...data });

                        // Finalize ML episode
                        if (this.mlTrainer) {
                            await this.mlTrainer.handleRemoteAgentDeath(agentName, data);
                        }

                        // Cleanup and respawn
                        this.cleanupWorker(agentName);
                        break;

                    case 'lowHealth':
                        this.emit('agentLowHealth', { agentName, ...data });
                        break;

                    case 'error':
                        console.error(`[WORKER POOL] ${agentName} error: ${data.message}`);
                        this.stats.totalErrors++;
                        if (data.fatal) {
                            this.killWorker(agentName);
                        }
                        break;

                    case 'kicked':
                        console.log(`[WORKER POOL] ${agentName} kicked: ${data.reason}`);
                        this.cleanupWorker(agentName);
                        break;

                    case 'disconnected':
                        console.log(`[WORKER POOL] ${agentName} disconnected`);
                        this.cleanupWorker(agentName);
                        break;

                    case 'status':
                        // Status response
                        if (this.actionCallbacks.has(agentName)) {
                            const callback = this.actionCallbacks.get(agentName);
                            callback(data);
                            this.actionCallbacks.delete(agentName);
                        }
                        break;

                    default:
                        console.warn(`[WORKER POOL] Unknown message type from ${agentName}: ${type}`);
                }
            } catch (error) {
                console.error(`[WORKER POOL] Error handling message from ${agentName}:`, error.message);
            }
        });
    }

    /**
     * Handle state ready - get action from ML brain
     */
    async handleStateReady(agentName, data) {
        const { state, stepCount } = data;

        if (!this.mlTrainer) {
            // No ML trainer, use random action
            const randomAction = Math.floor(Math.random() * 50);
            this.sendActionToWorker(agentName, randomAction);
            return;
        }

        try {
            // Get action from ML brain
            const metadata = this.workerMetadata.get(agentName);
            const actionData = this.mlTrainer.selectActionForAgent(
                agentName,
                metadata.agentType,
                new Float32Array(state)
            );

            // Send action to worker
            this.sendActionToWorker(agentName, actionData.action);

            // Store for experience replay
            this.pendingStates.set(agentName, {
                state,
                action: actionData.action,
                logProb: actionData.logProb,
                value: actionData.value,
                stepCount
            });

            this.stats.totalSteps++;
        } catch (error) {
            console.error(`[WORKER POOL] Error getting action for ${agentName}:`, error.message);
            // Fallback to random action
            const randomAction = Math.floor(Math.random() * 50);
            this.sendActionToWorker(agentName, randomAction);
        }
    }

    /**
     * Handle action complete - store experience
     */
    handleActionComplete(agentName, data) {
        const { reward, stepCount } = data;

        if (!this.mlTrainer || !this.pendingStates.has(agentName)) {
            return;
        }

        try {
            const stateData = this.pendingStates.get(agentName);
            const metadata = this.workerMetadata.get(agentName);

            // Add experience to ML trainer
            this.mlTrainer.addRemoteExperience(agentName, metadata.agentType, {
                state: stateData.state,
                action: stateData.action,
                reward,
                logProb: stateData.logProb,
                value: stateData.value,
                done: false
            });

            this.pendingStates.delete(agentName);
        } catch (error) {
            console.error(`[WORKER POOL] Error storing experience for ${agentName}:`, error.message);
        }
    }

    /**
     * Send action to worker
     */
    sendActionToWorker(agentName, actionId) {
        const worker = this.workers.get(agentName);
        if (worker) {
            worker.postMessage({ type: 'executeAction', data: { actionId } });
        }
    }

    /**
     * Get agent status
     */
    async getAgentStatus(agentName) {
        const worker = this.workers.get(agentName);
        if (!worker) {
            return null;
        }

        return new Promise((resolve) => {
            this.actionCallbacks.set(agentName, resolve);
            worker.postMessage({ type: 'getStatus' });

            // Timeout after 5 seconds
            setTimeout(() => {
                if (this.actionCallbacks.has(agentName)) {
                    this.actionCallbacks.delete(agentName);
                    resolve(null);
                }
            }, 5000);
        });
    }

    /**
     * Kill a worker
     */
    async killWorker(agentName) {
        const worker = this.workers.get(agentName);
        if (!worker) {
            return;
        }

        console.log(`[WORKER POOL] Killing worker ${agentName}...`);

        try {
            worker.postMessage({ type: 'shutdown' });
            await worker.terminate();
        } catch (error) {
            console.error(`[WORKER POOL] Error killing worker ${agentName}:`, error.message);
        }

        this.cleanupWorker(agentName);
    }

    /**
     * Cleanup worker references
     */
    cleanupWorker(agentName) {
        this.workers.delete(agentName);
        this.workerMetadata.delete(agentName);
        this.pendingStates.delete(agentName);
        this.actionCallbacks.delete(agentName);

        if (this.stats.currentActive > 0) {
            this.stats.currentActive--;
        }

        console.log(`[WORKER POOL] Cleaned up ${agentName} (${this.stats.currentActive} active)`);
    }

    /**
     * Handle worker error
     */
    handleWorkerError(agentName, error) {
        this.emit('workerError', { agentName, error: error.message });
        this.cleanupWorker(agentName);
    }

    /**
     * Shutdown all workers
     */
    async shutdownAll() {
        console.log(`[WORKER POOL] Shutting down ${this.workers.size} workers...`);

        const shutdownPromises = [];
        for (const [agentName, worker] of this.workers.entries()) {
            shutdownPromises.push(this.killWorker(agentName));
        }

        await Promise.allSettled(shutdownPromises);
        console.log('[WORKER POOL] All workers shut down');
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            workers: this.workers.size,
            pendingStates: this.pendingStates.size
        };
    }

    /**
     * Get all active agents
     */
    getActiveAgents() {
        return Array.from(this.workerMetadata.values());
    }

    /**
     * Get worker metadata
     */
    getAgentMetadata(agentName) {
        return this.workerMetadata.get(agentName);
    }
}

module.exports = WorkerPoolManager;
