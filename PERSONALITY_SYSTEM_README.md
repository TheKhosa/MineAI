# Agent Personality System - Complete Implementation

## 🎉 System Overview

The Intelligent Village now features a **Sims-like personality and preference system** combined with **WorldBox-style faction dynamics**. Agents have unique likes/dislikes, calculate compatibility with each other, form friendships or rivalries, and evolve their preferences through experience.

---

## ✅ What's Been Implemented

### 1. Core Personality System (`agent_personality_system.js`)

**Features**:
- **5 Preference Categories**:
  - Activities: mining, building, exploring, fighting, farming, trading, crafting, hunting, fishing, gathering
  - Biomes: forest, desert, mountains, plains, ocean, cave, swamp, jungle, taiga, nether
  - Items: diamonds, gold, iron, wood, stone, food, weapons, tools, blocks, redstone
  - Behaviors: cooperative, competitive, cautious, bold, creative, efficient, patient, impulsive, organized, spontaneous
  - Social: talkative, quiet, friendly, solitary, leader, follower, helper, independent, loyal, opportunistic

- **Personality Generation**:
  - Each agent gets 2-3 likes and 1-2 dislikes per category
  - 3-5 dominant personality traits
  - Completely unique combinations

- **Genetic Inheritance**:
  - Offspring inherit parent preferences with 30% mutation rate
  - Traits can change across generations
  - Creates family lineages with similar personalities

- **Compatibility Scoring**:
  - Calculates -1.0 to +1.0 compatibility between any two agents
  - Shared likes: +0.2 per match
  - Shared dislikes: +0.1 per match
  - Conflicts (A likes what B dislikes): -0.3 per conflict
  - Compatibility labels: Best Friends (+0.7), Good Friends (+0.4), Friendly (+0.2), Neutral (0), Tense (-0.1), Rivalry (-0.3), Enemies (-0.6)

- **Experience-Based Evolution**:
  - Successful activities become liked over time
  - Failed/dangerous activities become disliked
  - Agents can change preferences based on experiences
  - `updateFromExperience()` method tracks this

- **Conversation Topics**:
  - `getConversationTopic()` returns random like/dislike to discuss
  - Agents share their preferences in conversations

- **Faction Finding**:
  - `findCompatibleAgents()` - finds agents with similar preferences
  - `findRivals()` - finds agents with conflicting preferences
  - Enables emergent faction/group formation

### 2. Memory System Enhancements (`agent_memory_system.js`)

**New Tables**:
- `preference_discussions` - tracks conversations about likes/dislikes
- `personality_snapshots` - stores agent personalities for genetic lineage

**New Methods**:
- `storePreferenceDiscussion()` - records when agents discuss preferences
- `getPreferenceDiscussions()` - retrieves past preference conversations
- `savePersonalitySnapshot()` - saves personality for offspring inheritance
- `getPersonalitySnapshot()` - loads parent personality for inheritance
- `updateRelationshipWithCompatibility()` - relationship updates with compatibility modifiers

**Compatibility Effects**:
- High compatibility (>0.5): +0.1 bonus to bond strength
- Low compatibility (<-0.2): -0.05 penalty to bond strength

### 3. Chat LLM Integration (`agent_chat_llm.js`)

**Enhanced Prompt Building**:
- Includes personality traits in conversation context
- Shows preference to discuss (if any)
- Indicates compatibility level with listener
- "You feel a strong connection with..." or "You feel tension with..."

**Preference-Aware Dialogue** (Mock Backend):
- **Like templates**: "I really love mining! Do you like mining too?"
- **Dislike templates**: "I really don't like caves. Do you feel the same?"
- **Friendship templates**: "You're one of my best friends here!"
- **Rivalry templates**: "We don't see eye to eye, do we?"

**All backends** (Transformers.js, node-llama-cpp, Ollama) receive personality context in prompts.

### 4. Main System Integration (`intelligent_village.js`)

**Completed**:
- ✅ Personality system imported and initialized
- ✅ Startup logs show personality system features
- ✅ System ready for full agent integration

**Ready for Integration** (see `PERSONALITY_INTEGRATION_GUIDE.md`):
- Agent creation with personality generation
- Compatibility calculation during conversations
- Experience-based preference evolution
- Death handler personality preservation
- Dashboard data emission

