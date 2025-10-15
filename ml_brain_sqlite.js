/**
 * SQLite Shared Brain - Collective Agent Intelligence
 *
 * All agents share a single SQLite database brain that stores:
 * - Action success rates for different contexts
 * - Skill progressions and unlock conditions
 * - Emergent strategies discovered by any agent
 * - Collective memory of what works and what doesn't
 *
 * Benefits:
 * - No per-agent type models needed
 * - Agents learn from each other's experiences
 * - New agents instantly benefit from collective knowledge
 * - Skills emerge organically based on experience
 * - Faster learning through shared experiences
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SharedBrain {
    constructor(dbPath = './ml_brain.sqlite') {
        this.dbPath = dbPath;
        this.db = null;
        this.initialized = false;
    }

    /**
     * Initialize the shared brain database
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('[SHARED BRAIN] Failed to open database:', err);
                    reject(err);
                    return;
                }

                console.log('[SHARED BRAIN] Database opened:', this.dbPath);
                this.createTables().then(() => {
                    this.initialized = true;
                    console.log('[SHARED BRAIN] Initialized successfully');
                    resolve();
                }).catch(reject);
            });
        });
    }

    /**
     * Create database tables for collective intelligence
     */
    async createTables() {
        const tables = [
            // Action success tracking - what actions work in what contexts
            `CREATE TABLE IF NOT EXISTS action_experience (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                context TEXT NOT NULL,
                success_count INTEGER DEFAULT 0,
                failure_count INTEGER DEFAULT 0,
                total_reward REAL DEFAULT 0.0,
                avg_reward REAL DEFAULT 0.0,
                last_updated INTEGER,
                created_at INTEGER,
                UNIQUE(action, context)
            )`,

            // Skill progression - emergent skills unlocked through experience
            `CREATE TABLE IF NOT EXISTS skills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                skill_name TEXT UNIQUE NOT NULL,
                unlock_condition TEXT,
                times_used INTEGER DEFAULT 0,
                success_rate REAL DEFAULT 0.0,
                avg_reward REAL DEFAULT 0.0,
                unlocked_by TEXT,
                unlocked_at INTEGER,
                description TEXT
            )`,

            // Strategy patterns - sequences of actions that work well together
            `CREATE TABLE IF NOT EXISTS strategies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                strategy_name TEXT UNIQUE NOT NULL,
                action_sequence TEXT NOT NULL,
                context TEXT,
                success_count INTEGER DEFAULT 0,
                total_reward REAL DEFAULT 0.0,
                discovered_by TEXT,
                discovered_at INTEGER,
                description TEXT
            )`,

            // Context patterns - learn what contexts lead to success
            `CREATE TABLE IF NOT EXISTS context_patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pattern_type TEXT NOT NULL,
                pattern_data TEXT NOT NULL,
                positive_outcomes INTEGER DEFAULT 0,
                negative_outcomes INTEGER DEFAULT 0,
                avg_reward REAL DEFAULT 0.0,
                last_seen INTEGER,
                UNIQUE(pattern_type, pattern_data)
            )`,

            // Agent contributions - track what each agent has taught the collective
            `CREATE TABLE IF NOT EXISTS agent_contributions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_name TEXT NOT NULL,
                contribution_type TEXT NOT NULL,
                contribution_data TEXT,
                impact_score REAL DEFAULT 0.0,
                timestamp INTEGER
            )`
        ];

        for (const sql of tables) {
            await this.runQuery(sql);
        }

        console.log('[SHARED BRAIN] Tables created');
    }

    /**
     * Record an action experience
     */
    async recordAction(action, context, success, reward) {
        const sql = `
            INSERT INTO action_experience (action, context, success_count, failure_count, total_reward, avg_reward, last_updated, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(action, context) DO UPDATE SET
                success_count = success_count + ?,
                failure_count = failure_count + ?,
                total_reward = total_reward + ?,
                avg_reward = (total_reward + ?) / (success_count + failure_count + 1),
                last_updated = ?
        `;

        const now = Date.now();
        const successAdd = success ? 1 : 0;
        const failureAdd = success ? 0 : 1;

        await this.runQuery(sql, [
            action, context, successAdd, failureAdd, reward, reward, now, now,
            successAdd, failureAdd, reward, reward, now
        ]);
    }

    /**
     * Get best action for a given context based on collective experience
     */
    async getBestAction(context, availableActions) {
        const placeholders = availableActions.map(() => '?').join(',');
        const sql = `
            SELECT action, avg_reward, (success_count * 1.0 / (success_count + failure_count + 1)) as success_rate
            FROM action_experience
            WHERE context = ? AND action IN (${placeholders})
            ORDER BY avg_reward DESC, success_rate DESC
            LIMIT 5
        `;

        const rows = await this.queryAll(sql, [context, ...availableActions]);

        if (rows.length === 0) {
            // No experience yet, return random action
            return availableActions[Math.floor(Math.random() * availableActions.length)];
        }

        // Use softmax selection weighted by reward
        const weights = rows.map(r => Math.exp(r.avg_reward));
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        const rand = Math.random() * totalWeight;

        let cumWeight = 0;
        for (let i = 0; i < rows.length; i++) {
            cumWeight += weights[i];
            if (rand <= cumWeight) {
                return rows[i].action;
            }
        }

        return rows[0].action;
    }

    /**
     * Unlock a new skill
     */
    async unlockSkill(skillName, unlockedBy, description) {
        const sql = `
            INSERT OR IGNORE INTO skills (skill_name, unlocked_by, unlocked_at, description)
            VALUES (?, ?, ?, ?)
        `;

        await this.runQuery(sql, [skillName, unlockedBy, Date.now(), description]);
        console.log(`[SHARED BRAIN] 🎓 New skill unlocked: ${skillName} by ${unlockedBy}`);
    }

    /**
     * Check if agent has access to skill based on collective experience
     */
    async hasSkillAccess(skillName) {
        const sql = `SELECT * FROM skills WHERE skill_name = ?`;
        const row = await this.queryOne(sql, [skillName]);
        return row !== null;
    }

    /**
     * Record successful strategy
     */
    async recordStrategy(strategyName, actionSequence, context, reward, discoveredBy) {
        const sql = `
            INSERT INTO strategies (strategy_name, action_sequence, context, success_count, total_reward, discovered_by, discovered_at)
            VALUES (?, ?, ?, 1, ?, ?, ?)
            ON CONFLICT(strategy_name) DO UPDATE SET
                success_count = success_count + 1,
                total_reward = total_reward + ?
        `;

        await this.runQuery(sql, [
            strategyName, JSON.stringify(actionSequence), context,
            reward, discoveredBy, Date.now(), reward
        ]);

        console.log(`[SHARED BRAIN] 💡 Strategy recorded: ${strategyName} (${reward.toFixed(1)} reward)`);
    }

    /**
     * Get all available skills
     */
    async getAllSkills() {
        const sql = `SELECT * FROM skills ORDER BY unlocked_at ASC`;
        return await this.queryAll(sql);
    }

    /**
     * Get statistics about collective intelligence
     */
    async getStatistics() {
        const stats = {
            totalActions: await this.queryOne('SELECT COUNT(*) as count FROM action_experience'),
            totalSkills: await this.queryOne('SELECT COUNT(*) as count FROM skills'),
            totalStrategies: await this.queryOne('SELECT COUNT(*) as count FROM strategies'),
            bestActions: await this.queryAll(`
                SELECT action, context, avg_reward,
                       (success_count * 1.0 / (success_count + failure_count)) as success_rate
                FROM action_experience
                WHERE (success_count + failure_count) > 10
                ORDER BY avg_reward DESC
                LIMIT 10
            `),
            recentSkills: await this.queryAll(`
                SELECT skill_name, unlocked_by, unlocked_at
                FROM skills
                ORDER BY unlocked_at DESC
                LIMIT 5
            `)
        };

        return stats;
    }

    /**
     * Helper: Run a query with no results
     */
    runQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    /**
     * Helper: Get one row
     */
    queryOne(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    }

    /**
     * Helper: Get all rows
     */
    queryAll(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    /**
     * Cleanup
     */
    close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close(() => {
                    console.log('[SHARED BRAIN] Database closed');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

// Singleton instance
let sharedBrainInstance = null;

function getSharedBrain() {
    if (!sharedBrainInstance) {
        sharedBrainInstance = new SharedBrain();
    }
    return sharedBrainInstance;
}

module.exports = { SharedBrain, getSharedBrain };
