/**
 * Hierarchical Goal System for Reinforcement Learning
 * High-level goals guide low-level action selection
 * Inspired by hierarchical RL and goal-conditioned RL
 */

class HierarchicalGoalManager {
    constructor() {
        // Define high-level goals
        this.GOALS = {
            EXPLORE: {
                name: 'explore',
                description: 'Discover new areas and resources',
                duration: 120, // 2 minutes
                actionBias: {
                    'wander': 2.0,
                    'explore_underground': 2.5,
                    'explore_surface': 2.0,
                    'mine_nearest_ore': 1.5,
                    'follow_interesting_entity': 1.5
                },
                successCriteria: (bot, startState) => {
                    // Success if discovered 2+ new chunks
                    const chunksExplored = (bot.mlExploredChunks?.size || 0) - (startState.exploredChunks || 0);
                    return chunksExplored >= 2;
                },
                needsPriority: { exploration: 2.0, curiosity: 1.5, boredom: 1.8 }
            },

            GATHER_RESOURCES: {
                name: 'gather_resources',
                description: 'Collect materials and items',
                duration: 180, // 3 minutes
                actionBias: {
                    'mine_nearest_ore': 2.5,
                    'mine_stone': 2.0,
                    'chop_nearest_tree': 2.0,
                    'pickup_nearest_item': 2.5,
                    'hunt_animal': 1.8,
                    'gather_food': 2.0
                },
                successCriteria: (bot, startState) => {
                    // Success if inventory increased by 5+ items
                    const itemsGained = bot.inventory.items().length - (startState.inventorySize || 0);
                    return itemsGained >= 5;
                },
                needsPriority: { achievement: 2.0, hunger: 1.5, motivation: 1.7 }
            },

            BUILD_SHELTER: {
                name: 'build_shelter',
                description: 'Construct protective structures',
                duration: 240, // 4 minutes
                actionBias: {
                    'build_shelter_structure': 3.0,
                    'place_block': 2.5,
                    'build_wall': 2.5,
                    'build_floor': 2.0,
                    'place_door': 2.0,
                    'craft_item': 1.8
                },
                successCriteria: (bot, startState) => {
                    // Success if placed 10+ blocks
                    const blocksPlaced = (bot.rewards?.stats?.blocks_placed || 0) - (startState.blocksPlaced || 0);
                    return blocksPlaced >= 10;
                },
                needsPriority: { comfort: 2.5, safety: 2.0, creativity: 1.8 }
            },

            SOCIALIZE: {
                name: 'socialize',
                description: 'Interact with other agents',
                duration: 150, // 2.5 minutes
                actionBias: {
                    'follow_nearest_player': 2.5,
                    'assist_nearby_agent': 2.5,
                    'coordinate_mining': 2.0,
                    'defend_ally': 2.0,
                    'share_resources': 2.0,
                    'wander': 1.5 // To find other agents
                },
                successCriteria: (bot, startState) => {
                    // Success if cooperated with others or gained relationships
                    const cooperationEvents = (bot.rewards?.stats?.cooperation_events || 0) - (startState.cooperationEvents || 0);
                    return cooperationEvents >= 1;
                },
                needsPriority: { social: 2.5, loneliness: 2.0, cooperation: 2.2 }
            },

            DEFEND: {
                name: 'defend',
                description: 'Fight hostile mobs and protect allies',
                duration: 90, // 1.5 minutes
                actionBias: {
                    'attack_nearest': 2.5,
                    'fight_zombie': 2.5,
                    'fight_skeleton': 2.5,
                    'fight_creeper': 2.5,
                    'defend_ally': 3.0,
                    'retreat_from_danger': 2.0
                },
                successCriteria: (bot, startState) => {
                    // Success if killed mobs or escaped danger
                    const mobsKilled = (bot.rewards?.stats?.mobs_killed || 0) - (startState.mobsKilled || 0);
                    const healthDelta = bot.health - (startState.health || 20);
                    return mobsKilled >= 1 || healthDelta > 0;
                },
                needsPriority: { safety: 3.0, stress: -1.5, fear: -1.5 } // Negative = activated when need is LOW
            },

            REST: {
                name: 'rest',
                description: 'Recover and plan next actions',
                duration: 60, // 1 minute
                actionBias: {
                    'idle': 2.0,
                    'look_around': 1.8,
                    'eat_food': 2.5,
                    'craft_item': 1.5
                },
                successCriteria: (bot, startState) => {
                    // Success if health/food improved or time passed
                    const healthDelta = bot.health - (startState.health || 20);
                    const foodDelta = bot.food - (startState.food || 20);
                    return healthDelta > 0 || foodDelta > 2;
                },
                needsPriority: { rest: 2.5, energy: 2.0, hunger: 1.8 }
            },

            CRAFT_TOOLS: {
                name: 'craft_tools',
                description: 'Create tools and equipment',
                duration: 120, // 2 minutes
                actionBias: {
                    'craft_pickaxe': 3.0,
                    'craft_axe': 3.0,
                    'craft_sword': 2.5,
                    'craft_item': 2.5,
                    'place_crafting_table': 2.5,
                    'smelt_ore': 2.0
                },
                successCriteria: (bot, startState) => {
                    // Success if crafted tools or placed crafting station
                    const hasPick = bot.inventory.items().some(i => i.name.includes('pickaxe'));
                    const hasAxe = bot.inventory.items().some(i => i.name.includes('axe'));
                    const hasSword = bot.inventory.items().some(i => i.name.includes('sword'));
                    return (hasPick && !startState.hadPickaxe) || (hasAxe && !startState.hadAxe) || (hasSword && !startState.hadSword);
                },
                needsPriority: { achievement: 2.2, creativity: 2.0, motivation: 1.8 }
            }
        };

        console.log('[HIERARCHICAL RL] Goal system initialized with', Object.keys(this.GOALS).length, 'goals');
    }

