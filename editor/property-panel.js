/**
 * Property Panel Component
 * Shared scene properties editing panel for both editors
 *
 * Usage:
 *   const panel = new PropertyPanel({
 *       container: document.getElementById('properties-panel'),
 *       mode: 'full',  // 'full' or 'compact'
 *       onModified: () => { ... },
 *       getSceneIds: () => Object.keys(scenes),
 *       currentSceneId: () => currentSceneId
 *   });
 *
 *   panel.loadScene(scene);
 *   panel.getSceneData();  // Returns scene properties
 */

(function(global) {
'use strict';

const Config = global.EditorConfig;

class PropertyPanel {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container - Container element for the panel
     * @param {string} options.mode - 'full' (all properties) or 'compact' (basic info only)
     * @param {Function} options.onModified - Callback when properties are modified
     * @param {Function} options.getSceneIds - Returns array of valid scene IDs
     * @param {Function} options.currentSceneId - Returns current scene ID
     * @param {Function} options.onSceneIdChange - Callback when scene ID changes
     * @param {Function} options.onDelete - Callback for delete action
     * @param {Function} options.onEditInFullEditor - Callback to open in full editor (compact mode)
     */
    constructor(options = {}) {
        this.container = options.container;
        this.mode = options.mode || 'full';
        this.onModified = options.onModified || (() => {});
        this.getSceneIds = options.getSceneIds || (() => []);
        this.getCurrentSceneId = options.currentSceneId || (() => null);
        this.onSceneIdChange = options.onSceneIdChange || (() => {});
        this.onDelete = options.onDelete || null;
        this.onEditInFullEditor = options.onEditInFullEditor || null;

        // Config
        this.backgrounds = Config?.assets?.backgrounds || [];
        this.music = Config?.assets?.music || [];
        this.assetPaths = Config?.assetPaths || { bg: '../assets/bg/', music: '../assets/music/' };

        // DOM elements
        this.elements = {};

        // Sub-components (will be initialized if in full mode)
        this.choiceEditor = null;
        this.actionEditor = null;

        this._init();
    }

    _init() {
        if (!this.container) {
            console.error('PropertyPanel: container element is required');
            return;
        }

        this._createDOM();
        this._setupEventListeners();
    }

    _createDOM() {
        this.container.innerHTML = '';
        this.container.classList.add('property-panel-component');

        if (this.mode === 'compact') {
            this._createCompactDOM();
        } else {
            this._createFullDOM();
        }
    }

    _createCompactDOM() {
        // Compact mode: just basic info and link to full editor
        const header = document.createElement('div');
        header.className = 'panel-header';

        const title = document.createElement('h3');
        title.textContent = 'Scene Properties';
        header.appendChild(title);

        this.container.appendChild(header);

        // Scene ID (read-only in compact mode)
        const idSection = this._createSection('Scene Info');
        const idDisplay = document.createElement('div');
        idDisplay.className = 'scene-id-display';
        idDisplay.id = 'compact-scene-id';
        idDisplay.textContent = 'No scene selected';
        idSection.appendChild(idDisplay);
        this.elements.sceneIdDisplay = idDisplay;

        // Basic stats
        const statsDiv = document.createElement('div');
        statsDiv.className = 'scene-stats';
        statsDiv.innerHTML = `
            <div class="stat"><span id="stat-text-blocks">0</span> text blocks</div>
            <div class="stat"><span id="stat-choices">0</span> choices</div>
            <div class="stat"><span id="stat-actions">0</span> actions</div>
        `;
        idSection.appendChild(statsDiv);
        this.elements.statTextBlocks = statsDiv.querySelector('#stat-text-blocks');
        this.elements.statChoices = statsDiv.querySelector('#stat-choices');
        this.elements.statActions = statsDiv.querySelector('#stat-actions');

        this.container.appendChild(idSection);

        // Actions
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'panel-actions';

        if (this.onEditInFullEditor) {
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-primary';
            editBtn.textContent = 'Edit in Scene Editor';
            editBtn.addEventListener('click', () => this.onEditInFullEditor());
            actionsDiv.appendChild(editBtn);
        }

        this.container.appendChild(actionsDiv);
    }

    _createFullDOM() {
        // Scene Info section
        const infoSection = this._createSection('Scene Info');

        const idLabel = document.createElement('label');
        idLabel.innerHTML = 'Scene ID <span class="required">*</span>';

        const idInput = document.createElement('input');
        idInput.type = 'text';
        idInput.id = 'prop-scene-id';
        idInput.placeholder = 'unique_scene_id';
        idInput.addEventListener('input', () => {
            this.onSceneIdChange(idInput.value);
            this.onModified();
        });
        this.elements.sceneId = idInput;

        const idHint = document.createElement('span');
        idHint.className = 'hint';
        idHint.textContent = 'Lowercase, underscores, no spaces';

        idLabel.appendChild(idInput);
        idLabel.appendChild(idHint);
        infoSection.appendChild(idLabel);
        this.container.appendChild(infoSection);

        // Background section
        const bgSection = this._createSection('Background');
        const bgSelector = this._createBackgroundSelector();
        bgSection.appendChild(bgSelector);
        this.container.appendChild(bgSection);

        // Music section
        const musicSection = this._createSection('Music');
        const musicSelector = this._createMusicSelector();
        musicSection.appendChild(musicSelector);
        this.container.appendChild(musicSection);

        // Choices section
        const choicesSection = this._createSection('Choices / Outputs');
        const choicesContainer = document.createElement('div');
        choicesContainer.id = 'prop-choices-container';
        choicesSection.appendChild(choicesContainer);
        this.elements.choicesContainer = choicesContainer;

        const addChoiceBtn = document.createElement('button');
        addChoiceBtn.className = 'btn-secondary';
        addChoiceBtn.textContent = '+ Add Choice';
        addChoiceBtn.addEventListener('click', () => {
            if (this.choiceEditor) this.choiceEditor.addChoice();
        });
        choicesSection.appendChild(addChoiceBtn);

        const choiceHint = document.createElement('div');
        choiceHint.className = 'hint';
        choiceHint.textContent = 'Leave empty for ending scene';
        choicesSection.appendChild(choiceHint);

        this.container.appendChild(choicesSection);

        // Advanced section (collapsible)
        const advancedSection = this._createCollapsibleSection('Advanced');

        // Flags subsection
        const flagsDiv = this._createFlagsSubsection();
        advancedSection.content.appendChild(flagsDiv);

        // Items subsection
        const itemsDiv = this._createItemsSubsection();
        advancedSection.content.appendChild(itemsDiv);

        // Actions subsection
        const actionsDiv = this._createActionsSubsection();
        advancedSection.content.appendChild(actionsDiv);

        this.container.appendChild(advancedSection.wrapper);

        // Danger zone
        if (this.onDelete) {
            const dangerSection = document.createElement('div');
            dangerSection.className = 'panel-section danger-zone';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-danger';
            deleteBtn.id = 'prop-delete-btn';
            deleteBtn.textContent = 'Delete Scene';
            deleteBtn.disabled = true;
            deleteBtn.addEventListener('click', () => this.onDelete());
            this.elements.deleteBtn = deleteBtn;

            dangerSection.appendChild(deleteBtn);
            this.container.appendChild(dangerSection);
        }

        // Initialize sub-components
        this._initSubComponents();
    }

    _createSection(title) {
        const section = document.createElement('div');
        section.className = 'panel-section';

        const header = document.createElement('h3');
        header.textContent = title;
        section.appendChild(header);

        return section;
    }

    _createCollapsibleSection(title) {
        const wrapper = document.createElement('div');
        wrapper.className = 'panel-section collapsible';

        const header = document.createElement('h3');
        header.className = 'collapsible-header';
        header.innerHTML = `${title} <span class="collapse-icon">+</span>`;

        const content = document.createElement('div');
        content.className = 'collapsible-content collapsed';

        header.addEventListener('click', () => {
            content.classList.toggle('collapsed');
            const icon = header.querySelector('.collapse-icon');
            icon.textContent = content.classList.contains('collapsed') ? '+' : '−';
        });

        wrapper.appendChild(header);
        wrapper.appendChild(content);

        return { wrapper, content };
    }

    _createBackgroundSelector() {
        const container = document.createElement('div');
        container.id = 'bg-selector';

        const preview = document.createElement('div');
        preview.className = 'asset-preview';
        preview.id = 'prop-bg-preview';
        preview.innerHTML = '<span class="placeholder">No background</span>';
        this.elements.bgPreview = preview;

        const select = document.createElement('select');
        select.id = 'prop-bg-select';

        const noneOption = document.createElement('option');
        noneOption.value = '';
        noneOption.textContent = '-- None --';
        select.appendChild(noneOption);

        this.backgrounds.forEach(bg => {
            const opt = document.createElement('option');
            opt.value = bg;
            opt.textContent = bg.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
            select.appendChild(opt);
        });

        select.addEventListener('change', () => {
            this._updateBackgroundPreview(select.value);
            this.onModified();
        });
        this.elements.bgSelect = select;

        container.appendChild(preview);
        container.appendChild(select);

        return container;
    }

    _createMusicSelector() {
        const container = document.createElement('div');
        container.id = 'music-selector';

        const select = document.createElement('select');
        select.id = 'prop-music-select';

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '-- Default --';
        select.appendChild(defaultOption);

        const noneOption = document.createElement('option');
        noneOption.value = 'none';
        noneOption.textContent = 'No music';
        select.appendChild(noneOption);

        this.music.forEach(track => {
            const opt = document.createElement('option');
            opt.value = track;
            opt.textContent = track.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
            select.appendChild(opt);
        });

        select.addEventListener('change', () => this.onModified());
        this.elements.musicSelect = select;

        container.appendChild(select);

        return container;
    }

    _createFlagsSubsection() {
        const div = document.createElement('div');
        div.className = 'subsection';

        // Set flags
        const setHeader = document.createElement('h4');
        setHeader.textContent = 'Set Flags';
        div.appendChild(setHeader);

        const setContainer = document.createElement('div');
        setContainer.id = 'prop-set-flags';
        this.elements.setFlagsContainer = setContainer;
        div.appendChild(setContainer);

        const setInputRow = this._createFlagInputRow('set');
        div.appendChild(setInputRow);

        // Require flags
        const reqHeader = document.createElement('h4');
        reqHeader.textContent = 'Require Flags';
        div.appendChild(reqHeader);

        const reqContainer = document.createElement('div');
        reqContainer.id = 'prop-require-flags';
        this.elements.requireFlagsContainer = reqContainer;
        div.appendChild(reqContainer);

        const reqInputRow = this._createFlagInputRow('require');
        div.appendChild(reqInputRow);

        return div;
    }

    _createFlagInputRow(type) {
        const row = document.createElement('div');
        row.className = 'flag-input-row';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `prop-new-${type}-flag`;
        input.placeholder = 'flag_name';

        const addBtn = document.createElement('button');
        addBtn.className = 'btn-icon';
        addBtn.textContent = '+';
        addBtn.addEventListener('click', () => this._addFlag(type));

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this._addFlag(type);
        });

        if (type === 'set') {
            this.elements.newSetFlag = input;
        } else {
            this.elements.newRequireFlag = input;
        }

        row.appendChild(input);
        row.appendChild(addBtn);

        return row;
    }

    _createItemsSubsection() {
        const div = document.createElement('div');
        div.className = 'subsection';

        // Add items
        const addHeader = document.createElement('h4');
        addHeader.textContent = 'Add Items';
        div.appendChild(addHeader);

        const addContainer = document.createElement('div');
        addContainer.id = 'prop-add-items';
        this.elements.addItemsContainer = addContainer;
        div.appendChild(addContainer);

        const addInputRow = this._createItemInputRow('add');
        div.appendChild(addInputRow);

        const addHint = document.createElement('span');
        addHint.className = 'hint';
        addHint.textContent = 'Items given when entering this scene';
        div.appendChild(addHint);

        // Remove items
        const removeHeader = document.createElement('h4');
        removeHeader.textContent = 'Remove Items';
        div.appendChild(removeHeader);

        const removeContainer = document.createElement('div');
        removeContainer.id = 'prop-remove-items';
        this.elements.removeItemsContainer = removeContainer;
        div.appendChild(removeContainer);

        const removeInputRow = this._createItemInputRow('remove');
        div.appendChild(removeInputRow);

        const removeHint = document.createElement('span');
        removeHint.className = 'hint';
        removeHint.textContent = 'Items removed when entering this scene';
        div.appendChild(removeHint);

        return div;
    }

    _createItemInputRow(type) {
        const row = document.createElement('div');
        row.className = 'flag-input-row';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `prop-new-${type}-item`;
        input.placeholder = 'Item Name';

        const addBtn = document.createElement('button');
        addBtn.className = 'btn-icon';
        addBtn.textContent = '+';
        addBtn.addEventListener('click', () => this._addItem(type));

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this._addItem(type);
        });

        if (type === 'add') {
            this.elements.newAddItem = input;
        } else {
            this.elements.newRemoveItem = input;
        }

        row.appendChild(input);
        row.appendChild(addBtn);

        return row;
    }

    _createActionsSubsection() {
        const div = document.createElement('div');
        div.className = 'subsection';

        const header = document.createElement('h4');
        header.textContent = 'Actions';
        div.appendChild(header);

        const container = document.createElement('div');
        container.id = 'prop-actions-container';
        this.elements.actionsContainer = container;
        div.appendChild(container);

        const btnRow = document.createElement('div');
        btnRow.className = 'action-buttons';

        const diceBtn = document.createElement('button');
        diceBtn.className = 'btn-secondary';
        diceBtn.textContent = '+ Dice Roll';
        diceBtn.addEventListener('click', () => {
            if (this.actionEditor) this.actionEditor.addDiceRoll();
        });

        const battleBtn = document.createElement('button');
        battleBtn.className = 'btn-secondary';
        battleBtn.textContent = '+ Battle';
        battleBtn.addEventListener('click', () => {
            if (this.actionEditor) this.actionEditor.addBattle();
        });

        btnRow.appendChild(diceBtn);
        btnRow.appendChild(battleBtn);
        div.appendChild(btnRow);

        return div;
    }

    _initSubComponents() {
        // Initialize ChoiceEditor if available
        if (global.ChoiceEditor && this.elements.choicesContainer) {
            this.choiceEditor = new global.ChoiceEditor({
                container: this.elements.choicesContainer,
                onModified: () => this.onModified(),
                getSceneIds: this.getSceneIds,
                currentSceneId: this.getCurrentSceneId
            });
        }

        // Initialize ActionEditor if available
        if (global.ActionEditor && this.elements.actionsContainer) {
            this.actionEditor = new global.ActionEditor({
                container: this.elements.actionsContainer,
                onModified: () => this.onModified(),
                getSceneIds: this.getSceneIds,
                currentSceneId: this.getCurrentSceneId
            });
        }
    }

    _setupEventListeners() {
        // Event listeners are set up inline during DOM creation
    }

    // === Flag/Item Management ===

    _addFlag(type) {
        const input = type === 'set' ? this.elements.newSetFlag : this.elements.newRequireFlag;
        const container = type === 'set' ? this.elements.setFlagsContainer : this.elements.requireFlagsContainer;

        const flag = input.value.trim();
        if (!flag) return;

        this._addTag(container, flag);
        input.value = '';
        this.onModified();
    }

    _addItem(type) {
        const input = type === 'add' ? this.elements.newAddItem : this.elements.newRemoveItem;
        const container = type === 'add' ? this.elements.addItemsContainer : this.elements.removeItemsContainer;

        const item = input.value.trim();
        if (!item) return;

        this._addTag(container, item);
        input.value = '';
        this.onModified();
    }

    _addTag(container, value) {
        const tag = document.createElement('span');
        tag.className = 'flag-tag';
        tag.textContent = value;

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => {
            tag.remove();
            this.onModified();
        });

        tag.appendChild(removeBtn);
        container.appendChild(tag);
    }

    _renderTags(container, values) {
        container.innerHTML = '';
        (values || []).forEach(value => {
            this._addTag(container, value);
        });
    }

    _getTagValues(container) {
        const tags = container.querySelectorAll('.flag-tag');
        return Array.from(tags).map(tag => {
            // Get text content excluding the remove button
            return tag.firstChild.textContent.trim();
        });
    }

    // === Background Preview ===

    _updateBackgroundPreview(bg) {
        if (bg && this.elements.bgPreview) {
            this.elements.bgPreview.style.backgroundImage = `url(${this.assetPaths.bg}${bg})`;
            this.elements.bgPreview.innerHTML = '';
        } else if (this.elements.bgPreview) {
            this.elements.bgPreview.style.backgroundImage = 'none';
            this.elements.bgPreview.innerHTML = '<span class="placeholder">No background</span>';
        }
    }

    // === Public API ===

    /**
     * Load a scene into the panel
     * @param {Object} scene - Scene data to load
     */
    loadScene(scene) {
        if (!scene) {
            this.clear();
            return;
        }

        if (this.mode === 'compact') {
            this._loadSceneCompact(scene);
        } else {
            this._loadSceneFull(scene);
        }
    }

    _loadSceneCompact(scene) {
        if (this.elements.sceneIdDisplay) {
            this.elements.sceneIdDisplay.textContent = scene.id || 'Unknown';
        }

        if (this.elements.statTextBlocks) {
            this.elements.statTextBlocks.textContent = scene.textBlocks?.length || 0;
        }
        if (this.elements.statChoices) {
            this.elements.statChoices.textContent = scene.choices?.length || 0;
        }
        if (this.elements.statActions) {
            this.elements.statActions.textContent = scene.actions?.length || 0;
        }
    }

    _loadSceneFull(scene) {
        // Scene ID
        if (this.elements.sceneId) {
            this.elements.sceneId.value = scene.id || '';
        }

        // Background
        if (this.elements.bgSelect) {
            this.elements.bgSelect.value = scene.bg || '';
            this._updateBackgroundPreview(scene.bg);
        }

        // Music
        if (this.elements.musicSelect) {
            this.elements.musicSelect.value = scene.music || '';
        }

        // Choices
        if (this.choiceEditor) {
            this.choiceEditor.loadChoices(scene.choices || []);
        }

        // Flags
        if (this.elements.setFlagsContainer) {
            this._renderTags(this.elements.setFlagsContainer, scene.set_flags);
        }
        if (this.elements.requireFlagsContainer) {
            this._renderTags(this.elements.requireFlagsContainer, scene.require_flags);
        }

        // Items
        if (this.elements.addItemsContainer) {
            this._renderTags(this.elements.addItemsContainer, scene.add_items);
        }
        if (this.elements.removeItemsContainer) {
            this._renderTags(this.elements.removeItemsContainer, scene.remove_items);
        }

        // Actions
        if (this.actionEditor) {
            this.actionEditor.loadActions(scene.actions || []);
        }

        // Enable delete button
        if (this.elements.deleteBtn) {
            this.elements.deleteBtn.disabled = false;
        }
    }

    /**
     * Get scene data from the panel
     * @returns {Object} Scene properties
     */
    getSceneData() {
        if (this.mode === 'compact') {
            return {}; // Compact mode is read-only
        }

        const data = {
            id: this.elements.sceneId?.value.trim() || '',
            bg: this.elements.bgSelect?.value || null,
            music: this.elements.musicSelect?.value || null
        };

        // Choices
        if (this.choiceEditor) {
            data.choices = this.choiceEditor.getChoices();
        }

        // Flags
        if (this.elements.setFlagsContainer) {
            data.set_flags = this._getTagValues(this.elements.setFlagsContainer);
        }
        if (this.elements.requireFlagsContainer) {
            data.require_flags = this._getTagValues(this.elements.requireFlagsContainer);
        }

        // Items
        if (this.elements.addItemsContainer) {
            data.add_items = this._getTagValues(this.elements.addItemsContainer);
        }
        if (this.elements.removeItemsContainer) {
            data.remove_items = this._getTagValues(this.elements.removeItemsContainer);
        }

        // Actions
        if (this.actionEditor) {
            data.actions = this.actionEditor.getActions();
        }

        return data;
    }

    /**
     * Clear the panel
     */
    clear() {
        if (this.mode === 'compact') {
            if (this.elements.sceneIdDisplay) {
                this.elements.sceneIdDisplay.textContent = 'No scene selected';
            }
            if (this.elements.statTextBlocks) this.elements.statTextBlocks.textContent = '0';
            if (this.elements.statChoices) this.elements.statChoices.textContent = '0';
            if (this.elements.statActions) this.elements.statActions.textContent = '0';
        } else {
            if (this.elements.sceneId) this.elements.sceneId.value = '';
            if (this.elements.bgSelect) {
                this.elements.bgSelect.value = '';
                this._updateBackgroundPreview(null);
            }
            if (this.elements.musicSelect) this.elements.musicSelect.value = '';

            if (this.choiceEditor) this.choiceEditor.clear();
            if (this.actionEditor) this.actionEditor.clear();

            if (this.elements.setFlagsContainer) this.elements.setFlagsContainer.innerHTML = '';
            if (this.elements.requireFlagsContainer) this.elements.requireFlagsContainer.innerHTML = '';
            if (this.elements.addItemsContainer) this.elements.addItemsContainer.innerHTML = '';
            if (this.elements.removeItemsContainer) this.elements.removeItemsContainer.innerHTML = '';

            if (this.elements.deleteBtn) this.elements.deleteBtn.disabled = true;
        }
    }

    /**
     * Destroy the component
     */
    destroy() {
        if (this.choiceEditor) this.choiceEditor.destroy();
        if (this.actionEditor) this.actionEditor.destroy();
        this.container.innerHTML = '';
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PropertyPanel;
} else {
    global.PropertyPanel = PropertyPanel;
}

})(typeof window !== 'undefined' ? window : global);
