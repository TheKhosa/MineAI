/**
 * ML Agent Brain - Neural Network for decision making
 * Implements Actor-Critic architecture for PPO (Proximal Policy Optimization)
 */

const tf = require('@tensorflow/tfjs');

class AgentBrain {
    constructor(stateSize = 256, actionSize = 50, agentType = 'GENERIC') {
        this.stateSize = stateSize;
        this.actionSize = actionSize;
        this.agentType = agentType;

        // Training hyperparameters
        this.learningRate = 0.0003;
        this.gamma = 0.99;          // Discount factor
        this.lambda = 0.95;         // GAE lambda
        this.clipRatio = 0.2;       // PPO clip ratio
        this.entropyCoef = 0.01;    // Entropy bonus for exploration
        this.valueCoef = 0.5;       // Value loss coefficient

        // Create networks
        this.actor = null;          // Policy network (outputs action probabilities)
        this.critic = null;         // Value network (outputs state value)
        this.buildNetworks();

        // Optimizers
        this.actorOptimizer = tf.train.adam(this.learningRate);
        this.criticOptimizer = tf.train.adam(this.learningRate);

        // Training stats
        this.trainingSteps = 0;
        this.totalLoss = 0;
        this.avgReward = 0;

        // Disposal safety
        this.disposed = false;
        this.inUse = false;
    }

    /**
     * Build actor and critic networks
     */
    buildNetworks() {
        // ACTOR NETWORK (Policy) - outputs action probabilities
        const actorInput = tf.input({ shape: [this.stateSize] });

        let actorHidden = tf.layers.dense({
            units: 512,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }).apply(actorInput);

        actorHidden = tf.layers.dense({
            units: 256,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }).apply(actorHidden);

        actorHidden = tf.layers.dropout({ rate: 0.2 }).apply(actorHidden);

        actorHidden = tf.layers.dense({
            units: 128,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }).apply(actorHidden);

        // Output layer - action probabilities (softmax)
        const actorOutput = tf.layers.dense({
            units: this.actionSize,
            activation: 'softmax',
            name: 'action_probs'
        }).apply(actorHidden);

        this.actor = tf.model({ inputs: actorInput, outputs: actorOutput });

        // CRITIC NETWORK (Value) - outputs state value estimate
        const criticInput = tf.input({ shape: [this.stateSize] });

        let criticHidden = tf.layers.dense({
            units: 512,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }).apply(criticInput);

        criticHidden = tf.layers.dense({
            units: 256,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }).apply(criticHidden);

        criticHidden = tf.layers.dropout({ rate: 0.2 }).apply(criticHidden);

        criticHidden = tf.layers.dense({
            units: 128,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }).apply(criticHidden);

        // Output layer - single value estimate
        const criticOutput = tf.layers.dense({
            units: 1,
            activation: 'linear',
            name: 'value_estimate'
        }).apply(criticHidden);

        this.critic = tf.model({ inputs: criticInput, outputs: criticOutput });

        console.log(`[ML BRAIN] Created networks for ${this.agentType}`);
        console.log(`[ML BRAIN] Actor params: ${this.actor.countParams()}`);
        console.log(`[ML BRAIN] Critic params: ${this.critic.countParams()}`);
    }

    /**
     * Select an action given a state (for acting in environment)
     * @param {Float32Array} state - Encoded state vector
     * @param {boolean} training - If true, sample from distribution; if false, take argmax
     * @returns {Object} - {action, logProb, value}
     */
    selectAction(state, training = true) {
        if (this.disposed) {
            console.warn('[ML BRAIN] Attempted to use disposed model');
            return { action: 0, logProb: 0, value: 0, actionProbs: new Array(this.actionSize).fill(1 / this.actionSize) };
        }

        this.inUse = true;
        try {
            return tf.tidy(() => {
                const stateTensor = tf.tensor2d([state], [1, this.stateSize]);

                // Get action probabilities from actor
                const actionProbs = this.actor.predict(stateTensor);
                const probsArray = actionProbs.dataSync();

                // Get value estimate from critic
                const valueEstimate = this.critic.predict(stateTensor);
                const value = valueEstimate.dataSync()[0];

                let action;
                let logProb;

                if (training) {
                    // Sample action from probability distribution (exploration)
                    action = this.sampleAction(probsArray);
                    logProb = Math.log(probsArray[action] + 1e-8); // Add epsilon to avoid log(0)
                } else {
                    // Take most probable action (exploitation)
                    action = probsArray.indexOf(Math.max(...probsArray));
                    logProb = Math.log(probsArray[action] + 1e-8);
                }

                return { action, logProb, value, actionProbs: probsArray };
            });
        } finally {
            this.inUse = false;
        }
    }

