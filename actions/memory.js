/**
 * Memory Actions (421-435)
 * Recall resource locations, return to successful spots, avoid dangers, learn from failures
 */

const { goals: { GoalNear } } = require('mineflayer-pathfinder');

class MemoryActions {
    constructor(utils) {
        this.utils = utils;
        this.memories = {
            resources: [],      // Successful resource locations
            dangers: [],        // Dangerous locations to avoid
            successes: [],      // Successful strategies
            failures: []        // Failed attempts to learn from
        };
    }

    /**
     * Remember resource location
     */
    rememberResource(bot, resourceType, position, resourceYield) {
        this.memories.resources.push({
            type: resourceType,
            position: position.clone(),
            yield: resourceYield,
            timestamp: Date.now(),
            visits: 0
        });

        console.log(`[Memory] Remembered ${resourceType} location at ${position}`);
        return true;
    }

    /**
     * Recall best resource location
     */
    recallBestResourceLocation(resourceType) {
        const matches = this.memories.resources.filter(m => m.type === resourceType);

        if (matches.length === 0) return null;

        // Sort by yield and recency
        matches.sort((a, b) => {
            const scoreA = b.yield * 0.7 + (Date.now() - b.timestamp) / 1000000 * 0.3;
            const scoreB = a.yield * 0.7 + (Date.now() - a.timestamp) / 1000000 * 0.3;
            return scoreA - scoreB;
        });

        return matches[0];
    }

    /**
     * Return to successful mining spot
     */
    async returnToMiningSpot(bot) {
        const bestSpot = this.recallBestResourceLocation('ores');

        if (!bestSpot) {
            console.log('[Memory] No mining spots remembered');
            return false;
        }

        try {
            const goal = new GoalNear(bestSpot.position.x, bestSpot.position.y, bestSpot.position.z, 3);
            await bot.pathfinder.goto(goal);

            bestSpot.visits++;
            console.log('[Memory] Returned to successful mining spot');
            return true;
        } catch (err) {
            return false;
        }
    }

    /**
     * Remember dangerous location
     */
    rememberDanger(bot, dangerType, position) {
        this.memories.dangers.push({
            type: dangerType,
            position: position.clone(),
            timestamp: Date.now()
        });

        console.log(`[Memory] Remembered danger: ${dangerType} at ${position}`);
        return true;
    }

    /**
     * Check if location is dangerous
     */
    isDangerousLocation(position, radius = 10) {
        return this.memories.dangers.some(d =>
            d.position.distanceTo(position) < radius &&
            Date.now() - d.timestamp < 300000 // 5 minutes
        );
    }

    /**
     * Avoid dangerous area
     */
    async avoidDanger(bot) {
        if (this.isDangerousLocation(bot.entity.position)) {
            console.log('[Memory] Detected dangerous area, retreating...');

            // Move away
            bot.setControlState('back', true);
            await this.utils.sleep(3000);
            bot.setControlState('back', false);

            return true;
        }

        return false;
    }

    /**
     * Remember successful strategy
     */
    rememberSuccess(strategy, context, reward) {
        this.memories.successes.push({
            strategy,
            context,
            reward,
            timestamp: Date.now()
        });

        console.log(`[Memory] Remembered successful strategy: ${strategy}`);
    }

    /**
     * Remember failure to learn
     */
    rememberFailure(strategy, context, reason) {
        this.memories.failures.push({
            strategy,
            context,
            reason,
            timestamp: Date.now()
        });

        console.log(`[Memory] Remembered failure: ${strategy} - ${reason}`);
    }

    /**
     * Recall similar past experience
     */
    recallSimilarExperience(currentContext) {
        // Find most similar past experience
        const allExperiences = [...this.memories.successes, ...this.memories.failures];

        // Simple similarity check (would be more sophisticated in practice)
        const similar = allExperiences.filter(exp =>
            exp.context && exp.context.type === currentContext.type
        );

        return similar[similar.length - 1]; // Most recent similar
    }

    /**
     * Learn from past mistakes
     */
    shouldAvoidStrategy(strategy, context) {
        const recentFailures = this.memories.failures.filter(f =>
            f.strategy === strategy &&
            Date.now() - f.timestamp < 600000 // 10 minutes
        );

        return recentFailures.length >= 3; // Avoid after 3 failures
    }

    /**
     * Get memory statistics
     */
    getMemoryStats() {
        return {
            resourceLocations: this.memories.resources.length,
            dangerZones: this.memories.dangers.length,
            successfulStrategies: this.memories.successes.length,
            learnedFailures: this.memories.failures.length
        };
    }

    /**
     * Clear old memories (forget after 1 hour)
     */
    clearOldMemories() {
        const oneHourAgo = Date.now() - 3600000;

        this.memories.resources = this.memories.resources.filter(m => m.timestamp > oneHourAgo);
        this.memories.dangers = this.memories.dangers.filter(m => m.timestamp > oneHourAgo);
        this.memories.successes = this.memories.successes.filter(m => m.timestamp > oneHourAgo);
        this.memories.failures = this.memories.failures.filter(m => m.timestamp > oneHourAgo);

        console.log('[Memory] Cleared old memories');
    }
}

module.exports = MemoryActions;
