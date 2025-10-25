# WebSocket Protocol Specification

Communication protocol between the Spigot Plugin (Java) and Central Hub (Node.js).

## Connection

- **URL**: `ws://localhost:3002`
- **Auth**: Token-based authentication
- **Format**: JSON messages

## Message Flow

```
Plugin                          Hub
  |                              |
  |--- auth_request -----------→|
  |←-- auth_success -------------|
  |                              |
  |--- sensor_update ----------→|
  |←-- action_command -----------|
  |                              |
  |--- server_tick ------------→|
  |--- checkpoint -------------→|
  |--- evolution --------------→|
```

## Messages: Plugin → Hub

### 1. Authentication Request
```json
{
  "type": "auth_request",
  "token": "mineagent-sensor-2024",
  "serverInfo": {
    "version": "1.21.1",
    "playerCount": 0,
    "tps": 20.0
  }
}
```

### 2. Sensor Update
```json
{
  "type": "sensor_update",
  "agentName": "MinerSteve",
  "timestamp": 1698765432000,
  "tick": 123456,
  "data": {
    "position": {
      "x": 10.5,
      "y": 64.0,
      "z": -5.5,
      "yaw": 45.0,
      "pitch": 0.0,
      "world": "survival"
    },
    "health": 20.0,
    "maxHealth": 20.0,
    "food": 18,
    "maxFood": 20,
    "saturation": 5.0,
    "experience": 42,
    "level": 3,
    "blocks": {
      "nearby": [
        {
          "type": "STONE",
          "x": 10,
          "y": 63,
          "z": -5,
          "distance": 1.2
        },
        {
          "type": "IRON_ORE",
          "x": 12,
          "y": 64,
          "z": -4,
          "distance": 2.5
        }
      ],
      "radius": 32
    },
    "entities": {
      "nearby": [
        {
          "type": "ZOMBIE",
          "uuid": "abc123",
          "x": 15.0,
          "y": 64.0,
          "z": -3.0,
          "distance": 5.5,
          "health": 20.0
        },
        {
          "type": "PLAYER",
          "uuid": "def456",
          "name": "FarmerBob",
          "x": 8.0,
          "y": 64.0,
          "z": -7.0,
          "distance": 3.2
        }
      ],
      "radius": 32
    },
    "inventory": {
      "items": [
        {
          "type": "IRON_PICKAXE",
          "slot": 0,
          "count": 1,
          "durability": 245,
          "maxDurability": 250
        },
        {
          "type": "COAL",
          "slot": 1,
          "count": 32
        }
      ],
      "helmet": null,
      "chestplate": null,
      "leggings": null,
      "boots": null,
      "offhand": null
    },
    "effects": [
      {
        "type": "SPEED",
        "amplifier": 1,
        "duration": 600
      }
    ],
    "biome": "PLAINS",
    "lightLevel": 15,
    "isOnGround": true,
    "isInWater": false,
    "isInLava": false
  }
}
```

### 3. Server Tick
```json
{
  "type": "server_tick",
  "tick": 123456,
  "timestamp": 1698765432000,
  "tps": 19.8,
  "onlinePlayers": 5,
  "loadedChunks": 256
}
```

### 4. Checkpoint Event
```json
{
  "type": "checkpoint",
  "tick": 24000,
  "timestamp": 1698765432000,
  "ticksSinceLastCheckpoint": 6000
}
```

### 5. Evolution Event
```json
{
  "type": "evolution",
  "tick": 48000,
  "timestamp": 1698765432000,
  "ticksSinceLastEvolution": 12000
}
```

### 6. Agent Death
```json
{
  "type": "agent_death",
  "agentName": "MinerSteve",
  "timestamp": 1698765432000,
  "cause": "ENTITY_ATTACK",
  "killer": {
    "type": "ZOMBIE",
    "uuid": "abc123"
  },
  "location": {
    "x": 10.5,
    "y": 64.0,
    "z": -5.5,
    "world": "survival"
  }
}
```

### 7. Agent Spawn Confirm
```json
{
  "type": "spawn_confirm",
  "agentName": "MinerSteve",
  "timestamp": 1698765432000,
  "entityUUID": "xyz789",
  "location": {
    "x": 0.0,
    "y": 64.0,
    "z": 0.0,
    "world": "survival"
  }
}
```

