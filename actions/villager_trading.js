/**
 * Villager Trading Actions (251-265)
 * Find villagers, execute trades, cure zombie villagers, manage trading halls
 */

const { goals: { GoalNear } } = require('mineflayer-pathfinder');

class VillagerTradingActions {
    constructor(utils) {
        this.utils = utils;
    }

    /**
     * Find nearest villager
     */
    findNearestVillager(bot) {
        const villagers = Object.values(bot.entities).filter(entity =>
            entity.name === 'villager' &&
            entity.position &&
            entity.position.distanceTo(bot.entity.position) < 48
        );

        if (villagers.length === 0) {
            return null;
        }

        // Sort by distance
        villagers.sort((a, b) =>
            a.position.distanceTo(bot.entity.position) -
            b.position.distanceTo(bot.entity.position)
        );

        return villagers[0];
    }

    /**
     * Navigate to and interact with villager
     */
    async goToVillager(bot) {
        const villager = this.findNearestVillager(bot);
        if (!villager) {
            console.log('[Trading] No villager found nearby');
            return false;
        }

        try {
            const goal = new GoalNear(villager.position.x, villager.position.y, villager.position.z, 2);
            await bot.pathfinder.goto(goal);

            console.log('[Trading] Reached villager');
            return villager;
        } catch (err) {
            console.log('[Trading] Failed to reach villager:', err.message);
            return false;
        }
    }

    /**
     * Open trading window with villager
     */
    async openTrades(bot, villager) {
        try {
            const tradingWindow = await bot.openVillager(villager);
            console.log('[Trading] Opened trading window');
            return tradingWindow;
        } catch (err) {
            console.log('[Trading] Failed to open trades:', err.message);
            return null;
        }
    }

    /**
     * Execute best emerald trade (convert items to emeralds)
     */
    async tradeSellForEmeralds(bot) {
        const villager = await this.goToVillager(bot);
        if (!villager) return false;

        try {
            const tradingWindow = await this.openTrades(bot, villager);
            if (!tradingWindow) return false;

            const trades = tradingWindow.trades;

            // Find trade that gives emeralds
            const emeraldTrade = trades.find(trade =>
                trade.outputItem && trade.outputItem.name === 'emerald' &&
                trade.hasItem1 && !trade.disabled
            );

            if (!emeraldTrade) {
                console.log('[Trading] No emerald trades available');
                tradingWindow.close();
                return false;
            }

            // Check if we have the required item
            const requiredItem = bot.inventory.items().find(item =>
                item.type === emeraldTrade.inputItem1.type
            );

            if (!requiredItem || requiredItem.count < emeraldTrade.inputItem1.count) {
                console.log('[Trading] Insufficient items for trade');
                tradingWindow.close();
                return false;
            }

            // Execute trade
            await tradingWindow.makeTradeAtIndex(emeraldTrade.index);
            console.log(`[Trading] Sold ${emeraldTrade.inputItem1.count}x ${emeraldTrade.inputItem1.name} for emeralds`);

            tradingWindow.close();
            return true;
        } catch (err) {
            console.log('[Trading] Trade failed:', err.message);
            return false;
        }
    }

    /**
     * Execute best buy trade (spend emeralds for goods)
     */
    async tradeBuyWithEmeralds(bot) {
        const villager = await this.goToVillager(bot);
        if (!villager) return false;

        try {
            const tradingWindow = await this.openTrades(bot, villager);
            if (!tradingWindow) return false;

            const trades = tradingWindow.trades;

            // Find valuable trade that costs emeralds
            const valuableItems = ['diamond', 'diamond_pickaxe', 'diamond_sword', 'diamond_axe',
                                  'enchanted_book', 'mending', 'iron_chestplate', 'diamond_chestplate'];

            const goodTrade = trades.find(trade =>
                trade.inputItem1 && trade.inputItem1.name === 'emerald' &&
                trade.outputItem && valuableItems.some(item => trade.outputItem.name.includes(item)) &&
                !trade.disabled
            );

            if (!goodTrade) {
                console.log('[Trading] No valuable trades available');
                tradingWindow.close();
                return false;
            }

            // Check if we have enough emeralds
            const emeralds = bot.inventory.items().find(item => item.name === 'emerald');
            if (!emeralds || emeralds.count < goodTrade.inputItem1.count) {
                console.log('[Trading] Not enough emeralds');
                tradingWindow.close();
                return false;
            }

            // Execute trade
            await tradingWindow.makeTradeAtIndex(goodTrade.index);
            console.log(`[Trading] Bought ${goodTrade.outputItem.name} for ${goodTrade.inputItem1.count} emeralds`);

            tradingWindow.close();
            return true;
        } catch (err) {
            console.log('[Trading] Trade failed:', err.message);
            return false;
        }
    }

