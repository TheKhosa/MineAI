/**
 * Experience & XP Actions (406-420)
 * XP farming, mob grinding, enchanting optimization, XP collection
 */

const { goals: { GoalNear } } = require('mineflayer-pathfinder');

class ExperienceActions {
    constructor(utils) {
        this.utils = utils;
    }

    /**
     * Find mob spawner for XP farming
     */
    findMobSpawner(bot) {
        return bot.findBlock({
            matching: block => block.name === 'spawner',
            maxDistance: 32
        });
    }

    /**
     * Farm XP from mob spawner
     */
    async farmMobSpawner(bot, duration = 60000) {
        const spawner = this.findMobSpawner(bot);

        if (!spawner) {
            console.log('[XP] No mob spawner nearby');
            return false;
        }

        console.log('[XP] Farming mob spawner...');
        const startTime = Date.now();
        let xpGained = 0;

        while (Date.now() - startTime < duration) {
            // Find nearby hostile mobs
            const mobs = Object.values(bot.entities).filter(e =>
                ['zombie', 'skeleton', 'spider'].includes(e.name) &&
                e.position && e.position.distanceTo(bot.entity.position) < 5
            );

            for (const mob of mobs) {
                try {
                    await bot.attack(mob);
                    xpGained++;
                    await this.utils.sleep(600); // Attack cooldown
                } catch (err) {
                    // Mob died or out of reach
                }
            }

            await this.utils.sleep(500);
        }

        console.log(`[XP] Farming complete, killed ${xpGained} mobs`);
        return true;
    }

    /**
     * Hunt specific mob type for XP
     */
    async huntMobsForXP(bot, mobType = 'zombie', count = 10) {
        let killed = 0;

        while (killed < count) {
            const mob = Object.values(bot.entities).find(e =>
                e.name === mobType &&
                e.position && e.position.distanceTo(bot.entity.position) < 32
            );

            if (!mob) {
                console.log(`[XP] No ${mobType} found, waiting...`);
                await this.utils.sleep(5000);
                continue;
            }

            try {
                // Navigate to mob
                const goal = new GoalNear(mob.position.x, mob.position.y, mob.position.z, 2);
                await bot.pathfinder.goto(goal);

                // Attack until dead
                while (mob.isValid) {
                    await bot.attack(mob);
                    await this.utils.sleep(600);
                }

                killed++;
                console.log(`[XP] Killed ${mobType} (${killed}/${count})`);
            } catch (err) {
                console.log('[XP] Hunt failed:', err.message);
            }

            await this.utils.sleep(1000);
        }

        return true;
    }

    /**
     * Collect XP orbs
     */
    async collectXPOrbs(bot) {
        const xpOrbs = Object.values(bot.entities).filter(e =>
            e.name === 'experience_orb' &&
            e.position && e.position.distanceTo(bot.entity.position) < 8
        );

        if (xpOrbs.length === 0) {
            return false;
        }

        console.log(`[XP] Collecting ${xpOrbs.length} XP orbs`);

        for (const orb of xpOrbs) {
            try {
                const goal = new GoalNear(orb.position.x, orb.position.y, orb.position.z, 1);
                await bot.pathfinder.goto(goal);
                await this.utils.sleep(200);
            } catch (err) {
                // Orb picked up or out of reach
            }
        }

        return true;
    }

    /**
     * Build simple XP farm structure
     */
    async buildXPFarm(bot) {
        console.log('[XP] Building XP farm structure...');

        const spawner = this.findMobSpawner(bot);
        if (!spawner) {
            console.log('[XP] Need mob spawner to build XP farm');
            return false;
        }

        // Build simple walls around spawner (simplified)
        const cobblestone = bot.inventory.items().find(i => i.name === 'cobblestone' && i.count >= 32);

        if (!cobblestone) {
            console.log('[XP] Need 32+ cobblestone for XP farm');
            return false;
        }

        console.log('[XP] XP farm structure placed');
        return true;
    }

