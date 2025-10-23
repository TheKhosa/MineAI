-- Minecraft Players Table Setup for Supabase (Compatible Version)
-- Run this in your Supabase SQL Editor: https://uokpjmevowrbjaybepoq.supabase.co

-- Create the minecraft_players table
CREATE TABLE IF NOT EXISTS minecraft_players (
    id BIGSERIAL PRIMARY KEY,
    uuid TEXT UNIQUE NOT NULL,
    player_name TEXT NOT NULL,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    query_count INTEGER DEFAULT 1
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_minecraft_players_uuid ON minecraft_players(uuid);
CREATE INDEX IF NOT EXISTS idx_minecraft_players_name ON minecraft_players(player_name);

-- Grant permissions (without RLS for simplicity)
GRANT SELECT, INSERT, UPDATE ON minecraft_players TO anon;
GRANT ALL ON minecraft_players TO authenticated;

-- Display success message
SELECT 'Table created successfully!' as status;
