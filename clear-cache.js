/**
 * Clear HuggingFace Transformers Cache
 * Run this if you get Protobuf parsing errors
 *
 * Usage: node clear-cache.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const cacheBasePath = path.join(
    __dirname,
    'node_modules',
    '@huggingface',
    'transformers',
    '.cache',
    'onnx-community'
);

console.log('='.repeat(70));
console.log('HuggingFace Transformers.js Cache Cleaner');
console.log('='.repeat(70));
console.log(`Cache location: ${cacheBasePath}\n`);

if (!fs.existsSync(cacheBasePath)) {
    console.log('✓ No cache found - nothing to clear!');
    process.exit(0);
}

// List all cached models
console.log('Cached models:');
const models = fs.readdirSync(cacheBasePath).filter(name => !name.includes('_corrupted_'));
models.forEach(model => {
    const modelPath = path.join(cacheBasePath, model);
    const stats = fs.statSync(modelPath);
    console.log(`  - ${model}`);
});

console.log(`\nFound ${models.length} cached model(s)\n`);

if (models.length === 0) {
    console.log('✓ No models to clear!');
    process.exit(0);
}

console.log('Attempting to clear cache...\n');

// Try different methods
let success = false;

// Method 1: Rename (safest, works with locked files)
console.log('[Method 1] Trying to rename cache directories...');
try {
    models.forEach(model => {
        const modelPath = path.join(cacheBasePath, model);
        const timestamp = Date.now();
        const newPath = `${modelPath}_cleared_${timestamp}`;

        try {
            fs.renameSync(modelPath, newPath);
            console.log(`  ✓ Renamed: ${model} -> ${path.basename(newPath)}`);
            success = true;
        } catch (err) {
            console.log(`  ✗ Failed to rename ${model}: ${err.message}`);
        }
    });
} catch (err) {
    console.log(`  ✗ Rename failed: ${err.message}`);
}

// Method 2: Delete with PowerShell (Windows only)
if (!success && process.platform === 'win32') {
    console.log('\n[Method 2] Trying PowerShell force delete...');

    models.forEach(model => {
        const modelPath = path.join(cacheBasePath, model);

        if (!fs.existsSync(modelPath)) {
            console.log(`  ⊘ Already removed: ${model}`);
            return;
        }

        try {
            execSync(`powershell -Command "Remove-Item -Path '${modelPath}' -Recurse -Force"`, {
                stdio: 'pipe',
                timeout: 30000
            });

            if (!fs.existsSync(modelPath)) {
                console.log(`  ✓ Deleted: ${model}`);
                success = true;
            } else {
                console.log(`  ✗ Still exists: ${model}`);
            }
        } catch (err) {
            console.log(`  ✗ PowerShell failed for ${model}`);
        }
    });
}

// Method 3: Kill Node.js processes and retry
if (!success && process.platform === 'win32') {
    console.log('\n[Method 3] Checking for Node.js processes...');

    try {
        const output = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV', { encoding: 'utf8' });
        const lines = output.split('\n').filter(line => line.includes('node.exe'));

        if (lines.length > 1) { // More than just this process
            console.log(`  Found ${lines.length - 1} other Node.js process(es)`);
            console.log('  These processes may be locking the cache files.');
            console.log('\n  To fix:');
            console.log('    1. Close all Node.js applications');
            console.log('    2. Run: taskkill /F /IM node.exe');
            console.log('    3. Re-run this script');
        } else {
            console.log('  ✓ No other Node.js processes found');
        }
    } catch (err) {
        console.log(`  Could not check processes: ${err.message}`);
    }
}

console.log('\n' + '='.repeat(70));

if (success) {
    console.log('SUCCESS! Cache cleared/renamed successfully.');
    console.log('You can now run: node server.js');
} else {
    console.log('PARTIAL SUCCESS or MANUAL ACTION NEEDED');
    console.log('\nIf files are still locked, try:');
    console.log('  1. Close all Node.js processes');
    console.log('  2. Restart your computer (if files remain locked)');
    console.log('  3. Manually delete:');
    console.log(`     ${cacheBasePath}`);
}

console.log('='.repeat(70));
