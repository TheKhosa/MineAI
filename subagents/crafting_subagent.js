/**
 * Crafting Subagent
 * Handles all crafting and production behaviors
 */

const { BaseSubagent } = require('./base_subagent');

class CraftingSubagent extends BaseSubagent {
    constructor(bot, config) {
        super(bot, 'CRAFTING', config);

        this.craftQueue = [];
        this.craftedItems = 0;

        // Common recipes to craft
        this.commonRecipes = [
            'crafting_table',
            'chest',
            'stick',
            'wooden_pickaxe',
            'stone_pickaxe',
            'iron_pickaxe',
            'wooden_sword',
            'stone_sword',
            'iron_sword',
            'torch',
            'furnace'
        ];
    }

    async behaviorLoop() {
        while (this.isActive) {
            try {
                // Check craft queue
                if (this.craftQueue.length > 0) {
                    const nextCraft = this.craftQueue.shift();
                    await this.craftItem(nextCraft);
                } else {
                    // Auto-craft useful items if we have materials
                    await this.autoCraftUsefulItems();
                }

                // Small delay
                await this.sleep(5000);

            } catch (error) {
                console.error(`[CRAFTING SUBAGENT] Error:`, error.message);
                await this.sleep(5000);
            }
        }
    }

    /**
     * Craft a specific item
     */
    async craftItem(itemName) {
        try {
            const mcData = require('minecraft-data')(this.bot.version);
            const item = mcData.itemsByName[itemName];

            if (!item) {
                this.log(`Unknown item: ${itemName}`);
                return false;
            }

            // Get recipes
            const recipes = this.bot.recipesFor(item.id, null, 1, null);

            if (recipes.length === 0) {
                this.log(`No recipe found for ${itemName}`);
                return false;
            }

            const recipe = recipes[0];

            // Check if we need a crafting table
            const needsCraftingTable = recipe.requiresTable || false;

            if (needsCraftingTable) {
                const craftingTable = this.findNearestBlock('crafting_table', 64);

                if (!craftingTable) {
                    this.log('Need crafting table, crafting one first...');
                    await this.craftCraftingTable();
                    return false;
                }

                await this.moveTo(craftingTable.position, 3);
                await this.bot.craft(recipe, 1, craftingTable);
            } else {
                await this.bot.craft(recipe, 1, null);
            }

            this.craftedItems++;
            this.log(`Crafted ${itemName}`);
            this.bot.rewards.addReward(this.config.rewards.item_crafted || 15, `crafted ${itemName}`);

            return true;

        } catch (error) {
            this.log(`Failed to craft ${itemName}: ${error.message}`);
            return false;
        }
    }

    /**
     * Craft a crafting table
     */
    async craftCraftingTable() {
        const mcData = require('minecraft-data')(this.bot.version);
        const planks = this.bot.inventory.items().find(item =>
            item.name.includes('planks')
        );

        if (planks && planks.count >= 4) {
            try {
                const recipe = this.bot.recipesFor(mcData.itemsByName['crafting_table'].id)[0];
                await this.bot.craft(recipe, 1, null);
                this.log('Crafted crafting table');
                return true;
            } catch (error) {
                this.log('Failed to craft crafting table: ' + error.message);
                return false;
            }
        } else {
            this.log('Need 4 planks to craft crafting table');
            return false;
        }
    }

