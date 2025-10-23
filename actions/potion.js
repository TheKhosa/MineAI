/**
 * Potion & Brewing Actions (361-375)
 * Brew potions, drink at optimal times, throw splash potions, strategic buff usage
 */

const Vec3 = require('vec3');
const { goals: { GoalNear } } = require('mineflayer-pathfinder');

class PotionActions {
    constructor(utils) {
        this.utils = utils;
    }

    /**
     * Find brewing stand
     */
    findBrewingStand(bot) {
        return bot.findBlock({
            matching: block => block.name === 'brewing_stand',
            maxDistance: 16
        });
    }

    /**
     * Brew basic potion (water bottle + ingredient)
     */
    async brewPotion(bot, ingredient) {
        const brewingStand = this.findBrewingStand(bot);
        if (!brewingStand) {
            console.log('[Potion] No brewing stand nearby');
            return false;
        }

        try {
            // Navigate to brewing stand
            const goal = new GoalNear(brewingStand.position.x, brewingStand.position.y, brewingStand.position.z, 2);
            await bot.pathfinder.goto(goal);

            // Check ingredients
            const waterBottle = bot.inventory.items().find(i => i.name === 'potion' || i.name === 'glass_bottle');
            const ingredientItem = bot.inventory.items().find(i => i.name === ingredient);
            const blazePowder = bot.inventory.items().find(i => i.name === 'blaze_powder');

            if (!waterBottle || !ingredientItem || !blazePowder) {
                console.log('[Potion] Missing brewing ingredients');
                return false;
            }

            // Open brewing stand (simplified - actual brewing is complex)
            await bot.activateBlock(brewingStand);
            await this.utils.sleep(500);

            console.log(`[Potion] Brewing potion with ${ingredient}`);
            // Actual brewing logic would require window management

            return true;
        } catch (err) {
            console.log('[Potion] Brewing failed:', err.message);
            return false;
        }
    }

    /**
     * Brew strength potion (blaze powder)
     */
    async brewStrengthPotion(bot) {
        return await this.brewPotion(bot, 'blaze_powder');
    }

    /**
     * Brew speed potion (sugar)
     */
    async brewSpeedPotion(bot) {
        return await this.brewPotion(bot, 'sugar');
    }

    /**
     * Brew healing potion (glistering melon)
     */
    async brewHealingPotion(bot) {
        return await this.brewPotion(bot, 'glistering_melon_slice');
    }

    /**
     * Brew fire resistance potion (magma cream)
     */
    async brewFireResistancePotion(bot) {
        return await this.brewPotion(bot, 'magma_cream');
    }

    /**
     * Brew night vision potion (golden carrot)
     */
    async brewNightVisionPotion(bot) {
        return await this.brewPotion(bot, 'golden_carrot');
    }

    /**
     * Drink potion at optimal time
     */
    async drinkPotionOptimal(bot, potionType) {
        const potion = bot.inventory.items().find(i =>
            i.name.includes('potion') && i.name.includes(potionType)
        );

        if (!potion) {
            console.log(`[Potion] No ${potionType} potion available`);
            return false;
        }

        // Check if already has the effect
        const hasEffect = bot.entity.effects.some(e =>
            e.name.toLowerCase().includes(potionType.toLowerCase())
        );

        if (hasEffect) {
            console.log(`[Potion] Already have ${potionType} effect`);
            return false;
        }

        try {
            await bot.equip(potion, 'hand');
            await bot.consume();

            console.log(`[Potion] Drank ${potionType} potion`);
            return true;
        } catch (err) {
            console.log('[Potion] Failed to drink potion:', err.message);
            return false;
        }
    }

    /**
     * Use strength potion before combat
     */
    async useStrengthForCombat(bot) {
        // Check if enemy nearby
        const hostileMobs = Object.values(bot.entities).filter(e =>
            e.name && ['zombie', 'skeleton', 'spider', 'creeper'].includes(e.name) &&
            e.position && e.position.distanceTo(bot.entity.position) < 16
        );

        if (hostileMobs.length > 0) {
            return await this.drinkPotionOptimal(bot, 'strength');
        }

        return false;
    }

    /**
     * Use speed potion for travel
     */
    async useSpeedForTravel(bot) {
        return await this.drinkPotionOptimal(bot, 'swiftness');
    }

    /**
     * Use fire resistance before nether
     */
    async useFireResistanceForNether(bot) {
        // Check if in nether or about to enter
        const dimension = bot.game?.dimension || 'overworld';
        if (dimension.includes('nether')) {
            return await this.drinkPotionOptimal(bot, 'fire_resistance');
        }

        // Check if near nether portal
        const portal = bot.findBlock({
            matching: block => block.name === 'nether_portal',
            maxDistance: 8
        });

        if (portal) {
            return await this.drinkPotionOptimal(bot, 'fire_resistance');
        }

        return false;
    }

