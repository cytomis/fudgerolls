/**
 * Fudge Configuration Dialog
 * Application for configuring fudge rules
 */

import { MODULE_ID } from './main.js';

export class FudgeDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  constructor(options = {}) {
    super(options);
    this.fudges = game.diehard.config.getActiveFudges();
  }
  
  static DEFAULT_OPTIONS = {
    id: 'die-hard-fudge-dialog',
    tag: 'div',
    window: {
      title: 'Die Hard - Fudge Configuration',
      resizable: true
    },
    classes: ['die-hard', 'fudge-dialog'],
    position: {
      width: 800,
      height: 600
    }
  };

  static PARTS = {
    form: {
      template: 'modules/foundry-die-hard/templates/fudge-dialog.html'
    }
  };
  
  async _prepareContext(options = {}) {
    const context = await super._prepareContext(options);
    
    // Get online users
    context.users = game.diehard.config.getOnlineUsers();
    context.users.unshift({ id: 'all', name: 'All Players', isGM: false });
    
    // Get roll types
    context.rollTypes = [
      { value: 'raw', label: 'Raw Dice' },
      { value: 'total', label: 'Total (with modifiers)' }
    ];
    
    // Add system-specific roll types
    const systemTypes = game.diehard.config.getSystemRollTypes();
    if (systemTypes.length > 0) {
      context.rollTypes.push(...systemTypes);
    }
    
    // Get active fudges
    context.fudges = Object.values(this.fudges).map(f => {
      const user = game.users.get(f.userId);
      return {
        ...f,
        userName: f.userId === 'all' ? 'All Players' : (user ? user.name : 'Unknown')
      };
    });
    
    return context;
  }
  
  _onRender(context, options) {
    super._onRender(context, options);
    
    // Create fudge button
    this.element.querySelector('#create-fudge')?.addEventListener('click', this._onCreateFudge.bind(this));
    
    // Delete fudge buttons
    this.element.querySelectorAll('.delete-fudge').forEach(btn => {
      btn.addEventListener('click', this._onDeleteFudge.bind(this));
    });
    
    // Toggle persistent
    this.element.querySelectorAll('.toggle-persistent').forEach(btn => {
      btn.addEventListener('click', this._onTogglePersistent.bind(this));
    });
    
    // Toggle active
    this.element.querySelectorAll('.toggle-active').forEach(btn => {
      btn.addEventListener('click', this._onToggleActive.bind(this));
    });
    
    // Clear all fudges
    this.element.querySelector('#clear-all-fudges')?.addEventListener('click', this._onClearAll.bind(this));
  }
  
  async _onCreateFudge(event) {
    event.preventDefault();
    
    const form = this.element.querySelector('#fudge-create-form');
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
    this.render();
  }
  
  async _onDeleteFudge(event) {
    event.preventDefault();
    
    const fudgeId = event.target.closest('[data-fudge-id]').dataset.fudgeId;
    
    await game.diehard.config.removeFudge(fudgeId);
    
    ui.notifications.info('Fudge removed');
    
    this.render();
  }
  
  async _onTogglePersistent(event) {
    event.preventDefault();
    
    const fudgeId = event.target.closest('[data-fudge-id]').dataset.fudgeId;
    const fudge = this.fudges[fudgeId];
    
    if (fudge) {
      await game.diehard.config.updateFudge(fudgeId, {
        persistent: !fudge.persistent
      });
      
      this.render();
    }
  }
  
  async _onToggleActive(event) {
    event.preventDefault();
    
    const fudgeId = event.target.closest('[data-fudge-id]').dataset.fudgeId;
    const fudge = this.fudges[fudgeId];
    
    if (fudge) {
      await game.diehard.config.updateFudge(fudgeId, {
        active: !fudge.active
      });
      
      this.render();
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
      this.render();
    }
  }
}
