/**
 * Project Zomboid-inspired Sub-Skills System
 * Granular skill progression with XP and leveling
 * Inspired by Project Zomboid's deep skill mechanics
 */

class SubSkillsSystem {
    constructor() {
        // Define all sub-skills with categories
        this.SKILL_DEFINITIONS = {
            // COMBAT SKILLS
            COMBAT: {
                axe_fighting: {
                    name: 'Axe Fighting',
                    description: 'Efficiency with axes in combat',
                    xpPerLevel: 100,
                    maxLevel: 10,
                    bonus: (level) => ({ damage: 1 + level * 0.15, speed: 1 + level * 0.05 })
                },
                sword_fighting: {
                    name: 'Sword Fighting',
                    description: 'Proficiency with swords',
                    xpPerLevel: 100,
                    maxLevel: 10,
                    bonus: (level) => ({ damage: 1 + level * 0.15, crit_chance: level * 0.05 })
                },
                hand_to_hand: {
                    name: 'Hand-to-Hand',
                    description: 'Unarmed combat effectiveness',
                    xpPerLevel: 80,
                    maxLevel: 10,
                    bonus: (level) => ({ damage: 1 + level * 0.10, knockback: level * 0.1 })
                },
                archery: {
                    name: 'Archery',
                    description: 'Bow accuracy and damage',
                    xpPerLevel: 120,
                    maxLevel: 10,
                    bonus: (level) => ({ accuracy: 1 + level * 0.08, damage: 1 + level * 0.12 })
                },
                critical_strike: {
                    name: 'Critical Strike',
                    description: 'Chance for devastating attacks',
                    xpPerLevel: 150,
                    maxLevel: 10,
                    bonus: (level) => ({ crit_chance: level * 0.08, crit_damage: 1 + level * 0.2 })
                }
            },

            // SURVIVAL SKILLS
            SURVIVAL: {
                fishing: {
                    name: 'Fishing',
                    description: 'Catch fish more efficiently',
                    xpPerLevel: 100,
                    maxLevel: 10,
                    bonus: (level) => ({ catch_rate: 1 + level * 0.15, quality: level * 0.1 })
                },
                foraging: {
                    name: 'Foraging',
                    description: 'Find food in the wild',
                    xpPerLevel: 90,
                    maxLevel: 10,
                    bonus: (level) => ({ find_rate: 1 + level * 0.12, variety: level })
                },
                trapping: {
                    name: 'Trapping',
                    description: 'Set and maintain traps',
                    xpPerLevel: 110,
                    maxLevel: 10,
                    bonus: (level) => ({ trap_success: 1 + level * 0.1, trap_damage: level * 0.15 })
                },
                farming: {
                    name: 'Farming',
                    description: 'Grow crops efficiently',
                    xpPerLevel: 100,
                    maxLevel: 10,
                    bonus: (level) => ({ growth_speed: 1 + level * 0.08, yield: 1 + level * 0.1 })
                },
                cooking: {
                    name: 'Cooking',
                    description: 'Prepare better food',
                    xpPerLevel: 80,
                    maxLevel: 10,
                    bonus: (level) => ({ nutrition: 1 + level * 0.15, poison_resist: level * 0.1 })
                }
            },

            // CRAFTING SKILLS
            CRAFTING: {
                mining: {
                    name: 'Mining',
                    description: 'Mine faster and find more ore',
                    xpPerLevel: 100,
                    maxLevel: 10,
                    bonus: (level) => ({ speed: 1 + level * 0.1, ore_chance: 1 + level * 0.12 })
                },
                woodcutting: {
                    name: 'Woodcutting',
                    description: 'Chop trees faster',
                    xpPerLevel: 90,
                    maxLevel: 10,
                    bonus: (level) => ({ speed: 1 + level * 0.12, wood_yield: 1 + level * 0.08 })
                },
                carpentry: {
                    name: 'Carpentry',
                    description: 'Build structures efficiently',
                    xpPerLevel: 110,
                    maxLevel: 10,
                    bonus: (level) => ({ build_speed: 1 + level * 0.1, material_save: level * 0.05 })
                },
                smithing: {
                    name: 'Smithing',
                    description: 'Craft better tools and weapons',
                    xpPerLevel: 130,
                    maxLevel: 10,
                    bonus: (level) => ({ durability: 1 + level * 0.15, quality: level * 0.1 })
                },
                engineering: {
                    name: 'Engineering',
                    description: 'Master redstone and mechanisms',
                    xpPerLevel: 140,
                    maxLevel: 10,
                    bonus: (level) => ({ efficiency: 1 + level * 0.1, complexity: level })
                }
            },

            // PHYSICAL/AGILITY SKILLS
            PHYSICAL: {
                sprinting: {
                    name: 'Sprinting',
                    description: 'Run faster and longer',
                    xpPerLevel: 80,
                    maxLevel: 10,
                    bonus: (level) => ({ speed: 1 + level * 0.08, stamina_cost: 1 - level * 0.05 })
                },
                sneaking: {
                    name: 'Sneaking',
                    description: 'Move silently and avoid detection',
                    xpPerLevel: 100,
                    maxLevel: 10,
                    bonus: (level) => ({ detection_range: 1 - level * 0.08, sound: 1 - level * 0.1 })
                },
                nimble: {
                    name: 'Nimble',
                    description: 'Dodge attacks and move gracefully',
                    xpPerLevel: 110,
                    maxLevel: 10,
                    bonus: (level) => ({ dodge_chance: level * 0.06, movement_speed: 1 + level * 0.05 })
                },
                strength: {
                    name: 'Strength',
                    description: 'Carry more and hit harder',
                    xpPerLevel: 120,
                    maxLevel: 10,
                    bonus: (level) => ({ melee_damage: 1 + level * 0.12, carry_weight: 1 + level * 0.1 })
                },
                fitness: {
                    name: 'Fitness',
                    description: 'Better stamina and health',
                    xpPerLevel: 100,
                    maxLevel: 10,
                    bonus: (level) => ({ max_health: 20 + level * 2, stamina_regen: 1 + level * 0.15 })
                }
            }
        };

        console.log('[SUBSKILLS] System initialized with', this.getTotalSkillCount(), 'skills');
    }

