/**
 * Advanced Crafting Actions (91-110)
 * Specific crafting recipes for neural network-driven agents
 */

const Vec3 = require('vec3');

class CraftingActions {
    constructor(utils) {
        this.utils = utils;
    }

    /**
     * Helper: Find or approach crafting table
     */
    async findCraftingTable(bot) {
        const craftingTable = bot.findBlock({
            matching: block => block.name === 'crafting_table',
            maxDistance: 32
        });

        if (craftingTable) {
            const { GoalNear } = require('mineflayer-pathfinder').goals;
            bot.pathfinder.setGoal(new GoalNear(craftingTable.position.x, craftingTable.position.y, craftingTable.position.z, 3), true);
            await this.utils.sleep(500);
            return craftingTable;
        }
        return null;
    }

    /**
     * Craft wooden tools (pickaxe, axe, shovel)
     */
    async craftWoodenTools(bot) {
        const planks = bot.inventory.items().find(item => item.name.includes('planks'));
        const sticks = bot.inventory.items().find(item => item.name === 'stick');

        if (!planks || !sticks) {
            // Craft sticks first if we have planks
            if (planks && planks.count >= 2) {
                const stickRecipe = bot.recipesFor(bot.registry.itemsByName.stick.id)[0];
                if (stickRecipe) {
                    await bot.craft(stickRecipe, 1);
                }
            }
            return;
        }

        // Craft wooden pickaxe
        const pickaxeRecipe = bot.recipesFor(bot.registry.itemsByName.wooden_pickaxe.id)[0];
        if (pickaxeRecipe && planks.count >= 3 && sticks.count >= 2) {
            await bot.craft(pickaxeRecipe, 1);
        }
    }

    /**
     * Craft stone tools (pickaxe, axe, shovel)
     */
    async craftStoneTools(bot) {
        const cobblestone = bot.inventory.items().find(item => item.name === 'cobblestone');
        const sticks = bot.inventory.items().find(item => item.name === 'stick');

        if (!cobblestone || !sticks || cobblestone.count < 3 || sticks.count < 2) {
            return;
        }

        const craftingTable = await this.findCraftingTable(bot);
        if (!craftingTable) {
            return;
        }

        // Craft stone pickaxe
        const pickaxeRecipe = bot.recipesFor(bot.registry.itemsByName.stone_pickaxe.id, null, 1, craftingTable)[0];
        if (pickaxeRecipe) {
            await bot.craft(pickaxeRecipe, 1, craftingTable);
        }
    }

    /**
     * Craft iron tools (pickaxe, axe, shovel)
     */
    async craftIronTools(bot) {
        const ironIngot = bot.inventory.items().find(item => item.name === 'iron_ingot');
        const sticks = bot.inventory.items().find(item => item.name === 'stick');

        if (!ironIngot || !sticks || ironIngot.count < 3 || sticks.count < 2) {
            return;
        }

        const craftingTable = await this.findCraftingTable(bot);
        if (!craftingTable) {
            return;
        }

        // Craft iron pickaxe
        const pickaxeRecipe = bot.recipesFor(bot.registry.itemsByName.iron_pickaxe.id, null, 1, craftingTable)[0];
        if (pickaxeRecipe) {
            await bot.craft(pickaxeRecipe, 1, craftingTable);
        }
    }

    /**
     * Craft diamond tools (pickaxe, axe, shovel)
     */
    async craftDiamondTools(bot) {
        const diamond = bot.inventory.items().find(item => item.name === 'diamond');
        const sticks = bot.inventory.items().find(item => item.name === 'stick');

        if (!diamond || !sticks || diamond.count < 3 || sticks.count < 2) {
            return;
        }

        const craftingTable = await this.findCraftingTable(bot);
        if (!craftingTable) {
            return;
        }

        // Craft diamond pickaxe
        const pickaxeRecipe = bot.recipesFor(bot.registry.itemsByName.diamond_pickaxe.id, null, 1, craftingTable)[0];
        if (pickaxeRecipe) {
            await bot.craft(pickaxeRecipe, 1, craftingTable);
        }
    }

