# Intelligent Village - Development Notes

## Latest: Llama-3.2-1B with Rich Context & Pathfinding (2025-10-15)

### Current LLM Configuration
- **Model**: Llama-3.2-1B-Instruct (onnx-community)
- **Size**: 1.24GB (Q8 quantization)
- **Tokens**: 100 max tokens
- **Temperature**: 1.2 (creative)
- **Auto-downloads** on first run from config.js

### Rich Agent Context in Prompts
Agents now have FULL context when speaking:
```
=== MY PROFILE ===
Name: MinerSteve | Role: MINING (Gen 1)
Health: 18/20 | Food: 16/20 | Feeling: need resources
Carrying: iron_pickaxe, torch, coal, raw_iron, bread
Current Goal: find_diamond
Tasks: mine_deeper, find_diamond_layer, craft_diamond_pickaxe

=== RELATIONSHIPS ===
Friends: BuilderBob, FarmerJoe
Rivals: HunterDan

=== RECENT ACHIEVEMENTS ===
• Mined 15 iron ore
• Crafted iron pickaxe
• Reached depth -54
```

### Pathfinding Integration
- Agents **walk towards each other** during conversations
- Only moves if 3-32 blocks away
- Stops within 2 blocks (conversational distance)
- Dynamic pathfinding follows if they move
- See intelligent_village.js:2327-2345

### Transformers.js Model Options (2-4GB VRAM)
**Best Models**:
1. **Llama-3.2-1B-Instruct** (Q8) - 1.24GB ⭐ CURRENTLY USING
2. **Llama-3.2-3B-Instruct** (INT4) - 1.8GB (best quality for 4GB)
3. **Qwen2.5-1.5B-Instruct** (Q8) - 1.6GB (balanced)
4. **Qwen2.5-3B-Instruct** (Q4) - 1.8GB (excellent quality)

**Switch models**: Edit `config.js:94` model name, restart. Auto-downloads.

---

## System Architecture

### New Modular Structure (server.js)
**Main Entry Point**: `server.js` - Clean, refactored orchestrator using modules

**Core Modules**:
- **config.js** - Centralized configuration (server, agents, ML, LLM, features)
- **agent_ai.js** - AgentAI class for chat responses & personality ✨ NEW
- **village_knowledge.js** - Collective knowledge sharing system ✨ NEW
- **agent_chat_llm.js** - LLM backends (transformers, llamacpp, ollama, mock)
- **agent_memory_system.js** - SQLite episodic memory
- **agent_personality_system.js** - Sims-like personality & compatibility

