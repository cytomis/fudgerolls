/**
 * Karma Configuration Dialog
 * Application for configuring karma rules
 */

import { MODULE_ID } from './main.js';

export class KarmaDialog extends foundry.applications.api.ApplicationV2 {
  constructor(options = {}) {
    super(options);
    this.config = game.diehard.config.getKarmaConfig();
  }
  
  static DEFAULT_OPTIONS = {
    id: 'die-hard-karma-dialog',
    tag: 'div',
    window: {
      title: 'Die Hard - Karma Configuration',
      resizable: true
    },
    classes: ['die-hard', 'karma-dialog'],
    position: {
      width: 700,
      height: 700
    }
  };

  static PARTS = {
    form: {
      template: 'modules/foundry-die-hard/templates/karma-dialog.html'
    }
  };
  
  async _prepareContext(options = {}) {
    const context = await super._prepareContext(options);
    
    // Add karma configuration
    context.config = this.config;
    
    // Get online users with karma enabled status
    context.users = game.users.map(u => {
      const enabled = game.diehard.config.isKarmaEnabledForUser(u.id);
      return {
        id: u.id,
        name: u.name,
        isGM: u.isGM,
        active: u.active,
        karmaEnabled: enabled
      };
    });
    
    // Get roll history
    const history = game.diehard.config.getRollHistory();
    context.history = [];
    
    for (const [userId, rolls] of Object.entries(history)) {
      const user = game.users.get(userId);
      if (!user) continue;
      
      const recentRolls = rolls.slice(-20);
      const average = rolls.length > 0 
        ? rolls.reduce((sum, r) => sum + r.value, 0) / rolls.length 
        : 0;
      
      context.history.push({
        userId,
        userName: user.name,
        rolls: recentRolls,
        average: average.toFixed(2),
        count: rolls.length
      });
    }
    
    // Calculate statistics for all players based on configured history size
    const simpleHistorySize = this.config.simple.historySize || 5;
    const averageHistorySize = this.config.average.historySize || 10;
    const maxHistorySize = Math.max(simpleHistorySize, averageHistorySize);
    
    context.statistics = game.users.map(u => {
      const userRolls = history[u.id] || [];
      const recentRolls = userRolls.slice(-maxHistorySize);
      const simpleRolls = userRolls.slice(-simpleHistorySize);
      const averageRolls = userRolls.slice(-averageHistorySize);
      
      // Calculate averages
      const overallAverage = userRolls.length > 0
        ? userRolls.reduce((sum, r) => sum + r.value, 0) / userRolls.length
        : 0;
      
      const simpleAverage = simpleRolls.length > 0
        ? simpleRolls.reduce((sum, r) => sum + r.value, 0) / simpleRolls.length
        : 0;
      
      const averageKarmaAverage = averageRolls.length > 0
        ? averageRolls.reduce((sum, r) => sum + r.value, 0) / averageRolls.length
        : 0;
      
      // Find min and max in recent rolls
      const min = recentRolls.length > 0
        ? Math.min(...recentRolls.map(r => r.value))
        : 0;
      
      const max = recentRolls.length > 0
        ? Math.max(...recentRolls.map(r => r.value))
        : 0;
      
      // Check if simple karma would trigger
      const simpleTriggered = simpleRolls.length >= simpleHistorySize &&
        simpleRolls.every(r => r.value < this.config.simple.threshold) &&
        this.config.simple.enabled &&
        game.diehard.config.isKarmaEnabledForUser(u.id);
      
      // Check if average karma would trigger
      const averageTriggered = averageRolls.length >= averageHistorySize &&
        averageKarmaAverage < this.config.average.threshold &&
        this.config.average.enabled &&
        game.diehard.config.isKarmaEnabledForUser(u.id);
      
      return {
        userId: u.id,
        userName: u.name,
        isGM: u.isGM,
        active: u.active,
        karmaEnabled: game.diehard.config.isKarmaEnabledForUser(u.id),
        totalRolls: userRolls.length,
        overallAverage: overallAverage.toFixed(2),
        simpleAverage: simpleAverage.toFixed(2),
        averageKarmaAverage: averageKarmaAverage.toFixed(2),
        min,
        max,
        simpleTriggered,
        averageTriggered,
        recentRolls: recentRolls.map(r => r.value)
      };
    }).filter(s => s.totalRolls > 0); // Only show users with roll history
    
    return context;
  }
  
  _onRender(context, options) {
    super._onRender(context, options);
    
    // Save configuration
    this.element.querySelector('#save-karma-config')?.addEventListener('click', this._onSaveConfig.bind(this));
    
    // Toggle simple karma
    this.element.querySelector('#simple-enabled')?.addEventListener('change', this._onToggleSimple.bind(this));
    
    // Toggle average karma
    this.element.querySelector('#average-enabled')?.addEventListener('change', this._onToggleAverage.bind(this));
    
    // Toggle karma for individual users
    this.element.querySelectorAll('.toggle-user-karma').forEach(checkbox => {
      checkbox.addEventListener('change', this._onToggleUserKarma.bind(this));
    });
    
    // Clear user history
    this.element.querySelectorAll('.clear-user-history').forEach(btn => {
      btn.addEventListener('click', this._onClearUserHistory.bind(this));
    });
    
    // Clear all history
    this.element.querySelector('#clear-all-history')?.addEventListener('click', this._onClearAllHistory.bind(this));
  }
  
