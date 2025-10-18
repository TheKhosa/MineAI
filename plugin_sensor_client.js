/**
 * Plugin Sensor Client
 * WebSocket client for receiving real-time sensor data from AgentSensorPlugin
 *
 * Connects to the Spigot plugin's WebSocket server and streams enhanced sensor data
 * to the Node.js agent system for ML state encoding and action selection.
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

class PluginSensorClient extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            host: config.host || 'localhost',
            port: config.port || 3002,
            authToken: config.authToken || 'mineagent-sensor-2024',
            reconnectInterval: config.reconnectInterval || 5000,
            reconnectMaxAttempts: config.reconnectMaxAttempts || 10,
            ...config
        };

        this.ws = null;
        this.isAuthenticated = false;
        this.isRegistered = false;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.botName = null;

        // Sensor data cache (latest data for each bot)
        this.sensorCache = new Map();

        // Statistics
        this.stats = {
            messagesReceived: 0,
            lastUpdateTime: null,
            connectionTime: null,
            disconnectionCount: 0
        };
    }

    /**
     * Connect to the WebSocket server
     */
    connect() {
        const url = `ws://${this.config.host}:${this.config.port}`;
        console.log(`[PluginSensor] Connecting to ${url}...`);

        try {
            this.ws = new WebSocket(url);

            this.ws.on('open', () => this.handleOpen());
            this.ws.on('message', (data) => this.handleMessage(data));
            this.ws.on('close', (code, reason) => this.handleClose(code, reason));
            this.ws.on('error', (error) => this.handleError(error));
        } catch (error) {
            console.error('[PluginSensor] Connection error:', error.message);
            this.scheduleReconnect();
        }
    }

    /**
     * Handle WebSocket open event
     */
    handleOpen() {
        console.log('[PluginSensor] Connected to WebSocket server');
        this.stats.connectionTime = Date.now();
        this.reconnectAttempts = 0;
        this.emit('connected');
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());

            switch (message.type) {
                case 'auth_required':
                    this.authenticate();
                    break;

                case 'auth_success':
                    this.isAuthenticated = true;
                    console.log('[PluginSensor] Authenticated successfully');
                    this.emit('authenticated');
                    break;

                case 'registration_success':
                    this.isRegistered = true;
                    console.log(`[PluginSensor] Bot registered: ${message.botName}`);
                    this.emit('registered', message.botName);
                    break;

                case 'sensor_update':
                    this.handleSensorUpdate(message);
                    break;

                case 'server_tick':
                    this.handleServerTick(message);
                    break;

                case 'checkpoint':
                    this.handleCheckpoint(message);
                    break;

                case 'evolution':
                    this.handleEvolution(message);
                    break;

                case 'server_shutdown':
                    console.warn('[PluginSensor] Server is shutting down:', message.message);
                    this.emit('server_shutdown');
                    break;

                case 'error':
                    console.error('[PluginSensor] Server error:', message.message);
                    this.emit('server_error', message.message);
                    break;

                default:
                    console.warn('[PluginSensor] Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('[PluginSensor] Error processing message:', error.message);
        }
    }

    /**
     * Handle sensor data updates
     */
    handleSensorUpdate(message) {
        const { botName, timestamp, data } = message;

        // Cache the data
        this.sensorCache.set(botName, {
            data,
            timestamp,
            receivedAt: Date.now()
        });

        // Update statistics
        this.stats.messagesReceived++;
        this.stats.lastUpdateTime = Date.now();

        // Emit event for subscribers
        this.emit('sensor_update', {
            botName,
            timestamp,
            data
        });
    }

    /**
     * Handle server tick event
     */
    handleServerTick(message) {
        const { tick, timestamp, tps, onlinePlayers } = message;

        // Emit tick event for ML synchronization
        this.emit('server_tick', {
            tick,
            timestamp,
            tps,
            onlinePlayers
        });
    }

    /**
     * Handle checkpoint event (save models)
     */
    handleCheckpoint(message) {
        const { tick, timestamp, ticksSinceLastCheckpoint } = message;

        console.log(`[PluginSensor] Checkpoint triggered at tick ${tick}`);

        // Emit checkpoint event for ML trainer
        this.emit('checkpoint', {
            tick,
            timestamp,
            ticksSinceLastCheckpoint
        });
    }

    /**
     * Handle evolution event (evolve population)
     */
    handleEvolution(message) {
        const { tick, timestamp, ticksSinceLastEvolution } = message;

        console.log(`[PluginSensor] Evolution triggered at tick ${tick}`);

        // Emit evolution event for ML trainer
        this.emit('evolution', {
            tick,
            timestamp,
            ticksSinceLastEvolution
        });
    }

    /**
     * Handle WebSocket close event
     */
    handleClose(code, reason) {
        console.warn(`[PluginSensor] Connection closed (code: ${code}, reason: ${reason || 'none'})`);
        this.stats.disconnectionCount++;
        this.isAuthenticated = false;
        this.isRegistered = false;

        this.emit('disconnected', { code, reason });

        // Schedule reconnection
        this.scheduleReconnect();
    }

    /**
     * Handle WebSocket error event
     */
    handleError(error) {
        console.error('[PluginSensor] WebSocket error:', error.message);
        this.emit('error', error);
    }

    /**
     * Send authentication message
     */
    authenticate() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('[PluginSensor] Cannot authenticate: WebSocket not open');
            return;
        }

        const authMessage = {
            type: 'auth',
            token: this.config.authToken
        };

        this.ws.send(JSON.stringify(authMessage));
        console.log('[PluginSensor] Sent authentication request');
    }

    /**
     * Register a bot name with the server
     */
    registerBot(botName) {
        if (!this.isAuthenticated) {
            console.error('[PluginSensor] Cannot register bot: Not authenticated');
            return false;
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('[PluginSensor] Cannot register bot: WebSocket not open');
            return false;
        }

        this.botName = botName;

        const registerMessage = {
            type: 'register_bot',
            botName: botName
        };

        this.ws.send(JSON.stringify(registerMessage));
        console.log(`[PluginSensor] Sent bot registration: ${botName}`);
        return true;
    }

    /**
     * Request sensor data (optional - broadcaster sends automatically)
     */
    requestSensors() {
        if (!this.isRegistered) {
            console.error('[PluginSensor] Cannot request sensors: Bot not registered');
            return false;
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('[PluginSensor] Cannot request sensors: WebSocket not open');
            return false;
        }

        const requestMessage = {
            type: 'request_sensors'
        };

        this.ws.send(JSON.stringify(requestMessage));
        return true;
    }

    /**
     * Get cached sensor data for a bot
     */
    getSensorData(botName) {
        const cached = this.sensorCache.get(botName);
        if (!cached) {
            return null;
        }

        // Check if data is stale (> 5 seconds old)
        const age = Date.now() - cached.receivedAt;
        if (age > 5000) {
            console.warn(`[PluginSensor] Cached data for ${botName} is ${age}ms old`);
        }

        return cached.data;
    }

    /**
     * Get all cached sensor data
     */
    getAllSensorData() {
        const result = {};
        for (const [botName, cached] of this.sensorCache.entries()) {
            result[botName] = cached.data;
        }
        return result;
    }

    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        if (this.reconnectTimer) {
            return; // Already scheduled
        }

        if (this.reconnectAttempts >= this.config.reconnectMaxAttempts) {
            console.error('[PluginSensor] Max reconnection attempts reached. Giving up.');
            this.emit('reconnect_failed');
            return;
        }

        this.reconnectAttempts++;
        console.log(`[PluginSensor] Reconnecting in ${this.config.reconnectInterval}ms (attempt ${this.reconnectAttempts}/${this.config.reconnectMaxAttempts})`);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, this.config.reconnectInterval);
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        console.log('[PluginSensor] Disconnecting...');

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }

        this.isAuthenticated = false;
        this.isRegistered = false;
    }

    /**
     * Check if client is connected and authenticated
     */
    isReady() {
        return this.ws &&
               this.ws.readyState === WebSocket.OPEN &&
               this.isAuthenticated &&
               this.isRegistered;
    }

    /**
     * Get client statistics
     */
    getStats() {
        return {
            ...this.stats,
            isConnected: this.ws && this.ws.readyState === WebSocket.OPEN,
            isAuthenticated: this.isAuthenticated,
            isRegistered: this.isRegistered,
            reconnectAttempts: this.reconnectAttempts,
            cachedBots: this.sensorCache.size
        };
    }

    /**
     * Clear sensor cache
     */
    clearCache() {
        this.sensorCache.clear();
        console.log('[PluginSensor] Sensor cache cleared');
    }

    /**
     * Clear stale cache entries (> 10 seconds old)
     */
    clearStaleCache() {
        const now = Date.now();
        let cleared = 0;

        for (const [botName, cached] of this.sensorCache.entries()) {
            if (now - cached.receivedAt > 10000) {
                this.sensorCache.delete(botName);
                cleared++;
            }
        }

        if (cleared > 0) {
            console.log(`[PluginSensor] Cleared ${cleared} stale cache entries`);
        }
    }
}

// Singleton instance
let sensorClientInstance = null;

/**
 * Get or create the plugin sensor client instance
 */
function getPluginSensorClient(config) {
    if (!sensorClientInstance) {
        sensorClientInstance = new PluginSensorClient(config);
    }
    return sensorClientInstance;
}

/**
 * Destroy the sensor client instance
 */
function destroyPluginSensorClient() {
    if (sensorClientInstance) {
        sensorClientInstance.disconnect();
        sensorClientInstance = null;
    }
}

module.exports = {
    PluginSensorClient,
    getPluginSensorClient,
    destroyPluginSensorClient
};
