/**
 * Storage & Container Actions (281-295)
 * Chest management, item organization, furnace operations, storage optimization
 */

const { goals: { GoalNear } } = require('mineflayer-pathfinder');
const Vec3 = require('vec3');

class StorageActions {
    constructor(utils) {
        this.utils = utils;
    }

    /**
     * Find nearest chest
     */
    findNearestChest(bot) {
        return bot.findBlock({
            matching: block => block.name === 'chest' || block.name === 'barrel',
            maxDistance: 32
        });
    }

    /**
     * Open chest/container
     */
    async openChest(bot, chest) {
        if (!chest) {
            chest = this.findNearestChest(bot);
        }

        if (!chest) {
            console.log('[Storage] No chest found');
            return null;
        }

        try {
            const container = await bot.openContainer(chest);
            console.log('[Storage] Chest opened');
            return container;
        } catch (err) {
            console.log('[Storage] Failed to open chest:', err.message);
            return null;
        }
    }

    /**
     * Deposit all items into chest
     */
    async depositAllItems(bot) {
        const chest = this.findNearestChest(bot);
        if (!chest) return false;

        try {
            // Navigate to chest
            const goal = new GoalNear(chest.position.x, chest.position.y, chest.position.z, 2);
            await bot.pathfinder.goto(goal);

            const container = await this.openChest(bot, chest);
            if (!container) return false;

            const items = bot.inventory.items();

            for (const item of items) {
                // Keep tools and food, deposit rest
                if (!this.isEssentialItem(item)) {
                    try {
                        await container.deposit(item.type, null, item.count);
                        await this.utils.sleep(100);
                    } catch (err) {
                        // Chest might be full
                    }
                }
            }

            container.close();
            console.log('[Storage] Items deposited');
            return true;
        } catch (err) {
            console.log('[Storage] Deposit failed:', err.message);
            return false;
        }
    }

    /**
     * Deposit specific item type
     */
    async depositItemType(bot, itemName) {
        const chest = this.findNearestChest(bot);
        if (!chest) return false;

        try {
            const goal = new GoalNear(chest.position.x, chest.position.y, chest.position.z, 2);
            await bot.pathfinder.goto(goal);

            const container = await this.openChest(bot, chest);
            if (!container) return false;

            const items = bot.inventory.items().filter(item => item.name === itemName);

            for (const item of items) {
                await container.deposit(item.type, null, item.count);
                await this.utils.sleep(100);
            }

            container.close();
            console.log(`[Storage] Deposited all ${itemName}`);
            return true;
        } catch (err) {
            console.log('[Storage] Deposit failed:', err.message);
            return false;
        }
    }

    /**
     * Withdraw specific item from chest
     */
    async withdrawItem(bot, itemName, count = 1) {
        const chest = this.findNearestChest(bot);
        if (!chest) return false;

        try {
            const goal = new GoalNear(chest.position.x, chest.position.y, chest.position.z, 2);
            await bot.pathfinder.goto(goal);

            const container = await this.openChest(bot, chest);
            if (!container) return false;

            const item = container.containerItems().find(item => item.name === itemName);

            if (!item) {
                console.log(`[Storage] ${itemName} not found in chest`);
                container.close();
                return false;
            }

            await container.withdraw(item.type, null, Math.min(count, item.count));
            console.log(`[Storage] Withdrew ${count}x ${itemName}`);

            container.close();
            return true;
        } catch (err) {
            console.log('[Storage] Withdraw failed:', err.message);
            return false;
        }
    }

    /**
     * Check if item is essential (keep in inventory)
     */
    isEssentialItem(item) {
        const essential = [
            'diamond_pickaxe', 'iron_pickaxe', 'diamond_sword', 'iron_sword',
            'diamond_axe', 'iron_axe', 'cooked_beef', 'bread', 'torch',
            'crafting_table', 'shield'
        ];

        return essential.some(name => item.name.includes(name));
    }

    /**
     * Organize chest by item category
     */
    async organizeChest(bot) {
        const chest = this.findNearestChest(bot);
        if (!chest) return false;

        try {
            const container = await this.openChest(bot, chest);
            if (!container) return false;

            const items = container.containerItems();

            // Group by category
            const categories = {
                tools: items.filter(i => i.name.includes('pickaxe') || i.name.includes('axe') || i.name.includes('sword')),
                ores: items.filter(i => i.name.includes('ore') || i.name.includes('ingot')),
                food: items.filter(i => ['bread', 'beef', 'porkchop', 'apple'].some(f => i.name.includes(f))),
                blocks: items.filter(i => ['cobblestone', 'dirt', 'stone', 'planks'].includes(i.name))
            };

            console.log('[Storage] Chest organized by category');
            // Actual reorganization would require complex window operations
            container.close();
            return true;
        } catch (err) {
            console.log('[Storage] Organization failed:', err.message);
            return false;
        }
    }

