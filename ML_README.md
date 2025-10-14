# MineRL Machine Learning System

## Overview

The Intelligent Village now features a comprehensive **Machine Learning system** that allows agents to learn sophisticated Minecraft game mechanics through experience. Agents use **Deep Reinforcement Learning** with **PPO (Proximal Policy Optimization)** to develop intelligent behaviors by interacting with the Minecraft world via mineflayer.

## Architecture

### Core Components

1. **State Encoder** (`ml_state_encoder.js`)
   - Converts mineflayer bot observations into 256-dimensional neural network input vectors
   - Encodes: position, health, inventory, nearby blocks (5×5×5 voxel grid), nearby entities, time, goals
   - Provides rich environmental awareness to the neural network

2. **Action Space** (`ml_action_space.js`)
   - Defines 50 possible actions ranging from low-level (move, dig, attack) to high-level (mine nearest ore, fight creeper, trade with agent)
   - Executes actions through mineflayer's API
   - Actions categorized into: Movement, Interaction, Resource Gathering, Combat, Crafting, Social, Utility

3. **Agent Brain** (`ml_agent_brain.js`)
   - Implements Actor-Critic neural network architecture using TensorFlow.js
   - **Actor Network**: Outputs action probabilities (policy)
   - **Critic Network**: Outputs state value estimates
   - Trained using PPO algorithm with clipped objective and entropy regularization

4. **Experience Replay** (`ml_experience_replay.js`)
   - Stores agent experiences: (state, action, reward, next_state, done)
   - Supports both uniform and prioritized experience replay
   - Episode buffer for calculating returns and advantages (GAE)

5. **ML Trainer** (`ml_trainer.js`)
   - Coordinates the entire training pipeline
   - Manages per-agent-type neural networks
   - Handles online learning: agents learn while playing
   - Automatic model persistence and loading

## How It Works

### 1. Agent Lifecycle

```
Agent Spawns → ML Initialization → Behavior Loop → Death → Episode Finalization → Training
                                         ↓
                                    (repeated)
                            Observe State → Select Action
                                    ↓
                            Execute Action → Receive Reward
```

### 2. Learning Process

- **Online Learning**: Agents learn continuously while playing
- **Episode-Based**: Each agent life is an episode
- **Batch Training**: Models update every 512 steps
- **Multi-Agent**: Multiple agents of the same type share a single brain
- **Curriculum Learning**: Agents start with exploration and gradually exploit learned policies

### 3. Reward Signal

Agents receive rewards for:
- **Survival**: Small positive reward for staying alive
- **Task Completion**: Rewards from existing reward tracker (mining, combat, trading)
- **Health Management**: Penalties for damage, rewards for eating
- **Exploration**: Small rewards for moving and discovering
- **Death**: -10 penalty to discourage dying

### 4. State Representation (256D Vector)

| Component | Dimensions | Description |
|-----------|-----------|-------------|
| Position | 3 | x, y, z coordinates (normalized) |
| Health/Survival | 4 | health, food, saturation, oxygen |
| Inventory | 50 | Item counts and equipped tool |
| Nearby Blocks | 125 | 5×5×5 voxel grid around agent |
| Nearby Entities | 30 | Up to 10 entities with type, distance, Y-offset |
| Environment | 10 | Time, weather, biome, danger level |
| Goal/Task | 34 | Agent type, progress, skills, generation |

### 5. Action Space (50 Actions)

| Category | Actions | Examples |
|----------|---------|----------|
| Movement | 10 | Forward, jump, sprint, random walk |
| Interaction | 10 | Dig, place, attack, equip, eat |
| Gathering | 10 | Mine ore, chop tree, collect items, fish |
| Combat | 5 | Fight zombie/skeleton/creeper, defend, retreat |
| Crafting | 5 | Craft tools/weapons, smelt, build, place torch |
| Social | 5 | Find agent, trade, follow, share, request help |
| Utility | 5 | Idle, go to surface/underground, find shelter |

## Training Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| State Size | 256 | Input vector dimensions |
| Action Size | 50 | Number of possible actions |
| Learning Rate | 0.0003 | Adam optimizer learning rate |
| Gamma | 0.99 | Discount factor |
| Lambda | 0.95 | GAE lambda |
| Clip Ratio | 0.2 | PPO clipping parameter |
| Entropy Coef | 0.01 | Exploration bonus |
| Steps Per Update | 512 | Train every N steps |
| Batch Size | 64 | Training batch size |
| Training Epochs | 4 | PPO epochs per update |
| Exploration Rate | 0.2 → 0.05 | Epsilon-greedy (decays over time) |

