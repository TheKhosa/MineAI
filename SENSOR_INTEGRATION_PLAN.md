# Comprehensive Sensor Integration Plan

## Executive Summary
**Current State:** Plugin sensor data (274K+ blocks) is collected but NOT encoded into ML state vector.
**Goal:** Integrate ALL Bukkit plugin sensors AND missing Mineflayer data into StateEncoder for complete decision-making.

---

## Part 1: Bukkit Plugin Sensor Integration (HIGH PRIORITY)

### Current State Vector Size: 429 dimensions
### **Proposed New Size: 629 dimensions (+200 for plugin data)**

### 1.1 Enhanced Block Data from Plugin (50 dimensions)
**Source:** `bot.pluginSensorData.blocks` (274,625 blocks with metadata)

**Add to StateEncoder:**
```javascript
encodePluginBlockData(bot, state, offset) {
    if (!bot.pluginSensorData || !bot.pluginSensorData.blocks) {
        return offset + 50; // Skip if no data
    }

    const blocks = bot.pluginSensorData.blocks;

    // Feature 1-5: Block type distribution (top 5 most common nearby)
    const blockCounts = {};
    blocks.forEach(b => {
        blockCounts[b.type] = (blockCounts[b.type] || 0) + 1;
    });
    const topBlocks = Object.entries(blockCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    for (let i = 0; i < 5; i++) {
        if (i < topBlocks.length) {
            const blockIdx = this.BLOCK_VOCAB.indexOf(topBlocks[i][0]);
            state[offset++] = blockIdx >= 0 ? (blockIdx / this.BLOCK_VOCAB.length) : 0;
        } else {
            state[offset++] = 0;
        }
    }

    // Feature 6-10: Average block properties
    const avgHardness = blocks.reduce((sum, b) => sum + (b.hardness || 0), 0) / blocks.length;
    const avgLightLevel = blocks.reduce((sum, b) => sum + (b.lightLevel || 0), 0) / blocks.length;
    const passableRatio = blocks.filter(b => b.passable).length / blocks.length;
    const solidRatio = blocks.filter(b => b.isSolid).length / blocks.length;
    const flammableRatio = blocks.filter(b => b.isFlammable).length / blocks.length;

    state[offset++] = Math.min(1.0, avgHardness / 50.0);
    state[offset++] = avgLightLevel / 15.0;
    state[offset++] = passableRatio;
    state[offset++] = solidRatio;
    state[offset++] = flammableRatio;

    // Feature 11-20: Directional block analysis (ore distribution by direction)
    // North, South, East, West, Up, Down, Below (for mining), Surface (for building)
    const oreBlocks = blocks.filter(b => b.type.includes('_ore'));
    const northOres = oreBlocks.filter(b => b.z < 0).length;
    const southOres = oreBlocks.filter(b => b.z > 0).length;
    const eastOres = oreBlocks.filter(b => b.x > 0).length;
    const westOres = oreBlocks.filter(b => b.x < 0).length;
    const aboveOres = oreBlocks.filter(b => b.y > 0).length;
    const belowOres = oreBlocks.filter(b => b.y < 0).length;

    state[offset++] = northOres / Math.max(1, oreBlocks.length);
    state[offset++] = southOres / Math.max(1, oreBlocks.length);
    state[offset++] = eastOres / Math.max(1, oreBlocks.length);
    state[offset++] = westOres / Math.max(1, oreBlocks.length);
    state[offset++] = aboveOres / Math.max(1, oreBlocks.length);
    state[offset++] = belowOres / Math.max(1, oreBlocks.length);

    // Feature 21-30: Valuable resources nearby
    const coalCount = blocks.filter(b => b.type === 'coal_ore').length;
    const ironCount = blocks.filter(b => b.type.includes('iron_ore')).length;
    const goldCount = blocks.filter(b => b.type === 'gold_ore').length;
    const diamondCount = blocks.filter(b => b.type.includes('diamond_ore')).length;
    const redstoneCount = blocks.filter(b => b.type === 'redstone_ore').length;
    const lapisCount = blocks.filter(b => b.type === 'lapis_ore').length;
    const emeraldCount = blocks.filter(b => b.type === 'emerald_ore').length;
    const ancientDebrisCount = blocks.filter(b => b.type === 'ancient_debris').length;

    state[offset++] = Math.min(1.0, coalCount / 20.0);
    state[offset++] = Math.min(1.0, ironCount / 10.0);
    state[offset++] = Math.min(1.0, goldCount / 5.0);
    state[offset++] = Math.min(1.0, diamondCount / 3.0);
    state[offset++] = Math.min(1.0, redstoneCount / 10.0);
    state[offset++] = Math.min(1.0, lapisCount / 5.0);
    state[offset++] = Math.min(1.0, emeraldCount / 2.0);
    state[offset++] = Math.min(1.0, ancientDebrisCount / 1.0);

    // Feature 31-40: Environmental blocks
    const waterCount = blocks.filter(b => b.type === 'water').length;
    const lavaCount = blocks.filter(b => b.type === 'lava').length;
    const woodCount = blocks.filter(b => b.type.includes('_log')).length;
    const leavesCount = blocks.filter(b => b.type.includes('_leaves')).length;
    const dirtCount = blocks.filter(b => b.type === 'dirt' || b.type === 'grass_block').length;
    const stoneCount = blocks.filter(b => b.type === 'stone' || b.type === 'deepslate').length;
    const sandCount = blocks.filter(b => b.type === 'sand').length;
    const gravelCount = blocks.filter(b => b.type === 'gravel').length;
    const occludingRatio = blocks.filter(b => b.isOccluding).length / blocks.length;
    const airRatio = blocks.filter(b => b.type === 'air').length / blocks.length;

    state[offset++] = Math.min(1.0, waterCount / 50.0);
    state[offset++] = Math.min(1.0, lavaCount / 10.0);
    state[offset++] = Math.min(1.0, woodCount / 20.0);
    state[offset++] = Math.min(1.0, leavesCount / 100.0);
    state[offset++] = Math.min(1.0, dirtCount / 100.0);
    state[offset++] = Math.min(1.0, stoneCount / 200.0);
    state[offset++] = Math.min(1.0, sandCount / 50.0);
    state[offset++] = Math.min(1.0, gravelCount / 20.0);
    state[offset++] = occludingRatio;
    state[offset++] = airRatio;

    return offset;
}
```

