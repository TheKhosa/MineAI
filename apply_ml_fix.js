#!/usr/bin/env node
/**
 * Script to apply the ML Decision Loop fix to server.js
 * This fixes the "Maximum call stack size exceeded" error
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');
const backupPath = path.join(__dirname, 'server.js.backup');

console.log('[FIX] Reading server.js...');
const content = fs.readFileSync(serverPath, 'utf8');

// Create backup
console.log('[FIX] Creating backup at server.js.backup...');
fs.writeFileSync(backupPath, content, 'utf8');

// Find the section to replace (lines 1354-1453)
const oldCode = `    // ML Decision-Making Loop - Every 3 seconds, let ML choose an action
    console.log(\`[ML LOOP CHECK] \${bot.agentName} - ML_ENABLED: \${ML_ENABLED}, mlTrainer: \${!!mlTrainer}, actionSpace: \${!!bot.actionSpace}\`);
    if (ML_ENABLED && mlTrainer && bot.actionSpace) {
        console.log(\`[ML LOOP] Starting ML decision loop for \${bot.agentName}\`);
        setInterval(async () => {
            try {
                console.log(\`[ML LOOP] Tick for \${bot.agentName} - Health: \${bot.health}, Has entity: \${!!bot.entity}, Has position: \${!!bot.entity?.position}\`);
                if (bot.health > 0 && bot.entity && bot.entity.position) {
                    // Encode current state
                    const state = bot.stateEncoder.encodeState(bot);

                    // Get ML action from trainer
                    const actionResult = mlTrainer.selectActionForAgent(bot.agentName, bot.agentType, state);
                    const actionId = actionResult.action;

                    // Apply personality bias if available
                    let finalActionId = actionId;
                    let thoughtProcess = 'Deciding next action...';

                    if (bot.personality && mlPersonality) {
                        const actions = [{ id: actionId, type: bot.actionSpace.getActionName(actionId), probability: 1.0 }];
                        const biasedActions = mlPersonality.getPersonalityBiasedActions(bot.personality, actions);
                        if (biasedActions.length > 0) {
                            finalActionId = biasedActions[0].id;
                            thoughtProcess = \`My personality drives me to \${bot.actionSpace.getActionName(finalActionId)}\`;
                        }
                    }

                    // Execute the action
                    const actionName = bot.actionSpace.getActionName(finalActionId);
                    console.log(\`[ML ACTION] \${bot.agentName} attempting action \${finalActionId}: \${actionName}\`);

                    // Update bot's thought process and current action
                    bot.lastAction = actionName;
                    bot.lastThought = thoughtProcess;

                    const success = await bot.actionSpace.executeAction(finalActionId, bot);
                    console.log(\`[ML ACTION] \${bot.agentName} action result: \${success ? 'SUCCESS' : 'FAILED'}\`);

                    // Record action for enriched chat system
                    if (bot.actionChat) {
                        bot.actionChat.recordAction(finalActionId, actionName, success, {
                            position: bot.entity?.position,
                            health: bot.health,
                            inventory: bot.inventory?.items().length || 0
                        });
                    }

                    // Update last action time for idle detection (IF YOU AIN'T LEARNING, YOU DYING)
                    if (success) {
                        bot.lastActionTime = Date.now();
                    }

                    // Give reward for action
                    if (success) {
                        const actionReward = REWARD_CONFIG.MOVEMENT;
                        bot.rewards.addReward(actionReward, \`action: \${actionName}\`);
                        console.log(\`[ML REWARD] \${bot.agentName} earned \${actionReward.toFixed(2)} for \${actionName}\`);
                        bot.lastThought = \`Successfully completed \${actionName}! Reward: +\${actionReward.toFixed(2)}\`;

                        // Record experience for ML learning
                        // NOTE: Experience tracking is already handled by mlTrainer.agentStep()
                        // No need to manually store experiences here

                        // Record experience for personality evolution
                        if (mlPersonality && bot.personality) {
                            const activityMap = {
                                'mine': 'mining',
                                'chop': 'gathering',
                                'dig': 'mining',
                                'attack': 'fighting',
                                'craft': 'crafting',
                                'fish': 'fishing'
                            };

                            for (const [key, activity] of Object.entries(activityMap)) {
                                if (actionName.includes(key)) {
                                    mlPersonality.recordExperience(
                                        bot.uuid || bot.agentName,
                                        bot.personality,
                                        'activities',
                                        activity,
                                        true,
                                        0.02
                                    );
                                    break;
                                }
                            }
                        }
                    } else {
                        bot.lastThought = \`Failed to execute \${actionName}. Trying something else...\`;
                    }
                }
            } catch (error) {
                // Silently handle ML errors - agent continues with basic behavior
                bot.lastThought = \`Error during decision making: \${error.message}\`;
                console.error(\`[ML] \${bot.agentName} decision error: \${error.message}\`);
            }
        }, 3000); // Every 3 seconds
    }`;

const newCode = `    // ML Decision-Making Loop - Every 3 seconds, let ML choose an action
    console.log(\`[ML LOOP CHECK] \${bot.agentName} - ML_ENABLED: \${ML_ENABLED}, mlTrainer: \${!!mlTrainer}, actionSpace: \${!!bot.actionSpace}\`);
    if (ML_ENABLED && mlTrainer && bot.actionSpace) {
        console.log(\`[ML LOOP] Starting ML decision loop for \${bot.agentName}\`);

        // Initialize ML agent in trainer (this sets up brain, episode buffer, etc.)
        mlTrainer.initializeAgent(bot).then(() => {
            console.log(\`[ML INIT] \${bot.agentName} ML agent initialized successfully\`);
        }).catch(err => {
            console.error(\`[ML INIT] \${bot.agentName} failed to initialize ML: \${err.message}\`);
        });

        setInterval(async () => {
            try {
                if (bot.health > 0 && bot.entity && bot.entity.position) {
                    // Use mlTrainer.agentStep() - the CORRECT entry point for ML decision loop
                    // This method handles:
                    // - State encoding
                    // - Hierarchical brain action selection (SQLite + Shared + Personal)
                    // - Action execution via ActionSpace
                    // - Experience recording for training
                    // - Periodic training updates
                    const stepResult = await mlTrainer.agentStep(bot);

                    if (stepResult) {
                        const { action, actionName, value, success, wasExploring } = stepResult;

                        // Update bot's thought process
                        if (wasExploring) {
                            bot.lastThought = \`Exploring new strategies... trying \${actionName}\`;
                        } else {
                            bot.lastThought = \`My training suggests \${actionName} (value: \${(value || 0).toFixed(2)})\`;
                        }

                        bot.lastAction = actionName;

                        // Record action for enriched chat system
                        if (bot.actionChat && success) {
                            bot.actionChat.recordAction(action, actionName, success, {
                                position: bot.entity?.position,
                                health: bot.health,
                                inventory: bot.inventory?.items().length || 0
                            });
                        }

                        // Update last action time for idle detection
                        if (success) {
                            bot.lastActionTime = Date.now();

                            // Record experience for personality evolution
                            if (mlPersonality && bot.personality) {
                                const activityMap = {
                                    'mine': 'mining',
                                    'chop': 'gathering',
                                    'dig': 'mining',
                                    'attack': 'fighting',
                                    'craft': 'crafting',
                                    'fish': 'fishing'
                                };

                                for (const [key, activity] of Object.entries(activityMap)) {
                                    if (actionName.includes(key)) {
                                        mlPersonality.recordExperience(
                                            bot.uuid || bot.agentName,
                                            bot.personality,
                                            'activities',
                                            activity,
                                            true,
                                            0.02
                                        );
                                        break;
                                    }
                                }
                            }
                        } else {
                            bot.lastThought = \`\${actionName} didn't work out. Learning from this...\`;
                        }
                    }
                }
            } catch (error) {
                // Handle ML errors gracefully
                bot.lastThought = \`Error during decision making: \${error.message}\`;
                console.error(\`[ML] \${bot.agentName} decision error: \${error.message}\`);
                console.error(error.stack);
            }
        }, 3000); // Every 3 seconds
    }`;

if (!content.includes('mlTrainer.selectActionForAgent(bot.agentName, bot.agentType, state)')) {
    console.error('[FIX] ERROR: Could not find the code to replace. File may have already been patched or modified.');
    console.error('[FIX] Restoring original from backup...');
    process.exit(1);
}

console.log('[FIX] Applying patch...');
const fixedContent = content.replace(oldCode, newCode);

if (fixedContent === content) {
    console.error('[FIX] ERROR: Patch did not apply. Content unchanged.');
    process.exit(1);
}

console.log('[FIX] Writing fixed version...');
fs.writeFileSync(serverPath, fixedContent, 'utf8');

console.log('[FIX] ✅ Successfully applied ML decision loop fix!');
console.log('[FIX] Backup saved to: server.js.backup');
console.log('[FIX] You can now run: node server.js');
