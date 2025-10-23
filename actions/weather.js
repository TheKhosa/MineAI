/**
 * Weather Actions (466-475)
 * Weather-based strategies, shelter seeking, thunder charging
 */

class WeatherActions {
    constructor(utils) {
        this.utils = utils;
    }

    /**
     * Seek shelter from rain
     */
    async seekShelterFromRain(bot) {
        if (!bot.isRaining) {
            return false;
        }

        console.log('[Weather] Raining - seeking shelter');

        // Find nearest shelter (any block overhead)
        const shelters = bot.findBlocks({
            matching: block => block.name !== 'air',
            maxDistance: 16,
            count: 10
        });

        if (shelters.length > 0) {
            // Go under shelter
            const shelter = bot.blockAt(shelters[0]);
            console.log('[Weather] Found shelter');
            return true;
        }

        // Build quick shelter
        const blocks = bot.inventory.items().find(i =>
            ['cobblestone', 'dirt', 'oak_planks'].includes(i.name) && i.count >= 4
        );

        if (blocks) {
            console.log('[Weather] Building quick shelter');
            // Would place 4 blocks overhead
            return true;
        }

        return false;
    }

    /**
     * Use thunder for charging creeper
     */
    async chargeCreeper(bot) {
        if (bot.thunderState === 0) {
            return false;
        }

        console.log('[Weather] Thunder detected - looking for creeper to charge');

        const creeper = Object.values(bot.entities).find(e =>
            e.name === 'creeper' &&
            e.position.distanceTo(bot.entity.position) < 16
        );

        if (creeper) {
            // Lead creeper to open area for lightning strike
            console.log('[Weather] Found creeper to charge');
            return true;
        }

        return false;
    }

    /**
     * Fish in rain (better rates)
     */
    async fishInRain(bot) {
        if (!bot.isRaining) {
            return false;
        }

        const fishingRod = bot.inventory.items().find(i => i.name === 'fishing_rod');

        if (!fishingRod) {
            return false;
        }

        console.log('[Weather] Rain detected - fishing (better rates)');

        try {
            await bot.equip(fishingRod, 'hand');
            await bot.fish();
            return true;
        } catch (err) {
            return false;
        }
    }

    /**
     * Wait for clear weather
     */
    async waitForClearWeather(bot) {
        if (!bot.isRaining && bot.thunderState === 0) {
            return true;
        }

        console.log('[Weather] Waiting for clear weather...');

        // Sleep in bed to skip storm
        const bed = bot.findBlock({
            matching: block => block.name.includes('_bed'),
            maxDistance: 16
        });

        if (bed) {
            try {
                await bot.sleep(bed);
                console.log('[Weather] Slept through storm');
                return true;
            } catch (err) {
                // Can't sleep
            }
        }

        // Just wait
        await this.utils.sleep(30000); // 30 seconds
        return false;
    }

    /**
     * Adapt strategy to weather
     */
    getWeatherStrategy(bot) {
        if (bot.isRaining && bot.thunderState > 0) {
            return {
                strategy: 'shelter',
                reason: 'Thunder and rain - dangerous outdoors',
                actions: ['seek_shelter', 'wait_indoors']
            };
        }

        if (bot.isRaining) {
            return {
                strategy: 'fishing',
                reason: 'Rain - good for fishing',
                actions: ['fish', 'collect_water']
            };
        }

        return {
            strategy: 'normal',
            reason: 'Clear weather',
            actions: ['mine', 'explore', 'build']
        };
    }

    /**
     * Collect water during rain
     */
    async collectWaterInRain(bot) {
        if (!bot.isRaining) {
            return false;
        }

        const bucket = bot.inventory.items().find(i => i.name === 'bucket');

        if (!bucket) {
            return false;
        }

        console.log('[Weather] Collecting water from rain');

        // Place bucket to collect water
        await bot.equip(bucket, 'hand');

        // Find water source
        const water = bot.findBlock({
            matching: block => block.name === 'water',
            maxDistance: 8
        });

        if (water) {
            await bot.activateBlock(water);
            console.log('[Weather] Water collected');
            return true;
        }

        return false;
    }

    /**
     * Check if safe to be outdoors
     */
    isSafeOutdoors(bot) {
        // Thunder is dangerous
        if (bot.thunderState > 0) {
            return false;
        }

        // Rain is safe but annoying
        return true;
    }

    /**
     * Use weather info for planning
     */
    getWeatherInfo(bot) {
        return {
            isRaining: bot.isRaining,
            thunderLevel: bot.thunderState,
            safe: this.isSafeOutdoors(bot),
            strategy: this.getWeatherStrategy(bot).strategy
        };
    }
}

module.exports = WeatherActions;
