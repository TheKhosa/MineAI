/**
 * ML Trainer - Coordinates training of agent brains
 * Manages state encoding, action execution, reward collection, and model updates
 */

const StateEncoder = require('./ml_state_encoder');
const ActionSpace = require('./ml_action_space');
const AgentBrain = require('./ml_agent_brain');
const { ExperienceReplayBuffer, EpisodeBuffer } = require('./ml_experience_replay');
const { getGoalManager } = require('./ml_hierarchical_goals');
const { getSubSkillsSystem } = require('./ml_zomboid_skills');
const { getMoodlesSystem } = require('./ml_zomboid_moodles');
const { getSharedBrain } = require('./ml_brain_sqlite');
const fs = require('fs');
const path = require('path');

class MLTrainer {
    constructor() {
        // Core components
        this.stateEncoder = new StateEncoder();
        this.actionSpace = new ActionSpace();
        this.goalManager = getGoalManager(); // Hierarchical goal system

        // HIERARCHICAL BRAIN ARCHITECTURE
        // 1. Shared collective brain - ONE neural network + SQLite used by ALL agents
        // 2. Personal specialization brains - Each agent gets their own neural network
        this.sharedNeuralBrain = null;         // Single shared TensorFlow brain
        this.personalBrains = new Map();       // Map of agentName -> personal TensorFlow brain
        this.sharedSQLiteBrain = getSharedBrain();  // SQLite collective knowledge database

        // Initialize SQLite brain asynchronously
        this.sharedSQLiteBrain.initialize().then(() => {
            console.log('[ML TRAINER] ✓ SQLite Shared Brain initialized');
        }).catch(err => {
            console.error('[ML TRAINER] Failed to initialize SQLite brain:', err);
        });

        // Experience buffers
        this.globalReplayBuffer = new ExperienceReplayBuffer(50000);
        this.episodeBuffers = new Map();  // botName -> EpisodeBuffer

        // Training configuration
        this.config = {
            stepsPerUpdate: 512,        // Train every N steps
            batchSize: 64,              // Batch size for training
            trainingEpochs: 4,          // PPO epochs per update
            minBufferSize: 1000,        // Min experiences before training
            saveInterval: 5000,         // Save models every N steps
            explorationRate: 0.2,       // Probability of random action (epsilon-greedy)
            explorationDecay: 0.9995,   // Decay epsilon over time
            minExploration: 0.05        // Minimum exploration rate
        };

        // Training state
        this.totalSteps = 0;
        this.trainingEnabled = true;
        this.lastSaveStep = 0;

        // Model save path
        this.modelPath = path.join(__dirname, 'ml_models');
        this.ensureModelDirectory();

        // Stats
        this.stats = {
            totalTrainingSteps: 0,
            episodesCompleted: 0,
            avgReward: 0,
            avgEpisodeLength: 0,
            successRate: 0
        };

        console.log('[ML TRAINER] Initialized HIERARCHICAL ML Training System');
        console.log('[ML TRAINER] Architecture: Shared Collective + Personal Specialization');
        console.log('[ML TRAINER]   ├─ Shared TensorFlow Network (general knowledge)');
        console.log('[ML TRAINER]   ├─ SQLite Database (collective strategies)');
        console.log('[ML TRAINER]   └─ Personal TensorFlow Networks (individual expertise)');
        console.log(`[ML TRAINER] Action Space Size: ${this.actionSpace.ACTION_COUNT}`);
        console.log(`[ML TRAINER] State Vector Size: ${this.stateEncoder.STATE_SIZE}`);
    }

    /**
     * Get the shared brain (all agents use ONE neural network)
     */
    getBrain(agentType) {
        // SHARED BRAIN: All agents share the same neural network
        if (!this.sharedNeuralBrain) {
            this.sharedNeuralBrain = new AgentBrain(
                this.stateEncoder.STATE_SIZE,
                this.actionSpace.ACTION_COUNT,
                'SHARED_COLLECTIVE'  // Single unified brain
            );

            // Try to load existing model
            this.sharedNeuralBrain.loadModel(this.modelPath);

            console.log(`[ML TRAINER] 🧠 Created SHARED NEURAL BRAIN for all agents`);
        }

        return this.sharedNeuralBrain;
    }

    /**
     * Start ML agent - called when agent spawns
     * @param {Object} bot - Bot instance
     * @param {AgentBrain} parentBrain - Optional parent brain for genetic inheritance
     */
    async initializeAgent(bot, parentBrain = null) {
        // HIERARCHICAL BRAIN ARCHITECTURE:
        // 1. Shared collective brain (used by ALL agents)
        // 2. Personal specialization brain (unique to this agent)

        // Get shared brain (all agents use the same one)
        const sharedBrain = this.getBrain(bot.agentType);

        // Create personal specialization brain
        let personalBrain;

        // GENETIC EVOLUTION: Clone parent's personal brain if provided
        if (parentBrain && bot.generation > 1) {
            console.log(`[ML TRAINER] 🧬 Cloning parent's personal brain for ${bot.agentName} (Gen ${bot.generation})`);
            try {
                // Clone with 10% mutation rate and 5% mutation strength
                personalBrain = await parentBrain.clone(0.10, 0.05);
                console.log(`[ML TRAINER] ✓ Personal brain inherited with mutations (${personalBrain.trainingSteps} training steps)`);
            } catch (error) {
                console.error(`[ML TRAINER] Failed to clone brain: ${error.message}`);
                console.log(`[ML TRAINER] Creating fresh personal brain`);
                personalBrain = new AgentBrain(
                    this.stateEncoder.STATE_SIZE,
                    this.actionSpace.ACTION_COUNT,
                    `${bot.agentType}_${bot.agentName}`
                );
            }
        } else {
            // Create new personal specialization brain for this agent
            personalBrain = new AgentBrain(
                this.stateEncoder.STATE_SIZE,
                this.actionSpace.ACTION_COUNT,
                `${bot.agentType}_${bot.agentName}`
            );
            console.log(`[ML TRAINER] 🎯 Created personal specialization brain for ${bot.agentName}`);
        }

        const episodeBuffer = new EpisodeBuffer();
        episodeBuffer.agentType = bot.agentType;

        this.episodeBuffers.set(bot.agentName, episodeBuffer);

        // Store BOTH brains on bot
        bot.mlSharedBrain = sharedBrain;      // Collective knowledge
        bot.mlPersonalBrain = personalBrain;  // Personal specialization
        bot.mlBrain = personalBrain;          // Default to personal brain for compatibility

        // Track personal brains for training
        if (!this.personalBrains) {
            this.personalBrains = new Map();
        }
        this.personalBrains.set(bot.agentName, personalBrain);

        bot.mlEpisodeBuffer = episodeBuffer;
        bot.mlLastState = null;
        bot.mlLastAction = null;
        bot.mlLastValue = null;
        bot.mlLastLogProb = null;
        bot.mlStepCount = 0;

        // Initialize hierarchical goal
        bot.currentGoal = null; // Will be set on first step
        bot.lastGoalUpdate = 0;

        const inheritanceMsg = parentBrain ? ' [INHERITED]' : ' [NEW]';
        console.log(`[ML TRAINER] Initialized ML for ${bot.agentName} (${bot.agentType})${inheritanceMsg}`);
        console.log(`[ML TRAINER]   └─ Shared brain (collective) + Personal brain (specialization)`);
    }

