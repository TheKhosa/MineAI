# Plugin Auto-Update System

## Overview

Automatically keeps Minecraft plugins updated from Jenkins CI servers.

## Components

### 1. plugin_updater.js
Core updater that checks Jenkins for new plugin versions and downloads them.

**Features**:
- Checks Jenkins lastSuccessfulBuild API
- Downloads new JARs automatically
- Deletes old versions (after server restart)
- Progress indicators
- Error handling

**Currently Configured Plugins**:
- **EssentialsX**: https://ci.ender.zone/job/EssentialsX/lastSuccessfulBuild

**Run manually**:
```bash
node plugin_updater.js
```

### 2. start_with_updates.bat
Startup script that updates plugins before starting servers.

**Workflow**:
1. Check for plugin updates (plugin_updater.js)
2. Start Minecraft server
3. Wait 30 seconds
4. Start Node.js agent system

**Usage**:
```cmd
start_with_updates.bat
```

### 3. schedule_plugin_updates.ps1
Creates Windows scheduled task for automatic daily updates.

**Schedule**: Daily at 3:00 AM
**Runs as**: SYSTEM account
**Action**: Executes plugin_updater.js

**Install scheduled task**:
```powershell
powershell -ExecutionPolicy Bypass -File schedule_plugin_updates.ps1
```

**Manual trigger**:
```cmd
schtasks /run /tn "Minecraft Plugin Auto-Updater"
```

**Remove scheduled task**:
```powershell
Unregister-ScheduledTask -TaskName "Minecraft Plugin Auto-Updater" -Confirm:$false
```

## Adding More Plugins

Edit `plugin_updater.js` and add to `PLUGIN_CONFIGS`:

### Example: LuckPerms
```javascript
'LuckPerms': {
    jenkinsUrl: 'https://ci.lucko.me/job/LuckPerms/lastSuccessfulBuild',
    artifactPattern: 'LuckPerms-Bukkit-*.jar',
    currentVersion: null
}
```

### Example: ViaVersion
```javascript
'ViaVersion': {
    jenkinsUrl: 'https://ci.viaversion.com/job/ViaVersion/lastSuccessfulBuild',
    artifactPattern: 'ViaVersion-*.jar',
    currentVersion: null
}
```

### Example: WorldEdit
```javascript
'WorldEdit': {
    jenkinsUrl: 'https://ci.enginehub.org/job/worldedit/lastSuccessfulBuild',
    artifactPattern: 'worldedit-bukkit-*.jar',
    currentVersion: null
}
```

## Configuration

### Plugins Folder
Default: `D:/MCServer/Server/plugins`

Change in `plugin_updater.js` line 15:
```javascript
const PLUGINS_FOLDER = 'D:/MCServer/Server/plugins';
```

### Update Schedule
Default: Daily at 3:00 AM

Change in `schedule_plugin_updates.ps1` line 11:
```powershell
$trigger = New-ScheduledTaskTrigger -Daily -At 3am
```

Options:
- Hourly: `-Once -At 12am -RepetitionInterval (New-TimeSpan -Hours 1)`
- Weekly: `-Weekly -DaysOfWeek Sunday -At 3am`
- On startup: `-AtStartup`

## Output Examples

### Successful Update
```
[=============================================================]
[PLUGIN UPDATER] Checking EssentialsX...
[=============================================================]
[CURRENT] 2.22.0-dev+39-adf77dc
[FILE] EssentialsX-2.22.0-dev+39-adf77dc.jar
[CHECKING] https://ci.ender.zone/job/EssentialsX/lastSuccessfulBuild/api/json
[LATEST BUILD] #1735
[LATEST] 2.22.0-dev+40-150dabb
[FILE] EssentialsX-2.22.0-dev+40-150dabb.jar
[STATUS] 🔄 Update available!
[DOWNLOAD] https://ci.ender.zone/job/EssentialsX/1735/artifact/...
  Downloading: 100.0%
  Download complete!
[SAVED] D:/MCServer/Server/plugins/EssentialsX-2.22.0-dev+40-150dabb.jar
[DELETED] EssentialsX-2.22.0-dev+39-adf77dc.jar
[SUCCESS] ✅ EssentialsX updated successfully!
[ACTION REQUIRED] Restart Minecraft server to load new plugin
```

### Up to Date
```
[=============================================================]
[PLUGIN UPDATER] Checking EssentialsX...
[=============================================================]
[CURRENT] 2.22.0-dev+40-150dabb
[FILE] EssentialsX-2.22.0-dev+40-150dabb.jar
[CHECKING] https://ci.ender.zone/job/EssentialsX/lastSuccessfulBuild/api/json
[LATEST BUILD] #1735
[LATEST] 2.22.0-dev+40-150dabb
[FILE] EssentialsX-2.22.0-dev+40-150dabb.jar
[STATUS] ✅ Up to date!
```

## Best Practices

### 1. Test Updates First
Run manually before scheduling:
```bash
node plugin_updater.js
```

### 2. Backup Plugins
Before running auto-updates, backup your plugins folder:
```cmd
xcopy D:\MCServer\Server\plugins D:\MCServer\Backups\plugins_%date:~-4,4%%date:~-10,2%%date:~-7,2% /E /I
```

### 3. Monitor Scheduled Runs
Check Task Scheduler logs:
```
Task Scheduler > Task Scheduler Library > Minecraft Plugin Auto-Updater > History
```

### 4. Server Restart Required
Updates are downloaded but **require server restart** to load:
- Stop Minecraft server
- New plugins load automatically
- Old plugins are deleted on next updater run

## Troubleshooting

### Old JAR Not Deleted
**Cause**: Minecraft server has file locked

**Solution**: Restart Minecraft server, run updater again

### Jenkins URL 404
**Cause**: Build number changed or plugin moved

**Solution**: Check Jenkins URL in browser, update `jenkinsUrl` in config

### Download Timeout
**Cause**: Slow connection or large file

**Solution**: Increase timeout in plugin_updater.js (currently no limit)

### Scheduled Task Not Running
**Cause**: Permissions or Node.js not in PATH

**Solution**: Run as Administrator, verify Node.js path in task settings

## Integration with AgentSensorPlugin

The AgentSensorPlugin has its own TeamCity-based auto-updater built-in:
- Checks TeamCity every 30 minutes
- Command: `/agentsensor update`
- No configuration needed

**This updater is for OTHER plugins** that use Jenkins CI (like EssentialsX).

## Performance Impact

- **Check time**: 1-2 seconds per plugin
- **Download time**: 5-30 seconds (depends on file size)
- **Disk space**: Old JARs deleted automatically
- **Memory**: Negligible (Node.js script)

## Security Notes

- Uses HTTPS for all Jenkins connections
- Validates artifact patterns before download
- No credentials stored (public Jenkins servers)
- Runs with SYSTEM privileges (scheduled task)

## Future Enhancements

- [ ] Discord/Slack notifications for updates
- [ ] Rollback functionality
- [ ] Plugin dependency checking
- [ ] Multiple Jenkins servers support
- [ ] Web dashboard for update status
- [ ] Automatic server restart after updates

---

**Generated**: 2025-10-18
**Status**: ✅ Fully Functional

🤖 Generated with [Claude Code](https://claude.com/claude-code)
