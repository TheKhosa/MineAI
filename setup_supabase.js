const { createClient } = require('@supabase/supabase-js');

/**
 * Supabase Setup Script
 *
 * This script checks if the minecraft_players table exists and provides
 * instructions for creating it if needed.
 */

async function main() {
    console.log('=== Supabase Setup Check ===\n');

    // Initialize Supabase client
    const supabase = createClient(
        'https://uokpjmevowrbjaybepoq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVva3BqbWV2b3dyYmpheWJlcG9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4NzM1MTcsImV4cCI6MjA3NjQ0OTUxN30.sLAk-T90LIs25CcVHpJvdq08qCPIHzBOXtSlfUzNlpA'
    );

    console.log('Testing connection to Supabase...');
    console.log('URL: https://uokpjmevowrbjaybepoq.supabase.co\n');

    // Try to query the table
    const { data, error } = await supabase
        .from('minecraft_players')
        .select('uuid')
        .limit(1);

    if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') {
            console.log('❌ Table "minecraft_players" does not exist!\n');
            console.log('='.repeat(70));
            console.log('SETUP INSTRUCTIONS:');
            console.log('='.repeat(70));
            console.log('\n1. Open Supabase Dashboard:');
            console.log('   https://uokpjmevowrbjaybepoq.supabase.co\n');
            console.log('2. Navigate to: SQL Editor (left sidebar)\n');
            console.log('3. Copy and paste this SQL:\n');
            console.log('='.repeat(70));
            console.log(`
CREATE TABLE IF NOT EXISTS minecraft_players (
    id BIGSERIAL PRIMARY KEY,
    uuid TEXT UNIQUE NOT NULL,
    player_name TEXT NOT NULL,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    query_count INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_minecraft_players_uuid ON minecraft_players(uuid);
CREATE INDEX IF NOT EXISTS idx_minecraft_players_name ON minecraft_players(player_name);

GRANT SELECT, INSERT, UPDATE ON minecraft_players TO anon;
GRANT ALL ON minecraft_players TO authenticated;

SELECT 'Table created successfully!' as status;
            `);
            console.log('='.repeat(70));
            console.log('\n4. Click "Run" button\n');
            console.log('5. Verify success message appears\n');
            console.log('6. Run this script again to verify\n');
            console.log('='.repeat(70));
            console.log('\n💡 TIP: The SQL is also saved in "supabase_setup_simple.sql"\n');
            process.exit(1);
        } else {
            console.log('❌ Error connecting to Supabase:');
            console.log(error);
            process.exit(1);
        }
    }

    console.log('✅ Table "minecraft_players" exists!\n');

    // Get row count
    const { count, error: countError } = await supabase
        .from('minecraft_players')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.log('⚠️  Could not get row count:', countError.message);
    } else {
        console.log(`📊 Table contains ${count} UUIDs\n`);
    }

    // Sample some data if exists
    if (count > 0) {
        const { data: sampleData, error: sampleError } = await supabase
            .from('minecraft_players')
            .select('uuid, player_name, first_seen, query_count')
            .order('first_seen', { ascending: false })
            .limit(5);

        if (!sampleError && sampleData) {
            console.log('Recent entries:');
            console.log('─'.repeat(70));
            console.log('UUID                                  | Player Name    | Queries');
            console.log('─'.repeat(70));
            for (const row of sampleData) {
                console.log(`${row.uuid} | ${row.player_name.padEnd(14)} | ${row.query_count}`);
            }
            console.log('─'.repeat(70));
        }
    }

    console.log('\n✅ Supabase setup complete!\n');
    console.log('You can now run:');
    console.log('  - node test_uuid_validator.js  (test the validator)');
    console.log('  - node server.js               (start the agent system)\n');
}

main().catch(console.error);
