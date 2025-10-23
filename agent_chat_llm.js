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

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { DynamicPromptBuilder } = require('./agent_dynamic_prompts');
const { getMemorySystem } = require('./agent_memory_system');

class AgentChatLLM {
    constructor(backend = 'mock') {
        this.backend = backend;
        this.model = null;
        this.initialized = false;
        this.conversationHistory = [];
        this.maxHistoryLength = 50;

        // Dynamic prompt system
        this.promptBuilder = new DynamicPromptBuilder();
        this.memorySystem = getMemorySystem();

        // Request queue system for thread-safe model access
        this.requestQueue = [];
        this.isProcessing = false;
        this.initializationPromise = null;
        this.initializationInProgress = false;

        // Model configuration
        this.config = {
            maxTokens: 80, // Enough for 1-3 sentences
            temperature: 1.1, // High creativity for varied, personality-driven responses
            topP: 0.95,
            repetitionPenalty: 1.5 // Strong penalty to avoid repeating phrases
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
                    case 'gemini':
                        await this.initializeGemini();
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

                // NEW: Seed prompt library on first initialization
                await this.seedPromptLibrary();

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
     * Recursively delete directory with retry logic (Windows-compatible)
     */
    deleteFolderRecursive(directoryPath) {
        if (!fs.existsSync(directoryPath)) {
            return true;
        }

        try {
            // First pass: delete all files
            const files = fs.readdirSync(directoryPath);

            for (const file of files) {
                const curPath = path.join(directoryPath, file);

                if (fs.lstatSync(curPath).isDirectory()) {
                    // Recursive delete subdirectory
                    this.deleteFolderRecursive(curPath);
                } else {
                    // Delete file with retry
                    let attempts = 0;
                    const maxAttempts = 3;

                    while (attempts < maxAttempts) {
                        try {
                            fs.unlinkSync(curPath);
                            break;
                        } catch (err) {
                            attempts++;
                            if (attempts >= maxAttempts) {
                                console.warn(`[CHAT LLM] Could not delete file after ${maxAttempts} attempts: ${curPath}`);
                            } else {
                                // Wait briefly before retry
                                const wait = new Promise(resolve => setTimeout(resolve, 100 * attempts));
                                // Synchronous wait (blocking)
                                for (let i = 0; i < 100 * attempts; i++) { /* busy wait */ }
                            }
                        }
                    }
                }
            }

            // Second pass: try to delete the directory itself
            let attempts = 0;
            const maxAttempts = 3;

            while (attempts < maxAttempts) {
                try {
                    fs.rmdirSync(directoryPath);
                    return true;
                } catch (err) {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        console.warn(`[CHAT LLM] Could not delete directory after ${maxAttempts} attempts: ${directoryPath}`);
                        return false;
                    }
                    // Wait briefly before retry
                    for (let i = 0; i < 100 * attempts; i++) { /* busy wait */ }
                }
            }
        } catch (error) {
            console.error(`[CHAT LLM] Error during recursive delete: ${error.message}`);
            return false;
        }

        return true;
    }

    /**
     * Clear transformers.js cache for a specific model
     */
    clearModelCache(modelName) {
        try {
            const cacheDir = path.join(
                __dirname,
                'node_modules',
                '@huggingface',
                'transformers',
                '.cache',
                modelName.replace('/', path.sep)
            );

            if (fs.existsSync(cacheDir)) {
                console.log(`[CHAT LLM] Clearing corrupted cache at: ${cacheDir}`);

                // Strategy 1: Try to rename the corrupted directory (works even with locked files)
                const timestamp = Date.now();
                const corruptedDir = `${cacheDir}_corrupted_${timestamp}`;

                try {
                    fs.renameSync(cacheDir, corruptedDir);
                    console.log(`[CHAT LLM] ✓ Renamed corrupted cache to: ${path.basename(corruptedDir)}`);
                    console.log('[CHAT LLM] ✓ Fresh cache will be downloaded automatically');
                    console.log(`[CHAT LLM] Note: You can manually delete "${corruptedDir}" later`);
                    return true;
                } catch (renameError) {
                    console.warn(`[CHAT LLM] Could not rename cache directory: ${renameError.message}`);
                }

                // Strategy 2: Try JavaScript recursive delete
                console.log('[CHAT LLM] Trying to delete cache directory...');
                let success = this.deleteFolderRecursive(cacheDir);

                // Strategy 3: If that fails on Windows, try PowerShell as fallback
                if (!success && process.platform === 'win32') {
                    console.log('[CHAT LLM] Trying PowerShell force delete...');

                    try {
                        const { execSync } = require('child_process');
                        execSync(`powershell -Command "Remove-Item -Path '${cacheDir}' -Recurse -Force"`, {
                            stdio: 'pipe',
                            timeout: 30000
                        });

                        // Check if directory was deleted
                        success = !fs.existsSync(cacheDir);

                        if (success) {
                            console.log('[CHAT LLM] ✓ Cache cleared successfully using PowerShell');
                        }
                    } catch (psError) {
                        // PowerShell failed too
                    }
                }

                if (success) {
                    console.log('[CHAT LLM] ✓ Cache cleared successfully');
                    return true;
                } else {
                    console.error('[CHAT LLM] ✗ Could not delete cache directory (files are locked)');
                    console.log('[CHAT LLM] WORKAROUND: Please stop any other Node.js processes');
                    console.log('[CHAT LLM] Then run one of these commands:');
                    console.log(`[CHAT LLM]   PowerShell: Remove-Item "${cacheDir}" -Recurse -Force`);
                    console.log(`[CHAT LLM]   CMD:        rmdir /s /q "${cacheDir}"`);
                    return false;
                }
            } else {
                console.log('[CHAT LLM] Cache directory not found, nothing to clear');
                return false;
            }
        } catch (error) {
            console.error(`[CHAT LLM] Failed to clear cache: ${error.message}`);
            return false;
        }
    }

    /**
     * Initialize Transformers.js backend
     */
    async initializeTransformers() {
        const config = require('./config');
        const modelName = config.llm.transformers.model;
        const dtype = config.llm.transformers.dtype || 'q8';

        console.log(`[CHAT LLM] Loading ${modelName} (first run will download model)...`);

        try {
            const { pipeline, env } = await import('@huggingface/transformers');

            // Force use of local models only (no web workers)
            env.allowLocalModels = true;
            env.allowRemoteModels = true;

            console.log(`[CHAT LLM] Downloading ${modelName} from HuggingFace...`);
            console.log('[CHAT LLM] This may take a few minutes on first run...');

            this.model = await pipeline(
                'text-generation',
                modelName,
                {
                    dtype: dtype, // Use config quantization
                    progress_callback: (progress) => {
                        if (progress.status === 'progress') {
                            const percent = ((progress.loaded / progress.total) * 100).toFixed(1);
                            console.log(`[CHAT LLM] Download progress: ${percent}% (${progress.file})`);
                        }
                    }
                }
            );

            // Also update config from file
            this.config.maxTokens = config.llm.transformers.maxTokens || 80;
            this.config.temperature = config.llm.transformers.temperature || 1.1;
            this.config.topP = config.llm.transformers.topP || 0.95;
            this.config.repetitionPenalty = config.llm.transformers.repetitionPenalty || 1.5;

            console.log(`[CHAT LLM] ${modelName} loaded and ready for agent conversations`);
        } catch (error) {
            // Check if it's a Protobuf parsing error (corrupted cache)
            if (error.message && error.message.includes('Protobuf parsing failed')) {
                console.error('[CHAT LLM] ❌ Protobuf parsing error detected - corrupted cache!');
                console.log('[CHAT LLM] Attempting to clear cache and retry...');

                // Clear the corrupted cache
                const cacheCleared = this.clearModelCache(modelName);

                if (cacheCleared) {
                    console.log('[CHAT LLM] Retrying model download with fresh cache...');

                    // Retry the initialization
                    const { pipeline, env } = await import('@huggingface/transformers');
                    env.allowLocalModels = true;
                    env.allowRemoteModels = true;

                    this.model = await pipeline(
                        'text-generation',
                        modelName,
                        {
                            dtype: dtype,
                            progress_callback: (progress) => {
                                if (progress.status === 'progress') {
                                    const percent = ((progress.loaded / progress.total) * 100).toFixed(1);
                                    console.log(`[CHAT LLM] Download progress: ${percent}% (${progress.file})`);
                                }
                            }
                        }
                    );

                    // Update config
                    this.config.maxTokens = config.llm.transformers.maxTokens || 80;
                    this.config.temperature = config.llm.transformers.temperature || 1.1;
                    this.config.topP = config.llm.transformers.topP || 0.95;
                    this.config.repetitionPenalty = config.llm.transformers.repetitionPenalty || 1.5;

                    console.log(`[CHAT LLM] ✓ ${modelName} loaded successfully after cache clear!`);
                } else {
                    throw new Error('Failed to clear cache and retry. Please manually delete the cache directory.');
                }
            } else {
                // Re-throw other errors
                throw error;
            }
        }
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

        this.model = { type: 'ollama', modelName: config.llm.ollama.model };
        console.log(`[CHAT LLM] Ollama backend ready (model: ${config.llm.ollama.model})`);
    }

    /**
     * Initialize Google Gemini API backend
     */
    async initializeGemini() {
        // Validate API key
        if (!config.llm.gemini.apiKey) {
            throw new Error('Gemini API key not configured');
        }

        this.model = {
            type: 'gemini',
            modelName: config.llm.gemini.model,
            apiKey: config.llm.gemini.apiKey,
            endpoint: config.llm.gemini.endpoint
        };

        this.config.maxTokens = config.llm.gemini.maxTokens || 50;
        this.config.temperature = config.llm.gemini.temperature || 0.8;

        console.log(`[CHAT LLM] Gemini backend ready (model: ${config.llm.gemini.model})`);
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
            // Step 1: Auto-download model if needed
            console.log('[CHAT LLM] Checking for UserLM-8b model...');
            const { getDownloader } = require('./huggingface_downloader');
            const downloader = getDownloader();
            const modelPath = await downloader.ensureModelReady();
            console.log('[CHAT LLM] ✓ Model ready at:', modelPath);

            // Step 2: Install node-llama-cpp if needed
            console.log('[CHAT LLM] Loading node-llama-cpp...');
            const { getLlama, LlamaChatSession } = await import('node-llama-cpp');

            // Step 3: Load the model
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

            console.log('[CHAT LLM] ✓ node-llama-cpp backend ready with UserLM-8b');
        } catch (error) {
            if (error.message.includes('Cannot find package') || error.message.includes('Cannot find module')) {
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
            const startTime = Date.now();

            try {
                // NEW: Store context snapshot before generating response
                const contextSnapshotId = await this.storeContextSnapshot(speaker, listener);

                // NEW: Use dynamic prompt builder for rich context
                const conversationType = this.mapContextToConversationType(context);
                const { prompt, templateName } = await this.promptBuilder.buildConversationPrompt(
                    speaker,
                    listener,
                    conversationType
                );

                // Generate response with appropriate backend
                let response;
                switch (this.backend) {
                    case 'transformers':
                        response = await this.generateWithTransformers(prompt);
                        break;
                    case 'ollama':
                        response = await this.generateWithOllama(prompt);
                        break;
                    case 'gemini':
                        response = await this.generateWithGemini(prompt);
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

                const responseTime = Date.now() - startTime;

                // NEW: Store chat message in database
                await this.storeChatMessage(speaker, listener, response, context, contextSnapshotId, templateName, responseTime);

                // Store in conversation history (legacy)
                this.addToHistory(speaker.name, listener.name, response, context);

                return response;
            } catch (error) {
                console.error('[CHAT LLM] Generation error:', error.message);
                return this.generateWithMock(speaker, listener, context);
            }
        });
    }

    /**
     * Map legacy context types to new conversation types
     */
    mapContextToConversationType(context) {
        const mapping = {
            'nearby': 'greeting',
            'introduction': 'greeting',
            'player_conversation': 'casual_chat',
            'trading': 'casual_chat',
            'exploring': 'action_comment',
            'low_health': 'emotion_express',
            'danger': 'emotion_express',
            'farewell': 'casual_chat'
        };

        return mapping[context] || 'casual_chat';
    }

    /**
     * Store context snapshot to database
     */
    async storeContextSnapshot(speaker, listener) {
        try {
            const agentData = {
                uuid: speaker.uuid || '',
                username: speaker.name || speaker.username || 'Unknown',
                bot: speaker.bot,
                position: speaker.bot?.entity?.position,
                biome: speaker.currentBiome || 'unknown',
                dimension: speaker.dimension || 'overworld',
                timeOfDay: this.getTimeOfDay(speaker.bot),
                weather: speaker.weather || 'clear',
                health: speaker.bot?.health || speaker.health || 20,
                food: speaker.bot?.food || speaker.food || 20,
                xpLevel: speaker.bot?.experience?.level || 0,
                currentAction: speaker.lastActionTaken || speaker.currentActivity || 'idle',
                currentGoal: speaker.currentGoal || 'explore',
                currentEmotion: speaker.currentEmotion || 'neutral',
                inventory: speaker.inventory || [],
                nearbyEntities: speaker.nearbyEntities || [],
                nearbyBlocks: speaker.nearbyBlocks || [],
                visibleBlocksCount: speaker.sensorData?.blockCount || 0,
                nearbyAgents: listener ? [listener.name] : [],
                sensorData: speaker.sensorData || {},
                moodles: speaker.moodleSystem?.getCurrentMoodles() || [],
                skills: speaker.subskills || speaker.skills || {},
                recentActions: speaker.actionHistory?.slice(-5) || [],
                personalityTraits: speaker.personality?.traits || [],
                relationshipContext: {}
            };

            return await this.memorySystem.storeContextSnapshot(agentData);
        } catch (error) {
            console.error('[CHAT LLM] Failed to store context snapshot:', error.message);
            return null;
        }
    }

    /**
     * Store chat message to database
     */
    async storeChatMessage(speaker, listener, message, context, contextSnapshotId, templateName, responseTime) {
        try {
            const speakerPos = speaker.bot?.entity?.position;
            const listenerPos = listener?.bot?.entity?.position;
            let distance = null;

            if (speakerPos && listenerPos) {
                distance = Math.round(speakerPos.distanceTo(listenerPos));
            }

            const messageData = {
                speakerUUID: speaker.uuid || '',
                speakerName: speaker.name || speaker.username || 'Unknown',
                listenerUUID: listener?.uuid || null,
                listenerName: listener?.name || listener?.username || null,
                message: message,
                messageType: context,
                emotion: speaker.currentEmotion || 'neutral',
                currentAction: speaker.lastActionTaken || 'idle',
                locationX: speakerPos?.x || 0,
                locationY: speakerPos?.y || 64,
                locationZ: speakerPos?.z || 0,
                health: speaker.bot?.health || speaker.health || 20,
                food: speaker.bot?.food || speaker.food || 20,
                distanceToListener: distance,
                contextSnapshotId: contextSnapshotId,
                promptId: null, // Could link to prompt_library in future
                modelBackend: this.backend,
                responseTimeMs: responseTime
            };

            await this.memorySystem.storeChatMessage(messageData);

            // Increment prompt usage if template name provided
            if (templateName) {
                await this.memorySystem.incrementPromptUsage(templateName);
            }
        } catch (error) {
            console.error('[CHAT LLM] Failed to store chat message:', error.message);
        }
    }

    /**
     * Get time of day helper
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
     * Seed the prompt library with default templates
     */
    async seedPromptLibrary() {
        try {
            // Initialize memory system if not already done
            if (!this.memorySystem.initialized) {
                await this.memorySystem.initialize();
            }

            // Use prompt builder to seed templates
            await this.promptBuilder.seedPromptLibrary();
        } catch (error) {
            console.error('[CHAT LLM] Failed to seed prompt library:', error.message);
        }
    }

    /**
     * Build prompt from agent context
     */
    buildPrompt(speaker, listener, context) {
        const speakerNeeds = this.summarizeNeeds(speaker.needs);
        const listenerNeeds = this.summarizeNeeds(listener.needs);

        // Build context description
        let situation = '';
        if (context === 'player_conversation') {
            // RESPONSIVE CONVERSATION: Agent is responding to what someone said
            const messageText = listener.message || 'something';
            situation = `${listener.name} said: "${messageText}"`;

            // Analyze what was said and give context for response
            const msg = messageText.toLowerCase();
            if (msg.includes('hey') || msg.includes('hello') || msg.includes('hi')) {
                situation += '\nThey greeted you. Greet them back and ask how they are or what they are doing.';
            } else if (msg.includes('how are') || msg.includes('how\'s it')) {
                situation += '\nThey asked how you are. Tell them how you are doing and maybe ask about their tasks or needs.';
            } else if (msg.includes('help') || msg.includes('assist')) {
                situation += '\nThey need help. Offer to help or ask what they need.';
            } else if (msg.includes('trade') || msg.includes('resources')) {
                situation += '\nThey mentioned trading. Discuss what resources you have or need.';
            } else {
                situation += '\nRespond naturally to what they said. You can discuss tasks, needs, or offer cooperation.';
            }
        } else if (context === 'nearby') {
            situation = 'You just noticed them nearby. Greet them and ask how they are or what they are working on.';
        } else if (context === 'introduction') {
            situation = 'You just joined the village. Introduce yourself briefly and express interest in working together.';
        } else if (context === 'farewell') {
            situation = 'You are about to leave/die. Say goodbye to your friends and thank them.';
        } else if (context === 'trading') {
            situation = 'You want to discuss trading resources. Mention what you have or need.';
        } else if (context === 'danger') {
            situation = 'There is danger nearby. Warn them and suggest staying together for safety.';
        } else if (context === 'low_health') {
            situation = 'You are injured. Tell them you need food or shelter.';
        } else if (context === 'exploring') {
            situation = 'You are exploring. Share what you found and maybe invite them to explore together.';
        } else {
            situation = 'Start a friendly conversation. Ask how they are or what they are doing.';
        }

        // Add thought process context
        let thoughtContext = '';
        if (speaker.thoughtProcess || speaker.lastThought) {
            thoughtContext = `\n\n=== MY RECENT THOUGHTS ===`;
            thoughtContext += `\n${speaker.thoughtProcess || speaker.lastThought}`;
        }

        // Add conversation history context if available
        let historyContext = '';
        if (speaker.conversationHistory && speaker.conversationHistory.length > 0) {
            historyContext = '\n\n=== RECENT CONVERSATION HISTORY ===';
            speaker.conversationHistory.slice(-5).forEach((msg, index) => {
                const role = msg.role === 'user' ? listener.name : speaker.name;
                historyContext += `\n${role}: "${msg.content || msg.message}"`;
            });
        }

        // Add personality/relationship context
        let personalityContext = '';
        if (speaker.personality && speaker.preferenceToDiscuss) {
            const topic = speaker.preferenceToDiscuss;
            if (topic.sentiment === 'like') {
                personalityContext = ` You really like ${topic.item} and might mention it.`;
            } else if (topic.sentiment === 'dislike') {
                personalityContext = ` You dislike ${topic.item}.`;
            }
        }

        // Use relationship data from memory system to dictate sentiment
        if (speaker.relationshipWithListener) {
            const rel = speaker.relationshipWithListener;
            const bondStrength = rel.bond_strength || 0;
            const trustLevel = rel.trust_level || 0;
            const relationshipType = rel.relationship_type || 'neutral';

            if (bondStrength > 0.7 && trustLevel > 0.7) {
                personalityContext += ` You are very close friends with ${listener.name}. You trust them completely and enjoy their company.`;
            } else if (bondStrength > 0.4) {
                personalityContext += ` You are friends with ${listener.name} and enjoy working together.`;
            } else if (bondStrength < -0.3) {
                personalityContext += ` You don't get along well with ${listener.name}. There's tension between you.`;
            } else if (bondStrength < -0.6) {
                personalityContext += ` You strongly dislike ${listener.name}. You avoid them when possible.`;
            }

            // Add cooperation/conflict history
            if (rel.cooperation_count > 5) {
                personalityContext += ` You've worked together ${rel.cooperation_count} times successfully.`;
            }
            if (rel.conflict_count > 2) {
                personalityContext += ` You've had ${rel.conflict_count} conflicts in the past.`;
            }
        } else if (speaker.compatibility !== undefined && listener.name) {
            // Fallback to simple compatibility if no relationship data
            if (speaker.compatibility > 0.5) {
                personalityContext += ` You are good friends with ${listener.name}.`;
            } else if (speaker.compatibility < -0.2) {
                personalityContext += ` You don't get along well with ${listener.name}.`;
            }
        }

        // Build concise status
        let speakerStatus = [];
        if (speaker.health && speaker.health < 10) speakerStatus.push('low on health');
        if (speaker.food && speaker.food < 10) speakerStatus.push('hungry');
        if (speakerNeeds.includes('unsafe')) speakerStatus.push('feeling unsafe');
        if (speakerNeeds.includes('need resources')) speakerStatus.push('need resources');

        const statusStr = speakerStatus.length > 0 ? ` You are ${speakerStatus.join(' and ')}.` : '';

        // Add life experiences context for introduction/farewell
        let experienceContext = '';
        if (context === 'introduction' || context === 'farewell') {
            if (speaker.generation) {
                experienceContext += ` You are generation ${speaker.generation}.`;
            }
            if (speaker.survivalTime) {
                const minutes = Math.floor(speaker.survivalTime / 60);
                if (minutes > 0) {
                    experienceContext += ` You have lived for ${minutes} minutes.`;
                }
            }
            if (speaker.recentMemories && speaker.recentMemories.length > 0) {
                const memoryCount = speaker.recentMemories.length;
                experienceContext += ` You have ${memoryCount} significant memories.`;
            }
            if (speaker.friends && speaker.friends.length > 0) {
                experienceContext += ` Your friends are: ${speaker.friends.join(', ')}.`;
            }
            if (speaker.achievements) {
                const achievements = [];
                if (speaker.achievements.diamonds_found > 0) achievements.push(`found ${speaker.achievements.diamonds_found} diamonds`);
                if (speaker.achievements.mobs_killed > 0) achievements.push(`defeated ${speaker.achievements.mobs_killed} mobs`);
                if (achievements.length > 0) {
                    experienceContext += ` You ${achievements.join(' and ')}.`;
                }
            }
        }

        // Build rich personality description
        let personalityDesc = '';
        if (speaker.personality) {
            // Personality structure has likes/dislikes directly, not under preferences
            let likesText = '';
            let dislikesText = '';

            if (speaker.personality.likes) {
                const likesList = Object.entries(speaker.personality.likes)
                    .filter(([cat, items]) => items && items.length > 0)
                    .map(([cat, items]) => items.slice(0, 2).join(', '))
                    .filter(text => text.length > 0)
                    .join(', ');
                if (likesList) likesText = `Things you like: ${likesList}`;
            }

            if (speaker.personality.dislikes) {
                const dislikesList = Object.entries(speaker.personality.dislikes)
                    .filter(([cat, items]) => items && items.length > 0)
                    .map(([cat, items]) => items.slice(0, 2).join(', '))
                    .filter(text => text.length > 0)
                    .join(', ');
                if (dislikesList) dislikesText = `Things you dislike: ${dislikesList}`;
            }

            if (likesText) personalityDesc += `\n${likesText}.`;
            if (dislikesText) personalityDesc += `\n${dislikesText}.`;
        }

        // Build rich agent profile
        let agentProfile = `\n\n=== MY PROFILE ===`;
        agentProfile += `\nName: ${speaker.name}`;
        if (speaker.type) agentProfile += `\nRole: ${speaker.type}`;
        if (speaker.generation) agentProfile += ` (Generation ${speaker.generation})`;

        // Current stats
        agentProfile += `\nHealth: ${speaker.health || 20}/20 | Food: ${speaker.food || 20}/20`;

        // Needs/Mood
        if (speakerNeeds && speakerNeeds !== 'unknown') {
            agentProfile += `\nFeeling: ${speakerNeeds}`;
        }

        // Inventory highlights
        if (speaker.inventory && Array.isArray(speaker.inventory) && speaker.inventory.length > 0) {
            const items = speaker.inventory.slice(0, 5).map(i => i.name || i.displayName || 'item').join(', ');
            agentProfile += `\nCarrying: ${items}`;
        }

        // Current activity and recent actions
        if (speaker.currentActivity) {
            agentProfile += `\nCurrent Activity: ${speaker.currentActivity}`;
        }
        if (speaker.recentActions && speaker.recentActions.length > 0) {
            agentProfile += `\n\nRecent Actions:`;
            speaker.recentActions.forEach(action => {
                const status = action.success ? '✓' : '✗';
                agentProfile += `\n  ${status} ${action.name} (${action.timeAgo}s ago)`;
            });
        }

        // Current tasks/goals
        if (speaker.currentGoal) {
            agentProfile += `\nCurrent Goal: ${speaker.currentGoal}`;
        }
        if (speaker.taskQueue && speaker.taskQueue.length > 0) {
            const tasks = speaker.taskQueue.slice(0, 3).map(t => t.name || t).join(', ');
            agentProfile += `\nTasks: ${tasks}`;
        }

        // Relationships
        let relationshipContext = '';
        if (speaker.friends && speaker.friends.length > 0) {
            relationshipContext += `\n\n=== RELATIONSHIPS ===`;
            relationshipContext += `\nFriends: ${speaker.friends.slice(0, 3).join(', ')}`;
        }
        if (speaker.rivals && speaker.rivals.length > 0) {
            relationshipContext += `\nRivals: ${speaker.rivals.slice(0, 2).join(', ')}`;
        }

        // Recent achievements/memories
        let experienceFull = '';
        if (speaker.recentAchievements && speaker.recentAchievements.length > 0) {
            experienceFull += `\n\n=== RECENT ACHIEVEMENTS ===`;
            speaker.recentAchievements.slice(0, 3).forEach(ach => {
                experienceFull += `\n• ${ach}`;
            });
        }

        // Creative player-perspective prompt with FULL context
        return `<|im_start|>system
I'm ${speaker.name}, a ${speaker.type || 'player'} on this Minecraft server.${agentProfile}${personalityDesc}${relationshipContext}${experienceFull}${thoughtContext}${historyContext}<|im_end|>
<|im_start|>user
${situation}${personalityContext}${statusStr}${experienceContext}

I'm going to say something creative and natural to ${listener.name}:<|im_end|>
<|im_start|>assistant
`;
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

        // Get the full generated text
        let fullText = result[0].generated_text;

        // DEBUG: Log raw output (temporary for debugging)
        if (Math.random() < 0.1) {  // 10% sample for debugging
            console.log('[LLM DEBUG] Raw output:', fullText.substring(0, 200));
        }

        // STEP 1: Remove the ENTIRE input prompt
        // The model echoes back everything we sent it, we only want NEW text
        if (fullText.includes(prompt)) {
            fullText = fullText.replace(prompt, '').trim();
        }

        // STEP 2: If there are chat template markers, extract only the assistant's response
        const assistantMarker = '<|im_start|>assistant';
        if (fullText.includes(assistantMarker)) {
            // Find the LAST assistant marker (the actual response)
            const lastAssistantIndex = fullText.lastIndexOf(assistantMarker);
            fullText = fullText.substring(lastAssistantIndex + assistantMarker.length).trim();
        }

        // STEP 3: Remove all template markers
        fullText = fullText.split('<|im_end|>')[0].trim();
        fullText = fullText.split('<|im_start|>')[0].trim();
        fullText = fullText.replace(/<\|im_end\|>/g, '');
        fullText = fullText.replace(/<\|im_start\|>/g, '');
        fullText = fullText.replace(/^assistant[\s:]*|^user[\s:]*|^system[\s:]*/gi, '');

        // STEP 4: Aggressively remove ANY part of the system prompt that leaked through
        const promptParts = [
            'You are a helpful AI assistant that generates realistic Minecraft player dialogue',
            'You are a helpful AI assistant',
            'helpful AI assistant',
            'generates realistic Minecraft player dialogue',
            'realistic Minecraft player dialogue',
            'Generate a short, natural message',
            'Generate ONLY the dialogue',
            'would say to',
            'Talking to:',
            'Character:',
            'Situation:',
            'Things you like:',
            'Things you dislike:',
            /I'm \w+, playing on this Minecraft server/gi,
            /I'm thinking about what to say/gi,
            /playing on this Minecraft server/gi,
            /thinking about what to say/gi,
            /I say to/gi,
            /Gen \d+/gi,
            /\(Gen \d+\)/gi,
            /generation \d+/gi
        ];

        for (const part of promptParts) {
            if (typeof part === 'string') {
                fullText = fullText.replace(new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim();
            } else {
                fullText = fullText.replace(part, '').trim();
            }
        }

        // STEP 5: Remove quotes and prefixes
        fullText = fullText.replace(/^["'\s]+|["'\s]+$/g, '');
        fullText = fullText.replace(/^\w+:\s*/, ''); // Remove "Name: " prefix

        // STEP 6: Clean up and extract ONLY real dialogue (first 1-2 sentences)
        fullText = fullText.trim();

        // If it still contains template text, it's garbage - return fallback
        const badPhrases = [
            'you are',
            'generate',
            'minecraft player',
            'dialogue',
            'assistant',
            'system',
            'user\n'
        ];

        const lowerText = fullText.toLowerCase();
        for (const phrase of badPhrases) {
            if (lowerText.includes(phrase) && lowerText.indexOf(phrase) < 50) {
                // Bad phrase appears early in text = probably leaked prompt
                return 'Hey there!';
            }
        }

        // Extract sentences
        const sentences = fullText.match(/[^.!?]+[.!?]+/g);
        if (sentences && sentences.length > 0) {
            // Take first 1-2 sentences max
            fullText = sentences.slice(0, 2).join(' ').trim();
        } else if (fullText.length > 0) {
            // No punctuation, limit by words
            const words = fullText.split(/\s+/);
            if (words.length > 20) {
                fullText = words.slice(0, 20).join(' ') + '...';
            }
        }

        // Final safety check
        if (!fullText || fullText.length < 3) {
            return 'Hey there!';
        }

        return fullText;
    }

    /**
     * Generate with Ollama
     */
    async generateWithOllama(prompt) {
        const http = require('http');

        return new Promise((resolve, reject) => {
            // Extract key context for Minecraft-relevant responses
            const lines = prompt.split('\n').filter(line => line.trim());

            // Extract essential Minecraft facts
            const nameMatch = lines.find(l => l.includes('You are'));
            let agentName = 'Agent';
            let agentRole = 'EXPLORING';
            if (nameMatch) {
                const match = nameMatch.match(/You are (\w+), a Minecraft agent with the role of (\w+)/);
                if (match) {
                    agentName = match[1];
                    agentRole = match[2];
                }
            }

            // Extract current action and goal
            let currentAction = 'idle';
            let currentGoal = 'explore';
            const actionLine = lines.find(l => l.includes('Current Action:'));
            const goalLine = lines.find(l => l.includes('Current Goal:'));
            if (actionLine) {
                const match = actionLine.match(/Current Action: (.+)/);
                if (match) currentAction = match[1].trim();
            }
            if (goalLine) {
                const match = goalLine.match(/Current Goal: (.+)/);
                if (match) currentGoal = match[1].trim();
            }

            // Extract inventory
            let inventory = 'empty';
            const invLine = lines.find(l => l.includes('inventory') || l.includes('Carrying:'));
            if (invLine && invLine.includes(':')) {
                inventory = invLine.split(':')[1].trim();
            }

            // Build ultra-simple prompt with context already embedded in the template
            const systemMsg = `You are ${agentName}, a ${agentRole} in Minecraft. Say one short sentence (10 words max) about what you're doing.`;
            const userMsg = `Currently: ${currentAction}. Goal: ${currentGoal}. What do you say?`;

            // Use /api/chat with messages array format (per Ollama API docs)
            const data = JSON.stringify({
                model: this.model.modelName,
                messages: [
                    {
                        role: 'system',
                        content: systemMsg
                    },
                    {
                        role: 'user',
                        content: userMsg
                    }
                ],
                stream: false,
                options: {
                    temperature: 0.5,  // Very low temperature for consistent, focused responses
                    top_p: 0.9,
                    num_predict: 15  // Limit to 15 tokens
                }
            });

            const options = {
                hostname: 'localhost',
                port: 11434,
                path: '/api/chat',  // Use /api/chat endpoint per Ollama docs
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
                        // /api/chat returns: { message: { role: "assistant", content: "response" } }
                        const response = json.message?.content || '';
                        resolve(response);
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
     * Generate with Google Gemini API
     */
    async generateWithGemini(prompt) {
        const https = require('https');

        return new Promise((resolve, reject) => {
            // Extract context like we do for Ollama
            const lines = prompt.split('\n').filter(line => line.trim());

            const nameMatch = lines.find(l => l.includes('You are'));
            let agentName = 'Agent';
            let agentRole = 'EXPLORING';
            if (nameMatch) {
                const match = nameMatch.match(/You are (\w+), a Minecraft agent with the role of (\w+)/);
                if (match) {
                    agentName = match[1];
                    agentRole = match[2];
                }
            }

            let currentAction = 'idle';
            let currentGoal = 'explore';
            const actionLine = lines.find(l => l.includes('Current Action:'));
            const goalLine = lines.find(l => l.includes('Current Goal:'));
            if (actionLine) {
                const match = actionLine.match(/Current Action: (.+)/);
                if (match) currentAction = match[1].trim();
            }
            if (goalLine) {
                const match = goalLine.match(/Current Goal: (.+)/);
                if (match) currentGoal = match[1].trim();
            }

            // Build focused prompt for Gemini
            const userMsg = `You are ${agentName}, a ${agentRole} in Minecraft. You are currently ${currentAction}. Your goal is ${currentGoal}. Say one very short sentence (10 words max) about what you're doing right now.`;

            // Gemini API request body
            const requestBody = {
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                text: userMsg
                            }
                        ]
                    }
                ]
            };

            const data = JSON.stringify(requestBody);
            const url = `${this.model.endpoint}/publishers/google/models/${this.model.modelName}:streamGenerateContent?key=${this.model.apiKey}`;
            const urlObj = new URL(url);

            const options = {
                hostname: urlObj.hostname,
                port: 443,
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => responseData += chunk);
                res.on('end', () => {
                    try {
                        // The API returns JSON (not streaming despite the endpoint name)
                        const json = JSON.parse(responseData);

                        // Extract text from response
                        if (json.candidates && json.candidates[0]?.content?.parts) {
                            let fullText = '';
                            for (const part of json.candidates[0].content.parts) {
                                if (part.text) {
                                    fullText += part.text;
                                }
                            }
                            resolve(fullText.trim() || 'Working on my task.');
                        } else if (json.error) {
                            console.error('[GEMINI] API error:', json.error.message);
                            resolve('Working on my task.');
                        } else {
                            console.error('[GEMINI] Unexpected response format');
                            resolve('Working on my task.');
                        }
                    } catch (e) {
                        console.error('[GEMINI] Parse error:', e.message, '- Response:', responseData.substring(0, 200));
                        resolve('Working on my task.');
                    }
                });
            });

            req.on('error', (error) => {
                console.error('[GEMINI] Request error:', error.message);
                resolve('Working on my task.');
            });

            req.setTimeout(10000, () => {
                req.destroy();
                resolve('Working on my task.');
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
            introduction: [
                `Hello everyone! I'm ${speaker.name}, just arrived in the village.`,
                `Hey ${listener.name}! I'm ${speaker.name}, nice to meet you!`,
                `${listener.name}, hi! I'm ${speaker.name}, new here. Looking forward to working together!`
            ],
            farewell: [
                `Goodbye ${listener.name}... it's been an adventure. Take care of yourself.`,
                `${listener.name}, this is farewell. Thank you for everything, friend.`,
                `${listener.name}, I have to go now. Remember the good times we had together.`
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
