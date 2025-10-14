/**
 * ML State Encoder - Converts Mineflayer bot observations into neural network inputs
 * Encodes: position, health, inventory, nearby blocks, nearby entities, time, etc.
 */

const Vec3 = require('vec3');
const { getMemorySystem } = require('./agent_memory_system');
const { getSubSkillsSystem } = require('./ml_zomboid_skills');
const { getMoodlesSystem } = require('./ml_zomboid_moodles');

class StateEncoder {
    constructor() {
        // State vector dimensions
        this.STATE_SIZE = 429;  // Expanded to include Project Zomboid skills & moodles

        // Sub-vector sizes
        this.POSITION_SIZE = 3;
        this.HEALTH_SIZE = 4;       // health, food, saturation, oxygen
        this.INVENTORY_SIZE = 50;    // Top items encoded
        this.NEARBY_BLOCKS_SIZE = 125; // 5x5x5 voxel grid around agent
        this.NEARBY_ENTITIES_SIZE = 30; // Up to 10 entities, 3 features each
        this.ENVIRONMENTAL_SIZE = 10;  // Time, biome, weather, etc.
        this.GOAL_SIZE = 34;         // Current goal/task encoding
        this.SOCIAL_SIZE = 30;       // Nearby agents and cooperation signals
        this.ACHIEVEMENT_SIZE = 24;  // Achievement progress tracking
        this.CURIOSITY_SIZE = 10;    // Novelty and exploration signals
        this.NEEDS_SIZE = 10;        // Sims-style needs (hunger, energy, safety, social, etc.)
        this.MOODS_SIZE = 8;         // Emotional states (happiness, stress, boredom, etc.)
        this.RELATIONSHIPS_SIZE = 20; // Top relationships with bond strength
        this.MEMORY_SIZE = 7;        // Recent significant events
        this.SUBSKILLS_SIZE = 40;    // Project Zomboid sub-skills (20 skills × 2 values each)
        this.MOODLES_SIZE = 14;      // Project Zomboid moodles/debuffs (severity levels)

        // Block type vocabulary (most common blocks)
        this.BLOCK_VOCAB = [
            'air', 'stone', 'grass_block', 'dirt', 'cobblestone', 'oak_log', 'oak_planks',
            'coal_ore', 'iron_ore', 'diamond_ore', 'gold_ore', 'water', 'lava', 'sand',
            'gravel', 'oak_leaves', 'glass', 'chest', 'crafting_table', 'furnace',
            'wheat', 'oak_sapling', 'bedrock', 'obsidian', 'torch', 'deepslate',
            'deepslate_iron_ore', 'deepslate_diamond_ore', 'ancient_debris', 'netherrack'
        ];

        // Item vocabulary (most important items)
        this.ITEM_VOCAB = [
            'wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'diamond_pickaxe',
            'wooden_axe', 'stone_axe', 'iron_axe', 'diamond_axe',
            'wooden_sword', 'stone_sword', 'iron_sword', 'diamond_sword',
            'bow', 'arrow', 'shield', 'iron_helmet', 'iron_chestplate', 'iron_leggings', 'iron_boots',
            'coal', 'iron_ingot', 'diamond', 'gold_ingot', 'stick',
            'cobblestone', 'stone', 'dirt', 'oak_log', 'oak_planks',
            'bread', 'cooked_beef', 'apple', 'crafting_table', 'furnace', 'torch',
            'iron_ore', 'coal_ore', 'diamond_ore', 'wheat_seeds', 'wheat'
        ];

        // Entity types
        this.ENTITY_TYPES = [
            'player', 'zombie', 'skeleton', 'spider', 'creeper', 'enderman',
            'cow', 'pig', 'sheep', 'chicken', 'wolf', 'villager', 'iron_golem',
            'arrow', 'item', 'experience_orb'
        ];
    }

    /**
     * Encode the full bot state into a fixed-size vector
     */
    encodeState(bot) {
        const state = new Float32Array(this.STATE_SIZE);
        let offset = 0;

        // 1. Position encoding (3 values: x, y, z normalized)
        const pos = bot.entity.position;
        state[offset++] = this.normalizeCoord(pos.x);
        state[offset++] = this.normalizeCoord(pos.y);
        state[offset++] = this.normalizeCoord(pos.z);

        // 2. Health/survival stats (4 values)
        state[offset++] = bot.health / 20.0;
        state[offset++] = bot.food / 20.0;
        state[offset++] = (bot.foodSaturation || 0) / 20.0;
        state[offset++] = (bot.oxygenLevel || 20) / 20.0;

        // 3. Inventory encoding (50 values)
        offset = this.encodeInventory(bot, state, offset);

        // 4. Nearby blocks - 5x5x5 voxel grid (125 values)
        offset = this.encodeNearbyBlocks(bot, state, offset);

        // 5. Nearby entities (30 values: 10 entities × 3 features)
        offset = this.encodeNearbyEntities(bot, state, offset);

        // 6. Environmental factors (10 values)
        offset = this.encodeEnvironment(bot, state, offset);

        // 7. Current goal/task (34 values)
        offset = this.encodeGoal(bot, state, offset);

        // 8. Social context - nearby agents and cooperation (30 values)
        offset = this.encodeSocialContext(bot, state, offset);

        // 9. Achievement progress (24 values)
        offset = this.encodeAchievements(bot, state, offset);

        // 10. Curiosity/novelty signals (10 values)
        offset = this.encodeCuriosity(bot, state, offset);

        // 11. Needs (10 values) - Sims-style need satisfaction
        offset = this.encodeNeeds(bot, state, offset);

        // 12. Moods (8 values) - Emotional states
        offset = this.encodeMoods(bot, state, offset);

        // 13. Relationships (20 values) - Social bonds
        offset = this.encodeRelationships(bot, state, offset);

        // 14. Memories (7 values) - Recent significant events
        offset = this.encodeMemories(bot, state, offset);

        // 15. Sub-Skills (40 values) - Project Zomboid-style granular skills
        offset = this.encodeSubSkills(bot, state, offset);

        // 16. Moodles/Debuffs (14 values) - Project Zomboid-style status effects
        offset = this.encodeMoodles(bot, state, offset);

        // Fill remaining with zeros if needed
        while (offset < this.STATE_SIZE) {
            state[offset++] = 0;
        }

        return state;
    }

