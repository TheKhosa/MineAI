/**
 * Agent Dashboard - Web interface for monitoring and managing agents
 * Features: On-demand 3D view, stats, health/hunger monitoring, skill graphs
 * Using: Bootstrap, AdminLTE, Animate.js, Chart.js
 */

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

// Try to load prismarine-viewer (optional - requires canvas which has native dependencies)
let PrismarineViewer = null;
try {
    PrismarineViewer = require('prismarine-viewer').mineflayer;
    console.log('[DASHBOARD] Prismarine Viewer loaded - 3D view available');
} catch (error) {
    console.log('[DASHBOARD] Prismarine Viewer not available (canvas module missing)');
    console.log('[DASHBOARD] To enable 3D viewer: npm install canvas');
    console.log('[DASHBOARD] Dashboard will function without 3D viewer');
}

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const PORT = 3000;
const VIEWER_BASE_PORT = 3100; // Start viewer ports from 3100

// Store viewer instances for each bot (on-demand)
const viewerInstances = new Map();
let activeAgents = null;
let lineageTracker = null; // Reference to lineage tracker from intelligent_village.js
let nextViewerPort = VIEWER_BASE_PORT;
let spawnBotCallback = null; // Function to spawn bots from intelligent_village.js

// TTY console capture removed for cleaner dashboard

// Middleware
app.use(express.json());
app.use(express.static('public')); // For serving static files

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('[DASHBOARD] Client connected to real-time updates');

    socket.on('disconnect', () => {
        console.log('[DASHBOARD] Client disconnected');
    });

    // Handle spawn bot requests
    socket.on('spawnBots', async (data) => {
        console.log(`[DASHBOARD] Spawn request: ${data.amount} ${data.type} bot(s)`);

        if (!spawnBotCallback) {
            socket.emit('spawnBotsResponse', {
                success: false,
                message: 'Spawn function not initialized'
            });
            return;
        }

        try {
            const { type, amount } = data;

            // Validate
            if (!type || !amount || amount < 1 || amount > 50) {
                socket.emit('spawnBotsResponse', {
                    success: false,
                    message: 'Invalid spawn parameters'
                });
                return;
            }

            // Spawn bots with connection confirmation
            let spawned = 0;
            let failed = 0;
            const SPAWN_DELAY = 5000; // 5 seconds between each bot

            for (let i = 0; i < amount; i++) {
                try {
                    // Add delay BEFORE each spawn (except the first)
                    if (i > 0) {
                        await new Promise(resolve => setTimeout(resolve, SPAWN_DELAY));
                    }

                    console.log(`[DASHBOARD SPAWN] Spawning bot ${i + 1}/${amount}...`);

                    // Wait for successful spawn confirmation
                    await spawnBotCallback(type);
                    spawned++;

                    console.log(`[DASHBOARD SPAWN] Bot ${spawned}/${amount} spawned successfully`);

                    // Send progress update
                    io.emit('spawnProgress', {
                        current: spawned,
                        total: amount,
                        type: type,
                        failed: failed
                    });

                } catch (error) {
                    failed++;
                    console.error(`[DASHBOARD SPAWN ERROR] Bot ${i + 1} failed to spawn: ${error.message}`);

                    // Send progress update with failure
                    io.emit('spawnProgress', {
                        current: spawned,
                        total: amount,
                        type: type,
                        failed: failed,
                        error: error.message
                    });

                    // Continue spawning next bot despite failure
                }
            }

            emitServerEvent('system', `Dashboard spawn complete: ${spawned} succeeded, ${failed} failed`, {
                type,
                amount: spawned,
                failed: failed
            });

            socket.emit('spawnBotsResponse', {
                success: spawned > 0,
                message: `Spawned ${spawned}/${amount} ${type} bot(s)${failed > 0 ? ` (${failed} failed)` : '!'}`
            });
        } catch (error) {
            console.error('[DASHBOARD] Spawn error:', error);
            socket.emit('spawnBotsResponse', {
                success: false,
                message: `Error: ${error.message}`
            });
        }
    });
});

// Initialize the dashboard with reference to active agents
function initDashboard(agentsMap, lineageTrackerRef) {
    activeAgents = agentsMap;
    lineageTracker = lineageTrackerRef;
    console.log('[DASHBOARD] Initialized with agent map and lineage tracker');
}

// Set the spawn bot callback function
function setSpawnCallback(callback) {
    spawnBotCallback = callback;
    console.log('[DASHBOARD] Spawn callback registered');
}

// Emit agent join event
function emitAgentJoined(agentData) {
    io.emit('agentJoined', agentData);
    console.log(`[DASHBOARD] Emitted agentJoined event for ${agentData.name}`);
}

// Emit agent leave event
function emitAgentLeft(agentName) {
    io.emit('agentLeft', { name: agentName });
    console.log(`[DASHBOARD] Emitted agentLeft event for ${agentName}`);
}

// Emit agent update event (for live stats)
function emitAgentUpdate(agentData) {
    io.emit('agentUpdate', agentData);
}

// Emit server event (for live console)
function emitServerEvent(type, message, data = {}) {
    io.emit('serverEvent', {
        type,  // 'gamemaster', 'agent', 'system', 'skill', 'combat', 'death'
        message,
        data,
        timestamp: new Date().toISOString()
    });
}

// API: Create viewer on-demand for a specific bot
app.post('/api/viewer/create/:name', async (req, res) => {
    const agentName = req.params.name;

    if (!activeAgents) {
        return res.status(404).json({ error: 'No agents active' });
    }

    const bot = activeAgents.get(agentName);
    if (!bot) {
        return res.status(404).json({ error: 'Agent not found' });
    }

    // Check if viewer already exists
    if (viewerInstances.has(agentName)) {
        const viewerData = viewerInstances.get(agentName);
        return res.json({
            message: 'Viewer already exists',
            port: viewerData.port,
            url: `http://localhost:${viewerData.port}`
        });
    }

    try {
        if (!PrismarineViewer) {
            return res.status(503).json({
                error: 'Prismarine Viewer not available',
                message: 'Canvas module required. Install with: npm install canvas'
            });
        }

        const viewerPort = nextViewerPort++;

        console.log(`[DASHBOARD] Creating viewer for ${agentName} on port ${viewerPort}`);

        const viewer = PrismarineViewer(bot, {
            port: viewerPort,
            firstPerson: true
        });

        viewerInstances.set(agentName, {
            viewer,
            port: viewerPort,
            createdAt: Date.now()
        });

        console.log(`[DASHBOARD] Viewer created for ${agentName} on port ${viewerPort}`);

        res.json({
            message: 'Viewer created successfully',
            port: viewerPort,
            url: `http://localhost:${viewerPort}`
        });

    } catch (error) {
        console.error(`[DASHBOARD] Failed to create viewer for ${agentName}:`, error.message);
        res.status(500).json({ error: 'Failed to create viewer', message: error.message });
    }
});

// API: Close viewer for a specific bot
app.post('/api/viewer/close/:name', (req, res) => {
    const agentName = req.params.name;

    if (!viewerInstances.has(agentName)) {
        return res.status(404).json({ error: 'Viewer not found' });
    }

    try {
        const viewerData = viewerInstances.get(agentName);

        // Close the viewer
        if (viewerData.viewer && viewerData.viewer.close) {
            viewerData.viewer.close();
        }

        viewerInstances.delete(agentName);
        console.log(`[DASHBOARD] Viewer closed for ${agentName}`);

        res.json({ message: 'Viewer closed successfully' });

    } catch (error) {
        console.error(`[DASHBOARD] Failed to close viewer for ${agentName}:`, error.message);
        res.status(500).json({ error: 'Failed to close viewer', message: error.message });
    }
});

// API: Get lineage/dynasty data
app.get('/api/lineages', (req, res) => {
    if (!lineageTracker) {
        return res.json({ lineages: {}, error: 'Lineage tracker not initialized' });
    }

    try {
        const allLineages = lineageTracker.getAllLineages();
        res.json({ lineages: allLineages });
    } catch (error) {
        console.error('[DASHBOARD] Error getting lineages:', error);
        res.status(500).json({ error: 'Failed to get lineage data' });
    }
});

// API: Get all agents data
app.get('/api/agents', (req, res) => {
    if (!activeAgents) {
        return res.json({ agents: [] });
    }

    const agentData = [];
    activeAgents.forEach((bot) => {
        const stats = bot.rewards ? bot.rewards.getStats() : {};
        const currentGoal = bot.ai ? bot.ai.currentGoal : 'Unknown';
        const currentIssue = bot.ai ? bot.ai.currentIssue : null;

        // Get McMMO skills
        const mcmmoSkills = bot.rewards && bot.rewards.mcmmoSkills ? bot.rewards.mcmmoSkills : {};
        const skillsArray = Object.entries(mcmmoSkills).map(([name, data]) => ({
            name,
            level: data.level,
            xp: data.xp,
            xpToNextLevel: data.xpToNextLevel,
            totalActions: data.totalActions
        }));

        // Get ML stats if available
        const mlStats = {
            steps: bot.mlStepCount || 0,
            survivalTime: bot.mlSurvivalTime || 0,
            episodeReward: bot.mlEpisodeBuffer ? bot.mlEpisodeBuffer.totalReward() : 0,
            valueEstimate: bot.mlLastValue || 0,
            lastAction: bot.mlLastActionName || 'IDLE',
            lastActionSuccess: bot.mlLastActionSuccess !== false,
            explorationMode: bot.mlWasExploring ? 'EXPLORE' : 'EXPLOIT',
            rewardHistory: bot.mlRewardHistory || [],
            actionProbs: bot.mlActionProbs || null
        };

        // Get hierarchical goal if available
        const goalStats = bot.currentGoal ? {
            name: bot.currentGoal.name,
            description: bot.currentGoal.description,
            progress: bot.currentGoal.progress || 0,
            timeElapsed: Date.now() - (bot.currentGoal.startTime || Date.now()),
            duration: bot.currentGoal.duration * 1000,
            completed: bot.currentGoal.completed || false
        } : null;

        // Get needs and moods (Sims/Dwarf Fortress style)
        const needs = bot.needs || {};
        const moods = bot.moods || {};

        // Get relationships (top 5)
        const relationships = [];
        if (bot.relationships && bot.relationships.size > 0) {
            const relationshipArray = Array.from(bot.relationships.entries());
            relationshipArray.sort((a, b) => Math.abs(b[1].bond) - Math.abs(a[1].bond));

            for (const [otherUUID, relData] of relationshipArray.slice(0, 5)) {
                // Find the other agent's name
                let otherAgentName = 'Unknown';
                activeAgents.forEach((otherBot) => {
                    if (otherBot.uuid === otherUUID) {
                        otherAgentName = otherBot.agentName;
                    }
                });

                relationships.push({
                    agentName: otherAgentName,
                    agentUUID: otherUUID,
                    bond: relData.bond || 0,
                    trust: relData.trust || 0.5,
                    type: relData.type || 'neutral',
                    cooperationCount: relData.cooperationCount || 0
                });
            }
        }

        // Get sub-skills (Project Zomboid style)
        const subSkills = bot.subSkills || {};
        const subSkillsArray = Object.entries(subSkills).map(([skillId, skill]) => ({
            id: skillId,
            name: skill.name,
            category: skill.category,
            level: skill.level,
            xp: skill.xp,
            xpToNextLevel: skill.xpToNextLevel,
            maxLevel: skill.maxLevel,
            totalActions: skill.totalActions
        }));

        // Get moodles/debuffs (Project Zomboid style)
        const moodles = bot.moodles || {};
        const moodlesArray = Object.entries(moodles).map(([moodleId, moodle]) => ({
            id: moodleId,
            name: moodle.name,
            icon: moodle.icon,
            description: moodle.description,
            severity: moodle.severity,
            value: moodle.value
        }));

        agentData.push({
            name: bot.agentName,
            type: bot.agentType,
            generation: bot.generation,
            health: bot.health || 0,
            food: bot.food || 0,
            position: bot.entity ? {
                x: bot.entity.position.x.toFixed(1),
                y: bot.entity.position.y.toFixed(1),
                z: bot.entity.position.z.toFixed(1)
            } : null,
            currentTask: currentGoal,
            currentIssue: currentIssue,
            stats: {
                reward: stats.total_reward || 0,
                survival_time: stats.survival_time || 0,
                resources_gathered: stats.resources_gathered || 0,
                mobs_killed: stats.mobs_killed || 0,
                trades_completed: stats.trades_completed || 0,
                knowledge_shared: stats.knowledge_shared || 0,
                knowledge_learned: stats.knowledge_learned || 0
            },
            mlStats: mlStats,
            goal: goalStats,
            needs: needs,
            moods: moods,
            relationships: relationships,
            subSkills: subSkillsArray,
            moodles: moodlesArray,
            skills: skillsArray,
            inventory: bot.inventory ? bot.inventory.items().map(item => ({
                name: item.name,
                displayName: item.displayName,
                count: item.count
            })) : [],
            hasViewer: viewerInstances.has(bot.agentName),
            viewerPort: viewerInstances.has(bot.agentName) ? viewerInstances.get(bot.agentName).port : null,
            isBugged: bot.isBugged || false,
            needsResources: bot.rewards ? bot.rewards.needsResources : false,
            uuid: bot.uuid || null
        });
    });

    res.json({ agents: agentData, totalAgents: agentData.length, activeViewers: viewerInstances.size });
});

