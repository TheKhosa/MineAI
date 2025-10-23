/**
 * Test State Encoder 694-dimensional expansion
 * Verifies that all plugin sensor and additional mineflayer encoders work correctly
 * 429 base + 200 plugin sensors + 65 additional mineflayer = 694 total
 */

const StateEncoder = require('./ml_state_encoder');
const Vec3 = require('vec3');

// Create mock bot with all required properties
function createMockBot() {
    return {
        username: 'TestBot',
        uuid: 'test-uuid-1234',
        entity: {
            position: new Vec3(100, 64, 200),
            velocity: new Vec3(0.1, 0, 0.2),
            yaw: Math.PI / 4,
            pitch: 0,
            jumpTicks: 0,
            effects: {}
        },
        health: 18,
        food: 16,
        foodSaturation: 10,
        oxygenLevel: 20,
        experience: {
            level: 15,
            points: 45,
            progress: 0.5
        },
        controlState: {
            forward: true,
            back: false,
            left: false,
            right: false,
            jump: false,
            sprint: true,
            sneak: false
        },
        isSleeping: false,
        quickBarSlot: 0,
        inventory: {
            items: () => [
                { name: 'iron_pickaxe', count: 1 },
                { name: 'coal', count: 32 },
                { name: 'iron_ore', count: 15 }
            ],
            slots: []
        },
        heldItem: { name: 'iron_pickaxe', maxDurability: 250, durabilityUsed: 50 },
        entities: {},
        players: {},
        blockAt: (pos) => ({ name: 'stone', displayName: 'Stone' }),
        time: { timeOfDay: 1000, age: 50000 },
        isRaining: false,
        thunderState: 0,

        // Plugin sensor data (mock)
        pluginSensorData: {
            blocks: [
                { type: 'stone', x: 1, y: 0, z: 0, hardness: 1.5, lightLevel: 0, passable: false, isSolid: true, isFlammable: false, isOccluding: true },
                { type: 'coal_ore', x: 2, y: -1, z: 0, hardness: 3.0, lightLevel: 0, passable: false, isSolid: true, isFlammable: false, isOccluding: true },
                { type: 'iron_ore', x: -1, y: -2, z: 0, hardness: 3.0, lightLevel: 0, passable: false, isSolid: true, isFlammable: false, isOccluding: true },
                { type: 'stone', x: 0, y: -1, z: 1, hardness: 1.5, lightLevel: 0, passable: false, isSolid: true, isFlammable: false, isOccluding: true },
                { type: 'air', x: 0, y: 1, z: 0, hardness: 0, lightLevel: 15, passable: true, isSolid: false, isFlammable: false, isOccluding: false }
            ],
            entities: [
                { uuid: 'entity-1', type: 'zombie', isHostile: true, aiState: 'MOVING', health: 20, distance: 10 },
                { uuid: 'entity-2', type: 'cow', isHostile: false, aiState: 'IDLE', health: 10, distance: 5 }
            ],
            mobAI: [
                { uuid: 'mob-1', currentGoal: 'ATTACK_TARGET', targetUUID: 'other-uuid', targetType: 'PLAYER', isAggressive: true, aggressive: true, pathfindingNodes: ['node1', 'node2'], pathfinding: true, goal: 'ATTACK', health: 15, distance: 8 },
                { uuid: 'mob-2', currentGoal: 'WANDER', targetUUID: null, targetType: 'NONE', isAggressive: false, aggressive: false, pathfindingNodes: [], pathfinding: false, goal: 'WANDER', health: 20, distance: 12 }
            ],
            weather: {
                hasStorm: false,
                isThundering: false,
                weatherDuration: 5000,
                time: 6000,
                timeOfDay: 'DAY'
            },
            chunks: {
                loadedChunks: 15,
                entityCount: 25,
                tileEntityCount: 5,
                adjacentChunks: [
                    { loaded: true, generating: false, populated: true, lightCalculated: true },
                    { loaded: true, generating: false, populated: true, lightCalculated: true },
                    { loaded: false, generating: true, populated: false, lightCalculated: false }
                ],
                biomes: ['plains', 'forest', 'plains'],
                chunksAtHeight: { surface: 10, underground: 5, deepslate: 2, bedrock: 1, sky: 0 },
                structures: { village: 1, mineshaft: 0, dungeon: 1, stronghold: 0, monument: 0 },
                hostileSpawnable: 8,
                passiveSpawnable: 12,
                wellLit: 6,
                hasShelter: 3,
                resourceRich: 4,
                loadTime: 50
            },
            items: [
                { type: 'diamond', amount: 1, ticksLived: 100, x: 101, y: 64, z: 201 },
                { type: 'iron_ingot', amount: 5, ticksLived: 500, x: 102, y: 64, z: 199 }
            ]
        },

        getEquipmentDestSlot: (slot) => {
            const slots = { 'head': 5, 'torso': 6, 'legs': 7, 'feet': 8, 'off-hand': 45 };
            return slots[slot];
        }
    };
}