## Neural Network Architecture

### Actor (Policy Network)
```
Input (256) → Dense(512, ReLU) → Dense(256, ReLU) → Dropout(0.2)
    → Dense(128, ReLU) → Output(50, Softmax)
```

### Critic (Value Network)
```
Input (256) → Dense(512, ReLU) → Dense(256, ReLU) → Dropout(0.2)
    → Dense(128, ReLU) → Output(1, Linear)
```

- **Total Parameters**: ~500K per brain
- **Framework**: TensorFlow.js (@tensorflow/tfjs-node)
- **Optimization**: Adam with gradient clipping

## Usage

### Starting the System

```bash
node intelligent_village.js
```

The ML system initializes automatically on startup. You'll see:

```
======================================================================
[ML SYSTEM] Initializing Machine Learning Training System...
[ML SYSTEM] TensorFlow.js loaded - Neural networks ready
[ML SYSTEM] State Space: 256 dimensions
[ML SYSTEM] Action Space: 50 actions
[ML SYSTEM] Algorithm: PPO (Proximal Policy Optimization)
[ML SYSTEM] ML Mode: ENABLED ✓
======================================================================
```

### In-Game Commands

Type these commands in Minecraft chat:

- **`!mlstats`** - View training statistics
  ```
  === ML Training Stats ===
  Total Steps: 15420 | Episodes: 87
  Avg Reward: 12.3 | Exploration: 0.1234
  Buffer Size: 8942 | Active Brains: 12
  Avg Episode Length: 177 steps
  ```

- **`!mltoggle`** - Enable/disable ML training
  ```
  ML Training ENABLED ✓  (or DISABLED ✗)
  ```

- **`!mlsave`** - Manually save all trained models
  ```
  Saving all ML models...
  All ML models saved successfully!
  ```

- **`!mlhelp`** - Show command help

### Model Persistence

- **Auto-Save**: Models automatically save every 5000 steps
- **Location**: `./ml_models/` directory
- **Format**: TensorFlow SavedModel format
- **Per-Agent-Type**: Separate brain for each agent type (MINING, HUNTING, etc.)
- **On Shutdown**: All models saved when pressing Ctrl+C

### Monitoring Training

Watch the console for ML activity:

```
[ML] Miner_2341[2] initialized with ML brain
[ML] Miner_2341[2]: mine_nearest_ore (value: 3.45)
[ML TRAINER] Episode completed for Miner_2341[2]: 124 steps, 15.67 reward
[ML TRAINER] Trained MINING: Actor Loss=0.0234, Critic Loss=0.0156
[ML TRAINER] Training all brains... (Buffer size: 8942)
[ML TRAINER] Saved 12 models
```

## Advanced Features

### 1. Per-Agent-Type Learning

Each agent type (MINING, HUNTING, EXPLORING, etc.) has its own neural network:
- **Specialized Policies**: Miners learn to mine, Hunters learn to fight
- **Transfer Learning**: Related types can share knowledge
- **Parallel Training**: All agent types train simultaneously

### 2. Experience Replay

- **Capacity**: 50,000 experiences stored
- **Sampling**: Prioritized replay based on TD error
- **Importance Sampling**: Corrects for sampling bias
- **Per-Type Access**: Query experiences by agent type

### 3. Generalized Advantage Estimation (GAE)

- Balances bias-variance tradeoff
- Provides stable gradient estimates
- Lambda = 0.95 for smooth advantage calculation

### 4. Continuous Learning

- **No Episodes**: Agents learn online without episodes
- **Death Handling**: Episode ends on death, immediate training
- **Persistent Memory**: Knowledge retained across restarts
- **Evolutionary**: Offspring benefit from parent's experiences

### 5. Integration with Existing Systems

- **Reward System**: ML uses existing `AgentRewardTracker` rewards
- **Knowledge Sharing**: ML agents participate in village knowledge system
- **Lineage**: ML training data inherited across generations
- **McMMO**: Skill levels fed into state encoding

## Performance Optimization

- **Batch Processing**: Efficient tensor operations
- **Memory Management**: Automatic garbage collection
- **Model Compression**: Dropout for regularization
- **Async Training**: Non-blocking background training
- **Staggered Actions**: Agents act every 1-3 seconds to reduce load

