/**
 * Combat Advanced Actions Module (171-182)
 * Fine motor combat techniques for agents
 */

const Vec3 = require('vec3');
const { goals } = require('mineflayer-pathfinder');
const { GoalNear, GoalFollow, GoalBlock } = goals;

class CombatAdvanced {
    constructor(utils) {
        this.utils = utils;
    }

    // 171: Critical Hit - Jump + attack for critical damage
    async criticalHit(bot) {
        const hostileMobs = ['zombie', 'skeleton', 'spider', 'creeper', 'enderman'];
        const target = Object.values(bot.entities).find(e =>
            e.position &&
            hostileMobs.includes(e.name) &&
            e.position.distanceTo(bot.entity.position) < 4
        );

        if (target) {
            try {
                await this.utils.equipBestTool(bot);
                // Jump and attack while falling for critical hit
                bot.setControlState('jump', true);
                await this.sleep(100);
                bot.setControlState('jump', false);
                await this.sleep(150); // Wait to be falling
                await bot.attack(target);
            } catch (error) {
                // Attack failed
            }
        }
    }

    // 172: Block with Shield - Equip shield and activate blocking
    async blockWithShield(bot) {
        const shield = bot.inventory.items().find(item => item.name === 'shield');

        if (shield) {
            try {
                // Equip shield to offhand
                await bot.equip(shield, 'off-hand');

                // Check for nearby threats
                const hostiles = Object.values(bot.entities).filter(e =>
                    ['zombie', 'skeleton', 'spider', 'creeper'].includes(e.name) &&
                    e.position &&
                    e.position.distanceTo(bot.entity.position) < 8
                );

                if (hostiles.length > 0) {
                    // Look at threat
                    await bot.lookAt(hostiles[0].position.offset(0, 1, 0));
                    // Activate shield (right-click/use item)
                    bot.activateItem();
                    await this.sleep(1000);
                    bot.deactivateItem();
                }
            } catch (error) {
                // Shield blocking failed
            }
        }
    }

    // 173: Strafe Left - Move left while facing enemy
    async strafeLeft(bot) {
        const hostiles = Object.values(bot.entities).filter(e =>
            ['zombie', 'skeleton', 'spider', 'creeper'].includes(e.name) &&
            e.position &&
            e.position.distanceTo(bot.entity.position) < 16
        );

        if (hostiles.length > 0) {
            try {
                const target = hostiles[0];
                // Look at target
                await bot.lookAt(target.position.offset(0, 1, 0));
                // Strafe left
                bot.setControlState('left', true);
                await this.sleep(500);
                bot.setControlState('left', false);
            } catch (error) {
                // Strafe failed
            }
        }
    }

    // 174: Strafe Right - Move right while facing enemy
    async strafeRight(bot) {
        const hostiles = Object.values(bot.entities).filter(e =>
            ['zombie', 'skeleton', 'spider', 'creeper'].includes(e.name) &&
            e.position &&
            e.position.distanceTo(bot.entity.position) < 16
        );

        if (hostiles.length > 0) {
            try {
                const target = hostiles[0];
                // Look at target
                await bot.lookAt(target.position.offset(0, 1, 0));
                // Strafe right
                bot.setControlState('right', true);
                await this.sleep(500);
                bot.setControlState('right', false);
            } catch (error) {
                // Strafe failed
            }
        }
    }

    // 175: Combo Attack - 3-hit combo with timing
    async comboAttack(bot) {
        const hostileMobs = ['zombie', 'skeleton', 'spider', 'creeper'];
        const target = Object.values(bot.entities).find(e =>
            e.position &&
            hostileMobs.includes(e.name) &&
            e.position.distanceTo(bot.entity.position) < 4
        );

        if (target) {
            try {
                await this.utils.equipBestTool(bot);
                // Execute 3-hit combo with proper timing
                await bot.attack(target);
                await this.sleep(600); // Wait for attack cooldown
                await bot.attack(target);
                await this.sleep(600);
                await bot.attack(target);
            } catch (error) {
                // Combo failed
            }
        }
    }

    // 176: Kite Enemy - Attack and retreat pattern
    async kiteEnemy(bot) {
        const hostileMobs = ['zombie', 'skeleton', 'spider', 'creeper'];
        const target = Object.values(bot.entities).find(e =>
            e.position &&
            hostileMobs.includes(e.name) &&
            e.position.distanceTo(bot.entity.position) < 16
        );

        if (target) {
            try {
                await this.utils.equipBestTool(bot);
                const dist = target.position.distanceTo(bot.entity.position);

                if (dist < 3) {
                    // Too close - retreat
                    const escapeDir = bot.entity.position.minus(target.position).normalize();
                    const escapePos = bot.entity.position.plus(escapeDir.scaled(5));
                    bot.pathfinder.setGoal(new GoalNear(escapePos.x, escapePos.y, escapePos.z, 1), true);
                    await this.sleep(500);
                } else if (dist < 5) {
                    // Good range - attack
                    await bot.attack(target);
                    await this.sleep(300);
                } else {
                    // Too far - approach
                    bot.pathfinder.setGoal(new GoalNear(target.position.x, target.position.y, target.position.z, 3), true);
                    await this.sleep(500);
                }
            } catch (error) {
                // Kiting failed
            }
        }
    }

