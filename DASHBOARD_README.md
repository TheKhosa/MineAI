# Intelligent Village Dashboard

A real-time web dashboard for monitoring and managing all your Minecraft agents.

## Features

✅ **Real-time Agent Monitoring**
- Player name, type, and current task
- Health and hunger bars with live updates
- Position tracking
- Generation and status badges

✅ **Live Statistics**
- Reward scores
- Resources gathered
- Mobs killed
- Knowledge shared/learned
- Survival time

✅ **Interactive Charts**
- Live skill score graphs
- Historical data visualization
- Reward and resource tracking

✅ **3D Live View (Optional)**
- Prismarine Viewer integration
- See what each agent sees in real-time
- First-person perspective for each bot

✅ **Status Indicators**
- Bugged agents (red badge)
- Agents needing resources (yellow badge)
- Generation indicators (green badge)

## Installation

```bash
npm install express prismarine-viewer
```

## Usage

1. Start the intelligent village system:
```bash
node intelligent_village.js
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. The dashboard will automatically update every 2 seconds with live agent data.

## Enabling 3D Viewer

To enable the Prismarine Viewer for each agent:

1. Open `intelligent_village.js`
2. Find line ~1350 in the `setupAgentEvents` function
3. Uncomment this line:
```javascript
// dashboard.setupViewer(bot);
```

⚠️ **Note**: Running viewers for all 29 agents simultaneously requires significant system resources. Only enable if you have a powerful machine.

## API Endpoints

The dashboard provides REST API endpoints for custom integrations:

- `GET /api/agents` - Get all agents data
- `GET /api/agent/:name` - Get specific agent data
- `GET /api/agent/:name/history` - Get historical stats for charts

## Dashboard Features

### Overview Stats
- Total Agents
- Total Rewards
- Resources Gathered
- Mobs Killed

### Agent Cards
Each agent card displays:
- Agent name and type
- Health bar (red gradient)
- Hunger bar (orange gradient)
- Current task
- Current issue (if any)
- Live skill scores chart
- Statistics (rewards, survival, resources, kills, knowledge)
- "View Live 3D" button (if viewer is enabled)

### Live Charts
- Real-time Chart.js graphs
- Tracks reward progression
- Tracks resource gathering
- Historical data (last 100 data points)
- Auto-updates every 5 seconds

## Customization

The dashboard uses a modern gradient design with glassmorphism effects. You can customize:

- Colors in the `<style>` section
- Update intervals (currently 2 seconds for data, 5 seconds for stats)
- Chart configurations in the Chart.js setup
- Number of historical data points (currently 100)

## Performance

- Lightweight design
- Efficient data updates
- Minimal bandwidth usage
- Responsive grid layout
- Smooth animations and transitions

## Troubleshooting

**Dashboard not loading?**
- Check that port 3000 is available
- Verify Express is installed: `npm list express`
- Check console for error messages

**No agent data showing?**
- Wait for agents to spawn (takes ~30 seconds)
- Refresh the page
- Check that agents are connecting to the Minecraft server

**3D viewer not working?**
- Ensure prismarine-viewer is installed
- Check that viewer is uncommented in code
- Verify unique ports aren't blocked (3001+)

## Future Enhancements

Possible additions:
- Agent control panel (pause/resume agents)
- Chat interface
- Resource allocation management
- Custom goals and tasks
- Alert system for critical events
- Export stats to CSV/JSON
- Mobile responsive design
- Dark/light theme toggle
