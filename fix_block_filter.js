#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'AgentSensorPlugin/src/main/java/com/mineagents/sensors/api/sensors/BlockSensor.java');

console.log('[BLOCK FILTER FIX] Reading BlockSensor.java...');
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the getBlockData method
const oldMethod = `                    Block block = center.getWorld().getBlockAt(centerX + x, centerY + y, centerZ + z);

                    SensorAPI.BlockData data = new SensorAPI.BlockData();
                    data.x = block.getX();
                    data.y = block.getY();
                    data.z = block.getZ();
                    data.type = block.getType().name();
                    data.lightLevel = block.getLightLevel();
                    data.isPassable = block.isPassable();
                    data.metadata = getBlockMetadata(block);

                    blocks.add(data);`;

const newMethod = `                    Block block = center.getWorld().getBlockAt(centerX + x, centerY + y, centerZ + z);
                    Material type = block.getType();

                    // PERFORMANCE FIX: Skip air and common terrain blocks to reduce data size
                    // This prevents stack overflow when processing 33k+ blocks
                    if (shouldSkipBlock(type)) {
                        continue;
                    }

                    SensorAPI.BlockData data = new SensorAPI.BlockData();
                    data.x = block.getX();
                    data.y = block.getY();
                    data.z = block.getZ();
                    data.type = type.name();
                    data.lightLevel = block.getLightLevel();
                    data.isPassable = block.isPassable();
                    data.metadata = getBlockMetadata(block);

                    blocks.add(data);`;

content = content.replace(oldMethod, newMethod);

// Add the shouldSkipBlock method before the getBlockMetadata method
const insertPoint = '    private Map<String, Object> getBlockMetadata(Block block) {';
const newSkipMethod = `    /**
     * Determine if a block should be skipped to reduce data size
     * Skips air, cave air, void air, stone, dirt, grass (common terrain)
     * Keeps ores, structures, fluids, and interactive blocks
     */
    private boolean shouldSkipBlock(Material type) {
        switch (type) {
            // Skip all air variants
            case AIR:
            case CAVE_AIR:
            case VOID_AIR:
                return true;

            // Skip extremely common terrain blocks (reduces data by ~90%)
            case STONE:
            case DIRT:
            case GRASS_BLOCK:
            case GRAVEL:
            case SAND:
            case SANDSTONE:
            case ANDESITE:
            case DIORITE:
            case GRANITE:
                return true;

            // Keep everything else (ores, structures, fluids, interactive blocks)
            default:
                return false;
        }
    }

    `;

content = content.replace(insertPoint, newSkipMethod + insertPoint);

fs.writeFileSync(filePath, content, 'utf8');
console.log('[BLOCK FILTER FIX] ✅ Added block filtering to skip air and common terrain');
console.log('[BLOCK FILTER FIX] Expected reduction: ~90% fewer blocks sent (3k-5k instead of 33k)');
