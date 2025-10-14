/**
 * Agent Personality System - Likes, Dislikes, and Social Compatibility
 *
 * Creates emergent social dynamics similar to The Sims and WorldBox:
 * - Agents have unique personality traits and preferences
 * - Shared interests strengthen relationships
 * - Conflicting preferences create rivalries
 * - Preferences evolve through experience and genetics
 * - Agents form emergent factions based on compatibility
 *
 * Compatibility Formula:
 * - Shared likes: +0.2 per match
 * - Shared dislikes: +0.1 per match
 * - Conflicting preferences (A likes what B dislikes): -0.3 per conflict
 * - Result: Compatibility score from -1.0 to +1.0
 */

class AgentPersonalitySystem {
    constructor() {
        this.preferenceCategories = {
            activities: [
                'mining', 'building', 'exploring', 'fighting', 'farming',
                'trading', 'crafting', 'hunting', 'fishing', 'gathering'
            ],
            biomes: [
                'forest', 'desert', 'mountains', 'plains', 'ocean',
                'cave', 'swamp', 'jungle', 'taiga', 'nether'
            ],
            items: [
                'diamonds', 'gold', 'iron', 'wood', 'stone',
                'food', 'weapons', 'tools', 'blocks', 'redstone'
            ],
            behaviors: [
                'cooperative', 'competitive', 'cautious', 'bold',
                'creative', 'efficient', 'patient', 'impulsive',
                'organized', 'spontaneous'
            ],
            social: [
                'talkative', 'quiet', 'friendly', 'solitary',
                'leader', 'follower', 'helper', 'independent',
                'loyal', 'opportunistic'
            ]
        };
    }

    /**
     * Generate a new personality for an agent
     * @param {Object} parent - Optional parent personality to inherit from
     * @param {number} mutationRate - How much to mutate from parent (0-1)
     * @returns {Object} - Complete personality profile
     */
    generatePersonality(parent = null, mutationRate = 0.3) {
        if (parent) {
            return this.inheritPersonality(parent, mutationRate);
        }

        const personality = {
            likes: {},
            dislikes: {},
            traits: [],
            birthTime: Date.now(),
            experienceModifiers: {} // Tracks how experiences affect preferences
        };

        // Generate likes (2-3 per category)
        for (const [category, options] of Object.entries(this.preferenceCategories)) {
            const numLikes = Math.floor(Math.random() * 2) + 2; // 2-3 likes
            const numDislikes = Math.floor(Math.random() * 2) + 1; // 1-2 dislikes

            personality.likes[category] = this.selectRandom(options, numLikes);

            // Dislikes must not overlap with likes
            const availableForDislikes = options.filter(opt => !personality.likes[category].includes(opt));
            personality.dislikes[category] = this.selectRandom(availableForDislikes, numDislikes);
        }

        // Generate 3-5 dominant personality traits
        const allTraits = [...this.preferenceCategories.behaviors, ...this.preferenceCategories.social];
        personality.traits = this.selectRandom(allTraits, Math.floor(Math.random() * 3) + 3);

        return personality;
    }

    /**
     * Inherit personality from parent with mutations
     */
    inheritPersonality(parentPersonality, mutationRate = 0.3) {
        const personality = {
            likes: {},
            dislikes: {},
            traits: [],
            birthTime: Date.now(),
            experienceModifiers: {},
            parentPersonality: parentPersonality // Track genetic lineage
        };

        // Inherit likes/dislikes with mutations
        for (const [category, options] of Object.entries(this.preferenceCategories)) {
            // Start with parent's preferences
            personality.likes[category] = [...(parentPersonality.likes[category] || [])];
            personality.dislikes[category] = [...(parentPersonality.dislikes[category] || [])];

            // Apply mutations
            if (Math.random() < mutationRate) {
                // Remove a random like
                if (personality.likes[category].length > 0) {
                    const removeIdx = Math.floor(Math.random() * personality.likes[category].length);
                    personality.likes[category].splice(removeIdx, 1);
                }

                // Add a new like
                const available = options.filter(opt =>
                    !personality.likes[category].includes(opt) &&
                    !personality.dislikes[category].includes(opt)
                );
                if (available.length > 0) {
                    personality.likes[category].push(available[Math.floor(Math.random() * available.length)]);
                }
            }

            if (Math.random() < mutationRate) {
                // Mutate dislikes similarly
                if (personality.dislikes[category].length > 0) {
                    const removeIdx = Math.floor(Math.random() * personality.dislikes[category].length);
                    personality.dislikes[category].splice(removeIdx, 1);
                }

                const available = options.filter(opt =>
                    !personality.likes[category].includes(opt) &&
                    !personality.dislikes[category].includes(opt)
                );
                if (available.length > 0) {
                    personality.dislikes[category].push(available[Math.floor(Math.random() * available.length)]);
                }
            }
        }

        // Inherit traits with some mutation
        personality.traits = [...(parentPersonality.traits || [])];
        if (Math.random() < mutationRate * 2) {
            // Change 1-2 traits
            const allTraits = [...this.preferenceCategories.behaviors, ...this.preferenceCategories.social];
            const numChanges = Math.floor(Math.random() * 2) + 1;

            for (let i = 0; i < numChanges; i++) {
                if (personality.traits.length > 0) {
                    const removeIdx = Math.floor(Math.random() * personality.traits.length);
                    personality.traits.splice(removeIdx, 1);
                }

                const available = allTraits.filter(t => !personality.traits.includes(t));
                if (available.length > 0) {
                    personality.traits.push(available[Math.floor(Math.random() * available.length)]);
                }
            }
        }

        return personality;
    }

