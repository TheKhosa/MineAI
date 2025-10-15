/**
 * Emergent Task System
 *
 * Detects and rewards multi-action sequences that accomplish complex goals.
 * Agents discover that certain action combinations lead to higher rewards,
 * enabling emergent learned behaviors without hardcoding task logic.
 *
 * Example emergent tasks:
 * - Craft pickaxe: collect_wood → craft_planks → craft_sticks → craft_pickaxe
 * - Smelt iron: mine_iron → place_furnace → add_fuel → smelt → collect_ingot
 * - Create farm: find_water → till_soil → plant_seeds → wait → harvest
 */

class EmergentTaskSystem {
    constructor() {
        // Task definitions - combinations of actions that form meaningful goals
        this.taskDefinitions = {
            // === BASIC TOOL CRAFTING ===
            craft_wooden_pickaxe: {
                name: 'Craft Wooden Pickaxe',
                actions: ['chop_nearest_tree', 'craft_planks', 'craft_sticks', 'craft_wooden_tools'],
                reward: 20.0,
                description: 'Gather wood and craft a wooden pickaxe'
            },

            craft_stone_pickaxe: {
                name: 'Craft Stone Pickaxe',
                actions: ['mine_stone', 'craft_stone_tools'],
                prerequisites: ['craft_wooden_pickaxe'],
                reward: 30.0,
                description: 'Mine cobblestone and craft a stone pickaxe'
            },

            craft_iron_pickaxe: {
                name: 'Craft Iron Pickaxe',
                actions: ['mine_nearest_ore', 'smelt_iron_ore', 'craft_iron_tools'],
                prerequisites: ['craft_stone_pickaxe'],
                reward: 50.0,
                description: 'Mine iron, smelt it, and craft an iron pickaxe'
            },

            // === SMELTING OPERATIONS ===
            smelt_iron: {
                name: 'Smelt Iron Ore',
                actions: ['mine_nearest_ore', 'place_furnace', 'load_furnace', 'take_from_furnace'],
                reward: 35.0,
                description: 'Complete iron smelting process'
            },

            // === COMBAT PREPARATION ===
            prepare_for_combat: {
                name: 'Prepare for Combat',
                actions: ['craft_wooden_sword', 'equip_armor_set', 'collect_and_organize'],
                reward: 40.0,
                description: 'Craft weapon and equip armor'
            },

            advanced_combat_prep: {
                name: 'Advanced Combat Preparation',
                actions: ['craft_iron_sword', 'craft_iron_armor', 'equip_armor_set', 'craft_shield'],
                prerequisites: ['prepare_for_combat'],
                reward: 70.0,
                description: 'Full iron combat gear'
            },

            // === FARMING ===
            establish_farm: {
                name: 'Establish Farm',
                actions: ['till_soil', 'find_water_source', 'plant_seeds'],
                reward: 45.0,
                description: 'Create a functional farm plot'
            },

            farm_cycle: {
                name: 'Complete Farm Cycle',
                actions: ['plant_seeds', 'use_bone_meal', 'harvest_wheat'],
                prerequisites: ['establish_farm'],
                reward: 30.0,
                description: 'Plant, grow, and harvest crops'
            },

            // === ANIMAL HUSBANDRY ===
            animal_farm: {
                name: 'Animal Farm',
                actions: ['breed_cows', 'breed_pigs', 'breed_chickens'],
                reward: 50.0,
                description: 'Breed multiple animal types'
            },

            // === STORAGE & ORGANIZATION ===
            organize_base: {
                name: 'Organize Base',
                actions: ['place_chest', 'deposit_ores', 'deposit_food', 'deposit_tools'],
                reward: 35.0,
                description: 'Set up organized storage system'
            },

            // === ENCHANTING SETUP ===
            enchanting_station: {
                name: 'Enchanting Station',
                actions: ['create_enchanting_setup', 'gather_lapis', 'enchant_tool'],
                reward: 80.0,
                description: 'Set up enchanting and enchant an item'
            },

            // === TRADING ===
            establish_trading: {
                name: 'Establish Trading',
                actions: ['find_villager', 'gather_emeralds', 'execute_trade'],
                reward: 60.0,
                description: 'Find villager and complete a trade'
            },

            // === SHELTER BUILDING ===
            build_shelter: {
                name: 'Build Shelter',
                actions: ['build_wall', 'build_floor', 'place_torch', 'place_bed'],
                reward: 55.0,
                description: 'Construct basic shelter with bed'
            },

            // === ADVANCED MINING ===
            efficient_mining: {
                name: 'Efficient Mining Operation',
                actions: ['select_optimal_tool', 'strip_mine', 'organize_chest', 'repair_with_anvil'],
                reward: 65.0,
                description: 'Optimized mining workflow'
            },

            // === NETHER PREPARATION ===
            nether_prep: {
                name: 'Nether Preparation',
                actions: ['craft_diamond_pickaxe', 'craft_iron_armor', 'gather_food', 'craft_bucket'],
                prerequisites: ['craft_iron_pickaxe', 'advanced_combat_prep'],
                reward: 100.0,
                description: 'Full gear for Nether exploration'
            },

            // === COOPERATIVE TASKS ===
            team_mining: {
                name: 'Team Mining',
                actions: ['coordinate_mining', 'signal_resources', 'share_resources'],
                reward: 50.0,
                description: 'Coordinate mining with other agents',
                requiresNearbyAgents: true
            },

            cooperative_build: {
                name: 'Cooperative Building',
                actions: ['build_together', 'place_marker_block', 'form_line'],
                reward: 60.0,
                description: 'Build structures cooperatively',
                requiresNearbyAgents: true
            }
        };

        // Track recent action sequences per agent
        this.agentActionHistory = new Map();  // agentName -> recent actions
        this.agentCompletedTasks = new Map(); // agentName -> Set of completed task IDs
        this.actionHistoryLimit = 20;  // Keep last 20 actions

        // Performance metrics
        this.taskCompletionCount = {};
        this.taskAttemptCount = {};

        console.log('[EMERGENT TASKS] System initialized');
        console.log(`[EMERGENT TASKS] Tracking ${Object.keys(this.taskDefinitions).length} emergent task patterns`);
    }