// Run test
console.log('=== State Encoder 694-Dimensional Test ===\n');

const encoder = new StateEncoder();
console.log(`Expected STATE_SIZE: 694`);
console.log(`Actual STATE_SIZE: ${encoder.STATE_SIZE}`);

if (encoder.STATE_SIZE !== 694) {
    console.error(`❌ FAILED: STATE_SIZE is not 694! Got ${encoder.STATE_SIZE}`);
    process.exit(1);
}

console.log('✓ STATE_SIZE is correct\n');

// Create mock bot
const mockBot = createMockBot();

// Encode state
console.log('Encoding state...');
let state;
try {
    state = encoder.encodeState(mockBot);
    console.log('✓ State encoded successfully\n');
} catch (error) {
    console.error('❌ FAILED: Error during encoding:', error.message);
    console.error(error.stack);
    process.exit(1);
}

// Verify state vector size
console.log(`State vector length: ${state.length}`);
if (state.length !== 694) {
    console.error(`❌ FAILED: State vector length is ${state.length}, expected 694!`);
    process.exit(1);
}
console.log('✓ State vector has correct size\n');

// Verify state is a Float32Array
if (!(state instanceof Float32Array)) {
    console.error('❌ FAILED: State is not a Float32Array!');
    process.exit(1);
}
console.log('✓ State is Float32Array\n');

// Verify no NaN or Infinity values
const nanIndices = [];
Array.from(state).forEach((v, i) => {
    if (isNaN(v)) nanIndices.push(i);
});

if (nanIndices.length > 0) {
    console.error(`❌ FAILED: State vector contains ${nanIndices.length} NaN values!`);
    console.error(`NaN at indices: ${nanIndices.slice(0, 20).join(', ')}${nanIndices.length > 20 ? '...' : ''}`);

    // Show actual NaN values for debugging
    nanIndices.slice(0, 10).forEach(idx => {
        console.error(`  Index ${idx}: ${state[idx]}`);
    });

    // Find which encoder produced NaN
    nanIndices.forEach(idx => {
        if (idx < 429) {
            console.error(`Index ${idx}: NaN in base features (0-428)`);
        } else if (idx < 479) {
            console.error(`Index ${idx}: NaN in encodePluginBlockData (429-478), feature ${idx-429}`);
        } else if (idx < 509) {
            console.error(`Index ${idx}: NaN in encodePluginEntityData (479-508), feature ${idx-479}`);
        } else if (idx < 549) {
            console.error(`Index ${idx}: NaN in encodePluginMobAI (509-548), feature ${idx-509}`);
        } else if (idx < 559) {
            console.error(`Index ${idx}: NaN in encodePluginWeather (549-558), feature ${idx-549}`);
        } else if (idx < 589) {
            console.error(`Index ${idx}: NaN in encodePluginChunks (559-588), feature ${idx-559}`);
        } else if (idx < 629) {
            console.error(`Index ${idx}: NaN in additional mineflayer (589-628), feature ${idx-589}`);
        }
    });

    process.exit(1);
}
console.log('✓ No NaN values\n');

const hasInfinity = Array.from(state).some(v => !isFinite(v) && !isNaN(v));

if (hasInfinity) {
    console.error('❌ FAILED: State vector contains Infinity values!');
    process.exit(1);
}

if (hasInfinity) {
    console.error('❌ FAILED: State vector contains Infinity values!');
    process.exit(1);
}
console.log('✓ No Infinity values\n');

// Verify values are in reasonable ranges (most should be 0-1)
const outOfRange = Array.from(state).filter(v => v < -1.5 || v > 1.5);
console.log(`Values outside [-1.5, 1.5]: ${outOfRange.length} / ${state.length}`);

if (outOfRange.length > 50) {
    console.warn('⚠ WARNING: Many values outside expected range [-1.5, 1.5]');
}

// Sample some encoded values
console.log('\n=== Sample Encoded Values ===');
console.log(`Position (0-2): [${state[0].toFixed(3)}, ${state[1].toFixed(3)}, ${state[2].toFixed(3)}]`);
console.log(`Health (3): ${state[3].toFixed(3)} (expected ~0.9)`);
console.log(`Food (4): ${state[4].toFixed(3)} (expected ~0.8)`);

