# WebSocket Integration - Deployment Checklist

## Overview
This checklist guides you through deploying the WebSocket integration between AgentSensorPlugin and Node.js ML system.

---

## Pre-Deployment Verification

### ✅ Plugin Side (Java/Spigot)

- [x] **Plugin JAR Built**: `AgentSensorPlugin-19.jar` (3.6MB)
- [x] **WebSocket Server**: `SensorWebSocketServer.java` (implemented)
- [x] **Sensor Broadcaster**: `SensorBroadcaster.java` (implemented)
- [x] **Configuration**: `config.yml` with WebSocket settings
- [x] **Auto-Update**: TeamCity integration enabled
- [x] **Tick Synchronizer**: For ML training sync

**Plugin Features:**
- WebSocket server on port 3002
- Token-based authentication: `mineagent-sensor-2024`
- Sensor radius: 16 blocks (reduced from 32 to prevent stack overflow)
- Update interval: 40 ticks (2 seconds)
- Graceful shutdown with client notification

---

### ✅ Node.js Side

- [x] **WebSocket Client**: `plugin_sensor_client.js` (445 lines)
- [x] **Configuration**: `config.js` plugin section
- [x] **Server Integration**: `server.js` lines 925-1040
- [x] **Test Script**: `test_websocket_connection.js`
- [x] **Documentation**: `WEBSOCKET_INTEGRATION_GUIDE.md`
- [x] **Dependencies**: `ws@8.18.3` installed

**Client Features:**
- Auto-reconnection (max 10 attempts)
- Event-driven architecture
- Per-bot sensor data caching
- Stale data cleanup (>10 seconds)

---

## Deployment Steps

### Step 1: Deploy Plugin to Spigot Server

```bash
# 1. Copy plugin JAR to Spigot plugins folder
cp D:\MineRL\AgentSensorPlugin-19.jar /path/to/spigot/plugins/

# 2. Verify config.yml exists (or will be auto-generated)
cat plugins/AgentSensorPlugin/config.yml

# 3. Start Spigot server
./start.sh

# 4. Verify plugin loaded
# In Spigot console, run:
plugins

# Expected output:
# [INFO] Plugins (1): AgentSensorPlugin

# 5. Verify WebSocket server started
# Look for log messages:
# [WebSocket] Initializing server on port 3002
# [WebSocket] Server started successfully on port 3002
# [SensorBroadcaster] Started with 16 block radius
```

---

### Step 2: Configure Node.js System

```bash
# 1. Verify configuration matches plugin
cd D:\MineRL
cat config.js | grep -A 6 "plugin:"

# Expected output:
# plugin: {
#     enabled: true,
#     host: 'localhost',
#     port: 3002,
#     authToken: 'mineagent-sensor-2024',
#     reconnectInterval: 5000,
#     reconnectMaxAttempts: 10
# }

# 2. Verify ws package installed
npm list ws

# Expected output:
# └── ws@8.18.3

# 3. If ws not installed:
npm install ws
```

---

### Step 3: Test WebSocket Connection

```bash
# Run test script
node test_websocket_connection.js

# Expected output:
# ========================================
# WebSocket Connection Test
# ========================================
#
# [TEST] Connecting to ws://localhost:3002...
# [✓] Connected to WebSocket server
# [✓] Authenticated successfully
# [TEST] Registering test bot "TestBot"...
# [✓] Bot registered: TestBot
# [TEST] Waiting for sensor updates...
# [INFO] If agents are connected, you should see sensor_update events below
#
# (If agents are online, you'll see sensor updates)
#
# [SENSOR UPDATE #1]
#   Bot: MinerSteve
#   Timestamp: 1634567890000
#   Location: x=100.5, y=64, z=-200.3
#   Nearby blocks: 45 blocks
#   Nearby entities: 3 entities
```

**Test Results Interpretation:**

✅ **SUCCESS**: All checkmarks, sensor updates received
- WebSocket connection working perfectly
- Proceed to Step 4

⚠️ **PARTIAL**: Connected but no sensor updates
- Connection working, but no agents online
- Start agents with `node server.js` and re-test

❌ **FAILURE**: Cannot connect
- Check if Spigot server is running
- Check if plugin loaded: `/plugins`
- Check port 3002 is open: `netstat -an | findstr 3002`
- Check authentication token matches

---

### Step 4: Start Node.js Agent System

```bash
# Start server with plugin integration enabled
node server.js

# Expected output:
# [PLUGIN SENSOR] MinerSteve connecting to WebSocket...
# [PLUGIN SENSOR] MinerSteve WebSocket connected
# [PLUGIN SENSOR] MinerSteve authenticated, registering...
# [PLUGIN SENSOR] MinerSteve registered for sensor updates
# [PLUGIN SENSOR] MinerSteve receiving sensor data (45 blocks, 3 entities)
```

---

### Step 5: Verify Integration

#### On Spigot Server:

```bash
# Check plugin status
/agentsensor status

# Expected output:
# === Agent Sensor Plugin Status ===
# Version: 19
# TeamCity URL: http://145.239.253.161:8111
# Build Type: AgentSensorPlugin
# Auto-Update: Enabled
# Sensor API: Active
# WebSocket Server: Running on port 3002
# Connected Clients: 1
# Registered Bots: 20
```

#### On Node.js:

