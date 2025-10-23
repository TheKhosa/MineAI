/**
 * Chat Manager - Intelligent conversation queue and rate limiting
 *
 * Prevents chat spam by:
 * - Queueing conversations with priority
 * - Rate limiting messages per agent
 * - Conversation channels (global, whisper, local)
 * - Smart filtering of redundant messages
 * - Preventing exponential agent-to-agent loops
 */

const config = require('./config');

class ChatManager {
    constructor() {
        // Message queue - FIFO with priority
        this.messageQueue = [];

        // Per-agent cooldowns (agentName -> lastMessageTime)
        this.agentCooldowns = new Map();

        // Active conversations (conversationId -> {participants, lastActivity, messageCount})
        this.activeConversations = new Map();

        // Global rate limiting
        this.globalMessageCount = 0;
        this.globalResetTime = Date.now() + 60000; // Reset every minute

        // Configuration
        this.config = {
            // Cooldowns (ms)
            agentGlobalCooldown: 5000,        // 5s between global messages
            agentWhisperCooldown: 2000,       // 2s between whispers
            agentLocalCooldown: 3000,         // 3s for local chat

            // Limits
            maxMessagesPerMinute: 30,         // Max 30 global messages/min across all agents
            maxConversationLength: 10,        // Max 10 messages per conversation
            conversationTimeout: 60000,       // Conversation expires after 1 min inactivity

            // Probabilities
            agentResponseChance: 0.15,        // 15% chance to respond to other agents (was 30%)
            greetingResponseChance: 0.3,      // 30% chance to greet newcomers

            // Filtering
            filterRepeatedMessages: true,     // Block identical messages
            filterFallbackResponses: true,    // Block generic fallback spam
            useWhisperForDirectMessages: true // Use /msg instead of public chat
        };

        // Blocked phrases (fallback spam)
        this.blockedPhrases = [
            'Thanks for the message!',
            "I'm busy with my",
            'work right now'
        ];

        // Recent messages cache for deduplication
        this.recentMessages = [];
        this.maxRecentMessages = 50;

        // Start queue processor
        this.startQueueProcessor();

        console.log('[CHAT_MANAGER] Initialized with queue-based conversation system');
    }

    /**
     * Queue a message for sending
     * @param {Object} bot - Mineflayer bot instance
     * @param {string} message - Message to send
     * @param {Object} options - { channel: 'global'|'whisper'|'local', target: username, priority: number }
     */
    queueMessage(bot, message, options = {}) {
        const {
            channel = 'global',
            target = null,
            priority = 0,
            skipFilters = false
        } = options;

        // Apply filters
        if (!skipFilters) {
            if (this.shouldBlockMessage(bot, message, channel)) {
                console.log(`[CHAT_MANAGER] Blocked spam from ${bot.agentName}: "${message}"`);
                return false;
            }
        }

        // Check cooldown
        if (!this.checkCooldown(bot.agentName, channel)) {
            console.log(`[CHAT_MANAGER] ${bot.agentName} on cooldown for ${channel} chat`);
            return false;
        }

        // Check global rate limit
        if (channel === 'global' && !this.checkGlobalRateLimit()) {
            console.log(`[CHAT_MANAGER] Global rate limit reached, queuing for later`);
            // Still queue but with lower priority
            priority -= 10;
        }

        // Add to queue
        this.messageQueue.push({
            bot,
            message,
            channel,
            target,
            priority,
            timestamp: Date.now()
        });

        // Sort by priority (higher = sooner)
        this.messageQueue.sort((a, b) => b.priority - a.priority);

        return true;
    }

    /**
     * Check if agent can send message (cooldown check)
     */
    checkCooldown(agentName, channel) {
        const now = Date.now();
        const lastTime = this.agentCooldowns.get(agentName) || 0;

        let cooldown;
        switch (channel) {
            case 'global':
                cooldown = this.config.agentGlobalCooldown;
                break;
            case 'whisper':
                cooldown = this.config.agentWhisperCooldown;
                break;
            case 'local':
                cooldown = this.config.agentLocalCooldown;
                break;
            default:
                cooldown = this.config.agentGlobalCooldown;
        }

        return (now - lastTime) >= cooldown;
    }

    /**
     * Check global rate limit
     */
    checkGlobalRateLimit() {
        const now = Date.now();

        // Reset counter every minute
        if (now > this.globalResetTime) {
            this.globalMessageCount = 0;
            this.globalResetTime = now + 60000;
        }

        return this.globalMessageCount < this.config.maxMessagesPerMinute;
    }

    /**
     * Should block this message?
     */
    shouldBlockMessage(bot, message, channel) {
        // 1. Check for blocked phrases (fallback spam)
        if (this.config.filterFallbackResponses) {
            for (const phrase of this.blockedPhrases) {
                if (message.includes(phrase)) {
                    return true;
                }
            }
        }

        // 2. Check for repeated messages (deduplication)
        if (this.config.filterRepeatedMessages) {
            const messageKey = `${bot.agentName}:${message}`;
            if (this.recentMessages.includes(messageKey)) {
                return true;
            }

            // Add to recent cache
            this.recentMessages.push(messageKey);
            if (this.recentMessages.length > this.maxRecentMessages) {
                this.recentMessages.shift();
            }
        }

        return false;
    }