    /**
     * Initialize skills for an agent
     */
    initializeSkills(bot) {
        bot.subSkills = {};

        for (const [category, skills] of Object.entries(this.SKILL_DEFINITIONS)) {
            for (const [skillId, skillDef] of Object.entries(skills)) {
                bot.subSkills[skillId] = {
                    name: skillDef.name,
                    category: category,
                    level: 0,
                    xp: 0,
                    xpToNextLevel: skillDef.xpPerLevel,
                    maxLevel: skillDef.maxLevel,
                    totalActions: 0,
                    lastUsed: null
                };
            }
        }

        return bot.subSkills;
    }

    /**
     * Award XP to a skill
     */
    awardXP(bot, skillId, xpAmount, actionName = '') {
        if (!bot.subSkills || !bot.subSkills[skillId]) {
            console.warn(`[SUBSKILLS] Unknown skill: ${skillId}`);
            return false;
        }

        const skill = bot.subSkills[skillId];
        const skillDef = this.getSkillDefinition(skillId);

        if (!skillDef) return false;

        // Already max level
        if (skill.level >= skill.maxLevel) {
            return false;
        }

        // Award XP
        skill.xp += xpAmount;
        skill.totalActions++;
        skill.lastUsed = Date.now();

        // Check for level up
        let leveledUp = false;
        while (skill.xp >= skill.xpToNextLevel && skill.level < skill.maxLevel) {
            skill.xp -= skill.xpToNextLevel;
            skill.level++;
            leveledUp = true;

            // Increase XP requirement for next level (1.5x multiplier per level)
            skill.xpToNextLevel = Math.floor(skillDef.xpPerLevel * Math.pow(1.5, skill.level));

            console.log(`[SUBSKILLS] 🌟 ${bot.agentName} leveled up ${skill.name} to Level ${skill.level}!`);

            // Emit to dashboard
            if (bot.emitEvent) {
                bot.emitEvent('skillLevelUp', {
                    agent: bot.agentName,
                    skill: skill.name,
                    level: skill.level,
                    category: skill.category
                });
            }
        }

        return leveledUp;
    }

