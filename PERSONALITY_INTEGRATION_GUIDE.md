# Personality System Integration Guide

This document outlines all the integration points for the agent personality system in `intelligent_village.js`.

---

## ✅ Completed Integration Points

### 1. System Imports (Line 30-32)
```javascript
// === PERSONALITY SYSTEM ===
const { getPersonalitySystem } = require('./agent_personality_system');
let personalitySystem = null;  // Will be initialized after server starts
```

### 2. System Initialization (Line 3682-3694)
```javascript
// Initialize Personality System
console.log('\n' + '='.repeat(70));
console.log('[PERSONALITY] Initializing Agent Personality System...');
personalitySystem = getPersonalitySystem();
console.log('[PERSONALITY] Sims-like preferences and compatibility system active');
console.log('[PERSONALITY] Features:');
console.log('  - Likes/dislikes across 5 categories (activities, biomes, items, behaviors, social)');
console.log('  - Compatibility scoring (-1.0 to +1.0)');
console.log('  - Emergent factions based on shared interests');
console.log('  - Genetic inheritance with mutations');
console.log('  - Experience-based preference evolution');
console.log('[PERSONALITY] Agents will discuss preferences and form relationships/rivalries');
console.log('='.repeat(70) + '\n');
```

---

## 🔧 Integration Points Needed

### 3. Agent Creation - Add Personality Generation

**Location**: `createAgent()` function (around line 1846)

**Add after bot creation, before initial spawn**:

```javascript
// Generate personality for new agent
if (personalitySystem) {
    if (parentUUID && generation > 1) {
        // Try to inherit personality from parent
        const parentData = agentPopulation.get(parentName);
        if (parentData && parentData.personality) {
            bot.personality = personalitySystem.inheritPersonality(parentData.personality, 0.3);
            console.log(`[PERSONALITY] ${bot.agentName} inherited personality from ${parentName} (Gen ${generation})`);
        } else {
            bot.personality = personalitySystem.generatePersonality();
            console.log(`[PERSONALITY] ${bot.agentName} generated new personality (parent data not found)`);
        }
    } else {
        // Generate new personality for first generation
        bot.personality = personalitySystem.generatePersonality();
        console.log(`[PERSONALITY] ${bot.agentName} generated new Gen ${generation} personality`);
    }

    // Store personality snapshot in memory system
    if (memorySystem && bot.uuid) {
        memorySystem.savePersonalitySnapshot(
            bot.uuid,
            bot.agentName,
            generation,
            bot.personality,
            parentUUID,
            0.3
        ).catch(err => console.error('[PERSONALITY] Failed to save snapshot:', err.message));
    }

    // Log personality summary
    const summary = personalitySystem.getPersonalitySummary(bot.personality);
    console.log(`[PERSONALITY] ${bot.agentName} traits: ${summary.traits}`);
    console.log(`[PERSONALITY] ${bot.agentName} loves: ${summary.loves.slice(0, 3).join(', ')}`);
    console.log(`[PERSONALITY] ${bot.agentName} hates: ${summary.hates.slice(0, 2).join(', ')}`);
}
```

### 4. Agent Communication - Add Compatibility Calculation

**Location**: `tryAgentCommunication()` function (around line 1751)

**Replace the existing function with enhanced version**:

