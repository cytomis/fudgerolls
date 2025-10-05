/**
 * Dice Manipulator
 * Handles the actual manipulation of dice rolls for fudge and karma systems
 */

import { MODULE_ID, MODULE_TITLE, log } from './main.js';

export class DiceManipulator {
  constructor() {
    this.maxAttempts = 150;
  }
  
  /**
   * Process fudge for a roll
   */
  processFudge(roll, speaker) {
    const paused = game.settings.get(MODULE_ID, 'fudgesPaused');
    if (paused) return;
    
    const config = game.diehard.config;
    const fudges = config.getActiveFudges();
    
    // Get the user ID from the speaker
    const userId = this.getUserIdFromSpeaker(speaker);
    if (!userId) return;
    
    // Find applicable fudges for this user
    const applicableFudges = Object.values(fudges).filter(f => 
      f.active && (f.userId === userId || f.userId === 'all')
    );
    
    if (applicableFudges.length === 0) return;
    
    // Process each applicable fudge
    for (const fudge of applicableFudges) {
      const result = this.applyFudge(roll, fudge);
      
      if (result.attempted) {
        // Send whisper to GM
        this.sendFudgeWhisper(result, fudge, userId);
        
        // Disable fudge if not persistent
        if (!fudge.persistent && result.applied) {
          config.disableFudge(fudge.id);
        }
      }
    }
  }
  
  /**
   * Apply a fudge to a roll
   */
  applyFudge(roll, fudge) {
    const formula = game.diehard.config.parseFudgeFormula(fudge.formula);
    if (!formula) {
      return { attempted: false, applied: false };
    }
    
    const rollType = fudge.rollType || 'total';
    let targetValue;
    
    // Determine what value to check/manipulate
    switch (rollType) {
      case 'raw':
        targetValue = this.getRawDiceTotal(roll);
        break;
      case 'total':
        targetValue = roll.total;
        break;
      case 'system':
        // System-specific handling would go here
        targetValue = roll.total;
        break;
      default:
        targetValue = roll.total;
    }
    
    // Check if roll already meets criteria
    if (formula.test(targetValue, formula.value)) {
      log(`Roll ${targetValue} already meets formula ${fudge.formula}`);
      return {
        attempted: true,
        applied: false,
        originalValue: targetValue,
        finalValue: targetValue,
        meetsCriteria: true
      };
    }
    
    // Attempt to fudge the roll
    const result = this.attemptFudge(roll, formula, rollType);
    
    return {
      attempted: true,
      applied: result.success,
      originalValue: targetValue,
      finalValue: result.value,
      attempts: result.attempts,
      meetsCriteria: result.success
    };
  }
  
  /**
   * Attempt to fudge a roll to meet criteria
   */
  attemptFudge(roll, formula, rollType) {
    let bestRoll = foundry.utils.duplicate(roll);
    let bestValue = rollType === 'raw' ? this.getRawDiceTotal(bestRoll) : bestRoll.total;
    let bestDistance = Math.abs(bestValue - formula.value);
    
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      // Re-roll the dice
      const newRoll = this.rerollDice(roll);
      const newValue = rollType === 'raw' ? this.getRawDiceTotal(newRoll) : newRoll.total;
      
      // Check if this roll meets the criteria
      if (formula.test(newValue, formula.value)) {
        // Success! Apply this roll
        this.applyRollResult(roll, newRoll);
        return {
          success: true,
          value: newValue,
          attempts: attempt + 1
        };
      }
      
      // Track if this is closer to the target
      const distance = Math.abs(newValue - formula.value);
      if (distance < bestDistance) {
        bestRoll = newRoll;
        bestValue = newValue;
        bestDistance = distance;
      }
    }
    
    // Failed to meet criteria, use the closest result
    log(`Failed to meet fudge criteria after ${this.maxAttempts} attempts, using closest value`);
    this.applyRollResult(roll, bestRoll);
    
