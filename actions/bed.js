/**
 * Bed & Sleep Actions (166-170)
 * Sleep management and time control
 */

const Vec3 = require('vec3');

class BedActions {
    constructor(actionSpace) {
        this.actionSpace = actionSpace;
    }

    /**
     * Sleep in bed (skip to day)
     */
    async sleepInBed(bot) {
        const bed = bot.findBlock({
            matching: block => block.name.includes('bed'),
            maxDistance: 16
        });

        if (!bed) {
            return;
        }

        // Check if it's night time
        const timeOfDay = bot.time.timeOfDay;
        const isNight = timeOfDay >= 12542 && timeOfDay <= 23459;

        if (!isNight) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(bed.position.x, bed.position.y, bed.position.z, 2), true);
        await this.actionSpace.sleep(1000);

        try {
            await bot.sleep(bed);
            await this.actionSpace.sleep(2000);
        } catch (err) {
            // Sleep failed (might not be night, bed occupied, or monsters nearby)
        }
    }

    /**
     * Wake from bed
     */
    async wakeFromBed(bot) {
        if (bot.isSleeping) {
            try {
                await bot.wake();
                await this.actionSpace.sleep(500);
            } catch (err) {
                // Wake failed
            }
        }
    }

    /**
     * Find nearest bed
     */
    async findBed(bot) {
        const bed = bot.findBlock({
            matching: block => block.name.includes('bed'),
            maxDistance: 32
        });

        if (!bed) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(bed.position.x, bed.position.y, bed.position.z, 3), true);
        await this.actionSpace.sleep(1000);
    }

    /**
     * Claim bed as spawn point
     */
    async claimBed(bot) {
        const bed = bot.findBlock({
            matching: block => block.name.includes('bed'),
            maxDistance: 8
        });

        if (!bed) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(bed.position.x, bed.position.y, bed.position.z, 2), true);
        await this.actionSpace.sleep(1000);

        // Check if it's night or we can sleep
        const timeOfDay = bot.time.timeOfDay;
        const isNight = timeOfDay >= 12542 && timeOfDay <= 23459;

        if (isNight) {
            try {
                await bot.sleep(bed);
                await this.actionSpace.sleep(1000);
                await bot.wake();
                await this.actionSpace.sleep(500);
            } catch (err) {
                // Claim failed
            }
        } else {
            // Just approach the bed to mark it as discovered
            try {
                await bot.activateBlock(bed);
                await this.actionSpace.sleep(300);
            } catch (err) {
                // Bed interaction failed
            }
        }
    }

    /**
     * Wait for night time
     */
    async waitForNight(bot) {
        const timeOfDay = bot.time.timeOfDay;
        const isDay = timeOfDay >= 0 && timeOfDay < 12542;

        if (!isDay) {
            return; // Already night
        }

        // Calculate time until night
        const timeUntilNight = 12542 - timeOfDay;
        const millisecondsToWait = Math.min((timeUntilNight / 20) * 50, 5000); // Convert ticks to ms, max 5s

        await this.actionSpace.sleep(millisecondsToWait);

        // Find safe spot to wait
        const { GoalBlock } = require('mineflayer-pathfinder').goals;
        const safePos = bot.entity.position.floored();

        // Look for shelter
        const shelter = bot.findBlock({
            matching: block =>
                block.name !== 'air' &&
                bot.blockAt(block.position.offset(0, 1, 0))?.name !== 'air' &&
                bot.blockAt(block.position.offset(0, 2, 0))?.name !== 'air',
            maxDistance: 16
        });

        if (shelter) {
            const { GoalNear } = require('mineflayer-pathfinder').goals;
            bot.pathfinder.setGoal(new GoalNear(shelter.position.x, shelter.position.y, shelter.position.z, 2), true);
            await this.actionSpace.sleep(1000);
        }
    }
}

module.exports = BedActions;
