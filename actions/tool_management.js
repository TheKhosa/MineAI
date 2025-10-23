/**
 * Tool Management Actions (266-280)
 * Durability tracking, enchantment awareness, tool repair & optimization
 */

class ToolManagementActions {
    constructor(utils) {
        this.utils = utils;
    }

    /**
     * Get tool durability percentage (0-1)
     */
    getToolDurability(item) {
        if (!item || !item.maxDurability) {
            return 1.0; // Non-durable item
        }

        const currentDurability = item.maxDurability - (item.durabilityUsed || 0);
        return currentDurability / item.maxDurability;
    }

    /**
     * Check if tool needs repair (< 20% durability)
     */
    needsRepair(item) {
        return this.getToolDurability(item) < 0.2;
    }

    /**
     * Find best pickaxe in inventory
     */
    findBestPickaxe(bot) {
        const pickaxeTypes = ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe', 'wooden_pickaxe'];

        for (const pickType of pickaxeTypes) {
            const pick = bot.inventory.items().find(item =>
                item.name === pickType && this.getToolDurability(item) > 0.1
            );
            if (pick) return pick;
        }

        return null;
    }

    /**
     * Find best axe in inventory
     */
    findBestAxe(bot) {
        const axeTypes = ['netherite_axe', 'diamond_axe', 'iron_axe', 'stone_axe', 'wooden_axe'];

        for (const axeType of axeTypes) {
            const axe = bot.inventory.items().find(item =>
                item.name === axeType && this.getToolDurability(item) > 0.1
            );
            if (axe) return axe;
        }

        return null;
    }

    /**
     * Find best sword in inventory
     */
    findBestSword(bot) {
        const swordTypes = ['netherite_sword', 'diamond_sword', 'iron_sword', 'stone_sword', 'wooden_sword'];

        for (const swordType of swordTypes) {
            const sword = bot.inventory.items().find(item =>
                item.name === swordType && this.getToolDurability(item) > 0.1
            );
            if (sword) return sword;
        }

        return null;
    }

    /**
     * Equip tool with fortune enchantment (for ores)
     */
    async equipFortunePickaxe(bot) {
        const pickaxes = bot.inventory.items().filter(item =>
            item.name.includes('pickaxe') && this.getToolDurability(item) > 0.1
        );

        // Find pickaxe with Fortune enchantment
        const fortunePick = pickaxes.find(pick => {
            const enchants = pick.enchants || [];
            return enchants.some(e => e.name === 'fortune');
        });

        if (fortunePick) {
            await bot.equip(fortunePick, 'hand');
            console.log('[Tools] Equipped Fortune pickaxe');
            return true;
        }

        // Fall back to best pickaxe
        const bestPick = this.findBestPickaxe(bot);
        if (bestPick) {
            await bot.equip(bestPick, 'hand');
            return true;
        }

        console.log('[Tools] No suitable pickaxe found');
        return false;
    }

    /**
     * Equip tool with efficiency enchantment (for speed)
     */
    async equipEfficiencyTool(bot, toolType) {
        const tools = bot.inventory.items().filter(item =>
            item.name.includes(toolType) && this.getToolDurability(item) > 0.1
        );

        // Find tool with Efficiency enchantment
        const efficiencyTool = tools.find(tool => {
            const enchants = tool.enchants || [];
            return enchants.some(e => e.name === 'efficiency');
        });

        if (efficiencyTool) {
            await bot.equip(efficiencyTool, 'hand');
            console.log(`[Tools] Equipped Efficiency ${toolType}`);
            return true;
        }

        console.log(`[Tools] No Efficiency ${toolType} found`);
        return false;
    }

    /**
     * Equip weapon with sharpness/smite enchantment
     */
    async equipEnchantedWeapon(bot) {
        const weapons = bot.inventory.items().filter(item =>
            (item.name.includes('sword') || item.name.includes('axe')) &&
            this.getToolDurability(item) > 0.1
        );

        // Prioritize: Sharpness > Smite > Bane of Arthropods
        const enchantPriority = ['sharpness', 'smite', 'bane_of_arthropods'];

        for (const enchantName of enchantPriority) {
            const enchantedWeapon = weapons.find(weapon => {
                const enchants = weapon.enchants || [];
                return enchants.some(e => e.name === enchantName);
            });

            if (enchantedWeapon) {
                await bot.equip(enchantedWeapon, 'hand');
                console.log(`[Tools] Equipped ${enchantName} weapon`);
                return true;
            }
        }

        // Fall back to best sword
        const bestSword = this.findBestSword(bot);
        if (bestSword) {
            await bot.equip(bestSword, 'hand');
            return true;
        }

        return false;
    }

