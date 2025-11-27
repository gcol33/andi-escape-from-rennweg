/**
 * Andi VN - Scene Editor
 *
 * A visual editor for creating and editing VN scenes.
 * Generates .md files compatible with build_story_from_md.py
 */

const Editor = (function() {
    'use strict';

    // === Configuration ===
    const config = {
        assetPaths: {
            bg: '../assets/bg/',
            char: '../assets/char/',
            music: '../assets/music/'
        },
        // These will be populated by scanning or hardcoded
        assets: {
            backgrounds: [
                'back_stairwell_dim.jpg',
                'bedroom_morning.jpg',
                'dark_office_desk.jpg',
                'desk_computer_code.jpg',
                'hallway_dim.jpg',
                'hallway_fluorescent.jpg',
                'hallway_red_alert.jpg',
                'meeting_room_whiteboard.jpg',
                'office_corridor.jpg',
                'office_kitchen.jpg',
                'stairwell_escape.jpg',
                'stairwell_landing.jpg',
                'sunny_street_freedom.jpg'
            ],
            sprites: [
                'agnes_angry.svg',
                'agnes_blocking.svg',
                'agnes_happy.svg',
                'agnes_neutral.svg',
                'agnes_surprised.svg',
                'agnes_victorious.svg',
                'ali_friendly.svg',
                'fabio_friendly.svg',
                'gilles_explaining.svg',
                'joni_desperate.svg',
                'michi_whiteboard.svg',
                'norbert_grabbing.svg',
                'norbert_pleading.svg',
                'ruling_pointing.svg',
                'security_guard_waving.svg'
            ],
            music: [
                'default.mp3',
                'coding_frenzy.mp3',
                'coffee.mp3',
                'dicey_decisions.mp3',
                'last_day.mp3',
                'legal_trap_stairwell.mp3',
                'outside.mp3',
                'spooky.mp3',
                'victory.mp3',
                'zen.mp3'
            ]
        }
    };

    // === State ===
    const state = {
        scenes: {},           // All loaded scenes by ID
        currentSceneId: null, // Currently editing scene
        modified: false,      // Has current scene been modified?
        modifiedScenes: new Set(), // Track which scenes have unsaved changes
        draggedSprite: null,  // Currently dragged sprite element
        selectedSprite: null, // Currently selected sprite on canvas
        musicPlaying: false
    };

    // === DOM References ===
    let elements = {};

    // === Initialization ===
    function init() {
        cacheElements();
        setupEventListeners();
        populateAssetSelectors();
        populateSpriteGallery();

        // Load existing scenes from localStorage or prompt import
        loadScenesFromStorage();
    }

    function cacheElements() {
        elements = {
            // Scene list
            sceneList: document.getElementById('scene-list'),
            sceneSearchInput: document.getElementById('scene-search-input'),
            newSceneBtn: document.getElementById('new-scene-btn'),
            importScenesBtn: document.getElementById('import-scenes-btn'),

            // Canvas
            currentSceneName: document.getElementById('current-scene-name'),
            previewBtn: document.getElementById('preview-btn'),
            saveBtn: document.getElementById('save-btn'),
            downloadBtn: document.getElementById('download-btn'),
            canvasPreview: document.getElementById('canvas-preview'),
            previewBackground: document.getElementById('preview-background'),
            previewSprites: document.getElementById('preview-sprites'),
            previewText: document.getElementById('preview-text'),
            dropZone: document.getElementById('drop-zone'),
            spriteGallery: document.getElementById('sprite-gallery'),

            // Properties
            sceneId: document.getElementById('scene-id'),
            bgSelect: document.getElementById('bg-select'),
            bgPreview: document.getElementById('bg-preview'),
            musicSelect: document.getElementById('music-select'),
            musicPreviewBtn: document.getElementById('music-preview-btn'),
            musicPlayer: document.getElementById('music-player'),
            textBlocksContainer: document.getElementById('text-blocks-container'),
            addTextBlockBtn: document.getElementById('add-text-block-btn'),
            choicesContainer: document.getElementById('choices-container'),
            addChoiceBtn: document.getElementById('add-choice-btn'),

            // Flags
            setFlagsContainer: document.getElementById('set-flags-container'),
            requireFlagsContainer: document.getElementById('require-flags-container'),
            newSetFlag: document.getElementById('new-set-flag'),
            newRequireFlag: document.getElementById('new-require-flag'),
            addSetFlagBtn: document.getElementById('add-set-flag-btn'),
            addRequireFlagBtn: document.getElementById('add-require-flag-btn'),

            // Actions
            actionsContainer: document.getElementById('actions-container'),
            addActionBtn: document.getElementById('add-action-btn'),

            // Incoming
            incomingScenes: document.getElementById('incoming-scenes'),

            // Delete
            deleteSceneBtn: document.getElementById('delete-scene-btn'),
            deleteModal: document.getElementById('delete-modal'),
            deleteWarnings: document.getElementById('delete-warnings'),
            deleteCancelBtn: document.getElementById('delete-cancel-btn'),
            deleteConfirmBtn: document.getElementById('delete-confirm-btn')
        };
    }

    function setupEventListeners() {
        // Scene list
        elements.newSceneBtn.addEventListener('click', createNewScene);
        elements.importScenesBtn.addEventListener('click', importScenes);
        elements.sceneSearchInput.addEventListener('input', filterSceneList);

        // Save/Download
        elements.saveBtn.addEventListener('click', saveCurrentScene);
        elements.downloadBtn.addEventListener('click', downloadCurrentScene);
        elements.previewBtn.addEventListener('click', previewInGame);

        // Scene properties
        elements.sceneId.addEventListener('input', onSceneModified);
        elements.bgSelect.addEventListener('change', onBackgroundChange);
        elements.musicSelect.addEventListener('change', onSceneModified);
        elements.musicPreviewBtn.addEventListener('click', toggleMusicPreview);

        // Text blocks
        elements.addTextBlockBtn.addEventListener('click', addTextBlock);

        // Choices
        elements.addChoiceBtn.addEventListener('click', addChoice);

        // Flags
        elements.addSetFlagBtn.addEventListener('click', () => addFlag('set'));
        elements.addRequireFlagBtn.addEventListener('click', () => addFlag('require'));
        elements.newSetFlag.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addFlag('set');
        });
        elements.newRequireFlag.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addFlag('require');
        });

        // Actions
        elements.addActionBtn.addEventListener('click', addAction);

        // Delete
        elements.deleteSceneBtn.addEventListener('click', showDeleteModal);
        elements.deleteCancelBtn.addEventListener('click', hideDeleteModal);
        elements.deleteConfirmBtn.addEventListener('click', confirmDelete);

        // Collapsible sections
        document.querySelectorAll('.collapsible-header').forEach(header => {
            header.addEventListener('click', toggleCollapsible);
        });

        // Drag & drop for sprites
        setupSpriteDragDrop();

        // Background drag & drop
        setupBackgroundDragDrop();

        // Click outside to deselect sprite
        elements.canvasPreview.addEventListener('click', (e) => {
            if (e.target === elements.previewSprites || e.target === elements.previewBackground) {
                deselectSprite();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboard);
    }

    // === Asset Selectors ===
    function populateAssetSelectors() {
        // Backgrounds
        config.assets.backgrounds.forEach(bg => {
            const option = document.createElement('option');
            option.value = bg;
            option.textContent = bg.replace('.jpg', '').replace(/_/g, ' ');
            elements.bgSelect.appendChild(option);
        });

        // Music
        config.assets.music.forEach(music => {
            const option = document.createElement('option');
            option.value = music;
            option.textContent = music.replace('.mp3', '').replace(/_/g, ' ');
            elements.musicSelect.appendChild(option);
        });
    }

    function populateSpriteGallery() {
        elements.spriteGallery.innerHTML = '';

        config.assets.sprites.forEach(sprite => {
            const thumb = document.createElement('div');
            thumb.className = 'sprite-thumb';
            thumb.dataset.sprite = sprite;
            thumb.draggable = true;
            thumb.title = sprite.replace('.svg', '').replace(/_/g, ' ');

            const img = document.createElement('img');
            img.src = config.assetPaths.char + sprite;
            img.alt = sprite;

            thumb.appendChild(img);
            elements.spriteGallery.appendChild(thumb);
        });
    }

    // === Sprite Drag & Drop ===
    function setupSpriteDragDrop() {
        // Drag from gallery
        elements.spriteGallery.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('sprite-thumb')) {
                e.target.classList.add('dragging');
                e.dataTransfer.setData('text/plain', e.target.dataset.sprite);
                e.dataTransfer.effectAllowed = 'copy';
            }
        });

        elements.spriteGallery.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('sprite-thumb')) {
                e.target.classList.remove('dragging');
            }
        });

        // Drop on canvas
        elements.previewSprites.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        elements.previewSprites.addEventListener('drop', (e) => {
            e.preventDefault();
            const spriteFile = e.dataTransfer.getData('text/plain');
            if (spriteFile && spriteFile.endsWith('.svg')) {
                const rect = elements.previewSprites.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                addSpriteToCanvas(spriteFile, x, y);
            }
        });

        // Drag sprites on canvas
        elements.previewSprites.addEventListener('mousedown', onSpriteMouseDown);
        document.addEventListener('mousemove', onSpriteMouseMove);
        document.addEventListener('mouseup', onSpriteMouseUp);
    }

    function addSpriteToCanvas(spriteFile, x = 50, y = 80) {
        const sprite = document.createElement('div');
        sprite.className = 'sprite';
        sprite.dataset.file = spriteFile;
        sprite.dataset.x = x;
        sprite.dataset.y = y;

        // Position: x is center, y is bottom of sprite
        sprite.style.left = x + '%';
        sprite.style.bottom = (100 - y) + '%';
        sprite.style.transform = 'translateX(-50%)';

        const img = document.createElement('img');
        img.src = config.assetPaths.char + spriteFile;
        img.alt = spriteFile;
        img.draggable = false;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'sprite-delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sprite.remove();
            onSceneModified();
        });

        sprite.appendChild(img);
        sprite.appendChild(deleteBtn);
        sprite.addEventListener('click', (e) => {
            e.stopPropagation();
            selectSprite(sprite);
        });

        elements.previewSprites.appendChild(sprite);
        selectSprite(sprite);
        onSceneModified();
    }

    function selectSprite(sprite) {
        deselectSprite();
        sprite.classList.add('selected');
        state.selectedSprite = sprite;
    }

    function deselectSprite() {
        if (state.selectedSprite) {
            state.selectedSprite.classList.remove('selected');
            state.selectedSprite = null;
        }
    }

    function onSpriteMouseDown(e) {
        const sprite = e.target.closest('.sprite');
        if (sprite && !e.target.classList.contains('sprite-delete-btn')) {
            state.draggedSprite = sprite;
            sprite.classList.add('dragging');
            selectSprite(sprite);
            e.preventDefault();
        }
    }

    function onSpriteMouseMove(e) {
        if (state.draggedSprite) {
            const rect = elements.previewSprites.getBoundingClientRect();
            let x = ((e.clientX - rect.left) / rect.width) * 100;
            let y = ((e.clientY - rect.top) / rect.height) * 100;

            // Clamp to bounds
            x = Math.max(5, Math.min(95, x));
            y = Math.max(10, Math.min(95, y));

            state.draggedSprite.style.left = x + '%';
            state.draggedSprite.style.bottom = (100 - y) + '%';
            state.draggedSprite.dataset.x = x;
            state.draggedSprite.dataset.y = y;
        }
    }

    function onSpriteMouseUp() {
        if (state.draggedSprite) {
            state.draggedSprite.classList.remove('dragging');
            state.draggedSprite = null;
            onSceneModified();
        }
    }

    // === Background Drag & Drop ===
    function setupBackgroundDragDrop() {
        const container = document.getElementById('canvas-container');

        container.addEventListener('dragover', (e) => {
            if (e.dataTransfer.types.includes('Files')) {
                e.preventDefault();
                elements.dropZone.classList.remove('hidden');
            }
        });

        container.addEventListener('dragleave', (e) => {
            if (!container.contains(e.relatedTarget)) {
                elements.dropZone.classList.add('hidden');
            }
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            elements.dropZone.classList.add('hidden');

            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                handleBackgroundDrop(files[0]);
            }
        });
    }

    function handleBackgroundDrop(file) {
        // For now, we just show a message that custom backgrounds need to be added to assets/bg
        alert(`To use "${file.name}" as a background:\n\n1. Copy it to the assets/bg/ folder\n2. Add it to the backgrounds list in editor.js\n3. Refresh the editor\n\nFor now, please select from the existing backgrounds.`);
    }

    // === Scene Management ===
    function createNewScene() {
        if (state.modified && !confirm('You have unsaved changes. Create new scene anyway?')) {
            return;
        }

        const newId = 'new_scene_' + Date.now();
        const scene = {
            id: newId,
            bg: null,
            music: null,
            chars: [],
            set_flags: [],
            require_flags: [],
            actions: [],
            textBlocks: ['Enter your story text here...'],
            choices: []
        };

        state.scenes[newId] = scene;
        state.currentSceneId = newId;
        state.modified = true;

        renderSceneList();
        loadSceneIntoEditor(scene);

        elements.sceneId.focus();
        elements.sceneId.select();
    }

    function loadScene(sceneId) {
        if (state.modified && !confirm('You have unsaved changes. Load different scene anyway?')) {
            return;
        }

        const scene = state.scenes[sceneId];
        if (!scene) return;

        state.currentSceneId = sceneId;
        state.modified = false;

        loadSceneIntoEditor(scene);
        highlightCurrentScene();
    }

    function loadSceneIntoEditor(scene) {
        // Scene ID
        elements.sceneId.value = scene.id;
        elements.currentSceneName.textContent = scene.id;

        // Background
        elements.bgSelect.value = scene.bg || '';
        updateBackgroundPreview(scene.bg);

        // Music
        elements.musicSelect.value = scene.music || '';
        stopMusicPreview();

        // Clear and rebuild sprites
        elements.previewSprites.innerHTML = '';
        if (scene.chars && scene.chars.length > 0) {
            scene.chars.forEach((char, index) => {
                // Handle both old format (string) and new format (object with position)
                if (typeof char === 'string') {
                    // Old format: distribute evenly
                    const x = 50 + (index - (scene.chars.length - 1) / 2) * 25;
                    addSpriteToCanvas(char, x, 85);
                } else {
                    // New format with position
                    addSpriteToCanvas(char.file, char.x || 50, char.y || 85);
                }
            });
        }

        // Text blocks
        renderTextBlocks(scene.textBlocks || []);

        // Choices
        renderChoices(scene.choices || []);

        // Flags
        renderFlags('set', scene.set_flags || []);
        renderFlags('require', scene.require_flags || []);

        // Actions
        renderActions(scene.actions || []);

        // Incoming references
        updateIncomingScenes(scene.id);

        // Update preview text
        updatePreviewText(scene.textBlocks);

        // Enable buttons
        elements.saveBtn.disabled = false;
        elements.deleteSceneBtn.disabled = false;

        state.modified = false;
    }

    function updateBackgroundPreview(bg) {
        if (bg) {
            elements.previewBackground.style.backgroundImage = `url(${config.assetPaths.bg}${bg})`;
            elements.bgPreview.style.backgroundImage = `url(${config.assetPaths.bg}${bg})`;
            elements.bgPreview.innerHTML = '';
        } else {
            elements.previewBackground.style.backgroundImage = 'none';
            elements.bgPreview.style.backgroundImage = 'none';
            elements.bgPreview.innerHTML = '<span class="placeholder">No background</span>';
        }
    }

    function updatePreviewText(textBlocks) {
        if (textBlocks && textBlocks.length > 0) {
            elements.previewText.textContent = textBlocks[0].substring(0, 150) + (textBlocks[0].length > 150 ? '...' : '');
        } else {
            elements.previewText.textContent = 'No text content';
        }
    }

    // === Text Blocks ===
    function renderTextBlocks(textBlocks) {
        elements.textBlocksContainer.innerHTML = '';

        textBlocks.forEach((text, index) => {
            addTextBlockElement(text, index);
        });
    }

    function addTextBlockElement(text = '', index = null) {
        const blockDiv = document.createElement('div');
        blockDiv.className = 'text-block';

        const header = document.createElement('div');
        header.className = 'text-block-header';

        const label = document.createElement('span');
        const blockIndex = index !== null ? index : elements.textBlocksContainer.children.length;
        label.textContent = `Block ${blockIndex + 1}`;

        const actions = document.createElement('div');
        actions.className = 'text-block-actions';

        if (blockIndex > 0) {
            const upBtn = document.createElement('button');
            upBtn.className = 'btn-icon';
            upBtn.textContent = '↑';
            upBtn.title = 'Move up';
            upBtn.addEventListener('click', () => moveTextBlock(blockDiv, -1));
            actions.appendChild(upBtn);
        }

        const downBtn = document.createElement('button');
        downBtn.className = 'btn-icon';
        downBtn.textContent = '↓';
        downBtn.title = 'Move down';
        downBtn.addEventListener('click', () => moveTextBlock(blockDiv, 1));
        actions.appendChild(downBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-icon';
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Delete block';
        deleteBtn.addEventListener('click', () => {
            blockDiv.remove();
            renumberTextBlocks();
            onSceneModified();
        });
        actions.appendChild(deleteBtn);

        header.appendChild(label);
        header.appendChild(actions);

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.placeholder = 'Enter text for this block...';
        textarea.addEventListener('input', () => {
            onSceneModified();
            updatePreviewText(getTextBlocksFromEditor());
        });

        blockDiv.appendChild(header);
        blockDiv.appendChild(textarea);
        elements.textBlocksContainer.appendChild(blockDiv);
    }

    function addTextBlock() {
        addTextBlockElement('');
        onSceneModified();
        // Focus the new textarea
        const textareas = elements.textBlocksContainer.querySelectorAll('textarea');
        textareas[textareas.length - 1].focus();
    }

    function moveTextBlock(blockDiv, direction) {
        const blocks = Array.from(elements.textBlocksContainer.children);
        const index = blocks.indexOf(blockDiv);
        const newIndex = index + direction;

        if (newIndex >= 0 && newIndex < blocks.length) {
            if (direction === -1) {
                elements.textBlocksContainer.insertBefore(blockDiv, blocks[newIndex]);
            } else {
                elements.textBlocksContainer.insertBefore(blocks[newIndex], blockDiv);
            }
            renumberTextBlocks();
            onSceneModified();
        }
    }

    function renumberTextBlocks() {
        const blocks = elements.textBlocksContainer.querySelectorAll('.text-block');
        blocks.forEach((block, index) => {
            const label = block.querySelector('.text-block-header span');
            label.textContent = `Block ${index + 1}`;
        });
    }

    function getTextBlocksFromEditor() {
        const blocks = [];
        elements.textBlocksContainer.querySelectorAll('textarea').forEach(textarea => {
            if (textarea.value.trim()) {
                blocks.push(textarea.value.trim());
            }
        });
        return blocks;
    }

    // === Choices ===
    function renderChoices(choices) {
        elements.choicesContainer.innerHTML = '';
        choices.forEach((choice, index) => {
            addChoiceElement(choice, index);
        });
    }

    function addChoiceElement(choice = null, index = null) {
        const choiceDiv = document.createElement('div');
        choiceDiv.className = 'choice-item';

        const header = document.createElement('div');
        header.className = 'choice-item-header';

        const label = document.createElement('span');
        const choiceIndex = index !== null ? index : elements.choicesContainer.children.length;
        label.textContent = `Choice ${choiceIndex + 1}`;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-icon';
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', () => {
            choiceDiv.remove();
            renumberChoices();
            onSceneModified();
        });

        header.appendChild(label);
        header.appendChild(deleteBtn);

        const inputs = document.createElement('div');
        inputs.className = 'choice-inputs';

        // Label input
        const labelGroup = document.createElement('label');
        labelGroup.textContent = 'Button text';
        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.className = 'choice-label';
        labelInput.value = choice ? choice.label : '';
        labelInput.placeholder = 'Choice text shown to player';
        labelInput.addEventListener('input', onSceneModified);
        labelGroup.appendChild(labelInput);

        // Target input with autocomplete
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
        targetInput.value = choice ? choice.target : '';
        targetInput.placeholder = 'target_scene_id';
        targetInput.addEventListener('input', onSceneModified);
        setupAutocomplete(targetInput);

        targetRow.appendChild(arrow);
        targetRow.appendChild(targetInput);
        targetGroup.appendChild(targetRow);

        // Optional flags
        const flagsRow = document.createElement('div');
        flagsRow.className = 'choice-flags';

        const requireLabel = document.createElement('label');
        requireLabel.textContent = 'Requires:';
        const requireInput = document.createElement('input');
        requireInput.type = 'text';
        requireInput.className = 'choice-require';
        requireInput.value = choice && choice.require_flags ? choice.require_flags.join(', ') : '';
        requireInput.placeholder = 'flag1, flag2';
        requireInput.addEventListener('input', onSceneModified);
        requireLabel.appendChild(requireInput);

        const setsLabel = document.createElement('label');
        setsLabel.textContent = 'Sets:';
        const setsInput = document.createElement('input');
        setsInput.type = 'text';
        setsInput.className = 'choice-sets';
        setsInput.value = choice && choice.set_flags ? choice.set_flags.join(', ') : '';
        setsInput.placeholder = 'flag1, flag2';
        setsInput.addEventListener('input', onSceneModified);
        setsLabel.appendChild(setsInput);

        flagsRow.appendChild(requireLabel);
        flagsRow.appendChild(setsLabel);

        inputs.appendChild(labelGroup);
        inputs.appendChild(targetGroup);
        inputs.appendChild(flagsRow);

        choiceDiv.appendChild(header);
        choiceDiv.appendChild(inputs);
        elements.choicesContainer.appendChild(choiceDiv);
    }

    function addChoice() {
        addChoiceElement();
        onSceneModified();
    }

    function renumberChoices() {
        const choices = elements.choicesContainer.querySelectorAll('.choice-item');
        choices.forEach((choice, index) => {
            const label = choice.querySelector('.choice-item-header span');
            label.textContent = `Choice ${index + 1}`;
        });
    }

    function getChoicesFromEditor() {
        const choices = [];
        elements.choicesContainer.querySelectorAll('.choice-item').forEach(item => {
            const label = item.querySelector('.choice-label').value.trim();
            const target = item.querySelector('.choice-target').value.trim();
            const requireStr = item.querySelector('.choice-require').value.trim();
            const setsStr = item.querySelector('.choice-sets').value.trim();

            if (label && target) {
                const choice = {
                    label: label,
                    target: target,
                    require_flags: requireStr ? requireStr.split(',').map(f => f.trim()).filter(f => f) : [],
                    set_flags: setsStr ? setsStr.split(',').map(f => f.trim()).filter(f => f) : []
                };
                choices.push(choice);
            }
        });
        return choices;
    }

    // === Autocomplete ===
    function setupAutocomplete(input) {
        let dropdown = null;

        input.addEventListener('focus', () => showAutocomplete(input));
        input.addEventListener('input', () => showAutocomplete(input));
        input.addEventListener('blur', () => {
            // Delay to allow click on dropdown
            setTimeout(() => hideAutocomplete(), 150);
        });

        function showAutocomplete(input) {
            hideAutocomplete();

            const value = input.value.toLowerCase();
            const matches = Object.keys(state.scenes)
                .filter(id => id.toLowerCase().includes(value) && id !== state.currentSceneId)
                .slice(0, 10);

            if (matches.length === 0) return;

            dropdown = document.createElement('div');
            dropdown.className = 'autocomplete-dropdown';

            matches.forEach(id => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                item.textContent = id;
                item.addEventListener('mousedown', () => {
                    input.value = id;
                    onSceneModified();
                    hideAutocomplete();
                });
                dropdown.appendChild(item);
            });

            const rect = input.getBoundingClientRect();
            dropdown.style.position = 'fixed';
            dropdown.style.top = rect.bottom + 'px';
            dropdown.style.left = rect.left + 'px';
            dropdown.style.width = rect.width + 'px';

            document.body.appendChild(dropdown);
        }

        function hideAutocomplete() {
            if (dropdown) {
                dropdown.remove();
                dropdown = null;
            }
        }
    }

    // === Flags ===
    function renderFlags(type, flags) {
        const container = type === 'set' ? elements.setFlagsContainer : elements.requireFlagsContainer;
        container.innerHTML = '';

        flags.forEach(flag => {
            addFlagTag(container, flag, type);
        });
    }

    function addFlagTag(container, flag, type) {
        const tag = document.createElement('span');
        tag.className = 'flag-tag';
        tag.textContent = flag;

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => {
            tag.remove();
            onSceneModified();
        });

        tag.appendChild(removeBtn);
        container.appendChild(tag);
    }

    function addFlag(type) {
        const input = type === 'set' ? elements.newSetFlag : elements.newRequireFlag;
        const container = type === 'set' ? elements.setFlagsContainer : elements.requireFlagsContainer;

        const flag = input.value.trim().toLowerCase().replace(/\s+/g, '_');
        if (flag) {
            addFlagTag(container, flag, type);
            input.value = '';
            onSceneModified();
        }
    }

    function getFlagsFromEditor(type) {
        const container = type === 'set' ? elements.setFlagsContainer : elements.requireFlagsContainer;
        const flags = [];
        container.querySelectorAll('.flag-tag').forEach(tag => {
            // Get text content without the × button
            const text = tag.firstChild.textContent.trim();
            if (text) flags.push(text);
        });
        return flags;
    }

    // === Actions ===
    function renderActions(actions) {
        elements.actionsContainer.innerHTML = '';
        actions.forEach((action, index) => {
            if (action.type === 'roll_dice') {
                addActionElement(action);
            }
        });
    }

    function addActionElement(action = null) {
        const actionDiv = document.createElement('div');
        actionDiv.className = 'action-item';

        const header = document.createElement('div');
        header.className = 'action-item-header';

        const label = document.createElement('span');
        label.textContent = 'Dice Roll';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-icon';
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', () => {
            actionDiv.remove();
            onSceneModified();
        });

        header.appendChild(label);
        header.appendChild(deleteBtn);

        const inputs = document.createElement('div');
        inputs.className = 'action-inputs';

        // Dice type
        const diceLabel = document.createElement('label');
        diceLabel.textContent = 'Dice';
        const diceSelect = document.createElement('select');
        diceSelect.className = 'action-dice';
        ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'].forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d.toUpperCase();
            diceSelect.appendChild(opt);
        });
        diceSelect.value = action ? action.dice : 'd20';
        diceSelect.addEventListener('change', onSceneModified);
        diceLabel.appendChild(diceSelect);

        // Threshold
        const thresholdLabel = document.createElement('label');
        thresholdLabel.textContent = 'Success ≤';
        const thresholdInput = document.createElement('input');
        thresholdInput.type = 'number';
        thresholdInput.className = 'action-threshold';
        thresholdInput.min = 1;
        thresholdInput.max = 100;
        thresholdInput.value = action ? action.threshold : 10;
        thresholdInput.addEventListener('input', onSceneModified);
        thresholdLabel.appendChild(thresholdInput);

        // Success target
        const successLabel = document.createElement('label');
        successLabel.textContent = 'On success →';
        const successInput = document.createElement('input');
        successInput.type = 'text';
        successInput.className = 'action-success';
        successInput.value = action ? action.success_target : '';
        successInput.placeholder = 'success_scene_id';
        successInput.addEventListener('input', onSceneModified);
        setupAutocomplete(successInput);
        successLabel.appendChild(successInput);

        // Failure target
        const failureLabel = document.createElement('label');
        failureLabel.textContent = 'On failure →';
        const failureInput = document.createElement('input');
        failureInput.type = 'text';
        failureInput.className = 'action-failure';
        failureInput.value = action ? action.failure_target : '';
        failureInput.placeholder = 'failure_scene_id';
        failureInput.addEventListener('input', onSceneModified);
        setupAutocomplete(failureInput);
        failureLabel.appendChild(failureInput);

        inputs.appendChild(diceLabel);
        inputs.appendChild(thresholdLabel);
        inputs.appendChild(successLabel);
        inputs.appendChild(failureLabel);

        actionDiv.appendChild(header);
        actionDiv.appendChild(inputs);
        elements.actionsContainer.appendChild(actionDiv);
    }

    function addAction() {
        addActionElement();
        onSceneModified();
    }

    function getActionsFromEditor() {
        const actions = [];
        elements.actionsContainer.querySelectorAll('.action-item').forEach(item => {
            const dice = item.querySelector('.action-dice').value;
            const threshold = parseInt(item.querySelector('.action-threshold').value) || 10;
            const success = item.querySelector('.action-success').value.trim();
            const failure = item.querySelector('.action-failure').value.trim();

            if (success && failure) {
                actions.push({
                    type: 'roll_dice',
                    dice: dice,
                    threshold: threshold,
                    success_target: success,
                    failure_target: failure
                });
            }
        });
        return actions;
    }

    // === Scene List ===
    function renderSceneList() {
        elements.sceneList.innerHTML = '';

        const searchTerm = elements.sceneSearchInput.value.toLowerCase();
        const sortedIds = Object.keys(state.scenes).sort();

        sortedIds.forEach(id => {
            if (searchTerm && !id.toLowerCase().includes(searchTerm)) return;

            const item = document.createElement('div');
            item.className = 'scene-item';
            if (id === state.currentSceneId) item.classList.add('active');
            if (state.modifiedScenes.has(id)) item.classList.add('modified');

            const icon = document.createElement('span');
            icon.className = 'scene-icon';
            icon.textContent = id === 'start' ? '▶' : '•';

            const name = document.createElement('span');
            name.className = 'scene-name';
            name.textContent = id;

            item.appendChild(icon);
            item.appendChild(name);
            item.addEventListener('click', () => loadScene(id));

            elements.sceneList.appendChild(item);
        });
    }

    function filterSceneList() {
        renderSceneList();
    }

    function highlightCurrentScene() {
        elements.sceneList.querySelectorAll('.scene-item').forEach(item => {
            const name = item.querySelector('.scene-name').textContent;
            item.classList.toggle('active', name === state.currentSceneId);
        });
    }

    // === Incoming Scenes ===
    function updateIncomingScenes(sceneId) {
        elements.incomingScenes.innerHTML = '';

        const incoming = findIncomingScenes(sceneId);

        if (incoming.length === 0) {
            elements.incomingScenes.innerHTML = '<span class="placeholder">No scenes link here</span>';
            return;
        }

        incoming.forEach(ref => {
            const item = document.createElement('div');
            item.className = 'incoming-item';
            item.textContent = `${ref.from} (${ref.type})`;
            item.addEventListener('click', () => loadScene(ref.from));
            elements.incomingScenes.appendChild(item);
        });
    }

    function findIncomingScenes(targetId) {
        const incoming = [];

        Object.values(state.scenes).forEach(scene => {
            if (scene.id === targetId) return;

            // Check choices
            if (scene.choices) {
                scene.choices.forEach(choice => {
                    if (choice.target === targetId) {
                        incoming.push({ from: scene.id, type: 'choice' });
                    }
                });
            }

            // Check actions
            if (scene.actions) {
                scene.actions.forEach(action => {
                    if (action.success_target === targetId) {
                        incoming.push({ from: scene.id, type: 'dice success' });
                    }
                    if (action.failure_target === targetId) {
                        incoming.push({ from: scene.id, type: 'dice failure' });
                    }
                });
            }
        });

        return incoming;
    }

    // === Save / Export ===
    function onSceneModified() {
        state.modified = true;
        if (state.currentSceneId) {
            state.modifiedScenes.add(state.currentSceneId);
        }
        elements.saveBtn.disabled = false;
        highlightCurrentScene();
    }

    function onBackgroundChange() {
        const bg = elements.bgSelect.value;
        updateBackgroundPreview(bg);
        onSceneModified();
    }

    function saveCurrentScene() {
        if (!state.currentSceneId) return;

        const oldId = state.currentSceneId;
        const newId = elements.sceneId.value.trim().toLowerCase().replace(/\s+/g, '_');

        if (!newId) {
            alert('Scene ID is required');
            elements.sceneId.focus();
            return;
        }

        // Check for ID conflicts
        if (newId !== oldId && state.scenes[newId]) {
            alert(`A scene with ID "${newId}" already exists. Please choose a different ID.`);
            return;
        }

        // Get sprites from canvas
        const sprites = [];
        elements.previewSprites.querySelectorAll('.sprite').forEach(sprite => {
            sprites.push({
                file: sprite.dataset.file,
                x: parseFloat(sprite.dataset.x),
                y: parseFloat(sprite.dataset.y)
            });
        });

        // Build scene object
        const scene = {
            id: newId,
            bg: elements.bgSelect.value || null,
            music: elements.musicSelect.value || null,
            chars: sprites,
            set_flags: getFlagsFromEditor('set'),
            require_flags: getFlagsFromEditor('require'),
            actions: getActionsFromEditor(),
            textBlocks: getTextBlocksFromEditor(),
            choices: getChoicesFromEditor()
        };

        // Update scenes object
        if (newId !== oldId) {
            delete state.scenes[oldId];
            state.modifiedScenes.delete(oldId);
        }
        state.scenes[newId] = scene;
        state.currentSceneId = newId;
        state.modified = false;
        state.modifiedScenes.delete(newId);

        // Save to localStorage
        saveSenesToStorage();

        // Update UI
        elements.currentSceneName.textContent = newId;
        renderSceneList();
        updateIncomingScenes(newId);

        console.log('Scene saved:', scene);
    }

    function downloadCurrentScene() {
        if (!state.currentSceneId) return;

        // Save first
        saveCurrentScene();

        const scene = state.scenes[state.currentSceneId];
        const md = generateMarkdown(scene);

        // Download
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = scene.id + '.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function generateMarkdown(scene) {
        let md = '---\n';
        md += `id: ${scene.id}\n`;

        if (scene.bg) {
            md += `bg: ${scene.bg}\n`;
        }

        if (scene.music) {
            md += `music: ${scene.music}\n`;
        }

        if (scene.chars && scene.chars.length > 0) {
            md += 'chars:\n';
            scene.chars.forEach(char => {
                if (typeof char === 'string') {
                    md += `  - ${char}\n`;
                } else {
                    // New format with position
                    md += `  - file: ${char.file}\n`;
                    md += `    x: ${Math.round(char.x)}\n`;
                    md += `    y: ${Math.round(char.y)}\n`;
                }
            });
        }

        if (scene.set_flags && scene.set_flags.length > 0) {
            md += 'set_flags:\n';
            scene.set_flags.forEach(flag => {
                md += `  - ${flag}\n`;
            });
        }

        if (scene.require_flags && scene.require_flags.length > 0) {
            md += 'require_flags:\n';
            scene.require_flags.forEach(flag => {
                md += `  - ${flag}\n`;
            });
        }

        if (scene.actions && scene.actions.length > 0) {
            md += 'actions:\n';
            scene.actions.forEach(action => {
                md += `  - type: ${action.type}\n`;
                if (action.dice) md += `    dice: ${action.dice}\n`;
                if (action.threshold) md += `    threshold: ${action.threshold}\n`;
                if (action.success_target) md += `    success_target: ${action.success_target}\n`;
                if (action.failure_target) md += `    failure_target: ${action.failure_target}\n`;
            });
        }

        md += '---\n\n';

        // Text blocks
        if (scene.textBlocks && scene.textBlocks.length > 0) {
            md += scene.textBlocks.join('\n\n---\n\n');
        }

        // Choices
        if (scene.choices && scene.choices.length > 0) {
            md += '\n\n### Choices\n\n';
            scene.choices.forEach(choice => {
                let choiceLine = `- ${choice.label}`;

                if (choice.require_flags && choice.require_flags.length > 0) {
                    choiceLine += ` (requires: ${choice.require_flags.join(', ')})`;
                }
                if (choice.set_flags && choice.set_flags.length > 0) {
                    choiceLine += ` (sets: ${choice.set_flags.join(', ')})`;
                }

                choiceLine += ` → ${choice.target}`;
                md += choiceLine + '\n';
            });
        }

        return md;
    }

    // === Delete Scene ===
    function showDeleteModal() {
        if (!state.currentSceneId) return;

        const dependencies = findIncomingScenes(state.currentSceneId);

        let warningsHtml = '';
        if (dependencies.length > 0) {
            warningsHtml = '<div class="warning">⚠️ This scene is referenced by:</div><ul class="warning-list">';
            dependencies.forEach(dep => {
                warningsHtml += `<li>${dep.from} (${dep.type})</li>`;
            });
            warningsHtml += '</ul><div class="warning">Deleting will break these connections!</div>';
        } else {
            warningsHtml = '<p>This scene is not referenced by any other scenes.</p>';
        }

        elements.deleteWarnings.innerHTML = warningsHtml;
        elements.deleteModal.classList.remove('hidden');
    }

    function hideDeleteModal() {
        elements.deleteModal.classList.add('hidden');
    }

    function confirmDelete() {
        if (!state.currentSceneId) return;

        const idToDelete = state.currentSceneId;
        delete state.scenes[idToDelete];
        state.modifiedScenes.delete(idToDelete);
        state.currentSceneId = null;
        state.modified = false;

        saveSenesToStorage();
        renderSceneList();

        // Clear editor
        elements.sceneId.value = '';
        elements.currentSceneName.textContent = 'No scene selected';
        elements.bgSelect.value = '';
        updateBackgroundPreview(null);
        elements.musicSelect.value = '';
        elements.previewSprites.innerHTML = '';
        elements.textBlocksContainer.innerHTML = '';
        elements.choicesContainer.innerHTML = '';
        elements.setFlagsContainer.innerHTML = '';
        elements.requireFlagsContainer.innerHTML = '';
        elements.actionsContainer.innerHTML = '';
        elements.incomingScenes.innerHTML = '<span class="placeholder">Save scene to see references</span>';
        elements.previewText.textContent = 'Select or create a scene to begin editing...';
        elements.saveBtn.disabled = true;
        elements.deleteSceneBtn.disabled = true;

        hideDeleteModal();
    }

    // === Storage ===
    function saveSenesToStorage() {
        try {
            localStorage.setItem('andi_editor_scenes', JSON.stringify(state.scenes));
        } catch (e) {
            console.warn('Could not save to localStorage:', e);
        }
    }

    function loadScenesFromStorage() {
        try {
            const saved = localStorage.getItem('andi_editor_scenes');
            if (saved) {
                state.scenes = JSON.parse(saved);
                renderSceneList();
                console.log('Loaded', Object.keys(state.scenes).length, 'scenes from storage');
            }
        } catch (e) {
            console.warn('Could not load from localStorage:', e);
        }
    }

    // === Import ===
    function importScenes() {
        // Create file input for importing .md files
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.md';
        input.multiple = true;

        input.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            let imported = 0;

            for (const file of files) {
                try {
                    const content = await file.text();
                    const scene = parseMarkdownScene(content);
                    if (scene && scene.id) {
                        state.scenes[scene.id] = scene;
                        imported++;
                    }
                } catch (err) {
                    console.error('Error importing', file.name, err);
                }
            }

            if (imported > 0) {
                saveSenesToStorage();
                renderSceneList();
                alert(`Imported ${imported} scene(s)`);
            }
        });

        input.click();
    }

    function parseMarkdownScene(content) {
        // Simple parser matching build_story_from_md.py logic
        if (!content.startsWith('---')) {
            return null;
        }

        const endMatch = content.substring(3).indexOf('\n---\n');
        if (endMatch === -1) return null;

        const frontmatterText = content.substring(3, 3 + endMatch);
        const body = content.substring(3 + endMatch + 5);

        // Parse frontmatter
        const scene = {
            id: null,
            bg: null,
            music: null,
            chars: [],
            set_flags: [],
            require_flags: [],
            actions: [],
            textBlocks: [],
            choices: []
        };

        let currentList = null;
        let currentAction = null;
        let currentChar = null;

        frontmatterText.split('\n').forEach(line => {
            const stripped = line.trim();
            if (!stripped) return;

            // Check for action type start
            if (stripped.startsWith('- type:')) {
                if (currentAction) scene.actions.push(currentAction);
                currentAction = { type: stripped.substring(7).trim() };
                return;
            }

            // Check for char file start
            if (stripped.startsWith('- file:')) {
                if (currentChar) scene.chars.push(currentChar);
                currentChar = { file: stripped.substring(7).trim() };
                return;
            }

            // Action properties
            if (currentAction && line.startsWith('    ') && stripped.includes(':')) {
                const [key, ...valueParts] = stripped.split(':');
                let value = valueParts.join(':').trim();
                if (!isNaN(value)) value = parseInt(value);
                currentAction[key.trim()] = value;
                return;
            }

            // Char properties (x, y)
            if (currentChar && line.startsWith('    ') && stripped.includes(':')) {
                const [key, ...valueParts] = stripped.split(':');
                let value = valueParts.join(':').trim();
                if (!isNaN(value)) value = parseFloat(value);
                currentChar[key.trim()] = value;
                return;
            }

            // List items (old format chars)
            if (stripped.startsWith('- ') && currentList !== null && !currentAction && !currentChar) {
                const item = stripped.substring(2).trim();
                if (currentList === 'chars') {
                    scene.chars.push(item);
                } else {
                    scene[currentList].push(item);
                }
                return;
            }

            // Key: value pairs
            if (stripped.includes(':')) {
                if (currentAction) {
                    scene.actions.push(currentAction);
                    currentAction = null;
                }
                if (currentChar) {
                    scene.chars.push(currentChar);
                    currentChar = null;
                }

                const [key, ...valueParts] = stripped.split(':');
                const value = valueParts.join(':').trim();

                if (value === '') {
                    // Start of a list
                    if (key === 'actions') {
                        currentList = null; // Actions handled differently
                    } else if (key === 'chars') {
                        currentList = 'chars';
                    } else if (key === 'set_flags') {
                        currentList = 'set_flags';
                    } else if (key === 'require_flags') {
                        currentList = 'require_flags';
                    }
                } else {
                    currentList = null;
                    scene[key.trim()] = value;
                }
            }
        });

        if (currentAction) scene.actions.push(currentAction);
        if (currentChar) scene.chars.push(currentChar);

        // Parse body for text blocks and choices
        const choicesMatch = body.match(/###\s*Choices\s*\n/);
        let textPart = body;
        let choicesPart = '';

        if (choicesMatch) {
            textPart = body.substring(0, choicesMatch.index);
            choicesPart = body.substring(choicesMatch.index + choicesMatch[0].length);
        }

        // Split text blocks
        scene.textBlocks = textPart.split(/\n---\n/)
            .map(b => b.trim())
            .filter(b => b);

        // Parse choices
        if (choicesPart) {
            choicesPart.split('\n').forEach(line => {
                line = line.trim();
                if (!line.startsWith('-')) return;

                line = line.substring(1).trim();

                let target = '';
                let label = line;

                if (line.includes('→')) {
                    const parts = line.split('→');
                    label = parts[0].trim();
                    target = parts[1].trim();
                } else if (line.includes('->')) {
                    const parts = line.split('->');
                    label = parts[0].trim();
                    target = parts[1].trim();
                }

                const choice = {
                    label: label,
                    target: target,
                    require_flags: [],
                    set_flags: []
                };

                // Parse flags from label
                const requireMatch = label.match(/\(requires:\s*([^)]+)\)/);
                if (requireMatch) {
                    choice.require_flags = requireMatch[1].split(',').map(f => f.trim());
                    choice.label = label.replace(/\(requires:\s*[^)]+\)/, '').trim();
                }

                const setsMatch = choice.label.match(/\(sets:\s*([^)]+)\)/);
                if (setsMatch) {
                    choice.set_flags = setsMatch[1].split(',').map(f => f.trim());
                    choice.label = choice.label.replace(/\(sets:\s*[^)]+\)/, '').trim();
                }

                if (choice.label && choice.target) {
                    scene.choices.push(choice);
                }
            });
        }

        return scene;
    }

    // === Music Preview ===
    function toggleMusicPreview() {
        const music = elements.musicSelect.value;

        if (state.musicPlaying) {
            stopMusicPreview();
        } else if (music && music !== 'none') {
            elements.musicPlayer.src = config.assetPaths.music + music;
            elements.musicPlayer.play();
            elements.musicPreviewBtn.textContent = 'Stop';
            state.musicPlaying = true;
        }
    }

    function stopMusicPreview() {
        elements.musicPlayer.pause();
        elements.musicPlayer.currentTime = 0;
        elements.musicPreviewBtn.textContent = 'Play';
        state.musicPlaying = false;
    }

    // === Preview in Game ===
    function previewInGame() {
        // Save first
        saveCurrentScene();

        // Open game in new tab with scene parameter
        // Note: This requires the game to support a ?scene= parameter
        const url = `../index.html?scene=${state.currentSceneId}`;
        window.open(url, '_blank');
    }

    // === Collapsible Sections ===
    function toggleCollapsible(e) {
        const header = e.currentTarget;
        const content = header.nextElementSibling;
        const icon = header.querySelector('.collapse-icon');

        content.classList.toggle('collapsed');
        icon.textContent = content.classList.contains('collapsed') ? '+' : '−';
    }

    // === Keyboard Shortcuts ===
    function handleKeyboard(e) {
        // Ctrl+S to save
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveCurrentScene();
        }

        // Delete selected sprite
        if (e.key === 'Delete' && state.selectedSprite) {
            state.selectedSprite.remove();
            state.selectedSprite = null;
            onSceneModified();
        }

        // Escape to deselect
        if (e.key === 'Escape') {
            deselectSprite();
        }
    }

    // === Public API ===
    return {
        init: init,
        getScenes: () => state.scenes,
        getCurrentScene: () => state.scenes[state.currentSceneId]
    };

})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', Editor.init);
