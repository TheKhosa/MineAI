/**
 * ML Action Space - Defines all possible actions and executes them via mineflayer
 * Actions range from low-level (move, look) to high-level (mine nearest ore, attack mob)
 */

const { goals } = require('mineflayer-pathfinder');
const { GoalNear, GoalBlock, GoalFollow, GoalXZ } = goals;
const Vec3 = require('vec3');

class ActionSpace {
    constructor() {
        // Define all possible actions
        this.actions = [
            // === MOVEMENT ACTIONS (0-9) ===
            { id: 0, name: 'move_forward', type: 'movement', execute: this.moveForward },
            { id: 1, name: 'move_backward', type: 'movement', execute: this.moveBackward },
            { id: 2, name: 'move_left', type: 'movement', execute: this.moveLeft },
            { id: 3, name: 'move_right', type: 'movement', execute: this.moveRight },
            { id: 4, name: 'jump', type: 'movement', execute: this.jump },
            { id: 5, name: 'sneak', type: 'movement', execute: this.sneak },
            { id: 6, name: 'stop_moving', type: 'movement', execute: this.stopMoving },
            { id: 7, name: 'sprint', type: 'movement', execute: this.sprint },
            { id: 8, name: 'look_around', type: 'movement', execute: this.lookAround },
            { id: 9, name: 'random_walk', type: 'movement', execute: this.randomWalk },

            // === INTERACTION ACTIONS (10-19) ===
            { id: 10, name: 'dig_forward', type: 'interaction', execute: this.digForward },
            { id: 11, name: 'dig_down', type: 'interaction', execute: this.digDown },
            { id: 12, name: 'dig_up', type: 'interaction', execute: this.digUp },
            { id: 13, name: 'place_block', type: 'interaction', execute: this.placeBlock },
            { id: 14, name: 'attack_nearest', type: 'interaction', execute: this.attackNearest },
            { id: 15, name: 'use_item', type: 'interaction', execute: this.useItem },
            { id: 16, name: 'equip_best_tool', type: 'interaction', execute: this.equipBestTool },
            { id: 17, name: 'eat_food', type: 'interaction', execute: this.eatFood },
            { id: 18, name: 'open_nearby_chest', type: 'interaction', execute: this.openNearbyChest },
            { id: 19, name: 'activate_block', type: 'interaction', execute: this.activateBlock },

            // === HIGH-LEVEL RESOURCE GATHERING (20-29) ===
            { id: 20, name: 'mine_nearest_ore', type: 'gather', execute: this.mineNearestOre },
            { id: 21, name: 'chop_nearest_tree', type: 'gather', execute: this.chopNearestTree },
            { id: 22, name: 'collect_nearest_item', type: 'gather', execute: this.collectNearestItem },
            { id: 23, name: 'mine_stone', type: 'gather', execute: this.mineStone },
            { id: 24, name: 'search_for_resources', type: 'gather', execute: this.searchForResources },
            { id: 25, name: 'gather_food', type: 'gather', execute: this.gatherFood },
            { id: 26, name: 'fish', type: 'gather', execute: this.fish },
            { id: 27, name: 'farm_crops', type: 'gather', execute: this.farmCrops },
            { id: 28, name: 'mine_deep', type: 'gather', execute: this.mineDeep },
            { id: 29, name: 'surface_explore', type: 'gather', execute: this.surfaceExplore },

            // === COMBAT ACTIONS (30-34) ===
            { id: 30, name: 'fight_zombie', type: 'combat', execute: this.fightZombie },
            { id: 31, name: 'fight_skeleton', type: 'combat', execute: this.fightSkeleton },
            { id: 32, name: 'fight_creeper', type: 'combat', execute: this.fightCreeper },
            { id: 33, name: 'defend_position', type: 'combat', execute: this.defendPosition },
            { id: 34, name: 'retreat', type: 'combat', execute: this.retreat },

            // === CRAFTING & BUILDING (35-39) ===
            { id: 35, name: 'craft_tools', type: 'craft', execute: this.craftTools },
            { id: 36, name: 'craft_weapons', type: 'craft', execute: this.craftWeapons },
            { id: 37, name: 'smelt_ores', type: 'craft', execute: this.smeltOres },
            { id: 38, name: 'build_structure', type: 'craft', execute: this.buildStructure },
            { id: 39, name: 'place_torch', type: 'craft', execute: this.placeTorch },

            // === SOCIAL & TRADING (40-49) - EXPANDED FOR COOPERATION ===
            { id: 40, name: 'find_agent', type: 'social', execute: this.findAgent },
            { id: 41, name: 'trade_with_agent', type: 'social', execute: this.tradeWithAgent },
            { id: 42, name: 'follow_agent', type: 'social', execute: this.followAgent },
            { id: 43, name: 'share_resources', type: 'social', execute: this.shareResources },
            { id: 44, name: 'request_help', type: 'social', execute: this.requestHelp },
            { id: 45, name: 'gather_near_agents', type: 'social', execute: this.gatherNearAgents },
            { id: 46, name: 'coordinate_mining', type: 'social', execute: this.coordinateMining },
            { id: 47, name: 'build_together', type: 'social', execute: this.buildTogether },
            { id: 48, name: 'defend_ally', type: 'social', execute: this.defendAlly },
            { id: 49, name: 'celebrate_achievement', type: 'social', execute: this.celebrateAchievement },

            // === VILLAGE BUILDING (50-59) - NEW: Emergent village creation ===
            { id: 50, name: 'place_crafting_table', type: 'building', execute: this.placeCraftingTable },
            { id: 51, name: 'place_furnace', type: 'building', execute: this.placeFurnace },
            { id: 52, name: 'place_chest', type: 'building', execute: this.placeChest },
            { id: 53, name: 'build_wall', type: 'building', execute: this.buildWall },
            { id: 54, name: 'build_floor', type: 'building', execute: this.buildFloor },
            { id: 55, name: 'light_area', type: 'building', execute: this.lightArea },
            { id: 56, name: 'create_path', type: 'building', execute: this.createPath },
            { id: 57, name: 'build_shelter_structure', type: 'building', execute: this.buildShelterStructure },
            { id: 58, name: 'claim_territory', type: 'building', execute: this.claimTerritory },
            { id: 59, name: 'improve_infrastructure', type: 'building', execute: this.improveInfrastructure },

            // === UTILITY (60-69) ===
            { id: 60, name: 'idle', type: 'utility', execute: this.idle },
            { id: 61, name: 'go_to_surface', type: 'utility', execute: this.goToSurface },
            { id: 62, name: 'go_underground', type: 'utility', execute: this.goUnderground },
            { id: 63, name: 'find_shelter', type: 'utility', execute: this.findShelter },
            { id: 64, name: 'return_to_village', type: 'utility', execute: this.returnToVillage },
            { id: 65, name: 'rest_and_observe', type: 'utility', execute: this.restAndObserve },
            { id: 66, name: 'seek_adventure', type: 'utility', execute: this.seekAdventure },
            { id: 67, name: 'pursue_achievement', type: 'utility', execute: this.pursueAchievement },
            { id: 68, name: 'satisfy_needs', type: 'utility', execute: this.satisfyNeeds },
            { id: 69, name: 'express_mood', type: 'utility', execute: this.expressMood },
        ];

        this.ACTION_COUNT = this.actions.length;
    }

