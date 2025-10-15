/**
 * Subagent Manager
 * Coordinates multiple subagents for a single bot
 */

const { MiningSubagent } = require('./mining_subagent');
const { CombatSubagent } = require('./combat_subagent');
const { ExplorationSubagent } = require('./exploration_subagent');
const { CraftingSubagent } = require('./crafting_subagent');

class SubagentManager {
    constructor(bot, agentType, config) {
        this.bot = bot;
        this.agentType = agentType;
        this.config = config;
        this.subagents = [];
        this.activeSubagent = null;
    }

    /**
     * Initialize subagents based on agent type
     */
    initialize() {
        const typeConfig = this.config.agentTypes[this.agentType];

        if (!typeConfig) {
            console.error(`Unknown agent type: ${this.agentType}`);
            return;
        }

        // Create subagents based on specialization
        switch (typeConfig.specialization) {
            case 'resource_gathering':
                if (typeConfig.behavior === 'mining') {
                    this.subagents.push(new MiningSubagent(this.bot, typeConfig));
                }
                this.subagents.push(new CraftingSubagent(this.bot, typeConfig));
                this.subagents.push(new ExplorationSubagent(this.bot, typeConfig));
                break;

            case 'combat':
            case 'defense':
            case 'ranged_combat':
            case 'elite_combat':
                this.subagents.push(new CombatSubagent(this.bot, typeConfig));
                this.subagents.push(new CraftingSubagent(this.bot, typeConfig));
                break;

            case 'discovery':
            case 'reconnaissance':
            case 'cave_exploration':
            case 'navigation':
                this.subagents.push(new ExplorationSubagent(this.bot, typeConfig));
                this.subagents.push(new CraftingSubagent(this.bot, typeConfig));
                break;

            case 'tool_crafting':
            case 'food_production':
            case 'construction':
            case 'tool_production':
                this.subagents.push(new CraftingSubagent(this.bot, typeConfig));
                this.subagents.push(new ExplorationSubagent(this.bot, typeConfig));
                break;

            default:
                // Generic setup - all subagents available
                this.subagents.push(new MiningSubagent(this.bot, typeConfig));
                this.subagents.push(new CombatSubagent(this.bot, typeConfig));
                this.subagents.push(new ExplorationSubagent(this.bot, typeConfig));
                this.subagents.push(new CraftingSubagent(this.bot, typeConfig));
                break;
        }

        console.log(`[SUBAGENT MANAGER] ${this.bot.agentName} initialized with ${this.subagents.length} subagents`);
    }

    /**
     * Start all subagents
     */
    async startAll() {
        console.log(`[SUBAGENT MANAGER] Starting ${this.subagents.length} subagents for ${this.bot.agentName}`);

        // Start primary subagent based on type
        if (this.subagents.length > 0) {
            this.activeSubagent = this.subagents[0];
            await this.activeSubagent.start();
        }

        // Other subagents run in background for support tasks
        for (let i = 1; i < this.subagents.length; i++) {
            // Don't start their loops, just make them available
            this.subagents[i].isActive = true;
        }
    }

    /**
     * Switch active subagent
     */
    async switchSubagent(index) {
        if (index < 0 || index >= this.subagents.length) {
            console.error(`Invalid subagent index: ${index}`);
            return;
        }

        // Stop current
        if (this.activeSubagent) {
            this.activeSubagent.stop();
        }

        // Start new
        this.activeSubagent = this.subagents[index];
        await this.activeSubagent.start();

        console.log(`[SUBAGENT MANAGER] ${this.bot.agentName} switched to ${this.activeSubagent.agentType} subagent`);
    }

    /**
     * Get subagent by type
     */
    getSubagent(type) {
        return this.subagents.find(sub => sub.agentType === type);
    }

    /**
     * Execute task on specific subagent
     */
    async executeTask(subagentType, task) {
        const subagent = this.getSubagent(subagentType);

        if (!subagent) {
            console.error(`Subagent ${subagentType} not found for ${this.bot.agentName}`);
            return;
        }

        await subagent.executeTask(task);
    }

    /**
     * Stop all subagents
     */
    stopAll() {
        this.subagents.forEach(sub => sub.stop());
        console.log(`[SUBAGENT MANAGER] All subagents stopped for ${this.bot.agentName}`);
    }

    /**
     * Get statistics from all subagents
     */
    getStats() {
        const stats = {};

        this.subagents.forEach(sub => {
            if (sub.getStats) {
                stats[sub.agentType] = sub.getStats();
            }
        });

        return stats;
    }

    /**
     * Handle agent context decisions
     * Switches between subagents based on situation
     */
    async handleContext() {
        // Check for threats
        const nearbyEntities = Object.values(this.bot.entities).filter(entity =>
            entity.position &&
            entity.position.distanceTo(this.bot.entity.position) < 32
        );

        const hasHostiles = nearbyEntities.some(entity => {
            const name = entity.name?.toLowerCase() || '';
            return ['zombie', 'skeleton', 'spider', 'creeper'].some(mob => name.includes(mob));
        });

        // Switch to combat if threatened
        if (hasHostiles) {
            const combatSubagent = this.getSubagent('COMBAT');
            if (combatSubagent && this.activeSubagent !== combatSubagent) {
                console.log(`[SUBAGENT MANAGER] ${this.bot.agentName} switching to COMBAT mode - hostiles detected`);
                await this.switchSubagent(this.subagents.indexOf(combatSubagent));
            }
        }

        // Check health
        if (this.bot.health < 10) {
            console.log(`[SUBAGENT MANAGER] ${this.bot.agentName} low health - retreating`);
            // Could switch to healing/retreat subagent
        }

        // Check inventory
        if (this.bot.inventory && this.bot.inventory.emptySlotCount() === 0) {
            const craftingSubagent = this.getSubagent('CRAFTING');
            if (craftingSubagent) {
                console.log(`[SUBAGENT MANAGER] ${this.bot.agentName} inventory full - processing items`);
                await craftingSubagent.executeTask({ type: 'auto_craft' });
            }
        }
    }
}

module.exports = { SubagentManager };
