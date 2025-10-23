/**
 * Health Management Actions (331-345)
 * Eating, healing, potion usage, damage avoidance, status effect curing
 */

class HealthActions {
    constructor(utils) {
        this.utils = utils;
        this.minHealthThreshold = 10; // Eat/heal below this
        this.minFoodThreshold = 10; // Eat below this
    }

    /**
     * Eat best available food
     */
    async eatBestFood(bot) {
        const foodPriority = [
            { name: 'golden_apple', hunger: 4, saturation: 9.6 },
            { name: 'cooked_beef', hunger: 8, saturation: 12.8 },
            { name: 'cooked_porkchop', hunger: 8, saturation: 12.8 },
            { name: 'cooked_mutton', hunger: 6, saturation: 9.6 },
            { name: 'cooked_salmon', hunger: 6, saturation: 9.6 },
            { name: 'cooked_chicken', hunger: 6, saturation: 7.2 },
            { name: 'bread', hunger: 5, saturation: 6.0 },
            { name: 'baked_potato', hunger: 5, saturation: 6.0 },
            { name: 'apple', hunger: 4, saturation: 2.4 },
            { name: 'carrot', hunger: 3, saturation: 3.6 }
        ];

        for (const food of foodPriority) {
            const foodItem = bot.inventory.items().find(item => item.name === food.name);
            if (foodItem) {
                try {
                    await bot.equip(foodItem, 'hand');
                    await bot.consume();
                    console.log(`[Health] Ate ${food.name} (+${food.hunger} hunger)`);
                    return true;
                } catch (err) {
                    // Can't eat this food
                }
            }
        }

        console.log('[Health] No food available');
        return false;
    }

    /**
     * Eat food if hungry (food < threshold)
     */
    async eatIfHungry(bot) {
        if (bot.food < this.minFoodThreshold) {
            console.log(`[Health] Hungry (${bot.food}/20) - eating...`);
            return await this.eatBestFood(bot);
        }
        return false;
    }

    /**
     * Heal if health is low
     */
    async healIfLow(bot) {
        if (bot.health < this.minHealthThreshold) {
            console.log(`[Health] Low health (${bot.health}/20) - healing...`);

            // Try healing potion first
            const healingPotion = this.findPotion(bot, 'healing');
            if (healingPotion) {
                return await this.drinkPotion(bot, healingPotion);
            }

            // Fall back to eating
            return await this.eatBestFood(bot);
        }
        return false;
    }

    /**
     * Drink healing potion
     */
    async drinkPotion(bot, potion) {
        try {
            await bot.equip(potion, 'hand');
            await bot.consume();
            console.log(`[Health] Drank ${potion.name}`);
            return true;
        } catch (err) {
            console.log('[Health] Failed to drink potion:', err.message);
            return false;
        }
    }

    /**
     * Find specific potion type
     */
    findPotion(bot, effectType) {
        const potionNames = {
            'healing': ['potion', 'strong_healing', 'healing_ii'],
            'regeneration': ['regeneration', 'strong_regeneration'],
            'strength': ['strength', 'strong_strength'],
            'speed': ['swiftness', 'strong_swiftness'],
            'fire_resistance': ['fire_resistance']
        };

        const names = potionNames[effectType] || [];

        return bot.inventory.items().find(item =>
            item.name.includes('potion') &&
            names.some(n => item.name.includes(n))
        );
    }

    /**
     * Use regeneration potion
     */
    async useRegenerationPotion(bot) {
        const regenPotion = this.findPotion(bot, 'regeneration');
        if (regenPotion) {
            return await this.drinkPotion(bot, regenPotion);
        }
        console.log('[Health] No regeneration potion');
        return false;
    }

    /**
     * Cure poison effect
     */
    async curePoison(bot) {
        const isPoisoned = bot.entity.effects.some(e => e.name === 'poison' || e.name === 'Poison');

        if (!isPoisoned) {
            return false;
        }

        // Drink milk to clear all effects
        const milk = bot.inventory.items().find(item => item.name === 'milk_bucket');
        if (milk) {
            try {
                await bot.equip(milk, 'hand');
                await bot.consume();
                console.log('[Health] Cured poison with milk');
                return true;
            } catch (err) {
                console.log('[Health] Failed to drink milk');
            }
        }

        // Try healing potion as alternative
        return await this.healIfLow(bot);
    }