    /**
     * Record an action performed by an agent
     * @param {string} agentName - Agent identifier
     * @param {string} actionName - Name of action performed
     */
    recordAction(agentName, actionName) {
        if (!this.agentActionHistory.has(agentName)) {
            this.agentActionHistory.set(agentName, []);
        }

        const history = this.agentActionHistory.get(agentName);
        history.push({
            action: actionName,
            timestamp: Date.now()
        });

        // Keep only recent history
        if (history.length > this.actionHistoryLimit) {
            history.shift();
        }
    }

    /**
     * Check if agent completed any emergent tasks and calculate bonus reward
     * @param {string} agentName - Agent identifier
     * @param {Object} bot - Bot instance (for context checks)
     * @returns {Object} - { completedTasks: [], totalReward: number }
     */
    checkTaskCompletion(agentName, bot) {
        const history = this.agentActionHistory.get(agentName);
        if (!history || history.length < 2) {
            return { completedTasks: [], totalReward: 0 };
        }

        const recentActions = history.map(h => h.action);
        const completedTasks = [];
        let totalReward = 0;

        // Check each task definition
        for (const [taskId, task] of Object.entries(this.taskDefinitions)) {
            // Skip if already completed (one-time tasks)
            if (this.hasCompletedTask(agentName, taskId)) {
                continue;
            }

            // Check prerequisites
            if (task.prerequisites) {
                const hasPrereqs = task.prerequisites.every(prereq =>
                    this.hasCompletedTask(agentName, prereq)
                );
                if (!hasPrereqs) continue;
            }

            // Check if requires nearby agents
            if (task.requiresNearbyAgents) {
                const nearbyAgents = this.getNearbyAgents(bot);
                if (nearbyAgents.length === 0) continue;
            }

            // Check if action sequence is present in recent history
            if (this.matchesActionSequence(recentActions, task.actions)) {
                // Task completed!
                completedTasks.push({
                    taskId,
                    name: task.name,
                    description: task.description,
                    reward: task.reward
                });

                totalReward += task.reward;
                this.markTaskCompleted(agentName, taskId);

                // Update metrics
                this.taskCompletionCount[taskId] = (this.taskCompletionCount[taskId] || 0) + 1;

                console.log(`[EMERGENT TASK] ✓ ${bot.agentName} completed: ${task.name} (+${task.reward} reward)`);
                console.log(`[EMERGENT TASK]   Actions: ${task.actions.join(' → ')}`);
            } else {
                // Track attempt (partial match)
                if (this.hasPartialMatch(recentActions, task.actions)) {
                    this.taskAttemptCount[taskId] = (this.taskAttemptCount[taskId] || 0) + 1;
                }
            }
        }

        return { completedTasks, totalReward };
    }

