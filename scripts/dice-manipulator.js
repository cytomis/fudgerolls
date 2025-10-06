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
  processFudge(roll, userId) {
    const paused = game.settings.get(MODULE_ID, 'fudgesPaused');
    if (paused) return;
    
    const config = game.diehard.config;
    const fudges = config.getActiveFudges();
    
    if (!userId) {
      log('No userId provided for fudge processing');
      return;
    }
    
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
    // Create a new roll with the same formula
    const newRoll = new Roll(roll.formula);
    newRoll.evaluate({ async: false });
    return newRoll;
  }
  
  /**
   * Apply roll result by modifying the roll in place
   */
  applyRollResult(targetRoll, sourceRoll) {
    // Copy all the important properties from sourceRoll to targetRoll
    targetRoll.terms = foundry.utils.duplicate(sourceRoll.terms);
    targetRoll._total = sourceRoll._total;
    targetRoll._evaluated = sourceRoll._evaluated;
    targetRoll._dice = sourceRoll._dice;
    
    // Force recalculation of the total
    targetRoll._total = targetRoll._evaluateTotal();
    
    log('Applied roll result:', {
      original: sourceRoll._total,
      modified: targetRoll._total
    });
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
  processKarma(roll, userId) {
    const config = game.diehard.config.getKarmaConfig();
    
    if (!userId) {
      log('No userId provided for karma processing');
      return;
    }
    
    // Check if karma is enabled for this specific user
    if (!game.diehard.config.isKarmaEnabledForUser(userId)) {
      log(`Karma disabled for user ${userId}, skipping`);
      return;
    }
    
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
    if (history.length < config.historySize) {
      log(`Simple Karma: Not enough history (${history.length}/${config.historySize})`);
      return;
    }
    
    const recentRolls = history.slice(-config.historySize);
    const allBelowThreshold = recentRolls.every(r => r.value < config.threshold);
    
    log(`Simple Karma check: ${recentRolls.length} rolls, all below ${config.threshold}? ${allBelowThreshold}`);
    
    if (allBelowThreshold) {
      const rawTotal = this.getRawDiceTotal(roll);
      
      log(`Simple Karma triggered! Raw total: ${rawTotal}, Minimum: ${config.minValue}`);
      
      if (rawTotal < config.minValue) {
        log(`Simple Karma: Adjusting roll to minimum ${config.minValue}`);
        this.adjustRollToMinimum(roll, config.minValue);
        this.sendKarmaWhisper('Simple Karma', rawTotal, roll.total, config);
      }
    }
  }
  
  /**
   * Process average karma
   */
  processAverageKarma(roll, history, config) {
    if (history.length < config.historySize) {
      log(`Average Karma: Not enough history (${history.length}/${config.historySize})`);
      return;
    }
    
    const recentRolls = history.slice(-config.historySize);
    const average = recentRolls.reduce((sum, r) => sum + r.value, 0) / recentRolls.length;
    
    log(`Average Karma check: Average of ${recentRolls.length} rolls = ${average.toFixed(2)}, Threshold: ${config.threshold}`);
    
    if (average < config.threshold) {
      const originalTotal = roll.total;
      const adjustment = config.cumulative 
        ? config.adjustment * (history.length - config.historySize + 1)
        : config.adjustment;
      
      log(`Average Karma triggered! Adjustment: ${adjustment} (cumulative: ${config.cumulative})`);
      this.adjustRollByAmount(roll, adjustment);
      this.sendKarmaWhisper('Average Karma', originalTotal, roll.total, config);
    }
  }
  
  /**
   * Send whisper about karma adjustment
   */
  async sendKarmaWhisper(type, originalValue, finalValue, config) {
    const content = `<div class="die-hard-whisper karma-whisper">
      <h3>${type} Applied</h3>
      <p><strong>Original Total:</strong> ${originalValue}</p>
      <p><strong>Adjusted Total:</strong> ${finalValue}</p>
      <p><strong>Adjustment:</strong> +${finalValue - originalValue}</p>
      <p class="karma-config"><em>Threshold: ${config.threshold}</em></p>
    </div>`;
    
    await ChatMessage.create({
      content,
      whisper: [game.user.id],
      speaker: { alias: `${MODULE_TITLE} - Karma` }
    });
  }
  
  /**
   * Adjust roll to minimum value
   */
  adjustRollToMinimum(roll, minimum) {
    const currentRaw = this.getRawDiceTotal(roll);
    if (currentRaw < minimum) {
      const difference = minimum - currentRaw;
      
      log(`Adjusting roll from ${currentRaw} to ${minimum} (difference: ${difference})`);
      
      // Add a modifier term to the roll to reach the minimum
      const modifier = new foundry.dice.terms.NumericTerm({ number: difference });
      roll.terms.push(new foundry.dice.terms.OperatorTerm({ operator: '+' }));
      roll.terms.push(modifier);
      
      // Recalculate the total
      roll._total = roll._evaluateTotal();
      
      log(`Roll adjusted. New total: ${roll._total}`);
    }
  }
  
  /**
   * Adjust roll by specific amount
   */
  adjustRollByAmount(roll, amount) {
    if (amount === 0) return;
    
    log(`Adjusting roll by ${amount}`);
    
    // Add a modifier term to the roll
    const modifier = new foundry.dice.terms.NumericTerm({ number: Math.abs(amount) });
    const operator = amount > 0 ? '+' : '-';
    
    roll.terms.push(new foundry.dice.terms.OperatorTerm({ operator }));
    roll.terms.push(modifier);
    
    // Recalculate the total
    roll._total = roll._evaluateTotal();
    
    log(`Roll adjusted. New total: ${roll._total}`);
  }
  
  /**
   * Update roll history
   */
  async updateRollHistory(rolls, userId) {
    if (!userId) {
      log('No userId provided for updating roll history');
      return;
    }
    
    for (const roll of rolls) {
      const rawTotal = this.getRawDiceTotal(roll);
      await game.diehard.config.addToRollHistory(userId, { total: rawTotal });
      log(`Added roll to history for user ${userId}: ${rawTotal}`);
    }
  }
  
  /**
   * Get user ID from speaker (kept for backward compatibility, but not used anymore)
   */
  getUserIdFromSpeaker(speaker) {
    if (!speaker) return null;
    
    // First, try to get the user from the actor
    if (speaker.actor) {
      const actor = game.actors.get(speaker.actor);
      if (actor) {
        // Find the user who owns this actor
        for (const [userId, permission] of Object.entries(actor.ownership)) {
          if (userId !== 'default' && permission === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
            return userId;
          }
        }
      }
    }
    
    // Try to get user from token
    if (speaker.token) {
      const token = canvas.tokens?.get(speaker.token);
      if (token?.actor) {
        for (const [userId, permission] of Object.entries(token.actor.ownership)) {
          if (userId !== 'default' && permission === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
            return userId;
          }
        }
      }
    }
    
    // Fallback: check if any user has this actor as their character
    for (const user of game.users) {
      if (user.character?.id === speaker.actor) {
        return user.id;
      }
    }
    
    return null;
  }
}
