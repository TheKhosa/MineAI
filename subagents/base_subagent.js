/**
 * Base Subagent Class
 * All specialized subagents inherit from this
 */

class BaseSubagent {
    constructor(bot, agentType, config) {
        this.bot = bot;
        this.agentType = agentType;
        this.config = config;
        this.isActive = false;
        this.currentTask = null;
        this.taskQueue = [];
    }

    /**
     * Start the subagent behavior loop
     */
    async start() {
        this.isActive = true;
        console.log(`[SUBAGENT] ${this.bot.agentName} ${this.agentType} subagent started`);
        this.behaviorLoop();
    }

    /**
     * Stop the subagent
     */
    stop() {
        this.isActive = false;
        console.log(`[SUBAGENT] ${this.bot.agentName} ${this.agentType} subagent stopped`);
    }

    /**
     * Main behavior loop - Override in subclasses
     */
    async behaviorLoop() {
        throw new Error('behaviorLoop() must be implemented by subclass');
    }

    /**
     * Execute a specific task - Override in subclasses
     */
    async executeTask(task) {
        throw new Error('executeTask() must be implemented by subclass');
    }

    /**
     * Add task to queue
     */
    queueTask(task) {
        this.taskQueue.push(task);
    }

    /**
     * Get next task from queue
     */
    getNextTask() {
        return this.taskQueue.shift();
    }

    /**
     * Check if bot has required tools
     */
    hasTool(toolName) {
        if (!this.bot.inventory) return false;
        const items = this.bot.inventory.items();
        return items.some(item => item.name.includes(toolName));
    }

    /**
     * Get current position
     */
    getPosition() {
        return this.bot.entity ? this.bot.entity.position : null;
    }

    /**
     * Move to position
     */
    async moveTo(position, distance = 3) {
        const { GoalNear } = require('mineflayer-pathfinder').goals;

        try {
            await this.bot.pathfinder.goto(new GoalNear(position.x, position.y, position.z, distance));
            return true;
        } catch (error) {
            console.error(`[SUBAGENT] ${this.bot.agentName} movement failed:`, error.message);
            return false;
        }
    }

    /**
     * Find nearest block of type
     */
    findNearestBlock(blockType, maxDistance = 64) {
        if (!this.bot.entity) return null;

        const block = this.bot.findBlock({
            matching: (block) => block.name === blockType,
            maxDistance: maxDistance
        });

        return block;
    }

    /**
     * Mine a block
     */
    async mineBlock(block) {
        try {
            // Equip best tool
            await this.bot.tool.equipForBlock(block);

            // Mine the block
            await this.bot.dig(block);

            return true;
        } catch (error) {
            console.error(`[SUBAGENT] ${this.bot.agentName} mining failed:`, error.message);
            return false;
        }
    }

    /**
     * Collect nearby items
     */
    async collectNearbyItems() {
        const items = Object.values(this.bot.entities).filter(entity =>
            entity.objectType === 'Item' &&
            entity.position.distanceTo(this.bot.entity.position) < 10
        );

        for (const item of items) {
            try {
                await this.moveTo(item.position, 1);
            } catch (error) {
                // Item may have despawned
            }
        }
    }

    /**
     * Check if inventory is full
     */
    isInventoryFull() {
        if (!this.bot.inventory) return false;
        return this.bot.inventory.emptySlotCount() === 0;
    }

    /**
     * Log activity
     */
    log(message) {
        console.log(`[${this.agentType}] ${this.bot.agentName}: ${message}`);
    }
}

module.exports = { BaseSubagent };