    /**
     * Craft wooden sword
     */
    async craftWoodenSword(bot) {
        const planks = bot.inventory.items().find(item => item.name.includes('planks'));
        const sticks = bot.inventory.items().find(item => item.name === 'stick');

        if (!planks || !sticks || planks.count < 2 || sticks.count < 1) {
            return;
        }

        const swordRecipe = bot.recipesFor(bot.registry.itemsByName.wooden_sword.id)[0];
        if (swordRecipe) {
            await bot.craft(swordRecipe, 1);
        }
    }

    /**
     * Craft stone sword
     */
    async craftStoneSword(bot) {
        const cobblestone = bot.inventory.items().find(item => item.name === 'cobblestone');
        const sticks = bot.inventory.items().find(item => item.name === 'stick');

        if (!cobblestone || !sticks || cobblestone.count < 2 || sticks.count < 1) {
            return;
        }

        const craftingTable = await this.findCraftingTable(bot);
        if (!craftingTable) {
            return;
        }

        const swordRecipe = bot.recipesFor(bot.registry.itemsByName.stone_sword.id, null, 1, craftingTable)[0];
        if (swordRecipe) {
            await bot.craft(swordRecipe, 1, craftingTable);
        }
    }

    /**
     * Craft iron sword
     */
    async craftIronSword(bot) {
        const ironIngot = bot.inventory.items().find(item => item.name === 'iron_ingot');
        const sticks = bot.inventory.items().find(item => item.name === 'stick');

        if (!ironIngot || !sticks || ironIngot.count < 2 || sticks.count < 1) {
            return;
        }

        const craftingTable = await this.findCraftingTable(bot);
        if (!craftingTable) {
            return;
        }

        const swordRecipe = bot.recipesFor(bot.registry.itemsByName.iron_sword.id, null, 1, craftingTable)[0];
        if (swordRecipe) {
            await bot.craft(swordRecipe, 1, craftingTable);
        }
    }

    /**
     * Craft diamond sword
     */
    async craftDiamondSword(bot) {
        const diamond = bot.inventory.items().find(item => item.name === 'diamond');
        const sticks = bot.inventory.items().find(item => item.name === 'stick');

        if (!diamond || !sticks || diamond.count < 2 || sticks.count < 1) {
            return;
        }

        const craftingTable = await this.findCraftingTable(bot);
        if (!craftingTable) {
            return;
        }

        const swordRecipe = bot.recipesFor(bot.registry.itemsByName.diamond_sword.id, null, 1, craftingTable)[0];
        if (swordRecipe) {
            await bot.craft(swordRecipe, 1, craftingTable);
        }
    }

    /**
     * Craft iron armor set
     */
    async craftIronArmor(bot) {
        const ironIngot = bot.inventory.items().find(item => item.name === 'iron_ingot');

        if (!ironIngot || ironIngot.count < 24) { // Full set needs 24 ingots
            return;
        }

        const craftingTable = await this.findCraftingTable(bot);
        if (!craftingTable) {
            return;
        }

        const armorPieces = ['iron_helmet', 'iron_chestplate', 'iron_leggings', 'iron_boots'];
        for (const piece of armorPieces) {
            const recipe = bot.recipesFor(bot.registry.itemsByName[piece].id, null, 1, craftingTable)[0];
            if (recipe) {
                await bot.craft(recipe, 1, craftingTable);
                await this.utils.sleep(200);
            }
        }
    }

    /**
     * Craft diamond armor set
     */
    async craftDiamondArmor(bot) {
        const diamond = bot.inventory.items().find(item => item.name === 'diamond');

        if (!diamond || diamond.count < 24) { // Full set needs 24 diamonds
            return;
        }

        const craftingTable = await this.findCraftingTable(bot);
        if (!craftingTable) {
            return;
        }

        const armorPieces = ['diamond_helmet', 'diamond_chestplate', 'diamond_leggings', 'diamond_boots'];
        for (const piece of armorPieces) {
            const recipe = bot.recipesFor(bot.registry.itemsByName[piece].id, null, 1, craftingTable)[0];
            if (recipe) {
                await bot.craft(recipe, 1, craftingTable);
                await this.utils.sleep(200);
            }
        }
    }

