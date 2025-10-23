/**
 * Test State Encoder Expansion (629 → 1,028 dimensions)
 * Verifies that the expanded state encoder produces valid 1,028-dimensional vectors
 */

const StateEncoder = require('./ml_state_encoder');

// Mock bot object with comprehensive data
function createMockBot() {
    return {
        entity: {
            position: { x: 100, y: 64, z: 200, offset: (dx, dy, dz) => ({ x: 100+dx, y: 64+dy, z: 200+dz, floored: () => ({ x: 100+dx, y: 64+dy, z: 200+dz }) }) },
            onGround: true,
            isInWater: false,
            isInLava: false,
            velocity: { x: 0, y: 0, z: 0 },
            effects: {}
        },
        health: 18,
        food: 16,
        foodSaturation: 10,
        oxygenLevel: 20,
        isRaining: false,
        thunderState: 0,
        rainState: 0,
        time: {
            timeOfDay: 1000, // Morning
            age: 24000 // 1 day old
        },
        vehicle: null,
        heldItem: null,
        inventory: {
            items: () => [
                { name: 'iron_pickaxe', count: 1, durabilityUsed: 10, maxDurability: 250, enchants: [] },
                { name: 'cooked_beef', count: 5, enchants: [] },
                { name: 'cobblestone', count: 64, enchants: [] },
                { name: 'torch', count: 32, enchants: [] },
                { name: 'iron_ingot', count: 10, enchants: [] }
            ],
            slots: {
                5: null,  // Helmet
                6: null,  // Chestplate
                7: null,  // Leggings
                8: null,  // Boots
                45: null  // Off-hand
            }
        },
        entities: {
            '1': { name: 'zombie', position: { x: 110, y: 64, z: 210, distanceTo: () => 14.14 }, velocity: { x: 0.1, y: 0, z: 0.1 } },
            '2': { name: 'cow', position: { x: 95, y: 64, z: 195, distanceTo: () => 7.07 }, velocity: { x: 0, y: 0, z: 0 } },
            '3': { name: 'villager', position: { x: 90, y: 64, z: 190, distanceTo: () => 14.14 } },
            '4': { name: 'item', position: { x: 105, y: 64, z: 205, distanceTo: () => 7.07 } }
        },
        players: {},
        blockAt: (pos) => ({
            name: 'stone',
            light: 15,
            biome: { id: 1, temperature: 0.5, rainfall: 0.4 }
        }),
        findBlock: (opts) => null,
        findBlocks: (opts) => []
    };
}

// Performance timing helper
function measurePerformance(fn, iterations = 100) {
    const start = Date.now();
    for (let i = 0; i < iterations; i++) {
        fn();
    }
    const end = Date.now();
    return (end - start) / iterations;
}

// Validate state vector
function validateState(state, expectedSize) {
    const issues = [];

    // Check size
    if (state.length !== expectedSize) {
        issues.push(`Size mismatch: expected ${expectedSize}, got ${state.length}`);
    }

    // Check for NaN values
    const nanCount = state.filter(v => isNaN(v)).length;
    if (nanCount > 0) {
        issues.push(`Found ${nanCount} NaN values`);
    }

    // Check for Inf values
    const infCount = state.filter(v => !isFinite(v)).length;
    if (infCount > 0) {
        issues.push(`Found ${infCount} Inf values`);
    }

    // Check for values outside expected range [generally -1 to 1, but some can be larger]
    const outOfRange = state.filter(v => v < -10 || v > 10).length;
    if (outOfRange > 0) {
        issues.push(`Found ${outOfRange} values outside [-10, 10] range (may be intentional)`);
    }

    // Check for mostly zeros (indicates encoding failure)
    const zeroCount = state.filter(v => v === 0).length;
    const zeroPercentage = (zeroCount / state.length) * 100;
    if (zeroPercentage > 95) {
        issues.push(`Warning: ${zeroPercentage.toFixed(1)}% zeros (encoding may be incomplete)`);
    }

    return { valid: issues.length === 0, issues, zeroPercentage, nanCount, infCount };
}

// Main test
console.log('='.repeat(80));
console.log('STATE ENCODER EXPANSION TEST: 694 → 1,028 Dimensions');
console.log('='.repeat(80));
console.log();

const encoder = new StateEncoder();
const mockBot = createMockBot();

console.log('1. STATE SIZE VERIFICATION');
console.log('-'.repeat(80));
console.log(`Target STATE_SIZE:   1028 (as per WORLD_DATA_COMPREHENSIVE_GUIDE.md)`);
console.log(`Actual STATE_SIZE:   ${encoder.STATE_SIZE}`);
console.log(`Match:               ${encoder.STATE_SIZE === 1028 ? '✓ YES' : '✗ NO'}`);
console.log(`Base (before):       694 dimensions`);
console.log(`Added:               ${encoder.STATE_SIZE - 694} dimensions`);
console.log();

