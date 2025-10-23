/**
 * Dynamic Prompt Builder for Context-Aware Agent Conversations
 *
 * Generates rich, contextual prompts using:
 * - Sensor data (274k+ blocks, entities)
 * - Current actions (216-action space)
 * - Emotions/moodles (14 status effects)
 * - Skills (20 McMMO-style skills)
 * - Inventory, nearby entities, relationships
 * - Weather, time, biome, dimension
 */

const { getMemorySystem } = require('./agent_memory_system');

class DynamicPromptBuilder {
    constructor() {
        this.memorySystem = getMemorySystem();
    }

    /**
     * Build a rich, context-aware prompt for agent conversation
     */
    async buildConversationPrompt(speaker, listener = null, conversationType = 'greeting') {
        // Get or select appropriate prompt template
        const template = await this.selectPromptTemplate(conversationType, speaker, listener);

        // Build context data
        const context = await this.buildContextData(speaker, listener);

        // Fill template with context
        const prompt = this.fillTemplate(template, context);

        return {
            prompt,
            context,
            templateName: template.name
        };
    }

    /**
     * Select the best prompt template based on situation
     */
    async selectPromptTemplate(conversationType, speaker, listener) {
        // Try to get from database first
        const dbPrompt = await this.memorySystem.getPrompt(`${conversationType}_chat`);

        if (dbPrompt) {
            return {
                name: dbPrompt.prompt_name,
                template: dbPrompt.prompt_template,
                requires: {
                    sensorData: dbPrompt.requires_sensor_data,
                    actionContext: dbPrompt.requires_action_context,
                    emotionContext: dbPrompt.requires_emotion_context,
                    socialContext: dbPrompt.requires_social_context,
                    inventory: dbPrompt.requires_inventory,
                    nearbyEntities: dbPrompt.requires_nearby_entities,
                    nearbyBlocks: dbPrompt.requires_nearby_blocks
                }
            };
        }

        // Fallback to default templates
        return this.getDefaultTemplate(conversationType);
    }

