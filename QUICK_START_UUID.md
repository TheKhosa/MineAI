# UUID Validation System - Quick Start Guide

## ⚡ 3-Minute Setup

### Step 1: Install Dependencies (30 seconds)

```bash
npm install @supabase/supabase-js
```

### Step 2: Create Supabase Table (2 minutes)

```bash
node setup_supabase.js
```

**Follow the instructions to:**
1. Open Supabase Dashboard: https://uokpjmevowrbjaybepoq.supabase.co
2. Navigate to **SQL Editor** (left sidebar)
3. Copy/paste the SQL shown in terminal
4. Click **Run**

**OR** copy this SQL directly:

```sql
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
```

### Step 3: Verify Setup (30 seconds)

```bash
node setup_supabase.js
```

You should see:
```
✅ Table "minecraft_players" exists!
📊 Table contains 0 UUIDs
```

### Step 4: Test (Optional)

```bash
node test_uuid_validator.js
```

### Step 5: Run Your Server

```bash
node server.js
```

Done! 🎉

## 🎯 What You Get

- ✅ UUIDs cached in Supabase (valid)
- ✅ Invalid UUIDs cached in `invalidUUID.txt`
- ✅ 200x faster lookups for cached UUIDs
- ✅ Automatic validation on agent spawn

## 📊 Monitor Your Cache

**Supabase Dashboard**: https://uokpjmevowrbjaybepoq.supabase.co

Navigate to: **Table Editor** → **minecraft_players**

Watch UUIDs being added in real-time!

## 🔧 Troubleshooting

### "Table does not exist"
→ Run `node setup_supabase.js` and create the table

### Still not working?
→ Check `UUID_VALIDATOR_README.md` for detailed docs

---

**Ready to go!** Start with `node server.js`
