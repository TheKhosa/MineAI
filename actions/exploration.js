/**
 * Exploration Actions (376-390)
 * Systematic chunk exploration, POI marking, cave diving, biome hunting
 */

const Vec3 = require('vec3');
const { goals: { GoalNear, GoalXZ } } = require('mineflayer-pathfinder');

class ExplorationActions {
    constructor(utils) {
        this.utils = utils;
        this.exploredChunks = new Set();
        this.pointsOfInterest = [];
    }

    /**
     * Explore nearest unexplored chunk
     */
    async exploreNearestChunk(bot) {
        const currentChunk = this.getCurrentChunk(bot);
        const unexploredChunks = this.findUnexploredChunks(currentChunk, 5);

        if (unexploredChunks.length === 0) {
            console.log('[Exploration] No nearby unexplored chunks');
            return false;
        }

        const targetChunk = unexploredChunks[0];
        const worldPos = new Vec3(targetChunk.x * 16 + 8, bot.entity.position.y, targetChunk.z * 16 + 8);

        try {
            const goal = new GoalXZ(worldPos.x, worldPos.z);
            await bot.pathfinder.goto(goal);

            this.exploredChunks.add(`${targetChunk.x},${targetChunk.z}`);
            console.log(`[Exploration] Explored chunk ${targetChunk.x}, ${targetChunk.z}`);
            return true;
        } catch (err) {
            console.log('[Exploration] Failed to reach chunk:', err.message);
            return false;
        }
    }

    getCurrentChunk(bot) {
        return {
            x: Math.floor(bot.entity.position.x / 16),
            z: Math.floor(bot.entity.position.z / 16)
        };
    }

    findUnexploredChunks(centerChunk, radius) {
        const unexplored = [];

        for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
                const chunkX = centerChunk.x + dx;
                const chunkZ = centerChunk.z + dz;
                const key = `${chunkX},${chunkZ}`;

                if (!this.exploredChunks.has(key)) {
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    unexplored.push({ x: chunkX, z: chunkZ, distance: dist });
                }
            }
        }

        unexplored.sort((a, b) => a.distance - b.distance);
        return unexplored;
    }

    /**
     * Mark point of interest
     */
    markPOI(bot, type, description) {
        const poi = {
            type,
            description,
            position: bot.entity.position.clone(),
            timestamp: Date.now()
        };

        this.pointsOfInterest.push(poi);
        console.log(`[Exploration] Marked POI: ${type} - ${description}`);
        return true;
    }

    /**
     * Find cave entrance
     */
    async findCaveEntrance(bot) {
        const caves = [];

        // Scan for exposed cave openings
        for (let angle = 0; angle < 360; angle += 45) {
            const rad = angle * Math.PI / 180;
            const checkPos = bot.entity.position.offset(
                Math.cos(rad) * 16,
                -5,
                Math.sin(rad) * 16
            ).floored();

            const block = bot.blockAt(checkPos);
            if (block && block.name === 'air') {
                const below = bot.blockAt(checkPos.offset(0, -1, 0));
                if (below && below.name === 'air') {
                    caves.push(checkPos);
                }
            }
        }

        if (caves.length > 0) {
            await this.markPOI(bot, 'cave', 'Cave entrance found');
            return caves[0];
        }

        return null;
    }

    /**
     * Explore cave system
     */
    async exploreCave(bot, duration = 60000) {
        console.log('[Exploration] Cave exploration started');
        const startTime = Date.now();

        while (Date.now() - startTime < duration) {
            // Move to dark/unexplored areas
            const darkSpots = bot.findBlocks({
                matching: block => block.name === 'air',
                maxDistance: 32,
                count: 10
            });

            if (darkSpots.length > 0) {
                const target = bot.blockAt(darkSpots[0]);
                try {
                    const goal = new GoalNear(target.position.x, target.position.y, target.position.z, 2);
                    await bot.pathfinder.goto(goal);
                } catch (err) {
                    // Try next spot
                }
            }

            await this.utils.sleep(1000);
        }

        console.log('[Exploration] Cave exploration complete');
        return true;
    }

    /**
     * Hunt for specific biome
     */
    async huntBiome(bot, targetBiome) {
        console.log(`[Exploration] Hunting for ${targetBiome} biome`);

        for (let attempt = 0; attempt < 10; attempt++) {
            const randomAngle = Math.random() * Math.PI * 2;
            const distance = 64;
            const targetPos = bot.entity.position.offset(
                Math.cos(randomAngle) * distance,
                0,
                Math.sin(randomAngle) * distance
            );

            try {
                const goal = new GoalXZ(targetPos.x, targetPos.z);
                await bot.pathfinder.goto(goal);

                const currentBiome = bot.blockAt(bot.entity.position)?.biome;
                if (currentBiome && currentBiome.name.includes(targetBiome)) {
                    await this.markPOI(bot, 'biome', `${targetBiome} biome`);
                    console.log(`[Exploration] Found ${targetBiome}!`);
                    return true;
                }
            } catch (err) {
                // Try next direction
            }
        }

        return false;
    }

    /**
     * Spiral search pattern
     */
    async spiralSearch(bot, radius = 64) {
        let angle = 0;
        let dist = 8;

        while (dist < radius) {
            const targetX = bot.entity.position.x + Math.cos(angle) * dist;
            const targetZ = bot.entity.position.z + Math.sin(angle) * dist;

            try {
                const goal = new GoalXZ(targetX, targetZ);
                await bot.pathfinder.goto(goal);
            } catch (err) {
                // Continue spiral
            }

            angle += Math.PI / 4; // 45 degrees
            dist += 2;

            await this.utils.sleep(100);
        }

        return true;
    }

    /**
     * Return to previously marked POI
     */
    async returnToPOI(bot, poiType) {
        const pois = this.pointsOfInterest.filter(p => p.type === poiType);

        if (pois.length === 0) {
            console.log(`[Exploration] No ${poiType} POIs marked`);
            return false;
        }

        // Go to most recent
        const targetPOI = pois[pois.length - 1];

        try {
            const goal = new GoalNear(targetPOI.position.x, targetPOI.position.y, targetPOI.position.z, 3);
            await bot.pathfinder.goto(goal);

            console.log(`[Exploration] Returned to ${poiType} POI`);
            return true;
        } catch (err) {
            console.log('[Exploration] Failed to return to POI');
            return false;
        }
    }

    /**
     * Map surrounding area
     */
    async mapArea(bot, radius = 32) {
        const mapData = {
            chunks: [],
            biomes: new Set(),
            structures: [],
            resources: []
        };

        // Explore in a grid pattern
        for (let x = -radius; x <= radius; x += 16) {
            for (let z = -radius; z <= radius; z += 16) {
                const pos = bot.entity.position.offset(x, 0, z);
                const chunkKey = `${Math.floor(pos.x / 16)},${Math.floor(pos.z / 16)}`;

                mapData.chunks.push(chunkKey);

                const block = bot.blockAt(pos);
                if (block?.biome) {
                    mapData.biomes.add(block.biome.name);
                }
            }
        }

        console.log(`[Exploration] Mapped ${mapData.chunks.length} chunks, ${mapData.biomes.size} biomes`);
        return mapData;
    }

    getExplorationProgress() {
        return {
            chunksExplored: this.exploredChunks.size,
            poisMarked: this.pointsOfInterest.length
        };
    }
}

module.exports = ExplorationActions;
