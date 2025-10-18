/**
 * Container/Storage Operations (111-122)
 * Chest, furnace, and storage management actions
 */

const Vec3 = require('vec3');

class ContainerActions {
    constructor(utils) {
        this.utils = utils;
    }

    /**
     * Deposit all items into nearest chest
     */
    async depositAllItems(bot) {
        const chest = bot.findBlock({
            matching: block => block.name === 'chest' || block.name === 'barrel',
            maxDistance: 16
        });

        if (!chest) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(chest.position.x, chest.position.y, chest.position.z, 3), true);
        await this.utils.sleep(1000);

        try {
            const container = await bot.openContainer(chest);
            const items = bot.inventory.items();

            for (const item of items) {
                // Keep tools and armor equipped
                if (!item.name.includes('pickaxe') && !item.name.includes('sword') &&
                    !item.name.includes('helmet') && !item.name.includes('chestplate') &&
                    !item.name.includes('leggings') && !item.name.includes('boots')) {
                    await container.deposit(item.type, null, item.count);
                    await this.utils.sleep(100);
                }
            }

            container.close();
        } catch (err) {
            // Container operation failed
        }
    }

    /**
     * Deposit ores into nearest chest
     */
    async depositOres(bot) {
        const chest = bot.findBlock({
            matching: block => block.name === 'chest' || block.name === 'barrel',
            maxDistance: 16
        });

        if (!chest) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(chest.position.x, chest.position.y, chest.position.z, 3), true);
        await this.utils.sleep(1000);

        try {
            const container = await bot.openContainer(chest);
            const ores = bot.inventory.items().filter(item =>
                item.name.includes('ore') || item.name.includes('raw_') ||
                item.name === 'diamond' || item.name === 'emerald' ||
                item.name === 'coal' || item.name.includes('ingot')
            );

            for (const ore of ores) {
                await container.deposit(ore.type, null, ore.count);
                await this.utils.sleep(100);
            }

            container.close();
        } catch (err) {
            // Container operation failed
        }
    }

    /**
     * Deposit food items into nearest chest
     */
    async depositFood(bot) {
        const chest = bot.findBlock({
            matching: block => block.name === 'chest' || block.name === 'barrel',
            maxDistance: 16
        });

        if (!chest) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(chest.position.x, chest.position.y, chest.position.z, 3), true);
        await this.utils.sleep(1000);

        try {
            const container = await bot.openContainer(chest);
            const food = bot.inventory.items().filter(item =>
                item.name.includes('cooked') || item.name === 'bread' ||
                item.name === 'apple' || item.name === 'golden_apple' ||
                item.name.includes('stew') || item.name === 'baked_potato'
            );

            for (const foodItem of food) {
                // Keep some food for survival
                const keepAmount = 5;
                if (foodItem.count > keepAmount) {
                    await container.deposit(foodItem.type, null, foodItem.count - keepAmount);
                    await this.utils.sleep(100);
                }
            }

            container.close();
        } catch (err) {
            // Container operation failed
        }
    }

    /**
     * Deposit tools into nearest chest
     */
    async depositTools(bot) {
        const chest = bot.findBlock({
            matching: block => block.name === 'chest' || block.name === 'barrel',
            maxDistance: 16
        });

        if (!chest) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(chest.position.x, chest.position.y, chest.position.z, 3), true);
        await this.utils.sleep(1000);

        try {
            const container = await bot.openContainer(chest);
            const tools = bot.inventory.items().filter(item =>
                (item.name.includes('pickaxe') || item.name.includes('axe') ||
                 item.name.includes('shovel') || item.name.includes('hoe')) &&
                !item.name.includes('diamond') // Keep diamond tools
            );

            for (const tool of tools) {
                await container.deposit(tool.type, null, 1);
                await this.utils.sleep(100);
            }

            container.close();
        } catch (err) {
            // Container operation failed
        }
    }

    /**
     * Withdraw food from nearest chest
     */
    async withdrawFood(bot) {
        const chest = bot.findBlock({
            matching: block => block.name === 'chest' || block.name === 'barrel',
            maxDistance: 16
        });

        if (!chest) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(chest.position.x, chest.position.y, chest.position.z, 3), true);
        await this.utils.sleep(1000);

        try {
            const container = await bot.openContainer(chest);
            const foodTypes = ['cooked_beef', 'cooked_porkchop', 'bread', 'cooked_chicken', 'baked_potato'];

            for (const foodType of foodTypes) {
                const item = container.containerItems().find(i => i.name === foodType);
                if (item) {
                    await container.withdraw(item.type, null, Math.min(item.count, 10));
                    break;
                }
            }

            container.close();
        } catch (err) {
            // Container operation failed
        }
    }

    /**
     * Withdraw tools from nearest chest
     */
    async withdrawTools(bot) {
        const chest = bot.findBlock({
            matching: block => block.name === 'chest' || block.name === 'barrel',
            maxDistance: 16
        });

        if (!chest) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(chest.position.x, chest.position.y, chest.position.z, 3), true);
        await this.utils.sleep(1000);

        try {
            const container = await bot.openContainer(chest);
            const toolPriority = ['diamond_pickaxe', 'iron_pickaxe', 'diamond_sword', 'iron_sword'];

            for (const toolName of toolPriority) {
                const tool = container.containerItems().find(i => i.name === toolName);
                if (tool && !bot.inventory.items().some(i => i.name === toolName)) {
                    await container.withdraw(tool.type, null, 1);
                    break;
                }
            }

            container.close();
        } catch (err) {
            // Container operation failed
        }
    }

    /**
     * Withdraw building materials from nearest chest
     */
    async withdrawMaterials(bot) {
        const chest = bot.findBlock({
            matching: block => block.name === 'chest' || block.name === 'barrel',
            maxDistance: 16
        });

        if (!chest) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(chest.position.x, chest.position.y, chest.position.z, 3), true);
        await this.utils.sleep(1000);

        try {
            const container = await bot.openContainer(chest);
            const materials = ['cobblestone', 'stone', 'planks', 'dirt'];

            for (const material of materials) {
                const item = container.containerItems().find(i => i.name.includes(material));
                if (item) {
                    await container.withdraw(item.type, null, Math.min(item.count, 64));
                    break;
                }
            }

            container.close();
        } catch (err) {
            // Container operation failed
        }
    }

    /**
     * Organize chest contents (consolidate similar items)
     */
    async organizeChest(bot) {
        const chest = bot.findBlock({
            matching: block => block.name === 'chest',
            maxDistance: 16
        });

        if (!chest) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(chest.position.x, chest.position.y, chest.position.z, 3), true);
        await this.utils.sleep(1000);

        try {
            const container = await bot.openContainer(chest);
            // Chest organization is complex; for now, this action identifies the chest
            // Full implementation would require sophisticated item sorting logic
            await this.utils.sleep(500);
            container.close();
        } catch (err) {
            // Container operation failed
        }
    }

    /**
     * Open nearby furnace for interaction
     */
    async openNearbyFurnace(bot) {
        const furnace = bot.findBlock({
            matching: block => block.name === 'furnace' || block.name === 'blast_furnace' || block.name === 'smoker',
            maxDistance: 16
        });

        if (!furnace) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(furnace.position.x, furnace.position.y, furnace.position.z, 3), true);
        await this.utils.sleep(1000);

        try {
            const furnaceWindow = await bot.openFurnace(furnace);
            await this.utils.sleep(500);
            furnaceWindow.close();
        } catch (err) {
            // Furnace operation failed
        }
    }

    /**
     * Open nearby crafting table
     */
    async openCraftingTable(bot) {
        const craftingTable = bot.findBlock({
            matching: block => block.name === 'crafting_table',
            maxDistance: 16
        });

        if (!craftingTable) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(craftingTable.position.x, craftingTable.position.y, craftingTable.position.z, 3), true);
        await this.utils.sleep(1000);

        // Crafting table doesn't need to be "opened", just be nearby
        await this.utils.sleep(200);
    }

    /**
     * Take output from furnace
     */
    async takeFromFurnace(bot) {
        const furnace = bot.findBlock({
            matching: block => block.name === 'furnace' || block.name === 'blast_furnace' || block.name === 'smoker',
            maxDistance: 16
        });

        if (!furnace) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(furnace.position.x, furnace.position.y, furnace.position.z, 3), true);
        await this.utils.sleep(1000);

        try {
            const furnaceWindow = await bot.openFurnace(furnace);

            // Take output if available
            if (furnaceWindow.outputItem()) {
                await furnaceWindow.takeOutput();
            }

            furnaceWindow.close();
        } catch (err) {
            // Furnace operation failed
        }
    }

    /**
     * Load furnace with input and fuel
     */
    async loadFurnace(bot) {
        const furnace = bot.findBlock({
            matching: block => block.name === 'furnace' || block.name === 'blast_furnace' || block.name === 'smoker',
            maxDistance: 16
        });

        if (!furnace) {
            return;
        }

        const smeltable = bot.inventory.items().find(item =>
            item.name.includes('ore') || item.name.includes('raw_') ||
            item.name.includes('raw_beef') || item.name.includes('raw_porkchop') ||
            item.name.includes('raw_chicken') || item.name.includes('raw_mutton')
        );

        const fuel = bot.inventory.items().find(item =>
            item.name === 'coal' || item.name === 'charcoal' ||
            item.name.includes('planks') || item.name === 'coal_block'
        );

        if (!smeltable || !fuel) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(furnace.position.x, furnace.position.y, furnace.position.z, 3), true);
        await this.utils.sleep(1000);

        try {
            const furnaceWindow = await bot.openFurnace(furnace);
            await furnaceWindow.putInput(smeltable.type, null, Math.min(smeltable.count, 8));
            await furnaceWindow.putFuel(fuel.type, null, Math.min(fuel.count, 4));
            await this.utils.sleep(500);
            furnaceWindow.close();
        } catch (err) {
            // Furnace operation failed
        }
    }
}

module.exports = ContainerActions;