    /**
     * Sample action from probability distribution
     */
    sampleAction(probabilities) {
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
     * Train on a batch of experiences using PPO
     * @param {Array} states - Batch of states
     * @param {Array} actions - Batch of actions taken
     * @param {Array} oldLogProbs - Batch of old log probabilities
     * @param {Array} advantages - Batch of advantages
     * @param {Array} returns - Batch of returns (targets for critic)
     * @param {number} epochs - Number of training epochs
     */
    async trainPPO(states, actions, oldLogProbs, advantages, returns, epochs = 4) {
        // Normalize advantages
        const advMean = advantages.reduce((sum, a) => sum + a, 0) / advantages.length;
        const advStd = Math.sqrt(
            advantages.reduce((sum, a) => sum + Math.pow(a - advMean, 2), 0) / advantages.length
        ) + 1e-8;
        const normalizedAdvantages = advantages.map(a => (a - advMean) / advStd);

        let totalActorLoss = 0;
        let totalCriticLoss = 0;

        for (let epoch = 0; epoch < epochs; epoch++) {
            // Train actor (policy)
            const actorLoss = await this.trainActorStep(
                states,
                actions,
                oldLogProbs,
                normalizedAdvantages
            );

            // Train critic (value function)
            const criticLoss = await this.trainCriticStep(states, returns);

            totalActorLoss += actorLoss;
            totalCriticLoss += criticLoss;
        }

        this.trainingSteps++;
        const avgActorLoss = totalActorLoss / epochs;
        const avgCriticLoss = totalCriticLoss / epochs;

        return {
            actorLoss: avgActorLoss,
            criticLoss: avgCriticLoss,
            totalLoss: avgActorLoss + avgCriticLoss
        };
    }

    /**
     * Train actor network (one step)
     */
    async trainActorStep(states, actions, oldLogProbs, advantages) {
        return tf.tidy(() => {
            const statesTensor = tf.tensor2d(states, [states.length, this.stateSize]);
            const actionsTensor = tf.tensor1d(actions, 'int32');
            const oldLogProbsTensor = tf.tensor1d(oldLogProbs);
            const advantagesTensor = tf.tensor1d(advantages);

            // Forward pass and compute loss
            const loss = this.actorOptimizer.minimize(() => {
                // Get current action probabilities
                const actionProbs = this.actor.predict(statesTensor);

                // Get log probabilities for taken actions
                const actionMask = tf.oneHot(actionsTensor, this.actionSize);
                const selectedProbs = tf.sum(tf.mul(actionProbs, actionMask), 1);
                const logProbs = tf.log(tf.add(selectedProbs, 1e-8));

                // Calculate ratio for PPO
                const ratio = tf.exp(tf.sub(logProbs, oldLogProbsTensor));

                // PPO clipped objective
                const clippedRatio = tf.clipByValue(
                    ratio,
                    1 - this.clipRatio,
                    1 + this.clipRatio
                );

                const obj1 = tf.mul(ratio, advantagesTensor);
                const obj2 = tf.mul(clippedRatio, advantagesTensor);
                const policyLoss = tf.neg(tf.mean(tf.minimum(obj1, obj2)));

                // Entropy bonus for exploration
                const entropy = tf.neg(tf.sum(
                    tf.mul(actionProbs, tf.log(tf.add(actionProbs, 1e-8))),
                    1
                ));
                const entropyBonus = tf.mul(tf.mean(entropy), this.entropyCoef);

                // Total actor loss
                const totalLoss = tf.sub(policyLoss, entropyBonus);

                return totalLoss;
            }, true);

            return loss.dataSync()[0];
        });
    }

    /**
     * Train critic network (one step)
     */
    async trainCriticStep(states, returns) {
        return tf.tidy(() => {
            const statesTensor = tf.tensor2d(states, [states.length, this.stateSize]);
            const returnsTensor = tf.tensor2d(returns.map(r => [r]), [returns.length, 1]);

            const loss = this.criticOptimizer.minimize(() => {
                // Predict values
                const valuePredictions = this.critic.predict(statesTensor);

                // MSE loss
                const valueLoss = tf.losses.meanSquaredError(returnsTensor, valuePredictions);

                return tf.mul(valueLoss, this.valueCoef);
            }, true);

            return loss.dataSync()[0];
        });
    }

    /**
     * Evaluate value of a state
     */
    evaluateState(state) {
        if (this.disposed) {
            return 0;
        }

        this.inUse = true;
        try {
            return tf.tidy(() => {
                const stateTensor = tf.tensor2d([state], [1, this.stateSize]);
                const value = this.critic.predict(stateTensor);
                return value.dataSync()[0];
            });
        } finally {
            this.inUse = false;
        }
    }

    /**
     * Get action probabilities for a state (without sampling)
     */
    getActionProbabilities(state) {
        if (this.disposed) {
            return new Array(this.actionSize).fill(1 / this.actionSize);
        }

        this.inUse = true;
        try {
            return tf.tidy(() => {
                const stateTensor = tf.tensor2d([state], [1, this.stateSize]);
                const probs = this.actor.predict(stateTensor);
                return Array.from(probs.dataSync());
            });
        } finally {
            this.inUse = false;
        }
    }

    /**
     * Save model to disk using custom JSON serialization
     * Works with pure JS version of TensorFlow.js (@tensorflow/tfjs)
     */
    async saveModel(savePath) {
        const fs = require('fs');
        const path = require('path');

        try {
            // Ensure directory exists
            if (!fs.existsSync(savePath)) {
                fs.mkdirSync(savePath, { recursive: true });
            }

            // Get serializable weights data
            const weightsData = await this.getWeightsData();

            // Save to JSON file
            const filePath = path.join(savePath, `brain_${this.agentType}.json`);
            fs.writeFileSync(filePath, JSON.stringify(weightsData, null, 2));

            console.log(`[ML BRAIN] Saved ${this.agentType} model to ${filePath} (${this.trainingSteps} steps)`);
            return true;
        } catch (error) {
            console.error(`[ML BRAIN] Failed to save model: ${error.message}`);
            return false;
        }
    }

    /**
     * Load model from disk using custom JSON deserialization
     */
    async loadModel(loadPath) {
        const fs = require('fs');
        const path = require('path');

        try {
            const filePath = path.join(loadPath, `brain_${this.agentType}.json`);

            // Check if file exists
            if (!fs.existsSync(filePath)) {
                console.log(`[ML BRAIN] No saved model found for ${this.agentType} at ${filePath}`);
                return false;
            }

            // Load JSON file
            const weightsDataJson = fs.readFileSync(filePath, 'utf8');
            const weightsData = JSON.parse(weightsDataJson);

            // Restore weights
            await this.setWeightsData(weightsData);

            console.log(`[ML BRAIN] Loaded ${this.agentType} model from ${filePath} (${this.trainingSteps} steps)`);
            return true;
        } catch (error) {
            console.error(`[ML BRAIN] Failed to load model: ${error.message}`);
            return false;
        }
    }

    /**
     * Get training statistics
     */
    getStats() {
        return {
            agentType: this.agentType,
            trainingSteps: this.trainingSteps,
            actorParams: this.actor.countParams(),
            criticParams: this.critic.countParams()
        };
    }

    /**
     * Clone this brain to create an offspring brain (for genetic evolution)
     * @param {number} mutationRate - Probability of mutating each weight (0.0 - 1.0)
     * @param {number} mutationStrength - Standard deviation of mutation noise
     * @returns {AgentBrain} - New brain with cloned and mutated weights
     */
    async clone(mutationRate = 0.1, mutationStrength = 0.05) {
        console.log(`[ML BRAIN] Cloning ${this.agentType} brain with mutation rate ${mutationRate}`);

        // Create new brain with same architecture
        const offspring = new AgentBrain(this.stateSize, this.actionSize, this.agentType);

        // Copy actor weights with mutation
        const actorWeights = this.actor.getWeights();
        const mutatedActorWeights = actorWeights.map(weight => {
            return tf.tidy(() => {
                // Generate mutation mask (random values < mutationRate = 1, else 0)
                const mutationMask = tf.randomUniform(weight.shape).less(mutationRate);

                // Generate mutation noise (gaussian with mutationStrength std dev)
                const mutationNoise = tf.randomNormal(weight.shape, 0, mutationStrength);

                // Apply mutation: weight + (mask * noise)
                const mutation = tf.mul(mutationMask.cast('float32'), mutationNoise);
                return weight.add(mutation);
            });
        });
        offspring.actor.setWeights(mutatedActorWeights);

        // Copy critic weights with mutation
        const criticWeights = this.critic.getWeights();
        const mutatedCriticWeights = criticWeights.map(weight => {
            return tf.tidy(() => {
                const mutationMask = tf.randomUniform(weight.shape).less(mutationRate);
                const mutationNoise = tf.randomNormal(weight.shape, 0, mutationStrength);
                const mutation = tf.mul(mutationMask.cast('float32'), mutationNoise);
                return weight.add(mutation);
            });
        });
        offspring.critic.setWeights(mutatedCriticWeights);

        // Copy training statistics
        offspring.trainingSteps = this.trainingSteps;
        offspring.avgReward = this.avgReward;

        console.log(`[ML BRAIN] Brain cloned successfully (${this.trainingSteps} training steps inherited)`);

        // Clean up temporary tensors carefully
        setTimeout(() => {
            try {
                actorWeights.forEach(w => w.isDisposed || w.dispose());
                criticWeights.forEach(w => w.isDisposed || w.dispose());
                mutatedActorWeights.forEach(w => w.isDisposed || w.dispose());
                mutatedCriticWeights.forEach(w => w.isDisposed || w.dispose());
            } catch (e) {
                // Ignore disposal errors
            }
        }, 1000);

        return offspring;
    }

    /**
     * Get serializable weights for manual persistence
     * @returns {Object} - Weights data that can be JSON stringified
     */
    async getWeightsData() {
        const actorWeights = this.actor.getWeights();
        const criticWeights = this.critic.getWeights();

        const actorData = await Promise.all(
            actorWeights.map(async (w) => {
                const data = await w.data();
                return {
                    shape: w.shape,
                    data: Array.from(data)
                };
            })
        );

        const criticData = await Promise.all(
            criticWeights.map(async (w) => {
                const data = await w.data();
                return {
                    shape: w.shape,
                    data: Array.from(data)
                };
            })
        );

        return {
            agentType: this.agentType,
            stateSize: this.stateSize,
            actionSize: this.actionSize,
            actorWeights: actorData,
            criticWeights: criticData,
            trainingSteps: this.trainingSteps,
            avgReward: this.avgReward
        };
    }

    /**
     * Load weights from serialized data
     * @param {Object} weightsData - Data from getWeightsData()
     */
    async setWeightsData(weightsData) {
        try {
            // Restore actor weights
            const actorWeights = weightsData.actorWeights.map(w => {
                return tf.tensor(w.data, w.shape);
            });
            this.actor.setWeights(actorWeights);

            // Restore critic weights
            const criticWeights = weightsData.criticWeights.map(w => {
                return tf.tensor(w.data, w.shape);
            });
            this.critic.setWeights(criticWeights);

            // Restore statistics
            this.trainingSteps = weightsData.trainingSteps || 0;
            this.avgReward = weightsData.avgReward || 0;

            console.log(`[ML BRAIN] Loaded weights for ${this.agentType} (${this.trainingSteps} steps)`);

            // Clean up temporary tensors carefully
            setTimeout(() => {
                try {
                    actorWeights.forEach(w => w.isDisposed || w.dispose());
                    criticWeights.forEach(w => w.isDisposed || w.dispose());
                } catch (e) {
                    // Ignore disposal errors
                }
            }, 1000);

            return true;
        } catch (error) {
            console.error(`[ML BRAIN] Failed to load weights: ${error.message}`);
            return false;
        }
    }

    /**
     * Dispose of tensors to free memory
     */
    dispose() {
        if (this.disposed) {
            return; // Already disposed
        }

        // Wait for any in-progress operations
        if (this.inUse) {
            setTimeout(() => this.dispose(), 100);
            return;
        }

        this.disposed = true;

        try {
            if (this.actor && !this.actor.isDisposed) {
                this.actor.dispose();
            }
            if (this.critic && !this.critic.isDisposed) {
                this.critic.dispose();
            }
            if (this.actorOptimizer) {
                this.actorOptimizer.dispose();
            }
            if (this.criticOptimizer) {
                this.criticOptimizer.dispose();
            }
        } catch (error) {
            // Silently handle disposal errors
            console.warn('[ML BRAIN] Disposal warning:', error.message);
        }
    }
}

module.exports = AgentBrain;
