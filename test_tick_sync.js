/**
 * TEST: Tick Synchronization System
 *
 * Tests the tick-synchronized ML training system without requiring
 * the full Spigot plugin or Minecraft server.
 *
 * Simulates:
 * - Server tick events
 * - Checkpoint events
 * - Evolution events
 * - Agent actions
 */

const TickSynchronizedTrainer = require('./ml_tick_trainer');
const EventEmitter = require('events');

// Mock plugin sensor that simulates Spigot tick events
class MockPluginSensor extends EventEmitter {
    constructor() {
        super();
        this.currentTick = 0;
        this.running = false;
    }

    start() {
        console.log('[MOCK] Starting simulated server tick broadcaster...');
        this.running = true;

        // Simulate server ticks at ~50ms intervals (20 TPS)
        this.tickInterval = setInterval(() => {
            if (!this.running) return;

            this.currentTick++;

            // Emit server tick event
            this.emit('server_tick', {
                tick: this.currentTick,
                timestamp: Date.now(),
                tps: 19.8 + Math.random() * 0.4,  // Simulate 19.8-20.2 TPS
                onlinePlayers: 10
            });

            // Emit checkpoint event every 20 ticks (1 second in this test, 1 minute in reality)
            if (this.currentTick % 20 === 0) {
                this.emit('checkpoint', {
                    tick: this.currentTick,
                    timestamp: Date.now(),
                    ticksSinceLastCheckpoint: 20
                });
            }

            // Emit evolution event every 100 ticks (5 seconds in this test, 10 minutes in reality)
            if (this.currentTick % 100 === 0) {
                this.emit('evolution', {
                    tick: this.currentTick,
                    timestamp: Date.now(),
                    ticksSinceLastEvolution: 100
                });
            }
        }, 50);  // 50ms = 20 TPS
    }

    stop() {
        console.log('[MOCK] Stopping simulated server...');
        this.running = false;
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
        }
    }
}

