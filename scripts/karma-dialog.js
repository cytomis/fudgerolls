/**
 * Karma Configuration Dialog
 * Application for configuring karma rules
 */

import { MODULE_ID, MODULE_TITLE } from './main.js';

export class KarmaDialog extends Application {
  constructor(options = {}) {
    super(options);
    this.config = game.diehard.config.getKarmaConfig();
  }
  
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'die-hard-karma-dialog',
      title: `${MODULE_TITLE} - Karma Configuration`,
      template: 'modules/foundry-die-hard/templates/karma-dialog.html',
      classes: ['die-hard', 'karma-dialog'],
      width: 700,
      height: 700,
      resizable: true,
      tabs: [{ navSelector: '.tabs', contentSelector: '.content', initial: 'config' }]
    });
  }
  
  getData(options = {}) {
    const data = super.getData(options);
    
    // Add karma configuration
    data.config = this.config;
    
    // Get roll history
    const history = game.diehard.config.getRollHistory();
    data.history = [];
    
    for (const [userId, rolls] of Object.entries(history)) {
      const user = game.users.get(userId);
      if (!user) continue;
      
      const recentRolls = rolls.slice(-20);
      const average = rolls.length > 0 
        ? rolls.reduce((sum, r) => sum + r.value, 0) / rolls.length 
        : 0;
      
      data.history.push({
        userId,
        userName: user.name,
        rolls: recentRolls,
        average: average.toFixed(2),
        count: rolls.length
      });
    }
    
    return data;
  }
  
  activateListeners(html) {
    super.activateListeners(html);
    
    // Save configuration
    html.find('#save-karma-config').click(this._onSaveConfig.bind(this));
    
    // Toggle simple karma
    html.find('#simple-enabled').change(this._onToggleSimple.bind(this));
    
    // Toggle average karma
    html.find('#average-enabled').change(this._onToggleAverage.bind(this));
    
    // Clear user history
    html.find('.clear-user-history').click(this._onClearUserHistory.bind(this));
    
    // Clear all history
    html.find('#clear-all-history').click(this._onClearAllHistory.bind(this));
  }
  
  async _onSaveConfig(event) {
    event.preventDefault();
    
    const form = event.currentTarget.form;
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
    
    this.render(true);
  }
  
  _onToggleSimple(event) {
    const enabled = event.currentTarget.checked;
    const form = event.currentTarget.form;
    
    // Enable/disable related fields
    form.querySelectorAll('.simple-field').forEach(field => {
      field.disabled = !enabled;
    });
  }
  
  _onToggleAverage(event) {
    const enabled = event.currentTarget.checked;
    const form = event.currentTarget.form;
    
    // Enable/disable related fields
    form.querySelectorAll('.average-field').forEach(field => {
      field.disabled = !enabled;
    });
  }
  
  async _onClearUserHistory(event) {
    event.preventDefault();
    
    const userId = event.currentTarget.dataset.userId;
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
      this.render(true);
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
      this.render(true);
    }
  }
}