    /**
     * Agent decision step - encode state, select action, execute
     */
    async agentStep(bot) {
        if (!bot.mlBrain || !bot.entity) {
            return null;
        }

        try {
            // === HIERARCHICAL GOAL SYSTEM ===
            // Update goal every 5 seconds or on first step
            const now = Date.now();
            if (!bot.currentGoal || now - bot.lastGoalUpdate > 5000) {
                const newGoal = this.goalManager.updateGoal(bot);
                if (newGoal) {
                    bot.currentGoal = newGoal;
                    bot.lastGoalUpdate = now;
                }
            }

            // Encode current state
            const state = this.stateEncoder.encodeState(bot);

            // Get context for SharedBrain (simplified context string)
            const context = this.getContextString(bot);

            // Select action using brain (with exploration and goal bias)
            const useRandom = Math.random() < this.config.explorationRate;
            let action, logProb, value;

            let actionProbs;
            if (useRandom) {
                // Random exploration
                action = Math.floor(Math.random() * this.actionSpace.ACTION_COUNT);
                const actionData = bot.mlBrain.selectAction(state, true);
                logProb = actionData.logProb;
                value = actionData.value;
                actionProbs = actionData.actionProbs;
            } else {
                // HIERARCHICAL BRAIN SYSTEM: Blend shared knowledge + personal specialization

                // 1. Get SQLite collective recommendations
                const allActions = [];
                for (let i = 0; i < this.actionSpace.ACTION_COUNT; i++) {
                    allActions.push(this.actionSpace.getActionName(i));
                }
                const sqliteRecommendation = await this.sharedSQLiteBrain.getBestAction(context, allActions);
                const sqliteActionId = this.actionSpace.getActionId(sqliteRecommendation);

                // 2. Get shared neural network prediction (general knowledge)
                const sharedActionData = bot.mlSharedBrain.selectAction(state, true);

                // 3. Get personal neural network prediction (specialization)
                const personalActionData = bot.mlPersonalBrain.selectAction(state, true);

                // 4. BLEND ALL THREE SOURCES:
                // - SQLite collective: 40% weight (proven strategies)
                // - Shared network: 30% weight (general patterns)
                // - Personal network: 30% weight (individual expertise)

                const rand = Math.random();
                if (sqliteActionId !== null && rand < 0.4) {
                    // Use SQLite collective knowledge
                    action = sqliteActionId;
                    logProb = personalActionData.logProb;  // Use personal for training
                    value = personalActionData.value;
                    actionProbs = personalActionData.actionProbs;
                } else if (rand < 0.7) {
                    // Use shared brain (general knowledge)
                    action = sharedActionData.action;
                    logProb = sharedActionData.logProb;
                    value = sharedActionData.value;
                    actionProbs = sharedActionData.actionProbs;
                } else {
                    // Use personal brain (specialization)
                    action = personalActionData.action;
                    logProb = personalActionData.logProb;
                    value = personalActionData.value;
                    actionProbs = personalActionData.actionProbs;
                }
            }

            // Apply goal-based action bias (hierarchical RL)
            if (bot.currentGoal && !useRandom) {
                const actionBias = this.goalManager.getActionBiasVector(bot, this.actionSpace);

                // Convert actionProbs to array and apply bias
                const biasedProbs = [];
                let probSum = 0;

                for (let i = 0; i < this.actionSpace.ACTION_COUNT; i++) {
                    const biasedProb = actionProbs[i] * actionBias[i];
                    biasedProbs.push(biasedProb);
                    probSum += biasedProb;
                }

                // Renormalize
                for (let i = 0; i < biasedProbs.length; i++) {
                    biasedProbs[i] /= probSum;
                }

                // Sample from biased distribution
                const rand = Math.random();
                let cumsum = 0;
                for (let i = 0; i < biasedProbs.length; i++) {
                    cumsum += biasedProbs[i];
                    if (rand < cumsum) {
                        action = i;
                        break;
                    }
                }

                actionProbs = biasedProbs;
            }

            // Store action probabilities for dashboard (convert to array if needed)
            bot.mlActionProbs = Array.from(actionProbs);

            // Execute action in Minecraft
            const actionSuccess = await this.actionSpace.executeAction(action, bot);

            // Store state-action for next step
            if (bot.mlLastState !== null) {
                // Calculate reward from previous step
                const reward = this.calculateReward(bot);

                // Add to episode buffer
                bot.mlEpisodeBuffer.addStep(
                    bot.mlLastState,
                    bot.mlLastAction,
                    reward,
                    bot.mlLastValue,
                    bot.mlLastLogProb,
                    false  // done (will be set on death)
                );

                // SHARED BRAIN: Record action result in collective knowledge
                const lastActionName = this.actionSpace.getActionName(bot.mlLastAction);
                const lastContext = bot.mlLastContext || context;
                await this.sharedSQLiteBrain.recordAction(
                    lastActionName,
                    lastContext,
                    actionSuccess && reward > 0,  // success = action worked AND positive reward
                    reward
                );

                // Check for skill unlocks based on collective performance
                await this.checkSkillUnlocks(bot, lastActionName, reward);
            }

            // Store context for next step
            bot.mlLastContext = context;

            // Update last state/action
            bot.mlLastState = state;
            bot.mlLastAction = action;
            bot.mlLastValue = value;
            bot.mlLastLogProb = logProb;
            bot.mlStepCount++;
            this.totalSteps++;

            // Decay exploration rate
            this.config.explorationRate = Math.max(
                this.config.minExploration,
                this.config.explorationRate * this.config.explorationDecay
            );

            // Periodic training
            if (this.totalSteps % this.config.stepsPerUpdate === 0) {
                await this.trainAllBrains();
            }

            // Periodic model saving
            if (this.totalSteps - this.lastSaveStep >= this.config.saveInterval) {
                await this.saveAllModels();
                this.lastSaveStep = this.totalSteps;
            }

            return {
                action,
                actionName: this.actionSpace.getActionName(action),
                value,
                success: actionSuccess,
                wasExploring: useRandom
            };

        } catch (error) {
            console.error(`[ML TRAINER] Error in agent step: ${error.message}`);
            return null;
        }
    }

