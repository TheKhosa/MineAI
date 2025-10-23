const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

/**
 * UUID Validation System with Supabase Integration
 *
 * This module validates Minecraft UUIDs by:
 * 1. Checking if UUID is in Supabase (valid cache)
 * 2. Checking if UUID is in invalidUUID.txt (invalid cache)
 * 3. Querying Mojang API for player name
 * 4. Storing valid UUIDs in Supabase
 * 5. Storing invalid UUIDs in invalidUUID.txt
 */

class UUIDValidator {
    constructor() {
        // Initialize Supabase client
        this.supabase = createClient(
            'https://uokpjmevowrbjaybepoq.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVva3BqbWV2b3dyYmpheWJlcG9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4NzM1MTcsImV4cCI6MjA3NjQ0OTUxN30.sLAk-T90LIs25CcVHpJvdq08qCPIHzBOXtSlfUzNlpA'
        );

        this.invalidUUIDFile = path.join(__dirname, 'invalidUUID.txt');
        this.invalidUUIDCache = new Set();
        this.validUUIDCache = new Map(); // uuid -> player name
        this.initialized = false;
    }

    /**
     * Initialize the validator - load caches and verify table
     */
    async initialize() {
        if (this.initialized) return;

        console.log('[UUID Validator] Initializing...');

        // Load invalid UUID cache from file
        await this.loadInvalidUUIDs();

        // Verify Supabase table exists
        await this.ensureSupabaseTable();

        // Load valid UUIDs from Supabase
        await this.loadValidUUIDs();

        this.initialized = true;
        console.log(`[UUID Validator] Initialized with ${this.validUUIDCache.size} valid UUIDs and ${this.invalidUUIDCache.size} invalid UUIDs`);
    }

