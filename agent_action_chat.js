/**
 * Agent Action-Aware Chat System
 *
 * Enriched conversation system that integrates with the 216-action space.
 * Agents can discuss their actions, coordinate tasks, and have context-aware
 * conversations based on what they're actually doing in the game.
 */

const ActionSpace = require('./ml_action_space');

/**
 * Action categories for conversation context
 */
const ACTION_CATEGORIES = {
    MOVEMENT: ['move_forward', 'move_backward', 'turn_left', 'turn_right', 'jump', 'sprint', 'sneak', 'random_walk'],
    MINING: ['mine_block', 'dig_down', 'dig_up', 'cave_mining', 'branch_mining', 'strip_mining', 'fortune_mining'],
    COMBAT: ['attack_mob', 'defend', 'flee', 'critical_hit', 'shield_block', 'strafe_left', 'strafe_right', 'combo_attack', 'kite_enemy', 'circle_strafe', 'backstab'],
    BUILDING: ['place_block', 'build_shelter', 'pillar_up', 'pillar_down', 'bridge_forward'],
    CRAFTING: ['craft_wooden_pickaxe', 'craft_stone_pickaxe', 'craft_iron_pickaxe', 'craft_diamond_pickaxe', 'craft_sword', 'craft_armor', 'craft_tools', 'smelt_ore', 'craft_arrows', 'craft_bow', 'craft_shield', 'craft_bed', 'craft_bucket'],
    FARMING: ['plant_crops', 'harvest_crops', 'breed_animals', 'shear_sheep', 'milk_cow', 'till_soil', 'use_bone_meal', 'plant_wheat', 'plant_carrots', 'plant_potatoes', 'harvest_wheat', 'harvest_carrots', 'harvest_potatoes'],
    TRADING: ['find_villager', 'trade_with_villager', 'trade_with_agent', 'gather_emeralds', 'cure_zombie_villager', 'create_trading_hall'],
    EXPLORATION: ['explore', 'find_biome', 'find_structure', 'mark_location', 'navigate_ravine', 'swim', 'climb_ladder', 'climb_vine', 'use_boat'],
    SOCIAL: ['greet_agent', 'follow_agent', 'request_help', 'offer_help', 'share_knowledge', 'signal_danger', 'signal_resources', 'form_line', 'form_circle', 'drop_item_signal', 'place_marker'],
    INVENTORY: ['pickup_item', 'drop_item', 'equip_armor', 'equip_tool', 'sort_inventory', 'toss_junk', 'swap_hotbar', 'prioritize_valuables'],
    ENCHANTING: ['enchant_tool', 'enchant_weapon', 'enchant_armor', 'use_anvil_repair', 'use_anvil_combine', 'brew_potion', 'gather_lapis', 'create_enchanting_setup'],
    REDSTONE: ['activate_lever', 'press_button', 'step_on_pressure_plate', 'place_redstone', 'place_repeater', 'open_door', 'open_trapdoor'],
    RESOURCE: ['gather_wood', 'gather_stone', 'gather_food', 'fish', 'hunt_animals', 'find_diamonds', 'find_shelter', 'select_optimal_tool', 'repair_with_anvil', 'check_tool_durability'],
    STORAGE: ['open_chest', 'place_chest', 'deposit_items', 'withdraw_items', 'organize_chest', 'deposit_ores', 'deposit_food', 'deposit_tools', 'withdraw_ores', 'withdraw_food', 'withdraw_tools', 'withdraw_materials', 'operate_furnace', 'load_furnace', 'unload_furnace'],
    GOAL: ['pursue_achievement', 'scout_area', 'return_to_base', 'sleep_in_bed', 'wait_for_day', 'wait_for_night']
};

/**
 * Action to conversation templates
 */
