/**
 * Enchanting & Brewing Actions (123-132)
 * Enchanting table, anvil, grindstone, and brewing operations
 */

const Vec3 = require('vec3');

class EnchantingActions {
    constructor(actionSpace) {
        this.actionSpace = actionSpace;
    }

    /**
     * Open enchanting table and prepare for enchanting
     */
    async openEnchantingTable(bot) {
        const enchantingTable = bot.findBlock({
            matching: block => block.name === 'enchanting_table',
            maxDistance: 32
        });

        if (!enchantingTable) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(enchantingTable.position.x, enchantingTable.position.y, enchantingTable.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        try {
            const enchantWindow = await bot.openEnchantmentTable(enchantingTable);
            await this.actionSpace.sleep(500);
            enchantWindow.close();
        } catch (err) {
            // Failed to open enchanting table
        }
    }

    /**
     * Enchant tool (pickaxe, axe, shovel) at enchanting table
     */
    async enchantTool(bot) {
        const enchantingTable = bot.findBlock({
            matching: block => block.name === 'enchanting_table',
            maxDistance: 32
        });

        if (!enchantingTable) {
            return;
        }

        const tool = bot.inventory.items().find(item =>
            (item.name.includes('pickaxe') || item.name.includes('axe') || item.name.includes('shovel')) &&
            !item.nbt
        );
        const lapis = bot.inventory.items().find(item => item.name === 'lapis_lazuli');

        if (!tool || !lapis || bot.experience.level < 1) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(enchantingTable.position.x, enchantingTable.position.y, enchantingTable.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        try {
            const enchantWindow = await bot.openEnchantmentTable(enchantingTable);
            await enchantWindow.putTargetItem(tool);
            await this.actionSpace.sleep(500);

            // Try to enchant at the highest available level
            const enchantments = enchantWindow.enchantments;
            if (enchantments && enchantments.length > 0) {
                const bestEnchant = enchantments[enchantments.length - 1];
                await enchantWindow.enchant(bestEnchant.level);
                await this.actionSpace.sleep(500);
            }

            enchantWindow.close();
        } catch (err) {
            // Enchanting failed
        }
    }

    /**
     * Enchant weapon (sword, axe) at enchanting table
     */
    async enchantWeapon(bot) {
        const enchantingTable = bot.findBlock({
            matching: block => block.name === 'enchanting_table',
            maxDistance: 32
        });

        if (!enchantingTable) {
            return;
        }

        const weapon = bot.inventory.items().find(item =>
            (item.name.includes('sword') || (item.name.includes('axe') && !item.nbt))
        );
        const lapis = bot.inventory.items().find(item => item.name === 'lapis_lazuli');

        if (!weapon || !lapis || bot.experience.level < 1) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(enchantingTable.position.x, enchantingTable.position.y, enchantingTable.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        try {
            const enchantWindow = await bot.openEnchantmentTable(enchantingTable);
            await enchantWindow.putTargetItem(weapon);
            await this.actionSpace.sleep(500);

            const enchantments = enchantWindow.enchantments;
            if (enchantments && enchantments.length > 0) {
                const bestEnchant = enchantments[enchantments.length - 1];
                await enchantWindow.enchant(bestEnchant.level);
                await this.actionSpace.sleep(500);
            }

            enchantWindow.close();
        } catch (err) {
            // Enchanting failed
        }
    }

    /**
     * Enchant armor piece at enchanting table
     */
    async enchantArmor(bot) {
        const enchantingTable = bot.findBlock({
            matching: block => block.name === 'enchanting_table',
            maxDistance: 32
        });

        if (!enchantingTable) {
            return;
        }

        const armor = bot.inventory.items().find(item =>
            (item.name.includes('helmet') || item.name.includes('chestplate') ||
             item.name.includes('leggings') || item.name.includes('boots')) &&
            !item.nbt
        );
        const lapis = bot.inventory.items().find(item => item.name === 'lapis_lazuli');

        if (!armor || !lapis || bot.experience.level < 1) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(enchantingTable.position.x, enchantingTable.position.y, enchantingTable.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        try {
            const enchantWindow = await bot.openEnchantmentTable(enchantingTable);
            await enchantWindow.putTargetItem(armor);
            await this.actionSpace.sleep(500);

            const enchantments = enchantWindow.enchantments;
            if (enchantments && enchantments.length > 0) {
                const bestEnchant = enchantments[enchantments.length - 1];
                await enchantWindow.enchant(bestEnchant.level);
                await this.actionSpace.sleep(500);
            }

            enchantWindow.close();
        } catch (err) {
            // Enchanting failed
        }
    }

    /**
     * Use anvil to repair damaged item
     */
    async useAnvilRepair(bot) {
        const anvil = bot.findBlock({
            matching: block => block.name === 'anvil' || block.name === 'chipped_anvil' || block.name === 'damaged_anvil',
            maxDistance: 32
        });

        if (!anvil) {
            return;
        }

        const damagedItem = bot.inventory.items().find(item =>
            item.durabilityUsed && item.durabilityUsed > (item.maxDurability * 0.3)
        );

        if (!damagedItem) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(anvil.position.x, anvil.position.y, anvil.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        try {
            const anvilWindow = await bot.openAnvil(anvil);
            await this.actionSpace.sleep(500);
            anvilWindow.close();
        } catch (err) {
            // Anvil operation failed
        }
    }

    /**
     * Use anvil to combine enchanted items
     */
    async useAnvilCombine(bot) {
        const anvil = bot.findBlock({
            matching: block => block.name === 'anvil' || block.name === 'chipped_anvil' || block.name === 'damaged_anvil',
            maxDistance: 32
        });

        if (!anvil) {
            return;
        }

        const enchantedItems = bot.inventory.items().filter(item => item.nbt);

        if (enchantedItems.length < 2) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(anvil.position.x, anvil.position.y, anvil.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        try {
            const anvilWindow = await bot.openAnvil(anvil);
            await this.actionSpace.sleep(500);
            anvilWindow.close();
        } catch (err) {
            // Anvil operation failed
        }
    }

    /**
     * Use grindstone to remove enchantments
     */
    async useGrindstone(bot) {
        const grindstone = bot.findBlock({
            matching: block => block.name === 'grindstone',
            maxDistance: 32
        });

        if (!grindstone) {
            return;
        }

        const enchantedItem = bot.inventory.items().find(item => item.nbt);

        if (!enchantedItem) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(grindstone.position.x, grindstone.position.y, grindstone.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        try {
            const grindstoneWindow = await bot.openGrindstone(grindstone);
            await this.actionSpace.sleep(500);
            grindstoneWindow.close();
        } catch (err) {
            // Grindstone operation failed
        }
    }

    /**
     * Brew potion at brewing stand
     */
    async brewPotion(bot) {
        const brewingStand = bot.findBlock({
            matching: block => block.name === 'brewing_stand',
            maxDistance: 32
        });

        if (!brewingStand) {
            return;
        }

        const bottle = bot.inventory.items().find(item => item.name === 'glass_bottle' || item.name === 'potion');
        const ingredient = bot.inventory.items().find(item =>
            item.name === 'nether_wart' || item.name === 'blaze_powder' ||
            item.name === 'spider_eye' || item.name === 'ghast_tear'
        );
        const blazePowder = bot.inventory.items().find(item => item.name === 'blaze_powder');

        if (!bottle || !ingredient || !blazePowder) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(brewingStand.position.x, brewingStand.position.y, brewingStand.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        try {
            const brewWindow = await bot.openBrewingStand(brewingStand);
            await this.actionSpace.sleep(500);
            brewWindow.close();
        } catch (err) {
            // Brewing failed
        }
    }

    /**
     * Gather lapis lazuli for enchanting
     */
    async gatherLapis(bot) {
        const lapisOre = bot.findBlock({
            matching: block => block.name === 'lapis_ore' || block.name === 'deepslate_lapis_ore',
            maxDistance: 32
        });

        if (!lapisOre) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(lapisOre.position.x, lapisOre.position.y, lapisOre.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        const pickaxe = bot.inventory.items().find(item =>
            item.name.includes('pickaxe') && (item.name.includes('iron') || item.name.includes('diamond'))
        );

        if (pickaxe) {
            await bot.equip(pickaxe, 'hand');
            await this.actionSpace.sleep(100);
        }

        try {
            await bot.dig(lapisOre);
            await this.actionSpace.sleep(500);
        } catch (err) {
            // Mining failed
        }
    }

    /**
     * Create enchanting setup with bookshelves
     */
    async createEnchantingSetup(bot) {
        const enchantingTable = bot.findBlock({
            matching: block => block.name === 'enchanting_table',
            maxDistance: 32
        });

        if (!enchantingTable) {
            return;
        }

        const bookshelf = bot.inventory.items().find(item => item.name === 'bookshelf');

        if (!bookshelf) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(enchantingTable.position.x, enchantingTable.position.y, enchantingTable.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        // Place bookshelves around enchanting table (2 blocks away, 1 block higher)
        const positions = [
            new Vec3(enchantingTable.position.x + 2, enchantingTable.position.y, enchantingTable.position.z),
            new Vec3(enchantingTable.position.x - 2, enchantingTable.position.y, enchantingTable.position.z),
            new Vec3(enchantingTable.position.x, enchantingTable.position.y, enchantingTable.position.z + 2),
            new Vec3(enchantingTable.position.x, enchantingTable.position.y, enchantingTable.position.z - 2)
        ];

        for (const pos of positions) {
            if (bookshelf.count === 0) break;

            const blockBelow = bot.blockAt(pos.offset(0, -1, 0));
            if (blockBelow && blockBelow.name !== 'air') {
                try {
                    await bot.equip(bookshelf, 'hand');
                    await bot.placeBlock(blockBelow, new Vec3(0, 1, 0));
                    await this.actionSpace.sleep(300);
                } catch (err) {
                    // Placement failed
                }
            }
        }
    }
}

module.exports = EnchantingActions;