### 1.2 Enhanced Entity Data from Plugin (30 dimensions)
**Source:** `bot.pluginSensorData.entities`

```javascript
encodePluginEntityData(bot, state, offset) {
    if (!bot.pluginSensorData || !bot.pluginSensorData.entities) {
        return offset + 30;
    }

    const entities = bot.pluginSensorData.entities.slice(0, 10);

    // Encode 10 entities × 3 features = 30 dimensions
    for (let i = 0; i < 10; i++) {
        if (i < entities.length) {
            const entity = entities[i];

            // Feature 1: Hostility status (0=friendly, 1=hostile)
            state[offset++] = entity.isHostile ? 1.0 : 0.0;

            // Feature 2: AI state encoded (0=idle, 0.5=moving, 1=attacking)
            const aiState = entity.aiState === 'ATTACKING' ? 1.0 :
                           entity.aiState === 'MOVING' ? 0.5 : 0.0;
            state[offset++] = aiState;

            // Feature 3: Health ratio (if available)
            state[offset++] = entity.health ? (entity.health / 20.0) : 0.5;
        } else {
            state[offset++] = 0;
            state[offset++] = 0;
            state[offset++] = 0.5;
        }
    }

    return offset;
}
```

### 1.3 Mob AI Data from Plugin (40 dimensions)
**Source:** `bot.pluginSensorData.mobAI`