    /**
     * Check if action sequence matches task requirements
     * Actions don't need to be consecutive, but must appear in order within the window
     */
    matchesActionSequence(recentActions, requiredActions) {
        let requiredIndex = 0;

        for (const action of recentActions) {
            if (action === requiredActions[requiredIndex]) {
                requiredIndex++;
                if (requiredIndex === requiredActions.length) {
                    return true;  // All required actions found in order
                }
            }
        }

        return false;
    }

    /**
     * Check if agent has partial progress on a task (for tracking attempts)
     */
    hasPartialMatch(recentActions, requiredActions) {
        let matchCount = 0;
        let requiredIndex = 0;

        for (const action of recentActions) {
            if (action === requiredActions[requiredIndex]) {
                matchCount++;
                requiredIndex++;
            }
        }

        // Consider it a partial match if at least 50% of actions are present
        return matchCount >= Math.ceil(requiredActions.length / 2);
    }

    /**
     * Mark a task as completed for an agent (prevents duplicate rewards)
     */
    markTaskCompleted(agentName, taskId) {
        if (!this.agentCompletedTasks.has(agentName)) {
            this.agentCompletedTasks.set(agentName, new Set());
        }
        this.agentCompletedTasks.get(agentName).add(taskId);
    }

    /**
     * Check if agent has completed a specific task
     */
    hasCompletedTask(agentName, taskId) {
        const completed = this.agentCompletedTasks.get(agentName);
        return completed ? completed.has(taskId) : false;
    }

    /**
     * Get nearby agents for cooperative task checks
     */
    getNearbyAgents(bot) {
        const nearbyAgents = [];
        if (global.activeAgents && bot.entity) {
            for (const [name, otherBot] of global.activeAgents) {
                if (otherBot !== bot && otherBot.entity && otherBot.entity.position) {
                    const dist = otherBot.entity.position.distanceTo(bot.entity.position);
                    if (dist < 16) {
                        nearbyAgents.push(otherBot);
                    }
                }
            }
        }
        return nearbyAgents;
    }

    /**
     * Reset task progress for an agent (on death/respawn)
     */
    resetAgent(agentName) {
        this.agentActionHistory.delete(agentName);
        // Don't delete completed tasks - those persist across deaths
    }

    /**
     * Get statistics on emergent task system
     */
    getStats() {
        const totalCompletions = Object.values(this.taskCompletionCount).reduce((sum, c) => sum + c, 0);
        const totalAttempts = Object.values(this.taskAttemptCount).reduce((sum, c) => sum + c, 0);

        return {
            totalTasks: Object.keys(this.taskDefinitions).length,
            totalCompletions,
            totalAttempts,
            successRate: totalAttempts > 0 ? (totalCompletions / totalAttempts * 100).toFixed(1) + '%' : 'N/A',
            topTasks: this.getTopCompletedTasks(5)
        };
    }

    /**
     * Get most frequently completed tasks
     */
    getTopCompletedTasks(limit = 5) {
        return Object.entries(this.taskCompletionCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([taskId, count]) => ({
                task: this.taskDefinitions[taskId].name,
                completions: count
            }));
    }

    /**
     * Get list of available tasks for an agent (considering prerequisites)
     */
    getAvailableTasks(agentName) {
        const available = [];

        for (const [taskId, task] of Object.entries(this.taskDefinitions)) {
            if (this.hasCompletedTask(agentName, taskId)) {
                continue;  // Already completed
            }

            // Check prerequisites
            if (task.prerequisites) {
                const hasPrereqs = task.prerequisites.every(prereq =>
                    this.hasCompletedTask(agentName, prereq)
                );
                if (!hasPrereqs) continue;
            }

            available.push({
                taskId,
                name: task.name,
                description: task.description,
                actions: task.actions,
                reward: task.reward
            });
        }

        return available;
    }
}

// Singleton instance
let emergentTaskSystem = null;

function getEmergentTaskSystem() {
    if (!emergentTaskSystem) {
        emergentTaskSystem = new EmergentTaskSystem();
    }
    return emergentTaskSystem;
}

module.exports = { EmergentTaskSystem, getEmergentTaskSystem };
