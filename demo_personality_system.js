/**
 * Demo script showing the personality system in action
 * This simulates what happens when agents spawn and interact
 */

const { getPersonalitySystem } = require('./agent_personality_system');

console.log('\n' + '='.repeat(80));
console.log('  PERSONALITY SYSTEM DEMONSTRATION - Simulating Agent Interactions');
console.log('='.repeat(80));

const personalitySystem = getPersonalitySystem();

// Simulate agent spawn with personality generation
console.log('\n📌 SCENARIO 1: Agent Spawn and Personality Generation');
console.log('-'.repeat(80));

const agent1 = {
    name: 'MinerSteve01',
    generation: 1,
    simsPersonality: personalitySystem.generatePersonality()
};

const summary1 = personalitySystem.getPersonalitySummary(agent1.simsPersonality);
console.log(`\n[SPAWN] ${agent1.name} joined the world (Gen ${agent1.generation})`);
console.log(`[PERSONALITY] Traits: ${summary1.traits}`);
console.log(`[PERSONALITY] Loves: ${summary1.loves.slice(0, 3).join(', ')}`);
console.log(`[PERSONALITY] Hates: ${summary1.hates.slice(0, 2).join(', ')}`);

const agent2 = {
    name: 'BuilderBob02',
    generation: 1,
    simsPersonality: personalitySystem.generatePersonality()
};

const summary2 = personalitySystem.getPersonalitySummary(agent2.simsPersonality);
console.log(`\n[SPAWN] ${agent2.name} joined the world (Gen ${agent2.generation})`);
console.log(`[PERSONALITY] Traits: ${summary2.traits}`);
console.log(`[PERSONALITY] Loves: ${summary2.loves.slice(0, 3).join(', ')}`);
console.log(`[PERSONALITY] Hates: ${summary2.hates.slice(0, 2).join(', ')}`);

// Simulate agent communication
console.log('\n\n📌 SCENARIO 2: Agent-to-Agent Communication');
console.log('-'.repeat(80));

const compatibility = personalitySystem.calculateCompatibility(
    agent1.simsPersonality,
    agent2.simsPersonality
);
const compatDesc = personalitySystem.getCompatibilityDescription(compatibility);

console.log(`\n[AGENT COMMUNICATION] ${agent1.name} is near ${agent2.name}...`);
console.log(`[COMPATIBILITY] ${agent1.name} ↔ ${agent2.name}: ${compatibility.toFixed(2)} (${compatDesc})`);

const topic = personalitySystem.getConversationTopic(agent1.simsPersonality);
if (topic) {
    console.log(`[CHAT] ${agent1.name} → ${agent2.name}: "I ${topic.sentiment} ${topic.item}!"`);

    // Check if agent2 shares the sentiment
    const agent2Likes = agent2.simsPersonality.likes[topic.category]?.includes(topic.item);
    const agent2Dislikes = agent2.simsPersonality.dislikes[topic.category]?.includes(topic.item);

    if (agent2Likes) {
        console.log(`[CHAT] ${agent2.name}: "Me too! I love ${topic.item}!"`);
        console.log(`[RELATIONSHIP] Bond strengthened (+0.1)`);
    } else if (agent2Dislikes) {
        console.log(`[CHAT] ${agent2.name}: "Really? I can't stand ${topic.item}."`);
        console.log(`[RELATIONSHIP] Tension increased (-0.1)`);
    } else {
        console.log(`[CHAT] ${agent2.name}: "Interesting... I haven't thought much about ${topic.item}."`);
    }
}

// Simulate experience-based preference evolution
console.log('\n\n📌 SCENARIO 3: Experience-Based Preference Evolution');
console.log('-'.repeat(80));

const agent3 = {
    name: 'FarmerJoe03',
    generation: 1,
    simsPersonality: personalitySystem.generatePersonality()
};

console.log(`\n[SPAWN] ${agent3.name} joined the world`);
console.log(`[PERSONALITY] Initial likes (activities): ${agent3.simsPersonality.likes.activities.join(', ')}`);

// Simulate 10 successful mining actions
console.log(`\n[ACTION] ${agent3.name} mining... (success)`);
console.log(`[ACTION] ${agent3.name} mining... (success)`);
console.log(`[ACTION] ${agent3.name} mining... (success)`);
console.log('... (7 more successful mining actions)');

for (let i = 0; i < 10; i++) {
    personalitySystem.updateFromExperience(
        agent3.simsPersonality,
        'activities',
        'mining',
        true,
        0.1
    );
}

