/**
 * Mining Subagent
 * Handles all mining-related behaviors
 */

const { BaseSubagent } = require('./base_subagent');

class MiningSubagent extends BaseSubagent {
    constructor(bot, config) {
        super(bot, 'MINING', config);

        this.oreTypes = [
            'coal_ore',
            'iron_ore',
            'diamond_ore',
            'gold_ore',
            'redstone_ore',
            'lapis_ore',
            'emerald_ore',
            'deepslate_coal_ore',
            'deepslate_iron_ore',
            'deepslate_diamond_ore',
            'deepslate_gold_ore',
            'deepslate_redstone_ore',
            'deepslate_lapis_ore',
            'deepslate_emerald_ore'
        ];

        this.currentDepth = 0;
        this.targetDepth = -54; // Diamond level
        this.mineCount = 0;
    }

    async behaviorLoop() {
        while (this.isActive) {
            try {
                // Check if we have a pickaxe
                if (!this.hasTool('pickaxe')) {
                    this.log('No pickaxe found, crafting one...');
                    await this.craftPickaxe();
                }

                // Find and mine ores
                const ore = this.findNearestOre();

                if (ore) {
                    this.log(`Found ${ore.name} at ${ore.position}`);

                    // Move to ore
                    await this.moveTo(ore.position, 3);

                    // Mine it
                    const success = await this.mineBlock(ore);

                    if (success) {
                        this.mineCount++;
                        this.bot.rewards.addReward(this.config.rewards.ore_found || 10, `mined ${ore.name}`);
                        this.bot.rewards.incrementStat('resources_gathered', 1);

                        // Collect drops
                        await this.collectNearbyItems();
                    }
                } else {
                    // No ore nearby - descend deeper or explore
                    if (this.currentDepth > this.targetDepth) {
                        this.log('At target depth, exploring...');
                        await this.exploreHorizontally();
                    } else {
                        this.log('Descending to find ores...');
                        await this.descendToMiningLevel();
                    }
                }

                // Check if inventory full
                if (this.isInventoryFull()) {
                    this.log('Inventory full, storing items...');
                    await this.storeItems();
                }

                // Small delay to prevent spam
                await this.sleep(2000);

            } catch (error) {
                console.error(`[MINING SUBAGENT] Error:`, error.message);
                await this.sleep(5000);
            }
        }
    }

    /**
     * Find nearest ore block
     */
    findNearestOre() {
        if (!this.bot.entity) return null;

        for (const oreType of this.oreTypes) {
            const ore = this.findNearestBlock(oreType, 32);
            if (ore) return ore;
        }

        return null;
    }

    /**
     * Craft a basic pickaxe
     */
    async craftPickaxe() {
        // Check for materials
        const hasSticks = this.bot.inventory.items().some(item => item.name === 'stick');
        const hasCobble = this.bot.inventory.items().some(item =>
            item.name === 'cobblestone' || item.name === 'stone'
        );

        if (hasSticks && hasCobble) {
            try {
                const craftingTable = this.findNearestBlock('crafting_table', 64);

                if (craftingTable) {
                    await this.moveTo(craftingTable.position, 3);

                    // Craft stone pickaxe
                    const recipe = this.bot.recipesFor(require('minecraft-data')(this.bot.version).itemsByName['stone_pickaxe'].id)[0];

                    if (recipe) {
                        await this.bot.craft(recipe, 1, craftingTable);
                        this.log('Crafted stone pickaxe');
                        this.bot.rewards.addReward(this.config.rewards.tool_made || 20, 'crafted pickaxe');
                    }
                }
            } catch (error) {
                this.log('Failed to craft pickaxe: ' + error.message);
            }
        } else {
            this.log('Need sticks and cobblestone to craft pickaxe');
        }
    }

    /**
     * Descend to mining level
     */
    async descendToMiningLevel() {
        const currentY = this.bot.entity.position.y;
        this.currentDepth = currentY;

        if (currentY > this.targetDepth) {
            // Dig down (carefully)
            const blockBelow = this.bot.blockAt(this.bot.entity.position.offset(0, -1, 0));

            if (blockBelow && blockBelow.name !== 'air' && blockBelow.name !== 'lava') {
                await this.mineBlock(blockBelow);
            }
        }
    }

    /**
     * Explore horizontally at current level
     */
    async exploreHorizontally() {
        // Random walk
        const randomAngle = Math.random() * Math.PI * 2;
        const distance = 10;
        const targetX = this.bot.entity.position.x + Math.cos(randomAngle) * distance;
        const targetZ = this.bot.entity.position.z + Math.sin(randomAngle) * distance;

        await this.moveTo({
            x: targetX,
            y: this.bot.entity.position.y,
            z: targetZ
        }, 2);
    }

    /**
     * Store items (placeholder - would need chest management)
     */
    async storeItems() {
        const chest = this.findNearestBlock('chest', 64);

        if (chest) {
            await this.moveTo(chest.position, 3);

            try {
                const chestContainer = await this.bot.openContainer(chest);

                // Deposit non-tool items
                const items = this.bot.inventory.items().filter(item =>
                    !item.name.includes('pickaxe') &&
                    !item.name.includes('sword') &&
                    !item.name.includes('axe')
                );

                for (const item of items) {
                    await chestContainer.deposit(item.type, null, item.count);
                }

                chestContainer.close();
                this.log('Stored items in chest');
            } catch (error) {
                this.log('Failed to store items: ' + error.message);
            }
        } else {
            this.log('No chest nearby to store items');
        }
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Execute specific mining task
     */
    async executeTask(task) {
        switch (task.type) {
            case 'mine_ore':
                const ore = this.findNearestOre();
                if (ore) await this.mineBlock(ore);
                break;

            case 'descend':
                await this.descendToMiningLevel();
                break;

            case 'explore':
                await this.exploreHorizontally();
                break;

            default:
                this.log(`Unknown task type: ${task.type}`);
        }
    }
}

module.exports = { MiningSubagent };
