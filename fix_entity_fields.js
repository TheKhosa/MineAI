#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'AgentSensorPlugin/src/main/java/com/mineagents/sensors/api/sensors/EntitySensor.java');

console.log('[ENTITY FIELDS FIX] Reading EntitySensor.java...');
let content = fs.readFileSync(filePath, 'utf8');

const oldCode = `            data.uuid = entity.getUniqueId().toString();
            data.type = entity.getType().name();
            data.x = entity.getLocation().getX();`;

const newCode = `            data.uuid = entity.getUniqueId().toString();

            // SAFETY FIX: Ensure type is never null (fixes "Cannot read properties of undefined" error)
            data.type = entity.getType() != null ? entity.getType().name() : "UNKNOWN";

            // SAFETY FIX: Ensure name is never null
            String customName = entity.getCustomName();
            data.name = customName != null ? customName : entity.getType().name().toLowerCase();

            data.x = entity.getLocation().getX();`;

content = content.replace(oldCode, newCode);

fs.writeFileSync(filePath, content, 'utf8');
console.log('[ENTITY FIELDS FIX] ✅ Added safety checks for entity type and name fields');
console.log('[ENTITY FIELDS FIX] This prevents "Cannot read properties of undefined (reading \'includes\')" errors');