    /**
     * Calculate compatibility between two agents (-1.0 to +1.0)
     * Positive = compatible, Negative = incompatible
     */
    calculateCompatibility(personality1, personality2) {
        let compatibilityScore = 0;
        let totalComparisons = 0;

        // Compare likes and dislikes across all categories
        for (const category of Object.keys(this.preferenceCategories)) {
            const p1Likes = personality1.likes[category] || [];
            const p1Dislikes = personality1.dislikes[category] || [];
            const p2Likes = personality2.likes[category] || [];
            const p2Dislikes = personality2.dislikes[category] || [];

            // Shared likes (strong positive)
            const sharedLikes = p1Likes.filter(item => p2Likes.includes(item));
            compatibilityScore += sharedLikes.length * 0.2;
            totalComparisons += sharedLikes.length;

            // Shared dislikes (moderate positive)
            const sharedDislikes = p1Dislikes.filter(item => p2Dislikes.includes(item));
            compatibilityScore += sharedDislikes.length * 0.1;
            totalComparisons += sharedDislikes.length;

            // Conflicting preferences (strong negative)
            const conflicts1 = p1Likes.filter(item => p2Dislikes.includes(item));
            const conflicts2 = p2Likes.filter(item => p1Dislikes.includes(item));
            const totalConflicts = conflicts1.length + conflicts2.length;
            compatibilityScore -= totalConflicts * 0.3;
            totalComparisons += totalConflicts;
        }

        // Compare personality traits
        const sharedTraits = personality1.traits.filter(trait => personality2.traits.includes(trait));
        compatibilityScore += sharedTraits.length * 0.15;
        totalComparisons += sharedTraits.length;

        // Normalize to -1.0 to +1.0 range
        if (totalComparisons === 0) return 0;

        const normalized = Math.max(-1.0, Math.min(1.0, compatibilityScore));
        return normalized;
    }

    /**
     * Get compatibility description
     */
    getCompatibilityDescription(score) {
        if (score >= 0.7) return 'Best Friends';
        if (score >= 0.4) return 'Good Friends';
        if (score >= 0.2) return 'Friendly';
        if (score >= -0.1) return 'Neutral';
        if (score >= -0.3) return 'Tense';
        if (score >= -0.6) return 'Rivalry';
        return 'Enemies';
    }

    /**
     * Update personality based on experience
     * Successful activities become liked, failures become disliked
     */
    updateFromExperience(personality, category, item, success, strength = 0.1) {
        if (!personality.experienceModifiers[category]) {
            personality.experienceModifiers[category] = {};
        }

        if (!personality.experienceModifiers[category][item]) {
            personality.experienceModifiers[category][item] = 0;
        }

        // Update experience modifier
        personality.experienceModifiers[category][item] += success ? strength : -strength;

        const modifier = personality.experienceModifiers[category][item];

        // Strong positive experiences can convert dislikes to likes
        if (modifier > 0.5 && personality.dislikes[category]?.includes(item)) {
            personality.dislikes[category] = personality.dislikes[category].filter(i => i !== item);
            if (!personality.likes[category].includes(item)) {
                personality.likes[category].push(item);
            }
            console.log(`[PERSONALITY] Agent now LIKES ${item} after positive experiences (+${modifier.toFixed(2)})`);
        }

        // Strong negative experiences can convert likes to dislikes
        if (modifier < -0.5 && personality.likes[category]?.includes(item)) {
            personality.likes[category] = personality.likes[category].filter(i => i !== item);
            if (!personality.dislikes[category].includes(item)) {
                personality.dislikes[category].push(item);
            }
            console.log(`[PERSONALITY] Agent now DISLIKES ${item} after negative experiences (${modifier.toFixed(2)})`);
        }

        // Develop new likes from neutral experiences
        if (modifier > 0.3 &&
            !personality.likes[category]?.includes(item) &&
            !personality.dislikes[category]?.includes(item)) {
            personality.likes[category] = personality.likes[category] || [];
            personality.likes[category].push(item);
            console.log(`[PERSONALITY] Agent discovered new LIKE: ${item} (+${modifier.toFixed(2)})`);
        }
    }

