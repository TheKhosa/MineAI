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
        this.STATE_SIZE = 694;  // Expanded: 429 base + 200 plugin sensors + 65 additional mineflayer data (was 429 → 629 → 694)

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

        // 17-22. PLUGIN SENSOR DATA (200 values) - Enhanced Bukkit sensor data
        offset = this.encodePluginBlockData(bot, state, offset);     // +50
        offset = this.encodePluginEntityData(bot, state, offset);    // +30
        offset = this.encodePluginMobAI(bot, state, offset);         // +40
        offset = this.encodePluginWeather(bot, state, offset);       // +10
        offset = this.encodePluginChunks(bot, state, offset);        // +30
        offset = this.encodePluginItems(bot, state, offset);         // +40

        // 23-27. ADDITIONAL MINEFLAYER DATA (65 values) - Missing data from mineflayer bot
        offset = this.encodeExperience(bot, state, offset);          // +5
        offset = this.encodeControlState(bot, state, offset);        // +15
        offset = this.encodeEffects(bot, state, offset);             // +20
        offset = this.encodeEquipment(bot, state, offset);           // +15
        offset = this.encodeNearbyPlayers(bot, state, offset);       // +10

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
            e.name && ['zombie', 'skeleton', 'spider', 'creeper', 'enderman'].includes(e.name)
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
            e.name && ['zombie', 'skeleton', 'spider', 'creeper'].includes(e.name)
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

    // ============================================================
    // PLUGIN SENSOR ENCODERS (Bukkit/Spigot Enhanced Data)
    // ============================================================

    /**
     * Encode enhanced block data from plugin (50 dimensions)
     * Source: bot.pluginSensorData.blocks (274,625 blocks with metadata)
     */
    encodePluginBlockData(bot, state, offset) {
        if (!bot.pluginSensorData || !bot.pluginSensorData.blocks) {
            return offset + 50; // Skip if no data
        }

        // CRITICAL FIX: Limit blocks to prevent stack overflow
        // Plugin sends 274k+ blocks which causes Math.max(...blocks.map()) to overflow at line 1199
        // Only use nearest 1000 blocks for encoding (reduces processing from 274k to 1k)
        const allBlocks = bot.pluginSensorData.blocks;
        const blocks = allBlocks.length > 1000 ? allBlocks.slice(0, 1000) : allBlocks;

        // Feature 1-5: Block type distribution (top 5 most common nearby)
        const blockCounts = {};
        blocks.forEach(b => {
            blockCounts[b.type] = (blockCounts[b.type] || 0) + 1;
        });
        const topBlocks = Object.entries(blockCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        for (let i = 0; i < 5; i++) {
            if (i < topBlocks.length) {
                const blockIdx = this.BLOCK_VOCAB.indexOf(topBlocks[i][0]);
                state[offset++] = blockIdx >= 0 ? (blockIdx / this.BLOCK_VOCAB.length) : 0;
            } else {
                state[offset++] = 0;
            }
        }

        // Feature 6-10: Average block properties
        const avgHardness = blocks.reduce((sum, b) => sum + (b.hardness || 0), 0) / blocks.length;
        const avgLightLevel = blocks.reduce((sum, b) => sum + (b.lightLevel || 0), 0) / blocks.length;
        const passableRatio = blocks.filter(b => b.passable).length / blocks.length;
        const solidRatio = blocks.filter(b => b.isSolid).length / blocks.length;
        const flammableRatio = blocks.filter(b => b.isFlammable).length / blocks.length;

        state[offset++] = Math.min(1.0, avgHardness / 50.0);
        state[offset++] = avgLightLevel / 15.0;
        state[offset++] = passableRatio;
        state[offset++] = solidRatio;
        state[offset++] = flammableRatio;

        // Feature 11-20: Resource density (valuable blocks nearby)
        const oreTypes = ['coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'lapis_ore',
                          'redstone_ore', 'emerald_ore', 'copper_ore', 'ancient_debris', 'nether_quartz_ore'];
        for (let i = 0; i < 10; i++) {
            if (i < oreTypes.length) {
                const oreCount = blocks.filter(b => b.type === oreTypes[i]).length;
                state[offset++] = Math.min(1.0, oreCount / 10.0);
            } else {
                state[offset++] = 0;
            }
        }

        // Feature 21-25: Building material availability
        const materials = ['oak_log', 'cobblestone', 'dirt', 'sand', 'gravel'];
        materials.forEach(mat => {
            const count = blocks.filter(b => b.type === mat).length;
            state[offset++] = Math.min(1.0, count / 50.0);
        });

        // Feature 26-30: Danger indicators
        const lavaCount = blocks.filter(b => b.type === 'lava').length;
        const waterCount = blocks.filter(b => b.type === 'water').length;
        const cactusCount = blocks.filter(b => b.type === 'cactus').length;
        const fireCount = blocks.filter(b => b.type === 'fire').length;
        const explosiveCount = blocks.filter(b => b.type === 'tnt').length;

        state[offset++] = Math.min(1.0, lavaCount / 5.0);
        state[offset++] = Math.min(1.0, waterCount / 20.0);
        state[offset++] = Math.min(1.0, cactusCount / 5.0);
        state[offset++] = Math.min(1.0, fireCount / 3.0);
        state[offset++] = Math.min(1.0, explosiveCount / 2.0);

        // Feature 31-40: Structural blocks (crafting, storage, utility)
        const structuralBlocks = ['chest', 'crafting_table', 'furnace', 'anvil',
                                   'enchanting_table', 'brewing_stand', 'beacon',
                                   'hopper', 'dispenser', 'dropper'];
        structuralBlocks.forEach(block => {
            const count = blocks.filter(b => b.type === block).length;
            state[offset++] = Math.min(1.0, count / 3.0);
        });

        // Feature 41-45: Agricultural blocks
        const agricBlocks = ['wheat', 'carrots', 'potatoes', 'farmland', 'hay_block'];
        agricBlocks.forEach(block => {
            const count = blocks.filter(b => b.type === block).length;
            state[offset++] = Math.min(1.0, count / 10.0);
        });

        // Feature 46-50: Spatial distribution metrics
        if (blocks.length > 0) {
            const avgX = blocks.reduce((sum, b) => sum + b.x, 0) / blocks.length;
            const avgY = blocks.reduce((sum, b) => sum + b.y, 0) / blocks.length;
            const avgZ = blocks.reduce((sum, b) => sum + b.z, 0) / blocks.length;
            const maxDistance = Math.max(...blocks.map(b =>
                Math.sqrt(Math.pow(b.x - avgX, 2) + Math.pow(b.y - avgY, 2) + Math.pow(b.z - avgZ, 2))
            ));
            const blockDensity = blocks.length / 27000.0; // Normalized by 30x30x30 volume

            state[offset++] = this.normalizeCoord(avgX);
            state[offset++] = this.normalizeCoord(avgY);
            state[offset++] = this.normalizeCoord(avgZ);
            state[offset++] = Math.min(1.0, maxDistance / 30.0);
            state[offset++] = Math.min(1.0, blockDensity);
        } else {
            offset += 5;
        }

        return offset;
    }

    /**
     * Encode enhanced entity data from plugin (30 dimensions)
     * Source: bot.pluginSensorData.entities with AI state and hostility data
     */
    encodePluginEntityData(bot, state, offset) {
        if (!bot.pluginSensorData || !bot.pluginSensorData.entities) {
            return offset + 30; // Skip if no data
        }

        const entities = bot.pluginSensorData.entities;

        // Feature 1-3: Entity type distribution
        // SAFETY: Filter out entities without type field (plugin may send incomplete data)
        const hostile = entities.filter(e => e.type && ['ZOMBIE', 'SKELETON', 'SPIDER', 'CREEPER', 'ENDERMAN'].includes(e.type)).length;
        const passive = entities.filter(e => e.type && ['COW', 'PIG', 'SHEEP', 'CHICKEN'].includes(e.type)).length;
        const neutral = entities.filter(e => e.type && ['WOLF', 'IRON_GOLEM', 'VILLAGER'].includes(e.type)).length;

        state[offset++] = Math.min(1.0, hostile / 10.0);
        state[offset++] = Math.min(1.0, passive / 20.0);
        state[offset++] = Math.min(1.0, neutral / 10.0);

        // Feature 4-8: Closest 5 hostile mobs with distance and health
        const hostileMobs = entities
            .filter(e => e.type && ['ZOMBIE', 'SKELETON', 'SPIDER', 'CREEPER', 'ENDERMAN'].includes(e.type))
            .sort((a, b) => (a.distance || 32) - (b.distance || 32)) // NULL SAFETY: default to far distance if undefined
            .slice(0, 5);

        for (let i = 0; i < 5; i++) {
            if (i < hostileMobs.length) {
                const mob = hostileMobs[i];
                // NULL SAFETY: Check if distance exists
                const distance = (mob.distance != null) ? mob.distance : 32;
                state[offset++] = 1.0 - Math.min(1.0, distance / 32.0); // Closer = higher value
            } else {
                state[offset++] = 0;
            }
        }

        // Feature 9-13: Entity health average by type
        const getAvgHealth = (type) => {
            const mobs = entities.filter(e => e.type === type);
            if (mobs.length === 0) return 0;
            return mobs.reduce((sum, m) => sum + (m.health || 0), 0) / mobs.length / 20.0;
        };

        state[offset++] = getAvgHealth('ZOMBIE');
        state[offset++] = getAvgHealth('SKELETON');
        state[offset++] = getAvgHealth('SPIDER');
        state[offset++] = getAvgHealth('CREEPER');
        state[offset++] = getAvgHealth('ENDERMAN');

        // Feature 14-18: Passive mob counts (for farming/breeding)
        const mobTypes = ['COW', 'PIG', 'SHEEP', 'CHICKEN', 'HORSE'];
        mobTypes.forEach(type => {
            const count = entities.filter(e => e.type === type).length;
            state[offset++] = Math.min(1.0, count / 10.0);
        });

        // Feature 19-23: Special entities
        const playerCount = entities.filter(e => e.type === 'PLAYER').length;
        const villagerCount = entities.filter(e => e.type === 'VILLAGER').length;
        const itemCount = entities.filter(e => e.type === 'ITEM').length;
        const xpOrbCount = entities.filter(e => e.type === 'EXPERIENCE_ORB').length;
        const projectileCount = entities.filter(e => e.type === 'ARROW').length;

        state[offset++] = Math.min(1.0, playerCount / 5.0);
        state[offset++] = Math.min(1.0, villagerCount / 10.0);
        state[offset++] = Math.min(1.0, itemCount / 20.0);
        state[offset++] = Math.min(1.0, xpOrbCount / 10.0);
        state[offset++] = Math.min(1.0, projectileCount / 5.0);

        // Feature 24-28: Directional threat analysis (which direction has most danger)
        // NULL SAFETY: mob.x and mob.z may not exist in plugin data
        const threatByQuadrant = [0, 0, 0, 0]; // NE, SE, SW, NW
        hostileMobs.forEach(mob => {
            // Only count if we have position data
            if (mob.x != null && mob.z != null) {
                if (mob.x >= 0 && mob.z >= 0) threatByQuadrant[0]++;
                else if (mob.x >= 0 && mob.z < 0) threatByQuadrant[1]++;
                else if (mob.x < 0 && mob.z < 0) threatByQuadrant[2]++;
                else threatByQuadrant[3]++;
            }
        });

        threatByQuadrant.forEach(threat => {
            state[offset++] = Math.min(1.0, threat / 5.0);
        });

        // Feature 29: Total entity count
        state[offset++] = Math.min(1.0, entities.length / 50.0);

        // Feature 30: Danger score (composite)
        const dangerScore = (hostile * 2 + projectileCount) / 25.0;
        state[offset++] = Math.min(1.0, dangerScore);

        return offset;
    }

    /**
     * Encode mob AI states from plugin (40 dimensions)
     * Source: bot.pluginSensorData.mobAI with targeting and goals
     */
    encodePluginMobAI(bot, state, offset) {
        if (!bot.pluginSensorData || !bot.pluginSensorData.mobAI) {
            return offset + 40; // Skip if no data
        }

        const mobAI = bot.pluginSensorData.mobAI;

        // Feature 1-5: Targeting status (is bot being targeted?)
        const targetingMe = mobAI.filter(m => m.targetType === 'PLAYER' && m.targetUUID === bot.uuid).length;
        const targetingOthers = mobAI.filter(m => m.targetType === 'PLAYER' && m.targetUUID !== bot.uuid).length;
        const hasNoTarget = mobAI.filter(m => m.targetType === 'NONE').length;
        const targetingAnimals = mobAI.filter(m => m.targetType === 'ANIMAL').length;
        const aggressiveMobs = mobAI.filter(m => m.aggressive).length;

        state[offset++] = Math.min(1.0, targetingMe / 5.0); // Critical: Am I being hunted?
        state[offset++] = Math.min(1.0, targetingOthers / 5.0);
        state[offset++] = Math.min(1.0, hasNoTarget / 10.0);
        state[offset++] = Math.min(1.0, targetingAnimals / 5.0);
        state[offset++] = Math.min(1.0, aggressiveMobs / 10.0);

        // Feature 6-10: Closest 5 mobs targeting me with distance
        const threatMobs = mobAI
            .filter(m => m.targetType === 'PLAYER' && m.targetUUID === bot.uuid)
            .sort((a, b) => (a.distance || 16) - (b.distance || 16)) // NULL SAFETY: default to medium distance
            .slice(0, 5);

        for (let i = 0; i < 5; i++) {
            if (i < threatMobs.length) {
                // NULL SAFETY: Check if distance exists
                const distance = (threatMobs[i].distance != null) ? threatMobs[i].distance : 16;
                state[offset++] = 1.0 - Math.min(1.0, distance / 16.0);
            } else {
                state[offset++] = 0;
            }
        }

        // Feature 11-15: AI goal distribution
        const goalCounts = {};
        mobAI.forEach(m => {
            if (m.goal) goalCounts[m.goal] = (goalCounts[m.goal] || 0) + 1;
        });

        const commonGoals = ['ATTACK', 'WANDER', 'FLEE', 'FOLLOW', 'STAND'];
        commonGoals.forEach(goal => {
            const count = goalCounts[goal] || 0;
            state[offset++] = Math.min(1.0, count / 5.0);
        });

        // Feature 16-20: Pathfinding status
        const pathfinding = mobAI.filter(m => m.pathfinding).length;
        const stuckMobs = mobAI.filter(m => m.stuck).length;
        const jumpingMobs = mobAI.filter(m => m.jumping).length;
        const swimmingMobs = mobAI.filter(m => m.swimming).length;
        const flyingMobs = mobAI.filter(m => m.flying).length;

        state[offset++] = Math.min(1.0, pathfinding / 10.0);
        state[offset++] = Math.min(1.0, stuckMobs / 5.0);
        state[offset++] = Math.min(1.0, jumpingMobs / 5.0);
        state[offset++] = Math.min(1.0, swimmingMobs / 5.0);
        state[offset++] = Math.min(1.0, flyingMobs / 3.0);

        // Feature 21-25: Mob health distribution
        // NULL SAFETY: m.health might be undefined
        const lowHealthMobs = mobAI.filter(m => (m.health || 20) < 5).length;
        const medHealthMobs = mobAI.filter(m => {
            const h = m.health || 20;
            return h >= 5 && h < 15;
        }).length;
        const highHealthMobs = mobAI.filter(m => (m.health || 20) >= 15).length;
        const avgHealth = mobAI.reduce((sum, m) => sum + (m.health || 20), 0) / Math.max(mobAI.length, 1);
        const minHealth = Math.min(...mobAI.map(m => m.health || 20), 20);

        state[offset++] = Math.min(1.0, lowHealthMobs / 5.0);
        state[offset++] = Math.min(1.0, medHealthMobs / 10.0);
        state[offset++] = Math.min(1.0, highHealthMobs / 10.0);
        state[offset++] = avgHealth / 20.0;
        state[offset++] = minHealth / 20.0;

        // Feature 26-30: Mob equipment and variants
        const armoredMobs = mobAI.filter(m => m.hasArmor).length;
        const weaponMobs = mobAI.filter(m => m.hasWeapon).length;
        const babyMobs = mobAI.filter(m => m.isBaby).length;
        const angryMobs = mobAI.filter(m => m.angry).length;
        const tamedMobs = mobAI.filter(m => m.tamed).length;

        state[offset++] = Math.min(1.0, armoredMobs / 3.0);
        state[offset++] = Math.min(1.0, weaponMobs / 3.0);
        state[offset++] = Math.min(1.0, babyMobs / 5.0);
        state[offset++] = Math.min(1.0, angryMobs / 5.0);
        state[offset++] = Math.min(1.0, tamedMobs / 3.0);

        // Feature 31-35: Threat assessment by mob type
        const zombieThreats = mobAI.filter(m => m.type === 'ZOMBIE' && m.targetUUID === bot.uuid).length;
        const skeletonThreats = mobAI.filter(m => m.type === 'SKELETON' && m.targetUUID === bot.uuid).length;
        const spiderThreats = mobAI.filter(m => m.type === 'SPIDER' && m.targetUUID === bot.uuid).length;
        const creeperThreats = mobAI.filter(m => m.type === 'CREEPER' && m.targetUUID === bot.uuid).length;
        const endermanThreats = mobAI.filter(m => m.type === 'ENDERMAN' && m.targetUUID === bot.uuid).length;

        state[offset++] = Math.min(1.0, zombieThreats / 3.0);
        state[offset++] = Math.min(1.0, skeletonThreats / 3.0);
        state[offset++] = Math.min(1.0, spiderThreats / 3.0);
        state[offset++] = Math.min(1.0, creeperThreats / 2.0); // Creepers are high priority
        state[offset++] = Math.min(1.0, endermanThreats / 1.0);

        // Feature 36-40: Spatial distribution of AI mobs
        const nearbyMobs = mobAI.filter(m => m.distance < 8).length;
        const midRangeMobs = mobAI.filter(m => m.distance >= 8 && m.distance < 16).length;
        const farMobs = mobAI.filter(m => m.distance >= 16).length;
        const avgDistance = mobAI.reduce((sum, m) => sum + m.distance, 0) / Math.max(mobAI.length, 1);
        const minDistance = Math.min(...mobAI.map(m => m.distance), 32);

        state[offset++] = Math.min(1.0, nearbyMobs / 5.0);
        state[offset++] = Math.min(1.0, midRangeMobs / 10.0);
        state[offset++] = Math.min(1.0, farMobs / 10.0);
        state[offset++] = Math.min(1.0, avgDistance / 32.0);
        state[offset++] = Math.min(1.0, minDistance / 32.0);

        return offset;
    }

    /**
     * Encode enhanced weather data from plugin (10 dimensions)
     * Source: bot.pluginSensorData.weather with duration and time data
     */
    encodePluginWeather(bot, state, offset) {
        if (!bot.pluginSensorData || !bot.pluginSensorData.weather) {
            return offset + 10; // Skip if no data
        }

        const weather = bot.pluginSensorData.weather;

        // Feature 1-2: Basic weather state
        state[offset++] = weather.hasStorm ? 1.0 : 0.0;
        state[offset++] = weather.isThundering ? 1.0 : 0.0;

        // Feature 3-4: Weather duration (how long has it been raining/thundering?)
        state[offset++] = Math.min(1.0, (weather.rainDuration || 0) / 12000.0); // Normalized to ~10 min
        state[offset++] = Math.min(1.0, (weather.thunderDuration || 0) / 6000.0);

        // Feature 5: Time of day (more granular than mineflayer)
        state[offset++] = (weather.time % 24000) / 24000.0;

        // Feature 6-7: Time classification
        const isDay = weather.time >= 0 && weather.time < 12000;
        const isNight = weather.time >= 12000 && weather.time < 24000;
        state[offset++] = isDay ? 1.0 : 0.0;
        state[offset++] = isNight ? 1.0 : 0.0;

        // Feature 8: Daylight level (0-15)
        state[offset++] = (weather.skylightLevel || 0) / 15.0;

        // Feature 9: Combined danger from weather (storm + thunder + night)
        const weatherDanger = (weather.hasStorm ? 0.3 : 0) +
                             (weather.isThundering ? 0.4 : 0) +
                             (isNight ? 0.3 : 0);
        state[offset++] = Math.min(1.0, weatherDanger);

        // Feature 10: Weather change prediction (is weather clearing or worsening?)
        const weatherTrend = (weather.clearWeatherTime || 0) > (weather.rainTime || 0) ? 0.0 : 1.0;
        state[offset++] = weatherTrend;

        return offset;
    }

    /**
     * Encode enhanced chunk data from plugin (30 dimensions)
     * Source: bot.pluginSensorData.chunks with loading status
     */
    encodePluginChunks(bot, state, offset) {
        if (!bot.pluginSensorData || !bot.pluginSensorData.chunks) {
            return offset + 30; // Skip if no data
        }

        const chunks = bot.pluginSensorData.chunks;

        // Feature 1: Total loaded chunks
        state[offset++] = Math.min(1.0, (chunks.loadedChunks || 0) / 200.0);

        // Feature 2: Entities in loaded chunks
        state[offset++] = Math.min(1.0, (chunks.entityCount || 0) / 100.0);

        // Feature 3: Tile entities (chests, furnaces, etc.)
        state[offset++] = Math.min(1.0, (chunks.tileEntityCount || 0) / 50.0);

        // Feature 4-8: Chunk loading status (adjacent chunks)
        const adjacent = chunks.adjacentChunks || [];
        const loaded = adjacent.filter(c => c.loaded).length;
        const generating = adjacent.filter(c => c.generating).length;
        const unloaded = adjacent.filter(c => !c.loaded && !c.generating).length;
        const populated = adjacent.filter(c => c.populated).length;
        const lightCalculated = adjacent.filter(c => c.lightCalculated).length;

        state[offset++] = Math.min(1.0, loaded / 8.0); // Assume 8 adjacent chunks
        state[offset++] = Math.min(1.0, generating / 8.0);
        state[offset++] = Math.min(1.0, unloaded / 8.0);
        state[offset++] = Math.min(1.0, populated / 8.0);
        state[offset++] = Math.min(1.0, lightCalculated / 8.0);

        // Feature 9-13: Biome distribution in loaded chunks
        const biomes = chunks.biomes || [];
        const biomeTypes = ['plains', 'forest', 'desert', 'mountains', 'ocean'];
        biomeTypes.forEach(biome => {
            const count = biomes.filter(b => b.toLowerCase().includes(biome)).length;
            state[offset++] = Math.min(1.0, count / 10.0);
        });

        // Feature 14-18: Chunk data by height level
        const surfaceChunks = chunks.chunksAtHeight?.surface || 0;
        const undergroundChunks = chunks.chunksAtHeight?.underground || 0;
        const deepslateChunks = chunks.chunksAtHeight?.deepslate || 0;
        const bedrockChunks = chunks.chunksAtHeight?.bedrock || 0;
        const skyChunks = chunks.chunksAtHeight?.sky || 0;

        state[offset++] = Math.min(1.0, surfaceChunks / 20.0);
        state[offset++] = Math.min(1.0, undergroundChunks / 20.0);
        state[offset++] = Math.min(1.0, deepslateChunks / 20.0);
        state[offset++] = Math.min(1.0, bedrockChunks / 5.0);
        state[offset++] = Math.min(1.0, skyChunks / 10.0);

        // Feature 19-23: Structures in chunks
        const villages = chunks.structures?.village || 0;
        const mineshafts = chunks.structures?.mineshaft || 0;
        const dungeons = chunks.structures?.dungeon || 0;
        const strongholds = chunks.structures?.stronghold || 0;
        const monuments = chunks.structures?.monument || 0;

        state[offset++] = Math.min(1.0, villages / 3.0);
        state[offset++] = Math.min(1.0, mineshafts / 5.0);
        state[offset++] = Math.min(1.0, dungeons / 5.0);
        state[offset++] = Math.min(1.0, strongholds / 1.0);
        state[offset++] = Math.min(1.0, monuments / 1.0);

        // Feature 24-28: Chunk safety metrics
        const hostileSpawnableChunks = chunks.hostileSpawnable || 0;
        const passiveSpawnableChunks = chunks.passiveSpawnable || 0;
        const lightedChunks = chunks.wellLit || 0;
        const shelterChunks = chunks.hasShelter || 0;
        const resourceRichChunks = chunks.resourceRich || 0;

        state[offset++] = Math.min(1.0, hostileSpawnableChunks / 20.0);
        state[offset++] = Math.min(1.0, passiveSpawnableChunks / 20.0);
        state[offset++] = Math.min(1.0, lightedChunks / 20.0);
        state[offset++] = Math.min(1.0, shelterChunks / 10.0);
        state[offset++] = Math.min(1.0, resourceRichChunks / 10.0);

        // Feature 29: Chunk loading performance
        state[offset++] = Math.min(1.0, (chunks.loadTime || 0) / 1000.0);

        // Feature 30: Chunk exploration score
        const explorationScore = (loaded + populated) / 16.0;
        state[offset++] = Math.min(1.0, explorationScore);

        return offset;
    }

    /**
     * Encode enhanced dropped item data from plugin (40 dimensions)
     * Source: bot.pluginSensorData.items with age and metadata
     */
    encodePluginItems(bot, state, offset) {
        if (!bot.pluginSensorData || !bot.pluginSensorData.items) {
            return offset + 40; // Skip if no data
        }

        const items = bot.pluginSensorData.items;

        // Feature 1-10: Item type distribution (top 10 item types nearby)
        const itemCounts = {};
        items.forEach(i => {
            if (i.type && i.count != null) {
                itemCounts[i.type] = (itemCounts[i.type] || 0) + i.count;
            }
        });
        const topItems = Object.entries(itemCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        for (let i = 0; i < 10; i++) {
            if (i < topItems.length) {
                const itemIdx = this.ITEM_VOCAB.indexOf(topItems[i][0]);
                state[offset++] = itemIdx >= 0 ? (itemIdx / this.ITEM_VOCAB.length) : 0;
            } else {
                state[offset++] = 0;
            }
        }

        // Feature 11-15: Valuable item detection
        const diamondItems = items.filter(i => i.type && i.type.includes('diamond')).length;
        const ironItems = items.filter(i => i.type && i.type.includes('iron')).length;
        const goldItems = items.filter(i => i.type && i.type.includes('gold')).length;
        const toolItems = items.filter(i => i.type && (i.type.includes('pickaxe') || i.type.includes('axe'))).length;
        const foodItems = items.filter(i => i.type && (i.type.includes('bread') || i.type.includes('beef'))).length;

        state[offset++] = Math.min(1.0, diamondItems / 5.0);
        state[offset++] = Math.min(1.0, ironItems / 10.0);
        state[offset++] = Math.min(1.0, goldItems / 10.0);
        state[offset++] = Math.min(1.0, toolItems / 5.0);
        state[offset++] = Math.min(1.0, foodItems / 10.0);

        // Feature 16-20: Item age (are items fresh or despawning soon?)
        const freshItems = items.filter(i => i.age != null && i.age < 1000).length; // < 50 seconds
        const oldItems = items.filter(i => i.age != null && i.age >= 1000 && i.age < 5000).length;
        const despawningItems = items.filter(i => i.age != null && i.age >= 5000).length; // > 4 minutes
        const avgAge = items.reduce((sum, i) => sum + (i.age || 0), 0) / Math.max(items.length, 1);
        const minAge = Math.min(...items.map(i => i.age || 0), 6000);

        state[offset++] = Math.min(1.0, freshItems / 10.0);
        state[offset++] = Math.min(1.0, oldItems / 10.0);
        state[offset++] = Math.min(1.0, despawningItems / 5.0);
        state[offset++] = Math.min(1.0, avgAge / 6000.0);
        state[offset++] = Math.min(1.0, minAge / 6000.0);

        // Feature 21-25: Distance to valuable items (closest 5)
        const valueItems = items
            .filter(i => i.type && (i.type.includes('diamond') || i.type.includes('iron') || i.type.includes('gold')))
            .sort((a, b) => (a.distance || 0) - (b.distance || 0))
            .slice(0, 5);

        for (let i = 0; i < 5; i++) {
            if (i < valueItems.length) {
                // NULL SAFETY: Check if distance exists
                const distance = (valueItems[i].distance != null) ? valueItems[i].distance : 32;
                state[offset++] = 1.0 - Math.min(1.0, distance / 32.0);
            } else {
                state[offset++] = 0;
            }
        }

        // Feature 26-30: Item stack sizes
        const smallStacks = items.filter(i => i.count != null && i.count < 10).length;
        const mediumStacks = items.filter(i => i.count != null && i.count >= 10 && i.count < 32).length;
        const largeStacks = items.filter(i => i.count != null && i.count >= 32).length;
        const avgStack = items.reduce((sum, i) => sum + (i.count || 0), 0) / Math.max(items.length, 1);
        const maxStack = Math.max(...items.map(i => i.count || 0), 1);

        state[offset++] = Math.min(1.0, smallStacks / 10.0);
        state[offset++] = Math.min(1.0, mediumStacks / 10.0);
        state[offset++] = Math.min(1.0, largeStacks / 5.0);
        state[offset++] = Math.min(1.0, avgStack / 64.0);
        state[offset++] = Math.min(1.0, maxStack / 64.0);

        // Feature 31-35: Spatial distribution
        if (items.length > 0) {
            const avgX = items.reduce((sum, i) => sum + (i.x || 0), 0) / items.length;
            const avgY = items.reduce((sum, i) => sum + (i.y || 0), 0) / items.length;
            const avgZ = items.reduce((sum, i) => sum + (i.z || 0), 0) / items.length;
            const spread = Math.max(...items.map(i =>
                Math.sqrt(Math.pow((i.x || 0) - avgX, 2) + Math.pow((i.y || 0) - avgY, 2) + Math.pow((i.z || 0) - avgZ, 2))
            ));
            const density = items.length / 1000.0; // Items per 10x10x10 area

            state[offset++] = this.normalizeCoord(avgX);
            state[offset++] = this.normalizeCoord(avgY);
            state[offset++] = this.normalizeCoord(avgZ);
            state[offset++] = Math.min(1.0, spread / 30.0);
            state[offset++] = Math.min(1.0, density);
        } else {
            offset += 5;
        }

        // Feature 36-40: Item urgency and pickup priority
        const urgentItems = items.filter(i => i.age != null && i.age > 5000 && i.type && i.type.includes('diamond')).length;
        const nearbyValuable = items.filter(i => i.distance != null && i.distance < 5 && i.type && (i.type.includes('diamond') || i.type.includes('iron'))).length;
        const droppingItems = items.filter(i => i.motionY != null && i.motionY < -0.1).length; // Falling items
        const burningItems = items.filter(i => i.onFire === true).length;
        const pickupScore = (nearbyValuable * 2 + urgentItems) / 10.0;

        state[offset++] = Math.min(1.0, urgentItems / 3.0);
        state[offset++] = Math.min(1.0, nearbyValuable / 5.0);
        state[offset++] = Math.min(1.0, droppingItems / 5.0);
        state[offset++] = Math.min(1.0, burningItems / 3.0);
        state[offset++] = Math.min(1.0, pickupScore);

        return offset;
    }

    // ============================================================
    // ADDITIONAL MINEFLAYER DATA ENCODERS
    // ============================================================

    /**
     * Encode experience data (5 dimensions)
     * Source: bot.experience
     */
    encodeExperience(bot, state, offset) {
        if (!bot.experience) {
            return offset + 5;
        }

        // Feature 1: Current level
        state[offset++] = Math.min(1.0, bot.experience.level / 30.0);

        // Feature 2: Points (0-1 for current level)
        state[offset++] = bot.experience.progress || 0;

        // Feature 3: Total points
        state[offset++] = Math.min(1.0, (bot.experience.points || 0) / 1000.0);

        // Feature 4: Points needed for next level
        const pointsNeeded = bot.experience.level < 16 ? 17 :
                            bot.experience.level < 31 ? 97 : 277;
        state[offset++] = Math.min(1.0, pointsNeeded / 300.0);

        // Feature 5: XP farming efficiency (levels per minute - needs tracking)
        const xpRate = (bot.experience.level || 0) / Math.max((Date.now() - (bot.spawnTime || Date.now())) / 60000, 0.1);
        state[offset++] = Math.min(1.0, xpRate / 5.0);

        return offset;
    }

    /**
     * Encode control state (15 dimensions)
     * Source: bot.controlState
     */
    encodeControlState(bot, state, offset) {
        if (!bot.controlState) {
            return offset + 15;
        }

        const ctrl = bot.controlState;

        // Feature 1-8: Movement controls
        state[offset++] = ctrl.forward ? 1.0 : 0.0;
        state[offset++] = ctrl.back ? 1.0 : 0.0;
        state[offset++] = ctrl.left ? 1.0 : 0.0;
        state[offset++] = ctrl.right ? 1.0 : 0.0;
        state[offset++] = ctrl.jump ? 1.0 : 0.0;
        state[offset++] = ctrl.sprint ? 1.0 : 0.0;
        state[offset++] = ctrl.sneak ? 1.0 : 0.0;
        state[offset++] = (ctrl.forward && ctrl.sprint) ? 1.0 : 0.0; // Sprinting forward

        // Feature 9-11: View direction
        state[offset++] = Math.max(-1, Math.min(1, (bot.entity.yaw || 0) / Math.PI));
        state[offset++] = Math.max(-1, Math.min(1, (bot.entity.pitch || 0) / (Math.PI / 2)));
        const lookingDown = (bot.entity.pitch || 0) > 0.5 ? 1.0 : 0.0;
        state[offset++] = lookingDown;

        // Feature 12-14: Velocity
        const vel = bot.entity.velocity;
        state[offset++] = Math.max(-1, Math.min(1, vel.x / 10.0));
        state[offset++] = Math.max(-1, Math.min(1, vel.y / 10.0));
        state[offset++] = Math.max(-1, Math.min(1, vel.z / 10.0));

        // Feature 15: Is moving
        const isMoving = Math.sqrt(vel.x ** 2 + vel.z ** 2) > 0.1 ? 1.0 : 0.0;
        state[offset++] = isMoving;

        return offset;
    }

    /**
     * Encode potion effects (20 dimensions)
     * Source: bot.entity.effects
     */
    encodeEffects(bot, state, offset) {
        if (!bot.entity || !bot.entity.effects) {
            return offset + 20;
        }

        const effects = bot.entity.effects;

        // Define important effect IDs and their slots
        const effectSlots = [
            1,  // Speed
            2,  // Slowness
            3,  // Haste
            4,  // Mining Fatigue
            5,  // Strength
            6,  // Instant Health
            7,  // Instant Damage
            8,  // Jump Boost
            9,  // Nausea
            10, // Regeneration
            11, // Resistance
            12, // Fire Resistance
            13, // Water Breathing
            14, // Invisibility
            15, // Blindness
            16, // Night Vision
            17, // Hunger
            18, // Weakness
            19, // Poison
            20  // Wither
        ];

        effectSlots.forEach(id => {
            const effect = Object.values(effects).find(e => e.id === id);
            if (effect) {
                // Encode amplifier (strength) normalized
                state[offset++] = Math.min(1.0, (effect.amplifier || 0) / 3.0);
            } else {
                state[offset++] = 0;
            }
        });

        return offset;
    }

    /**
     * Encode equipment durability (15 dimensions)
     * Source: bot.inventory armor slots
     */
    encodeEquipment(bot, state, offset) {
        // Feature 1-4: Armor durability
        const helmet = bot.inventory.slots[5];
        const chestplate = bot.inventory.slots[6];
        const leggings = bot.inventory.slots[7];
        const boots = bot.inventory.slots[8];

        const getDurability = (item) => {
            if (!item || !item.maxDurability) return 0;
            return (item.maxDurability - (item.durabilityUsed || 0)) / item.maxDurability;
        };

        state[offset++] = getDurability(helmet);
        state[offset++] = getDurability(chestplate);
        state[offset++] = getDurability(leggings);
        state[offset++] = getDurability(boots);

        // Feature 5: Average armor durability
        const avgArmorDur = (getDurability(helmet) + getDurability(chestplate) +
                            getDurability(leggings) + getDurability(boots)) / 4.0;
        state[offset++] = avgArmorDur;

        // Feature 6-9: Armor enchantment presence (simplified)
        state[offset++] = (helmet && helmet.enchants && helmet.enchants.length > 0) ? 1.0 : 0.0;
        state[offset++] = (chestplate && chestplate.enchants && chestplate.enchants.length > 0) ? 1.0 : 0.0;
        state[offset++] = (leggings && leggings.enchants && leggings.enchants.length > 0) ? 1.0 : 0.0;
        state[offset++] = (boots && boots.enchants && boots.enchants.length > 0) ? 1.0 : 0.0;

        // Feature 10: Held item durability
        const heldItem = bot.heldItem;
        state[offset++] = getDurability(heldItem);

        // Feature 11: Held item enchantment
        state[offset++] = (heldItem && heldItem.enchants && heldItem.enchants.length > 0) ? 1.0 : 0.0;

        // Feature 12: Off-hand item presence
        const offHand = bot.inventory.slots[45];
        state[offset++] = offHand ? 1.0 : 0.0;

        // Feature 13-14: Equipment completeness
        const armorPieces = [helmet, chestplate, leggings, boots].filter(item => item !== null).length;
        state[offset++] = armorPieces / 4.0;
        const hasFullArmor = armorPieces === 4 ? 1.0 : 0.0;
        state[offset++] = hasFullArmor;

        // Feature 15: Equipment quality (iron/diamond/netherite)
        const hasIronArmor = [helmet, chestplate, leggings, boots].some(item =>
            item && item.name.includes('iron'));
        state[offset++] = hasIronArmor ? 0.5 : 0.0;

        return offset;
    }

    /**
     * Encode nearby players (10 dimensions)
     * Source: bot.players
     */
    encodeNearbyPlayers(bot, state, offset) {
        if (!bot.players) {
            return offset + 10;
        }

        const players = Object.values(bot.players).filter(p =>
            p.entity && p.username !== bot.username &&
            p.entity.position && p.entity.position.distanceTo(bot.entity.position) < 32
        );

        // Feature 1: Player count
        state[offset++] = Math.min(1.0, players.length / 10.0);

        // Feature 2-6: Closest 5 players distance
        const sortedPlayers = players.sort((a, b) =>
            a.entity.position.distanceTo(bot.entity.position) -
            b.entity.position.distanceTo(bot.entity.position)
        ).slice(0, 5);

        for (let i = 0; i < 5; i++) {
            if (i < sortedPlayers.length) {
                const dist = sortedPlayers[i].entity.position.distanceTo(bot.entity.position);
                state[offset++] = 1.0 - Math.min(1.0, dist / 32.0);
            } else {
                state[offset++] = 0;
            }
        }

        // Feature 7: Closest player distance
        if (players.length > 0) {
            const closestDist = players[0].entity.position.distanceTo(bot.entity.position);
            state[offset++] = 1.0 - Math.min(1.0, closestDist / 32.0);
        } else {
            state[offset++] = 0;
        }

        // Feature 8: Players in combat range (< 5 blocks)
        const inCombatRange = players.filter(p =>
            p.entity.position.distanceTo(bot.entity.position) < 5
        ).length;
        state[offset++] = Math.min(1.0, inCombatRange / 3.0);

        // Feature 9: Players in communication range (< 16 blocks)
        const inCommRange = players.filter(p =>
            p.entity.position.distanceTo(bot.entity.position) < 16
        ).length;
        state[offset++] = Math.min(1.0, inCommRange / 5.0);

        // Feature 10: Is alone (no players within 32 blocks)
        state[offset++] = players.length === 0 ? 1.0 : 0.0;

        return offset;
    }
}

module.exports = StateEncoder;
