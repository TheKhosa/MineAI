/**
 * Project Zomboid-inspired Moodles (Status Effects/Debuffs) System
 * Affects agent behavior, stats, and survival
 */

class MoodlesSystem {
    constructor() {
        // Define all moodle types with severity levels
        this.MOODLE_DEFINITIONS = {
            // PHYSICAL MOODLES
            PHYSICAL: {
                hungry: {
                    name: 'Hungry',
                    icon: '🍖',
                    description: 'Need food urgently',
                    severity: [
                        { level: 0, threshold: 0.8, effects: {} }, // Well fed
                        { level: 1, threshold: 0.5, effects: { speed: 0.95, strength: 0.95 } }, // Peckish
                        { level: 2, threshold: 0.3, effects: { speed: 0.85, strength: 0.85, health_regen: -0.1 } }, // Hungry
                        { level: 3, threshold: 0.1, effects: { speed: 0.7, strength: 0.7, health_regen: -0.3 } }, // Very Hungry
                        { level: 4, threshold: 0.0, effects: { speed: 0.5, strength: 0.5, health_regen: -0.5, health_drain: 0.05 } } // Starving
                    ]
                },
                thirsty: {
                    name: 'Thirsty',
                    icon: '💧',
                    description: 'Need water urgently',
                    severity: [
                        { level: 0, threshold: 0.7, effects: {} },
                        { level: 1, threshold: 0.5, effects: { stamina_regen: 0.9 } },
                        { level: 2, threshold: 0.3, effects: { stamina_regen: 0.7, max_stamina: 0.85 } },
                        { level: 3, threshold: 0.1, effects: { stamina_regen: 0.5, max_stamina: 0.6, confusion: 0.2 } },
                        { level: 4, threshold: 0.0, effects: { stamina_regen: 0.3, max_stamina: 0.4, confusion: 0.5, health_drain: 0.08 } }
                    ]
                },
                tired: {
                    name: 'Tired',
                    icon: '😴',
                    description: 'Need rest',
                    severity: [
                        { level: 0, threshold: 0.7, effects: {} },
                        { level: 1, threshold: 0.5, effects: { accuracy: 0.95, focus: 0.95 } },
                        { level: 2, threshold: 0.3, effects: { accuracy: 0.85, focus: 0.8, speed: 0.95 } },
                        { level: 3, threshold: 0.1, effects: { accuracy: 0.7, focus: 0.6, speed: 0.85, vision: 0.9 } },
                        { level: 4, threshold: 0.0, effects: { accuracy: 0.5, focus: 0.4, speed: 0.7, vision: 0.7, pass_out_risk: 0.1 } }
                    ]
                },
                injured: {
                    name: 'Injured',
                    icon: '🩹',
                    description: 'Wounded and in pain',
                    severity: [
                        { level: 0, threshold: 0.95, effects: {} },
                        { level: 1, threshold: 0.75, effects: { speed: 0.95, pain: 0.1 } },
                        { level: 2, threshold: 0.5, effects: { speed: 0.85, strength: 0.9, pain: 0.3, bleeding: 0.1 } },
                        { level: 3, threshold: 0.25, effects: { speed: 0.7, strength: 0.75, pain: 0.6, bleeding: 0.2, infection_risk: 0.1 } },
                        { level: 4, threshold: 0.1, effects: { speed: 0.5, strength: 0.5, pain: 1.0, bleeding: 0.4, infection_risk: 0.3 } }
                    ]
                },
                sick: {
                    name: 'Sick',
                    icon: '🤢',
                    description: 'Feeling ill',
                    severity: [
                        { level: 0, threshold: 0.9, effects: {} },
                        { level: 1, threshold: 0.7, effects: { stamina: 0.95, nausea: 0.1 } },
                        { level: 2, threshold: 0.5, effects: { stamina: 0.8, strength: 0.9, nausea: 0.3, fever: 0.2 } },
                        { level: 3, threshold: 0.3, effects: { stamina: 0.6, strength: 0.7, nausea: 0.6, fever: 0.5, vomit_risk: 0.2 } },
                        { level: 4, threshold: 0.0, effects: { stamina: 0.4, strength: 0.5, nausea: 1.0, fever: 0.8, vomit_risk: 0.5, health_drain: 0.03 } }
                    ]
                },
                bleeding: {
                    name: 'Bleeding',
                    icon: '🩸',
                    description: 'Losing blood',
                    severity: [
                        { level: 0, threshold: 0.0, effects: {} },
                        { level: 1, threshold: 0.2, effects: { health_drain: 0.02 } },
                        { level: 2, threshold: 0.4, effects: { health_drain: 0.05, weakness: 0.1 } },
                        { level: 3, threshold: 0.6, effects: { health_drain: 0.1, weakness: 0.3, vision: 0.9 } },
                        { level: 4, threshold: 0.8, effects: { health_drain: 0.2, weakness: 0.5, vision: 0.7, pass_out_risk: 0.2 } }
                    ]
                },
                poisoned: {
                    name: 'Poisoned',
                    icon: '☠️',
                    description: 'Suffering from poison',
                    severity: [
                        { level: 0, threshold: 0.0, effects: {} },
                        { level: 1, threshold: 0.2, effects: { health_drain: 0.03, nausea: 0.2 } },
                        { level: 2, threshold: 0.4, effects: { health_drain: 0.06, nausea: 0.4, confusion: 0.2 } },
                        { level: 3, threshold: 0.6, effects: { health_drain: 0.1, nausea: 0.7, confusion: 0.4, weakness: 0.3 } },
                        { level: 4, threshold: 0.8, effects: { health_drain: 0.15, nausea: 1.0, confusion: 0.7, weakness: 0.6 } }
                    ]
                }
            },

            // MENTAL MOODLES
            MENTAL: {
                panicked: {
                    name: 'Panicked',
                    icon: '😱',
                    description: 'Overwhelmed with fear',
                    severity: [
                        { level: 0, threshold: 0.2, effects: {} },
                        { level: 1, threshold: 0.4, effects: { accuracy: 0.9, focus: 0.9 } },
                        { level: 2, threshold: 0.6, effects: { accuracy: 0.75, focus: 0.7, speed: 1.1 } }, // Adrenaline boost
                        { level: 3, threshold: 0.8, effects: { accuracy: 0.6, focus: 0.5, speed: 1.15, tunnel_vision: 0.3 } },
                        { level: 4, threshold: 0.9, effects: { accuracy: 0.4, focus: 0.3, speed: 1.2, tunnel_vision: 0.6, flee_chance: 0.5 } }
                    ]
                },
                stressed: {
                    name: 'Stressed',
                    icon: '😰',
                    description: 'Under pressure',
                    severity: [
                        { level: 0, threshold: 0.3, effects: {} },
                        { level: 1, threshold: 0.5, effects: { focus: 0.95, happiness: 0.95 } },
                        { level: 2, threshold: 0.7, effects: { focus: 0.85, happiness: 0.85, irritability: 0.2 } },
                        { level: 3, threshold: 0.85, effects: { focus: 0.7, happiness: 0.7, irritability: 0.4, stamina_regen: 0.9 } },
                        { level: 4, threshold: 0.95, effects: { focus: 0.5, happiness: 0.5, irritability: 0.7, stamina_regen: 0.7, health_regen: 0.9 } }
                    ]
                },
                anxious: {
                    name: 'Anxious',
                    icon: '😟',
                    description: 'Worried and nervous',
                    severity: [
                        { level: 0, threshold: 0.3, effects: {} },
                        { level: 1, threshold: 0.5, effects: { focus: 0.95, sleep_quality: 0.9 } },
                        { level: 2, threshold: 0.7, effects: { focus: 0.85, sleep_quality: 0.75, hand_tremor: 0.1 } },
                        { level: 3, threshold: 0.85, effects: { focus: 0.7, sleep_quality: 0.5, hand_tremor: 0.3, appetite: 0.8 } },
                        { level: 4, threshold: 0.95, effects: { focus: 0.5, sleep_quality: 0.3, hand_tremor: 0.5, appetite: 0.5 } }
                    ]
                },
                depressed: {
                    name: 'Depressed',
                    icon: '😔',
                    description: 'Feeling hopeless',
                    severity: [
                        { level: 0, threshold: 0.3, effects: {} },
                        { level: 1, threshold: 0.5, effects: { motivation: 0.9, energy: 0.95 } },
                        { level: 2, threshold: 0.7, effects: { motivation: 0.75, energy: 0.85, appetite: 0.9 } },
                        { level: 3, threshold: 0.85, effects: { motivation: 0.6, energy: 0.7, appetite: 0.7, social_desire: 0.5 } },
                        { level: 4, threshold: 0.95, effects: { motivation: 0.4, energy: 0.5, appetite: 0.5, social_desire: 0.3, give_up_chance: 0.1 } }
                    ]
                }
            },

            // ENVIRONMENTAL MOODLES
            ENVIRONMENTAL: {
                cold: {
                    name: 'Cold',
                    icon: '🥶',
                    description: 'Freezing temperature',
                    severity: [
                        { level: 0, threshold: 0.2, effects: {} },
                        { level: 1, threshold: 0.4, effects: { speed: 0.95, dexterity: 0.95 } },
                        { level: 2, threshold: 0.6, effects: { speed: 0.85, dexterity: 0.85, stamina_regen: 0.9, shivering: 0.2 } },
                        { level: 3, threshold: 0.8, effects: { speed: 0.7, dexterity: 0.7, stamina_regen: 0.7, shivering: 0.5, health_drain: 0.02 } },
                        { level: 4, threshold: 0.95, effects: { speed: 0.5, dexterity: 0.5, stamina_regen: 0.5, shivering: 1.0, health_drain: 0.05, hypothermia: 0.3 } }
                    ]
                },
                hot: {
                    name: 'Hot',
                    icon: '🥵',
                    description: 'Overheating',
                    severity: [
                        { level: 0, threshold: 0.2, effects: {} },
                        { level: 1, threshold: 0.4, effects: { thirst_rate: 1.2, sweating: 0.1 } },
                        { level: 2, threshold: 0.6, effects: { thirst_rate: 1.5, sweating: 0.3, fatigue: 0.1 } },
                        { level: 3, threshold: 0.8, effects: { thirst_rate: 2.0, sweating: 0.6, fatigue: 0.3, dizziness: 0.2 } },
                        { level: 4, threshold: 0.95, effects: { thirst_rate: 3.0, sweating: 1.0, fatigue: 0.6, dizziness: 0.5, heatstroke_risk: 0.2 } }
                    ]
                },
                wet: {
                    name: 'Wet',
                    icon: '💦',
                    description: 'Soaked and uncomfortable',
                    severity: [
                        { level: 0, threshold: 0.2, effects: {} },
                        { level: 1, threshold: 0.4, effects: { comfort: 0.9, cold_resist: 0.9 } },
                        { level: 2, threshold: 0.6, effects: { comfort: 0.75, cold_resist: 0.75, sick_risk: 0.1 } },
                        { level: 3, threshold: 0.8, effects: { comfort: 0.6, cold_resist: 0.6, sick_risk: 0.3, movement_noise: 1.2 } },
                        { level: 4, threshold: 0.95, effects: { comfort: 0.4, cold_resist: 0.4, sick_risk: 0.6, movement_noise: 1.5 } }
                    ]
                },
                dark: {
                    name: 'In Darkness',
                    icon: '🌑',
                    description: 'Cannot see well',
                    severity: [
                        { level: 0, threshold: 0.3, effects: {} },
                        { level: 1, threshold: 0.5, effects: { vision: 0.8, anxiety: 0.1 } },
                        { level: 2, threshold: 0.7, effects: { vision: 0.6, anxiety: 0.2, accuracy: 0.9 } },
                        { level: 3, threshold: 0.85, effects: { vision: 0.4, anxiety: 0.4, accuracy: 0.75, panic_risk: 0.1 } },
                        { level: 4, threshold: 0.95, effects: { vision: 0.2, anxiety: 0.7, accuracy: 0.5, panic_risk: 0.3 } }
                    ]
                }
            }
        };

        console.log('[MOODLES] System initialized with', this.getTotalMoodleCount(), 'moodle types');
    }

