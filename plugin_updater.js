#!/usr/bin/env node
/**
 * Plugin Auto-Updater for Minecraft Server
 *
 * Automatically checks for and downloads updates from Jenkins CI servers
 * Supports: EssentialsX, and other Jenkins-based plugins
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const PLUGINS_FOLDER = 'D:/MCServer/Server/plugins';

const PLUGIN_CONFIGS = {
    'EssentialsX': {
        jenkinsUrl: 'https://ci.ender.zone/job/EssentialsX/lastSuccessfulBuild',
        artifactPattern: 'EssentialsX-2.*-dev+*.jar',  // Only main EssentialsX, not modules
        currentVersion: null  // Will be auto-detected
    },
    // Add more plugins here as needed
    // 'LuckPerms': {
    //     jenkinsUrl: 'https://ci.lucko.me/job/LuckPerms/lastSuccessfulBuild',
    //     artifactPattern: 'LuckPerms-Bukkit-*.jar',
    //     currentVersion: null
    // }
};

/**
 * Fetch JSON from URL
 */
function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;

        client.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
}

/**
 * Download file from URL
 */
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(dest);

        client.get(url, (res) => {
            if (res.statusCode === 302 || res.statusCode === 301) {
                // Handle redirects
                file.close();
                fs.unlinkSync(dest);
                return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
            }

            const totalSize = parseInt(res.headers['content-length'], 10);
            let downloaded = 0;

            res.on('data', (chunk) => {
                downloaded += chunk.length;
                const percent = ((downloaded / totalSize) * 100).toFixed(1);
                process.stdout.write(`\r  Downloading: ${percent}%`);
            });

            res.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log('\r  Download complete!        ');
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

/**
 * Get current installed version of a plugin
 */
function getCurrentVersion(pluginName, pattern) {
    const files = fs.readdirSync(PLUGINS_FOLDER);

    // Convert glob pattern to regex
    const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
    const regex = new RegExp(regexPattern);

    const matches = files.filter(f => regex.test(f));

    if (matches.length > 0) {
        return matches[0];  // Return the filename
    }

    return null;
}

/**
 * Extract version from filename
 */
function extractVersion(filename) {
    // Try to extract version like "2.22.0-dev+40-150dabb"
    const versionMatch = filename.match(/(\d+\.\d+\.\d+(?:-[^\.]+)?)/);
    return versionMatch ? versionMatch[1] : filename;
}

/**
 * Check for updates for a specific plugin
 */
async function checkPlugin(pluginName, config) {
    console.log(`\n[${'='.repeat(60)}]`);
    console.log(`[PLUGIN UPDATER] Checking ${pluginName}...`);
    console.log(`[${'='.repeat(60)}]`);

    try {
        // Get current installed version
        const currentFile = getCurrentVersion(pluginName, config.artifactPattern);
        const currentVersion = currentFile ? extractVersion(currentFile) : 'NOT INSTALLED';

        console.log(`[CURRENT] ${currentVersion}`);
        if (currentFile) {
            console.log(`[FILE] ${currentFile}`);
        }

        // Fetch latest build info
        console.log(`[CHECKING] ${config.jenkinsUrl}/api/json`);
        const buildInfo = await fetchJSON(`${config.jenkinsUrl}/api/json`);

        const buildNumber = buildInfo.number;
        const artifacts = buildInfo.artifacts;

        console.log(`[LATEST BUILD] #${buildNumber}`);

        // Find matching artifact
        const regexPattern = config.artifactPattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*');
        const regex = new RegExp(regexPattern);

        const mainArtifact = artifacts.find(a => regex.test(a.fileName) && !a.fileName.includes('AntiBuild') && !a.fileName.includes('Chat') && !a.fileName.includes('Discord') && !a.fileName.includes('GeoIP') && !a.fileName.includes('Protect') && !a.fileName.includes('Spawn') && !a.fileName.includes('XMPP'));

        if (!mainArtifact) {
            console.log(`[ERROR] No matching artifact found for pattern: ${config.artifactPattern}`);
            return false;
        }

        const latestVersion = extractVersion(mainArtifact.fileName);
        console.log(`[LATEST] ${latestVersion}`);
        console.log(`[FILE] ${mainArtifact.fileName}`);

        // Check if update needed
        if (currentFile === mainArtifact.fileName) {
            console.log(`[STATUS] ✅ Up to date!`);
            return false;
        }

        console.log(`[STATUS] 🔄 Update available!`);

        // Download new version
        const downloadUrl = `${config.jenkinsUrl}/artifact/${mainArtifact.relativePath}`;
        const destPath = path.join(PLUGINS_FOLDER, mainArtifact.fileName);

        console.log(`[DOWNLOAD] ${downloadUrl}`);
        await downloadFile(downloadUrl, destPath);

        console.log(`[SAVED] ${destPath}`);

        // Delete old version
        if (currentFile) {
            const oldPath = path.join(PLUGINS_FOLDER, currentFile);
            fs.unlinkSync(oldPath);
            console.log(`[DELETED] ${currentFile}`);
        }

        console.log(`[SUCCESS] ✅ ${pluginName} updated successfully!`);
        console.log(`[ACTION REQUIRED] Restart Minecraft server to load new plugin`);

        return true;

    } catch (error) {
        console.error(`[ERROR] Failed to update ${pluginName}: ${error.message}`);
        return false;
    }
}

/**
 * Main update routine
 */
async function updateAll() {
    console.log('\n' + '='.repeat(70));
    console.log('MINECRAFT PLUGIN AUTO-UPDATER');
    console.log('='.repeat(70));
    console.log(`Plugins Folder: ${PLUGINS_FOLDER}`);
    console.log(`Checking ${Object.keys(PLUGIN_CONFIGS).length} plugin(s)...`);

    let updatedCount = 0;

    for (const [pluginName, config] of Object.entries(PLUGIN_CONFIGS)) {
        const updated = await checkPlugin(pluginName, config);
        if (updated) {
            updatedCount++;
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log('UPDATE SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total plugins checked: ${Object.keys(PLUGIN_CONFIGS).length}`);
    console.log(`Plugins updated: ${updatedCount}`);

    if (updatedCount > 0) {
        console.log('\n⚠️  ACTION REQUIRED: Restart Minecraft server to load updated plugins');
        console.log('   OR use /reload confirm in-game (may cause issues)');
    } else {
        console.log('\n✅ All plugins are up to date!');
    }

    console.log('='.repeat(70) + '\n');
}

// Run if executed directly
if (require.main === module) {
    updateAll().catch(err => {
        console.error('[FATAL ERROR]', err);
        process.exit(1);
    });
}

module.exports = { updateAll, checkPlugin };
