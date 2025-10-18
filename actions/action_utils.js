/**
 * Action Utilities
 *
 * Shared utility methods for all action modules.
 * This prevents circular references between ActionSpace and action modules.
 */

class ActionUtils {
    constructor() {}

    /**
     * Sleep utility for delays in action sequences
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Equip the best tool for the current target block
     */
    async equipBestTool(bot) {
        try {
            const targetBlock = bot.blockAtCursor(4);
            if (!targetBlock) return false;

            const tool = bot.pathfinder.bestHarvestTool(targetBlock);
            if (tool && bot.inventory.slots[bot.quickBarSlot] !== tool) {
                await bot.equip(tool, 'hand');
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Look around randomly for exploration
     */
    async lookAround(bot) {
        try {
            const yaw = Math.random() * Math.PI * 2 - Math.PI;
            const pitch = (Math.random() - 0.5) * Math.PI * 0.5;
            await bot.look(yaw, pitch);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get nearby agents within range
     */
    getNearbyAgents(bot, range = 16) {
        try {
            const nearbyPlayers = [];
            for (const player of Object.values(bot.players)) {
                if (player.entity && player.username !== bot.username) {
                    const distance = bot.entity.position.distanceTo(player.entity.position);
                    if (distance <= range) {
                        nearbyPlayers.push({
                            username: player.username,
                            distance: distance,
                            entity: player.entity
                        });
                    }
                }
            }
            return nearbyPlayers;
        } catch (error) {
            return [];
        }
    }

    /**
     * Dig the block below the bot
     */
    async digDown(bot) {
        try {
            const blockBelow = bot.blockAt(bot.entity.position.offset(0, -1, 0));
            if (blockBelow && bot.canDigBlock(blockBelow)) {
                await this.equipBestTool(bot);
                await bot.dig(blockBelow);
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Dig the block in front of the bot
     */
    async digForward(bot) {
        try {
            const blockInFront = bot.blockAtCursor(4);
            if (blockInFront && bot.canDigBlock(blockInFront)) {
                await this.equipBestTool(bot);
                await bot.dig(blockInFront);
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }
}

module.exports = ActionUtils;
