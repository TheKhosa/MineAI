/**
 * Agent Chat LLM - Local language model for agent-to-agent communication
 * Supports multiple backends: Transformers.js, Ollama, or Python subprocess
 */

class AgentChatLLM {
    constructor(backend = 'mock') {
        this.backend = backend;
        this.model = null;
        this.initialized = false;
        this.conversationHistory = [];
        this.maxHistoryLength = 50;

        // Model configuration
        this.config = {
            maxTokens: 50, // Keep responses short for agent chat
            temperature: 0.7,
            topP: 0.9,
            repetitionPenalty: 1.2 // Reduce repetitive outputs
        };
    }

    /**
     * Initialize the LLM backend
     */
    async initialize() {
        if (this.initialized) return true;

        console.log(`[CHAT LLM] Initializing ${this.backend} backend...`);

        try {
            switch (this.backend) {
                case 'transformers':
                    await this.initializeTransformers();
                    break;
                case 'ollama':
                    await this.initializeOllama();
                    break;
                case 'python':
                    await this.initializePython();
                    break;
                case 'mock':
                    await this.initializeMock();
                    break;
                default:
                    throw new Error(`Unknown backend: ${this.backend}`);
            }

            this.initialized = true;
            console.log('[CHAT LLM] Initialization complete');
            return true;
        } catch (error) {
            console.error('[CHAT LLM] Initialization failed:', error.message);
            console.log('[CHAT LLM] Falling back to mock backend');
            this.backend = 'mock';
            await this.initializeMock();
            this.initialized = true;
            return false;
        }
    }

    /**
     * Initialize Transformers.js backend
     */
    async initializeTransformers() {
        console.log('[CHAT LLM] Loading IBM Granite 4.0 Micro (first run will download model)...');
        const { pipeline } = await import('@huggingface/transformers');

        // Use IBM Granite 4.0 Micro ONNX Web version (3B params, hybrid Mamba-Transformer)
        console.log('[CHAT LLM] Loading Granite 4.0 Micro model...');
        this.model = await pipeline('text-generation', 'onnx-community/granite-4.0-micro-ONNX-web', {
            dtype: 'q8', // 8-bit quantization for speed
        });
        console.log('[CHAT LLM] Granite 4.0 Micro loaded and ready (Hybrid Mamba-Transformer)');
    }

    /**
     * Initialize Ollama backend (requires Ollama server running)
     */
    async initializeOllama() {
        // Check if Ollama is running
        const http = require('http');

        const checkOllama = () => new Promise((resolve) => {
            const req = http.get('http://localhost:11434/api/tags', (res) => {
                resolve(res.statusCode === 200);
            });
            req.on('error', () => resolve(false));
            req.setTimeout(2000, () => {
                req.destroy();
                resolve(false);
            });
        });

        const isRunning = await checkOllama();
        if (!isRunning) {
            throw new Error('Ollama server not running on localhost:11434');
        }

        this.model = { type: 'ollama', modelName: 'granite' };
        console.log('[CHAT LLM] Ollama backend ready');
    }

    /**
     * Initialize Python subprocess backend
     */
    async initializePython() {
        const { spawn } = require('child_process');

        // Check if Python and transformers are available
        this.pythonProcess = spawn('python', ['-c', 'import transformers; print("OK")']);

        return new Promise((resolve, reject) => {
            let output = '';
            this.pythonProcess.stdout.on('data', (data) => {
                output += data.toString();
            });
            this.pythonProcess.on('close', (code) => {
                if (output.includes('OK')) {
                    this.model = { type: 'python' };
                    console.log('[CHAT LLM] Python backend ready');
                    resolve();
                } else {
                    reject(new Error('Python transformers not available'));
                }
            });
            setTimeout(() => reject(new Error('Python check timeout')), 5000);
        });
    }

    /**
     * Initialize mock backend (for testing/fallback)
     */
    async initializeMock() {
        this.model = { type: 'mock' };
        console.log('[CHAT LLM] Mock backend ready (rule-based responses)');
    }

    /**
     * Generate agent dialogue based on context
     * @param {Object} speaker - The agent speaking {name, needs, inventory, mood}
     * @param {Object} listener - The agent being spoken to {name, needs, inventory, mood}
     * @param {string} context - Situational context (nearby, needs_help, trading, etc)
     * @returns {Promise<string>} - Generated dialogue
     */
    async generateDialogue(speaker, listener, context = 'nearby') {
        if (!this.initialized) await this.initialize();

        // Build prompt with agent context
        const prompt = this.buildPrompt(speaker, listener, context);

        try {
            let response;
            switch (this.backend) {
                case 'transformers':
                    response = await this.generateWithTransformers(prompt);
                    break;
                case 'ollama':
                    response = await this.generateWithOllama(prompt);
                    break;
                case 'python':
                    response = await this.generateWithPython(prompt);
                    break;
                case 'mock':
                    response = this.generateWithMock(speaker, listener, context);
                    break;
            }

            // Store in conversation history
            this.addToHistory(speaker.name, listener.name, response, context);

            return response;
        } catch (error) {
            console.error('[CHAT LLM] Generation error:', error.message);
            return this.generateWithMock(speaker, listener, context);
        }
    }