// Mock ML Trainer
class MockMLTrainer {
    constructor() {
        this.agents = new Map();
        this.sharedBrain = { weights: 'mock_weights' };

        // Create 10 mock agents
        for (let i = 0; i < 10; i++) {
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

// Run test
async function runTest() {
    console.log('');
    console.log('======================================================================');
    console.log('TICK SYNCHRONIZATION TEST');
    console.log('======================================================================');
    console.log('');

    // Create mock components
    const mockSensor = new MockPluginSensor();
    const mockMLTrainer = new MockMLTrainer();

    // Create tick trainer
    const tickTrainer = new TickSynchronizedTrainer({
        checkpointDir: './ml_models/tick_checkpoints',
        evolutionDir: './ml_models/evolution',
        autoSave: true,
        autoEvolve: true,
        verboseLogging: true  // Show all tick events
    });

    // Connect ML trainer
    tickTrainer.setMLTrainer(mockMLTrainer);

    // Connect to mock sensor events
    mockSensor.on('server_tick', (data) => {
        tickTrainer.onServerTick(data);

        // Simulate agent actions
        const agentNames = Array.from(mockMLTrainer.agents.keys());
        const randomAgent = agentNames[Math.floor(Math.random() * agentNames.length)];
        tickTrainer.recordAgentAction(randomAgent, data.tick);
    });

    mockSensor.on('checkpoint', async (data) => {
        await tickTrainer.onCheckpoint(data);
    });

    mockSensor.on('evolution', async (data) => {
        await tickTrainer.onEvolution(data);
    });

    // Listen to tick trainer events
    tickTrainer.on('checkpoint', (data) => {
        console.log(`[TEST] ✓ Checkpoint event processed: ${data.saved} checkpoints saved`);
    });

    tickTrainer.on('evolution', (data) => {
        console.log(`[TEST] ✓ Evolution event processed: ${data.performed} evolutions completed`);
    });

    // Start simulation
    console.log('[TEST] Starting 10-second simulation (200 ticks)...');
    console.log('[TEST] Checkpoints expected: ~10 (every 20 ticks)');
    console.log('[TEST] Evolutions expected: ~2 (every 100 ticks)');
    console.log('');

    mockSensor.start();

    // Run for 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Stop simulation
    mockSensor.stop();

    // Display final statistics
    console.log('');
    console.log('======================================================================');
    console.log('TEST RESULTS');
    console.log('======================================================================');

    const stats = tickTrainer.getStats();
    console.log('Statistics:');
    console.log(`  Total ticks received: ${stats.ticksReceived}`);
    console.log(`  Current tick: ${stats.currentTick}`);
    console.log(`  Checkpoints saved: ${stats.checkpointsSaved}`);
    console.log(`  Evolutions performed: ${stats.evolutionsPerformed}`);
    console.log(`  Average TPS: ${stats.avgTPS.toFixed(2)}`);
    console.log(`  Active agents: ${stats.activeAgents}`);
    console.log('');

    // Verify checkpoint files
    const fs = require('fs');
    const path = require('path');

    if (fs.existsSync('./ml_models/tick_checkpoints')) {
        const checkpointFiles = fs.readdirSync('./ml_models/tick_checkpoints');
        console.log(`Checkpoint files created: ${checkpointFiles.length}`);
        if (checkpointFiles.length > 0) {
            console.log('Sample checkpoint files:');
            checkpointFiles.slice(0, 3).forEach(f => console.log(`  - ${f}`));
        }
    }

    console.log('');

    if (fs.existsSync('./ml_models/evolution')) {
        const evolutionFiles = fs.readdirSync('./ml_models/evolution');
        console.log(`Evolution files created: ${evolutionFiles.length}`);
        if (evolutionFiles.length > 0) {
            console.log('Sample evolution files:');
            evolutionFiles.slice(0, 3).forEach(f => console.log(`  - ${f}`));

            // Show sample evolution data
            const sampleFile = path.join('./ml_models/evolution', evolutionFiles[0]);
            const evolutionData = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
            console.log('');
            console.log('Sample evolution data:');
            console.log(`  Tick: ${evolutionData.tick}`);
            console.log(`  Total agents: ${evolutionData.totalAgents}`);
            console.log(`  Parents selected: ${evolutionData.parents.length}`);
            console.log(`  Max fitness: ${evolutionData.maxFitness.toFixed(2)} (${evolutionData.parents[0]?.name})`);
            console.log(`  Avg fitness: ${evolutionData.avgFitness.toFixed(2)}`);
        }
    }

    console.log('');
    console.log('======================================================================');
    console.log('TEST VALIDATION');
    console.log('======================================================================');

    // Validate results
    const validations = [
        { name: 'Ticks received', value: stats.ticksReceived, expected: '~200', pass: stats.ticksReceived >= 180 && stats.ticksReceived <= 220 },
        { name: 'Checkpoints saved', value: stats.checkpointsSaved, expected: '~10', pass: stats.checkpointsSaved >= 8 && stats.checkpointsSaved <= 12 },
        { name: 'Evolutions performed', value: stats.evolutionsPerformed, expected: '~2', pass: stats.evolutionsPerformed >= 1 && stats.evolutionsPerformed <= 3 },
        { name: 'Agent tracking', value: stats.activeAgents, expected: '10', pass: stats.activeAgents === 10 },
        { name: 'TPS average', value: stats.avgTPS.toFixed(2), expected: '~20', pass: stats.avgTPS >= 19 && stats.avgTPS <= 21 }
    ];

    let allPassed = true;
    validations.forEach(v => {
        const status = v.pass ? '✓ PASS' : '✗ FAIL';
        console.log(`${status} | ${v.name}: ${v.value} (expected: ${v.expected})`);
        if (!v.pass) allPassed = false;
    });

    console.log('');
    if (allPassed) {
        console.log('✓✓✓ ALL TESTS PASSED ✓✓✓');
    } else {
        console.log('✗✗✗ SOME TESTS FAILED ✗✗✗');
    }
    console.log('======================================================================');
    console.log('');

    process.exit(allPassed ? 0 : 1);
}

// Run test
runTest().catch(error => {
    console.error('[TEST ERROR]', error);
    process.exit(1);
});
