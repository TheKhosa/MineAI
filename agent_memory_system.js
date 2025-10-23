/**
 * Agent Memory System - SQLite-powered episodic memory
 * Stores significant events, emotional context, and social interactions
 * Inspired by The Sims and Dwarf Fortress memory systems
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class AgentMemorySystem {
    constructor(dbPath = 'agent_memories.sqlite') {
        this.dbPath = path.join(__dirname, dbPath);
        this.db = null;
        this.initialized = false;
    }

    /**
     * Initialize SQLite database and create tables
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('[MEMORY] Failed to open SQLite:', err);
                    reject(err);
                    return;
                }

                // Enable foreign keys and WAL mode for better concurrency
                this.db.serialize(() => {
                    this.db.run('PRAGMA foreign_keys = ON');
                    this.db.run('PRAGMA journal_mode = WAL');

                    // Create tables for different memory types
                    const createTables = `
                        -- Episodic Memories: Significant events
                        CREATE TABLE IF NOT EXISTS episodic_memories (
                            memory_id INTEGER PRIMARY KEY AUTOINCREMENT,
                            agent_uuid TEXT NOT NULL,
                            agent_name TEXT NOT NULL,
                            generation INTEGER NOT NULL,
                            timestamp DATETIME DEFAULT (datetime('now')),
                            event_type TEXT NOT NULL,
                            event_subtype TEXT NOT NULL,
                            location_x REAL,
                            location_y REAL,
                            location_z REAL,
                            emotional_valence REAL,
                            emotional_arousal REAL,
                            importance REAL,
                            context TEXT,
                            memory_strength REAL DEFAULT 1.0
                        );

                        -- Social Relationships: Bonds between agents
                        CREATE TABLE IF NOT EXISTS social_relationships (
                            relationship_id INTEGER PRIMARY KEY AUTOINCREMENT,
                            agent_uuid TEXT NOT NULL,
                            other_agent_uuid TEXT NOT NULL,
                            other_agent_name TEXT NOT NULL,
                            relationship_type TEXT,
                            bond_strength REAL,
                            trust_level REAL,
                            cooperation_count INTEGER DEFAULT 0,
                            conflict_count INTEGER DEFAULT 0,
                            last_interaction DATETIME,
                            first_met DATETIME,
                            shared_experiences TEXT,
                            UNIQUE(agent_uuid, other_agent_uuid)
                        );

                        -- Emotional States History: Track mood changes
                        CREATE TABLE IF NOT EXISTS emotional_history (
                            record_id INTEGER PRIMARY KEY AUTOINCREMENT,
                            agent_uuid TEXT NOT NULL,
                            timestamp DATETIME DEFAULT (datetime('now')),
                            happiness REAL,
                            stress REAL,
                            boredom REAL,
                            motivation REAL,
                            loneliness REAL,
                            confidence REAL,
                            curiosity REAL,
                            fear REAL,
                            trigger_event TEXT,
                            needs_snapshot TEXT
                        );

                        -- Location Memories: Remember places with emotional context
                        CREATE TABLE IF NOT EXISTS location_memories (
                            location_id INTEGER PRIMARY KEY AUTOINCREMENT,
                            agent_uuid TEXT NOT NULL,
                            chunk_x INTEGER NOT NULL,
                            chunk_z INTEGER NOT NULL,
                            location_type TEXT,
                            emotional_valence REAL,
                            visit_count INTEGER DEFAULT 1,
                            last_visited DATETIME,
                            first_visited DATETIME,
                            significant_events TEXT,
                            UNIQUE(agent_uuid, chunk_x, chunk_z)
                        );

                        -- Achievement Progress: Persistent goal tracking
                        CREATE TABLE IF NOT EXISTS achievement_progress (
                            agent_uuid TEXT PRIMARY KEY,
                            agent_name TEXT,
                            generation INTEGER,
                            first_diamond_time DATETIME,
                            first_iron_armor_time DATETIME,
                            first_enchanting_table_time DATETIME,
                            first_nether_portal_time DATETIME,
                            first_boss_attempt_time DATETIME,
                            first_dragon_kill_time DATETIME,
                            diamonds_found INTEGER DEFAULT 0,
                            mobs_killed INTEGER DEFAULT 0,
                            blocks_placed INTEGER DEFAULT 0,
                            chunks_explored INTEGER DEFAULT 0,
                            cooperation_events INTEGER DEFAULT 0,
                            deaths INTEGER DEFAULT 0,
                            agents_met INTEGER DEFAULT 0,
                            friendships_formed INTEGER DEFAULT 0,
                            total_playtime_seconds INTEGER DEFAULT 0,
                            furthest_x INTEGER DEFAULT 0,
                            furthest_z INTEGER DEFAULT 0,
                            deepest_y INTEGER DEFAULT 64
                        );

                        -- Preference Discussions: Track conversations about likes/dislikes
                        CREATE TABLE IF NOT EXISTS preference_discussions (
                            discussion_id INTEGER PRIMARY KEY AUTOINCREMENT,
                            agent_uuid TEXT NOT NULL,
                            other_agent_uuid TEXT NOT NULL,
                            timestamp DATETIME DEFAULT (datetime('now')),
                            topic_category TEXT NOT NULL,
                            topic_item TEXT NOT NULL,
                            agent_sentiment TEXT NOT NULL,
                            other_sentiment TEXT,
                            compatibility_impact REAL,
                            conversation_text TEXT
                        );

                        -- Personality Snapshots: Store agent personalities for lineage tracking
                        CREATE TABLE IF NOT EXISTS personality_snapshots (
                            snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
                            agent_uuid TEXT NOT NULL,
                            agent_name TEXT NOT NULL,
                            generation INTEGER NOT NULL,
                            timestamp DATETIME DEFAULT (datetime('now')),
                            personality_json TEXT NOT NULL,
                            parent_uuid TEXT,
                            mutation_rate REAL
                        );

                        -- Chat History: Store all agent conversations with full context
                        CREATE TABLE IF NOT EXISTS chat_history (
                            chat_id INTEGER PRIMARY KEY AUTOINCREMENT,
                            timestamp DATETIME DEFAULT (datetime('now')),
                            speaker_uuid TEXT NOT NULL,
                            speaker_name TEXT NOT NULL,
                            listener_uuid TEXT,
                            listener_name TEXT,
                            message TEXT NOT NULL,
                            message_type TEXT DEFAULT 'chat',
                            emotion TEXT,
                            current_action TEXT,
                            location_x REAL,
                            location_y REAL,
                            location_z REAL,
                            health REAL,
                            food REAL,
                            distance_to_listener REAL,
                            context_snapshot_id INTEGER,
                            prompt_id INTEGER,
                            model_backend TEXT,
                            response_time_ms INTEGER,
                            FOREIGN KEY (context_snapshot_id) REFERENCES context_snapshots(snapshot_id),
                            FOREIGN KEY (prompt_id) REFERENCES prompt_library(prompt_id)
                        );

                        -- Prompt Library: Dynamic prompts with action/emotion context
                        CREATE TABLE IF NOT EXISTS prompt_library (
                            prompt_id INTEGER PRIMARY KEY AUTOINCREMENT,
                            prompt_name TEXT NOT NULL UNIQUE,
                            prompt_category TEXT NOT NULL,
                            prompt_template TEXT NOT NULL,
                            description TEXT,
                            requires_sensor_data BOOLEAN DEFAULT 0,
                            requires_action_context BOOLEAN DEFAULT 0,
                            requires_emotion_context BOOLEAN DEFAULT 0,
                            requires_social_context BOOLEAN DEFAULT 0,
                            requires_inventory BOOLEAN DEFAULT 0,
                            requires_nearby_entities BOOLEAN DEFAULT 0,
                            requires_nearby_blocks BOOLEAN DEFAULT 0,
                            usage_count INTEGER DEFAULT 0,
                            avg_response_quality REAL,
                            created_at DATETIME DEFAULT (datetime('now')),
                            updated_at DATETIME DEFAULT (datetime('now'))
                        );

                        -- Context Snapshots: Full game state at moment of conversation
                        CREATE TABLE IF NOT EXISTS context_snapshots (
                            snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
                            agent_uuid TEXT NOT NULL,
                            agent_name TEXT NOT NULL,
                            timestamp DATETIME DEFAULT (datetime('now')),
                            position_x REAL,
                            position_y REAL,
                            position_z REAL,
                            biome TEXT,
                            dimension TEXT,
                            time_of_day TEXT,
                            weather TEXT,
                            health REAL,
                            food REAL,
                            xp_level INTEGER,
                            current_action TEXT,
                            current_goal TEXT,
                            current_emotion TEXT,
                            inventory_json TEXT,
                            nearby_entities_json TEXT,
                            nearby_blocks_json TEXT,
                            visible_blocks_count INTEGER,
                            nearby_agents_json TEXT,
                            sensor_data_json TEXT,
                            moodles_json TEXT,
                            skills_json TEXT,
                            recent_actions_json TEXT,
                            personality_traits_json TEXT,
                            relationship_context_json TEXT
                        );

                        -- Create indexes for performance
                        CREATE INDEX IF NOT EXISTS idx_episodic_agent ON episodic_memories(agent_uuid);
                        CREATE INDEX IF NOT EXISTS idx_episodic_type ON episodic_memories(event_type);
                        CREATE INDEX IF NOT EXISTS idx_episodic_importance ON episodic_memories(importance);
                        CREATE INDEX IF NOT EXISTS idx_social_agent ON social_relationships(agent_uuid);
                        CREATE INDEX IF NOT EXISTS idx_emotional_agent ON emotional_history(agent_uuid);
                        CREATE INDEX IF NOT EXISTS idx_location_agent ON location_memories(agent_uuid);
                        CREATE INDEX IF NOT EXISTS idx_preference_agent ON preference_discussions(agent_uuid);
                        CREATE INDEX IF NOT EXISTS idx_preference_topic ON preference_discussions(topic_category);
                        CREATE INDEX IF NOT EXISTS idx_personality_agent ON personality_snapshots(agent_uuid);
                        CREATE INDEX IF NOT EXISTS idx_chat_speaker ON chat_history(speaker_uuid);
                        CREATE INDEX IF NOT EXISTS idx_chat_listener ON chat_history(listener_uuid);
                        CREATE INDEX IF NOT EXISTS idx_chat_timestamp ON chat_history(timestamp);
                        CREATE INDEX IF NOT EXISTS idx_chat_context ON chat_history(context_snapshot_id);
                        CREATE INDEX IF NOT EXISTS idx_prompt_category ON prompt_library(prompt_category);
                        CREATE INDEX IF NOT EXISTS idx_prompt_name ON prompt_library(prompt_name);
                        CREATE INDEX IF NOT EXISTS idx_context_agent ON context_snapshots(agent_uuid);
                        CREATE INDEX IF NOT EXISTS idx_context_timestamp ON context_snapshots(timestamp);
                    `;

                    this.db.exec(createTables, (err) => {
                        if (err) {
                            console.error('[MEMORY] Failed to create tables:', err);
                            reject(err);
                            return;
                        }

                        console.log('[MEMORY] SQLite memory system initialized');
                        console.log('[MEMORY] Database:', this.dbPath);
                        this.initialized = true;
                        resolve();
                    });
                });
            });
        });
    }

    /**
     * Store a significant event in episodic memory
     */
    async storeMemory(agentUUID, agentName, generation, eventType, eventSubtype, location, emotional, context = {}) {
        if (!this.initialized) await this.initialize();

        // Validate required parameters
        if (!agentUUID || !agentName || generation === undefined || !eventType || !eventSubtype || !location) {
            return Promise.resolve();
        }

        const { valence = 0, arousal = 0.5, importance = 0.5 } = emotional || {};

        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO episodic_memories (
                    agent_uuid, agent_name, generation, event_type, event_subtype,
                    location_x, location_y, location_z,
                    emotional_valence, emotional_arousal, importance, context
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(query, [
                agentUUID,
                agentName,
                generation,
                eventType,
                eventSubtype,
                location.x ?? 0,
                location.y ?? 64,
                location.z ?? 0,
                valence,
                arousal,
                importance,
                JSON.stringify(context)
            ], (err) => {
                if (err) {
                    console.error('[MEMORY] Failed to store memory:', err.message);
                    resolve(); // Resolve anyway to prevent blocking
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Update or create social relationship
     */
    async updateRelationship(agentUUID, otherAgentUUID, otherAgentName, interaction) {
        if (!this.initialized) await this.initialize();

        // Validate required parameters
        if (!agentUUID || !otherAgentUUID || !otherAgentName || !interaction) {
            return Promise.resolve();
        }

        const { type = 'neutral', bondChange = 0, trustChange = 0, wasCooperation = false, wasConflict = false } = interaction;

        return new Promise((resolve, reject) => {
            // SQLite upsert syntax
            const query = `
                INSERT INTO social_relationships (
                    agent_uuid, other_agent_uuid, other_agent_name, relationship_type,
                    bond_strength, trust_level, cooperation_count, conflict_count,
                    last_interaction, first_met
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                ON CONFLICT(agent_uuid, other_agent_uuid) DO UPDATE SET
                    bond_strength = MIN(1.0, MAX(-1.0, bond_strength + ?)),
                    trust_level = MIN(1.0, MAX(0.0, trust_level + ?)),
                    cooperation_count = cooperation_count + ?,
                    conflict_count = conflict_count + ?,
                    last_interaction = datetime('now'),
                    relationship_type = ?
            `;

            this.db.run(query, [
                agentUUID, otherAgentUUID, otherAgentName, type,
                bondChange, trustChange, wasCooperation ? 1 : 0, wasConflict ? 1 : 0,
                bondChange, trustChange, wasCooperation ? 1 : 0, wasConflict ? 1 : 0, type
            ], (err) => {
                if (err) {
                    console.error('[MEMORY] Failed to update relationship:', err.message);
                    resolve(); // Resolve anyway
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Get a relationship between two agents
     */
    async getRelationship(agentUUID, otherAgentUUID) {
        if (!this.initialized) await this.initialize();

        if (!agentUUID || !otherAgentUUID) {
            return Promise.resolve(null);
        }

        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM social_relationships
                WHERE agent_uuid = ? AND other_agent_uuid = ?
                LIMIT 1
            `;

            this.db.get(query, [agentUUID, otherAgentUUID], (err, row) => {
                if (err) {
                    console.error('[MEMORY] Failed to retrieve relationship:', err.message);
                    resolve(null);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Record emotional state snapshot
     */
    async recordEmotionalState(agentUUID, emotions, trigger = '') {
        if (!this.initialized) await this.initialize();

        // Validate required parameters
        if (!agentUUID || !emotions) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO emotional_history (
                    agent_uuid, happiness, stress, boredom, motivation,
                    loneliness, confidence, curiosity, fear, trigger_event
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(query, [
                agentUUID,
                emotions.happiness ?? 0.5,
                emotions.stress ?? 0.5,
                emotions.boredom ?? 0.5,
                emotions.motivation ?? 0.5,
                emotions.loneliness ?? 0.5,
                emotions.confidence ?? 0.5,
                emotions.curiosity ?? 0.5,
                emotions.fear ?? 0.5,
                trigger ?? ''
            ], (err) => {
                if (err) {
                    console.error('[MEMORY] Failed to record emotional state:', err.message);
                    resolve(); // Resolve anyway
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Update location memory (for place attachment)
     */
    async updateLocationMemory(agentUUID, chunkX, chunkZ, locationType, emotionalValence) {
        if (!this.initialized) await this.initialize();

        // Validate required parameters
        if (!agentUUID || chunkX === undefined || chunkZ === undefined || !locationType || emotionalValence === undefined) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO location_memories (
                    agent_uuid, chunk_x, chunk_z, location_type, emotional_valence,
                    visit_count, last_visited, first_visited
                ) VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
                ON CONFLICT(agent_uuid, chunk_x, chunk_z) DO UPDATE SET
                    visit_count = visit_count + 1,
                    emotional_valence = (emotional_valence * 0.9 + ? * 0.1),
                    location_type = ?,
                    last_visited = datetime('now')
            `;

            this.db.run(query, [
                agentUUID, chunkX, chunkZ, locationType, emotionalValence,
                emotionalValence, locationType
            ], (err) => {
                if (err) {
                    console.error('[MEMORY] Failed to update location memory:', err.message);
                    resolve(); // Resolve anyway
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Get recent memories for an agent (for encoding into state)
     */
    async getRecentMemories(agentUUID, limit = 10) {
        if (!this.initialized) await this.initialize();

        // Validate required parameters
        if (!agentUUID) {
            return Promise.resolve([]);
        }

        return new Promise((resolve, reject) => {
            const query = `
                SELECT event_type, event_subtype, emotional_valence, emotional_arousal, importance, memory_strength
                FROM episodic_memories
                WHERE agent_uuid = ? AND memory_strength > 0.1
                ORDER BY importance DESC, timestamp DESC
                LIMIT ?
            `;

            this.db.all(query, [agentUUID, limit ?? 10], (err, rows) => {
                if (err) {
                    console.error('[MEMORY] Failed to retrieve memories:', err.message);
                    resolve([]); // Return empty array on error
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    /**
     * Get social relationships for an agent
     */
    async getRelationships(agentUUID, limit = 5) {
        if (!this.initialized) await this.initialize();

        // Validate required parameters
        if (!agentUUID) {
            return Promise.resolve([]);
        }

        return new Promise((resolve, reject) => {
            const query = `
                SELECT other_agent_uuid, other_agent_name, relationship_type,
                       bond_strength, trust_level, cooperation_count
                FROM social_relationships
                WHERE agent_uuid = ?
                ORDER BY bond_strength DESC, trust_level DESC
                LIMIT ?
            `;

            this.db.all(query, [agentUUID, limit ?? 5], (err, rows) => {
                if (err) {
                    console.error('[MEMORY] Failed to retrieve relationships:', err.message);
                    resolve([]); // Return empty array on error
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    /**
     * Update achievement progress
     */
    async updateAchievement(agentUUID, agentName, generation, achievement, value) {
        if (!this.initialized) await this.initialize();

        // Validate required parameters
        if (!agentUUID || !agentName || generation === undefined || !achievement || value === undefined) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            // First, ensure record exists
            const upsertQuery = `
                INSERT INTO achievement_progress (agent_uuid, agent_name, generation)
                VALUES (?, ?, ?)
                ON CONFLICT(agent_uuid) DO UPDATE SET generation = ?
            `;

            this.db.run(upsertQuery, [agentUUID, agentName, generation, generation], (err) => {
                if (err) {
                    console.error('[MEMORY] Failed to upsert achievement record:', err.message);
                    resolve(); // Resolve anyway
                    return;
                }

                // Then update specific achievement
                const updateQuery = `UPDATE achievement_progress SET ${achievement} = ? WHERE agent_uuid = ?`;

                this.db.run(updateQuery, [value, agentUUID], (err) => {
                    if (err) {
                        console.error('[MEMORY] Failed to update achievement:', err.message);
                        resolve(); // Resolve anyway
                    } else {
                        resolve();
                    }
                });
            });
        });
    }

    /**
     * Decay old memories (called periodically)
     */
    async decayMemories(decayRate = 0.01) {
        if (!this.initialized) await this.initialize();

        return new Promise((resolve, reject) => {
            const query = `
                UPDATE episodic_memories
                SET memory_strength = memory_strength * (1 - ? * (1 - importance))
                WHERE memory_strength > 0.01
            `;

            this.db.run(query, [decayRate], (err) => {
                if (err) {
                    console.error('[MEMORY] Failed to decay memories:', err.message);
                    resolve(); // Resolve anyway
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Store a preference discussion between two agents
     */
    async storePreferenceDiscussion(agentUUID, otherAgentUUID, topic, agentSentiment, otherSentiment, compatibilityImpact, conversationText = '') {
        if (!this.initialized) await this.initialize();

        if (!agentUUID || !otherAgentUUID || !topic || !agentSentiment) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO preference_discussions (
                    agent_uuid, other_agent_uuid, topic_category, topic_item,
                    agent_sentiment, other_sentiment, compatibility_impact, conversation_text
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(query, [
                agentUUID,
                otherAgentUUID,
                topic.category || 'general',
                topic.item || 'unknown',
                agentSentiment,
                otherSentiment || 'unknown',
                compatibilityImpact ?? 0,
                conversationText
            ], (err) => {
                if (err) {
                    console.error('[MEMORY] Failed to store preference discussion:', err.message);
                    resolve();
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Get recent preference discussions for compatibility analysis
     */
    async getPreferenceDiscussions(agentUUID, otherAgentUUID = null, limit = 10) {
        if (!this.initialized) await this.initialize();

        if (!agentUUID) {
            return Promise.resolve([]);
        }

        return new Promise((resolve, reject) => {
            let query, params;

            if (otherAgentUUID) {
                // Get discussions between specific agents
                query = `
                    SELECT * FROM preference_discussions
                    WHERE (agent_uuid = ? AND other_agent_uuid = ?)
                       OR (agent_uuid = ? AND other_agent_uuid = ?)
                    ORDER BY timestamp DESC
                    LIMIT ?
                `;
                params = [agentUUID, otherAgentUUID, otherAgentUUID, agentUUID, limit];
            } else {
                // Get all discussions for this agent
                query = `
                    SELECT * FROM preference_discussions
                    WHERE agent_uuid = ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                `;
                params = [agentUUID, limit];
            }

            this.db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[MEMORY] Failed to retrieve preference discussions:', err.message);
                    resolve([]);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    /**
     * Save personality snapshot (for genetic lineage tracking)
     */
    async savePersonalitySnapshot(agentUUID, agentName, generation, personality, parentUUID = null, mutationRate = 0) {
        if (!this.initialized) await this.initialize();

        if (!agentUUID || !agentName || !personality) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO personality_snapshots (
                    agent_uuid, agent_name, generation, personality_json, parent_uuid, mutation_rate
                ) VALUES (?, ?, ?, ?, ?, ?)
            `;

            this.db.run(query, [
                agentUUID,
                agentName,
                generation,
                JSON.stringify(personality),
                parentUUID,
                mutationRate
            ], (err) => {
                if (err) {
                    console.error('[MEMORY] Failed to save personality snapshot:', err.message);
                    resolve();
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Get personality snapshot for an agent
     */
    async getPersonalitySnapshot(agentUUID) {
        if (!this.initialized) await this.initialize();

        if (!agentUUID) {
            return Promise.resolve(null);
        }

        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM personality_snapshots
                WHERE agent_uuid = ?
                ORDER BY timestamp DESC
                LIMIT 1
            `;

            this.db.get(query, [agentUUID], (err, row) => {
                if (err) {
                    console.error('[MEMORY] Failed to retrieve personality snapshot:', err.message);
                    resolve(null);
                } else if (row) {
                    try {
                        row.personality = JSON.parse(row.personality_json);
                        resolve(row);
                    } catch (e) {
                        console.error('[MEMORY] Failed to parse personality JSON:', e.message);
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            });
        });
    }

    /**
     * Update relationship with compatibility modifier
     */
    async updateRelationshipWithCompatibility(agentUUID, otherAgentUUID, otherAgentName, compatibility, interaction) {
        if (!this.initialized) await this.initialize();

        if (!agentUUID || !otherAgentUUID || !otherAgentName || compatibility === undefined) {
            return Promise.resolve();
        }

        // Compatibility affects bond strength
        // High compatibility (>0.5) gives extra bond boost
        // Low compatibility (<-0.2) creates tension
        let bondModifier = interaction.bondChange || 0;

        if (compatibility > 0.5) {
            bondModifier += 0.1; // Extra boost for compatible agents
        } else if (compatibility < -0.2) {
            bondModifier -= 0.05; // Tension for incompatible agents
        }

        const modifiedInteraction = {
            ...interaction,
            bondChange: bondModifier
        };

        return this.updateRelationship(agentUUID, otherAgentUUID, otherAgentName, modifiedInteraction);
    }

    /**
     * Store a context snapshot with full game state
     */
    async storeContextSnapshot(agentData) {
        if (!this.initialized) await this.initialize();

        if (!agentData || !agentData.uuid || !agentData.username) {
            return Promise.resolve(null);
        }

        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO context_snapshots (
                    agent_uuid, agent_name, position_x, position_y, position_z,
                    biome, dimension, time_of_day, weather, health, food, xp_level,
                    current_action, current_goal, current_emotion,
                    inventory_json, nearby_entities_json, nearby_blocks_json,
                    visible_blocks_count, nearby_agents_json, sensor_data_json,
                    moodles_json, skills_json, recent_actions_json,
                    personality_traits_json, relationship_context_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const pos = agentData.position || agentData.bot?.entity?.position || {};

            this.db.run(query, [
                agentData.uuid,
                agentData.username,
                pos.x || 0,
                pos.y || 64,
                pos.z || 0,
                agentData.biome || 'unknown',
                agentData.dimension || 'overworld',
                agentData.timeOfDay || 'day',
                agentData.weather || 'clear',
                agentData.health || 20,
                agentData.food || 20,
                agentData.xpLevel || 0,
                agentData.currentAction || 'idle',
                agentData.currentGoal || 'explore',
                agentData.currentEmotion || 'neutral',
                JSON.stringify(agentData.inventory || []),
                JSON.stringify(agentData.nearbyEntities || []),
                JSON.stringify(agentData.nearbyBlocks || []),
                agentData.visibleBlocksCount || 0,
                JSON.stringify(agentData.nearbyAgents || []),
                JSON.stringify(agentData.sensorData || {}),
                JSON.stringify(agentData.moodles || []),
                JSON.stringify(agentData.skills || {}),
                JSON.stringify(agentData.recentActions || []),
                JSON.stringify(agentData.personalityTraits || []),
                JSON.stringify(agentData.relationshipContext || {})
            ], function(err) {
                if (err) {
                    console.error('[MEMORY] Failed to store context snapshot:', err.message);
                    resolve(null);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    /**
     * Store a chat message with context
     */
    async storeChatMessage(messageData) {
        if (!this.initialized) await this.initialize();

        if (!messageData || !messageData.speakerUUID || !messageData.message) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO chat_history (
                    speaker_uuid, speaker_name, listener_uuid, listener_name,
                    message, message_type, emotion, current_action,
                    location_x, location_y, location_z, health, food,
                    distance_to_listener, context_snapshot_id, prompt_id,
                    model_backend, response_time_ms
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(query, [
                messageData.speakerUUID,
                messageData.speakerName || 'Unknown',
                messageData.listenerUUID || null,
                messageData.listenerName || null,
                messageData.message,
                messageData.messageType || 'chat',
                messageData.emotion || 'neutral',
                messageData.currentAction || 'idle',
                messageData.locationX || 0,
                messageData.locationY || 64,
                messageData.locationZ || 0,
                messageData.health || 20,
                messageData.food || 20,
                messageData.distanceToListener || null,
                messageData.contextSnapshotId || null,
                messageData.promptId || null,
                messageData.modelBackend || 'unknown',
                messageData.responseTimeMs || 0
            ], (err) => {
                if (err) {
                    console.error('[MEMORY] Failed to store chat message:', err.message);
                    resolve();
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Get recent chat history between two agents
     */
    async getChatHistory(agentUUID, otherAgentUUID = null, limit = 20) {
        if (!this.initialized) await this.initialize();

        if (!agentUUID) {
            return Promise.resolve([]);
        }

        return new Promise((resolve, reject) => {
            let query, params;

            if (otherAgentUUID) {
                // Get conversation between two specific agents
                query = `
                    SELECT * FROM chat_history
                    WHERE (speaker_uuid = ? AND listener_uuid = ?)
                       OR (speaker_uuid = ? AND listener_uuid = ?)
                    ORDER BY timestamp DESC
                    LIMIT ?
                `;
                params = [agentUUID, otherAgentUUID, otherAgentUUID, agentUUID, limit];
            } else {
                // Get all messages involving this agent
                query = `
                    SELECT * FROM chat_history
                    WHERE speaker_uuid = ? OR listener_uuid = ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                `;
                params = [agentUUID, agentUUID, limit];
            }

            this.db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[MEMORY] Failed to retrieve chat history:', err.message);
                    resolve([]);
                } else {
                    resolve((rows || []).reverse()); // Reverse to get chronological order
                }
            });
        });
    }

    /**
     * Add or update a prompt in the library
     */
    async upsertPrompt(promptData) {
        if (!this.initialized) await this.initialize();

        if (!promptData || !promptData.name || !promptData.template) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO prompt_library (
                    prompt_name, prompt_category, prompt_template, description,
                    requires_sensor_data, requires_action_context, requires_emotion_context,
                    requires_social_context, requires_inventory, requires_nearby_entities,
                    requires_nearby_blocks
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(prompt_name) DO UPDATE SET
                    prompt_category = excluded.prompt_category,
                    prompt_template = excluded.prompt_template,
                    description = excluded.description,
                    requires_sensor_data = excluded.requires_sensor_data,
                    requires_action_context = excluded.requires_action_context,
                    requires_emotion_context = excluded.requires_emotion_context,
                    requires_social_context = excluded.requires_social_context,
                    requires_inventory = excluded.requires_inventory,
                    requires_nearby_entities = excluded.requires_nearby_entities,
                    requires_nearby_blocks = excluded.requires_nearby_blocks,
                    updated_at = datetime('now')
            `;

            this.db.run(query, [
                promptData.name,
                promptData.category || 'general',
                promptData.template,
                promptData.description || '',
                promptData.requiresSensorData ? 1 : 0,
                promptData.requiresActionContext ? 1 : 0,
                promptData.requiresEmotionContext ? 1 : 0,
                promptData.requiresSocialContext ? 1 : 0,
                promptData.requiresInventory ? 1 : 0,
                promptData.requiresNearbyEntities ? 1 : 0,
                promptData.requiresNearbyBlocks ? 1 : 0
            ], (err) => {
                if (err) {
                    console.error('[MEMORY] Failed to upsert prompt:', err.message);
                    resolve();
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Get a prompt by name
     */
    async getPrompt(promptName) {
        if (!this.initialized) await this.initialize();

        if (!promptName) {
            return Promise.resolve(null);
        }

        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM prompt_library WHERE prompt_name = ?`;

            this.db.get(query, [promptName], (err, row) => {
                if (err) {
                    console.error('[MEMORY] Failed to retrieve prompt:', err.message);
                    resolve(null);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Get prompts by category
     */
    async getPromptsByCategory(category, limit = 10) {
        if (!this.initialized) await this.initialize();

        if (!category) {
            return Promise.resolve([]);
        }

        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM prompt_library
                WHERE prompt_category = ?
                ORDER BY usage_count DESC
                LIMIT ?
            `;

            this.db.all(query, [category, limit], (err, rows) => {
                if (err) {
                    console.error('[MEMORY] Failed to retrieve prompts by category:', err.message);
                    resolve([]);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    /**
     * Increment prompt usage count
     */
    async incrementPromptUsage(promptName) {
        if (!this.initialized) await this.initialize();

        if (!promptName) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const query = `
                UPDATE prompt_library
                SET usage_count = usage_count + 1
                WHERE prompt_name = ?
            `;

            this.db.run(query, [promptName], (err) => {
                if (err) {
                    console.error('[MEMORY] Failed to increment prompt usage:', err.message);
                }
                resolve();
            });
        });
    }

    /**
     * Get memory statistics for dashboard
     */
    async getStats() {
        if (!this.initialized) await this.initialize();

        return new Promise((resolve, reject) => {
            const stats = {};

            // Execute queries sequentially
            this.db.get('SELECT COUNT(*) as total_memories FROM episodic_memories', (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                Object.assign(stats, row);

                this.db.get('SELECT COUNT(*) as total_relationships FROM social_relationships', (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    Object.assign(stats, row);

                    this.db.get('SELECT COUNT(DISTINCT agent_uuid) as unique_agents FROM episodic_memories', (err, row) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        Object.assign(stats, row);

                        this.db.all('SELECT event_type, COUNT(*) as count FROM episodic_memories GROUP BY event_type', (err, rows) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            stats.event_types = rows;
                            resolve(stats);
                        });
                    });
                });
            });
        });
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('[MEMORY] Error closing database:', err.message);
                } else {
                    console.log('[MEMORY] Database closed');
                }
            });
        }
    }
}

// Singleton instance
let memorySystemInstance = null;

function getMemorySystem() {
    if (!memorySystemInstance) {
        memorySystemInstance = new AgentMemorySystem();
    }
    return memorySystemInstance;
}

module.exports = { AgentMemorySystem, getMemorySystem };