---

## 📂 Files Created/Modified

| File | Status | Purpose |
|------|--------|---------|
| `agent_personality_system.js` | ✅ NEW | Core personality and compatibility engine |
| `agent_memory_system.js` | ✅ ENHANCED | Added preference discussion and personality tracking |
| `agent_chat_llm.js` | ✅ ENHANCED | Preference-aware dialogue generation |
| `intelligent_village.js` | ✅ PARTIAL | System initialized, ready for full integration |
| `PERSONALITY_INTEGRATION_GUIDE.md` | ✅ NEW | Complete integration roadmap |
| `PERSONALITY_SYSTEM_README.md` | ✅ NEW | This file - system documentation |

---

## 🎮 How It Works

### Agent Lifecycle with Personalities

```
1. SPAWN (Generation 1)
   └─→ Generate random personality
       └─→ Save personality snapshot to database

2. DAILY LIFE
   ├─→ Meet other agents
   │   ├─→ Calculate compatibility
   │   ├─→ Discuss preferences (40% chance)
   │   ├─→ Store discussion in memory
   │   └─→ Update relationship based on compatibility
   │
   ├─→ Perform activities
   │   ├─→ Success → Activity becomes liked
   │   └─→ Failure → Activity becomes disliked
   │
   └─→ Form social groups
       ├─→ Seek out compatible agents (factions)
       └─→ Avoid incompatible agents (rivals)

3. DEATH
   └─→ Save personality for offspring

4. OFFSPRING (Generation 2+)
   ├─→ Inherit parent personality
   ├─→ Apply 30% mutations
   └─→ Slightly different preferences than parent
```

### Compatibility Example

**Agent Alice**:
- Likes: mining, diamonds, cooperative
- Dislikes: caves, competitive

**Agent Bob**:
- Likes: mining, gold, cooperative
- Dislikes: caves, bold

**Compatibility Calculation**:
- Shared likes: mining (+0.2), cooperative (+0.2) = +0.4
- Shared dislikes: caves (+0.1) = +0.1
- Conflicts: None = 0
- **Total: +0.5 (Good Friends)**

Result: Alice and Bob will seek each other out, get bonus social rewards when together, and form a friendship bond.

**Agent Charlie**:
- Likes: competitive, exploring, caves
- Dislikes: mining, cooperative

**Alice ↔ Charlie Compatibility**:
- Conflicts: Alice likes mining/cooperative, Charlie dislikes them (-0.3, -0.3)
- Conflicts: Charlie likes caves/competitive, Alice dislikes them (-0.3, -0.3)
- **Total: -1.0 (Enemies)**

Result: Alice and Charlie will avoid each other, have reduced social rewards, and may form rival factions.

---

## 🌍 Emergent Behaviors

### Expected Social Dynamics

**Factions** (High Compatibility Groups):
- Miners Guild (love mining, diamonds, cooperative)
- Explorers Alliance (love exploring, mountains, bold)
- Builders Collective (love building, creative, organized)
- Farmers Union (love farming, plains, patient)

**Rivalries** (Low Compatibility):
- Miners vs Cave-Haters
- Cooperative vs Competitive personalities
- Bold Explorers vs Cautious Homebodies

**Conversation Examples**:
```
[CHAT] Steve → Alex: "Hey Alex, I really love mining! Do you like mining too?"
[COMPATIBILITY] Steve ↔ Alex: 0.62 (Good Friends)

[CHAT] Alex → Steve: "Steve, you're one of my best friends here!"

[CHAT] Bob → Charlie: "Charlie, I really don't like competitive behavior. Do you feel the same?"
[COMPATIBILITY] Bob ↔ Charlie: -0.45 (Rivalry)

[CHAT] Charlie → Bob: "Bob, we don't see eye to eye, do we?"
```

**Memory Formation**:
- Agents remember who shares their interests
- Strong positive memories with compatible agents
- Tension/conflict memories with incompatible agents
- Preference discussions stored in memory system

