# MineFlayer + Spigot Integration Plan

## Overview
Combine MineFlayer client API with Spigot server-side sensor data to create a powerful hybrid action space for AI agents.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Node.js Server                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          MineFlayer Bot (Client-Side)                  │ │
│  │  • Movement, combat, crafting                          │ │
│  │  • Inventory management                                │ │
│  │  • Chat, interactions                                  │ │
│  └───────────────────┬────────────────────────────────────┘ │
│                      │                                        │
│                      │ WebSocket/HTTP                         │
│                      │                                        │
│  ┌───────────────────▼────────────────────────────────────┐ │
│  │         Enhanced Sensor Integration Layer              │ │
│  │  • Real-time server sensor data                        │ │
│  │  • Advanced perception (mob AI, chunk states)          │ │
│  │  • World state beyond client view distance            │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Plugin API (WebSocket)
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Minecraft Server (Spigot)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │            AgentSensorPlugin                           │ │
│  │  • Block metadata (hardness, flammability, blast res) │ │
│  │  • Entity tracking (health, AI state, targets)        │ │
│  │  • Mob AI goals and pathfinding                       │ │
│  │  • Weather, time, chunk loading states                │ │
│  │  • Dropped items with age tracking                    │ │
│  │  • Advanced block states (chests, furnaces, etc.)     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Expanded Action Space

### Current (216 Actions - MineFlayer Only)
1. Inventory Management (15) - Toss, sort, equip, swap
2. Advanced Crafting (20) - Tools, weapons, armor, smelting
3. Container Operations (12) - Deposit/withdraw, organize chests
4. Enchanting & Brewing (10) - Enchant, brew, anvil
5. Trading (8) - Villager interactions
6. Agriculture (15) - Plant, harvest, breed animals
7. Redstone (10) - Levers, buttons, mechanisms
8. Bed & Time (5) - Sleep, shelter
9. Fine Motor Combat (12) - Critical hits, blocking, kiting
10. Advanced Navigation (15) - Swim, climb, parkour, bridge
11. Resource Optimization (10) - Tool selection, mining patterns
12. Communication (8) - Drop signals, markers

### NEW - Server-Enhanced Actions (60+ additional)

#### 13. **Tactical Combat** (12 actions, 216-227)
Using mob AI sensor data for informed combat decisions:
- **RETREAT_FROM_MOB_GROUP** - Detect multiple hostile mobs via sensor
- **FLANK_TARGET** - Use mob AI pathfinding data to predict movement
- **INTERRUPT_MOB_ABILITY** - Attack mobs preparing special abilities
- **PRIORITIZE_WEAK_ENEMY** - Target lowest health enemy from sensor data
- **EXPLOIT_MOB_COOLDOWN** - Attack during mob ability cooldowns
- **USE_TERRAIN_ADVANTAGE** - Position based on mob pathfinding constraints
- **KITE_TO_SAFE_ZONE** - Navigate away from multiple hostile AI targets
- **AMBUSH_PATROL_ROUTE** - Use mob AI goal tracking to predict paths
- **COUNTER_ATTACK_PATTERN** - Learn and counter mob attack patterns
- **FLEE_LOSING_BATTLE** - Calculate battle outcome from health/damage data
- **RESCUE_ALLY** - Detect agents being attacked via sensor
- **COORDINATE_FOCUS_FIRE** - Target same enemy with nearby agents

#### 14. **Advanced Block Interactions** (10 actions, 228-237)
Using block metadata from sensors:
- **MINE_WITH_FORTUNE** - Target blocks with fortune bonus (detect from metadata)
- **AVOID_EXPLOSIVE_BLOCKS** - Detect TNT, creepers near valuable blocks
- **SILK_TOUCH_HARVEST** - Use silk touch on specific blocks (ice, glass, ores)
- **OPTIMIZE_BLAST_MINING** - Place TNT based on blast resistance data
- **HARVEST_MATURE_CROPS_ONLY** - Use block state data to find ripe crops
- **TARGET_SPAWNER_BLOCKS** - Detect and navigate to mob spawners
- **AVOID_FIRE_HAZARD** - Detect flammable block clusters
- **MINE_LIGHTWEIGHT_FIRST** - Sort by hardness for efficient mining
- **DETECT_ORE_VEINS** - Use sensor radius to find connected ore blocks
- **PLACE_LIGHT_SOURCES** - Detect light levels below spawn threshold

