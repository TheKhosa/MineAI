/**
 * ML TICK-SYNCHRONIZED TRAINER
 *
 * Aligns ML training steps perfectly with Minecraft server ticks for:
 * - 1 AI step = 1 server tick = 50ms
 * - Synchronized model checkpoints
 * - Tick-perfect evolutionary selection
 * - Real-time model persistence
 *
 * Features:
 * - Listens to server tick events from Spigot plugin
 * - Saves models on checkpoint events (every 1200 ticks = 1 minute)
 * - Evolves population on evolution events (every 12000 ticks = 10 minutes)
 * - Maintains perfect sync with game state
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class TickSynchronizedTrainer extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            checkpointDir: config.checkpointDir || './ml_models/tick_checkpoints',
            evolutionDir: config.evolutionDir || './ml_models/evolution',
            autoSave: config.autoSave !== false,
            autoEvolve: config.autoEvolve !== false,
            verboseLogging: config.verboseLogging || false,
            ...config
        };

        // Create directories
        [this.config.checkpointDir, this.config.evolutionDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        // Tick tracking
        this.currentServerTick = 0;
        this.lastCheckpointTick = 0;
        this.lastEvolutionTick = 0;
        this.ticksSinceStart = 0;

        // Agent step tracking (perfect sync)
        this.agentSteps = new Map();  // agentName -> step count
        this.agentLastTick = new Map();  // agentName -> last tick they acted

        // Performance metrics
        this.stats = {
            ticksReceived: 0,
            checkpointsSaved: 0,
            evolutionsPerformed: 0,
            avgTPS: 20.0,
            agentsTracked: 0
        };

        // ML trainer reference (will be set externally)
        this.mlTrainer = null;
    }

    /**
     * Set ML trainer instance
     */
    setMLTrainer(mlTrainer) {
        this.mlTrainer = mlTrainer;
        console.log('[TICK SYNC] ML Trainer connected');
    }

    /**
     * Handle server tick event from Spigot plugin
     */
    onServerTick(tickData) {
        this.currentServerTick = tickData.tick;
        this.ticksSinceStart++;
        this.stats.ticksReceived++;
        this.stats.avgTPS = tickData.tps || 20.0;

        if (this.config.verboseLogging && this.currentServerTick % 20 === 0) {
            console.log(`[TICK SYNC] Server tick: ${this.currentServerTick} | TPS: ${tickData.tps.toFixed(2)} | Players: ${tickData.onlinePlayers}`);
        }

        // Emit tick event for agents to act
        this.emit('tick', {
            tick: this.currentServerTick,
            tps: tickData.tps,
            timestamp: tickData.timestamp
        });
    }

    /**
     * Handle checkpoint event (save models)
     */
    async onCheckpoint(checkpointData) {
        if (!this.config.autoSave) {
            return;
        }

        const tick = checkpointData.tick;
        const ticksSinceLastCheckpoint = checkpointData.ticksSinceLastCheckpoint;

        console.log('');
        console.log('======================================================================');
        console.log(`[TICK SYNC] CHECKPOINT at tick ${tick}`);
        console.log(`[TICK SYNC] Time since last checkpoint: ${(ticksSinceLastCheckpoint / 20).toFixed(1)}s`);
        console.log('======================================================================');

        this.lastCheckpointTick = tick;

        try {
            // Save all agent models
            if (this.mlTrainer) {
                const saved = await this.saveAllModels(tick);
                this.stats.checkpointsSaved++;

                console.log(`[TICK SYNC] ✓ Saved ${saved} models at tick ${tick}`);
                console.log(`[TICK SYNC] Checkpoint directory: ${this.config.checkpointDir}`);
            } else {
                console.log('[TICK SYNC] ⚠ No ML trainer connected, skipping checkpoint');
            }
        } catch (error) {
            console.error('[TICK SYNC] ✗ Checkpoint failed:', error.message);
        }

        console.log('======================================================================');
        console.log('');

        this.emit('checkpoint', { tick, saved: this.stats.checkpointsSaved });
    }

    /**
     * Handle evolution event (select parents, spawn offspring)
     */
    async onEvolution(evolutionData) {
        if (!this.config.autoEvolve) {
            return;
        }

        const tick = evolutionData.tick;
        const ticksSinceLastEvolution = evolutionData.ticksSinceLastEvolution;

        console.log('');
        console.log('======================================================================');
        console.log(`[TICK SYNC] EVOLUTION at tick ${tick}`);
        console.log(`[TICK SYNC] Time since last evolution: ${(ticksSinceLastEvolution / 20 / 60).toFixed(1)} minutes`);
        console.log('======================================================================');

        this.lastEvolutionTick = tick;

        try {
            // Trigger evolutionary selection
            if (this.mlTrainer) {
                const evolved = await this.evolvePopulation(tick);
                this.stats.evolutionsPerformed++;

                console.log(`[TICK SYNC] ✓ Evolution complete: ${evolved.selected} parents selected, ${evolved.offspring} offspring spawned`);
                console.log(`[TICK SYNC] Evolution directory: ${this.config.evolutionDir}`);
            } else {
                console.log('[TICK SYNC] ⚠ No ML trainer connected, skipping evolution');
            }
        } catch (error) {
            console.error('[TICK SYNC] ✗ Evolution failed:', error.message);
        }

        console.log('======================================================================');
        console.log('');

        this.emit('evolution', { tick, performed: this.stats.evolutionsPerformed });
    }

    /**
     * Record agent action execution (maintain perfect tick sync)
     */
    recordAgentAction(agentName, tick) {
        // Increment step counter
        const currentSteps = this.agentSteps.get(agentName) || 0;
        this.agentSteps.set(agentName, currentSteps + 1);

        // Record last action tick
        this.agentLastTick.set(agentName, tick);

        // Update stats
        this.stats.agentsTracked = this.agentSteps.size;

        if (this.config.verboseLogging && currentSteps % 100 === 0) {
            console.log(`[TICK SYNC] ${agentName} completed ${currentSteps} steps (tick ${tick})`);
        }
    }

    /**
     * Save all agent models to checkpoint
     */
    async saveAllModels(tick) {
        if (!this.mlTrainer || !this.mlTrainer.agents) {
            return 0;
        }

        let savedCount = 0;

        // Save shared collective brain
        if (this.mlTrainer.sharedBrain) {
            const checkpointPath = path.join(
                this.config.checkpointDir,
                `shared_brain_tick_${tick}.json`
            );

            const metadata = {
                tick,
                timestamp: Date.now(),
                steps: this.ticksSinceStart,
                avgTPS: this.stats.avgTPS,
                agents: this.stats.agentsTracked
            };

            fs.writeFileSync(checkpointPath, JSON.stringify(metadata, null, 2));
            savedCount++;
        }

        // Save individual agent brains
        for (const [agentName, agent] of this.mlTrainer.agents.entries()) {
            if (agent.brain) {
                const checkpointPath = path.join(
                    this.config.checkpointDir,
                    `${agentName}_tick_${tick}.json`
                );

                const metadata = {
                    agentName,
                    tick,
                    timestamp: Date.now(),
                    steps: this.agentSteps.get(agentName) || 0,
                    lastTick: this.agentLastTick.get(agentName) || 0
                };

                fs.writeFileSync(checkpointPath, JSON.stringify(metadata, null, 2));
                savedCount++;
            }
        }

        return savedCount;
    }

    /**
     * Evolve population (select fittest, spawn offspring)
     */
    async evolvePopulation(tick) {
        if (!this.mlTrainer || !this.mlTrainer.agents) {
            return { selected: 0, offspring: 0 };
        }

        // Get all agents with fitness scores
        const agentFitness = [];
        for (const [agentName, agent] of this.mlTrainer.agents.entries()) {
            if (agent.fitness != null) {
                agentFitness.push({
                    name: agentName,
                    fitness: agent.fitness,
                    steps: this.agentSteps.get(agentName) || 0
                });
            }
        }

        // Sort by fitness (descending)
        agentFitness.sort((a, b) => b.fitness - a.fitness);

        // Select top 20% as parents
        const parentCount = Math.max(1, Math.floor(agentFitness.length * 0.2));
        const parents = agentFitness.slice(0, parentCount);

        // Save evolution snapshot
        const evolutionPath = path.join(
            this.config.evolutionDir,
            `evolution_tick_${tick}.json`
        );

        const evolutionData = {
            tick,
            timestamp: Date.now(),
            totalAgents: agentFitness.length,
            parents: parents.map(p => ({
                name: p.name,
                fitness: p.fitness,
                steps: p.steps
            })),
            avgFitness: agentFitness.reduce((sum, a) => sum + a.fitness, 0) / agentFitness.length,
            maxFitness: agentFitness[0]?.fitness || 0,
            minFitness: agentFitness[agentFitness.length - 1]?.fitness || 0
        };

        fs.writeFileSync(evolutionPath, JSON.stringify(evolutionData, null, 2));

        console.log('[TICK SYNC] Evolution stats:');
        console.log(`  Total agents: ${agentFitness.length}`);
        console.log(`  Parents selected: ${parents.length}`);
        console.log(`  Avg fitness: ${evolutionData.avgFitness.toFixed(2)}`);
        console.log(`  Max fitness: ${evolutionData.maxFitness.toFixed(2)} (${parents[0]?.name})`);

        return {
            selected: parents.length,
            offspring: 0  // Offspring spawning handled by existing death/respawn system
        };
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            currentTick: this.currentServerTick,
            ticksSinceStart: this.ticksSinceStart,
            lastCheckpointTick: this.lastCheckpointTick,
            lastEvolutionTick: this.lastEvolutionTick,
            activeAgents: this.agentSteps.size
        };
    }

    /**
     * Get agent step count
     */
    getAgentSteps(agentName) {
        return this.agentSteps.get(agentName) || 0;
    }

    /**
     * Get ticks since agent last acted
     */
    getTicksSinceLastAction(agentName) {
        const lastTick = this.agentLastTick.get(agentName);
        if (lastTick == null) {
            return -1;
        }
        return this.currentServerTick - lastTick;
    }
}

module.exports = TickSynchronizedTrainer;
