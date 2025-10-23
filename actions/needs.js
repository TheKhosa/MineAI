/**
 * Needs Management Actions (391-405)
 * Satisfy Sims-style needs: hunger, energy, social, safety, fun
 */

class NeedsActions {
    constructor(utils) {
        this.utils = utils;
    }

    /**
     * Assess all current needs
     */
    assessNeeds(bot) {
        if (!bot.needs) {
            bot.needs = {
                hunger: 100,      // 0-100, decreases over time
                energy: 100,      // 0-100, decreases with activity
                social: 100,      // 0-100, decreases without interaction
                safety: 100,      // 0-100, decreases near danger
                fun: 100,         // 0-100, decreases with repetitive tasks
                hygiene: 100,     // 0-100 (placeholder)
                comfort: 100,     // 0-100, improves in shelter
                environment: 100  // 0-100, affected by biome/weather
            };
        }

        // Update needs based on bot state
        bot.needs.hunger = (bot.food / 20) * 100;
        bot.needs.energy = (bot.health / 20) * 100;

        return bot.needs;
    }

    /**
     * Get most urgent need
     */
    getMostUrgentNeed(bot) {
        const needs = this.assessNeeds(bot);

        let lowestNeed = 'hunger';
        let lowestValue = needs.hunger;

        for (const [need, value] of Object.entries(needs)) {
            if (value < lowestValue) {
                lowestValue = value;
                lowestNeed = need;
            }
        }

        return { need: lowestNeed, value: lowestValue };
    }

    /**
     * Satisfy hunger need
     */
    async satisfyHunger(bot) {
        const food = bot.inventory.items().find(i =>
            ['bread', 'cooked_beef', 'apple', 'carrot'].includes(i.name)
        );

        if (food) {
            try {
                await bot.equip(food, 'hand');
                await bot.consume();
                console.log('[Needs] Satisfied hunger');
                return true;
            } catch (err) {
                return false;
            }
        }

        // Find food source
        const animals = Object.values(bot.entities).filter(e =>
            ['cow', 'pig', 'sheep', 'chicken'].includes(e.name) &&
            e.position.distanceTo(bot.entity.position) < 16
        );

        if (animals.length > 0) {
            console.log('[Needs] Hunting for food');
            return true; // Would trigger hunting behavior
        }

        return false;
    }

    /**
     * Satisfy energy need (sleep/rest)
     */
    async satisfyEnergy(bot) {
        // Find bed
        const bed = bot.findBlock({
            matching: block => block.name.includes('_bed'),
            maxDistance: 16
        });

        if (bed) {
            try {
                await bot.sleep(bed);
                console.log('[Needs] Resting in bed');
                return true;
            } catch (err) {
                console.log('[Needs] Cannot sleep now');
            }
        }

        // Just stand still to "rest"
        console.log('[Needs] Resting in place');
        await this.utils.sleep(5000);
        return true;
    }

    /**
     * Satisfy social need
     */
    async satisfySocial(bot) {
        if (!global.activeAgents) return false;

        // Find nearby agent
        for (const [name, otherBot] of global.activeAgents) {
            if (otherBot !== bot && otherBot.entity) {
                const dist = otherBot.entity.position.distanceTo(bot.entity.position);
                if (dist < 32) {
                    // Chat with agent
                    const greetings = [
                        `Hey ${name}!`,
                        `Hi ${name}, nice to see you!`,
                        `Hello ${name}, how's it going?`
                    ];
                    bot.chat(greetings[Math.floor(Math.random() * greetings.length)]);

                    console.log(`[Needs] Socialized with ${name}`);
                    if (bot.needs) bot.needs.social = Math.min(100, bot.needs.social + 20);
                    return true;
                }
            }
        }

        console.log('[Needs] No one to socialize with');
        return false;
    }

    /**
     * Satisfy safety need (find shelter)
     */
    async satisfySafety(bot) {
        // Check for nearby threats
        const threats = Object.values(bot.entities).filter(e =>
            ['zombie', 'skeleton', 'spider', 'creeper'].includes(e.name) &&
            e.position.distanceTo(bot.entity.position) < 16
        );

        if (threats.length === 0) {
            if (bot.needs) bot.needs.safety = Math.min(100, bot.needs.safety + 10);
            return true;
        }

        // Find enclosed space
        const shelter = bot.findBlock({
            matching: block => block.name.includes('door') || block.name.includes('wall'),
            maxDistance: 16
        });

        if (shelter) {
            console.log('[Needs] Moving to shelter');
            // Would trigger shelter behavior
            return true;
        }

        // Retreat from threats
        console.log('[Needs] Retreating from danger');
        bot.setControlState('back', true);
        await this.utils.sleep(2000);
        bot.setControlState('back', false);

        return true;
    }

