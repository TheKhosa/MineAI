#!/usr/bin/env node
/**
 * Fix entity name undefined error
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'ml_state_encoder.js');

console.log('[ENTITY NAME FIX] Reading ml_state_encoder.js...');
let content = fs.readFileSync(filePath, 'utf8');

const oldCode1 = `        // Nearby danger (hostile mobs within 8 blocks)
        const hostileMobs = Object.values(bot.entities).filter(e =>
            e.position &&
            e.position.distanceTo(bot.entity.position) < 8 &&
            ['zombie', 'skeleton', 'spider', 'creeper', 'enderman'].includes(e.name)
        );`;

const newCode1 = `        // Nearby danger (hostile mobs within 8 blocks)
        const hostileMobs = Object.values(bot.entities).filter(e =>
            e.position &&
            e.position.distanceTo(bot.entity.position) < 8 &&
            e.name && ['zombie', 'skeleton', 'spider', 'creeper', 'enderman'].includes(e.name)
        );`;

const oldCode2 = `        // Safety: affected by nearby hostiles
        const nearbyHostiles = Object.values(bot.entities).filter(e =>
            e.position &&
            e.position.distanceTo(bot.entity.position) < 16 &&
            ['zombie', 'skeleton', 'spider', 'creeper'].includes(e.name)
        );`;

const newCode2 = `        // Safety: affected by nearby hostiles
        const nearbyHostiles = Object.values(bot.entities).filter(e =>
            e.position &&
            e.position.distanceTo(bot.entity.position) < 16 &&
            e.name && ['zombie', 'skeleton', 'spider', 'creeper'].includes(e.name)
        );`;

console.log('[ENTITY NAME FIX] Applying patch 1/2 (line 285)...');
content = content.replace(oldCode1, newCode1);

console.log('[ENTITY NAME FIX] Applying patch 2/2 (line 710)...');
content = content.replace(oldCode2, newCode2);

console.log('[ENTITY NAME FIX] Writing fixed version...');
fs.writeFileSync(filePath, content, 'utf8');

console.log('[ENTITY NAME FIX] ✅ Successfully added entity.name safety checks!');
console.log('[ENTITY NAME FIX] This prevents "Cannot read properties of undefined (reading \'includes\')" error');