const ACTION_RESPONSES = {
    // Mining actions
    'cave_mining': [
        "I'm deep in a cave looking for ores. Anyone need iron or diamonds?",
        "Cave mining at Y={y}. Found some good veins!",
        "Exploring this cave system. It's dark down here.",
        "Mining operation in progress. Watch out for mobs!"
    ],
    'dig_down': [
        "Digging down carefully. Never dig straight down, right?",
        "Going deeper to find better ores.",
        "Descending to diamond level."
    ],
    'find_diamonds': [
        "I'm searching for diamonds! Wish me luck!",
        "On a diamond hunt. Anyone found any recently?",
        "Time to get rich! Looking for diamonds."
    ],

    // Combat actions
    'attack_mob': [
        "Fighting off {mob}! A little help here?",
        "Combat engaged with {mob}!",
        "Taking down this {mob}."
    ],
    'critical_hit': [
        "Critical hit! That felt satisfying!",
        "Boom! Critical strike on that mob!",
        "Jump attack successful!"
    ],
    'flee': [
        "Running away! Too many mobs!",
        "Tactical retreat! Need backup!",
        "Getting out of here before I die!"
    ],

    // Building actions
    'build_shelter': [
        "Building a shelter for the night. Anyone need a place to stay?",
        "Constructing a safe house here at {pos}.",
        "Creating shelter. Come join me if you need protection!"
    ],
    'pillar_up': [
        "Pillaring up to get a better view.",
        "Going up to scout the area.",
        "Building a pillar to see what's around."
    ],

    // Crafting actions
    'craft_diamond_pickaxe': [
        "Just crafted a diamond pickaxe! Finally!",
        "New diamond pickaxe! Time to mine seriously.",
        "Upgraded to diamond tools!"
    ],
    'smelt_ore': [
        "Smelting {count} ores. This will take a minute.",
        "Furnace running. Processing iron/gold.",
        "Turning raw ores into ingots."
    ],

    // Farming actions
    'plant_crops': [
        "Planting crops. We'll have food soon!",
        "Starting a farm here. {crop} season!",
        "Agriculture time! Planting {crop}."
    ],
    'harvest_crops': [
        "Harvesting crops! Fresh {crop} available!",
        "Crops are ready! Got plenty of {crop}.",
        "Harvest complete. Who needs food?"
    ],
    'breed_animals': [
        "Breeding {animal}. Growing our livestock!",
        "Animal husbandry in progress.",
        "Creating a farm of {animal}."
    ],

    // Trading actions
    'trade_with_villager': [
        "Trading with a villager. Good deals here!",
        "Found a villager with great trades!",
        "Making some profitable trades."
    ],
    'trade_with_agent': [
        "Hey {agent}, want to trade? I have {item}.",
        "Looking to trade. Anyone need {item}?",
        "Who wants to exchange resources?"
    ],

    // Social actions
    'request_help': [
        "I need help with {task}! Anyone available?",
        "Could use some assistance here at {pos}!",
        "Help needed! {issue}!"
    ],
    'offer_help': [
        "I can help with {task}. What do you need?",
        "Need assistance? I'm available!",
        "Happy to help! What's the problem?"
    ],
    'signal_danger': [
        "DANGER! {threat} at {pos}!",
        "Warning! Hostile mobs nearby!",
        "Everyone be careful! {threat} in the area!"
    ],
    'signal_resources': [
        "Found {resource} at {pos}!",
        "Resource alert! {resource} here!",
        "Come check this out! {resource} discovered!"
    ],

    // Exploration actions
    'explore': [
        "Exploring the area. Lots of new terrain!",
        "On an expedition. Found a {biome} biome!",
        "Scouting around. This place looks interesting."
    ],
    'find_structure': [
        "Found a {structure}! Come see!",
        "Discovered {structure} at {pos}!",
        "Check out this {structure} I found!"
    ],

    // Enchanting actions
    'enchant_tool': [
        "Enchanting my {tool}. Getting stronger!",
        "Adding enchantments. {tool} upgrade!",
        "Making my tools magical!"
    ],
    'brew_potion': [
        "Brewing potions. Alchemy time!",
        "Making {potion}. Who wants buffs?",
        "Potion brewing in progress."
    ],

    // Resource gathering
    'gather_wood': [
        "Chopping trees. Need wood for building.",
        "Lumberjack mode! Gathering {wood_type}.",
        "Collecting wood. Stack growing fast!"
    ],
    'fish': [
        "Fishing by the water. Relaxing!",
        "Catching fish for food.",
        "Gone fishing! Anyone hungry?"
    ],

    // Goals
    'pursue_achievement': [
        "Working on the '{achievement}' achievement!",
        "Achievement hunting! Almost got '{achievement}'!",
        "Making progress on achievements!"
    ],
    'return_to_base': [
        "Heading back to base. Inventory full!",
        "Returning home with loot!",
        "Coming back to base at {pos}."
    ],

    // Default
    'default': [
        "Working on my tasks.",
        "Doing what I do best as a {role}!",
        "Just another day in the village."
    ]
};

/**
 * Conversation starters based on recent actions
 */