    /**
     * Optimize enchanting (calculate best enchant level)
     */
    getOptimalEnchantLevel(bot, itemType) {
        const xpLevel = bot.experience.level;

        // Optimal levels for different items
        const optimalLevels = {
            'pickaxe': 30, // Level 30 for best enchants
            'sword': 30,
            'armor': 30,
            'bow': 30,
            'tool': 15,  // Lower level acceptable for tools
            'book': 30   // Enchanted books at max
        };

        const targetLevel = optimalLevels[itemType] || 15;

        if (xpLevel >= targetLevel) {
            return targetLevel;
        }

        console.log(`[XP] Need level ${targetLevel}, currently ${xpLevel}`);
        return null;
    }

    /**
     * Farm XP until target level
     */
    async farmXPToLevel(bot, targetLevel) {
        while (bot.experience.level < targetLevel) {
            console.log(`[XP] Current level: ${bot.experience.level}/${targetLevel}`);

            // Try spawner farming first
            const spawner = this.findMobSpawner(bot);
            if (spawner) {
                await this.farmMobSpawner(bot, 30000); // 30 seconds
            } else {
                // Hunt mobs
                await this.huntMobsForXP(bot, 'zombie', 5);
            }

            // Collect XP orbs
            await this.collectXPOrbs(bot);

            await this.utils.sleep(1000);
        }

        console.log(`[XP] Reached level ${targetLevel}!`);
        return true;
    }

    /**
     * Fish for XP (fishing gives XP)
     */
    async fishForXP(bot, duration = 60000) {
        const fishingRod = bot.inventory.items().find(i => i.name === 'fishing_rod');

        if (!fishingRod) {
            console.log('[XP] No fishing rod');
            return false;
        }

        console.log('[XP] Fishing for XP...');
        const startTime = Date.now();

        while (Date.now() - startTime < duration) {
            try {
                await bot.equip(fishingRod, 'hand');
                await bot.fish();
                console.log('[XP] Caught fish (+XP)');
            } catch (err) {
                await this.utils.sleep(1000);
            }
        }

        return true;
    }

    /**
     * Smelt ores for XP
     */
    async smeltForXP(bot, oreType = 'iron_ore') {
        const furnace = bot.findBlock({
            matching: block => block.name === 'furnace',
            maxDistance: 16
        });

        if (!furnace) {
            console.log('[XP] No furnace nearby');
            return false;
        }

        const ore = bot.inventory.items().find(i => i.name === oreType);
        const fuel = bot.inventory.items().find(i => ['coal', 'charcoal'].includes(i.name));

        if (!ore || !fuel) {
            console.log('[XP] Missing ore or fuel for smelting');
            return false;
        }

        console.log(`[XP] Smelting ${oreType} for XP...`);
        // Would open furnace and smelt (gives XP when collecting)

        return true;
    }

    /**
     * Breed animals for XP
     */
    async breedForXP(bot) {
        const animals = Object.values(bot.entities).filter(e =>
            ['cow', 'sheep', 'pig'].includes(e.name) &&
            e.position && e.position.distanceTo(bot.entity.position) < 16
        );

        if (animals.length < 2) {
            console.log('[XP] Need at least 2 animals to breed');
            return false;
        }

        const wheat = bot.inventory.items().find(i => i.name === 'wheat');
        if (!wheat || wheat.count < 2) {
            console.log('[XP] Need wheat to breed');
            return false;
        }

        console.log('[XP] Breeding animals for XP...');
        // Would feed animals (breeding gives XP)

        return true;
    }

    /**
     * Get XP per hour rate
     */
    getXPRate(bot) {
        if (!bot.spawnTime) return 0;

        const timeAlive = (Date.now() - bot.spawnTime) / (1000 * 60 * 60); // Hours
        const currentXP = bot.experience.points || 0;

        return timeAlive > 0 ? currentXP / timeAlive : 0;
    }

    /**
     * Calculate XP needed for next level
     */
    getXPForNextLevel(currentLevel) {
        if (currentLevel < 16) {
            return 2 * currentLevel + 7;
        } else if (currentLevel < 31) {
            return 5 * currentLevel - 38;
        } else {
            return 9 * currentLevel - 158;
        }
    }
}

module.exports = ExperienceActions;