    /**
     * Select initial goal for agent based on needs and moods
     */
    selectInitialGoal(bot) {
        const needs = bot.needs || {};
        const moods = bot.moods || {};

        // Calculate priority scores for each goal
        const goalScores = {};

        for (const [goalKey, goal] of Object.entries(this.GOALS)) {
            let score = 1.0;

            // Factor in need/mood priorities
            for (const [needName, weight] of Object.entries(goal.needsPriority)) {
                const needValue = needs[needName] !== undefined ? needs[needName] :
                                 moods[needName] !== undefined ? moods[needName] : 0.5;

                // If weight is negative, activated when need is LOW
                if (weight < 0) {
                    score += (1.0 - needValue) * Math.abs(weight);
                } else {
                    score += (1.0 - needValue) * weight; // Low need = high priority
                }
            }

            // Random exploration factor (10% randomness)
            score += Math.random() * 0.1;

            goalScores[goalKey] = score;
        }

        // Select highest scoring goal
        let bestGoal = 'EXPLORE';
        let bestScore = -Infinity;

        for (const [goalKey, score] of Object.entries(goalScores)) {
            if (score > bestScore) {
                bestScore = score;
                bestGoal = goalKey;
            }
        }

        const selectedGoal = this.GOALS[bestGoal];

        console.log(`[GOAL] ${bot.agentName} selected goal: ${selectedGoal.name} (score: ${bestScore.toFixed(2)})`);

        return {
            ...selectedGoal,
            startTime: Date.now(),
            startState: this.captureState(bot),
            completed: false,
            abandoned: false
        };
    }

    /**
     * Capture bot state for goal tracking
     */
    captureState(bot) {
        return {
            exploredChunks: bot.mlExploredChunks?.size || 0,
            inventorySize: bot.inventory.items().length,
            blocksPlaced: bot.rewards?.stats?.blocks_placed || 0,
            cooperationEvents: bot.rewards?.stats?.cooperation_events || 0,
            mobsKilled: bot.rewards?.stats?.mobs_killed || 0,
            health: bot.health,
            food: bot.food,
            hadPickaxe: bot.inventory.items().some(i => i.name.includes('pickaxe')),
            hadAxe: bot.inventory.items().some(i => i.name.includes('axe')),
            hadSword: bot.inventory.items().some(i => i.name.includes('sword'))
        };
    }