    /**
     * Load invalid UUIDs from local file
     */
    async loadInvalidUUIDs() {
        try {
            const data = await fs.readFile(this.invalidUUIDFile, 'utf-8');
            const uuids = data.split('\n').filter(line => line.trim());
            this.invalidUUIDCache = new Set(uuids);
            console.log(`[UUID Validator] Loaded ${this.invalidUUIDCache.size} invalid UUIDs from file`);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist yet, create it
                await fs.writeFile(this.invalidUUIDFile, '', 'utf-8');
                console.log('[UUID Validator] Created new invalidUUID.txt file');
            } else {
                console.error('[UUID Validator] Error loading invalid UUIDs:', error);
            }
        }
    }

    /**
     * Ensure the Minecraft Players table exists in Supabase
     */
    async ensureSupabaseTable() {
        try {
            // Try to query the table
            const { data, error } = await this.supabase
                .from('minecraft_players')
                .select('uuid')
                .limit(1);

            if (error) {
                if (error.code === 'PGRST205' || error.code === '42P01' || error.message.includes('does not exist')) {
                    console.log('[UUID Validator] ❌ Table "minecraft_players" does not exist!');
                    console.log('[UUID Validator] Please run: node setup_supabase.js');
                    console.log('[UUID Validator] Or manually create the table in Supabase Dashboard');
                    console.log('[UUID Validator] See UUID_VALIDATOR_README.md for instructions');
                    throw new Error('Supabase table not found. Run setup_supabase.js to create it.');
                } else {
                    throw error;
                }
            } else {
                console.log('[UUID Validator] ✓ Supabase table verified');
            }
        } catch (error) {
            console.error('[UUID Validator] Error checking Supabase table:', error);
            throw error;
        }
    }

    /**
     * Load valid UUIDs from Supabase into cache
     */
    async loadValidUUIDs() {
        try {
            const { data, error } = await this.supabase
                .from('minecraft_players')
                .select('uuid, player_name');

            if (error) throw error;

            if (data) {
                for (const row of data) {
                    this.validUUIDCache.set(row.uuid, row.player_name);
                }
                console.log(`[UUID Validator] Loaded ${data.length} valid UUIDs from Supabase`);
            }
        } catch (error) {
            console.error('[UUID Validator] Error loading valid UUIDs:', error);
        }
    }

    /**
     * Add invalid UUID to cache and file
     */
    async addInvalidUUID(uuid) {
        if (this.invalidUUIDCache.has(uuid)) return;

        this.invalidUUIDCache.add(uuid);

        try {
            await fs.appendFile(this.invalidUUIDFile, uuid + '\n', 'utf-8');
            console.log(`[UUID Validator] Added invalid UUID: ${uuid}`);
        } catch (error) {
            console.error('[UUID Validator] Error writing invalid UUID:', error);
        }
    }

    /**
     * Add valid UUID to Supabase
     */
    async addValidUUID(uuid, playerName) {
        // Add to cache immediately
        this.validUUIDCache.set(uuid, playerName);

        try {
            // Try to insert
            const { data, error } = await this.supabase
                .from('minecraft_players')
                .upsert({
                    uuid: uuid,
                    player_name: playerName,
                    last_updated: new Date().toISOString()
                }, {
                    onConflict: 'uuid',
                    ignoreDuplicates: false
                })
                .select();

            if (error) {
                // If it's a duplicate, update the query count and last_updated
                if (error.code === '23505') {
                    const { error: updateError } = await this.supabase
                        .from('minecraft_players')
                        .update({
                            last_updated: new Date().toISOString(),
                            query_count: this.supabase.sql`query_count + 1`
                        })
                        .eq('uuid', uuid);

                    if (updateError) {
                        console.error('[UUID Validator] Error updating UUID:', updateError);
                    }
                } else {
                    throw error;
                }
            }

            console.log(`[UUID Validator] Added valid UUID to Supabase: ${uuid} -> ${playerName}`);
        } catch (error) {
            console.error('[UUID Validator] Error adding valid UUID to Supabase:', error);
        }
    }

    /**
     * Query Mojang API for player name
     */
    async queryMojangAPI(uuid) {
        try {
            // Remove dashes from UUID for Mojang API
            const cleanUUID = uuid.replace(/-/g, '');

            const response = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${cleanUUID}`);

            if (response.status === 404) {
                return null; // Invalid UUID
            }

            if (!response.ok) {
                console.error(`[UUID Validator] Mojang API error: ${response.status}`);
                return null;
            }

            const data = await response.json();
            return data.name || null;
        } catch (error) {
            console.error('[UUID Validator] Error querying Mojang API:', error);
            return null;
        }
    }

    /**
     * Validate a UUID and get player name
     * Returns: { valid: boolean, playerName: string|null, source: 'cache'|'mojang'|null }
     */
    async validateUUID(uuid) {
        if (!this.initialized) {
            await this.initialize();
        }

        // Check if in invalid cache
        if (this.invalidUUIDCache.has(uuid)) {
            return { valid: false, playerName: null, source: 'invalid_cache' };
        }

        // Check if in valid cache
        if (this.validUUIDCache.has(uuid)) {
            return { valid: true, playerName: this.validUUIDCache.get(uuid), source: 'valid_cache' };
        }

        // Query Mojang API
        const playerName = await this.queryMojangAPI(uuid);

        if (playerName) {
            // Valid UUID - add to Supabase
            await this.addValidUUID(uuid, playerName);
            return { valid: true, playerName, source: 'mojang' };
        } else {
            // Invalid UUID - add to file
            await this.addInvalidUUID(uuid);
            return { valid: false, playerName: null, source: 'mojang' };
        }
    }

    /**
     * Batch validate multiple UUIDs
     */
    async validateBatch(uuids, delayMs = 100) {
        const results = [];

        for (const uuid of uuids) {
            const result = await this.validateUUID(uuid);
            results.push({ uuid, ...result });

            // Add delay between API calls to avoid rate limiting
            if (result.source === 'mojang' && delayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        return results;
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            validUUIDs: this.validUUIDCache.size,
            invalidUUIDs: this.invalidUUIDCache.size,
            total: this.validUUIDCache.size + this.invalidUUIDCache.size
        };
    }
}

// Export singleton instance
module.exports = new UUIDValidator();
