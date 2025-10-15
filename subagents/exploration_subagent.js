/**
 * Exploration Subagent
 * Handles exploration, scouting, and discovery
 */

const { BaseSubagent } = require('./base_subagent');

class ExplorationSubagent extends BaseSubagent {
    constructor(bot, config) {
        super(bot, 'EXPLORATION', config);

        this.visitedChunks = new Set();
        this.explorationRadius = 256;
        this.currentDirection = 0;
        this.distanceTraveled = 0;
        this.discoveries = 0;
    }

    async behaviorLoop() {
        while (this.isActive) {
            try {
                // Explore in random direction
                await this.exploreNewArea();

                // Look for interesting structures
                await this.scanForStructures();

                // Record location
                this.recordCurrentLocation();

                // Small delay
                await this.sleep(3000);

            } catch (error) {
                console.error(`[EXPLORATION SUBAGENT] Error:`, error.message);
                await this.sleep(5000);
            }
        }
    }

    /**
     * Explore new area
     */
    async exploreNewArea() {
        const currentPos = this.getPosition();
        if (!currentPos) return;

        // Get current chunk
        const chunkX = Math.floor(currentPos.x / 16);
        const chunkZ = Math.floor(currentPos.z / 16);
        const chunkKey = `${chunkX},${chunkZ}`;

        // Check if we've been here
        if (!this.visitedChunks.has(chunkKey)) {
            this.visitedChunks.add(chunkKey);
            this.discoveries++;

            this.log(`Discovered new chunk (${chunkX}, ${chunkZ}) - Total: ${this.discoveries}`);
            this.bot.rewards.addReward(this.config.rewards.discovery || 30, 'new chunk discovered');
        }

        // Choose exploration direction
        const angle = this.currentDirection + (Math.random() - 0.5) * Math.PI / 2;
        const distance = 50 + Math.random() * 50;

        const targetX = currentPos.x + Math.cos(angle) * distance;
        const targetZ = currentPos.z + Math.sin(angle) * distance;

        const previousPos = currentPos.clone();

        // Move to new position
        const success = await this.moveTo({
            x: targetX,
            y: currentPos.y,
            z: targetZ
        }, 5);

        if (success) {
            const distanceMoved = previousPos.distanceTo(this.getPosition());
            this.distanceTraveled += distanceMoved;
            this.bot.rewards.addReward(distanceMoved * (this.config.rewards.distance || 0.15), 'exploration movement');

            // Update direction
            this.currentDirection = angle;
        } else {
            // Change direction if stuck
            this.currentDirection += Math.PI / 2;
        }
    }

    /**
     * Scan for interesting structures
     */
    async scanForStructures() {
        const interestingBlocks = [
            'chest',
            'spawner',
            'nether_portal',
            'end_portal',
            'enchanting_table',
            'diamond_ore',
            'ancient_debris',
            'village',
            'stronghold'
        ];

        for (const blockType of interestingBlocks) {
            const found = this.findNearestBlock(blockType, 64);

            if (found) {
                this.log(`DISCOVERY: Found ${blockType} at ${this.formatPosition(found.position)}`);

                // Record in village knowledge
                if (this.bot.villageKnowledge) {
                    this.bot.villageKnowledge.recordResourceLocation(
                        blockType,
                        found.position.x,
                        found.position.y,
                        found.position.z,
                        this.bot.agentName
                    );
                }

                this.bot.rewards.addReward(this.config.rewards.rare_discovery || 100, `found ${blockType}`);

                // Move towards it
                await this.moveTo(found.position, 5);
                break;
            }
        }
    }

    /**
     * Record current location
     */
    recordCurrentLocation() {
        const pos = this.getPosition();
        if (!pos) return;

        // Check for nearby resources
        const resourceBlocks = [
            'coal_ore',
            'iron_ore',
            'gold_ore',
            'diamond_ore',
            'lapis_ore',
            'redstone_ore',
            'emerald_ore',
            'tree',
            'water',
            'lava'
        ];

        for (const resource of resourceBlocks) {
            const found = this.findNearestBlock(resource, 32);

            if (found && this.bot.villageKnowledge) {
                this.bot.villageKnowledge.recordResourceLocation(
                    resource,
                    found.position.x,
                    found.position.y,
                    found.position.z,
                    this.bot.agentName
                );
            }
        }
    }

    /**
     * Format position for logging
     */
    formatPosition(pos) {
        return `(${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)})`;
    }

    /**
     * Get exploration statistics
     */
    getStats() {
        return {
            chunksExplored: this.visitedChunks.size,
            distanceTraveled: Math.floor(this.distanceTraveled),
            discoveries: this.discoveries
        };
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Execute specific exploration task
     */
    async executeTask(task) {
        switch (task.type) {
            case 'explore_area':
                await this.exploreNewArea();
                break;

            case 'scout':
                await this.scanForStructures();
                break;

            case 'goto':
                if (task.position) {
                    await this.moveTo(task.position, task.distance || 5);
                }
                break;

            default:
                this.log(`Unknown task type: ${task.type}`);
        }
    }
}

module.exports = { ExplorationSubagent };
