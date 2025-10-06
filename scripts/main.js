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
  
  console.log(`${MODULE_TITLE} | GM user detected, initializing controls`);
  
  // Add control buttons to the UI
  addControlButtons();
  
  // Hook into dice rolls
  setupDiceRollHooks();
  
  console.log(`${MODULE_TITLE} | Fully initialized and ready`);
  console.log(`${MODULE_TITLE} | Fudge enabled: ${game.settings.get(MODULE_ID, 'enableFudge')}`);
  console.log(`${MODULE_TITLE} | Karma enabled: ${game.settings.get(MODULE_ID, 'enableKarma')}`);
  console.log(`${MODULE_TITLE} | Debug logging: ${game.settings.get(MODULE_ID, 'debugLogging')}`);
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
    default: true  // Enabled by default for initial testing
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
 * Check if a roll is a damage roll
 */
function isDamageRoll(roll, message) {
  // Check if roll is an instance of DamageRoll (dnd5e and other systems)
  if (roll.constructor.name === 'DamageRoll') {
    return true;
  }

  // Check message flavor for damage indicators
  if (message.flavor) {
    const flavor = message.flavor.toLowerCase();
    if (flavor.includes('damage')) {
      return true;
    }
  }

  // Check roll options for damage type
  if (roll.options) {
    if (roll.options.type === 'damage' || roll.options.rollType === 'damage') {
      return true;
    }

    // Check flavor in roll options
    if (roll.options.flavor) {
      const flavor = roll.options.flavor.toLowerCase();
      if (flavor.includes('damage')) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Setup hooks for intercepting dice rolls
 */
function setupDiceRollHooks() {
  // Store modifications temporarily
  const modifiedMessages = new Map();

  // Hook into dice rolls before they're created
  Hooks.on('preCreateChatMessage', async (message, data, options, userId) => {
    if (!game.user.isGM) return true;

    const fudgeEnabled = game.settings.get(MODULE_ID, 'enableFudge');
    const karmaEnabled = game.settings.get(MODULE_ID, 'enableKarma');

    if (!fudgeEnabled && !karmaEnabled) return true;

    // Check if this is a roll message
    if (!message.rolls || message.rolls.length === 0) return true;

    log('Processing roll from user:', userId, 'Rolls:', message.rolls.length);

    const manipulator = game.diehard.manipulator;
    let modified = false;
    const originalValues = [];

    // Process each roll
    for (let i = 0; i < message.rolls.length; i++) {
      let roll = message.rolls[i];
      const originalTotal = roll.total;
      const originalFormula = roll.formula;
      const isDamage = isDamageRoll(roll, message);

      originalValues.push({ total: originalTotal, formula: originalFormula });

      if (fudgeEnabled) {
        manipulator.processFudge(roll, userId);
      }

      // Only apply karma to non-damage rolls
      if (karmaEnabled && !isDamage) {
        manipulator.processKarma(roll, userId);
        log(`Karma processed for roll: ${roll.formula}`);
      } else if (karmaEnabled && isDamage) {
        log(`Skipping karma for damage roll: ${roll.formula}`);
      }

      // Check if the roll was modified
      if (roll.total !== originalTotal || roll.formula !== originalFormula) {
        modified = true;
        log(`Roll modified: ${originalFormula} = ${originalTotal} -> ${roll.formula} = ${roll.total}`);
      }
    }
    
    // If rolls were modified, store info for post-processing
    if (modified) {
      const messageKey = `${userId}-${Date.now()}`;
      modifiedMessages.set(messageKey, {
        rolls: message.rolls,
        originalValues: originalValues,
        userId: userId
      });
      
      // Store the key and original values in the message flags so we can find it later
      message.updateSource({ 
        rolls: message.rolls,
        flags: {
          'foundry-die-hard': {
            modified: true,
            messageKey: messageKey,
            originalTotal: originalValues[0].total // Store first roll's original total for brute force search
          }
        }
      });
      
      log('Rolls modified, stored for post-processing');
    }
    
    return true;
  });
  
  // Hook after message is created to fix the display
  Hooks.on('createChatMessage', async (message, options, userId) => {
    if (!game.user.isGM) return;

    // Update roll history (only for non-damage rolls)
    const karmaEnabled = game.settings.get(MODULE_ID, 'enableKarma');
    if (karmaEnabled && message.rolls && message.rolls.length > 0) {
      const manipulator = game.diehard.manipulator;
      // Filter out damage rolls before updating history
      const nonDamageRolls = message.rolls.filter(roll => !isDamageRoll(roll, message));
      if (nonDamageRolls.length > 0) {
        manipulator.updateRollHistory(nonDamageRolls, userId);
        log(`Updated roll history with ${nonDamageRolls.length} non-damage rolls`);
      }
    }
    
    // Check if this message was modified
    const wasModified = message.getFlag('foundry-die-hard', 'modified');
    if (!wasModified) return;
    
    log('Message was modified, updating display');
    
    // Wait for the message to render
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Update the message content to show correct values
    if (message.rolls && message.rolls.length > 0) {
      const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
      if (!messageElement) {
        log('Could not find message element');
        return;
      }
      
      log('Found message element, updating displays');
      
      // Find and update all result displays
      // Try multiple selectors to catch different system formats
      const selectors = [
        // Standard Foundry
        '.dice-total',
        '.dice-result',
        // PF2e specific
        '.result-total',
        'h4.result',
        '.degree-of-success',
        'span[class*="result"]',
        'div[class*="result"]',
        // DND5e specific  
        '.roll-total',
        '.dice-formula .total',
        // Generic
        '[data-tooltip] .total',
        'span.total',
        'div.total'
      ];
      
      let updated = false;
      
      // First, try our known selectors
      for (const selector of selectors) {
        const elements = messageElement.querySelectorAll(selector);
        elements.forEach((element, index) => {
          const roll = message.rolls[index] || message.rolls[0];
          if (!roll) return;
          
          const currentValue = parseInt(element.textContent.trim());
          if (!isNaN(currentValue) && currentValue !== roll.total) {
            log(`Updating ${selector} from ${currentValue} to ${roll.total}`);
            element.textContent = roll.total;
            element.style.color = '#0066cc';
            element.style.fontWeight = 'bold';
            element.title = `Modified by Die Hard: ${roll.formula}`;
            updated = true;
          }
        });
      }
      
      // If no updates were made, try brute force: find ANY element with the old total
      if (!updated && message.rolls.length > 0) {
        const roll = message.rolls[0];
        const originalTotal = parseInt(message.getFlag('foundry-die-hard', 'originalTotal')) || (roll.total - 5);
        
        log(`Brute force search for value ${originalTotal} to replace with ${roll.total}`);
        
        // Get all text nodes
        const walker = document.createTreeWalker(
          messageElement,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        let node;
        while (node = walker.nextNode()) {
          const text = node.textContent.trim();
          const value = parseInt(text);
          
          // If this text node contains ONLY the old total value
          if (!isNaN(value) && text === value.toString() && value === originalTotal) {
            log(`Found matching text node with value ${value}, updating to ${roll.total}`);
            node.textContent = roll.total;
            // Style the parent element
            if (node.parentElement) {
              node.parentElement.style.color = '#0066cc';
              node.parentElement.style.fontWeight = 'bold';
            }
            updated = true;
            break;
          }
        }
      }
      
      if (!updated) {
        log('Warning: Could not find result element to update.');
        log('Message rolls:', message.rolls.map(r => `${r.formula} = ${r.total}`));
        log('Available elements:', 
          Array.from(messageElement.querySelectorAll('*'))
            .filter(el => {
              const text = el.textContent.trim();
              const num = parseInt(text);
              return !isNaN(num) && text.length < 4;
            })
            .map(el => ({
              tag: el.tagName,
              class: el.className,
              text: el.textContent.trim()
            }))
        );
      }
    }
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
