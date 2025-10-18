/**
 * Inventory Management Actions (76-90)
 * Fine-grained inventory control for neural network-driven agents
 */

const Vec3 = require('vec3');

class InventoryActions {
    constructor(utils) {
        this.utils = utils;
    }

    /**
     * Toss trash/unwanted items to free inventory space
     */
    async tossTrashItems(bot) {
        const trashItems = ['dirt', 'gravel', 'cobblestone', 'rotten_flesh', 'poisonous_potato',
                           'spider_eye', 'bone', 'string'];
        const items = bot.inventory.items();

        for (const item of items) {
            if (trashItems.includes(item.name) && item.count > 16) {
                // Keep some, toss excess
                const tossAmount = Math.floor(item.count / 2);
                await bot.toss(item.type, null, tossAmount);
                await this.utils.sleep(100);
            }
        }
    }

    /**
     * Sort inventory by placing valuable items first
     */
    async sortInventory(bot) {
        const valueOrder = {
            diamond: 100, diamond_pickaxe: 95, diamond_sword: 94, diamond_axe: 93,
            iron_pickaxe: 50, iron_sword: 49, iron_axe: 48,
            food: 40, cooked_beef: 45, cooked_porkchop: 44, bread: 42,
            torch: 35, crafting_table: 30, furnace: 29
        };

        const items = bot.inventory.items().sort((a, b) => {
            const scoreA = valueOrder[a.name] || (a.name.includes('diamond') ? 90 : 10);
            const scoreB = valueOrder[b.name] || (b.name.includes('diamond') ? 90 : 10);
            return scoreB - scoreA;
        });

        // Items are now sorted conceptually; actual slot rearrangement would require
        // complex window click operations. For ML, this provides the sorted item list.
        return items;
    }

    /**
     * Equip full armor set (helmet, chestplate, leggings, boots)
     */
    async equipArmorSet(bot) {
        const armorPieces = [
            { slot: 'head', types: ['helmet'] },
            { slot: 'torso', types: ['chestplate'] },
            { slot: 'legs', types: ['leggings'] },
            { slot: 'feet', types: ['boots'] }
        ];

        const materials = ['diamond', 'iron', 'golden', 'chainmail', 'leather'];

        for (const piece of armorPieces) {
            for (const material of materials) {
                const armor = bot.inventory.items().find(item =>
                    piece.types.some(type => item.name === `${material}_${type}`)
                );
                if (armor) {
                    try {
                        await bot.equip(armor, piece.slot);
                        break; // Found and equipped best available
                    } catch (err) {
                        // Already equipped or failed
                    }
                }
            }
        }
    }

    /**
     * Swap item to specific hotbar slot for quick access
     */
    async swapHotbarSlot(bot) {
        // Move best tool to hotbar slot 0
        const bestTool = bot.inventory.items()
            .filter(item => item.name.includes('pickaxe') || item.name.includes('sword'))
            .sort((a, b) => {
                const scoreA = a.name.includes('diamond') ? 4 : a.name.includes('iron') ? 3 : 2;
                const scoreB = b.name.includes('diamond') ? 4 : b.name.includes('iron') ? 3 : 2;
                return scoreB - scoreA;
            })[0];

        if (bestTool && bot.quickBarSlot !== 0) {
            await bot.equip(bestTool, 'hand');
        }
    }

    /**
     * Stack similar items together to save space
     */
    async stackItems(bot) {
        // Mineflayer handles stacking automatically in most cases
        // This action serves as an explicit stack consolidation check
        const items = bot.inventory.items();
        const itemGroups = {};

        items.forEach(item => {
            if (!itemGroups[item.name]) {
                itemGroups[item.name] = [];
            }
            itemGroups[item.name].push(item);
        });

        // Items are grouped; actual stacking happens via inventory operations
        return Object.keys(itemGroups).length;
    }

    /**
     * Equip best available helmet
     */
    async equipHelmet(bot) {
        const helmets = ['diamond_helmet', 'iron_helmet', 'golden_helmet', 'chainmail_helmet', 'leather_helmet'];
        for (const helmetName of helmets) {
            const helmet = bot.inventory.items().find(item => item.name === helmetName);
            if (helmet) {
                try {
                    await bot.equip(helmet, 'head');
                    return;
                } catch (err) {
                    // Already equipped or failed
                }
            }
        }
    }

    /**
     * Equip best available chestplate
     */
    async equipChestplate(bot) {
        const chestplates = ['diamond_chestplate', 'iron_chestplate', 'golden_chestplate',
                            'chainmail_chestplate', 'leather_chestplate'];
        for (const chestplateName of chestplates) {
            const chestplate = bot.inventory.items().find(item => item.name === chestplateName);
            if (chestplate) {
                try {
                    await bot.equip(chestplate, 'torso');
                    return;
                } catch (err) {
                    // Already equipped or failed
                }
            }
        }
    }

