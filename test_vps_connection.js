/**
 * Test VPS Connection and WebSocket Sensor Streaming
 * Connects to vps-38b05e45.vps.ovh.net and verifies plugin functionality
 */

const mineflayer = require('mineflayer');
const { getPluginSensorClient } = require('./plugin_sensor_client');

const VPS_HOST = 'vps-38b05e45.vps.ovh.net';
const VPS_PORT = 25565;
const BOT_USERNAME = 'SensorTestBot';

console.log('===========================================');
console.log('AgentSensorPlugin Connection Test');
console.log('===========================================');
console.log(`VPS Server: ${VPS_HOST}:${VPS_PORT}`);
console.log(`Bot Username: ${BOT_USERNAME}`);
console.log('');

// Create MineFlayer bot
const bot = mineflayer.createBot({
    host: VPS_HOST,
    port: VPS_PORT,
    username: BOT_USERNAME,
    version: '1.21',
    auth: 'offline'
});

// Create WebSocket sensor client
const sensorClient = getPluginSensorClient({
    host: VPS_HOST,
    port: 3002,
    authToken: 'mineagent-sensor-2024',
    reconnectInterval: 5000
});

// Bot event handlers
bot.on('login', () => {
    console.log(`✓ Bot logged in to Minecraft server`);
    console.log(`  Username: ${bot.username}`);
    console.log(`  Entity ID: ${bot.entity.id}`);
});

bot.on('spawn', () => {
    console.log(`✓ Bot spawned in world`);
    console.log(`  Position: ${bot.entity.position}`);
    console.log(`  Dimension: ${bot.game.dimension}`);
    console.log('');
    console.log('Connecting to WebSocket sensor server...');

    // Connect to WebSocket after spawn
    sensorClient.connect();
});

bot.on('health', () => {
    console.log(`  Health: ${bot.health}/20, Food: ${bot.food}/20`);
});

bot.on('error', (err) => {
    console.error('✗ Bot error:', err.message);
});

bot.on('kicked', (reason) => {
    console.error('✗ Bot was kicked:', reason);
});

bot.on('end', () => {
    console.log('✗ Bot disconnected');
    sensorClient.disconnect();
    process.exit(0);
});

// Sensor client event handlers
sensorClient.on('connected', () => {
    console.log('✓ WebSocket connected to plugin');
});

sensorClient.on('authenticated', () => {
    console.log('✓ WebSocket authenticated');
    console.log('  Registering bot...');
    sensorClient.registerBot(bot.username);
});

sensorClient.on('registered', (botName) => {
    console.log(`✓ Bot registered with sensor server: ${botName}`);
    console.log('');
    console.log('===========================================');
    console.log('Waiting for sensor data...');
    console.log('===========================================');
});

let sensorUpdateCount = 0;
sensorClient.on('sensor_update', ({ botName, timestamp, data }) => {
    sensorUpdateCount++;

    console.log(`\n[Sensor Update #${sensorUpdateCount}] ${new Date(timestamp).toLocaleTimeString()}`);
    console.log(`  Bot: ${botName}`);
    console.log(`  Location: (${data.location.x.toFixed(1)}, ${data.location.y.toFixed(1)}, ${data.location.z.toFixed(1)})`);
    console.log(`  Blocks nearby: ${data.blocks ? data.blocks.length : 0}`);
    console.log(`  Entities nearby: ${data.entities ? data.entities.length : 0}`);
    console.log(`  Mob AI states: ${data.mobAI ? data.mobAI.length : 0}`);
    console.log(`  Weather: ${data.weather.isRaining ? 'Raining' : 'Clear'}, Time: ${data.weather.timeOfDay}`);
    console.log(`  Chunks loaded: ${data.chunks ? data.chunks.length : 0}`);
    console.log(`  Dropped items: ${data.items ? data.items.length : 0}`);

    // Show some interesting entities
    if (data.entities && data.entities.length > 0) {
        console.log(`  Entities:`);
        data.entities.slice(0, 3).forEach(entity => {
            console.log(`    - ${entity.type} (${entity.aiState}) at (${entity.x.toFixed(1)}, ${entity.y.toFixed(1)}, ${entity.z.toFixed(1)})`);
        });
    }

    // Show some nearby blocks
    if (data.blocks && data.blocks.length > 0) {
        const interestingBlocks = data.blocks.filter(b =>
            b.type !== 'AIR' && b.type !== 'CAVE_AIR'
        ).slice(0, 5);

        if (interestingBlocks.length > 0) {
            console.log(`  Nearby blocks:`);
            interestingBlocks.forEach(block => {
                console.log(`    - ${block.type} at (${block.x}, ${block.y}, ${block.z}), light: ${block.lightLevel}`);
            });
        }
    }

    // After 10 updates, disconnect
    if (sensorUpdateCount >= 10) {
        console.log('\n===========================================');
        console.log('Test completed successfully!');
        console.log(`  Total sensor updates received: ${sensorUpdateCount}`);
        console.log('===========================================\n');

        bot.quit('Test completed');
    }
});

sensorClient.on('disconnected', ({ code, reason }) => {
    console.warn(`⚠ WebSocket disconnected (code: ${code}, reason: ${reason})`);
});

sensorClient.on('error', (error) => {
    console.error('✗ WebSocket error:', error.message);
});

sensorClient.on('server_error', (message) => {
    console.error('✗ Server error:', message);
});

sensorClient.on('reconnect_failed', () => {
    console.error('✗ Failed to reconnect to WebSocket server');
    bot.quit('WebSocket connection failed');
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n\nShutting down...');
    bot.quit('Test interrupted');
    sensorClient.disconnect();
    process.exit(0);
});

console.log('Connecting to server...\n');
