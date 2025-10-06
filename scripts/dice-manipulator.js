/**
 * Dice Manipulator
 * Handles the actual manipulation of dice rolls for fudge and karma systems
 */

import { MODULE_ID, log } from './main.js';

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

    // Get original raw die value for GM message
    const originalRawDieValue = this.getRawDiceTotal(roll);

    // Check if roll already meets criteria
    if (formula.test(targetValue, formula.value)) {
      log(`Roll ${targetValue} already meets formula ${fudge.formula}`);
      return {
        attempted: true,
        applied: false,
        originalValue: targetValue,
        finalValue: targetValue,
        originalRawDieValue: originalRawDieValue,
        finalRawDieValue: originalRawDieValue,
        meetsCriteria: true
      };
    }

    // Attempt to fudge the roll
    const result = this.attemptFudge(roll, formula, rollType);

    // Get final raw die value after fudge
    const finalRawDieValue = this.getRawDiceTotal(roll);

    return {
      attempted: true,
      applied: result.success,
      originalValue: targetValue,
      finalValue: result.value,
      originalRawDieValue: originalRawDieValue,
      finalRawDieValue: finalRawDieValue,
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
  async sendFudgeWhisper(result, fudge, userId, roll) {
    const user = game.users.get(userId);
    const userName = user ? user.name : 'Unknown';

    // Get raw die values for display (not totals with modifiers)
    const originalRawValue = result.originalRawDieValue || result.originalValue;
    const finalRawValue = result.finalRawDieValue || result.finalValue;

    let content = `<div class="die-hard-whisper">
      <h3>Fudge Applied</h3>
      <p><strong>User:</strong> ${userName}</p>
      <p><strong>Formula:</strong> ${fudge.formula}</p>
      <p><strong>Original d20:</strong> ${originalRawValue}</p>`;

    if (result.applied) {
      content += `<p><strong>Final d20:</strong> ${finalRawValue}</p>
        <p><strong>Adjustment:</strong> ${finalRawValue > originalRawValue ? '+' : ''}${finalRawValue - originalRawValue}</p>
        <p><strong>Attempts:</strong> ${result.attempts}</p>`;
    } else if (result.meetsCriteria) {
      content += `<p><em>Roll already met criteria</em></p>`;
    } else {
      content += `<p><strong>Final d20 (closest):</strong> ${finalRawValue}</p>
        <p><strong>Adjustment:</strong> ${finalRawValue > originalRawValue ? '+' : ''}${finalRawValue - originalRawValue}</p>
        <p><em>Could not meet criteria after ${this.maxAttempts} attempts</em></p>`;
    }

    content += `</div>`;

    await ChatMessage.create({
      content,
      whisper: [game.user.id],
      speaker: { alias: 'Die Hard' }
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
      const originalRawTotal = this.getRawDiceTotal(roll);

      log(`Simple Karma triggered! Raw total: ${originalRawTotal}, Minimum: ${config.minValue}`);

      if (originalRawTotal < config.minValue) {
        log(`Simple Karma: Adjusting roll to minimum ${config.minValue}`);
        this.adjustRollToMinimum(roll, config.minValue);
        const finalRawTotal = this.getRawDiceTotal(roll);
        this.sendKarmaWhisper('Simple Karma', originalRawTotal, finalRawTotal, config);
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
      const originalRawTotal = this.getRawDiceTotal(roll);

      // Only apply karma if the current roll is below the threshold
      if (originalRawTotal < config.threshold) {
        const adjustment = config.cumulative
          ? config.adjustment * (history.length - config.historySize + 1)
          : config.adjustment;

        log(`Average Karma triggered! Current roll: ${originalRawTotal}, Adjustment: ${adjustment} (cumulative: ${config.cumulative})`);
        this.adjustRollByAmount(roll, adjustment);
        const finalRawTotal = this.getRawDiceTotal(roll);
        this.sendKarmaWhisper('Average Karma', originalRawTotal, finalRawTotal, config);
      } else {
        log(`Average Karma: Current roll ${originalRawTotal} is not below threshold ${config.threshold}, no adjustment`);
      }
    }
  }
  
  /**
   * Send whisper about karma adjustment
   */
  async sendKarmaWhisper(type, originalRawValue, finalRawValue, config) {
    const adjustment = finalRawValue - originalRawValue;
    const content = `<div class="die-hard-whisper karma-whisper">
      <h3>${type} Applied</h3>
      <p><strong>Original d20:</strong> ${originalRawValue}</p>
      <p><strong>Adjusted d20:</strong> ${finalRawValue}</p>
      <p><strong>Adjustment:</strong> ${adjustment > 0 ? '+' : ''}${adjustment}</p>
      <p class="karma-config"><em>Threshold: ${config.threshold}</em></p>
    </div>`;

    await ChatMessage.create({
      content,
      whisper: [game.user.id],
      speaker: { alias: 'Die Hard - Karma' }
    });
  }
  
  /**
   * Adjust roll to minimum value by modifying the die result directly
   */
  adjustRollToMinimum(roll, minimum) {
    const currentRaw = this.getRawDiceTotal(roll);
    if (currentRaw >= minimum) {
      log(`Roll ${currentRaw} already meets minimum ${minimum}, no adjustment needed`);
      return;
    }

    log(`Adjusting roll from ${currentRaw} to ${minimum}`);

    // Find the d20 die term in the roll
    let d20Term = null;
    for (const term of roll.terms) {
      if (term instanceof foundry.dice.terms.DiceTerm && term.faces === 20) {
        d20Term = term;
        break;
      }
    }

    if (!d20Term || !d20Term.results || d20Term.results.length === 0) {
      log('No d20 found in roll, cannot adjust');
      return;
    }

    // Calculate the new die value (capped at die maximum)
    const originalDieValue = d20Term.results[0].result;
    const difference = minimum - currentRaw;
    const newDieValue = Math.min(originalDieValue + difference, d20Term.faces);

    log(`Modifying d20 result: ${originalDieValue} -> ${newDieValue} (capped at ${d20Term.faces})`);

    // Modify the die result directly
    d20Term.results[0].result = newDieValue;

    // Recalculate the total
    roll._total = roll._evaluateTotal();

    log(`Roll adjusted. New total: ${roll._total}`);
  }
  
  /**
   * Adjust roll by specific amount by modifying the die result directly
   */
  adjustRollByAmount(roll, amount) {
    if (amount === 0) return;

    log(`Adjusting roll by ${amount}`);

    // Find the d20 die term in the roll
    let d20Term = null;
    for (const term of roll.terms) {
      if (term instanceof foundry.dice.terms.DiceTerm && term.faces === 20) {
        d20Term = term;
        break;
      }
    }

    if (!d20Term || !d20Term.results || d20Term.results.length === 0) {
      log('No d20 found in roll, cannot adjust');
      return;
    }

    const originalDieValue = d20Term.results[0].result;
    const newDieValue = Math.max(1, Math.min(originalDieValue + amount, d20Term.faces));

    log(`Modifying d20 result: ${originalDieValue} -> ${newDieValue} (capped between 1 and ${d20Term.faces})`);

    // Modify the die result directly
    d20Term.results[0].result = newDieValue;

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
