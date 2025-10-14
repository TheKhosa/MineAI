# Agent Chat LLM Setup Guide

> **⚠️ UPDATED**: This system now includes automatic prerequisite checking and download management!
> **📚 See [STARTUP_GUIDE.md](STARTUP_GUIDE.md) for the latest startup procedure and features.**

The Intelligent Village agents can communicate with each other using various AI language models. The system supports multiple backends with automatic fallback to rule-based responses.

## ✨ New Features (2025-10-14)

- ✅ **Prerequisite Validation** - Automatic dependency checking
- ✅ **Download Manager** - Progress tracking for model downloads
- ✅ **Cache Validation** - Auto-clean corrupted files
- ✅ **Smaller Model** - Switched to Qwen2.5-0.5B-Instruct (~120MB vs ~500MB)
- ✅ **Smart Startup** - Village waits for LLM initialization
- ✅ **Visual Progress** - Clear console feedback

**Configuration location changed**: Now at `intelligent_village.js` line **3669**

## Current Status

**Default Backend**: Mock (rule-based)
- ✅ **Working out of the box** - no installation required
- Agents use context-aware template responses
- Based on agent needs, mood, and situation
- Perfect for testing and development

## Backend Options

### 1. Mock Backend (Default)
**Status**: ✅ Active and working

Rule-based responses with contextual awareness:
- Nearby conversations
- Trading requests
- Danger warnings
- Low health situations
- Resource sharing

**Configuration** (intelligent_village.js):
```javascript
chatLLM = getChatLLM('mock');
```

No installation required!

---

### 2. Transformers.js with Granite 4.0 Micro (ONNX)
**Status**: ⏳ Optional - requires large download

**Advantages**:
- Pure JavaScript (no Python required)
- IBM Granite 4.0 Micro model (3B parameters)
- Hybrid Mamba-Transformer architecture
- 8-bit quantization for efficiency

**Requirements**:
```bash
npm install @huggingface/transformers onnxruntime-node
```

**First Run**: Downloads ~500MB model to cache (one-time)

**Configuration** (intelligent_village.js line 3664):
```javascript
chatLLM = getChatLLM('transformers');
```

**Model Location**: `node_modules/@huggingface/transformers/.cache/`

---

### 3. node-llama-cpp with UserLM-8b (GGUF)
**Status**: 🔧 Optional - configured but requires model download

**Advantages**:
- UserLM-8b: Microsoft's user simulation model
- Designed for realistic user behavior
- Excellent for Minecraft player simulation
- Efficient GGUF format

**Requirements**:
```bash
npm install node-llama-cpp
```

**Model Download**:
1. Visit: https://huggingface.co/mradermacher/UserLM-8b-GGUF
2. Download: `UserLM-8b-Q4_K_M.gguf` (~5GB)
3. Place in: `D:\MineRL\ml_models\UserLM-8b-Q4_K_M.gguf`

**Configuration** (intelligent_village.js line 3664):
```javascript
chatLLM = getChatLLM('llamacpp');
```

**Quantization Options**:
- Q4_K_M: 5GB (recommended - best balance)
- Q6_K: 6.4GB (better quality)
- Q8_0: 8.6GB (highest quality)

---

### 4. Ollama (External Service)
**Status**: 🔧 Optional - requires external server

**Advantages**:
- Full GPU acceleration
- Easy model management
- Multiple model options

**Requirements**:
1. Install Ollama: https://ollama.ai
2. Start server: `ollama serve`
3. Pull model: `ollama pull granite`

**Configuration**:
```javascript
chatLLM = getChatLLM('ollama');
```

**Server**: Must run on localhost:11434

---

## Switching Backends

Edit `intelligent_village.js` line 3664:

```javascript
// Option 1: Mock (default, no installation)
chatLLM = getChatLLM('mock');

// Option 2: Transformers.js with Granite 4.0
chatLLM = getChatLLM('transformers');

// Option 3: node-llama-cpp with UserLM-8b
chatLLM = getChatLLM('llamacpp');

// Option 4: Ollama
chatLLM = getChatLLM('ollama');
```

**Automatic Fallback**: If initialization fails, the system automatically falls back to the mock backend.

---

## Testing Your Backend

Run the test script to verify your chosen backend:

```bash
node test_chat_llm.js
```

This will:
1. Initialize the backend
2. Generate sample dialogues
3. Test different contexts (nearby, low health, trading)
4. Show conversation statistics

---

## Performance Comparison

| Backend | First Load | Inference | Memory | Quality |
|---------|------------|-----------|--------|---------|
| Mock | Instant | <1ms | ~1MB | Good templates |
| Transformers.js | 2-5 min | ~500ms | ~2GB | Very good |
| node-llama-cpp | 10-30s | ~200ms | ~3GB | Excellent |
| Ollama | 10-30s | ~100ms | ~4GB | Excellent |

---

## Troubleshooting

### "Cannot find package '@huggingface/transformers'"
```bash
npm install @huggingface/transformers onnxruntime-node
```

### "Cannot find package 'node-llama-cpp'"
```bash
npm install node-llama-cpp
```

### "Model file not found: ml_models/UserLM-8b-Q4_K_M.gguf"
1. Create directory: `mkdir ml_models` (if not exists)
2. Download model from HuggingFace
3. Place in `ml_models/` folder

### "Ollama server not running"
```bash
ollama serve
```
Open new terminal and run:
```bash
ollama pull granite
```

### Transformers.js taking too long to download
- First run downloads ~500MB model
- Model cached for future use
- Be patient on first initialization
- Or use mock backend while developing

---

## Recommendation

**For Development**: Use mock backend (default)
- Fast, reliable, no downloads
- Good contextual responses
- Perfect for testing agent behavior

**For Production**: Use Transformers.js or node-llama-cpp
- Transformers.js: Pure JS, easier setup
- node-llama-cpp: Better quality, user simulation focus

**For GPU Systems**: Use Ollama
- Best performance with GPU acceleration
- Easy model switching

---

## Current Configuration

The system is currently configured to use:
- **Primary**: Transformers.js (Granite 4.0 Micro)
- **Fallback**: Mock backend (active by default)

**To use the system immediately**: No changes needed! The mock backend provides full functionality.

**To enable AI models**: Follow installation instructions above for your chosen backend.

---

## Agent Dialogue Features

Regardless of backend, agents will:
- ✅ Initiate conversations every 30 seconds
- ✅ Consider their own needs (health, hunger, safety, resources, social)
- ✅ Adapt messages to context (nearby, danger, trading, etc.)
- ✅ Generate appropriate responses based on mood
- ✅ Earn social rewards for interactions
- ✅ Show conversations in dashboard
- ✅ Track conversation history

The mock backend provides all these features with rule-based responses!
