/**
 * Agriculture Actions (141-155)
 * Farming, animal breeding, and crop management
 */

const Vec3 = require('vec3');

class AgricultureActions {
    constructor(actionSpace) {
        this.actionSpace = actionSpace;
    }

    /**
     * Plant seeds on tilled soil
     */
    async plantSeeds(bot) {
        const seeds = bot.inventory.items().find(item =>
            item.name === 'wheat_seeds' || item.name === 'carrot' ||
            item.name === 'potato' || item.name === 'beetroot_seeds'
        );

        if (!seeds) {
            return;
        }

        const farmland = bot.findBlock({
            matching: block => block.name === 'farmland',
            maxDistance: 16
        });

        if (!farmland) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(farmland.position.x, farmland.position.y, farmland.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        await bot.equip(seeds, 'hand');
        await this.actionSpace.sleep(200);

        try {
            const airAbove = bot.blockAt(farmland.position.offset(0, 1, 0));
            if (airAbove && airAbove.name === 'air') {
                await bot.placeBlock(farmland, new Vec3(0, 1, 0));
                await this.actionSpace.sleep(300);
            }
        } catch (err) {
            // Planting failed
        }
    }

    /**
     * Harvest mature wheat
     */
    async harvestWheat(bot) {
        const wheat = bot.findBlock({
            matching: block => block.name === 'wheat' && block.metadata === 7,
            maxDistance: 16
        });

        if (!wheat) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(wheat.position.x, wheat.position.y, wheat.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        try {
            await bot.dig(wheat);
            await this.actionSpace.sleep(500);
        } catch (err) {
            // Harvesting failed
        }
    }

    /**
     * Harvest mature carrots
     */
    async harvestCarrots(bot) {
        const carrots = bot.findBlock({
            matching: block => block.name === 'carrots' && block.metadata === 7,
            maxDistance: 16
        });

        if (!carrots) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(carrots.position.x, carrots.position.y, carrots.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        try {
            await bot.dig(carrots);
            await this.actionSpace.sleep(500);
        } catch (err) {
            // Harvesting failed
        }
    }

    /**
     * Harvest mature potatoes
     */
    async harvestPotatoes(bot) {
        const potatoes = bot.findBlock({
            matching: block => block.name === 'potatoes' && block.metadata === 7,
            maxDistance: 16
        });

        if (!potatoes) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(potatoes.position.x, potatoes.position.y, potatoes.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        try {
            await bot.dig(potatoes);
            await this.actionSpace.sleep(500);
        } catch (err) {
            // Harvesting failed
        }
    }

    /**
     * Breed cows with wheat
     */
    async breedCows(bot) {
        const wheat = bot.inventory.items().find(item => item.name === 'wheat');

        if (!wheat || wheat.count < 2) {
            return;
        }

        const cows = Object.values(bot.entities).filter(entity =>
            entity.type === 'mob' &&
            entity.name === 'cow' &&
            entity.position &&
            entity.position.distanceTo(bot.entity.position) < 16
        );

        if (cows.length < 2) {
            return;
        }

        await bot.equip(wheat, 'hand');
        await this.actionSpace.sleep(200);

        // Feed first cow
        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(cows[0].position.x, cows[0].position.y, cows[0].position.z, 2), true);
        await this.actionSpace.sleep(800);

        try {
            await bot.activateEntity(cows[0]);
            await this.actionSpace.sleep(500);
        } catch (err) {
            // Feeding failed
        }

        // Feed second cow
        bot.pathfinder.setGoal(new GoalNear(cows[1].position.x, cows[1].position.y, cows[1].position.z, 2), true);
        await this.actionSpace.sleep(800);

        try {
            await bot.activateEntity(cows[1]);
            await this.actionSpace.sleep(500);
        } catch (err) {
            // Feeding failed
        }
    }

    /**
     * Breed pigs with carrots
     */
    async breedPigs(bot) {
        const carrot = bot.inventory.items().find(item => item.name === 'carrot');

        if (!carrot || carrot.count < 2) {
            return;
        }

        const pigs = Object.values(bot.entities).filter(entity =>
            entity.type === 'mob' &&
            entity.name === 'pig' &&
            entity.position &&
            entity.position.distanceTo(bot.entity.position) < 16
        );

        if (pigs.length < 2) {
            return;
        }

        await bot.equip(carrot, 'hand');
        await this.actionSpace.sleep(200);

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(pigs[0].position.x, pigs[0].position.y, pigs[0].position.z, 2), true);
        await this.actionSpace.sleep(800);

        try {
            await bot.activateEntity(pigs[0]);
            await this.actionSpace.sleep(500);
        } catch (err) {
            // Feeding failed
        }

        bot.pathfinder.setGoal(new GoalNear(pigs[1].position.x, pigs[1].position.y, pigs[1].position.z, 2), true);
        await this.actionSpace.sleep(800);

        try {
            await bot.activateEntity(pigs[1]);
            await this.actionSpace.sleep(500);
        } catch (err) {
            // Feeding failed
        }
    }

    /**
     * Breed sheep with wheat
     */
    async breedSheep(bot) {
        const wheat = bot.inventory.items().find(item => item.name === 'wheat');

        if (!wheat || wheat.count < 2) {
            return;
        }

        const sheep = Object.values(bot.entities).filter(entity =>
            entity.type === 'mob' &&
            entity.name === 'sheep' &&
            entity.position &&
            entity.position.distanceTo(bot.entity.position) < 16
        );

        if (sheep.length < 2) {
            return;
        }

        await bot.equip(wheat, 'hand');
        await this.actionSpace.sleep(200);

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(sheep[0].position.x, sheep[0].position.y, sheep[0].position.z, 2), true);
        await this.actionSpace.sleep(800);

        try {
            await bot.activateEntity(sheep[0]);
            await this.actionSpace.sleep(500);
        } catch (err) {
            // Feeding failed
        }

        bot.pathfinder.setGoal(new GoalNear(sheep[1].position.x, sheep[1].position.y, sheep[1].position.z, 2), true);
        await this.actionSpace.sleep(800);

        try {
            await bot.activateEntity(sheep[1]);
            await this.actionSpace.sleep(500);
        } catch (err) {
            // Feeding failed
        }
    }

    /**
     * Breed chickens with seeds
     */
    async breedChickens(bot) {
        const seeds = bot.inventory.items().find(item =>
            item.name === 'wheat_seeds' || item.name === 'beetroot_seeds' ||
            item.name === 'melon_seeds' || item.name === 'pumpkin_seeds'
        );

        if (!seeds || seeds.count < 2) {
            return;
        }

        const chickens = Object.values(bot.entities).filter(entity =>
            entity.type === 'mob' &&
            entity.name === 'chicken' &&
            entity.position &&
            entity.position.distanceTo(bot.entity.position) < 16
        );

        if (chickens.length < 2) {
            return;
        }

        await bot.equip(seeds, 'hand');
        await this.actionSpace.sleep(200);

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(chickens[0].position.x, chickens[0].position.y, chickens[0].position.z, 2), true);
        await this.actionSpace.sleep(800);

        try {
            await bot.activateEntity(chickens[0]);
            await this.actionSpace.sleep(500);
        } catch (err) {
            // Feeding failed
        }

        bot.pathfinder.setGoal(new GoalNear(chickens[1].position.x, chickens[1].position.y, chickens[1].position.z, 2), true);
        await this.actionSpace.sleep(800);

        try {
            await bot.activateEntity(chickens[1]);
            await this.actionSpace.sleep(500);
        } catch (err) {
            // Feeding failed
        }
    }

