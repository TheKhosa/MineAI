/**
 * Idle Behavior Benchmark Test
 *
 * Monitors agent activity and counts how many agents are idle vs active
 * Tests the effectiveness of the idle penalty system
 */

const sqlite3 = require('sqlite3').verbose();

console.log('=== IDLE BEHAVIOR BENCHMARK ===\n');
console.log('Monitoring agent activity from ML brain database...\n');

const db = new sqlite3.Database('./ml_brain.sqlite', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        return;
    }

    console.log('✓ Connected to ml_brain.sqlite\n');

    // Count total actions in last 60 seconds
    const oneMinuteAgo = Date.now() - 60000;

    db.get(`
        SELECT COUNT(*) as count
        FROM action_experience
        WHERE last_updated > ?
    `, [oneMinuteAgo], (err, row) => {
        if (!err) {
            console.log(`Actions taken in last 60 seconds: ${row.count}`);
        }
    });

    // Get action breakdown by type
    db.all(`
        SELECT action, COUNT(*) as count, AVG(avg_reward) as avg_r
        FROM action_experience
        WHERE last_updated > ?
        GROUP BY action
        ORDER BY count DESC
        LIMIT 15
    `, [oneMinuteAgo], (err, rows) => {
        if (!err && rows.length > 0) {
            console.log('\nMost common actions (last 60 seconds):');
            console.log('━'.repeat(70));
            rows.forEach((a, i) => {
                console.log(`${String(i+1).padStart(2)}. ${a.action.padEnd(25)} | Count: ${String(a.count).padStart(4)} | Avg reward: ${a.avg_r.toFixed(2)}`);
            });
        }
    });

    // Check for idle-related actions
    db.get(`
        SELECT COUNT(*) as idle_count
        FROM action_experience
        WHERE action IN ('idle', 'wait', 'do_nothing', 'stand_still')
        AND last_updated > ?
    `, [oneMinuteAgo], (err, row) => {
        if (!err) {
            console.log(`\nIdle actions detected: ${row.idle_count}`);
        }
    });

    // Get overall statistics
    db.get('SELECT COUNT(DISTINCT action) as unique_actions, COUNT(*) as total_experiences FROM action_experience', (err, row) => {
        if (!err) {
            console.log(`\n=== OVERALL STATISTICS ===`);
            console.log(`Total unique actions learned: ${row.unique_actions}`);
            console.log(`Total experiences: ${row.total_experiences}`);
        }
    });

    // Calculate activity rate
    db.all(`
        SELECT action, success_count, failure_count, avg_reward
        FROM action_experience
        WHERE (success_count + failure_count) > 3
        ORDER BY avg_reward DESC
        LIMIT 10
    `, (err, rows) => {
        if (!err) {
            console.log(`\n=== TOP REWARDING ACTIONS ===`);
            console.log('━'.repeat(70));
            rows.forEach((a, i) => {
                const total = a.success_count + a.failure_count;
                const successRate = ((a.success_count / total) * 100).toFixed(1);
                console.log(`${String(i+1).padStart(2)}. ${a.action.padEnd(25)} | Reward: ${String(a.avg_reward.toFixed(2)).padStart(6)} | Success: ${successRate}%`);
            });
        }
    });

    // Get worst performing actions (potential idle indicators)
    db.all(`
        SELECT action, avg_reward, (success_count + failure_count) as total
        FROM action_experience
        WHERE (success_count + failure_count) > 3
        ORDER BY avg_reward ASC
        LIMIT 10
    `, (err, rows) => {
        if (!err) {
            console.log(`\n=== LOWEST REWARDING ACTIONS (Potential Idle Behavior) ===`);
            console.log('━'.repeat(70));
            rows.forEach((a, i) => {
                console.log(`${String(i+1).padStart(2)}. ${a.action.padEnd(25)} | Reward: ${String(a.avg_reward.toFixed(2)).padStart(6)} | Total: ${a.total}`);
            });
        }

        // Close after last query
        setTimeout(() => {
            db.close((err) => {
                if (err) {
                    console.error('\nError closing database:', err.message);
                } else {
                    console.log('\n✓ Benchmark complete\n');
                }
            });
        }, 500);
    });
});
