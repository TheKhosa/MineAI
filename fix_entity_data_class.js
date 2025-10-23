#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'AgentSensorPlugin/src/main/java/com/mineagents/sensors/api/SensorAPI.java');

console.log('[ENTITY DATA CLASS FIX] Reading SensorAPI.java...');
let content = fs.readFileSync(filePath, 'utf8');

const oldCode = `    public static class EntityData {
        public String uuid;
        public String type;
        public double x, y, z;
        public float yaw, pitch;
        public double health;
        public boolean isHostile;
        public String aiState;
    }`;

const newCode = `    public static class EntityData {
        public String uuid;
        public String type;
        public String name; // ADDED: Entity name field to prevent undefined errors in ML encoder
        public double x, y, z;
        public float yaw, pitch;
        public double health;
        public boolean isHostile;
        public String aiState;
    }`;

content = content.replace(oldCode, newCode);

fs.writeFileSync(filePath, content, 'utf8');
console.log('[ENTITY DATA CLASS FIX] ✅ Added name field to EntityData class');
console.log('[ENTITY DATA CLASS FIX] This ensures all entities have type and name fields');