    /**
     * Calculate reward for agent based on environment feedback
     * ENHANCED REWARD SHAPING - Dense rewards with psychological state modulation
     * Incorporates needs, moods, relationships, and memories for context-aware rewards
     */
    calculateReward(bot) {
        let reward = 0;
        let rewardBreakdown = []; // For debugging

        // === PSYCHOLOGICAL STATE MULTIPLIERS ===
        // Extract needs, moods for reward modulation
        const needs = bot.needs || {};
        const moods = bot.moods || {};

        // Motivation multiplier: Higher motivation = stronger positive rewards
        const motivationMultiplier = 0.7 + (moods.motivation || 0.5) * 0.6; // 0.7 to 1.3x

        // === 1. SURVIVAL REWARDS (Exponential bonus for staying alive longer) ===
        bot.mlSurvivalTime = (bot.mlSurvivalTime || 0) + 1;
        let survivalBonus = Math.min(bot.mlSurvivalTime * 0.1, 10.0); // Up to +10 for long survival

        // Boost survival reward when safety need is low (encourage staying alive when scared)
        if (needs.safety !== undefined && needs.safety < 0.4) {
            survivalBonus *= 1.5;
            rewardBreakdown.push(`survival:+${survivalBonus.toFixed(2)}[fear-boost]`);
        } else {
            reward += survivalBonus;
            rewardBreakdown.push(`survival:+${survivalBonus.toFixed(2)}`);
        }
        reward += survivalBonus;

        // === 2. HEALTH AND FOOD REWARDS ===
        // Health changes
        const healthChange = bot.health - (bot.mlLastHealth || 20);
        bot.mlLastHealth = bot.health;
        if (healthChange < 0) {
            let healthPenalty = healthChange * 2.0;  // Base penalty for damage
            // Reduce penalty if stress is already high (avoid overwhelming stressed agents)
            if (moods.stress !== undefined && moods.stress > 0.7) {
                healthPenalty *= 0.7; // Reduce penalty by 30%
                rewardBreakdown.push(`damage:${healthPenalty.toFixed(1)}[stress-relief]`);
            } else {
                rewardBreakdown.push(`damage:${healthPenalty.toFixed(1)}`);
            }
            reward += healthPenalty;
        } else if (healthChange > 0) {
            let healReward = healthChange * 1.5; // Increased base reward for healing
            // Boost healing reward when safety need is low
            if (needs.safety !== undefined && needs.safety < 0.5) {
                healReward *= 1.3;
                rewardBreakdown.push(`heal:+${healReward.toFixed(1)}[safety-boost]`);
            } else {
                rewardBreakdown.push(`heal:+${healReward.toFixed(1)}`);
            }
            reward += healReward;
        }

        // Food/saturation rewards (modulated by hunger need)
        const foodChange = bot.food - (bot.mlLastFood || 20);
        bot.mlLastFood = bot.food;
        if (foodChange > 0) {
            let foodReward = foodChange * 1.5;
            // Boost food reward when hunger need is low
            if (needs.hunger !== undefined && needs.hunger < 0.4) {
                foodReward *= 2.0; // Double reward when hungry!
                rewardBreakdown.push(`eat:+${foodReward.toFixed(1)}[hungry-boost]`);
            } else {
                rewardBreakdown.push(`eat:+${foodReward.toFixed(1)}`);
            }
            reward += foodReward;
        } else if (bot.food < 6) {
            // Penalty for low food (encourages eating)
            reward -= 0.5;
            rewardBreakdown.push(`hungry:-0.5`);
        }

        // === 3. INVENTORY REWARDS (Big rewards for gathering resources) ===
        const currentInvSize = bot.inventory.items().length;
        const lastInvSize = bot.mlLastInventorySize || 0;
        bot.mlLastInventorySize = currentInvSize;

        if (currentInvSize > lastInvSize) {
            // Picked up items!
            let pickupReward = (currentInvSize - lastInvSize) * 5.0;
            // Apply motivation multiplier to resource gathering
            pickupReward *= motivationMultiplier;
            reward += pickupReward;
            rewardBreakdown.push(`pickup:+${pickupReward.toFixed(1)}`);
        }

        // Reward for having tools (encourages crafting) - modulated by achievement/creativity needs
        const hasPickaxe = bot.inventory.items().some(item => item.name.includes('pickaxe'));
        const hasAxe = bot.inventory.items().some(item => item.name.includes('axe'));
        const hasSword = bot.inventory.items().some(item => item.name.includes('sword'));

        // Achievement multiplier for crafting milestones
        const achievementMultiplier = 1.0 + (needs.achievement || 0.5) * 0.5; // 1.0 to 1.5x
        const creativityMultiplier = 1.0 + (needs.creativity || 0.5) * 0.4; // 1.0 to 1.4x

        if (hasPickaxe && !bot.mlHadPickaxe) {
            const pickaxeReward = 10.0 * achievementMultiplier * creativityMultiplier;
            reward += pickaxeReward;
            bot.mlHadPickaxe = true;
            rewardBreakdown.push(`pickaxe:+${pickaxeReward.toFixed(1)}`);
        }
        if (hasAxe && !bot.mlHadAxe) {
            const axeReward = 10.0 * achievementMultiplier * creativityMultiplier;
            reward += axeReward;
            bot.mlHadAxe = true;
            rewardBreakdown.push(`axe:+${axeReward.toFixed(1)}`);
        }
        if (hasSword && !bot.mlHadSword) {
            const swordReward = 10.0 * achievementMultiplier * creativityMultiplier;
            reward += swordReward;
            bot.mlHadSword = true;
            rewardBreakdown.push(`sword:+${swordReward.toFixed(1)}`);
        }

        // === 4. EXPLORATION REWARDS (Modulated by curiosity and exploration need) ===
        if (bot.entity && bot.mlLastPosition) {
            const distMoved = bot.entity.position.distanceTo(bot.mlLastPosition);

            if (distMoved > 0.1) {
                // Movement reward (scaled by distance)
                let moveReward = Math.min(distMoved * 0.5, 3.0);

                // Boost exploration when curiosity is high or boredom is high
                const curiosityBoost = 1.0 + (moods.curiosity || 0.6) * 0.5; // 1.0 to 1.5x
                const boredomBoost = moods.boredom !== undefined && moods.boredom > 0.6 ? 1.3 : 1.0;
                const explorationNeedBoost = 1.0 + (needs.exploration || 0.5) * 0.6; // 1.0 to 1.6x

                moveReward *= curiosityBoost * boredomBoost * explorationNeedBoost;
                reward += moveReward;
                rewardBreakdown.push(`move:+${moveReward.toFixed(2)}`);

                // Check if discovered new chunk
                const currentChunk = `${Math.floor(bot.entity.position.x / 16)},${Math.floor(bot.entity.position.z / 16)}`;
                if (!bot.mlExploredChunks) bot.mlExploredChunks = new Set();

                if (!bot.mlExploredChunks.has(currentChunk)) {
                    bot.mlExploredChunks.add(currentChunk);
                    let exploreReward = 15.0; // Big reward for new chunk!

                    // Apply same exploration multipliers
                    exploreReward *= curiosityBoost * boredomBoost * explorationNeedBoost;
                    reward += exploreReward;
                    rewardBreakdown.push(`newChunk:+${exploreReward.toFixed(1)}`);
                }
            }
        }
        bot.mlLastPosition = bot.entity ? bot.entity.position.clone() : null;

        // === 5. INTERACTION REWARDS (From existing reward tracker) ===
        if (bot.rewards) {
            const currentReward = bot.rewards.totalReward;
            const lastTrackedReward = bot.mlLastTrackedReward || 0;
            const rewardDelta = currentReward - lastTrackedReward;

            if (rewardDelta > 0) {
                // Scale up for ML (was 0.1, now 0.5)
                const interactionReward = rewardDelta * 0.5;
                reward += interactionReward;
                rewardBreakdown.push(`interact:+${interactionReward.toFixed(2)}`);
            }

            bot.mlLastTrackedReward = currentReward;
        }

        // === 6. COOPERATION REWARDS (Emergent Village Formation) ===
        // Social need and loneliness modulation
        const socialNeedMultiplier = 1.0 + (needs.social || 0.5) * 0.8; // 1.0 to 1.8x
        const lonelinessMultiplier = moods.loneliness !== undefined && moods.loneliness > 0.6 ? 1.5 : 1.0;
        const cooperationNeedMultiplier = 1.0 + (needs.cooperation || 0.5) * 0.7; // 1.0 to 1.7x

        // Count nearby agents (also check relationships for bonded agents)
        let nearbyAgents = [];
        let nearbyBondedAgents = [];
        if (global.activeAgents) {
            for (const [name, otherBot] of global.activeAgents) {
                if (otherBot !== bot && otherBot.entity && otherBot.entity.position) {
                    const dist = otherBot.entity.position.distanceTo(bot.entity.position);
                    if (dist < 32) {
                        nearbyAgents.push({ bot: otherBot, distance: dist });

                        // Check if this is a bonded agent
                        if (bot.relationships && otherBot.uuid) {
                            const relationship = bot.relationships.get(otherBot.uuid);
                            if (relationship && relationship.bond > 0.5) {
                                nearbyBondedAgents.push({ bot: otherBot, distance: dist, bond: relationship.bond });
                            }
                        }
                    }
                }
            }
        }

        // Clustering reward: Bonus for being near other agents (modulated by social need/loneliness)
        if (nearbyAgents.length > 0) {
            let clusterBonus = Math.min(nearbyAgents.length, 5) * 1.0;
            clusterBonus *= socialNeedMultiplier * lonelinessMultiplier;
            reward += clusterBonus;
            rewardBreakdown.push(`cluster:+${clusterBonus.toFixed(1)}`);

            // Extra bonus for being near bonded agents (relationship maintenance)
            if (nearbyBondedAgents.length > 0) {
                const bondBonus = nearbyBondedAgents.reduce((sum, a) => sum + a.bond * 2.0, 0);
                reward += bondBonus;
                rewardBreakdown.push(`bondedNear:+${bondBonus.toFixed(1)}`);
            }
        }

        // Shared building reward: Check if placing blocks near others
        if (bot.mlLastAction) {
            const actionName = this.actionSpace.getActionName(bot.mlLastAction);
            const isBuildingAction = ['place_block', 'build_structure', 'place_crafting_table',
                                     'place_furnace', 'place_chest', 'build_wall', 'build_floor',
                                     'build_shelter_structure'].includes(actionName);

            if (isBuildingAction && nearbyAgents.filter(a => a.distance < 16).length > 0) {
                let buildTogetherReward = 10.0;
                // Apply cooperation need multiplier
                buildTogetherReward *= cooperationNeedMultiplier;
                // Extra boost if building with bonded agents
                if (nearbyBondedAgents.filter(a => a.distance < 16).length > 0) {
                    buildTogetherReward *= 1.4;
                }
                reward += buildTogetherReward;
                rewardBreakdown.push(`buildTogether:+${buildTogetherReward.toFixed(1)}`);
            }
        }

        // Coordinated mining reward: Check if mining near others
        if (bot.mlLastAction) {
            const actionName = this.actionSpace.getActionName(bot.mlLastAction);
            const isMiningAction = ['dig_forward', 'dig_down', 'dig_up', 'mine_nearest_ore',
                                   'mine_stone', 'coordinate_mining'].includes(actionName);

            if (isMiningAction && nearbyAgents.filter(a => a.distance < 10).length > 0) {
                let mineTogetherReward = 5.0;
                mineTogetherReward *= cooperationNeedMultiplier;
                reward += mineTogetherReward;
                rewardBreakdown.push(`mineTogether:+${mineTogetherReward.toFixed(1)}`);
            }
        }

        // Defend ally reward: Check if attacking when other agents are in danger
        if (bot.mlLastAction) {
            const actionName = this.actionSpace.getActionName(bot.mlLastAction);
            const isCombatAction = ['attack_nearest', 'fight_zombie', 'fight_skeleton',
                                   'fight_creeper', 'defend_ally'].includes(actionName);

            if (isCombatAction && nearbyAgents.filter(a => a.distance < 12).length > 0) {
                let defendReward = 7.0;
                // Huge boost when defending bonded agents
                if (nearbyBondedAgents.filter(a => a.distance < 12).length > 0) {
                    defendReward *= 2.0; // Double reward for defending friends!
                }
                reward += defendReward;
                rewardBreakdown.push(`defendAlly:+${defendReward.toFixed(1)}`);
            }
        }

        // === 7. CURIOSITY & EXPLORATION BONUSES (Intrinsic Motivation) ===
        // Novelty bonus: Reward for visiting new chunks (already tracked, add extra bonus)
        if (bot.explorationData) {
            // Boredom penalty: Slight penalty for staying in same area too long
            const boredom = bot.explorationData.timesSinceNewDiscovery || 0;
            if (boredom > 50) {
                const boredomPenalty = Math.min((boredom - 50) * -0.1, -3.0);
                reward += boredomPenalty;
                rewardBreakdown.push(`boredom:${boredomPenalty.toFixed(1)}`);
            }

            // Exploration diversity bonus: Reward for seeing unique blocks/entities
            if ((bot.mlStepCount % 20) === 0) {  // Check every 20 steps
                const uniqueBlocks = bot.explorationData.uniqueBlocksSeen?.size || 0;
                const uniqueEntities = bot.explorationData.uniqueEntitiesSeen?.size || 0;
                const diversityBonus = Math.min((uniqueBlocks + uniqueEntities) * 0.05, 5.0);
                if (diversityBonus > 0) {
                    reward += diversityBonus;
                    rewardBreakdown.push(`diversity:+${diversityBonus.toFixed(2)}`);
                }
            }
        }

        // === 8. NEW PSYCHOLOGICAL REWARDS (Sims-style Need Fulfillment) ===

        // Comfort reward: Bonus for having shelter (roof overhead) when comfort need is low
        if (needs.comfort !== undefined && needs.comfort < 0.5) {
            // Check if agent has roof overhead (simple check: blocks above)
            if (bot.entity) {
                let hasRoof = false;
                for (let y = 1; y <= 5; y++) {
                    const blockAbove = bot.blockAt(bot.entity.position.offset(0, y, 0));
                    if (blockAbove && blockAbove.name !== 'air') {
                        hasRoof = true;
                        break;
                    }
                }
                if (hasRoof) {
                    const comfortReward = (0.5 - needs.comfort) * 8.0; // Up to +4 reward
                    reward += comfortReward;
                    rewardBreakdown.push(`comfort:+${comfortReward.toFixed(1)}`);
                }
            }
        }

        // Creativity reward: Building/crafting when creativity need is low
        if (bot.mlLastAction && needs.creativity !== undefined && needs.creativity < 0.5) {
            const actionName = this.actionSpace.getActionName(bot.mlLastAction);
            const isCreativeAction = ['place_block', 'build_structure', 'craft_item',
                                      'build_wall', 'build_floor', 'build_shelter_structure',
                                      'place_crafting_table', 'place_furnace'].includes(actionName);

            if (isCreativeAction) {
                const creativityReward = (0.5 - needs.creativity) * 12.0; // Up to +6 reward
                reward += creativityReward;
                rewardBreakdown.push(`creativityFulfill:+${creativityReward.toFixed(1)}`);
            }
        }

        // Rest reward: Strategic pausing (low movement) when rest need is low
        if (bot.entity && bot.mlLastPosition && needs.rest !== undefined && needs.rest < 0.3) {
            const distMoved = bot.entity.position.distanceTo(bot.mlLastPosition);
            if (distMoved < 0.1) {
                // Reward resting when rest need is low
                const restReward = (0.3 - needs.rest) * 10.0; // Up to +3 reward
                reward += restReward;
                rewardBreakdown.push(`rest:+${restReward.toFixed(1)}`);
            }
        }

        // Memory-based location rewards: Favor safe places, avoid danger zones
        if (bot.recentMemories && bot.recentMemories.length > 0 && bot.entity) {
            // Check if current location has positive or negative memories
            const currentChunk = `${Math.floor(bot.entity.position.x / 16)},${Math.floor(bot.entity.position.z / 16)}`;

            // Simple heuristic: Check recent danger events
            const recentDangerMemories = bot.recentMemories.filter(m => m.type === 'danger' && m.valence < 0);
            const recentSafeMemories = bot.recentMemories.filter(m => m.type === 'achievement' && m.valence > 0);

            if (recentDangerMemories.length > recentSafeMemories.length) {
                // In dangerous area based on memories - small penalty to encourage leaving
                const dangerAversion = -1.5;
                reward += dangerAversion;
                rewardBreakdown.push(`memoryDanger:${dangerAversion.toFixed(1)}`);
            } else if (recentSafeMemories.length > 2) {
                // In safe/productive area - small bonus
                const safetyBonus = 1.0;
                reward += safetyBonus;
                rewardBreakdown.push(`memorySafe:+${safetyBonus.toFixed(1)}`);
            }
        }

        // === 9. SUB-SKILLS AND MOODLES (Project Zomboid Survival System) ===
        const subSkillsSystem = getSubSkillsSystem();
        const moodlesSystem = getMoodlesSystem();

        // Award skill XP for performing actions
        if (bot.mlLastAction) {
            const actionName = this.actionSpace.getActionName(bot.mlLastAction);
            const skillId = subSkillsSystem.getSkillForAction(actionName);

            if (skillId) {
                // Award 1-5 XP based on action complexity
                const xpAmount = 3.0;
                const leveledUp = subSkillsSystem.awardXP(bot, skillId, xpAmount, actionName);

                if (leveledUp) {
                    // BIG reward for leveling up a skill!
                    const levelUpReward = 20.0;
                    reward += levelUpReward;
                    rewardBreakdown.push(`skillUp:+${levelUpReward.toFixed(1)}`);
                }
            }
        }

        // Moodle penalties: Severe debuffs hurt performance
        if (bot.moodles) {
            let moodlePenalty = 0;

            // Physical moodles - penalize severe conditions
            if (bot.moodles.injured && bot.moodles.injured.severity >= 3) {
                moodlePenalty += bot.moodles.injured.severity * -1.5; // -4.5 to -6.0
            }
            if (bot.moodles.bleeding && bot.moodles.bleeding.severity >= 2) {
                moodlePenalty += bot.moodles.bleeding.severity * -2.0; // -4.0 to -8.0
            }
            if (bot.moodles.poisoned && bot.moodles.poisoned.severity >= 2) {
                moodlePenalty += bot.moodles.poisoned.severity * -1.8;
            }
            if (bot.moodles.sick && bot.moodles.sick.severity >= 3) {
                moodlePenalty += bot.moodles.sick.severity * -1.2;
            }

            // Mental moodles - penalize panic and severe stress
            if (bot.moodles.panicked && bot.moodles.panicked.severity >= 3) {
                moodlePenalty += bot.moodles.panicked.severity * -1.0; // Panic hurts decision making
            }
            if (bot.moodles.depressed && bot.moodles.depressed.severity >= 4) {
                moodlePenalty += bot.moodles.depressed.severity * -0.8;
            }

            // Environmental moodles - penalize extreme conditions
            if (bot.moodles.cold && bot.moodles.cold.severity >= 3) {
                moodlePenalty += bot.moodles.cold.severity * -0.6;
            }
            if (bot.moodles.hot && bot.moodles.hot.severity >= 3) {
                moodlePenalty += bot.moodles.hot.severity * -0.6;
            }

            if (moodlePenalty < 0) {
                reward += moodlePenalty;
                rewardBreakdown.push(`moodles:${moodlePenalty.toFixed(1)}`);
            }
        }

        // Reward good debuff management: Having NO severe moodles
        const hasSevereMoodle = bot.moodles && Object.values(bot.moodles).some(m => m.severity >= 3);
        if (!hasSevereMoodle && bot.moodles && Object.keys(bot.moodles).length > 0) {
            const healthyBonus = 2.0;
            reward += healthyBonus;
            rewardBreakdown.push(`healthy:+${healthyBonus.toFixed(1)}`);
        }

        // === 10. PENALTIES ===
        // Stuck penalty (only when truly stuck by stuck detector)
        if (bot.stuckDetector && bot.stuckDetector.isStuck) {
            reward -= 3.0;
            rewardBreakdown.push(`stuck:-3.0`);
        }

        // REMOVED: Idle penalty - agents need freedom to learn and explore
        // Reset idle counter for tracking purposes only
        if (bot.entity && bot.mlLastPosition) {
            const distMoved = bot.entity.position.distanceTo(bot.mlLastPosition);
            bot.mlIdleSteps = distMoved < 0.1 ? (bot.mlIdleSteps || 0) + 1 : 0;
        }

        // === 11. LOGGING (Occasional debug output) ===
        if (Math.random() < 0.02) { // 2% chance to log
            console.log(`[ML REWARD] ${bot.agentName}: ${reward.toFixed(2)} (${rewardBreakdown.join(', ')})`);
        }

        // Store reward breakdown history for dashboard (keep last 10)
        if (!bot.mlRewardHistory) {
            bot.mlRewardHistory = [];
        }
        bot.mlRewardHistory.push({
            total: reward,
            breakdown: rewardBreakdown.join(', '),
            timestamp: Date.now()
        });
        // Keep only last 10 entries
        if (bot.mlRewardHistory.length > 10) {
            bot.mlRewardHistory.shift();
        }

        return reward;
    }