    /**
     * Get default prompt templates
     */
    getDefaultTemplate(conversationType) {
        const templates = {
            greeting: {
                name: 'greeting_chat',
                template: `You are {{speaker_name}}, a Minecraft agent with the role of {{speaker_role}}.

=== YOUR STATUS ===
Health: {{health}}/20 | Food: {{food}}/20
Location: {{location}}
Biome: {{biome}} | Time: {{time_of_day}} | Weather: {{weather}}
Current Action: {{current_action}}
Current Goal: {{current_goal}}
Feeling: {{current_emotion}}

=== YOUR INVENTORY ({{inventory_count}} items) ===
{{inventory_summary}}

=== YOUR PERSONALITY ===
Traits: {{personality_traits}}
Likes: {{personality_likes}}
Dislikes: {{personality_dislikes}}

=== YOUR SKILLS (Top 5) ===
{{top_skills}}

=== YOUR STATUS EFFECTS ===
{{moodles}}

=== RECENT ACTIONS ===
{{recent_actions}}

{{#if listener}}
=== TALKING TO ===
{{listener_name}} ({{distance}}m away)
Role: {{listener_role}}
Your Relationship: {{relationship_type}} (bond: {{bond_strength}})
{{#if past_conversations}}
You've talked {{conversation_count}} times before. Last topic: {{last_topic}}
{{/if}}
{{/if}}

{{#if nearby_agents}}
=== NEARBY AGENTS ===
{{nearby_agents_list}}
{{/if}}

{{#if nearby_entities}}
=== NEARBY ENTITIES ===
{{nearby_entities_summary}}
{{/if}}

{{#if nearby_blocks}}
=== VISIBLE BLOCKS (nearby) ===
{{nearby_blocks_summary}}
{{/if}}

INSTRUCTIONS: Greet {{listener_name}} in character. Keep it natural and relevant to your current situation, personality, and what you're doing. Mention something about your environment, current task, or how you're feeling. Keep response under 100 characters.`,
                requires: {
                    sensorData: true,
                    actionContext: true,
                    emotionContext: true,
                    socialContext: true,
                    inventory: true,
                    nearbyEntities: true,
                    nearbyBlocks: true
                }
            },

            casual_chat: {
                name: 'casual_chat',
                template: `You are {{speaker_name}}, currently {{current_action}}.

Status: {{health}}HP, {{food}} hunger, feeling {{current_emotion}}
Location: {{location}} ({{biome}})
Inventory: {{inventory_summary}}
Recent: {{recent_actions}}

Talking to {{listener_name}} ({{distance}}m away)
Relationship: {{relationship_type}} ({{bond_strength}} bond)

Your personality: {{personality_traits}}
You like: {{personality_likes}}
You dislike: {{personality_dislikes}}

Respond naturally based on your situation and personality. Keep it under 120 characters.`,
                requires: {
                    actionContext: true,
                    emotionContext: true,
                    socialContext: true,
                    inventory: true
                }
            },

            action_comment: {
                name: 'action_comment',
                template: `You are {{speaker_name}} ({{speaker_role}}), currently doing: {{current_action}}

Your Status:
- Health: {{health}}/20, Food: {{food}}/20
- Emotion: {{current_emotion}}
- Goal: {{current_goal}}
- Skills: {{top_skills}}

Current Situation:
- Location: {{location}} ({{biome}}, {{time_of_day}}, {{weather}})
- Inventory: {{inventory_summary}}
- Recent actions: {{recent_actions}}

{{#if listener}}
Talking to {{listener_name}} about what you're doing.
{{/if}}

Make a brief, natural comment about your current action or situation. Be in character. Under 100 characters.`,
                requires: {
                    actionContext: true,
                    emotionContext: true,
                    inventory: true
                }
            },

            emotion_express: {
                name: 'emotion_express',
                template: `You are {{speaker_name}}, feeling {{current_emotion}}.

Status Effects: {{moodles}}
Health: {{health}}/20 | Food: {{food}}/20
Current: {{current_action}} | Goal: {{current_goal}}

What caused this feeling:
{{recent_events}}

{{#if listener}}
Talking to {{listener_name}} ({{relationship_type}})
{{/if}}

Express your current emotion naturally based on your situation and status effects. Under 100 characters.`,
                requires: {
                    emotionContext: true,
                    actionContext: true
                }
            },

            discovery: {
                name: 'discovery_chat',
                template: `You are {{speaker_name}} and you just discovered something!

Discovery: {{discovery_type}}
Location: {{location}} ({{biome}})
Nearby: {{nearby_blocks_summary}}

Your reaction based on:
- Role: {{speaker_role}}
- Personality: {{personality_traits}}
- Current goal: {{current_goal}}

{{#if listener}}
Telling {{listener_name}} about your discovery!
{{/if}}

React excitedly to your discovery in character. Under 100 characters.`,
                requires: {
                    nearbyBlocks: true,
                    actionContext: true
                }
            }
        };

        return templates[conversationType] || templates.casual_chat;
    }