#### 15. **Chunk Management** (8 actions, 238-245)
Using chunk sensor for world awareness:
- **CLAIM_TERRITORY** - Mark high-value chunks
- **DETECT_PLAYER_BASES** - Find chunks with high tile entity density
- **SCOUT_UNLOADED_AREAS** - Navigate to chunk borders
- **MONITOR_SPAWN_CHUNKS** - Track entity counts in spawn areas
- **OPTIMIZE_CHUNK_LOADING** - Move to keep important chunks loaded
- **DETECT_LAG_ZONES** - Avoid chunks with excessive entities
- **COORDINATE_EXPLORATION** - Share chunk discovery with other agents
- **BUILD_IN_SAFE_CHUNKS** - Select low-entity chunks for building

#### 16. **Item Economy** (10 actions, 246-255)
Using dropped item sensor:
- **COLLECT_EXPIRED_ITEMS** - Prioritize items about to despawn (ticksLived > 5400)
- **TRADE_ITEM_SURPLUS** - Drop items for other agents to collect
- **SCAVENGE_BATTLEFIELDS** - Detect dropped loot from combat
- **ITEM_DUPLICATION_EXPLOIT** - Detect item duplication bugs (same UUID)
- **HOARD_VALUABLES** - Collect diamonds, emeralds, netherite
- **DISCARD_TRASH_ITEMS** - Drop low-value items when inventory full
- **CREATE_ITEM_CACHE** - Drop items in hidden location for later
- **STEAL_FROM_OTHERS** - Collect items dropped by other players
- **BAIT_WITH_ITEMS** - Drop items to lure players/mobs
- **ITEM_TRAP_DETECTION** - Avoid suspiciously placed item stacks

#### 17. **Weather & Time Strategies** (8 actions, 256-263)
Using weather sensor:
- **SEEK_SHELTER_RAIN** - Find cover when raining (prevent skeleton attacks)
- **FISH_IN_RAIN** - Fishing is more effective in rain
- **CHARGE_LIGHTNING_ROD** - Use thunderstorms for charged creepers
- **SLEEP_AT_NIGHT** - Use time sensor to sleep before monsters
- **HUNT_AT_NIGHT** - Farm mobs during darkness
- **FARM_IN_DAYLIGHT** - Maximize crop growth during day
- **PREDICT_WEATHER_CHANGE** - Use weather duration to plan activities
- **EXPLOIT_WEATHER_MECHANICS** - Use rain for faster ice farming, etc.

#### 18. **Social Coordination** (12 actions, 264-275)
Enhanced with server-side entity tracking:
- **FORM_HUNTING_PARTY** - Detect nearby agents and coordinate
- **DIVIDE_RESOURCES** - Split loot based on contribution
- **ESTABLISH_ROLES** - Assign tasks (mining, farming, combat) to agents
- **CALL_FOR_BACKUP** - Signal danger when outnumbered
- **SHARE_DISCOVERED_LOCATIONS** - Broadcast coordinates of valuables
- **TRADE_SPECIALIZED_ITEMS** - Exchange based on role specialization
- **COORDINATE_BASE_DEFENSE** - Detect intruders and respond as group
- **ESTABLISH_TERRITORY** - Mark and defend clan boundaries
- **PUNISH_TRAITORS** - Detect and exile agents breaking rules
- **REWARD_COOPERATION** - Give items to helpful agents
- **FORM_ALLIANCES** - Create persistent agent relationships
- **DECLARE_WAR** - Coordinate attacks on rival factions

## Communication Protocol

### WebSocket API (Plugin → Node.js)

#### Connection
```javascript
const ws = new WebSocket('ws://localhost:3002/sensors');
```