console.log(`\n[PERSONALITY] Updated likes (activities): ${agent3.simsPersonality.likes.activities.join(', ')}`);
console.log(`[PERSONALITY] ✓ ${agent3.name} now loves mining!`);

// Simulate offspring inheritance
console.log('\n\n📌 SCENARIO 4: Genetic Inheritance (Offspring System)');
console.log('-'.repeat(80));

console.log(`\n[DEATH] ${agent1.name} died (Gen ${agent1.generation})`);
console.log(`[PERSONALITY] Saved personality for offspring inheritance`);

const offspring = {
    name: 'MinerSteve04',
    generation: agent1.generation + 1,
    parentName: agent1.name,
    simsPersonality: personalitySystem.inheritPersonality(agent1.simsPersonality, 0.3)
};

const offspringSummary = personalitySystem.getPersonalitySummary(offspring.simsPersonality);
console.log(`\n[SPAWN] ${offspring.name} spawned (Gen ${offspring.generation}, parent: ${agent1.name})`);
console.log(`[PERSONALITY] Inherited from ${agent1.name} with 30% mutation`);
console.log(`[PERSONALITY] Parent loved: ${summary1.loves.slice(0, 3).join(', ')}`);
console.log(`[PERSONALITY] Offspring loves: ${offspringSummary.loves.slice(0, 3).join(', ')}`);

// Highlight inherited traits
const inheritedLikes = offspringSummary.loves.filter(love =>
    summary1.loves.some(parentLove =>
        parentLove.split('(')[0].trim() === love.split('(')[0].trim()
    )
);
const mutatedLikes = offspringSummary.loves.filter(love =>
    !inheritedLikes.includes(love)
);

if (inheritedLikes.length > 0) {
    console.log(`[GENETICS] Inherited traits: ${inheritedLikes.join(', ')}`);
}
if (mutatedLikes.length > 0) {
    console.log(`[GENETICS] Mutated traits: ${mutatedLikes.join(', ')}`);
}

// Simulate faction formation
console.log('\n\n📌 SCENARIO 5: Emergent Faction Formation');
console.log('-'.repeat(80));

// Create a diverse population
const population = {};
for (let i = 1; i <= 5; i++) {
    const agentName = `Agent${String(i).padStart(2, '0')}`;
    population[agentName] = {
        agentName: agentName,
        simsPersonality: personalitySystem.generatePersonality()
    };
}

console.log(`\n[POPULATION] 5 agents spawned, calculating compatibility matrix...\n`);

// Show compatibility matrix
const agents = Object.values(population);
for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
        const compat = personalitySystem.calculateCompatibility(
            agents[i].simsPersonality,
            agents[j].simsPersonality
        );
        const desc = personalitySystem.getCompatibilityDescription(compat);
        const icon = compat > 0.5 ? '💚' : compat > 0 ? '🟡' : compat > -0.3 ? '🟠' : '❤️';
        console.log(`${icon} ${agents[i].agentName} ↔ ${agents[j].agentName}: ${compat.toFixed(2)} (${desc})`);
    }
}

// Find best friends and rivals
console.log(`\n[FACTIONS] Identifying social groups...`);
agents.forEach(agent => {
    const friends = personalitySystem.findCompatibleAgents(agent.simsPersonality, population, 0.5);
    const rivals = personalitySystem.findRivals(agent.simsPersonality, population, -0.3);

    if (friends.length > 1) { // Exclude self
        console.log(`\n${agent.agentName} formed friendships with:`);
        friends.slice(0, 3).forEach(friend => {
            if (friend.name !== agent.agentName) {
                console.log(`  - ${friend.name} (${friend.compatibility.toFixed(2)})`);
            }
        });
    }

    if (rivals.length > 0) {
        console.log(`${agent.agentName} has rivalries with:`);
        rivals.slice(0, 2).forEach(rival => {
            console.log(`  - ${rival.name} (${rival.compatibility.toFixed(2)})`);
        });
    }
});

console.log('\n' + '='.repeat(80));
console.log('  DEMONSTRATION COMPLETE');
console.log('='.repeat(80));
console.log('\nThe personality system creates rich emergent social dynamics:');
console.log('  ✓ Unique personalities for each agent');
console.log('  ✓ Dynamic compatibility-based relationships');
console.log('  ✓ Preferences evolve based on experience');
console.log('  ✓ Genetic inheritance with mutations');
console.log('  ✓ Emergent factions and rivalries');
console.log('\nSystem is ready for integration into server.js!\n');