## Messages: Hub → Plugin

### 1. Authentication Success
```json
{
  "type": "auth_success",
  "timestamp": 1698765432000,
  "hubVersion": "2.0.0"
}
```

### 2. Authentication Failed
```json
{
  "type": "auth_failed",
  "reason": "Invalid token",
  "timestamp": 1698765432000
}
```

### 3. Spawn Agent
```json
{
  "type": "spawn_agent",
  "agentName": "MinerSteve",
  "agentType": "MINING",
  "location": {
    "world": "survival",
    "x": 0.0,
    "y": 64.0,
    "z": 0.0,
    "yaw": 0.0
  },
  "skin": {
    "texture": "ewogICJ0aW1lc3RhbXAiIDog...",
    "signature": "..."
  }
}
```

### 4. Action Command
```json
{
  "type": "action",
  "agentName": "MinerSteve",
  "timestamp": 1698765432000,
  "action": {
    "type": "move",
    "params": {
      "x": 10.0,
      "y": 64.0,
      "z": -5.0
    }
  }
}
```

**Action Types**:

#### Movement
```json
{"type": "move", "params": {"x": 10, "y": 64, "z": -5}}
{"type": "jump", "params": {}}
{"type": "sneak", "params": {"enable": true}}
{"type": "sprint", "params": {"enable": true}}
{"type": "look", "params": {"yaw": 45.0, "pitch": 0.0}}
```

#### Mining
```json
{"type": "dig", "params": {"x": 10, "y": 63, "z": -5}}
{"type": "place_block", "params": {"x": 10, "y": 63, "z": -5, "type": "STONE"}}
```

#### Combat
```json
{"type": "attack", "params": {"entityUUID": "abc123"}}
{"type": "use_shield", "params": {"enable": true}}
```

#### Inventory
```json
{"type": "equip", "params": {"slot": 0}}
{"type": "drop_item", "params": {"slot": 1, "count": 16}}
{"type": "pickup_item", "params": {"entityUUID": "item123"}}
{"type": "craft", "params": {"recipe": "IRON_PICKAXE"}}
```

#### Interaction
```json
{"type": "use_item", "params": {"hand": "MAIN"}}
{"type": "interact_entity", "params": {"entityUUID": "abc123"}}
{"type": "interact_block", "params": {"x": 10, "y": 64, "z": -5}}
```

#### Communication
```json
{"type": "chat", "params": {"message": "Hello, world!"}}
```

### 5. Remove Agent
```json
{
  "type": "remove_agent",
  "agentName": "MinerSteve",
  "reason": "death",
  "timestamp": 1698765432000
}
```

### 6. Heartbeat
```json
{
  "type": "heartbeat",
  "timestamp": 1698765432000
}
```

### 7. Save Request
```json
{
  "type": "save_request",
  "timestamp": 1698765432000
}
```

## Error Handling

### Error Message
```json
{
  "type": "error",
  "code": "INVALID_ACTION",
  "message": "Action type 'fly' is not valid",
  "agentName": "MinerSteve",
  "timestamp": 1698765432000
}
```

**Error Codes**:
- `INVALID_TOKEN` - Authentication failed
- `AGENT_NOT_FOUND` - Agent doesn't exist
- `INVALID_ACTION` - Unknown action type
- `ACTION_FAILED` - Action execution failed
- `SPAWN_FAILED` - Could not spawn NPC
- `RATE_LIMIT` - Too many requests

## Connection Lifecycle

1. **Connect**: Plugin connects to hub WebSocket
2. **Authenticate**: Plugin sends auth_request
3. **Active**:
   - Plugin streams sensor_update (20/sec per agent)
   - Hub sends action commands
   - Server events (tick, checkpoint, evolution)
4. **Disconnect**: Clean shutdown or error

## Performance Notes

- **Update Rate**: 20 sensor updates/second per agent (1 per Minecraft tick)
- **Batch Actions**: Hub can send multiple actions per agent per tick
- **Compression**: Consider enabling WebSocket compression for 100+ agents
- **Heartbeat**: 30-second intervals to detect stale connections
