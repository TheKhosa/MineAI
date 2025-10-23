/**
 * Dimension & World Actions (216-225)
 * Portal usage, dimension travel, and world-specific strategies
 */

const Vec3 = require('vec3');
const { goals: { GoalNear, GoalBlock } } = require('mineflayer-pathfinder');

class DimensionActions {
    constructor(utils) {
        this.utils = utils;
    }

    /**
     * Find and enter nearby nether portal
     */
    async enterNetherPortal(bot) {
        const portal = bot.findBlock({
            matching: block => block.name === 'nether_portal',
            maxDistance: 32
        });

        if (!portal) {
            console.log('[Dimension] No nether portal found nearby');
            return false;
        }

        try {
            // Stand in portal for 4 seconds
            const goal = new GoalBlock(portal.position.x, portal.position.y, portal.position.z);
            await bot.pathfinder.goto(goal);

            console.log('[Dimension] Entering nether portal...');
            await this.utils.sleep(5000); // Wait for teleport
            return true;
        } catch (err) {
            console.log('[Dimension] Failed to enter portal:', err.message);
            return false;
        }
    }

    /**
     * Build nether portal frame (requires obsidian)
     */
    async buildNetherPortal(bot) {
        const obsidian = bot.inventory.items().find(item => item.name === 'obsidian');
        if (!obsidian || obsidian.count < 10) {
            console.log('[Dimension] Need at least 10 obsidian to build portal');
            return false;
        }

        const flintSteel = bot.inventory.items().find(item => item.name === 'flint_and_steel');
        if (!flintSteel) {
            console.log('[Dimension] Need flint and steel to ignite portal');
            return false;
        }

        try {
            // Build 5-block tall, 4-block wide frame
            const basePos = bot.entity.position.offset(2, 0, 0).floored();

            // Place obsidian frame (simplified - just corners and sides)
            const framePositions = [
                // Bottom
                basePos.offset(0, 0, 0), basePos.offset(1, 0, 0), basePos.offset(2, 0, 0), basePos.offset(3, 0, 0),
                // Left side
                basePos.offset(0, 1, 0), basePos.offset(0, 2, 0), basePos.offset(0, 3, 0), basePos.offset(0, 4, 0),
                // Right side
                basePos.offset(3, 1, 0), basePos.offset(3, 2, 0), basePos.offset(3, 3, 0), basePos.offset(3, 4, 0),
                // Top
                basePos.offset(1, 4, 0), basePos.offset(2, 4, 0)
            ];

            await bot.equip(obsidian, 'hand');

            for (const pos of framePositions) {
                const refBlock = bot.blockAt(pos.offset(0, -1, 0));
                if (refBlock && refBlock.name !== 'air') {
                    await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
                    await this.utils.sleep(200);
                }
            }

            // Ignite portal
            await bot.equip(flintSteel, 'hand');
            const bottomCenter = bot.blockAt(basePos.offset(1, 0, 0));
            await bot.activateBlock(bottomCenter);

            console.log('[Dimension] Portal built and ignited!');
            return true;
        } catch (err) {
            console.log('[Dimension] Failed to build portal:', err.message);
            return false;
        }
    }

    /**
     * Find stronghold and enter End portal (requires eyes of ender)
     */
    async findEndPortal(bot) {
        const enderEye = bot.inventory.items().find(item => item.name === 'ender_eye');
        if (!enderEye || enderEye.count < 3) {
            console.log('[Dimension] Need at least 3 eyes of ender to locate stronghold');
            return false;
        }

        try {
            // Throw ender eye (this is simplified - real implementation needs trajectory tracking)
            await bot.equip(enderEye, 'hand');
            await bot.activateItem(); // Throws ender eye

            console.log('[Dimension] Ender eye thrown - follow it to stronghold');
            await this.utils.sleep(3000);

            // In real implementation, would track eye trajectory and navigate
            return true;
        } catch (err) {
            console.log('[Dimension] Failed to use ender eye:', err.message);
            return false;
        }
    }