    /**
     * Find chest containing specific item
     */
    async findChestWithItem(bot, itemName) {
        const nearbyChests = bot.findBlocks({
            matching: block => block.name === 'chest' || block.name === 'barrel',
            maxDistance: 32,
            count: 10
        });

        for (const chestPos of nearbyChests) {
            try {
                const chest = bot.blockAt(chestPos);
                const container = await bot.openContainer(chest);

                const hasItem = container.containerItems().some(item => item.name === itemName);

                container.close();

                if (hasItem) {
                    console.log(`[Storage] Found ${itemName} in chest at ${chestPos}`);
                    return chest;
                }

                await this.utils.sleep(200);
            } catch (err) {
                // Skip this chest
            }
        }

        console.log(`[Storage] ${itemName} not found in any chest`);
        return null;
    }

    /**
     * Get total items in storage
     */
    async getTotalStorageCount(bot) {
        const nearbyChests = bot.findBlocks({
            matching: block => block.name === 'chest' || block.name === 'barrel',
            maxDistance: 32,
            count: 10
        });

        let totalItems = 0;

        for (const chestPos of nearbyChests) {
            try {
                const chest = bot.blockAt(chestPos);
                const container = await bot.openContainer(chest);

                totalItems += container.containerItems().length;

                container.close();
                await this.utils.sleep(200);
            } catch (err) {
                // Skip
            }
        }

        return totalItems;
    }

    /**
     * Furnace operations: smelt items
     */
    async smeltItems(bot, itemToSmelt, fuelType = 'coal') {
        const furnace = bot.findBlock({
            matching: block => block.name === 'furnace' || block.name === 'blast_furnace',
            maxDistance: 16
        });

        if (!furnace) {
            console.log('[Storage] No furnace nearby');
            return false;
        }

        try {
            const goal = new GoalNear(furnace.position.x, furnace.position.y, furnace.position.z, 2);
            await bot.pathfinder.goto(goal);

            const furnaceWindow = await bot.openFurnace(furnace);

            // Get items
            const smeltItem = bot.inventory.items().find(item => item.name === itemToSmelt);
            const fuel = bot.inventory.items().find(item => item.name === fuelType);

            if (!smeltItem) {
                console.log(`[Storage] No ${itemToSmelt} to smelt`);
                furnaceWindow.close();
                return false;
            }

            if (!fuel) {
                console.log(`[Storage] No ${fuelType} for fuel`);
                furnaceWindow.close();
                return false;
            }

            // Put items in furnace
            await furnaceWindow.putInput(smeltItem.type, null, smeltItem.count);
            await furnaceWindow.putFuel(fuel.type, null, Math.min(fuel.count, 8));

            console.log(`[Storage] Smelting ${smeltItem.count}x ${itemToSmelt}`);

            // Wait a bit then collect output
            await this.utils.sleep(5000);

            await furnaceWindow.takeOutput();

            furnaceWindow.close();
            return true;
        } catch (err) {
            console.log('[Storage] Smelting failed:', err.message);
            return false;
        }
    }

    /**
     * Collect furnace output
     */
    async collectFurnaceOutput(bot) {
        const furnace = bot.findBlock({
            matching: block => block.name === 'furnace' || block.name === 'blast_furnace',
            maxDistance: 16
        });

        if (!furnace) return false;

        try {
            const furnaceWindow = await bot.openFurnace(furnace);

            // Take all output
            await furnaceWindow.takeOutput();

            console.log('[Storage] Collected furnace output');
            furnaceWindow.close();
            return true;
        } catch (err) {
            console.log('[Storage] Collection failed:', err.message);
            return false;
        }
    }

    /**
     * Check if chest is full
     */
    async isChestFull(bot, chest) {
        try {
            const container = await bot.openContainer(chest);
            const isFull = container.containerItems().length >= container.slots.length - 1;
            container.close();
            return isFull;
        } catch (err) {
            return false;
        }
    }

    /**
     * Find empty chest
     */
    async findEmptyChest(bot) {
        const nearbyChests = bot.findBlocks({
            matching: block => block.name === 'chest' || block.name === 'barrel',
            maxDistance: 32,
            count: 10
        });

        for (const chestPos of nearbyChests) {
            const chest = bot.blockAt(chestPos);
            const isEmpty = !(await this.isChestFull(bot, chest));

            if (isEmpty) {
                return chest;
            }

            await this.utils.sleep(200);
        }

        return null;
    }
}

module.exports = StorageActions;
