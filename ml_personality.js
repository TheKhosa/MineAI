/**
 * ML Personality Integration - Connects Personality System with ML Reward System
 *
 * This module bridges the agent_personality_system.js with the ML training system,
 * providing personality-aware reward modifiers, compatibility bonuses, and
 * experience-based personality evolution.
 *
 * Key Features:
 * - Compatibility-based reward modifiers for social interactions
 * - Personality-driven action preferences
 * - Experience tracking that evolves personality over time
 * - Genetic personality inheritance with mutations
 * - Faction formation through compatibility clustering
 */

const { getPersonalitySystem } = require('./agent_personality_system');

class MLPersonalityIntegration {
    constructor() {
        this.personalitySystem = getPersonalitySystem();
        this.experienceTracking = new Map(); // Track experiences per agent UUID
    }

    /**
     * Generate personality for a new agent
     * @param {string} agentUUID - Unique agent identifier
     * @param {string} agentName - Agent name
     * @param {number} generation - Generation number
     * @param {Object} parentPersonality - Parent's personality (if offspring)
     * @param {number} mutationRate - Mutation rate for inheritance (0-1)
     * @returns {Object} - Generated personality
     */
    generateAgentPersonality(agentUUID, agentName, generation, parentPersonality = null, mutationRate = 0.3) {
        const personality = parentPersonality
            ? this.personalitySystem.inheritPersonality(parentPersonality, mutationRate)
            : this.personalitySystem.generatePersonality();

        // Initialize experience tracking
        this.experienceTracking.set(agentUUID, {
            agentName,
            generation,
            activities: {},
            successfulActions: {},
            failedActions: {}
        });

        const summary = this.personalitySystem.getPersonalitySummary(personality);
        console.log(`[ML_PERSONALITY] ${agentName} (Gen ${generation}):`);
        console.log(`  Traits: ${summary.traits}`);
        console.log(`  Loves: ${summary.loves.slice(0, 3).join(', ')}`);
        console.log(`  Hates: ${summary.hates.slice(0, 2).join(', ')}`);

        return personality;
    }

    /**
     * Calculate compatibility-based reward modifier for social interactions
     * @param {Object} agent1Personality - First agent's personality
     * @param {Object} agent2Personality - Second agent's personality
     * @returns {Object} - { modifier, description, compatibility }
     */
    getSocialRewardModifier(agent1Personality, agent2Personality) {
        const compatibility = this.personalitySystem.calculateCompatibility(
            agent1Personality,
            agent2Personality
        );
        const description = this.personalitySystem.getCompatibilityDescription(compatibility);

        let modifier = 0.5; // Base social reward

        // High compatibility bonus
        if (compatibility > 0.5) {
            modifier += 0.3 + (compatibility * 0.2); // +0.3 to +0.5 bonus
        }
        // Good compatibility bonus
        else if (compatibility > 0.2) {
            modifier += 0.15;
        }
        // Low compatibility penalty
        else if (compatibility < -0.2) {
            modifier = 0.2; // Reduced reward
        }
        // Enemies penalty
        else if (compatibility < -0.5) {
            modifier = 0.1; // Minimal reward
        }

        return { modifier, description, compatibility };
    }

    /**
     * Calculate action preference modifier based on personality
     * Returns higher rewards for actions the agent likes
     * @param {Object} personality - Agent personality
     * @param {string} actionType - Type of action ('mining', 'building', etc.)
     * @param {string} category - Preference category ('activities', 'items', etc.)
     * @returns {number} - Reward multiplier (0.5 to 1.5)
     */
    getActionPreferenceModifier(personality, actionType, category = 'activities') {
        if (!personality || !personality.likes || !personality.dislikes) {
            return 1.0; // Neutral
        }

        const likes = personality.likes[category] || [];
        const dislikes = personality.dislikes[category] || [];

        // Agent likes this action
        if (likes.includes(actionType)) {
            return 1.5; // +50% reward bonus
        }

        // Agent dislikes this action
        if (dislikes.includes(actionType)) {
            return 0.5; // -50% reward penalty
        }

        return 1.0; // Neutral
    }

    /**
     * Record experience and update personality
     * @param {string} agentUUID - Agent UUID
     * @param {Object} personality - Agent's personality (will be modified)
     * @param {string} category - Experience category ('activities', 'items', 'biomes')
     * @param {string} item - Specific item/activity
     * @param {boolean} success - Whether experience was positive
     * @param {number} strength - Strength of experience (default 0.05)
     */
    recordExperience(agentUUID, personality, category, item, success, strength = 0.05) {
        // Track experience
        const tracking = this.experienceTracking.get(agentUUID);
        if (tracking) {
            if (!tracking.activities[category]) {
                tracking.activities[category] = {};
            }
            if (!tracking.activities[category][item]) {
                tracking.activities[category][item] = { successes: 0, failures: 0 };
            }

            if (success) {
                tracking.activities[category][item].successes++;
                tracking.successfulActions[item] = (tracking.successfulActions[item] || 0) + 1;
            } else {
                tracking.activities[category][item].failures++;
                tracking.failedActions[item] = (tracking.failedActions[item] || 0) + 1;
            }
        }

        // Update personality based on experience
        this.personalitySystem.updateFromExperience(personality, category, item, success, strength);
    }

