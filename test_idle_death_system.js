/**
 * Test Script: Idle Punishment & Death Threshold System
 *
 * This script tests:
 * 1. Idle penalty application when agents don't take meaningful actions
 * 2. Cumulative reward tracking
 * 3. Automatic termination when cumulative reward drops below -20
 * 4. New generation spawning after death
 */

const config = require('./config');

console.log('=== IDLE PUNISHMENT & DEATH THRESHOLD SYSTEM TEST ===\n');

// Display configuration
console.log('Current Configuration:');
console.log('---------------------');
console.log(`Idle Penalty Enabled: ${config.features.enableIdlePenalty}`);
console.log(`Idle Penalty Amount: ${config.features.idlePenaltyAmount} (per check)`);
console.log(`Idle Check Interval: ${config.features.idleCheckInterval}ms`);
console.log(`Idle Threshold: ${config.features.idleThreshold}ms (${config.features.idleThreshold / 1000}s)`);
console.log();
console.log(`Death Threshold Enabled: ${config.features.enableRewardThresholdDeath}`);
console.log(`Death Reward Threshold: ${config.features.deathRewardThreshold}`);
console.log(`Death Check Interval: ${config.features.checkDeathInterval}ms`);
console.log();

// Simulate idle punishment accumulation
console.log('Simulated Idle Punishment Scenario:');
console.log('-----------------------------------');

let cumulativeReward = 0;
let timeElapsed = 0;
const idleCheckInterval = config.features.idleCheckInterval;
const idlePenalty = config.features.idlePenaltyAmount;
const deathThreshold = config.features.deathRewardThreshold;

console.log(`Starting with cumulative reward: ${cumulativeReward}`);
console.log();

let deathOccurred = false;
let checkCount = 0;

while (!deathOccurred && checkCount < 50) {
    checkCount++;
    timeElapsed += idleCheckInterval;

    // Apply idle penalty
    cumulativeReward += idlePenalty;

    console.log(`[${(timeElapsed / 1000).toFixed(1)}s] Idle penalty applied: ${idlePenalty.toFixed(1)} | Cumulative: ${cumulativeReward.toFixed(2)}`);

    // Check death threshold
    if (cumulativeReward < deathThreshold) {
        console.log();
        console.log(`💀 DEATH THRESHOLD REACHED!`);
        console.log(`   Time survived: ${(timeElapsed / 1000).toFixed(1)}s`);
        console.log(`   Final cumulative reward: ${cumulativeReward.toFixed(2)}`);
        console.log(`   Death threshold: ${deathThreshold}`);
        console.log(`   Agent will be terminated and new generation spawned.`);
        deathOccurred = true;
    }
}

console.log();
console.log('Test Summary:');
console.log('-------------');
console.log(`Expected death after ~${Math.abs(deathThreshold / idlePenalty)} idle checks`);
console.log(`Actual death after ${checkCount} idle checks`);
console.log(`Time to death: ${(timeElapsed / 1000).toFixed(1)} seconds`);
console.log();

// Show what happens with some positive rewards
console.log('Scenario with Mixed Rewards:');
console.log('----------------------------');

cumulativeReward = 0;
timeElapsed = 0;
checkCount = 0;
deathOccurred = false;

console.log('Agent takes some good actions interspersed with idle periods:');
console.log();

const mixedRewards = [
    { time: 3, reward: 5.0, reason: 'pickup items' },
    { time: 3, reward: -2.0, reason: 'idle' },
    { time: 3, reward: 15.0, reason: 'new chunk explored' },
    { time: 3, reward: -2.0, reason: 'idle' },
    { time: 3, reward: -2.0, reason: 'idle' },
    { time: 3, reward: 10.0, reason: 'crafted pickaxe' },
    { time: 3, reward: -2.0, reason: 'idle' },
    { time: 3, reward: -2.0, reason: 'idle' },
    { time: 3, reward: -2.0, reason: 'idle' },
    { time: 3, reward: -2.0, reason: 'idle' },
    { time: 3, reward: -2.0, reason: 'idle' },
    { time: 3, reward: -2.0, reason: 'idle' }
];

for (const { time, reward, reason } of mixedRewards) {
    timeElapsed += time * 1000;
    cumulativeReward += reward;

    const prefix = reward > 0 ? '✓' : '×';
    console.log(`[${(timeElapsed / 1000).toFixed(1)}s] ${prefix} ${reason}: ${reward >= 0 ? '+' : ''}${reward.toFixed(1)} | Cumulative: ${cumulativeReward.toFixed(2)}`);

    if (cumulativeReward < deathThreshold) {
        console.log();
        console.log(`💀 DEATH THRESHOLD REACHED at ${(timeElapsed / 1000).toFixed(1)}s`);
        console.log(`   Final cumulative reward: ${cumulativeReward.toFixed(2)}`);
        break;
    }
}

console.log();
console.log('=== TEST COMPLETE ===');
console.log();
console.log('To run the actual system with these settings:');
console.log('  node server.js');
console.log();
console.log('Watch for log messages:');
console.log('  [IDLE] - Idle penalty warnings');
console.log('  [ML REWARD] - Cumulative reward tracking (2% of steps)');
console.log('  [DEATH THRESHOLD] - Agent termination messages');
console.log();
