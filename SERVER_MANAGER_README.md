# Minecraft Server Manager

Automated Minecraft server management agent that handles plugin updates from TeamCity CI.

## Features

- **Auto-downloads** latest AgentSensorPlugin from TeamCity
- **Manages server lifecycle** (start, stop, restart)
- **Monitors plugin health** and server status
- **Periodic updates** checks TeamCity every 5 minutes
- **Old version cleanup** removes outdated plugin JARs
- **Interactive console** send commands to server

## Quick Start

### 1. Prerequisites

Ensure you have:
- Java 17+ installed
- Spigot 1.21.10 server JAR at `D:\MCServer\Server\spigot-1.21.10.jar`
- Node.js installed
- TeamCity access (already configured)

### 2. Start the System

```bash
# Option 1: Use the batch file
start_local_system.bat

# Option 2: Run directly
node minecraft_server_manager.js
```

### 3. Start Agents

Once the server is running, start the agents in a separate terminal:

```bash
node server.js
```

## Configuration

The server manager can be configured in `minecraft_server_manager.js`:

```javascript
const manager = new MinecraftServerManager({
    serverDir: 'D:\\MCServer\\Server',
    serverJar: 'spigot-1.21.10.jar',
    pluginsDir: 'D:\\MCServer\\Server\\plugins',
    javaPath: 'java',
    javaArgs: ['-Xmx4G', '-Xms2G'],
    checkInterval: 300000 // 5 minutes
});
```

### Agent Configuration

Agents are now configured to connect to `localhost` in `config.js`:

```javascript
server: {
    host: 'localhost',
    port: 25565
},

plugin: {
    enabled: true,
    host: 'localhost',
    port: 3002,
    authToken: 'mineagent-sensor-2024'
}
```

## Server Manager Commands

While the manager is running, you can type commands:

- `status` - Show manager and server status
- `update` - Force plugin update check
- `restart` - Restart the Minecraft server
- Any other text - Send as server command (e.g., `list`, `op PlayerName`)

## How It Works

### Startup Flow

```
1. Server Manager starts
   ↓
2. Checks TeamCity for latest plugin build
   ↓
3. Downloads AgentSensorPlugin-{buildNumber}.jar
   ↓
4. Removes old plugin versions
   ↓
5. Starts Spigot server with plugin
   ↓
6. Plugin loads and starts WebSocket server (port 3002)
   ↓
7. Agents connect to localhost:25565
   ↓
8. Agents connect to WebSocket for sensor data
   ↓
9. System operational ✓
```

### Update Flow

```
Every 5 minutes:
   ↓
1. Check TeamCity for new builds
   ↓
2. Compare with current version
   ↓
3. If newer: Download new plugin
   ↓
4. Remove old versions
   ↓
5. Restart server with new plugin
   ↓
6. Agents automatically reconnect
```

## Directory Structure

```
D:\MCServer\Server\
├── spigot-1.21.10.jar          # Minecraft server
├── eula.txt                     # Minecraft EULA (must be accepted)
├── server.properties            # Server configuration
├── plugins/
│   └── AgentSensorPlugin-{N}.jar   # Auto-downloaded from TeamCity
├── world/                       # World data
└── logs/                        # Server logs

D:\MineRL\
├── minecraft_server_manager.js  # Server manager agent
├── start_local_system.bat       # Startup script
├── server.js                    # Agent system (start separately)
├── config.js                    # Agent configuration (uses localhost)
└── plugin_sensor_client.js      # WebSocket client for plugin
```

## Troubleshooting

### Server won't start

**Problem**: `Server JAR not found`

**Solution**:
```bash
# Check if spigot JAR exists
dir D:\MCServer\Server\spigot-1.21.10.jar

# Download Spigot if missing
# Visit https://getbukkit.org/download/spigot
```

**Problem**: `EULA not accepted`

**Solution**:
```bash
# Edit D:\MCServer\Server\eula.txt
# Change: eula=false → eula=true
```

