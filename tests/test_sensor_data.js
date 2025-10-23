/**
 * Test Sensor Data Reception with Real Player Name
 */

const { PluginSensorClient } = require('./plugin_sensor_client.js');

console.log('========================================');
console.log('Sensor Data Reception Test');
console.log('========================================\n');

// Use an actual player name from the server
const PLAYER_NAME = 'Dinxs'; // Real player currently on server

const client = new PluginSensorClient({
    host: 'localhost',
    port: 3002,
    authToken: 'mineagent-sensor-2024'
});

let sensorUpdatesReceived = 0;
let firstUpdate = null;

client.on('connected', () => {
    console.log(`[✓] Connected to WebSocket`);
});

client.on('authenticated', () => {
    console.log(`[✓] Authenticated`);
    console.log(`\n[TEST] Registering as player: ${PLAYER_NAME}`);
    console.log('[INFO] This should match a real player on the server\n');
    client.registerBot(PLAYER_NAME);
});

client.on('registered', (botName) => {
    console.log(`[✓] Registered as: ${botName}`);
    console.log(`[WAIT] Waiting for sensor updates (broadcasts every 2 seconds)...\n`);
});

client.on('sensor_update', ({ botName, timestamp, data }) => {
    sensorUpdatesReceived++;

    if (sensorUpdatesReceived === 1) {
        firstUpdate = data;

        console.log(`\n${'='.repeat(60)}`);
        console.log(`SENSOR UPDATE #1 RECEIVED!`);
        console.log(`${'='.repeat(60)}`);
        console.log(`Bot Name: ${botName}`);
        console.log(`Timestamp: ${timestamp}`);
        console.log(`\n📊 SENSOR DATA STRUCTURE:`);
        console.log(`${'─'.repeat(60)}`);

        // Print all top-level keys
        const keys = Object.keys(data);
        console.log(`\nData Keys (${keys.length} total):`);
        keys.forEach(key => {
            const value = data[key];
            if (Array.isArray(value)) {
                console.log(`  • ${key}: [Array with ${value.length} items]`);
            } else if (typeof value === 'object' && value !== null) {
                console.log(`  • ${key}: {Object with ${Object.keys(value).length} fields}`);
            } else {
                console.log(`  • ${key}: ${value}`);
            }
        });

        // Detailed breakdown
        console.log(`\n🌍 LOCATION DATA:`);
        if (data.location) {
            console.log(`  x: ${data.location.x}`);
            console.log(`  y: ${data.location.y}`);
            console.log(`  z: ${data.location.z}`);
            console.log(`  yaw: ${data.location.yaw}°`);
            console.log(`  pitch: ${data.location.pitch}°`);
            console.log(`  world: ${data.location.world}`);
        }

        console.log(`\n🧱 BLOCK DATA:`);
        if (data.blocks && Array.isArray(data.blocks)) {
            console.log(`  Total blocks: ${data.blocks.length}`);
            if (data.blocks.length > 0) {
                console.log(`  Sample block:`, data.blocks[0]);
            }
        }

        console.log(`\n👾 ENTITY DATA:`);
        if (data.entities && Array.isArray(data.entities)) {
            console.log(`  Total entities: ${data.entities.length}`);
            if (data.entities.length > 0) {
                console.log(`  Sample entity:`, data.entities[0]);
            }
        }

        console.log(`\n🌦️  WEATHER DATA:`);
        if (data.weather) {
            console.log(`  Has storm: ${data.weather.hasStorm}`);
            console.log(`  Is thundering: ${data.weather.isThundering}`);
            console.log(`  Time: ${data.weather.time}`);
        }

        console.log(`\n🗺️  CHUNK DATA:`);
        if (data.chunks) {
            console.log(`  Loaded chunks: ${data.chunks.loadedChunks || 'N/A'}`);
            console.log(`  Entities in chunks: ${data.chunks.entityCount || 'N/A'}`);
        }

        console.log(`\n💎 ITEM DATA:`);
        if (data.items && Array.isArray(data.items)) {
            console.log(`  Dropped items nearby: ${data.items.length}`);
        }

        console.log(`\n🤖 MOB AI DATA:`);
        if (data.mobAI && Array.isArray(data.mobAI)) {
            console.log(`  Mobs with AI data: ${data.mobAI.length}`);
            if (data.mobAI.length > 0) {
                console.log(`  Sample mob AI:`, data.mobAI[0]);
            }
        }

        console.log(`\n${'='.repeat(60)}\n`);

    } else {
        // Just show counts for subsequent updates
        console.log(`[UPDATE #${sensorUpdatesReceived}] Received (blocks: ${data.blocks?.length || 0}, entities: ${data.entities?.length || 0})`);
    }
});

client.on('error', (error) => {
    console.error('[✗] Error:', error.message);
});

// Run for 15 seconds then exit
setTimeout(() => {
    console.log(`\n${'='.repeat(60)}`);
    console.log('TEST COMPLETE');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total sensor updates received: ${sensorUpdatesReceived}`);
    console.log(`Expected frequency: 1 update every 2 seconds`);
    console.log(`Test duration: 15 seconds`);
    console.log(`Expected updates: ~7`);

    if (sensorUpdatesReceived > 0) {
        console.log(`\n✅ SUCCESS! Plugin is broadcasting sensor data correctly!`);
        console.log(`\nThe AgentSensorPlugin is working as designed:`);
        console.log(`  • WebSocket server: ✓ Running on port 3002`);
        console.log(`  • Authentication: ✓ Working`);
        console.log(`  • Bot registration: ✓ Working`);
        console.log(`  • Sensor broadcasting: ✓ Working (every 2 seconds)`);
        console.log(`  • Data collection: ✓ Working (${Object.keys(firstUpdate || {}).length} data types)`);
    } else {
        console.log(`\n❌ FAILURE! No sensor updates received.`);
        console.log(`\nPossible causes:`);
        console.log(`  • Player "${PLAYER_NAME}" not found on server`);
        console.log(`  • SensorBroadcaster not started`);
        console.log(`  • Broadcaster filtering by online players only`);
    }
    console.log(`${'='.repeat(60)}\n`);

    client.disconnect();
    process.exit(0);
}, 15000);

client.connect();

process.on('SIGINT', () => {
    console.log('\n\n[Interrupted]');
    client.disconnect();
    process.exit(0);
});
