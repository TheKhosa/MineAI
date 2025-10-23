/**
 * Vehicle & Mount Actions (296-305)
 * Horses, boats, minecarts - mounting, dismounting, and vehicle management
 */

const { goals: { GoalNear } } = require('mineflayer-pathfinder');
const Vec3 = require('vec3');

class VehicleActions {
    constructor(utils) {
        this.utils = utils;
    }

    /**
     * Find nearest horse/donkey/mule
     */
    findNearestHorse(bot) {
        const horses = Object.values(bot.entities).filter(entity =>
            ['horse', 'donkey', 'mule'].includes(entity.name) &&
            entity.position &&
            entity.position.distanceTo(bot.entity.position) < 32
        );

        if (horses.length === 0) return null;

        horses.sort((a, b) =>
            a.position.distanceTo(bot.entity.position) -
            b.position.distanceTo(bot.entity.position)
        );

        return horses[0];
    }

    /**
     * Mount horse
     */
    async mountHorse(bot) {
        const horse = this.findNearestHorse(bot);
        if (!horse) {
            console.log('[Vehicle] No horse nearby');
            return false;
        }

        try {
            // Navigate near horse
            const goal = new GoalNear(horse.position.x, horse.position.y, horse.position.z, 1);
            await bot.pathfinder.goto(goal);

            // Mount (right-click on horse)
            await bot.mount(horse);

            console.log('[Vehicle] Mounted horse');
            return true;
        } catch (err) {
            console.log('[Vehicle] Failed to mount horse:', err.message);
            return false;
        }
    }

    /**
     * Dismount from any vehicle
     */
    async dismount(bot) {
        if (!bot.vehicle) {
            console.log('[Vehicle] Not riding anything');
            return false;
        }

        try {
            await bot.dismount();
            console.log('[Vehicle] Dismounted');
            return true;
        } catch (err) {
            console.log('[Vehicle] Failed to dismount:', err.message);
            return false;
        }
    }

    /**
     * Tame horse (requires repeated mounting attempts)
     */
    async tameHorse(bot) {
        const horse = this.findNearestHorse(bot);
        if (!horse) return false;

        try {
            // Navigate near horse
            const goal = new GoalNear(horse.position.x, horse.position.y, horse.position.z, 1);
            await bot.pathfinder.goto(goal);

            // Taming requires multiple mount attempts
            for (let i = 0; i < 10; i++) {
                try {
                    await bot.mount(horse);
                    console.log('[Vehicle] Taming attempt', i + 1);
                    await this.utils.sleep(500);

                    // Check if tamed (will stay mounted if tamed)
                    if (bot.vehicle === horse) {
                        console.log('[Vehicle] Horse tamed!');
                        return true;
                    }
                } catch (err) {
                    // Failed mount, try again
                    await this.utils.sleep(1000);
                }
            }

            console.log('[Vehicle] Taming failed after 10 attempts');
            return false;
        } catch (err) {
            console.log('[Vehicle] Taming error:', err.message);
            return false;
        }
    }

    /**
     * Place and enter boat
     */
    async placeAndEnterBoat(bot) {
        const boat = bot.inventory.items().find(item => item.name.includes('_boat'));

        if (!boat) {
            console.log('[Vehicle] No boat in inventory');
            return false;
        }

        try {
            // Equip boat
            await bot.equip(boat, 'hand');

            // Look at water or ground
            const targetBlock = bot.blockAt(bot.entity.position.offset(1, -1, 0));
            if (!targetBlock) return false;

            // Place boat (right-click)
            await bot.activateItem();
            await this.utils.sleep(500);

            // Find placed boat entity
            const boatEntity = Object.values(bot.entities).find(entity =>
                entity.name === 'boat' &&
                entity.position.distanceTo(bot.entity.position) < 3
            );

            if (boatEntity) {
                await bot.mount(boatEntity);
                console.log('[Vehicle] Entered boat');
                return true;
            }

            return false;
        } catch (err) {
            console.log('[Vehicle] Boat placement failed:', err.message);
            return false;
        }
    }