### Plugin won't load

**Problem**: `Invalid plugin.yml`

**Solution**: Plugin is being updated. Wait for next TeamCity build.

**Problem**: `Could not load plugin`

**Solution**:
```bash
# Check plugin exists
dir D:\MCServer\Server\plugins\AgentSensorPlugin-*.jar

# Check server logs
type D:\MCServer\Server\logs\latest.log
```

### Agents won't connect

**Problem**: `Connection refused`

**Solution**:
```bash
# 1. Check server is running
#    Look for "Done! For help, type 'help'"

# 2. Check port is open
netstat -an | findstr :25565

# 3. Verify config.js points to localhost
#    server.host should be 'localhost'
```

### WebSocket errors

**Problem**: `WebSocket connection failed`

**Solution**:
```bash
# 1. Check plugin loaded
#    Server console should show:
#    "[AgentSensorPlugin] WebSocket Server started on port 3002"

# 2. Check port is open
netstat -an | findstr :3002

# 3. Verify config.js plugin settings
#    plugin.host should be 'localhost'
#    plugin.port should be 3002
```

## Development

### Testing Plugin Updates

Force a plugin update:

```bash
# In server manager console, type:
update
```

### Viewing Build Status

Check latest TeamCity build:
```
http://145.239.253.161:8111/buildConfiguration/AgentSensorPlugin
```

### Manual Plugin Install

Download and install manually:

```bash
# 1. Download from TeamCity
curl -u "AIAgent:D#hp^uC5RuJcn%" -o AgentSensorPlugin.jar http://145.239.253.161:8111/app/rest/builds/latest/artifacts/content/AgentSensorPlugin-9.jar

# 2. Copy to plugins folder
copy AgentSensorPlugin.jar D:\MCServer\Server\plugins\

# 3. Restart server (in manager console)
restart
```

## Advanced Usage

### Custom Server Properties

Edit `D:\MCServer\Server\server.properties`:

```properties
# Server settings
server-port=25565
max-players=100
difficulty=normal
gamemode=survival
pvp=true

# Performance
view-distance=10
simulation-distance=8
```

### Multiple Servers

Run multiple instances:

```javascript
// Server 1 - Main
const mainServer = new MinecraftServerManager({
    serverDir: 'D:\\MCServer\\Server1',
    serverJar: 'spigot-1.21.10.jar',
    pluginsDir: 'D:\\MCServer\\Server1\\plugins'
});

// Server 2 - Test
const testServer = new MinecraftServerManager({
    serverDir: 'D:\\MCServer\\Server2',
    serverJar: 'spigot-1.21.10.jar',
    pluginsDir: 'D:\\MCServer\\Server2\\plugins'
});
```

## Monitoring

### Server Logs

View real-time logs:
```bash
# Windows
powershell Get-Content D:\MCServer\Server\logs\latest.log -Wait -Tail 50

# Or use server manager (outputs to console automatically)
```

### Plugin Logs

Check plugin-specific logs:
```bash
type D:\MCServer\Server\logs\latest.log | findstr AgentSensorPlugin
```

### Performance Monitoring

Check server resource usage:
```bash
# CPU and Memory
tasklist | findstr java

# Detailed stats
wmic process where "name='java.exe'" get ProcessId,ThreadCount,WorkingSetSize
```

## Next Steps

1. ✅ Start server manager
2. ✅ Wait for server to fully load
3. ✅ Verify plugin loaded (`[AgentSensorPlugin] Enabling`)
4. ✅ Start agents (`node server.js`)
5. ✅ Watch agents connect and receive sensor data
6. 🔄 Plugin auto-updates every 5 minutes

## Support

- TeamCity: http://145.239.253.161:8111/
- Build Config: http://145.239.253.161:8111/buildConfiguration/AgentSensorPlugin
- GitHub: https://github.com/TheKhosa/MineAI-Plugin
