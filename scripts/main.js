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
      
      originalValues.push({ total: originalTotal, formula: originalFormula });
      
      if (fudgeEnabled) {
        manipulator.processFudge(roll, userId);
      }
      
      if (karmaEnabled) {
        manipulator.processKarma(roll, userId);
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

    // Update roll history
    const karmaEnabled = game.settings.get(MODULE_ID, 'enableKarma');
    if (karmaEnabled && message.rolls && message.rolls.length > 0) {
      const manipulator = game.diehard.manipulator;
      manipulator.updateRollHistory(message.rolls, userId);
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

      // Get the original and modified roll values to calculate the delta
      const roll = message.rolls[0];
      const originalTotal = parseInt(message.getFlag('foundry-die-hard', 'originalTotal'));
      const modifiedTotal = roll.total;
      const delta = modifiedTotal - originalTotal;

      log(`Original: ${originalTotal}, Modified: ${modifiedTotal}, Delta: ${delta}`);

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
      const updatedElements = new Set(); // Track updated elements to avoid duplicates

      // First, try our known selectors
      for (const selector of selectors) {
        const elements = messageElement.querySelectorAll(selector);
        elements.forEach((element, index) => {
          if (updatedElements.has(element)) return; // Skip if already updated

          const rollToUse = message.rolls[index] || message.rolls[0];
          if (!rollToUse) return;

          const currentValue = parseInt(element.textContent.trim());
          if (!isNaN(currentValue) && currentValue !== rollToUse.total) {
            log(`Updating ${selector} from ${currentValue} to ${rollToUse.total}`);
            element.textContent = rollToUse.total;
            element.style.color = '#0066cc';
            element.style.fontWeight = 'bold';
            element.title = `Modified by Die Hard: ${rollToUse.formula}`;
            updatedElements.add(element);
            updated = true;
          }
        });
      }

      // Update all dependent rolls: find text nodes with numeric values and update if they match the pattern
      // This handles cases where the message contains calculated results based on the base roll
      if (!isNaN(originalTotal) && !isNaN(delta) && delta !== 0) {
        log(`Searching for dependent rolls that need updating (delta: ${delta})`);

        // Get all text nodes in the message
        const walker = document.createTreeWalker(
          messageElement,
          NodeFilter.SHOW_TEXT,
          null
        );

        let node;
        const nodesToUpdate = [];
        while (node = walker.nextNode()) {
          // Skip if parent was already updated
          if (updatedElements.has(node.parentElement)) continue;

          const text = node.textContent.trim();
          const value = parseInt(text);

          // Check if this is a numeric value that might be a roll result
          if (!isNaN(value) && text === value.toString()) {
            // Check if this value is the original base roll
            if (value === originalTotal) {
              log(`Found base roll value ${value}, will update to ${modifiedTotal}`);
              nodesToUpdate.push({ node, oldValue: value, newValue: modifiedTotal });
            }
            // Check if this value could be a dependent calculation (original + modifier)
            // We look for values that could have been calculated from the original roll
            else if (Math.abs(value - originalTotal) <= 20) {
              // This could be a dependent roll (base roll + some modifier)
              // Calculate what the new value should be
              const possibleModifier = value - originalTotal;
              const newValue = modifiedTotal + possibleModifier;
              log(`Found potential dependent value ${value} (base ${originalTotal} + modifier ${possibleModifier}), will update to ${newValue}`);
              nodesToUpdate.push({ node, oldValue: value, newValue: newValue });
            }
          }
        }

        // Apply all updates
        for (const { node, oldValue, newValue } of nodesToUpdate) {
          log(`Updating dependent roll from ${oldValue} to ${newValue}`);
          node.textContent = newValue;
          if (node.parentElement) {
            node.parentElement.style.color = '#0066cc';
            node.parentElement.style.fontWeight = 'bold';
            node.parentElement.title = `Modified by Die Hard (was ${oldValue})`;
            updatedElements.add(node.parentElement);
          }
          updated = true;
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
