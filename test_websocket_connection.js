/**
 * Test WebSocket Connection to AgentSensorPlugin
 *
 * This script tests the WebSocket connection and verifies sensor data is being broadcast.
 */

const { PluginSensorClient } = require('./plugin_sensor_client.js');

console.log('========================================');
console.log('WebSocket Connection Test');
console.log('========================================\n');

// Create client
const client = new PluginSensorClient({
    host: 'localhost',
    port: 3002,
    authToken: 'mineagent-sensor-2024'
});

// Track events
let connected = false;
let authenticated = false;
let registered = false;
let sensorUpdatesReceived = 0;

// Connection event
client.on('connected', () => {
    connected = true;
    console.log('[✓] Connected to WebSocket server');
});

// Authentication event
client.on('authenticated', () => {
    authenticated = true;
    console.log('[✓] Authenticated successfully');

    // Register a test bot
    console.log('\n[TEST] Registering test bot "TestBot"...');
    client.registerBot('TestBot');
});

// Registration event
client.on('registered', (botName) => {
    registered = true;
    console.log(`[✓] Bot registered: ${botName}`);
    console.log('\n[TEST] Waiting for sensor updates...');
    console.log('[INFO] If agents are connected, you should see sensor_update events below\n');
});

// Sensor update event
client.on('sensor_update', ({ botName, timestamp, data }) => {
    sensorUpdatesReceived++;

    console.log(`\n[SENSOR UPDATE #${sensorUpdatesReceived}]`);
    console.log(`  Bot: ${botName}`);
    console.log(`  Timestamp: ${timestamp}`);
    console.log(`  Data keys: ${Object.keys(data).join(', ')}`);

    // Print some sample data
    if (data.location) {
        console.log(`  Location: x=${data.location.x}, y=${data.location.y}, z=${data.location.z}`);
    }
    if (data.health !== undefined) {
        console.log(`  Health: ${data.health}`);
    }
    if (data.nearbyBlocks) {
        console.log(`  Nearby blocks: ${data.nearbyBlocks.length} blocks`);
    }
    if (data.nearbyEntities) {
        console.log(`  Nearby entities: ${data.nearbyEntities.length} entities`);
    }
});

// Error events
client.on('error', (error) => {
    console.error('[✗] WebSocket error:', error.message);
});

client.on('disconnected', ({ code, reason }) => {
    console.warn(`[✗] Disconnected (code: ${code}, reason: ${reason || 'none'})`);
});

client.on('reconnect_failed', () => {
    console.error('[✗] Failed to reconnect after max attempts');
    printSummary();
    process.exit(1);
});

// Summary and exit after 30 seconds
setTimeout(() => {
    printSummary();
    client.disconnect();
    process.exit(0);
}, 30000);

function printSummary() {
    console.log('\n========================================');
    console.log('Test Summary');
    console.log('========================================');
    console.log(`Connected: ${connected ? '✓ YES' : '✗ NO'}`);
    console.log(`Authenticated: ${authenticated ? '✓ YES' : '✗ NO'}`);
    console.log(`Registered: ${registered ? '✓ YES' : '✗ NO'}`);
    console.log(`Sensor updates received: ${sensorUpdatesReceived}`);
    console.log('');

    const stats = client.getStats();
    console.log('Client Statistics:');
    console.log(`  Messages received: ${stats.messagesReceived}`);
    console.log(`  Cached bots: ${stats.cachedBots}`);
    console.log(`  Disconnection count: ${stats.disconnectionCount}`);
    console.log('========================================\n');

    if (sensorUpdatesReceived > 0) {
        console.log('[SUCCESS] WebSocket connection working! Sensor data is being streamed.\n');
    } else if (registered) {
        console.log('[WARNING] Connected and authenticated, but no sensor updates received.');
        console.log('[INFO] This might mean no agents are currently connected to the Minecraft server.\n');
    } else if (authenticated) {
        console.log('[PARTIAL] Authenticated but not registered. Check bot registration logic.\n');
    } else if (connected) {
        console.log('[PARTIAL] Connected but not authenticated. Check authentication token.\n');
    } else {
        console.log('[FAILURE] Could not connect to WebSocket server.');
        console.log('[INFO] Is the plugin loaded? Check: localhost:3002\n');
    }
}

// Start connection
console.log('[TEST] Connecting to ws://localhost:3002...\n');
client.connect();

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\n\n[TEST] Interrupted by user');
    printSummary();
    client.disconnect();
    process.exit(0);
});