    /**
     * Craft shield
     */
    async craftShield(bot) {
        const planks = bot.inventory.items().find(item => item.name.includes('planks'));
        const ironIngot = bot.inventory.items().find(item => item.name === 'iron_ingot');

        if (!planks || !ironIngot || planks.count < 6 || ironIngot.count < 1) {
            return;
        }

        const craftingTable = await this.findCraftingTable(bot);
        if (!craftingTable) {
            return;
        }

        const shieldRecipe = bot.recipesFor(bot.registry.itemsByName.shield.id, null, 1, craftingTable)[0];
        if (shieldRecipe) {
            await bot.craft(shieldRecipe, 1, craftingTable);
        }
    }

    /**
     * Craft bow
     */
    async craftBow(bot) {
        const sticks = bot.inventory.items().find(item => item.name === 'stick');
        const string = bot.inventory.items().find(item => item.name === 'string');

        if (!sticks || !string || sticks.count < 3 || string.count < 3) {
            return;
        }

        const craftingTable = await this.findCraftingTable(bot);
        if (!craftingTable) {
            return;
        }

        const bowRecipe = bot.recipesFor(bot.registry.itemsByName.bow.id, null, 1, craftingTable)[0];
        if (bowRecipe) {
            await bot.craft(bowRecipe, 1, craftingTable);
        }
    }

    /**
     * Craft arrows
     */
    async craftArrows(bot) {
        const flint = bot.inventory.items().find(item => item.name === 'flint');
        const sticks = bot.inventory.items().find(item => item.name === 'stick');
        const feather = bot.inventory.items().find(item => item.name === 'feather');

        if (!flint || !sticks || !feather) {
            return;
        }

        const craftingTable = await this.findCraftingTable(bot);
        if (!craftingTable) {
            return;
        }

        const arrowRecipe = bot.recipesFor(bot.registry.itemsByName.arrow.id, null, 1, craftingTable)[0];
        if (arrowRecipe) {
            const maxCraft = Math.min(Math.floor(flint.count / 1), Math.floor(sticks.count / 1), Math.floor(feather.count / 1));
            if (maxCraft > 0) {
                await bot.craft(arrowRecipe, Math.min(maxCraft, 4), craftingTable);
            }
        }
    }

    /**
     * Craft bed
     */
    async craftBed(bot) {
        const planks = bot.inventory.items().find(item => item.name.includes('planks'));
        const wool = bot.inventory.items().find(item => item.name.includes('wool'));

        if (!planks || !wool || planks.count < 3 || wool.count < 3) {
            return;
        }

        const craftingTable = await this.findCraftingTable(bot);
        if (!craftingTable) {
            return;
        }

        // Try to craft any color bed
        const bedTypes = ['white_bed', 'red_bed', 'black_bed', 'blue_bed'];
        for (const bedType of bedTypes) {
            if (bot.registry.itemsByName[bedType]) {
                const bedRecipe = bot.recipesFor(bot.registry.itemsByName[bedType].id, null, 1, craftingTable)[0];
                if (bedRecipe) {
                    await bot.craft(bedRecipe, 1, craftingTable);
                    return;
                }
            }
        }
    }

    /**
     * Craft bucket
     */
    async craftBucket(bot) {
        const ironIngot = bot.inventory.items().find(item => item.name === 'iron_ingot');

        if (!ironIngot || ironIngot.count < 3) {
            return;
        }

        const craftingTable = await this.findCraftingTable(bot);
        if (!craftingTable) {
            return;
        }

        const bucketRecipe = bot.recipesFor(bot.registry.itemsByName.bucket.id, null, 1, craftingTable)[0];
        if (bucketRecipe) {
            await bot.craft(bucketRecipe, 1, craftingTable);
        }
    }

    /**
     * Smelt iron ore in furnace
     */
    async smeltIronOre(bot) {
        const furnace = bot.findBlock({
            matching: block => block.name === 'furnace' || block.name === 'blast_furnace',
            maxDistance: 32
        });

        if (!furnace) {
            return;
        }

        const ironOre = bot.inventory.items().find(item =>
            item.name === 'iron_ore' || item.name === 'raw_iron' || item.name === 'deepslate_iron_ore'
        );
        const fuel = bot.inventory.items().find(item =>
            item.name === 'coal' || item.name === 'charcoal' || item.name.includes('planks')
        );

        if (!ironOre || !fuel) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(furnace.position.x, furnace.position.y, furnace.position.z, 3), true);
        await this.utils.sleep(1000);

