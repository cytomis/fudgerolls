# Die Hard - Foundry VTT Module
# Note this code is updated and maintained using Claude AI, there is no reference to Uranus as this is just a copied branch of the original as it is no longer maintained.

A comprehensive dice manipulation module for Foundry Virtual Tabletop v13, allowing GMs to influence rolls and implement karma systems for better game balance.

## Features

### Fudge System
- **Influence Specific Rolls**: Set conditions for player or GM rolls to meet specific criteria
- **Flexible Targeting**: Target individual users, all players, or specific roll types
- **Roll Types**: Manipulate raw dice, total results (with modifiers), or system-specific rolls
- **Persistent Fudges**: Create one-time or persistent roll modifications
- **Automatic Application**: Rolls are automatically adjusted in the background with GM notifications

### Karma System
- **Simple Karma**: If all recent rolls are below a threshold, ensure the next roll meets a minimum value
- **Average Karma**: If the average of recent rolls is below a threshold, gradually increase rolls
- **Per-User Control**: Enable or disable karma for specific users (e.g., exclude the GM)
- **Real-Time Statistics**: View current averages and roll statistics for all players
- **Quick Stats**: Right-click karma button for instant statistics in chat
- **Visual Indicators**: See at a glance when karma would trigger for players
- **Cumulative Adjustments**: Option for increasing adjustments until balance is restored
- **Roll History Tracking**: Automatic tracking of player roll history for karma calculations

## Installation

### Method 1: Module Browser (Recommended)
1. Open Foundry VTT
2. Go to the "Add-on Modules" tab
3. Click "Install Module"
4. Search for "Die Hard"
5. Click "Install"

### Method 2: Manifest URL
1. Open Foundry VTT
2. Go to the "Add-on Modules" tab
3. Click "Install Module"
4. Paste this manifest URL:
   ```
   https://github.com/UranusBytes/foundry-die-hard/releases/latest/download/module.json
   ```
5. Click "Install"

### Method 3: Manual Installation
1. Download the latest release from GitHub
2. Extract the zip file to your Foundry VTT `Data/modules` folder
3. Restart Foundry VTT

## Compatibility

- **Foundry VTT**: v13+
- **Game Systems**: All systems supported (with enhanced features for DND5e and PF2e)

## Usage

### For GMs

#### Accessing the Module
After enabling the module in your world, you'll see two new icons above the chat controls:
- 💩 **Fudge Icon**: Opens the Fudge configuration dialog (Right-click to pause/resume all fudges)
- 🙏 **Praying Hands Icon**: Opens the Karma configuration dialog (Right-click for quick statistics)

#### Fudge Configuration

1. **Creating a Fudge**:
   - Click the poop icon
   - Select the "Create Fudge" tab
   - Choose a target user (or "All Players")
   - Select the roll type to affect
   - Enter a formula (e.g., `> 15`, `< 5`, `= 10`)
   - Optionally enable "Persistent" to keep the fudge active
   - Click "Create Fudge"

2. **Managing Fudges**:
   - Switch to the "Active Fudges" tab
   - View all active fudges
   - Toggle active/inactive status
   - Toggle persistent mode
   - Delete individual fudges
   - Clear all fudges at once

3. **Pausing Fudges**:
   - Right-click the poop icon to pause all fudges
   - Right-click again to resume
   - The icon color indicates status:
     - White: No active fudges
     - Orange: Active fudges running
     - Gray: Fudges paused

#### Karma Configuration

1. **Statistics Tab** (Default):
   - View real-time averages for all players
   - See statistics based on configured history sizes
   - Visual indicators show when karma would trigger
   - Displays overall average, recent averages, min/max, and recent rolls
   - Cards highlight in orange when karma would be applied
   - Shows GM and offline status for each player

2. **Karma Enabled Users**:
   - Select which users should have karma applied
   - Uncheck users (like the GM) to exclude them from karma
   - Great for preventing karma from affecting GM rolls

3. **Simple Karma**:
   - Enable Simple Karma
   - Set history size (number of rolls to check)
   - Set threshold (maximum value for "bad luck")
   - Set minimum value (what the next roll should be at least)

2. **Average Karma**:
   - Enable Average Karma
   - Set history size (number of rolls to average)
   - Set threshold (average must be above this)
   - Set adjustment amount
   - Optionally enable cumulative adjustments