    /**
     * Shear sheep for wool
     */
    async shearSheep(bot) {
        const shears = bot.inventory.items().find(item => item.name === 'shears');

        if (!shears) {
            return;
        }

        const sheep = Object.values(bot.entities).filter(entity =>
            entity.type === 'mob' &&
            entity.name === 'sheep' &&
            entity.position &&
            entity.position.distanceTo(bot.entity.position) < 16 &&
            !entity.metadata || entity.metadata[16] !== 1 // Not sheared
        );

        if (sheep.length === 0) {
            return;
        }

        const targetSheep = sheep[0];

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(targetSheep.position.x, targetSheep.position.y, targetSheep.position.z, 2), true);
        await this.actionSpace.sleep(1000);

        await bot.equip(shears, 'hand');
        await this.actionSpace.sleep(200);

        try {
            await bot.activateEntity(targetSheep);
            await this.actionSpace.sleep(500);
        } catch (err) {
            // Shearing failed
        }
    }

    /**
     * Milk cow with bucket
     */
    async milkCow(bot) {
        const bucket = bot.inventory.items().find(item => item.name === 'bucket');

        if (!bucket) {
            return;
        }

        const cows = Object.values(bot.entities).filter(entity =>
            entity.type === 'mob' &&
            entity.name === 'cow' &&
            entity.position &&
            entity.position.distanceTo(bot.entity.position) < 16
        );

        if (cows.length === 0) {
            return;
        }

        const cow = cows[0];

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(cow.position.x, cow.position.y, cow.position.z, 2), true);
        await this.actionSpace.sleep(1000);

        await bot.equip(bucket, 'hand');
        await this.actionSpace.sleep(200);

        try {
            await bot.activateEntity(cow);
            await this.actionSpace.sleep(500);
        } catch (err) {
            // Milking failed
        }
    }

    /**
     * Use bone meal on crops
     */
    async useBoneMeal(bot) {
        const boneMeal = bot.inventory.items().find(item => item.name === 'bone_meal');

        if (!boneMeal) {
            return;
        }

        const crop = bot.findBlock({
            matching: block =>
                (block.name === 'wheat' || block.name === 'carrots' || block.name === 'potatoes') &&
                block.metadata < 7,
            maxDistance: 16
        });

        if (!crop) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(crop.position.x, crop.position.y, crop.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        await bot.equip(boneMeal, 'hand');
        await this.actionSpace.sleep(200);

        try {
            await bot.activateBlock(crop);
            await this.actionSpace.sleep(300);
        } catch (err) {
            // Bone meal application failed
        }
    }

    /**
     * Till soil with hoe
     */
    async tillSoil(bot) {
        const hoe = bot.inventory.items().find(item => item.name.includes('hoe'));

        if (!hoe) {
            return;
        }

        const dirt = bot.findBlock({
            matching: block =>
                (block.name === 'dirt' || block.name === 'grass_block') &&
                bot.blockAt(block.position.offset(0, 1, 0))?.name === 'air',
            maxDistance: 16
        });

        if (!dirt) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(dirt.position.x, dirt.position.y, dirt.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        await bot.equip(hoe, 'hand');
        await this.actionSpace.sleep(200);

        try {
            await bot.activateBlock(dirt);
            await this.actionSpace.sleep(300);
        } catch (err) {
            // Tilling failed
        }
    }

    /**
     * Create farm plot
     */
    async createFarmPlot(bot) {
        const hoe = bot.inventory.items().find(item => item.name.includes('hoe'));

        if (!hoe) {
            return;
        }

        const startPos = bot.entity.position.floored();
        const plotPositions = [];

        // Create 3x3 farm plot
        for (let x = -1; x <= 1; x++) {
            for (let z = -1; z <= 1; z++) {
                plotPositions.push(startPos.offset(x, 0, z));
            }
        }

        await bot.equip(hoe, 'hand');

        for (const pos of plotPositions) {
            const block = bot.blockAt(pos);
            if (block && (block.name === 'dirt' || block.name === 'grass_block')) {
                try {
                    const { GoalNear } = require('mineflayer-pathfinder').goals;
                    bot.pathfinder.setGoal(new GoalNear(pos.x, pos.y, pos.z, 3), true);
                    await this.actionSpace.sleep(300);

                    await bot.activateBlock(block);
                    await this.actionSpace.sleep(200);
                } catch (err) {
                    // Tilling failed
                }
            }
        }
    }

    /**
     * Find water source for farm
     */
    async findWaterSource(bot) {
        const water = bot.findBlock({
            matching: block => block.name === 'water',
            maxDistance: 32
        });

        if (!water) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(water.position.x, water.position.y, water.position.z, 3), true);
        await this.actionSpace.sleep(1000);
    }

    /**
     * Collect eggs from chickens
     */
    async collectEggs(bot) {
        const eggs = Object.values(bot.entities).filter(entity =>
            entity.type === 'object' &&
            entity.displayName === 'Item' &&
            entity.metadata &&
            entity.metadata[8]?.itemId === bot.registry.itemsByName.egg?.id &&
            entity.position &&
            entity.position.distanceTo(bot.entity.position) < 16
        );

        if (eggs.length === 0) {
            return;
        }

        const nearestEgg = eggs[0];

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(nearestEgg.position.x, nearestEgg.position.y, nearestEgg.position.z, 1), true);
        await this.actionSpace.sleep(1000);
    }
}

module.exports = AgricultureActions;