    /**
     * Encode inventory items into vector
     */
    encodeInventory(bot, state, offset) {
        const items = bot.inventory.items();
        const startOffset = offset;

        // Create item count map
        const itemCounts = {};
        items.forEach(item => {
            if (!itemCounts[item.name]) {
                itemCounts[item.name] = 0;
            }
            itemCounts[item.name] += item.count;
        });

        // Encode known items
        for (let i = 0; i < this.ITEM_VOCAB.length && i < 40; i++) {
            const itemName = this.ITEM_VOCAB[i];
            const count = itemCounts[itemName] || 0;
            state[offset++] = Math.min(count / 64.0, 1.0); // Normalize to [0, 1]
        }

        // Encode equipped item (10 one-hot values)
        const heldItem = bot.heldItem;
        if (heldItem && this.ITEM_VOCAB.includes(heldItem.name)) {
            const idx = this.ITEM_VOCAB.indexOf(heldItem.name);
            if (idx < 10) {
                state[offset + idx] = 1.0;
            }
        }
        offset += 10;

        return offset;
    }

    /**
     * Encode nearby blocks in a 5x5x5 voxel grid
     */
    encodeNearbyBlocks(bot, state, offset) {
        const pos = bot.entity.position;
        const radius = 2; // 5x5x5 grid (2 blocks in each direction)

        let idx = 0;
        for (let y = -radius; y <= radius; y++) {
            for (let z = -radius; z <= radius; z++) {
                for (let x = -radius; x <= radius; x++) {
                    if (idx >= this.NEARBY_BLOCKS_SIZE) break;

                    const blockPos = pos.offset(x, y, z).floored();
                    const block = bot.blockAt(blockPos);

                    if (block && this.BLOCK_VOCAB.includes(block.name)) {
                        const blockIdx = this.BLOCK_VOCAB.indexOf(block.name);
                        state[offset + idx] = (blockIdx + 1) / this.BLOCK_VOCAB.length;
                    } else {
                        state[offset + idx] = 0; // Unknown or air
                    }
                    idx++;
                }
            }
        }

        return offset + this.NEARBY_BLOCKS_SIZE;
    }

    /**
     * Encode nearby entities (mobs, players, items)
     */
    encodeNearbyEntities(bot, state, offset) {
        const entities = Object.values(bot.entities)
            .filter(e => e.position && e.position.distanceTo(bot.entity.position) < 16)
            .filter(e => e.type !== 'object' || e.displayName === 'Item')
            .slice(0, 10); // Top 10 closest entities

        for (let i = 0; i < 10; i++) {
            if (i < entities.length) {
                const entity = entities[i];
                const entityType = entity.name || entity.displayName || 'unknown';

                // Feature 1: Entity type (encoded as index)
                if (this.ENTITY_TYPES.includes(entityType)) {
                    state[offset++] = (this.ENTITY_TYPES.indexOf(entityType) + 1) / this.ENTITY_TYPES.length;
                } else {
                    state[offset++] = 0;
                }

                // Feature 2: Distance (normalized)
                const dist = entity.position.distanceTo(bot.entity.position);
                state[offset++] = Math.min(dist / 16.0, 1.0);

                // Feature 3: Relative Y position
                const relY = entity.position.y - bot.entity.position.y;
                state[offset++] = Math.max(-1, Math.min(1, relY / 10.0));
            } else {
                // No entity in this slot
                state[offset++] = 0;
                state[offset++] = 0;
                state[offset++] = 0;
            }
        }

        return offset;
    }