// API: Get village relationship network
app.get('/api/relationships', (req, res) => {
    if (!activeAgents) {
        return res.json({ nodes: [], edges: [] });
    }

    const nodes = [];
    const edges = [];

    // Create nodes for all agents
    activeAgents.forEach((bot) => {
        nodes.push({
            id: bot.uuid || bot.agentName,
            name: bot.agentName,
            type: bot.agentType,
            generation: bot.generation
        });
    });

    // Create edges for relationships
    activeAgents.forEach((bot) => {
        if (bot.relationships && bot.relationships.size > 0) {
            bot.relationships.forEach((relData, otherUUID) => {
                // Only add edge if other agent exists
                const otherBotExists = Array.from(activeAgents.values()).some(b => b.uuid === otherUUID);

                if (otherBotExists) {
                    edges.push({
                        source: bot.uuid || bot.agentName,
                        target: otherUUID,
                        bond: relData.bond || 0,
                        trust: relData.trust || 0.5,
                        type: relData.type || 'neutral',
                        cooperationCount: relData.cooperationCount || 0
                    });
                }
            });
        }
    });

    res.json({ nodes, edges });
});

// API: Get specific agent data
app.get('/api/agent/:name', (req, res) => {
    if (!activeAgents) {
        return res.status(404).json({ error: 'No agents active' });
    }

    const bot = activeAgents.get(req.params.name);
    if (!bot) {
        return res.status(404).json({ error: 'Agent not found' });
    }

    const stats = bot.rewards ? bot.rewards.getStats() : {};
    const currentGoal = bot.ai ? bot.ai.currentGoal : 'Unknown';
    const currentIssue = bot.ai ? bot.ai.currentIssue : null;

    res.json({
        name: bot.agentName,
        type: bot.agentType,
        generation: bot.generation,
        health: bot.health || 0,
        food: bot.food || 0,
        position: bot.entity ? {
            x: bot.entity.position.x.toFixed(1),
            y: bot.entity.position.y.toFixed(1),
            z: bot.entity.position.z.toFixed(1)
        } : null,
        currentTask: currentGoal,
        currentIssue: currentIssue,
        stats: stats,
        hasViewer: viewerInstances.has(bot.agentName),
        viewerPort: viewerInstances.has(bot.agentName) ? viewerInstances.get(bot.agentName).port : null,
        isBugged: bot.isBugged || false,
        inventory: bot.inventory ? bot.inventory.items().map(item => ({
            name: item.name,
            count: item.count
        })) : []
    });
});

// API: Get historical stats for charts (last 100 data points)
const statsHistory = new Map(); // agentName -> [{timestamp, stats}]

function recordStats() {
    if (!activeAgents) return;

    activeAgents.forEach((bot) => {
        if (!statsHistory.has(bot.agentName)) {
            statsHistory.set(bot.agentName, []);
        }

        const history = statsHistory.get(bot.agentName);
        const stats = bot.rewards ? bot.rewards.getStats() : {};

        history.push({
            timestamp: Date.now(),
            reward: stats.total_reward || 0,
            resources: stats.resources_gathered || 0,
            kills: stats.mobs_killed || 0,
            knowledge_shared: stats.knowledge_shared || 0,
            survival_time: stats.survival_time || 0
        });

        // Keep only last 100 data points
        if (history.length > 100) {
            history.shift();
        }
    });
}

// Record stats every 5 seconds
setInterval(recordStats, 5000);

app.get('/api/agent/:name/history', (req, res) => {
    const history = statsHistory.get(req.params.name) || [];
    res.json({ history });
});

