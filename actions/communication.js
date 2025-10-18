/**
 * Communication Actions Module (208-215)
 * Agent coordination and signaling
 */

const Vec3 = require('vec3');
const { goals } = require('mineflayer-pathfinder');
const { GoalNear, GoalFollow, GoalXZ } = goals;

class Communication {
    constructor(utils) {
        this.utils = utils;
    }

    // 208: Drop Item Signal - Drop specific item as signal
    async dropItemSignal(bot) {
        try {
            // Drop a distinctive item as a signal
            const signalItems = ['torch', 'stick', 'cobblestone'];
            const signalItem = bot.inventory.items().find(item =>
                signalItems.includes(item.name)
            );

            if (signalItem) {
                // Drop one item
                await bot.toss(signalItem.type, null, 1);
                await this.sleep(500);
            }
        } catch (error) {
            // Signal drop failed
        }
    }

    // 209: Place Marker Block - Place distinctive block as marker
    async placeMarkerBlock(bot) {
        try {
            // Place a marker block (wool, concrete, or terracotta for visibility)
            const markerBlocks = ['white_wool', 'yellow_wool', 'red_wool', 'cobblestone'];
            const marker = bot.inventory.items().find(item =>
                markerBlocks.some(block => item.name.includes(block))
            );

            if (marker) {
                await bot.equip(marker, 'hand');
                const referenceBlock = bot.blockAt(bot.entity.position.offset(2, -1, 0));
                if (referenceBlock && referenceBlock.name !== 'air') {
                    await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
                }
            }
        } catch (error) {
            // Marker placement failed
        }
    }

    // 210: Create Waypoint - Place torch and record location
    async createWaypoint(bot) {
        try {
            const torch = bot.inventory.items().find(item => item.name === 'torch');

            if (torch) {
                await bot.equip(torch, 'hand');

                // Place torch
                const referenceBlock = bot.blockAt(bot.entity.position.offset(1, 0, 0));
                if (referenceBlock && referenceBlock.name !== 'air') {
                    await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));

                    // Record location (would integrate with memory system)
                    const waypoint = {
                        position: bot.entity.position.clone(),
                        timestamp: Date.now(),
                        agentName: bot.agentName || bot.username
                    };

                    // Store in bot's memory
                    if (!bot.waypoints) bot.waypoints = [];
                    bot.waypoints.push(waypoint);
                }
            }
        } catch (error) {
            // Waypoint creation failed
        }
    }

    // 211: Signal Danger - Jump + sprint pattern to indicate danger
    async signalDanger(bot) {
        try {
            // Distinctive movement pattern: jump repeatedly while sprinting
            for (let i = 0; i < 3; i++) {
                bot.setControlState('jump', true);
                bot.setControlState('sprint', true);
                await this.sleep(200);
                bot.setControlState('jump', false);
                await this.sleep(300);
            }
            bot.clearControlStates();
        } catch (error) {
            // Danger signal failed
        }
    }

    // 212: Signal Resources - Crouch + jump pattern to indicate resources
    async signalResources(bot) {
        try {
            // Distinctive pattern: crouch then jump
            bot.setControlState('sneak', true);
            await this.sleep(500);
            bot.setControlState('sneak', false);

            bot.setControlState('jump', true);
            await this.sleep(200);
            bot.setControlState('jump', false);
            await this.sleep(200);

            bot.setControlState('jump', true);
            await this.sleep(200);
            bot.setControlState('jump', false);
        } catch (error) {
            // Resource signal failed
        }
    }

    // 213: Form Line - Line up with nearby agents
    async formLine(bot) {
        try {
            const agents = this.utils.getNearbyAgents(bot, 16);

            if (agents.length > 0) {
                // Calculate line formation
                const leader = agents[0];
                const direction = leader.position.minus(bot.entity.position).normalize();

                // Position ourselves in line behind the leader
                const linePos = leader.position.minus(direction.scaled(3 * (agents.length + 1)));

                bot.pathfinder.setGoal(new GoalNear(linePos.x, linePos.y, linePos.z, 1), true);
                await this.sleep(2000);

                // Face same direction as leader
                await bot.lookAt(leader.position.offset(0, 1, 0));
            }
        } catch (error) {
            // Line formation failed
        }
    }

    // 214: Form Circle - Circle formation around a point
    async formCircle(bot) {
        try {
            const agents = this.utils.getNearbyAgents(bot, 16);

            if (agents.length > 0) {
                // Calculate circle center
                const center = agents.reduce((acc, a) => acc.plus(a.position), bot.entity.position)
                    .scaled(1 / (agents.length + 1));

                // Calculate our position on the circle
                const radius = 5;
                const agentCount = agents.length + 1;
                const angleStep = (Math.PI * 2) / agentCount;

                // Use our position in the list to determine angle
                const myAngle = agents.length * angleStep; // Simplified

                const circlePos = center.offset(
                    Math.cos(myAngle) * radius,
                    0,
                    Math.sin(myAngle) * radius
                );

                bot.pathfinder.setGoal(new GoalNear(circlePos.x, circlePos.y, circlePos.z, 1), true);
                await this.sleep(2000);

                // Face toward center
                await bot.lookAt(center);
            }
        } catch (error) {
            // Circle formation failed
        }
    }

    // 215: Follow Leader - Follow the closest agent
    async followLeader(bot) {
        try {
            const agents = this.utils.getNearbyAgents(bot, 32);

            if (agents.length > 0) {
                const leader = agents[0]; // Closest agent

                // Follow at a distance
                const followDist = 3;
                bot.pathfinder.setGoal(new GoalFollow(leader.bot.entity, followDist), true);
                await this.sleep(2000);

                // Look in same direction as leader
                if (leader.bot.entity.yaw !== undefined) {
                    await bot.look(leader.bot.entity.yaw, leader.bot.entity.pitch || 0);
                }
            }
        } catch (error) {
            // Leader following failed
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = Communication;