    /**
     * Execute an action by ID
     */
    async executeAction(actionId, bot) {
        if (actionId < 0 || actionId >= this.ACTION_COUNT) {
            console.log(`[ML ACTION] Invalid action ID: ${actionId}`);
            return false;
        }

        const action = this.actions[actionId];
        try {
            await action.execute.call(this, bot);
            return true;
        } catch (error) {
            // Silently handle errors - many actions may fail (e.g., no tree nearby)
            return false;
        }
    }

    /**
     * Get action name by ID
     */
    getActionName(actionId) {
        return this.actions[actionId]?.name || 'unknown';
    }

    // ===== MOVEMENT ACTIONS =====
    async moveForward(bot) {
        bot.setControlState('forward', true);
        await this.sleep(500);
        bot.setControlState('forward', false);
    }

    async moveBackward(bot) {
        bot.setControlState('back', true);
        await this.sleep(500);
        bot.setControlState('back', false);
    }

    async moveLeft(bot) {
        bot.setControlState('left', true);
        await this.sleep(500);
        bot.setControlState('left', false);
    }

    async moveRight(bot) {
        bot.setControlState('right', true);
        await this.sleep(500);
        bot.setControlState('right', false);
    }

    async jump(bot) {
        bot.setControlState('jump', true);
        await this.sleep(200);
        bot.setControlState('jump', false);
    }

    async sneak(bot) {
        bot.setControlState('sneak', true);
        await this.sleep(1000);
        bot.setControlState('sneak', false);
    }

    async stopMoving(bot) {
        bot.clearControlStates();
    }

    async sprint(bot) {
        bot.setControlState('sprint', true);
        bot.setControlState('forward', true);
        await this.sleep(1000);
        bot.clearControlStates();
    }

    async lookAround(bot) {
        const yaw = bot.entity.yaw + (Math.random() - 0.5) * Math.PI;
        const pitch = (Math.random() - 0.5) * Math.PI / 4;
        await bot.look(yaw, pitch);
    }

    async randomWalk(bot) {
        const randomPos = bot.entity.position.offset(
            (Math.random() - 0.5) * 20,
            0,
            (Math.random() - 0.5) * 20
        );
        bot.pathfinder.setGoal(new GoalNear(randomPos.x, randomPos.y, randomPos.z, 1), true);
        await this.sleep(2000);
    }