    /**
     * Handle agent death - finalize episode
     */
    async handleAgentDeath(bot) {
        if (!bot.mlEpisodeBuffer) return;

        const episodeBuffer = bot.mlEpisodeBuffer;

        // Add final step with death penalty
        if (bot.mlLastState !== null) {
            const deathPenalty = -10.0;
            episodeBuffer.addStep(
                bot.mlLastState,
                bot.mlLastAction,
                deathPenalty,
                bot.mlLastValue,
                bot.mlLastLogProb,
                true  // done = true (episode ended)
            );
        }

        // Transfer episode to global replay buffer
        const episodeData = episodeBuffer.getData();
        for (let i = 0; i < episodeData.states.length; i++) {
            this.globalReplayBuffer.add({
                state: episodeData.states[i],
                action: episodeData.actions[i],
                reward: episodeData.rewards[i],
                nextState: i < episodeData.states.length - 1 ? episodeData.states[i + 1] : null,
                done: episodeData.dones[i],
                agentType: bot.agentType
            });
        }

        // Update stats
        this.stats.episodesCompleted++;
        const episodeReward = episodeBuffer.totalReward();
        this.stats.avgReward = this.stats.avgReward * 0.99 + episodeReward * 0.01;
        this.stats.avgEpisodeLength = this.stats.avgEpisodeLength * 0.99 + episodeBuffer.length() * 0.01;

        console.log(`[ML TRAINER] Episode completed for ${bot.agentName}: ` +
                   `${episodeBuffer.length()} steps, ${episodeReward.toFixed(2)} reward`);

        // Train on this episode immediately (PPO on-policy learning)
        await this.trainBrainOnEpisode(bot.agentType, episodeData);

        // Clear episode buffer
        episodeBuffer.clear();
    }