    /**
     * Build prompt from agent context
     */
    buildPrompt(speaker, listener, context) {
        const speakerNeeds = this.summarizeNeeds(speaker.needs);
        const listenerNeeds = this.summarizeNeeds(listener.needs);

        return `You are ${speaker.name}, a Minecraft agent. You're talking to ${listener.name}.

Your status:
- Health: ${speaker.health || 'unknown'}
- Food: ${speaker.food || 'unknown'}
- Needs: ${speakerNeeds}
- Inventory: ${speaker.inventory || 'empty'}
- Mood: ${speaker.mood || 'neutral'}

${listener.name}'s status:
- Needs: ${listenerNeeds}

Context: ${context}

Generate a SHORT (1-2 sentences) message to ${listener.name}:`;
    }

    /**
     * Summarize agent needs for prompt
     */
    summarizeNeeds(needs) {
        if (!needs) return 'unknown';

        const priorities = [];
        if (needs.health < 0.3) priorities.push('low health');
        if (needs.hunger < 0.3) priorities.push('hungry');
        if (needs.safety < 0.3) priorities.push('unsafe');
        if (needs.resources < 0.3) priorities.push('need resources');
        if (needs.social < 0.3) priorities.push('lonely');

        return priorities.length > 0 ? priorities.join(', ') : 'doing okay';
    }

    /**
     * Generate with Transformers.js
     */
    async generateWithTransformers(prompt) {
        const result = await this.model(prompt, {
            max_new_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            top_p: this.config.topP,
            repetition_penalty: this.config.repetitionPenalty,
            do_sample: true
        });

        // Extract just the generated text (remove prompt)
        let text = result[0].generated_text.replace(prompt, '').trim();

        // Clean up: take only first sentence for short agent messages
        const firstSentence = text.match(/^[^.!?]+[.!?]/);
        if (firstSentence) {
            text = firstSentence[0].trim();
        }

        return text;
    }

    /**
     * Generate with Ollama
     */
    async generateWithOllama(prompt) {
        const http = require('http');

        return new Promise((resolve, reject) => {
            const data = JSON.stringify({
                model: this.model.modelName,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: this.config.temperature,
                    top_p: this.config.topP,
                    num_predict: this.config.maxTokens
                }
            });

            const options = {
                hostname: 'localhost',
                port: 11434,
                path: '/api/generate',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length
                }
            };

            const req = http.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => responseData += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(responseData);
                        resolve(json.response || '');
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            req.on('error', reject);
            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Ollama request timeout'));
            });
            req.write(data);
            req.end();
        });
    }

    /**
     * Generate with Python subprocess
     */
    async generateWithPython(prompt) {
        // TODO: Implement Python subprocess generation
        return this.generateWithMock(null, null, 'generic');
    }

    /**
     * Generate with mock/rule-based system (fallback)
     */
    generateWithMock(speaker, listener, context) {
        const templates = {
            nearby: [
                `Hey ${listener.name}! How's it going?`,
                `${listener.name}, good to see you around here.`,
                `What's up ${listener.name}?`
            ],
            needs_help: [
                `${listener.name}, I could use some help here.`,
                `Hey ${listener.name}, got a minute?`,
                `${listener.name}, can you assist me?`
            ],
            trading: [
                `${listener.name}, want to trade resources?`,
                `Hey ${listener.name}, I've got some items to share.`,
                `${listener.name}, let's pool our resources.`
            ],
            low_health: [
                `${listener.name}, I'm not feeling so good...`,
                `Hey ${listener.name}, I need to find food or shelter.`,
                `${listener.name}, I'm in bad shape, be careful out here.`
            ],
            exploring: [
                `${listener.name}, I'm heading out to explore. Want to come?`,
                `Hey ${listener.name}, let's check out that area over there.`,
                `${listener.name}, I think I found something interesting.`
            ],
            danger: [
                `${listener.name}, watch out! There's danger nearby!`,
                `Hey ${listener.name}, be careful!`,
                `${listener.name}, we should stick together for safety.`
            ]
        };

        // Context-specific needs
        if (speaker && speaker.needs) {
            if (speaker.needs.health < 0.3) context = 'low_health';
            else if (speaker.needs.safety < 0.3) context = 'danger';
            else if (speaker.needs.resources < 0.3) context = 'trading';
        }

        const options = templates[context] || templates.nearby;
        return options[Math.floor(Math.random() * options.length)];
    }

    /**
     * Add conversation to history
     */
    addToHistory(speaker, listener, message, context) {
        this.conversationHistory.push({
            timestamp: Date.now(),
            speaker,
            listener,
            message,
            context
        });

        // Trim history if too long
        if (this.conversationHistory.length > this.maxHistoryLength) {
            this.conversationHistory.shift();
        }
    }

    /**
     * Get recent conversation history
     */
    getHistory(limit = 10) {
        return this.conversationHistory.slice(-limit);
    }

    /**
     * Get conversation statistics
     */
    getStats() {
        return {
            backend: this.backend,
            totalConversations: this.conversationHistory.length,
            recentConversations: this.getHistory(5)
        };
    }

    /**
     * Cleanup resources
     */
    dispose() {
        if (this.pythonProcess) {
            this.pythonProcess.kill();
        }
        this.conversationHistory = [];
        this.initialized = false;
    }
}

// Singleton instance
let chatLLMInstance = null;

function getChatLLM(backend = 'mock') {
    if (!chatLLMInstance) {
        chatLLMInstance = new AgentChatLLM(backend);
    }
    return chatLLMInstance;
}

module.exports = { AgentChatLLM, getChatLLM };
