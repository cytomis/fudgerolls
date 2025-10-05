/**
 * Fudge Configuration Dialog
 * Application for configuring fudge rules
 */

import { MODULE_ID, MODULE_TITLE } from './main.js';

export class FudgeDialog extends Application {
  constructor(options = {}) {
    super(options);
    this.fudges = game.diehard.config.getActiveFudges();
  }
  
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'die-hard-fudge-dialog',
      title: `${MODULE_TITLE} - Fudge Configuration`,
      template: 'modules/foundry-die-hard/templates/fudge-dialog.html',
      classes: ['die-hard', 'fudge-dialog'],
      width: 800,
      height: 600,
      resizable: true,
      tabs: [{ navSelector: '.tabs', contentSelector: '.content', initial: 'create' }]
    });
  }
  
  getData(options = {}) {
    const data = super.getData(options);
    
    // Get online users
    data.users = game.diehard.config.getOnlineUsers();
    data.users.unshift({ id: 'all', name: 'All Players', isGM: false });
    
    // Get roll types
    data.rollTypes = [
      { value: 'raw', label: 'Raw Dice' },
      { value: 'total', label: 'Total (with modifiers)' }
    ];
    
    // Add system-specific roll types
    const systemTypes = game.diehard.config.getSystemRollTypes();
    if (systemTypes.length > 0) {
      data.rollTypes.push(...systemTypes);
    }
    
    // Get active fudges
    data.fudges = Object.values(this.fudges).map(f => {
      const user = game.users.get(f.userId);
      return {
        ...f,
        userName: f.userId === 'all' ? 'All Players' : (user ? user.name : 'Unknown')
      };
    });
    
    return data;
  }
  
  activateListeners(html) {
    super.activateListeners(html);
    
    // Create fudge button
    html.find('#create-fudge').click(this._onCreateFudge.bind(this));
    
    // Delete fudge buttons
    html.find('.delete-fudge').click(this._onDeleteFudge.bind(this));
    
    // Toggle persistent
    html.find('.toggle-persistent').click(this._onTogglePersistent.bind(this));
    
    // Toggle active
    html.find('.toggle-active').click(this._onToggleActive.bind(this));
    
    // Clear all fudges
    html.find('#clear-all-fudges').click(this._onClearAll.bind(this));
  }
  
  async _onCreateFudge(event) {
    event.preventDefault();
    
    const form = event.currentTarget.form;
    const formData = new FormData(form);
    
    const userId = formData.get('user');
    const rollType = formData.get('rollType');
    const formula = formData.get('formula');
    const persistent = formData.get('persistent') === 'on';
    
    // Validate formula
    const parsedFormula = game.diehard.config.parseFudgeFormula(formula);
    if (!parsedFormula) {
      ui.notifications.error('Invalid formula. Use format: OPERATOR VALUE (e.g., > 15)');
      return;
    }
    
    // Create the fudge
    const fudge = {
      userId,
      rollType,
      formula,
      persistent,
      active: true
    };
    
    await game.diehard.config.addFudge(fudge);
    
    ui.notifications.info('Fudge created');
    
    // Refresh the dialog
    this.render(true);
  }
  
  async _onDeleteFudge(event) {
    event.preventDefault();
    
    const fudgeId = event.currentTarget.dataset.fudgeId;
    
    await game.diehard.config.removeFudge(fudgeId);
    
    ui.notifications.info('Fudge removed');
    
    this.render(true);
  }
  
  async _onTogglePersistent(event) {
    event.preventDefault();
    
    const fudgeId = event.currentTarget.dataset.fudgeId;
    const fudge = this.fudges[fudgeId];
    
    if (fudge) {
      await game.diehard.config.updateFudge(fudgeId, {
        persistent: !fudge.persistent
      });
      
      this.render(true);
    }
  }
  
  async _onToggleActive(event) {
    event.preventDefault();
    
    const fudgeId = event.currentTarget.dataset.fudgeId;
    const fudge = this.fudges[fudgeId];
    
    if (fudge) {
      await game.diehard.config.updateFudge(fudgeId, {
        active: !fudge.active
      });
      
      this.render(true);
    }
  }
  
  async _onClearAll(event) {
    event.preventDefault();
    
    const confirmed = await Dialog.confirm({
      title: 'Clear All Fudges',
      content: '<p>Are you sure you want to clear all active fudges?</p>',
      yes: () => true,
      no: () => false
    });
    
    if (confirmed) {
      await game.diehard.config.setActiveFudges({});
      ui.notifications.info('All fudges cleared');
      this.render(true);
    }
  }
}