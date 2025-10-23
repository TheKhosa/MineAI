/**
 * GraphQL Server for Live Agent Visualization
 *
 * Provides real-time data about:
 * - Agent states, positions, and metadata
 * - ML brain activity (state vectors, action probabilities)
 * - Relationships and social bonds
 * - Experience memories and learning events
 * - Action history and trajectories
 */

const { ApolloServer } = require('@apollo/server');
const { startStandaloneServer } = require('@apollo/server/standalone');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ============================================================================
// GRAPHQL SCHEMA
// ============================================================================

const typeDefs = `#graphql
  # Core Agent Type
  type Agent {
    name: String!
    type: String!
    uuid: String!
    generation: Int!
    position: Position!
    health: Float!
    food: Float!
    cumulativeReward: Float!

    # Relationships
    relationships: [Relationship!]!
    friends: [Agent!]!
    rivals: [Agent!]!

    # Brain State
    brainState: BrainState!
    currentAction: ActionExecution
    actionHistory: [ActionExecution!]!

    # Memory & Learning
    recentExperiences: [Experience!]!
    skills: [Skill!]!
    personality: Personality!

    # Lineage
    parentUUID: String
    parent: Agent
    children: [Agent!]!
  }

  # Position & Movement
  type Position {
    x: Float!
    y: Float!
    z: Float!
    yaw: Float
    pitch: Float
  }

  # Relationships between agents
  type Relationship {
    targetAgent: Agent!
    bondStrength: Float!
    relationshipType: String!
    interactionCount: Int!
    lastInteraction: String!
  }

  # ML Brain State
  type BrainState {
    stateVector: [Float!]!
    actionProbabilities: [ActionProbability!]!
    valueEstimate: Float!
    policyLoss: Float
    valueLoss: Float
    entropy: Float
  }

  # Action Probability Distribution
  type ActionProbability {
    actionId: Int!
    actionName: String!
    probability: Float!
    category: String!
  }

  # Current/Historical Action Execution
  type ActionExecution {
    actionId: Int!
    actionName: String!
    category: String!
    timestamp: String!
    result: String
    reward: Float
    position: Position!
  }

  # Experience/Memory
  type Experience {
    id: Int!
    type: String!
    description: String!
    outcome: String!
    reward: Float!
    timestamp: String!
    position: Position
  }

  # Skills (McMMO-style)
  type Skill {
    name: String!
    level: Int!
    xp: Float!
    category: String!
  }

  # Personality Traits
  type Personality {
    likes: [String!]!
    dislikes: [String!]!
    traits: [Trait!]!
  }

  type Trait {
    category: String!
    value: String!
  }

  # Graph Statistics
  type GraphStats {
    totalAgents: Int!
    totalRelationships: Int!
    averageReward: Float!
    averageBondStrength: Float!
    activeActions: Int!
  }

  # Queries
  type Query {
    # Get all agents
    agents: [Agent!]!

    # Get specific agent
    agent(name: String!): Agent

    # Get agents by type
    agentsByType(type: String!): [Agent!]!

    # Get graph statistics
    stats: GraphStats!

    # Get relationship graph (all connections)
    relationshipGraph: RelationshipGraph!
  }

  # Relationship graph structure
  type RelationshipGraph {
    nodes: [Agent!]!
    edges: [RelationshipEdge!]!
  }

  type RelationshipEdge {
    source: String!
    target: String!
    strength: Float!
    type: String!
  }

`;

// Note: Subscriptions removed - using polling instead for simplicity
// GraphQL subscriptions require ES modules which conflicts with CommonJS

// ============================================================================
// RESOLVERS
// ============================================================================

let activeAgents = null; // Will be injected
let memorySystem = null;
let mlTrainer = null;
let actionSpace = null;
let fitnessTracker = null;