```javascript
async function tryAgentCommunication(bot) {
    if (!bot.entity || !bot.agentName) return;
    if (!chatLLM || !personalitySystem) return;

    // Find nearby player entities (other agents)
    const nearbyPlayers = Object.values(bot.entities || {}).filter(entity => {
        if (!entity || !entity.position || entity === bot.entity) return false;
        if (entity.type !== 'player') return false;
        const distance = entity.position.distanceTo(bot.entity.position);
        return distance > 0 && distance < 20;
    });

    if (nearbyPlayers.length === 0) return;

    const targetEntity = nearbyPlayers[Math.floor(Math.random() * nearbyPlayers.length)];
    const targetName = targetEntity.username || 'Unknown';

    // Get target agent data from activeAgents
    const targetBot = activeAgents.get(targetName);

    // Calculate compatibility if both agents have personalities
    let compatibility = 0;
    if (bot.personality && targetBot && targetBot.personality) {
        compatibility = personalitySystem.calculateCompatibility(bot.personality, targetBot.personality);
        const compatibilityDesc = personalitySystem.getCompatibilityDescription(compatibility);
        console.log(`[COMPATIBILITY] ${bot.agentName} ↔ ${targetName}: ${compatibility.toFixed(2)} (${compatibilityDesc})`);
    }

    // Get a conversation topic (like/dislike to discuss)
    const preferenceToDiscuss = Math.random() < 0.4 ? // 40% chance to discuss preferences
        personalitySystem.getConversationTopic(bot.personality) : null;

    // Build context
    const speaker = {
        name: bot.agentName,
        health: bot.health / 20,
        food: bot.food / 20,
        needs: bot.moods || {},
        inventory: bot.inventory ? Object.keys(bot.inventory.items()).length + ' items' : 'empty',
        mood: getMoodDescription(bot.moods),
        personality: bot.personality,
        preferenceToDiscuss: preferenceToDiscuss,
        compatibility: compatibility
    };

    const listener = {
        name: targetName,
        needs: targetBot?.moods || {},
        inventory: targetBot ? 'items' : 'unknown',
        mood: targetBot ? getMoodDescription(targetBot.moods) : 'unknown'
    };

    let context = 'nearby';
    if (bot.moods) {
        if (bot.moods.health < 0.3) context = 'low_health';
        else if (bot.moods.safety < 0.3) context = 'danger';
        else if (bot.moods.resources < 0.3) context = 'trading';
    }

    const message = await chatLLM.generateDialogue(speaker, listener, context);

    if (message && message.length > 0) {
        bot.chat(message);
        console.log(`[CHAT] ${bot.agentName} → ${targetName}: "${message}" (context: ${context}, compatibility: ${compatibility.toFixed(2)})`);

        // Store preference discussion in memory if topic was discussed
        if (memorySystem && preferenceToDiscuss && bot.uuid && targetBot?.uuid) {
            // Try to infer other agent's sentiment from their personality
            let otherSentiment = 'unknown';
            if (targetBot.personality) {
                const category = preferenceToDiscuss.category;
                const item = preferenceToDiscuss.item;
                if (targetBot.personality.likes[category]?.includes(item)) {
                    otherSentiment = 'like';
                } else if (targetBot.personality.dislikes[category]?.includes(item)) {
                    otherSentiment = 'dislike';
                }
            }

            memorySystem.storePreferenceDiscussion(
                bot.uuid,
                targetBot.uuid,
                preferenceToDiscuss,
                preferenceToDiscuss.sentiment,
                otherSentiment,
                compatibility,
                message
            ).catch(err => console.error('[MEMORY] Failed to store preference discussion:', err.message));
        }

        // Emit to dashboard with compatibility info
        if (dashboard && dashboard.io) {
            dashboard.io.emit('agent_chat', {
                timestamp: Date.now(),
                from: bot.agentName,
                to: targetName,
                message,
                context,
                distance: targetEntity.position.distanceTo(bot.entity.position).toFixed(1),
                compatibility: compatibility.toFixed(2),
                compatibilityDesc: personalitySystem.getCompatibilityDescription(compatibility),
                topic: preferenceToDiscuss ? `${preferenceToDiscuss.sentiment} ${preferenceToDiscuss.item}` : null
            });
        }

        // Calculate social rewards based on compatibility
        let socialReward = 0.5; // Base reward
        if (compatibility > 0.5) {
            socialReward += 0.3; // Bonus for talking to compatible agent
        } else if (compatibility < -0.2) {
            socialReward = 0.2; // Reduced reward for incompatible interaction
        }

        // Update moods
        if (bot.moods && bot.moods.social !== undefined) {
            bot.moods.social = Math.min(1.0, bot.moods.social + 0.1 * (1 + compatibility * 0.5));
        }

        // Give rewards
        if (bot.rewards) {
            bot.rewards.addReward('social_interaction', socialReward, `(talked to ${targetName}, compat: ${compatibility.toFixed(2)})`);
        }

        // Update relationship in memory system with compatibility modifier
        if (memorySystem && bot.uuid && targetBot?.uuid) {
            memorySystem.updateRelationshipWithCompatibility(
                bot.uuid,
                targetBot.uuid,
                targetName,
                compatibility,
                {
                    type: compatibility > 0.3 ? 'friend' : (compatibility < -0.2 ? 'rival' : 'acquaintance'),
                    bondChange: 0.05 * (1 + compatibility),
                    trustChange: 0.02,
                    wasCooperation: true,
                    wasConflict: compatibility < -0.3
                }
            ).catch(err => console.error('[MEMORY] Failed to update relationship:', err.message));
        }
    }
}
```

### 5. Death Handler - Save Personality for Offspring

**Location**: Bot's `end` event handler (around line 2400-2450)

**Add before spawning offspring**:

```javascript
// Save personality data for offspring inheritance
if (bot.personality && bot.uuid) {
    if (!agentPopulation.has(bot.agentName)) {
        agentPopulation.set(bot.agentName, {});
    }
    const agentData = agentPopulation.get(bot.agentName);
    agentData.personality = bot.personality;  // Store for inheritance
    console.log(`[PERSONALITY] Saved ${bot.agentName}'s personality for offspring`);
}
```

### 6. Experience-Based Preference Evolution

**Location**: Throughout bot event handlers (mining, combat, achievements)

**Example for mining success**:

```javascript
// When agent successfully mines a block
bot.on('digged', (block) => {
    if (personalitySystem && bot.personality) {
        personalitySystem.updateFromExperience(
            bot.personality,
            'activities',
            'mining',
            true,  // success
            0.05   // small increase per success
        );
    }
});
```

**Example for combat success**:

```javascript
// When agent kills a mob
bot.on('entityHurt', (entity) => {
    if (entity.type === 'mob' && entity.health <= 0) {
        if (personalitySystem && bot.personality) {
            personalitySystem.updateFromExperience(
                bot.personality,
                'activities',
                'fighting',
                true,
                0.05
            );
        }
    }
});
```

**Example for death (negative experience)**:

```javascript
// When agent dies
bot.on('death', () => {
    // Last activity before death becomes disliked
    if (personalitySystem && bot.personality && bot.lastActivity) {
        personalitySystem.updateFromExperience(
            bot.personality,
            'activities',
            bot.lastActivity,
            false,  // failure/death
            0.1     // stronger negative experience
        );
    }
});
```

---

## 🎯 Reward System Integration

### Add Compatibility-Based Reward Modifiers

**Location**: ML reward calculation functions

```javascript
// Bonus rewards for agents working near compatible agents
function getCooperationBonus(bot, nearbyAgents) {
    let bonus = 0;
    if (!personalitySystem || !bot.personality) return 0;

    for (const nearby of nearbyAgents) {
        if (nearby.personality) {
            const compatibility = personalitySystem.calculateCompatibility(
                bot.personality,
                nearby.personality
            );

            if (compatibility > 0.5) {
                bonus += 0.5 * compatibility;  // Up to +0.5 reward for high compatibility
            }
        }
    }

    return bonus;
}
```

---

## 📊 Dashboard Integration

### Send Personality Data to Dashboard

**Location**: Dashboard data emission (socket.io events)

```javascript
// When sending agent data to dashboard
if (dashboard && dashboard.io) {
    const personalitySummary = bot.personality ?
        personalitySystem.getPersonalitySummary(bot.personality) : null;

    dashboard.io.emit('agent_update', {
        name: bot.agentName,
        uuid: bot.uuid,
        generation: bot.generation,
        health: bot.health,
        food: bot.food,
        // ... other stats
        personality: personalitySummary,
        compatibleAgents: bot.personality ?
            personalitySystem.findCompatibleAgents(bot.personality, activeAgents, 0.4).slice(0, 5) :
            [],
        rivals: bot.personality ?
            personalitySystem.findRivals(bot.personality, activeAgents, -0.2).slice(0, 3) :
            []
    });
}
```

---

## 🧪 Testing Checklist

- [ ] Agents spawn with unique personalities
- [ ] Offspring inherit parent personalities with mutations
- [ ] Agents discuss preferences in chat
- [ ] Compatibility scores affect relationship bonds
- [ ] High compatibility agents seek each other out (emergent factions)
- [ ] Low compatibility agents avoid/rival each other
- [ ] Successful activities become liked over time
- [ ] Dangerous/failed activities become disliked
- [ ] Dashboard shows personality traits and compatibility
- [ ] Memory system stores preference discussions
- [ ] Social rewards scale with compatibility

---

## 📝 Next Steps

1. Implement integration points 3-6 in `intelligent_village.js`
2. Update dashboard.js to display personality information
3. Test with 10-20 agents
4. Observe emergent faction formation
5. Fine-tune compatibility thresholds
6. Add dashboard visualizations (faction clusters, compatibility network)

---

## 🎮 Expected Emergent Behaviors

After implementation, you should see:

- **Factions**: Agents with similar likes cluster together
- **Rivalries**: Agents with conflicting preferences avoid each other
- **Personality Evolution**: Miners develop love for mining, fighters for combat
- **Social Dynamics**: Best friends, acquaintances, rivals, enemies
- **Preference Discussions**: "I love diamonds!" "I hate mining!" etc.
- **Memory-Based Relationships**: Agents remember past conversations
- **Genetic Lineages**: Family lines with similar personality traits

---

This creates a rich social simulation layer on top of the existing ML and genetic systems!