    /**
     * Navigate to world spawn (0, y, 0)
     */
    async goToWorldSpawn(bot) {
        try {
            const spawnPos = new Vec3(0, bot.entity.position.y, 0);
            const goal = new GoalNear(spawnPos.x, spawnPos.y, spawnPos.z, 10);

            console.log('[Dimension] Navigating to world spawn...');
            await bot.pathfinder.goto(goal);
            return true;
        } catch (err) {
            console.log('[Dimension] Failed to reach world spawn:', err.message);
            return false;
        }
    }

    /**
     * Detect current dimension
     */
    getCurrentDimension(bot) {
        if (!bot.game || !bot.game.dimension) {
            return 'overworld'; // Default
        }

        const dim = bot.game.dimension;
        if (dim.includes('nether')) return 'nether';
        if (dim.includes('end')) return 'end';
        return 'overworld';
    }

    /**
     * Check if it's safe to enter nether (has armor, weapons, food)
     */
    isReadyForNether(bot) {
        const items = bot.inventory.items();

        const hasArmor = items.some(i => i.name.includes('chestplate'));
        const hasWeapon = items.some(i => i.name.includes('sword') || i.name.includes('axe'));
        const hasFood = items.some(i => ['cooked_beef', 'cooked_porkchop', 'bread', 'cooked_chicken'].includes(i.name));
        const hasBlocks = items.some(i => ['cobblestone', 'netherrack', 'dirt'].includes(i.name) && i.count >= 32);

        return hasArmor && hasWeapon && hasFood && hasBlocks;
    }

    /**
     * Check if ready for End fight
     */
    isReadyForEnd(bot) {
        const items = bot.inventory.items();

        const hasDiamondArmor = items.filter(i => i.name.includes('diamond_')).length >= 3;
        const hasBow = items.some(i => i.name === 'bow');
        const hasArrows = items.some(i => i.name === 'arrow' && i.count >= 64);
        const hasSword = items.some(i => i.name.includes('diamond_sword'));
        const hasFood = items.filter(i => i.name === 'cooked_beef').reduce((sum, item) => sum + item.count, 0) >= 32;
        const hasBed = items.some(i => i.name.includes('_bed')); // For respawn anchor alternative

        return hasDiamondArmor && hasBow && hasArrows && hasSword && hasFood;
    }

    /**
     * Emergency return to overworld (find nearest portal)
     */
    async emergencyReturnToOverworld(bot) {
        const dimension = this.getCurrentDimension(bot);

        if (dimension === 'overworld') {
            console.log('[Dimension] Already in overworld');
            return true;
        }

        // Find nearest portal
        const portal = bot.findBlock({
            matching: block => block.name === 'nether_portal',
            maxDistance: 64
        });

        if (portal) {
            return await this.enterNetherPortal(bot);
        }

        console.log('[Dimension] No portal found for emergency return!');
        return false;
    }

    /**
     * Get dimension-specific strategy hints
     */
    getDimensionStrategy(bot) {
        const dimension = this.getCurrentDimension(bot);

        const strategies = {
            overworld: {
                priorities: ['gather_resources', 'build_base', 'farm_food', 'find_villages'],
                dangers: ['creepers', 'fall_damage', 'drowning'],
                resources: ['iron', 'coal', 'wood', 'food', 'diamonds']
            },
            nether: {
                priorities: ['find_fortress', 'get_blaze_rods', 'mine_ancient_debris', 'avoid_lava'],
                dangers: ['ghasts', 'lava_lakes', 'fall_damage', 'piglins'],
                resources: ['netherite', 'blaze_rods', 'nether_wart', 'gold']
            },
            end: {
                priorities: ['destroy_crystals', 'fight_dragon', 'collect_dragon_egg', 'find_end_city'],
                dangers: ['dragon_breath', 'void', 'endermen', 'shulkers'],
                resources: ['elytra', 'shulker_boxes', 'dragon_head', 'end_rods']
            }
        };

        return strategies[dimension] || strategies.overworld;
    }
}

module.exports = DimensionActions;
