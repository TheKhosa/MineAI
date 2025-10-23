#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'AgentSensorPlugin/src/main/java/com/mineagents/sensors/AgentSensorPlugin.java');

console.log('[PLUGIN RADIUS FIX] Reading AgentSensorPlugin.java...');
let content = fs.readFileSync(filePath, 'utf8');

const oldCode = '    private static final int SENSOR_RADIUS = 32; // blocks';
const newCode = '    private static final int SENSOR_RADIUS = 16; // blocks (reduced from 32 to prevent stack overflow - was 274k blocks!)';

content = content.replace(oldCode, newCode);

fs.writeFileSync(filePath, content, 'utf8');
console.log('[PLUGIN RADIUS FIX] ✅ Reduced sensor radius from 32 to 16 blocks');
console.log('[PLUGIN RADIUS FIX] This reduces blocks from 274,625 to 33,856 (87% reduction)');
