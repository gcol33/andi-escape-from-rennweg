/**
 * Action Editor Component
 * Shared action editing UI for dice rolls and battles
 *
 * Usage:
 *   const actionEditor = new ActionEditor({
 *       container: document.getElementById('actions-container'),
 *       onModified: () => { ... },
 *       getSceneIds: () => Object.keys(scenes),  // For autocomplete
 *       currentSceneId: () => currentSceneId     // Exclude from autocomplete
 *   });
 *
 *   actionEditor.loadActions(scene.actions);
 *   actionEditor.getActions();  // Returns array of action objects
 */

(function(global) {
'use strict';

const Config = global.EditorConfig;

class ActionEditor {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container - Container element for actions
     * @param {Function} options.onModified - Callback when actions are modified
     * @param {Function} options.getSceneIds - Returns array of valid scene IDs for autocomplete
     * @param {Function} options.currentSceneId - Returns current scene ID (to exclude from autocomplete)
     */
    constructor(options = {}) {
        this.container = options.container;
        this.onModified = options.onModified || (() => {});
        this.getSceneIds = options.getSceneIds || (() => []);
        this.getCurrentSceneId = options.currentSceneId || (() => null);

        // Dice config
        this.diceConfig = Config?.dice || {
            defaultType: 'd20',
            defaultThreshold: 10,
            maxThreshold: 100
        };

        // Use shared AutocompleteHelper if available
        if (global.AutocompleteHelper) {
            this.autocomplete = new global.AutocompleteHelper({
                getSceneIds: this.getSceneIds,
                getCurrentSceneId: this.getCurrentSceneId,
                onSelect: () => this.onModified()
            });
        } else {
            this.autocomplete = null;
        }
    }

    /**
     * Load actions into the editor
     * @param {Array} actions - Array of action objects
     */
    loadActions(actions = []) {
        this.container.innerHTML = '';
        actions.forEach(action => {
            if (action.type === 'roll_dice') {
                this._addDiceRollElement(action);
            } else if (action.type === 'start_battle') {
                this._addBattleElement(action);
            }
        });
    }

    /**
     * Add a new dice roll action
     */
    addDiceRoll() {
        this._addDiceRollElement(null);
        this.onModified();
    }

    /**
     * Add a new battle action
     */
    addBattle() {
        this._addBattleElement(null);
        this.onModified();
    }

    /**
     * Get all actions from the editor
     * @returns {Array} Array of action objects
     */
    getActions() {
        const actions = [];

        // Collect dice roll actions
        this.container.querySelectorAll('.action-item:not(.battle-item)').forEach(item => {
            const dice = item.querySelector('.action-dice')?.value;
            const threshold = parseInt(item.querySelector('.action-threshold')?.value) || this.diceConfig.defaultThreshold;
            const success = item.querySelector('.action-success')?.value.trim();
            const failure = item.querySelector('.action-failure')?.value.trim();
            const modifier = item.querySelector('.action-modifier')?.value || '';
            const skill = item.querySelector('.action-skill')?.value.trim() || '';
            const critText = item.querySelector('.action-crit')?.value.trim() || '';
            const fumbleText = item.querySelector('.action-fumble')?.value.trim() || '';

            if (success && failure) {
                const action = {
                    type: 'roll_dice',
                    dice: dice,
                    threshold: threshold,
                    success_target: success,
                    failure_target: failure
                };
                if (modifier) action.modifier = modifier;
                if (skill) action.skill = skill;
                if (critText) action.crit_text = critText;
                if (fumbleText) action.fumble_text = fumbleText;
                actions.push(action);
            }
        });

        // Collect battle actions
        this.container.querySelectorAll('.battle-item').forEach(item => {
            const enemyName = item.querySelector('.battle-enemy-name')?.value.trim();
            const enemyId = item.querySelector('.battle-enemy-id')?.value.trim();
            const enemyHP = parseInt(item.querySelector('.battle-enemy-hp')?.value) || 20;
            const enemyAttack = parseInt(item.querySelector('.battle-enemy-attack')?.value) || 4;
            const enemyDefense = parseInt(item.querySelector('.battle-enemy-defense')?.value) || 10;
            const playerAttack = parseInt(item.querySelector('.battle-player-attack')?.value) || 4;
            const playerDefense = parseInt(item.querySelector('.battle-player-defense')?.value) || 10;
            const victory = item.querySelector('.battle-victory')?.value.trim();
            const defeat = item.querySelector('.battle-defeat')?.value.trim();
            const flee = item.querySelector('.battle-flee')?.value.trim();

            if ((enemyName || enemyId) && victory && defeat) {
                const action = {
                    type: 'start_battle',
                    victory_target: victory,
                    defeat_target: defeat
                };

                // Use enemy_id if provided, otherwise use inline definition
                if (enemyId) {
                    action.enemy_id = enemyId;
                } else {
                    action.enemy_name = enemyName;
                    action.enemy_hp = enemyHP;
                    action.enemy_max_hp = enemyHP;
                    action.enemy_attack = enemyAttack;
                    action.enemy_defense = enemyDefense;
                }

                action.player_attack = playerAttack;
                action.player_defense = playerDefense;

                if (flee) action.flee_target = flee;

                actions.push(action);
            }
        });

        return actions;
    }

    /**
     * Clear all actions
     */
    clear() {
        this.container.innerHTML = '';
    }

    // === Private Methods - Dice Roll ===

    _addDiceRollElement(action = null) {
        const actionDiv = document.createElement('div');
        actionDiv.className = 'action-item';

        // Header
        const header = this._createHeader('Dice Roll', () => {
            actionDiv.remove();
            this.onModified();
        });

        // Inputs container
        const inputs = document.createElement('div');
        inputs.className = 'action-inputs';

        // Dice type
        const diceGroup = this._createDiceSelect(action?.dice || this.diceConfig.defaultType);

        // Threshold
        const thresholdGroup = this._createNumberInput('Success ≤', 'action-threshold', {
            value: action?.threshold || this.diceConfig.defaultThreshold,
            min: 1,
            max: this.diceConfig.maxThreshold
        });

        // Modifier (advantage/disadvantage)
        const modifierGroup = this._createModifierSelect(action?.modifier || '');

        // Skill name
        const skillGroup = this._createTextInput('Skill', 'action-skill', {
            value: action?.skill || '',
            placeholder: 'e.g. Stealth'
        });

        // Success target
        const successGroup = this._createAutocompleteInput('On success →', 'action-success', {
            value: action?.success_target || '',
            placeholder: 'success_scene_id'
        });

        // Failure target
        const failureGroup = this._createAutocompleteInput('On failure →', 'action-failure', {
            value: action?.failure_target || '',
            placeholder: 'failure_scene_id'
        });

        // Crit text
        const critGroup = this._createTextInput('Crit (nat 20)', 'action-crit', {
            value: action?.crit_text || '',
            placeholder: 'Special message on nat 20'
        });

        // Fumble text
        const fumbleGroup = this._createTextInput('Fumble (nat 1)', 'action-fumble', {
            value: action?.fumble_text || '',
            placeholder: 'Special message on nat 1'
        });

        inputs.appendChild(diceGroup);
        inputs.appendChild(thresholdGroup);
        inputs.appendChild(modifierGroup);
        inputs.appendChild(skillGroup);
        inputs.appendChild(successGroup);
        inputs.appendChild(failureGroup);
        inputs.appendChild(critGroup);
        inputs.appendChild(fumbleGroup);

        actionDiv.appendChild(header);
        actionDiv.appendChild(inputs);
        this.container.appendChild(actionDiv);
    }

    // === Private Methods - Battle ===

    _addBattleElement(action = null) {
        const actionDiv = document.createElement('div');
        actionDiv.className = 'action-item battle-item';

        // Header
        const header = this._createHeader('Battle', () => {
            actionDiv.remove();
            this.onModified();
        });

        // Inputs container
        const inputs = document.createElement('div');
        inputs.className = 'action-inputs battle-inputs';

        // Enemy ID (for referencing enemies/*.md)
        const enemyIdGroup = this._createTextInput('Enemy ID', 'battle-enemy-id', {
            value: action?.enemy_id || '',
            placeholder: 'e.g. agnes_hr (from enemies/*.md)'
        });

        // Enemy name (for inline definition)
        const enemyNameGroup = this._createTextInput('Enemy Name', 'battle-enemy-name', {
            value: action?.enemy_name || '',
            placeholder: 'e.g. Agnes (or use Enemy ID above)'
        });

        // Enemy HP
        const enemyHPGroup = this._createNumberInput('Enemy HP', 'battle-enemy-hp', {
            value: action?.enemy_hp || 20,
            min: 1
        });

        // Enemy Attack
        const enemyAtkGroup = this._createNumberInput('Enemy Atk', 'battle-enemy-attack', {
            value: action?.enemy_attack || 4
        });

        // Enemy Defense
        const enemyDefGroup = this._createNumberInput('Enemy Def', 'battle-enemy-defense', {
            value: action?.enemy_defense || 10
        });

        // Player Attack
        const playerAtkGroup = this._createNumberInput('Player Atk', 'battle-player-attack', {
            value: action?.player_attack || 4
        });

        // Player Defense
        const playerDefGroup = this._createNumberInput('Player Def', 'battle-player-defense', {
            value: action?.player_defense || 10
        });

        // Victory target
        const victoryGroup = this._createAutocompleteInput('On victory →', 'battle-victory', {
            value: action?.victory_target || '',
            placeholder: 'victory_scene_id'
        });

        // Defeat target
        const defeatGroup = this._createAutocompleteInput('On defeat →', 'battle-defeat', {
            value: action?.defeat_target || '',
            placeholder: 'defeat_scene_id'
        });

        // Flee target
        const fleeGroup = this._createAutocompleteInput('On flee →', 'battle-flee', {
            value: action?.flee_target || '',
            placeholder: 'flee_scene_id (optional)'
        });

        inputs.appendChild(enemyIdGroup);
        inputs.appendChild(enemyNameGroup);
        inputs.appendChild(enemyHPGroup);
        inputs.appendChild(enemyAtkGroup);
        inputs.appendChild(enemyDefGroup);
        inputs.appendChild(playerAtkGroup);
        inputs.appendChild(playerDefGroup);
        inputs.appendChild(victoryGroup);
        inputs.appendChild(defeatGroup);
        inputs.appendChild(fleeGroup);

        actionDiv.appendChild(header);
        actionDiv.appendChild(inputs);
        this.container.appendChild(actionDiv);
    }

    // === Helper Methods ===

    _createHeader(title, onDelete) {
        const header = document.createElement('div');
        header.className = 'action-item-header';

        const label = document.createElement('span');
        label.textContent = title;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-icon';
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Delete action';
        deleteBtn.addEventListener('click', onDelete);

        header.appendChild(label);
        header.appendChild(deleteBtn);
        return header;
    }

    _createTextInput(labelText, className, options = {}) {
        const group = document.createElement('label');
        group.textContent = labelText;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = className;
        input.value = options.value || '';
        if (options.placeholder) input.placeholder = options.placeholder;
        input.addEventListener('input', () => this.onModified());

        group.appendChild(input);
        return group;
    }

    _createNumberInput(labelText, className, options = {}) {
        const group = document.createElement('label');
        group.textContent = labelText;

        const input = document.createElement('input');
        input.type = 'number';
        input.className = className;
        input.value = options.value !== undefined ? options.value : 0;
        if (options.min !== undefined) input.min = options.min;
        if (options.max !== undefined) input.max = options.max;
        input.addEventListener('input', () => this.onModified());

        group.appendChild(input);
        return group;
    }

    _createDiceSelect(selectedValue) {
        const group = document.createElement('label');
        group.textContent = 'Dice';

        const select = document.createElement('select');
        select.className = 'action-dice';

        ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'].forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d.toUpperCase();
            select.appendChild(opt);
        });

        select.value = selectedValue;
        select.addEventListener('change', () => this.onModified());

        group.appendChild(select);
        return group;
    }

    _createModifierSelect(selectedValue) {
        const group = document.createElement('label');
        group.textContent = 'Modifier';

        const select = document.createElement('select');
        select.className = 'action-modifier';

        [
            { value: '', text: 'None' },
            { value: 'advantage', text: 'Advantage (2d20 high)' },
            { value: 'disadvantage', text: 'Disadvantage (2d20 low)' }
        ].forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            select.appendChild(option);
        });

        select.value = selectedValue;
        select.addEventListener('change', () => this.onModified());

        group.appendChild(select);
        return group;
    }

    _createAutocompleteInput(labelText, className, options = {}) {
        const group = document.createElement('label');
        group.textContent = labelText;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = className;
        input.value = options.value || '';
        if (options.placeholder) input.placeholder = options.placeholder;
        input.addEventListener('input', () => this.onModified());

        // Use shared autocomplete helper
        if (this.autocomplete) {
            this.autocomplete.attach(input);
        }

        group.appendChild(input);
        return group;
    }

    /**
     * Destroy the component
     */
    destroy() {
        if (this.autocomplete) {
            this.autocomplete.destroy();
        }
        this.container.innerHTML = '';
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ActionEditor;
} else {
    global.ActionEditor = ActionEditor;
}

})(typeof window !== 'undefined' ? window : global);