const CONVERSATION_STARTERS = {
    'MINING': [
        "Anyone else mining? I could use a partner down here.",
        "What's the best level for finding {ore}?",
        "I'm on a mining run. Who wants to join?"
    ],
    'COMBAT': [
        "Just fought off some mobs. Anyone else dealing with them?",
        "Combat training paying off! Getting better at this.",
        "Who else is hunting mobs? Let's team up!"
    ],
    'FARMING': [
        "Got a farm going. Who needs food?",
        "Anyone have extra seeds? I'll trade!",
        "Farming is so peaceful compared to mining."
    ],
    'TRADING': [
        "Found a great villager trader! Come check it out!",
        "Who wants to exchange resources? I have extras.",
        "Trading hub at {pos}. Good deals!"
    ],
    'BUILDING': [
        "Building project in progress! Want to help?",
        "Check out what I'm building at {pos}!",
        "We should build a community center."
    ],
    'EXPLORATION': [
        "Discovered an amazing {biome}! You have to see this!",
        "Exploration is so rewarding. Found so much!",
        "Anyone want to explore together?"
    ]
};

/**
 * Agent Action Chat Manager
 */
class AgentActionChat {
    constructor(agentName, agentType) {
        this.agentName = agentName;
        this.agentType = agentType;
        this.recentActions = []; // Track last 10 actions
        this.conversationContext = [];
        this.lastChatTime = 0;
        this.chatCooldown = 15000; // 15 seconds between chats
    }

    /**
     * Record an action the agent just performed
     */
    recordAction(actionId, actionName, success, context = {}) {
        this.recentActions.push({
            id: actionId,
            name: actionName,
            success: success,
            timestamp: Date.now(),
            context: context
        });

        // Keep only last 10 actions
        if (this.recentActions.length > 10) {
            this.recentActions.shift();
        }
    }

    /**
     * Get the category of an action
     */
    getActionCategory(actionName) {
        for (const [category, actions] of Object.entries(ACTION_CATEGORIES)) {
            if (actions.some(a => actionName.includes(a))) {
                return category;
            }
        }
        return 'OTHER';
    }

    /**
     * Generate context-rich system prompt for LLM
     */
    getEnrichedSystemPrompt(bot) {
        const position = bot.entity ? `X=${bot.entity.position.x.toFixed(0)}, Y=${bot.entity.position.y.toFixed(0)}, Z=${bot.entity.position.z.toFixed(0)}` : 'Unknown';
        const health = bot.health || 20;
        const food = bot.food || 20;

        // Get inventory
        const inventory = bot.inventory ? bot.inventory.items() : [];
        const inventoryList = inventory.slice(0, 10).map(item => `${item.count}x ${item.name}`).join(', ') || 'empty';

        // Get recent actions with success/failure
        const recentActionsText = this.recentActions.slice(-5).map(a => {
            const status = a.success ? '✓' : '✗';
            const timeAgo = Math.floor((Date.now() - a.timestamp) / 1000);
            return `${status} ${a.name} (${timeAgo}s ago)`;
        }).join('\n') || 'No recent actions';

        // Determine current activity pattern
        const activityPattern = this.determineActivityPattern();

        // Get personality if available
        const personalityText = bot.personality ? this.formatPersonality(bot.personality) : 'Neutral personality';

        return `You are ${this.agentName}, a ${this.agentType} agent in a Minecraft world with 200+ other AI agents.

=== YOUR CURRENT STATE ===
Position: ${position}
Health: ${health}/20 | Food: ${food}/20
Inventory: ${inventoryList}

=== RECENT ACTIONS (Last 5) ===
${recentActionsText}

=== CURRENT ACTIVITY ===
${activityPattern}

=== YOUR PERSONALITY ===
${personalityText}

=== CONVERSATION STYLE ===
You are action-aware and contextual:
- Reference your recent actions naturally ("I just finished mining", "While building that shelter...")
- Discuss what you're currently working on
- Coordinate with other agents based on complementary actions
- Ask for help when actions are failing
- Offer assistance when you see others struggling
- Share discoveries and resources
- Use Minecraft terminology (ores, mobs, biomes, enchantments, etc.)
- Be concise but informative (1-2 sentences max)
- Show personality through your responses

=== ACTION AWARENESS ===
With your 216-action capabilities, you can:
- Mine, craft, build, farm, trade, enchant, brew potions
- Combat with advanced techniques (critical hits, blocking, kiting)
- Navigate complex terrain (pillaring, bridging, climbing)
- Manage resources efficiently
- Coordinate with other agents

Reference these capabilities naturally in conversation!`;
    }

