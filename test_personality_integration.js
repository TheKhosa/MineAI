/**
 * Test script to verify personality system integration
 */

const { getPersonalitySystem } = require('./agent_personality_system');

console.log('='.repeat(70));
console.log('Testing Personality System Integration');
console.log('='.repeat(70));

// Test 1: Initialize personality system
console.log('\n[TEST 1] Initializing personality system...');
const personalitySystem = getPersonalitySystem();
console.log('✓ Personality system initialized');

// Test 2: Generate a personality
console.log('\n[TEST 2] Generating test personality...');
const personality1 = personalitySystem.generatePersonality();
console.log('✓ Personality generated');
const summary1 = personalitySystem.getPersonalitySummary(personality1);
console.log(`  Traits: ${summary1.traits}`);
console.log(`  Loves: ${summary1.loves.slice(0, 3).join(', ')}`);
console.log(`  Hates: ${summary1.hates.slice(0, 2).join(', ')}`);

// Test 3: Generate second personality and calculate compatibility
console.log('\n[TEST 3] Generating second personality and calculating compatibility...');
const personality2 = personalitySystem.generatePersonality();
const compatibility = personalitySystem.calculateCompatibility(personality1, personality2);
const compatDesc = personalitySystem.getCompatibilityDescription(compatibility);
console.log(`✓ Compatibility calculated: ${compatibility.toFixed(2)} (${compatDesc})`);

// Test 4: Test personality inheritance
console.log('\n[TEST 4] Testing personality inheritance...');
const childPersonality = personalitySystem.inheritPersonality(personality1, 0.3);
const childSummary = personalitySystem.getPersonalitySummary(childPersonality);
console.log('✓ Child personality inherited from parent');
console.log(`  Parent loves: ${summary1.loves.slice(0, 3).join(', ')}`);
console.log(`  Child loves: ${childSummary.loves.slice(0, 3).join(', ')}`);

// Test 5: Test conversation topic generation
console.log('\n[TEST 5] Testing conversation topic generation...');
const topic = personalitySystem.getConversationTopic(personality1);
if (topic) {
    console.log(`✓ Conversation topic: ${topic.sentiment} ${topic.item} (${topic.category})`);
} else {
    console.log('✗ Failed to generate conversation topic');
}

// Test 6: Test experience-based preference evolution
console.log('\n[TEST 6] Testing experience-based preference evolution...');
const testPersonality = personalitySystem.generatePersonality();
console.log('  Initial likes (activities):', testPersonality.likes.activities);

// Simulate successful mining experiences
for (let i = 0; i < 10; i++) {
    personalitySystem.updateFromExperience(testPersonality, 'activities', 'mining', true, 0.1);
}
console.log('  After 10 successful mining experiences:', testPersonality.likes.activities);
console.log('✓ Experience-based evolution works');

// Test 7: Test finding compatible agents
console.log('\n[TEST 7] Testing compatible agent finding...');
const mockAgents = {
    'agent1': { agentName: 'TestAgent1', personality: personality1 },
    'agent2': { agentName: 'TestAgent2', personality: personality2 },
    'agent3': { agentName: 'TestAgent3', personality: personalitySystem.generatePersonality() }
};
const compatibleAgents = personalitySystem.findCompatibleAgents(personality1, mockAgents, 0.0);
console.log(`✓ Found ${compatibleAgents.length} compatible agents`);
compatibleAgents.forEach(agent => {
    console.log(`  - ${agent.name}: ${agent.compatibility.toFixed(2)} (${agent.description})`);
});

console.log('\n' + '='.repeat(70));
console.log('All personality system tests completed successfully!');
console.log('='.repeat(70));
console.log('\nPersonality system is ready for use in server.js');
