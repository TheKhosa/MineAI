/**
 * Agent Chat LLM - Local language model for agent-to-agent communication
 *
 * Supported backends:
 *
 * 1. 'transformers' (Recommended - Pure JS, ONNX models)
 *    - Uses @huggingface/transformers with ONNX models
 *    - Currently configured: Qwen2.5-0.5B-Instruct (500M params)
 *    - Requires: npm install @huggingface/transformers onnxruntime-node
 *    - First run downloads model to cache (~120MB)
 *
 * 2. 'llamacpp' (Optional - For GGUF models)
 *    - Uses node-llama-cpp for GGUF format models
 *    - Supports UserLM-8b-GGUF and other llama.cpp compatible models
 *    - Requires: npm install node-llama-cpp
 *    - Download model to: ml_models/UserLM-8b-Q4_K_M.gguf (~5GB)
 *    - Get model from: https://huggingface.co/mradermacher/UserLM-8b-GGUF
 *
 * 3. 'ollama' (External service)
 *    - Requires Ollama server running on localhost:11434
 *    - Full GPU acceleration available
 *
 * 4. 'python' (Legacy)
 *    - Python subprocess with transformers library
 *    - Not fully implemented
 *
 * 5. 'mock' (Fallback)
 *    - Rule-based responses, no AI model required
 *    - Always available as fallback
 *
 * Usage in intelligent_village.js:
 *   const { getChatLLM } = require('./agent_chat_llm');
 *   const chatLLM = getChatLLM('transformers');  // or 'llamacpp'
 *   await chatLLM.initialize();
 */

class AgentChatLLM {
    constructor(backend = 'mock') {
        this.backend = backend;
        this.model = null;
        this.initialized = false;
        this.conversationHistory = [];
        this.maxHistoryLength = 50;

        // Request queue system for thread-safe model access
        this.requestQueue = [];
        this.isProcessing = false;
        this.initializationPromise = null;
        this.initializationInProgress = false;

        // Model configuration
        this.config = {
            maxTokens: 50, // Keep responses short for agent chat
            temperature: 0.7,
            topP: 0.9,
            repetitionPenalty: 1.2 // Reduce repetitive outputs
        };
    }

