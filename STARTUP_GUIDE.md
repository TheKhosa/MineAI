# Intelligent Village - Startup Guide

## Overview

The Intelligent Village system now includes a comprehensive **prerequisite checker and download manager** that ensures all dependencies are ready before the village starts running.

## Key Features

### 1. **Prerequisite Validation**
- ✅ Automatically checks for required npm packages
- ✅ Validates model files and cache integrity
- ✅ Tests external services (Ollama)
- ✅ Auto-cleans corrupted cache files
- ✅ Provides clear error messages with installation instructions

### 2. **Download Progress Tracking**
- 📥 Real-time download progress for model files
- ⏱️ Download speed and ETA estimates
- 📊 File size tracking
- 🔄 One-time download (subsequent runs are instant)

### 3. **Automatic Cache Management**
- 🧹 Detects corrupted files (zero-byte, incomplete downloads)
- 🗑️ Auto-deletes corrupted cache entries
- ✅ Validates JSON config files
- 🔄 Re-downloads missing or corrupted files

### 4. **Smart Startup Sequence**
1. Check prerequisites
2. Download/validate models
3. Initialize LLM backend
4. **ONLY THEN** start the village

---

## Supported Backends

### 1. **Mock Backend** (Default - Zero Dependencies)
```javascript
const SELECTED_BACKEND = 'mock';
```
- ✅ Rule-based contextual responses
- ✅ No installation required
- ✅ Works immediately
- 🎯 Perfect for testing and development

### 2. **Transformers.js** (Recommended - Pure JavaScript)
```javascript
const SELECTED_BACKEND = 'transformers';
```
- **Model**: Qwen2.5-0.5B-Instruct (500M parameters)
- **Size**: ~120MB (first-time download)
- **Requirements**:
  ```bash
  npm install @huggingface/transformers onnxruntime-node
  ```
- **Features**:
  - Pure JavaScript/ONNX inference
  - 8-bit quantization for efficiency
  - Automatic model caching
  - Progress tracking during first download
  - Subsequent runs are instant (cached)

### 3. **LlamaCpp** (Optional - Best Quality)
```javascript
const SELECTED_BACKEND = 'llamacpp';
```
- **Model**: UserLM-8b (8B parameters)
- **Size**: ~5GB (manual download)
- **Requirements**:
  ```bash
  npm install node-llama-cpp
  ```
- **Manual Setup**:
  1. Download from: https://huggingface.co/mradermacher/UserLM-8b-GGUF
  2. Get: `UserLM-8b.Q4_K_M.gguf`
  3. Place in: `D:\MineRL\models\`

### 4. **Ollama** (External Service)
```javascript
const SELECTED_BACKEND = 'ollama';
```
- **Requirements**:
  - Ollama server running on `localhost:11434`
  - Install from: https://ollama.ai/download
- **Features**:
  - Full GPU acceleration
  - Multiple model options
  - External service (not bundled)

---

## First-Time Setup

### Quick Start (Zero Dependencies)
```bash
# Use mock backend - works immediately
node intelligent_village.js
```

### With AI Models (Recommended)
```bash
# 1. Install dependencies
npm install @huggingface/transformers onnxruntime-node

# 2. Run the system
node intelligent_village.js

# First run will download ~120MB (Qwen2.5-0.5B-Instruct)
# This takes 1-2 minutes depending on internet speed
# Subsequent runs are instant - model is cached
```

---

## Configuration

### Switching Backends

Edit `intelligent_village.js` line **3669**:

```javascript
const SELECTED_BACKEND = 'transformers';  // Change this line
```

**Options**:
- `'mock'` - Rule-based (no dependencies)
- `'transformers'` - Qwen2.5-0.5B-Instruct (~120MB)
- `'llamacpp'` - UserLM-8b (~5GB, manual download)
- `'ollama'` - External service

---

## Startup Sequence

### What Happens on First Run?

#### 1. **Prerequisite Check**
```
==================================================================
🔍 Checking prerequisites for backend: TRANSFORMERS
==================================================================

✅ @huggingface/transformers - installed
✅ onnxruntime-node - installed

📦 Checking Transformers.js model cache...
✅ Cache directory exists: C:\Users\...\transformers
🔍 Validating cache integrity...
✅ Cache validated - no corrupted files found
⚠️  Model not downloaded yet
   First run will download ~120MB of model data (Qwen2.5-0.5B-Instruct)
   This is a ONE-TIME download - subsequent runs will be instant
```

#### 2. **Model Download** (First Time Only)
```
📡 Initializing model download monitor...
⏳ Please wait while the model is being downloaded...

⏳ First-time setup may take 1-2 minutes for model download...
💡 Subsequent runs will be instant - this is a one-time setup!

