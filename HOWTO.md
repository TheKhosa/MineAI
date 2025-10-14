# Intelligent Village - Complete Setup & Usage Guide

**A comprehensive guide to installing, configuring, and using the Intelligent Village Minecraft AI system.**

---

## Table of Contents

1. [Prerequisites & System Requirements](#prerequisites--system-requirements)
2. [Installation](#installation)
3. [Minecraft Server Setup](#minecraft-server-setup)
4. [Configuration](#configuration)
5. [Starting the System](#starting-the-system)
6. [Using the Dashboard](#using-the-dashboard)
7. [ML Training System](#ml-training-system)
8. [Agent Chat System](#agent-chat-system)
9. [Memory System](#memory-system)
10. [Spawning Agents](#spawning-agents)
11. [Multi-Threading Configuration](#multi-threading-configuration)
12. [Monitoring & Debugging](#monitoring--debugging)
13. [Advanced Configuration](#advanced-configuration)
14. [Troubleshooting](#troubleshooting)
15. [Tips & Best Practices](#tips--best-practices)

---

## Prerequisites & System Requirements

### Minimum Requirements
- **CPU**: 4 cores (8+ cores recommended for 100+ agents)
- **RAM**: 8GB (16GB+ recommended for large villages)
- **Storage**: 5GB free space (for Node.js, dependencies, models)
- **OS**: Windows, Linux, or macOS
- **Network**: Internet connection (for initial setup only)

### Software Requirements
- **Node.js**: v16.0.0 or higher
- **npm**: v7.0.0 or higher (comes with Node.js)
- **Git**: Latest version
- **Minecraft Java Edition Server**: 1.16.5 or higher

### Optional
- **PM2**: For production deployment
- **Docker**: For containerized deployment
- **Visual Studio Code**: For development

---

## Installation

### Step 1: Install Node.js

**Windows**:
1. Download from https://nodejs.org/
2. Run installer (choose LTS version)
3. Verify installation:
   ```bash
   node --version
   npm --version
   ```

**Linux (Ubuntu/Debian)**:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
npm --version
```

**macOS**:
```bash
brew install node
node --version
npm --version
```

### Step 2: Clone the Repository

```bash
# Clone the project
git clone <repository-url>
cd MineRL

# Or download ZIP and extract
# Then navigate to directory
```

### Step 3: Install Dependencies

```bash
npm install
```

This will install:
- `mineflayer` - Minecraft bot framework
- `@tensorflow/tfjs` - Machine learning
- `sqlite3` - Memory database
- `express` - Web server
- `socket.io` - Real-time communication
- `axios` - HTTP client
- And other dependencies...

**Installation may take 5-10 minutes** on first run.

---

## Minecraft Server Setup

### Option 1: Use Existing Server

If you already have a Minecraft server:

1. Edit `server.properties`:
   ```properties
   online-mode=false
   ```

2. Restart server

3. Note the server IP and port (default: `localhost:25565`)

### Option 2: Create New Server

1. **Download Minecraft Server JAR**:
   - Visit https://www.minecraft.net/en-us/download/server
   - Download `server.jar` (1.16.5+ recommended)

2. **Create server directory**:
   ```bash
   mkdir minecraft-server
   cd minecraft-server
   ```

3. **Place `server.jar` in directory**

4. **Run server first time**:
   ```bash
   java -Xmx2G -Xms2G -jar server.jar nogui
   ```

5. **Accept EULA**:
   - Edit `eula.txt`: `eula=true`

6. **Configure server.properties**:
   ```properties
   online-mode=false
   gamemode=survival
   difficulty=normal
   max-players=1000
   spawn-protection=0
   view-distance=10
   ```

7. **Start server**:
   ```bash
   java -Xmx4G -Xms4G -jar server.jar nogui
   ```

8. **Verify server is running**:
   - Look for "Done!" message
   - Server should be on `localhost:25565`

---

## Configuration

### Main Configuration File

Edit `D:\MineRL\intelligent_village.js` (lines 30-45):

```javascript
// ===  SCALABILITY CONFIGURATION ===
const USE_THREADING = true;   // Enable multi-threading (recommended)
const MAX_WORKERS = 1000;     // Maximum concurrent agents

// === ML CONFIGURATION ===
let ML_ENABLED = true;        // Enable machine learning

// === SERVER CONFIGURATION ===
const SERVER_HOST = 'localhost';
const SERVER_PORT = 25565;

// === SPAWN CONFIGURATION ===
const INITIAL_AGENTS = 10;    // Number of agents to spawn on start
const MAX_AGENTS = 100;       // Maximum total agents
```

### Minecraft Server Connection

If your Minecraft server is on a different host/port, update the configuration:

```javascript
const SERVER_CONFIG = {
    host: 'your-server-ip',  // Change from 'localhost' if needed
    port: 25565,             // Change if using different port
    username: 'AgentName',   // Will be overridden per agent
    version: '1.16.5'        // Match your server version
};
```

### ML Training Configuration

Edit `D:\MineRL\ml_trainer.js` (lines 31-40):

```javascript
this.config = {
    stepsPerUpdate: 512,        // Train every N steps
    batchSize: 64,              // Batch size for training
    trainingEpochs: 4,          // PPO epochs per update
    minBufferSize: 1000,        // Min experiences before training
    saveInterval: 5000,         // Save models every N steps
    explorationRate: 0.2,       // Initial exploration rate
    explorationDecay: 0.9995,   // Decay rate
    minExploration: 0.05        // Minimum exploration rate
};
```

### Reward Configuration

Reward values are in `D:\MineRL\ml_trainer.js` (lines 280-735). Key rewards:

```javascript
// Survival
survivalBonus = Math.min(bot.mlSurvivalTime * 0.1, 10.0);

// Item pickup
pickupReward = (currentInvSize - lastInvSize) * 5.0;

// Tool crafting
pickaxeReward = 10.0;

// Exploration
exploreReward = 15.0; // Per new chunk

// Movement
moveReward = Math.min(distMoved * 0.5, 3.0);

// Cooperation
clusterBonus = Math.min(nearbyAgents.length, 5) * 1.0;
buildTogetherReward = 10.0;
```

---

## Starting the System

### Method 1: Direct Node.js Execution

```bash
cd D:\MineRL
node intelligent_village.js
```

**Expected output**:
```
[ML TRAINER] Initialized ML Training System
[ML TRAINER] Action Space Size: 70
[ML TRAINER] State Vector Size: 320
[MEMORY] SQLite memory system initialized
[CHAT LLM] Initializing mock backend...
[THREADING] Worker pool enabled - can handle 1000+ agents
[DASHBOARD] Starting dashboard server on port 3000
[SERVER] Connected to Minecraft server
[SPAWN] Spawning initial agents...
```

### Method 2: Windows Batch File

```bash
cd D:\MineRL
start.bat
```

This opens two windows:
1. **Main Server** - Intelligent Village system
2. **Dashboard Server** - Web interface (optional, if separate)

### Method 3: With Auto-Reload (Development)

```bash
npm install -g nodemon
cd D:\MineRL
nodemon intelligent_village.js
```

This automatically restarts on code changes.

### Method 4: Background Process (Production)

```bash
# Install PM2
npm install -g pm2

# Start system
pm2 start intelligent_village.js --name minerl-village --max-memory-restart 8G

# View logs
pm2 logs minerl-village

# Monitor
pm2 monit

# Stop
pm2 stop minerl-village
```

---

## Using the Dashboard

### Accessing the Dashboard

1. **Start the system** (see above)
2. **Open browser** to `http://localhost:3000`
3. **Dashboard loads** with real-time agent data

### Dashboard Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      INTELLIGENT VILLAGE DASHBOARD                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                      AGENT CARDS                                │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │     │
│  │  │  Agent 1     │  │  Agent 2     │  │  Agent 3     │         │     │
│  │  │  Health: ❤❤❤ │  │  Health: ❤❤  │  │  Health: ❤   │  ...   │     │
│  │  │  Food: 🍖🍖  │  │  Food: 🍖    │  │  Food: -     │         │     │
│  │  │  Gen: 5      │  │  Gen: 3      │  │  Gen: 1      │         │     │
│  │  │  Reward: +12 │  │  Reward: +8  │  │  Reward: -2  │         │     │
│  │  └──────────────┘  └──────────────┘  └──────────────┘         │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                      EVENT CONSOLE                              │     │
│  │  [SPAWN] Alex joined the server (Gen 1)                        │     │
│  │  [SKILL] Steve leveled up Mining: Lv 5                         │     │
│  │  [DEATH] Zombie killed Alex (survived 15 min)                  │     │
│  │  [SPAWN] Alex_offspring joined the server (Gen 2)              │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                      TTY CONSOLE                                │     │
│  │  $ [ML TRAINER] Training step 1024                             │     │
│  │  $ [ML REWARD] Steve: +12.5 (survival:+2.1, explore:+8.0, ...) │     │
│  │  $ [MEMORY] Stored episodic memory for Alex                    │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                      MCMMO SKILLS                               │     │
│  │  Mining:      ████████░░ Lv 8  (750/1000 XP)                   │     │
│  │  Combat:      ██████░░░░ Lv 6  (450/800 XP)                    │     │
│  │  Woodcutting: ███░░░░░░░ Lv 3  (200/500 XP)                    │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Dashboard Features

**Agent Cards**:
- **Health bar**: Visual health representation
- **Food bar**: Saturation level
- **Inventory**: Items held
- **Generation**: Genetic generation number
- **Reward**: Current episode reward
- **Skills**: Expandable McMMO skills section
- **Position**: Current coordinates

**Event Console**:
- **Color-coded events**:
  - 🟦 Blue = Agent actions
  - 🟩 Green = Skill level-ups
  - 🟥 Red = Combat/Death
  - 🟪 Purple = System events
- **Auto-scroll**: Follows latest events
- **Clear button**: Clears console
- **Limit**: Shows last 100 events

**TTY Console**:
- **Node.js output**: Real-time console.log output
- **CRT styling**: Retro terminal aesthetic
- **Color-coded**: Error (red), Warning (yellow), Info (green)
- **Auto-scroll toggle**: Lock/unlock scrolling
- **Clear button**: Clears output
- **Buffer**: Last 500 lines

**Spawn Controls**:
- **Spawn button**: Add new agents
- **Count input**: Number of agents to spawn
- **Type selector**: Choose agent type (miner, fighter, explorer, builder)

---

## ML Training System

### How ML Training Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ML TRAINING PIPELINE                              │
└─────────────────────────────────────────────────────────────────────────┘

1. STATE ENCODING
   ┌──────────────────────────────────────────┐
   │  Bot observes Minecraft world            │
   │  - Position, health, food                │
   │  - Nearby blocks, entities, agents       │
   │  - Inventory, tools                      │
   │  - Recent memories                       │
   │  - Needs, moods, relationships           │
   └──────────────┬───────────────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────────┐
   │  Convert to 320D vector                  │
   │  [0.8, 0.5, 12.3, ..., 0.2]             │
   └──────────────┬───────────────────────────┘
                  │
                  ▼
2. ACTION SELECTION
   ┌──────────────────────────────────────────┐
   │  Neural Network (Actor)                  │
   │  Input: 320D state vector                │
   │  Output: 70 action probabilities         │
   │  [0.05, 0.12, 0.03, ..., 0.08]          │
   └──────────────┬───────────────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────────┐
   │  Sample action from distribution         │
   │  With exploration (ε-greedy)             │
   │  Action: 23 = "mine_forward"             │
   └──────────────┬───────────────────────────┘
                  │
                  ▼
3. ACTION EXECUTION
   ┌──────────────────────────────────────────┐
   │  Execute in Minecraft                    │
   │  - Bot mines block forward               │
   │  - Update world state                    │
   └──────────────┬───────────────────────────┘
                  │
                  ▼
4. REWARD CALCULATION
   ┌──────────────────────────────────────────┐
   │  Calculate dense rewards:                │
   │  + Survival: +0.1                        │
   │  + Item pickup: +5.0                     │
   │  + Movement: +0.5                        │
   │  + Cooperation: +3.0                     │
   │  - Damage: -2.0                          │
   │  = Total: +6.6                           │
   └──────────────┬───────────────────────────┘
                  │
                  ▼
5. EXPERIENCE STORAGE
   ┌──────────────────────────────────────────┐
   │  Store (state, action, reward, done)     │
   │  In episode buffer                       │
   └──────────────┬───────────────────────────┘
                  │
                  ▼
6. TRAINING (Every 512 steps)
   ┌──────────────────────────────────────────┐
   │  PPO Algorithm:                          │
   │  1. Calculate advantages (TD error)      │
   │  2. Update Actor (policy network)        │
   │  3. Update Critic (value network)        │
   │  4. Clip policy updates                  │
   └──────────────┬───────────────────────────┘
                  │
                  ▼
7. MODEL SAVING (Every 5000 steps)
   ┌──────────────────────────────────────────┐
   │  Save neural network weights             │
   │  To: ml_models/brain_{type}.json         │
   └──────────────────────────────────────────┘
```

### Training Configuration

**Key parameters** (in `ml_trainer.js`):

```javascript
// Training frequency
stepsPerUpdate: 512  // Train every 512 agent steps

// Batch size
batchSize: 64  // Use 64 experiences per training batch

// Training epochs
trainingEpochs: 4  // 4 PPO epochs per update

// Exploration
explorationRate: 0.2      // Start with 20% random actions
explorationDecay: 0.9995  // Decay by 0.05% per step
minExploration: 0.05      // Minimum 5% exploration
```

### Monitoring Training

**Console output**:
```
[ML TRAINER] Training step 512
[ML TRAINER] Trained MINING: Actor Loss=0.0234, Critic Loss=0.0156
[ML TRAINER] Episode completed for Steve: 487 steps, +42.31 reward
[ML TRAINER] Saved 3 models
```

**Dashboard**:
- Episode rewards visible on agent cards
- TTY console shows real-time training logs

### Adjusting Training

**Faster training**:
```javascript
stepsPerUpdate: 256  // Train more frequently
batchSize: 128       // Larger batches
trainingEpochs: 8    // More epochs per update
```

**More exploration**:
```javascript
explorationRate: 0.3     // 30% random actions
explorationDecay: 0.999  // Slower decay
minExploration: 0.1      // Higher minimum
```

**Stronger rewards**:
```javascript
// In calculateReward() function
survivalBonus = Math.min(bot.mlSurvivalTime * 0.2, 20.0);  // 2x stronger
pickupReward = (currentInvSize - lastInvSize) * 10.0;      // 2x stronger
```

---

## Agent Chat System

### Overview

Agents can communicate using a local language model (Transformers.js) or rule-based fallback.

### Configuration

**Enable chat** (in `intelligent_village.js`):

```javascript
// === CHAT LLM SYSTEM ===
const { getChatLLM } = require('./agent_chat_llm');
let chatLLM = null;

// Initialize after server starts
chatLLM = getChatLLM('mock');  // Options: 'transformers', 'ollama', 'mock'
await chatLLM.initialize();
```

### Chat Backends

**1. Transformers.js (Local LLM)**:
```javascript
chatLLM = getChatLLM('transformers');
await chatLLM.initialize();
```

- **Model**: IBM Granite 4.0 Micro (3B params)
- **Size**: ~800MB download (first run only)
- **Speed**: 1-2 seconds per response
- **Quality**: Natural, context-aware dialogue
- **Offline**: Runs entirely locally

**2. Mock (Rule-Based)**:
```javascript
chatLLM = getChatLLM('mock');
await chatLLM.initialize();
```

- **Model**: None (templates)
- **Size**: 0 bytes
- **Speed**: Instant
- **Quality**: Simple, templated responses
- **Offline**: Always available

**3. Ollama (External)**:
```javascript
chatLLM = getChatLLM('ollama');
await chatLLM.initialize();
```

- **Requires**: Ollama server running on localhost:11434
- **Models**: Any model supported by Ollama

### Using Chat

**Generate dialogue**:
```javascript
const speaker = {
    name: 'Steve',
    health: 15,
    food: 8,
    needs: { hunger: 0.3, safety: 0.8 },
    inventory: '3x wood, 1x pickaxe'
};

const listener = {
    name: 'Alex',
    needs: { resources: 0.2 }
};

const message = await chatLLM.generateDialogue(speaker, listener, 'trading');
// Output: "Alex, want to trade resources? I've got some wood to share."
```

### Chat Contexts

Available contexts:
- `nearby` - Casual greeting
- `needs_help` - Requesting assistance
- `trading` - Resource exchange
- `low_health` - Health warning
- `exploring` - Exploration invitation
- `danger` - Danger alert

---

## Memory System

### Overview

SQLite-powered episodic memory system inspired by The Sims and Dwarf Fortress.

### Database Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MEMORY DATABASE SCHEMA                            │
└─────────────────────────────────────────────────────────────────────────┘

episodic_memories
├─ memory_id (PK)
├─ agent_uuid
├─ agent_name
├─ generation
├─ timestamp
├─ event_type (achievement, danger, social, exploration)
├─ event_subtype
├─ location (x, y, z)
├─ emotional_valence (-1.0 to +1.0)
├─ emotional_arousal (0.0 to 1.0)
├─ importance (0.0 to 1.0)
├─ context (JSON)
└─ memory_strength (decays over time)

social_relationships
├─ relationship_id (PK)
├─ agent_uuid
├─ other_agent_uuid
├─ other_agent_name
├─ relationship_type (friend, rival, neutral)
├─ bond_strength (-1.0 to +1.0)
├─ trust_level (0.0 to 1.0)
├─ cooperation_count
├─ conflict_count
├─ last_interaction
├─ first_met
└─ shared_experiences (JSON)

emotional_history
├─ record_id (PK)
├─ agent_uuid
├─ timestamp
├─ happiness, stress, boredom, motivation
├─ loneliness, confidence, curiosity, fear
├─ trigger_event
└─ needs_snapshot (JSON)

location_memories
├─ location_id (PK)
├─ agent_uuid
├─ chunk (x, z)
├─ location_type (safe, dangerous, resource-rich)
├─ emotional_valence
├─ visit_count
├─ last_visited
├─ first_visited
└─ significant_events (JSON)

achievement_progress
├─ agent_uuid (PK)
├─ agent_name
├─ generation
├─ first_diamond_time, first_iron_armor_time, ...
├─ diamonds_found, mobs_killed, blocks_placed
├─ chunks_explored, cooperation_events
├─ deaths, agents_met, friendships_formed
├─ total_playtime_seconds
└─ furthest_x, furthest_z, deepest_y
```

### Using Memory System

**Store episodic memory**:
```javascript
await memorySystem.storeMemory(
    bot.uuid,                    // Agent UUID
    bot.agentName,               // Agent name
    bot.generation,              // Generation number
    'achievement',               // Event type
    'found_diamonds',            // Event subtype
    bot.entity.position,         // Location {x, y, z}
    {                            // Emotional context
        valence: 0.9,            // Very positive
        arousal: 0.8,            // High excitement
        importance: 0.95         // Very important
    },
    { count: 3 }                 // Additional context
);
```

**Update social relationship**:
```javascript
await memorySystem.updateRelationship(
    bot.uuid,                    // This agent
    otherBot.uuid,               // Other agent
    otherBot.agentName,          // Other agent name
    {
        type: 'friend',          // Relationship type
        bondChange: +0.1,        // Increase bond
        trustChange: +0.05,      // Increase trust
        wasCooperation: true,    // Was this cooperation?
        wasConflict: false       // Was this conflict?
    }
);
```

**Record emotional state**:
```javascript
await memorySystem.recordEmotionalState(
    bot.uuid,
    {
        happiness: 0.8,
        stress: 0.2,
        boredom: 0.1,
        motivation: 0.9,
        loneliness: 0.3,
        confidence: 0.7,
        curiosity: 0.6,
        fear: 0.1
    },
    'found_diamonds'  // Trigger event
);
```

**Retrieve memories for decision-making**:
```javascript
// Get recent significant memories
const memories = await memorySystem.getRecentMemories(bot.uuid, 10);

// Get social relationships
const relationships = await memorySystem.getRelationships(bot.uuid, 5);

// Use in state encoding
bot.recentMemories = memories;
bot.relationships = new Map(relationships.map(r => [r.other_agent_uuid, r]));
```

### Memory Decay

Memories naturally decay over time:

```javascript
// Run periodically (e.g., every hour)
await memorySystem.decayMemories(0.01);  // 1% decay per call
```

- **Important memories** decay slower
- **Low-importance memories** decay faster
- **Memories below 0.1 strength** are considered "forgotten"

---

## Spawning Agents

### Manual Spawning

**Via Console** (in Node.js console):
```javascript
// Spawn single agent
await createAgent('Steve', 'MINING', 1);

// Spawn multiple agents
for (let i = 0; i < 10; i++) {
    await createAgent(`Agent_${i}`, 'MINING', 1);
}
```

**Via Dashboard**:
1. Click "Spawn Agents" button
2. Enter number of agents
3. Select agent type
4. Click "Spawn"

### Automatic Spawning

**On startup** (in `intelligent_village.js`):

```javascript
async function startVillage() {
    // Spawn initial population
    for (let i = 0; i < INITIAL_AGENTS; i++) {
        const agentType = randomAgentType();
        await createAgent(`Agent_${i}`, agentType, 1);
        await sleep(2000);  // Wait 2s between spawns
    }
}
```

**On death** (automatic respawn):

```javascript
bot.on('death', async () => {
    // Calculate fitness
    const fitness = calculateFitness(bot);

    // Spawn offspring with inherited brain
    await spawnOffspring(bot, fitness);
});
```

### Agent Types

```javascript
function randomAgentType() {
    const types = ['MINING', 'COMBAT', 'EXPLORATION', 'BUILDING', 'GATHERING'];
    return types[Math.floor(Math.random() * types.length)];
}
```

**Type behaviors** (via state encoding and action biasing):
- **MINING**: Biased toward mining actions, ore detection
- **COMBAT**: Biased toward combat actions, mob detection
- **EXPLORATION**: Biased toward movement, new chunk discovery
- **BUILDING**: Biased toward placing blocks, crafting
- **GATHERING**: Biased toward collecting items, resource search

---

## Multi-Threading Configuration

### Enabling Multi-Threading

**Edit `intelligent_village.js`**:

```javascript
// === SCALABILITY CONFIGURATION ===
const USE_THREADING = true;   // Enable worker threads
const MAX_WORKERS = 1000;     // Maximum concurrent agents

// Import worker pool
let WorkerPoolManager = null;
let workerPool = null;

if (USE_THREADING) {
    WorkerPoolManager = require('./worker_pool_manager');
    console.log('[THREADING] Worker pool enabled');
}
```

### Initialize Worker Pool

```javascript
// After ML trainer initialization
if (USE_THREADING && mlTrainer) {
    workerPool = new WorkerPoolManager(mlTrainer, MAX_WORKERS);

    // Listen to events
    workerPool.on('agentSpawned', (data) => {
        console.log(`[WORKER] ${data.agentName} spawned`);
    });

    workerPool.on('agentDeath', (data) => {
        console.log(`[WORKER] ${data.agentName} died`);
        // Respawn logic here
    });

    workerPool.on('workerError', (data) => {
        console.error(`[WORKER] Error: ${data.error}`);
    });
}
```

### Spawn Threaded Agent

```javascript
async function spawnAgentThreaded(agentName, agentType, generation = 1) {
    if (!workerPool) {
        throw new Error('Worker pool not initialized');
    }

    try {
        const result = await workerPool.spawnAgent(
            agentName,
            agentType,
            SERVER_CONFIG,
            generation,
            null,  // parentName
            null,  // parentUUID
            null   // uuid (auto-generated)
        );

        console.log(`[SPAWN] ${agentName} spawned in worker thread`);
        return result;
    } catch (error) {
        console.error(`[SPAWN ERROR] ${agentName}: ${error.message}`);
    }
}
```

### Multi-Threading Benefits

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     SINGLE-THREADED vs MULTI-THREADED                    │
└─────────────────────────────────────────────────────────────────────────┘

SINGLE-THREADED:
┌──────────────────────────────────────────────┐
│              MAIN THREAD                      │
│  ┌────────┐ ┌────────┐ ┌────────┐           │
│  │ Agent1 │ │ Agent2 │ │ Agent3 │ ...       │
│  └────────┘ └────────┘ └────────┘           │
│  ┌───────────────────────────┐               │
│  │      ML Training          │               │
│  └───────────────────────────┘               │
│  ┌───────────────────────────┐               │
│  │      Dashboard            │               │
│  └───────────────────────────┘               │
└──────────────────────────────────────────────┘
- Max ~100 agents
- Single CPU core
- Errors affect all agents
- Protocol errors visible

MULTI-THREADED:
┌──────────────────────────────────────────────┐
│              MAIN THREAD                      │
│  ┌───────────────────────────┐               │
│  │      ML Training          │               │
│  │    (All Agent Types)      │               │
│  └───────────────────────────┘               │
│  ┌───────────────────────────┐               │
│  │      Worker Pool Mgr      │               │
│  └───────────────────────────┘               │
└───────────┬──────────────────────────────────┘
            │
    ┌───────┼───────┬───────┬───────┐
    ▼       ▼       ▼       ▼       ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Worker 1│ │Worker 2│ │Worker 3│ │Worker N│
│Agent1  │ │Agent2  │ │Agent3  │ │AgentN  │
└────────┘ └────────┘ └────────┘ └────────┘
- Max 1000+ agents
- Multi-core CPU
- Errors isolated per agent
- Protocol errors suppressed
```

---

## Monitoring & Debugging

### Console Logging

**Log levels**:
```javascript
console.log('[INFO] Normal operation message');
console.warn('[WARN] Warning message');
console.error('[ERROR] Error message');
```

**Detailed ML logging**:
```javascript
// In ml_trainer.js, enable verbose logging
if (Math.random() < 0.05) {  // 5% chance
    console.log(`[ML REWARD] ${bot.agentName}: ${reward.toFixed(2)} (${rewardBreakdown.join(', ')})`);
}
```

### Dashboard Monitoring

**Real-time metrics**:
- Agent health/food bars
- Episode rewards
- Survival times
- Skill levels
- Memory counts

**TTY Console**:
- All Node.js console output
- Color-coded by level
- Auto-scroll with toggle
- 500-line buffer

### Performance Monitoring

**Add stats interval** (in `intelligent_village.js`):

```javascript
setInterval(() => {
    if (workerPool) {
        const stats = workerPool.getStats();
        console.log(`
┌─────────────────────────────────────────┐
│         WORKER POOL STATS               │
├─────────────────────────────────────────┤
│ Active Workers:     ${stats.workers}   │
│ Total Spawned:      ${stats.totalSpawned} │
│ Total Deaths:       ${stats.totalDeaths} │
│ Total Steps:        ${stats.totalSteps}  │
└─────────────────────────────────────────┘
        `);
    }

    if (mlTrainer) {
        const mlStats = mlTrainer.getStats();
        console.log(`
┌─────────────────────────────────────────┐
│         ML TRAINING STATS               │
├─────────────────────────────────────────┤
│ Training Steps:     ${mlStats.totalTrainingSteps} │
│ Episodes:           ${mlStats.episodesCompleted} │
│ Avg Reward:         ${mlStats.avgReward.toFixed(2)} │
│ Buffer Size:        ${mlStats.bufferSize} │
│ Exploration:        ${mlStats.explorationRate} │
└─────────────────────────────────────────┘
        `);
    }
}, 30000);  // Every 30 seconds
```

### Debugging Tips

**1. Check Minecraft server connection**:
```javascript
// Add connection test
const testConnection = async () => {
    try {
        const testBot = mineflayer.createBot({
            host: SERVER_HOST,
            port: SERVER_PORT,
            username: 'TestBot',
            version: '1.16.5'
        });
        testBot.once('spawn', () => {
            console.log('[TEST] Connection successful');
            testBot.quit();
        });
    } catch (error) {
        console.error('[TEST] Connection failed:', error.message);
    }
};
```

**2. Verify ML trainer initialization**:
```javascript
console.log('[DEBUG] ML Trainer initialized:', !!mlTrainer);
console.log('[DEBUG] ML Enabled:', ML_ENABLED);
console.log('[DEBUG] State size:', mlTrainer?.stateEncoder.STATE_SIZE);
console.log('[DEBUG] Action count:', mlTrainer?.actionSpace.ACTION_COUNT);
```

**3. Check memory system**:
```javascript
const stats = await memorySystem.getStats();
console.log('[DEBUG] Memory stats:', stats);
```

**4. Monitor reward calculation**:
```javascript
// In ml_trainer.js calculateReward(), add:
console.log('[DEBUG] Reward breakdown:', rewardBreakdown.join(', '));
console.log('[DEBUG] Total reward:', reward.toFixed(2));
```

---

## Advanced Configuration

### Custom State Encoding

**Add new state features** (in `ml_state_encoder.js`):

```javascript
encodeState(bot) {
    const state = new Float32Array(this.STATE_SIZE);
    let offset = 0;

    // Existing encoding...
    offset = this.encodeBasicSurvival(bot, state, offset);
    offset = this.encodeEnvironment(bot, state, offset);

    // Add custom encoding
    offset = this.encodeCustomFeature(bot, state, offset);

    return state;
}

encodeCustomFeature(bot, state, offset) {
    // Your custom feature encoding
    state[offset++] = customValue1;
    state[offset++] = customValue2;
    return offset;
}
```

**Update STATE_SIZE**:
```javascript
constructor() {
    this.STATE_SIZE = 320 + CUSTOM_FEATURE_SIZE;  // Add your features
}
```

### Custom Actions

**Add new actions** (in `ml_action_space.js`):

```javascript
constructor() {
    this.actions = [
        // Existing actions...
        { name: 'custom_action', execute: this.executeCustomAction.bind(this) }
    ];

    this.ACTION_COUNT = this.actions.length;
}

async executeCustomAction(bot) {
    try {
        // Your custom action logic
        console.log('[ACTION] Executing custom action');
        return true;
    } catch (error) {
        console.error('[ACTION] Custom action failed:', error.message);
        return false;
    }
}
```

### Custom Rewards

**Modify reward calculation** (in `ml_trainer.js`):

```javascript
calculateReward(bot) {
    let reward = 0;

    // Existing reward calculation...

    // Add custom reward
    const customReward = this.calculateCustomReward(bot);
    reward += customReward;

    return reward;
}

calculateCustomReward(bot) {
    // Your custom reward logic
    let reward = 0;

    if (customCondition) {
        reward += 10.0;
    }

    return reward;
}
```

---

## Troubleshooting

### Problem: Agents not spawning

**Symptoms**: No agents join server, console shows errors

**Solutions**:

1. **Check Minecraft server**:
   ```bash
   # Verify server is running
   netstat -an | findstr :25565  # Windows
   netstat -an | grep :25565     # Linux/Mac
   ```

2. **Check server.properties**:
   ```properties
   online-mode=false  # MUST be false
   ```

3. **Check console for errors**:
   ```
   [ERROR] Connection refused - Is Minecraft server running?
   [ERROR] UUID fetch failed - Check internet connection
   ```

4. **Test connection manually**:
   - Open Minecraft client
   - Connect to `localhost:25565`
   - If it fails, server is not running

---

### Problem: Model save errors

**Symptoms**: Console spam with "Cannot find save handlers"

**Solutions**:

This is **NORMAL** and **expected**. The system handles this gracefully:

1. **Pure JS TensorFlow** doesn't support file:// protocol
2. **Models train successfully** in memory
3. **JSON fallback** implemented
4. **No action needed**

To suppress logs:
```javascript
// Already implemented in ml_agent_brain.js
// Silent failure handling
```

---

### Problem: High memory usage

**Symptoms**: Node.js crashes with "Out of memory"

**Solutions**:

1. **Increase Node.js memory limit**:
   ```bash
   node --max-old-space-size=8192 intelligent_village.js  # 8GB
   ```

2. **Reduce max agents**:
   ```javascript
   const MAX_WORKERS = 100;  // Reduce from 1000
   ```

3. **Reduce buffer sizes**:
   ```javascript
   // In ml_trainer.js
   this.globalReplayBuffer = new ExperienceReplayBuffer(10000);  // Was 50000
   ```

4. **Enable garbage collection**:
   ```bash
   node --expose-gc intelligent_village.js
   ```

   Then in code:
   ```javascript
   setInterval(() => {
       if (global.gc) {
           global.gc();
       }
   }, 60000);  // Every minute
   ```

---

### Problem: Dashboard not loading

**Symptoms**: Browser shows "Connection refused"

**Solutions**:

1. **Check port availability**:
   ```bash
   netstat -an | findstr :3000  # Windows
   netstat -an | grep :3000     # Linux/Mac
   ```

2. **Check dashboard server**:
   ```javascript
   console.log('[DASHBOARD] Starting on port 3000');
   ```

3. **Try different port**:
   ```javascript
   const PORT = 3001;  // Change from 3000
   ```

4. **Check firewall**:
   - Allow port 3000 in firewall
   - Try `http://127.0.0.1:3000`

---

### Problem: Chat LLM fails

**Symptoms**: "Transformers initialization failed"

**Solutions**:

System **automatically falls back to mock**. No action needed.

If you want to use Transformers.js:

1. **Ensure internet connection** (for first-time model download)
2. **Wait for download** (~800MB, takes 5-10 minutes)
3. **Check disk space** (need 2GB free)

Or use mock backend:
```javascript
chatLLM = getChatLLM('mock');  // Use rule-based fallback
```

---

### Problem: Agents stuck or idle

**Symptoms**: Agents not moving, rewards near zero

**Solutions**:

1. **Check pathfinding**:
   ```javascript
   // Agents may be stuck on terrain
   // Check console for pathfinding errors
   ```

2. **Increase exploration**:
   ```javascript
   this.config.explorationRate = 0.3;  // More random actions
   ```

3. **Verify rewards are working**:
   ```javascript
   // In ml_trainer.js, enable debug logging
   console.log('[DEBUG] Reward:', reward, 'Breakdown:', rewardBreakdown);
   ```

4. **Check for errors**:
   - Look for death loops
   - Check for spawn point issues
   - Verify world is generating properly

---

## Tips & Best Practices

### 1. Start Small

```javascript
// Begin with few agents
const INITIAL_AGENTS = 5;
const MAX_AGENTS = 20;
const USE_THREADING = false;  // Disable for testing
```

Once stable, scale up:
```javascript
const INITIAL_AGENTS = 50;
const MAX_AGENTS = 500;
const USE_THREADING = true;  // Enable for scale
```

### 2. Monitor Training Progress

**Watch dashboard regularly**:
- Are episode rewards increasing over time?
- Are agents surviving longer?
- Are they discovering new behaviors?

**Adjust rewards if needed**:
- If rewards too low, increase reward magnitudes
- If agents focus on one behavior, reduce that reward
- Use need-based scaling for balanced behavior

### 3. Use Version Control

```bash
# Create git repository
git init
git add .
git commit -m "Initial commit"

# Before major changes
git checkout -b feature/new-reward-system

# Test changes
# If successful, merge back to main
```

### 4. Backup Models

```bash
# Backup trained models regularly
mkdir backups
cp -r ml_models backups/ml_models_2025-10-14
```

### 5. Experiment with Configurations

**Test different settings**:
- Exploration rates
- Reward magnitudes
- Training frequencies
- Agent types
- Population sizes

**Document results**:
```javascript
// Keep notes in code
/*
 * Configuration: High exploration (0.3)
 * Results: More diverse behaviors, slower convergence
 * Date: 2025-10-14
 */
```

### 6. Use Dashboard for Insights

**Watch for patterns**:
- Which agents survive longest?
- What behaviors lead to high rewards?
- Are agents cooperating organically?
- Which agent types perform best?

### 7. Optimize Performance

**For large villages**:
```javascript
// Enable threading
USE_THREADING = true;

// Increase Node.js memory
// Run with: node --max-old-space-size=16384 intelligent_village.js

// Reduce Minecraft server view distance
// In server.properties: view-distance=6

// Stagger agent spawns
for (let i = 0; i < MAX_AGENTS; i++) {
    await spawnAgent(...);
    await sleep(2000);  // Wait 2s between spawns
}
```

### 8. Monitor Resource Usage

**Check CPU**:
```bash
# Windows
taskmgr

# Linux/Mac
top
htop
```

**Check Memory**:
- Node.js should use <8GB with 100 agents
- Minecraft server should use <4GB

**Check Disk**:
- SQLite database grows over time
- Periodically clean old memories

---

## Conclusion

You now have everything you need to run the Intelligent Village system!

**Quick Checklist**:
- [ ] Node.js installed
- [ ] Minecraft server configured (online-mode=false)
- [ ] Dependencies installed (npm install)
- [ ] Configuration adjusted (intelligent_village.js)
- [ ] System started (node intelligent_village.js)
- [ ] Dashboard accessible (http://localhost:3000)
- [ ] Agents spawning successfully
- [ ] ML training running
- [ ] Rewards positive and increasing

**Next Steps**:
1. Start with 5-10 agents
2. Monitor training progress
3. Experiment with configurations
4. Scale up to 100+ agents
5. Enable multi-threading for 1000+ agents

**Need Help?**:
- Check console logs for errors
- Review troubleshooting section
- Check dashboard TTY console
- Verify all prerequisites installed

**Have Fun Watching Your AI Village Evolve!** 🏘️🤖

---

**Built with Claude Code** - An AI-first development workflow