    /**
     * Use night vision in caves
     */
    async useNightVisionInCaves(bot) {
        // Check if underground
        const yLevel = bot.entity.position.y;
        const skyLight = bot.world.getSkyLight?.(bot.entity.position) || 15;

        if (yLevel < 50 && skyLight < 5) {
            return await this.drinkPotionOptimal(bot, 'night_vision');
        }

        return false;
    }

    /**
     * Throw splash potion
     */
    async throwSplashPotion(bot, potionType, target) {
        const splashPotion = bot.inventory.items().find(i =>
            i.name.includes('splash') && i.name.includes(potionType)
        );

        if (!splashPotion) {
            console.log(`[Potion] No splash ${potionType} potion`);
            return false;
        }

        try {
            await bot.equip(splashPotion, 'hand');

            // Aim at target
            if (target) {
                await bot.lookAt(target.position || target);
            }

            // Throw potion
            await bot.activateItem();

            console.log(`[Potion] Threw splash ${potionType} potion`);
            return true;
        } catch (err) {
            console.log('[Potion] Failed to throw splash potion:', err.message);
            return false;
        }
    }

    /**
     * Throw healing splash potion at low health ally
     */
    async healAllyWithPotion(bot, allyName) {
        if (!global.activeAgents) return false;

        const ally = global.activeAgents.get(allyName);
        if (!ally || !ally.entity) return false;

        // Check if ally needs healing
        if (ally.health > 10) {
            console.log(`[Potion] ${allyName} doesn't need healing`);
            return false;
        }

        return await this.throwSplashPotion(bot, 'healing', ally.entity);
    }

    /**
     * Throw weakness splash potion at zombie villager
     */
    async weakenZombieVillager(bot, zombieVillager) {
        return await this.throwSplashPotion(bot, 'weakness', zombieVillager);
    }

    /**
     * Throw poison/harming splash potion at enemy
     */
    async attackWithPotion(bot, enemy) {
        // Try harming first, then poison
        if (await this.throwSplashPotion(bot, 'harming', enemy)) {
            return true;
        }

        return await this.throwSplashPotion(bot, 'poison', enemy);
    }

    /**
     * Check if has specific potion effect active
     */
    hasPotionEffect(bot, effectName) {
        if (!bot.entity.effects) return false;

        return bot.entity.effects.some(e =>
            e.name.toLowerCase().includes(effectName.toLowerCase())
        );
    }

    /**
     * Get potion effect duration remaining
     */
    getPotionEffectDuration(bot, effectName) {
        if (!bot.entity.effects) return 0;

        const effect = bot.entity.effects.find(e =>
            e.name.toLowerCase().includes(effectName.toLowerCase())
        );

        return effect ? effect.duration : 0;
    }

    /**
     * Maintain combat buffs (strength, speed, regen)
     */
    async maintainCombatBuffs(bot) {
        // Check for nearby enemies
        const hostileMobs = Object.values(bot.entities).filter(e =>
            e.name && ['zombie', 'skeleton', 'spider', 'creeper', 'enderman'].includes(e.name) &&
            e.position && e.position.distanceTo(bot.entity.position) < 20
        );

        if (hostileMobs.length === 0) {
            return false;
        }

        // Use strength if not active
        if (!this.hasPotionEffect(bot, 'strength')) {
            if (await this.drinkPotionOptimal(bot, 'strength')) {
                await this.utils.sleep(500);
            }
        }

        // Use speed if not active
        if (!this.hasPotionEffect(bot, 'speed')) {
            if (await this.drinkPotionOptimal(bot, 'swiftness')) {
                await this.utils.sleep(500);
            }
        }

        // Use regeneration if low health
        if (bot.health < 15 && !this.hasPotionEffect(bot, 'regeneration')) {
            await this.drinkPotionOptimal(bot, 'regeneration');
        }

        return true;
    }

    /**
     * Use water breathing for ocean exploration
     */
    async useWaterBreathing(bot) {
        // Check if in water
        if (bot.entity.isInWater) {
            return await this.drinkPotionOptimal(bot, 'water_breathing');
        }

        return false;
    }

    /**
     * Use invisibility for stealth
     */
    async useInvisibility(bot) {
        return await this.drinkPotionOptimal(bot, 'invisibility');
    }

    /**
     * Count potions in inventory
     */
    countPotions(bot, potionType = null) {
        const potions = bot.inventory.items().filter(i =>
            i.name.includes('potion') &&
            (potionType ? i.name.includes(potionType) : true)
        );

        return potions.reduce((sum, item) => sum + item.count, 0);
    }

    /**
     * Check if ready for brewing (has bottles, blaze powder, ingredients)
     */
    isReadyForBrewing(bot) {
        const hasBottles = bot.inventory.items().some(i =>
            i.name === 'glass_bottle' || i.name === 'potion'
        );

        const hasBlazePowder = bot.inventory.items().some(i =>
            i.name === 'blaze_powder'
        );

        const hasIngredients = bot.inventory.items().some(i =>
            ['nether_wart', 'sugar', 'magma_cream', 'glistering_melon_slice'].includes(i.name)
        );

        return hasBottles && hasBlazePowder && hasIngredients;
    }
}

module.exports = PotionActions;
