/**
 * Verify Action Integration
 * Tests that all 10 new action modules are properly integrated
 */

const ActionSpace = require('./ml_action_space');

console.log('=== ACTION SPACE INTEGRATION VERIFICATION ===\n');

// Initialize ActionSpace
const actionSpace = new ActionSpace();

console.log('[INFO] ActionSpace initialized successfully');
console.log('[INFO] Total actions:', actionSpace.ACTION_COUNT);
console.log('[INFO] Actions array length:', actionSpace.actions.length);
console.log();

// Verify action count matches
if (actionSpace.ACTION_COUNT === actionSpace.actions.length) {
    console.log('[✓] ACTION_COUNT matches actions array length');
} else {
    console.log('[✗] MISMATCH: ACTION_COUNT =', actionSpace.ACTION_COUNT, 'vs array length =', actionSpace.actions.length);
}
console.log();

// Check for sequential IDs
console.log('[INFO] Checking action ID sequence...');
let sequentialErrors = 0;
for (let i = 0; i < actionSpace.actions.length; i++) {
    if (actionSpace.actions[i].id !== i) {
        console.log(`[✗] ID mismatch at index ${i}: expected ${i}, got ${actionSpace.actions[i].id}`);
        sequentialErrors++;
    }
}

if (sequentialErrors === 0) {
    console.log('[✓] All action IDs are sequential (0 to', actionSpace.ACTION_COUNT - 1, ')');
} else {
    console.log('[✗] Found', sequentialErrors, 'sequential ID errors');
}
console.log();

// Find the 10 new action modules
const newModules = {
    dimension: { start: 216, end: 224, count: 0 },
    hotbar: { start: 225, end: 237, count: 0 },
    combat_timing: { start: 238, end: 248, count: 0 },
    villager_trading: { start: 249, end: 255, count: 0 },
    tool_management: { start: 256, end: 264, count: 0 },
    storage: { start: 265, end: 271, count: 0 },
    vehicle: { start: 272, end: 279, count: 0 },
    spawn_management: { start: 280, end: 286, count: 0 },
    fishing: { start: 287, end: 290, count: 0 },
    flight: { start: 291, end: 296, count: 0 }
};

console.log('[INFO] Verifying 10 new action modules (IDs 216-296)...');
console.log();

// Count actions in each module
for (const action of actionSpace.actions) {
    for (const [moduleName, range] of Object.entries(newModules)) {
        if (action.id >= range.start && action.id <= range.end) {
            range.count++;
        }
    }
}

// Report results
let totalNewActions = 0;
let allModulesPresent = true;

for (const [moduleName, range] of Object.entries(newModules)) {
    const expectedCount = range.end - range.start + 1;
    const isCorrect = range.count === expectedCount;
    const status = isCorrect ? '✓' : '✗';

    console.log(`[${status}] ${moduleName.padEnd(20)} IDs ${range.start}-${range.end}  Found: ${range.count}/${expectedCount}`);

    totalNewActions += range.count;
    if (!isCorrect) allModulesPresent = false;
}

console.log();
console.log('[INFO] Total new actions found:', totalNewActions);
console.log();

// Show action breakdown
console.log('=== ACTION BREAKDOWN ===');
console.log('[INFO] Actions 0-75: Core actions');
console.log('[INFO] Actions 76-215: Original modular actions (140 actions)');
console.log('[INFO] Actions 216-296: NEW advanced modules (81 actions)');
console.log('[INFO] Actions 297+: Essential modules (Batch 2)');
console.log();

// Show first and last actions from new modules
console.log('=== SAMPLE ACTIONS FROM NEW MODULES ===');
const sampleIds = [216, 225, 238, 249, 256, 265, 272, 280, 287, 291, 296];
for (const id of sampleIds) {
    if (actionSpace.actions[id]) {
        const action = actionSpace.actions[id];
        console.log(`[${id}] ${action.name.padEnd(30)} type: ${action.type}`);
    }
}
console.log();

// Final summary
console.log('=== INTEGRATION SUMMARY ===');
if (allModulesPresent && sequentialErrors === 0) {
    console.log('[✓] ALL 10 MODULES INTEGRATED SUCCESSFULLY!');
    console.log('[✓] All action IDs are sequential');
    console.log('[✓] Total action count:', actionSpace.ACTION_COUNT);
    console.log();
    console.log('The integration is complete and ready for use.');
} else {
    console.log('[✗] Integration has issues that need attention');
}