```javascript
encodePluginMobAI(bot, state, offset) {
    if (!bot.pluginSensorData || !bot.pluginSensorData.mobAI) {
        return offset + 40;
    }

    const mobAI = bot.pluginSensorData.mobAI.slice(0, 10);

    // Encode 10 mobs × 4 features = 40 dimensions
    for (let i = 0; i < 10; i++) {
        if (i < mobAI.length) {
            const mob = mobAI[i];

            // Feature 1: Has attack target (0=idle, 1=targeting)
            state[offset++] = mob.currentGoal === 'ATTACK_TARGET' ? 1.0 : 0.0;

            // Feature 2: Is targeting ME (critical for danger detection)
            const targetingMe = mob.targetUUID === bot.uuid;
            state[offset++] = targetingMe ? 1.0 : 0.0;

            // Feature 3: Aggression level
            state[offset++] = mob.isAggressive ? 1.0 : 0.0;

            // Feature 4: Has pathfinding active (mob is moving purposefully)
            state[offset++] = (mob.pathfindingNodes && mob.pathfindingNodes.length > 0) ? 1.0 : 0.0;
        } else {
            state[offset++] = 0;
            state[offset++] = 0;
            state[offset++] = 0;
            state[offset++] = 0;
        }
    }

    return offset;
}
```

### 1.4 Enhanced Weather Data from Plugin (10 dimensions)
**Source:** `bot.pluginSensorData.weather`

```javascript
encodePluginWeather(bot, state, offset) {
    if (!bot.pluginSensorData || !bot.pluginSensorData.weather) {
        return offset + 10;
    }

    const weather = bot.pluginSensorData.weather;

    // Feature 1: Rain status (boolean)
    state[offset++] = weather.hasStorm ? 1.0 : 0.0;

    // Feature 2: Thunder status (boolean)
    state[offset++] = weather.isThundering ? 1.0 : 0.0;

    // Feature 3: Weather duration remaining (normalized)
    state[offset++] = Math.min(1.0, (weather.weatherDuration || 0) / 12000.0);

    // Feature 4: World time (ticks)
    state[offset++] = (weather.time % 24000) / 24000.0;

    // Feature 5-8: Time of day classification (one-hot)
    const timeOfDay = weather.timeOfDay; // "MORNING", "DAY", "EVENING", "NIGHT"
    state[offset++] = timeOfDay === 'MORNING' ? 1.0 : 0.0;
    state[offset++] = timeOfDay === 'DAY' ? 1.0 : 0.0;
    state[offset++] = timeOfDay === 'EVENING' ? 1.0 : 0.0;
    state[offset++] = timeOfDay === 'NIGHT' ? 1.0 : 0.0;

    // Feature 9: Is daytime (derived, for convenience)
    state[offset++] = (timeOfDay === 'DAY' || timeOfDay === 'MORNING') ? 1.0 : 0.0;

    // Feature 10: Is nighttime hostile spawn time
    state[offset++] = timeOfDay === 'NIGHT' ? 1.0 : 0.0;

    return offset;
}
```

### 1.5 Chunk Data from Plugin (30 dimensions)
**Source:** `bot.pluginSensorData.chunks`

```javascript
encodePluginChunks(bot, state, offset) {
    if (!bot.pluginSensorData || !bot.pluginSensorData.chunks) {
        return offset + 30;
    }

    const chunkData = bot.pluginSensorData.chunks;

    // Feature 1: Total loaded chunks nearby
    state[offset++] = Math.min(1.0, (chunkData.loadedChunks || 0) / 20.0);

    // Feature 2: Total entities in loaded chunks
    state[offset++] = Math.min(1.0, (chunkData.entityCount || 0) / 100.0);

    // Feature 3: Total tile entities (chests, furnaces, etc.)
    const tileEntityCount = chunkData.chunks ?
        chunkData.chunks.reduce((sum, c) => sum + (c.tileEntities || 0), 0) : 0;
    state[offset++] = Math.min(1.0, tileEntityCount / 50.0);

    // Feature 4-13: Chunk loading status in 9 directions + center (3x3 grid)
    const centerChunkX = Math.floor(bot.entity.position.x / 16);
    const centerChunkZ = Math.floor(bot.entity.position.z / 16);

    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            const chunkX = centerChunkX + dx;
            const chunkZ = centerChunkZ + dz;

            const chunk = chunkData.chunks ?
                chunkData.chunks.find(c => c.chunkX === chunkX && c.chunkZ === chunkZ) : null;

            state[offset++] = (chunk && chunk.isLoaded) ? 1.0 : 0.0;
        }
    }

    // Feature 14-23: Entity density in each direction (3x3 grid)
    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            const chunkX = centerChunkX + dx;
            const chunkZ = centerChunkZ + dz;

            const chunk = chunkData.chunks ?
                chunkData.chunks.find(c => c.chunkX === chunkX && c.chunkZ === chunkZ) : null;

            const entityDensity = chunk ? (chunk.entityCount || 0) / 20.0 : 0.0;
            state[offset++] = Math.min(1.0, entityDensity);
        }
    }

    // Feature 24-30: Reserved for future chunk-related features
    for (let i = 0; i < 7; i++) {
        state[offset++] = 0;
    }

    return offset;
}
```

