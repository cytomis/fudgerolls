/**
 * Die Hard Module for Foundry VTT v13
 * Allows manipulation of dice rolls and karma systems
 */

import { DieHardConfig } from './config.js';
import { FudgeDialog } from './fudge-dialog.js';
import { KarmaDialog } from './karma-dialog.js';
import { DiceManipulator } from './dice-manipulator.js';

// Module Constants
const MODULE_ID = 'foundry-die-hard';
const MODULE_TITLE = 'Die Hard';

/**
 * Module initialization
 */
Hooks.once('init', () => {
  console.log(`${MODULE_TITLE} | Initializing`);
  
  // Register module settings
  registerSettings();
  
  // Initialize module classes
  game.diehard = {
    config: new DieHardConfig(),
    manipulator: new DiceManipulator()
  };
  
  console.log(`${MODULE_TITLE} | Initialized`);
});

/**
 * Setup hook - called after init but before ready
 */
Hooks.once('setup', () => {
  console.log(`${MODULE_TITLE} | Setup`);
});

/**
 * Ready hook - called when the game is fully loaded
 */
Hooks.once('ready', () => {
  console.log(`${MODULE_TITLE} | Ready`);
  
  // Only initialize for GM users
  if (!game.user.isGM) {
    console.log(`${MODULE_TITLE} | Non-GM user, skipping initialization`);
    return;
  }
  
  // Add control buttons to the UI
  addControlButtons();
  
  // Hook into dice rolls
  setupDiceRollHooks();
});

/**
 * Register module settings
 */
function registerSettings() {
  // Enable/Disable Fudge
  game.settings.register(MODULE_ID, 'enableFudge', {
    name: 'DIEHARD.Settings.EnableFudge.Name',
    hint: 'DIEHARD.Settings.EnableFudge.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    onChange: value => {
      console.log(`${MODULE_TITLE} | Fudge ${value ? 'enabled' : 'disabled'}`);
    }
  });
  
  // Enable/Disable Karma
  game.settings.register(MODULE_ID, 'enableKarma', {
    name: 'DIEHARD.Settings.EnableKarma.Name',
    hint: 'DIEHARD.Settings.EnableKarma.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    onChange: value => {
      console.log(`${MODULE_TITLE} | Karma ${value ? 'enabled' : 'disabled'}`);
    }
  });
  
  // Debug logging
  game.settings.register(MODULE_ID, 'debugLogging', {
    name: 'DIEHARD.Settings.DebugLogging.Name',
    hint: 'DIEHARD.Settings.DebugLogging.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });
  
  // Active fudges storage
  game.settings.register(MODULE_ID, 'activeFudges', {
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });
  
  // Fudges paused state
  game.settings.register(MODULE_ID, 'fudgesPaused', {
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });
  
  // Karma configuration
  game.settings.register(MODULE_ID, 'karmaConfig', {
    scope: 'world',
    config: false,
    type: Object,
    default: {
      simple: {
        enabled: false,
        historySize: 5,
        threshold: 10,
        minValue: 15
      },
      average: {
        enabled: false,
        historySize: 10,
        threshold: 10,
        adjustment: 2,
        cumulative: false
      }
    }
  });
  
  // Roll history
  game.settings.register(MODULE_ID, 'rollHistory', {
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });
  
  // Karma enabled users
  game.settings.register(MODULE_ID, 'karmaEnabledUsers', {
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });
}

/**
 * Add control buttons to the UI
 */
function addControlButtons() {
  const chatControls = document.getElementById('chat-controls');
  if (!chatControls) return;
  
  // Create fudge button
  const fudgeBtn = document.createElement('a');
  fudgeBtn.classList.add('die-hard-control', 'fudge-control');
  fudgeBtn.title = 'Configure Fudge';
  fudgeBtn.innerHTML = '<i class="fas fa-poo"></i>';
  
  fudgeBtn.addEventListener('click', (event) => {
    event.preventDefault();
    new FudgeDialog().render(true);
  });
  
  fudgeBtn.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    toggleFudgePause();
  });
  
  // Create karma button
  const karmaBtn = document.createElement('a');
  karmaBtn.classList.add('die-hard-control', 'karma-control');
  karmaBtn.title = 'Configure Karma (Right-click for quick stats)';
  karmaBtn.innerHTML = '<i class="fas fa-praying-hands"></i>';
  
  karmaBtn.addEventListener('click', (event) => {
    event.preventDefault();
    new KarmaDialog().render(true);
  });
  
  karmaBtn.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    KarmaDialog.showQuickStats();
  });
  
  // Insert buttons
  chatControls.prepend(karmaBtn);
  chatControls.prepend(fudgeBtn);
  
  // Update button states
  updateControlButtons();
}

/**
 * Update control button states
 */
function updateControlButtons() {
  const fudgeBtn = document.querySelector('.fudge-control');
  if (!fudgeBtn) return;
  
  const activeFudges = game.settings.get(MODULE_ID, 'activeFudges');
  const hasFudges = Object.keys(activeFudges).length > 0;
  const paused = game.settings.get(MODULE_ID, 'fudgesPaused');
  
  if (hasFudges && !paused) {
    fudgeBtn.classList.add('active');
  } else {
    fudgeBtn.classList.remove('active');
  }
  
  if (paused) {
    fudgeBtn.classList.add('paused');
  } else {
    fudgeBtn.classList.remove('paused');
  }
}

/**
 * Toggle fudge pause state
 */
function toggleFudgePause() {
  const currentState = game.settings.get(MODULE_ID, 'fudgesPaused');
  game.settings.set(MODULE_ID, 'fudgesPaused', !currentState);
  
  ui.notifications.info(`Fudge ${!currentState ? 'paused' : 'resumed'}`);
  updateControlButtons();
}

/**
 * Setup hooks for intercepting dice rolls
 */
function setupDiceRollHooks() {
  // Hook into dice rolls before they're evaluated
  Hooks.on('preCreateChatMessage', (message, data, options, userId) => {
    if (!game.user.isGM) return true;
    
    const fudgeEnabled = game.settings.get(MODULE_ID, 'enableFudge');
    const karmaEnabled = game.settings.get(MODULE_ID, 'enableKarma');
    
    if (!fudgeEnabled && !karmaEnabled) return true;
    
    // Check if this is a roll message
    if (!message.rolls || message.rolls.length === 0) return true;
    
    const manipulator = game.diehard.manipulator;
    
    // Process each roll
    for (let roll of message.rolls) {
      if (fudgeEnabled) {
        manipulator.processFudge(roll, message.speaker);
      }
      
      if (karmaEnabled) {
        manipulator.processKarma(roll, message.speaker);
      }
    }
    
    return true;
  });
  
  // Update roll history after roll is created
  Hooks.on('createChatMessage', (message, options, userId) => {
    if (!game.user.isGM) return;
    
    const karmaEnabled = game.settings.get(MODULE_ID, 'enableKarma');
    if (!karmaEnabled) return;
    
    if (!message.rolls || message.rolls.length === 0) return;
    
    const manipulator = game.diehard.manipulator;
    manipulator.updateRollHistory(message.rolls, message.speaker);
  });
}

/**
 * Logging helper
 */
export function log(...args) {
  const debug = game.settings.get(MODULE_ID, 'debugLogging');
  if (debug) {
    console.log(`${MODULE_TITLE} |`, ...args);
  }
}

/**
 * Export module ID for use in other files
 */
export { MODULE_ID, MODULE_TITLE };