## Troubleshooting

### Issue: High CPU/Memory Usage

**Solution**:
- Reduce `stepsPerUpdate` (train less frequently)
- Decrease `batchSize`
- Limit number of concurrent agents

### Issue: Agents Behaving Randomly

**Possible Causes**:
- Early in training (exploration phase)
- High exploration rate
- Insufficient training data

**Solution**:
- Let agents train longer (>10K steps)
- Reduce `explorationRate` in ml_trainer.js
- Check `!mlstats` - ensure buffer size > 1000

### Issue: Models Not Loading

**Solution**:
- Check `./ml_models/` directory exists
- Verify model files present (actor_*/model.json, critic_*/model.json)
- First run creates new models (expected)

### Issue: TensorFlow Errors

**Solution**:
- The system uses `@tensorflow/tfjs` (pure JS) for better compatibility
- If you see native binding errors, this is already fixed in the current version
- Update Node.js to v16+ if needed (TF.js requirement)
- No Python installation required with pure JS version

## Future Enhancements

Potential improvements:

1. **Multi-Task Learning**: Share base layers across agent types
2. **Imitation Learning**: Learn from successful human players
3. **Curriculum Learning**: Progressively harder challenges
4. **Meta-Learning**: Learn to learn faster
5. **Visualization**: TensorBoard integration for loss curves
6. **Distributed Training**: Multiple servers training together
7. **Reward Shaping**: Fine-tune rewards for specific behaviors
8. **Action Masking**: Prevent invalid actions
9. **Hierarchical RL**: High-level and low-level policies
10. **Multi-Agent Coordination**: Cooperative strategies

## Technical Details

### Files Created

- `ml_state_encoder.js` - State observation encoding
- `ml_action_space.js` - Action definition and execution
- `ml_agent_brain.js` - Neural network (Actor-Critic)
- `ml_experience_replay.js` - Experience storage and sampling
- `ml_trainer.js` - Training orchestration
- `ML_README.md` - This documentation

### Dependencies Added

```json
{
  "@tensorflow/tfjs": "^4.22.0"
}
```

**Note**: Using pure JavaScript version (@tensorflow/tfjs) instead of native version (@tensorflow/tfjs-node) for better Windows compatibility. Performance is slightly slower but more reliable across platforms.

### Code Changes to `intelligent_village.js`

1. Import ML trainer at top
2. ML initialization on agent spawn (line ~2030)
3. ML death handling (line ~2136)
4. ML behavior loop function (line ~2367)
5. ML startup initialization (line ~3236)
6. ML commands (!mlstats, !mltoggle, !mlsave, !mlhelp) (line ~2324)
7. ML cleanup on shutdown (line ~2266)

## Research & Theory

### PPO (Proximal Policy Optimization)

PPO is a policy gradient method that:
- Prevents large policy updates (clipping)
- Balances exploration and exploitation
- Works well with continuous learning
- More stable than vanilla policy gradients

**Key Innovation**: Clipped surrogate objective prevents destructive updates.

### Actor-Critic Architecture

- **Actor**: Learns the policy π(a|s) - what to do
- **Critic**: Learns the value V(s) - how good is the state
- **Advantage**: A(s,a) = Q(s,a) - V(s) - how much better is this action

### Why PPO for Minecraft?

- **Continuous Learning**: No need for episode boundaries
- **Sample Efficiency**: Reuses data via multiple epochs
- **Stability**: Clipping prevents catastrophic forgetting
- **Scalability**: Works with many agents simultaneously

## Contributing

To extend the ML system:

1. **Add New Actions**: Edit `ml_action_space.js`, add to `actions` array
2. **Modify State**: Edit `ml_state_encoder.js`, adjust `encodeState()`
3. **Change Rewards**: Edit reward calculation in `ml_trainer.js` `calculateReward()`
4. **Tune Hyperparameters**: Modify `config` object in `MLTrainer` constructor
5. **New Architectures**: Replace networks in `ml_agent_brain.js` `buildNetworks()`

## License

Part of the Intelligent Village project. Same license applies.

## Acknowledgments

- **TensorFlow.js**: Neural network framework
- **Mineflayer**: Minecraft bot API
- **OpenAI**: PPO algorithm research
- **DeepMind**: Reinforcement learning research

---

**Status**: ✅ **Fully Integrated and Operational**

For questions or issues, check console logs or use `!mlstats` to monitor training progress.