### 1.6 Dropped Item Data from Plugin (40 dimensions)
**Source:** `bot.pluginSensorData.items`

```javascript
encodePluginItems(bot, state, offset) {
    if (!bot.pluginSensorData || !bot.pluginSensorData.items) {
        return offset + 40;
    }

    const items = bot.pluginSensorData.items.slice(0, 10);

    // Encode 10 dropped items × 4 features = 40 dimensions
    for (let i = 0; i < 10; i++) {
        if (i < items.length) {
            const item = items[i];

            // Feature 1: Item type (encoded as vocab index)
            const itemIdx = this.ITEM_VOCAB.indexOf(item.type);
            state[offset++] = itemIdx >= 0 ? (itemIdx / this.ITEM_VOCAB.length) : 0;

            // Feature 2: Stack amount (normalized)
            state[offset++] = Math.min(1.0, (item.amount || 1) / 64.0);

            // Feature 3: Item age (ticks lived)
            // Newer items = more valuable (despawn after 6000 ticks = 5 min)
            const ageRatio = (item.ticksLived || 0) / 6000.0;
            state[offset++] = Math.min(1.0, 1.0 - ageRatio); // Invert: fresh=1, old=0

            // Feature 4: Distance to item (normalized)
            const dx = item.x - bot.entity.position.x;
            const dy = item.y - bot.entity.position.y;
            const dz = item.z - bot.entity.position.z;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            state[offset++] = Math.min(1.0, 1.0 - (dist / 32.0)); // Closer = higher value
        } else {
            state[offset++] = 0;
            state[offset++] = 0;
            state[offset++] = 0;
            state[offset++] = 0;
        }
    }

    return offset;
}
```

---

## Part 2: Missing Mineflayer Data Integration

### 2.1 Experience and Leveling (5 dimensions)
```javascript
encodeExperience(bot, state, offset) {
    // Feature 1: XP level (normalized)
    state[offset++] = Math.min(1.0, (bot.experience.level || 0) / 30.0);

    // Feature 2: XP points (normalized)
    state[offset++] = Math.min(1.0, (bot.experience.points || 0) / 100.0);

    // Feature 3: XP progress to next level
    const xpProgress = bot.experience.progress || 0;
    state[offset++] = xpProgress;

    // Feature 4: Has enough XP for enchanting (level 30+)
    state[offset++] = (bot.experience.level >= 30) ? 1.0 : 0.0;

    // Feature 5: Has XP for anvil (level 5+)
    state[offset++] = (bot.experience.level >= 5) ? 1.0 : 0.0;

    return offset;
}
```