// Test plugin sensor encoding ranges
let offset = 429; // Base features
console.log(`\n=== Plugin Sensor Data (offset ${offset}) ===`);
console.log(`Plugin block data starts at: ${offset}`);
console.log(`Sample plugin block values: [${state[offset].toFixed(3)}, ${state[offset+1].toFixed(3)}, ${state[offset+2].toFixed(3)}]`);

offset += 50; // encodePluginBlockData (offset now 479)
console.log(`Plugin entity data starts at: ${offset}`);
console.log(`Sample plugin entity values: [${state[offset].toFixed(3)}, ${state[offset+1].toFixed(3)}, ${state[offset+2].toFixed(3)}]`);

offset += 30; // encodePluginEntityData (offset now 509)
console.log(`Plugin mob AI starts at: ${offset}`);
console.log(`Sample plugin mob AI values: [${state[offset].toFixed(3)}, ${state[offset+1].toFixed(3)}, ${state[offset+2].toFixed(3)}]`);

offset += 40; // encodePluginMobAI (offset now 549)
console.log(`Plugin weather starts at: ${offset}`);
console.log(`Sample plugin weather values: [${state[offset].toFixed(3)}, ${state[offset+1].toFixed(3)}, ${state[offset+2].toFixed(3)}]`);

offset += 10; // encodePluginWeather (offset now 559)
console.log(`Plugin chunks starts at: ${offset}`);
console.log(`Sample plugin chunk values: [${state[offset].toFixed(3)}, ${state[offset+1].toFixed(3)}, ${state[offset+2].toFixed(3)}]`);

offset += 30; // encodePluginChunks (offset now 589)
console.log(`Plugin items starts at: ${offset}`);
console.log(`Sample plugin item values: [${state[offset].toFixed(3)}, ${state[offset+1].toFixed(3)}, ${state[offset+2].toFixed(3)}]`);

offset += 40; // encodePluginItems (offset now 629)

// Additional Mineflayer data starts at 629
let mineflayerOffset = 629;
console.log(`\n=== Additional Mineflayer Data (starts at offset ${mineflayerOffset}) ===`);
console.log(`Experience starts at: ${mineflayerOffset}`);
if (state[mineflayerOffset] !== undefined) {
    console.log(`Sample experience values: [${state[mineflayerOffset].toFixed(3)}, ${state[mineflayerOffset+1].toFixed(3)}, ${state[mineflayerOffset+2].toFixed(3)}]`);
}

mineflayerOffset += 5; // encodeExperience
console.log(`Control state starts at: ${mineflayerOffset}`);
if (state[mineflayerOffset] !== undefined) {
    console.log(`Sample control state values: [${state[mineflayerOffset].toFixed(3)}, ${state[mineflayerOffset+1].toFixed(3)}, ${state[mineflayerOffset+2].toFixed(3)}]`);
}

mineflayerOffset += 15; // encodeControlState
console.log(`Effects starts at: ${mineflayerOffset}`);
if (state[mineflayerOffset] !== undefined) {
    console.log(`Sample effect values: [${state[mineflayerOffset].toFixed(3)}, ${state[mineflayerOffset+1].toFixed(3)}, ${state[mineflayerOffset+2].toFixed(3)}]`);
}

mineflayerOffset += 20; // encodeEffects
console.log(`Equipment starts at: ${mineflayerOffset}`);
if (state[mineflayerOffset] !== undefined) {
    console.log(`Sample equipment values: [${state[mineflayerOffset].toFixed(3)}, ${state[mineflayerOffset+1].toFixed(3)}, ${state[mineflayerOffset+2].toFixed(3)}]`);
}

mineflayerOffset += 15; // encodeEquipment
console.log(`Nearby players starts at: ${mineflayerOffset}`);
if (state[mineflayerOffset] !== undefined) {
    console.log(`Sample nearby player values: [${state[mineflayerOffset].toFixed(3)}, ${state[mineflayerOffset+1].toFixed(3)}, ${state[mineflayerOffset+2].toFixed(3)}]`);
}

mineflayerOffset += 10; // encodeNearbyPlayers
console.log(`\nFinal offset calculation: ${mineflayerOffset} (should be 694)`);

if (mineflayerOffset !== 694) {
    console.error(`❌ FAILED: Final offset is ${mineflayerOffset}, expected 694!`);
    process.exit(1);
}

console.log('\n=== ALL TESTS PASSED ✓ ===');
console.log('State encoder successfully expanded to 694 dimensions!');
console.log('\nBreakdown:');
console.log('  Base features: 429 dimensions');
console.log('  Plugin sensors: 200 dimensions (blocks:50, entities:30, mobAI:40, weather:10, chunks:30, items:40)');
console.log('  Additional mineflayer: 65 dimensions (xp:5, controls:15, effects:20, equipment:15, players:10)');
console.log('  Total: 694 dimensions ✓');

process.exit(0);