    /**
     * Process message queue (runs continuously)
     */
    startQueueProcessor() {
        setInterval(() => {
            if (this.messageQueue.length === 0) return;

            // Get next message
            const queuedMessage = this.messageQueue.shift();
            if (!queuedMessage) return;

            const { bot, message, channel, target } = queuedMessage;

            // Send message based on channel
            try {
                switch (channel) {
                    case 'whisper':
                        if (target) {
                            bot.chat(`/w ${target} ${message}`);
                            console.log(`[CHAT] ${bot.agentName} → ${target} (whisper): "${message}"`);
                        }
                        break;

                    case 'local':
                        // Local chat not implemented in vanilla - use global for now
                        bot.chat(message);
                        console.log(`[CHAT] ${bot.agentName} (local): "${message}"`);
                        break;

                    case 'global':
                    default:
                        bot.chat(message);
                        console.log(`[CHAT] ${bot.agentName}: "${message}"`);
                        this.globalMessageCount++;
                        break;
                }

                // Update cooldown
                this.agentCooldowns.set(bot.agentName, Date.now());

            } catch (error) {
                console.error(`[CHAT_MANAGER] Error sending message from ${bot.agentName}: ${error.message}`);
            }

        }, 1000); // Process 1 message per second
    }

    /**
     * Should agent respond to this message?
     * Returns: { shouldRespond: boolean, priority: number, channel: string, target: string }
     */
    shouldRespond(bot, username, message, isAgent = false) {
        const lowerMessage = message.toLowerCase();
        const myName = bot.agentName.toLowerCase();

        // 1. Direct mention - ALWAYS respond (high priority, use whisper)
        const isMentioned = lowerMessage.includes(myName);
        if (isMentioned) {
            return {
                shouldRespond: true,
                priority: 10,
                channel: this.config.useWhisperForDirectMessages ? 'whisper' : 'global',
                target: username
            };
        }

        // 2. Name-only message - Simple acknowledgment
        const isNameOnly = lowerMessage.trim() === myName.trim();
        if (isNameOnly) {
            return {
                shouldRespond: true,
                priority: 5,
                channel: 'whisper',
                target: username,
                quickReply: `Yes, ${username}?`
            };
        }

        // 3. Greeting to everyone - Medium chance
        const isGreeting = (lowerMessage.includes('hello') || lowerMessage.includes('hi ') || lowerMessage.includes('hey'))
                          && !lowerMessage.includes('there'); // Exclude "hi there"
        if (isGreeting && !isAgent) {
            if (Math.random() < this.config.greetingResponseChance) {
                return {
                    shouldRespond: true,
                    priority: 3,
                    channel: 'global',
                    target: username
                };
            }
        }

        // 4. Another agent talking - LOW chance (prevent exponential spam)
        if (isAgent) {
            if (Math.random() < this.config.agentResponseChance) {
                return {
                    shouldRespond: true,
                    priority: 1,
                    channel: 'whisper', // Use whisper to reduce spam
                    target: username
                };
            }
        }

        // Don't respond
        return { shouldRespond: false };
    }

    /**
     * Create conversation session
     */
    startConversation(participants) {
        const conversationId = participants.sort().join('_');

        if (!this.activeConversations.has(conversationId)) {
            this.activeConversations.set(conversationId, {
                participants,
                startTime: Date.now(),
                lastActivity: Date.now(),
                messageCount: 0
            });
        }

        return conversationId;
    }

    /**
     * Update conversation activity
     */
    updateConversation(conversationId) {
        const conversation = this.activeConversations.get(conversationId);
        if (conversation) {
            conversation.lastActivity = Date.now();
            conversation.messageCount++;

            // End conversation if too long
            if (conversation.messageCount >= this.config.maxConversationLength) {
                this.endConversation(conversationId);
            }
        }
    }

    /**
     * End conversation
     */
    endConversation(conversationId) {
        this.activeConversations.delete(conversationId);
        console.log(`[CHAT_MANAGER] Ended conversation: ${conversationId}`);
    }

    /**
     * Cleanup expired conversations
     */
    cleanupConversations() {
        const now = Date.now();
        const toDelete = [];

        for (const [id, conv] of this.activeConversations.entries()) {
            if (now - conv.lastActivity > this.config.conversationTimeout) {
                toDelete.push(id);
            }
        }

        toDelete.forEach(id => this.endConversation(id));
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            queueLength: this.messageQueue.length,
            activeConversations: this.activeConversations.size,
            globalMessagesThisMinute: this.globalMessageCount,
            agentsOnCooldown: this.agentCooldowns.size
        };
    }
}

// Singleton instance
let chatManagerInstance = null;

function getChatManager() {
    if (!chatManagerInstance) {
        chatManagerInstance = new ChatManager();

        // Start cleanup interval
        setInterval(() => {
            chatManagerInstance.cleanupConversations();
        }, 30000); // Every 30 seconds
    }

    return chatManagerInstance;
}

module.exports = {
    ChatManager,
    getChatManager
};