    /**
     * Initialize moodles for an agent
     */
    initializeMoodles(bot) {
        bot.moodles = {};
        bot.moodleValues = {}; // Store the underlying values that trigger moodles

        // Initialize all moodle values
        bot.moodleValues = {
            hunger: 1.0,      // 1.0 = full, 0.0 = starving
            thirst: 1.0,      // 1.0 = hydrated, 0.0 = dehydrated
            tiredness: 0.0,   // 0.0 = well rested, 1.0 = exhausted
            health_ratio: 1.0, // bot.health / 20
            sickness: 0.0,    // 0.0 = healthy, 1.0 = very sick
            bleeding_amount: 0.0, // 0.0 = no bleeding, 1.0 = severe
            poison_level: 0.0,    // 0.0 = no poison, 1.0 = severe poison
            panic_level: 0.0,     // 0.0 = calm, 1.0 = terrified
            stress_level: 0.0,    // 0.0 = relaxed, 1.0 = very stressed
            anxiety_level: 0.0,   // 0.0 = confident, 1.0 = very anxious
            depression: 0.0,      // 0.0 = happy, 1.0 = very depressed
            temperature: 0.5,     // 0.0 = freezing, 0.5 = comfortable, 1.0 = very hot
            wetness: 0.0,         // 0.0 = dry, 1.0 = soaked
            darkness: 0.0         // 0.0 = bright, 1.0 = pitch black
        };

        return bot.moodles;
    }