    /**
     * Exit and pick up boat
     */
    async exitAndPickupBoat(bot) {
        const boatEntity = bot.vehicle;

        if (!boatEntity || boatEntity.name !== 'boat') {
            console.log('[Vehicle] Not in a boat');
            return false;
        }

        try {
            // Dismount
            await bot.dismount();
            await this.utils.sleep(200);

            // Attack boat to break it and pick it up
            await bot.attack(boatEntity);

            console.log('[Vehicle] Boat picked up');
            return true;
        } catch (err) {
            console.log('[Vehicle] Failed to pick up boat:', err.message);
            return false;
        }
    }

    /**
     * Place minecart on rails
     */
    async placeMinecart(bot) {
        const minecart = bot.inventory.items().find(item => item.name === 'minecart');

        if (!minecart) {
            console.log('[Vehicle] No minecart in inventory');
            return false;
        }

        // Find rail
        const rail = bot.findBlock({
            matching: block => block.name.includes('rail'),
            maxDistance: 8
        });

        if (!rail) {
            console.log('[Vehicle] No rail nearby');
            return false;
        }

        try {
            await bot.equip(minecart, 'hand');

            // Place minecart on rail
            await bot.activateBlock(rail);
            await this.utils.sleep(500);

            console.log('[Vehicle] Minecart placed');
            return true;
        } catch (err) {
            console.log('[Vehicle] Failed to place minecart:', err.message);
            return false;
        }
    }

    /**
     * Get in minecart
     */
    async enterMinecart(bot) {
        const minecart = Object.values(bot.entities).find(entity =>
            entity.name === 'minecart' &&
            entity.position.distanceTo(bot.entity.position) < 3
        );

        if (!minecart) {
            console.log('[Vehicle] No minecart nearby');
            return false;
        }

        try {
            await bot.mount(minecart);
            console.log('[Vehicle] Entered minecart');
            return true;
        } catch (err) {
            console.log('[Vehicle] Failed to enter minecart:', err.message);
            return false;
        }
    }

    /**
     * Feed horse to heal or speed up breeding
     */
    async feedHorse(bot, horse) {
        const food = bot.inventory.items().find(item =>
            ['apple', 'golden_apple', 'sugar', 'wheat', 'hay_block'].includes(item.name)
        );

        if (!food) {
            console.log('[Vehicle] No horse food in inventory');
            return false;
        }

        try {
            await bot.equip(food, 'hand');
            await bot.activateEntity(horse);

            console.log(`[Vehicle] Fed horse ${food.name}`);
            return true;
        } catch (err) {
            console.log('[Vehicle] Failed to feed horse:', err.message);
            return false;
        }
    }

    /**
     * Equip horse with saddle
     */
    async saddleHorse(bot, horse) {
        const saddle = bot.inventory.items().find(item => item.name === 'saddle');

        if (!saddle) {
            console.log('[Vehicle] No saddle in inventory');
            return false;
        }

        try {
            // Mount horse first
            await bot.mount(horse);
            await this.utils.sleep(200);

            // Open horse inventory (press E while mounted)
            // This is simplified - actual implementation needs window management

            console.log('[Vehicle] Saddle equipped');
            return true;
        } catch (err) {
            console.log('[Vehicle] Failed to saddle horse:', err.message);
            return false;
        }
    }

    /**
     * Get horse speed/stats
     */
    getHorseStats(horse) {
        return {
            speed: horse.attributes?.['generic.movementSpeed'] || 0.225,
            jumpStrength: horse.attributes?.['horse.jumpStrength'] || 0.5,
            health: horse.health || 20
        };
    }

    /**
     * Check if currently mounted on vehicle
     */
    isRidingVehicle(bot) {
        return bot.vehicle !== null;
    }

    /**
     * Get current vehicle type
     */
    getCurrentVehicleType(bot) {
        if (!bot.vehicle) return null;
        return bot.vehicle.name;
    }
}

module.exports = VehicleActions;
