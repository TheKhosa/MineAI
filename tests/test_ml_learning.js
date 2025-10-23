const sqlite3 = require('sqlite3').verbose();

console.log('=== ML BRAIN DATABASE ANALYSIS ===\n');

const db = new sqlite3.Database('./ml_brain.sqlite', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        return;
    }

    console.log('✓ Connected to ml_brain.sqlite\n');

    // Count total action experiences
    db.get('SELECT COUNT(*) as count FROM action_experience', (err, row) => {
        if (err) {
            console.error('Error:', err.message);
        } else {
            console.log(`Total action experiences: ${row.count}`);
        }
    });

    // Count strategies
    db.get('SELECT COUNT(*) as count FROM strategies', (err, row) => {
        if (err) {
            console.error('Error:', err.message);
        } else {
            console.log(`Total strategies: ${row.count}`);
        }
    });

    // Count skills
    db.get('SELECT COUNT(*) as count FROM skills', (err, row) => {
        if (err) {
            console.error('Error:', err.message);
        } else {
            console.log(`Total skills unlocked: ${row.count}\n`);
        }
    });

    // Get action experiences
    db.all('SELECT action, context, avg_reward, success_count, failure_count FROM action_experience ORDER BY last_updated DESC LIMIT 10', (err, rows) => {
        if (err) {
            console.error('Error:', err.message);
        } else {
            console.log('\nRecent action experiences (last 10):');
            console.log('━'.repeat(80));
            rows.forEach((s, i) => {
                const successRate = ((s.success_count / (s.success_count + s.failure_count)) * 100).toFixed(1);
                console.log(`${i+1}. Action: ${s.action.padEnd(25)} | Context: ${s.context.substring(0, 20).padEnd(20)} | Reward: ${s.avg_reward.toFixed(3)} | Success: ${successRate}%`);
            });
        }
    });

    // Get best actions (highest avg reward)
    db.all('SELECT action, context, avg_reward, success_count, failure_count FROM action_experience WHERE (success_count + failure_count) > 5 ORDER BY avg_reward DESC LIMIT 10', (err, rows) => {
        if (err) {
            console.error('Error:', err.message);
        } else {
            console.log('\nBest performing actions (min 5 uses):');
            console.log('━'.repeat(80));
            rows.forEach((s, i) => {
                const successRate = ((s.success_count / (s.success_count + s.failure_count)) * 100).toFixed(1);
                console.log(`${i+1}. Action: ${s.action.padEnd(25)} | Reward: ${s.avg_reward.toFixed(3)} | Success: ${successRate}% | Total: ${s.success_count + s.failure_count}`);
            });
        }
    });

    // Get strategies
    db.all('SELECT strategy_name, success_count, total_reward, discovered_by FROM strategies ORDER BY total_reward DESC LIMIT 5', (err, rows) => {
        if (err) {
            console.error('Error:', err.message);
        } else {
            console.log('\nDiscovered strategies:');
            console.log('━'.repeat(80));
            rows.forEach((s, i) => {
                const avgReward = (s.total_reward / s.success_count).toFixed(3);
                console.log(`${i+1}. ${s.strategy_name.padEnd(30)} | Uses: ${s.success_count} | Avg reward: ${avgReward} | Found by: ${s.discovered_by}`);
            });
        }
    });

    // Get skills unlocked
    db.all('SELECT skill_name, unlocked_by, description FROM skills ORDER BY unlocked_at DESC LIMIT 5', (err, rows) => {
        if (err) {
            console.error('Error:', err.message);
        } else {
            console.log('\nUnlocked skills:');
            console.log('━'.repeat(80));
            if (rows.length === 0) {
                console.log('No skills unlocked yet');
            } else {
                rows.forEach((s, i) => {
                    console.log(`${i+1}. ${s.skill_name.padEnd(30)} | Unlocked by: ${s.unlocked_by}`);
                    if (s.description) console.log(`   ${s.description}`);
                });
            }
        }

        // Close after last query
        setTimeout(() => {
            db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                } else {
                    console.log('\n✓ Database closed');
                }
            });
        }, 500);
    });
});