    // ===== INTERACTION ACTIONS =====
    async digForward(bot) {
        const block = bot.blockAtCursor(4);
        if (block && block.name !== 'air' && block.name !== 'water' && block.name !== 'lava') {
            await bot.dig(block);
        }
    }

    async digDown(bot) {
        const below = bot.blockAt(bot.entity.position.offset(0, -1, 0));
        if (below && below.name !== 'air' && below.name !== 'bedrock') {
            await bot.dig(below);
        }
    }

    async digUp(bot) {
        const above = bot.blockAt(bot.entity.position.offset(0, 2, 0));
        if (above && above.name !== 'air') {
            await bot.dig(above);
        }
    }

    async placeBlock(bot) {
        const referenceBlock = bot.blockAt(bot.entity.position.offset(0, -1, 0));
        const blockItem = bot.inventory.items().find(item =>
            item.name.includes('cobblestone') || item.name.includes('dirt') || item.name.includes('stone')
        );
        if (blockItem && referenceBlock) {
            await bot.equip(blockItem, 'hand');
            await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
        }
    }

    async attackNearest(bot) {
        const hostileMobs = ['zombie', 'skeleton', 'spider', 'creeper', 'enderman'];
        const entity = Object.values(bot.entities).find(e =>
            e.position &&
            hostileMobs.includes(e.name) &&
            e.position.distanceTo(bot.entity.position) < 4
        );
        if (entity) {
            await bot.attack(entity);
        }
    }

    async useItem(bot) {
        await bot.activateItem();
        await this.sleep(500);
        await bot.deactivateItem();
    }

    async equipBestTool(bot) {
        const tools = bot.inventory.items().filter(item =>
            item.name.includes('pickaxe') || item.name.includes('axe') || item.name.includes('sword')
        );
        if (tools.length > 0) {
            // Prefer diamond > iron > stone > wood
            const best = tools.sort((a, b) => {
                const scoreA = a.name.includes('diamond') ? 4 : a.name.includes('iron') ? 3 :
                              a.name.includes('stone') ? 2 : 1;
                const scoreB = b.name.includes('diamond') ? 4 : b.name.includes('iron') ? 3 :
                              b.name.includes('stone') ? 2 : 1;
                return scoreB - scoreA;
            })[0];
            await bot.equip(best, 'hand');
        }
    }

    async eatFood(bot) {
        if (bot.food < 18) {
            const foods = ['cooked_beef', 'cooked_porkchop', 'bread', 'apple', 'cooked_chicken'];
            const food = bot.inventory.items().find(item => foods.includes(item.name));
            if (food) {
                await bot.equip(food, 'hand');
                await bot.consume();
            }
        }
    }

    async openNearbyChest(bot) {
        const chest = bot.findBlock({
            matching: block => block.name === 'chest',
            maxDistance: 4
        });
        if (chest) {
            const chestContainer = await bot.openContainer(chest);
            await this.sleep(500);
            chestContainer.close();
        }
    }

    async activateBlock(bot) {
        const block = bot.blockAtCursor(4);
        if (block) {
            await bot.activateBlock(block);
        }
    }

    // ===== HIGH-LEVEL GATHERING ACTIONS =====
    async mineNearestOre(bot) {
        const ores = ['coal_ore', 'iron_ore', 'diamond_ore', 'gold_ore', 'deepslate_iron_ore', 'deepslate_diamond_ore'];
        const ore = bot.findBlock({
            matching: block => ores.includes(block.name),
            maxDistance: 32
        });
        if (ore) {
            await this.equipBestTool(bot);
            bot.pathfinder.setGoal(new GoalBlock(ore.position.x, ore.position.y, ore.position.z), true);
            await this.sleep(1000);
            if (bot.entity.position.distanceTo(ore.position) < 5) {
                await bot.dig(ore);
            }
        }
    }

    async chopNearestTree(bot) {
        const logs = ['oak_log', 'birch_log', 'spruce_log', 'jungle_log'];
        const log = bot.findBlock({
            matching: block => logs.includes(block.name),
            maxDistance: 32
        });
        if (log) {
            await this.equipBestTool(bot);
            bot.pathfinder.setGoal(new GoalBlock(log.position.x, log.position.y, log.position.z), true);
            await this.sleep(1000);
            if (bot.entity.position.distanceTo(log.position) < 5) {
                await bot.dig(log);
            }
        }
    }

    async collectNearestItem(bot) {
        const items = Object.values(bot.entities).filter(e =>
            e.type === 'object' &&
            e.displayName === 'Item' &&
            e.position &&
            e.position.distanceTo(bot.entity.position) < 16
        );
        if (items.length > 0) {
            const nearest = items[0];
            bot.pathfinder.setGoal(new GoalNear(nearest.position.x, nearest.position.y, nearest.position.z, 1), true);
            await this.sleep(1000);
        }
    }