#### Message Format
```json
{
  "type": "sensor_update",
  "botName": "MinerSteve",
  "timestamp": 1634567890000,
  "data": {
    "location": {
      "x": 100.5,
      "y": 64.0,
      "z": -200.3,
      "world": "world"
    },
    "blocks": [
      {
        "x": 100, "y": 64, "z": -200,
        "type": "DIAMOND_ORE",
        "lightLevel": 0,
        "hardness": 3.0,
        "blastResistance": 3.0,
        "isPassable": false,
        "requiresTool": true,
        "toolType": "PICKAXE",
        "minToolTier": "IRON"
      }
    ],
    "entities": [
      {
        "uuid": "abc-123",
        "type": "ZOMBIE",
        "x": 105.0, "y": 64.0, "z": -205.0,
        "health": 15.0,
        "maxHealth": 20.0,
        "isHostile": true,
        "aiState": "ATTACKING",
        "aiGoal": "MELEE_ATTACK",
        "targetUuid": "bot-uuid-456",
        "pathfindingTarget": {"x": 100, "y": 64, "z": -200}
      }
    ],
    "mobAI": [
      {
        "entityUuid": "abc-123",
        "currentGoal": "MELEE_ATTACK",
        "priority": 2,
        "targetUuid": "bot-uuid-456",
        "cooldownTicks": 0,
        "canAttack": true
      }
    ],
    "weather": {
      "isRaining": false,
      "isThundering": false,
      "rainTime": 0,
      "thunderTime": 0,
      "timeOfDay": "DAY",
      "worldTime": 6000
    },
    "chunks": [
      {
        "chunkX": 6,
        "chunkZ": -13,
        "isLoaded": true,
        "entityCount": 12,
        "tileEntityCount": 3,
        "hasSpawner": false
      }
    ],
    "items": [
      {
        "uuid": "item-789",
        "itemType": "DIAMOND",
        "amount": 1,
        "x": 102.0, "y": 64.0, "z": -198.0,
        "ticksLived": 1200
      }
    ]
  }
}
```

## Implementation Steps

### Phase 1: WebSocket Communication Layer (Week 1)

1. **Add WebSocket to AgentSensorPlugin**
   - Create `WebSocketServer.java`
   - Bind to port 3002
   - Implement authentication
   - Stream sensor data every 2 seconds

2. **Create Node.js WebSocket Client**
   - New file: `plugin_sensor_client.js`
   - Connect to plugin WebSocket
   - Parse sensor data into usable format
   - Cache data for ML state encoder

3. **Integrate with ML System**
   - Expand `ml_state_encoder.js` to include sensor data
   - Add sensor features to state vector (429 → 600+ dimensions)

### Phase 2: Enhanced Action Space (Week 2)

1. **Create New Action Modules**
   - `actions/tactical_combat.js` (12 actions)
   - `actions/advanced_blocks.js` (10 actions)
   - `actions/chunk_management.js` (8 actions)
   - `actions/item_economy.js` (10 actions)
   - `actions/weather_strategies.js` (8 actions)
   - `actions/social_coordination.js` (12 actions)

2. **Expand `ml_action_space.js`**
   - Register new action modules
   - Update action count: 216 → 276 actions
   - Add sensor data to action context

3. **Update Neural Network**
   - Expand output layer in `ml_agent_brain.js`: 216 → 276
   - Retrain with new action space

### Phase 3: Smart Action Selection (Week 3)

1. **Create Action Context System**
   - New file: `action_context_builder.js`
   - Combines MineFlayer state + Plugin sensor data
   - Provides rich context for each action

2. **Implement Action Preconditions**
   - Each action checks if sensor data is available
   - Fallback to MineFlayer-only actions if plugin offline
   - Smart action filtering based on context

3. **Reward Shaping for Sensor-Enhanced Actions**
   - Bonus rewards for using advanced tactics
   - Penalize ignoring critical sensor data (e.g., not fleeing from mob groups)

### Phase 4: Testing & Optimization (Week 4)

1. **Create Test Scenarios**
   - Combat against multiple mobs (use tactical actions)
   - Resource collection with expired items
   - Social coordination with multiple agents
   - Weather-based strategy adaptation

2. **Performance Optimization**
   - Cache sensor data efficiently
   - Reduce WebSocket message frequency if needed
   - Optimize action selection with sensor context

