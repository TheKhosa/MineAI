# PowerShell script to schedule plugin updates
# Runs plugin_updater.js daily at 3 AM

$taskName = "Minecraft Plugin Auto-Updater"
$scriptPath = "D:\MineRL\plugin_updater.js"
$nodePath = (Get-Command node).Source

# Create scheduled task action
$action = New-ScheduledTaskAction `
    -Execute $nodePath `
    -Argument $scriptPath `
    -WorkingDirectory "D:\MineRL"

# Daily trigger at 3 AM
$trigger = New-ScheduledTaskTrigger -Daily -At 3am

# Run whether user is logged on or not
$principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

# Task settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

# Register the task
Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Force

Write-Host "✅ Scheduled task created: $taskName"
Write-Host "   Runs daily at 3:00 AM"
Write-Host "   Updates: EssentialsX (more plugins can be added to config)"
Write-Host ""
Write-Host "To manually run: schtasks /run /tn `"$taskName`""
Write-Host "To remove: Unregister-ScheduledTask -TaskName `"$taskName`" -Confirm:`$false"