        try {
            const furnaceWindow = await bot.openFurnace(furnace);
            await furnaceWindow.putInput(ironOre.type, null, 1);
            await furnaceWindow.putFuel(fuel.type, null, 1);
            await this.utils.sleep(500);
            furnaceWindow.close();
        } catch (err) {
            // Furnace operation failed
        }
    }

    /**
     * Smelt gold ore in furnace
     */
    async smeltGoldOre(bot) {
        const furnace = bot.findBlock({
            matching: block => block.name === 'furnace' || block.name === 'blast_furnace',
            maxDistance: 32
        });

        if (!furnace) {
            return;
        }

        const goldOre = bot.inventory.items().find(item =>
            item.name === 'gold_ore' || item.name === 'raw_gold' || item.name === 'deepslate_gold_ore'
        );
        const fuel = bot.inventory.items().find(item =>
            item.name === 'coal' || item.name === 'charcoal' || item.name.includes('planks')
        );

        if (!goldOre || !fuel) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(furnace.position.x, furnace.position.y, furnace.position.z, 3), true);
        await this.utils.sleep(1000);

        try {
            const furnaceWindow = await bot.openFurnace(furnace);
            await furnaceWindow.putInput(goldOre.type, null, 1);
            await furnaceWindow.putFuel(fuel.type, null, 1);
            await this.utils.sleep(500);
            furnaceWindow.close();
        } catch (err) {
            // Furnace operation failed
        }
    }

    /**
     * Smelt/cook food in furnace
     */
    async smeltFood(bot) {
        const furnace = bot.findBlock({
            matching: block => block.name === 'furnace' || block.name === 'smoker',
            maxDistance: 32
        });

        if (!furnace) {
            return;
        }

        const rawFood = bot.inventory.items().find(item =>
            item.name === 'raw_beef' || item.name === 'raw_porkchop' ||
            item.name === 'raw_chicken' || item.name === 'raw_mutton'
        );
        const fuel = bot.inventory.items().find(item =>
            item.name === 'coal' || item.name === 'charcoal' || item.name.includes('planks')
        );

        if (!rawFood || !fuel) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(furnace.position.x, furnace.position.y, furnace.position.z, 3), true);
        await this.utils.sleep(1000);

        try {
            const furnaceWindow = await bot.openFurnace(furnace);
            await furnaceWindow.putInput(rawFood.type, null, Math.min(rawFood.count, 8));
            await furnaceWindow.putFuel(fuel.type, null, 2);
            await this.utils.sleep(500);
            furnaceWindow.close();
        } catch (err) {
            // Furnace operation failed
        }
    }

    /**
     * Craft sticks from planks
     */
    async craftSticks(bot) {
        const planks = bot.inventory.items().find(item => item.name.includes('planks'));

        if (!planks || planks.count < 2) {
            return;
        }

        const stickRecipe = bot.recipesFor(bot.registry.itemsByName.stick.id)[0];
        if (stickRecipe) {
            const maxCraft = Math.floor(planks.count / 2);
            await bot.craft(stickRecipe, Math.min(maxCraft, 16));
        }
    }

    /**
     * Craft planks from logs
     */
    async craftPlanks(bot) {
        const log = bot.inventory.items().find(item =>
            item.name.includes('log') && !item.name.includes('stripped')
        );

        if (!log) {
            return;
        }

        // Determine plank type from log type
        let plankType = 'oak_planks';
        if (log.name.includes('birch')) plankType = 'birch_planks';
        else if (log.name.includes('spruce')) plankType = 'spruce_planks';
        else if (log.name.includes('jungle')) plankType = 'jungle_planks';
        else if (log.name.includes('acacia')) plankType = 'acacia_planks';
        else if (log.name.includes('dark_oak')) plankType = 'dark_oak_planks';

        const plankRecipe = bot.recipesFor(bot.registry.itemsByName[plankType].id)[0];
        if (plankRecipe) {
            await bot.craft(plankRecipe, Math.min(log.count, 16));
        }
    }
}

module.exports = CraftingActions;