// Serve the main dashboard HTML with server-side rendering
app.get('/', (req, res) => {
    // Get current agent data for SSR
    const agentData = [];
    let totalRewards = 0, totalResources = 0, totalKills = 0;

    if (activeAgents) {
        activeAgents.forEach((bot) => {
            const stats = bot.rewards ? bot.rewards.getStats() : {};
            const currentGoal = bot.ai ? bot.ai.currentGoal : 'Unknown';
            const currentIssue = bot.ai ? bot.ai.currentIssue : null;

            // Get McMMO skills
            const mcmmoSkills = bot.rewards && bot.rewards.mcmmoSkills ? bot.rewards.mcmmoSkills : {};
            const skillsArray = Object.entries(mcmmoSkills).map(([name, data]) => ({
                name,
                level: data.level,
                xp: data.xp,
                xpToNextLevel: data.xpToNextLevel,
                totalActions: data.totalActions
            }));

            // Get fitness if available
            const fitness = bot.rewards ? bot.rewards.calculateFitness() : null;

            agentData.push({
                name: bot.agentName,
                type: bot.agentType,
                generation: bot.generation,
                health: bot.health || 0,
                food: bot.food || 0,
                position: bot.entity ? {
                    x: bot.entity.position.x.toFixed(1),
                    y: bot.entity.position.y.toFixed(1),
                    z: bot.entity.position.z.toFixed(1)
                } : null,
                currentTask: currentGoal,
                currentIssue: currentIssue,
                stats: {
                    reward: stats.total_reward || 0,
                    survival_time: stats.survival_time || 0,
                    resources_gathered: stats.resources_gathered || 0,
                    mobs_killed: stats.mobs_killed || 0,
                    trades_completed: stats.trades_completed || 0,
                    knowledge_shared: stats.knowledge_shared || 0,
                    knowledge_learned: stats.knowledge_learned || 0
                },
                fitness: fitness,
                skills: skillsArray,
                inventory: bot.inventory ? bot.inventory.items().map(item => ({
                    name: item.name,
                    displayName: item.displayName,
                    count: item.count
                })) : [],
                hasViewer: viewerInstances.has(bot.agentName),
                viewerPort: viewerInstances.has(bot.agentName) ? viewerInstances.get(bot.agentName).port : null,
                isBugged: bot.isBugged || false,
                needsResources: bot.rewards ? bot.rewards.needsResources : false
            });

            totalRewards += stats.total_reward || 0;
            totalResources += stats.resources_gathered || 0;
            totalKills += stats.mobs_killed || 0;
        });
    }

    const totalAgents = agentData.length;
    const activeViewers = viewerInstances.size;

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Intelligent Village Dashboard</title>

    <!-- Bootstrap CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <!-- AdminLTE -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/admin-lte@3.2/dist/css/adminlte.min.css">
    <!-- Animate.css -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <!-- Socket.IO Client -->
    <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>

    <style>
        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .content-wrapper {
            margin-left: 0 !important;
            background: transparent !important;
        }

        .main-header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-bottom: none;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .info-box {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }

        .info-box:hover {
            transform: translateY(-5px);
        }

        .card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            border: none;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }

        .badge-gen {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .btn-view-bot {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            color: white;
            transition: all 0.3s ease;
        }

        .btn-view-bot:hover {
            transform: scale(1.05);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }

        .btn-close-viewer {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            border: none;
            color: white;
        }

        .progress {
            height: 8px;
            border-radius: 10px;
            background: rgba(0,0,0,0.1);
        }

        .progress-bar {
            border-radius: 10px;
        }

        .modal-content {
            border-radius: 15px;
            border: none;
        }

        .badge-pulse {
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
        }

        .chart-container {
            position: relative;
            height: 200px;
        }

        .agent-position {
            font-family: 'Courier New', monospace;
            font-size: 0.85em;
            color: #666;
        }

        /* Skill Badge Styles */
        .skill-badge {
            display: inline-block;
            padding: 3px 8px;
            margin: 2px;
            border-radius: 12px;
            font-size: 0.75em;
            font-weight: 600;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }

        .skill-progress {
            height: 4px;
            background: rgba(0,0,0,0.2);
            border-radius: 2px;
            overflow: hidden;
            margin-top: 2px;
        }

        .skill-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            transition: width 0.3s ease;
        }
    </style>
</head>
<body class="hold-transition layout-top-nav">
<div class="wrapper">

    <!-- Navbar -->
    <nav class="main-header navbar navbar-expand-md navbar-light navbar-white">
        <div class="container-fluid">
            <a href="/" class="navbar-brand">
                <i class="fas fa-city"></i>
                <span class="brand-text font-weight-light"><strong>Intelligent Village</strong> Dashboard</span>
            </a>

            <button class="navbar-toggler order-1" type="button" data-toggle="collapse" data-target="#navbarCollapse">
                <span class="navbar-toggler-icon"></span>
            </button>

            <div class="collapse navbar-collapse order-3" id="navbarCollapse">
                <ul class="navbar-nav">
                    <li class="nav-item">
                        <a class="nav-link active" href="#" onclick="showTab('agents'); return false;">
                            <i class="fas fa-robot"></i> Agents
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="#" onclick="showTab('dynasty'); return false;">
                            <i class="fas fa-sitemap"></i> Dynasty
                        </a>
                    </li>
                </ul>
                <ul class="navbar-nav ml-auto">
                    <li class="nav-item">
                        <span class="nav-link">
                            <i class="fas fa-eye"></i> Active Viewers: <span id="activeViewersCount">${activeViewers}</span>
                        </span>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <!-- Content Wrapper -->
    <div class="content-wrapper">
        <!-- Content Header -->
        <div class="content-header">
            <div class="container-fluid">
                <div class="row mb-2">
                    <div class="col-sm-12">
                        <h1 class="m-0 text-white animate__animated animate__fadeInDown">
                            <i class="fas fa-robot"></i> Agent Management System
                        </h1>
                    </div>
                </div>
            </div>
        </div>

        <!-- Main content -->
        <div class="content">
            <div class="container-fluid">

                <!-- Stats Overview (Server-Side Rendered) -->
                <div class="row mb-4 animate__animated animate__fadeInUp">
                    <div class="col-lg-3 col-6">
                        <div class="info-box">
                            <span class="info-box-icon bg-info elevation-1"><i class="fas fa-users"></i></span>
                            <div class="info-box-content">
                                <span class="info-box-text">Total Agents</span>
                                <span class="info-box-number" id="totalAgents">${totalAgents}</span>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-3 col-6">
                        <div class="info-box">
                            <span class="info-box-icon bg-success elevation-1"><i class="fas fa-trophy"></i></span>
                            <div class="info-box-content">
                                <span class="info-box-text">Total Rewards</span>
                                <span class="info-box-number" id="totalRewards">${totalRewards.toFixed(0)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-3 col-6">
                        <div class="info-box">
                            <span class="info-box-icon bg-warning elevation-1"><i class="fas fa-cubes"></i></span>
                            <div class="info-box-content">
                                <span class="info-box-text">Resources</span>
                                <span class="info-box-number" id="totalResources">${totalResources}</span>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-3 col-6">
                        <div class="info-box">
                            <span class="info-box-icon bg-danger elevation-1"><i class="fas fa-skull"></i></span>
                            <div class="info-box-content">
                                <span class="info-box-text">Mobs Killed</span>
                                <span class="info-box-number" id="totalKills">${totalKills}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Spawn Bot Controls -->
                <div class="row mb-4 animate__animated animate__fadeInUp">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-header bg-primary text-white">
                                <h5 class="m-0">
                                    <i class="fas fa-plus-circle"></i> Spawn New Bots
                                </h5>
                            </div>
                            <div class="card-body">
                                <div class="row">
                                    <div class="col-md-4">
                                        <label for="botType" class="form-label">Bot Type</label>
                                        <select class="form-select" id="botType">
                                            <optgroup label="Resource Gathering">
                                                <option value="MINING">Miner</option>
                                                <option value="LUMBERJACK">Lumberjack</option>
                                                <option value="FISHING">Fisher</option>
                                                <option value="FARMING">Farmer</option>
                                                <option value="QUARRY">Quarryman</option>
                                            </optgroup>
                                            <optgroup label="Combat & Defense">
                                                <option value="HUNTING">Hunter</option>
                                                <option value="GUARD">Guard</option>
                                                <option value="ARCHER">Archer</option>
                                                <option value="KNIGHT">Knight</option>
                                            </optgroup>
                                            <optgroup label="Exploration">
                                                <option value="EXPLORING">Explorer</option>
                                                <option value="SCOUT">Scout</option>
                                                <option value="SPELUNKER">Spelunker</option>
                                            </optgroup>
                                            <optgroup label="Crafting & Production">
                                                <option value="BLACKSMITH">Blacksmith</option>
                                                <option value="BAKER">Baker</option>
                                                <option value="BUILDER">Builder</option>
                                                <option value="TOOLMAKER">Toolmaker</option>
                                            </optgroup>
                                            <optgroup label="Support & Utility">
                                                <option value="TRADER">Trader</option>
                                                <option value="HEALER">Healer</option>
                                                <option value="SHEPHERD">Shepherd</option>
                                                <option value="ALCHEMIST">Alchemist</option>
                                            </optgroup>
                                            <optgroup label="Specialized">
                                                <option value="ENCHANTER">Enchanter</option>
                                            </optgroup>
                                        </select>
                                    </div>
                                    <div class="col-md-4">
                                        <label for="botAmount" class="form-label">Amount</label>
                                        <input type="number" class="form-control" id="botAmount" min="1" max="50" value="1">
                                        <small class="text-muted">Max: 50 bots at once</small>
                                    </div>
                                    <div class="col-md-4 d-flex align-items-end">
                                        <button class="btn btn-primary w-100" onclick="spawnBots()">
                                            <i class="fas fa-robot"></i> Spawn Bots
                                        </button>
                                    </div>
                                </div>
                                <div id="spawnStatus" class="mt-3" style="display:none;"></div>

                                <!-- Infinite Spawn Toggle -->
                                <div class="alert alert-warning mt-3">
                                    <div class="form-check form-switch">
                                        <input class="form-check-input" type="checkbox" id="infiniteSpawn" onchange="toggleInfiniteSpawn()">
                                        <label class="form-check-label" for="infiniteSpawn">
                                            <strong><i class="fas fa-infinity"></i> Infinite Random Spawn Mode</strong>
                                            <small class="d-block text-muted">Continuously spawns random agent types (5 sec delay)</small>
                                        </label>
                                    </div>
                                    <div id="infiniteStatus" class="mt-2" style="display:none;">
                                        <span id="infiniteCount" class="badge bg-primary">0</span> agents spawned
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ML Training Overview -->
                <div class="row mb-4 animate__animated animate__fadeInUp">
                    <div class="col-12">
                        <div class="card bg-gradient-primary">
                            <div class="card-header">
                                <h5 class="m-0 text-white">
                                    <i class="fas fa-brain"></i> ML Training Overview
                                    <small class="float-end">
                                        <span id="ml-status-badge" class="badge bg-success">
                                            <i class="fas fa-check-circle"></i> TRAINING
                                        </span>
                                    </small>
                                </h5>
                            </div>
                            <div class="card-body">
                                <div class="row text-center">
                                    <div class="col-lg-2 col-md-4 col-sm-6 mb-3">
                                        <div class="text-white">
                                            <i class="fas fa-walking fa-2x mb-2"></i>
                                            <h3 class="mb-0" id="ml-total-steps">0</h3>
                                            <small>Total Steps</small>
                                        </div>
                                    </div>
                                    <div class="col-lg-2 col-md-4 col-sm-6 mb-3">
                                        <div class="text-white">
                                            <i class="fas fa-flag-checkered fa-2x mb-2"></i>
                                            <h3 class="mb-0" id="ml-episodes">0</h3>
                                            <small>Episodes Completed</small>
                                        </div>
                                    </div>
                                    <div class="col-lg-2 col-md-4 col-sm-6 mb-3">
                                        <div class="text-white">
                                            <i class="fas fa-trophy fa-2x mb-2"></i>
                                            <h3 class="mb-0" id="ml-avg-reward">0.00</h3>
                                            <small>Avg Episode Reward</small>
                                        </div>
                                    </div>
                                    <div class="col-lg-2 col-md-4 col-sm-6 mb-3">
                                        <div class="text-white">
                                            <i class="fas fa-route fa-2x mb-2"></i>
                                            <h3 class="mb-0" id="ml-avg-length">0</h3>
                                            <small>Avg Episode Length</small>
                                        </div>
                                    </div>
                                    <div class="col-lg-2 col-md-4 col-sm-6 mb-3">
                                        <div class="text-white">
                                            <i class="fas fa-compass fa-2x mb-2"></i>
                                            <h3 class="mb-0" id="ml-exploration">0.00%</h3>
                                            <small>Exploration Rate</small>
                                        </div>
                                    </div>
                                    <div class="col-lg-2 col-md-4 col-sm-6 mb-3">
                                        <div class="text-white">
                                            <i class="fas fa-database fa-2x mb-2"></i>
                                            <h3 class="mb-0" id="ml-buffer-size">0</h3>
                                            <small>Replay Buffer</small>
                                        </div>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col-12">
                                        <div class="progress" style="height: 8px; background: rgba(255,255,255,0.2);">
                                            <div id="ml-buffer-progress" class="progress-bar progress-bar-striped progress-bar-animated bg-success"
                                                 role="progressbar" style="width: 0%" aria-valuenow="0" aria-valuemin="0" aria-valuemax="50000">
                                            </div>
                                        </div>
                                        <small class="text-white text-center d-block mt-1">
                                            <span id="ml-buffer-text">0 / 50,000</span> experiences in replay buffer
                                        </small>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col-md-6">
                                        <div class="small text-white">
                                            <i class="fas fa-microchip"></i> <strong>Active Brains:</strong>
                                            <span id="ml-active-brains">0</span> agent types
                                        </div>
                                    </div>
                                    <div class="col-md-6 text-md-end">
                                        <div class="small text-white">
                                            <i class="fas fa-graduation-cap"></i> <strong>Training Steps:</strong>
                                            <span id="ml-training-steps">0</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>


                <!-- Agents Tab Content (Server-Side Rendered) -->
                <div id="agentsTab" class="tab-content">
                    <div class="row" id="agentsGrid">
                        ${agentData.map(agent => {
                            const healthPercent = (agent.health / 20) * 100;
                            const foodPercent = (agent.food / 20) * 100;

                            const badges = [];
                            if (agent.needsResources) badges.push('<span class="badge bg-warning badge-pulse ms-1">NEEDS RESOURCES</span>');
                            if (agent.isBugged) badges.push('<span class="badge bg-danger badge-pulse ms-1">BUGGED</span>');
                            if (agent.generation > 1) badges.push(`<span class="badge badge-gen ms-1">Gen ${agent.generation}</span>`);

                            return `
                            <div class="col-lg-4 col-md-6 mb-4 animate__animated animate__fadeIn" id="agent-${agent.name}">
                                <div class="card">
                                    <div class="card-header">
                                        <h3 class="card-title">
                                            <i class="fas fa-robot"></i> <strong>${agent.name}</strong>
                                        </h3>
                                        <div class="card-tools">
                                            <span class="badge bg-primary">${agent.type}</span>
                                        </div>
                                    </div>
                                    <div class="card-body">
                                        <div class="mb-2">${badges.join('')}</div>

                                        <div class="row mb-3">
                                            <div class="col-6">
                                                <small class="text-muted"><i class="fas fa-heart text-danger"></i> Health</small>
                                                <div class="progress">
                                                    <div class="progress-bar bg-danger health-bar" style="width: ${healthPercent}%"></div>
                                                </div>
                                                <small class="health-value">${agent.health.toFixed(1)}/20</small>
                                            </div>
                                            <div class="col-6">
                                                <small class="text-muted"><i class="fas fa-drumstick-bite text-warning"></i> Hunger</small>
                                                <div class="progress">
                                                    <div class="progress-bar bg-warning hunger-bar" style="width: ${foodPercent}%"></div>
                                                </div>
                                                <small class="hunger-value">${agent.food.toFixed(1)}/20</small>
                                            </div>
                                        </div>

                                        <div class="alert alert-info mb-2 py-2">
                                            <small><strong><i class="fas fa-tasks"></i> Task:</strong> ${agent.currentTask || 'Idle'}</small>
                                        </div>

                                        ${agent.currentIssue ? `<div class="alert alert-danger mb-2 py-2">
                                            <small><strong><i class="fas fa-exclamation-triangle"></i> Issue:</strong> ${agent.currentIssue}</small>
                                        </div>` : ''}

                                        <div class="agent-position mb-2">
                                            <i class="fas fa-map-marker-alt"></i> Position: ${agent.position ? `X=${agent.position.x}, Y=${agent.position.y}, Z=${agent.position.z}` : 'Unknown'}
                                        </div>

                                        <div class="row text-center mb-3">
                                            <div class="col-3">
                                                <div class="small text-muted">Reward</div>
                                                <div class="stat-reward"><strong>${agent.stats.reward.toFixed(0)}</strong></div>
                                            </div>
                                            <div class="col-3">
                                                <div class="small text-muted">Fitness</div>
                                                <div class="stat-fitness"><strong>${agent.fitness ? agent.fitness.total.toFixed(0) : '0'}</strong></div>
                                            </div>
                                            <div class="col-3">
                                                <div class="small text-muted">Resources</div>
                                                <div class="stat-resources"><strong>${agent.stats.resources_gathered}</strong></div>
                                            </div>
                                            <div class="col-3">
                                                <div class="small text-muted">Kills</div>
                                                <div class="stat-kills"><strong>${agent.stats.mobs_killed}</strong></div>
                                            </div>
                                        </div>

                                        <div class="row mb-3">
                                            <div class="col-6">
                                                <div class="text-center mb-2">
                                                    <small class="text-muted"><strong>Skill Focus</strong></small>
                                                </div>
                                                <div style="height: 180px;">
                                                    <canvas id="radar-${agent.name}"></canvas>
                                                </div>
                                            </div>
                                            <div class="col-6">
                                                <div class="text-center mb-2">
                                                    <small class="text-muted"><strong>Progress</strong></small>
                                                </div>
                                                <div style="height: 180px;">
                                                    <canvas id="chart-${agent.name}"></canvas>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="alert alert-light py-2 mb-3" style="font-size: 0.85em;">
                                            <strong><i class="fas fa-crosshairs text-primary"></i> Currently Training:</strong>
                                            <span class="badge bg-primary training-badge">${agent.currentTask || 'Idle'}</span>
                                        </div>

                                        <div class="mb-3">
                                            <button class="btn btn-sm btn-outline-success w-100" type="button" data-bs-toggle="collapse" data-bs-target="#skills-${agent.name}">
                                                <i class="fas fa-star"></i> McMMO Skills (${agent.skills ? agent.skills.length : 0} unlocked)
                                            </button>
                                            <div class="collapse mt-2" id="skills-${agent.name}">
                                                <div class="card card-body" style="max-height: 200px; overflow-y: auto;">
                                                    <div class="skills-list">
                                                        ${agent.skills && agent.skills.length > 0 ?
                                                            agent.skills.map(skill => {
                                                                const progressPercent = (skill.xp / skill.xpToNextLevel) * 100;
                                                                return `<div class="mb-2">
                                                                    <div class="d-flex justify-content-between align-items-center">
                                                                        <span class="skill-badge">${skill.name} Lv.${skill.level}</span>
                                                                        <small class="text-muted">${skill.xp}/${skill.xpToNextLevel} XP</small>
                                                                    </div>
                                                                    <div class="skill-progress">
                                                                        <div class="skill-progress-bar" style="width: ${progressPercent}%"></div>
                                                                    </div>
                                                                    <small class="text-muted">${skill.totalActions} actions</small>
                                                                </div>`;
                                                            }).join('') :
                                                            '<small class="text-muted">No skills unlocked yet</small>'
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="mb-3">
                                            <button class="btn btn-sm btn-outline-primary w-100" type="button" data-bs-toggle="collapse" data-bs-target="#inventory-${agent.name}">
                                                <i class="fas fa-box"></i> View Inventory (${agent.inventory ? agent.inventory.length : 0} items)
                                            </button>
                                            <div class="collapse mt-2" id="inventory-${agent.name}">
                                                <div class="card card-body" style="max-height: 200px; overflow-y: auto;">
                                                    <div class="inventory-items">
                                                        ${agent.inventory && agent.inventory.length > 0 ?
                                                            agent.inventory.map(item =>
                                                                `<div class="d-flex justify-content-between align-items-center mb-1">
                                                                    <span class="text-truncate"><i class="fas fa-cube text-primary"></i> ${item.displayName || item.name}</span>
                                                                    <span class="badge bg-secondary">${item.count}</span>
                                                                </div>`
                                                            ).join('') :
                                                            '<small class="text-muted">No items in inventory</small>'
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <button class="btn btn-view-bot w-100" onclick="viewBot('${agent.name}', ${agent.hasViewer})">
                                            <i class="fas fa-eye"></i> ${agent.hasViewer ? 'Open Viewer' : 'View Bot (Create Viewer)'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Dynasty Tab Content -->
                <div id="dynastyTab" class="tab-content" style="display:none;">
                    <div class="row">
                        <div class="col-12">
                            <div class="card">
                                <div class="card-header bg-purple text-white">
                                    <h3 class="card-title">
                                        <i class="fas fa-dna"></i> Evolutionary Lineages
                                    </h3>
                                </div>
                                <div class="card-body">
                                    <div id="lineageGrid" class="row"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>

</div>

<!-- Viewer Modal -->
<div class="modal fade" id="viewerModal" tabindex="-1">
    <div class="modal-dialog modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">
                    <i class="fas fa-eye"></i> Bot Viewer: <span id="viewerAgentName"></span>
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <div class="text-center">
                    <div class="spinner-border text-primary" role="status" id="viewerLoading">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Creating 3D viewer...</p>
                </div>
                <iframe id="viewerFrame" style="width:100%; height:600px; border:none; display:none;"></iframe>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-danger" onclick="closeCurrentViewer()">
                    <i class="fas fa-times-circle"></i> Close Viewer & Free Resources
                </button>
            </div>
        </div>
    </div>
</div>

<!-- jQuery -->
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<!-- Bootstrap Bundle -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
<!-- AdminLTE -->
<script src="https://cdn.jsdelivr.net/npm/admin-lte@3.2/dist/js/adminlte.min.js"></script>

<script>
    const charts = new Map();
    const radarCharts = new Map();
    let currentViewerAgent = null;
    let viewerModal = null;
    let socket = null;
    let infiniteSpawnInterval = null;
    let infiniteSpawnCount = 0;

    // All available agent types for infinite spawning
    const ALL_AGENT_TYPES = [
        'MINING', 'LUMBERJACK', 'FISHING', 'FARMING', 'QUARRY', 'GEMOLOGIST', 'FORAGER',
        'HUNTING', 'GUARD', 'ARCHER', 'KNIGHT',
        'EXPLORING', 'SCOUT', 'SPELUNKER', 'TREASURE_HUNTER',
        'BLACKSMITH', 'BAKER', 'BUILDER', 'TOOLMAKER',
        'TRADER', 'HEALER', 'SHEPHERD', 'ALCHEMIST',
        'ENCHANTER', 'CARTOGRAPHER', 'BEEKEEPER', 'RANCHER',
        'NETHER_EXPLORER', 'END_RAIDER'
    ];

    // Initialize modal and Socket.IO
    document.addEventListener('DOMContentLoaded', function() {
        viewerModal = new bootstrap.Modal(document.getElementById('viewerModal'));

        // Connect to Socket.IO for real-time updates
        socket = io();

        socket.on('connect', () => {
            console.log('[Socket.IO] Connected to server');
        });

        socket.on('disconnect', () => {
            console.log('[Socket.IO] Disconnected from server');
        });

        // Handle agent joined event
        socket.on('agentJoined', (agentData) => {
            console.log('[Socket.IO] Agent joined:', agentData.name);

            // Show notification
            showNotification('Agent Joined', \`\${agentData.name} (\${agentData.type}) has joined the village!\`, 'success');

            // Refresh agent list
            fetchAgents();
        });

        // Handle agent left event
        socket.on('agentLeft', (data) => {
            console.log('[Socket.IO] Agent left:', data.name);

            // Show notification
            showNotification('Agent Left', \`\${data.name} has left the village.\`, 'warning');

            // Remove agent card with animation
            const agentCard = document.getElementById(\`agent-\${data.name}\`);
            if (agentCard) {
                agentCard.classList.add('animate__animated', 'animate__fadeOut');
                setTimeout(() => {
                    agentCard.remove();
                    charts.delete(data.name);
                    radarCharts.delete(data.name);
                }, 500);
            }
        });

        // Handle agent update event
        socket.on('agentUpdate', (agentData) => {
            updateAgentCard(document.getElementById(\`agent-\${agentData.name}\`), agentData);
        });



        // Handle spawn progress updates
        socket.on('spawnProgress', (progress) => {
            const spawnStatus = document.getElementById('spawnStatus');
            if (spawnStatus) {
                const failedText = progress.failed > 0 ? \` <span class="text-danger">(\${progress.failed} failed)</span>\` : '';
                const errorText = progress.error ? \`<br><small class="text-danger">Last error: \${progress.error}</small>\` : '';

                spawnStatus.className = 'alert alert-info mt-3';
                spawnStatus.innerHTML = \`
                    <i class="fas fa-spinner fa-spin"></i> Spawning \${progress.type} bots... (\${progress.current}/\${progress.total})\${failedText}
                    <div class="progress mt-2" style="height: 20px;">
                        <div class="progress-bar bg-success progress-bar-striped progress-bar-animated"
                             style="width: \${(progress.current / progress.total) * 100}%">
                            \${progress.current}/\${progress.total}
                        </div>
                        \${progress.failed > 0 ? \`
                        <div class="progress-bar bg-danger progress-bar-striped"
                             style="width: \${(progress.failed / progress.total) * 100}%">
                            \${progress.failed}
                        </div>
                        \` : ''}
                    </div>
                    \${errorText}
                \`;
                spawnStatus.style.display = 'block';
            }
        });

        // Handle ML stats updates
        socket.on('mlStats', (stats) => {
            // Update main stats
            document.getElementById('ml-total-steps').textContent = stats.totalSteps ? stats.totalSteps.toLocaleString() : '0';
            document.getElementById('ml-episodes').textContent = stats.episodesCompleted ? stats.episodesCompleted.toLocaleString() : '0';
            document.getElementById('ml-avg-reward').textContent = stats.avgReward ? stats.avgReward.toFixed(2) : '0.00';
            document.getElementById('ml-avg-length').textContent = stats.avgEpisodeLength ? Math.round(stats.avgEpisodeLength).toLocaleString() : '0';

            // Exploration rate (convert to percentage)
            const explorationRate = stats.explorationRate || 0;
            const explorationPercent = (parseFloat(explorationRate) * 100).toFixed(2);
            document.getElementById('ml-exploration').textContent = explorationPercent + '%';

            // Buffer size and progress
            const bufferSize = stats.bufferSize || 0;
            const maxBuffer = 50000;
            const bufferPercent = (bufferSize / maxBuffer) * 100;

            document.getElementById('ml-buffer-size').textContent = bufferSize.toLocaleString();
            document.getElementById('ml-buffer-text').textContent = \`\${bufferSize.toLocaleString()} / \${maxBuffer.toLocaleString()}\`;
            document.getElementById('ml-buffer-progress').style.width = bufferPercent + '%';
            document.getElementById('ml-buffer-progress').setAttribute('aria-valuenow', bufferSize);

            // Active brains and training steps
            document.getElementById('ml-active-brains').textContent = stats.activeBrains || '0';
            document.getElementById('ml-training-steps').textContent = stats.totalTrainingSteps ? stats.totalTrainingSteps.toLocaleString() : '0';
        });
    });

    function showNotification(title, message, type = 'info') {
        // Create toast notification (using simple alert for now)
        const toast = document.createElement('div');
        toast.className = \`alert alert-\${type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'info'} alert-dismissible fade show position-fixed\`;
        toast.style.cssText = 'top: 80px; right: 20px; z-index: 9999; min-width: 300px;';
        toast.innerHTML = \`
            <strong>\${title}</strong><br>
            \${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        \`;
        document.body.appendChild(toast);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    // Console functions removed for cleaner dashboard

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function spawnBots() {
        const botType = document.getElementById('botType').value;
        const amount = parseInt(document.getElementById('botAmount').value);
        const spawnStatus = document.getElementById('spawnStatus');

        // Validate input
        if (!botType || amount < 1 || amount > 50) {
            spawnStatus.className = 'alert alert-danger mt-3';
            spawnStatus.textContent = 'Please select a valid bot type and amount (1-50)';
            spawnStatus.style.display = 'block';
            return;
        }

        // Show loading
        spawnStatus.className = 'alert alert-info mt-3';
        spawnStatus.innerHTML = \`<i class="fas fa-spinner fa-spin"></i> Spawning \${amount} \${botType} bot(s)...\`;
        spawnStatus.style.display = 'block';

        // Emit spawn request via Socket.IO
        socket.emit('spawnBots', { type: botType, amount: amount });

        // Listen for spawn response
        socket.once('spawnBotsResponse', (response) => {
            if (response.success) {
                spawnStatus.className = 'alert alert-success mt-3';
                spawnStatus.innerHTML = \`<i class="fas fa-check-circle"></i> \${response.message}\`;

                // Add console log
                addConsoleLog({
                    type: 'system',
                    message: \`Spawned \${amount} \${botType} bot(s) via dashboard\`,
                    timestamp: new Date().toISOString()
                });

                // Auto-hide after 5 seconds
                setTimeout(() => {
                    spawnStatus.style.display = 'none';
                }, 5000);
            } else {
                spawnStatus.className = 'alert alert-danger mt-3';
                spawnStatus.innerHTML = \`<i class="fas fa-times-circle"></i> \${response.message}\`;
            }
        });
    }

    // Toggle infinite spawn mode
    function toggleInfiniteSpawn() {
        const checkbox = document.getElementById('infiniteSpawn');
        const statusDiv = document.getElementById('infiniteStatus');

        if (checkbox.checked) {
            // Start infinite spawning
            infiniteSpawnCount = 0;
            statusDiv.style.display = 'block';

            // Spawn first agent immediately
            spawnRandomAgent();

            // Then continue spawning every 5 seconds
            infiniteSpawnInterval = setInterval(() => {
                spawnRandomAgent();
            }, 5000); // 5 second delay to avoid throttling

            addConsoleLog({
                type: 'system',
                message: 'Infinite spawn mode ENABLED - spawning random agents every 5 seconds',
                timestamp: new Date().toISOString()
            });
        } else {
            // Stop infinite spawning
            if (infiniteSpawnInterval) {
                clearInterval(infiniteSpawnInterval);
                infiniteSpawnInterval = null;
            }

            addConsoleLog({
                type: 'system',
                message: \`Infinite spawn mode DISABLED - spawned \${infiniteSpawnCount} total agents\`,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Spawn a random agent type
    function spawnRandomAgent() {
        const randomType = ALL_AGENT_TYPES[Math.floor(Math.random() * ALL_AGENT_TYPES.length)];

        // Emit spawn request for 1 bot
        socket.emit('spawnBots', { type: randomType, amount: 1 });

        // Listen for response
        socket.once('spawnBotsResponse', (response) => {
            if (response.success) {
                infiniteSpawnCount++;
                document.getElementById('infiniteCount').textContent = infiniteSpawnCount;

                addConsoleLog({
                    type: 'agent',
                    message: \`Infinite spawn: \${randomType} agent spawned (total: \${infiniteSpawnCount})\`,
                    timestamp: new Date().toISOString()
                });
            } else {
                addConsoleLog({
                    type: 'system',
                    message: \`Infinite spawn failed: \${response.message}\`,
                    timestamp: new Date().toISOString()
                });
            }
        });
    }

    async function fetchAgents() {
        try {
            const response = await fetch('/api/agents');
            const data = await response.json();

            updateOverview(data);
            updateAgentsGrid(data.agents);
            document.getElementById('activeViewersCount').textContent = data.activeViewers;
        } catch (error) {
            console.error('Failed to fetch agents:', error);
        }
    }

    function updateOverview(data) {
        document.getElementById('totalAgents').textContent = data.totalAgents;

        let totalRewards = 0, totalResources = 0, totalKills = 0;
        data.agents.forEach(agent => {
            totalRewards += agent.stats.reward;
            totalResources += agent.stats.resources_gathered;
            totalKills += agent.stats.mobs_killed;
        });

        document.getElementById('totalRewards').textContent = totalRewards.toFixed(0);
        document.getElementById('totalResources').textContent = totalResources;
        document.getElementById('totalKills').textContent = totalKills;
    }

    function updateAgentsGrid(agents) {
        const grid = document.getElementById('agentsGrid');

        agents.forEach(agent => {
            let card = document.getElementById(\`agent-\${agent.name}\`);

            if (!card) {
                card = createAgentCard(agent);
                grid.appendChild(card);
            } else {
                updateAgentCard(card, agent);
            }
        });
    }

    function createAgentCard(agent) {
        const col = document.createElement('div');
        col.className = 'col-lg-4 col-md-6 mb-4 animate__animated animate__fadeIn';
        col.id = \`agent-\${agent.name}\`;

        const healthPercent = (agent.health / 20) * 100;
        const foodPercent = (agent.food / 20) * 100;

        const badges = [];
        if (agent.needsResources) badges.push('<span class="badge bg-warning badge-pulse ms-1">NEEDS RESOURCES</span>');
        if (agent.isBugged) badges.push('<span class="badge bg-danger badge-pulse ms-1">BUGGED</span>');
        if (agent.generation > 1) badges.push(\`<span class="badge badge-gen ms-1">Gen \${agent.generation}</span>\`);

        col.innerHTML = \`
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="fas fa-robot"></i> <strong>\${agent.name}</strong>
                    </h3>
                    <div class="card-tools">
                        <span class="badge bg-primary">\${agent.type}</span>
                    </div>
                </div>
                <div class="card-body">
                    <div class="mb-2">\${badges.join('')}</div>

                    <div class="row mb-3">
                        <div class="col-6">
                            <small class="text-muted"><i class="fas fa-heart text-danger"></i> Health</small>
                            <div class="progress">
                                <div class="progress-bar bg-danger health-bar" role="progressbar" style="width: \${healthPercent}%"></div>
                            </div>
                            <small class="health-value">\${agent.health.toFixed(1)}/20</small>
                        </div>
                        <div class="col-6">
                            <small class="text-muted"><i class="fas fa-drumstick-bite text-warning"></i> Hunger</small>
                            <div class="progress">
                                <div class="progress-bar bg-warning hunger-bar" role="progressbar" style="width: \${foodPercent}%"></div>
                            </div>
                            <small class="hunger-value">\${agent.food.toFixed(1)}/20</small>
                        </div>
                    </div>

                    <div class="alert alert-info mb-2 py-2">
                        <small><strong><i class="fas fa-tasks"></i> Task:</strong> \${agent.currentTask || 'Idle'}</small>
                    </div>

                    \${agent.currentIssue ? \`<div class="alert alert-danger mb-2 py-2">
                        <small><strong><i class="fas fa-exclamation-triangle"></i> Issue:</strong> \${agent.currentIssue}</small>
                    </div>\` : ''}

                    <div class="agent-position mb-2">
                        <i class="fas fa-map-marker-alt"></i> Position: \${agent.position ? \`X=\${agent.position.x}, Y=\${agent.position.y}, Z=\${agent.position.z}\` : 'Unknown'}
                    </div>

                    <div class="row text-center mb-3">
                        <div class="col-4">
                            <div class="small text-muted">Reward</div>
                            <div class="stat-reward"><strong>\${agent.stats.reward.toFixed(0)}</strong></div>
                        </div>
                        <div class="col-4">
                            <div class="small text-muted">Resources</div>
                            <div class="stat-resources"><strong>\${agent.stats.resources_gathered}</strong></div>
                        </div>
                        <div class="col-4">
                            <div class="small text-muted">Kills</div>
                            <div class="stat-kills"><strong>\${agent.stats.mobs_killed}</strong></div>
                        </div>
                    </div>

                    <div class="row mb-3">
                        <div class="col-6">
                            <div class="text-center mb-2">
                                <small class="text-muted"><strong>Skill Focus</strong></small>
                            </div>
                            <div style="height: 180px;">
                                <canvas id="radar-\${agent.name}"></canvas>
                            </div>
                        </div>
                        <div class="col-6">
                            <div class="text-center mb-2">
                                <small class="text-muted"><strong>Progress</strong></small>
                            </div>
                            <div style="height: 180px;">
                                <canvas id="chart-\${agent.name}"></canvas>
                            </div>
                        </div>
                    </div>

                    <div class="alert alert-light py-2 mb-3" style="font-size: 0.85em;">
                        <strong><i class="fas fa-crosshairs text-primary"></i> Currently Training:</strong>
                        <span class="badge bg-primary training-badge">\${agent.currentTask || 'Idle'}</span>
                    </div>

                    <div class="mb-3">
                        <button class="btn btn-sm btn-outline-success w-100" type="button" data-bs-toggle="collapse" data-bs-target="#skills-\${agent.name}">
                            <i class="fas fa-star"></i> McMMO Skills (\${agent.skills ? agent.skills.length : 0} unlocked)
                        </button>
                        <div class="collapse mt-2" id="skills-\${agent.name}">
                            <div class="card card-body" style="max-height: 200px; overflow-y: auto;">
                                <div class="skills-list">
                                    \${agent.skills && agent.skills.length > 0 ?
                                        agent.skills.map(skill => {
                                            const progressPercent = (skill.xp / skill.xpToNextLevel) * 100;
                                            return \`<div class="mb-2">
                                                <div class="d-flex justify-content-between align-items-center">
                                                    <span class="skill-badge">\${skill.name} Lv.\${skill.level}</span>
                                                    <small class="text-muted">\${skill.xp}/\${skill.xpToNextLevel} XP</small>
                                                </div>
                                                <div class="skill-progress">
                                                    <div class="skill-progress-bar" style="width: \${progressPercent}%"></div>
                                                </div>
                                                <small class="text-muted">\${skill.totalActions} actions</small>
                                            </div>\`;
                                        }).join('') :
                                        '<small class="text-muted">No skills unlocked yet</small>'
                                    }
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="mb-3">
                        <button class="btn btn-sm btn-outline-info w-100" type="button" data-bs-toggle="collapse" data-bs-target="#ml-stats-\${agent.name}">
                            <i class="fas fa-brain"></i> ML Training Stats
                        </button>
                        <div class="collapse mt-2" id="ml-stats-\${agent.name}">
                            <div class="card card-body bg-light">
                                <div class="row text-center mb-2">
                                    <div class="col-6">
                                        <small class="text-muted d-block">ML Steps</small>
                                        <strong class="ml-steps">0</strong>
                                    </div>
                                    <div class="col-6">
                                        <small class="text-muted d-block">Survival Time</small>
                                        <strong class="ml-survival">0s</strong>
                                    </div>
                                </div>
                                <div class="row text-center mb-2">
                                    <div class="col-6">
                                        <small class="text-muted d-block">Episode Reward</small>
                                        <strong class="ml-episode-reward text-success">+0.00</strong>
                                    </div>
                                    <div class="col-6">
                                        <small class="text-muted d-block">Value Estimate</small>
                                        <strong class="ml-value-estimate">0.00</strong>
                                    </div>
                                </div>
                                <hr class="my-2">
                                <div class="mb-2">
                                    <small class="text-muted d-block">Last ML Action</small>
                                    <span class="badge bg-primary ml-last-action">IDLE</span>
                                    <span class="badge bg-success ml-action-status">✓</span>
                                </div>
                                <div class="mb-2">
                                    <small class="text-muted d-block">Decision Mode</small>
                                    <span class="badge bg-info ml-exploration-mode">EXPLOIT</span>
                                </div>
                                <div class="mb-3">
                                    <small class="text-muted d-block mb-1">Recent Rewards</small>
                                    <div class="ml-reward-log" style="font-size: 0.75em; max-height: 100px; overflow-y: auto; font-family: monospace;">
                                        <div class="text-muted">No ML activity yet...</div>
                                    </div>
                                </div>
                                <div>
                                    <button class="btn btn-sm btn-outline-secondary w-100" type="button" data-bs-toggle="collapse" data-bs-target="#action-probs-\${agent.name}">
                                        <i class="fas fa-chart-bar"></i> Action Probabilities (Top 10)
                                    </button>
                                    <div class="collapse mt-2" id="action-probs-\${agent.name}">
                                        <div class="ml-action-probs" style="font-size: 0.8em;">
                                            <div class="text-muted text-center py-2">No data yet...</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="mb-3">
                        <button class="btn btn-sm btn-outline-primary w-100" type="button" data-bs-toggle="collapse" data-bs-target="#inventory-\${agent.name}">
                            <i class="fas fa-box"></i> View Inventory (\${agent.inventory ? agent.inventory.length : 0} items)
                        </button>
                        <div class="collapse mt-2" id="inventory-\${agent.name}">
                            <div class="card card-body" style="max-height: 200px; overflow-y: auto;">
                                <div class="inventory-items">
                                    \${agent.inventory && agent.inventory.length > 0 ?
                                        agent.inventory.map(item =>
                                            \`<div class="d-flex justify-content-between align-items-center mb-1">
                                                <span class="text-truncate"><i class="fas fa-cube text-primary"></i> \${item.displayName || item.name}</span>
                                                <span class="badge bg-secondary">\${item.count}</span>
                                            </div>\`
                                        ).join('') :
                                        '<small class="text-muted">No items in inventory</small>'
                                    }
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="mb-3">
                        <button class="btn btn-sm btn-outline-warning w-100" type="button" data-bs-toggle="collapse" data-bs-target="#goal-\${agent.name}">
                            <i class="fas fa-bullseye"></i> Current Goal
                        </button>
                        <div class="collapse mt-2" id="goal-\${agent.name}">
                            <div class="card card-body">
                                <div class="goal-info"></div>
                            </div>
                        </div>
                    </div>

                    <div class="mb-3">
                        <button class="btn btn-sm btn-outline-success w-100" type="button" data-bs-toggle="collapse" data-bs-target="#needs-\${agent.name}">
                            <i class="fas fa-heartbeat"></i> Needs & Moods
                        </button>
                        <div class="collapse mt-2" id="needs-\${agent.name}">
                            <div class="card card-body">
                                <div class="needs-moods-info"></div>
                            </div>
                        </div>
                    </div>

                    <div class="mb-3">
                        <button class="btn btn-sm btn-outline-danger w-100" type="button" data-bs-toggle="collapse" data-bs-target="#relationships-\${agent.name}">
                            <i class="fas fa-users"></i> Relationships (\${agent.relationships ? agent.relationships.length : 0})
                        </button>
                        <div class="collapse mt-2" id="relationships-\${agent.name}">
                            <div class="card card-body" style="max-height: 250px; overflow-y: auto;">
                                <div class="relationships-list">
                                    \${agent.relationships && agent.relationships.length > 0 ?
                                        agent.relationships.map(rel => {
                                            const bondPercent = ((rel.bond + 1) / 2) * 100;
                                            const trustPercent = rel.trust * 100;
                                            const bondColor = rel.bond > 0.5 ? 'success' : rel.bond < -0.5 ? 'danger' : 'warning';
                                            const typeIcon = rel.type === 'friend' ? '💚' : rel.type === 'rival' ? '💔' : rel.type === 'ally' ? '🤝' : '😐';
                                            return \`<div class="mb-3 pb-2 border-bottom">
                                                <div class="d-flex justify-content-between align-items-center mb-1">
                                                    <span><strong>\${typeIcon} \${rel.agentName}</strong></span>
                                                    <span class="badge bg-\${bondColor}">\${rel.type.toUpperCase()}</span>
                                                </div>
                                                <div class="mb-1">
                                                    <small class="text-muted">Bond: \${rel.bond.toFixed(2)}</small>
                                                    <div class="progress" style="height: 8px;">
                                                        <div class="progress-bar bg-\${bondColor}" style="width: \${bondPercent}%"></div>
                                                    </div>
                                                </div>
                                                <div class="mb-1">
                                                    <small class="text-muted">Trust: \${rel.trust.toFixed(2)}</small>
                                                    <div class="progress" style="height: 8px;">
                                                        <div class="progress-bar bg-info" style="width: \${trustPercent}%"></div>
                                                    </div>
                                                </div>
                                                <small class="text-muted">🤝 Cooperations: \${rel.cooperationCount}</small>
                                            </div>\`;
                                        }).join('') :
                                        '<small class="text-muted">No relationships formed yet</small>'
                                    }
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="mb-3">
                        <button class="btn btn-sm btn-outline-info w-100" type="button" data-bs-toggle="collapse" data-bs-target="#subskills-\${agent.name}">
                            <i class="fas fa-chart-line"></i> Sub-Skills (\${agent.subSkills ? agent.subSkills.length : 0})
                        </button>
                        <div class="collapse mt-2" id="subskills-\${agent.name}">
                            <div class="card card-body" style="max-height: 300px; overflow-y: auto;">
                                <div class="subskills-list">
                                    \${agent.subSkills && agent.subSkills.length > 0 ?
                                        (() => {
                                            // Group skills by category
                                            const categories = {COMBAT: [], SURVIVAL: [], CRAFTING: [], PHYSICAL: []};
                                            agent.subSkills.forEach(skill => {
                                                if (categories[skill.category]) {
                                                    categories[skill.category].push(skill);
                                                }
                                            });

                                            return Object.entries(categories).map(([category, skills]) => {
                                                if (skills.length === 0) return '';
                                                return \`
                                                    <h6 class="text-muted mt-2 mb-2">\${category}</h6>
                                                    \${skills.map(skill => {
                                                        const levelPercent = (skill.level / skill.maxLevel) * 100;
                                                        const xpPercent = (skill.xp / skill.xpToNextLevel) * 100;
                                                        return \`<div class="mb-3 pb-2 border-bottom">
                                                            <div class="d-flex justify-content-between align-items-center mb-1">
                                                                <span><strong>\${skill.name}</strong></span>
                                                                <span class="badge bg-primary">Lv \${skill.level}</span>
                                                            </div>
                                                            <div class="mb-1">
                                                                <small class="text-muted">Level Progress</small>
                                                                <div class="progress" style="height: 6px;">
                                                                    <div class="progress-bar bg-success" style="width: \${levelPercent}%"></div>
                                                                </div>
                                                            </div>
                                                            <div class="mb-1">
                                                                <small class="text-muted">XP: \${skill.xp}/\${skill.xpToNextLevel}</small>
                                                                <div class="progress" style="height: 6px;">
                                                                    <div class="progress-bar bg-warning" style="width: \${xpPercent}%"></div>
                                                                </div>
                                                            </div>
                                                            <small class="text-muted">Actions: \${skill.totalActions}</small>
                                                        </div>\`;
                                                    }).join('')}
                                                \`;
                                            }).join('');
                                        })() :
                                        '<small class="text-muted">No skills trained yet</small>'
                                    }
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="mb-3">
                        <button class="btn btn-sm btn-outline-warning w-100" type="button" data-bs-toggle="collapse" data-bs-target="#moodles-\${agent.name}">
                            <i class="fas fa-exclamation-triangle"></i> Status Effects (\${agent.moodles ? agent.moodles.length : 0})
                        </button>
                        <div class="collapse mt-2" id="moodles-\${agent.name}">
                            <div class="card card-body" style="max-height: 250px; overflow-y: auto;">
                                <div class="moodles-list">
                                    \${agent.moodles && agent.moodles.length > 0 ?
                                        agent.moodles.map(moodle => {
                                            const severityPercent = (moodle.severity / 4) * 100;
                                            const severityColor = moodle.severity >= 3 ? 'danger' : moodle.severity >= 2 ? 'warning' : 'info';
                                            const severityText = ['None', 'Mild', 'Moderate', 'Severe', 'Critical'][moodle.severity];
                                            return \`<div class="mb-3 pb-2 border-bottom">
                                                <div class="d-flex justify-content-between align-items-center mb-1">
                                                    <span><strong>\${moodle.icon} \${moodle.name}</strong></span>
                                                    <span class="badge bg-\${severityColor}">\${severityText}</span>
                                                </div>
                                                <p class="text-muted mb-1" style="font-size: 0.75em;">\${moodle.description}</p>
                                                <div class="mb-1">
                                                    <small class="text-muted">Severity</small>
                                                    <div class="progress" style="height: 8px;">
                                                        <div class="progress-bar bg-\${severityColor}" style="width: \${severityPercent}%"></div>
                                                    </div>
                                                </div>
                                            </div>\`;
                                        }).join('') :
                                        '<div class="alert alert-success mb-0"><i class="fas fa-check-circle"></i> No status effects - Healthy!</div>'
                                    }
                                </div>
                            </div>
                        </div>
                    </div>

                    <button class="btn btn-view-bot w-100" onclick="viewBot('\${agent.name}', \${agent.hasViewer})">
                        <i class="fas fa-eye"></i> \${agent.hasViewer ? 'Open Viewer' : 'View Bot (Create Viewer)'}
                    </button>
                </div>
            </div>
        \`;

        // Create both charts for this agent
        setTimeout(() => {
            createRadarChart(agent.name, agent.stats);
            createChart(agent.name);
        }, 100);

        return col;
    }

    function updateAgentCard(col, agent) {
        const healthPercent = (agent.health / 20) * 100;
        const foodPercent = (agent.food / 20) * 100;

        // Update health
        const healthBar = col.querySelector('.health-bar');
        const healthValue = col.querySelector('.health-value');
        if (healthBar) healthBar.style.width = \`\${healthPercent}%\`;
        if (healthValue) healthValue.textContent = \`\${agent.health.toFixed(1)}/20\`;

        // Update hunger
        const hungerBar = col.querySelector('.hunger-bar');
        const hungerValue = col.querySelector('.hunger-value');
        if (hungerBar) hungerBar.style.width = \`\${foodPercent}%\`;
        if (hungerValue) hungerValue.textContent = \`\${agent.food.toFixed(1)}/20\`;

        // Update stats
        const rewardEl = col.querySelector('.stat-reward strong');
        const resourcesEl = col.querySelector('.stat-resources strong');
        const killsEl = col.querySelector('.stat-kills strong');

        if (rewardEl) rewardEl.textContent = agent.stats.reward.toFixed(0);
        if (resourcesEl) resourcesEl.textContent = agent.stats.resources_gathered;
        if (killsEl) killsEl.textContent = agent.stats.mobs_killed;

        // Update ML stats if available
        if (agent.mlStats) {
            const mlSteps = col.querySelector('.ml-steps');
            const mlSurvival = col.querySelector('.ml-survival');
            const mlEpisodeReward = col.querySelector('.ml-episode-reward');
            const mlValueEstimate = col.querySelector('.ml-value-estimate');
            const mlLastAction = col.querySelector('.ml-last-action');
            const mlActionStatus = col.querySelector('.ml-action-status');
            const mlExplorationMode = col.querySelector('.ml-exploration-mode');

            if (mlSteps) mlSteps.textContent = agent.mlStats.steps.toLocaleString();
            if (mlSurvival) mlSurvival.textContent = agent.mlStats.survivalTime + 's';

            if (mlEpisodeReward) {
                const reward = agent.mlStats.episodeReward;
                mlEpisodeReward.textContent = (reward >= 0 ? '+' : '') + reward.toFixed(2);
                mlEpisodeReward.className = 'ml-episode-reward ' + (reward >= 0 ? 'text-success' : 'text-danger');
            }

            if (mlValueEstimate) mlValueEstimate.textContent = agent.mlStats.valueEstimate.toFixed(2);
            if (mlLastAction) mlLastAction.textContent = agent.mlStats.lastAction;

            if (mlActionStatus) {
                mlActionStatus.textContent = agent.mlStats.lastActionSuccess ? '✓' : '✗';
                mlActionStatus.className = 'badge ' + (agent.mlStats.lastActionSuccess ? 'bg-success' : 'bg-danger') + ' ml-action-status';
            }

            if (mlExplorationMode) {
                mlExplorationMode.textContent = agent.mlStats.explorationMode;
                mlExplorationMode.className = 'badge ' + (agent.mlStats.explorationMode === 'EXPLORE' ? 'bg-warning' : 'bg-info') + ' ml-exploration-mode';
            }

            // Update reward history log
            const mlRewardLog = col.querySelector('.ml-reward-log');
            if (mlRewardLog && agent.mlStats.rewardHistory && agent.mlStats.rewardHistory.length > 0) {
                const rewardLines = agent.mlStats.rewardHistory.slice(-5).reverse().map(entry => {
                    const time = new Date(entry.timestamp).toLocaleTimeString();
                    const color = entry.total >= 0 ? 'text-success' : 'text-danger';
                    const sign = entry.total >= 0 ? '+' : '';
                    return \`<div class="\${color}">[T+\${agent.mlStats.survivalTime}s] \${sign}\${entry.total.toFixed(2)} (\${entry.breakdown})</div>\`;
                }).join('');
                mlRewardLog.innerHTML = rewardLines || '<div class="text-muted">No ML activity yet...</div>';
            }

            // Update action probabilities (top 10)
            const mlActionProbs = col.querySelector('.ml-action-probs');
            if (mlActionProbs && agent.mlStats.actionProbs && agent.mlStats.actionProbs.length > 0) {
                // Action names mapping (from ml_action_space.js)
                const actionNames = [
                    'move_forward', 'move_backward', 'move_left', 'move_right', 'jump',
                    'sneak', 'stop_moving', 'sprint', 'look_around', 'random_walk',
                    'dig_forward', 'dig_down', 'dig_up', 'place_block', 'attack_nearest',
                    'use_item', 'equip_best_tool', 'eat_food', 'open_nearby_chest', 'activate_block',
                    'mine_nearest_ore', 'chop_nearest_tree', 'collect_nearest_item', 'mine_stone', 'search_for_resources',
                    'gather_food', 'fish', 'farm_crops', 'mine_deep', 'surface_explore',
                    'fight_zombie', 'fight_skeleton', 'fight_creeper', 'defend_position', 'retreat',
                    'craft_tools', 'craft_weapons', 'smelt_ores', 'build_structure', 'place_torch',
                    'find_agent', 'trade_with_agent', 'follow_agent', 'share_resources', 'request_help',
                    'idle', 'go_to_surface', 'go_underground', 'find_shelter', 'return_to_village'
                ];

                // Create pairs and sort by probability
                const actionProbPairs = agent.mlStats.actionProbs.map((prob, idx) => ({
                    name: actionNames[idx] || \`ACTION_\${idx}\`,
                    prob: prob
                }));
                actionProbPairs.sort((a, b) => b.prob - a.prob);
                const top10 = actionProbPairs.slice(0, 10);

                // Generate HTML with probability bars
                const probBars = top10.map((item, idx) => {
                    const percent = (item.prob * 100).toFixed(1);
                    const barColor = idx === 0 ? 'bg-success' : (idx < 3 ? 'bg-primary' : 'bg-secondary');
                    return \`
                        <div class="mb-1">
                            <div class="d-flex justify-content-between">
                                <small class="text-truncate" style="max-width: 70%;">\${item.name}</small>
                                <small class="text-muted">\${percent}%</small>
                            </div>
                            <div class="progress" style="height: 6px;">
                                <div class="progress-bar \${barColor}" style="width: \${percent}%"></div>
                            </div>
                        </div>
                    \`;
                }).join('');

                mlActionProbs.innerHTML = probBars || '<div class="text-muted text-center py-2">No data yet...</div>';
            }
        }

        // Update goal section
        const goalInfo = col.querySelector('.goal-info');
        if (goalInfo) {
            if (agent.goal) {
                const progress = (agent.goal.progress * 100).toFixed(1);
                const timeElapsed = Math.floor(agent.goal.timeElapsed / 1000);
                const totalTime = Math.floor(agent.goal.duration / 1000);
                const timeRemaining = Math.max(0, totalTime - timeElapsed);
                const progressColor = agent.goal.completed ? 'success' : (agent.goal.progress > 0.5 ? 'primary' : 'warning');

                goalInfo.innerHTML = \`
                    <div class="mb-2">
                        <strong class="text-primary">\${agent.goal.name.replace(/_/g, ' ').toUpperCase()}</strong>
                        \${agent.goal.completed ? '<span class="badge bg-success ms-2">✓ COMPLETED</span>' : ''}
                    </div>
                    <p class="text-muted mb-2" style="font-size: 0.85em;">\${agent.goal.description}</p>
                    <div class="mb-2">
                        <div class="d-flex justify-content-between mb-1">
                            <small class="text-muted">Progress</small>
                            <small class="text-muted">\${progress}%</small>
                        </div>
                        <div class="progress" style="height: 12px;">
                            <div class="progress-bar bg-\${progressColor}" style="width: \${progress}%"></div>
                        </div>
                    </div>
                    <div class="row text-center">
                        <div class="col-6">
                            <small class="text-muted d-block">Time Elapsed</small>
                            <strong>\${timeElapsed}s</strong>
                        </div>
                        <div class="col-6">
                            <small class="text-muted d-block">Time Remaining</small>
                            <strong>\${timeRemaining}s</strong>
                        </div>
                    </div>
                \`;
            } else {
                goalInfo.innerHTML = '<small class="text-muted">No active goal</small>';
            }
        }

        // Update needs & moods section
        const needsMoodsInfo = col.querySelector('.needs-moods-info');
        if (needsMoodsInfo) {
            const needs = agent.needs || {};
            const moods = agent.moods || {};

            // Define needs order and emojis
            const needsOrder = [
                { key: 'hunger', label: 'Hunger', emoji: '🍖' },
                { key: 'energy', label: 'Energy', emoji: '⚡' },
                { key: 'safety', label: 'Safety', emoji: '🛡️' },
                { key: 'social', label: 'Social', emoji: '👥' },
                { key: 'comfort', label: 'Comfort', emoji: '🏠' },
                { key: 'achievement', label: 'Achievement', emoji: '🏆' },
                { key: 'exploration', label: 'Exploration', emoji: '🗺️' },
                { key: 'cooperation', label: 'Cooperation', emoji: '🤝' },
                { key: 'creativity', label: 'Creativity', emoji: '🎨' },
                { key: 'rest', label: 'Rest', emoji: '😴' }
            ];

            const moodsOrder = [
                { key: 'happiness', label: 'Happiness', emoji: '😊' },
                { key: 'stress', label: 'Stress', emoji: '😰' },
                { key: 'boredom', label: 'Boredom', emoji: '😑' },
                { key: 'motivation', label: 'Motivation', emoji: '💪' },
                { key: 'loneliness', label: 'Loneliness', emoji: '😔' },
                { key: 'confidence', label: 'Confidence', emoji: '😎' },
                { key: 'curiosity', label: 'Curiosity', emoji: '🤔' },
                { key: 'fear', label: 'Fear', emoji: '😨' }
            ];

            let html = '<h6 class="text-muted mb-3"><i class="fas fa-heart"></i> Needs</h6>';

            needsOrder.forEach(need => {
                const value = needs[need.key] !== undefined ? needs[need.key] : 0.5;
                const percent = (value * 100).toFixed(0);
                const barColor = value > 0.7 ? 'success' : value > 0.4 ? 'warning' : 'danger';

                html += \`
                    <div class="mb-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <small><strong>\${need.emoji} \${need.label}</strong></small>
                            <small class="text-muted">\${percent}%</small>
                        </div>
                        <div class="progress" style="height: 8px;">
                            <div class="progress-bar bg-\${barColor}" style="width: \${percent}%"></div>
                        </div>
                    </div>
                \`;
            });

            html += '<hr class="my-3"><h6 class="text-muted mb-3"><i class="fas fa-smile"></i> Moods</h6>';

            moodsOrder.forEach(mood => {
                const value = moods[mood.key] !== undefined ? moods[mood.key] : 0.5;
                const percent = (value * 100).toFixed(0);
                const barColor = value > 0.7 ? 'primary' : value > 0.4 ? 'info' : 'secondary';

                html += \`
                    <div class="mb-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <small><strong>\${mood.emoji} \${mood.label}</strong></small>
                            <small class="text-muted">\${percent}%</small>
                        </div>
                        <div class="progress" style="height: 8px;">
                            <div class="progress-bar bg-\${barColor}" style="width: \${percent}%"></div>
                        </div>
                    </div>
                \`;
            });

            needsMoodsInfo.innerHTML = html;
        }

        // Update button text
        const button = col.querySelector('.btn-view-bot');
        if (button) {
            button.innerHTML = \`<i class="fas fa-eye"></i> \${agent.hasViewer ? 'Open Viewer' : 'View Bot (Create Viewer)'}\`;
        }

        // Update training badge
        const trainingBadge = col.querySelector('.training-badge');
        if (trainingBadge) {
            trainingBadge.textContent = agent.currentTask || 'Idle';
        }

        // Update charts
        updateChart(agent.name, agent.stats);
        updateRadarChart(agent.name, agent.stats);
    }

    async function viewBot(agentName, hasViewer) {
        currentViewerAgent = agentName;
        document.getElementById('viewerAgentName').textContent = agentName;
        document.getElementById('viewerLoading').style.display = 'block';
        document.getElementById('viewerFrame').style.display = 'none';

        viewerModal.show();

        if (!hasViewer) {
            // Create viewer
            try {
                const response = await fetch(\`/api/viewer/create/\${agentName}\`, { method: 'POST' });
                const data = await response.json();

                if (data.port) {
                    document.getElementById('viewerLoading').style.display = 'none';
                    document.getElementById('viewerFrame').src = data.url;
                    document.getElementById('viewerFrame').style.display = 'block';
                } else {
                    alert('Failed to create viewer: ' + (data.error || 'Unknown error'));
                }
            } catch (error) {
                alert('Failed to create viewer: ' + error.message);
            }
        } else {
            // Viewer already exists, just open it
            try {
                const response = await fetch(\`/api/agent/\${agentName}\`);
                const data = await response.json();

                if (data.viewerPort) {
                    document.getElementById('viewerLoading').style.display = 'none';
                    document.getElementById('viewerFrame').src = \`http://localhost:\${data.viewerPort}\`;
                    document.getElementById('viewerFrame').style.display = 'block';
                }
            } catch (error) {
                alert('Failed to open viewer: ' + error.message);
            }
        }
    }

    async function closeCurrentViewer() {
        if (!currentViewerAgent) return;

        try {
            await fetch(\`/api/viewer/close/\${currentViewerAgent}\`, { method: 'POST' });
            viewerModal.hide();
            document.getElementById('viewerFrame').src = '';
            currentViewerAgent = null;
        } catch (error) {
            alert('Failed to close viewer: ' + error.message);
        }
    }

    function createRadarChart(agentName, stats) {
        const ctx = document.getElementById(\`radar-\${agentName}\`);
        if (!ctx) return;

        // Calculate skill scores from stats (normalized to 0-100)
        const maxCombat = 50; // Max expected mobs killed
        const maxResources = 100; // Max expected resources
        const maxSurvival = 300; // Max expected survival time (5 minutes)
        const maxTrading = 20; // Max expected trades
        const maxKnowledge = 30; // Max expected knowledge shares

        const combatScore = Math.min((stats.mobs_killed / maxCombat) * 100, 100);
        const resourceScore = Math.min((stats.resources_gathered / maxResources) * 100, 100);
        const survivalScore = Math.min((stats.survival_time / maxSurvival) * 100, 100);
        const tradingScore = Math.min((stats.trades_completed / maxTrading) * 100, 100);
        const knowledgeScore = Math.min((stats.knowledge_shared / maxKnowledge) * 100, 100);

        const chart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Combat', 'Resources', 'Survival', 'Trading', 'Knowledge'],
                datasets: [{
                    label: 'Skill Level',
                    data: [combatScore, resourceScore, survivalScore, tradingScore, knowledgeScore],
                    backgroundColor: 'rgba(102, 126, 234, 0.2)',
                    borderColor: 'rgb(102, 126, 234)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgb(102, 126, 234)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(102, 126, 234)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            stepSize: 25,
                            display: false
                        }
                    }
                }
            }
        });

        radarCharts.set(agentName, chart);
    }

    async function createChart(agentName) {
        const ctx = document.getElementById(\`chart-\${agentName}\`);
        if (!ctx) return;

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Reward',
                    data: [],
                    borderColor: 'rgb(102, 126, 234)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Resources',
                    data: [],
                    borderColor: 'rgb(118, 75, 162)',
                    backgroundColor: 'rgba(118, 75, 162, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        charts.set(agentName, chart);

        // Fetch historical data
        try {
            const response = await fetch(\`/api/agent/\${agentName}/history\`);
            const data = await response.json();

            if (data.history && data.history.length > 0) {
                const labels = data.history.map((_, i) => i.toString());
                const rewards = data.history.map(h => h.reward);
                const resources = data.history.map(h => h.resources);

                chart.data.labels = labels;
                chart.data.datasets[0].data = rewards;
                chart.data.datasets[1].data = resources;
                chart.update();
            }
        } catch (error) {
            console.error('Failed to fetch history:', error);
        }
    }

    function updateChart(agentName, stats) {
        const chart = charts.get(agentName);
        if (!chart) return;

        // Add new data point
        if (chart.data.labels.length > 20) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
            chart.data.datasets[1].data.shift();
        }

        chart.data.labels.push(chart.data.labels.length.toString());
        chart.data.datasets[0].data.push(stats.reward);
        chart.data.datasets[1].data.push(stats.resources_gathered);
        chart.update('none'); // Update without animation
    }

    function updateRadarChart(agentName, stats) {
        const chart = radarCharts.get(agentName);
        if (!chart) return;

        // Calculate skill scores from stats (normalized to 0-100)
        const maxCombat = 50;
        const maxResources = 100;
        const maxSurvival = 300;
        const maxTrading = 20;
        const maxKnowledge = 30;

        const combatScore = Math.min((stats.mobs_killed / maxCombat) * 100, 100);
        const resourceScore = Math.min((stats.resources_gathered / maxResources) * 100, 100);
        const survivalScore = Math.min((stats.survival_time / maxSurvival) * 100, 100);
        const tradingScore = Math.min((stats.trades_completed / maxTrading) * 100, 100);
        const knowledgeScore = Math.min((stats.knowledge_shared / maxKnowledge) * 100, 100);

        chart.data.datasets[0].data = [combatScore, resourceScore, survivalScore, tradingScore, knowledgeScore];
        chart.update('none'); // Update without animation
    }

    // Tab switching
    function showTab(tabName) {
        // Hide all tabs
        document.getElementById('agentsTab').style.display = 'none';
        document.getElementById('dynastyTab').style.display = 'none';

        // Remove active class from all nav links
        document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
            link.classList.remove('active');
        });

        // Show selected tab
        if (tabName === 'agents') {
            document.getElementById('agentsTab').style.display = 'block';
            document.querySelectorAll('.navbar-nav .nav-link')[0].classList.add('active');
        } else if (tabName === 'dynasty') {
            document.getElementById('dynastyTab').style.display = 'block';
            document.querySelectorAll('.navbar-nav .nav-link')[1].classList.add('active');
            fetchLineages(); // Load lineage data when switching to dynasty tab
        }
    }

    // Fetch and display lineage data
    async function fetchLineages() {
        try {
            const response = await fetch('/api/lineages');
            const data = await response.json();

            updateLineageGrid(data.lineages);
        } catch (error) {
            console.error('Failed to fetch lineages:', error);
        }
    }

    function updateLineageGrid(lineages) {
        const grid = document.getElementById('lineageGrid');
        grid.innerHTML = ''; // Clear existing

        if (!lineages || Object.keys(lineages).length === 0) {
            grid.innerHTML = '<div class="col-12"><p class="text-muted">No lineage data available yet.</p></div>';
            return;
        }

        // Group by status: active vs extinct
        const activeLineages = [];
        const extinctLineages = [];

        Object.entries(lineages).forEach(([agentType, lineage]) => {
            if (lineage.extinct) {
                extinctLineages.push({ type: agentType, ...lineage });
            } else {
                activeLineages.push({ type: agentType, ...lineage });
            }
        });

        // Display active lineages
        if (activeLineages.length > 0) {
            grid.innerHTML += '<div class="col-12"><h4 class="text-success"><i class="fas fa-heartbeat"></i> Active Lineages</h4></div>';
            activeLineages.forEach(lineage => {
                grid.innerHTML += createLineageCard(lineage, false);
            });
        }

        // Display extinct lineages
        if (extinctLineages.length > 0) {
            grid.innerHTML += '<div class="col-12 mt-4"><h4 class="text-danger"><i class="fas fa-skull-crossbones"></i> Extinct Lineages</h4></div>';
            extinctLineages.forEach(lineage => {
                grid.innerHTML += createLineageCard(lineage, true);
            });
        }
    }

    function createLineageCard(lineage, isExtinct) {
        const statusColor = isExtinct ? 'danger' : 'success';
        const statusIcon = isExtinct ? 'skull-crossbones' : 'heartbeat';
        const statusText = isExtinct ? 'EXTINCT' : 'ACTIVE';

        return \`
            <div class="col-md-4 col-sm-6 mb-3">
                <div class="card">
                    <div class="card-header bg-\${statusColor} text-white">
                        <h5 class="mb-0">
                            <i class="fas fa-\${statusIcon}"></i> \${lineage.type}
                        </h5>
                    </div>
                    <div class="card-body">
                        <div class="mb-2">
                            <strong>Status:</strong> <span class="badge bg-\${statusColor}">\${statusText}</span>
                        </div>
                        <div class="mb-2">
                            <strong>Highest Generation:</strong> <span class="badge bg-info">Gen \${lineage.generation}</span>
                        </div>
                        <div class="mb-2">
                            <strong>Living Agents:</strong> <span class="badge bg-primary">\${lineage.living}</span>
                        </div>
                        <div class="mb-2">
                            <strong>Last Parent:</strong> <small class="text-muted">\${lineage.lastParent}</small>
                        </div>
                        \${!isExtinct ? \`
                            <div class="alert alert-success mt-2 py-1" style="font-size: 0.85em;">
                                <i class="fas fa-chart-line"></i> Lineage evolving - Gen \${lineage.generation + 1} will spawn next
                            </div>
                        \` : \`
                            <div class="alert alert-danger mt-2 py-1" style="font-size: 0.85em;">
                                <i class="fas fa-redo"></i> Next spawn will restart at Gen 1
                            </div>
                        \`}
                    </div>
                </div>
            </div>
        \`;
    }

    // Update lineages every 5 seconds when on dynasty tab
    setInterval(() => {
        if (document.getElementById('dynastyTab').style.display !== 'none') {
            fetchLineages();
        }
    }, 5000);

    // Initialize charts for all server-side rendered agents
    function initializeServerRenderedAgents() {
        const serverAgentData = ${JSON.stringify(agentData)};

        serverAgentData.forEach(agent => {
            // Create charts for each agent
            setTimeout(() => {
                createRadarChart(agent.name, agent.stats);
                createChart(agent.name);
            }, 100);
        });

        console.log('[Dashboard] Initialized ' + serverAgentData.length + ' server-rendered agents');
    }

    // Initialize SSR agents on page load
    initializeServerRenderedAgents();

    // Update agents every 2 seconds
    setInterval(fetchAgents, 2000);
    fetchAgents(); // Initial load
</script>

</body>
</html>
    `);
});

// Start server
function startDashboard() {
    server.listen(PORT, () => {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`[DASHBOARD] Web Dashboard running at http://localhost:${PORT}`);
        console.log(`[DASHBOARD] Open your browser to monitor agents`);
        console.log(`[DASHBOARD] Real-time updates enabled via Socket.IO`);
        console.log(`[DASHBOARD] Viewers will be created on-demand (resource efficient)`);
        console.log(`${'='.repeat(70)}\n`);
    });
}

// Cleanup function for when agents disconnect
function cleanupViewer(agentName) {
    if (viewerInstances.has(agentName)) {
        try {
            const viewerData = viewerInstances.get(agentName);
            if (viewerData.viewer && viewerData.viewer.close) {
                viewerData.viewer.close();
            }
            viewerInstances.delete(agentName);
            console.log(`[DASHBOARD] Cleaned up viewer for disconnected agent: ${agentName}`);
        } catch (error) {
            console.error(`[DASHBOARD] Error cleaning up viewer for ${agentName}:`, error.message);
        }
    }
}

module.exports = {
    initDashboard,
    startDashboard,
    cleanupViewer,
    emitAgentJoined,
    emitAgentLeft,
    emitAgentUpdate,
    emitServerEvent,
    setSpawnCallback
};
