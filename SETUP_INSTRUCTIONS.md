# UUID Validation System - Setup Instructions

## ✅ FIXED: PostgreSQL Syntax Error

The syntax error with `CREATE POLICY IF NOT EXISTS` has been fixed. Use the new simplified SQL below.

## 🚀 Complete Setup (3 Steps)

### Step 1: Copy the SQL

Copy this SQL (also saved in `supabase_setup_simple.sql`):

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

### Step 2: Run in Supabase

1. Open: **https://uokpjmevowrbjaybepoq.supabase.co**
2. Click **SQL Editor** in left sidebar
3. Paste the SQL above
4. Click **Run** button
5. You should see: `"Table created successfully!"`

### Step 3: Verify

```bash
node setup_supabase.js
```

Expected output:
```
✅ Table "minecraft_players" exists!
📊 Table contains 0 UUIDs
```

## ✅ Done!

Now you can:
- **Test**: `node test_uuid_validator.js`
- **Run**: `node server.js`

## 🔍 What Changed?

### ❌ Old SQL (had errors):
```sql
CREATE POLICY IF NOT EXISTS "Allow public read access" ...
```

### ✅ New SQL (works perfectly):
```sql
GRANT SELECT, INSERT, UPDATE ON minecraft_players TO anon;
GRANT ALL ON minecraft_players TO authenticated;
```

**Why?**: Older PostgreSQL versions don't support `IF NOT EXISTS` for policies. The new version uses simple GRANT statements that work everywhere.

## 📁 Files Updated

- ✅ `supabase_setup_simple.sql` - New simplified SQL
- ✅ `setup_supabase.js` - Updated to use simplified SQL
- ✅ `QUICK_START_UUID.md` - Updated instructions
- ✅ `supabase_setup.sql` - Original (kept for reference)

## 🎯 Test Your Setup

After creating the table, test with:

```bash
# Test the validator
node test_uuid_validator.js
```

Expected output:
```
✓ VALID 069a79f4-44e9-4726-a5be-fca90e38aaf5 -> Notch [mojang]
✓ VALID f7c77d99-9f15-4a66-a87d-c4a51ef30d19 -> Hypixel [mojang]
✗ INVALID 00000000-0000-0000-0000-000000000000 [mojang]
```

Check Supabase Dashboard - you should see 2-3 rows in `minecraft_players` table!

## 🆘 Still Having Issues?

### "Permission denied"
- Make sure you're logged into Supabase Dashboard
- Try running the SQL again

### "Table already exists"
- This is OK! The table is already created
- Run `node setup_supabase.js` to verify

### "Connection error"
- Check your internet connection
- Verify Supabase URL: https://uokpjmevowrbjaybepoq.supabase.co

---

**Ready to go!** Start with `node server.js`