    /**
     * Train a specific brain on episode data
     */
    async trainBrainOnEpisode(agentType, episodeData) {
        if (episodeData.states.length < 2) return;

        // Validate all arrays have the same length
        const length = episodeData.states.length;
        if (episodeData.actions.length !== length ||
            episodeData.logProbs.length !== length ||
            episodeData.advantages.length !== length ||
            episodeData.returns.length !== length) {

            console.error(`[ML TRAINER] ${agentType} episode data shape mismatch:`, {
                states: episodeData.states.length,
                actions: episodeData.actions.length,
                logProbs: episodeData.logProbs.length,
                advantages: episodeData.advantages.length,
                returns: episodeData.returns.length
            });

            // Skip training this episode to prevent crashes
            return;
        }

        const brain = this.getBrain(agentType);

        try {
            const losses = await brain.trainPPO(
                episodeData.states,
                episodeData.actions,
                episodeData.logProbs,
                episodeData.advantages,
                episodeData.returns,
                this.config.trainingEpochs
            );

            this.stats.totalTrainingSteps++;

            console.log(`[ML TRAINER] Trained ${agentType}: Actor Loss=${losses.actorLoss.toFixed(4)}, ` +
                       `Critic Loss=${losses.criticLoss.toFixed(4)}`);

        } catch (error) {
            console.error(`[ML TRAINER] Training error for ${agentType}: ${error.message}`);
            console.error(`[ML TRAINER] Episode data shapes: states=${episodeData.states.length}, actions=${episodeData.actions.length}, advantages=${episodeData.advantages.length}, returns=${episodeData.returns.length}`);
        }
    }