    async mineStone(bot) {
        const stone = bot.findBlock({
            matching: block => block.name === 'stone' || block.name === 'cobblestone',
            maxDistance: 16
        });
        if (stone) {
            await this.equipBestTool(bot);
            await bot.dig(stone);
        }
    }

    async searchForResources(bot) {
        // Move in a search pattern
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 20;
        const targetPos = bot.entity.position.offset(
            Math.cos(angle) * dist,
            0,
            Math.sin(angle) * dist
        );
        bot.pathfinder.setGoal(new GoalNear(targetPos.x, targetPos.y, targetPos.z, 2), true);
        await this.sleep(3000);
    }

    async gatherFood(bot) {
        const animals = ['cow', 'pig', 'sheep', 'chicken'];
        const animal = Object.values(bot.entities).find(e =>
            animals.includes(e.name) &&
            e.position &&
            e.position.distanceTo(bot.entity.position) < 16
        );
        if (animal) {
            await bot.attack(animal);
        }
    }

    async fish(bot) {
        // Simple fishing logic
        const water = bot.findBlock({
            matching: block => block.name === 'water',
            maxDistance: 16
        });
        if (water) {
            const rod = bot.inventory.items().find(item => item.name === 'fishing_rod');
            if (rod) {
                await bot.equip(rod, 'hand');
                await bot.activateItem();
                await this.sleep(5000);
                await bot.deactivateItem();
            }
        }
    }

    async farmCrops(bot) {
        const crops = ['wheat', 'carrots', 'potatoes', 'beetroots'];
        const crop = bot.findBlock({
            matching: block => crops.includes(block.name),
            maxDistance: 16
        });
        if (crop) {
            await bot.dig(crop);
        }
    }

    async mineDeep(bot) {
        if (bot.entity.position.y > 16) {
            await this.digDown(bot);
        }
    }

    async surfaceExplore(bot) {
        const randomAngle = Math.random() * Math.PI * 2;
        const targetPos = bot.entity.position.offset(
            Math.cos(randomAngle) * 30,
            0,
            Math.sin(randomAngle) * 30
        );
        bot.pathfinder.setGoal(new GoalXZ(targetPos.x, targetPos.z), true);
        await this.sleep(2000);
    }

    // ===== COMBAT ACTIONS =====
    async fightZombie(bot) {
        const zombie = Object.values(bot.entities).find(e =>
            e.name === 'zombie' &&
            e.position &&
            e.position.distanceTo(bot.entity.position) < 16
        );
        if (zombie) {
            await this.equipBestTool(bot);
            await bot.attack(zombie);
        }
    }

    async fightSkeleton(bot) {
        const skeleton = Object.values(bot.entities).find(e =>
            e.name === 'skeleton' &&
            e.position &&
            e.position.distanceTo(bot.entity.position) < 16
        );
        if (skeleton) {
            await this.equipBestTool(bot);
            bot.pathfinder.setGoal(new GoalFollow(skeleton, 2), true);
            await this.sleep(500);
            await bot.attack(skeleton);
        }
    }

    async fightCreeper(bot) {
        const creeper = Object.values(bot.entities).find(e =>
            e.name === 'creeper' &&
            e.position &&
            e.position.distanceTo(bot.entity.position) < 16
        );
        if (creeper) {
            const dist = creeper.position.distanceTo(bot.entity.position);
            if (dist < 3) {
                await this.retreat(bot);
            } else {
                await this.equipBestTool(bot);
                await bot.attack(creeper);
            }
        }
    }

    async defendPosition(bot) {
        const hostiles = Object.values(bot.entities).filter(e =>
            ['zombie', 'skeleton', 'spider', 'creeper'].includes(e.name) &&
            e.position &&
            e.position.distanceTo(bot.entity.position) < 8
        );
        if (hostiles.length > 0) {
            await this.equipBestTool(bot);
            await bot.attack(hostiles[0]);
        }
    }

    async retreat(bot) {
        const hostiles = Object.values(bot.entities).filter(e =>
            ['zombie', 'skeleton', 'spider', 'creeper'].includes(e.name) &&
            e.position &&
            e.position.distanceTo(bot.entity.position) < 16
        );

        if (hostiles.length > 0) {
            const avgPos = hostiles.reduce((acc, e) => acc.plus(e.position), new Vec3(0, 0, 0))
                .scaled(1 / hostiles.length);
            const escapeDir = bot.entity.position.minus(avgPos).normalize();
            const escapePos = bot.entity.position.plus(escapeDir.scaled(20));
            bot.pathfinder.setGoal(new GoalNear(escapePos.x, escapePos.y, escapePos.z, 1), true);
            await this.sleep(2000);
        }
    }

    // ===== CRAFTING ACTIONS =====
    async craftTools(bot) {
        // Simplified - just equip crafting table if available
        const craftingTable = bot.findBlock({
            matching: block => block.name === 'crafting_table',
            maxDistance: 4
        });
        if (craftingTable) {
            // Complex crafting logic would go here
        }
    }

