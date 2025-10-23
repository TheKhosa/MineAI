# GraphQL Agent Brain Visualization

A live, interactive graph visualization system for monitoring AI agents in real-time using GraphQL and D3.js.

## 🎯 Features

### Real-Time Agent Monitoring
- **Live force-directed graph** showing all agents and their relationships
- **Interactive nodes** - click to view detailed agent information
- **Relationship visualization** - color-coded bonds (friends, rivals, neutral)
- **Brain state monitoring** - see ML action probabilities in real-time
- **Action stream** - live feed of agent actions and rewards

### GraphQL API
- **Comprehensive schema** for agents, actions, relationships, and experiences
- **Real-time subscriptions** for live updates (WebSocket)
- **Powerful queries** to explore agent state and behavior
- **GraphQL Playground** for testing queries

### Brain Activity Visualization
- **State vectors** - 429-dimensional agent state
- **Action probabilities** - top 10 actions the agent is considering
- **Value estimates** - predicted future reward
- **Experience memories** - recent learning events
- **Skill levels** - McMMO-style progression

## 🚀 Quick Start

### 1. Enable in Config
Edit `config.js`:
```javascript
visualization: {
    enabled: true,  // Enable GraphQL visualization
    port: 4000,     // GraphQL server port
    pollInterval: 2000  // Dashboard refresh rate (ms)
}
```

### 2. Start the Server
```bash
node server.js
```

### 3. Open the Dashboard
Visit **http://localhost:4001/** (dashboard runs on port + 1)

The GraphQL Playground is at **http://localhost:4000/graphql**

## 📊 Dashboard Interface

### Header Stats
- **Total Agents** - number of active agents
- **Relationships** - total social bonds
- **Avg Reward** - average cumulative reward
- **Active Actions** - agents currently executing actions

### Main Graph View
- **Agent nodes** - sized by reward, colored by type
- **Relationship edges** - thickness = bond strength, color = type
- **Drag nodes** - reposition the graph
- **Click nodes** - select agent for details

### Sidebar (Right)
- **Selected Agent** - detailed info (health, food, position, reward)
- **Action Probabilities** - top 10 actions with probability bars
- **Relationships** - friends and rivals with bond strengths
- **Value Estimate** - ML predicted future reward

### Timeline (Bottom)
- **Live Action Stream** - real-time feed of agent actions
- **Timestamps** - when actions occurred
- **Rewards** - reward gained per action

## 🔍 GraphQL Schema

### Key Types

#### Agent
```graphql
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

  # Memory
  recentExperiences: [Experience!]!
  skills: [Skill!]!
  personality: Personality!
}
```

#### BrainState
```graphql
type BrainState {
  stateVector: [Float!]!           # 429-dimensional state
  actionProbabilities: [ActionProbability!]!  # Action distribution
  valueEstimate: Float!             # Predicted future reward
  policyLoss: Float
  valueLoss: Float
  entropy: Float
}
```

#### ActionProbability
```graphql
type ActionProbability {
  actionId: Int!
  actionName: String!
  probability: Float!
  category: String!  # movement, combat, resource, etc.
}
```

### Example Queries

#### Get All Agents
```graphql
query {
  agents {
    name
    type
    health
    cumulativeReward
    position { x y z }
  }
}
```

#### Get Agent Brain State
```graphql
query GetBrain($name: String!) {
  agent(name: $name) {
    name
    brainState {
      actionProbabilities {
        actionName
        probability
        category
      }
      valueEstimate
    }
  }
}
```

#### Get Relationship Graph
```graphql
query {
  relationshipGraph {
    nodes {
      name
      type
      cumulativeReward
    }
    edges {
      source
      target
      strength
      type
    }
  }
}
```

#### Get Stats
```graphql
query {
  stats {
    totalAgents
    totalRelationships
    averageReward
    activeActions
  }
}
```

### Subscriptions (Real-Time)

#### Subscribe to Agent Updates
```graphql
subscription {
  agentUpdated {
    name
    position { x y z }
    health
    cumulativeReward
  }
}
```

#### Subscribe to Actions
```graphql
subscription {
  actionExecuted {
    actionName
    category
    reward
    timestamp
  }
}
```

#### Subscribe to Brain Updates
```graphql
subscription {
  brainStateUpdated {
    agentName
    brainState {
      actionProbabilities {
        actionName
        probability
      }
    }
  }
}
```

## 🎨 Agent Color Coding