    /**
     * Build comprehensive context data from agent state
     */
    async buildContextData(speaker, listener = null) {
        const context = {
            // Speaker basic info
            speaker_name: speaker.username || 'Unknown',
            speaker_role: speaker.agentType || 'EXPLORING',
            speaker_uuid: speaker.uuid || '',

            // Health and status
            health: speaker.bot?.health || 20,
            food: speaker.bot?.food || 20,
            xp_level: speaker.bot?.experience?.level || 0,

            // Location
            location: this.formatLocation(speaker.bot?.entity?.position),
            biome: speaker.currentBiome || 'unknown',
            dimension: speaker.dimension || 'overworld',
            time_of_day: this.getTimeOfDay(speaker.bot),
            weather: speaker.weather || 'clear',

            // Current state
            current_action: speaker.lastActionTaken || 'idle',
            current_goal: speaker.currentGoal || 'explore',
            current_emotion: this.determineEmotion(speaker),

            // Inventory
            inventory_count: speaker.bot?.inventory?.items()?.length || 0,
            inventory_summary: this.summarizeInventory(speaker.bot),

            // Personality
            personality_traits: this.formatTraits(speaker.personality?.traits),
            personality_likes: this.formatPreferences(speaker.personality?.likes),
            personality_dislikes: this.formatPreferences(speaker.personality?.dislikes),

            // Skills
            top_skills: this.formatTopSkills(speaker.subskills || speaker.skills),

            // Moodles/status effects
            moodles: this.formatMoodles(speaker.moodleSystem?.getCurrentMoodles()),

            // Recent actions
            recent_actions: this.formatRecentActions(speaker.actionHistory),

            // Sensor data
            visible_blocks_count: speaker.sensorData?.blockCount || 0,

            // Nearby entities
            nearby_entities: speaker.nearbyEntities || [],
            nearby_entities_summary: this.summarizeEntities(speaker.nearbyEntities),

            // Nearby blocks (from sensor plugin)
            nearby_blocks_summary: this.summarizeNearbyBlocks(speaker.sensorData),

            // Nearby agents
            nearby_agents: [],
            nearby_agents_list: ''
        };

        // Add listener context if present
        if (listener) {
            context.listener = true;
            context.listener_name = listener.username || 'Unknown';
            context.listener_role = listener.agentType || 'EXPLORING';
            context.listener_uuid = listener.uuid || '';

            // Calculate distance
            if (speaker.bot?.entity?.position && listener.bot?.entity?.position) {
                const dist = speaker.bot.entity.position.distanceTo(listener.bot.entity.position);
                context.distance = Math.round(dist);
            } else {
                context.distance = 0;
            }

            // Get relationship data
            const relationship = await this.memorySystem.getRelationship(speaker.uuid, listener.uuid);
            if (relationship) {
                context.relationship_type = relationship.relationship_type || 'neutral';
                context.bond_strength = relationship.bond_strength?.toFixed(2) || '0.00';
            } else {
                context.relationship_type = 'stranger';
                context.bond_strength = '0.00';
            }

            // Get past conversations
            const pastChats = await this.memorySystem.getChatHistory(speaker.uuid, listener.uuid, 5);
            context.past_conversations = pastChats.length > 0;
            context.conversation_count = pastChats.length;
            context.last_topic = pastChats[0]?.message || 'nothing';
        }

        return context;
    }