    async craftWeapons(bot) {
        await this.craftTools(bot);
    }

    async smeltOres(bot) {
        const furnace = bot.findBlock({
            matching: block => block.name === 'furnace',
            maxDistance: 4
        });
        if (furnace) {
            // Complex smelting logic would go here
        }
    }

    async buildStructure(bot) {
        await this.placeBlock(bot);
    }

    async placeTorch(bot) {
        const torch = bot.inventory.items().find(item => item.name === 'torch');
        if (torch) {
            const referenceBlock = bot.blockAt(bot.entity.position.offset(1, 0, 0));
            if (referenceBlock && referenceBlock.name !== 'air') {
                await bot.equip(torch, 'hand');
                await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
            }
        }
    }

    // ===== SOCIAL ACTIONS =====
    async findAgent(bot) {
        const agents = Object.values(bot.entities).filter(e =>
            e.type === 'player' &&
            e.username !== bot.username &&
            e.position &&
            e.position.distanceTo(bot.entity.position) < 32
        );
        if (agents.length > 0) {
            const target = agents[0];
            bot.pathfinder.setGoal(new GoalNear(target.position.x, target.position.y, target.position.z, 3), true);
            await this.sleep(2000);
        }
    }

    async tradeWithAgent(bot) {
        // This would integrate with existing trade beacon system
        await this.findAgent(bot);
    }

    async followAgent(bot) {
        const agents = Object.values(bot.entities).filter(e =>
            e.type === 'player' &&
            e.username !== bot.username &&
            e.position &&
            e.position.distanceTo(bot.entity.position) < 16
        );
        if (agents.length > 0) {
            bot.pathfinder.setGoal(new GoalFollow(agents[0], 2), true);
            await this.sleep(2000);
        }
    }

    async shareResources(bot) {
        // This would integrate with existing resource sharing
        await this.tradeWithAgent(bot);
    }

    async requestHelp(bot) {
        // Could broadcast via chat
        const nearbyAgent = Object.values(bot.entities).find(e =>
            e.type === 'player' &&
            e.username !== bot.username &&
            e.position &&
            e.position.distanceTo(bot.entity.position) < 16
        );
        if (nearbyAgent) {
            bot.chat(`Need help! Health: ${bot.health}`);
        }
    }

    // ===== UTILITY ACTIONS =====
    async idle(bot) {
        await this.sleep(1000);
    }

    async goToSurface(bot) {
        if (bot.entity.position.y < 60) {
            const surfacePos = bot.entity.position.offset(0, 60 - bot.entity.position.y, 0);
            bot.pathfinder.setGoal(new GoalNear(surfacePos.x, surfacePos.y, surfacePos.z, 2), true);
            await this.sleep(3000);
        }
    }

    async goUnderground(bot) {
        if (bot.entity.position.y > 40) {
            await this.digDown(bot);
        }
    }

    async findShelter(bot) {
        // Look for existing structure or dig into hillside
        const solidBlocks = ['stone', 'cobblestone', 'dirt'];
        const shelter = bot.findBlock({
            matching: block => solidBlocks.includes(block.name),
            maxDistance: 16
        });
        if (shelter) {
            bot.pathfinder.setGoal(new GoalNear(shelter.position.x, shelter.position.y, shelter.position.z, 2), true);
            await this.sleep(2000);
        }
    }

    async returnToVillage(bot) {
        // Return to spawn area (simplified)
        const spawn = new Vec3(0, 64, 0); // Default spawn
        bot.pathfinder.setGoal(new GoalNear(spawn.x, spawn.y, spawn.z, 16), true);
        await this.sleep(3000);
    }

    // ===== NEW COOPERATIVE ACTIONS (45-49) =====
    async gatherNearAgents(bot) {
        // Move toward the nearest cluster of agents
        const agents = this.getNearbyAgents(bot);
        if (agents.length > 0) {
            // Calculate cluster center
            const center = agents.reduce((acc, a) => acc.plus(a.position), new Vec3(0, 0, 0))
                .scaled(1 / agents.length);
            bot.pathfinder.setGoal(new GoalNear(center.x, center.y, center.z, 3), true);
            await this.sleep(2000);
        }
    }

    async coordinateMining(bot) {
        // Mine near where other agents are mining
        const agents = this.getNearbyAgents(bot, 16);
        if (agents.length > 0) {
            // Find the closest agent
            const nearest = agents[0];
            // Mine blocks near that agent's position
            const targetPos = nearest.position.offset(
                (Math.random() - 0.5) * 4,
                -1,
                (Math.random() - 0.5) * 4
            );
            const block = bot.blockAt(targetPos);
            if (block && block.name !== 'air' && block.name !== 'bedrock') {
                await this.equipBestTool(bot);
                bot.pathfinder.setGoal(new GoalBlock(block.position.x, block.position.y, block.position.z), true);
                await this.sleep(1000);
                if (bot.entity.position.distanceTo(block.position) < 5) {
                    await bot.dig(block);
                }
            }
        }
    }

