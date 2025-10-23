/**
 * Spawn & Death Management Actions (306-315)
 * Bed placement, spawn point setting, death recovery, home navigation
 */

const { goals: { GoalNear, GoalBlock } } = require('mineflayer-pathfinder');
const Vec3 = require('vec3');

class SpawnManagementActions {
    constructor(utils) {
        this.utils = utils;
    }

    /**
     * Place bed and set spawn point
     */
    async placeBedAndSetSpawn(bot) {
        const bed = bot.inventory.items().find(item => item.name.includes('_bed'));

        if (!bed) {
            console.log('[Spawn] No bed in inventory');
            return false;
        }

        try {
            // Find suitable location (flat ground, no obstructions)
            const placePos = bot.entity.position.offset(1, 0, 0).floored();
            const referenceBlock = bot.blockAt(placePos.offset(0, -1, 0));

            if (!referenceBlock || referenceBlock.name === 'air') {
                console.log('[Spawn] No suitable ground for bed');
                return false;
            }

            // Equip and place bed
            await bot.equip(bed, 'hand');
            await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));

            console.log('[Spawn] Bed placed');
            await this.utils.sleep(500);

            // Sleep in bed to set spawn (only works at night)
            const bedBlock = bot.findBlock({
                matching: block => block.name.includes('_bed'),
                maxDistance: 3
            });

            if (bedBlock) {
                try {
                    await bot.sleep(bedBlock);
                    console.log('[Spawn] Spawn point set!');
                    return true;
                } catch (err) {
                    console.log('[Spawn] Cannot sleep now (must be night or thunderstorm)');
                    return true; // Bed placed successfully even if can't sleep
                }
            }

