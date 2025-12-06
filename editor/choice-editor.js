/**
 * Choice Editor Component
 * Shared choice editing UI for scene editors
 *
 * Usage:
 *   const choiceEditor = new ChoiceEditor({
 *       container: document.getElementById('choices-container'),
 *       onModified: () => { ... },
 *       getSceneIds: () => Object.keys(scenes),  // For autocomplete
 *       currentSceneId: () => currentSceneId     // Exclude from autocomplete
 *   });
 *
 *   choiceEditor.loadChoices(scene.choices);
 *   choiceEditor.getChoices();  // Returns array of choice objects
 */

(function(global) {
'use strict';

const Config = global.EditorConfig;

class ChoiceEditor {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container - Container element for choices
     * @param {Function} options.onModified - Callback when choices are modified
     * @param {Function} options.getSceneIds - Returns array of valid scene IDs for autocomplete
     * @param {Function} options.currentSceneId - Returns current scene ID (to exclude from autocomplete)
     * @param {boolean} options.showBattleActions - Show battle action options (default: false)
     */
    constructor(options = {}) {
        this.container = options.container;
        this.onModified = options.onModified || (() => {});
        this.getSceneIds = options.getSceneIds || (() => []);
        this.getCurrentSceneId = options.currentSceneId || (() => null);
        this.showBattleActions = options.showBattleActions || false;

        // Get config
        this.sfxList = Config?.assets?.sfx || [];

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
     * Load choices into the editor
     * @param {Array} choices - Array of choice objects
     */
    loadChoices(choices = []) {
        this.container.innerHTML = '';
        choices.forEach((choice, index) => {
            this._addChoiceElement(choice, index);
        });
    }

    /**
     * Add a new empty choice
     */
    addChoice() {
        this._addChoiceElement(null);
        this.onModified();
    }

    /**
     * Get all choices from the editor
     * @returns {Array} Array of choice objects
     */
    getChoices() {
        const choices = [];
        this.container.querySelectorAll('.choice-item').forEach(item => {
            const label = item.querySelector('.choice-label').value.trim();
            const target = item.querySelector('.choice-target').value.trim();
            const sfx = item.querySelector('.choice-sfx')?.value || '';
            const requireStr = item.querySelector('.choice-require')?.value.trim() || '';
            const setsStr = item.querySelector('.choice-sets')?.value.trim() || '';

            // Battle-specific fields
            const battleAction = item.querySelector('.choice-battle-action')?.value || '';
            const heals = item.querySelector('.choice-heals')?.value || '';
            const usesItem = item.querySelector('.choice-uses-item')?.value.trim() || '';
            const requireItems = item.querySelector('.choice-require-items')?.value.trim() || '';

            if (label && target) {
                const choice = {
                    label: label,
                    target: target
                };

                // Optional fields - only add if present
                if (sfx) choice.sfx = sfx;
                if (requireStr) {
                    choice.require_flags = requireStr.split(',').map(f => f.trim()).filter(f => f);
                }
                if (setsStr) {
                    choice.set_flags = setsStr.split(',').map(f => f.trim()).filter(f => f);
                }
                if (battleAction) choice.battle = battleAction;
                if (heals) choice.heals = parseInt(heals, 10);
                if (usesItem) choice.uses = usesItem;
                if (requireItems) choice.require_items = requireItems;

                choices.push(choice);
            }
        });
        return choices;
    }

    /**
     * Clear all choices
     */
    clear() {
        this.container.innerHTML = '';
    }

    // === Private Methods ===

    _addChoiceElement(choice = null, index = null) {
        const choiceDiv = document.createElement('div');
        choiceDiv.className = 'choice-item';

        // Header with choice number and delete button
        const header = document.createElement('div');
        header.className = 'choice-item-header';

        const label = document.createElement('span');
        const choiceIndex = index !== null ? index : this.container.children.length;
        label.textContent = `Choice ${choiceIndex + 1}`;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-icon';
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Delete choice';
        deleteBtn.addEventListener('click', () => {
            choiceDiv.remove();
            this._renumberChoices();
            this.onModified();
        });

        header.appendChild(label);
        header.appendChild(deleteBtn);

        // Inputs container
        const inputs = document.createElement('div');
        inputs.className = 'choice-inputs';

        // Button text (label)
        const labelGroup = this._createInputGroup('Button text', 'text', 'choice-label', {
            value: choice?.label || '',
            placeholder: 'Choice text shown to player'
        });

        // Target scene with autocomplete
        const targetGroup = document.createElement('label');
        targetGroup.textContent = 'Goes to scene';

        const targetRow = document.createElement('div');
        targetRow.className = 'choice-target-row';

        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        arrow.textContent = '→';

        const targetInput = document.createElement('input');
        targetInput.type = 'text';
        targetInput.className = 'choice-target';
        targetInput.value = choice?.target || '';
        targetInput.placeholder = 'target_scene_id';
        targetInput.addEventListener('input', () => this.onModified());

        // Use shared autocomplete helper
        if (this.autocomplete) {
            this.autocomplete.attach(targetInput);
        }

        targetRow.appendChild(arrow);
        targetRow.appendChild(targetInput);
        targetGroup.appendChild(targetRow);

        // SFX dropdown
        const sfxGroup = this._createSfxSelect(choice?.sfx || '');

        // Flags row
        const flagsRow = document.createElement('div');
        flagsRow.className = 'choice-flags';

        const requireLabel = this._createInputGroup('Requires:', 'text', 'choice-require', {
            value: choice?.require_flags?.join(', ') || '',
            placeholder: 'flag1, flag2'
        }, true);

        const setsLabel = this._createInputGroup('Sets:', 'text', 'choice-sets', {
            value: choice?.set_flags?.join(', ') || '',
            placeholder: 'flag1, flag2'
        }, true);

        flagsRow.appendChild(requireLabel);
        flagsRow.appendChild(setsLabel);

        // Assemble inputs
        inputs.appendChild(labelGroup);
        inputs.appendChild(targetGroup);
        inputs.appendChild(sfxGroup);
        inputs.appendChild(flagsRow);

        // Battle-specific options
        if (this.showBattleActions) {
            const battleRow = this._createBattleOptions(choice);
            inputs.appendChild(battleRow);
        }

        choiceDiv.appendChild(header);
        choiceDiv.appendChild(inputs);
        this.container.appendChild(choiceDiv);
    }

    _createInputGroup(labelText, inputType, className, options = {}, inline = false) {
        const group = document.createElement('label');
        if (inline) group.className = 'inline-label';
        group.textContent = labelText;

        const input = document.createElement('input');
        input.type = inputType;
        input.className = className;
        input.value = options.value || '';
        if (options.placeholder) input.placeholder = options.placeholder;
        input.addEventListener('input', () => this.onModified());

        group.appendChild(input);
        return group;
    }

    _createSfxSelect(selectedValue) {
        const group = document.createElement('label');
        group.textContent = 'Sound effect';

        const select = document.createElement('select');
        select.className = 'choice-sfx';

        // None option
        const noneOption = document.createElement('option');
        noneOption.value = '';
        noneOption.textContent = '(none)';
        select.appendChild(noneOption);

        // SFX options
        this.sfxList.forEach(sfxFile => {
            const option = document.createElement('option');
            option.value = sfxFile;
            option.textContent = sfxFile.replace('.ogg', '');
            select.appendChild(option);
        });

        select.value = selectedValue;
        select.addEventListener('change', () => this.onModified());

        group.appendChild(select);
        return group;
    }

    _createBattleOptions(choice) {
        const battleRow = document.createElement('div');
        battleRow.className = 'choice-battle-options';

        // Battle action dropdown
        const actionGroup = document.createElement('label');
        actionGroup.textContent = 'Battle action';

        const actionSelect = document.createElement('select');
        actionSelect.className = 'choice-battle-action';

        const actions = [
            { value: '', label: '(none)' },
            { value: 'attack', label: 'Attack' },
            { value: 'skill', label: 'Skill' },
            { value: 'defend', label: 'Defend' },
            { value: 'item', label: 'Item' },
            { value: 'flee', label: 'Flee' }
        ];

        actions.forEach(action => {
            const option = document.createElement('option');
            option.value = action.value;
            option.textContent = action.label;
            actionSelect.appendChild(option);
        });

        actionSelect.value = choice?.battle || '';
        actionSelect.addEventListener('change', () => this.onModified());
        actionGroup.appendChild(actionSelect);

        // Heals input
        const healsGroup = this._createInputGroup('Heals HP:', 'number', 'choice-heals', {
            value: choice?.heals || '',
            placeholder: '0'
        }, true);
        healsGroup.querySelector('input').min = 0;

        // Uses item
        const usesGroup = this._createInputGroup('Uses item:', 'text', 'choice-uses-item', {
            value: choice?.uses || '',
            placeholder: 'Item Name'
        }, true);

        // Requires item
        const requireItemsGroup = this._createInputGroup('Requires item:', 'text', 'choice-require-items', {
            value: choice?.require_items || '',
            placeholder: 'Item Name'
        }, true);

        battleRow.appendChild(actionGroup);
        battleRow.appendChild(healsGroup);
        battleRow.appendChild(usesGroup);
        battleRow.appendChild(requireItemsGroup);

        return battleRow;
    }

    _renumberChoices() {
        const choices = this.container.querySelectorAll('.choice-item');
        choices.forEach((choice, index) => {
            const label = choice.querySelector('.choice-item-header span');
            label.textContent = `Choice ${index + 1}`;
        });
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
    module.exports = ChoiceEditor;
} else {
    global.ChoiceEditor = ChoiceEditor;
}

})(typeof window !== 'undefined' ? window : global);
