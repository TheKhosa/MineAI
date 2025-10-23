/**
 * Combat Timing Actions (241-250)
 * Attack cooldown management, blocking, and advanced combat mechanics
 */

const Vec3 = require('vec3');

class CombatTimingActions {
    constructor(utils) {
        this.utils = utils;
        this.lastAttackTime = 0;
        this.attackCooldown = 600; // 0.6 seconds for swords (1.6+ combat)
    }

    /**
     * Attack with cooldown awareness (1.6+ combat system)
     */
    async attackWithCooldown(bot, entity) {
        const now = Date.now();
        const timeSinceLastAttack = now - this.lastAttackTime;

        if (timeSinceLastAttack < this.attackCooldown) {
            // Cooldown not ready, wait
            const waitTime = this.attackCooldown - timeSinceLastAttack;
            await this.utils.sleep(waitTime);
        }

        try {
            await bot.attack(entity);
            this.lastAttackTime = Date.now();
            return true;
        } catch (err) {
            console.log('[Combat] Attack failed:', err.message);
            return false;
        }
    }

    /**
     * Critical hit attack (jump + attack at peak)
     */
    async criticalHitAttack(bot, entity) {
        try {
            // Jump
            bot.setControlState('jump', true);
            await this.utils.sleep(200); // Wait to reach peak

            // Attack at peak of jump
            await this.attackWithCooldown(bot, entity);

            bot.setControlState('jump', false);
            await this.utils.sleep(200); // Landing delay

            console.log('[Combat] Critical hit executed!');
            return true;
        } catch (err) {
            bot.setControlState('jump', false);
            console.log('[Combat] Critical hit failed:', err.message);
            return false;
        }
    }

    /**
     * Shield block (activate and hold)
     */
    async activateShield(bot) {
        const shield = bot.inventory.slots[45]; // Offhand slot
        if (!shield || shield.name !== 'shield') {
            console.log('[Combat] No shield equipped in offhand');
            return false;
        }

        try {
            // Activate shield (right-click hold)
            bot.activateItem(); // Starts blocking
            console.log('[Combat] Shield raised');
            return true;
        } catch (err) {
            console.log('[Combat] Failed to raise shield:', err.message);
            return false;
        }
    }

    /**
     * Deactivate shield
     */
    async deactivateShield(bot) {
        try {
            bot.deactivateItem();
            console.log('[Combat] Shield lowered');
            return true;
        } catch (err) {
            console.log('[Combat] Failed to lower shield:', err.message);
            return false;
        }
    }

    /**
     * Block and counterattack combo
     */
    async blockAndCounter(bot, entity) {
        try {
            // Raise shield
            await this.activateShield(bot);
            await this.utils.sleep(500); // Block for 0.5s

            // Lower shield and immediately counter
            await this.deactivateShield(bot);
            await this.attackWithCooldown(bot, entity);

            console.log('[Combat] Block-counter executed');
            return true;
        } catch (err) {
            await this.deactivateShield(bot);
            console.log('[Combat] Block-counter failed:', err.message);
            return false;
        }
    }

    /**
     * Strafe left while attacking
     */
    async strafeLeftAttack(bot, entity) {
        try {
            bot.setControlState('left', true);
            await this.utils.sleep(100);

            await this.attackWithCooldown(bot, entity);

            bot.setControlState('left', false);
            return true;
        } catch (err) {
            bot.setControlState('left', false);
            console.log('[Combat] Strafe-left attack failed:', err.message);
            return false;
        }
    }

    /**
     * Strafe right while attacking
     */
    async strafeRightAttack(bot, entity) {
        try {
            bot.setControlState('right', true);
            await this.utils.sleep(100);

            await this.attackWithCooldown(bot, entity);

            bot.setControlState('right', false);
            return true;
        } catch (err) {
            bot.setControlState('right', false);
            console.log('[Combat] Strafe-right attack failed:', err.message);
            return false;
        }
    }

