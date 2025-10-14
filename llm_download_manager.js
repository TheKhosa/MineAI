/**
 * LLM Download Manager
 * Handles prerequisite checking and model downloads for all LLM backends
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class DownloadManager {
    constructor() {
        this.downloads = new Map();
        this.prerequisites = {
            mock: { ready: true, required: [] },
            transformers: { ready: false, required: ['@huggingface/transformers', 'onnxruntime-node'] },
            llamacpp: { ready: false, required: ['node-llama-cpp'] },
            ollama: { ready: false, required: [] }
        };
    }

    /**
     * Check if required npm packages are installed
     */
    checkNpmPackage(packageName) {
        try {
            require.resolve(packageName);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Check prerequisites for a specific backend
     */
    async checkPrerequisites(backend) {
        const prereq = this.prerequisites[backend];
        if (!prereq) {
            console.error(`❌ Unknown backend: ${backend}`);
            return false;
        }

        console.log(`\n${'='.repeat(70)}`);
        console.log(`🔍 Checking prerequisites for backend: ${backend.toUpperCase()}`);
        console.log(`${'='.repeat(70)}\n`);

        if (backend === 'mock') {
            console.log('✅ Mock backend requires no dependencies - ready to use!');
            return true;
        }

        if (backend === 'ollama') {
            console.log('🔍 Checking Ollama service...');
            const ollamaReady = await this.checkOllamaService();
            if (ollamaReady) {
                console.log('✅ Ollama service is running on localhost:11434');
                this.prerequisites.ollama.ready = true;
                return true;
            } else {
                console.log('❌ Ollama service not running. Please start Ollama server.');
                console.log('   Install from: https://ollama.ai/download');
                return false;
            }
        }

        // Check npm packages
        let allInstalled = true;
        for (const pkg of prereq.required) {
            const installed = this.checkNpmPackage(pkg);
            if (installed) {
                console.log(`✅ ${pkg} - installed`);
            } else {
                console.log(`❌ ${pkg} - NOT INSTALLED`);
                console.log(`   Install with: npm install ${pkg}`);
                allInstalled = false;
            }
        }

        if (!allInstalled) {
            return false;
        }

        // Check model files for specific backends
        if (backend === 'transformers') {
            return await this.checkTransformersModel();
        } else if (backend === 'llamacpp') {
            return await this.checkLlamaCppModel();
        }

        return allInstalled;
    }

    /**
     * Check if Ollama service is running
     */
    async checkOllamaService() {
        return new Promise((resolve) => {
            const req = http.request({
                hostname: 'localhost',
                port: 11434,
                path: '/api/tags',
                method: 'GET',
                timeout: 3000
            }, (res) => {
                resolve(res.statusCode === 200);
            });

            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });

            req.end();
        });
    }

    /**
     * Validate cache integrity - check for corrupted files
     */
    validateCache(cacheDir) {
        console.log('🔍 Validating cache integrity...');

        const modelFiles = this.findFilesRecursive(cacheDir, /\.(onnx|json|txt)$/);
        let corruptedFiles = [];

        for (const file of modelFiles) {
            try {
                const stats = fs.statSync(file);

                // Check for zero-byte files (corrupted)
                if (stats.size === 0) {
                    corruptedFiles.push(file);
                    console.log(`❌ Corrupted (0 bytes): ${path.basename(file)}`);
                    continue;
                }

                // Check for incomplete downloads (temp files)
                if (file.includes('.tmp') || file.includes('.partial')) {
                    corruptedFiles.push(file);
                    console.log(`❌ Incomplete download: ${path.basename(file)}`);
                    continue;
                }

                // For JSON files, try to parse
                if (file.endsWith('.json')) {
                    try {
                        const content = fs.readFileSync(file, 'utf8');
                        JSON.parse(content);
                    } catch (e) {
                        corruptedFiles.push(file);
                        console.log(`❌ Corrupted JSON: ${path.basename(file)}`);
                    }
                }
            } catch (e) {
                corruptedFiles.push(file);
                console.log(`❌ Cannot read: ${path.basename(file)}`);
            }
        }

        return corruptedFiles;
    }

    /**
     * Clean corrupted cache files
     */
    cleanCache(cacheDir, corruptedFiles) {
        console.log('\n🧹 Cleaning corrupted cache files...');

        let cleaned = 0;
        for (const file of corruptedFiles) {
            try {
                fs.unlinkSync(file);
                console.log(`✅ Deleted: ${path.basename(file)}`);
                cleaned++;
            } catch (e) {
                console.log(`❌ Failed to delete: ${path.basename(file)}`);
            }
        }

        console.log(`\n✅ Cleaned ${cleaned} corrupted file(s)`);
        return cleaned;
    }

    /**
     * Check Transformers.js model cache
     */
    async checkTransformersModel() {
        console.log('\n📦 Checking Transformers.js model cache...');

        // HuggingFace cache is typically in user's home directory
        const homeDir = process.env.USERPROFILE || process.env.HOME;
        const cacheDir = path.join(homeDir, '.cache', 'huggingface', 'transformers');

        if (fs.existsSync(cacheDir)) {
            console.log(`✅ Cache directory exists: ${cacheDir}`);

            // Validate cache and auto-clean if corrupted
            const corruptedFiles = this.validateCache(cacheDir);
            if (corruptedFiles.length > 0) {
                console.log(`\n⚠️  Found ${corruptedFiles.length} corrupted file(s)`);
                this.cleanCache(cacheDir, corruptedFiles);
                console.log('💡 Corrupted files removed - model will re-download if needed');
            } else {
                console.log('✅ Cache validated - no corrupted files found');
            }

            // Check for model files (Qwen2.5 Coder or any small model)
            const modelPattern = /\.(onnx|safetensors)$/;
            const modelFiles = this.findFilesRecursive(cacheDir, modelPattern);

            if (modelFiles.length > 0) {
                const totalSize = modelFiles.reduce((sum, file) => {
                    try {
                        return sum + fs.statSync(file).size;
                    } catch (e) {
                        return sum;
                    }
                }, 0);
                const sizeMB = (totalSize / 1024 / 1024).toFixed(2);

                console.log(`✅ Model files found (${modelFiles.length} files, ${sizeMB} MB)`);
                this.prerequisites.transformers.ready = true;
                return true;
            } else {
                console.log('⚠️  Model not downloaded yet');
                console.log('   First run will download ~120MB of model data (Qwen2.5-0.5B-Instruct)');
                console.log('   This is a ONE-TIME download - subsequent runs will be instant');
                return true; // Allow to proceed, will download on first use
            }
        } else {
            console.log('⚠️  Cache directory not found - will be created on first run');
            console.log('   First run will download ~120MB of model data (Qwen2.5-0.5B-Instruct)');
            return true; // Allow to proceed
        }
    }

    /**
     * Check LlamaCpp model file
     */
    async checkLlamaCppModel() {
        console.log('\n📦 Checking LlamaCpp model...');

        const modelPath = path.join(__dirname, 'models', 'UserLM-8b.Q4_K_M.gguf');

        if (fs.existsSync(modelPath)) {
            const stats = fs.statSync(modelPath);
            const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
            console.log(`✅ Model found: ${modelPath}`);
            console.log(`   Size: ${sizeMB} MB`);
            this.prerequisites.llamacpp.ready = true;
            return true;
        } else {
            console.log(`❌ Model not found: ${modelPath}`);
            console.log('\n📥 MANUAL DOWNLOAD REQUIRED:');
            console.log('   1. Visit: https://huggingface.co/mradermacher/UserLM-8b-GGUF');
            console.log('   2. Download: UserLM-8b.Q4_K_M.gguf (~5GB)');
            console.log(`   3. Place in: ${path.join(__dirname, 'models')}`);
            console.log('   4. Restart the application');
            return false;
        }
    }

    /**
     * Find files recursively matching pattern
     */
    findFilesRecursive(dir, pattern) {
        const results = [];
        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                try {
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        results.push(...this.findFilesRecursive(fullPath, pattern));
                    } else if (pattern.test(file)) {
                        results.push(fullPath);
                    }
                } catch (e) {
                    // Skip files we can't read
                }
            }
        } catch (e) {
            // Skip directories we can't read
        }
        return results;
    }

    /**
     * Monitor model download progress (for Transformers.js)
     */
    async monitorTransformersDownload(onProgress) {
        console.log('\n📡 Initializing model download monitor...');
        console.log('⏳ Please wait while the model is being downloaded...\n');

        let lastSize = 0;
        let stableCount = 0;
        const homeDir = process.env.USERPROFILE || process.env.HOME;
        const cacheDir = path.join(homeDir, '.cache', 'huggingface', 'transformers');

        return new Promise((resolve) => {
            const interval = setInterval(() => {
                try {
                    if (!fs.existsSync(cacheDir)) {
                        console.log('⏳ Waiting for download to start...');
                        return;
                    }

                    const files = this.findFilesRecursive(cacheDir, /\.onnx$/);
                    let totalSize = 0;
                    for (const file of files) {
                        try {
                            const stats = fs.statSync(file);
                            totalSize += stats.size;
                        } catch (e) {
                            // File might be being written
                        }
                    }

                    if (totalSize > lastSize) {
                        const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
                        const downloadedMB = ((totalSize - lastSize) / 1024 / 1024).toFixed(2);
                        console.log(`📥 Downloaded: ${sizeMB} MB (+${downloadedMB} MB)`);

                        if (onProgress) {
                            onProgress({
                                totalMB: parseFloat(sizeMB),
                                downloadedMB: parseFloat(downloadedMB)
                            });
                        }

                        lastSize = totalSize;
                        stableCount = 0;
                    } else {
                        stableCount++;
                        if (stableCount > 5 && totalSize > 0) {
                            // Download seems complete
                            clearInterval(interval);
                            console.log('\n✅ Model download complete!');
                            resolve(true);
                        }
                    }
                } catch (e) {
                    console.error('Error monitoring download:', e.message);
                }
            }, 2000); // Check every 2 seconds

            // Timeout after 30 minutes
            setTimeout(() => {
                clearInterval(interval);
                resolve(false);
            }, 30 * 60 * 1000);
        });
    }

    /**
     * Display a nice summary before starting
     */
    displayStartupSummary(backend, ready) {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`🎮 INTELLIGENT VILLAGE - STARTUP SUMMARY`);
        console.log(`${'='.repeat(70)}`);
        console.log(`Backend: ${backend.toUpperCase()}`);
        console.log(`Status: ${ready ? '✅ READY' : '❌ NOT READY'}`);

        if (ready) {
            console.log('\n🚀 All prerequisites satisfied - starting village...\n');
        } else {
            console.log('\n⚠️  Prerequisites not met - please resolve issues above\n');
            console.log('💡 TIP: Use mock backend for zero-dependency setup:');
            console.log('   Change line 3664 in intelligent_village.js to:');
            console.log('   chatLLM = getChatLLM(\'mock\');\n');
        }
        console.log(`${'='.repeat(70)}\n`);
    }

    /**
     * Initialize and wait for model download if needed
     */
    async initializeWithProgress(backend, initCallback) {
        console.log(`\n🔧 Initializing ${backend.toUpperCase()} backend...`);

        if (backend === 'transformers') {
            // Start initialization in background
            const initPromise = initCallback();

            // Monitor download progress
            const downloadPromise = this.monitorTransformersDownload((progress) => {
                // Progress callback if needed
            });

            // Wait for both to complete
            console.log('\n⏳ First-time setup may take 5-10 minutes for model download...');
            console.log('💡 Subsequent runs will be instant - this is a one-time setup!\n');

            await Promise.race([initPromise, downloadPromise]);

            // Give a bit more time for initialization to complete
            await new Promise(resolve => setTimeout(resolve, 5000));

            console.log('✅ Backend initialization complete!');
            return true;
        } else {
            // Other backends don't need download monitoring
            await initCallback();
            return true;
        }
    }
}

module.exports = { DownloadManager };
