/**
 * Minecraft Server Manager Agent
 *
 * Manages local Minecraft server lifecycle:
 * - Downloads latest plugin from TeamCity
 * - Installs/updates plugin
 * - Starts/restarts server
 * - Monitors server health
 * - Verifies plugin functionality
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class MinecraftServerManager {
    constructor(config) {
        this.config = {
            serverDir: config.serverDir || 'D:\\MCServer\\Server',
            serverJar: config.serverJar || 'spigot-1.21.10.jar',
            pluginsDir: config.pluginsDir || 'D:\\MCServer\\Server\\plugins',
            javaPath: config.javaPath || 'java',
            javaArgs: config.javaArgs || ['-Xmx4G', '-Xms2G'],
            teamcityUrl: config.teamcityUrl || 'http://145.239.253.161:8111',
            teamcityUser: config.teamcityUser || 'AIAgent',
            teamcityPass: config.teamcityPass || 'D#hp^uC5RuJcn%',
            buildTypeId: config.buildTypeId || 'AgentSensorPlugin',
            checkInterval: config.checkInterval || 300000, // 5 minutes
            ...config
        };

        this.serverProcess = null;
        this.isRunning = false;
        this.lastPluginVersion = null;
        this.updateCheckInterval = null;
    }

    /**
     * Initialize the server manager
     */
    async initialize() {
        console.log('===========================================');
        console.log('Minecraft Server Manager - Initializing');
        console.log('===========================================');
        console.log(`Server Dir: ${this.config.serverDir}`);
        console.log(`Plugins Dir: ${this.config.pluginsDir}`);
        console.log(`TeamCity: ${this.config.teamcityUrl}`);
        console.log('');

        // Ensure directories exist
        this.ensureDirectories();

        // Check for latest plugin
        await this.checkAndUpdatePlugin();

        // Start the server
        await this.startServer();

        // Schedule periodic updates
        this.scheduleUpdateChecks();
    }

    /**
     * Ensure required directories exist
     */
    ensureDirectories() {
        if (!fs.existsSync(this.config.serverDir)) {
            console.log(`Creating server directory: ${this.config.serverDir}`);
            fs.mkdirSync(this.config.serverDir, { recursive: true });
        }

        if (!fs.existsSync(this.config.pluginsDir)) {
            console.log(`Creating plugins directory: ${this.config.pluginsDir}`);
            fs.mkdirSync(this.config.pluginsDir, { recursive: true });
        }
    }

    /**
     * Get latest successful build from TeamCity
     */
    async getLatestBuild() {
        return new Promise((resolve, reject) => {
            const url = `${this.config.teamcityUrl}/app/rest/builds?locator=buildType:${this.config.buildTypeId},status:SUCCESS,count:1&fields=build(id,number,status)`;
            const auth = Buffer.from(`${this.config.teamcityUser}:${this.config.teamcityPass}`).toString('base64');

            const options = {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/json'
                }
            };

            http.get(url, options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.build && json.build.length > 0) {
                            const build = json.build[0];
                            resolve({
                                id: build.id,
                                number: build.number,
                                status: build.status
                            });
                        } else {
                            resolve(null);
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
    }

    /**
     * Download plugin artifact from TeamCity
     */
    async downloadPlugin(buildNumber) {
        return new Promise((resolve, reject) => {
            const artifactName = `AgentSensorPlugin-${buildNumber}.jar`;
            const url = `${this.config.teamcityUrl}/app/rest/builds/number:${buildNumber}/artifacts/content/${artifactName}`;
            const auth = Buffer.from(`${this.config.teamcityUser}:${this.config.teamcityPass}`).toString('base64');
            const outputPath = path.join(this.config.pluginsDir, artifactName);

            console.log(`Downloading ${artifactName}...`);

            const options = {
                headers: {
                    'Authorization': `Basic ${auth}`
                }
            };

            const file = fs.createWriteStream(outputPath);

            http.get(url, options, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Failed to download: HTTP ${res.statusCode}`));
                    return;
                }

                res.pipe(file);

                file.on('finish', () => {
                    file.close();
                    console.log(`✓ Downloaded to: ${outputPath}`);
                    resolve(outputPath);
                });
            }).on('error', (err) => {
                fs.unlink(outputPath, () => {});
                reject(err);
            });
        });
    }

    /**
     * Remove old plugin versions
     */
    cleanupOldPlugins(currentVersion) {
        console.log('Cleaning up old plugin versions...');

        const files = fs.readdirSync(this.config.pluginsDir);
        let removed = 0;

        files.forEach(file => {
            if (file.startsWith('AgentSensorPlugin-') && file.endsWith('.jar') && file !== `AgentSensorPlugin-${currentVersion}.jar`) {
                const filePath = path.join(this.config.pluginsDir, file);
                try {
                    fs.unlinkSync(filePath);
                    console.log(`  Removed: ${file}`);
                    removed++;
                } catch (e) {
                    console.warn(`  Failed to remove ${file}:`, e.message);
                }
            }
        });

        if (removed > 0) {
            console.log(`✓ Removed ${removed} old plugin version(s)`);
        } else {
            console.log('  No old versions to remove');
        }
    }

    /**
     * Check for plugin updates and install if available
     */
    async checkAndUpdatePlugin() {
        try {
            console.log('\n[Update Check] Checking TeamCity for latest build...');

            const latestBuild = await this.getLatestBuild();

            if (!latestBuild) {
                console.log('✗ No successful builds found');
                return false;
            }

            console.log(`  Latest build: #${latestBuild.number} (ID: ${latestBuild.id})`);

            // Check if we already have this version
            const pluginPath = path.join(this.config.pluginsDir, `AgentSensorPlugin-${latestBuild.number}.jar`);

            if (fs.existsSync(pluginPath)) {
                console.log(`✓ Plugin already up-to-date (version ${latestBuild.number})`);
                this.lastPluginVersion = latestBuild.number;
                return false;
            }

            console.log(`  New version available: ${latestBuild.number}`);

            // Download new version
            await this.downloadPlugin(latestBuild.number);

            // Cleanup old versions
            this.cleanupOldPlugins(latestBuild.number);

            this.lastPluginVersion = latestBuild.number;

            console.log(`✓ Plugin updated to version ${latestBuild.number}`);

            // Restart server if running
            if (this.isRunning) {
                console.log('  Server restart required...');
                await this.restartServer();
            }

            return true;
        } catch (error) {
            console.error('✗ Update check failed:', error.message);
            return false;
        }
    }

    /**
     * Start the Minecraft server
     */
    async startServer() {
        if (this.isRunning) {
            console.log('⚠ Server is already running');
            return;
        }

        console.log('\n[Server] Starting Minecraft server...');

        const serverJarPath = path.join(this.config.serverDir, this.config.serverJar);

        if (!fs.existsSync(serverJarPath)) {
            throw new Error(`Server JAR not found: ${serverJarPath}`);
        }

        const args = [
            ...this.config.javaArgs,
            '-jar',
            this.config.serverJar,
            'nogui'
        ];

        console.log(`  Command: ${this.config.javaPath} ${args.join(' ')}`);
        console.log(`  Working Dir: ${this.config.serverDir}`);

        this.serverProcess = spawn(this.config.javaPath, args, {
            cwd: this.config.serverDir,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.isRunning = true;

        // Handle server output
        this.serverProcess.stdout.on('data', (data) => {
            const output = data.toString();
            process.stdout.write(`[SERVER] ${output}`);

            // Check for plugin load
            if (output.includes('AgentSensorPlugin')) {
                if (output.includes('Enabling AgentSensorPlugin')) {
                    console.log('✓ AgentSensorPlugin loaded successfully');
                } else if (output.includes('Error') || output.includes('Exception')) {
                    console.error('✗ AgentSensorPlugin encountered an error');
                }
            }

            // Check for server ready
            if (output.includes('Done') && output.includes('For help, type "help"')) {
                console.log('\n✓ Server is ready!');
                console.log('  Agents can now connect to localhost:25565');
                console.log('  WebSocket sensor server: localhost:3002\n');
            }
        });

        this.serverProcess.stderr.on('data', (data) => {
            process.stderr.write(`[SERVER ERROR] ${data}`);
        });

        this.serverProcess.on('close', (code) => {
            console.log(`\n[Server] Process exited with code ${code}`);
            this.isRunning = false;
            this.serverProcess = null;
        });

        this.serverProcess.on('error', (error) => {
            console.error('✗ Failed to start server:', error.message);
            this.isRunning = false;
            this.serverProcess = null;
        });

        // Give server time to start
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    /**
     * Stop the Minecraft server
     */
    async stopServer() {
        if (!this.isRunning || !this.serverProcess) {
            console.log('⚠ Server is not running');
            return;
        }

        console.log('\n[Server] Stopping server...');

        return new Promise((resolve) => {
            // Send stop command
            this.serverProcess.stdin.write('stop\n');

            // Wait for graceful shutdown
            const timeout = setTimeout(() => {
                console.log('  Server did not stop gracefully, forcing...');
                this.serverProcess.kill();
                resolve();
            }, 30000); // 30 seconds

            this.serverProcess.on('close', () => {
                clearTimeout(timeout);
                console.log('✓ Server stopped');
                this.isRunning = false;
                this.serverProcess = null;
                resolve();
            });
        });
    }

    /**
     * Restart the Minecraft server
     */
    async restartServer() {
        console.log('\n[Server] Restarting server...');
        await this.stopServer();
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        await this.startServer();
    }

    /**
     * Schedule periodic update checks
     */
    scheduleUpdateChecks() {
        console.log(`\n[Manager] Scheduling update checks every ${this.config.checkInterval / 1000 / 60} minutes`);

        this.updateCheckInterval = setInterval(async () => {
            await this.checkAndUpdatePlugin();
        }, this.config.checkInterval);
    }

    /**
     * Shutdown the manager
     */
    async shutdown() {
        console.log('\n[Manager] Shutting down...');

        if (this.updateCheckInterval) {
            clearInterval(this.updateCheckInterval);
        }

        await this.stopServer();

        console.log('✓ Manager shutdown complete');
    }

    /**
     * Send command to server console
     */
    sendCommand(command) {
        if (!this.isRunning || !this.serverProcess) {
            console.warn('⚠ Cannot send command: Server is not running');
            return false;
        }

        console.log(`[Command] ${command}`);
        this.serverProcess.stdin.write(`${command}\n`);
        return true;
    }

    /**
     * Get server status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            pluginVersion: this.lastPluginVersion,
            serverDir: this.config.serverDir,
            pluginsDir: this.config.pluginsDir
        };
    }
}

// Main execution
async function main() {
    const manager = new MinecraftServerManager({
        serverDir: 'D:\\MCServer\\Server',
        serverJar: 'spigot-1.21.10.jar',
        pluginsDir: 'D:\\MCServer\\Server\\plugins',
        javaPath: 'java',
        javaArgs: ['-Xmx4G', '-Xms2G'],
        checkInterval: 300000 // 5 minutes
    });

    try {
        await manager.initialize();
    } catch (error) {
        console.error('✗ Failed to initialize manager:', error);
        process.exit(1);
    }

    // Handle Ctrl+C gracefully
    process.on('SIGINT', async () => {
        console.log('\n\nReceived SIGINT, shutting down...');
        await manager.shutdown();
        process.exit(0);
    });

    // Keep process alive
    process.stdin.resume();

    // Allow sending commands via stdin
    process.stdin.on('data', (data) => {
        const command = data.toString().trim();
        if (command === 'status') {
            console.log('Status:', manager.getStatus());
        } else if (command === 'update') {
            manager.checkAndUpdatePlugin();
        } else if (command === 'restart') {
            manager.restartServer();
        } else if (command) {
            manager.sendCommand(command);
        }
    });
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = { MinecraftServerManager };