    /**
     * Cure wither effect
     */
    async cureWither(bot) {
        const hasWither = bot.entity.effects.some(e => e.name === 'wither' || e.name === 'Wither');

        if (!hasWither) {
            return false;
        }

        // Drink milk to clear all effects
        const milk = bot.inventory.items().find(item => item.name === 'milk_bucket');
        if (milk) {
            try {
                await bot.equip(milk, 'hand');
                await bot.consume();
                console.log('[Health] Cured wither with milk');
                return true;
            } catch (err) {
                console.log('[Health] Failed to drink milk');
            }
        }

        return false;
    }

    /**
     * Extinguish fire (jump in water or use fire resistance)
     */
    async extinguishFire(bot) {
        if (!bot.entity.isInLava && bot.entity.onFire) {
            // Find nearby water
            const water = bot.findBlock({
                matching: block => block.name === 'water',
                maxDistance: 8
            });

            if (water) {
                console.log('[Health] Jumping in water to extinguish fire');
                // Navigate to water (simplified)
                return true;
            }

            // Use fire resistance potion
            const fireResPotion = this.findPotion(bot, 'fire_resistance');
            if (fireResPotion) {
                return await this.drinkPotion(bot, fireResPotion);
            }
        }

        return false;
    }

    /**
     * Avoid lava/fire damage
     */
    async avoidFireDamage(bot) {
        if (bot.entity.isInLava) {
            console.log('[Health] In lava! Emergency escape');

            // Try to pillar up with blocks
            const blocks = bot.inventory.items().find(item =>
                ['cobblestone', 'dirt', 'netherrack'].includes(item.name)
            );

            if (blocks) {
                await bot.equip(blocks, 'hand');
                // Place block below to pillar up
                const refBlock = bot.blockAt(bot.entity.position.offset(0, -1, 0));
                if (refBlock) {
                    await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
                }
            }

            return true;
        }

        return false;
    }

    /**
     * Avoid drowning (swim up)
     */
    async avoidDrowning(bot) {
        if (bot.oxygenLevel < 5) {
            console.log('[Health] Low oxygen! Swimming up');
            bot.setControlState('jump', true); // Swim up
            await this.utils.sleep(1000);
            bot.setControlState('jump', false);
            return true;
        }

        return false;
    }

    /**
     * Eat golden apple for absorption
     */
    async useGoldenApple(bot) {
        const goldenApple = bot.inventory.items().find(item => item.name === 'golden_apple');

        if (goldenApple) {
            try {
                await bot.equip(goldenApple, 'hand');
                await bot.consume();
                console.log('[Health] Ate golden apple (Absorption + Regen)');
                return true;
            } catch (err) {
                console.log('[Health] Failed to eat golden apple');
            }
        }

        return false;
    }

    /**
     * Get current health percentage
     */
    getHealthPercentage(bot) {
        return bot.health / 20.0;
    }

    /**
     * Get current food percentage
     */
    getFoodPercentage(bot) {
        return bot.food / 20.0;
    }

    /**
     * Check if critically low health
     */
    isCriticalHealth(bot) {
        return bot.health <= 6; // 3 hearts or less
    }

    /**
     * Check if needs food soon
     */
    needsFood(bot) {
        return bot.food < 14; // Less than 7 drumsticks
    }

    /**
     * Emergency heal (use any available healing method)
     */
    async emergencyHeal(bot) {
        console.log('[Health] EMERGENCY HEAL - trying all methods');

        // 1. Golden apple (best)
        if (await this.useGoldenApple(bot)) return true;

        // 2. Healing potion
        if (await this.healIfLow(bot)) return true;

        // 3. Regeneration potion
        if (await this.useRegenerationPotion(bot)) return true;

        // 4. Any food
        if (await this.eatBestFood(bot)) return true;

        console.log('[Health] No healing items available!');
        return false;
    }

    /**
     * Full health check and action
     */
    async maintainHealth(bot) {
        // Check for immediate threats
        if (await this.avoidDrowning(bot)) return;
        if (await this.avoidFireDamage(bot)) return;
        if (await this.extinguishFire(bot)) return;

        // Cure status effects
        if (await this.curePoison(bot)) return;
        if (await this.cureWither(bot)) return;

        // Maintain health
        if (this.isCriticalHealth(bot)) {
            await this.emergencyHeal(bot);
        } else if (this.needsFood(bot)) {
            await this.eatIfHungry(bot);
        }
    }
}

module.exports = HealthActions;