    /**
     * Encode environmental factors
     */
    encodeEnvironment(bot, state, offset) {
        // Time of day (0-1)
        state[offset++] = (bot.time.timeOfDay % 24000) / 24000.0;

        // Is raining
        state[offset++] = bot.isRaining ? 1.0 : 0.0;

        // Is thundering
        state[offset++] = bot.thunderState > 0 ? 1.0 : 0.0;

        // Biome (simplified - just temperature proxy)
        const biome = bot.blockAt(bot.entity.position)?.biome;
        state[offset++] = biome ? (biome.temperature || 0.5) : 0.5;

        // On ground
        state[offset++] = bot.entity.onGround ? 1.0 : 0.0;

        // In water
        state[offset++] = bot.entity.isInWater ? 1.0 : 0.0;

        // In lava
        state[offset++] = bot.entity.isInLava ? 1.0 : 0.0;

        // Y-level category (0=low, 0.5=mid, 1=high)
        state[offset++] = Math.max(0, Math.min(1, bot.entity.position.y / 128.0));

        // Nearby danger (hostile mobs within 8 blocks)
        const hostileMobs = Object.values(bot.entities).filter(e =>
            e.position &&
            e.position.distanceTo(bot.entity.position) < 8 &&
            ['zombie', 'skeleton', 'spider', 'creeper', 'enderman'].includes(e.name)
        );
        state[offset++] = Math.min(hostileMobs.length / 5.0, 1.0);

        // Has nearby resources (ore/tree within 8 blocks)
        const hasResources = this.checkNearbyResources(bot) ? 1.0 : 0.0;
        state[offset++] = hasResources;

        return offset;
    }

    /**
     * Encode current goal/task
     */
    encodeGoal(bot, state, offset) {
        // Agent type one-hot encoding (12 major types)
        const agentTypes = ['MINING', 'LUMBERJACK', 'HUNTING', 'EXPLORING', 'FARMING',
                           'BLACKSMITH', 'GUARD', 'BUILDER', 'TRADING', 'FISHING', 'KNIGHT', 'SCOUT'];
        const typeIdx = agentTypes.indexOf(bot.agentType);
        for (let i = 0; i < 12; i++) {
            state[offset++] = (i === typeIdx) ? 1.0 : 0.0;
        }

        // Current task progress (if available)
        state[offset++] = bot.currentTaskProgress || 0.0;

        // Reward so far (normalized)
        const totalReward = bot.rewards ? bot.rewards.totalReward : 0;
        state[offset++] = Math.tanh(totalReward / 100.0); // Squash to [-1, 1]

        // Generation (normalized)
        state[offset++] = Math.min((bot.generation || 1) / 10.0, 1.0);

        // Resource priority
        state[offset++] = (bot.resourcePriority || 5) / 10.0;

        // Recent success rate (from inherited knowledge)
        const successRate = bot.inheritedKnowledge?.successRate || 50;
        state[offset++] = successRate / 100.0;

        // McMMO skill levels (encode top 3 skills if available)
        if (bot.rewards && bot.rewards.mcmmoSkills) {
            const skills = Object.values(bot.rewards.mcmmoSkills)
                .sort((a, b) => b.level - a.level)
                .slice(0, 3);

            for (let i = 0; i < 3; i++) {
                if (i < skills.length) {
                    state[offset++] = Math.min(skills[i].level / 50.0, 1.0);
                    state[offset++] = Math.min(skills[i].totalActions / 1000.0, 1.0);
                } else {
                    state[offset++] = 0;
                    state[offset++] = 0;
                }
            }
        } else {
            for (let i = 0; i < 6; i++) {
                state[offset++] = 0;
            }
        }

        // Stuck detector flag
        state[offset++] = (bot.stuckDetector && bot.stuckDetector.isStuck) ? 1.0 : 0.0;

        // Needs resources flag
        state[offset++] = (bot.rewards && bot.rewards.needsResources) ? 1.0 : 0.0;

        return offset;
    }