            return false;
        } catch (err) {
            console.log('[Spawn] Failed to place bed:', err.message);
            return false;
        }
    }

    /**
     * Sleep in nearby bed
     */
    async sleepInBed(bot) {
        const bed = bot.findBlock({
            matching: block => block.name.includes('_bed'),
            maxDistance: 16
        });

        if (!bed) {
            console.log('[Spawn] No bed nearby');
            return false;
        }

        try {
            // Navigate to bed
            const goal = new GoalBlock(bed.position.x, bed.position.y, bed.position.z);
            await bot.pathfinder.goto(goal);

            // Sleep
            await bot.sleep(bed);
            console.log('[Spawn] Sleeping... (sets spawn point)');

            // Wait until morning or interrupted
            await this.utils.sleep(5000);

            return true;
        } catch (err) {
            console.log('[Spawn] Failed to sleep:', err.message);
            return false;
        }
    }

    /**
     * Wake up from bed
     */
    async wakeUp(bot) {
        try {
            await bot.wake();
            console.log('[Spawn] Woke up');
            return true;
        } catch (err) {
            console.log('[Spawn] Not sleeping');
            return false;
        }
    }

    /**
     * Navigate to spawn point / bed
     */
    async goToSpawnPoint(bot) {
        const spawnPoint = bot.spawnPoint;

        if (!spawnPoint) {
            console.log('[Spawn] No spawn point set (defaulting to world spawn 0,0)');
            // Default to world spawn
            spawnPoint = new Vec3(0, bot.entity.position.y, 0);
        }

        try {
            const goal = new GoalNear(spawnPoint.x, spawnPoint.y, spawnPoint.z, 5);
            console.log(`[Spawn] Navigating to spawn point at ${spawnPoint}`);
            await bot.pathfinder.goto(goal);

            console.log('[Spawn] Reached spawn point');
            return true;
        } catch (err) {
            console.log('[Spawn] Failed to reach spawn:', err.message);
            return false;
        }
    }

    /**
     * Navigate to last death location to recover items
     */
    async recoverDeathItems(bot) {
        if (!bot.lastDeathPosition) {
            console.log('[Spawn] No death location recorded');
            return false;
        }

        const deathPos = bot.lastDeathPosition;
        const timeSinceDeath = Date.now() - (bot.lastDeathTime || 0);

        // Items despawn after 5 minutes (300000ms)
        if (timeSinceDeath > 300000) {
            console.log('[Spawn] Items likely despawned (>5 min since death)');
            return false;
        }

        try {
            const goal = new GoalNear(deathPos.x, deathPos.y, deathPos.z, 3);
            console.log(`[Spawn] Navigating to death location at ${deathPos}`);
            await bot.pathfinder.goto(goal);

            console.log('[Spawn] Reached death location - collect items!');

            // Pick up nearby items
            await this.utils.sleep(1000);

            const nearbyItems = Object.values(bot.entities).filter(entity =>
                entity.name === 'item' &&
                entity.position.distanceTo(bot.entity.position) < 3
            );

            console.log(`[Spawn] Found ${nearbyItems.length} items to collect`);
            return true;
        } catch (err) {
            console.log('[Spawn] Failed to reach death location:', err.message);
            return false;
        }
    }

    /**
     * Mark current location as home
     */
    markHomeLocation(bot) {
        bot.homeLocation = bot.entity.position.clone();
        console.log(`[Spawn] Home marked at ${bot.homeLocation}`);
        return true;
    }

    /**
     * Navigate to marked home location
     */
    async goToHome(bot) {
        if (!bot.homeLocation) {
            console.log('[Spawn] No home location set');
            return false;
        }

        try {
            const goal = new GoalNear(bot.homeLocation.x, bot.homeLocation.y, bot.homeLocation.z, 3);
            console.log(`[Spawn] Navigating home to ${bot.homeLocation}`);
            await bot.pathfinder.goto(goal);

            console.log('[Spawn] Arrived home');
            return true;
        } catch (err) {
            console.log('[Spawn] Failed to reach home:', err.message);
            return false;
        }
    }

    /**
     * Build emergency shelter (4x4 cobblestone box with bed)
     */
    async buildEmergencyShelter(bot) {
        const cobblestone = bot.inventory.items().find(item =>
            item.name === 'cobblestone' && item.count >= 20
        );

        const bed = bot.inventory.items().find(item => item.name.includes('_bed'));

        if (!cobblestone) {
            console.log('[Spawn] Need 20+ cobblestone for shelter');
            return false;
        }

        try {
            await bot.equip(cobblestone, 'hand');

            const basePos = bot.entity.position.offset(2, 0, 0).floored();

            // Build walls (simplified 4x4)
            const wallPositions = [
                // Front wall
                basePos.offset(0, 0, 0), basePos.offset(1, 0, 0), basePos.offset(2, 0, 0), basePos.offset(3, 0, 0),
                basePos.offset(0, 1, 0), basePos.offset(1, 1, 0), basePos.offset(2, 1, 0), basePos.offset(3, 1, 0),
                // Back wall
                basePos.offset(0, 0, 3), basePos.offset(1, 0, 3), basePos.offset(2, 0, 3), basePos.offset(3, 0, 3),
                basePos.offset(0, 1, 3), basePos.offset(1, 1, 3), basePos.offset(2, 1, 3), basePos.offset(3, 1, 3),
            ];

            for (const pos of wallPositions) {
                const refBlock = bot.blockAt(pos.offset(0, -1, 0));
                if (refBlock && refBlock.name !== 'air') {
                    try {
                        await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
                        await this.utils.sleep(100);
                    } catch (err) {
                        // Skip if placement fails
                    }
                }
            }

            // Place bed inside if available
            if (bed) {
                await bot.equip(bed, 'hand');
                const bedPos = basePos.offset(1, 0, 1);
                const bedRef = bot.blockAt(bedPos.offset(0, -1, 0));
                await bot.placeBlock(bedRef, new Vec3(0, 1, 0));
            }

            console.log('[Spawn] Emergency shelter built');
            return true;
        } catch (err) {
            console.log('[Spawn] Shelter construction failed:', err.message);
            return false;
        }
    }

    /**
     * Check distance to spawn point
     */
    getDistanceToSpawn(bot) {
        const spawnPoint = bot.spawnPoint || new Vec3(0, bot.entity.position.y, 0);
        return bot.entity.position.distanceTo(spawnPoint);
    }

    /**
     * Check if close to death location
     */
    isNearDeathLocation(bot) {
        if (!bot.lastDeathPosition) return false;

        const dist = bot.entity.position.distanceTo(bot.lastDeathPosition);
        return dist < 10;
    }

    /**
     * Record death event (to be called on 'death' event)
     */
    recordDeath(bot) {
        bot.lastDeathPosition = bot.entity.position.clone();
        bot.lastDeathTime = Date.now();
        console.log(`[Spawn] Death recorded at ${bot.lastDeathPosition}`);
    }
}

module.exports = SpawnManagementActions;
