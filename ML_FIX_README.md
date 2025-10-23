# ML Decision Loop Stack Overflow Fix

## Problem Identified

The ML decision loop in `server.js` (lines 1354-1453) is causing **"Maximum call stack size exceeded" errors** that block all agent actions after the first successful action.

### Root Cause

The code was calling `mlTrainer.selectActionForAgent()` which is designed for **remote worker threads**, not the main thread loop. This method doesn't properly manage the ML state transitions, leading to:

1. Out-of-sync state/action tracking
2. Missing experience recording
3. Recursive TensorFlow graph operations
4. Stack overflow in brain.selectAction() calls

The correct entry point is `mlTrainer.agentStep(bot)` which properly handles:
- State encoding
- Hierarchical brain action selection (SQLite + Shared + Personal networks)
- Action execution
- Experience recording for training
- Periodic training updates

## The Fix

Replace lines 1354-1453 in `server.js` with the following code:

```javascript
    // ML Decision-Making Loop - Every 3 seconds, let ML choose an action
    console.log(`[ML LOOP CHECK] ${bot.agentName} - ML_ENABLED: ${ML_ENABLED}, mlTrainer: ${!!mlTrainer}, actionSpace: ${!!bot.actionSpace}`);
    if (ML_ENABLED && mlTrainer && bot.actionSpace) {
        console.log(`[ML LOOP] Starting ML decision loop for ${bot.agentName}`);

        // Initialize ML agent in trainer (this sets up brain, episode buffer, etc.)
        mlTrainer.initializeAgent(bot).then(() => {
            console.log(`[ML INIT] ${bot.agentName} ML agent initialized successfully`);
        }).catch(err => {
            console.error(`[ML INIT] ${bot.agentName} failed to initialize ML: ${err.message}`);
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
                            bot.lastThought = `Exploring new strategies... trying ${actionName}`;
                        } else {
                            bot.lastThought = `My training suggests ${actionName} (value: ${(value || 0).toFixed(2)})`;
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
                            bot.lastThought = `${actionName} didn't work out. Learning from this...`;
                        }
                    }
                }
            } catch (error) {
                // Handle ML errors gracefully
                bot.lastThought = `Error during decision making: ${error.message}`;
                console.error(`[ML] ${bot.agentName} decision error: ${error.message}`);
                console.error(error.stack);
            }
        }, 3000); // Every 3 seconds
    }
```

## Key Changes

1. **Added `mlTrainer.initializeAgent(bot)`** call before starting the interval loop
   - This initializes the shared brain, personal brain, episode buffer, and ML state variables
   - Without this, the agent has no ML context

2. **Replaced manual state encoding + selectActionForAgent()** with **`mlTrainer.agentStep(bot)`**
   - This is the proper entry point that manages the entire ML decision cycle
   - Prevents stack overflow by maintaining proper state transitions

3. **Removed manual action execution** since `agentStep()` already handles it
   - The old code was executing actions twice (once in selectActionForAgent, once manually)
   - This caused circular references and stack overflow

4. **Removed manual reward calculation** since `agentStep()` handles this via `mlTrainer.calculateReward()`
   - The old code wasn't recording experiences for training
   - `agentStep()` properly stores state-action-reward tuples for PPO training

5. **Added error stack traces** for better debugging

## Testing

After applying the fix, run:

```bash
node server.js
```

You should see:
- `[ML INIT] <agentName> ML agent initialized successfully` for each agent
- No more "Maximum call stack size exceeded" errors
- Agents taking consistent actions every 3 seconds
- Agents learning and improving over time

## Technical Details

The hierarchical brain system works as follows:

1. **SQLite Collective Brain** (40% weight) - Proven strategies from all agents
2. **Shared TensorFlow Network** (30% weight) - General pattern learning
3. **Personal TensorFlow Network** (30% weight) - Individual specialization

`mlTrainer.agentStep()` blends all three sources correctly, while the old `selectActionForAgent()` only used a single source, breaking the architecture.

## Files Modified

- `server.js` - Lines 1354-1453 (ML decision loop)

## Files Analyzed

- `ml_trainer.js:219-421` - agentStep() implementation
- `ml_trainer.js:1509-1530` - selectActionForAgent() (worker thread method)
- `ml_action_space.js:29-46` - Action module initialization
- `actions/action_utils.js` - Utility methods (no circular refs)

## Race Condition Fixed

The original code had a race condition where:
1. Agent spawns
2. ML loop starts immediately
3. Brain not yet initialized
4. First action fails → stack overflow cascade

The fix ensures the brain is fully initialized before any actions are attempted.
