#!/usr/bin/env node
/**
 * Add stack trace logging to ml_trainer.js error handler
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'ml_trainer.js');

console.log('[STACK TRACE] Reading ml_trainer.js...');
let content = fs.readFileSync(filePath, 'utf8');

const oldCode = `        } catch (error) {
            console.error(\`[ML TRAINER] Error in agent step: \${error.message}\`);
            return null;
        }`;

const newCode = `        } catch (error) {
            console.error(\`[ML TRAINER] Error in agent step: \${error.message}\`);
            console.error(\`[ML TRAINER] Stack trace:\`);
            console.error(error.stack);
            return null;
        }`;

if (!content.includes(`console.error(\`[ML TRAINER] Error in agent step: \${error.message}\`);`)) {
    console.error('[STACK TRACE] ERROR: Could not find the error handler to patch.');
    process.exit(1);
}

console.log('[STACK TRACE] Applying patch...');
content = content.replace(oldCode, newCode);

console.log('[STACK TRACE] Writing fixed version...');
fs.writeFileSync(filePath, content, 'utf8');

console.log('[STACK TRACE] ✅ Successfully added stack trace logging!');