    /**
     * Train shared brain and personal brains using replay buffer
     */
    async trainAllBrains() {
        if (!this.trainingEnabled) return;
        if (this.globalReplayBuffer.size() < this.config.minBufferSize) return;

        const allExperiences = this.globalReplayBuffer.sample(1000);
        if (allExperiences.length < 32) return;

        console.log(`[ML TRAINER] Training hierarchical brain system... (Buffer size: ${this.globalReplayBuffer.size()})`);

        // 1. TRAIN SHARED BRAIN (collective knowledge from all agents)
        if (this.sharedNeuralBrain) {
            const batchSize = Math.min(this.config.batchSize, allExperiences.length);
            const batch = [];
            for (let i = 0; i < batchSize; i++) {
                batch.push(allExperiences[Math.floor(Math.random() * allExperiences.length)]);
            }

            const states = batch.map(exp => exp.state);
            const actions = batch.map(exp => exp.action);

            // Calculate returns and advantages
            const returns = [];
            const advantages = [];
            for (let i = 0; i < batch.length; i++) {
                const value = this.sharedNeuralBrain.evaluateState(batch[i].state);
                const nextValue = batch[i].nextState ? this.sharedNeuralBrain.evaluateState(batch[i].nextState) : 0;
                const tdTarget = batch[i].reward + 0.99 * nextValue * (batch[i].done ? 0 : 1);
                const advantage = tdTarget - value;

                returns.push(tdTarget);
                advantages.push(advantage);
            }

            const oldLogProbs = states.map((state, i) => {
                const actionData = this.sharedNeuralBrain.selectAction(state, false);
                return actionData.logProb;
            });

            try {
                await this.sharedNeuralBrain.trainPPO(states, actions, oldLogProbs, advantages, returns, 2);
                console.log(`[ML TRAINER] ✓ Shared brain trained (collective knowledge)`);
            } catch (error) {
                console.error(`[ML TRAINER] Shared brain training error: ${error.message}`);
            }
        }

        // 2. TRAIN PERSONAL BRAINS (individual specialization)
        if (this.personalBrains && this.personalBrains.size > 0) {
            let trainedCount = 0;
            for (const [agentName, personalBrain] of this.personalBrains) {
                // Get experiences for this specific agent
                const agentExperiences = allExperiences.filter(exp =>
                    exp.agentName === agentName || !exp.agentName  // Include generic experiences too
                );

                if (agentExperiences.length < 16) continue;  // Need at least 16 experiences

                const batchSize = Math.min(32, agentExperiences.length);
                const batch = [];
                for (let i = 0; i < batchSize; i++) {
                    batch.push(agentExperiences[Math.floor(Math.random() * agentExperiences.length)]);
                }

                const states = batch.map(exp => exp.state);
                const actions = batch.map(exp => exp.action);

                const returns = [];
                const advantages = [];
                for (let i = 0; i < batch.length; i++) {
                    const value = personalBrain.evaluateState(batch[i].state);
                    const nextValue = batch[i].nextState ? personalBrain.evaluateState(batch[i].nextState) : 0;
                    const tdTarget = batch[i].reward + 0.99 * nextValue * (batch[i].done ? 0 : 1);
                    const advantage = tdTarget - value;

                    returns.push(tdTarget);
                    advantages.push(advantage);
                }

                const oldLogProbs = states.map((state, i) => {
                    const actionData = personalBrain.selectAction(state, false);
                    return actionData.logProb;
                });

                try {
                    await personalBrain.trainPPO(states, actions, oldLogProbs, advantages, returns, 1);
                    trainedCount++;
                } catch (error) {
                    // Skip this agent's training
                }
            }

            if (trainedCount > 0) {
                console.log(`[ML TRAINER] ✓ Trained ${trainedCount} personal brains (specialization)`);
            }
        }
    }

