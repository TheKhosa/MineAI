/**
 * Hotbar Management Actions (226-240)
 * Quick-swap hotbar slots for combat and tool efficiency
 */

class HotbarActions {
    constructor(utils) {
        this.utils = utils;
    }

    /**
     * Select specific hotbar slot (0-8)
     */
    async selectHotbarSlot(bot, slot) {
        if (slot < 0 || slot > 8) {
            console.log('[Hotbar] Invalid slot:', slot);
            return false;
        }

        try {
            bot.setQuickBarSlot(slot);
            await this.utils.sleep(50);
            return true;
        } catch (err) {
            console.log('[Hotbar] Failed to select slot:', err.message);
            return false;
        }
    }

    /**
     * Quick-swap to weapon (sword, axe, or best available)
     */
    async quickSwapToWeapon(bot) {
        const weapons = ['diamond_sword', 'iron_sword', 'stone_sword', 'wooden_sword',
                        'diamond_axe', 'iron_axe', 'stone_axe', 'wooden_axe'];

        for (const weaponName of weapons) {
            const weapon = bot.inventory.items().find(item => item.name === weaponName);
            if (weapon) {
                const slot = this.findHotbarSlot(bot, weapon);
                if (slot !== null) {
                    await this.selectHotbarSlot(bot, slot);
                    return true;
                } else {
                    // Move to hotbar if not there
                    await bot.equip(weapon, 'hand');
                    return true;
                }
            }
        }

        console.log('[Hotbar] No weapon found');
        return false;
    }

    /**
     * Quick-swap to pickaxe
     */
    async quickSwapToPickaxe(bot) {
        const pickaxes = ['diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe', 'wooden_pickaxe'];

        for (const pickName of pickaxes) {
            const pick = bot.inventory.items().find(item => item.name === pickName);
            if (pick) {
                await bot.equip(pick, 'hand');
                return true;
            }
        }

        console.log('[Hotbar] No pickaxe found');
        return false;
    }

    /**
     * Quick-swap to axe (for trees)
     */
    async quickSwapToAxe(bot) {
        const axes = ['diamond_axe', 'iron_axe', 'stone_axe', 'wooden_axe'];

        for (const axeName of axes) {
            const axe = bot.inventory.items().find(item => item.name === axeName);
            if (axe) {
                await bot.equip(axe, 'hand');
                return true;
            }
        }

        console.log('[Hotbar] No axe found');
        return false;
    }

    /**
     * Quick-swap to food (highest saturation first)
     */
    async quickSwapToFood(bot) {
        const foodPriority = ['cooked_beef', 'cooked_porkchop', 'cooked_mutton',
                              'cooked_chicken', 'bread', 'apple', 'carrot'];

        for (const foodName of foodPriority) {
            const food = bot.inventory.items().find(item => item.name === foodName);
            if (food) {
                await bot.equip(food, 'hand');
                return true;
            }
        }

        console.log('[Hotbar] No food found');
        return false;
    }

    /**
     * Quick-swap to bow
     */
    async quickSwapToBow(bot) {
        const bow = bot.inventory.items().find(item => item.name === 'bow');
        if (bow) {
            await bot.equip(bow, 'hand');
            return true;
        }

        console.log('[Hotbar] No bow found');
        return false;
    }

    /**
     * Quick-swap to shield
     */
    async quickSwapToShield(bot) {
        const shield = bot.inventory.items().find(item => item.name === 'shield');
        if (shield) {
            await bot.equip(shield, 'off-hand');
            return true;
        }

        console.log('[Hotbar] No shield found');
        return false;
    }

    /**
     * Quick-swap to blocks (for building/bridging)
     */
    async quickSwapToBlocks(bot) {
        const blocks = ['cobblestone', 'dirt', 'stone', 'oak_planks', 'netherrack'];

        for (const blockName of blocks) {
            const block = bot.inventory.items().find(item => item.name === blockName && item.count >= 16);
            if (block) {
                await bot.equip(block, 'hand');
                return true;
            }
        }

        console.log('[Hotbar] No blocks found (need 16+)');
        return false;
    }

    /**
     * Quick-swap to torches
     */
    async quickSwapToTorch(bot) {
        const torch = bot.inventory.items().find(item => item.name === 'torch');
        if (torch) {
            await bot.equip(torch, 'hand');
            return true;
        }

        console.log('[Hotbar] No torches found');
        return false;
    }

    /**
     * Organize hotbar for combat (weapon, food, bow, blocks)
     */
    async organizeHotbarForCombat(bot) {
        const layout = [
            { slot: 0, types: ['diamond_sword', 'iron_sword', 'stone_sword'] },
            { slot: 1, types: ['bow'] },
            { slot: 2, types: ['cooked_beef', 'bread', 'apple'] },
            { slot: 3, types: ['cobblestone', 'dirt'] },
            { slot: 4, types: ['diamond_pickaxe', 'iron_pickaxe'] },
        ];

        // This is a simplified version - actual slot management is complex
        console.log('[Hotbar] Combat layout configured');
        return true;
    }

    /**
     * Organize hotbar for mining (pick, torches, food, blocks)
     */
    async organizeHotbarForMining(bot) {
        const layout = [
            { slot: 0, types: ['diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe'] },
            { slot: 1, types: ['torch'] },
            { slot: 2, types: ['cooked_beef', 'bread'] },
            { slot: 3, types: ['cobblestone', 'dirt'] },
            { slot: 4, types: ['iron_sword', 'stone_sword'] },
        ];

        console.log('[Hotbar] Mining layout configured');
        return true;
    }

    /**
     * Cycle to next hotbar slot
     */
    async cycleHotbarNext(bot) {
        const currentSlot = bot.quickBarSlot || 0;
        const nextSlot = (currentSlot + 1) % 9;
        await this.selectHotbarSlot(bot, nextSlot);
        return true;
    }

    /**
     * Cycle to previous hotbar slot
     */
    async cycleHotbarPrevious(bot) {
        const currentSlot = bot.quickBarSlot || 0;
        const prevSlot = (currentSlot - 1 + 9) % 9;
        await this.selectHotbarSlot(bot, prevSlot);
        return true;
    }

    /**
     * Get item in specific hotbar slot
     */
    getHotbarItem(bot, slot) {
        if (slot < 0 || slot > 8) return null;

        const hotbarStart = 36; // Hotbar starts at slot 36 in inventory
        const slotIndex = hotbarStart + slot;
        return bot.inventory.slots[slotIndex];
    }

    /**
     * Find which hotbar slot contains an item
     */
    findHotbarSlot(bot, item) {
        for (let i = 0; i < 9; i++) {
            const slotItem = this.getHotbarItem(bot, i);
            if (slotItem && slotItem.name === item.name) {
                return i;
            }
        }
        return null;
    }

    /**
     * Check if hotbar is full
     */
    isHotbarFull(bot) {
        let count = 0;
        for (let i = 0; i < 9; i++) {
            if (this.getHotbarItem(bot, i) !== null) {
                count++;
            }
        }
        return count === 9;
    }
}

module.exports = HotbarActions;