    /**
     * Combo attack (3-hit sequence)
     */
    async comboAttack(bot, entity) {
        try {
            // Hit 1: Direct
            await this.attackWithCooldown(bot, entity);

            // Hit 2: Strafe left
            bot.setControlState('left', true);
            await this.utils.sleep(100);
            await this.attackWithCooldown(bot, entity);
            bot.setControlState('left', false);

            // Hit 3: Critical
            await this.criticalHitAttack(bot, entity);

            console.log('[Combat] 3-hit combo executed!');
            return true;
        } catch (err) {
            bot.setControlState('left', false);
            console.log('[Combat] Combo failed:', err.message);
            return false;
        }
    }

    /**
     * Kiting (hit and retreat)
     */
    async kiteAttack(bot, entity) {
        try {
            // Attack
            await this.attackWithCooldown(bot, entity);

            // Retreat backward
            bot.setControlState('back', true);
            await this.utils.sleep(500);
            bot.setControlState('back', false);

            console.log('[Combat] Kite maneuver executed');
            return true;
        } catch (err) {
            bot.setControlState('back', false);
            console.log('[Combat] Kite failed:', err.message);
            return false;
        }
    }

    /**
     * Circle strafe around target
     */
    async circleStrafe(bot, entity) {
        try {
            const strafeTime = 1000; // 1 second circle
            const attackInterval = 600; // Attack every 0.6s

            const startTime = Date.now();
            let lastAttack = 0;

            while (Date.now() - startTime < strafeTime) {
                // Strafe right
                bot.setControlState('right', true);
                bot.setControlState('forward', true);

                // Look at entity while strafing
                await bot.lookAt(entity.position.offset(0, entity.height * 0.5, 0));

                // Attack if cooldown ready
                if (Date.now() - lastAttack >= attackInterval) {
                    await bot.attack(entity);
                    lastAttack = Date.now();
                    this.lastAttackTime = lastAttack;
                }

                await this.utils.sleep(50);
            }

            bot.setControlState('right', false);
            bot.setControlState('forward', false);

            console.log('[Combat] Circle strafe completed');
            return true;
        } catch (err) {
            bot.setControlState('right', false);
            bot.setControlState('forward', false);
            console.log('[Combat] Circle strafe failed:', err.message);
            return false;
        }
    }

    /**
     * Backstab (attack from behind)
     */
    async backstabAttack(bot, entity) {
        try {
            // Get position behind entity
            const entityDir = entity.yaw;
            const behindPos = entity.position.offset(
                -Math.sin(entityDir) * 2,
                0,
                Math.cos(entityDir) * 2
            );

            // Move behind (simplified - real implementation needs pathfinding)
            const distToBehind = bot.entity.position.distanceTo(behindPos);
            if (distToBehind > 1.5) {
                console.log('[Combat] Too far for backstab');
                return false;
            }

            // Critical backstab
            await this.criticalHitAttack(bot, entity);
            console.log('[Combat] Backstab executed!');
            return true;
        } catch (err) {
            console.log('[Combat] Backstab failed:', err.message);
            return false;
        }
    }

    /**
     * Get attack cooldown progress (0-1)
     */
    getAttackCooldownProgress() {
        const timeSinceAttack = Date.now() - this.lastAttackTime;
        return Math.min(timeSinceAttack / this.attackCooldown, 1.0);
    }

    /**
     * Check if attack is ready
     */
    isAttackReady() {
        return this.getAttackCooldownProgress() >= 1.0;
    }

    /**
     * Set attack cooldown based on weapon type
     */
    updateCooldownForWeapon(bot) {
        const held = bot.heldItem;
        if (!held) {
            this.attackCooldown = 250; // Fist = 4 attacks/sec
            return;
        }

        const cooldowns = {
            'wooden_sword': 600, 'stone_sword': 600, 'iron_sword': 600,
            'diamond_sword': 600, 'netherite_sword': 600, // All swords = 0.6s
            'wooden_axe': 1250, 'stone_axe': 1250, 'iron_axe': 1111,
            'diamond_axe': 1000, 'netherite_axe': 1000, // Axes slower but higher damage
            'trident': 1111, // Trident = 0.9s
        };

        this.attackCooldown = cooldowns[held.name] || 600;
    }
}

module.exports = CombatTimingActions;
