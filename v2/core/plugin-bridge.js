/**
 * Plugin Bridge
 * WebSocket server for communicating with the Spigot AgentSensorPlugin
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

class PluginBridge extends EventEmitter {
    constructor(config) {
        super();

        this.config = config;
        this.server = null;
        this.connection = null;
        this.isAuthenticated = false;

        // Statistics
        this.stats = {
            messagesReceived: 0,
            messagesSent: 0,
            sensorUpdates: 0,
            lastUpdateTime: null,
            connectionTime: null,
            reconnections: 0
        };

        // Heartbeat
        this.heartbeatTimer = null;
    }

    /**
     * Start WebSocket server
     */
    start() {
        this.server = new WebSocket.Server({
            port: this.config.hub.port
        });

        console.log(`[PLUGIN BRIDGE] WebSocket server listening on port ${this.config.hub.port}`);

        this.server.on('connection', (ws) => this.handleConnection(ws));
        this.server.on('error', (error) => this.handleServerError(error));
    }

    /**
     * Handle new plugin connection
     */
    handleConnection(ws) {
        console.log('[PLUGIN BRIDGE] Plugin attempting to connect...');

        // Only allow one plugin connection
        if (this.connection && this.connection.readyState === WebSocket.OPEN) {
            console.warn('[PLUGIN BRIDGE] Rejecting connection - plugin already connected');
            ws.close(1008, 'Already connected');
            return;
        }

        this.connection = ws;
        this.stats.connectionTime = Date.now();

        if (this.isAuthenticated) {
            this.stats.reconnections++;
        }

        // Set up event handlers
        ws.on('message', (data) => this.handleMessage(data));
        ws.on('close', (code, reason) => this.handleDisconnect(code, reason));
        ws.on('error', (error) => this.handleError(error));

        // Request authentication
        this.sendMessage({
            type: 'auth_required',
            timestamp: Date.now()
        });

        // Start heartbeat
        this.startHeartbeat();

        this.emit('connection');
    }

    /**
     * Handle incoming messages from plugin
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            this.stats.messagesReceived++;

            switch (message.type) {
                case 'auth_request':
                    this.handleAuth(message);
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

                case 'agent_death':
                    this.handleAgentDeath(message);
                    break;

                case 'spawn_confirm':
                    this.handleSpawnConfirm(message);
                    break;

                case 'heartbeat_response':
                    // Plugin acknowledged heartbeat
                    break;

                default:
                    console.warn('[PLUGIN BRIDGE] Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('[PLUGIN BRIDGE] Error parsing message:', error.message);
        }
    }

    /**
     * Handle authentication
     */
    handleAuth(message) {
        const { token, serverInfo } = message;

        if (token === this.config.hub.authToken) {
            this.isAuthenticated = true;
            console.log('[PLUGIN BRIDGE] Plugin authenticated successfully');
            console.log('[PLUGIN BRIDGE] Server info:', serverInfo);

            this.sendMessage({
                type: 'auth_success',
                timestamp: Date.now(),
                hubVersion: '2.0.0'
            });

            this.emit('authenticated', serverInfo);
        } else {
            console.error('[PLUGIN BRIDGE] Authentication failed - invalid token');

            this.sendMessage({
                type: 'auth_failed',
                reason: 'Invalid token',
                timestamp: Date.now()
            });

            this.connection.close(1008, 'Authentication failed');
        }
    }

    /**
     * Handle sensor data update
     */
    handleSensorUpdate(message) {
        if (!this.isAuthenticated) {
            console.warn('[PLUGIN BRIDGE] Sensor update before authentication');
            return;
        }

        const { agentName, timestamp, tick, data } = message;

        this.stats.sensorUpdates++;
        this.stats.lastUpdateTime = Date.now();

        // Emit to hub for processing
        this.emit('sensor_update', {
            agentName,
            timestamp,
            tick,
            data
        });
    }

    /**
     * Handle server tick event
     */
    handleServerTick(message) {
        const { tick, timestamp, tps, onlinePlayers, loadedChunks } = message;

        this.emit('server_tick', {
            tick,
            timestamp,
            tps,
            onlinePlayers,
            loadedChunks
        });
    }

    /**
     * Handle checkpoint event
     */
    handleCheckpoint(message) {
        const { tick, timestamp, ticksSinceLastCheckpoint } = message;

        console.log(`[PLUGIN BRIDGE] Checkpoint at tick ${tick}`);

        this.emit('checkpoint', {
            tick,
            timestamp,
            ticksSinceLastCheckpoint
        });
    }

    /**
     * Handle evolution event
     */
    handleEvolution(message) {
        const { tick, timestamp, ticksSinceLastEvolution } = message;

        console.log(`[PLUGIN BRIDGE] Evolution at tick ${tick}`);

        this.emit('evolution', {
            tick,
            timestamp,
            ticksSinceLastEvolution
        });
    }

    /**
     * Handle agent death
     */
    handleAgentDeath(message) {
        const { agentName, timestamp, cause, killer, location } = message;

        console.log(`[PLUGIN BRIDGE] ${agentName} died - ${cause}`);

        this.emit('agent_death', {
            agentName,
            timestamp,
            cause,
            killer,
            location
        });
    }

    /**
     * Handle spawn confirmation
     */
    handleSpawnConfirm(message) {
        const { agentName, timestamp, entityUUID, location } = message;

        console.log(`[PLUGIN BRIDGE] ${agentName} spawned at (${location.x}, ${location.y}, ${location.z})`);

        this.emit('spawn_confirm', {
            agentName,
            timestamp,
            entityUUID,
            location
        });
    }

    /**
     * Send action command to plugin
     */
    sendAction(agentName, action) {
        if (!this.isAuthenticated || !this.connection) {
            console.warn(`[PLUGIN BRIDGE] Cannot send action for ${agentName} - not connected`);
            return false;
        }

        this.sendMessage({
            type: 'action',
            agentName,
            timestamp: Date.now(),
            action
        });

        return true;
    }

    /**
     * Request plugin to spawn an agent
     */
    spawnAgent(agentName, agentType, location, skin = null) {
        if (!this.isAuthenticated || !this.connection) {
            console.warn(`[PLUGIN BRIDGE] Cannot spawn ${agentName} - not connected`);
            return false;
        }

        this.sendMessage({
            type: 'spawn_agent',
            agentName,
            agentType,
            location,
            skin
        });

        console.log(`[PLUGIN BRIDGE] Requested spawn for ${agentName} (${agentType})`);
        return true;
    }

    /**
     * Request plugin to remove an agent
     */
    removeAgent(agentName, reason = 'removed') {
        if (!this.isAuthenticated || !this.connection) {
            return false;
        }

        this.sendMessage({
            type: 'remove_agent',
            agentName,
            reason,
            timestamp: Date.now()
        });

        console.log(`[PLUGIN BRIDGE] Requested removal of ${agentName} (${reason})`);
        return true;
    }

    /**
     * Send message to plugin
     */
    sendMessage(message) {
        if (!this.connection || this.connection.readyState !== WebSocket.OPEN) {
            return false;
        }

        try {
            this.connection.send(JSON.stringify(message));
            this.stats.messagesSent++;
            return true;
        } catch (error) {
            console.error('[PLUGIN BRIDGE] Error sending message:', error.message);
            return false;
        }
    }

    /**
     * Start heartbeat timer
     */
    startHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }

        this.heartbeatTimer = setInterval(() => {
            this.sendMessage({
                type: 'heartbeat',
                timestamp: Date.now()
            });
        }, this.config.plugin.heartbeatInterval);
    }

    /**
     * Handle connection disconnect
     */
    handleDisconnect(code, reason) {
        console.warn(`[PLUGIN BRIDGE] Plugin disconnected (${code}): ${reason}`);

        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }

        this.isAuthenticated = false;
        this.emit('disconnect', { code, reason });
    }

    /**
     * Handle connection error
     */
    handleError(error) {
        console.error('[PLUGIN BRIDGE] Connection error:', error.message);
        this.emit('error', error);
    }

    /**
     * Handle server error
     */
    handleServerError(error) {
        console.error('[PLUGIN BRIDGE] Server error:', error.message);
        this.emit('server_error', error);
    }

    /**
     * Get connection stats
     */
    getStats() {
        return {
            ...this.stats,
            isConnected: this.connection && this.connection.readyState === WebSocket.OPEN,
            isAuthenticated: this.isAuthenticated,
            uptime: this.stats.connectionTime ? Date.now() - this.stats.connectionTime : 0
        };
    }

    /**
     * Shutdown bridge
     */
    shutdown() {
        console.log('[PLUGIN BRIDGE] Shutting down...');

        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }

        if (this.connection) {
            this.connection.close(1000, 'Hub shutting down');
        }

        if (this.server) {
            this.server.close();
        }
    }
}

module.exports = PluginBridge;
