/**
 * Hugging Face Model Downloader
 *
 * Automatically downloads UserLM-8b model from Hugging Face
 * Verifies file integrity and places in correct directory
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

class HuggingFaceDownloader {
    constructor() {
        this.modelDir = path.join(__dirname, 'ml_models');
        this.modelFile = 'UserLM-8b.Q4_K_M.gguf';
        this.modelPath = path.join(this.modelDir, this.modelFile);

        // Hugging Face URL for UserLM-8b Q4_K_M quantization
        this.modelUrl = 'https://huggingface.co/mradermacher/UserLM-8b-GGUF/resolve/main/UserLM-8b.Q4_K_M.gguf';

        // Expected file size (approximate, in bytes)
        this.expectedSize = 4.5 * 1024 * 1024 * 1024; // ~4.5GB
    }

    /**
     * Ensure model directory exists
     */
    ensureDirectory() {
        if (!fs.existsSync(this.modelDir)) {
            console.log(`[HF DOWNLOADER] Creating directory: ${this.modelDir}`);
            fs.mkdirSync(this.modelDir, { recursive: true });
        }
    }

    /**
     * Check if model already exists and is valid
     */
    modelExists() {
        if (!fs.existsSync(this.modelPath)) {
            return false;
        }

        const stats = fs.statSync(this.modelPath);
        const fileSizeGB = (stats.size / (1024 * 1024 * 1024)).toFixed(2);
        console.log(`[HF DOWNLOADER] Found existing model: ${this.modelPath} (${fileSizeGB} GB)`);

        // Check if file is reasonable size (at least 3GB for Q4_K_M)
        if (stats.size < 3 * 1024 * 1024 * 1024) {
            console.log(`[HF DOWNLOADER] Model file too small (${fileSizeGB} GB), may be corrupted`);
            return false;
        }

        return true;
    }

    /**
     * Download model from Hugging Face
     */
    async downloadModel() {
        this.ensureDirectory();

        if (this.modelExists()) {
            console.log('[HF DOWNLOADER] ✓ Model already downloaded and verified');
            return this.modelPath;
        }

        console.log('[HF DOWNLOADER] Starting UserLM-8b download from Hugging Face...');
        console.log(`[HF DOWNLOADER] URL: ${this.modelUrl}`);
        console.log(`[HF DOWNLOADER] Destination: ${this.modelPath}`);
        console.log('[HF DOWNLOADER] This is a ~4.5GB file and may take 10-30 minutes depending on your internet speed...');

        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(this.modelPath);
            let downloadedBytes = 0;
            let totalBytes = 0;
            let lastProgressUpdate = Date.now();

            const request = https.get(this.modelUrl, (response) => {
                // Handle redirects
                if (response.statusCode === 301 || response.statusCode === 302) {
                    console.log('[HF DOWNLOADER] Following redirect...');
                    file.close();
                    fs.unlinkSync(this.modelPath);

                    https.get(response.headers.location, (redirectResponse) => {
                        this.handleDownloadResponse(redirectResponse, file, resolve, reject);
                    }).on('error', (err) => {
                        file.close();
                        fs.unlinkSync(this.modelPath);
                        reject(err);
                    });
                } else {
                    this.handleDownloadResponse(response, file, resolve, reject);
                }
            });

            request.on('error', (err) => {
                file.close();
                if (fs.existsSync(this.modelPath)) {
                    fs.unlinkSync(this.modelPath);
                }
                reject(new Error(`Download failed: ${err.message}`));
            });

            request.setTimeout(60000, () => {
                request.destroy();
                file.close();
                if (fs.existsSync(this.modelPath)) {
                    fs.unlinkSync(this.modelPath);
                }
                reject(new Error('Download timeout'));
            });
        });
    }

    /**
     * Handle download response
     */
    handleDownloadResponse(response, file, resolve, reject) {
        if (response.statusCode !== 200) {
            file.close();
            if (fs.existsSync(this.modelPath)) {
                fs.unlinkSync(this.modelPath);
            }
            reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
            return;
        }

        const totalBytes = parseInt(response.headers['content-length'], 10);
        let downloadedBytes = 0;
        let lastProgressUpdate = Date.now();
        const startTime = Date.now();

        console.log(`[HF DOWNLOADER] Total size: ${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`);

        response.on('data', (chunk) => {
            downloadedBytes += chunk.length;

            // Update progress every 5 seconds
            const now = Date.now();
            if (now - lastProgressUpdate > 5000) {
                const progress = ((downloadedBytes / totalBytes) * 100).toFixed(1);
                const downloadedGB = (downloadedBytes / (1024 * 1024 * 1024)).toFixed(2);
                const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);
                const elapsedMin = ((now - startTime) / 60000).toFixed(1);
                const speedMBps = (downloadedBytes / (1024 * 1024)) / ((now - startTime) / 1000);

                console.log(`[HF DOWNLOADER] Progress: ${progress}% (${downloadedGB}/${totalGB} GB) - ${speedMBps.toFixed(1)} MB/s - ${elapsedMin} min elapsed`);
                lastProgressUpdate = now;
            }
        });

        response.pipe(file);

        file.on('finish', () => {
            file.close();
            const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
            console.log(`[HF DOWNLOADER] ✓ Download complete in ${elapsedMin} minutes!`);
            console.log(`[HF DOWNLOADER] Model saved to: ${this.modelPath}`);
            resolve(this.modelPath);
        });

        file.on('error', (err) => {
            file.close();
            if (fs.existsSync(this.modelPath)) {
                fs.unlinkSync(this.modelPath);
            }
            reject(err);
        });
    }

    /**
     * Verify model file integrity
     */
    verifyModel() {
        if (!fs.existsSync(this.modelPath)) {
            throw new Error(`Model file not found: ${this.modelPath}`);
        }

        const stats = fs.statSync(this.modelPath);
        const fileSizeGB = (stats.size / (1024 * 1024 * 1024)).toFixed(2);

        if (stats.size < 3 * 1024 * 1024 * 1024) {
            throw new Error(`Model file too small (${fileSizeGB} GB), expected ~4.5 GB`);
        }

        console.log(`[HF DOWNLOADER] ✓ Model verified: ${fileSizeGB} GB`);
        return true;
    }

    /**
     * Main entry point - download and verify model
     */
    async ensureModelReady() {
        try {
            await this.downloadModel();
            this.verifyModel();
            return this.modelPath;
        } catch (error) {
            console.error('[HF DOWNLOADER] Error:', error.message);
            throw error;
        }
    }
}

// Singleton instance
let downloaderInstance = null;

function getDownloader() {
    if (!downloaderInstance) {
        downloaderInstance = new HuggingFaceDownloader();
    }
    return downloaderInstance;
}

module.exports = { HuggingFaceDownloader, getDownloader };