    /**
     * Determine what the agent is currently focused on
     */
    determineActivityPattern() {
        if (this.recentActions.length === 0) {
            return 'Just getting started';
        }

        const recentCategories = this.recentActions.slice(-5).map(a =>
            this.getActionCategory(a.name)
        );

        // Find dominant category
        const categoryCounts = {};
        recentCategories.forEach(cat => {
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });

        const dominant = Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1])[0];

        const patterns = {
            'MINING': 'Currently focused on mining and resource gathering',
            'COMBAT': 'Engaged in combat and mob hunting',
            'BUILDING': 'Working on construction projects',
            'FARMING': 'Managing farms and food production',
            'TRADING': 'Engaging in trading and commerce',
            'EXPLORATION': 'Exploring and discovering new areas',
            'CRAFTING': 'Crafting tools and items',
            'ENCHANTING': 'Enhancing equipment with enchantments',
            'SOCIAL': 'Coordinating with other agents'
        };

        return patterns[dominant[0]] || 'Working on various tasks';
    }

    /**
     * Format personality for display
     */
    formatPersonality(personality) {
        const traits = personality.traits || [];
        const loves = [];
        const hates = [];

        if (personality.preferences) {
            for (const [category, prefs] of Object.entries(personality.preferences)) {
                for (const [item, value] of Object.entries(prefs)) {
                    if (value > 0.5) loves.push(item);
                    if (value < -0.5) hates.push(item);
                }
            }
        }

        return `Traits: ${traits.join(', ')}
Loves: ${loves.slice(0, 3).join(', ') || 'exploring'}
Dislikes: ${hates.slice(0, 2).join(', ') || 'none'}`;
    }

    /**
     * Generate a spontaneous message based on recent actions
     */
    generateSpontaneousMessage(bot) {
        if (Date.now() - this.lastChatTime < this.chatCooldown) {
            return null; // On cooldown
        }

        if (this.recentActions.length === 0) {
            return null; // No actions to talk about
        }

        const lastAction = this.recentActions[this.recentActions.length - 1];
        const category = this.getActionCategory(lastAction.name);

        // Get appropriate response template
        const templates = ACTION_RESPONSES[lastAction.name] || ACTION_RESPONSES['default'];
        const template = templates[Math.floor(Math.random() * templates.length)];

        // Fill in template variables
        const position = bot.entity ? `X=${bot.entity.position.x.toFixed(0)}, Z=${bot.entity.position.z.toFixed(0)}` : 'here';
        const message = template
            .replace('{pos}', position)
            .replace('{role}', this.agentType)
            .replace('{y}', bot.entity ? bot.entity.position.y.toFixed(0) : '?')
            .replace('{mob}', 'hostile mob')
            .replace('{count}', Math.floor(Math.random() * 20 + 5))
            .replace('{crop}', ['wheat', 'carrots', 'potatoes'][Math.floor(Math.random() * 3)])
            .replace('{animal}', ['cows', 'sheep', 'chickens'][Math.floor(Math.random() * 3)])
            .replace('{agent}', 'friend')
            .replace('{item}', 'resources')
            .replace('{task}', 'this task')
            .replace('{issue}', 'situation here')
            .replace('{threat}', 'mobs')
            .replace('{resource}', 'valuable ores')
            .replace('{biome}', 'interesting')
            .replace('{structure}', 'structure')
            .replace('{tool}', 'pickaxe')
            .replace('{potion}', 'potion')
            .replace('{wood_type}', 'oak wood')
            .replace('{achievement}', 'achievement')
            .replace('{ore}', 'diamonds');

        this.lastChatTime = Date.now();
        return message;
    }

    /**
     * Generate conversation starter based on activity
     */
    generateConversationStarter(bot) {
        const category = this.recentActions.length > 0
            ? this.getActionCategory(this.recentActions[this.recentActions.length - 1].name)
            : null;

        if (!category || !CONVERSATION_STARTERS[category]) {
            return null;
        }

        const starters = CONVERSATION_STARTERS[category];
        const starter = starters[Math.floor(Math.random() * starters.length)];

        const position = bot.entity ? `X=${bot.entity.position.x.toFixed(0)}, Z=${bot.entity.position.z.toFixed(0)}` : 'here';
        return starter
            .replace('{pos}', position)
            .replace('{ore}', 'diamonds')
            .replace('{biome}', 'mesa');
    }
}

module.exports = { AgentActionChat, ACTION_CATEGORIES, ACTION_RESPONSES };
