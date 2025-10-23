#!/usr/bin/env node
/**
 * Fix entity type undefined error in plugin data encoding
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'ml_state_encoder.js');

console.log('[ENTITY TYPE FIX] Reading ml_state_encoder.js...');
let content = fs.readFileSync(filePath, 'utf8');

const oldCode = `        // Feature 1-3: Entity type distribution
        const hostile = entities.filter(e => ['ZOMBIE', 'SKELETON', 'SPIDER', 'CREEPER', 'ENDERMAN'].includes(e.type)).length;
        const passive = entities.filter(e => ['COW', 'PIG', 'SHEEP', 'CHICKEN'].includes(e.type)).length;
        const neutral = entities.filter(e => ['WOLF', 'IRON_GOLEM', 'VILLAGER'].includes(e.type)).length;`;

const newCode = `        // Feature 1-3: Entity type distribution
        // SAFETY: Filter out entities without type field (plugin may send incomplete data)
        const hostile = entities.filter(e => e.type && ['ZOMBIE', 'SKELETON', 'SPIDER', 'CREEPER', 'ENDERMAN'].includes(e.type)).length;
        const passive = entities.filter(e => e.type && ['COW', 'PIG', 'SHEEP', 'CHICKEN'].includes(e.type)).length;
        const neutral = entities.filter(e => e.type && ['WOLF', 'IRON_GOLEM', 'VILLAGER'].includes(e.type)).length;`;

if (!content.includes(`const hostile = entities.filter(e => ['ZOMBIE'`)) {
    console.error('[ENTITY TYPE FIX] ERROR: Could not find the code to patch.');
    process.exit(1);
}

console.log('[ENTITY TYPE FIX] Applying patch 1/2...');
content = content.replace(oldCode, newCode);

// Fix second occurrence
const oldCode2 = `        // Feature 4-8: Closest 5 hostile mobs with distance and health
        const hostileMobs = entities
            .filter(e => ['ZOMBIE', 'SKELETON', 'SPIDER', 'CREEPER', 'ENDERMAN'].includes(e.type))`;

const newCode2 = `        // Feature 4-8: Closest 5 hostile mobs with distance and health
        const hostileMobs = entities
            .filter(e => e.type && ['ZOMBIE', 'SKELETON', 'SPIDER', 'CREEPER', 'ENDERMAN'].includes(e.type))`;

console.log('[ENTITY TYPE FIX] Applying patch 2/2...');
content = content.replace(oldCode2, newCode2);

console.log('[ENTITY TYPE FIX] Writing fixed version...');
fs.writeFileSync(filePath, content, 'utf8');

console.log('[ENTITY TYPE FIX] ✅ Successfully added entity.type safety checks!');
console.log('[ENTITY TYPE FIX] This prevents "Cannot read properties of undefined (reading \'includes\')" error');
