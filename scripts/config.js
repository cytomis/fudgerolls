/**
 * Die Hard Configuration Class
 * Manages module configuration and settings
 */

import { MODULE_ID, log } from './main.js';

export class DieHardConfig {
  constructor() {
    this.operators = {
      '<': (a, b) => a < b,
      '<=': (a, b) => a <= b,
      '>': (a, b) => a > b,
      '>=': (a, b) => a >= b,
      '=': (a, b) => a === b,
      '==': (a, b) => a === b,
      '!=': (a, b) => a !== b
    };
    
    this.rollTypes = {
      RAW: 'raw',
      TOTAL: 'total',
      SYSTEM: 'system'
    };
  }
  
  /**
   * Get all active fudges
   */
  getActiveFudges() {
    return game.settings.get(MODULE_ID, 'activeFudges') || {};
  }
  
  /**
   * Set active fudges
   */
  async setActiveFudges(fudges) {
    return await game.settings.set(MODULE_ID, 'activeFudges', fudges);
  }
  
  /**
   * Add a new fudge
   */
  async addFudge(fudge) {
    const fudges = this.getActiveFudges();
    const id = foundry.utils.randomID();
    
    fudges[id] = {
      id,
      ...fudge,
      active: true,
      timestamp: Date.now()
    };
    
    await this.setActiveFudges(fudges);
    log('Fudge added:', fudge);
    
    return id;
  }
  
  /**
   * Remove a fudge by ID
   */
  async removeFudge(id) {
    const fudges = this.getActiveFudges();
    delete fudges[id];
    await this.setActiveFudges(fudges);
    log('Fudge removed:', id);
  }
  
  /**
   * Update a fudge
   */
  async updateFudge(id, updates) {
    const fudges = this.getActiveFudges();
    if (fudges[id]) {
      fudges[id] = {
        ...fudges[id],
        ...updates
      };
      await this.setActiveFudges(fudges);
      log('Fudge updated:', id, updates);
    }
  }
  
  /**
   * Disable a fudge
   */
  async disableFudge(id) {
    await this.updateFudge(id, { active: false });
  }
  
  /**
   * Get karma configuration
   */
  getKarmaConfig() {
    return game.settings.get(MODULE_ID, 'karmaConfig');
  }
  
  /**
   * Set karma configuration
   */
  async setKarmaConfig(config) {
    return await game.settings.set(MODULE_ID, 'karmaConfig', config);
  }
  
  /**
   * Get roll history
   */
  getRollHistory() {
    return game.settings.get(MODULE_ID, 'rollHistory') || {};
  }
  
  /**
   * Set roll history
   */
  async setRollHistory(history) {
    return await game.settings.set(MODULE_ID, 'rollHistory', history);
  }
  
  /**
   * Add roll to history
   */
  async addToRollHistory(userId, roll) {
    const history = this.getRollHistory();
    
    if (!history[userId]) {
      history[userId] = [];
    }
    
    history[userId].push({
      value: roll.total,
      timestamp: Date.now()
    });
    
    // Trim history to max size
    const maxSize = Math.max(
      this.getKarmaConfig().simple.historySize,
      this.getKarmaConfig().average.historySize
    );
    
    if (history[userId].length > maxSize) {
      history[userId] = history[userId].slice(-maxSize);
    }
    
    await this.setRollHistory(history);
  }
  
  /**
   * Clear roll history for a user
   */
  async clearUserHistory(userId) {
    const history = this.getRollHistory();
    delete history[userId];
    await this.setRollHistory(history);
  }
  
  /**
   * Parse fudge formula
   */
  parseFudgeFormula(formula) {
    if (!formula || typeof formula !== 'string') {
      return null;
    }
    
    formula = formula.trim();
    
    // Find the operator
    let operator = null;
    let value = null;
    
    for (const op of Object.keys(this.operators)) {
      if (formula.startsWith(op)) {
        operator = op;
        value = formula.substring(op.length).trim();
        break;
      }
    }
    
    if (!operator || !value) {
      return null;
    }
    
    // Parse the value
    const numValue = parseInt(value);
    if (isNaN(numValue)) {
      return null;
    }
    
    return {
      operator,
      value: numValue,
      test: this.operators[operator]
    };
  }
  
  /**
   * Get list of online users (for fudge targeting)
   */
  getOnlineUsers() {
    return game.users.filter(u => u.active).map(u => ({
      id: u.id,
      name: u.name,
      isGM: u.isGM
    }));
  }
  
  /**
   * Get system-specific roll types (if applicable)
   */
  getSystemRollTypes() {
    const systemId = game.system.id;
    
    switch (systemId) {
      case 'dnd5e':
        return [
          { value: 'skill', label: 'Skill Check' },
          { value: 'ability', label: 'Ability Check' },
          { value: 'save', label: 'Saving Throw' },
          { value: 'attack', label: 'Attack Roll' },
          { value: 'damage', label: 'Damage Roll' },
          { value: 'death', label: 'Death Save' }
        ];
      case 'pf2e':
        return [
          { value: 'skill', label: 'Skill Check' },
          { value: 'save', label: 'Saving Throw' },
          { value: 'attack', label: 'Attack Roll' },
          { value: 'damage', label: 'Damage Roll' }
        ];
      default:
        return [];
    }
  }
}