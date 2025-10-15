/**
 * Redstone Actions (156-165)
 * Redstone mechanisms and interactive blocks
 */

const Vec3 = require('vec3');

class RedstoneActions {
    constructor(actionSpace) {
        this.actionSpace = actionSpace;
    }

    /**
     * Activate lever
     */
    async activateLever(bot) {
        const lever = bot.findBlock({
            matching: block => block.name === 'lever',
            maxDistance: 16
        });

        if (!lever) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(lever.position.x, lever.position.y, lever.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        try {
            await bot.activateBlock(lever);
            await this.actionSpace.sleep(300);
        } catch (err) {
            // Lever activation failed
        }
    }

    /**
     * Press button
     */
    async pressButton(bot) {
        const button = bot.findBlock({
            matching: block =>
                block.name.includes('button') ||
                block.name === 'stone_button' ||
                block.name === 'oak_button',
            maxDistance: 16
        });

        if (!button) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(button.position.x, button.position.y, button.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        try {
            await bot.activateBlock(button);
            await this.actionSpace.sleep(300);
        } catch (err) {
            // Button press failed
        }
    }

    /**
     * Activate pressure plate
     */
    async activatePressurePlate(bot) {
        const pressurePlate = bot.findBlock({
            matching: block =>
                block.name.includes('pressure_plate') ||
                block.name === 'stone_pressure_plate' ||
                block.name === 'oak_pressure_plate',
            maxDistance: 16
        });

        if (!pressurePlate) {
            return;
        }

        const { GoalBlock } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalBlock(pressurePlate.position.x, pressurePlate.position.y + 1, pressurePlate.position.z), true);
        await this.actionSpace.sleep(1000);
    }

    /**
     * Place redstone dust
     */
    async placeRedstone(bot) {
        const redstone = bot.inventory.items().find(item => item.name === 'redstone');

        if (!redstone) {
            return;
        }

        const placeableBlock = bot.findBlock({
            matching: block =>
                block.name !== 'air' &&
                bot.blockAt(block.position.offset(0, 1, 0))?.name === 'air',
            maxDistance: 8
        });

        if (!placeableBlock) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(placeableBlock.position.x, placeableBlock.position.y, placeableBlock.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        await bot.equip(redstone, 'hand');
        await this.actionSpace.sleep(200);

        try {
            await bot.placeBlock(placeableBlock, new Vec3(0, 1, 0));
            await this.actionSpace.sleep(300);
        } catch (err) {
            // Placement failed
        }
    }

    /**
     * Place redstone repeater
     */
    async placeRepeater(bot) {
        const repeater = bot.inventory.items().find(item => item.name === 'repeater');

        if (!repeater) {
            return;
        }

        const placeableBlock = bot.findBlock({
            matching: block =>
                block.name !== 'air' &&
                bot.blockAt(block.position.offset(0, 1, 0))?.name === 'air',
            maxDistance: 8
        });

        if (!placeableBlock) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(placeableBlock.position.x, placeableBlock.position.y, placeableBlock.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        await bot.equip(repeater, 'hand');
        await this.actionSpace.sleep(200);

        try {
            await bot.placeBlock(placeableBlock, new Vec3(0, 1, 0));
            await this.actionSpace.sleep(300);
        } catch (err) {
            // Placement failed
        }
    }

    /**
     * Open door
     */
    async openDoor(bot) {
        const door = bot.findBlock({
            matching: block =>
                block.name.includes('door') &&
                !block.name.includes('trapdoor') &&
                block.metadata < 8, // Door is closed
            maxDistance: 8
        });

        if (!door) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(door.position.x, door.position.y, door.position.z, 2), true);
        await this.actionSpace.sleep(1000);

        try {
            await bot.activateBlock(door);
            await this.actionSpace.sleep(300);
        } catch (err) {
            // Door opening failed
        }
    }

    /**
     * Close door
     */
    async closeDoor(bot) {
        const door = bot.findBlock({
            matching: block =>
                block.name.includes('door') &&
                !block.name.includes('trapdoor') &&
                block.metadata >= 8, // Door is open
            maxDistance: 8
        });

        if (!door) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(door.position.x, door.position.y, door.position.z, 2), true);
        await this.actionSpace.sleep(1000);

        try {
            await bot.activateBlock(door);
            await this.actionSpace.sleep(300);
        } catch (err) {
            // Door closing failed
        }
    }

    /**
     * Open trapdoor
     */
    async openTrapdoor(bot) {
        const trapdoor = bot.findBlock({
            matching: block => block.name.includes('trapdoor'),
            maxDistance: 8
        });

        if (!trapdoor) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(trapdoor.position.x, trapdoor.position.y, trapdoor.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        try {
            await bot.activateBlock(trapdoor);
            await this.actionSpace.sleep(300);
        } catch (err) {
            // Trapdoor operation failed
        }
    }

    /**
     * Open fence gate
     */
    async openFenceGate(bot) {
        const fenceGate = bot.findBlock({
            matching: block => block.name.includes('fence_gate'),
            maxDistance: 8
        });

        if (!fenceGate) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(fenceGate.position.x, fenceGate.position.y, fenceGate.position.z, 2), true);
        await this.actionSpace.sleep(1000);

        try {
            await bot.activateBlock(fenceGate);
            await this.actionSpace.sleep(300);
        } catch (err) {
            // Fence gate operation failed
        }
    }

    /**
     * Use hopper for item transfer
     */
    async useHopper(bot) {
        const hopper = bot.findBlock({
            matching: block => block.name === 'hopper',
            maxDistance: 16
        });

        if (!hopper) {
            return;
        }

        const { GoalNear } = require('mineflayer-pathfinder').goals;
        bot.pathfinder.setGoal(new GoalNear(hopper.position.x, hopper.position.y, hopper.position.z, 3), true);
        await this.actionSpace.sleep(1000);

        try {
            const hopperWindow = await bot.openContainer(hopper);
            await this.actionSpace.sleep(300);

            // Transfer some items if we have any
            const items = bot.inventory.items();
            if (items.length > 0 && items[0].count > 1) {
                await hopperWindow.deposit(items[0].type, null, 1);
                await this.actionSpace.sleep(300);
            }

            hopperWindow.close();
        } catch (err) {
            // Hopper operation failed
        }
    }
}

module.exports = RedstoneActions;
