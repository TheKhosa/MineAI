# UUID Validation System with Supabase Integration

## Overview

This system validates Minecraft UUIDs by querying the Mojang API and caching results in both Supabase (valid UUIDs) and a local file (invalid UUIDs). This dramatically reduces API calls and improves performance.

## Architecture

```
┌─────────────────────┐
│   server.js         │
│ (Agent Name Gen)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ uuid_validator.js   │
│  - Check Cache      │
│  - Query Mojang     │
│  - Store Results    │
└─────┬─────────┬─────┘
      │         │
      ▼         ▼
┌──────────┐ ┌────────────────┐
│ Supabase │ │ invalidUUID.txt│
│  (Valid) │ │   (Invalid)    │
└──────────┘ └────────────────┘
```

## Features

### ✅ Smart Caching
- **Supabase Database**: Stores valid UUIDs with player names
- **Local File**: Stores invalid UUIDs (invalidUUID.txt)
- **In-Memory Cache**: Fast access during runtime
- **Automatic Management**: No manual cache clearing needed

### ✅ Mojang API Integration
- Queries `sessionserver.mojang.com` for player profiles
- Handles rate limiting with configurable delays
- Proper error handling for 404s and network issues

### ✅ Performance
- **Cache Hits**: ~1ms lookup time
- **Cache Misses**: ~200ms Mojang API query
- **Batch Operations**: Validates multiple UUIDs with rate limiting

### ✅ Data Tracking
- First seen timestamp
- Last updated timestamp
- Query count per UUID
- Player name changes (via last_updated)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install @supabase/supabase-js
```

### 2. Create Supabase Table

1. Go to Supabase Dashboard: https://uokpjmevowrbjaybepoq.supabase.co
2. Navigate to **SQL Editor**
3. Run the SQL from `supabase_setup.sql`:

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
```

4. Click **Run** to execute

### 3. Verify Integration

The UUID validator is automatically integrated into `server.js` at line 574:

```javascript
// server.js:574
async function getPlayerNameFromUUID(uuid) {
    const result = await uuidValidator.validateUUID(uuid);

    if (result.valid) {
        PLAYER_NAME_CACHE.set(uuid, result.playerName);
        return result.playerName;
    }

    return null;
}
```

### 4. Test the System

Run the test script:

```bash
node test_uuid_validator.js
```

Expected output:
```
=== UUID Validator Test ===

[UUID Validator] Initializing...
[UUID Validator] Loaded 0 invalid UUIDs from file
[UUID Validator] ✓ Supabase table verified
[UUID Validator] Loaded 0 valid UUIDs from Supabase
[UUID Validator] Initialized with 0 valid UUIDs and 0 invalid UUIDs

Testing 5 UUIDs...

=== Results ===
✓ VALID 069a79f4-44e9-4726-a5be-fca90e38aaf5 -> Notch [mojang]
✓ VALID f7c77d99-9f15-4a66-a87d-c4a51ef30d19 -> Hypixel [mojang]
✗ INVALID 00000000-0000-0000-0000-000000000000 [mojang]
✗ INVALID aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa [mojang]
✓ VALID 853c80ef-3c37-49fd-aa49-938b674adae6 -> jeb_ [mojang]

=== Statistics ===
Valid UUIDs in cache: 3
Invalid UUIDs in cache: 2
Total cached: 5

✓ Test complete!
```

## File Structure

```
D:\MineRL\
├── uuid_validator.js          # Main validation module
├── test_uuid_validator.js     # Test script
├── supabase_setup.sql          # Database schema
├── invalidUUID.txt             # Invalid UUID cache (auto-created)
├── server.js                   # Integrated at line 61, 574, 1856
└── UUID_VALIDATOR_README.md    # This file
```

## Usage

### Validate Single UUID

```javascript
const uuidValidator = require('./uuid_validator');

await uuidValidator.initialize();

const result = await uuidValidator.validateUUID('069a79f4-44e9-4726-a5be-fca90e38aaf5');

console.log(result);
// Output:
// {
//   valid: true,
//   playerName: 'Notch',
//   source: 'mojang' // or 'valid_cache' or 'invalid_cache'
// }
```

### Validate Multiple UUIDs

```javascript
const uuids = [
    '069a79f4-44e9-4726-a5be-fca90e38aaf5',
    'f7c77d99-9f15-4a66-a87d-c4a51ef30d19',
    '00000000-0000-0000-0000-000000000000'
];

const results = await uuidValidator.validateBatch(uuids, 200); // 200ms delay between API calls

for (const result of results) {
    console.log(`${result.uuid}: ${result.valid ? result.playerName : 'INVALID'}`);
}
```

### Get Statistics

```javascript
const stats = uuidValidator.getStats();
console.log(`Valid: ${stats.validUUIDs}, Invalid: ${stats.invalidUUIDs}`);
```

## Database Schema

### minecraft_players Table

| Column       | Type      | Description                              |
|--------------|-----------|------------------------------------------|
| id           | BIGSERIAL | Primary key (auto-increment)             |
| uuid         | TEXT      | Minecraft UUID (unique, with dashes)     |
| player_name  | TEXT      | Current Minecraft username               |
| first_seen   | TIMESTAMP | When UUID was first validated            |
| last_updated | TIMESTAMP | Last time UUID was queried               |
| query_count  | INTEGER   | Number of times UUID has been validated  |

### Indexes

- `idx_minecraft_players_uuid` - Fast UUID lookups
- `idx_minecraft_players_name` - Fast player name searches