    /**
     * Generate a chat topic based on personality
     * Returns a random like/dislike to discuss
     */
    getConversationTopic(personality) {
        const categories = Object.keys(personality.likes);
        const category = categories[Math.floor(Math.random() * categories.length)];

        // 70% chance to talk about likes, 30% about dislikes
        const discussLikes = Math.random() < 0.7;

        if (discussLikes && personality.likes[category]?.length > 0) {
            const item = personality.likes[category][Math.floor(Math.random() * personality.likes[category].length)];
            return { category, item, sentiment: 'like' };
        } else if (personality.dislikes[category]?.length > 0) {
            const item = personality.dislikes[category][Math.floor(Math.random() * personality.dislikes[category].length)];
            return { category, item, sentiment: 'dislike' };
        }

        return null;
    }

    /**
     * Build a personality summary string
     */
    getPersonalitySummary(personality) {
        const summary = {
            traits: personality.traits.join(', '),
            loves: [],
            hates: []
        };

        // Top 3 likes across all categories
        for (const [category, items] of Object.entries(personality.likes)) {
            for (const item of items.slice(0, 2)) { // Top 2 per category
                summary.loves.push(`${item} (${category})`);
            }
        }

        // Top 3 dislikes
        for (const [category, items] of Object.entries(personality.dislikes)) {
            for (const item of items.slice(0, 1)) { // Top 1 per category
                summary.hates.push(`${item} (${category})`);
            }
        }

        return summary;
    }

    /**
     * Find faction/group based on personality similarity
     * Returns list of compatible agent UUIDs
     */
    findCompatibleAgents(agentPersonality, allAgents, minCompatibility = 0.3) {
        const compatible = [];

        for (const [uuid, otherAgent] of Object.entries(allAgents)) {
            if (!otherAgent.personality) continue;

            const compatibility = this.calculateCompatibility(agentPersonality, otherAgent.personality);

            if (compatibility >= minCompatibility) {
                compatible.push({
                    uuid,
                    name: otherAgent.agentName,
                    compatibility,
                    description: this.getCompatibilityDescription(compatibility)
                });
            }
        }

        // Sort by compatibility (highest first)
        compatible.sort((a, b) => b.compatibility - a.compatibility);

        return compatible;
    }

    /**
     * Find rivals based on low compatibility
     */
    findRivals(agentPersonality, allAgents, maxCompatibility = -0.2) {
        const rivals = [];

        for (const [uuid, otherAgent] of Object.entries(allAgents)) {
            if (!otherAgent.personality) continue;

            const compatibility = this.calculateCompatibility(agentPersonality, otherAgent.personality);

            if (compatibility <= maxCompatibility) {
                rivals.push({
                    uuid,
                    name: otherAgent.agentName,
                    compatibility,
                    description: this.getCompatibilityDescription(compatibility)
                });
            }
        }

        // Sort by compatibility (lowest first)
        rivals.sort((a, b) => a.compatibility - b.compatibility);

        return rivals;
    }

    /**
     * Helper: Select random items from array
     */
    selectRandom(array, count) {
        const shuffled = [...array].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(count, array.length));
    }

    /**
     * Export personality to JSON
     */
    exportPersonality(personality) {
        return JSON.stringify(personality);
    }

    /**
     * Import personality from JSON
     */
    importPersonality(json) {
        try {
            return JSON.parse(json);
        } catch (error) {
            console.error('[PERSONALITY] Failed to import personality:', error.message);
            return this.generatePersonality();
        }
    }
}

// Singleton instance
let personalitySystemInstance = null;

function getPersonalitySystem() {
    if (!personalitySystemInstance) {
        personalitySystemInstance = new AgentPersonalitySystem();
    }
    return personalitySystemInstance;
}

module.exports = { AgentPersonalitySystem, getPersonalitySystem };