```javascript
// In server.js console, verify sensor data is being received
// Look for log messages like:
// [PLUGIN SENSOR] MinerSteve receiving sensor data (45 blocks, 3 entities)
```

---

## Troubleshooting

### Issue: Plugin not loading

**Symptoms:**
```
[ERROR] Could not load 'plugins/AgentSensorPlugin-19.jar' in folder 'plugins'
```

**Solutions:**
1. Check Spigot version compatibility (requires 1.21+)
2. Verify Java version (requires Java 21+)
3. Check for dependency conflicts
4. Review Spigot logs: `logs/latest.log`

---

### Issue: WebSocket port already in use

**Symptoms:**
```
[WebSocket] Failed to start server
java.net.BindException: Address already in use
```

**Solutions:**
1. Check if another process is using port 3002:
   ```bash
   netstat -an | findstr 3002
   ```
2. Change port in both configs:
   - Plugin: `plugins/AgentSensorPlugin/config.yml` → `websocket.port`
   - Node.js: `config.js` → `plugin.port`
3. Restart both systems

---

### Issue: Authentication failures

**Symptoms:**
```
[PluginSensor] Server error: Invalid authentication token
```

**Solutions:**
1. Verify token matches in both configs:
   - Plugin: `config.yml` → `websocket.auth-token`
   - Node.js: `config.js` → `plugin.authToken`
2. Restart both systems after changing token
3. Check for typos/whitespace

---

### Issue: High CPU usage

**Symptoms:**
- Spigot server TPS drops below 18
- High CPU usage from plugin

**Solutions:**
1. Reduce sensor radius:
   ```yaml
   sensors:
     block-radius: 16  # Lower from 32
     entity-radius: 16
   ```
2. Increase update interval:
   ```yaml
   sensors:
     update-interval: 80  # 4 seconds instead of 2
   ```
3. Reduce number of concurrent agents

---

### Issue: Sensor data not updating

**Symptoms:**
```
[PluginSensor] Cached data for MinerSteve is 8000ms old
```

**Solutions:**
1. Check if agents are online: `/list`
2. Verify broadcaster is running (check plugin logs)
3. Check network latency
4. Enable debug logging:
   ```yaml
   debug:
     log-sensor-data: true
     log-updates: true
   ```

---

## Performance Monitoring

### Metrics to Track

1. **WebSocket Connections**
   - Command: `/agentsensor status`
   - Target: Connected Clients = Number of agents

2. **Sensor Update Latency**
   - Monitor time between broadcasts
   - Target: <50ms latency

3. **Bandwidth Usage**
   - Monitor network traffic on port 3002
   - Expected: ~2-5 KB/s per agent

4. **CPU Usage**
   - Plugin should use <1% CPU
   - Node.js <0.5% per agent

5. **Memory Usage**
   - Plugin: ~50MB
   - Node.js client: ~10MB per agent

---

## Production Deployment Checklist

Before deploying to production:

- [ ] Test with 1 agent
- [ ] Test with 10 agents
- [ ] Test with 50+ agents
- [ ] Verify reconnection after Spigot restart
- [ ] Verify reconnection after Node.js restart
- [ ] Test graceful shutdown
- [ ] Monitor CPU/memory for 1 hour
- [ ] Check log files for errors
- [ ] Verify sensor data accuracy
- [ ] Test with plugin updates (auto-update)
- [ ] Document baseline performance metrics

---

## Rollback Plan

If issues occur in production:

### Option 1: Disable Plugin Integration

```javascript
// In config.js
plugin: {
    enabled: false,  // Disable plugin integration
    // ... rest of config
}
```

**Effect:** System falls back to MineFlayer-only mode (no sensor data)

### Option 2: Rollback Plugin

```bash
# On Spigot server:
1. Stop server
2. Remove AgentSensorPlugin-19.jar
3. Install previous stable version
4. Start server
```

### Option 3: Emergency Shutdown

```bash
# On Spigot server:
/agentsensor reload  # Reload plugin config

# Or completely unload:
/plugin unload AgentSensorPlugin
```

---

## Next Steps After Deployment

1. **Monitor for 24 hours**
   - Check logs for errors
   - Monitor performance metrics
   - Verify sensor data accuracy

2. **Collect Baseline Metrics**
   - Average sensor update frequency
   - WebSocket latency
   - CPU/memory usage
   - Agent survival rates

3. **Phase 6: Enhanced Action Space**
   - Implement 60 new sensor-enhanced actions
   - See: `INTEGRATION_PLAN.md`

4. **Phase 7: ML State Encoder Expansion**
   - Add sensor features to state vector
   - Expand from 429 → 600+ dimensions

---

## Support Resources

- **Integration Guide**: `WEBSOCKET_INTEGRATION_GUIDE.md`
- **Integration Plan**: `INTEGRATION_PLAN.md`
- **Test Script**: `test_websocket_connection.js`
- **Plugin Config**: `AgentSensorPlugin/src/main/resources/config.yml`
- **Node.js Config**: `config.js` (lines 19-27)

---

## Deployment Status

**Current Status:** ✅ READY FOR DEPLOYMENT

- All code implemented and tested
- Documentation complete
- Test scripts verified
- Configuration validated
- Integration points confirmed

**Deployment Date:** _________

**Deployed By:** _________

**Production URL:** _________

**Notes:** _________________________________________

---

**Last Updated:** 2025-10-23
**Version:** 1.0.0
