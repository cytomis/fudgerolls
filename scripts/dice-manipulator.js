/**
 * Dice Manipulator - v0.0.1 Alpha
 * Simplified system for fudge and karma roll modifications
 *
 * FUDGE: Replaces d20 with specific value
 * KARMA: Modifies d20 by adjustment amount
 *
 * All modifications are hidden from players - only GM receives whispers
 */

import { MODULE_ID, log } from './main.js';

export class DiceManipulator {
  constructor() {
    // No reroll attempts needed - we directly set values
  }

  /**
   * Process fudge for a roll - REPLACES d20 with set value
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

      if (result.modified) {
        // Send whisper to GM ONLY
        this.sendFudgeWhisper(result, fudge, userId);

        // Disable fudge if not persistent
        if (!fudge.persistent) {
          config.disableFudge(fudge.id);
        }
      }
    }
  }

  /**
   * Apply a fudge to a roll - REPLACES d20 with specific value
   * This is the core fudge logic: we SET the d20 to a specific value
   */
  applyFudge(roll, fudge) {
    const formula = game.diehard.config.parseFudgeFormula(fudge.formula);
    if (!formula) {
      return { modified: false };
    }

    // Find all d20 dice in this roll
    const d20Terms = this.findAllD20Terms(roll);

    if (d20Terms.length === 0) {
      log('No d20 found in roll, cannot fudge');
      return { modified: false };
    }

    const modifications = [];
    let anyModified = false;

    // Apply fudge to each d20 in the roll
    for (const d20Info of d20Terms) {
      const d20Term = d20Info.term;
      const originalValue = d20Term.results[0].result;

      // Determine target value based on formula
      let targetValue;

      // Parse the formula to determine what value to set
      // Formula can be: "=15", ">10", "<5", etc.
      // For FUDGE, we interpret these as setting to the value if condition not met
      if (formula.operator === '=' || formula.operator === '==') {
        // Set to exact value
        targetValue = formula.value;
      } else if (formula.operator === '>=' || formula.operator === '>') {
        // Set to minimum value
        targetValue = originalValue < formula.value ? formula.value : originalValue;
      } else if (formula.operator === '<=' || formula.operator === '<') {
        // Set to maximum value
        targetValue = originalValue > formula.value ? formula.value : originalValue;
      } else {
        targetValue = formula.value;
      }

      // Clamp to valid d20 range (1-20)
      targetValue = Math.max(1, Math.min(20, targetValue));

      if (targetValue !== originalValue) {
        // REPLACE the d20 value
        d20Term.results[0].result = targetValue;
        anyModified = true;

        modifications.push({
          originalValue,
          newValue: targetValue,
          adjustment: targetValue - originalValue
        });

        log(`Fudge: Replaced d20 ${originalValue} with ${targetValue}`);
      }
    }

    if (anyModified) {
      // Recalculate the roll total
      roll._total = roll._evaluateTotal();
    }

    return {
      modified: anyModified,
      modifications
    };
  }

  /**
   * Send whisper to GM about fudge result - GM ONLY, hidden from players
   */
  async sendFudgeWhisper(result, fudge, userId) {
    const user = game.users.get(userId);
    const userName = user ? user.name : 'Unknown';

    let modificationsText = '';
    if (result.modifications && result.modifications.length > 0) {
      modificationsText = result.modifications.map(m =>
        `<li>d20: ${m.originalValue} → ${m.newValue} (${m.adjustment > 0 ? '+' : ''}${m.adjustment})</li>`
      ).join('');
    }

    const content = `<div class="die-hard-whisper">
      <h3>🎲 Fudge Roll Applied</h3>
      <p><strong>User:</strong> ${userName}</p>
      <p><strong>Formula:</strong> ${fudge.formula}</p>
      <p><strong>Changes:</strong></p>
      <ul>${modificationsText}</ul>
      <p><em>This modification is hidden from players</em></p>
    </div>`;

    await ChatMessage.create({
      content,
      whisper: [game.user.id], // Only to GM
      speaker: { alias: 'Die Hard - Fudge' }
    });
  }

