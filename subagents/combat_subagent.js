/**
 * Combat Subagent
 * Handles all combat-related behaviors (hunting, guarding, fighting)
 */

const { BaseSubagent } = require('./base_subagent');

class CombatSubagent extends BaseSubagent {
    constructor(bot, config) {
        super(bot, 'COMBAT', config);

        this.hostileMobs = [
            'zombie',
            'skeleton',
            'spider',
            'creeper',
            'enderman',
            'witch',
            'blaze',
            'ghast',
            'slime'
        ];

        this.guardRadius = 32;
        this.currentTarget = null;
        this.killCount = 0;
    }

    async behaviorLoop() {
        while (this.isActive) {
            try {
                // Check if we have a weapon
                if (!this.hasTool('sword') && !this.hasTool('axe')) {
                    this.log('No weapon found, crafting one...');
                    await this.craftWeapon();
                }

                // Find nearest hostile mob
                const target = this.findNearestHostile();

                if (target) {
                    this.log(`Engaging ${target.name || target.displayName} at distance ${target.position.distanceTo(this.bot.entity.position).toFixed(1)}`);

                    // Equip weapon
                    await this.equipWeapon();

                    // Attack the mob
                    await this.attackTarget(target);

                } else {
                    // No enemies - patrol or idle
                    await this.patrol();
                }

                // Small delay
                await this.sleep(1000);

            } catch (error) {
                console.error(`[COMBAT SUBAGENT] Error:`, error.message);
                await this.sleep(5000);
            }
        }
    }

    /**
     * Find nearest hostile mob
     */
    findNearestHostile() {
        if (!this.bot.entity) return null;

        let nearest = null;
        let nearestDistance = Infinity;

        for (const entity of Object.values(this.bot.entities)) {
            if (!entity.position) continue;

            const distance = entity.position.distanceTo(this.bot.entity.position);

            // Check if it's a hostile mob
            const mobName = entity.name?.toLowerCase() || entity.displayName?.toLowerCase() || '';

            if (this.hostileMobs.some(hostile => mobName.includes(hostile)) && distance < this.guardRadius) {
                if (distance < nearestDistance) {
                    nearest = entity;
                    nearestDistance = distance;
                }
            }
        }

        return nearest;
    }

    /**
     * Equip best weapon
     */
    async equipWeapon() {
        const weapons = this.bot.inventory.items().filter(item =>
            item.name.includes('sword') ||
            item.name.includes('axe')
        );

        if (weapons.length > 0) {
            // Sort by material quality (diamond > iron > stone > wood)
            const priority = { diamond: 4, iron: 3, stone: 2, wooden: 1 };

            weapons.sort((a, b) => {
                const aPriority = priority[a.name.split('_')[0]] || 0;
                const bPriority = priority[b.name.split('_')[0]] || 0;
                return bPriority - aPriority;
            });

            await this.bot.equip(weapons[0], 'hand');
        }
    }

    /**
     * Attack target
     */
    async attackTarget(target) {
        this.currentTarget = target;

        try {
            // Move closer if too far
            const distance = target.position.distanceTo(this.bot.entity.position);

            if (distance > 4) {
                await this.moveTo(target.position, 3);
            }

            // Attack until dead
            while (target.isValid && !target.metadata[6]) { // metadata[6] is health
                this.bot.attack(target);

                // Strafe to avoid damage
                if (Math.random() > 0.5) {
                    this.bot.setControlState('left', true);
                    await this.sleep(200);
                    this.bot.setControlState('left', false);
                } else {
                    this.bot.setControlState('right', true);
                    await this.sleep(200);
                    this.bot.setControlState('right', false);
                }

                await this.sleep(500);
            }

            // Target defeated
            this.log(`Defeated ${target.name || target.displayName}`);
            this.killCount++;
            this.bot.rewards.addReward(this.config.rewards.mob_kill || 50, `killed ${target.name}`);
            this.bot.rewards.incrementStat('mobs_killed', 1);

            // Collect drops
            await this.collectNearbyItems();

        } catch (error) {
            this.log(`Combat error: ${error.message}`);
        } finally {
            this.currentTarget = null;
        }
    }

    /**
     * Craft a basic weapon
     */
    async craftWeapon() {
        const hasSticks = this.bot.inventory.items().some(item => item.name === 'stick');
        const hasCobble = this.bot.inventory.items().some(item => item.name === 'cobblestone');

        if (hasSticks && hasCobble) {
            try {
                const craftingTable = this.findNearestBlock('crafting_table', 64);

                if (craftingTable) {
                    await this.moveTo(craftingTable.position, 3);

                    // Craft stone sword
                    const mcData = require('minecraft-data')(this.bot.version);
                    const recipe = this.bot.recipesFor(mcData.itemsByName['stone_sword'].id)[0];

                    if (recipe) {
                        await this.bot.craft(recipe, 1, craftingTable);
                        this.log('Crafted stone sword');
                        this.bot.rewards.addReward(this.config.rewards.weapon_crafted || 30, 'crafted sword');
                    }
                }
            } catch (error) {
                this.log('Failed to craft weapon: ' + error.message);
            }
        }
    }

    /**
     * Patrol around area
     */
    async patrol() {
        // Random patrol
        const angle = Math.random() * Math.PI * 2;
        const distance = 15;
        const targetX = this.bot.entity.position.x + Math.cos(angle) * distance;
        const targetZ = this.bot.entity.position.z + Math.sin(angle) * distance;

        await this.moveTo({
            x: targetX,
            y: this.bot.entity.position.y,
            z: targetZ
        }, 2);
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Execute specific combat task
     */
    async executeTask(task) {
        switch (task.type) {
            case 'attack':
                if (task.target) {
                    await this.attackTarget(task.target);
                }
                break;

            case 'patrol':
                await this.patrol();
                break;

            case 'guard':
                // Stay in position and watch for threats
                const threat = this.findNearestHostile();
                if (threat) await this.attackTarget(threat);
                break;

            default:
                this.log(`Unknown task type: ${task.type}`);
        }
    }
}

module.exports = { CombatSubagent };
