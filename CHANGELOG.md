# Changelog

All notable changes to the Die Hard module will be documented in this file.

## [2.3.4] - 2025-10-05

### Fixed
- **Scrollbar Added to Karma Configuration** - Tab content now scrolls properly to show all options including Average Karma
- **Improved Roll Modification Display** - Roll formula is now properly updated when modified
- Enhanced roll modification to update both total and formula string
- Better tracking of roll changes for debugging

### Changed
- Tab content now has max-height with overflow scroll
- Roll modifications create new rolls array for proper reactivity
- Formula is regenerated using `Roll.getFormula()` after adding modifier terms
- Enhanced logging shows both formula and total changes

### Technical
- Added `max-height: 500px` and `overflow-y: auto` to tab content
- Roll formula updated via `roll._formula = Roll.getFormula(roll.terms)`
- Message receives new rolls array reference for proper change detection
- Content update forced to trigger message re-render

## [2.3.3] - 2025-10-05

### Fixed
- **Dialog Content Now Displays** - Fixed empty dialog windows
- Removed broken parchment.jpg background image reference
- Added manual tab switching functionality (ApplicationV2 doesn't have built-in tabs)
- Added CSS to properly show/hide tab content
- Dialogs now display all content correctly

### Added
- Manual tab navigation for both Fudge and Karma dialogs
- Console logging for dialog context (helps debugging)
- Gradient background instead of missing image
- Tab active/inactive CSS styling

### Technical
- Implemented `_setupTabs()` method in both dialog classes
- Added `.tab { display: none }` and `.tab.active { display: block }` CSS
- Replaced `url("../ui/parchment.jpg")` with CSS gradient
- ApplicationV2 requires manual tab handling unlike v1's automatic tab support

## [2.3.2] - 2025-10-05

### Fixed
- **CRITICAL: Dialog Rendering Fixed** - Added HandlebarsApplicationMixin to both dialog classes
- Dialogs now properly render and open without errors
- Fixed "Application class is not renderable" error
- Both Fudge and Karma dialogs now implement required rendering methods via mixin

### Technical
- Changed class extension from `ApplicationV2` to `HandlebarsApplicationMixin(ApplicationV2)`
- HandlebarsApplicationMixin provides `_renderHTML` and `_replaceHTML` implementations
- This is the correct pattern for ApplicationV2 classes that use Handlebars templates

## [2.3.1] - 2025-10-05

### Fixed
- **CRITICAL HOTFIX: Module Loading Error** - Fixed ReferenceError where MODULE_TITLE couldn't be accessed before initialization
- Removed MODULE_TITLE from static class properties in dialog files
- Replaced dynamic string interpolation with string literals in DEFAULT_OPTIONS
- Fixed ES6 module initialization order issues

### Technical
- Changed `title: ${MODULE_TITLE} - ...` to `title: 'Die Hard - ...'` in static properties
- Removed MODULE_TITLE import from fudge-dialog.js and karma-dialog.js
- Updated dice-manipulator.js to use string literal instead of MODULE_TITLE constant
- This prevents initialization errors when static properties are evaluated before imports are resolved

## [2.3.0] - 2025-10-05

### Fixed
- **CRITICAL: Migrated to ApplicationV2** - Fixed deprecated Application framework warnings
- **Roll modifications now persist to chat** - Modified rolls now correctly display in chat messages
- Fudge and Karma dialogs now use Foundry v13's ApplicationV2 framework
- Removed jQuery dependencies from dialog event handlers
- Fixed message data updates to ensure roll modifications are saved

### Changed
- Complete rewrite of dialog classes using ApplicationV2
- Updated all event handlers to use vanilla JavaScript instead of jQuery  
- Improved roll modification tracking and logging
- Enhanced message update logic for roll changes

### Technical
- Replaced `Application` with `foundry.applications.api.ApplicationV2`
- Changed `defaultOptions` to `DEFAULT_OPTIONS` static property
- Replaced `getData()` with `_prepareContext()`
- Replaced `activateListeners()` with `_onRender()`
- Removed jQuery selectors (`.find()`, `.click()`) in favor of vanilla JS
- Added `PARTS` configuration for template rendering

## [2.2.2] - 2025-10-05

### Fixed
- **Roll Modification Now Working** - Karma and Fudge now properly modify dice rolls
- Fixed roll manipulation to properly update roll terms instead of just totals
- Karma adjustments now add proper modifier terms to rolls
- Fudge re-rolls now properly replace dice results

### Added
- GM whispers when karma adjusts a roll (shows original and adjusted totals)
- Detailed logging for karma trigger conditions
- Better debugging output for roll modifications

### Changed
- Improved roll adjustment logic for v13 compatibility
- Enhanced karma whisper styling with blue border
- More verbose logging for easier troubleshooting

## [2.2.1] - 2025-10-05

### Fixed
- **Critical Bug Fix** - Roll detection now works properly with all player rolls
- Fixed user ID detection to use ChatMessage userId directly instead of parsing from speaker
- Roll history now properly tracks all dice rolls
- Statistics tab now correctly displays player data
- Karma and Fudge systems now properly detect and process rolls

### Changed
- Improved logging for debugging roll detection
- Debug logging now enabled by default for easier troubleshooting
- Enhanced error handling for roll processing

## [2.2.0] - 2025-10-05

### Added
- **Statistics Tab** - New default tab in Karma Configuration showing real-time player statistics
- **Quick Statistics** - Right-click karma button to instantly view player averages in chat
- **Visual Karma Triggers** - Cards highlight in orange when karma conditions would be met
- **Per-User Karma Control** - Enable/disable karma for individual players (e.g., exclude GM)
- Comprehensive statistics display showing:
  - Overall average across all rolls
  - Average for Simple Karma window
  - Average for Average Karma window
  - Min/Max values
  - Recent roll history visualization
  - Visual indicators when karma would trigger

### Changed
- Statistics tab is now the default tab when opening Karma Configuration
- Improved karma dialog layout and organization
- Enhanced CSS styling for better visual hierarchy

### Fixed
- Karma now properly respects per-user settings
- Statistics calculations align with configured history sizes

## [2.1.0] - 2025-10-05

### Added
- Per-user karma controls in Karma Configuration
- Ability to enable/disable karma for specific users
- User status indicators (GM, Offline, Karma Disabled)

### Changed
- Updated module for Foundry VTT v13 compatibility
- Migrated to ESM (ECMAScript Modules)
- Complete rewrite using modern JavaScript patterns

## [2.0.0] - 2025-10-05

### Added
- Initial v13 compatibility release
- Complete module rewrite for Foundry VTT v13
- ESM module system implementation
- Updated Application framework
- Modern dice manipulation system
- Comprehensive documentation

### Changed
- Migrated from v10 to v13 API
- Updated all core functionality for v13
- Improved error handling
- Enhanced performance

### Breaking Changes
- Requires Foundry VTT v13 or higher
- Not compatible with Foundry VTT v12 or earlier

## [1.x.x] - Legacy

Previous versions were compatible with Foundry VTT v10 and earlier.

---

## Version Numbering

This project follows [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality in a backward compatible manner
- **PATCH** version for backward compatible bug fixes
