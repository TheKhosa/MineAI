/**
 * Optimization Actions Module (198-207)
 * Resource efficiency and optimal mining strategies
 */

const Vec3 = require('vec3');
const { goals } = require('mineflayer-pathfinder');
const { GoalNear, GoalBlock, GoalXZ } = goals;

class Optimization {
    constructor(utils) {
        this.utils = utils;
    }

    // 198: Select Optimal Tool - Choose best tool for block type
    async selectOptimalTool(bot) {
        try {
            const targetBlock = bot.blockAtCursor(4);
            if (!targetBlock || targetBlock.name === 'air') return;

            const blockName = targetBlock.name;
            let bestTool = null;

            // Determine optimal tool based on block type
            if (blockName.includes('log') || blockName.includes('planks') || blockName.includes('wood')) {
                // Wood blocks - use axe
                bestTool = bot.inventory.items().find(item => item.name.includes('axe'));
            } else if (blockName.includes('ore') || blockName.includes('stone') || blockName.includes('cobblestone')) {
                // Stone/ore blocks - use pickaxe
                bestTool = bot.inventory.items().find(item => item.name.includes('pickaxe'));
            } else if (blockName.includes('dirt') || blockName.includes('grass') || blockName.includes('sand')) {
                // Soft blocks - use shovel
                bestTool = bot.inventory.items().find(item => item.name.includes('shovel'));
            } else if (blockName.includes('leaves') || blockName.includes('wool')) {
                // Shearable blocks - use shears if available
                bestTool = bot.inventory.items().find(item => item.name.includes('shears'));
            }

            if (bestTool) {
                await bot.equip(bestTool, 'hand');
            } else {
                // Fall back to best available tool
                await this.utils.equipBestTool(bot);
            }
        } catch (error) {
            // Tool selection failed
        }
    }

    // 199: Repair with Anvil - Use anvil for repairs
    async repairWithAnvil(bot) {
        try {
            const anvil = bot.findBlock({
                matching: block => block.name.includes('anvil'),
                maxDistance: 4
            });

            if (anvil) {
                // Find damaged tools
                const damagedTools = bot.inventory.items().filter(item =>
                    item.nbt && item.nbt.value && item.nbt.value.Damage &&
                    (item.name.includes('pickaxe') || item.name.includes('sword') ||
                     item.name.includes('axe') || item.name.includes('shovel'))
                );

                if (damagedTools.length > 0) {
                    // Open anvil (simplified - full implementation would require window handling)
                    await bot.activateBlock(anvil);
                    await this.sleep(500);
                }
            }
        } catch (error) {
            // Anvil repair failed
        }
    }

    // 200: Salvage Tools - Use grindstone to salvage materials
    async salvageTools(bot) {
        try {
            const grindstone = bot.findBlock({
                matching: block => block.name === 'grindstone',
                maxDistance: 4
            });

            if (grindstone) {
                // Find heavily damaged or duplicate tools
                const salvageableTools = bot.inventory.items().filter(item =>
                    item.nbt && item.nbt.value && item.nbt.value.Damage &&
                    item.nbt.value.Damage.value > (item.maxDurability * 0.8)
                );

                if (salvageableTools.length > 0) {
                    await bot.activateBlock(grindstone);
                    await this.sleep(500);
                }
            }
        } catch (error) {
            // Tool salvage failed
        }
    }

    // 201: Optimize Inventory Space - Consolidate stacks
    async optimizeInventorySpace(bot) {
        try {
            const items = bot.inventory.items();
            const itemGroups = {};

            // Group items by type
            for (const item of items) {
                if (!itemGroups[item.name]) {
                    itemGroups[item.name] = [];
                }
                itemGroups[item.name].push(item);
            }

            // Consolidate stacks (simplified - would need window operations)
            for (const [itemName, itemList] of Object.entries(itemGroups)) {
                if (itemList.length > 1) {
                    // Multiple stacks of same item - could be consolidated
                    // This would require window click operations
                }
            }

            await this.sleep(500);
        } catch (error) {
            // Inventory optimization failed
        }
    }

    // 202: Conserve Durability - Switch tools before breaking
    async conserveDurability(bot) {
        try {
            const currentItem = bot.heldItem;

            if (currentItem && currentItem.nbt && currentItem.nbt.value && currentItem.nbt.value.Damage) {
                const damage = currentItem.nbt.value.Damage.value;
                const maxDurability = currentItem.maxDurability;

                // Switch if tool is about to break (< 10% durability)
                if (damage > (maxDurability * 0.9)) {
                    // Find similar tool with better durability
                    const similarTools = bot.inventory.items().filter(item =>
                        item.name === currentItem.name &&
                        (!item.nbt || !item.nbt.value.Damage ||
                         item.nbt.value.Damage.value < (maxDurability * 0.5))
                    );

                    if (similarTools.length > 0) {
                        await bot.equip(similarTools[0], 'hand');
                    }
                }
            }
        } catch (error) {
            // Durability conservation failed
        }
    }

