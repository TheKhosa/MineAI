# 🧠 GraphQL Agent Visualization - Quick Start

## ✅ Installation Complete!

Your GraphQL agent brain visualization system is now installed and running!

## 🚀 Access the Dashboard

### Main Dashboard (Interactive Graph)
**http://localhost:4001/**

Features:
- Live force-directed graph of all agents
- Click agents to view brain state
- See action probabilities in real-time
- Monitor relationships (friends/rivals)
- Live action stream

### GraphQL Playground
**http://localhost:4000/graphql**

Test queries and explore the API

## 📊 What You Can See

### 1. Agent Nodes
- **Size** = cumulative reward (bigger = better performance)
- **Color** = agent type (MINING=orange, EXPLORING=cyan, etc.)
- **Border** = selection state (green when selected)

### 2. Relationship Edges
- **Green** = Friends (bond strength > 0.5)
- **Red** = Rivals (bond strength < -0.3)
- **Gray** = Neutral
- **Thickness** = bond strength

### 3. Brain State (Click an agent)
- **Top 10 Action Probabilities** - what the agent is thinking
- **Value Estimate** - predicted future reward
- **Health & Food** - survival status
- **Position** - location in world
- **Relationships** - social connections

### 4. Live Action Stream
- Real-time feed of all agent actions
- Rewards earned per action
- Timestamps

## 🔍 Example GraphQL Queries

### Get All Agents
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

### Get Agent Brain State
```graphql
query {
  agent(name: "MinerSteve") {
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

### Get Relationship Graph
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

### Get Statistics
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

## ⚙️ Configuration

Edit `config.js`:

```javascript
visualization: {
    enabled: true,      // Enable/disable visualization
    port: 4000,         // GraphQL server port
    pollInterval: 2000  // Dashboard refresh rate (ms)
}
```

## 🎮 How to Use

1. **Start the server:**
   ```bash
   node server.js
   ```

2. **Open the dashboard:**
   Visit http://localhost:4001/

3. **Interact:**
   - **Drag nodes** to rearrange the graph
   - **Click agents** to view detailed brain state
   - **Watch action probabilities** change in real-time
   - **Monitor the action stream** for live updates

## 🔧 Troubleshooting

### Dashboard shows "Connecting to GraphQL..."
- Ensure server is running
- Check console for errors
- Verify ports 4000 and 4001 are not blocked

### No agents appear
- Wait for agents to spawn (takes 30-60 seconds)
- Check `config.agents.maxAgents > 0`
- Verify Minecraft server is running

### Can't see action probabilities
- Ensure `config.ml.enabled = true`
- Wait for agents to execute at least one action
- Click on an agent node first

## 📁 Files

- **viz_graphql_server.js** - GraphQL server & resolvers
- **viz_dashboard.html** - Interactive D3.js dashboard
- **server.js** - Main server (integrates GraphQL)
- **config.js** - Configuration

## 🎯 What's Happening?

1. **Agents** spawn and connect to Minecraft
2. **ML Brain** selects actions based on 429-dimensional state
3. **GraphQL** exposes live agent data
4. **Dashboard** polls every 2 seconds for updates
5. **D3.js** renders the interactive force-directed graph
6. **You** can explore the AI's decision-making process!

## 🌟 Features

✅ **Live agent monitoring** - see all agents and their states
✅ **Brain activity visualization** - 216-action probability distribution
✅ **Relationship graph** - social network dynamics
✅ **Action history** - what agents have done
✅ **Experience memories** - what agents learned
✅ **Skill progression** - McMMO-style leveling
✅ **Interactive graph** - drag, click, explore
✅ **Real-time updates** - 2-second polling

## 📚 Learn More

See **VIZ_GRAPHQL_README.md** for complete documentation including:
- Full GraphQL schema
- All available queries
- Architecture details
- Customization guide
- Advanced features

---

**🎉 Enjoy visualizing your AI agents' brains!**

Built with: Apollo Server, GraphQL, D3.js, Node.js
