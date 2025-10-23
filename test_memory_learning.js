const sqlite3 = require('sqlite3').verbose();

console.log('=== AGENT MEMORY & LEARNING ANALYSIS ===\n');

// Check memories database
const memDb = new sqlite3.Database('./agent_memories.sqlite', (err) => {
    if (err) {
        console.error('Error opening memories database:', err.message);
        return;
    }

    console.log('✓ Connected to agent_memories.sqlite\n');

    // Total memories
    memDb.get('SELECT COUNT(*) as count FROM memories', (err, row) => {
        if (!err) {
            console.log(`Total memories stored: ${row.count}`);
        }
    });

    // Most active agents
    memDb.all('SELECT agent_name, COUNT(*) as count FROM memories GROUP BY agent_name ORDER BY count DESC LIMIT 5', (err, rows) => {
        if (!err) {
            console.log('\nMost active agents:');
            console.log('━'.repeat(50));
            rows.forEach((r, i) => {
                console.log(`${i+1}. ${r.agent_name.padEnd(25)}: ${r.count} memories`);
            });
        }
    });

    // Recent memories
    memDb.all('SELECT agent_name, type, content, timestamp FROM memories ORDER BY timestamp DESC LIMIT 5', (err, rows) => {
        if (!err) {
            console.log('\nRecent memories:');
            console.log('━'.repeat(80));
            rows.forEach((m, i) => {
                const time = new Date(m.timestamp).toLocaleTimeString();
                const contentPreview = JSON.parse(m.content).description ? JSON.parse(m.content).description.substring(0, 40) : '';
                console.log(`${i+1}. [${time}] ${m.agent_name} (${m.type}): ${contentPreview}...`);
            });
        }

        setTimeout(() => {
            memDb.close();
            console.log('\n✓ Memory database closed\n');
        }, 500);
    });
});
