/**
 * Flight & Elytra Actions (321-330)
 * Elytra gliding, firework boosting, creative flight, fall damage prevention
 */

const Vec3 = require('vec3');

class FlightActions {
    constructor(utils) {
        this.utils = utils;
    }

    /**
     * Equip elytra
     */
    async equipElytra(bot) {
        const elytra = bot.inventory.items().find(item => item.name === 'elytra');

        if (!elytra) {
            console.log('[Flight] No elytra in inventory');
            return false;
        }

        try {
            await bot.equip(elytra, 'torso');
            console.log('[Flight] Elytra equipped');
            return true;
        } catch (err) {
            console.log('[Flight] Failed to equip elytra:', err.message);
            return false;
        }
    }

    /**
     * Start elytra gliding (jump + activate while falling)
     */
    async startGliding(bot) {
        // Check if elytra is equipped
        const chestSlot = bot.inventory.slots[6]; // Chest armor slot
        if (!chestSlot || chestSlot.name !== 'elytra') {
            console.log('[Flight] Elytra not equipped');
            return false;
        }

        try {
            // Jump to get airborne
            bot.setControlState('jump', true);
            await this.utils.sleep(100);
            bot.setControlState('jump', false);

            // Wait to start falling
            await this.utils.sleep(200);

            // Activate elytra (jump again while falling)
            bot.setControlState('jump', true);
            await this.utils.sleep(50);
            bot.setControlState('jump', false);

            console.log('[Flight] Gliding started');
            return true;
        } catch (err) {
            bot.setControlState('jump', false);
            console.log('[Flight] Failed to start gliding:', err.message);
            return false;
        }
    }

    /**
     * Boost with firework rocket while gliding
     */
    async fireworkBoost(bot) {
        const firework = bot.inventory.items().find(item => item.name === 'firework_rocket');

        if (!firework) {
            console.log('[Flight] No firework rockets');
            return false;
        }

        // Check if currently gliding
        if (!bot.entity.elytraFlying) {
            console.log('[Flight] Not gliding - cannot boost');
            return false;
        }

        try {
            await bot.equip(firework, 'hand');
            await bot.activateItem(); // Use firework

            console.log('[Flight] Firework boost activated!');
            return true;
        } catch (err) {
            console.log('[Flight] Boost failed:', err.message);
            return false;
        }
    }

    /**
     * Glide toward target position
     */
    async glideTowards(bot, targetPos, duration = 5000) {
        if (!bot.entity.elytraFlying) {
            console.log('[Flight] Not gliding');
            return false;
        }

        const startTime = Date.now();

        while (Date.now() - startTime < duration) {
            // Look toward target
            await bot.lookAt(targetPos);

            // Move forward
            bot.setControlState('forward', true);

            // Check if close enough
            if (bot.entity.position.distanceTo(targetPos) < 5) {
                bot.setControlState('forward', false);
                console.log('[Flight] Reached target');
                return true;
            }

            await this.utils.sleep(50);
        }

        bot.setControlState('forward', false);
        console.log('[Flight] Glide duration complete');
        return false;
    }

    /**
     * Emergency landing (look down and land)
     */
    async emergencyLand(bot) {
        try {
            // Look down steeply
            bot.entity.pitch = Math.PI / 3; // 60 degrees down

            // Wait to descend
            await this.utils.sleep(2000);

            // Level out before hitting ground
            bot.entity.pitch = 0;

            // Wait for landing
            while (!bot.entity.onGround && bot.entity.position.y > 5) {
                await this.utils.sleep(100);
            }

            console.log('[Flight] Emergency landing complete');
            return true;
        } catch (err) {
            console.log('[Flight] Landing failed:', err.message);
            return false;
        }
    }

    /**
     * MLG water bucket (prevent fall damage)
     */
    async mlgWaterBucket(bot) {
        const waterBucket = bot.inventory.items().find(item => item.name === 'water_bucket');

        if (!waterBucket) {
            console.log('[Flight] No water bucket for MLG');
            return false;
        }

        try {
            // Look straight down
            await bot.look(bot.entity.yaw, Math.PI / 2); // 90 degrees down

            // Place water just before impact
            await bot.equip(waterBucket, 'hand');
            await this.utils.sleep(100);

            // Place water
            await bot.activateItem();

            console.log('[Flight] MLG water placed!');

            // Wait for landing in water
            await this.utils.sleep(1000);

            // Pick up water
            const block = bot.blockAtCursor(5);
            if (block && block.name === 'water') {
                const bucket = bot.inventory.items().find(item => item.name === 'bucket');
                if (bucket) {
                    await bot.equip(bucket, 'hand');
                    await bot.activateBlock(block);
                }
            }

            return true;
        } catch (err) {
            console.log('[Flight] MLG failed:', err.message);
            return false;
        }
    }

    /**
     * Check elytra durability
     */
    getElytraDurability(bot) {
        const chestSlot = bot.inventory.slots[6]; // Chest armor slot

        if (!chestSlot || chestSlot.name !== 'elytra' || !chestSlot.maxDurability) {
            return 0;
        }

        const currentDurability = chestSlot.maxDurability - (chestSlot.durabilityUsed || 0);
        return currentDurability / chestSlot.maxDurability;
    }

    /**
     * Check if elytra needs repair
     */
    needsRepair(bot) {
        return this.getElytraDurability(bot) < 0.2;
    }

    /**
     * Check if currently gliding
     */
    isGliding(bot) {
        return bot.entity.elytraFlying || false;
    }

    /**
     * Get flight speed
     */
    getFlightSpeed(bot) {
        const velocity = bot.entity.velocity;
        return Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
    }

    /**
     * Get vertical speed (positive = rising, negative = falling)
     */
    getVerticalSpeed(bot) {
        return bot.entity.velocity.y;
    }

    /**
     * Steer left while gliding
     */
    async steerLeft(bot) {
        bot.setControlState('left', true);
        await this.utils.sleep(200);
        bot.setControlState('left', false);
        return true;
    }

    /**
     * Steer right while gliding
     */
    async steerRight(bot) {
        bot.setControlState('right', true);
        await this.utils.sleep(200);
        bot.setControlState('right', false);
        return true;
    }

    /**
     * Ascend (look up while gliding, requires speed)
     */
    async ascend(bot) {
        if (!bot.entity.elytraFlying) return false;

        // Look up
        bot.entity.pitch = -Math.PI / 6; // 30 degrees up

        await this.utils.sleep(1000);
        return true;
    }

    /**
     * Descend (look down while gliding)
     */
    async descend(bot) {
        if (!bot.entity.elytraFlying) return false;

        // Look down
        bot.entity.pitch = Math.PI / 6; // 30 degrees down

        await this.utils.sleep(1000);
        return true;
    }

    /**
     * Calculate distance can glide (based on height and speed)
     */
    estimateGlideDistance(bot) {
        const height = bot.entity.position.y;
        const speed = this.getFlightSpeed(bot);

        // Simplified: 1 block height = ~8 blocks horizontal distance
        const glideRatio = 8;
        return height * glideRatio * (1 + speed / 10);
    }
}

module.exports = FlightActions;