    /**
     * Find and cure zombie villager
     */
    async cureZombieVillager(bot) {
        // Find zombie villager
        const zombieVillager = Object.values(bot.entities).find(entity =>
            entity.name === 'zombie_villager' &&
            entity.position &&
            entity.position.distanceTo(bot.entity.position) < 16
        );

        if (!zombieVillager) {
            console.log('[Trading] No zombie villager nearby');
            return false;
        }

        // Check if we have weakness potion and golden apple
        const weaknessPotion = bot.inventory.items().find(item =>
            item.name.includes('splash_potion') && item.nbt?.Potion === 'weakness'
        );

        const goldenApple = bot.inventory.items().find(item =>
            item.name === 'golden_apple'
        );

        if (!weaknessPotion || !goldenApple) {
            console.log('[Trading] Need splash potion of weakness + golden apple');
            return false;
        }

        try {
            // Go near zombie villager
            const goal = new GoalNear(zombieVillager.position.x, zombieVillager.position.y, zombieVillager.position.z, 3);
            await bot.pathfinder.goto(goal);

            // Throw weakness potion
            await bot.equip(weaknessPotion, 'hand');
            await bot.lookAt(zombieVillager.position.offset(0, 1, 0));
            await bot.activateItem(); // Throw potion
            await this.utils.sleep(500);

            // Feed golden apple
            await bot.equip(goldenApple, 'hand');
            await bot.activateEntity(zombieVillager);

            console.log('[Trading] Curing zombie villager (takes 3-5 minutes)');
            return true;
        } catch (err) {
            console.log('[Trading] Failed to cure zombie villager:', err.message);
            return false;
        }
    }

    /**
     * Get trade value assessment
     */
    assessTradeValue(trade) {
        const valuableOutputs = {
            'diamond': 100, 'diamond_pickaxe': 95, 'diamond_sword': 94,
            'diamond_axe': 93, 'diamond_chestplate': 92, 'diamond_helmet': 91,
            'diamond_leggings': 90, 'diamond_boots': 89,
            'enchanted_book': 85, 'mending': 100,
            'iron_chestplate': 50, 'iron_helmet': 48,
            'bread': 10, 'emerald': 20
        };

        const outputValue = valuableOutputs[trade.outputItem?.name] || 1;
        const emeraldCost = trade.inputItem1?.name === 'emerald' ? trade.inputItem1.count : 0;

        // Value per emerald spent (higher is better)
        return emeraldCost > 0 ? outputValue / emeraldCost : 0;
    }

    /**
     * Find best trade from all nearby villagers
     */
    async findBestTrade(bot) {
        const villagers = Object.values(bot.entities).filter(entity =>
            entity.name === 'villager' &&
            entity.position &&
            entity.position.distanceTo(bot.entity.position) < 32
        );

        if (villagers.length === 0) {
            console.log('[Trading] No villagers nearby');
            return null;
        }

        let bestTrade = null;
        let bestValue = 0;
        let bestVillager = null;

        for (const villager of villagers) {
            try {
                // Go to villager
                const goal = new GoalNear(villager.position.x, villager.position.y, villager.position.z, 2);
                await bot.pathfinder.goto(goal);

                const tradingWindow = await bot.openVillager(villager);
                const trades = tradingWindow.trades;

                for (const trade of trades) {
                    const value = this.assessTradeValue(trade);
                    if (value > bestValue && !trade.disabled) {
                        bestValue = value;
                        bestTrade = trade;
                        bestVillager = villager;
                    }
                }

                tradingWindow.close();
                await this.utils.sleep(200);
            } catch (err) {
                // Skip this villager
            }
        }

        if (bestTrade) {
            console.log(`[Trading] Best trade: ${bestTrade.outputItem.name} (value: ${bestValue})`);
            return { trade: bestTrade, villager: bestVillager };
        }

        return null;
    }

    /**
     * Build simple trading hall (place 3 job sites)
     */
    async buildTradingHall(bot) {
        const jobSites = ['lectern', 'barrel', 'composter'];
        const items = bot.inventory.items();

        for (const jobSite of jobSites) {
            const item = items.find(i => i.name === jobSite);
            if (!item) {
                console.log(`[Trading] Missing ${jobSite} for trading hall`);
                continue;
            }

            try {
                // Place job site block
                await bot.equip(item, 'hand');
                const refBlock = bot.blockAt(bot.entity.position.offset(0, -1, 0));
                await bot.placeBlock(refBlock, new Vec3(1, 0, 0));
                await this.utils.sleep(500);
            } catch (err) {
                console.log(`[Trading] Failed to place ${jobSite}:`, err.message);
            }
        }

        console.log('[Trading] Trading hall structure placed');
        return true;
    }

    /**
     * Gather emeralds from inventory
     */
    getTotalEmeralds(bot) {
        const emeralds = bot.inventory.items().filter(item => item.name === 'emerald');
        return emeralds.reduce((sum, item) => sum + item.count, 0);
    }

    /**
     * Check if villager has restocked
     */
    async checkRestockStatus(bot, villager) {
        try {
            const tradingWindow = await bot.openVillager(villager);
            const hasRestocked = tradingWindow.trades.some(trade => !trade.disabled);
            tradingWindow.close();
            return hasRestocked;
        } catch (err) {
            return false;
        }
    }
}

module.exports = VillagerTradingActions;
