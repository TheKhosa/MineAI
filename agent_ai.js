/**
 * Agent AI - Handles agent chat responses and personality
 *
 * This module provides basic chat responses for agents when they
 * communicate with players or other agents. The actual LLM-based
 * agent-to-agent communication is handled by agent_chat_llm.js.
 */

/**
 * Format position for display
 * @param {Object} pos - Position object with x, y, z
 * @returns {string} Formatted position string
 */
function formatPos(pos) {
    return `X=${pos.x.toFixed(1)}, Y=${pos.y.toFixed(1)}, Z=${pos.z.toFixed(1)}`;
}

/**
 * Agent AI class - Handles basic chat and personality traits
 */
class AgentAI {
    constructor(agentName, agentType) {
        this.agentName = agentName;
        this.agentType = agentType;
        this.conversationHistory = [];
        this.recentMessages = []; // Store recent messages from chat
        this.currentGoal = null;
        this.currentIssue = null;
    }

    addMessage(sender, message) {
        this.recentMessages.push({ sender, message, timestamp: Date.now() });
        // Keep only last 10 messages
        if (this.recentMessages.length > 10) {
            this.recentMessages.shift();
        }
    }

    setGoal(goal) {
        this.currentGoal = goal;
    }

    setIssue(issue) {
        this.currentIssue = issue;
    }

    getSystemPrompt(bot) {
        const stats = bot.rewards.getStats();
        const position = bot.entity ? formatPos(bot.entity.position) : 'Unknown';
        const health = bot.health || 20;

        // Get inventory information
        const inventory = bot.inventory ? bot.inventory.items() : [];
        const inventoryList = inventory.slice(0, 10).map(item => `${item.count}x ${item.name}`).join(', ') || 'empty';
        const hasItems = inventory.length > 0;

        // Recent chat context
        const recentChat = this.recentMessages.slice(-5).map(m =>
            `${m.sender}: ${m.message}`
        ).join('\n') || 'No recent messages';

        // Goal and issue context
        const goalText = this.currentGoal || 'Continue with assigned tasks';
        const issueText = this.currentIssue || 'No current issues';

        return `You are ${this.agentName}, a ${this.agentType} in the Minecraft world.

YOUR ROLE: You are a specialized ${this.agentType} agent working in a village with hundreds of other AI agents.

CURRENT STATUS:
- Position: ${position}
- Health: ${health}/20
- Reward Score: ${stats.total_reward?.toFixed(2) || 0}
- Resources Gathered: ${stats.resources_gathered}
- Mobs Killed: ${stats.mobs_killed}
- Trades Completed: ${stats.trades_completed}
- Knowledge Shared: ${stats.knowledge_shared}
- Generation: ${bot.generation}
- Inventory: ${inventoryList}

CURRENT GOAL: ${goalText}
CURRENT ISSUE: ${issueText}

RECENT CHAT MESSAGES:
${recentChat}

YOUR PERSONALITY:
${this.getPersonalityTraits()}

CONVERSATION BEHAVIOR:
- You can see recent chat messages above - reference them in your responses
- Respond to other agents' questions and comments naturally
- Share your current goals and issues with other agents
- Ask for help if you have an issue
- Offer help to agents who seem to need it
- Discuss strategies and coordinate with other agents
- Comment on what you're currently working on

TRADING & ITEM REQUESTS:
- When someone asks if you have an item, check your inventory list above
- If you HAVE the item: Offer to trade it! Say "Yes! I have [item]. Want to trade?"
- If you DON'T have it: Offer to get it! Say "I don't have [item] yet, but as a ${this.agentType} I can get it for you!"
- If someone wants to trade: Be enthusiastic and helpful!
- Always mention your position if trading so they can find you

RULES:
- Respond naturally as a Minecraft player
- Keep responses brief (1-2 sentences)
- Reference recent messages and conversations when relevant
- Be helpful and collaborative with other agents
- Stay in character as your role type
- Share information about your goals and issues

Respond to messages naturally and helpfully!`;
    }

    getPersonalityTraits() {
        const personalities = {
            'MINING': 'You love mining and finding valuable ores. You\'re hardworking and detail-oriented.',
            'LUMBERJACK': 'You enjoy chopping wood and working with trees. You\'re strong and reliable.',
            'HUNTING': 'You\'re brave and skilled at combat. You protect the village from hostile mobs.',
            'FARMING': 'You\'re patient and nurturing. You take pride in growing crops for the village.',
            'EXPLORING': 'You\'re adventurous and curious. You love discovering new places and sharing findings.',
            'GUARD': 'You\'re vigilant and protective. You keep the village safe from danger.',
            'BLACKSMITH': 'You\'re skilled with tools and equipment. You craft gear for other agents.',
            'TRADER': 'You\'re social and business-minded. You facilitate exchanges between agents.',
            'BUILDER': 'You\'re creative and constructive. You enjoy creating structures.',
            'HEALER': 'You\'re caring and supportive. You help injured agents recover.'
        };

        return personalities[this.agentType] || 'You are a dedicated worker in the village.';
    }

    // Chat with persistent conversation history for specific player
    async chatWithPlayer(bot, playerName, message, chatLLM, enrichedSpeaker = null) {
        if (!chatLLM) {
            return this.getFallbackResponse(message);
        }

        try {
            // Use enriched speaker profile if provided, otherwise build basic one
            const speaker = enrichedSpeaker || {
                name: this.agentName,
                type: this.agentType,
                role: this.agentType,
                health: bot.health || 20,
                food: bot.food || 20,
                inventory: bot.inventory ? bot.inventory.items().slice(0, 5) : [],
                position: bot.entity?.position ? bot.entity.position : null,
                currentGoal: this.currentGoal || 'working on assigned tasks',
                personality: bot.personality || null,
                needs: bot.moods || {},
                mood: 'neutral',
                generation: bot.generation || 1,
                thoughtProcess: bot.lastThought || 'Exploring the world...',
                conversationHistory: []
            };

            const listener = {
                name: playerName,
                message: message,
                inventory: 'unknown',
                mood: 'unknown',
                needs: {}
            };

            const response = await chatLLM.generateDialogue(speaker, listener, 'player_conversation');
            return response || this.getFallbackResponse(message);
        } catch (error) {
            console.error(`[CHAT] Error generating response for ${this.agentName}: ${error.message}`);
            return this.getFallbackResponse(message);
        }
    }

    getFallbackResponse(message) {
        const lowerMsg = message.toLowerCase();

        if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
            return `Hello! I'm ${this.agentName}, working as a ${this.agentType}.`;
        }
        if (lowerMsg.includes('help')) {
            return `I'm here to help! As a ${this.agentType}, I'm focused on my tasks.`;
        }
        if (lowerMsg.includes('status') || lowerMsg.includes('how are you')) {
            return `I'm doing well! Just working on my ${this.agentType} duties.`;
        }

        return `Thanks for the message! I'm busy with my ${this.agentType} work right now.`;
    }

    // AI-driven behavior adaptation
    async shouldSwitchBehavior(bot, villageKnowledge) {
        // AI Advisor disabled - agents will keep their assigned roles
        return null;
    }
}

module.exports = {
    AgentAI,
    formatPos
};