    async buildTogether(bot) {
        // Place blocks near where other agents are building
        const agents = this.getNearbyAgents(bot, 12);
        if (agents.length > 0) {
            const nearest = agents[0];
            // Place blocks near the nearest agent
            const targetPos = nearest.position.offset(
                (Math.random() - 0.5) * 6,
                0,
                (Math.random() - 0.5) * 6
            );
            const referenceBlock = bot.blockAt(targetPos.offset(0, -1, 0));
            const buildingBlock = bot.inventory.items().find(item =>
                item.name.includes('cobblestone') || item.name.includes('stone') ||
                item.name.includes('planks') || item.name.includes('dirt')
            );
            if (buildingBlock && referenceBlock && referenceBlock.name !== 'air') {
                await bot.equip(buildingBlock, 'hand');
                bot.pathfinder.setGoal(new GoalNear(targetPos.x, targetPos.y, targetPos.z, 2), true);
                await this.sleep(1000);
                if (bot.entity.position.distanceTo(targetPos) < 5) {
                    await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
                }
            }
        }
    }

    async defendAlly(bot) {
        // Attack mobs that are near other agents
        const agents = this.getNearbyAgents(bot, 16);
        if (agents.length > 0) {
            const hostileMobs = ['zombie', 'skeleton', 'spider', 'creeper'];
            // Find mobs near any agent
            const threateningMob = Object.values(bot.entities).find(e =>
                hostileMobs.includes(e.name) &&
                e.position &&
                agents.some(agent => e.position.distanceTo(agent.position) < 8)
            );
            if (threateningMob) {
                await this.equipBestTool(bot);
                bot.pathfinder.setGoal(new GoalNear(threateningMob.position.x, threateningMob.position.y, threateningMob.position.z, 2), true);
                await this.sleep(1000);
                if (bot.entity.position.distanceTo(threateningMob.position) < 4) {
                    await bot.attack(threateningMob);
                }
            }
        }
    }

    async celebrateAchievement(bot) {
        // Jump and look around when near other agents (social reinforcement)
        const agents = this.getNearbyAgents(bot, 8);
        if (agents.length > 0) {
            // Celebratory jump
            await this.jump(bot);
            await this.sleep(200);
            await this.jump(bot);
            // Look at nearby agent
            const nearest = agents[0];
            await bot.lookAt(nearest.position.offset(0, 1, 0));
        }
    }

    // ===== NEW VILLAGE BUILDING ACTIONS (50-59) =====
    async placeCraftingTable(bot) {
        const craftingTable = bot.inventory.items().find(item => item.name === 'crafting_table');
        if (craftingTable) {
            const referenceBlock = bot.blockAt(bot.entity.position.offset(2, 0, 0));
            if (referenceBlock && referenceBlock.name !== 'air') {
                await bot.equip(craftingTable, 'hand');
                await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
            }
        } else {
            // Try to craft one if we have planks
            const planks = bot.inventory.items().find(item => item.name.includes('planks'));
            if (planks && planks.count >= 4) {
                await bot.craft(bot.registry.recipesByName['crafting_table'][0], 1);
            }
        }
    }

    async placeFurnace(bot) {
        const furnace = bot.inventory.items().find(item => item.name === 'furnace');
        if (furnace) {
            const referenceBlock = bot.blockAt(bot.entity.position.offset(2, 0, 0));
            if (referenceBlock && referenceBlock.name !== 'air') {
                await bot.equip(furnace, 'hand');
                await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
            }
        }
    }

    async placeChest(bot) {
        const chest = bot.inventory.items().find(item => item.name === 'chest');
        if (chest) {
            // Place chest in a central location if near other agents
            const agents = this.getNearbyAgents(bot, 16);
            let targetPos = bot.entity.position.offset(2, 0, 0);
            if (agents.length > 0) {
                // Place chest at cluster center for sharing
                const center = agents.reduce((acc, a) => acc.plus(a.position), bot.entity.position)
                    .scaled(1 / (agents.length + 1));
                targetPos = center;
            }
            const referenceBlock = bot.blockAt(targetPos.offset(0, -1, 0));
            if (referenceBlock && referenceBlock.name !== 'air') {
                await bot.equip(chest, 'hand');
                bot.pathfinder.setGoal(new GoalNear(targetPos.x, targetPos.y, targetPos.z, 2), true);
                await this.sleep(1000);
                if (bot.entity.position.distanceTo(targetPos) < 5) {
                    await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
                }
            }
        }
    }