    /**
     * Save shared brain model
     */
    async saveAllModels() {
        if (!this.sharedNeuralBrain) return;

        console.log('[ML TRAINER] Saving SHARED BRAIN model...');
        await this.sharedNeuralBrain.saveModel(this.modelPath);
        console.log(`[ML TRAINER] ✓ Shared brain model saved`);
    }

    /**
     * Get training statistics
     */
    getStats() {
        return {
            ...this.stats,
            totalSteps: this.totalSteps,
            explorationRate: this.config.explorationRate.toFixed(4),
            bufferSize: this.globalReplayBuffer.size(),
            sharedBrainActive: this.sharedNeuralBrain !== null,
            personalBrainsCount: this.personalBrains ? this.personalBrains.size : 0,
            sqliteBrainActive: this.sharedSQLiteBrain.initialized,
            replayBufferStats: this.globalReplayBuffer.getStats(),
            architecture: 'Hierarchical: Shared Collective + Personal Specialization'
        };
    }

    /**
     * Generate context string for SharedBrain queries
     */
    getContextString(bot) {
        const parts = [];

        // Health status
        if (bot.health < 10) parts.push('low_health');
        else if (bot.health > 18) parts.push('healthy');

        // Food status
        if (bot.food < 10) parts.push('hungry');
        else if (bot.food > 18) parts.push('well_fed');

        // Combat context
        const nearbyHostiles = Object.values(bot.entities).filter(e =>
            e.type === 'mob' &&
            e.position.distanceTo(bot.entity.position) < 16 &&
            ['zombie', 'skeleton', 'creeper', 'spider', 'enderman'].includes(e.name)
        );
        if (nearbyHostiles.length > 0) parts.push('combat');

        // Time of day
        const time = bot.time.timeOfDay;
        if (time < 6000) parts.push('day');
        else if (time < 12000) parts.push('afternoon');
        else if (time < 18000) parts.push('night');
        else parts.push('midnight');

        // Current goal
        if (bot.currentGoal) {
            parts.push(bot.currentGoal.name.toLowerCase().replace(/ /g, '_'));
        }

        return parts.join('_') || 'general';
    }