**Evolution Over Time**:
```
Gen 1 Miner Steve:
  - Likes: mining, diamonds
  - Experience: mines frequently, finds diamonds
  - Result: mining preference strengthens (+0.05 per success)

Gen 2 Miner Steve Jr:
  - Inherits: mining, diamonds from parent
  - Mutations: adds "caves" to likes (30% mutation)
  - Personality: similar but slightly different

Gen 3 Miner Steve III:
  - Inherits: mining, diamonds, caves
  - Dies in cave accident
  - Result: caves becomes disliked (-0.1 from death)

Gen 4 Miner Steve IV:
  - Inherits: mining, diamonds, DISLIKE caves
  - Personality evolved through experience!
```

---

## 🔧 Configuration Options

### Personality Generation

**In `agent_personality_system.js`**:

```javascript
// Number of likes per category (2-3)
const numLikes = Math.floor(Math.random() * 2) + 2;

// Number of dislikes per category (1-2)
const numDislikes = Math.floor(Math.random() * 2) + 1;

// Number of dominant traits (3-5)
personality.traits = this.selectRandom(allTraits, Math.floor(Math.random() * 3) + 3);
```

### Mutation Rate

**In `intelligent_village.js` when calling `inheritPersonality()`**:

```javascript
// Default: 30% mutation rate
bot.personality = personalitySystem.inheritPersonality(parentPersonality, 0.3);

// Higher mutation (50%) - more diverse offspring
bot.personality = personalitySystem.inheritPersonality(parentPersonality, 0.5);

// Lower mutation (10%) - children very similar to parents
bot.personality = personalitySystem.inheritPersonality(parentPersonality, 0.1);
```

### Compatibility Thresholds

**In `agent_personality_system.js`**:

```javascript
// Adjust compatibility weights
const sharedLikes = p1Likes.filter(item => p2Likes.includes(item));
compatibilityScore += sharedLikes.length * 0.2;  // Increase for stronger like bonuses

const conflicts = p1Likes.filter(item => p2Dislikes.includes(item));
compatibilityScore -= conflicts.length * 0.3;  // Increase for stronger conflict penalties
```

### Experience Evolution Speed

**When calling `updateFromExperience()`**:

```javascript
// Fast learning (0.1 per experience)
personalitySystem.updateFromExperience(bot.personality, 'activities', 'mining', true, 0.1);

// Slow learning (0.01 per experience)
personalitySystem.updateFromExperience(bot.personality, 'activities', 'mining', true, 0.01);

// Default (0.05 per experience)
personalitySystem.updateFromExperience(bot.personality, 'activities', 'mining', true, 0.05);
```

---

## 📊 Database Schema

### preference_discussions Table

```sql
CREATE TABLE preference_discussions (
    discussion_id INTEGER PRIMARY KEY,
    agent_uuid TEXT,
    other_agent_uuid TEXT,
    timestamp DATETIME,
    topic_category TEXT,     -- 'activities', 'biomes', 'items', 'behaviors', 'social'
    topic_item TEXT,          -- 'mining', 'diamonds', 'cooperative', etc.
    agent_sentiment TEXT,     -- 'like' or 'dislike'
    other_sentiment TEXT,     -- 'like', 'dislike', or 'unknown'
    compatibility_impact REAL,
    conversation_text TEXT
);
```

### personality_snapshots Table

```sql
CREATE TABLE personality_snapshots (
    snapshot_id INTEGER PRIMARY KEY,
    agent_uuid TEXT,
    agent_name TEXT,
    generation INTEGER,
    timestamp DATETIME,
    personality_json TEXT,    -- Full personality object as JSON
    parent_uuid TEXT,
    mutation_rate REAL
);
```

---

## 🧪 Testing the System

### Quick Test Script

Create `test_personality_system.js`:

```javascript
const { getPersonalitySystem } = require('./agent_personality_system');

const personalitySystem = getPersonalitySystem();

// Generate two personalities
const alice = personalitySystem.generatePersonality();
const bob = personalitySystem.generatePersonality();

console.log('Alice:', personalitySystem.getPersonalitySummary(alice));
console.log('Bob:', personalitySystem.getPersonalitySummary(bob));

// Calculate compatibility
const compatibility = personalitySystem.calculateCompatibility(alice, bob);
console.log(`Compatibility: ${compatibility.toFixed(2)} (${personalitySystem.getCompatibilityDescription(compatibility)})`);

// Test inheritance
const offspring = personalitySystem.inheritPersonality(alice, 0.3);
console.log('Offspring:', personalitySystem.getPersonalitySummary(offspring));

// Test experience evolution
personalitySystem.updateFromExperience(alice, 'activities', 'mining', true, 0.5);
console.log('After mining success:', personalitySystem.getPersonalitySummary(alice));
```

