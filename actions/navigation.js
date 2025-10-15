/**
 * Navigation Actions Module (183-197)
 * Advanced movement and navigation techniques
 */

const Vec3 = require('vec3');
const { goals } = require('mineflayer-pathfinder');
const { GoalNear, GoalBlock, GoalXZ, GoalY } = goals;

class Navigation {
    constructor(actionSpace) {
        this.actionSpace = actionSpace;
    }

    // 183: Swim Forward - Forward swimming controls
    async swimForward(bot) {
        try {
            // Check if in water
            const headBlock = bot.blockAt(bot.entity.position.offset(0, 1, 0));
            if (headBlock && headBlock.name === 'water') {
                bot.setControlState('forward', true);
                bot.setControlState('jump', true); // Jump in water = swim up slightly
                await this.sleep(800);
                bot.clearControlStates();
            }
        } catch (error) {
            // Swimming failed
        }
    }

    // 184: Swim Up - Ascend in water
    async swimUp(bot) {
        try {
            const headBlock = bot.blockAt(bot.entity.position.offset(0, 1, 0));
            if (headBlock && headBlock.name === 'water') {
                // Jump to swim up
                bot.setControlState('jump', true);
                await this.sleep(1000);
                bot.setControlState('jump', false);
            }
        } catch (error) {
            // Swim up failed
        }
    }

    // 185: Swim Down - Descend in water
    async swimDown(bot) {
        try {
            const headBlock = bot.blockAt(bot.entity.position.offset(0, 1, 0));
            if (headBlock && headBlock.name === 'water') {
                // Sneak to swim down
                bot.setControlState('sneak', true);
                await this.sleep(1000);
                bot.setControlState('sneak', false);
            }
        } catch (error) {
            // Swim down failed
        }
    }

    // 186: Climb Vine - Climb up vines
    async climbVine(bot) {
        try {
            const vine = bot.findBlock({
                matching: block => block.name === 'vine',
                maxDistance: 4
            });

            if (vine) {
                // Move to vine
                bot.pathfinder.setGoal(new GoalBlock(vine.position.x, vine.position.y, vine.position.z), true);
                await this.sleep(500);

                // Climb by holding forward and jump
                bot.setControlState('forward', true);
                bot.setControlState('jump', true);
                await this.sleep(2000);
                bot.clearControlStates();
            }
        } catch (error) {
            // Vine climbing failed
        }
    }

    // 187: Climb Ladder - Climb up ladders
    async climbLadder(bot) {
        try {
            const ladder = bot.findBlock({
                matching: block => block.name === 'ladder',
                maxDistance: 4
            });

            if (ladder) {
                // Move to ladder
                bot.pathfinder.setGoal(new GoalBlock(ladder.position.x, ladder.position.y, ladder.position.z), true);
                await this.sleep(500);

                // Climb by holding forward and jump
                bot.setControlState('forward', true);
                bot.setControlState('jump', true);
                await this.sleep(2000);
                bot.clearControlStates();
            }
        } catch (error) {
            // Ladder climbing failed
        }
    }

    // 188: Use Boat - Enter and control boat
    async useBoat(bot) {
        try {
            // Look for nearby boat entity
            const boat = Object.values(bot.entities).find(e =>
                e.name && e.name === 'boat' &&
                e.position &&
                e.position.distanceTo(bot.entity.position) < 4
            );

            if (boat) {
                // Mount the boat
                await bot.mount(boat);
                await this.sleep(500);

                // Move forward in boat
                bot.setControlState('forward', true);
                await this.sleep(2000);
                bot.clearControlStates();
            } else {
                // Try to place boat if we have one
                const boatItem = bot.inventory.items().find(item => item.name.includes('boat'));
                if (boatItem) {
                    const waterBlock = bot.findBlock({
                        matching: block => block.name === 'water',
                        maxDistance: 8
                    });

                    if (waterBlock) {
                        await bot.equip(boatItem, 'hand');
                        await bot.lookAt(waterBlock.position);
                        await bot.activateItem();
                    }
                }
            }
        } catch (error) {
            // Boat usage failed
        }
    }

    // 189: Exit Boat - Dismount from boat
    async exitBoat(bot) {
        try {
            if (bot.vehicle) {
                await bot.dismount();
            }
        } catch (error) {
            // Boat exit failed
        }
    }

    // 190: Parkour Jump - Sprint + jump for maximum distance
    async parkourJump(bot) {
        try {
            // Sprint and jump for distance
            bot.setControlState('sprint', true);
            bot.setControlState('forward', true);
            await this.sleep(200);
            bot.setControlState('jump', true);
            await this.sleep(300);
            bot.clearControlStates();
        } catch (error) {
            // Parkour jump failed
        }
    }

    // 191: Bridge Forward - Place blocks while moving forward
    async bridgeForward(bot) {
        try {
            const blockItem = bot.inventory.items().find(item =>
                item.name.includes('cobblestone') || item.name.includes('dirt') || item.name.includes('stone')
            );

            if (blockItem && blockItem.count >= 3) {
                await bot.equip(blockItem, 'hand');

                // Bridge forward by placing blocks
                for (let i = 0; i < 3; i++) {
                    // Move forward
                    bot.setControlState('forward', true);
                    await this.sleep(200);
                    bot.setControlState('forward', false);

                    // Look down and place block
                    await bot.look(bot.entity.yaw, Math.PI / 2); // Look down
                    await this.sleep(100);

                    const referenceBlock = bot.blockAt(bot.entity.position.offset(0, -1, 0));
                    if (referenceBlock && referenceBlock.name === 'air') {
                        const belowRef = bot.blockAt(bot.entity.position.offset(0, -2, 0));
                        if (belowRef && belowRef.name !== 'air') {
                            await bot.placeBlock(belowRef, new Vec3(0, 1, 0));
                        }
                    }
                    await this.sleep(200);
                }
            }
        } catch (error) {
            // Bridging failed
        }
    }