    /**
     * Update moodles based on current values
     */
    updateMoodles(bot) {
        if (!bot.moodleValues) {
            this.initializeMoodles(bot);
        }

        // Map values to moodles
        const valuesToMoodles = {
            hunger: 'hungry',
            thirst: 'thirsty',
            tiredness: 'tired',
            health_ratio: 'injured',
            sickness: 'sick',
            bleeding_amount: 'bleeding',
            poison_level: 'poisoned',
            panic_level: 'panicked',
            stress_level: 'stressed',
            anxiety_level: 'anxious',
            depression: 'depressed',
            temperature: ['cold', 'hot'], // Special case - two moodles
            wetness: 'wet',
            darkness: 'dark'
        };

        bot.moodles = {};

        for (const [valueKey, moodleId] of Object.entries(valuesToMoodles)) {
            const value = bot.moodleValues[valueKey];

            // Handle temperature (two moodles)
            if (valueKey === 'temperature') {
                if (value < 0.5) {
                    const coldValue = 1.0 - (value * 2); // 0.5 → 0.0, 0.0 → 1.0
                    this.setMoodle(bot, 'cold', coldValue);
                } else if (value > 0.5) {
                    const hotValue = (value - 0.5) * 2; // 0.5 → 0.0, 1.0 → 1.0
                    this.setMoodle(bot, 'hot', hotValue);
                }
            } else {
                this.setMoodle(bot, moodleId, value);
            }
        }

        return bot.moodles;
    }