- **MINING** - Orange (#ff8800)
- **LUMBERJACK** - Brown (#8B4513)
- **FISHING** - Blue (#4169E1)
- **FARMING** - Green (#32CD32)
- **EXPLORING** - Cyan (#00f5ff)
- **BUILDER** - Gold (#FFD700)
- **GUARD** - Red (#DC143C)
- **TRADER** - Purple (#9370DB)
- And 20+ more types...

## 📁 File Structure

```
D:\MineRL\
├── viz_graphql_server.js    # GraphQL server + resolvers
├── viz_dashboard.html        # Interactive D3.js dashboard
├── server.js                 # Main server (integrates GraphQL)
└── config.js                 # Configuration (visualization settings)
```

## 🔧 Architecture

### Server Ports
- **4000** - GraphQL Server (Apollo Server)
- **4001** - Dashboard HTTP Server (serves HTML)
- **4001/subscriptions** - WebSocket for real-time subscriptions

### Data Flow
1. **server.js** creates agents with `activeAgents` Map
2. **viz_graphql_server.js** receives `activeAgents` reference
3. **GraphQL resolvers** query live agent data
4. **Dashboard** polls GraphQL every 2 seconds
5. **D3.js force simulation** renders live graph
6. **User clicks node** → GraphQL query fetches details

### Real-Time Updates
- **Polling**: Dashboard fetches data every 2 seconds
- **Subscriptions**: WebSocket for instant updates (requires graphql-ws client)
- **PubSub**: Server can publish events (agents updated, actions, etc.)

## 🧠 Brain State Details

### State Vector (429 dimensions)
Encoded from:
- Agent health/food (2)
- Position & velocity (6)
- Inventory items (100)
- Nearby blocks (200)
- Nearby entities (100)
- Plugin sensor data (variable)
- Goals & tasks (variable)

### Action Space (216 actions)
Categories:
1. **Movement** (7) - forward, back, jump, sprint, etc.
2. **Combat** (16) - attack, equip, aim, block, etc.
3. **Resource** (15) - mine, chop, fish, dig, etc.
4. **Building** (15) - place blocks, scaffold, etc.
5. **Crafting** (23) - basic crafting
6. **Inventory** (15) - toss, sort, equip, etc.
7. **Advanced Crafting** (20) - specific recipes
8. **Container** (12) - storage operations
9. **Enchanting** (10) - enchant & brew
10. **Trading** (8) - villager trades
11. **Agriculture** (15) - farming & breeding
12. **Redstone** (10) - mechanisms
13. **Bed** (5) - sleep & time
14. **Advanced Combat** (12) - critical hits, combos
15. **Navigation** (15) - swim, climb, parkour
16. **Optimization** (10) - tool selection, repair
17. **Communication** (8) - signals, formations

## 📊 Use Cases

### 1. Agent Debugging
- Watch action probabilities change in real-time
- See why agents make specific decisions
- Track reward accumulation

### 2. Relationship Analysis
- Visualize social network formation
- See friendship/rivalry dynamics
- Monitor bond strength changes

### 3. Learning Progress
- Watch skills level up (McMMO)
- See experience memories accumulate
- Track generational improvements

### 4. Performance Monitoring
- Average reward trends
- Active action count
- Agent survival times

## 🛠️ Customization

### Change Poll Interval
In `config.js`:
```javascript
visualization: {
    pollInterval: 1000  // Poll every 1 second (faster updates)
}
```

### Change Graph Layout
In `viz_dashboard.html`, modify D3 force simulation:
```javascript
const simulation = d3.forceSimulation()
    .force('charge', d3.forceManyBody().strength(-500))  // Stronger repulsion
    .force('link', d3.forceLink().distance(200))  // Longer edges
```

### Add Custom Queries
In `viz_graphql_server.js`, add to `resolvers.Query`:
```javascript
Query: {
    myCustomQuery: () => {
        // Your logic here
    }
}
```

## 🐛 Troubleshooting

### Dashboard shows "Connecting to GraphQL..."
- Check that server.js is running
- Verify GraphQL server started (check console logs)
- Ensure no firewall blocking ports 4000/4001

### No agents appear in graph
- Wait for agents to spawn (batch spawn takes time)
- Check `config.agents.maxAgents` is > 0
- Verify agents are connecting to Minecraft server

### Action probabilities not showing
- Ensure ML system is enabled (`config.ml.enabled: true`)
- Check that agents have executed at least one action
- Verify neural network is initialized

### WebSocket errors
- WebSocket subscriptions require `graphql-ws` client library
- Current implementation uses polling (2-second intervals)
- To enable subscriptions, install: `npm install graphql-ws`

## 🚀 Future Enhancements

- [ ] WebSocket real-time subscriptions (no polling)
- [ ] 3D visualization with Three.js
- [ ] Historical replay (timeline scrubbing)
- [ ] Agent trajectory paths
- [ ] Experience heatmap overlay
- [ ] Custom graph layouts (hierarchical, circular)
- [ ] Export graph as image/video
- [ ] Agent performance comparison charts
- [ ] Lineage tree visualization

## 📝 Notes

- GraphQL server runs independently of main dashboard
- No Express dependency conflicts (uses standalone Apollo Server)
- Compatible with Express 5.x in server.js
- Lightweight - no heavy dependencies
- Scales to 1000+ agents with pagination

## 📚 References

- [Apollo Server Docs](https://www.apollographql.com/docs/apollo-server/)
- [GraphQL Schema Basics](https://graphql.org/learn/schema/)
- [D3.js Force Layout](https://d3js.org/d3-force)
- [GraphQL Subscriptions](https://www.apollographql.com/docs/apollo-server/data/subscriptions/)

---

**Built with:** Apollo Server, GraphQL, D3.js, WebSockets, Node.js

**Created:** 2025-10-21

**Version:** 1.0.0
