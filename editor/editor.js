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
        resizingSprite: null, // Sprite being resized with Shift
        initialResizeData: null, // Initial data for resize operation
        musicPlaying: false,
        // Text block navigation
        textBlocks: [''],     // Current text blocks array
        currentTextBlockIndex: 0,
        // Graph view state
        graph: {
            zoom: 1,
            panX: 0,
            panY: 0,
            isPanning: false,
            startPanX: 0,
            startPanY: 0,
            contextMenuNode: null,  // Node currently shown in context menu
            // Node dragging
            draggingNode: null,
            dragOffsetX: 0,
            dragOffsetY: 0,
            nodePositions: {}  // Custom positions keyed by node ID
        }
    };

    // === DOM References ===
    let elements = {};

    // === Initialization ===
    function init() {
        cacheElements();
        setupEventListeners();
        populateAssetSelectors();
        populateSpriteGallery();

        // Auto-load scenes on startup
        autoLoadScenes();
    }

    async function autoLoadScenes() {
        // First check if story is already loaded (via script tag)
        if (typeof story !== 'undefined' && story) {
            let count = 0;
            for (const [id, scene] of Object.entries(story)) {
                state.scenes[id] = scene;
                count++;
            }
            console.log(`Auto-loaded ${count} scenes from global story object`);
            renderSceneList();
            saveSenesToStorage();
            return;
        }

        // Try to load from the compiled story.js via fetch
        try {
            const response = await fetch('../js/story.js');
            if (response.ok) {
                const jsContent = await response.text();
                // Extract the story object from the JS file
                // Find start after "const story = " and end at "};" on its own line
                const startMarker = 'const story = ';
                const startIdx = jsContent.indexOf(startMarker);
                if (startIdx !== -1) {
                    const jsonStart = startIdx + startMarker.length;
                    // Find the closing }; that ends the object (on its own line or followed by newline)
                    const endMatch = jsContent.indexOf('\n};', jsonStart);
                    if (endMatch !== -1) {
                        const jsonStr = jsContent.substring(jsonStart, endMatch + 2); // +2 to include the }
                        const storyData = JSON.parse(jsonStr);
                        let count = 0;
                        for (const [id, scene] of Object.entries(storyData)) {
                            state.scenes[id] = scene;
                            count++;
                        }
                        console.log(`Auto-loaded ${count} scenes from story.js via fetch`);
                        renderSceneList();
                        saveSenesToStorage();
                        return;
                    }
                }
            }
        } catch (e) {
            console.log('Could not load from story.js via fetch:', e.message);
        }

        // Fallback: try to load from localStorage
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
            choicesContainer: document.getElementById('choices-container'),
            addChoiceBtn: document.getElementById('add-choice-btn'),

            // Text editing (on canvas)
            previewTextarea: document.getElementById('preview-text'),
            textBlockIndicator: document.getElementById('text-block-indicator'),
            textPrevBtn: document.getElementById('text-prev-btn'),
            textNextBtn: document.getElementById('text-next-btn'),
            textAddBtn: document.getElementById('text-add-btn'),
            textDeleteBtn: document.getElementById('text-delete-btn'),

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

            // Incoming (sidebar)
            incomingScenes: document.getElementById('incoming-scenes'),

            // Node connections panel
            incomingConnections: document.getElementById('incoming-connections'),
            outgoingConnections: document.getElementById('outgoing-connections'),
            nodeCurrentScene: document.getElementById('node-current-scene'),

            // Delete
            deleteSceneBtn: document.getElementById('delete-scene-btn'),
            deleteModal: document.getElementById('delete-modal'),
            deleteWarnings: document.getElementById('delete-warnings'),
            deleteCancelBtn: document.getElementById('delete-cancel-btn'),
            deleteConfirmBtn: document.getElementById('delete-confirm-btn'),

            // Graph
            graphBtn: document.getElementById('graph-btn'),
            graphModal: document.getElementById('graph-modal'),
            graphSvg: document.getElementById('graph-svg'),
            graphContainer: document.getElementById('graph-container'),
            graphClose: document.getElementById('graph-close'),
            graphZoomIn: document.getElementById('graph-zoom-in'),
            graphZoomOut: document.getElementById('graph-zoom-out'),
            graphReset: document.getElementById('graph-reset'),
            graphResetLayout: document.getElementById('graph-reset-layout'),

            // Graph context menu
            graphContextMenu: document.getElementById('graph-context-menu'),
            ctxEditScene: document.getElementById('ctx-edit-scene'),
            ctxRenameScene: document.getElementById('ctx-rename-scene'),
            ctxViewFlags: document.getElementById('ctx-view-flags'),
            ctxDeleteScene: document.getElementById('ctx-delete-scene')
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

        // Text block navigation (on canvas)
        elements.textPrevBtn.addEventListener('click', () => navigateTextBlock(-1));
        elements.textNextBtn.addEventListener('click', () => navigateTextBlock(1));
        elements.textAddBtn.addEventListener('click', addNewTextBlock);
        elements.textDeleteBtn.addEventListener('click', deleteCurrentTextBlock);
        elements.previewTextarea.addEventListener('input', onTextBlockInput);

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

        // Graph
        elements.graphBtn.addEventListener('click', showGraphModal);
        elements.graphClose.addEventListener('click', hideGraphModal);
        elements.graphZoomIn.addEventListener('click', () => zoomGraph(1.2));
        elements.graphZoomOut.addEventListener('click', () => zoomGraph(0.8));
        elements.graphReset.addEventListener('click', resetGraphView);
        elements.graphResetLayout.addEventListener('click', resetGraphLayout);
        elements.graphModal.addEventListener('click', (e) => {
            if (e.target === elements.graphModal) hideGraphModal();
        });

        // Graph context menu
        elements.ctxEditScene.addEventListener('click', ctxEditScene);
        elements.ctxRenameScene.addEventListener('click', ctxRenameScene);
        elements.ctxViewFlags.addEventListener('click', ctxViewFlags);
        elements.ctxDeleteScene.addEventListener('click', ctxDeleteScene);
        document.addEventListener('click', hideContextMenu);

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
            const thumb = e.target.closest('.sprite-thumb');
            if (thumb) {
                thumb.classList.add('dragging');
                e.dataTransfer.setData('text/plain', thumb.dataset.sprite);
                e.dataTransfer.effectAllowed = 'copy';

                // Use the image inside the thumb as the drag image
                const img = thumb.querySelector('img');
                if (img) {
                    // Create a smaller drag image
                    e.dataTransfer.setDragImage(img, img.width / 2, img.height / 2);
                }
            }
        });

        elements.spriteGallery.addEventListener('dragend', (e) => {
            const thumb = e.target.closest('.sprite-thumb');
            if (thumb) {
                thumb.classList.remove('dragging');
            }
        });

        // Drop on entire canvas (background + sprites area)
        elements.canvasPreview.addEventListener('dragover', (e) => {
            // Only allow sprite drops (not file drops which are for background)
            if (e.dataTransfer.types.includes('text/plain')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            }
        });

        elements.canvasPreview.addEventListener('drop', (e) => {
            const spriteFile = e.dataTransfer.getData('text/plain');
            if (spriteFile && spriteFile.endsWith('.svg')) {
                e.preventDefault();
                // Calculate position relative to sprite layer
                const rect = elements.previewSprites.getBoundingClientRect();
                let x = ((e.clientX - rect.left) / rect.width) * 100;
                let yRaw = ((e.clientY - rect.top) / rect.height) * 100;

                // Snap Y to 4 preset positions based on drop zone
                // Divide canvas into bands, max Y is 65% to stay above text box
                let y;
                if (yRaw < 15) {
                    y = 10;  // highest
                } else if (yRaw < 35) {
                    y = 25;  // high
                } else if (yRaw < 55) {
                    y = 45;  // middle
                } else {
                    y = 65;  // low (max allowed)
                }

                // Clamp X to reasonable bounds
                x = Math.max(5, Math.min(95, x));

                addSpriteToCanvas(spriteFile, x, y);
            }
        });

        // Drag sprites on canvas
        elements.previewSprites.addEventListener('mousedown', onSpriteMouseDown);
        document.addEventListener('mousemove', onSpriteMouseMove);
        document.addEventListener('mouseup', onSpriteMouseUp);
    }

    function addSpriteToCanvas(spriteFile, x = 50, y = 50, scale = 1, autoSelect = true) {
        const sprite = document.createElement('div');
        sprite.className = 'sprite';
        sprite.dataset.file = spriteFile;
        sprite.dataset.x = x;
        sprite.dataset.y = y;
        sprite.dataset.scale = scale;

        // Position: x/y are center of sprite
        sprite.style.left = x + '%';
        sprite.style.top = y + '%';
        sprite.style.transform = `translate(-50%, -50%) scale(${scale})`;
        sprite.style.transformOrigin = 'center center';

        const img = document.createElement('img');
        img.src = config.assetPaths.char + spriteFile;
        img.alt = spriteFile;
        img.draggable = false;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'sprite-delete-btn';
        deleteBtn.title = 'Remove sprite';
        deleteBtn.innerHTML = '<svg viewBox="0 0 10 10" width="8" height="8"><line x1="1" y1="1" x2="9" y2="9" stroke="white" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>';
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
        if (autoSelect) {
            selectSprite(sprite);
            onSceneModified();
        }
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
            selectSprite(sprite);
            e.preventDefault();

            if (e.shiftKey) {
                // Shift+drag = resize
                state.resizingSprite = sprite;
                const rect = elements.previewSprites.getBoundingClientRect();
                state.initialResizeData = {
                    startY: e.clientY,
                    startScale: parseFloat(sprite.dataset.scale) || 1
                };
                sprite.classList.add('resizing');
            } else {
                // Normal drag = move
                state.draggedSprite = sprite;
                sprite.classList.add('dragging');
            }
        }
    }

    function onSpriteMouseMove(e) {
        if (state.draggedSprite) {
            // Moving sprite
            const rect = elements.previewSprites.getBoundingClientRect();
            let x = ((e.clientX - rect.left) / rect.width) * 100;
            let y = ((e.clientY - rect.top) / rect.height) * 100;

            // Clamp to bounds (max Y is 65% to stay above text box)
            x = Math.max(5, Math.min(95, x));
            y = Math.max(5, Math.min(65, y));

            state.draggedSprite.style.left = x + '%';
            state.draggedSprite.style.top = y + '%';
            state.draggedSprite.dataset.x = x;
            state.draggedSprite.dataset.y = y;
        }

        if (state.resizingSprite && state.initialResizeData) {
            // Resizing sprite - drag up to grow, drag down to shrink
            const deltaY = state.initialResizeData.startY - e.clientY;
            const scaleFactor = deltaY / 100; // 100px drag = 1x scale change
            let newScale = state.initialResizeData.startScale + scaleFactor;

            // Clamp scale between 0.2 and 3
            newScale = Math.max(0.2, Math.min(3, newScale));

            const currentScale = parseFloat(state.resizingSprite.dataset.scale) || 1;
            state.resizingSprite.dataset.scale = newScale;
            state.resizingSprite.style.transform = `translate(-50%, -50%) scale(${newScale})`;
        }
    }

    function onSpriteMouseUp() {
        if (state.draggedSprite) {
            state.draggedSprite.classList.remove('dragging');
            state.draggedSprite = null;
            onSceneModified();
        }

        if (state.resizingSprite) {
            state.resizingSprite.classList.remove('resizing');
            state.resizingSprite = null;
            state.initialResizeData = null;
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

        const scene = state.scenes[sceneId];
        if (!scene) return;

        state.currentSceneId = sceneId;
        state.modified = false;

        loadSceneIntoEditor(scene);
        highlightCurrentScene();
    }

    function loadSceneIntoEditor(scene) {
        // Deselect any selected sprite
        deselectSprite();

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
                    // Old format: distribute evenly, vertically centered
                    const x = 50 + (index - (scene.chars.length - 1) / 2) * 25;
                    addSpriteToCanvas(char, x, 50, 1, false);
                } else {
                    // New format with position and optional scale
                    addSpriteToCanvas(char.file, char.x || 50, char.y || 50, char.scale || 1, false);
                }
            });
        }

        // Text blocks - load into state and display first
        state.textBlocks = scene.textBlocks && scene.textBlocks.length > 0
            ? [...scene.textBlocks]
            : [''];
        state.currentTextBlockIndex = 0;
        updateTextBlockDisplay();

        // Choices
        renderChoices(scene.choices || []);

        // Flags
        renderFlags('set', scene.set_flags || []);
        renderFlags('require', scene.require_flags || []);

        // Actions
        renderActions(scene.actions || []);

        // Incoming references (sidebar)
        updateIncomingScenes(scene.id);

        // Node connections panel
        updateNodeConnections(scene);

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

    // === Text Block Navigation (on canvas) ===
    function updateTextBlockDisplay() {
        const total = state.textBlocks.length;
        const current = state.currentTextBlockIndex + 1;

        // Update indicator
        elements.textBlockIndicator.textContent = `Block ${current} / ${total}`;

        // Update textarea content
        elements.previewTextarea.value = state.textBlocks[state.currentTextBlockIndex] || '';

        // Update button states
        elements.textPrevBtn.disabled = state.currentTextBlockIndex <= 0;
        elements.textNextBtn.disabled = state.currentTextBlockIndex >= total - 1;
        elements.textDeleteBtn.disabled = total <= 1; // Can't delete last block
    }

    function navigateTextBlock(direction) {
        // Save current text first
        saveCurrentTextBlock();

        const newIndex = state.currentTextBlockIndex + direction;
        if (newIndex >= 0 && newIndex < state.textBlocks.length) {
            state.currentTextBlockIndex = newIndex;
            updateTextBlockDisplay();
        }
    }

    function saveCurrentTextBlock() {
        state.textBlocks[state.currentTextBlockIndex] = elements.previewTextarea.value;
    }

    function onTextBlockInput() {
        saveCurrentTextBlock();
        onSceneModified();
    }

    function addNewTextBlock() {
        // Save current first
        saveCurrentTextBlock();

        // Add new block after current
        state.currentTextBlockIndex++;
        state.textBlocks.splice(state.currentTextBlockIndex, 0, '');

        updateTextBlockDisplay();
        elements.previewTextarea.focus();
        onSceneModified();
    }

    function deleteCurrentTextBlock() {
        if (state.textBlocks.length <= 1) return;

        state.textBlocks.splice(state.currentTextBlockIndex, 1);

        // Adjust index if we deleted the last block
        if (state.currentTextBlockIndex >= state.textBlocks.length) {
            state.currentTextBlockIndex = state.textBlocks.length - 1;
        }

        updateTextBlockDisplay();
        onSceneModified();
    }

    function getTextBlocksFromEditor() {
        // Make sure current is saved
        saveCurrentTextBlock();
        // Return non-empty blocks
        return state.textBlocks.filter(b => b.trim());
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

    // === Node Connections Panel ===
    function updateNodeConnections(scene) {
        // Update current scene name in center
        elements.nodeCurrentScene.textContent = scene.id || 'No scene';

        // Update incoming connections
        updateIncomingConnectionsPanel(scene.id);

        // Update outgoing connections
        updateOutgoingConnectionsPanel(scene);
    }

    function updateIncomingConnectionsPanel(sceneId) {
        elements.incomingConnections.innerHTML = '';

        const incoming = findIncomingScenes(sceneId);

        if (incoming.length === 0) {
            elements.incomingConnections.innerHTML = '<span class="placeholder">No scenes lead here</span>';
            return;
        }

        incoming.forEach(ref => {
            const node = document.createElement('div');
            node.className = 'connection-node';
            node.innerHTML = `
                <span class="connection-name">${ref.from}</span>
                <span class="connection-type">${ref.type}</span>
            `;
            node.title = `Click to go to ${ref.from}`;
            node.addEventListener('click', () => loadScene(ref.from));
            elements.incomingConnections.appendChild(node);
        });
    }

    function updateOutgoingConnectionsPanel(scene) {
        elements.outgoingConnections.innerHTML = '';

        const outgoing = [];

        // Collect choices
        if (scene.choices && scene.choices.length > 0) {
            scene.choices.forEach(choice => {
                if (choice.target) {
                    outgoing.push({
                        target: choice.target,
                        type: 'choice',
                        label: choice.text ? choice.text.substring(0, 20) : 'choice'
                    });
                }
            });
        }

        // Collect dice action targets
        if (scene.actions && scene.actions.length > 0) {
            scene.actions.forEach(action => {
                if (action.success_target) {
                    outgoing.push({
                        target: action.success_target,
                        type: 'success',
                        label: `dice ≥${action.dc || '?'}`
                    });
                }
                if (action.failure_target) {
                    outgoing.push({
                        target: action.failure_target,
                        type: 'failure',
                        label: `dice <${action.dc || '?'}`
                    });
                }
            });
        }

        if (outgoing.length === 0) {
            elements.outgoingConnections.innerHTML = '<span class="placeholder">End scene (no outputs)</span>';
            return;
        }

        outgoing.forEach(ref => {
            const node = document.createElement('div');
            node.className = 'connection-node';

            // Check if target scene exists
            const exists = state.scenes[ref.target];

            node.innerHTML = `
                <span class="connection-name">${ref.target}</span>
                <span class="connection-type">${ref.type}</span>
            `;
            node.title = exists
                ? `Click to go to ${ref.target}`
                : `${ref.target} (scene not found - click to create)`;

            if (!exists) {
                node.style.borderColor = 'var(--warning)';
            }

            node.addEventListener('click', () => {
                if (exists) {
                    loadScene(ref.target);
                } else {
                    // Offer to create the scene
                    if (confirm(`Scene "${ref.target}" doesn't exist. Create it?`)) {
                        createSceneWithId(ref.target);
                    }
                }
            });
            elements.outgoingConnections.appendChild(node);
        });
    }

    function createSceneWithId(id) {
        const newScene = {
            id: id,
            bg: '',
            chars: [],
            textBlocks: [''],
            choices: [],
            set_flags: [],
            require_flags: [],
            actions: []
        };

        state.scenes[id] = newScene;
        state.currentSceneId = id;

        loadSceneIntoEditor(newScene);
        renderSceneList();
        onSceneModified();
    }

    function clearNodeConnections() {
        elements.nodeCurrentScene.textContent = 'No scene selected';
        elements.incomingConnections.innerHTML = '<span class="placeholder">No scenes lead here</span>';
        elements.outgoingConnections.innerHTML = '<span class="placeholder">No outgoing connections</span>';
    }

    // === Story Graph ===
    function showGraphModal() {
        elements.graphModal.classList.remove('hidden');
        resetGraphView();
        renderGraph();
        setupGraphPanning();
    }

    function hideGraphModal() {
        elements.graphModal.classList.add('hidden');
    }

    function resetGraphView() {
        state.graph.zoom = 1;
        state.graph.panX = 0;
        state.graph.panY = 0;
        updateGraphTransform();
    }

    function resetGraphLayout() {
        state.graph.nodePositions = {};
        renderGraph();
    }

    function zoomGraph(factor) {
        state.graph.zoom = Math.max(0.2, Math.min(3, state.graph.zoom * factor));
        updateGraphTransform();
    }

    function updateGraphTransform() {
        const g = elements.graphSvg.querySelector('g');
        if (g) {
            g.setAttribute('transform',
                `translate(${state.graph.panX}, ${state.graph.panY}) scale(${state.graph.zoom})`);
        }
    }

    function setupGraphPanning() {
        const container = elements.graphContainer;

        container.onmousedown = (e) => {
            // If clicking on a node, start node dragging
            const nodeGroup = e.target.closest('.graph-node');
            if (nodeGroup) {
                const nodeId = nodeGroup.dataset.nodeId;
                if (nodeId) {
                    state.graph.draggingNode = nodeId;
                    // Get the node's current position
                    const rect = nodeGroup.querySelector('rect');
                    const nodeX = parseFloat(rect.getAttribute('x')) + 50; // center of node (width/2)
                    const nodeY = parseFloat(rect.getAttribute('y')) + 15; // center of node (height/2)
                    // Calculate mouse position in graph space
                    const mouseX = (e.clientX - state.graph.panX) / state.graph.zoom;
                    const mouseY = (e.clientY - state.graph.panY) / state.graph.zoom;
                    // Store offset from mouse to node center
                    state.graph.dragOffsetX = nodeX - mouseX;
                    state.graph.dragOffsetY = nodeY - mouseY;
                    nodeGroup.classList.add('dragging');
                    e.preventDefault();
                    return;
                }
            }
            // Otherwise, start panning
            state.graph.isPanning = true;
            state.graph.startPanX = e.clientX - state.graph.panX;
            state.graph.startPanY = e.clientY - state.graph.panY;
        };

        container.onmousemove = (e) => {
            // Handle node dragging
            if (state.graph.draggingNode) {
                const nodeId = state.graph.draggingNode;
                // Calculate new position in graph coordinate space, applying the offset
                const mouseX = (e.clientX - state.graph.panX) / state.graph.zoom;
                const mouseY = (e.clientY - state.graph.panY) / state.graph.zoom;
                const newX = mouseX + state.graph.dragOffsetX;
                const newY = mouseY + state.graph.dragOffsetY;

                // Update stored position
                state.graph.nodePositions[nodeId] = { x: newX, y: newY };

                // Re-render graph with new position
                renderGraph();
                return;
            }

            // Handle panning
            if (!state.graph.isPanning) return;
            state.graph.panX = e.clientX - state.graph.startPanX;
            state.graph.panY = e.clientY - state.graph.startPanY;
            updateGraphTransform();
        };

        container.onmouseup = () => {
            if (state.graph.draggingNode) {
                const nodeGroup = elements.graphSvg.querySelector(`[data-node-id="${state.graph.draggingNode}"]`);
                if (nodeGroup) nodeGroup.classList.remove('dragging');
                state.graph.draggingNode = null;
            }
            state.graph.isPanning = false;
        };

        container.onmouseleave = () => {
            if (state.graph.draggingNode) {
                const nodeGroup = elements.graphSvg.querySelector(`[data-node-id="${state.graph.draggingNode}"]`);
                if (nodeGroup) nodeGroup.classList.remove('dragging');
                state.graph.draggingNode = null;
            }
            state.graph.isPanning = false;
        };

        // Mouse wheel zoom
        container.onwheel = (e) => {
            e.preventDefault();
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            zoomGraph(factor);
        };
    }

    function renderGraph() {
        const svg = elements.graphSvg;
        const container = elements.graphContainer;
        const width = container.clientWidth;
        const height = container.clientHeight;

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.innerHTML = '';

        // Collect all nodes and edges
        const nodes = {};
        const edges = [];
        const missingTargets = new Set();

        // Special targets that are handled by the engine (not actual scenes)
        const specialTargets = new Set(['_roll']);

        // Build node list from existing scenes
        Object.keys(state.scenes).forEach(id => {
            const scene = state.scenes[id];
            nodes[id] = {
                id,
                exists: true,
                hasFlags: scene.require_flags && scene.require_flags.length > 0
            };
        });

        // Build edges and find missing targets
        Object.values(state.scenes).forEach(scene => {
            if (scene.choices) {
                scene.choices.forEach(choice => {
                    if (choice.target && !specialTargets.has(choice.target)) {
                        edges.push({ from: scene.id, to: choice.target, type: 'choice' });
                        if (!nodes[choice.target]) {
                            missingTargets.add(choice.target);
                        }
                    }
                });
            }
            if (scene.actions) {
                scene.actions.forEach(action => {
                    if (action.success_target && !specialTargets.has(action.success_target)) {
                        edges.push({ from: scene.id, to: action.success_target, type: 'success' });
                        if (!nodes[action.success_target]) {
                            missingTargets.add(action.success_target);
                        }
                    }
                    if (action.failure_target && !specialTargets.has(action.failure_target)) {
                        edges.push({ from: scene.id, to: action.failure_target, type: 'failure' });
                        if (!nodes[action.failure_target]) {
                            missingTargets.add(action.failure_target);
                        }
                    }
                });
            }
        });

        // Add missing targets as nodes
        missingTargets.forEach(id => {
            nodes[id] = { id, exists: false, hasFlags: false };
        });

        // Find start scene (no incoming edges) and ending scenes (no outgoing edges)
        const hasIncoming = new Set(edges.map(e => e.to));
        const hasOutgoing = new Set(edges.map(e => e.from));

        Object.values(nodes).forEach(node => {
            if (node.exists) {
                if (!hasIncoming.has(node.id)) node.isStart = true;
                if (!hasOutgoing.has(node.id)) node.isEnding = true;
            }
        });

        // Layout: simple layered layout
        const nodeList = Object.values(nodes);
        const positions = layoutGraph(nodeList, edges, width, height);

        // Apply any custom positions from dragging
        Object.keys(state.graph.nodePositions).forEach(nodeId => {
            if (positions[nodeId]) {
                positions[nodeId] = { ...state.graph.nodePositions[nodeId] };
            }
        });

        // Create main group for transformations
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        // Draw edges first (behind nodes)
        edges.forEach(edge => {
            const fromPos = positions[edge.from];
            const toPos = positions[edge.to];
            if (!fromPos || !toPos) return;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = createEdgePath(fromPos, toPos);
            path.setAttribute('d', d);
            path.classList.add('graph-edge', edge.type);
            g.appendChild(path);

            // Add arrowhead
            const arrow = createArrowhead(fromPos, toPos, edge.type);
            g.appendChild(arrow);
        });

        // Draw nodes
        const nodeWidth = 100;
        const nodeHeight = 30;

        nodeList.forEach(node => {
            const pos = positions[node.id];
            if (!pos) return;

            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.classList.add('graph-node');
            group.dataset.nodeId = node.id;  // For drag handling
            if (!node.exists) group.classList.add('missing');
            if (node.isStart) group.classList.add('start');
            if (node.isEnding) group.classList.add('ending');
            if (node.hasFlags) group.classList.add('has-flags');
            if (node.id === state.currentSceneId) group.classList.add('current');
            if (state.graph.draggingNode === node.id) group.classList.add('dragging');

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', pos.x - nodeWidth / 2);
            rect.setAttribute('y', pos.y - nodeHeight / 2);
            rect.setAttribute('width', nodeWidth);
            rect.setAttribute('height', nodeHeight);
            group.appendChild(rect);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', pos.x);
            text.setAttribute('y', pos.y);
            // Truncate long names
            const displayName = node.id.length > 14 ? node.id.substring(0, 12) + '...' : node.id;
            text.textContent = displayName;
            group.appendChild(text);

            // Click to navigate
            group.addEventListener('click', () => {
                if (node.exists) {
                    hideGraphModal();
                    loadScene(node.id);
                } else {
                    if (confirm(`Scene "${node.id}" doesn't exist. Create it?`)) {
                        hideGraphModal();
                        createSceneWithId(node.id);
                    }
                }
            });

            // Right-click for context menu
            group.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showGraphContextMenu(e, node);
            });

            group.setAttribute('title', node.id);
            g.appendChild(group);
        });

        svg.appendChild(g);
        updateGraphTransform();
    }

    function layoutGraph(nodes, edges, width, height) {
        const positions = {};

        // Build adjacency for topological sort
        const outgoing = {};
        const incoming = {};
        nodes.forEach(n => {
            outgoing[n.id] = [];
            incoming[n.id] = [];
        });
        edges.forEach(e => {
            if (outgoing[e.from]) outgoing[e.from].push(e.to);
            if (incoming[e.to]) incoming[e.to].push(e.from);
        });

        // Find layers using BFS from start nodes
        const layers = [];
        const assigned = new Set();

        // Start nodes (no incoming)
        let currentLayer = nodes.filter(n => incoming[n.id].length === 0).map(n => n.id);
        if (currentLayer.length === 0) {
            // No clear start, pick first
            currentLayer = nodes.length > 0 ? [nodes[0].id] : [];
        }

        while (currentLayer.length > 0) {
            layers.push(currentLayer);
            currentLayer.forEach(id => assigned.add(id));

            const nextLayer = [];
            currentLayer.forEach(id => {
                outgoing[id].forEach(targetId => {
                    if (!assigned.has(targetId) && !nextLayer.includes(targetId)) {
                        // Check if all incoming are assigned
                        const allIncomingAssigned = incoming[targetId].every(src => assigned.has(src));
                        if (allIncomingAssigned) {
                            nextLayer.push(targetId);
                        }
                    }
                });
            });

            // Handle cycles - add remaining unassigned nodes
            if (nextLayer.length === 0) {
                const remaining = nodes.filter(n => !assigned.has(n.id));
                if (remaining.length > 0) {
                    nextLayer.push(remaining[0].id);
                }
            }

            currentLayer = nextLayer;
        }

        // Position nodes - more spacing for readability
        const layerGap = 200;
        const nodeGap = 60;
        const startX = 120;
        const startY = height / 2;

        layers.forEach((layer, layerIndex) => {
            const layerHeight = layer.length * nodeGap;
            const layerStartY = startY - layerHeight / 2 + nodeGap / 2;

            layer.forEach((nodeId, nodeIndex) => {
                positions[nodeId] = {
                    x: startX + layerIndex * layerGap,
                    y: layerStartY + nodeIndex * nodeGap
                };
            });
        });

        return positions;
    }

    function createEdgePath(from, to) {
        const nodeWidth = 100;
        const nodeHeight = 30;

        // Start from right edge of from node
        const startX = from.x + nodeWidth / 2;
        const startY = from.y;

        // End at left edge of to node
        const endX = to.x - nodeWidth / 2;
        const endY = to.y;

        // Create curved path
        const midX = (startX + endX) / 2;

        return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
    }

    function createArrowhead(from, to, type) {
        const nodeWidth = 100;
        const endX = to.x - nodeWidth / 2;
        const endY = to.y;

        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const size = 6;

        // Arrow pointing left
        arrow.setAttribute('points',
            `${endX},${endY} ${endX + size},${endY - size/2} ${endX + size},${endY + size/2}`);
        arrow.classList.add('graph-edge-arrow', type);

        return arrow;
    }

    // === Graph Context Menu ===
    function showGraphContextMenu(e, node) {
        state.graph.contextMenuNode = node;

        const menu = elements.graphContextMenu;
        menu.classList.remove('hidden');

        // Position menu at click location
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';

        // Adjust if menu would go off screen
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = (e.clientX - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = (e.clientY - rect.height) + 'px';
        }

        // Disable options for missing nodes
        elements.ctxEditScene.disabled = !node.exists;
        elements.ctxRenameScene.disabled = !node.exists;
        elements.ctxDeleteScene.disabled = !node.exists;
    }

    function hideContextMenu() {
        elements.graphContextMenu.classList.add('hidden');
        state.graph.contextMenuNode = null;
    }

    function ctxEditScene() {
        const node = state.graph.contextMenuNode;
        if (!node || !node.exists) return;

        hideContextMenu();
        hideGraphModal();
        loadScene(node.id);
    }

    function ctxRenameScene() {
        const node = state.graph.contextMenuNode;
        if (!node || !node.exists) return;

        const newId = prompt(`Rename scene "${node.id}" to:`, node.id);
        if (!newId || newId === node.id) {
            hideContextMenu();
            return;
        }

        const cleanId = newId.trim().toLowerCase().replace(/\s+/g, '_');

        // Check for conflicts
        if (state.scenes[cleanId]) {
            alert(`A scene with ID "${cleanId}" already exists.`);
            hideContextMenu();
            return;
        }

        // Rename the scene
        const scene = state.scenes[node.id];
        delete state.scenes[node.id];
        scene.id = cleanId;
        state.scenes[cleanId] = scene;

        // Update references in other scenes
        Object.values(state.scenes).forEach(s => {
            if (s.choices) {
                s.choices.forEach(choice => {
                    if (choice.target === node.id) {
                        choice.target = cleanId;
                    }
                });
            }
            if (s.actions) {
                s.actions.forEach(action => {
                    if (action.success_target === node.id) {
                        action.success_target = cleanId;
                    }
                    if (action.failure_target === node.id) {
                        action.failure_target = cleanId;
                    }
                });
            }
        });

        // Update current scene if needed
        if (state.currentSceneId === node.id) {
            state.currentSceneId = cleanId;
            elements.sceneId.value = cleanId;
            elements.currentSceneName.textContent = cleanId;
        }

        saveSenesToStorage();
        renderSceneList();
        renderGraph();
        hideContextMenu();
    }

    function ctxViewFlags() {
        const node = state.graph.contextMenuNode;
        if (!node) {
            hideContextMenu();
            return;
        }

        const scene = state.scenes[node.id];
        let message = `Flags for "${node.id}":\n\n`;

        if (!scene) {
            message += '(Scene does not exist yet)';
        } else {
            // Required flags
            if (scene.require_flags && scene.require_flags.length > 0) {
                message += `Requires:\n  • ${scene.require_flags.join('\n  • ')}\n\n`;
            } else {
                message += 'Requires: (none)\n\n';
            }

            // Set flags
            if (scene.set_flags && scene.set_flags.length > 0) {
                message += `Sets:\n  • ${scene.set_flags.join('\n  • ')}`;
            } else {
                message += 'Sets: (none)';
            }
        }

        alert(message);
        hideContextMenu();
    }

    function ctxDeleteScene() {
        const node = state.graph.contextMenuNode;
        if (!node || !node.exists) return;

        // Check for incoming references
        const incoming = findIncomingScenes(node.id);
        let message = `Are you sure you want to delete "${node.id}"?`;

        if (incoming.length > 0) {
            const refs = incoming.map(r => r.from).join(', ');
            message += `\n\nWarning: This scene is referenced by: ${refs}`;
        }

        if (!confirm(message)) {
            hideContextMenu();
            return;
        }

        // Delete the scene
        delete state.scenes[node.id];

        // If this was the current scene, clear editor
        if (state.currentSceneId === node.id) {
            state.currentSceneId = null;
            elements.sceneId.value = '';
            elements.currentSceneName.textContent = 'No scene selected';
            elements.previewSprites.innerHTML = '';
            elements.saveBtn.disabled = true;
            elements.deleteSceneBtn.disabled = true;
            clearNodeConnections();
        }

        saveSenesToStorage();
        renderSceneList();
        renderGraph();
        hideContextMenu();
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
            const spriteData = {
                file: sprite.dataset.file,
                x: parseFloat(sprite.dataset.x),
                y: parseFloat(sprite.dataset.y)
            };
            const scale = parseFloat(sprite.dataset.scale);
            if (scale && scale !== 1) {
                spriteData.scale = scale;
            }
            sprites.push(spriteData);
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
        updateNodeConnections(scene);

        console.log('Scene saved:', scene);
    }

    function downloadCurrentScene() {
        if (!state.currentSceneId) {
            alert('No scene selected to download.');
            return;
        }

        // Validate scene ID first
        const sceneIdValue = elements.sceneId.value.trim().toLowerCase().replace(/\s+/g, '_');
        if (!sceneIdValue) {
            alert('Scene ID is required before downloading.');
            elements.sceneId.focus();
            return;
        }

        // Save first
        saveCurrentScene();

        const scene = state.scenes[state.currentSceneId];
        if (!scene) {
            alert('Scene could not be saved. Please check your scene data.');
            return;
        }

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
                    // New format with position and optional scale
                    md += `  - file: ${char.file}\n`;
                    md += `    x: ${Math.round(char.x)}\n`;
                    md += `    y: ${Math.round(char.y)}\n`;
                    if (char.scale && char.scale !== 1) {
                        md += `    scale: ${char.scale.toFixed(2)}\n`;
                    }
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
        elements.choicesContainer.innerHTML = '';
        elements.setFlagsContainer.innerHTML = '';
        elements.requireFlagsContainer.innerHTML = '';
        elements.actionsContainer.innerHTML = '';
        elements.incomingScenes.innerHTML = '<span class="placeholder">Save scene to see references</span>';

        // Clear text editor
        state.textBlocks = [''];
        state.currentTextBlockIndex = 0;
        elements.previewTextarea.value = '';
        elements.textBlockIndicator.textContent = 'Block 1 / 1';
        elements.textPrevBtn.disabled = true;
        elements.textNextBtn.disabled = true;
        elements.textDeleteBtn.disabled = true;

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

        // Arrow keys for text block navigation (only when not in textarea)
        if (document.activeElement !== elements.previewTextarea) {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                navigateTextBlock(-1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                navigateTextBlock(1);
            }
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