    /**
     * Set a specific moodle based on value
     */
    setMoodle(bot, moodleId, value) {
        const moodleDef = this.getMoodleDefinition(moodleId);
        if (!moodleDef) return;

        // Find severity level
        let severityLevel = 0;
        for (const severity of moodleDef.severity) {
            if (value >= severity.threshold) {
                severityLevel = severity.level;
                break;
            }
        }

        // Only add moodle if severity > 0
        if (severityLevel > 0) {
            const severity = moodleDef.severity.find(s => s.level === severityLevel);
            bot.moodles[moodleId] = {
                name: moodleDef.name,
                icon: moodleDef.icon,
                description: moodleDef.description,
                severity: severityLevel,
                value: value,
                effects: severity.effects
            };
        }
    }

    /**
     * Get moodle definition
     */
    getMoodleDefinition(moodleId) {
        for (const [category, moodles] of Object.entries(this.MOODLE_DEFINITIONS)) {
            if (moodles[moodleId]) {
                return moodles[moodleId];
            }
        }
        return null;
    }

    /**
     * Get combined effects from all active moodles
     */
    getCombinedEffects(bot) {
        if (!bot.moodles) return {};

        const combined = {};

        for (const moodle of Object.values(bot.moodles)) {
            for (const [effect, value] of Object.entries(moodle.effects)) {
                if (effect.endsWith('_drain') || effect.endsWith('_risk') || effect.endsWith('_chance')) {
                    // Additive for drains, risks, chances
                    combined[effect] = (combined[effect] || 0) + value;
                } else {
                    // Multiplicative for multipliers
                    combined[effect] = (combined[effect] || 1.0) * value;
                }
            }
        }

        return combined;
    }

