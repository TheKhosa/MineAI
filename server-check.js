/**
 * Minecraft Server Check
 * Validates if the Minecraft server is online and responding
 */

const mineflayer = require('mineflayer');

const SERVER_CONFIG = {
    host: 'vps-38b05e45.vps.ovh.net',
    port: 25565,
    version: '1.21'
};

console.log('========================================');
console.log('Minecraft Server Connection Test');
console.log('========================================');
console.log(`Host: ${SERVER_CONFIG.host}`);
console.log(`Port: ${SERVER_CONFIG.port}`);
console.log(`Version: ${SERVER_CONFIG.version}`);
console.log('========================================\n');

console.log('Attempting to connect...\n');

const testBot = mineflayer.createBot({
    host: SERVER_CONFIG.host,
    port: SERVER_CONFIG.port,
    version: SERVER_CONFIG.version,
    username: `TestBot_${Date.now()}`,
    auth: 'offline',
    hideErrors: false,
    checkTimeoutInterval: 30000,
    logErrors: true
});

let connectionTimeout = setTimeout(() => {
    console.error('\n❌ CONNECTION TIMEOUT (30 seconds)');
    console.error('Server did not respond within timeout period.');
    console.error('\nPossible issues:');
    console.error('1. Server is offline or not responding');
    console.error('2. Firewall blocking connection');
    console.error('3. Wrong host/port configuration');
    console.error('4. Server version mismatch');
    testBot.end();
    process.exit(1);
}, 30000);

testBot.on('login', () => {
    clearTimeout(connectionTimeout);
    console.log('✅ LOGIN SUCCESSFUL');
    console.log(`   Connected as: ${testBot.username}`);
    console.log(`   Server version: ${testBot.version}`);
});

testBot.on('spawn', () => {
    console.log('✅ SPAWN SUCCESSFUL');
    console.log(`   Position: ${testBot.entity.position.x.toFixed(2)}, ${testBot.entity.position.y.toFixed(2)}, ${testBot.entity.position.z.toFixed(2)}`);
    console.log(`   Health: ${testBot.health}/20`);
    console.log(`   Food: ${testBot.food}/20`);

    console.log('\n========================================');
    console.log('✅ SERVER IS ONLINE AND ACCEPTING CONNECTIONS');
    console.log('========================================\n');

    console.log('Disconnecting test bot...');
    testBot.quit();

    setTimeout(() => {
        console.log('✅ Test completed successfully!\n');
        process.exit(0);
    }, 1000);
});

testBot.on('error', (err) => {
    clearTimeout(connectionTimeout);
    console.error('\n❌ CONNECTION ERROR:');
    console.error(err.message);

    if (err.message.includes('ENOTFOUND')) {
        console.error('\n⚠️  DNS Resolution Failed');
        console.error('The hostname could not be resolved.');
        console.error('Check if the server address is correct.');
    } else if (err.message.includes('ECONNREFUSED')) {
        console.error('\n⚠️  Connection Refused');
        console.error('Server is not accepting connections on this port.');
        console.error('Server may be offline or firewall blocking.');
    } else if (err.message.includes('ETIMEDOUT')) {
        console.error('\n⚠️  Connection Timed Out');
        console.error('Server did not respond in time.');
        console.error('Server may be overloaded or network issues.');
    }

    process.exit(1);
});

testBot.on('end', (reason) => {
    clearTimeout(connectionTimeout);
    if (reason) {
        console.log(`\n⚠️  Connection ended: ${reason}`);
    }
});

testBot.on('kicked', (reason) => {
    clearTimeout(connectionTimeout);
    console.error('\n❌ KICKED FROM SERVER:');
    try {
        const parsed = JSON.parse(reason);
        console.error(parsed.text || reason);
    } catch {
        console.error(reason);
    }
    process.exit(1);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\n\n⚠️  Test interrupted by user');
    testBot.end();
    process.exit(0);
});
