/**
 * Social & Relationship Actions (346-360)
 * Building friendships, cooperation, gifting, team coordination
 */

const { goals: { GoalNear } } = require('mineflayer-pathfinder');

class SocialActions {
    constructor(utils) {
        this.utils = utils;
    }

    /**
     * Approach nearby agent for interaction
     */
    async approachAgent(bot, targetAgentName) {
        if (!global.activeAgents) {
            console.log('[Social] No active agents map available');
            return false;
        }

        const targetBot = global.activeAgents.get(targetAgentName);
        if (!targetBot || !targetBot.entity) {
            console.log(`[Social] Agent ${targetAgentName} not found`);
            return false;
        }

        try {
            const goal = new GoalNear(targetBot.entity.position.x, targetBot.entity.position.y, targetBot.entity.position.z, 3);
            await bot.pathfinder.goto(goal);

            console.log(`[Social] Approached ${targetAgentName}`);
            return true;
        } catch (err) {
            console.log(`[Social] Failed to approach ${targetAgentName}:`, err.message);
            return false;
        }
    }

    /**
     * Greet nearby agent
     */
    async greetAgent(bot, targetAgentName) {
        const greetings = [
            `Hello ${targetAgentName}!`,
            `Hi ${targetAgentName}, how are you?`,
            `Greetings ${targetAgentName}!`,
            `Hey ${targetAgentName}!`
        ];

        const greeting = greetings[Math.floor(Math.random() * greetings.length)];
        bot.chat(greeting);

        console.log(`[Social] Greeted ${targetAgentName}`);
        return true;
    }

    /**
     * Gift item to another agent
     */
    async giftItem(bot, targetAgentName, itemName) {
        const item = bot.inventory.items().find(i => i.name === itemName);

        if (!item) {
            console.log(`[Social] Don't have ${itemName} to gift`);
            return false;
        }

        // Approach agent first
        if (!await this.approachAgent(bot, targetAgentName)) {
            return false;
        }

        try {
            // Toss item near agent
            await bot.toss(item.type, null, 1);
            bot.chat(`${targetAgentName}, I'm giving you ${itemName}!`);

            console.log(`[Social] Gifted ${itemName} to ${targetAgentName}`);
            return true;
        } catch (err) {
            console.log('[Social] Failed to gift item:', err.message);
            return false;
        }
    }