    /**
     * Calculate cooperation bonus when agents work together
     * @param {Object} agent1Personality - First agent's personality
     * @param {Object} agent2Personality - Second agent's personality
     * @param {string} activity - Joint activity type
     * @returns {number} - Cooperation bonus (0 to 1.0)
     */
    getCooperationBonus(agent1Personality, agent2Personality, activity) {
        const compatibility = this.personalitySystem.calculateCompatibility(
            agent1Personality,
            agent2Personality
        );

        let bonus = 0;

        // Base compatibility bonus
        if (compatibility > 0.5) {
            bonus += 0.5 * compatibility; // Up to +0.5 for best friends
        }

        // Both agents like the activity
        const agent1Likes = agent1Personality.likes.activities?.includes(activity);
        const agent2Likes = agent2Personality.likes.activities?.includes(activity);

        if (agent1Likes && agent2Likes) {
            bonus += 0.3; // Shared interest bonus
        }

        // Cooperative personality traits
        const cooperativeTraits = ['cooperative', 'helper', 'friendly', 'loyal'];
        const agent1Coop = agent1Personality.traits?.some(t => cooperativeTraits.includes(t));
        const agent2Coop = agent2Personality.traits?.some(t => cooperativeTraits.includes(t));

        if (agent1Coop && agent2Coop) {
            bonus += 0.2; // Cooperative personalities work well together
        }

        return Math.min(1.0, bonus);
    }

    /**
     * Find compatible agents for faction/group formation
     * @param {Object} agentPersonality - Agent's personality
     * @param {Map} allAgents - Map of all active agents
     * @param {number} minCompatibility - Minimum compatibility threshold
     * @returns {Array} - Array of compatible agent info
     */
    findCompatibleAgents(agentPersonality, allAgents, minCompatibility = 0.3) {
        const agentsObject = {};

        // Convert Map to object for compatibility with personality system
        for (const [name, bot] of allAgents.entries()) {
            if (bot.personality) {
                agentsObject[bot.uuid || name] = {
                    agentName: bot.agentName || name,
                    personality: bot.personality
                };
            }
        }

        return this.personalitySystem.findCompatibleAgents(agentPersonality, agentsObject, minCompatibility);
    }

    /**
     * Find rivals for conflict/competition
     * @param {Object} agentPersonality - Agent's personality
     * @param {Map} allAgents - Map of all active agents
     * @param {number} maxCompatibility - Maximum compatibility threshold
     * @returns {Array} - Array of rival agent info
     */
    findRivals(agentPersonality, allAgents, maxCompatibility = -0.2) {
        const agentsObject = {};

        // Convert Map to object for compatibility with personality system
        for (const [name, bot] of allAgents.entries()) {
            if (bot.personality) {
                agentsObject[bot.uuid || name] = {
                    agentName: bot.agentName || name,
                    personality: bot.personality
                };
            }
        }

        return this.personalitySystem.findRivals(agentPersonality, agentsObject, maxCompatibility);
    }

    /**
     * Get conversation topic based on personality
     * @param {Object} personality - Agent's personality
     * @returns {Object} - { category, item, sentiment }
     */
    getConversationTopic(personality) {
        return this.personalitySystem.getConversationTopic(personality);
    }

    /**
     * Get personality summary for display
     * @param {Object} personality - Agent's personality
     * @returns {Object} - { traits, loves, hates }
     */
    getPersonalitySummary(personality) {
        return this.personalitySystem.getPersonalitySummary(personality);
    }

    /**
     * Get compatibility description
     * @param {number} score - Compatibility score
     * @returns {string} - Description
     */
    getCompatibilityDescription(score) {
        return this.personalitySystem.getCompatibilityDescription(score);
    }

    /**
     * Calculate personality influence on ML action selection
     * Returns probability distribution adjustments based on preferences
     * @param {Object} personality - Agent's personality
     * @param {Array} actions - Available actions
     * @returns {Array} - Modified action probabilities
     */
    getPersonalityBiasedActions(personality, actions) {
        const biasedActions = actions.map(action => {
            const actionCopy = { ...action };

            // Map action to personality preferences
            const activityMap = {
                'dig': 'mining',
                'place': 'building',
                'attack': 'fighting',
                'craft': 'crafting',
                'move': 'exploring'
            };

            const activity = activityMap[action.type] || action.type;
            const modifier = this.getActionPreferenceModifier(personality, activity, 'activities');

            // Adjust probability based on personality
            actionCopy.probability = (actionCopy.probability || 1.0) * modifier;

            return actionCopy;
        });

        // Normalize probabilities
        const totalProb = biasedActions.reduce((sum, a) => sum + (a.probability || 1.0), 0);
        if (totalProb > 0) {
            biasedActions.forEach(a => {
                a.probability = (a.probability || 1.0) / totalProb;
            });
        }

        return biasedActions;
    }

    /**
     * Get experience statistics for an agent
     * @param {string} agentUUID - Agent UUID
     * @returns {Object} - Experience statistics
     */
    getExperienceStats(agentUUID) {
        return this.experienceTracking.get(agentUUID) || null;
    }

    /**
     * Export personality to JSON string
     * @param {Object} personality - Personality object
     * @returns {string} - JSON string
     */
    exportPersonality(personality) {
        return this.personalitySystem.exportPersonality(personality);
    }

    /**
     * Import personality from JSON string
     * @param {string} json - JSON string
     * @returns {Object} - Personality object
     */
    importPersonality(json) {
        return this.personalitySystem.importPersonality(json);
    }
}

// Singleton instance
let mlPersonalityInstance = null;

function getMLPersonality() {
    if (!mlPersonalityInstance) {
        mlPersonalityInstance = new MLPersonalityIntegration();
    }
    return mlPersonalityInstance;
}

module.exports = { MLPersonalityIntegration, getMLPersonality };
