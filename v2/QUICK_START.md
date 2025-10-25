# Quick Start Guide - MineRL Hub V2

## Prerequisites

- Node.js >= 18.0.0
- Minecraft Server (Spigot/Paper 1.20.1+)
- AgentSensorPlugin (modified for V2)
- CUDA-capable GPU (optional, for faster training)

## Installation

### 1. Install Node.js Dependencies

```bash
cd D:\MineRL\v2
npm install
```

This will install:
- `ws` - WebSocket server/client
- `@tensorflow/tfjs-node-gpu` - TensorFlow with GPU support
- `better-sqlite3` - SQLite database
- `uuid` - UUID generation

### 2. Verify Installation

```bash
node --version  # Should be >= 18.0.0
```

## Configuration

Edit `config/default.js` to customize settings:

```javascript
// Hub port (must match plugin config)
hub: {
    port: 3002,
    authToken: 'mineagent-sensor-2024'
}

// Number of initial agents to spawn
agents: {
    spawnBatchSize: 10,
    spawnDelay: 1000
}
```

## Running the Hub

### Start Hub Server

```bash
cd D:\MineRL\v2
node core/hub.js
```

You should see:

```
======================================================================
CENTRAL INTELLIGENCE HUB - V2
======================================================================
Architecture: Hub-based with plugin NPCs
Max Agents: 1000
Tick Rate: 20/sec
======================================================================

[HUB] Initializing components...
[PLUGIN BRIDGE] WebSocket server listening on port 3002
[HUB] All components initialized
[HUB] System ready - waiting for plugin connection...
```

### Start Minecraft Server

The hub is now waiting for the plugin to connect. Start your Minecraft server with the modified AgentSensorPlugin installed.

When the plugin connects, you'll see:

```
[PLUGIN BRIDGE] Plugin attempting to connect...
[PLUGIN BRIDGE] Plugin authenticated successfully
[PLUGIN BRIDGE] Server info: { version: '1.21.1', ... }
[HUB] Auto-spawning initial agents...
```

## Verifying Operation

### Check Plugin Connection

The hub will show plugin status every 30 seconds:

```
======================================================================
HUB STATUS
======================================================================
Uptime: 120s | Server Tick: 24000 | TPS: 19.8
Plugin: Connected | Auth: Yes
Agents: 10 active / 10 total
Sensor Updates: 2400 | Actions Sent: 240
Messages: ↓2450 ↑250
======================================================================
```

### Monitor Agents

Watch for:
- `[HUB] Agent created:` - New agents spawned
- `[PLUGIN BRIDGE] Requested spawn for` - NPCs requested
- `[HUB] ... is now active` - NPCs confirmed in-game

### In-Game

You should see NPCs spawning in the server with names like:
- `MIN_A3F2_G1` (Miner, Generation 1)
- `LUM_B4K9_G1` (Lumberjack, Generation 1)
- etc.

## Troubleshooting

### Plugin Won't Connect

**Problem**: Hub says "waiting for plugin connection"

**Solutions**:
1. Check plugin config matches hub:
   ```yaml
   # AgentSensorPlugin/config.yml
   websocket:
     port: 3002
     auth-token: "mineagent-sensor-2024"
   ```

2. Check server logs for plugin errors
3. Verify network connectivity (both on localhost)

### Authentication Failed

**Problem**: `[PLUGIN BRIDGE] Authentication failed`

**Solution**: Auth tokens must match in:
- `v2/config/default.js` → `hub.authToken`
- Plugin config → `websocket.auth-token`

### No Agents Spawning

**Problem**: Plugin connects but no NPCs appear

**Solutions**:
1. Check console for spawn errors
2. Verify spawn location is valid
3. Check server permissions
4. Enable plugin debug mode:
   ```yaml
   debug:
     enabled: true
     log-websocket: true
   ```

### GPU Not Detected

**Problem**: TensorFlow not using GPU

**Solutions**:
1. Verify CUDA installation:
   ```bash
   nvidia-smi
   ```

2. Reinstall GPU backend:
   ```bash
   npm install @tensorflow/tfjs-node-gpu
   ```

3. Check TensorFlow logs on startup

## Next Steps

### Add More Agents

Edit `config/default.js`:
```javascript
agents: {
    spawnBatchSize: 50,  // Spawn 50 agents initially
}
```

### Enable ML Training

Once ML systems are migrated:
```javascript
ml: {
    enabled: true,
    useGPU: true
}
```

### Customize Agent Types

Add new agent types:
```javascript
agents: {
    types: [
        'MINING', 'LUMBERJACK', 'CUSTOM_TYPE', ...
    ]
}
```

### Monitor Performance

Check hub status regularly for:
- Sensor update rate (should be ~20/sec per agent)
- TPS (should be close to 20.0)
- Agent activity

## Development Mode

### Auto-Restart on Changes

```bash
npm install -g nodemon
npm run dev
```

### Enable Debug Logging

Edit `config/default.js`:
```javascript
logging: {
    level: 'debug',  // Show all debug messages
    logML: true,
    logActions: true
}
```

## Stopping the Hub

Press `Ctrl+C` to gracefully shutdown:

```
[HUB] Shutting down...
[AGENT MANAGER] Final stats: 10 total agents, 10 active
[PLUGIN BRIDGE] Plugin disconnected
[HUB] Shutdown complete
```

## Architecture Notes

### How It Works

1. **Hub starts** and opens WebSocket server on port 3002
2. **Plugin connects** when Minecraft server starts
3. **Plugin authenticates** with token
4. **Hub spawns agents** by sending spawn requests to plugin
5. **Plugin creates NPCs** and confirms spawn
6. **Plugin streams sensor data** (20/sec per NPC)
7. **Hub processes data** and sends action commands
8. **Plugin executes actions** on NPCs

### Data Flow

```
Minecraft Server (Plugin)          Central Hub (Node.js)
        NPC #1 ────┐
        NPC #2 ────┤
        NPC #N ────┴─→ WebSocket ──→ Agent Manager
                                      ML Trainer
                                      ↓
                       ←─ Actions ───┘
```

### Performance

- **1000+ NPCs**: Supported by hub
- **GPU Training**: All agents trained in batch
- **Low Latency**: Direct WebSocket communication
- **Scalable**: Add more NPCs without client overhead

## Support

For issues:
1. Check logs in `logs/hub.log`
2. Review protocol spec: `docs/PROTOCOL.md`
3. Enable debug logging
4. Check plugin logs on server

## What's Next?

The hub is ready! Next components to implement:
- [ ] ML System migration
- [ ] Personality system integration
- [ ] Memory system integration
- [ ] Dashboard (optional)

See [README.md](README.md) for full architecture overview.