    // 177: Circle Strafe - Circle around enemy while attacking
    async circleStrafe(bot) {
        const hostileMobs = ['zombie', 'skeleton', 'spider', 'creeper'];
        const target = Object.values(bot.entities).find(e =>
            e.position &&
            hostileMobs.includes(e.name) &&
            e.position.distanceTo(bot.entity.position) < 8
        );

        if (target) {
            try {
                await this.utils.equipBestTool(bot);

                // Calculate position to circle around target
                const direction = bot.entity.position.minus(target.position).normalize();
                const perpendicular = new Vec3(-direction.z, 0, direction.x);
                const circlePos = target.position.plus(direction.scaled(4)).plus(perpendicular.scaled(2));

                // Look at target while moving
                await bot.lookAt(target.position.offset(0, 1, 0));
                bot.pathfinder.setGoal(new GoalNear(circlePos.x, circlePos.y, circlePos.z, 1), true);
                await this.sleep(800);

                // Attack if in range
                if (bot.entity.position.distanceTo(target.position) < 4) {
                    await bot.attack(target);
                }
            } catch (error) {
                // Circle strafe failed
            }
        }
    }

    // 178: Backstab - Get behind enemy and attack
    async backstab(bot) {
        const hostileMobs = ['zombie', 'skeleton', 'spider', 'creeper'];
        const target = Object.values(bot.entities).find(e =>
            e.position &&
            hostileMobs.includes(e.name) &&
            e.position.distanceTo(bot.entity.position) < 16
        );

        if (target) {
            try {
                await this.utils.equipBestTool(bot);

                // Calculate position behind target
                // Assume target is facing roughly toward us
                const directionToUs = bot.entity.position.minus(target.position).normalize();
                const behindPos = target.position.minus(directionToUs.scaled(2));

                // Move behind target
                bot.pathfinder.setGoal(new GoalNear(behindPos.x, behindPos.y, behindPos.z, 1), true);
                await this.sleep(1000);

                // Attack from behind
                if (bot.entity.position.distanceTo(target.position) < 4) {
                    await bot.attack(target);
                }
            } catch (error) {
                // Backstab failed
            }
        }
    }

    // 179: Knockback Attack - Sprint + attack for knockback
    async knockbackAttack(bot) {
        const hostileMobs = ['zombie', 'skeleton', 'spider', 'creeper'];
        const target = Object.values(bot.entities).find(e =>
            e.position &&
            hostileMobs.includes(e.name) &&
            e.position.distanceTo(bot.entity.position) < 5
        );

        if (target) {
            try {
                await this.utils.equipBestTool(bot);

                // Sprint toward target
                bot.setControlState('sprint', true);
                bot.setControlState('forward', true);
                await this.sleep(300);

                // Attack while sprinting for knockback
                await bot.attack(target);

                bot.clearControlStates();
            } catch (error) {
                // Knockback attack failed
            }
        }
    }

    // 180: Sweep Attack - Sword sweep for multiple targets
    async sweepAttack(bot) {
        const sword = bot.inventory.items().find(item => item.name.includes('sword'));

        if (sword) {
            try {
                await bot.equip(sword, 'hand');

                // Find multiple nearby hostiles
                const hostiles = Object.values(bot.entities).filter(e =>
                    ['zombie', 'skeleton', 'spider', 'creeper'].includes(e.name) &&
                    e.position &&
                    e.position.distanceTo(bot.entity.position) < 4
                );

                if (hostiles.length >= 2) {
                    // Sweep attack hits multiple enemies
                    // In Minecraft, sweep happens automatically with swords when not sprinting
                    await bot.attack(hostiles[0]);
                }
            } catch (error) {
                // Sweep attack failed
            }
        }
    }

    // 181: Fight Defensive - Shield + retreat pattern
    async fightDefensive(bot) {
        const shield = bot.inventory.items().find(item => item.name === 'shield');
        const hostiles = Object.values(bot.entities).filter(e =>
            ['zombie', 'skeleton', 'spider', 'creeper'].includes(e.name) &&
            e.position &&
            e.position.distanceTo(bot.entity.position) < 8
        );

        if (hostiles.length > 0) {
            try {
                // Equip shield if available
                if (shield) {
                    await bot.equip(shield, 'off-hand');
                }

                await this.utils.equipBestTool(bot);
                const target = hostiles[0];

                // Defensive pattern: attack, block, retreat
                await bot.lookAt(target.position.offset(0, 1, 0));

                if (bot.entity.position.distanceTo(target.position) < 3) {
                    // Too close - attack once and retreat
                    await bot.attack(target);
                    await this.sleep(200);

                    // Retreat
                    const escapeDir = bot.entity.position.minus(target.position).normalize();
                    const escapePos = bot.entity.position.plus(escapeDir.scaled(4));
                    bot.pathfinder.setGoal(new GoalNear(escapePos.x, escapePos.y, escapePos.z, 1), true);
                    await this.sleep(800);
                } else {
                    // Maintain distance and block
                    if (shield) {
                        bot.activateItem();
                        await this.sleep(500);
                        bot.deactivateItem();
                    }
                }
            } catch (error) {
                // Defensive fight failed
            }
        }
    }

    // 182: Fight Aggressive - Constant forward + attack
    async fightAggressive(bot) {
        const hostileMobs = ['zombie', 'skeleton', 'spider', 'creeper'];
        const target = Object.values(bot.entities).find(e =>
            e.position &&
            hostileMobs.includes(e.name) &&
            e.position.distanceTo(bot.entity.position) < 16
        );

        if (target) {
            try {
                await this.utils.equipBestTool(bot);

                // Aggressive pattern: sprint toward target and attack constantly
                bot.pathfinder.setGoal(new GoalNear(target.position.x, target.position.y, target.position.z, 2), true);

                // Sprint
                bot.setControlState('sprint', true);
                bot.setControlState('forward', true);
                await this.sleep(500);

                // Attack if in range
                if (bot.entity.position.distanceTo(target.position) < 4) {
                    await bot.attack(target);
                    await this.sleep(200);
                    await bot.attack(target);
                }

                bot.clearControlStates();
            } catch (error) {
                // Aggressive fight failed
            }
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = CombatAdvanced;