    /**
     * Update moodle values based on game state
     */
    updateMoodleValues(bot) {
        if (!bot.moodleValues) {
            this.initializeMoodles(bot);
        }

        // Update hunger from Minecraft food level
        bot.moodleValues.hunger = bot.food / 20;

        // Update health ratio
        bot.moodleValues.health_ratio = bot.health / 20;

        // Tiredness increases over time, decreases when resting
        if (bot.needs && bot.needs.rest) {
            bot.moodleValues.tiredness = 1.0 - bot.needs.rest;
        }

        // Panic from nearby hostile mobs
        const hostileMobs = bot.nearbyHostiles?.length || 0;
        if (hostileMobs > 0) {
            bot.moodleValues.panic_level = Math.min(1.0, bot.moodleValues.panic_level + 0.1 * hostileMobs);
        } else {
            bot.moodleValues.panic_level = Math.max(0.0, bot.moodleValues.panic_level - 0.05);
        }

        // Stress from low health or danger
        if (bot.health < 10 || hostileMobs > 2) {
            bot.moodleValues.stress_level = Math.min(1.0, bot.moodleValues.stress_level + 0.05);
        } else {
            bot.moodleValues.stress_level = Math.max(0.0, bot.moodleValues.stress_level - 0.02);
        }

        // Darkness based on light level
        const lightLevel = bot.entity?.metadata?.[15] || 15; // Default to full light
        bot.moodleValues.darkness = 1.0 - (lightLevel / 15);

        // Temperature based on biome (simplified)
        // TODO: Could check actual biome
        bot.moodleValues.temperature = 0.5; // Default comfortable

        // Thirst (simplified - could track separately)
        bot.moodleValues.thirst = Math.max(0.3, bot.moodleValues.hunger);

        // Update moodles based on new values
        this.updateMoodles(bot);
    }

    /**
     * Get total moodle count
     */
    getTotalMoodleCount() {
        let count = 0;
        for (const moodles of Object.values(this.MOODLE_DEFINITIONS)) {
            count += Object.keys(moodles).length;
        }
        return count;
    }

    /**
     * Get moodles for dashboard display
     */
    getMoodlesForDashboard(bot) {
        if (!bot.moodles) return [];

        return Object.entries(bot.moodles).map(([id, moodle]) => ({
            id,
            ...moodle
        }));
    }
}

// Singleton instance
let moodlesInstance = null;

function getMoodlesSystem() {
    if (!moodlesInstance) {
        moodlesInstance = new MoodlesSystem();
    }
    return moodlesInstance;
}

module.exports = { MoodlesSystem, getMoodlesSystem };
