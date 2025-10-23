#!/usr/bin/env node
/**
 * Script to expose activeAgents on global object
 * This fixes the stack overflow in ml_trainer.js calculateReward()
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');

console.log('[GLOBAL FIX] Reading server.js...');
let content = fs.readFileSync(serverPath, 'utf8');

const oldCode = `const activeAgents = new Map();
const agentPopulation = new Map();

const lineageTracker = {`;

const newCode = `const activeAgents = new Map();
const agentPopulation = new Map();

// Expose activeAgents globally for ML trainer's calculateReward() method
global.activeAgents = activeAgents;

const lineageTracker = {`;

if (!content.includes(oldCode)) {
    console.error('[GLOBAL FIX] ERROR: Could not find the code to replace. File may have already been patched.');
    process.exit(1);
}

console.log('[GLOBAL FIX] Applying patch...');
content = content.replace(oldCode, newCode);

console.log('[GLOBAL FIX] Writing fixed version...');
fs.writeFileSync(serverPath, content, 'utf8');

console.log('[GLOBAL FIX] ✅ Successfully exposed global.activeAgents!');
console.log('[GLOBAL FIX] This fixes the stack overflow error in ml_trainer.js calculateReward()');
