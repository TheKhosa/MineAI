/**
 * Fishing Actions (316-320)
 * Cast rod, detect bites, reel in catches, auto-fishing
 */

class FishingActions {
    constructor(utils) {
        this.utils = utils;
        this.isFishing = false;
        this.fishingStartTime = 0;
    }

    /**
     * Cast fishing rod
     */
    async castFishingRod(bot) {
        const fishingRod = bot.inventory.items().find(item => item.name === 'fishing_rod');

        if (!fishingRod) {
            console.log('[Fishing] No fishing rod in inventory');
            return false;
        }

        try {
            // Equip fishing rod
            await bot.equip(fishingRod, 'hand');

            // Cast (right-click/activate)
            await bot.activateItem();

            this.isFishing = true;
            this.fishingStartTime = Date.now();

            console.log('[Fishing] Rod cast');
            return true;
        } catch (err) {
            console.log('[Fishing] Failed to cast rod:', err.message);
            return false;
        }
    }

    /**
     * Reel in fishing rod
     */
    async reelIn(bot) {
        if (!this.isFishing) {
            console.log('[Fishing] Not currently fishing');
            return false;
        }

        try {
            // Reel in (right-click again)
            await bot.activateItem();

            this.isFishing = false;

            console.log('[Fishing] Reeled in!');
            return true;
        } catch (err) {
            console.log('[Fishing] Failed to reel in:', err.message);
            return false;
        }
    }

    /**
     * Detect if fish is biting (check for bobber velocity change)
     */
    isFishBiting(bot) {
        // Find fishing bobber entity
        const bobber = Object.values(bot.entities).find(entity =>
            entity.name === 'fishing_bobber' &&
            entity.position &&
            entity.position.distanceTo(bot.entity.position) < 32
        );

        if (!bobber) {
            return false;
        }

        // Check if bobber is in water and has sudden velocity change
        // This is simplified - actual detection is more complex
        const inWater = bobber.isInWater || false;
        const velocityChange = bobber.velocity && Math.abs(bobber.velocity.y) > 0.3;

        return inWater && velocityChange;
    }

    /**
     * Auto-fishing loop (cast, wait for bite, reel in, repeat)
     */
    async autoFish(bot, duration = 60000) {
        const startTime = Date.now();
        let catches = 0;

        console.log(`[Fishing] Auto-fishing for ${duration / 1000} seconds...`);

        // Set up bite detection
        let lastBiteCheck = Date.now();

        while (Date.now() - startTime < duration) {
            // Cast if not fishing
            if (!this.isFishing) {
                await this.castFishingRod(bot);
                await this.utils.sleep(1000);
            }

            // Check for bites every 100ms
            if (Date.now() - lastBiteCheck > 100) {
                if (this.isFishBiting(bot)) {
                    console.log('[Fishing] Fish biting!');
                    await this.reelIn(bot);
                    catches++;
                    await this.utils.sleep(500);
                }
                lastBiteCheck = Date.now();
            }

            // Timeout detection - if fishing for >30s without bite, recast
            if (this.isFishing && Date.now() - this.fishingStartTime > 30000) {
                console.log('[Fishing] Timeout - recasting...');
                await this.reelIn(bot);
                await this.utils.sleep(500);
            }

            await this.utils.sleep(100);
        }

        console.log(`[Fishing] Auto-fishing complete - caught ${catches} fish`);
        return catches;
    }

    /**
     * Fish with treasure detection (listen for better loot)
     */
    async fishForTreasure(bot) {
        console.log('[Fishing] Fishing for treasure...');

        await this.castFishingRod(bot);

        // Wait longer for treasure (up to 60s)
        const waitTime = 60000;
        const startTime = Date.now();

        while (Date.now() - startTime < waitTime) {
            if (this.isFishBiting(bot)) {
                await this.reelIn(bot);

                // Check what was caught
                const recentItems = bot.inventory.items().filter(item =>
                    ['enchanted_book', 'name_tag', 'saddle', 'bow', 'fishing_rod'].includes(item.name)
                );

                if (recentItems.length > 0) {
                    console.log(`[Fishing] Caught treasure: ${recentItems[0].name}!`);
                    return recentItems[0];
                }

                console.log('[Fishing] Caught regular fish, trying again...');
                await this.utils.sleep(1000);
                await this.castFishingRod(bot);
            }

            await this.utils.sleep(100);
        }

        console.log('[Fishing] No treasure found');
        return null;
    }

    /**
     * Get fishing rod durability
     */
    getFishingRodDurability(bot) {
        const fishingRod = bot.inventory.items().find(item => item.name === 'fishing_rod');

        if (!fishingRod || !fishingRod.maxDurability) {
            return 0;
        }

        const currentDurability = fishingRod.maxDurability - (fishingRod.durabilityUsed || 0);
        return currentDurability / fishingRod.maxDurability;
    }

    /**
     * Check if fishing rod needs repair
     */
    needsRepair(bot) {
        return this.getFishingRodDurability(bot) < 0.2;
    }

    /**
     * Count fish in inventory
     */
    countFish(bot) {
        const fishTypes = ['cod', 'salmon', 'tropical_fish', 'pufferfish',
                          'cooked_cod', 'cooked_salmon'];

        return bot.inventory.items()
            .filter(item => fishTypes.includes(item.name))
            .reduce((sum, item) => sum + item.count, 0);
    }

    /**
     * Find best fishing spot (water with open sky)
     */
    findFishingSpot(bot) {
        // Find water blocks nearby
        const waterBlocks = bot.findBlocks({
            matching: block => block.name === 'water',
            maxDistance: 16,
            count: 50
        });

        if (waterBlocks.length === 0) {
            console.log('[Fishing] No water nearby');
            return null;
        }

        // Prefer water with open sky (better catch rates)
        for (const waterPos of waterBlocks) {
            const waterBlock = bot.blockAt(waterPos);
            const skyLight = bot.world.getSkyLight?.(waterPos) || 15;

            if (skyLight > 12) {
                console.log(`[Fishing] Good fishing spot found at ${waterPos}`);
                return waterBlock;
            }
        }

        // Return any water if no perfect spot
        return bot.blockAt(waterBlocks[0]);
    }

    /**
     * Stop fishing (reel in if currently fishing)
     */
    async stopFishing(bot) {
        if (this.isFishing) {
            await this.reelIn(bot);
        }

        this.isFishing = false;
        console.log('[Fishing] Stopped fishing');
        return true;
    }
}

module.exports = FishingActions;