[CHAT LLM] Download progress: 15.2% (decoder_model.onnx)
📥 Downloaded: 18.5 MB (+18.5 MB)
[CHAT LLM] Download progress: 45.8% (decoder_model.onnx)
📥 Downloaded: 55.3 MB (+36.8 MB)
...
✅ Model download complete!
```

#### 3. **Initialization**
```
[CHAT LLM] Agent chat system initialized
[CHAT LLM] Backend: transformers
[CHAT LLM] Agents can now socialize and negotiate with Qwen2.5-0.5B-Instruct AI

==================================================================
🎮 INTELLIGENT VILLAGE - STARTUP SUMMARY
==================================================================
Backend: TRANSFORMERS
Status: ✅ READY

🚀 All prerequisites satisfied - starting village...

==================================================================
```

#### 4. **Village Start**
```
==================================================================
[STARTUP] ✅ All prerequisites met - starting village!
==================================================================

[VILLAGE] Starting Intelligent Multi-Agent Village...
```

---

## Troubleshooting

### Problem: "Prerequisites not met"

**Solution**: Install required packages
```bash
npm install @huggingface/transformers onnxruntime-node
```

### Problem: "Model download failed"

**Solution**: Check internet connection and retry. Corrupted files will be auto-cleaned on next run.

### Problem: "Ollama service not running"

**Solution**:
1. Install Ollama: https://ollama.ai/download
2. Start service: `ollama serve`
3. Verify: Visit http://localhost:11434

### Problem: "LlamaCpp model not found"

**Solution**:
1. Download from: https://huggingface.co/mradermacher/UserLM-8b-GGUF
2. Get: `UserLM-8b.Q4_K_M.gguf` (~5GB)
3. Place in: `D:\MineRL\models\`

### Problem: Corrupted cache

**Solution**: The system auto-detects and cleans corrupted files:
```
⚠️  Found 3 corrupted file(s)
🧹 Cleaning corrupted cache files...
✅ Deleted: config.json
✅ Deleted: decoder_model.onnx
✅ Cleaned 2 corrupted file(s)
💡 Corrupted files removed - model will re-download if needed
```

---

## Performance Comparison

| Backend | Model Size | First Run | Subsequent Runs | Quality | Dependencies |
|---------|-----------|-----------|-----------------|---------|--------------|
| **Mock** | 0 MB | Instant | Instant | Basic | None |
| **Transformers.js** | 120 MB | 1-2 min | Instant | Good | 2 packages |
| **LlamaCpp** | 5 GB | Manual DL | Instant | Excellent | 1 package + model |
| **Ollama** | Variable | Instant | Instant | Excellent | External service |

---

## Advanced Configuration

### Custom Model (Transformers.js)

Edit `agent_chat_llm.js` line **134**:
```javascript
this.model = await pipeline(
    'text-generation',
    'onnx-community/Qwen2.5-0.5B-Instruct',  // Change this
    { dtype: 'q8' }
);
```

**Other compatible models**:
- `Xenova/TinyLlama-1.1B-Chat-v1.0` (~600MB)
- `onnx-community/Phi-3-mini-4k-instruct` (~2.5GB)
- `onnx-community/Qwen2.5-1.5B-Instruct` (~900MB)

### Disable Download Manager

To bypass prerequisite checks (not recommended):
```javascript
// intelligent_village.js line 3714
// Comment out this line:
// const chatLLMInitPromise = initializeChatLLM();

// And manually initialize:
chatLLM = getChatLLM('mock');
await chatLLM.initialize();
chatLLMReady = true;
```

---

## Files

### Core System Files
- `llm_download_manager.js` - Download manager with cache validation
- `agent_chat_llm.js` - Multi-backend LLM system
- `intelligent_village.js` - Main application (startup at line 3667)

### Model Cache Location
- **Windows**: `C:\Users\<username>\.cache\huggingface\transformers`
- **Linux/Mac**: `~/.cache/huggingface/transformers`

### Manual Model Directory
- `D:\MineRL\models\` - Place LlamaCpp GGUF models here

---

## Summary

✅ **What Changed**:
1. Village **WAITS** for LLM initialization before starting
2. Prerequisite checker validates dependencies
3. Download manager tracks model downloads
4. Corrupted cache auto-cleaned
5. Clear console output with progress indicators
6. Switched to smaller, faster model (Qwen2.5-0.5B)

✅ **Benefits**:
- No more "model not ready" errors
- Clear feedback on download progress
- Automatic error recovery
- Faster initial download (~120MB vs ~600MB)
- Professional startup experience

✅ **User Experience**:
- First run: 1-2 minute setup (one time)
- Subsequent runs: Instant startup
- Clear error messages with solutions
- No manual cache management needed