    /**
     * Check if current goal should be updated
     * Returns new goal if change needed, null otherwise
     */
    updateGoal(bot) {
        if (!bot.currentGoal) {
            return this.selectInitialGoal(bot);
        }

        const goal = bot.currentGoal;
        const elapsed = Date.now() - goal.startTime;
        const goalDef = this.GOALS[goal.name.toUpperCase().replace(/_/g, '_')];

        // Check success criteria
        if (goalDef && goalDef.successCriteria(bot, goal.startState)) {
            console.log(`[GOAL] ${bot.agentName} completed goal: ${goal.name}`);
            goal.completed = true;

            // Reward for completing goal
            if (bot.rewards) {
                bot.rewards.addReward(15.0, 'goal_completed', `completed ${goal.name}`);
            }

            return this.selectInitialGoal(bot);
        }

        // Check timeout
        if (elapsed > goal.duration * 1000) {
            console.log(`[GOAL] ${bot.agentName} timed out on goal: ${goal.name}`);
            return this.selectInitialGoal(bot);
        }

        // Check if needs have changed drastically (goal abandonment)
        const needs = bot.needs || {};
        const moods = bot.moods || {};

        // Urgent situations override current goal
        if (needs.safety !== undefined && needs.safety < 0.3 && goal.name !== 'defend') {
            console.log(`[GOAL] ${bot.agentName} abandoning ${goal.name} for DEFEND (low safety)`);
            goal.abandoned = true;
            return { ...this.GOALS.DEFEND, startTime: Date.now(), startState: this.captureState(bot) };
        }

        if (needs.hunger !== undefined && needs.hunger < 0.2 && goal.name !== 'gather_resources') {
            console.log(`[GOAL] ${bot.agentName} abandoning ${goal.name} for GATHER_RESOURCES (starving)`);
            goal.abandoned = true;
            return { ...this.GOALS.GATHER_RESOURCES, startTime: Date.now(), startState: this.captureState(bot) };
        }

        if (needs.rest !== undefined && needs.rest < 0.15 && goal.name !== 'rest') {
            console.log(`[GOAL] ${bot.agentName} abandoning ${goal.name} for REST (exhausted)`);
            goal.abandoned = true;
            return { ...this.GOALS.REST, startTime: Date.now(), startState: this.captureState(bot) };
        }

        // No change needed
        return null;
    }

    /**
     * Get action probability bias based on current goal
     * Returns multiplier array for action space
     */
    getActionBiasVector(bot, actionSpace) {
        if (!bot.currentGoal) {
            return Array(actionSpace.ACTION_COUNT).fill(1.0);
        }

        const biasVector = Array(actionSpace.ACTION_COUNT).fill(1.0);
        const goal = bot.currentGoal;

        // Apply action biases from goal definition
        for (let i = 0; i < actionSpace.ACTION_COUNT; i++) {
            const actionName = actionSpace.getActionName(i);

            if (goal.actionBias && goal.actionBias[actionName]) {
                biasVector[i] = goal.actionBias[actionName];
            }
        }

        return biasVector;
    }

    /**
     * Get goal progress (0.0 to 1.0)
     */
    getGoalProgress(bot) {
        if (!bot.currentGoal) return 0.0;

        const goal = bot.currentGoal;
        const elapsed = Date.now() - goal.startTime;
        const goalDef = this.GOALS[goal.name.toUpperCase().replace(/_/g, '_')];

        // Time-based progress
        const timeProgress = Math.min(1.0, elapsed / (goal.duration * 1000));

        // Success criteria progress (if available)
        if (goalDef && goalDef.successCriteria(bot, goal.startState)) {
            return 1.0; // Completed
        }

        return timeProgress;
    }

    /**
     * Get goal statistics for dashboard
     */
    getGoalStats(bot) {
        if (!bot.currentGoal) return null;

        return {
            name: bot.currentGoal.name,
            description: bot.currentGoal.description,
            progress: this.getGoalProgress(bot),
            timeElapsed: Date.now() - bot.currentGoal.startTime,
            duration: bot.currentGoal.duration * 1000,
            completed: bot.currentGoal.completed || false,
            abandoned: bot.currentGoal.abandoned || false
        };
    }
}

// Singleton instance
let goalManagerInstance = null;

function getGoalManager() {
    if (!goalManagerInstance) {
        goalManagerInstance = new HierarchicalGoalManager();
    }
    return goalManagerInstance;
}

module.exports = { HierarchicalGoalManager, getGoalManager };