**ML System**:
- **ml_trainer.js** - PPO training coordinator
- **ml_agent_brain.js** - Neural networks (policy/value, 216-action space)
- **ml_state_encoder.js** - State vector encoding (429-dimensional)
- **ml_action_space.js** - Action coordinator (216 actions, modular)
- **ml_experience_replay.js** - Experience buffers
- **ml_hierarchical_goals.js** - Goal management
- **ml_brain_sqlite.js** - Shared collective brain
- **ml_zomboid_skills.js** - Sub-skills system
- **ml_zomboid_moodles.js** - Status effects
- **actions/** - Modular action implementations (12 categories)

**Infrastructure**:
- **worker_pool_manager.js** - Multi-threading (1000+ agents)
- **dashboard.js** - Web dashboard (optional)
- **huggingface_downloader.js** - Model auto-download
- **llm_download_manager.js** - Prerequisite checking

**Legacy** (kept for compatibility):
- **intelligent_village.js** - Original monolithic version

### LLM Backends
1. **transformers** (ACTIVE) - ONNX models via @huggingface/transformers
2. **llamacpp** - GGUF models (UserLM-8b auto-download ready)
3. **ollama** - External service (requires server)
4. **mock** - Rule-based (no AI needed)

Configure in `config.js:88-117`

---

## Key Features

### Multi-Threading
- Enabled by default (`config.js:173`)
- Supports 1000+ concurrent agents
- Isolated worker threads per agent
- Multi-core CPU utilization

### Enhanced ML Rewards
- Survival: 0.1/step
- Inventory pickups: +5.0/item
- Tool crafting: +10.0
- Exploration: +15.0/new chunk
- Movement: 0.5/block
- No idle penalties (removed)

### UUID System
- Fetches real Minecraft UUIDs from chunks 0001-0675
- Queries Mojang API for player names
- Sequential fallback (try 300 UUIDs before fallback)
- Real player names for all agents

### Agent Personalities
- Sims-like preferences (likes/dislikes)
- 5 categories: activities, biomes, items, behaviors, social
- Compatibility scoring (-1.0 to +1.0)
- Genetic inheritance with mutations (20%)
- Emergent factions based on shared interests

### Memory System
- SQLite episodic memory
- Social relationships with bond strength
- Emotional history tracking
- Location memories
- Achievement progress
- Memory decay system (5-min intervals)

### Skills (Project Zomboid-style)
- 20 sub-skills across 4 categories
- McMMO-like XP and leveling
- Combat: swords, axes, archery, defense, unarmed
- Survival: mining, woodcutting, fishing, farming
- Crafting: repair, alchemy, smelting, brewing
- Physical: acrobatics, endurance, etc.
- 14 moodle status effects

### Expanded ML Action Space (216 Actions)
**3x expansion from 76 → 216 actions** for complex emergent gameplay mechanics:

**Action Categories (Modular Architecture)**:
1. **Inventory Management** (15 actions, 76-90) - Fine-grained control
   - Toss/sort items, equip armor sets, swap hotbar, prioritize valuables
   - actions/inventory.js

2. **Advanced Crafting** (20 actions, 91-110) - Specific recipes
   - Craft wooden/stone/iron/diamond tools, weapons, armor
   - Smelt ores, craft arrows, bows, shields, beds, buckets
   - actions/crafting.js

3. **Container Operations** (12 actions, 111-122) - Storage management
   - Deposit/withdraw specific item types (ores, food, tools)
   - Organize chests, operate furnaces, load/unload smelting
   - actions/container.js

4. **Enchanting & Brewing** (10 actions, 123-132)
   - Enchant tools/weapons/armor, use anvil for repair/combining
   - Brew potions, gather lapis, create enchanting setups
   - actions/enchanting.js

5. **Trading** (8 actions, 133-140)
   - Find villagers, execute trades, cure zombie villagers
   - Create trading halls, gather emeralds
   - actions/trading.js

6. **Agriculture** (15 actions, 141-155)
   - Plant/harvest wheat/carrots/potatoes, breed animals
   - Shear sheep, milk cows, till soil, use bone meal
   - actions/agriculture.js

7. **Redstone & Mechanisms** (10 actions, 156-165)
   - Activate levers, buttons, pressure plates
   - Place redstone/repeaters, operate doors/trapdoors
   - actions/redstone.js

8. **Bed & Time** (5 actions, 166-170)
   - Sleep in bed, find shelter, wait for night
   - actions/bed.js

9. **Fine Motor Combat** (12 actions, 171-182)
   - Critical hits, shield blocking, strafing
   - Combo attacks, kiting, circle strafe, backstab
   - actions/combat_advanced.js

10. **Advanced Navigation** (15 actions, 183-197)
    - Swim/climb/boat mechanics, parkour jumps
    - Bridge forward, pillar up/down, navigate ravines
    - actions/navigation.js

11. **Resource Optimization** (10 actions, 198-207)
    - Select optimal tools, repair with anvil
    - Strip mining, branch mining, fortune mining
    - actions/optimization.js

12. **Communication & Signaling** (8 actions, 208-215)
    - Drop item signals, place marker blocks
    - Signal danger/resources, form line/circle formations
    - actions/communication.js

**Integration**: Modular architecture with `actions/` folder structure. Each category is a separate class with full mineflayer API implementations. Neural network automatically scales to 216-action output space.

---

## Configuration (config.js)

### Agents
```javascript
maxAgents: 20
batchSpawnSize: 1
batchSpawnDelay: 15000
chatInterval: 30000
chatRange: 50
```

### LLM
```javascript
backend: 'transformers'
transformers: {
    model: 'onnx-community/Llama-3.2-1B-Instruct',
    dtype: 'q8',
    maxTokens: 100,
    temperature: 1.2,
    topP: 0.95,
    repetitionPenalty: 1.5
}
```

### ML Rewards
```javascript
rewards: {
    survival: 0.1,
    inventoryPickup: 5.0,
    toolCrafting: 10.0,
    exploration: 15.0,
    movement: 0.5
}
```

### Features
```javascript
enableIdlePenalty: false  // Let agents explore
enableStuckDetection: true
enableKnowledgeSharing: true
enableSocialRewards: true
enableGameMaster: false  // Agents autonomous
```

---

## File Locations

### Core
- `server.js` - **NEW** Main entry point (modular, clean)
- `intelligent_village.js` - Legacy main file (kept for compatibility)
- `config.js` - Centralized configuration

### Agent Systems
- `agent_ai.js` - **NEW** AgentAI class, formatPos utility
- `village_knowledge.js` - **NEW** VillageKnowledge class
- `agent_chat_llm.js` - Multi-backend LLM system
- `agent_memory_system.js` - SQLite episodic memory
- `agent_personality_system.js` - Sims-like personalities

### ML System
- `ml_trainer.js` - PPO training coordinator
- `ml_agent_brain.js` - Neural networks (policy/value, 216-action space)
- `ml_state_encoder.js` - State vector encoding (429-dimensional)
- `ml_action_space.js` - Action coordinator (216 actions, modular)
- `ml_experience_replay.js` - Experience buffers
- `ml_hierarchical_goals.js` - Goal management system
- `ml_brain_sqlite.js` - Shared collective brain
- `ml_zomboid_skills.js` - Sub-skills (20 skills)
- `ml_zomboid_moodles.js` - Status effects (14 moodles)
- `actions/` - Modular action implementations
  - `inventory.js` - 15 inventory management actions
  - `crafting.js` - 20 crafting & smelting actions
  - `container.js` - 12 storage operations
  - `enchanting.js` - 10 enchanting & brewing actions
  - `trading.js` - 8 villager trading actions
  - `agriculture.js` - 15 farming & animal breeding
  - `redstone.js` - 10 redstone mechanisms
  - `bed.js` - 5 sleep & time actions
  - `combat_advanced.js` - 12 fine motor combat
  - `navigation.js` - 15 advanced movement
  - `optimization.js` - 10 resource optimization
  - `communication.js` - 8 agent coordination
  - `index.js` - Module exports

### Infrastructure
- `worker_pool_manager.js` - Multi-threading support
- `dashboard.js` - Web dashboard (optional)
- `huggingface_downloader.js` - Model auto-download
- `llm_download_manager.js` - Prerequisite checking

---

## Quick Start

### Run (NEW MODULAR VERSION)
```bash
node server.js
```

### Run (Legacy Version)
```bash
node intelligent_village.js
```

### Switch LLM Model
Edit `config.js:94`, restart. Model auto-downloads.

### Adjust Agent Count
Edit `config.js:22` (maxAgents), restart.

### Change Creativity
Edit `config.js:97` (temperature: 0.8-2.0), restart.

---

## Important Rules
- **Never use mock LLM responses** - Always use real AI models (transformers/llamacpp/ollama)
- **Never hardcode values** - Use config.js for all parameters
- **Always use pathfinding** - Agents walk towards conversation partners
- **Rich context required** - Include full agent profile in prompts
- **Sequential UUIDs** - Try full chunk before fetching new one

---

## Recent Changes

### 2025-10-15 (Latest - ML Action Space Expansion)
- **🎯 ML Action Space**: 3x expansion from 76 → 216 actions
  - Modular architecture with `actions/` folder (12 categories)
  - Inventory management (15), crafting (20), containers (12), enchanting (10)
  - Trading (8), agriculture (15), redstone (10), bed/time (5)
  - Advanced combat (12), navigation (15), optimization (10), communication (8)
  - Full mineflayer API implementations (no placeholders)
  - Neural network automatically scales to 216-action output space
  - Enables complex emergent gameplay: enchanting, brewing, trading, farming, advanced combat
- **Code Organization**: Clean modular structure
  - Each action category in separate class file
  - Method binding for seamless integration
  - actions/index.js exports all modules

### 2025-10-15 (Major Refactoring)
- **✨ NEW: server.js** - Complete modular rewrite
  - Clean architecture with proper module separation
  - All configuration from config.js
  - Clear section organization with comments
  - Production-ready, maintainable structure
- **Code Refactoring**: Extracted modules for better organization
  - Created `agent_ai.js` - AgentAI class and formatPos utility
  - Created `village_knowledge.js` - VillageKnowledge class
  - Deleted 6 unused files (agent_worker.js, tasks.js, gym.js, test_llm_chat.js, agent.js, networking.js)
  - Cleaned up codebase from 26 → 21 files
- **LLM Enhancements**:
  - Upgraded to Llama-3.2-1B-Instruct
  - Added rich agent profiles (14 fields: goals, tasks, friends, rivals, achievements)
  - Implemented pathfinding to walk towards conversation partners
  - Dynamic config loading for transformers
  - Fixed inventory array handling
  - Prompt filtering for player-perspective format

### 2025-10-14
- Enhanced reward shaping (10x stronger)
- Removed idle penalties
- TTY console implementation
- Silent TensorFlow save handling
- Multi-threading enabled by default
- Modular architecture refactoring
- LLM multi-backend system

### 2025-10-13
- UUID chunk range correction (0001-0675)
- Sequential UUID fallback
- Dashboard improvements
- McMMO skills display
- Agent lineage tracking

---

## Dashboard
- **URL**: http://localhost:3000
- **Status**: Disabled by default (`config.js:158`)
- Features: Agent cards, skills, TTY console, 3D viewer

---

## Performance
- **Scalability**: 1000+ agents (multi-threading)
- **Episode Rewards**: +49.41 avg (was -50)
- **Survival Times**: 10x longer
- **LLM Speed**: ~1-2 seconds/response
- **Model Loading**: First run 3-5 min, then instant

---

## Future Enhancements
- Emotion system (happy, sad, excited)
- Memory of past conversations
- Collaborative planning
- Trading negotiations
- Shared goals
- Visual lineage tree
- Genetic trait visualization