    /**
     * Fill template with context data
     */
    fillTemplate(template, context) {
        let prompt = template.template;

        // Simple template variable replacement
        for (const [key, value] of Object.entries(context)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            prompt = prompt.replace(regex, value || '');
        }

        // Handle conditionals (simple {{#if var}} ... {{/if}} support)
        prompt = prompt.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, varName, content) => {
            return context[varName] ? content : '';
        });

        // Remove empty lines
        prompt = prompt.split('\n').filter(line => line.trim()).join('\n');

        return prompt;
    }

    /**
     * Helper: Format location
     */
    formatLocation(position) {
        if (!position) return 'unknown';
        return `(${Math.round(position.x)}, ${Math.round(position.y)}, ${Math.round(position.z)})`;
    }

    /**
     * Helper: Get time of day
     */
    getTimeOfDay(bot) {
        if (!bot?.time?.timeOfDay) return 'day';
        const time = bot.time.timeOfDay;
        if (time < 6000) return 'morning';
        if (time < 12000) return 'day';
        if (time < 18000) return 'evening';
        return 'night';
    }

    /**
     * Helper: Determine emotion from moodles and state
     */
    determineEmotion(agent) {
        if (!agent.moodleSystem) return 'neutral';

        const moodles = agent.moodleSystem.getCurrentMoodles();
        if (moodles.some(m => m.type === 'pain' && m.severity > 2)) return 'hurt';
        if (moodles.some(m => m.type === 'panic')) return 'scared';
        if (moodles.some(m => m.type === 'bored')) return 'bored';
        if (moodles.some(m => m.type === 'tired')) return 'tired';
        if (agent.bot?.health < 10) return 'worried';
        if (agent.bot?.food < 6) return 'hungry';

        return 'focused';
    }

    /**
     * Helper: Summarize inventory
     */
    summarizeInventory(bot) {
        if (!bot?.inventory) return 'empty';

        const items = bot.inventory.items();
        if (items.length === 0) return 'empty';

        const summary = items.slice(0, 8).map(item =>
            `${item.name.replace('minecraft:', '')} x${item.count}`
        ).join(', ');

        return items.length > 8 ? `${summary}, +${items.length - 8} more` : summary;
    }

    /**
     * Helper: Format personality traits
     */
    formatTraits(traits) {
        if (!traits || traits.length === 0) return 'balanced';
        return traits.slice(0, 5).join(', ');
    }

    /**
     * Helper: Format preferences
     */
    formatPreferences(prefs) {
        if (!prefs || Object.keys(prefs).length === 0) return 'nothing special';

        const items = [];
        for (const [category, list] of Object.entries(prefs)) {
            if (list && list.length > 0) {
                items.push(...list.slice(0, 2));
            }
        }

        return items.slice(0, 3).join(', ') || 'nothing special';
    }

    /**
     * Helper: Format top skills
     */
    formatTopSkills(skills) {
        if (!skills) return 'none yet';

        const skillArray = Object.entries(skills)
            .map(([name, data]) => ({ name, level: data.level || 0 }))
            .sort((a, b) => b.level - a.level)
            .slice(0, 5);

        if (skillArray.length === 0) return 'none yet';

        return skillArray.map(s => `${s.name}: Lv${s.level}`).join(', ');
    }

    /**
     * Helper: Format moodles
     */
    formatMoodles(moodles) {
        if (!moodles || moodles.length === 0) return 'feeling normal';

        return moodles.map(m => `${m.type}(${m.severity})`).join(', ');
    }

    /**
     * Helper: Format recent actions
     */
    formatRecentActions(actionHistory) {
        if (!actionHistory || actionHistory.length === 0) return 'just spawned';

        return actionHistory.slice(-3).map(a => a.action || 'idle').join(' → ');
    }

    /**
     * Helper: Summarize entities
     */
    summarizeEntities(entities) {
        if (!entities || entities.length === 0) return 'none';

        const counts = {};
        entities.forEach(e => {
            const type = e.name || e.type || 'unknown';
            counts[type] = (counts[type] || 0) + 1;
        });

        return Object.entries(counts)
            .map(([type, count]) => `${count}x ${type}`)
            .slice(0, 5)
            .join(', ');
    }

    /**
     * Helper: Summarize nearby blocks from sensor data
     */
    summarizeNearbyBlocks(sensorData) {
        if (!sensorData || !sensorData.blockCounts) return 'unknown area';

        const blocks = Object.entries(sensorData.blockCounts)
            .filter(([name]) => !name.includes('air'))
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name, count]) => `${name.replace('minecraft:', '')}: ${count}`)
            .join(', ');

        return blocks || 'mostly air';
    }

    /**
     * Seed initial prompt library to database
     */
    async seedPromptLibrary() {
        console.log('[DYNAMIC PROMPTS] Seeding prompt library...');

        const templates = [
            'greeting',
            'casual_chat',
            'action_comment',
            'emotion_express',
            'discovery'
        ];

        for (const templateName of templates) {
            const template = this.getDefaultTemplate(templateName);

            await this.memorySystem.upsertPrompt({
                name: template.name,
                category: templateName,
                template: template.template,
                description: `Default ${templateName} prompt template`,
                requiresSensorData: template.requires.sensorData || false,
                requiresActionContext: template.requires.actionContext || false,
                requiresEmotionContext: template.requires.emotionContext || false,
                requiresSocialContext: template.requires.socialContext || false,
                requiresInventory: template.requires.inventory || false,
                requiresNearbyEntities: template.requires.nearbyEntities || false,
                requiresNearbyBlocks: template.requires.nearbyBlocks || false
            });
        }

        console.log('[DYNAMIC PROMPTS] Seeded', templates.length, 'prompt templates');
    }
}

module.exports = { DynamicPromptBuilder };
