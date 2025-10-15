/**
 * Village Knowledge System - Collective knowledge sharing among agents
 *
 * Tracks:
 * - Resource locations
 * - Danger zones and bugged locations
 * - Successful/failed strategies
 * - Agent lineage and deaths
 * - Distress signals and support requests
 * - Collaborative tasks
 */

class VillageKnowledge {
    constructor(database) {
        this.db = database; // SQLite database instance
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
        this.db.run(`INSERT INTO experiences (agent_name, agent_type, experience_type, data, outcome, timestamp, generation)
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
            this.db.run(`INSERT INTO resource_locations (resource_type, x, y, z, discovered_by, timestamp)
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

module.exports = { VillageKnowledge };