    // 203: Efficient Mining - Optimal mining patterns
    async efficientMining(bot) {
        try {
            // Look for ore clusters
            const ores = ['coal_ore', 'iron_ore', 'diamond_ore', 'gold_ore', 'redstone_ore',
                         'deepslate_iron_ore', 'deepslate_diamond_ore', 'deepslate_gold_ore'];

            const ore = bot.findBlock({
                matching: block => ores.includes(block.name),
                maxDistance: 32
            });

            if (ore) {
                await this.selectOptimalTool(bot);

                // Mine ore
                bot.pathfinder.setGoal(new GoalBlock(ore.position.x, ore.position.y, ore.position.z), true);
                await this.sleep(1000);

                if (bot.entity.position.distanceTo(ore.position) < 5) {
                    await bot.dig(ore);

                    // Check surrounding blocks for more ore
                    const offsets = [
                        new Vec3(1, 0, 0), new Vec3(-1, 0, 0),
                        new Vec3(0, 1, 0), new Vec3(0, -1, 0),
                        new Vec3(0, 0, 1), new Vec3(0, 0, -1)
                    ];

                    for (const offset of offsets) {
                        const adjacentBlock = bot.blockAt(ore.position.plus(offset));
                        if (adjacentBlock && ores.includes(adjacentBlock.name)) {
                            await bot.dig(adjacentBlock);
                            await this.sleep(100);
                        }
                    }
                }
            }
        } catch (error) {
            // Efficient mining failed
        }
    }

    // 204: Strip Mine - Y=11 strip mining pattern
    async stripMine(bot) {
        try {
            // Go to Y=11 (diamond level)
            if (bot.entity.position.y > 11) {
                await this.utils.digDown(bot);
            } else if (bot.entity.position.y < 11) {
                // Build up to Y=11
                const blockItem = bot.inventory.items().find(item =>
                    item.name.includes('cobblestone') || item.name.includes('dirt')
                );
                if (blockItem) {
                    await bot.equip(blockItem, 'hand');
                    const referenceBlock = bot.blockAt(bot.entity.position.offset(0, -1, 0));
                    if (referenceBlock) {
                        await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
                    }
                }
            } else {
                // At Y=11 - mine forward
                await this.utils.digForward(bot);
                bot.setControlState('forward', true);
                await this.sleep(500);
                bot.setControlState('forward', false);
            }
        } catch (error) {
            // Strip mining failed
        }
    }

    // 205: Branch Mine - Create branch mining pattern
    async branchMine(bot) {
        try {
            // Create branches every 3 blocks
            await this.selectOptimalTool(bot);

            // Mine forward for 3 blocks
            for (let i = 0; i < 3; i++) {
                await this.utils.digForward(bot);
                bot.setControlState('forward', true);
                await this.sleep(400);
                bot.setControlState('forward', false);
            }

            // Turn and create branch
            const randomDirection = Math.random() > 0.5 ? 'left' : 'right';
            bot.setControlState(randomDirection, true);
            await this.sleep(300);
            bot.setControlState(randomDirection, false);

            // Mine the branch
            for (let i = 0; i < 5; i++) {
                await this.utils.digForward(bot);
                bot.setControlState('forward', true);
                await this.sleep(400);
                bot.setControlState('forward', false);
            }
        } catch (error) {
            // Branch mining failed
        }
    }

    // 206: Cave Mining - Explore caves for ores
    async caveMining(bot) {
        try {
            // Look for natural caves (air pockets underground)
            if (bot.entity.position.y < 50) {
                // We're underground - look for ores
                await this.efficientMining(bot);
            } else {
                // Go underground first
                await this.utils.digDown(bot);
            }

            // Follow cave systems
            const air = bot.findBlock({
                matching: block => block.name === 'air',
                maxDistance: 16
            });

            if (air && air.position.y < bot.entity.position.y) {
                // Move toward cave opening
                bot.pathfinder.setGoal(new GoalNear(air.position.x, air.position.y, air.position.z, 2), true);
                await this.sleep(2000);
            }
        } catch (error) {
            // Cave mining failed
        }
    }

    // 207: Fortune Mining - Use fortune pickaxe on valuable ores
    async fortuneMining(bot) {
        try {
            // Look for fortune pickaxe
            const fortunePick = bot.inventory.items().find(item =>
                item.name.includes('pickaxe') &&
                item.nbt && item.nbt.value.Enchantments &&
                item.nbt.value.Enchantments.value.some(e =>
                    e.value && e.value.id && e.value.id.value.includes('fortune')
                )
            );

            if (fortunePick) {
                // Look for valuable ores (diamond, lapis, redstone, emerald)
                const valuableOres = ['diamond_ore', 'deepslate_diamond_ore', 'lapis_ore',
                                     'redstone_ore', 'emerald_ore', 'deepslate_lapis_ore'];

                const ore = bot.findBlock({
                    matching: block => valuableOres.includes(block.name),
                    maxDistance: 32
                });

                if (ore) {
                    // Equip fortune pickaxe
                    await bot.equip(fortunePick, 'hand');

                    // Mine the ore
                    bot.pathfinder.setGoal(new GoalBlock(ore.position.x, ore.position.y, ore.position.z), true);
                    await this.sleep(1000);

                    if (bot.entity.position.distanceTo(ore.position) < 5) {
                        await bot.dig(ore);
                    }
                }
            } else {
                // No fortune pickaxe - use regular efficient mining
                await this.efficientMining(bot);
            }
        } catch (error) {
            // Fortune mining failed
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = Optimization;