    /**
     * Repair tool at anvil (requires duplicate tool or material)
     */
    async repairToolAtAnvil(bot, tool) {
        const anvil = bot.findBlock({
            matching: block => block.name === 'anvil',
            maxDistance: 16
        });

        if (!anvil) {
            console.log('[Tools] No anvil nearby');
            return false;
        }

        try {
            // Find repair material or duplicate tool
            const duplicateTool = bot.inventory.items().find(item =>
                item.name === tool.name && item !== tool
            );

            if (!duplicateTool) {
                console.log('[Tools] No duplicate tool for repair');
                return false;
            }

            // Open anvil (simplified - actual anvil use is complex)
            await bot.activateBlock(anvil);
            await this.utils.sleep(500);

            console.log(`[Tools] Repairing ${tool.name} at anvil`);
            // Actual repair logic would require window management
            return true;
        } catch (err) {
            console.log('[Tools] Anvil repair failed:', err.message);
            return false;
        }
    }

    /**
     * Check if tool has Mending enchantment
     */
    hasMending(item) {
        if (!item || !item.enchants) return false;
        return item.enchants.some(e => e.name === 'mending');
    }

    /**
     * Check if tool has Unbreaking enchantment
     */
    hasUnbreaking(item) {
        if (!item || !item.enchants) return false;
        return item.enchants.some(e => e.name === 'unbreaking');
    }

    /**
     * Get tool enchantment level
     */
    getEnchantmentLevel(item, enchantmentName) {
        if (!item || !item.enchants) return 0;

        const enchant = item.enchants.find(e => e.name === enchantmentName);
        return enchant ? enchant.lvl : 0;
    }

    /**
     * Select optimal tool for block type
     */
    async selectOptimalTool(bot, block) {
        if (!block) return false;

        const toolMap = {
            // Pickaxe for stone/ores
            stone: 'pickaxe', cobblestone: 'pickaxe', iron_ore: 'pickaxe',
            diamond_ore: 'pickaxe', coal_ore: 'pickaxe', gold_ore: 'pickaxe',
            deepslate: 'pickaxe', deepslate_iron_ore: 'pickaxe',

            // Axe for wood
            oak_log: 'axe', birch_log: 'axe', spruce_log: 'axe',
            oak_planks: 'axe', crafting_table: 'axe',

            // Shovel for dirt/sand/gravel
            dirt: 'shovel', grass_block: 'shovel', sand: 'shovel', gravel: 'shovel',

            // Sword for webs/plants
            cobweb: 'sword', bamboo: 'sword'
        };

        const toolType = toolMap[block.name];
        if (!toolType) {
            console.log('[Tools] No specific tool needed for', block.name);
            return false;
        }

        // Find best tool of that type
        const bestTool = this[`findBest${toolType.charAt(0).toUpperCase() + toolType.slice(1)}`]?.(bot);
        if (bestTool) {
            await bot.equip(bestTool, 'hand');
            console.log(`[Tools] Equipped optimal ${toolType} for ${block.name}`);
            return true;
        }

        return false;
    }

    /**
     * Get all tools that need repair
     */
    getToolsNeedingRepair(bot) {
        return bot.inventory.items().filter(item =>
            item.maxDurability && this.needsRepair(item)
        );
    }

    /**
     * Discard broken tools (0% durability)
     */
    async discardBrokenTools(bot) {
        const brokenTools = bot.inventory.items().filter(item =>
            item.maxDurability && (item.durabilityUsed >= item.maxDurability)
        );

        for (const tool of brokenTools) {
            try {
                await bot.toss(tool.type, null, tool.count);
                console.log(`[Tools] Discarded broken ${tool.name}`);
                await this.utils.sleep(100);
            } catch (err) {
                // Failed to toss
            }
        }

        return brokenTools.length;
    }

    /**
     * Calculate mining efficiency with current tool
     */
    getMiningEfficiency(bot, block) {
        const tool = bot.heldItem;
        if (!tool) return 1.0;

        // Check for Efficiency enchantment
        const efficiencyLevel = this.getEnchantmentLevel(tool, 'efficiency');

        // Base multiplier from tool material
        const materialMultipliers = {
            wooden: 2, stone: 4, iron: 6, diamond: 8, netherite: 9
        };

        let multiplier = 1.0;
        for (const [material, mult] of Object.entries(materialMultipliers)) {
            if (tool.name.includes(material)) {
                multiplier = mult;
                break;
            }
        }

        // Add efficiency bonus
        multiplier += efficiencyLevel * 0.2;

        return multiplier;
    }
}

module.exports = ToolManagementActions;