## How It Works

### Validation Flow

```
1. validateUUID(uuid) called
   │
   ├─> Check invalidUUID.txt (in-memory cache)
   │   └─> Found? Return { valid: false, source: 'invalid_cache' }
   │
   ├─> Check Supabase cache (in-memory)
   │   └─> Found? Return { valid: true, playerName, source: 'valid_cache' }
   │
   └─> Query Mojang API
       │
       ├─> Valid UUID?
       │   ├─> Add to Supabase (with upsert)
       │   └─> Return { valid: true, playerName, source: 'mojang' }
       │
       └─> Invalid UUID?
           ├─> Add to invalidUUID.txt
           └─> Return { valid: false, source: 'mojang' }
```

### Cache Behavior

1. **First Run**: All UUIDs query Mojang API (slow)
2. **Subsequent Runs**: Cached UUIDs return instantly (<1ms)
3. **New UUIDs**: Only new UUIDs query Mojang API
4. **Invalid UUIDs**: Stored in `invalidUUID.txt`, never re-queried

## Supabase Dashboard

View your cached UUIDs:

1. Go to: https://uokpjmevowrbjaybepoq.supabase.co
2. Navigate to **Table Editor**
3. Select **minecraft_players** table

### Example Query

```sql
-- Find most popular UUIDs
SELECT uuid, player_name, query_count, last_updated
FROM minecraft_players
ORDER BY query_count DESC
LIMIT 10;

-- Find recent additions
SELECT uuid, player_name, first_seen
FROM minecraft_players
ORDER BY first_seen DESC
LIMIT 10;

-- Search by player name
SELECT uuid, player_name, query_count
FROM minecraft_players
WHERE player_name ILIKE '%notch%';
```

## Configuration

### Supabase Credentials

Located in `uuid_validator.js:20-23`:

```javascript
this.supabase = createClient(
    'https://uokpjmevowrbjaybepoq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // API Key
);
```

### Rate Limiting

Default delay between Mojang API calls: **100ms**

Adjust in `validateBatch()`:

```javascript
const results = await uuidValidator.validateBatch(uuids, 200); // 200ms delay
```

## Troubleshooting

### "Table does not exist" Error

**Solution**: Run the SQL from `supabase_setup.sql` in Supabase Dashboard

### "Connection refused" to Supabase

**Possible causes**:
1. Invalid API key (check uuid_validator.js:22)
2. Network connectivity issues
3. Supabase project paused (free tier)

### invalidUUID.txt keeps growing

**This is normal**. Invalid UUIDs from the MC-UUID chunks are stored here to avoid re-querying them. The file will stabilize once all chunks have been processed.

### Cache not persisting between runs

**Check**:
1. Supabase table exists and has data
2. invalidUUID.txt file has entries
3. No errors during `initialize()`

## Performance Metrics

### Before UUID Validator
- **Every UUID**: ~200ms (Mojang API query)
- **100 agents**: ~20 seconds to spawn

### After UUID Validator
- **Cached UUIDs**: ~1ms (Supabase/file cache)
- **New UUIDs**: ~200ms (Mojang API query)
- **100 agents (cached)**: ~0.1 seconds to fetch names

**Speed improvement**: ~200x faster for cached UUIDs

## Integration with server.js

The UUID validator is integrated at three points in `server.js`:

1. **Line 61**: Import module
   ```javascript
   const uuidValidator = require('./uuid_validator');
   ```

2. **Line 574**: Replace Mojang API calls
   ```javascript
   async function getPlayerNameFromUUID(uuid) {
       const result = await uuidValidator.validateUUID(uuid);
       if (result.valid) {
           PLAYER_NAME_CACHE.set(uuid, result.playerName);
           return result.playerName;
       }
       return null;
   }
   ```

3. **Line 1856**: Initialize during startup
   ```javascript
   await uuidValidator.initialize();
   ```

## API Reference

### `uuidValidator.initialize()`
Loads caches and verifies Supabase table. Call once at startup.

**Returns**: `Promise<void>`

### `uuidValidator.validateUUID(uuid)`
Validates a single UUID.

**Parameters**:
- `uuid` (string): Minecraft UUID (with or without dashes)

**Returns**: `Promise<{ valid: boolean, playerName: string|null, source: string }>`

**Sources**: `'valid_cache'`, `'invalid_cache'`, `'mojang'`

### `uuidValidator.validateBatch(uuids, delayMs = 100)`
Validates multiple UUIDs with rate limiting.

**Parameters**:
- `uuids` (string[]): Array of UUIDs
- `delayMs` (number): Delay between API calls (default: 100ms)

**Returns**: `Promise<Array<{ uuid, valid, playerName, source }>>`

### `uuidValidator.getStats()`
Gets cache statistics.

**Returns**: `{ validUUIDs: number, invalidUUIDs: number, total: number }`

## Future Enhancements

- [ ] Add player skin URLs to Supabase
- [ ] Track name change history
- [ ] Export/import cache functionality
- [ ] Admin dashboard for cache management
- [ ] Automatic cache cleanup (remove old entries)
- [ ] Batch Mojang API queries (reduce API calls)

## Credits

- **Supabase**: Database hosting
- **Mojang API**: Player profile data
- **TheKhosa/MC-UUID**: UUID dataset (chunks 0001-0675)

## License

Same as parent project (MineRL Intelligent Village)

---

**Last Updated**: 2025-10-21
**Version**: 1.0.0
**Author**: MineRL Team
