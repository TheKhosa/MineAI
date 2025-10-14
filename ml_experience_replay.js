/**
 * ML Experience Replay Buffer - Stores agent experiences for training
 * Implements both uniform and prioritized experience replay
 */

class ExperienceReplayBuffer {
    constructor(maxSize = 50000) {
        this.maxSize = maxSize;
        this.buffer = [];
        this.position = 0;
        this.priorities = [];  // For prioritized replay
        this.alpha = 0.6;      // Priority exponent
        this.beta = 0.4;       // Importance sampling weight
        this.betaIncrement = 0.001;
        this.epsilon = 0.01;   // Small constant to avoid zero priority
    }

    /**
     * Add an experience to the buffer
     * @param {Object} experience - {state, action, reward, nextState, done, agentType}
     */
    add(experience) {
        // Default priority is max priority (for new experiences)
        const maxPriority = this.priorities.length > 0 ? Math.max(...this.priorities) : 1.0;

        if (this.buffer.length < this.maxSize) {
            this.buffer.push(experience);
            this.priorities.push(maxPriority);
        } else {
            // Circular buffer - overwrite oldest
            this.buffer[this.position] = experience;
            this.priorities[this.position] = maxPriority;
        }

        this.position = (this.position + 1) % this.maxSize;
    }

    /**
     * Sample a batch of experiences uniformly
     */
    sampleUniform(batchSize) {
        if (this.buffer.length === 0) {
            return [];
        }

        const batch = [];
        const indices = [];

        for (let i = 0; i < batchSize && i < this.buffer.length; i++) {
            const idx = Math.floor(Math.random() * this.buffer.length);
            batch.push(this.buffer[idx]);
            indices.push(idx);
        }

        return { batch, indices, weights: new Array(batch.length).fill(1.0) };
    }

    /**
     * Sample a batch using prioritized experience replay
     */
    samplePrioritized(batchSize) {
        if (this.buffer.length === 0) {
            return { batch: [], indices: [], weights: [] };
        }

        batchSize = Math.min(batchSize, this.buffer.length);

        // Calculate sampling probabilities
        const priorities = this.priorities.slice(0, this.buffer.length);
        const probabilities = priorities.map(p => Math.pow(p + this.epsilon, this.alpha));
        const totalPriority = probabilities.reduce((sum, p) => sum + p, 0);
        const normalizedProbs = probabilities.map(p => p / totalPriority);

        // Sample indices based on priorities
        const batch = [];
        const indices = [];
        const weights = [];

        for (let i = 0; i < batchSize; i++) {
            const idx = this.sampleIndex(normalizedProbs);
            indices.push(idx);
            batch.push(this.buffer[idx]);

            // Calculate importance sampling weight
            const probability = normalizedProbs[idx];
            const weight = Math.pow(this.buffer.length * probability, -this.beta);
            weights.push(weight);
        }

        // Normalize weights
        const maxWeight = Math.max(...weights);
        const normalizedWeights = weights.map(w => w / maxWeight);

        // Increment beta towards 1.0 (full importance sampling correction)
        this.beta = Math.min(1.0, this.beta + this.betaIncrement);

        return { batch, indices, weights: normalizedWeights };
    }

    /**
     * Update priorities for sampled experiences (after training)
     */
    updatePriorities(indices, tdErrors) {
        for (let i = 0; i < indices.length; i++) {
            const idx = indices[i];
            if (idx < this.priorities.length) {
                // Priority is proportional to TD error
                this.priorities[idx] = Math.abs(tdErrors[i]) + this.epsilon;
            }
        }
    }

    /**
     * Sample an index based on probability distribution
     */
    sampleIndex(probabilities) {
        const rand = Math.random();
        let cumulative = 0;

        for (let i = 0; i < probabilities.length; i++) {
            cumulative += probabilities[i];
            if (rand <= cumulative) {
                return i;
            }
        }

        return probabilities.length - 1;
    }

    /**
     * Get all experiences for a specific agent type
     */
    getExperiencesByType(agentType, maxCount = 1000) {
        return this.buffer
            .filter(exp => exp.agentType === agentType)
            .slice(-maxCount);
    }

    /**
     * Get recent high-reward experiences (for imitation learning)
     */
    getTopExperiences(count = 100, minReward = 5.0) {
        return this.buffer
            .filter(exp => exp.reward >= minReward)
            .sort((a, b) => b.reward - a.reward)
            .slice(0, count);
    }

    /**
     * Get statistics about the replay buffer
     */
    getStats() {
        if (this.buffer.length === 0) {
            return {
                size: 0,
                avgReward: 0,
                maxReward: 0,
                minReward: 0,
                successRate: 0
            };
        }

        const rewards = this.buffer.map(exp => exp.reward);
        const avgReward = rewards.reduce((sum, r) => sum + r, 0) / rewards.length;
        const maxReward = Math.max(...rewards);
        const minReward = Math.min(...rewards);
        const successRate = this.buffer.filter(exp => exp.reward > 0).length / this.buffer.length;

        return {
            size: this.buffer.length,
            avgReward: avgReward.toFixed(2),
            maxReward: maxReward.toFixed(2),
            minReward: minReward.toFixed(2),
            successRate: (successRate * 100).toFixed(1) + '%'
        };
    }

