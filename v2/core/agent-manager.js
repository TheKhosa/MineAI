/**
 * Agent Manager
 * Manages all agent states, metadata, and lifecycle
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class AgentManager extends EventEmitter {
    constructor(config) {
        super();

        this.config = config;
        this.agents = new Map(); // agentName → agent state
        this.agentsByType = new Map(); // agentType → Set<agentName>
        this.activeAgents = new Set(); // Currently active agent names

        // Statistics
        this.stats = {
            totalSpawned: 0,
            totalDeaths: 0,
            totalRemoved: 0,
            generationCount: new Map() // agentType → max generation
        };

        // Initialize agent type tracking
        for (const type of config.agents.types) {
            this.agentsByType.set(type, new Set());
            this.stats.generationCount.set(type, 0);
        }
    }

    /**
     * Create a new agent
     */
    createAgent(agentType, parentName = null, generation = 1) {
        // Generate unique agent name
        const agentName = this.generateAgentName(agentType, generation);

        const agent = {
            // Identity
            name: agentName,
            type: agentType,
            uuid: uuidv4(),
            generation,
            parentName,

            // State
            isActive: false,
            isAlive: true,
            entityUUID: null, // Set when plugin confirms spawn

            // Location
            location: {
                world: null,
                x: 0,
                y: 0,
                z: 0,
                yaw: 0,
                pitch: 0
            },

            // Stats
            health: 20,
            maxHealth: 20,
            food: 20,
            maxFood: 20,
            experience: 0,
            level: 0,

            // ML
            lastState: null,
            lastAction: null,
            lastReward: 0,
            cumulativeReward: 0,
            episodeSteps: 0,

            // Sensor data
            sensorData: null,
            lastSensorUpdate: null,

            // Timestamps
            createdAt: Date.now(),
            spawnedAt: null,
            diedAt: null,

            // Performance
            totalActions: 0,
            totalRewards: 0,
            averageReward: 0
        };

        this.agents.set(agentName, agent);
        this.agentsByType.get(agentType).add(agentName);
        this.stats.totalSpawned++;

        // Update generation counter
        if (generation > this.stats.generationCount.get(agentType)) {
            this.stats.generationCount.set(agentType, generation);
        }

        console.log(`[AGENT MANAGER] Created ${agentName} (${agentType}, Gen ${generation})`);

        this.emit('agent_created', agent);

        return agent;
    }

    /**
     * Mark agent as spawned
     */
    confirmSpawn(agentName, entityUUID, location) {
        const agent = this.agents.get(agentName);
        if (!agent) {
            console.warn(`[AGENT MANAGER] Spawn confirm for unknown agent: ${agentName}`);
            return false;
        }

        agent.isActive = true;
        agent.entityUUID = entityUUID;
        agent.location = { ...location };
        agent.spawnedAt = Date.now();

        this.activeAgents.add(agentName);

        console.log(`[AGENT MANAGER] ${agentName} spawn confirmed`);

        this.emit('agent_spawned', agent);

        return true;
    }

    /**
     * Update agent sensor data
     */
    updateSensorData(agentName, data, timestamp, tick) {
        const agent = this.agents.get(agentName);
        if (!agent) {
            console.warn(`[AGENT MANAGER] Sensor update for unknown agent: ${agentName}`);
            return false;
        }

        agent.sensorData = data;
        agent.lastSensorUpdate = timestamp;

        // Update basic stats from sensor data
        if (data.position) {
            agent.location = { ...data.position };
        }
        if (data.health !== undefined) {
            agent.health = data.health;
        }
        if (data.food !== undefined) {
            agent.food = data.food;
        }
        if (data.experience !== undefined) {
            agent.experience = data.experience;
        }
        if (data.level !== undefined) {
            agent.level = data.level;
        }

        this.emit('sensor_update', { agentName, data, timestamp, tick });

        return true;
    }

    /**
     * Record agent action
     */
    recordAction(agentName, actionIndex, state, reward) {
        const agent = this.agents.get(agentName);
        if (!agent) {
            return false;
        }

        agent.lastState = state;
        agent.lastAction = actionIndex;
        agent.lastReward = reward;
        agent.cumulativeReward += reward;
        agent.totalActions++;
        agent.totalRewards += reward;
        agent.episodeSteps++;
        agent.averageReward = agent.totalRewards / agent.totalActions;

        return true;
    }

    /**
     * Handle agent death
     */
    handleDeath(agentName, cause, killer, location) {
        const agent = this.agents.get(agentName);
        if (!agent) {
            return false;
        }

        agent.isActive = false;
        agent.isAlive = false;
        agent.diedAt = Date.now();
        agent.location = { ...location };

        this.activeAgents.delete(agentName);
        this.stats.totalDeaths++;

        const survivalTime = agent.spawnedAt ? Date.now() - agent.spawnedAt : 0;

        console.log(`[AGENT MANAGER] ${agentName} died - ${cause} (survived ${Math.floor(survivalTime / 1000)}s)`);

        this.emit('agent_died', {
            agent,
            cause,
            killer,
            location,
            survivalTime
        });

        return true;
    }

    /**
     * Remove agent from system
     */
    removeAgent(agentName, reason = 'removed') {
        const agent = this.agents.get(agentName);
        if (!agent) {
            return false;
        }

        this.agents.delete(agentName);
        this.agentsByType.get(agent.type).delete(agentName);
        this.activeAgents.delete(agentName);
        this.stats.totalRemoved++;

        console.log(`[AGENT MANAGER] Removed ${agentName} (${reason})`);

        this.emit('agent_removed', { agent, reason });

        return true;
    }

    /**
     * Get agent by name
     */
    getAgent(agentName) {
        return this.agents.get(agentName);
    }

    /**
     * Get all agents of a type
     */
    getAgentsByType(agentType) {
        const names = this.agentsByType.get(agentType);
        if (!names) return [];

        return Array.from(names).map(name => this.agents.get(name));
    }

    /**
     * Get all active agents
     */
    getActiveAgents() {
        return Array.from(this.activeAgents).map(name => this.agents.get(name));
    }

    /**
     * Get agent count
     */
    getAgentCount() {
        return {
            total: this.agents.size,
            active: this.activeAgents.size,
            byType: Object.fromEntries(
                Array.from(this.agentsByType.entries()).map(([type, names]) => [
                    type,
                    names.size
                ])
            )
        };
    }

    /**
     * Generate unique agent name
     */
    generateAgentName(agentType, generation) {
        const typePrefix = agentType.substring(0, 3).toUpperCase();
        const shortId = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${typePrefix}_${shortId}_G${generation}`;
    }

    /**
     * Get next generation number for type
     */
    getNextGeneration(agentType) {
        return (this.stats.generationCount.get(agentType) || 0) + 1;
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            currentAgents: this.agents.size,
            activeAgents: this.activeAgents.size,
            generationCounts: Object.fromEntries(this.stats.generationCount),
            agentsByType: Object.fromEntries(
                Array.from(this.agentsByType.entries()).map(([type, names]) => [
                    type,
                    names.size
                ])
            )
        };
    }

    /**
     * Get agent performance summary
     */
    getPerformanceSummary() {
        const agents = Array.from(this.agents.values());

        return {
            totalAgents: agents.length,
            activeAgents: this.activeAgents.size,
            averageReward: agents.reduce((sum, a) => sum + a.averageReward, 0) / agents.length,
            totalActions: agents.reduce((sum, a) => sum + a.totalActions, 0),
            totalDeaths: this.stats.totalDeaths,
            byType: Object.fromEntries(
                this.config.agents.types.map(type => {
                    const typeAgents = this.getAgentsByType(type);
                    return [
                        type,
                        {
                            count: typeAgents.length,
                            averageReward: typeAgents.reduce((sum, a) => sum + a.averageReward, 0) / (typeAgents.length || 1),
                            totalActions: typeAgents.reduce((sum, a) => sum + a.totalActions, 0)
                        }
                    ];
                })
            )
        };
    }

    /**
     * Shutdown manager
     */
    shutdown() {
        console.log('[AGENT MANAGER] Shutting down...');
        console.log(`[AGENT MANAGER] Final stats: ${this.agents.size} total agents, ${this.activeAgents.size} active`);
        this.agents.clear();
        this.activeAgents.clear();
    }
}

module.exports = AgentManager;