    /**
     * Auto-craft useful items based on available materials
     */
    async autoCraftUsefulItems() {
        const inventory = this.bot.inventory.items();

        // Check for wood -> craft planks and sticks
        const logs = inventory.filter(item => item.name.includes('log'));
        if (logs.length > 0 && logs[0].count > 0) {
            await this.craftItem('oak_planks');
        }

        // Check for planks -> craft sticks
        const planks = inventory.filter(item => item.name.includes('planks'));
        if (planks.length > 0 && planks[0].count >= 2) {
            await this.craftItem('stick');
        }

        // Check for cobblestone + sticks -> craft tools
        const cobble = inventory.find(item => item.name === 'cobblestone');
        const sticks = inventory.find(item => item.name === 'stick');

        if (cobble && sticks && cobble.count >= 3 && sticks.count >= 2) {
            if (!this.hasTool('pickaxe')) {
                await this.craftItem('stone_pickaxe');
            } else if (!this.hasTool('sword')) {
                await this.craftItem('stone_sword');
            } else if (!this.hasTool('axe')) {
                await this.craftItem('stone_axe');
            }
        }

        // Check for coal + sticks -> craft torches
        const coal = inventory.find(item => item.name === 'coal');
        if (coal && sticks && coal.count > 0 && sticks.count > 0) {
            const torches = inventory.find(item => item.name === 'torch');
            if (!torches || torches.count < 10) {
                await this.craftItem('torch');
            }
        }

        // Check for iron -> smelt and craft tools
        const rawIron = inventory.find(item => item.name === 'raw_iron');
        if (rawIron && rawIron.count > 0) {
            await this.smeltOre('raw_iron', 'iron_ingot');
        }

        const ironIngot = inventory.find(item => item.name === 'iron_ingot');
        if (ironIngot && ironIngot.count >= 3 && sticks && sticks.count >= 2) {
            if (!this.hasTool('iron_pickaxe')) {
                await this.craftItem('iron_pickaxe');
            } else if (!this.hasTool('iron_sword')) {
                await this.craftItem('iron_sword');
            }
        }
    }

    /**
     * Smelt ore in furnace
     */
    async smeltOre(oreType, resultType) {
        const furnace = this.findNearestBlock('furnace', 64);

        if (!furnace) {
            this.log('Need furnace, crafting one...');

            const cobble = this.bot.inventory.items().find(item => item.name === 'cobblestone');
            if (cobble && cobble.count >= 8) {
                await this.craftItem('furnace');
            } else {
                this.log('Need 8 cobblestone to craft furnace');
                return false;
            }
        }

        try {
            await this.moveTo(furnace.position, 3);

            const furnaceBlock = await this.bot.openFurnace(furnace);

            // Get ore and fuel
            const ore = this.bot.inventory.items().find(item => item.name === oreType);
            const fuel = this.bot.inventory.items().find(item =>
                item.name === 'coal' || item.name.includes('planks') || item.name.includes('log')
            );

            if (ore && fuel) {
                await furnaceBlock.putInput(ore.type, null, ore.count);
                await furnaceBlock.putFuel(fuel.type, null, 1);

                this.log(`Smelting ${ore.count}x ${oreType}...`);

                // Wait for smelting
                await this.sleep(10000);

                // Take output
                const output = furnaceBlock.outputItem();
                if (output) {
                    await furnaceBlock.takeOutput();
                    this.log(`Smelted ${output.count}x ${resultType}`);
                    this.bot.rewards.addReward(this.config.rewards.smelted || 10, `smelted ${resultType}`);
                }

                furnaceBlock.close();
                return true;
            }

        } catch (error) {
            this.log(`Smelting error: ${error.message}`);
            return false;
        }
    }

    /**
     * Queue item for crafting
     */
    queueCraft(itemName, count = 1) {
        for (let i = 0; i < count; i++) {
            this.craftQueue.push(itemName);
        }
        this.log(`Queued ${count}x ${itemName} for crafting`);
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Execute specific crafting task
     */
    async executeTask(task) {
        switch (task.type) {
            case 'craft':
                if (task.item) {
                    await this.craftItem(task.item);
                }
                break;

            case 'smelt':
                if (task.ore && task.result) {
                    await this.smeltOre(task.ore, task.result);
                }
                break;

            case 'auto_craft':
                await this.autoCraftUsefulItems();
                break;

            default:
                this.log(`Unknown task type: ${task.type}`);
        }
    }
}

module.exports = { CraftingSubagent };