    /**
     * Share resources with nearby agents
     */
    async shareResources(bot, resourceType = 'food') {
        if (!global.activeAgents) return false;

        const shareableItems = {
            'food': ['bread', 'cooked_beef', 'cooked_porkchop', 'apple'],
            'tools': ['wooden_pickaxe', 'stone_pickaxe', 'wooden_axe'],
            'materials': ['cobblestone', 'oak_log', 'coal', 'iron_ore']
        };

        const itemsToShare = shareableItems[resourceType] || shareableItems.food;

        for (const itemName of itemsToShare) {
            const item = bot.inventory.items().find(i => i.name === itemName && i.count > 1);

            if (item) {
                // Find nearby agent in need
                const nearbyAgent = this.findAgentInNeed(bot, resourceType);

                if (nearbyAgent) {
                    await this.giftItem(bot, nearbyAgent.username, itemName);
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Find agent in need of resources
     */
    findAgentInNeed(bot, resourceType) {
        if (!global.activeAgents) return null;

        const nearbyAgents = [];
        for (const [name, otherBot] of global.activeAgents) {
            if (otherBot !== bot && otherBot.entity) {
                const dist = otherBot.entity.position.distanceTo(bot.entity.position);
                if (dist < 16) {
                    // Check if they need this resource type
                    let needsResource = false;

                    if (resourceType === 'food') {
                        needsResource = otherBot.food < 10;
                    } else if (resourceType === 'tools') {
                        const hasTools = otherBot.inventory.items().some(i =>
                            i.name.includes('pickaxe') || i.name.includes('axe')
                        );
                        needsResource = !hasTools;
                    }

                    if (needsResource) {
                        nearbyAgents.push({ username: name, bot: otherBot, distance: dist });
                    }
                }
            }
        }

        // Return closest agent in need
        nearbyAgents.sort((a, b) => a.distance - b.distance);
        return nearbyAgents[0];
    }

    /**
     * Request help from nearby agents
     */
    async requestHelp(bot, helpType = 'combat') {
        const messages = {
            'combat': 'Help! I need backup in combat!',
            'resources': 'Can anyone spare some resources?',
            'food': 'I\'m hungry, does anyone have food?',
            'tools': 'Need tools, can someone help?',
            'danger': 'Danger nearby! Watch out!'
        };

        const message = messages[helpType] || 'I need help!';
        bot.chat(message);

        console.log(`[Social] Requested help: ${helpType}`);
        return true;
    }

    /**
     * Respond to agent request for help
     */
    async respondToHelp(bot, requesterName, helpType) {
        console.log(`[Social] ${requesterName} needs help: ${helpType}`);

        if (helpType === 'food') {
            return await this.giftItem(bot, requesterName, 'bread');
        } else if (helpType === 'tools') {
            const tool = bot.inventory.items().find(i =>
                i.name.includes('pickaxe') || i.name.includes('axe')
            );
            if (tool) {
                return await this.giftItem(bot, requesterName, tool.name);
            }
        } else if (helpType === 'combat') {
            return await this.approachAgent(bot, requesterName);
        }

        return false;
    }

    /**
     * Form party/team with agents
     */
    async formParty(bot, agentNames) {
        bot.chat(`Forming party with: ${agentNames.join(', ')}`);

        // Store party members
        if (!bot.party) {
            bot.party = {
                members: [bot.username, ...agentNames],
                leader: bot.username,
                objective: null
            };
        }

        console.log(`[Social] Party formed: ${bot.party.members.join(', ')}`);
        return true;
    }

    /**
     * Coordinate group attack
     */
    async coordinateGroupAttack(bot, targetEntity) {
        if (!bot.party || bot.party.members.length === 1) {
            console.log('[Social] No party to coordinate with');
            return false;
        }

        bot.chat(`Everyone attack ${targetEntity.name || 'the target'}!`);

        // Attack the target
        try {
            await bot.attack(targetEntity);
            return true;
        } catch (err) {
            return false;
        }
    }

    /**
     * Follow party leader
     */
    async followLeader(bot) {
        if (!bot.party || !bot.party.leader) {
            return false;
        }

        const leaderName = bot.party.leader;
        if (leaderName === bot.username) {
            console.log('[Social] I am the leader');
            return false;
        }

        return await this.approachAgent(bot, leaderName);
    }

    /**
     * Share discovered location
     */
    async shareLocation(bot, locationType, position) {
        const locationMessages = {
            'diamonds': `Found diamonds at ${Math.floor(position.x)}, ${Math.floor(position.y)}, ${Math.floor(position.z)}!`,
            'cave': `Found cave entrance at ${Math.floor(position.x)}, ${Math.floor(position.y)}, ${Math.floor(position.z)}`,
            'village': `Village at ${Math.floor(position.x)}, ${Math.floor(position.y)}, ${Math.floor(position.z)}!`,
            'stronghold': `STRONGHOLD at ${Math.floor(position.x)}, ${Math.floor(position.y)}, ${Math.floor(position.z)}!!!`,
            'dungeon': `Dungeon at ${Math.floor(position.x)}, ${Math.floor(position.y)}, ${Math.floor(position.z)}`
        };

        const message = locationMessages[locationType] || `Point of interest at ${Math.floor(position.x)}, ${Math.floor(position.y)}, ${Math.floor(position.z)}`;
        bot.chat(message);

        console.log(`[Social] Shared ${locationType} location`);
        return true;
    }

    /**
     * Celebrate achievement with others
     */
    async celebrate(bot, achievement) {
        const celebrations = [
            `🎉 I did it! ${achievement}!`,
            `Yes! ${achievement} complete!`,
            `${achievement} - mission accomplished!`,
            `Woohoo! ${achievement}!`
        ];

        const celebration = celebrations[Math.floor(Math.random() * celebrations.length)];
        bot.chat(celebration);

        console.log(`[Social] Celebrated: ${achievement}`);
        return true;
    }

    /**
     * Get relationship strength with agent
     */
    getRelationshipStrength(bot, agentName) {
        if (!bot.relationships) {
            bot.relationships = {};
        }

        return bot.relationships[agentName] || 0; // -100 to +100
    }

    /**
     * Improve relationship with agent
     */
    improveRelationship(bot, agentName, amount = 10) {
        if (!bot.relationships) {
            bot.relationships = {};
        }

        const current = bot.relationships[agentName] || 0;
        bot.relationships[agentName] = Math.min(100, current + amount);

        console.log(`[Social] Relationship with ${agentName}: ${bot.relationships[agentName]}`);
    }

    /**
     * Trade with another agent (not villager)
     */
    async tradeWithAgent(bot, agentName, offerItem, requestItem) {
        if (!await this.approachAgent(bot, agentName)) {
            return false;
        }

        const hasOffer = bot.inventory.items().some(i => i.name === offerItem);
        if (!hasOffer) {
            console.log(`[Social] Don't have ${offerItem} to trade`);
            return false;
        }

        bot.chat(`${agentName}, want to trade? I'll give you ${offerItem} for ${requestItem}`);

        // Wait for response (simplified - real implementation needs message handling)
        await this.utils.sleep(3000);

        console.log(`[Social] Trade proposed to ${agentName}`);
        return true;
    }

    /**
     * Apologize to agent
     */
    async apologize(bot, agentName, reason) {
        const apologies = [
            `Sorry ${agentName}, my bad!`,
            `${agentName}, I apologize for ${reason}`,
            `Oops, sorry ${agentName}!`,
            `${agentName}, forgive me!`
        ];

        const apology = apologies[Math.floor(Math.random() * apologies.length)];
        bot.chat(apology);

        console.log(`[Social] Apologized to ${agentName}`);
        return true;
    }
}

module.exports = SocialActions;