    // 192: Pillar Up - Place blocks below and jump up
    async pillarUp(bot) {
        try {
            const blockItem = bot.inventory.items().find(item =>
                item.name.includes('cobblestone') || item.name.includes('dirt') || item.name.includes('stone')
            );

            if (blockItem && blockItem.count >= 5) {
                await bot.equip(blockItem, 'hand');

                // Pillar up by placing blocks below and jumping
                for (let i = 0; i < 5; i++) {
                    // Look down
                    await bot.look(bot.entity.yaw, Math.PI / 2);

                    // Place block below
                    const referenceBlock = bot.blockAt(bot.entity.position.offset(0, -1, 0));
                    if (referenceBlock) {
                        await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
                    }

                    // Jump
                    bot.setControlState('jump', true);
                    await this.sleep(200);
                    bot.setControlState('jump', false);
                    await this.sleep(300);
                }
            }
        } catch (error) {
            // Pillaring failed
        }
    }

    // 193: Pillar Down - Dig down and place blocks for safe descent
    async pillarDown(bot) {
        try {
            const blockItem = bot.inventory.items().find(item =>
                item.name.includes('cobblestone') || item.name.includes('dirt') || item.name.includes('stone')
            );

            if (blockItem && blockItem.count >= 3) {
                // Dig down carefully
                for (let i = 0; i < 3; i++) {
                    const below = bot.blockAt(bot.entity.position.offset(0, -1, 0));
                    if (below && below.name !== 'air' && below.name !== 'bedrock') {
                        await bot.dig(below);
                        await this.sleep(500);

                        // Move down
                        bot.setControlState('forward', true);
                        await this.sleep(200);
                        bot.setControlState('forward', false);
                    }
                }
            }
        } catch (error) {
            // Pillar down failed
        }
    }

    // 194: Navigate Ravine - Safely cross ravines
    async navigateRavine(bot) {
        try {
            // Look for blocks to bridge across
            const blockItem = bot.inventory.items().find(item =>
                item.name.includes('cobblestone') || item.name.includes('dirt') || item.name.includes('stone')
            );

            if (blockItem && blockItem.count >= 5) {
                // Use bridging technique
                await this.bridgeForward(bot);
            } else {
                // Try to find a way around
                const angle = Math.random() * Math.PI;
                const targetPos = bot.entity.position.offset(
                    Math.cos(angle) * 10,
                    0,
                    Math.sin(angle) * 10
                );
                bot.pathfinder.setGoal(new GoalNear(targetPos.x, targetPos.y, targetPos.z, 2), true);
                await this.sleep(2000);
            }
        } catch (error) {
            // Ravine navigation failed
        }
    }

    // 195: Cross Lava - Bridge over lava safely
    async crossLava(bot) {
        try {
            const lava = bot.findBlock({
                matching: block => block.name === 'lava',
                maxDistance: 8
            });

            if (lava) {
                const blockItem = bot.inventory.items().find(item =>
                    item.name.includes('cobblestone') || item.name.includes('stone')
                );

                if (blockItem && blockItem.count >= 3) {
                    // Bridge across lava
                    await this.bridgeForward(bot);
                } else {
                    // Try to go around
                    const escapeDir = bot.entity.position.minus(lava.position).normalize();
                    const safePos = bot.entity.position.plus(escapeDir.scaled(10));
                    bot.pathfinder.setGoal(new GoalNear(safePos.x, safePos.y, safePos.z, 2), true);
                    await this.sleep(2000);
                }
            }
        } catch (error) {
            // Lava crossing failed
        }
    }

    // 196: Find Cave Entrance - Locate and navigate to cave opening
    async findCaveEntrance(bot) {
        try {
            // Look for dark areas or stone walls that might indicate caves
            const stone = bot.findBlock({
                matching: block => block.name === 'stone' || block.name === 'cobblestone',
                maxDistance: 32
            });

            if (stone) {
                // Move toward stone formation
                bot.pathfinder.setGoal(new GoalNear(stone.position.x, stone.position.y, stone.position.z, 3), true);
                await this.sleep(2000);

                // Look for openings
                await this.actionSpace.lookAround(bot);
            } else {
                // Explore randomly
                const angle = Math.random() * Math.PI * 2;
                const targetPos = bot.entity.position.offset(
                    Math.cos(angle) * 20,
                    0,
                    Math.sin(angle) * 20
                );
                bot.pathfinder.setGoal(new GoalNear(targetPos.x, targetPos.y, targetPos.z, 2), true);
                await this.sleep(2000);
            }
        } catch (error) {
            // Cave finding failed
        }
    }

    // 197: Escape Water - Swim to surface quickly
    async escapeWater(bot) {
        try {
            const headBlock = bot.blockAt(bot.entity.position.offset(0, 1, 0));
            if (headBlock && headBlock.name === 'water') {
                // Swim straight up
                bot.setControlState('jump', true);
                await this.sleep(2000);
                bot.setControlState('jump', false);

                // Move forward to get to shore
                bot.setControlState('forward', true);
                await this.sleep(1000);
                bot.clearControlStates();
            }
        } catch (error) {
            // Water escape failed
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = Navigation;