    /**
     * Check for skill unlocks based on collective performance
     */
    async checkSkillUnlocks(bot, actionName, reward) {
        // Only check positive rewards
        if (reward <= 0) return;

        // Define skill unlock thresholds (simplified for now)
        const skillUnlockConditions = {
            'mining_expert': { actions: ['dig_forward', 'dig_down', 'mine_nearest_ore'], threshold: 50 },
            'combat_veteran': { actions: ['attack_nearest', 'fight_zombie', 'fight_skeleton'], threshold: 30 },
            'builder': { actions: ['place_block', 'build_structure', 'build_wall'], threshold: 40 },
            'explorer': { actions: ['move_forward', 'random_walk', 'explore_area'], threshold: 100 },
            'farmer': { actions: ['collect_seeds', 'plant_crops', 'harvest_crops'], threshold: 20 }
        };

        // Check each skill
        for (const [skillName, condition] of Object.entries(skillUnlockConditions)) {
            if (condition.actions.includes(actionName)) {
                // Check if skill already unlocked
                const hasSkill = await this.sharedSQLiteBrain.hasSkillAccess(skillName);
                if (!hasSkill) {
                    // Count successful uses of this action type from collective experience
                    // For now, unlock randomly with small probability (will improve with better tracking)
                    if (Math.random() < 0.01) {  // 1% chance per successful action
                        await this.sharedSQLiteBrain.unlockSkill(
                            skillName,
                            bot.agentName,
                            `Unlocked through ${actionName} mastery`
                        );
                    }
                }
            }
        }
    }

    /**
     * Enable/disable training
     */
    setTraining(enabled) {
        this.trainingEnabled = enabled;
        console.log(`[ML TRAINER] Training ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }

    /**
     * Ensure model directory exists
     */
    ensureModelDirectory() {
        if (!fs.existsSync(this.modelPath)) {
            fs.mkdirSync(this.modelPath, { recursive: true });
            console.log(`[ML TRAINER] Created model directory: ${this.modelPath}`);
        }
    }

    /**
     * Clean up resources
     */
    async dispose() {
        // Dispose shared TensorFlow brain
        if (this.sharedNeuralBrain) {
            this.sharedNeuralBrain.dispose();
            this.sharedNeuralBrain = null;
        }

        // Dispose all personal brains
        if (this.personalBrains) {
            for (const [agentName, brain] of this.personalBrains) {
                brain.dispose();
            }
            this.personalBrains.clear();
        }

        // Close SQLite brain
        if (this.sharedSQLiteBrain) {
            await this.sharedSQLiteBrain.close();
        }

        console.log('[ML TRAINER] Disposed all ML resources (shared + personal brains + SQLite)');
    }

    // ===== REMOTE WORKER METHODS =====
    // These methods support the worker pool architecture

    /**
     * Initialize ML for remote agent (worker thread)
     */
    initializeRemoteAgent(agentName, agentType) {
        const brain = this.getBrain(agentType);
        const episodeBuffer = new EpisodeBuffer();
        episodeBuffer.agentType = agentType;

        this.episodeBuffers.set(agentName, episodeBuffer);
        console.log(`[ML TRAINER] Initialized remote ML for ${agentName} (${agentType})`);
    }

    /**
     * Select action for remote agent
     */
    selectActionForAgent(agentName, agentType, state) {
        const brain = this.getBrain(agentType);

        // Exploration
        const useRandom = Math.random() < this.config.explorationRate;
        let action, logProb, value;

        if (useRandom) {
            action = Math.floor(Math.random() * this.actionSpace.ACTION_COUNT);
            const actionData = brain.selectAction(state, true);
            logProb = actionData.logProb;
            value = actionData.value;
        } else {
            const actionData = brain.selectAction(state, true);
            action = actionData.action;
            logProb = actionData.logProb;
            value = actionData.value;
        }

        return { action, logProb, value };
    }

    /**
     * Add experience from remote agent
     */
    addRemoteExperience(agentName, agentType, experience) {
        const episodeBuffer = this.episodeBuffers.get(agentName);
        if (!episodeBuffer) {
            console.warn(`[ML TRAINER] No episode buffer for ${agentName}`);
            return;
        }

        episodeBuffer.addStep(
            experience.state,
            experience.action,
            experience.reward,
            experience.value,
            experience.logProb,
            experience.done
        );

        this.totalSteps++;

        // Decay exploration
        this.config.explorationRate = Math.max(
            this.config.minExploration,
            this.config.explorationRate * this.config.explorationDecay
        );

        // Periodic training
        if (this.totalSteps % this.config.stepsPerUpdate === 0) {
            this.trainAllBrains().catch(err => {
                console.error(`[ML TRAINER] Training error: ${err.message}`);
            });
        }

        // Periodic saving
        if (this.totalSteps - this.lastSaveStep >= this.config.saveInterval) {
            this.saveAllModels().catch(err => {
                console.error(`[ML TRAINER] Save error: ${err.message}`);
            });
            this.lastSaveStep = this.totalSteps;
        }
    }

    /**
     * Handle death of remote agent
     */
    async handleRemoteAgentDeath(agentName, deathData) {
        const episodeBuffer = this.episodeBuffers.get(agentName);
        if (!episodeBuffer) {
            return;
        }

        // Add final death penalty
        if (episodeBuffer.length() > 0) {
            const lastIdx = episodeBuffer.states.length - 1;
            episodeBuffer.rewards[lastIdx] -= 10.0; // Death penalty
            episodeBuffer.dones[lastIdx] = true;
        }

        // Transfer to replay buffer
        const episodeData = episodeBuffer.getData();
        for (let i = 0; i < episodeData.states.length; i++) {
            this.globalReplayBuffer.add({
                state: episodeData.states[i],
                action: episodeData.actions[i],
                reward: episodeData.rewards[i],
                nextState: i < episodeData.states.length - 1 ? episodeData.states[i + 1] : null,
                done: episodeData.dones[i],
                agentType: episodeBuffer.agentType
            });
        }

        // Update stats
        this.stats.episodesCompleted++;
        const episodeReward = episodeBuffer.totalReward();
        this.stats.avgReward = this.stats.avgReward * 0.99 + episodeReward * 0.01;
        this.stats.avgEpisodeLength = this.stats.avgEpisodeLength * 0.99 + episodeBuffer.length() * 0.01;

        console.log(`[ML TRAINER] Episode completed for ${agentName}: ` +
                   `${episodeBuffer.length()} steps, ${episodeReward.toFixed(2)} reward`);

        // Train on episode
        await this.trainBrainOnEpisode(episodeBuffer.agentType, episodeData);

        // Clean up
        this.episodeBuffers.delete(agentName);
    }
}

// Singleton instance
let trainerInstance = null;

function getMLTrainer() {
    if (!trainerInstance) {
        trainerInstance = new MLTrainer();
    }
    return trainerInstance;
}

module.exports = { MLTrainer, getMLTrainer };
