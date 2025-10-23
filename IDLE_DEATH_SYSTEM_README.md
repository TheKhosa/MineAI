# Idle Punishment & Death Threshold System

## Overview

A complete idle punishment and automatic death system has been implemented to ensure agents actively learn and improve. Agents who fail to take meaningful actions or whose cumulative rewards drop below -20 are automatically terminated and replaced with a new generation.

## System Components

### 1. Idle Penalty System

**Location**: `config.js:219-222`, `ml_trainer.js:857-884`, `server.js:1335-1351`

**How it works:**
- Tracks whether agents take meaningful actions (movement, inventory changes, health changes)
- Applies a penalty of **-2.0 reward** every **3 seconds** if agent is idle for more than **6 seconds**
- Idle time resets when agent performs any meaningful action

**Configuration** (`config.js`):
```javascript
features: {
    enableIdlePenalty: true,           // Enable/disable idle penalties
    idlePenaltyAmount: -2.0,           // Penalty per idle check (-2 reward)
    idleCheckInterval: 3000,           // Check every 3 seconds
    idleThreshold: 6000,               // Consider idle after 6 seconds
}
```

**Benefits:**
- Encourages continuous exploration and learning
- Prevents agents from getting stuck in passive states
- Creates urgency to discover effective strategies

### 2. Cumulative Reward Tracking

**Location**: `ml_trainer.js:577-583`

**How it works:**
- Every step, the agent's instant reward is added to `bot.mlCumulativeReward`
- This creates a running total of all rewards earned/lost during the agent's lifetime
- Cumulative reward is displayed in occasional debug logs

**Example:**
```
[ML REWARD] MinerSteve: +5.20 | Cumulative: +42.80 (pickup:+5.0, move:+0.20)
[ML REWARD] HunterDan: -2.00 | Cumulative: -18.50 (idle:-2.0)
```

### 3. Death Threshold System

**Location**: `config.js:231-234`, `server.js:1354-1383`

**How it works:**
- Every **5 seconds**, checks if `bot.mlCumulativeReward < -20.0`
- If true, agent is immediately terminated
- Death event triggers normal offspring spawning with genetic evolution
- New generation inherits from fittest available parent

**Configuration** (`config.js`):
```javascript
features: {
    enableRewardThresholdDeath: true,  // Enable death threshold
    deathRewardThreshold: -20.0,       // Death at cumulative reward < -20
    checkDeathInterval: 5000           // Check every 5 seconds
}
```

**Death Logs:**
```
[DEATH THRESHOLD] HunterDan cumulative reward (-22.40) dropped below -20
[DEATH THRESHOLD] HunterDan is being terminated - not learning effectively
```

## Performance Characteristics

### Idle-Only Agent
- **Penalty per check**: -2.0 (every 3 seconds)
- **Death threshold**: -20.0
- **Time to death**: ~33 seconds (11 idle checks)
- **Result**: Fast culling of non-learning agents

### Active Agent with Mixed Performance
- **Good actions**: +5 to +15 rewards (pickup, exploration, crafting)
- **Idle periods**: -2 per check
- **Survival**: As long as positive actions outweigh idle penalties
- **Result**: Agents must balance exploration with productivity

## Example Scenarios

### Scenario 1: Completely Idle Agent
```
[3.0s]  Idle: -2.0 | Cumulative: -2.00
[6.0s]  Idle: -2.0 | Cumulative: -4.00
[9.0s]  Idle: -2.0 | Cumulative: -6.00
...
[30.0s] Idle: -2.0 | Cumulative: -20.00
[33.0s] Idle: -2.0 | Cumulative: -22.00
💀 DEATH - Agent terminated after 33 seconds
```

### Scenario 2: Active Learning Agent
```
[3.0s]  ✓ Pickup items: +5.0 | Cumulative: +5.00
[6.0s]  × Idle: -2.0 | Cumulative: +3.00
[9.0s]  ✓ New chunk: +15.0 | Cumulative: +18.00
[12.0s] × Idle: -2.0 | Cumulative: +16.00
[18.0s] ✓ Crafted tool: +10.0 | Cumulative: +26.00
[21.0s] × Idle: -2.0 | Cumulative: +24.00
✓ SURVIVES - Positive actions outweigh idle time
```