  /**
   * Process karma for a roll - MODIFIES d20 by adjustment amount
   */
  async processKarma(roll, userId) {
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
      this.processSimpleKarma(roll, userHistory, config.simple, userId);
    }

    // Process average karma
    if (config.average.enabled) {
      await this.processAverageKarma(roll, userHistory, config.average, userId);
    }
  }

  /**
   * Process simple karma - if last N rolls below threshold, set to minimum
   */
  processSimpleKarma(roll, history, config, userId) {
    if (history.length < config.historySize) {
      log(`Simple Karma: Not enough history (${history.length}/${config.historySize})`);
      return;
    }

    const recentRolls = history.slice(-config.historySize);
    const allBelowThreshold = recentRolls.every(r => r.value < config.threshold);

    log(`Simple Karma check: ${recentRolls.length} rolls, all below ${config.threshold}? ${allBelowThreshold}`);

    if (allBelowThreshold) {
      // Find all d20 dice in this roll
      const d20Terms = this.findAllD20Terms(roll);

      if (d20Terms.length === 0) {
        log('Simple Karma: No d20 found in roll');
        return;
      }

      const modifications = [];

      // Apply karma to each d20
      for (const d20Info of d20Terms) {
        const d20Term = d20Info.term;
        const originalValue = d20Term.results[0].result;

        if (originalValue < config.minValue) {
          // Set to minimum value
          d20Term.results[0].result = Math.min(config.minValue, 20);
          const newValue = d20Term.results[0].result;

          modifications.push({
            originalValue,
            newValue,
            adjustment: newValue - originalValue
          });

          log(`Simple Karma: d20 ${originalValue} → ${newValue}`);
        }
      }

      if (modifications.length > 0) {
        // Recalculate the roll total
        roll._total = roll._evaluateTotal();

        this.sendKarmaWhisper('Simple Karma', modifications, config, userId);
      }
    }
  }

  /**
   * Process average karma - if average below threshold, add adjustment
   */
  async processAverageKarma(roll, history, config, userId) {
    if (history.length < config.historySize) {
      log(`Average Karma: Not enough history (${history.length}/${config.historySize})`);
      return;
    }

    const recentRolls = history.slice(-config.historySize);
    const average = recentRolls.reduce((sum, r) => sum + r.value, 0) / recentRolls.length;

    log(`Average Karma check: Average of ${recentRolls.length} rolls = ${average.toFixed(2)}, Threshold: ${config.threshold}`);

    if (average < config.threshold) {
      // Find all d20 dice in this roll
      const d20Terms = this.findAllD20Terms(roll);

      if (d20Terms.length === 0) {
        log('Average Karma: No d20 found in roll');
        return;
      }

      // Get or initialize cumulative count
      let cumulativeCount = game.diehard.config.getCumulativeCount(userId);

      if (config.cumulative) {
        cumulativeCount += 1;
      } else {
        cumulativeCount = 1;
      }

      const adjustment = cumulativeCount * config.adjustment;

      log(`Average Karma triggered! Adjustment: ${adjustment} (cumulative: ${config.cumulative}, count: ${cumulativeCount})`);

      // Store the updated cumulative count
      await game.diehard.config.setCumulativeCount(userId, cumulativeCount);

      const modifications = [];

      // Apply karma to each d20
      for (const d20Info of d20Terms) {
        const d20Term = d20Info.term;
        const originalValue = d20Term.results[0].result;

        // Only apply if current roll is below threshold
        if (originalValue < config.threshold) {
          const newValue = Math.max(1, Math.min(originalValue + adjustment, 20));
          d20Term.results[0].result = newValue;

          modifications.push({
            originalValue,
            newValue,
            adjustment: newValue - originalValue
          });

          log(`Average Karma: d20 ${originalValue} → ${newValue} (${adjustment > 0 ? '+' : ''}${adjustment})`);
        }
      }

      if (modifications.length > 0) {
        // Recalculate the roll total
        roll._total = roll._evaluateTotal();

        this.sendKarmaWhisper('Average Karma', modifications, config, userId);

        // Check if the new average (after adjustment) reaches the threshold
        // Use the first modified die's new value for average calculation
        if (modifications.length > 0) {
          const adjustedRolls = [...recentRolls.slice(0, -1), { value: modifications[0].newValue }];
          const newAverage = adjustedRolls.reduce((sum, r) => sum + r.value, 0) / adjustedRolls.length;

          log(`Average Karma: New average after adjustment: ${newAverage.toFixed(2)}`);

          if (newAverage >= config.threshold) {
            log(`Average Karma: Threshold reached! Resetting cumulative counter.`);
            await game.diehard.config.resetCumulativeCount(userId);
          }
        }
      }
    } else {
      // Average is at or above threshold, reset cumulative counter
      log(`Average Karma: Average ${average.toFixed(2)} is at or above threshold ${config.threshold}, resetting cumulative counter`);
      await game.diehard.config.resetCumulativeCount(userId);
    }
  }

  /**
   * Send whisper about karma adjustment - GM ONLY, hidden from players
   */
  async sendKarmaWhisper(type, modifications, config, userId) {
    const user = game.users.get(userId);
    const userName = user ? user.name : 'Unknown';

    let modificationsText = '';
    if (modifications && modifications.length > 0) {
      modificationsText = modifications.map(m =>
        `<li>d20: ${m.originalValue} → ${m.newValue} (${m.adjustment > 0 ? '+' : ''}${m.adjustment})</li>`
      ).join('');
    }

    const content = `<div class="die-hard-whisper karma-whisper">
      <h3>✨ ${type} Applied</h3>
      <p><strong>User:</strong> ${userName}</p>
      <p><strong>Changes:</strong></p>
      <ul>${modificationsText}</ul>
      <p><em>Threshold: ${config.threshold}</em></p>
      <p><em>This modification is hidden from players</em></p>
    </div>`;

    await ChatMessage.create({
      content,
      whisper: [game.user.id], // Only to GM
      speaker: { alias: 'Die Hard - Karma' }
    });
  }

  /**
   * Find all d20 dice terms in a roll
   * Returns array of {term, index} objects for each d20 found
   * Handles multiple d20s in a single roll (e.g., PF2e Recall Knowledge with multiple skills)
   */
  findAllD20Terms(roll) {
    const d20Terms = [];

    // Approach 1: Look for d20 in direct terms
    for (let i = 0; i < roll.terms.length; i++) {
      const term = roll.terms[i];
      if (term instanceof foundry.dice.terms.DiceTerm && term.faces === 20 && term.results && term.results.length > 0) {
        d20Terms.push({ term, index: i });
        log(`Found d20 in terms[${i}]`);
      }
    }

    // Approach 2: Look in nested dice array (if no terms found)
    if (d20Terms.length === 0 && roll.dice && Array.isArray(roll.dice)) {
      for (let i = 0; i < roll.dice.length; i++) {
        const die = roll.dice[i];
        if (die.faces === 20 && die.results && die.results.length > 0) {
          d20Terms.push({ term: die, index: i });
          log(`Found d20 in dice[${i}]`);
        }
      }
    }

    log(`Found ${d20Terms.length} d20 dice in roll`);
    return d20Terms;
  }

  /**
   * Update roll history - tracks raw d20 values for karma calculations
   */
  async updateRollHistory(rolls, userId) {
    if (!userId) {
      log('No userId provided for updating roll history');
      return;
    }

    for (const roll of rolls) {
      // Find d20 values and track them
      const d20Terms = this.findAllD20Terms(roll);

      if (d20Terms.length > 0) {
        // Track the first d20 value for karma calculations
        const d20Value = d20Terms[0].term.results[0].result;
        await game.diehard.config.addToRollHistory(userId, { total: d20Value });
        log(`Added d20 roll to history for user ${userId}: ${d20Value}`);
      }
    }
  }
}