### 2.2 Control State and Movement (15 dimensions)
```javascript
encodeControlState(bot, state, offset) {
    // Feature 1-6: Control state flags
    state[offset++] = bot.controlState.forward ? 1.0 : 0.0;
    state[offset++] = bot.controlState.back ? 1.0 : 0.0;
    state[offset++] = bot.controlState.left ? 1.0 : 0.0;
    state[offset++] = bot.controlState.right ? 1.0 : 0.0;
    state[offset++] = bot.controlState.jump ? 1.0 : 0.0;
    state[offset++] = bot.controlState.sprint ? 1.0 : 0.0;
    state[offset++] = bot.controlState.sneak ? 1.0 : 0.0;

    // Feature 7-9: Velocity vector (movement speed/direction)
    const vel = bot.entity.velocity;
    state[offset++] = Math.max(-1, Math.min(1, vel.x));
    state[offset++] = Math.max(-1, Math.min(1, vel.y));
    state[offset++] = Math.max(-1, Math.min(1, vel.z));

    // Feature 10-11: View direction (yaw, pitch)
    state[offset++] = (bot.entity.yaw || 0) / (2 * Math.PI); // Normalize to [0, 1]
    state[offset++] = ((bot.entity.pitch || 0) + Math.PI/2) / Math.PI; // Normalize to [0, 1]

    // Feature 12: Current speed (magnitude of velocity)
    const speed = Math.sqrt(vel.x**2 + vel.y**2 + vel.z**2);
    state[offset++] = Math.min(1.0, speed / 0.5); // Sprint speed ~0.28, normalize to 0.5

    // Feature 13: Is jumping (for parkour)
    state[offset++] = (bot.entity.jumpTicks || 0) > 0 ? 1.0 : 0.0;

    // Feature 14: Selected hotbar slot
    state[offset++] = (bot.quickBarSlot || 0) / 8.0;

    // Feature 15: Is sleeping
    state[offset++] = bot.isSleeping ? 1.0 : 0.0;

    return offset;
}
```

### 2.3 Effects and Status (20 dimensions)
```javascript
encodeEffects(bot, state, offset) {
    const effects = bot.entity.effects || {};

    // Common effect IDs
    const effectIds = {
        1: 'speed', 2: 'slowness', 3: 'haste', 4: 'mining_fatigue',
        5: 'strength', 6: 'instant_health', 7: 'instant_damage', 8: 'jump_boost',
        9: 'nausea', 10: 'regeneration', 11: 'resistance', 12: 'fire_resistance',
        13: 'water_breathing', 14: 'invisibility', 15: 'blindness', 16: 'night_vision',
        17: 'hunger', 18: 'weakness', 19: 'poison', 20: 'wither'
    };

    // Encode presence and amplifier for top 10 effects
    const priorityEffects = [1, 5, 10, 12, 13, 16, 19, 20, 8, 3]; // Most important

    for (let i = 0; i < 10; i++) {
        const effectId = priorityEffects[i];
        const effect = effects[effectId];

        if (effect) {
            // Has effect (1.0) + amplifier level
            state[offset++] = 1.0;
            state[offset++] = Math.min(1.0, (effect.amplifier || 0) / 5.0);
        } else {
            state[offset++] = 0.0;
            state[offset++] = 0.0;
        }
    }

    return offset;
}
```

### 2.4 Equipment and Durability (15 dimensions)
```javascript
encodeEquipment(bot, state, offset) {
    const slots = ['head', 'torso', 'legs', 'feet', 'off-hand'];

    // Feature 1-10: Equipment slots (presence + durability)
    for (const slot of slots) {
        const item = bot.inventory.slots[bot.getEquipmentDestSlot(slot)];

        if (item) {
            // Has equipment
            state[offset++] = 1.0;

            // Durability ratio (1.0 = full, 0.0 = broken)
            const maxDurability = item.maxDurability || 1;
            const durability = (maxDurability - (item.durabilityUsed || 0)) / maxDurability;
            state[offset++] = Math.max(0, durability);
        } else {
            state[offset++] = 0.0;
            state[offset++] = 0.0;
        }
    }

    // Feature 11: Held item durability
    if (bot.heldItem && bot.heldItem.maxDurability) {
        const maxDur = bot.heldItem.maxDurability;
        const dur = (maxDur - (bot.heldItem.durabilityUsed || 0)) / maxDur;
        state[offset++] = Math.max(0, dur);
    } else {
        state[offset++] = 1.0; // No durability = assume full
    }

    // Feature 12-15: Armor protection level
    const armorSlots = ['head', 'torso', 'legs', 'feet'];
    for (const slot of armorSlots) {
        const item = bot.inventory.slots[bot.getEquipmentDestSlot(slot)];
        if (item && item.name.includes('diamond')) {
            state[offset++] = 1.0; // Diamond
        } else if (item && item.name.includes('iron')) {
            state[offset++] = 0.66; // Iron
        } else if (item && item.name.includes('chain')) {
            state[offset++] = 0.5; // Chain
        } else if (item && item.name.includes('gold')) {
            state[offset++] = 0.33; // Gold
        } else if (item && item.name.includes('leather')) {
            state[offset++] = 0.16; // Leather
        } else {
            state[offset++] = 0.0; // None
        }
    }

    return offset;
}
```

