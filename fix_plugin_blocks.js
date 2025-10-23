#!/usr/bin/env node
/**
 * Fix plugin block data stack overflow
 * Limits blocks to 1000 to prevent Math.max(...blocks.map()) overflow
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'ml_state_encoder.js');

console.log('[PLUGIN BLOCKS FIX] Reading ml_state_encoder.js...');
let content = fs.readFileSync(filePath, 'utf8');

const oldCode = `    encodePluginBlockData(bot, state, offset) {
        if (!bot.pluginSensorData || !bot.pluginSensorData.blocks) {
            return offset + 50; // Skip if no data
        }

        const blocks = bot.pluginSensorData.blocks;`;

const newCode = `    encodePluginBlockData(bot, state, offset) {
        if (!bot.pluginSensorData || !bot.pluginSensorData.blocks) {
            return offset + 50; // Skip if no data
        }

        // CRITICAL FIX: Limit blocks to prevent stack overflow
        // Plugin sends 274k+ blocks which causes Math.max(...blocks.map()) to overflow at line 1199
        // Only use nearest 1000 blocks for encoding (reduces processing from 274k to 1k)
        const allBlocks = bot.pluginSensorData.blocks;
        const blocks = allBlocks.length > 1000 ? allBlocks.slice(0, 1000) : allBlocks;`;

if (!content.includes('const blocks = bot.pluginSensorData.blocks;')) {
    console.error('[PLUGIN BLOCKS FIX] ERROR: Could not find the code to patch.');
    process.exit(1);
}

console.log('[PLUGIN BLOCKS FIX] Applying patch...');
content = content.replace(oldCode, newCode);

console.log('[PLUGIN BLOCKS FIX] Writing fixed version...');
fs.writeFileSync(filePath, content, 'utf8');

console.log('[PLUGIN BLOCKS FIX] ✅ Successfully limited plugin block data to 1000 blocks!');
console.log('[PLUGIN BLOCKS FIX] This prevents stack overflow in Math.max(...blocks.map()) at line 1199');