### Scenario 3: Poor Performance
```
[3.0s]  ✓ Movement: +0.5 | Cumulative: +0.50
[6.0s]  × Idle: -2.0 | Cumulative: -1.50
[9.0s]  × Damage: -4.0 | Cumulative: -5.50
[12.0s] × Idle: -2.0 | Cumulative: -7.50
[15.0s] × Idle: -2.0 | Cumulative: -9.50
[18.0s] × Idle: -2.0 | Cumulative: -11.50
[21.0s] × Idle: -2.0 | Cumulative: -13.50
[24.0s] × Idle: -2.0 | Cumulative: -15.50
[27.0s] × Idle: -2.0 | Cumulative: -17.50
[30.0s] × Idle: -2.0 | Cumulative: -19.50
[33.0s] × Stuck: -3.0 | Cumulative: -22.50
💀 DEATH - Poor strategy, unable to recover
```

## Integration with Genetic Evolution

When an agent dies from reward threshold:

1. **Fitness Calculation**: Final fitness score includes survival time, achievements, and cumulative reward
2. **Parent Selection**: Tournament selection picks fit parents from current population
3. **Offspring Spawning**: New agent inherits:
   - Personal brain weights (with 10% mutation)
   - Personality traits (with 20% mutation)
   - Generation number incremented
4. **Population Management**: Maintains target population of 15-20 agents

## Monitoring & Debugging

### Log Messages to Watch

**Idle Warnings** (every 30s when idle):
```
[IDLE] MinerSteve has been idle for 30s! Reward: -18.5
```

**Cumulative Reward Tracking** (2% of steps):
```
[ML REWARD] BuilderBob: +2.5 | Cumulative: +45.20 (build:+2.0, move:+0.5)
```

**Death Threshold Reached**:
```
[DEATH THRESHOLD] HunterDan cumulative reward (-22.40) dropped below -20
[DEATH THRESHOLD] HunterDan is being terminated - not learning effectively
```

**Offspring Spawning**:
```
[SPAWN] Creating HunterDan (Gen 2) from HunterAlex
[ML TRAINER] 🧬 Cloning parent's personal brain for HunterDan (Gen 2)
```

## Testing

Run the test script to verify system behavior:

```bash
node test_idle_death_system.js
```

This simulates:
- Pure idle agent (dies in ~33 seconds)
- Mixed performance agent (survives with good actions)
- Reward calculation accuracy

## Configuration Tuning

### More Forgiving (Slower Death)
```javascript
idlePenaltyAmount: -1.0,        // Gentler penalties
deathRewardThreshold: -50.0,    // More tolerance
```

### More Aggressive (Faster Death)
```javascript
idlePenaltyAmount: -5.0,        // Harsh penalties
deathRewardThreshold: -10.0,    // Quick termination
```

### Current Settings (Balanced)
```javascript
idlePenaltyAmount: -2.0,        // Moderate pressure
deathRewardThreshold: -20.0,    // ~30 seconds idle tolerance
```

## Files Modified

1. **config.js** - Added idle penalty and death threshold configuration
2. **ml_trainer.js** - Added cumulative reward tracking and idle penalty logic
3. **server.js** - Added death threshold checking in behavior loop
4. **test_idle_death_system.js** - Test script for system verification

## Benefits

✅ **Fast Failure Detection**: Idle agents culled in ~30 seconds
✅ **Genetic Pressure**: Only effective strategies survive and reproduce
✅ **Population Quality**: Continuous improvement through natural selection
✅ **Prevents Stagnation**: Forces exploration and learning
✅ **Configurable**: Easy to tune difficulty via config.js

## Troubleshooting

**Problem**: Agents dying too fast
**Solution**: Reduce `idlePenaltyAmount` or lower `deathRewardThreshold`

**Problem**: Idle agents surviving too long
**Solution**: Increase `idlePenaltyAmount` or raise `deathRewardThreshold`

**Problem**: Not seeing death threshold messages
**Solution**: Verify `enableRewardThresholdDeath: true` in config.js

**Problem**: Cumulative reward not showing in logs
**Solution**: Wait for random 2% sample logs or add manual logging

## Future Enhancements

- [ ] Dashboard visualization of cumulative rewards
- [ ] Death cause analytics (idle vs combat vs damage)
- [ ] Adaptive threshold based on population performance
- [ ] Lineage tracking with death reasons
- [ ] Warning system before threshold death