### 2.5 Nearby Players and Multiplayer (10 dimensions)
```javascript
encodeNearbyPlayers(bot, state, offset) {
    const players = Object.values(bot.players)
        .filter(p => p.entity && p.username !== bot.username)
        .sort((a, b) => {
            const distA = a.entity.position.distanceTo(bot.entity.position);
            const distB = b.entity.position.distanceTo(bot.entity.position);
            return distA - distB;
        })
        .slice(0, 5); // Top 5 closest players

    // Feature 1-10: 5 players × 2 features each
    for (let i = 0; i < 5; i++) {
        if (i < players.length) {
            const player = players[i];

            // Feature 1: Distance (normalized)
            const dist = player.entity.position.distanceTo(bot.entity.position);
            state[offset++] = Math.min(1.0, 1.0 - (dist / 32.0));

            // Feature 2: Gamemode (0=survival, 0.5=adventure, 1=creative)
            const gamemodeValue = player.gamemode === 0 ? 0.0 :
                                 player.gamemode === 2 ? 0.5 : 1.0;
            state[offset++] = gamemodeValue;
        } else {
            state[offset++] = 0.0;
            state[offset++] = 0.0;
        }
    }

    return offset;
}
```

---

## Part 3: Implementation Plan

### Step 1: Update STATE_SIZE
```javascript
this.STATE_SIZE = 629; // Was 429, now 429 + 200 = 629
```

### Step 2: Update encodeState() to call new methods
```javascript
encodeState(bot) {
    const state = new Float32Array(this.STATE_SIZE);
    let offset = 0;

    // ... existing encoders (429 dimensions) ...

    // NEW: Plugin sensor data (200 dimensions)
    offset = this.encodePluginBlockData(bot, state, offset);     // +50
    offset = this.encodePluginEntityData(bot, state, offset);    // +30
    offset = this.encodePluginMobAI(bot, state, offset);         // +40
    offset = this.encodePluginWeather(bot, state, offset);       // +10
    offset = this.encodePluginChunks(bot, state, offset);        // +30
    offset = this.encodePluginItems(bot, state, offset);         // +40

    // NEW: Missing Mineflayer data (65 dimensions)
    offset = this.encodeExperience(bot, state, offset);          // +5
    offset = this.encodeControlState(bot, state, offset);        // +15
    offset = this.encodeEffects(bot, state, offset);             // +20
    offset = this.encodeEquipment(bot, state, offset);           // +15
    offset = this.encodeNearbyPlayers(bot, state, offset);       // +10

    return state;
}
```

### Step 3: Update ml_agent_brain.js to handle 629-dimensional input
The neural network input layer must be updated from 429 to 629.

### Step 4: Delete old model weights (incompatible)
The existing saved models have 429-dimensional input, which is incompatible with 629.

---

## Expected Benefits

1. **274,625+ blocks vs 125** - 2,197x more spatial awareness
2. **Exact block properties** - Hardness, light, passability for mining optimization
3. **Mob AI targeting** - Know which mobs are hunting YOU
4. **Item pickup optimization** - Age and distance for value calculation
5. **Enhanced combat** - Potion effects, armor durability, mob AI states
6. **Better pathfinding** - Chunk loading, velocity, control state
7. **Player interaction** - Detect other players and their gamemode
8. **Equipment awareness** - Durability management, repair timing

---

## Testing Plan

1. Add one encoder at a time
2. Verify state vector size matches expected
3. Test with dummy data first
4. Verify neural network accepts new input size
5. Train for 100 episodes and verify reward improvement
6. Compare decision quality before/after

---

## Timeline

- **Phase 1 (2 hours):** Add plugin sensor encoders
- **Phase 2 (1 hour):** Add mineflayer encoders
- **Phase 3 (1 hour):** Update neural network architecture
- **Phase 4 (30 min):** Testing and validation

**Total: ~4.5 hours**