const resolvers = {
  Query: {
    agents: () => {
      if (!activeAgents) return [];
      return Array.from(activeAgents.values()).map(bot => formatAgent(bot));
    },

    agent: (_, { name }) => {
      if (!activeAgents) return null;
      const bot = activeAgents.get(name);
      return bot ? formatAgent(bot) : null;
    },

    agentsByType: (_, { type }) => {
      if (!activeAgents) return [];
      return Array.from(activeAgents.values())
        .filter(bot => bot.agentType === type)
        .map(bot => formatAgent(bot));
    },

    stats: () => {
      if (!activeAgents) {
        return {
          totalAgents: 0,
          totalRelationships: 0,
          averageReward: 0,
          averageBondStrength: 0,
          activeActions: 0
        };
      }

      const agents = Array.from(activeAgents.values());
      const totalAgents = agents.length;

      let totalRelationships = 0;
      let totalReward = 0;
      let totalBondStrength = 0;
      let bondCount = 0;

      agents.forEach(bot => {
        totalReward += bot.cumulativeReward || 0;

        if (bot.relationships) {
          const rels = Array.from(bot.relationships.values());
          totalRelationships += rels.length;
          rels.forEach(rel => {
            totalBondStrength += rel.bondStrength;
            bondCount++;
          });
        }
      });

      return {
        totalAgents,
        totalRelationships: Math.floor(totalRelationships / 2), // Divide by 2 (bidirectional)
        averageReward: totalAgents > 0 ? totalReward / totalAgents : 0,
        averageBondStrength: bondCount > 0 ? totalBondStrength / bondCount : 0,
        activeActions: agents.filter(bot => bot.currentAction).length
      };
    },

    relationshipGraph: () => {
      if (!activeAgents) {
        return { nodes: [], edges: [] };
      }

      const nodes = Array.from(activeAgents.values()).map(bot => formatAgent(bot));
      const edges = [];
      const processedPairs = new Set();

      Array.from(activeAgents.values()).forEach(bot => {
        if (bot.relationships) {
          bot.relationships.forEach((rel, targetName) => {
            const pairKey = [bot.agentName, targetName].sort().join('|');

            if (!processedPairs.has(pairKey)) {
              processedPairs.add(pairKey);

              edges.push({
                source: bot.agentName,
                target: targetName,
                strength: rel.bondStrength,
                type: rel.bondStrength > 0.5 ? 'friend' :
                      rel.bondStrength < -0.3 ? 'rival' : 'neutral'
              });
            }
          });
        }
      });

      return { nodes, edges };
    }
  },

  Agent: {
    relationships: (bot) => {
      if (!bot.relationships) return [];
      return Array.from(bot.relationships.entries()).map(([targetName, rel]) => ({
        targetAgent: activeAgents.get(targetName) ? formatAgent(activeAgents.get(targetName)) : null,
        bondStrength: rel.bondStrength,
        relationshipType: rel.bondStrength > 0.5 ? 'friend' :
                         rel.bondStrength < -0.3 ? 'rival' : 'neutral',
        interactionCount: rel.interactionCount || 0,
        lastInteraction: rel.lastInteraction || new Date().toISOString()
      })).filter(r => r.targetAgent);
    },

    friends: (bot) => {
      if (!bot.relationships) return [];
      return Array.from(bot.relationships.entries())
        .filter(([_, rel]) => rel.bondStrength > 0.5)
        .map(([name]) => activeAgents.get(name))
        .filter(Boolean)
        .map(formatAgent);
    },

    rivals: (bot) => {
      if (!bot.relationships) return [];
      return Array.from(bot.relationships.entries())
        .filter(([_, rel]) => rel.bondStrength < -0.3)
        .map(([name]) => activeAgents.get(name))
        .filter(Boolean)
        .map(formatAgent);
    },

    brainState: (bot) => {
      return formatBrainState(bot);
    },

    currentAction: (bot) => {
      if (!bot.currentAction) return null;
      return {
        actionId: bot.currentAction.actionId || 0,
        actionName: bot.currentAction.actionName || 'idle',
        category: bot.currentAction.category || 'unknown',
        timestamp: bot.currentAction.timestamp || new Date().toISOString(),
        result: bot.currentAction.result,
        reward: bot.currentAction.reward || 0,
        position: {
          x: bot.entity?.position?.x || 0,
          y: bot.entity?.position?.y || 0,
          z: bot.entity?.position?.z || 0
        }
      };
    },

    actionHistory: (bot) => {
      if (!bot.actionHistory) return [];
      return bot.actionHistory.slice(-20).map(action => ({
        actionId: action.actionId || 0,
        actionName: action.actionName || 'unknown',
        category: action.category || 'unknown',
        timestamp: action.timestamp || new Date().toISOString(),
        result: action.result,
        reward: action.reward || 0,
        position: action.position || { x: 0, y: 0, z: 0 }
      }));
    },

    recentExperiences: async (bot) => {
      if (!memorySystem) return [];

      try {
        const memories = await memorySystem.getEpisodicMemories(bot.agentName, 10);
        return memories.map(mem => ({
          id: mem.id,
          type: mem.type,
          description: mem.description,
          outcome: mem.outcome,
          reward: mem.reward || 0,
          timestamp: new Date(mem.timestamp).toISOString(),
          position: mem.position ? JSON.parse(mem.position) : null
        }));
      } catch (error) {
        console.error(`Error fetching experiences for ${bot.agentName}:`, error);
        return [];
      }
    },

    skills: (bot) => {
      if (!bot.skills) return [];
      return Object.entries(bot.skills).map(([name, data]) => ({
        name,
        level: data.level || 0,
        xp: data.xp || 0,
        category: data.category || 'general'
      }));
    },

    personality: (bot) => {
      if (!bot.personality) {
        return { likes: [], dislikes: [], traits: [] };
      }

      return {
        likes: bot.personality.likes || [],
        dislikes: bot.personality.dislikes || [],
        traits: Object.entries(bot.personality.preferences || {}).map(([category, value]) => ({
          category,
          value: String(value)
        }))
      };
    },

    parent: (bot) => {
      if (!bot.parentUUID) return null;
      const parent = Array.from(activeAgents.values()).find(b => b.uuid === bot.parentUUID);
      return parent ? formatAgent(parent) : null;
    },

    children: (bot) => {
      return Array.from(activeAgents.values())
        .filter(b => b.parentUUID === bot.uuid)
        .map(formatAgent);
    }
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatAgent(bot) {
  if (!bot) return null;

  return {
    name: bot.agentName,
    type: bot.agentType,
    uuid: bot.uuid,
    generation: bot.generation || 1,
    position: {
      x: bot.entity?.position?.x || 0,
      y: bot.entity?.position?.y || 0,
      z: bot.entity?.position?.z || 0,
      yaw: bot.entity?.yaw || 0,
      pitch: bot.entity?.pitch || 0
    },
    health: bot.health || 0,
    food: bot.food || 0,
    cumulativeReward: bot.cumulativeReward || 0,
    parentUUID: bot.parentUUID || null,
    // Nested resolvers will handle relationships, brainState, etc.
    ...bot // Pass through for nested resolvers
  };
}

function formatBrainState(bot) {
  const brain = bot.mlBrain;

  if (!brain) {
    return {
      stateVector: [],
      actionProbabilities: [],
      valueEstimate: 0,
      policyLoss: null,
      valueLoss: null,
      entropy: null
    };
  }

  // Get latest state vector
  const stateVector = bot.lastStateVector || [];

  // Get action probabilities
  const actionProbs = bot.lastActionProbs || [];
  const actionProbabilities = actionProbs.map((prob, idx) => {
    const actionInfo = getActionInfo(idx);
    return {
      actionId: idx,
      actionName: actionInfo.name,
      probability: prob,
      category: actionInfo.category
    };
  }).sort((a, b) => b.probability - a.probability).slice(0, 20); // Top 20 actions

  return {
    stateVector: Array.from(stateVector),
    actionProbabilities,
    valueEstimate: bot.lastValueEstimate || 0,
    policyLoss: brain.lastPolicyLoss || null,
    valueLoss: brain.lastValueLoss || null,
    entropy: brain.lastEntropy || null
  };
}

function getActionInfo(actionId) {
  if (!actionSpace) {
    return { name: `action_${actionId}`, category: 'unknown' };
  }

  // Action categories (from ml_action_space.js)
  const categories = [
    { range: [0, 6], name: 'movement', prefix: 'move_' },
    { range: [7, 22], name: 'combat', prefix: 'combat_' },
    { range: [23, 37], name: 'resource', prefix: 'resource_' },
    { range: [38, 52], name: 'building', prefix: 'build_' },
    { range: [53, 75], name: 'crafting', prefix: 'craft_' },
    { range: [76, 90], name: 'inventory', prefix: 'inv_' },
    { range: [91, 110], name: 'advanced_crafting', prefix: 'adv_craft_' },
    { range: [111, 122], name: 'container', prefix: 'container_' },
    { range: [123, 132], name: 'enchanting', prefix: 'enchant_' },
    { range: [133, 140], name: 'trading', prefix: 'trade_' },
    { range: [141, 155], name: 'agriculture', prefix: 'farm_' },
    { range: [156, 165], name: 'redstone', prefix: 'redstone_' },
    { range: [166, 170], name: 'bed', prefix: 'bed_' },
    { range: [171, 182], name: 'advanced_combat', prefix: 'adv_combat_' },
    { range: [183, 197], name: 'navigation', prefix: 'nav_' },
    { range: [198, 207], name: 'optimization', prefix: 'opt_' },
    { range: [208, 215], name: 'communication', prefix: 'comm_' }
  ];

  const category = categories.find(cat => actionId >= cat.range[0] && actionId <= cat.range[1]);

  return {
    name: category ? `${category.prefix}${actionId - category.range[0]}` : `action_${actionId}`,
    category: category ? category.name : 'unknown'
  };
}

// ============================================================================
// SERVER INITIALIZATION
// ============================================================================

async function createGraphQLServer(port, deps) {
  // Inject dependencies
  activeAgents = deps.activeAgents;
  memorySystem = deps.memorySystem;
  mlTrainer = deps.mlTrainer;
  actionSpace = deps.actionSpace;
  fitnessTracker = deps.fitnessTracker;

  // Create HTTP server for dashboard
  const httpServer = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.url === '/' || req.url === '/index.html') {
      // Serve the dashboard HTML
      const htmlPath = path.join(__dirname, 'viz_dashboard.html');
      const html = fs.readFileSync(htmlPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  // Apollo Server (standalone)
  const server = new ApolloServer({
    typeDefs,
    resolvers
  });

  // Start Apollo Server
  const { url } = await startStandaloneServer(server, {
    listen: { port }
  });

  // Start HTTP server for dashboard on different port
  const dashboardPort = port + 1;
  await new Promise((resolve) => httpServer.listen(dashboardPort, resolve));

  console.log(`[VIZ GRAPHQL] GraphQL Server ready at ${url}`);
  console.log(`[VIZ GRAPHQL] Dashboard at http://localhost:${dashboardPort}/`);

  return {
    server,
    httpServer,
    port,
    dashboardPort
  };
}

module.exports = {
  createGraphQLServer
};
