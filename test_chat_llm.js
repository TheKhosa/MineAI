/**
 * Test script for Agent Chat LLM
 * Tests the Transformers.js backend with Granite 4.0 Micro
 */

const { getChatLLM } = require('./agent_chat_llm');

async function testChatLLM() {
    console.log('=== Testing Agent Chat LLM ===\n');

    // Test 1: Initialize with transformers backend
    console.log('[TEST 1] Initializing transformers backend...');
    const chatLLM = getChatLLM('transformers');

    try {
        const success = await chatLLM.initialize();
        if (success) {
            console.log('✓ Transformers backend initialized successfully');
            console.log(`Backend: ${chatLLM.backend}\n`);
        } else {
            console.log('✗ Failed to initialize, fell back to mock backend');
            console.log(`Current backend: ${chatLLM.backend}\n`);
        }
    } catch (error) {
        console.error('✗ Initialization error:', error.message);
        return;
    }

    // Test 2: Generate dialogue with nearby context
    console.log('[TEST 2] Generating dialogue (nearby context)...');
    const speaker = {
        name: 'Steve',
        health: 0.8,
        food: 0.6,
        needs: { health: 0.8, hunger: 0.6, safety: 0.7, resources: 0.5, social: 0.3 },
        inventory: '5 items',
        mood: 'neutral'
    };

    const listener = {
        name: 'Alex',
        needs: { health: 0.9, hunger: 0.8, safety: 0.8, resources: 0.6, social: 0.4 }
    };

    try {
        const message = await chatLLM.generateDialogue(speaker, listener, 'nearby');
        console.log(`Steve → Alex: "${message}"`);
        console.log('✓ Dialogue generated successfully\n');
    } catch (error) {
        console.error('✗ Dialogue generation error:', error.message);
    }

    // Test 3: Generate dialogue with low_health context
    console.log('[TEST 3] Generating dialogue (low health context)...');
    const injuredSpeaker = {
        ...speaker,
        health: 0.2,
        needs: { health: 0.2, hunger: 0.6, safety: 0.3, resources: 0.5, social: 0.3 },
        mood: 'stressed'
    };

    try {
        const message = await chatLLM.generateDialogue(injuredSpeaker, listener, 'low_health');
        console.log(`Steve (injured) → Alex: "${message}"`);
        console.log('✓ Context-aware dialogue generated\n');
    } catch (error) {
        console.error('✗ Dialogue generation error:', error.message);
    }

    // Test 4: Generate dialogue with trading context
    console.log('[TEST 4] Generating dialogue (trading context)...');
    const poorSpeaker = {
        ...speaker,
        needs: { health: 0.8, hunger: 0.6, safety: 0.7, resources: 0.2, social: 0.5 },
        inventory: '1 item',
        mood: 'concerned'
    };

    try {
        const message = await chatLLM.generateDialogue(poorSpeaker, listener, 'trading');
        console.log(`Steve (low resources) → Alex: "${message}"`);
        console.log('✓ Trading dialogue generated\n');
    } catch (error) {
        console.error('✗ Dialogue generation error:', error.message);
    }

    // Test 5: Get statistics
    console.log('[TEST 5] Checking conversation statistics...');
    const stats = chatLLM.getStats();
    console.log(`Backend: ${stats.backend}`);
    console.log(`Total conversations: ${stats.totalConversations}`);
    console.log(`Recent conversations: ${stats.recentConversations.length}`);
    console.log('✓ Statistics retrieved\n');

    // Cleanup
    console.log('[CLEANUP] Disposing chat LLM...');
    chatLLM.dispose();
    console.log('✓ Cleanup complete\n');

    console.log('=== All Tests Complete ===');
}

// Run tests
testChatLLM().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});