    /**
     * Initialize the LLM backend (thread-safe, only initializes once)
     */
    async initialize() {
        if (this.initialized) return true;

        // If initialization is already in progress, wait for it
        if (this.initializationInProgress && this.initializationPromise) {
            console.log('[CHAT LLM] Initialization already in progress, waiting...');
            return this.initializationPromise;
        }

        // Mark initialization as in progress
        this.initializationInProgress = true;

        // Create initialization promise
        this.initializationPromise = (async () => {
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
                    case 'llamacpp':
                        await this.initializeLlamaCpp();
                        break;
                    case 'mock':
                        await this.initializeMock();
                        break;
                    default:
                        throw new Error(`Unknown backend: ${this.backend}`);
                }

                this.initialized = true;
                this.initializationInProgress = false;
                console.log('[CHAT LLM] Initialization complete - ready to process requests');
                return true;
            } catch (error) {
                this.initializationInProgress = false;
                this.initializationPromise = null;
                console.error('[CHAT LLM] Initialization failed:', error.message);
                console.error('[CHAT LLM] Backend:', this.backend);
                console.error('[CHAT LLM] ERROR: Cannot fall back to mock - fix the backend configuration!');
                throw error; // Fail hard instead of falling back
            }
        })();

        return this.initializationPromise;
    }

    /**
     * Initialize Transformers.js backend
     */
    async initializeTransformers() {
        console.log('[CHAT LLM] Loading Qwen2.5-0.5B-Instruct model (first run will download ~120MB)...');
        const { pipeline, env } = await import('@huggingface/transformers');

        // Force use of local models only (no web workers)
        env.allowLocalModels = true;
        env.allowRemoteModels = true;

        // Use Qwen2.5-0.5B-Instruct - small, fast, and efficient
        console.log('[CHAT LLM] Downloading Qwen2.5-0.5B-Instruct from HuggingFace...');
        console.log('[CHAT LLM] This may take 1-2 minutes on first run...');

        this.model = await pipeline(
            'text-generation',
            'onnx-community/Qwen2.5-0.5B-Instruct',
            {
                dtype: 'q8', // 8-bit quantization for smaller size
                progress_callback: (progress) => {
                    if (progress.status === 'progress') {
                        const percent = ((progress.loaded / progress.total) * 100).toFixed(1);
                        console.log(`[CHAT LLM] Download progress: ${percent}% (${progress.file})`);
                    }
                }
            }
        );

        console.log('[CHAT LLM] Qwen2.5-0.5B-Instruct loaded and ready for agent conversations');
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
     * Initialize node-llama-cpp backend (for GGUF models like UserLM-8b)
     */
    async initializeLlamaCpp() {
        try {
            const { getLlama, LlamaChatSession } = await import('node-llama-cpp');
            const path = require('path');

            // Check if model file exists
            const modelPath = path.join(__dirname, 'ml_models', 'UserLM-8b-Q4_K_M.gguf');
            const fs = require('fs');

            if (!fs.existsSync(modelPath)) {
                throw new Error(`Model file not found: ${modelPath}\nDownload from: https://huggingface.co/mradermacher/UserLM-8b-GGUF`);
            }

            console.log('[CHAT LLM] Loading UserLM-8b from GGUF...');
            const llama = await getLlama();
            const model = await llama.loadModel({
                modelPath: modelPath
            });

            const context = await model.createContext();
            this.model = {
                type: 'llamacpp',
                llama,
                model,
                context,
                createSession: () => new LlamaChatSession({ context })
            };

            console.log('[CHAT LLM] node-llama-cpp backend ready with UserLM-8b');
        } catch (error) {
            if (error.message.includes('Cannot find package')) {
                throw new Error('node-llama-cpp not installed. Run: npm install node-llama-cpp');
            } else {
                throw error;
            }
        }
    }

    /**
     * Initialize mock backend (for testing/fallback)
     */
    async initializeMock() {
        this.model = { type: 'mock' };
        console.log('[CHAT LLM] Mock backend ready (rule-based responses)');
    }

    /**
     * Add request to queue and process
     */
    async enqueueRequest(requestFunc) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ requestFunc, resolve, reject });

            // Log queue status
            if (this.requestQueue.length > 1) {
                console.log(`[CHAT LLM QUEUE] Request queued (${this.requestQueue.length} waiting)`);
            }

            this.processQueue();
        });
    }

    /**
     * Process queued requests one at a time
     */
    async processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) {
            return; // Already processing or nothing to process
        }

        this.isProcessing = true;

        while (this.requestQueue.length > 0) {
            const { requestFunc, resolve, reject } = this.requestQueue.shift();

            try {
                const result = await requestFunc();
                resolve(result);
            } catch (error) {
                reject(error);
            }

            // Small delay between requests to prevent overwhelming the model
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        this.isProcessing = false;
    }

    /**
     * Generate agent dialogue based on context (thread-safe with queue)
     * @param {Object} speaker - The agent speaking {name, needs, inventory, mood}
     * @param {Object} listener - The agent being spoken to {name, needs, inventory, mood}
     * @param {string} context - Situational context (nearby, needs_help, trading, etc)
     * @returns {Promise<string>} - Generated dialogue
     */
    async generateDialogue(speaker, listener, context = 'nearby') {
        // Ensure initialization is complete
        if (!this.initialized) {
            await this.initialize();
        }

        // Enqueue the request for processing
        return this.enqueueRequest(async () => {
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
                    case 'llamacpp':
                        response = await this.generateWithLlamaCpp(prompt);
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
        });
    }

    /**
     * Build prompt from agent context
     */
    buildPrompt(speaker, listener, context) {
        const speakerNeeds = this.summarizeNeeds(speaker.needs);
        const listenerNeeds = this.summarizeNeeds(listener.needs);

        // Add personality information if available
        let personalityInfo = '';
        if (speaker.personality && speaker.preferenceToDiscuss) {
            const topic = speaker.preferenceToDiscuss;
            personalityInfo = `\nYour personality: ${speaker.personality.traits?.slice(0, 3).join(', ') || 'balanced'}`;
            if (topic) {
                personalityInfo += `\nYou want to discuss: You ${topic.sentiment} ${topic.item}`;
            }
        }

        // Add compatibility/relationship info if available
        let relationshipInfo = '';
        if (speaker.compatibility !== undefined && listener.name) {
            if (speaker.compatibility > 0.5) {
                relationshipInfo = `\nYou feel a strong connection with ${listener.name}.`;
            } else if (speaker.compatibility < -0.2) {
                relationshipInfo = `\nYou feel tension with ${listener.name}.`;
            }
        }

        return `You are ${speaker.name}, a Minecraft agent. You're talking to ${listener.name}.

Your status:
- Health: ${speaker.health || 'unknown'}
- Food: ${speaker.food || 'unknown'}
- Needs: ${speakerNeeds}
- Inventory: ${speaker.inventory || 'empty'}
- Mood: ${speaker.mood || 'neutral'}${personalityInfo}${relationshipInfo}

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
     * Generate with node-llama-cpp (GGUF models)
     */
    async generateWithLlamaCpp(prompt) {
        const session = this.model.createSession();

        const response = await session.prompt(prompt, {
            maxTokens: this.config.maxTokens,
            temperature: this.config.temperature,
            topP: this.config.topP,
            repeatPenalty: this.config.repetitionPenalty
        });

        // Extract first sentence for short agent messages
        let text = response.trim();
        const firstSentence = text.match(/^[^.!?]+[.!?]/);
        if (firstSentence) {
            text = firstSentence[0].trim();
        }

        return text;
    }

    /**
     * Generate with mock/rule-based system (fallback)
     */
    generateWithMock(speaker, listener, context) {
        // Check if speaker wants to discuss preferences
        if (speaker && speaker.preferenceToDiscuss) {
            const topic = speaker.preferenceToDiscuss;
            const sentiment = topic.sentiment;
            const item = topic.item;
            const category = topic.category;

            if (sentiment === 'like') {
                const likeTemplates = [
                    `${listener.name}, I really love ${item}! Do you like ${item} too?`,
                    `Hey ${listener.name}, ${item} is my favorite! What do you think about ${item}?`,
                    `${listener.name}, I've been working with ${item} lately. It's so great!`,
                    `You know what I love, ${listener.name}? ${item}! How about you?`
                ];
                return likeTemplates[Math.floor(Math.random() * likeTemplates.length)];
            } else if (sentiment === 'dislike') {
                const dislikeTemplates = [
                    `${listener.name}, I really don't like ${item}. Do you feel the same?`,
                    `Hey ${listener.name}, ${item} is not my thing. What's your take on it?`,
                    `${listener.name}, I try to avoid ${item} when I can. You?`,
                    `Honestly ${listener.name}, ${item} bothers me. How do you feel about it?`
                ];
                return dislikeTemplates[Math.floor(Math.random() * dislikeTemplates.length)];
            }
        }

        // Check for compatibility-based dialogue
        if (speaker && speaker.compatibility !== undefined) {
            if (speaker.compatibility > 0.6) {
                const friendTemplates = [
                    `${listener.name}, you're one of my best friends here!`,
                    `Hey ${listener.name}, I always enjoy hanging out with you!`,
                    `${listener.name}, we think alike! Want to team up?`,
                    `${listener.name}, you get me. Let's work together!`
                ];
                return friendTemplates[Math.floor(Math.random() * friendTemplates.length)];
            } else if (speaker.compatibility < -0.3) {
                const rivalTemplates = [
                    `${listener.name}, we don't see eye to eye, do we?`,
                    `${listener.name}... we're very different.`,
                    `Hey ${listener.name}, I guess we just have different priorities.`,
                    `${listener.name}, I don't think we'll ever agree on things.`
                ];
                return rivalTemplates[Math.floor(Math.random() * rivalTemplates.length)];
            }
        }

        // Standard context-based templates
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
            initialized: this.initialized,
            totalConversations: this.conversationHistory.length,
            recentConversations: this.getHistory(5),
            queueStatus: {
                queueLength: this.requestQueue.length,
                isProcessing: this.isProcessing,
                initializationInProgress: this.initializationInProgress
            }
        };
    }

    /**
     * Get queue status
     */
    getQueueStatus() {
        return {
            queueLength: this.requestQueue.length,
            isProcessing: this.isProcessing,
            initialized: this.initialized
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
