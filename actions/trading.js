/**
 * Trading Actions (133-140)
 * Villager trading and village management
 */

const Vec3 = require('vec3');

class TradingActions {
    constructor(utils) {
        this.utils = utils;
    }

    /**
     * Find nearest villager
     */
    async findVillager(bot) {
        const villagers = Object.values(bot.entities).filter(entity =>
            entity.type === 'mob' &&
            entity.name &&
            (entity.name === 'villager' || entity.displayName === 'Villager') &&
            entity.position &&
            entity.position.distanceTo(bot.entity.position) < 32
        );

        if (villagers.length === 0) {
            return;
        }

        const nearestVillager = villagers.sort((a, b) =>
            a.position.distanceTo(bot.entity.position) - b.position.distanceTo(bot.entity.position)
        )[0];

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(nearestVillager.position.x, nearestVillager.position.y, nearestVillager.position.z, 2), true);
        await this.utils.sleep(1000);
    }

    /**
     * Open villager trade window
     */
    async openVillagerTrade(bot) {
        const villagers = Object.values(bot.entities).filter(entity =>
            entity.type === 'mob' &&
            entity.name &&
            (entity.name === 'villager' || entity.displayName === 'Villager') &&
            entity.position &&
            entity.position.distanceTo(bot.entity.position) < 4
        );

        if (villagers.length === 0) {
            return;
        }

        const villager = villagers[0];

        try {
            const tradeWindow = await bot.openVillager(villager);
            await this.utils.sleep(500);
            tradeWindow.close();
        } catch (err) {
            // Failed to open trade window
        }
    }

    /**
     * Execute trade with villager
     */
    async executeTrade(bot) {
        const villagers = Object.values(bot.entities).filter(entity =>
            entity.type === 'mob' &&
            entity.name &&
            (entity.name === 'villager' || entity.displayName === 'Villager') &&
            entity.position &&
            entity.position.distanceTo(bot.entity.position) < 4
        );

        if (villagers.length === 0) {
            return;
        }

        const villager = villagers[0];

        try {
            const tradeWindow = await bot.openVillager(villager);
            await this.utils.sleep(300);

            // Find first available trade
            if (tradeWindow.trades && tradeWindow.trades.length > 0) {
                const trade = tradeWindow.trades[0];

                // Check if we have required items
                const hasInputA = trade.inputItem1 ? bot.inventory.items().find(item => item.type === trade.inputItem1.type) : null;
                const hasInputB = trade.inputItem2 ? bot.inventory.items().find(item => item.type === trade.inputItem2.type) : null;

                if (hasInputA && (!trade.inputItem2 || hasInputB)) {
                    await tradeWindow.trade(0, 1);
                    await this.utils.sleep(500);
                }
            }

            tradeWindow.close();
        } catch (err) {
            // Trade failed
        }
    }

    /**
     * Find best trade among villagers
     */
    async findBestTrade(bot) {
        const villagers = Object.values(bot.entities).filter(entity =>
            entity.type === 'mob' &&
            entity.name &&
            (entity.name === 'villager' || entity.displayName === 'Villager') &&
            entity.position &&
            entity.position.distanceTo(bot.entity.position) < 32
        );

        if (villagers.length === 0) {
            return;
        }

        // Check each villager for valuable trades
        for (const villager of villagers.slice(0, 3)) {
            const { GoalNear } = require('mineflayer-pathfinder').goals;
            bot.pathfinder.setGoal(new GoalNear(villager.position.x, villager.position.y, villager.position.z, 2), true);
            await this.utils.sleep(800);

            try {
                const tradeWindow = await bot.openVillager(villager);
                await this.utils.sleep(300);

                // Look for valuable trades (diamond gear, enchanted books, etc.)
                if (tradeWindow.trades && tradeWindow.trades.length > 0) {
                    const valuableTrade = tradeWindow.trades.find(trade =>
                        trade.outputItem && (
                            trade.outputItem.name.includes('diamond') ||
                            trade.outputItem.name.includes('enchanted') ||
                            trade.outputItem.name === 'mending'
                        )
                    );

                    if (valuableTrade) {
                        // Found valuable trade
                        tradeWindow.close();
                        return;
                    }
                }

                tradeWindow.close();
            } catch (err) {
                // Failed to check villager
            }
        }
    }

    /**
     * Cure zombie villager
     */
    async cureZombieVillager(bot) {
        const zombieVillagers = Object.values(bot.entities).filter(entity =>
            entity.type === 'mob' &&
            entity.name &&
            (entity.name === 'zombie_villager' || entity.displayName === 'Zombie Villager') &&
            entity.position &&
            entity.position.distanceTo(bot.entity.position) < 16
        );

        if (zombieVillagers.length === 0) {
            return;
        }

        const goldenApple = bot.inventory.items().find(item => item.name === 'golden_apple');
        const splashPotion = bot.inventory.items().find(item =>
            item.name === 'splash_potion' && item.displayName && item.displayName.includes('Weakness')
        );

        if (!goldenApple || !splashPotion) {
            return;
        }

        const zombieVillager = zombieVillagers[0];

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(zombieVillager.position.x, zombieVillager.position.y, zombieVillager.position.z, 4), true);
        await this.utils.sleep(1000);

        try {
            // Throw splash potion
            await bot.equip(splashPotion, 'hand');
            await this.utils.sleep(200);
            await bot.activateItem();
            await this.utils.sleep(1000);

            // Use golden apple on zombie villager
            await bot.equip(goldenApple, 'hand');
            await this.utils.sleep(200);
            await bot.activateEntity(zombieVillager);
            await this.utils.sleep(500);
        } catch (err) {
            // Curing failed
        }
    }

    /**
     * Protect villager from threats
     */
    async protectVillager(bot) {
        const villagers = Object.values(bot.entities).filter(entity =>
            entity.type === 'mob' &&
            entity.name &&
            (entity.name === 'villager' || entity.displayName === 'Villager') &&
            entity.position &&
            entity.position.distanceTo(bot.entity.position) < 16
        );

        if (villagers.length === 0) {
            return;
        }

        const nearestVillager = villagers[0];

        // Find threats near villager
        const threats = Object.values(bot.entities).filter(entity =>
            entity.type === 'mob' &&
            entity.name &&
            (entity.name === 'zombie' || entity.name === 'skeleton' ||
             entity.name === 'creeper' || entity.name === 'spider') &&
            entity.position &&
            entity.position.distanceTo(nearestVillager.position) < 8
        );

        if (threats.length === 0) {
            return;
        }

        const threat = threats[0];

        // Move between villager and threat
        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(threat.position.x, threat.position.y, threat.position.z, 2), true);
        await this.utils.sleep(500);

        // Equip weapon
        const weapon = bot.inventory.items().find(item =>
            item.name.includes('sword') || item.name.includes('axe')
        );
        if (weapon) {
            await bot.equip(weapon, 'hand');
            await this.utils.sleep(100);
        }

        // Attack threat
        try {
            await bot.attack(threat);
            await this.utils.sleep(500);
        } catch (err) {
            // Attack failed
        }
    }

    /**
     * Create trading hall infrastructure
     */
    async createTradingHall(bot) {
        const villagers = Object.values(bot.entities).filter(entity =>
            entity.type === 'mob' &&
            entity.name &&
            (entity.name === 'villager' || entity.displayName === 'Villager') &&
            entity.position &&
            entity.position.distanceTo(bot.entity.position) < 32
        );

        if (villagers.length === 0) {
            return;
        }

        const cobblestone = bot.inventory.items().find(item => item.name === 'cobblestone');
        const glass = bot.inventory.items().find(item => item.name === 'glass');

        if (!cobblestone || cobblestone.count < 16) {
            return;
        }

        const villager = villagers[0];
        const basePos = villager.position.floored();

        // Build simple enclosure
        const buildPositions = [
            basePos.offset(-1, 0, -1),
            basePos.offset(1, 0, -1),
            basePos.offset(-1, 0, 1),
            basePos.offset(1, 0, 1),
            basePos.offset(-1, 1, -1),
            basePos.offset(1, 1, -1),
            basePos.offset(-1, 1, 1),
            basePos.offset(1, 1, 1)
        ];

        await bot.equip(cobblestone, 'hand');

        for (const pos of buildPositions) {
            if (cobblestone.count === 0) break;

            const block = bot.blockAt(pos);
            if (block && block.name === 'air') {
                const referenceBlock = bot.blockAt(pos.offset(0, -1, 0));
                if (referenceBlock && referenceBlock.name !== 'air') {
                    try {
                        await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
                        await this.utils.sleep(300);
                    } catch (err) {
                        // Placement failed
                    }
                }
            }
        }
    }

    /**
     * Gather emeralds for trading
     */
    async gatherEmeralds(bot) {
        const emeraldOre = bot.findBlock({
            matching: block => block.name === 'emerald_ore' || block.name === 'deepslate_emerald_ore',
            maxDistance: 32
        });

        if (!emeraldOre) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(emeraldOre.position.x, emeraldOre.position.y, emeraldOre.position.z, 3), true);
        await this.utils.sleep(1000);

        const pickaxe = bot.inventory.items().find(item =>
            item.name.includes('pickaxe') && (item.name.includes('iron') || item.name.includes('diamond'))
        );

        if (pickaxe) {
            await bot.equip(pickaxe, 'hand');
            await this.utils.sleep(100);
        }

        try {
            await bot.dig(emeraldOre);
            await this.utils.sleep(500);
        } catch (err) {
            // Mining failed
        }
    }
}

module.exports = TradingActions;
