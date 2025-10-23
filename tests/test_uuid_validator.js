const uuidValidator = require('./uuid_validator.js');

/**
 * Test script for UUID validation system
 */

async function main() {
    console.log('=== UUID Validator Test ===\n');

    // Initialize
    await uuidValidator.initialize();

    // Test UUIDs (mix of valid and invalid)
    const testUUIDs = [
        '069a79f4-44e9-4726-a5be-fca90e38aaf5', // Notch (valid)
        'f7c77d99-9f15-4a66-a87d-c4a51ef30d19', // Hypixel (valid)
        '00000000-0000-0000-0000-000000000000', // Invalid
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', // Invalid
        '853c80ef-3c37-49fd-aa49-938b674adae6', // jeb_ (valid)
    ];

    console.log(`Testing ${testUUIDs.length} UUIDs...\n`);

    // Test batch validation
    const results = await uuidValidator.validateBatch(testUUIDs, 200);

    // Display results
    console.log('\n=== Results ===');
    for (const result of results) {
        const status = result.valid ? '✓ VALID' : '✗ INVALID';
        const name = result.playerName ? `-> ${result.playerName}` : '';
        const source = `[${result.source}]`;
        console.log(`${status} ${result.uuid} ${name} ${source}`);
    }

    // Show statistics
    console.log('\n=== Statistics ===');
    const stats = uuidValidator.getStats();
    console.log(`Valid UUIDs in cache: ${stats.validUUIDs}`);
    console.log(`Invalid UUIDs in cache: ${stats.invalidUUIDs}`);
    console.log(`Total cached: ${stats.total}`);

    console.log('\n=== Test single UUID ===');
    // Test individual validation
    const singleResult = await uuidValidator.validateUUID('069a79f4-44e9-4726-a5be-fca90e38aaf5');
    console.log('Testing Notch\'s UUID again (should hit cache):');
    console.log(singleResult);

    console.log('\n✓ Test complete!');
    console.log('\nNext steps:');
    console.log('1. Check Supabase Dashboard: https://uokpjmevowrbjaybepoq.supabase.co');
    console.log('2. Verify "minecraft_players" table has entries');
    console.log('3. Check invalidUUID.txt for invalid UUIDs');
}

main().catch(console.error);
