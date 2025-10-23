/**
 * LIVE TEST: Tick Synchronization with Real Spigot Server
 *
 * Connects to the live Spigot server and demonstrates:
 * - Server tick events being received
 * - Checkpoint events (every 1200 ticks = 1 minute)
 * - Evolution events (every 12000 ticks = 10 minutes)
 * - Perfect ML agent synchronization
 */

const { PluginSensorClient } = require('./plugin_sensor_client');
const TickSynchronizedTrainer = require('./ml_tick_trainer');

console.log('');
console.log('======================================================================');
console.log('LIVE TICK SYNCHRONIZATION TEST');
console.log('======================================================================');
console.log('Connecting to Spigot server with AgentSensorPlugin-27.jar...');
console.log('Will display tick events, checkpoints, and evolution triggers');
console.log('======================================================================');
console.log('');

// Create plugin sensor client (connects to WebSocket server on port 3002)
const pluginClient = new PluginSensorClient({
    host: 'localhost',
    port: 3002,
    authToken: 'mineagent-sensor-2024',
    reconnect: true
});

// Create tick trainer
const tickTrainer = new TickSynchronizedTrainer({
    checkpointDir: './ml_models/tick_checkpoints',
    evolutionDir: './ml_models/evolution',
    autoSave: true,
    autoEvolve: true,
    verboseLogging: false  // Don't spam every tick
});

// Mock ML trainer with some agents
class MockMLTrainer {
    constructor() {
        this.agents = new Map();

        // Create 5 mock agents
        for (let i = 0; i < 5; i++) {
            this.agents.set(`Agent${i}`, {
                brain: { weights: `agent${i}_weights` },
                fitness: Math.random() * 100,
                steps: 0
            });
        }
    }

    getAllFitness() {
        const fitness = [];
        for (const [name, agent] of this.agents.entries()) {
            fitness.push({ name, fitness: agent.fitness });
        }
        return fitness;
    }
}

const mockMLTrainer = new MockMLTrainer();
tickTrainer.setMLTrainer(mockMLTrainer);

// Track tick statistics
let tickCount = 0;
let startTime = Date.now();
let lastTickTime = Date.now();
let tickRates = [];

// Listen to plugin client events
pluginClient.on('connected', () => {
    console.log('[✓] Connected to AgentSensorPlugin WebSocket server');
    console.log('[✓] Listening for tick events...');
    console.log('');
    console.log('Tick event format:');
    console.log('  [TICK] tick=<number> tps=<number> players=<number> ms_since_last=<number>');
    console.log('');
});

pluginClient.on('authenticated', () => {
    console.log('[✓] Authenticated with server');
});

pluginClient.on('server_tick', (data) => {
    tickTrainer.onServerTick(data);

    tickCount++;
    const now = Date.now();
    const msSinceLastTick = now - lastTickTime;
    lastTickTime = now;

    // Calculate actual TPS
    tickRates.push(1000 / msSinceLastTick);
    if (tickRates.length > 20) tickRates.shift();  // Keep last 20 ticks
    const avgTPS = tickRates.reduce((a, b) => a + b, 0) / tickRates.length;

    // Show every 20th tick (once per second)
    if (data.tick % 20 === 0) {
        console.log(`[TICK] tick=${data.tick} tps=${avgTPS.toFixed(2)} players=${data.onlinePlayers} ms_since_last=${msSinceLastTick}ms`);
    }

    // Simulate agent actions
    const agentNames = Array.from(mockMLTrainer.agents.keys());
    const randomAgent = agentNames[Math.floor(Math.random() * agentNames.length)];
    tickTrainer.recordAgentAction(randomAgent, data.tick);
});

pluginClient.on('checkpoint', async (data) => {
    const elapsed = (Date.now() - startTime) / 1000;
    console.log('');
    console.log(`[✓✓✓ CHECKPOINT EVENT ✓✓✓]`);
    console.log(`  Tick: ${data.tick}`);
    console.log(`  Ticks since last: ${data.ticksSinceLastCheckpoint}`);
    console.log(`  Elapsed time: ${elapsed.toFixed(1)}s`);
    console.log(`  Expected time: ${data.ticksSinceLastCheckpoint / 20}s (at 20 TPS)`);
    console.log('');

    await tickTrainer.onCheckpoint(data);
});

pluginClient.on('evolution', async (data) => {
    const elapsed = (Date.now() - startTime) / 1000;
    console.log('');
    console.log(`[✓✓✓ EVOLUTION EVENT ✓✓✓]`);
    console.log(`  Tick: ${data.tick}`);
    console.log(`  Ticks since last: ${data.ticksSinceLastEvolution}`);
    console.log(`  Elapsed time: ${elapsed.toFixed(1)}s`);
    console.log(`  Expected time: ${data.ticksSinceLastEvolution / 20}s (at 20 TPS)`);
    console.log('');

    await tickTrainer.onEvolution(data);
});

pluginClient.on('error', (error) => {
    console.error('[ERROR]', error.message);
});

pluginClient.on('disconnected', () => {
    console.log('[X] Disconnected from server');
});

// Listen to tick trainer events
tickTrainer.on('checkpoint', (data) => {
    console.log(`  [TickTrainer] Saved ${data.saved} model checkpoints`);
});

tickTrainer.on('evolution', (data) => {
    console.log(`  [TickTrainer] Performed ${data.performed} evolutions`);
    console.log(`  [TickTrainer] Top agent: ${data.topAgent} (fitness: ${data.topFitness.toFixed(2)})`);
});

// Start connection
pluginClient.connect();

// Show statistics every 10 seconds
setInterval(() => {
    const stats = tickTrainer.getStats();
    const elapsed = (Date.now() - startTime) / 1000;

    console.log('');
    console.log('--- STATISTICS ---');
    console.log(`  Runtime: ${elapsed.toFixed(1)}s`);
    console.log(`  Ticks received: ${stats.ticksReceived}`);
    console.log(`  Current tick: ${stats.currentTick}`);
    console.log(`  Average TPS: ${stats.avgTPS.toFixed(2)}`);
    console.log(`  Checkpoints saved: ${stats.checkpointsSaved}`);
    console.log(`  Evolutions performed: ${stats.evolutionsPerformed}`);
    console.log(`  Active agents: ${stats.activeAgents}`);
    console.log('');
}, 10000);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('');
    console.log('======================================================================');
    console.log('SHUTTING DOWN');
    console.log('======================================================================');

    const stats = tickTrainer.getStats();
    console.log('Final Statistics:');
    console.log(`  Total ticks received: ${stats.ticksReceived}`);
    console.log(`  Checkpoints saved: ${stats.checkpointsSaved}`);
    console.log(`  Evolutions performed: ${stats.evolutionsPerformed}`);
    console.log(`  Average TPS: ${stats.avgTPS.toFixed(2)}`);
    console.log('');

    pluginClient.disconnect();
    process.exit(0);
});

console.log('[i] Press Ctrl+C to stop...');
console.log('');