    /**
     * Get skill definition
     */
    getSkillDefinition(skillId) {
        for (const [category, skills] of Object.entries(this.SKILL_DEFINITIONS)) {
            if (skills[skillId]) {
                return skills[skillId];
            }
        }
        return null;
    }

    /**
     * Get bonus multipliers for a skill
     */
    getSkillBonus(bot, skillId) {
        if (!bot.subSkills || !bot.subSkills[skillId]) {
            return {};
        }

        const skill = bot.subSkills[skillId];
        const skillDef = this.getSkillDefinition(skillId);

        if (!skillDef || !skillDef.bonus) {
            return {};
        }

        return skillDef.bonus(skill.level);
    }

    /**
     * Get all skills by category
     */
    getSkillsByCategory(bot, category) {
        if (!bot.subSkills) return [];

        return Object.entries(bot.subSkills)
            .filter(([skillId, skill]) => skill.category === category)
            .map(([skillId, skill]) => ({ skillId, ...skill }));
    }

    /**
     * Get skill stats for dashboard
     */
    getSkillStats(bot) {
        if (!bot.subSkills) return null;

        const stats = {
            totalSkills: Object.keys(bot.subSkills).length,
            categories: {}
        };

        for (const category of Object.keys(this.SKILL_DEFINITIONS)) {
            const categorySkills = this.getSkillsByCategory(bot, category);
            stats.categories[category] = {
                skills: categorySkills,
                avgLevel: categorySkills.reduce((sum, s) => sum + s.level, 0) / categorySkills.length,
                totalActions: categorySkills.reduce((sum, s) => sum + s.totalActions, 0)
            };
        }

        return stats;
    }

    /**
     * Get total skill count
     */
    getTotalSkillCount() {
        let count = 0;
        for (const skills of Object.values(this.SKILL_DEFINITIONS)) {
            count += Object.keys(skills).length;
        }
        return count;
    }

    /**
     * Map Minecraft actions to skills for XP awards
     */
    getSkillForAction(actionName) {
        const mapping = {
            // Combat
            'attack_nearest': 'hand_to_hand',
            'fight_zombie': 'sword_fighting',
            'fight_skeleton': 'archery',
            'fight_creeper': 'sword_fighting',
            'defend_ally': 'critical_strike',

            // Survival
            'fish': 'fishing',
            'gather_food': 'foraging',
            'hunt_animal': 'trapping',
            'farm_crops': 'farming',
            'eat_food': 'cooking',

            // Crafting
            'mine_nearest_ore': 'mining',
            'mine_stone': 'mining',
            'mine_deep': 'mining',
            'chop_nearest_tree': 'woodcutting',
            'build_structure': 'carpentry',
            'place_block': 'carpentry',
            'craft_tools': 'smithing',
            'craft_weapons': 'smithing',
            'craft_pickaxe': 'smithing',
            'craft_axe': 'smithing',
            'craft_sword': 'smithing',

            // Physical
            'sprint': 'sprinting',
            'sneak': 'sneaking',
            'jump': 'nimble',
            'dig_forward': 'strength',
            'dig_down': 'strength',
            'random_walk': 'fitness'
        };

        return mapping[actionName] || null;
    }
}

// Singleton instance
let subSkillsInstance = null;

function getSubSkillsSystem() {
    if (!subSkillsInstance) {
        subSkillsInstance = new SubSkillsSystem();
    }
    return subSkillsInstance;
}

module.exports = { SubSkillsSystem, getSubSkillsSystem };