Run: `node test_personality_system.js`

---

## 🚀 Next Steps

### To Complete Integration:

1. **Follow `PERSONALITY_INTEGRATION_GUIDE.md`** for detailed code changes
2. **Implement personality generation** in `createAgent()` function
3. **Enhance agent communication** with compatibility calculation
4. **Add experience tracking** for preference evolution
5. **Update dashboard** to display personalities and factions
6. **Test with 10-20 agents** to observe emergent behaviors

### Integration Priority:

1. ✅ High: Agent creation (personality generation)
2. ✅ High: Agent communication (compatibility calculation)
3. ⏳ Medium: Experience evolution (activity tracking)
4. ⏳ Medium: Dashboard display (personality UI)
5. ⏳ Low: Advanced faction mechanics (faction warfare, territory)

---

## 🎯 Expected Results

After full integration:

**Population Diversity**:
- Each agent has unique personality
- Genetic lineages with family traits
- Emergent specialization (miners, fighters, builders)

**Social Dynamics**:
- Factions form based on shared interests
- Rivalries emerge from conflicting preferences
- Best friends, acquaintances, rivals, enemies
- Memory-based long-term relationships

**Conversations**:
- Agents discuss what they love/hate
- Ask each other's opinions
- Form bonds over shared interests
- Create tension over conflicts

**Evolution**:
- Successful miners love mining more
- Agents who die in caves hate caves
- Generational personality shifts
- Family lineages with signature traits

---

## 📚 API Reference

### AgentPersonalitySystem

```javascript
// Generate new personality
const personality = personalitySystem.generatePersonality();

// Inherit from parent
const offspring = personalitySystem.inheritPersonality(parentPersonality, mutationRate);

// Calculate compatibility
const score = personalitySystem.calculateCompatibility(personality1, personality2);
const description = personalitySystem.getCompatibilityDescription(score);

// Get conversation topic
const topic = personalitySystem.getConversationTopic(personality);
// Returns: { category: 'activities', item: 'mining', sentiment: 'like' }

// Update from experience
personalitySystem.updateFromExperience(personality, category, item, success, strength);

// Get summary
const summary = personalitySystem.getPersonalitySummary(personality);
// Returns: { traits: [...], loves: [...], hates: [...] }

// Find compatible agents
const friends = personalitySystem.findCompatibleAgents(personality, allAgents, minCompatibility);

// Find rivals
const rivals = personalitySystem.findRivals(personality, allAgents, maxCompatibility);

// Export/import
const json = personalitySystem.exportPersonality(personality);
const loaded = personalitySystem.importPersonality(json);
```

---

## 🎨 Personality Trait Combinations

Some interesting emergent archetypes:

**The Cooperative Miner**:
- Likes: mining, diamonds, cooperative, helper, loyal
- Personality: team player, shares resources, forms mining guilds

**The Lone Explorer**:
- Likes: exploring, mountains, bold, independent, solitary
- Personality: adventures alone, discovers new territories

**The Creative Builder**:
- Likes: building, creative, organized, patient, blocks
- Personality: constructs elaborate structures, artistic

**The Competitive Fighter**:
- Likes: fighting, competitive, bold, weapons, leader
- Personality: challenges others, dominance-seeking

**The Cautious Farmer**:
- Likes: farming, plains, cautious, patient, food
- Personality: safe lifestyle, provides for community

---

## 🐛 Troubleshooting

### "personalitySystem is null"
- Ensure personality system is initialized before agent creation
- Check `personalitySystem = getPersonalitySystem();` was called

### "Compatibility always 0"
- Both agents need personalities
- Check `bot.personality` exists for both agents
- Verify personality objects have likes/dislikes populated

### "Preferences don't evolve"
- Call `updateFromExperience()` after significant events
- Check strength parameter (0.01-0.1 recommended)
- May take 5-10 experiences to see changes

### "All agents have same personality"
- Check personality is generated per-agent, not globally
- Verify not reusing same personality object
- Ensure offspring get `inheritPersonality()` not parent reference

---

This system creates rich, dynamic social interactions that evolve over time - just like The Sims meets WorldBox! 🎮✨