  async _onSaveConfig(event) {
    event.preventDefault();
    
    const form = this.element.querySelector('#karma-config-form');
    const formData = new FormData(form);
    
    const config = {
      simple: {
        enabled: formData.get('simple-enabled') === 'on',
        historySize: parseInt(formData.get('simple-history-size')) || 5,
        threshold: parseInt(formData.get('simple-threshold')) || 10,
        minValue: parseInt(formData.get('simple-min-value')) || 15
      },
      average: {
        enabled: formData.get('average-enabled') === 'on',
        historySize: parseInt(formData.get('average-history-size')) || 10,
        threshold: parseInt(formData.get('average-threshold')) || 10,
        adjustment: parseInt(formData.get('average-adjustment')) || 2,
        cumulative: formData.get('average-cumulative') === 'on'
      }
    };
    
    await game.diehard.config.setKarmaConfig(config);
    
    ui.notifications.info('Karma configuration saved');
    
    this.render();
  }
  
  _onToggleSimple(event) {
    const enabled = event.target.checked;
    const form = this.element.querySelector('#karma-config-form');
    
    // Enable/disable related fields
    form.querySelectorAll('.simple-field').forEach(field => {
      field.disabled = !enabled;
    });
  }
  
  _onToggleAverage(event) {
    const enabled = event.target.checked;
    const form = this.element.querySelector('#karma-config-form');
    
    // Enable/disable related fields
    form.querySelectorAll('.average-field').forEach(field => {
      field.disabled = !enabled;
    });
  }
  
  async _onToggleUserKarma(event) {
    const userId = event.target.dataset.userId;
    const enabled = event.target.checked;
    
    await game.diehard.config.toggleKarmaForUser(userId, enabled);
    
    const user = game.users.get(userId);
    ui.notifications.info(`Karma ${enabled ? 'enabled' : 'disabled'} for ${user.name}`);
  }
  
  async _onClearUserHistory(event) {
    event.preventDefault();
    
    const userId = event.target.dataset.userId;
    const user = game.users.get(userId);
    
    const confirmed = await Dialog.confirm({
      title: 'Clear User History',
      content: `<p>Clear roll history for ${user.name}?</p>`,
      yes: () => true,
      no: () => false
    });
    
    if (confirmed) {
      await game.diehard.config.clearUserHistory(userId);
      ui.notifications.info(`History cleared for ${user.name}`);
      this.render();
    }
  }
  
  async _onClearAllHistory(event) {
    event.preventDefault();
    
    const confirmed = await Dialog.confirm({
      title: 'Clear All History',
      content: '<p>Are you sure you want to clear all roll history?</p>',
      yes: () => true,
      no: () => false
    });
    
    if (confirmed) {
      await game.diehard.config.setRollHistory({});
      ui.notifications.info('All roll history cleared');
      this.render();
    }
  }
  
  /**
   * Show quick statistics as a notification
   */
  static showQuickStats() {
    const config = game.diehard.config.getKarmaConfig();
    const history = game.diehard.config.getRollHistory();
    const historySize = Math.max(config.simple.historySize || 5, config.average.historySize || 10);
    
    let content = '<div class="die-hard-stats"><h3>Current Roll Statistics</h3>';
    content += `<p class="stats-info">Based on last ${historySize} rolls</p><table>`;
    content += '<tr><th>Player</th><th>Avg</th><th>Min</th><th>Max</th><th>Count</th></tr>';
    
    const stats = [];
    for (const user of game.users) {
      const userRolls = history[user.id] || [];
      if (userRolls.length === 0) continue;
      
      const recentRolls = userRolls.slice(-historySize);
      const average = recentRolls.reduce((sum, r) => sum + r.value, 0) / recentRolls.length;
      const min = Math.min(...recentRolls.map(r => r.value));
      const max = Math.max(...recentRolls.map(r => r.value));
      
      stats.push({
        name: user.name,
        average,
        min,
        max,
        count: userRolls.length
      });
    }
    
    // Sort by average (lowest first)
    stats.sort((a, b) => a.average - b.average);
    
    if (stats.length === 0) {
      content += '<tr><td colspan="5" style="text-align:center;">No roll history yet</td></tr>';
    } else {
      for (const stat of stats) {
        content += `<tr>
          <td><strong>${stat.name}</strong></td>
          <td>${stat.average.toFixed(2)}</td>
          <td>${stat.min}</td>
          <td>${stat.max}</td>
          <td>${stat.count}</td>
        </tr>`;
      }
    }
    
    content += '</table></div>';
    
    ChatMessage.create({
      content,
      whisper: [game.user.id],
      speaker: { alias: 'Die Hard' }
    });
  }
}