    async buildWall(bot) {
        // Place a short line of blocks (wall segment)
        const blockItem = bot.inventory.items().find(item =>
            item.name.includes('cobblestone') || item.name.includes('stone') || item.name.includes('planks')
        );
        if (blockItem && blockItem.count >= 3) {
            await bot.equip(blockItem, 'hand');
            // Place 3 blocks in a line
            for (let i = 0; i < 3; i++) {
                const offset = new Vec3(i, 0, 0);
                const referenceBlock = bot.blockAt(bot.entity.position.offset(offset.x, -1, offset.z));
                if (referenceBlock && referenceBlock.name !== 'air') {
                    try {
                        await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
                        await this.sleep(200);
                    } catch (err) {
                        // Block placement failed, continue
                    }
                }
            }
        }
    }

    async buildFloor(bot) {
        // Place blocks in a small 3x3 floor pattern
        const blockItem = bot.inventory.items().find(item =>
            item.name.includes('cobblestone') || item.name.includes('stone') ||
            item.name.includes('planks') || item.name.includes('dirt')
        );
        if (blockItem && blockItem.count >= 5) {
            await bot.equip(blockItem, 'hand');
            // Place blocks in a pattern
            const offsets = [
                new Vec3(0, -1, 0), new Vec3(1, -1, 0), new Vec3(-1, -1, 0),
                new Vec3(0, -1, 1), new Vec3(0, -1, -1)
            ];
            for (const offset of offsets) {
                const targetBlock = bot.blockAt(bot.entity.position.offset(offset.x, offset.y, offset.z));
                if (targetBlock && targetBlock.name === 'air') {
                    const referenceBlock = bot.blockAt(bot.entity.position.offset(offset.x, offset.y - 1, offset.z));
                    if (referenceBlock && referenceBlock.name !== 'air') {
                        try {
                            await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
                            await this.sleep(200);
                        } catch (err) {
                            // Continue on error
                        }
                    }
                }
            }
        }
    }

    async lightArea(bot) {
        // Place torches around the current position
        const torch = bot.inventory.items().find(item => item.name === 'torch');
        if (torch) {
            await bot.equip(torch, 'hand');
            // Try to place torch on nearby wall
            const offsets = [new Vec3(2, 0, 0), new Vec3(-2, 0, 0), new Vec3(0, 0, 2), new Vec3(0, 0, -2)];
            for (const offset of offsets) {
                const referenceBlock = bot.blockAt(bot.entity.position.offset(offset.x, offset.y, offset.z));
                if (referenceBlock && referenceBlock.name !== 'air' && !referenceBlock.name.includes('torch')) {
                    try {
                        await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
                        break; // Place one torch
                    } catch (err) {
                        // Try next position
                    }
                }
            }
        }
    }

    async createPath(bot) {
        // Place blocks in a line (path toward nearest agent or spawn)
        const agents = this.getNearbyAgents(bot, 32);
        let direction = new Vec3(1, 0, 0); // Default direction
        if (agents.length > 0) {
            // Path toward nearest agent
            direction = agents[0].position.minus(bot.entity.position).normalize();
        }
        const blockItem = bot.inventory.items().find(item =>
            item.name.includes('cobblestone') || item.name.includes('dirt') || item.name.includes('stone')
        );
        if (blockItem && blockItem.count >= 3) {
            await bot.equip(blockItem, 'hand');
            for (let i = 1; i <= 3; i++) {
                const targetPos = bot.entity.position.plus(direction.scaled(i));
                const referenceBlock = bot.blockAt(targetPos.offset(0, -1, 0));
                if (referenceBlock && referenceBlock.name === 'air') {
                    const belowRef = bot.blockAt(targetPos.offset(0, -2, 0));
                    if (belowRef && belowRef.name !== 'air') {
                        try {
                            await bot.placeBlock(belowRef, new Vec3(0, 1, 0));
                            await this.sleep(200);
                        } catch (err) {
                            // Continue
                        }
                    }
                }
            }
        }
    }

    async buildShelterStructure(bot) {
        // Build a simple 2-block high wall segment (shelter start)
        const blockItem = bot.inventory.items().find(item =>
            item.name.includes('cobblestone') || item.name.includes('stone') || item.name.includes('dirt')
        );
        if (blockItem && blockItem.count >= 4) {
            await bot.equip(blockItem, 'hand');
            // Place 2 blocks vertically
            const referenceBlock = bot.blockAt(bot.entity.position.offset(2, -1, 0));
            if (referenceBlock && referenceBlock.name !== 'air') {
                try {
                    await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
                    await this.sleep(300);
                    const secondBlock = bot.blockAt(bot.entity.position.offset(2, 0, 0));
                    if (secondBlock) {
                        await bot.placeBlock(secondBlock, new Vec3(0, 1, 0));
                    }
                } catch (err) {
                    // Continue
                }
            }
        }
    }