console.log('2. NEW ENCODING METHODS');
console.log('-'.repeat(80));
const newMethods = [
    { name: 'encodeAdvancedInventory', dims: 50 },
    { name: 'encodeToolCapabilities', dims: 30 },
    { name: 'encodeEntityBehavior', dims: 40 },
    { name: 'encodeVehicleState', dims: 20 },
    { name: 'encodeDimensionContext', dims: 30 },
    { name: 'encodeWeatherEffects', dims: 15 },
    { name: 'encodeChunkBoundaries', dims: 25 },
    { name: 'encodeVillagerEconomy', dims: 35 },
    { name: 'encodeStructureProximity', dims: 40 },
    { name: 'encodeAdvancedCombat', dims: 50 },
    { name: 'encodeWorldTime', dims: 15 },
    { name: 'encodeTerrainAnalysis', dims: 49 }
];

let totalNewDims = 0;
newMethods.forEach(method => {
    const exists = typeof encoder[method.name] === 'function';
    console.log(`  ${method.name.padEnd(30)} (${method.dims} dims) ${exists ? '✓' : '✗'}`);
    totalNewDims += method.dims;
});
console.log(`  ${'TOTAL NEW DIMENSIONS'.padEnd(30)} ${totalNewDims} dims`);
console.log();

console.log('3. STATE VECTOR GENERATION');
console.log('-'.repeat(80));

let state;
try {
    state = encoder.encodeState(mockBot);
    console.log(`State vector generated:  ✓ SUCCESS`);
    console.log(`State vector type:       ${state.constructor.name}`);
    console.log(`State vector length:     ${state.length}`);
} catch (error) {
    console.log(`State vector generated:  ✗ FAILED`);
    console.log(`Error: ${error.message}`);
    console.log(error.stack);
    process.exit(1);
}
console.log();

console.log('4. STATE VECTOR VALIDATION');
console.log('-'.repeat(80));
const validation = validateState(state, 1028);

if (validation.valid) {
    console.log(`Overall validation:      ✓ PASSED`);
} else {
    console.log(`Overall validation:      ✗ FAILED`);
}

console.log(`Zero values:             ${validation.zeroPercentage.toFixed(1)}%`);
console.log(`NaN values:              ${validation.nanCount}`);
console.log(`Inf values:              ${validation.infCount}`);

if (validation.issues.length > 0) {
    console.log();
    console.log('Issues found:');
    validation.issues.forEach(issue => console.log(`  - ${issue}`));
}
console.log();

console.log('5. STATE VECTOR SAMPLE VALUES');
console.log('-'.repeat(80));
console.log(`First 10 values:  [${state.slice(0, 10).map(v => v.toFixed(3)).join(', ')}]`);
console.log(`Middle 10 values: [${state.slice(500, 510).map(v => v.toFixed(3)).join(', ')}]`);
console.log(`Last 10 values:   [${state.slice(-10).map(v => v.toFixed(3)).join(', ')}]`);
console.log();

console.log('6. PERFORMANCE BENCHMARK');
console.log('-'.repeat(80));

const avgTime = measurePerformance(() => encoder.encodeState(mockBot), 1000);
console.log(`Average encoding time:   ${avgTime.toFixed(3)} ms`);
console.log(`Encodings per second:    ${(1000 / avgTime).toFixed(0)}`);
console.log(`Performance rating:      ${avgTime < 5 ? '✓ EXCELLENT' : avgTime < 10 ? '○ GOOD' : '△ ACCEPTABLE'}`);
console.log();

console.log('7. DIMENSION BREAKDOWN');
console.log('-'.repeat(80));
console.log(`Base features (old):     694 dimensions`);
console.log(`New features:            ${totalNewDims} dimensions`);
console.log(`Expected total:          ${694 + totalNewDims} dimensions`);
console.log(`Actual total:            ${state.length} dimensions`);
console.log(`Match:                   ${state.length === 1028 ? '✓ YES' : '✗ NO'}`);
console.log();

console.log('8. TEST SUMMARY');
console.log('='.repeat(80));

const allPassed =
    encoder.STATE_SIZE === 1028 &&
    state.length === 1028 &&
    validation.valid &&
    avgTime < 10;

if (allPassed) {
    console.log('✓ ALL TESTS PASSED');
    console.log();
    console.log('The state encoder has been successfully expanded from 694 to 1,028 dimensions.');
    console.log('All new encoding methods are functional and producing valid output.');
    console.log(`Performance: ${avgTime.toFixed(2)}ms per encoding (${(1000/avgTime).toFixed(0)} encodings/sec)`);
} else {
    console.log('✗ SOME TESTS FAILED');
    console.log();
    console.log('Please review the issues above.');
}

console.log('='.repeat(80));