    /**
     * Clear buffer
     */
    clear() {
        this.buffer = [];
        this.priorities = [];
        this.position = 0;
    }

    /**
     * Get buffer size
     */
    size() {
        return this.buffer.length;
    }

    /**
     * Check if buffer is ready for training (has enough experiences)
     */
    isReadyForTraining(minExperiences = 1000) {
        return this.buffer.length >= minExperiences;
    }
}

/**
 * Episode Buffer - Stores experiences for a single episode
 * Used for calculating returns and advantages in PPO
 */
class EpisodeBuffer {
    constructor() {
        this.states = [];
        this.actions = [];
        this.rewards = [];
        this.values = [];      // Value estimates
        this.logProbs = [];    // Log probabilities of actions
        this.dones = [];
        this.agentType = null;
    }

    /**
     * Add a step to the episode
     */
    addStep(state, action, reward, value, logProb, done) {
        this.states.push(state);
        this.actions.push(action);
        this.rewards.push(reward);
        this.values.push(value);
        this.logProbs.push(logProb);
        this.dones.push(done);
    }

    /**
     * Calculate discounted returns (Monte Carlo)
     */
    calculateReturns(gamma = 0.99) {
        const returns = new Array(this.rewards.length);
        let runningReturn = 0;

        // Calculate returns backward
        for (let t = this.rewards.length - 1; t >= 0; t--) {
            if (this.dones[t]) {
                runningReturn = 0;
            }
            runningReturn = this.rewards[t] + gamma * runningReturn;
            returns[t] = runningReturn;
        }

        return returns;
    }

    /**
     * Calculate advantages using Generalized Advantage Estimation (GAE)
     */
    calculateAdvantages(gamma = 0.99, lambda = 0.95) {
        const advantages = new Array(this.rewards.length);
        let lastGaeLam = 0;

        // Calculate advantages backward
        for (let t = this.rewards.length - 1; t >= 0; t--) {
            const nextValue = t < this.rewards.length - 1 ? this.values[t + 1] : 0;
            const nextNonTerminal = t < this.rewards.length - 1 && !this.dones[t] ? 1 : 0;

            // TD error
            const delta = this.rewards[t] + gamma * nextValue * nextNonTerminal - this.values[t];

            // GAE
            advantages[t] = lastGaeLam = delta + gamma * lambda * nextNonTerminal * lastGaeLam;
        }

        return advantages;
    }

    /**
     * Get all data for training (returns copies to prevent race conditions)
     */
    getData() {
        // Create snapshots of all arrays to avoid race conditions
        const statesCopy = [...this.states];
        const actionsCopy = [...this.actions];
        const rewardsCopy = [...this.rewards];
        const valuesCopy = [...this.values];
        const logProbsCopy = [...this.logProbs];
        const donesCopy = [...this.dones];

        // Validate all arrays have the same length
        const length = statesCopy.length;
        if (actionsCopy.length !== length || rewardsCopy.length !== length ||
            valuesCopy.length !== length || logProbsCopy.length !== length ||
            donesCopy.length !== length) {
            console.error(`[EPISODE BUFFER] Array length mismatch! states:${length}, actions:${actionsCopy.length}, rewards:${rewardsCopy.length}, values:${valuesCopy.length}, logProbs:${logProbsCopy.length}, dones:${donesCopy.length}`);

            // Truncate all arrays to the shortest length to prevent crashes
            const minLength = Math.min(length, actionsCopy.length, rewardsCopy.length, valuesCopy.length, logProbsCopy.length, donesCopy.length);
            return {
                states: statesCopy.slice(0, minLength),
                actions: actionsCopy.slice(0, minLength),
                rewards: rewardsCopy.slice(0, minLength),
                values: valuesCopy.slice(0, minLength),
                logProbs: logProbsCopy.slice(0, minLength),
                dones: donesCopy.slice(0, minLength),
                returns: this.calculateReturns().slice(0, minLength),
                advantages: this.calculateAdvantages().slice(0, minLength)
            };
        }

        return {
            states: statesCopy,
            actions: actionsCopy,
            rewards: rewardsCopy,
            values: valuesCopy,
            logProbs: logProbsCopy,
            dones: donesCopy,
            returns: this.calculateReturns(),
            advantages: this.calculateAdvantages()
        };
    }

    /**
     * Clear episode
     */
    clear() {
        this.states = [];
        this.actions = [];
        this.rewards = [];
        this.values = [];
        this.logProbs = [];
        this.dones = [];
    }

    /**
     * Get episode length
     */
    length() {
        return this.states.length;
    }

    /**
     * Get total reward for episode
     */
    totalReward() {
        return this.rewards.reduce((sum, r) => sum + r, 0);
    }
}

module.exports = { ExperienceReplayBuffer, EpisodeBuffer };