3. **Documentation & Examples**
   - Update README with sensor integration
   - Create example scenarios
   - Document new action space

## Expected Benefits

### Improved Decision Making
- **Combat**: 50% higher survival rate with mob AI awareness
- **Resource Collection**: 30% more efficient item pickup
- **Exploration**: 40% better chunk coverage with coordination
- **Social Dynamics**: Emergent clan behavior and cooperation

### Emergent Behaviors
- **Tactical Retreats**: Agents detect overwhelming force and flee together
- **Resource Trading**: Agents specialize and trade surplus items
- **Base Building**: Coordinate to claim and defend territory
- **Weather Adaptation**: Different strategies for rain/night/thunder
- **Mob Farming**: Create efficient spawn-and-kill loops

### Performance Metrics
- **Action Space**: 216 → 276 actions (28% increase)
- **State Vector**: 429 → 600+ dimensions (40% increase)
- **Perception Range**: 16 blocks → 32 blocks (server sensor radius)
- **Decision Quality**: +60% (estimated) with server-side data

## Configuration

### `config.js` Updates

```javascript
module.exports = {
    // ... existing config ...

    // Plugin integration
    plugin: {
        enabled: true,
        host: 'localhost',
        port: 3002,
        reconnectInterval: 5000,
        sensorUpdateInterval: 2000, // Match plugin update rate
        authToken: 'shared-secret-token'
    },

    // Enhanced ML with sensor data
    ml: {
        enabled: true,
        actionCount: 276, // Expanded from 216
        stateDimensions: 620, // Expanded from 429
        useSensorFeatures: true,
        sensorFeatureWeight: 0.3 // How much to weight sensor vs MineFlayer data
    },

    // Action filters
    actions: {
        requireSensorData: false, // Fallback if plugin offline
        tacticalCombatEnabled: true,
        socialCoordinationEnabled: true,
        weatherStrategiesEnabled: true
    }
};
```

## File Structure

```
D:\MineRL\
├── plugin_sensor_client.js          # NEW - WebSocket client for plugin
├── action_context_builder.js        # NEW - Combines MineFlayer + sensor data
├── ml_state_encoder.js              # MODIFIED - Add sensor features
├── ml_action_space.js               # MODIFIED - Register new actions (276)
├── ml_agent_brain.js                # MODIFIED - Expand output layer
├── server.js                        # MODIFIED - Integrate sensor client
├── config.js                        # MODIFIED - Add plugin config
├── actions/
│   ├── tactical_combat.js           # NEW - 12 combat actions
│   ├── advanced_blocks.js           # NEW - 10 block interaction actions
│   ├── chunk_management.js          # NEW - 8 chunk awareness actions
│   ├── item_economy.js              # NEW - 10 item trading actions
│   ├── weather_strategies.js        # NEW - 8 weather-based actions
│   ├── social_coordination.js       # NEW - 12 social actions
│   └── index.js                     # MODIFIED - Export new modules
└── AgentSensorPlugin/
    └── src/main/java/com/mineagents/sensors/
        ├── websocket/
        │   ├── WebSocketServer.java         # NEW - WebSocket server
        │   ├── SensorBroadcaster.java       # NEW - Periodic broadcasts
        │   └── WebSocketAuthenticator.java  # NEW - Token auth
        └── api/
            └── SensorAPI.java               # MODIFIED - Add WebSocket methods
```

## Next Steps

1. ✅ Create integration plan (this document)
2. ⏳ Implement WebSocket server in plugin
3. ⏳ Create Node.js WebSocket client
4. ⏳ Expand ML state encoder with sensor features
5. ⏳ Implement 60 new sensor-enhanced actions
6. ⏳ Test and optimize
7. ⏳ Document and deploy

## Questions to Address

1. **Latency**: How much delay does WebSocket add? (Target: <50ms)
2. **Scalability**: Can plugin handle 100+ WebSocket connections?
3. **Fallback**: What happens if plugin crashes? (Use MineFlayer-only mode)
4. **Security**: How to prevent unauthorized sensor access? (Token authentication)
5. **Bandwidth**: How much data per second? (Estimate: ~10KB/s per agent)