    async claimTerritory(bot) {
        // Place markers (torches or blocks) around an area
        const marker = bot.inventory.items().find(item => item.name === 'torch');
        if (marker) {
            await bot.equip(marker, 'hand');
            // Place torches in a square pattern
            const corners = [
                new Vec3(5, 0, 5), new Vec3(5, 0, -5),
                new Vec3(-5, 0, 5), new Vec3(-5, 0, -5)
            ];
            for (const corner of corners) {
                const referenceBlock = bot.blockAt(bot.entity.position.offset(corner.x, corner.y - 1, corner.z));
                if (referenceBlock && referenceBlock.name !== 'air') {
                    try {
                        bot.pathfinder.setGoal(new GoalNear(
                            bot.entity.position.x + corner.x,
                            bot.entity.position.y,
                            bot.entity.position.z + corner.z,
                            1
                        ), true);
                        await this.sleep(500);
                        await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
                    } catch (err) {
                        // Continue
                    }
                }
            }
        }
    }

    async improveInfrastructure(bot) {
        // Look for existing structures and improve them (add torches, repair walls, etc.)
        const nearby = this.getNearbyAgents(bot, 16);
        if (nearby.length > 0) {
            // Check for structures nearby
            const structures = ['crafting_table', 'furnace', 'chest'];
            const structure = bot.findBlock({
                matching: block => structures.includes(block.name),
                maxDistance: 8
            });
            if (structure) {
                // Add torch near structure
                await this.lightArea(bot);
            } else {
                // Build new infrastructure
                await this.placeCraftingTable(bot);
            }
        }
    }

    // ===== NEW UTILITY ACTIONS (65-69) =====
    async restAndObserve(bot) {
        // Stop and observe surroundings (passive learning)
        bot.clearControlStates();
        await this.sleep(2000);
        // Look around slowly
        await this.lookAround(bot);
    }

    async seekAdventure(bot) {
        // Move away from clusters toward unexplored areas
        const agents = this.getNearbyAgents(bot, 32);
        let targetPos;
        if (agents.length > 0) {
            // Move away from cluster
            const center = agents.reduce((acc, a) => acc.plus(a.position), new Vec3(0, 0, 0))
                .scaled(1 / agents.length);
            const awayDir = bot.entity.position.minus(center).normalize();
            targetPos = bot.entity.position.plus(awayDir.scaled(30));
        } else {
            // Random exploration
            const angle = Math.random() * Math.PI * 2;
            targetPos = bot.entity.position.offset(
                Math.cos(angle) * 40,
                0,
                Math.sin(angle) * 40
            );
        }
        bot.pathfinder.setGoal(new GoalNear(targetPos.x, targetPos.y, targetPos.z, 5), true);
        await this.sleep(3000);
    }

    async pursueAchievement(bot) {
        // Behavior based on current achievement state
        if (bot.achievementProgress) {
            const progress = bot.achievementProgress;
            // Priority: diamonds > armor > nether
            if (!progress.hasDiamonds) {
                // Mine deep for diamonds
                await this.mineDeep(bot);
            } else if (!progress.hasIronArmor) {
                // Get iron and craft armor
                await this.mineNearestOre(bot);
            } else if (!progress.hasEnchantingTable) {
                // Gather resources for enchanting
                await this.mineNearestOre(bot);
            } else {
                // Explore for nether portal materials
                await this.searchForResources(bot);
            }
        } else {
            // Default: mine for resources
            await this.mineNearestOre(bot);
        }
    }

    async satisfyNeeds(bot) {
        // Address most urgent need (future: will use needs system)
        if (bot.food < 10) {
            await this.eatFood(bot);
        } else if (bot.health < 10) {
            await this.findShelter(bot);
        } else {
            // Default: gather resources
            await this.searchForResources(bot);
        }
    }

    async expressMood(bot) {
        // Express mood through actions (future: will use mood system)
        const health = bot.health / 20.0;
        const food = bot.food / 20.0;
        if (health > 0.8 && food > 0.8) {
            // Happy: jump
            await this.jump(bot);
        } else if (health < 0.3 || food < 0.3) {
            // Stressed: look around nervously
            await this.lookAround(bot);
            await this.sleep(200);
            await this.lookAround(bot);
        } else {
            // Neutral: idle
            await this.idle(bot);
        }
    }

    // ===== HELPER METHODS =====
    getNearbyAgents(bot, maxDistance = 32) {
        // Get list of nearby player agents sorted by distance
        const agents = [];
        if (global.activeAgents) {
            for (const [name, otherBot] of global.activeAgents) {
                if (otherBot !== bot && otherBot.entity && otherBot.entity.position) {
                    const dist = otherBot.entity.position.distanceTo(bot.entity.position);
                    if (dist < maxDistance) {
                        agents.push({
                            bot: otherBot,
                            position: otherBot.entity.position,
                            distance: dist,
                            name: name
                        });
                    }
                }
            }
        }
        // Sort by distance (closest first)
        return agents.sort((a, b) => a.distance - b.distance);
    }

    // Helper sleep function
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = ActionSpace;