    /**
     * Helper: Check for nearby valuable resources
     */
    checkNearbyResources(bot) {
        const pos = bot.entity.position;
        const radius = 8;

        const valuableBlocks = ['coal_ore', 'iron_ore', 'diamond_ore', 'gold_ore',
                                'oak_log', 'birch_log', 'spruce_log', 'chest'];

        for (let y = -3; y <= 3; y++) {
            for (let x = -radius; x <= radius; x++) {
                for (let z = -radius; z <= radius; z++) {
                    const block = bot.blockAt(pos.offset(x, y, z));
                    if (block && valuableBlocks.includes(block.name)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Helper: Normalize world coordinates to [-1, 1]
     */
    normalizeCoord(coord) {
        return Math.max(-1, Math.min(1, coord / 1000.0));
    }

    /**
     * Encode social context - nearby agents, cooperation opportunities
     * ENABLES EMERGENT COOPERATION: Agents learn when grouping is beneficial
     */
    encodeSocialContext(bot, state, offset) {
        // Get nearby agents (other bots in the village)
        const nearbyAgents = [];
        if (global.activeAgents) {
            for (const [name, otherBot] of global.activeAgents) {
                if (otherBot !== bot && otherBot.entity) {
                    const dist = otherBot.entity.position.distanceTo(bot.entity.position);
                    if (dist < 32) {  // Within 32 blocks
                        nearbyAgents.push({
                            bot: otherBot,
                            distance: dist,
                            type: otherBot.agentType,
                            health: otherBot.health / 20.0
                        });
                    }
                }
            }
        }
        nearbyAgents.sort((a, b) => a.distance - b.distance);

        // Feature 1: Number of nearby agents (normalized)
        state[offset++] = Math.min(nearbyAgents.length / 10.0, 1.0);

        // Feature 2-6: Closest 5 agents - type, distance, health, similar role
        for (let i = 0; i < 5; i++) {
            if (i < nearbyAgents.length) {
                const agent = nearbyAgents[i];

                // Distance (closer = higher value for learning clustering)
                state[offset++] = 1.0 - Math.min(agent.distance / 32.0, 1.0);

                // Same type (1 if same role, 0 if different)
                state[offset++] = agent.type === bot.agentType ? 1.0 : 0.0;

                // Agent health (indicates if they need help)
                state[offset++] = agent.health;

                // Agent has resources (check inventory richness)
                const hasResources = agent.bot.inventory && agent.bot.inventory.items().length > 5;
                state[offset++] = hasResources ? 1.0 : 0.0;
            } else {
                state[offset++] = 0; state[offset++] = 0;
                state[offset++] = 0; state[offset++] = 0;
            }
        }

        // Feature 7: Village density (am I in a clustered area?)
        const localDensity = nearbyAgents.filter(a => a.distance < 16).length;
        state[offset++] = Math.min(localDensity / 5.0, 1.0);

        // Feature 8: Has nearby shared structures (crafting tables, furnaces, chests)
        state[offset++] = this.hasNearbySharedStructures(bot) ? 1.0 : 0.0;

        // Feature 9: Others working nearby (detect coordinated activity)
        const othersWorking = nearbyAgents.filter(a =>
            a.distance < 10 && a.bot.pathfinder && a.bot.pathfinder.goal
        ).length;
        state[offset++] = Math.min(othersWorking / 3.0, 1.0);

        // Feature 10: Alone vs grouped signal (emergent: learn when solo/group is better)
        const isAlone = nearbyAgents.length === 0;
        state[offset++] = isAlone ? 1.0 : 0.0;

        return offset;
    }

    /**
     * Encode achievement progress
     * ENABLES EMERGENT GOAL DISCOVERY: Agents learn achievement value through rewards
     */
    encodeAchievements(bot, state, offset) {
        // Initialize achievement tracking if not exists
        if (!bot.achievementProgress) {
            bot.achievementProgress = {
                hasDiamonds: false,
                hasIronArmor: false,
                hasEnchantingTable: false,
                hasNetherPortal: false,
                hasElytra: false,
                beatenWither: false,
                beatenDragon: false,
                hasBeacon: false,
                exploredBiomes: new Set(),
                bredAnimals: 0,
                villagerTrades: 0,
                blocksPlaced: 0
            };
        }

        const progress = bot.achievementProgress;

        // Basic achievements (binary flags)
        state[offset++] = progress.hasDiamonds ? 1.0 : 0.0;
        state[offset++] = progress.hasIronArmor ? 1.0 : 0.0;
        state[offset++] = progress.hasEnchantingTable ? 1.0 : 0.0;
        state[offset++] = progress.hasNetherPortal ? 1.0 : 0.0;
        state[offset++] = progress.hasElytra ? 1.0 : 0.0;
        state[offset++] = progress.beatenWither ? 1.0 : 0.0;
        state[offset++] = progress.beatenDragon ? 1.0 : 0.0;
        state[offset++] = progress.hasBeacon ? 1.0 : 0.0;

        // Exploration (biomes discovered)
        state[offset++] = Math.min(progress.exploredBiomes.size / 20.0, 1.0);

        // Animal breeding
        state[offset++] = Math.min(progress.bredAnimals / 50.0, 1.0);

        // Villager trades
        state[offset++] = Math.min(progress.villagerTrades / 100.0, 1.0);

        // Building (blocks placed)
        state[offset++] = Math.min(progress.blocksPlaced / 1000.0, 1.0);

        // Current inventory indicators for achievements
        const inv = bot.inventory.items();
        const hasDiamond = inv.some(i => i.name.includes('diamond'));
        const hasIronIngot = inv.some(i => i.name === 'iron_ingot');
        const hasObsidian = inv.some(i => i.name === 'obsidian');
        const hasEnderPearl = inv.some(i => i.name === 'ender_pearl');
        const hasBlazePowder = inv.some(i => i.name === 'blaze_powder');
        const hasNetherStar = inv.some(i => i.name === 'nether_star');

        state[offset++] = hasDiamond ? 1.0 : 0.0;
        state[offset++] = hasIronIngot ? 1.0 : 0.0;
        state[offset++] = hasObsidian ? 1.0 : 0.0;
        state[offset++] = hasEnderPearl ? 1.0 : 0.0;
        state[offset++] = hasBlazePowder ? 1.0 : 0.0;
        state[offset++] = hasNetherStar ? 1.0 : 0.0;

        // Progress toward major goals
        state[offset++] = bot.rewards ? Math.min(bot.rewards.stats.resources_gathered / 1000.0, 1.0) : 0.0;
        state[offset++] = bot.rewards ? Math.min(bot.rewards.stats.mobs_killed / 100.0, 1.0) : 0.0;
        state[offset++] = bot.rewards ? Math.min(bot.rewards.stats.trades_completed / 50.0, 1.0) : 0.0;

        // Total achievement score (composite)
        const score = (progress.hasDiamonds ? 1 : 0) + (progress.hasIronArmor ? 1 : 0) +
                     (progress.beatenDragon ? 3 : 0) + (progress.beatenWither ? 2 : 0);
        state[offset++] = Math.min(score / 10.0, 1.0);

        return offset;
    }

    /**
     * Encode curiosity and novelty signals
     * ENABLES EMERGENT EXPLORATION: Agents learn to seek new experiences
     */
    encodeCuriosity(bot, state, offset) {
        // Track unique locations visited
        if (!bot.explorationData) {
            bot.explorationData = {
                visitedChunks: new Set(),
                uniqueBlocksSeen: new Set(),
                uniqueEntitiesSeen: new Set(),
                timesSinceNewDiscovery: 0,
                totalDiscoveries: 0
            };
        }

        const data = bot.explorationData;

        // Current chunk
        const chunkX = Math.floor(bot.entity.position.x / 16);
        const chunkZ = Math.floor(bot.entity.position.z / 16);
        const chunkKey = `${chunkX},${chunkZ}`;

        // Feature 1: Is this a new chunk? (novelty signal)
        const isNewChunk = !data.visitedChunks.has(chunkKey);
        state[offset++] = isNewChunk ? 1.0 : 0.0;

        if (isNewChunk) {
            data.visitedChunks.add(chunkKey);
            data.totalDiscoveries++;
            data.timesSinceNewDiscovery = 0;
        } else {
            data.timesSinceNewDiscovery++;
        }

        // Feature 2: Exploration breadth (unique chunks visited)
        state[offset++] = Math.min(data.visitedChunks.size / 100.0, 1.0);

        // Feature 3: Time since last discovery (encourages seeking novelty)
        state[offset++] = Math.min(data.timesSinceNewDiscovery / 100.0, 1.0);

        // Feature 4: Unique blocks seen recently
        const nearbyBlocks = this.getNearbyUniqueBlocks(bot);
        nearbyBlocks.forEach(b => data.uniqueBlocksSeen.add(b));
        state[offset++] = Math.min(data.uniqueBlocksSeen.size / 50.0, 1.0);

        // Feature 5: Unique entities encountered
        const nearbyEntities = Object.values(bot.entities)
            .filter(e => e.position && e.position.distanceTo(bot.entity.position) < 16)
            .map(e => e.name || e.displayName);
        nearbyEntities.forEach(e => data.uniqueEntitiesSeen.add(e));
        state[offset++] = Math.min(data.uniqueEntitiesSeen.size / 30.0, 1.0);

        // Feature 6: Y-level exploration (encourage vertical exploration)
        const yLevel = bot.entity.position.y;
        const exploredUnderground = yLevel < 50 ? 1.0 : 0.0;
        state[offset++] = exploredUnderground;

        // Feature 7: Distance from spawn (exploration radius)
        const distFromSpawn = Math.sqrt(
            bot.entity.position.x ** 2 + bot.entity.position.z ** 2
        );
        state[offset++] = Math.min(distFromSpawn / 500.0, 1.0);

        // Feature 8: Has unexplored directions nearby
        const hasUnexploredNearby = this.checkUnexploredDirections(bot, data);
        state[offset++] = hasUnexploredNearby;

        // Feature 9: Boredom signal (stuck in same area too long)
        const boredom = Math.min(data.timesSinceNewDiscovery / 50.0, 1.0);
        state[offset++] = boredom;

        // Feature 10: Curiosity reward accumulator
        state[offset++] = Math.min(data.totalDiscoveries / 100.0, 1.0);

        return offset;
    }

    /**
     * Helper: Check if nearby shared structures exist
     */
    hasNearbySharedStructures(bot) {
        const pos = bot.entity.position;
        const sharedBlocks = ['crafting_table', 'furnace', 'chest', 'anvil', 'enchanting_table'];

        for (let y = -3; y <= 3; y++) {
            for (let x = -8; x <= 8; x++) {
                for (let z = -8; z <= 8; z++) {
                    const block = bot.blockAt(pos.offset(x, y, z));
                    if (block && sharedBlocks.includes(block.name)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Helper: Get unique blocks in view
     */
    getNearbyUniqueBlocks(bot) {
        const blocks = new Set();
        const pos = bot.entity.position;
        const radius = 8;

        for (let y = -3; y <= 3; y++) {
            for (let x = -radius; x <= radius; x++) {
                for (let z = -radius; z <= radius; z++) {
                    const block = bot.blockAt(pos.offset(x, y, z));
                    if (block && block.name !== 'air') {
                        blocks.add(block.name);
                    }
                }
            }
        }
        return Array.from(blocks);
    }

    /**
     * Helper: Check for unexplored directions
     */
    checkUnexploredDirections(bot, explorationData) {
        const pos = bot.entity.position;
        const checkRadius = 32;
        const directions = [
            [checkRadius, 0],   // East
            [-checkRadius, 0],  // West
            [0, checkRadius],   // South
            [0, -checkRadius]   // North
        ];

        for (const [dx, dz] of directions) {
            const chunkX = Math.floor((pos.x + dx) / 16);
            const chunkZ = Math.floor((pos.z + dz) / 16);
            const chunkKey = `${chunkX},${chunkZ}`;

            if (!explorationData.visitedChunks.has(chunkKey)) {
                return 1.0;  // Unexplored direction found
            }
        }
        return 0.0;  // All nearby directions explored
    }

    /**
     * Encode Sims-style needs (10 values)
     * INSPIRED BY THE SIMS: Agents have needs that must be satisfied
     */
    encodeNeeds(bot, state, offset) {
        // Initialize needs if not exists
        if (!bot.needs) {
            bot.needs = {
                hunger: 1.0,       // Derived from food level
                energy: 1.0,       // Time-based decay, restored by being idle
                safety: 1.0,       // Affected by nearby hostiles
                social: 0.5,       // Increased by being near other agents
                comfort: 0.5,      // Having shelter, good weather
                achievement: 0.5,  // Progress toward goals
                exploration: 0.5,  // Desire to see new places
                cooperation: 0.5,  // Desire to work with others
                creativity: 0.5,   // Building, crafting
                rest: 1.0          // Similar to energy but for decision making
            };
        }

        const needs = bot.needs;

        // Update needs based on current state
        // Hunger: directly from food level
        needs.hunger = bot.food / 20.0;

        // Energy: decays over time, restore when idle (simulated)
        const timeSinceSpawn = (Date.now() - (bot.spawnTime || Date.now())) / 1000;
        needs.energy = Math.max(0, 1.0 - (timeSinceSpawn / 3600.0)); // Decay over 1 hour

        // Safety: affected by nearby hostiles
        const nearbyHostiles = Object.values(bot.entities).filter(e =>
            e.position &&
            e.position.distanceTo(bot.entity.position) < 16 &&
            ['zombie', 'skeleton', 'spider', 'creeper'].includes(e.name)
        );
        needs.safety = Math.max(0, 1.0 - (nearbyHostiles.length * 0.2));

        // Social: increased by proximity to other agents
        let nearbyAgentCount = 0;
        if (global.activeAgents) {
            for (const [name, otherBot] of global.activeAgents) {
                if (otherBot !== bot && otherBot.entity) {
                    const dist = otherBot.entity.position.distanceTo(bot.entity.position);
                    if (dist < 32) nearbyAgentCount++;
                }
            }
        }
        needs.social = Math.min(1.0, 0.3 + (nearbyAgentCount * 0.15));

        // Comfort: weather, shelter, health
        const hasRoof = this.hasRoofOverhead(bot);
        const weatherPenalty = (bot.isRaining ? 0.2 : 0) + (bot.thunderState > 0 ? 0.3 : 0);
        const healthBonus = bot.health / 20.0 * 0.3;
        needs.comfort = Math.max(0, Math.min(1, 0.5 + (hasRoof ? 0.2 : 0) - weatherPenalty + healthBonus));

        // Achievement: based on progress
        const achievementCount = (bot.achievementProgress?.hasDiamonds ? 1 : 0) +
                                (bot.achievementProgress?.hasIronArmor ? 1 : 0) +
                                (bot.achievementProgress?.hasEnchantingTable ? 1 : 0);
        needs.achievement = Math.min(1.0, achievementCount / 3.0);

        // Exploration: based on recent discoveries
        const recentExplorationTime = bot.explorationData?.timesSinceNewDiscovery || 0;
        needs.exploration = Math.max(0, 1.0 - (recentExplorationTime / 100.0));

        // Cooperation: based on recent cooperative actions
        needs.cooperation = Math.min(1.0, (bot.recentCooperationCount || 0) / 10.0);

        // Creativity: based on recent building/crafting
        needs.creativity = Math.min(1.0, (bot.recentBuildingCount || 0) / 20.0);

        // Rest: similar to energy
        needs.rest = needs.energy * 0.8 + 0.2;

        // Encode all needs
        state[offset++] = needs.hunger;
        state[offset++] = needs.energy;
        state[offset++] = needs.safety;
        state[offset++] = needs.social;
        state[offset++] = needs.comfort;
        state[offset++] = needs.achievement;
        state[offset++] = needs.exploration;
        state[offset++] = needs.cooperation;
        state[offset++] = needs.creativity;
        state[offset++] = needs.rest;

        return offset;
    }

    /**
     * Encode emotional states / moods (8 values)
     * INSPIRED BY THE SIMS & DWARF FORTRESS: Agents have dynamic emotional states
     */
    encodeMoods(bot, state, offset) {
        // Initialize moods if not exists
        if (!bot.moods) {
            bot.moods = {
                happiness: 0.5,
                stress: 0.3,
                boredom: 0.2,
                motivation: 0.7,
                loneliness: 0.3,
                confidence: 0.5,
                curiosity: 0.6,
                fear: 0.1
            };
        }

        const moods = bot.moods;
        const needs = bot.needs || {};

        // Update moods based on needs and events
        // Happiness: average of satisfied needs
        const needAvg = (
            (needs.hunger || 0.5) + (needs.energy || 0.5) + (needs.safety || 0.5) +
            (needs.social || 0.5) + (needs.comfort || 0.5)
        ) / 5.0;
        moods.happiness = moods.happiness * 0.9 + needAvg * 0.1; // Smooth update

        // Stress: inverse of safety + time pressure
        moods.stress = Math.min(1.0, (1.0 - (needs.safety || 0.5)) + ((bot.health < 10) ? 0.3 : 0));

        // Boredom: lack of exploration and achievement
        moods.boredom = Math.min(1.0, (1.0 - (needs.exploration || 0.5)) * (1.0 - (needs.achievement || 0.5)));

        // Motivation: based on recent rewards and health
        const recentReward = bot.rewards?.totalReward || 0;
        moods.motivation = Math.min(1.0, Math.max(0.2, (recentReward / 100.0) + (bot.health / 30.0)));

        // Loneliness: inverse of social need
        moods.loneliness = 1.0 - (needs.social || 0.5);

        // Confidence: based on generation, survival time, achievements
        const survivalBonus = Math.min(0.4, (bot.mlSurvivalTime || 0) / 1000.0);
        const genBonus = Math.min(0.3, (bot.generation || 1) / 10.0);
        moods.confidence = Math.min(1.0, 0.3 + survivalBonus + genBonus + (needs.achievement || 0));

        // Curiosity: based on exploration need and boredom
        moods.curiosity = Math.min(1.0, ((needs.exploration || 0.5) + moods.boredom) / 2.0);

        // Fear: based on danger and health
        const dangerLevel = 1.0 - (needs.safety || 0.5);
        const healthFear = (bot.health < 6) ? 0.5 : 0;
        moods.fear = Math.min(1.0, dangerLevel * 0.7 + healthFear);

        // Encode all moods
        state[offset++] = moods.happiness;
        state[offset++] = moods.stress;
        state[offset++] = moods.boredom;
        state[offset++] = moods.motivation;
        state[offset++] = moods.loneliness;
        state[offset++] = moods.confidence;
        state[offset++] = moods.curiosity;
        state[offset++] = moods.fear;

        return offset;
    }

    /**
     * Encode social relationships (20 values)
     * INSPIRED BY DWARF FORTRESS: Agents form bonds and remember relationships
     */
    encodeRelationships(bot, state, offset) {
        // Initialize relationships tracking
        if (!bot.relationships) {
            bot.relationships = new Map(); // agentUUID -> { bond, trust, lastSeen, cooperationCount, type }
            bot.lastRelationshipFetch = 0;
        }

        // Fetch relationships from DuckDB periodically (every 30 seconds)
        const now = Date.now();
        if (bot.uuid && now - bot.lastRelationshipFetch > 30000) {
            bot.lastRelationshipFetch = now;

            // Async fetch - don't block encoding
            const memorySystem = getMemorySystem();
            if (memorySystem && memorySystem.initialized) {
                memorySystem.getRelationships(bot.uuid, 10).then(relationships => {
                    // Update local relationship map
                    relationships.forEach(rel => {
                        bot.relationships.set(rel.other_agent_uuid, {
                            bond: rel.bond_strength,
                            trust: rel.trust_level,
                            type: rel.relationship_type,
                            cooperationCount: rel.cooperation_count,
                            lastSeen: now
                        });
                    });
                }).catch(err => {
                    // Silently handle errors - relationship retrieval is non-critical
                });
            }
        }

        // Get top 4 relationships sorted by bond strength
        const relationships = Array.from(bot.relationships.entries())
            .sort((a, b) => (b[1].bond || 0) - (a[1].bond || 0))
            .slice(0, 4);

        // Encode top 4 relationships (5 features each = 20 total)
        for (let i = 0; i < 4; i++) {
            if (i < relationships.length) {
                const [uuid, data] = relationships[i];

                // Feature 1: Bond strength (-1 to 1)
                state[offset++] = Math.max(-1, Math.min(1, data.bond || 0));

                // Feature 2: Trust level (0 to 1)
                state[offset++] = Math.max(0, Math.min(1, data.trust || 0.5));

                // Feature 3: Relationship type encoded
                // 0 = hostile, 0.33 = neutral, 0.66 = ally, 1 = friend
                const typeValue = data.type === 'hostile' ? 0 : data.type === 'neutral' ? 0.33 :
                                 data.type === 'ally' ? 0.66 : 1.0;
                state[offset++] = typeValue;

                // Feature 4: Cooperation count (normalized)
                state[offset++] = Math.min(1.0, (data.cooperationCount || 0) / 20.0);

                // Feature 5: Recency (was seen recently?)
                const timeSinceLastSeen = Date.now() - (data.lastSeen || Date.now());
                state[offset++] = Math.max(0, 1.0 - (timeSinceLastSeen / 300000)); // Decay over 5 min
            } else {
                // No relationship in this slot
                state[offset++] = 0;
                state[offset++] = 0.5; // Neutral trust
                state[offset++] = 0.33; // Neutral type
                state[offset++] = 0;
                state[offset++] = 0;
            }
        }

        return offset;
    }

    /**
     * Encode recent memories (7 values)
     * INSPIRED BY DWARF FORTRESS: Significant events affect behavior
     */
    encodeMemories(bot, state, offset) {
        // Initialize memory tracking
        if (!bot.recentMemories) {
            bot.recentMemories = [];
            bot.lastMemoryFetch = 0;
        }

        // Fetch memories from DuckDB periodically (every 30 seconds)
        const now = Date.now();
        if (bot.uuid && now - bot.lastMemoryFetch > 30000) {
            bot.lastMemoryFetch = now;

            // Async fetch - don't block encoding
            const memorySystem = getMemorySystem();
            if (memorySystem && memorySystem.initialized) {
                memorySystem.getRecentMemories(bot.uuid, 10).then(memories => {
                    // Convert DuckDB format to internal format
                    bot.recentMemories = memories.map(m => ({
                        type: m.event_type,
                        valence: m.emotional_valence,
                        arousal: m.emotional_arousal,
                        strength: m.memory_strength,
                        timestamp: now // Approximate timestamp
                    }));
                }).catch(err => {
                    // Silently handle errors - memory retrieval is non-critical for encoding
                });
            }
        }

        // Memory types and their emotional valence
        const memoryTypes = {
            'achievement': 1,
            'danger': 2,
            'social': 3,
            'discovery': 4,
            'death': 5,
            'birth': 6
        };

        // Get most recent significant memory
        const lastMemory = bot.recentMemories[bot.recentMemories.length - 1];

        if (lastMemory) {
            // Feature 1: Memory type (encoded as category)
            const typeValue = (memoryTypes[lastMemory.type] || 0) / 6.0;
            state[offset++] = typeValue;

            // Feature 2: Emotional valence (-1 to 1)
            state[offset++] = lastMemory.valence || 0;

            // Feature 3: Emotional arousal (0 to 1)
            state[offset++] = lastMemory.arousal || 0.5;

            // Feature 4: Memory strength (from database or time-based)
            const memoryStrength = lastMemory.strength || 1.0;
            state[offset++] = memoryStrength;
        } else {
            // No recent memory
            state[offset++] = 0;
            state[offset++] = 0;
            state[offset++] = 0.5;
            state[offset++] = 0;
        }

        // Feature 5: Total memory count (how experienced is agent)
        state[offset++] = Math.min(1.0, bot.recentMemories.length / 50.0);

        // Feature 6: Average emotional valence of recent memories
        if (bot.recentMemories.length > 0) {
            const avgValence = bot.recentMemories.slice(-10)
                .reduce((sum, m) => sum + (m.valence || 0), 0) / Math.min(10, bot.recentMemories.length);
            state[offset++] = Math.max(-1, Math.min(1, avgValence));
        } else {
            state[offset++] = 0;
        }

        // Feature 7: Recent trauma indicator (negative memories)
        const recentNegativeCount = bot.recentMemories.slice(-5)
            .filter(m => (m.valence || 0) < -0.5).length;
        state[offset++] = Math.min(1.0, recentNegativeCount / 5.0);

        return offset;
    }

    /**
     * Helper: Check if agent has roof overhead (for comfort)
     */
    hasRoofOverhead(bot) {
        const pos = bot.entity.position;
        for (let y = 1; y <= 5; y++) {
            const blockAbove = bot.blockAt(pos.offset(0, y, 0));
            if (blockAbove && blockAbove.name !== 'air') {
                return true;
            }
        }
        return false;
    }

    /**
     * Encode Project Zomboid-style sub-skills (40 values)
     * 20 skills × 2 values each (level normalized, xp progress)
     */
    encodeSubSkills(bot, state, offset) {
        const subSkillsSystem = getSubSkillsSystem();

        // Initialize skills if not exists
        if (!bot.subSkills) {
            subSkillsSystem.initializeSkills(bot);
        }

        // Define skill order (must match across all agents)
        const skillOrder = [
            // Combat (5)
            'axe_fighting', 'sword_fighting', 'hand_to_hand', 'archery', 'critical_strike',
            // Survival (5)
            'fishing', 'foraging', 'trapping', 'farming', 'cooking',
            // Crafting (5)
            'mining', 'woodcutting', 'carpentry', 'smithing', 'engineering',
            // Physical (5)
            'sprinting', 'sneaking', 'nimble', 'strength', 'fitness'
        ];

        // Encode each skill (level + xp progress)
        for (const skillId of skillOrder) {
            const skill = bot.subSkills[skillId];

            if (skill) {
                // Level (normalized 0-1 based on max level)
                state[offset++] = skill.level / skill.maxLevel;

                // XP progress to next level (0-1)
                const xpProgress = skill.xpToNextLevel > 0 ?
                    Math.min(1.0, skill.xp / skill.xpToNextLevel) : 0.0;
                state[offset++] = xpProgress;
            } else {
                // Skill not found - zero values
                state[offset++] = 0;
                state[offset++] = 0;
            }
        }

        return offset;
    }

    /**
     * Encode Project Zomboid-style moodles/debuffs (14 values)
     * Each moodle severity encoded as 0-1 (0 = none, 1 = maximum severity)
     */
    encodeMoodles(bot, state, offset) {
        const moodlesSystem = getMoodlesSystem();

        // Initialize and update moodles
        if (!bot.moodleValues) {
            moodlesSystem.initializeMoodles(bot);
        }

        // Update moodle values based on current state
        moodlesSystem.updateMoodleValues(bot);

        // Define moodle order (must match across all agents)
        const moodleOrder = [
            // Physical (7)
            'hungry', 'thirsty', 'tired', 'injured', 'sick', 'bleeding', 'poisoned',
            // Mental (4)
            'panicked', 'stressed', 'anxious', 'depressed',
            // Environmental (3)
            'cold', 'hot', 'wet' // 'dark' excluded as it's less critical
        ];

        // Encode each moodle severity
        for (const moodleId of moodleOrder) {
            if (bot.moodles && bot.moodles[moodleId]) {
                // Moodle is active - encode severity (0-4 normalized to 0-1)
                state[offset++] = bot.moodles[moodleId].severity / 4.0;
            } else {
                // Moodle not active
                state[offset++] = 0;
            }
        }

        return offset;
    }
}

module.exports = StateEncoder;