    return {
      success: false,
      value: bestValue,
      attempts: this.maxAttempts
    };
  }
  
  /**
   * Re-roll dice
   */
  rerollDice(roll) {
    const newRoll = roll.clone();
    newRoll.resetFormula();
    newRoll.evaluate({ async: false });
    return newRoll;
  }
  
  /**
   * Apply roll result
   */
  applyRollResult(targetRoll, sourceRoll) {
    // Copy the results from sourceRoll to targetRoll
    targetRoll.terms = sourceRoll.terms;
    targetRoll._total = sourceRoll._total;
    targetRoll._evaluated = sourceRoll._evaluated;
  }
  
  /**
   * Get raw dice total (sum of all dice, excluding modifiers)
   */
  getRawDiceTotal(roll) {
    let total = 0;
    
    for (const term of roll.terms) {
      if (term instanceof foundry.dice.terms.DiceTerm) {
        total += term.total;
      }
    }
    
    return total;
  }
  
  /**
   * Send whisper to GM about fudge result
   */
  async sendFudgeWhisper(result, fudge, userId) {
    const user = game.users.get(userId);
    const userName = user ? user.name : 'Unknown';
    
    let content = `<div class="die-hard-whisper">
      <h3>Fudge Applied</h3>
      <p><strong>User:</strong> ${userName}</p>
      <p><strong>Formula:</strong> ${fudge.formula}</p>
      <p><strong>Original:</strong> ${result.originalValue}</p>`;
    
    if (result.applied) {
      content += `<p><strong>Final:</strong> ${result.finalValue}</p>
        <p><strong>Attempts:</strong> ${result.attempts}</p>`;
    } else if (result.meetsCriteria) {
      content += `<p><em>Roll already met criteria</em></p>`;
    } else {
      content += `<p><strong>Final (closest):</strong> ${result.finalValue}</p>
        <p><em>Could not meet criteria after ${this.maxAttempts} attempts</em></p>`;
    }
    
    content += `</div>`;
    
    await ChatMessage.create({
      content,
      whisper: [game.user.id],
      speaker: { alias: MODULE_TITLE }
    });
  }
  
  /**
   * Process karma for a roll
   */
  processKarma(roll, speaker) {
    const config = game.diehard.config.getKarmaConfig();
    const userId = this.getUserIdFromSpeaker(speaker);
    if (!userId) return;
    
    // Check if karma is enabled
    if (!config.simple.enabled && !config.average.enabled) return;
    
    // Get roll history
    const history = game.diehard.config.getRollHistory();
    const userHistory = history[userId] || [];
    
    // Process simple karma
    if (config.simple.enabled) {
      this.processSimpleKarma(roll, userHistory, config.simple);
    }
    
    // Process average karma
    if (config.average.enabled) {
      this.processAverageKarma(roll, userHistory, config.average);
    }
  }
  
  /**
   * Process simple karma
   */
  processSimpleKarma(roll, history, config) {
    if (history.length < config.historySize) return;
    
    const recentRolls = history.slice(-config.historySize);
    const allBelowThreshold = recentRolls.every(r => r.value < config.threshold);
    
    if (allBelowThreshold) {
      const rawTotal = this.getRawDiceTotal(roll);
      
      if (rawTotal < config.minValue) {
        log('Simple Karma triggered, adjusting roll');
        this.adjustRollToMinimum(roll, config.minValue);
      }
    }
  }
  
  /**
   * Process average karma
   */
  processAverageKarma(roll, history, config) {
    if (history.length < config.historySize) return;
    
    const recentRolls = history.slice(-config.historySize);
    const average = recentRolls.reduce((sum, r) => sum + r.value, 0) / recentRolls.length;
    
    if (average < config.threshold) {
      const adjustment = config.cumulative 
        ? config.adjustment * (config.historySize - history.length + 1)
        : config.adjustment;
      
      log(`Average Karma triggered, adjusting roll by ${adjustment}`);
      this.adjustRollByAmount(roll, adjustment);
    }
  }
  
  /**
   * Adjust roll to minimum value
   */
  adjustRollToMinimum(roll, minimum) {
    const currentRaw = this.getRawDiceTotal(roll);
    if (currentRaw < minimum) {
      const difference = minimum - currentRaw;
      roll._total += difference;
    }
  }
  
  /**
   * Adjust roll by specific amount
   */
  adjustRollByAmount(roll, amount) {
    roll._total += amount;
  }
  
  /**
   * Update roll history
   */
  async updateRollHistory(rolls, speaker) {
    const userId = this.getUserIdFromSpeaker(speaker);
    if (!userId) return;
    
    for (const roll of rolls) {
      const rawTotal = this.getRawDiceTotal(roll);
      await game.diehard.config.addToRollHistory(userId, { total: rawTotal });
    }
  }
  
  /**
   * Get user ID from speaker
   */
  getUserIdFromSpeaker(speaker) {
    if (!speaker) return null;
    
    // Try to get user from actor
    if (speaker.actor) {
      const actor = game.actors.get(speaker.actor);
      if (actor) {
        return actor.ownership ? Object.keys(actor.ownership)[0] : null;
      }
    }
    
    // Try to get user from token
    if (speaker.token) {
      const token = canvas.tokens?.get(speaker.token);
      if (token && token.actor) {
        return token.actor.ownership ? Object.keys(token.actor.ownership)[0] : null;
      }
    }
    
    // Fallback to checking all users
    for (const user of game.users) {
      if (user.character?.id === speaker.actor) {
        return user.id;
      }
    }
    
    return null;
  }
}