    /**
     * Satisfy fun need (do varied activities)
     */
    async satisfyFun(bot) {
        const funActivities = [
            'explore',
            'jump',
            'look_around',
            'chat',
            'dance'
        ];

        const activity = funActivities[Math.floor(Math.random() * funActivities.length)];

        switch (activity) {
            case 'jump':
                bot.setControlState('jump', true);
                await this.utils.sleep(500);
                bot.setControlState('jump', false);
                break;

            case 'look_around':
                for (let i = 0; i < 4; i++) {
                    bot.look(bot.entity.yaw + Math.PI / 2, 0);
                    await this.utils.sleep(200);
                }
                break;

            case 'chat':
                const phrases = ['Wheee!', 'This is fun!', 'Having a great time!'];
                bot.chat(phrases[Math.floor(Math.random() * phrases.length)]);
                break;

            case 'dance':
                for (let i = 0; i < 3; i++) {
                    bot.setControlState('jump', true);
                    await this.utils.sleep(100);
                    bot.setControlState('jump', false);
                    await this.utils.sleep(200);
                }
                break;
        }

        console.log(`[Needs] Having fun: ${activity}`);
        if (bot.needs) bot.needs.fun = Math.min(100, bot.needs.fun + 15);
        return true;
    }

    /**
     * Satisfy comfort need (stay indoors)
     */
    async satisfyComfort(bot) {
        // Check if indoors
        const skyLight = bot.world.getSkyLight?.(bot.entity.position) || 15;

        if (skyLight < 10) {
            // Already indoors
            if (bot.needs) bot.needs.comfort = Math.min(100, bot.needs.comfort + 10);
            return true;
        }

        // Find shelter
        console.log('[Needs] Seeking comfort indoors');
        return await this.satisfySafety(bot);
    }

    /**
     * Satisfy environment need (good biome/weather)
     */
    async satisfyEnvironment(bot) {
        // Check weather
        if (bot.isRaining) {
            console.log('[Needs] Seeking shelter from rain');
            return await this.satisfySafety(bot);
        }

        // Check temperature (biome)
        const biome = bot.blockAt(bot.entity.position)?.biome;
        if (biome?.temperature) {
            if (biome.temperature < 0.2 || biome.temperature > 1.5) {
                console.log('[Needs] Uncomfortable biome, seeking better location');
                // Would trigger biome hunting
            }
        }

        if (bot.needs) bot.needs.environment = Math.min(100, bot.needs.environment + 5);
        return true;
    }

    /**
     * Address most urgent need
     */
    async addressUrgentNeed(bot) {
        const urgent = this.getMostUrgentNeed(bot);

        if (urgent.value > 50) {
            console.log('[Needs] All needs satisfied');
            return false;
        }

        console.log(`[Needs] Addressing ${urgent.need} (${urgent.value.toFixed(1)}%)`);

        switch (urgent.need) {
            case 'hunger':
                return await this.satisfyHunger(bot);
            case 'energy':
                return await this.satisfyEnergy(bot);
            case 'social':
                return await this.satisfySocial(bot);
            case 'safety':
                return await this.satisfySafety(bot);
            case 'fun':
                return await this.satisfyFun(bot);
            case 'comfort':
                return await this.satisfyComfort(bot);
            case 'environment':
                return await this.satisfyEnvironment(bot);
            default:
                return false;
        }
    }

    /**
     * Update all needs over time (call periodically)
     */
    updateNeeds(bot, deltaTime = 1000) {
        if (!bot.needs) {
            this.assessNeeds(bot);
            return;
        }

        const decayRate = deltaTime / 60000; // Per minute

        bot.needs.energy -= decayRate * 5;
        bot.needs.social -= decayRate * 3;
        bot.needs.fun -= decayRate * 2;

        // Clamp values
        for (const need in bot.needs) {
            bot.needs[need] = Math.max(0, Math.min(100, bot.needs[need]));
        }
    }
}

module.exports = NeedsActions;