3. **Viewing Roll History**:
   - Switch to the "Roll History" tab
   - View each player's roll history
   - See averages and recent rolls
   - Clear individual or all histories

### Viewing Statistics

**Quick View (Right-click method)**:
1. Right-click the 🙏 Praying Hands icon
2. A chat message appears with current statistics for all players
3. Shows average, min, max, and total roll count
4. Sorted by average (lowest first)

**Detailed View (Statistics Tab)**:
1. Click the 🙏 Praying Hands icon to open Karma Configuration
2. The Statistics tab opens by default
3. View comprehensive statistics for each player:
   - Overall average across all rolls
   - Average for Simple Karma history size
   - Average for Average Karma history size
   - Min and Max values
   - Visual list of recent rolls
   - Warning indicators when karma would trigger
4. Cards highlight in orange when karma conditions are met

### Formula Syntax

Fudge formulas use the following operators:

- `<` - Less than (e.g., `< 10`)
- `<=` - Less than or equal to (e.g., `<= 8`)
- `>` - Greater than (e.g., `> 15`)
- `>=` - Greater than or equal to (e.g., `>= 12`)
- `=` or `==` - Equal to (e.g., `= 20`)
- `!=` - Not equal to (e.g., `!= 1`)

### Roll Types

- **Raw Dice**: Only the dice results, excluding modifiers
- **Total**: The complete roll result including all modifiers
- **System Specific**: Roll types specific to your game system (DND5e, PF2e)

## How It Works

### Fudge System
When a fudge is active and a matching roll occurs:
1. The roll is evaluated against the fudge formula
2. If it doesn't meet the criteria, the module re-rolls in the background
3. Up to 150 attempts are made to meet the criteria
4. If successful, the adjusted roll is used
5. If unsuccessful, the closest result is used
6. The GM receives a whisper with details
7. The fudge is disabled (unless persistent mode is on)

### Karma System
Karma tracks raw dice rolls and applies adjustments:
1. Each roll is added to the player's history
2. When a new roll occurs, history is checked
3. If karma conditions are met, the roll is adjusted
4. Adjustments are applied automatically
5. History continues to be tracked

## Configuration

### Module Settings
Access via Game Settings → Module Settings → Die Hard:

- **Enable Fudge**: Turn the fudge system on/off
- **Enable Karma**: Turn the karma system on/off
- **Debug Logging**: Enable detailed console logging

## Updates for v13

This version has been completely rewritten for Foundry VTT v13:

- ✅ Migrated to ESM (ECMAScript Modules)
- ✅ Updated to v13 Application framework
- ✅ Modernized Document API usage
- ✅ Updated dice roll handling for v13
- ✅ Improved UI with contemporary styling
- ✅ Enhanced error handling and logging
- ✅ Better performance and reliability

## Known Issues

- The module may not be compatible with other dice manipulation modules
- Some complex roll formulas may not work correctly
- Fudge dialog doesn't update in real-time when other GMs make changes

## Troubleshooting

### Fudges Not Working
1. Check if fudges are paused (right-click the poop icon)
2. Verify the formula is correct
3. Check if the roll type matches
4. Enable debug logging to see details

### Karma Not Triggering
1. Ensure karma is enabled in settings
2. Check if history size requirements are met
3. Verify threshold settings are correct
4. Check the roll history tab

### Console Errors
1. Enable debug logging in settings
2. Check browser console (F12)
3. Report issues on GitHub with console output

## Credits

- **Original Author**: Uranus Bytes
- **Updated for v13**: Professional web developer with 15+ years experience
- **Inspiration**: @apoapostolov

## License

This module is provided as-is without warranty. Use at your own risk.

## Support

- **Issues**: https://github.com/UranusBytes/foundry-die-hard/issues
- **Discord**: Join the Foundry VTT community
- **Documentation**: https://foundryvtt.com/api/v13/

## Changelog

### Version 2.0.0
- Complete rewrite for Foundry VTT v13
- Migrated to ESM modules
- Updated Application framework
- Improved UI and styling
- Better error handling
- Enhanced performance
- Added comprehensive documentation

---

**Note**: This module is designed to help GMs manage game balance and create memorable moments. Use responsibly and communicate with your players about its use.