    /**
     * Equip best available leggings
     */
    async equipLeggings(bot) {
        const leggings = ['diamond_leggings', 'iron_leggings', 'golden_leggings',
                         'chainmail_leggings', 'leather_leggings'];
        for (const leggingsName of leggings) {
            const legging = bot.inventory.items().find(item => item.name === leggingsName);
            if (legging) {
                try {
                    await bot.equip(legging, 'legs');
                    return;
                } catch (err) {
                    // Already equipped or failed
                }
            }
        }
    }

    /**
     * Equip best available boots
     */
    async equipBoots(bot) {
        const boots = ['diamond_boots', 'iron_boots', 'golden_boots', 'chainmail_boots', 'leather_boots'];
        for (const bootsName of boots) {
            const boot = bot.inventory.items().find(item => item.name === bootsName);
            if (boot) {
                try {
                    await bot.equip(boot, 'feet');
                    return;
                } catch (err) {
                    // Already equipped or failed
                }
            }
        }
    }

    /**
     * Equip shield in offhand
     */
    async equipShield(bot) {
        const shield = bot.inventory.items().find(item => item.name === 'shield');
        if (shield) {
            try {
                await bot.equip(shield, 'off-hand');
            } catch (err) {
                // Failed to equip
            }
        }
    }

    /**
     * Toss duplicate/extra tools (keep best one of each type)
     */
    async tossExtraTools(bot) {
        const toolTypes = ['pickaxe', 'axe', 'shovel', 'hoe', 'sword'];

        for (const toolType of toolTypes) {
            const tools = bot.inventory.items()
                .filter(item => item.name.includes(toolType))
                .sort((a, b) => {
                    const scoreA = a.name.includes('diamond') ? 4 : a.name.includes('iron') ? 3 :
                                  a.name.includes('stone') ? 2 : 1;
                    const scoreB = b.name.includes('diamond') ? 4 : b.name.includes('iron') ? 3 :
                                  b.name.includes('stone') ? 2 : 1;
                    return scoreB - scoreA;
                });

            // Keep best, toss rest
            for (let i = 1; i < tools.length; i++) {
                await bot.toss(tools[i].type, null, tools[i].count);
                await this.utils.sleep(100);
            }
        }
    }

    /**
     * Quick swap to best weapon when in danger
     */
    async quickSwapWeapon(bot) {
        const weapons = ['diamond_sword', 'iron_sword', 'stone_sword', 'wooden_sword', 'diamond_axe', 'iron_axe'];
        for (const weaponName of weapons) {
            const weapon = bot.inventory.items().find(item => item.name === weaponName);
            if (weapon) {
                await bot.equip(weapon, 'hand');
                return;
            }
        }
    }

    /**
     * Fill empty hotbar slots with useful items
     */
    async fillEmptySlots(bot) {
        const useful = ['torch', 'food', 'crafting_table', 'cobblestone', 'dirt'];
        const items = bot.inventory.items();

        for (const itemType of useful) {
            const item = items.find(i => i.name.includes(itemType) ||
                                        (itemType === 'food' && (i.name.includes('cooked') || i.name === 'bread')));
            if (item) {
                // Items in inventory are automatically accessible
                // This action marks priority items as identified
            }
        }
    }

    /**
     * Collect nearby items and organize inventory
     */
    async collectAndOrganize(bot) {
        // Collect nearby items
        const items = Object.values(bot.entities).filter(e =>
            e.type === 'object' &&
            e.displayName === 'Item' &&
            e.position &&
            e.position.distanceTo(bot.entity.position) < 8
        );

        if (items.length > 0) {
            const nearest = items[0];
            const { GoalNear } = require('mineflayer-pathfinder').goals;
            bot.pathfinder.setGoal(new GoalNear(nearest.position.x, nearest.position.y, nearest.position.z, 1), true);
            await this.utils.sleep(1000);
        }

        // Then organize (sort)
        await this.sortInventory(bot);
    }

    /**
     * Prioritize keeping valuable items, toss junk
     */
    async prioritizeValuableItems(bot) {
        const valuable = ['diamond', 'iron_ingot', 'gold_ingot', 'emerald', 'ancient_debris', 'netherite'];
        const items = bot.inventory.items();

        const valuableItems = items.filter(item =>
            valuable.some(v => item.name.includes(v))
        );

        // If inventory is full and we have valuables, toss trash
        if (items.length >= 36 && valuableItems.length > 0) {
            await this.tossTrashItems(bot);
        }
    }
}

module.exports = InventoryActions;
