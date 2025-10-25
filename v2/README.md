# MineRL V2 - Central Intelligence Hub Architecture

## Overview

Version 2 is a complete architectural redesign focused on scalability and GPU utilization. Instead of spawning individual Mineflayer bots, we use a **Central Hub** that manages all agent intelligence while the Spigot plugin handles entity spawning and action execution.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Minecraft Server                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │         AgentSensorPlugin (Java)                  │  │
│  │  • Spawns NPC entities                            │  │
│  │  • Collects sensor data (blocks, entities, etc.)  │  │
│  │  • Executes actions on NPCs                       │  │
│  │  • Manages pathfinding server-side                │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↕ WebSocket
┌─────────────────────────────────────────────────────────┐
│              Central Intelligence Hub (Node.js)          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Agent Manager                                    │  │
│  │  • Manages 1000+ agent states                     │  │
│  │  • Personality & memory systems                   │  │
│  │  • Knowledge sharing                              │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  ML System (GPU-Accelerated)                      │  │
│  │  • Batch inference for all agents                 │  │
│  │  • Shared collective brain                        │  │
│  │  • Personal specialization brains                 │  │
│  │  • PPO training                                   │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Directory Structure

```
v2/
├── core/                   # Core hub functionality
│   ├── hub.js             # Main hub server
│   ├── agent-manager.js   # Agent state management
│   └── plugin-bridge.js   # WebSocket communication with plugin
├── ml/                     # Machine learning systems
│   ├── trainer.js         # PPO training
│   ├── brain.js           # Neural networks
│   ├── state-encoder.js   # State vector encoding
│   └── action-space.js    # Action definitions
├── systems/                # Agent systems
│   ├── personality.js     # Personality traits
│   ├── memory.js          # Episodic memory
│   └── knowledge.js       # Village knowledge sharing
├── config/                 # Configuration
│   └── default.js         # Default configuration
├── plugins/                # Plugin extension specs
│   └── java-specs/        # Java code specifications
├── data/                   # Runtime data
│   ├── models/            # Saved ML models
│   ├── memories/          # SQLite databases
│   └── knowledge/         # Shared knowledge
└── docs/                   # Documentation
    ├── PROTOCOL.md        # WebSocket protocol
    └── PLUGIN_GUIDE.md    # Plugin development guide
```

## Key Benefits

### Massive Scalability
- **1000+ NPCs** managed by single hub process
- No Mineflayer overhead (memory, CPU, network)
- Plugin handles rendering/physics (server-optimized)

### GPU Acceleration
- Batch inference for all agents
- TensorFlow.js GPU support
- Faster training with parallel processing

### Simplified Architecture
- Single point of control
- Centralized logging & monitoring
- Easier debugging

### Better Performance
- No network overhead per bot
- Efficient state encoding
- Optimized action execution

## Quick Start

1. **Install Dependencies**:
   ```bash
   cd v2
   npm install
   ```

2. **Configure**:
   Edit `config/default.js` to match your setup

3. **Start Hub**:
   ```bash
   node core/hub.js
   ```

4. **Install Plugin**:
   - Build the AgentSensorPlugin extension
   - Copy JAR to server plugins folder
   - Configure plugin to connect to hub

## Components

### Central Hub
- Manages all agent intelligence
- Processes sensor data from plugin
- Sends action commands to plugin
- Handles ML training on GPU

### Agent Manager
- Tracks agent states
- Manages personalities
- Handles memory systems
- Coordinates knowledge sharing

### ML System
- State encoding (429 dimensions)
- Action space (216 actions)
- PPO training algorithm
- Shared + personal neural networks

### Plugin Bridge
- WebSocket communication
- Message protocol handling
- Connection management
- Error recovery

## Protocol

See [PROTOCOL.md](docs/PROTOCOL.md) for WebSocket message specifications.

## Migration from V1

V2 is a complete rewrite with a new architecture. Key changes:

| V1 | V2 |
|----|-----|
| Mineflayer bots | NPC entities via plugin |
| Individual bot processes | Central hub process |
| CPU-only training | GPU-accelerated training |
| ~10 concurrent bots | 1000+ concurrent NPCs |
| Network overhead | Direct plugin communication |

## Development Status

- [x] Architecture design
- [ ] Core hub server
- [ ] Agent manager
- [ ] ML system migration
- [ ] Plugin bridge
- [ ] Plugin extension (Java)
- [ ] Testing & optimization

## License

Same as V1 - Internal use only
