/**
 * Andi VN - Scene Editor
 *
 * A visual editor for creating and editing VN scenes.
 * Generates .md files compatible with build_story_from_md.py
 *
 * Dependencies (loaded via script tags):
 * - EditorConfig: Shared configuration (assets, paths, defaults)
 * - EditorStorage: Shared localStorage operations
 * - GraphModule: Shared graph logic
 */

const Editor = (function() {
    'use strict';

    // Get shared modules (loaded via script tags)
    const SharedConfig = window.EditorConfig || {};
    const Storage = window.EditorStorage;
    const { SPECIAL_TARGETS, ChainCompressor } = window.GraphModule || {};

    // === Configuration ===
    // Merge shared config with editor-specific settings
    const config = {
        // Use shared config values
        assetPaths: SharedConfig.assetPaths || {
            bg: '../assets/bg/',
            char: '../assets/char/',
            music: '../assets/music/',
            sfx: '../assets/sfx/'
        },
        sprite: SharedConfig.sprite || {
            defaultX: 50,
            defaultY: 50,
            defaultScale: 1,
            minX: 5,
            maxX: 95,
            minY: 5,
            maxY: 65,
            ySnapPositions: [10, 25, 45, 65],
            ySnapThresholds: [15, 35, 55],
            scaleDragFactor: 100,
            spacing: 25
        },
        graph: SharedConfig.graph || {
            nodeWidth: 180,
            nodeHeight: 80,
            defaultZoom: 1,
            zoomStep: 1.2
        },
        dice: SharedConfig.dice || {
            defaultType: 'd20',
            defaultThreshold: 10,
            maxThreshold: 100
        },
        assets: SharedConfig.assets || {
            backgrounds: [],
            sprites: [],
            music: [],
            sfx: []
        },
        // Editor-specific UI timing
        autocompleteDelay: (SharedConfig.ui && SharedConfig.ui.autocompleteDelay) || 150,
        maxAutocompleteItems: (SharedConfig.ui && SharedConfig.ui.maxAutocompleteItems) || 10
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
        // File System Access API
        scenesDirectoryHandle: null, // Handle to scenes folder for saving .md files
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
            nodePositions: {},  // Custom positions keyed by node ID
            expandedChains: new Set(),  // Chain IDs that are expanded
            compressChains: true  // Whether to compress linear chains
        }
    };

    // === Logging Utilities ===
    // Standardized logging with consistent prefixes
    const log = {
        info: function(msg) {
            console.log('Editor: ' + msg);
        },
        warn: function(msg) {
            console.warn('Editor: ' + msg);
        },
        error: function(msg) {
            console.error('Editor: ' + msg);
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
        initThemeSelector();

        // Auto-load scenes on startup
        autoLoadScenes();
    }

    /**
     * Initialize theme selector dropdown
     * Note: Theme CSS is NOT loaded in the editor - it would override editor styles.
     * The selector only saves the preference to localStorage for the game to use.
     */
    function initThemeSelector() {
        const select = elements.themeSelect;
        if (!select) return;

        // Get available themes from themeConfig (loaded from theme.js)
        const themes = (typeof themeConfig !== 'undefined' && themeConfig.available)
            ? themeConfig.available
            : ['prototype'];

        // Populate options
        themes.forEach(theme => {
            const option = document.createElement('option');
            option.value = theme;
            option.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
            select.appendChild(option);
        });

        // Set current theme from localStorage or themeConfig
        const currentTheme = getCurrentTheme();
        select.value = currentTheme;

        // Handle theme change - only saves to localStorage for the game
        select.addEventListener('change', () => {
            setTheme(select.value);
        });
    }

    /**
     * Get the current theme from localStorage or themeConfig
     */
    function getCurrentTheme() {
        const savedTheme = localStorage.getItem('andi_vn_theme');
        if (savedTheme && typeof themeConfig !== 'undefined' &&
            themeConfig.available && themeConfig.available.includes(savedTheme)) {
            return savedTheme;
        }
        return (typeof themeConfig !== 'undefined') ? themeConfig.selected : 'prototype';
    }

    /**
     * Set the theme - updates editor via body class and saves to localStorage for the game
     */
    function setTheme(themeName) {
        // Remove all existing theme classes from body
        const body = document.body;
        const themeClasses = Array.from(body.classList).filter(c => c.startsWith('theme-'));
        themeClasses.forEach(c => body.classList.remove(c));

        // Add new theme class
        body.classList.add('theme-' + themeName);

        // Save to localStorage so the game uses the same theme
        localStorage.setItem('andi_vn_theme', themeName);
        log.info('Theme changed to: ' + themeName);
    }

    async function autoLoadScenes() {
        // Use shared EditorStorage for loading (same fallback chain as node editor)
        if (Storage) {
            const scenes = await Storage.autoLoad();
            if (scenes) {
                state.scenes = scenes;
                log.info('Loaded ' + Object.keys(scenes).length + ' scenes via EditorStorage');
                renderSceneList();
                restoreCurrentScene();
                return;
            }
        }

        // Fallback if EditorStorage not available
        log.warn('EditorStorage not available, using legacy loading');

        // Try localStorage directly
        try {
            const saved = localStorage.getItem('andi_editor_scenes');
            if (saved) {
                const savedScenes = JSON.parse(saved);
                if (Object.keys(savedScenes).length > 0) {
                    state.scenes = savedScenes;
                    log.info('Loaded ' + Object.keys(savedScenes).length + ' scenes from localStorage');
                    renderSceneList();
                    restoreCurrentScene();
                    return;
                }
            }
        } catch (e) {
            log.warn('Could not load from localStorage: ' + e.message);
        }

        // Try global story object
        if (typeof story !== 'undefined' && story) {
            state.scenes = { ...story };
            log.info('Auto-loaded ' + Object.keys(story).length + ' scenes from global story object');
            renderSceneList();
            saveScenesToStorage();
            restoreCurrentScene();
        }
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
            exportAllBtn: document.getElementById('export-all-btn'),
            themeSelect: document.getElementById('theme-select'),
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

            // Items
            addItemsContainer: document.getElementById('add-items-container'),
            removeItemsContainer: document.getElementById('remove-items-container'),
            newAddItem: document.getElementById('new-add-item'),
            newRemoveItem: document.getElementById('new-remove-item'),
            addAddItemBtn: document.getElementById('add-add-item-btn'),
            addRemoveItemBtn: document.getElementById('add-remove-item-btn'),

            // Actions
            actionsContainer: document.getElementById('actions-container'),
            addActionBtn: document.getElementById('add-action-btn'),
            addBattleBtn: document.getElementById('add-battle-btn'),

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
            graphExportPng: document.getElementById('graph-export-png'),
            graphFullEditor: document.getElementById('graph-full-editor'),

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
        elements.exportAllBtn.addEventListener('click', exportAllScenes);
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

        // Items
        elements.addAddItemBtn.addEventListener('click', () => addItem('add'));
        elements.addRemoveItemBtn.addEventListener('click', () => addItem('remove'));
        elements.newAddItem.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addItem('add');
        });
        elements.newRemoveItem.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addItem('remove');
        });

        // Actions
        elements.addActionBtn.addEventListener('click', addAction);
        elements.addBattleBtn.addEventListener('click', addBattle);

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
        elements.graphExportPng.addEventListener('click', exportGraphAsPng);
        if (elements.graphFullEditor) {
            elements.graphFullEditor.addEventListener('click', openFullGraphEditor);
        } else {
            console.error('graphFullEditor element not found');
        }
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

                // Snap Y to preset positions based on drop zone
                const thresholds = config.sprite.ySnapThresholds;
                const positions = config.sprite.ySnapPositions;
                let y = positions[positions.length - 1]; // default to lowest
                for (let i = 0; i < thresholds.length; i++) {
                    if (yRaw < thresholds[i]) {
                        y = positions[i];
                        break;
                    }
                }

                // Clamp X to reasonable bounds
                x = Math.max(config.sprite.minX, Math.min(config.sprite.maxX, x));

                addSpriteToCanvas(spriteFile, x, y);
            }
        });

        // Drag sprites on canvas
        elements.previewSprites.addEventListener('mousedown', onSpriteMouseDown);
        document.addEventListener('mousemove', onSpriteMouseMove);
        document.addEventListener('mouseup', onSpriteMouseUp);
    }

    function addSpriteToCanvas(spriteFile, x, y, scale, autoSelect) {
        // Use config defaults if not provided
        x = x !== undefined ? x : config.sprite.defaultX;
        y = y !== undefined ? y : config.sprite.defaultY;
        scale = scale !== undefined ? scale : config.sprite.defaultScale;
        autoSelect = autoSelect !== undefined ? autoSelect : true;
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

            // Clamp to bounds
            x = Math.max(config.sprite.minX, Math.min(config.sprite.maxX, x));
            y = Math.max(config.sprite.minY, Math.min(config.sprite.maxY, y));

            state.draggedSprite.style.left = x + '%';
            state.draggedSprite.style.top = y + '%';
            state.draggedSprite.dataset.x = x;
            state.draggedSprite.dataset.y = y;
        }

        if (state.resizingSprite && state.initialResizeData) {
            // Resizing sprite - drag up to grow, drag down to shrink
            const deltaY = state.initialResizeData.startY - e.clientY;
            const scaleFactor = deltaY / config.sprite.scaleDragFactor;
            let newScale = state.initialResizeData.startScale + scaleFactor;

            // Clamp scale between 0.2 and 3
            newScale = Math.max(0.2, Math.min(3, newScale));

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
            add_items: [],
            remove_items: [],
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

        // Save current scene ID so it persists on refresh
        if (Storage) {
            Storage.setCurrentScene(sceneId);
        }

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
                    const x = config.sprite.defaultX + (index - (scene.chars.length - 1) / 2) * config.sprite.spacing;
                    addSpriteToCanvas(char, x, config.sprite.defaultY, config.sprite.defaultScale, false);
                } else {
                    // New format with position and optional scale
                    addSpriteToCanvas(char.file, char.x || config.sprite.defaultX, char.y || config.sprite.defaultY, char.scale || config.sprite.defaultScale, false);
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

        // Items
        renderItems('add', scene.add_items || []);
        renderItems('remove', scene.remove_items || []);

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

        // SFX dropdown
        const sfxGroup = document.createElement('label');
        sfxGroup.textContent = 'Sound effect';
        const sfxSelect = document.createElement('select');
        sfxSelect.className = 'choice-sfx';

        // Add "None" option
        const noneOption = document.createElement('option');
        noneOption.value = '';
        noneOption.textContent = '(none)';
        sfxSelect.appendChild(noneOption);

        // Add all SFX options
        config.assets.sfx.forEach(sfxFile => {
            const option = document.createElement('option');
            option.value = sfxFile;
            option.textContent = sfxFile.replace('.ogg', '');
            sfxSelect.appendChild(option);
        });

        sfxSelect.value = choice && choice.sfx ? choice.sfx : '';
        sfxSelect.addEventListener('change', onSceneModified);
        sfxGroup.appendChild(sfxSelect);

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
        inputs.appendChild(sfxGroup);
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
            const sfx = item.querySelector('.choice-sfx').value;
            const requireStr = item.querySelector('.choice-require').value.trim();
            const setsStr = item.querySelector('.choice-sets').value.trim();

            if (label && target) {
                const choice = {
                    label: label,
                    target: target,
                    sfx: sfx || null,
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
            setTimeout(() => hideAutocomplete(), config.autocompleteDelay);
        });

        function showAutocomplete(input) {
            hideAutocomplete();

            const value = input.value.toLowerCase();
            const matches = Object.keys(state.scenes)
                .filter(id => id.toLowerCase().includes(value) && id !== state.currentSceneId)
                .slice(0, config.maxAutocompleteItems);

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

    function addFlagTag(container, flag) {
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

    // === Items ===
    function renderItems(type, items) {
        const container = type === 'add' ? elements.addItemsContainer : elements.removeItemsContainer;
        container.innerHTML = '';

        items.forEach(item => {
            addItemTag(container, item);
        });
    }

    function addItemTag(container, item) {
        const tag = document.createElement('span');
        tag.className = 'flag-tag item-tag';
        tag.textContent = item;

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => {
            tag.remove();
            onSceneModified();
        });

        tag.appendChild(removeBtn);
        container.appendChild(tag);
    }

    function addItem(type) {
        const input = type === 'add' ? elements.newAddItem : elements.newRemoveItem;
        const container = type === 'add' ? elements.addItemsContainer : elements.removeItemsContainer;

        const item = input.value.trim();
        if (item) {
            addItemTag(container, item);
            input.value = '';
            onSceneModified();
        }
    }

    function getItemsFromEditor(type) {
        const container = type === 'add' ? elements.addItemsContainer : elements.removeItemsContainer;
        const items = [];
        container.querySelectorAll('.flag-tag').forEach(tag => {
            // Get text content without the × button
            const text = tag.firstChild.textContent.trim();
            if (text) items.push(text);
        });
        return items;
    }

    // === Actions ===
    function renderActions(actions) {
        elements.actionsContainer.innerHTML = '';
        actions.forEach((action) => {
            if (action.type === 'roll_dice') {
                addActionElement(action);
            } else if (action.type === 'start_battle') {
                addBattleElement(action);
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

        // Modifier (advantage/disadvantage)
        const modifierLabel = document.createElement('label');
        modifierLabel.textContent = 'Modifier';
        const modifierSelect = document.createElement('select');
        modifierSelect.className = 'action-modifier';
        [
            { value: '', text: 'None' },
            { value: 'advantage', text: 'Advantage (2d20 high)' },
            { value: 'disadvantage', text: 'Disadvantage (2d20 low)' }
        ].forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            modifierSelect.appendChild(option);
        });
        modifierSelect.value = action && action.modifier ? action.modifier : '';
        modifierSelect.addEventListener('change', onSceneModified);
        modifierLabel.appendChild(modifierSelect);

        // Skill name (optional)
        const skillLabel = document.createElement('label');
        skillLabel.textContent = 'Skill';
        const skillInput = document.createElement('input');
        skillInput.type = 'text';
        skillInput.className = 'action-skill';
        skillInput.value = action && action.skill ? action.skill : '';
        skillInput.placeholder = 'e.g. Stealth';
        skillInput.addEventListener('input', onSceneModified);
        skillLabel.appendChild(skillInput);

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

        // Crit text (optional)
        const critLabel = document.createElement('label');
        critLabel.textContent = 'Crit (nat 20)';
        const critInput = document.createElement('input');
        critInput.type = 'text';
        critInput.className = 'action-crit';
        critInput.value = action && action.crit_text ? action.crit_text : '';
        critInput.placeholder = 'Special message on nat 20';
        critInput.addEventListener('input', onSceneModified);
        critLabel.appendChild(critInput);

        // Fumble text (optional)
        const fumbleLabel = document.createElement('label');
        fumbleLabel.textContent = 'Fumble (nat 1)';
        const fumbleInput = document.createElement('input');
        fumbleInput.type = 'text';
        fumbleInput.className = 'action-fumble';
        fumbleInput.value = action && action.fumble_text ? action.fumble_text : '';
        fumbleInput.placeholder = 'Special message on nat 1';
        fumbleInput.addEventListener('input', onSceneModified);
        fumbleLabel.appendChild(fumbleInput);

        inputs.appendChild(diceLabel);
        inputs.appendChild(thresholdLabel);
        inputs.appendChild(modifierLabel);
        inputs.appendChild(skillLabel);
        inputs.appendChild(successLabel);
        inputs.appendChild(failureLabel);
        inputs.appendChild(critLabel);
        inputs.appendChild(fumbleLabel);

        actionDiv.appendChild(header);
        actionDiv.appendChild(inputs);
        elements.actionsContainer.appendChild(actionDiv);
    }

    function addAction() {
        addActionElement();
        onSceneModified();
    }

    function addBattleElement(action = null) {
        const actionDiv = document.createElement('div');
        actionDiv.className = 'action-item battle-item';

        const header = document.createElement('div');
        header.className = 'action-item-header';

        const label = document.createElement('span');
        label.textContent = '⚔️ Battle';

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
        inputs.className = 'action-inputs battle-inputs';

        // Enemy name
        const enemyNameLabel = document.createElement('label');
        enemyNameLabel.textContent = 'Enemy Name';
        const enemyNameInput = document.createElement('input');
        enemyNameInput.type = 'text';
        enemyNameInput.className = 'battle-enemy-name';
        enemyNameInput.value = action && action.enemy_name ? action.enemy_name : '';
        enemyNameInput.placeholder = 'e.g. Agnes';
        enemyNameInput.addEventListener('input', onSceneModified);
        enemyNameLabel.appendChild(enemyNameInput);

        // Enemy HP
        const enemyHPLabel = document.createElement('label');
        enemyHPLabel.textContent = 'Enemy HP';
        const enemyHPInput = document.createElement('input');
        enemyHPInput.type = 'number';
        enemyHPInput.className = 'battle-enemy-hp';
        enemyHPInput.min = 1;
        enemyHPInput.value = action && action.enemy_hp ? action.enemy_hp : 20;
        enemyHPInput.addEventListener('input', onSceneModified);
        enemyHPLabel.appendChild(enemyHPInput);

        // Enemy Attack
        const enemyAtkLabel = document.createElement('label');
        enemyAtkLabel.textContent = 'Enemy Atk';
        const enemyAtkInput = document.createElement('input');
        enemyAtkInput.type = 'number';
        enemyAtkInput.className = 'battle-enemy-attack';
        enemyAtkInput.value = action && action.enemy_attack ? action.enemy_attack : 4;
        enemyAtkInput.addEventListener('input', onSceneModified);
        enemyAtkLabel.appendChild(enemyAtkInput);

        // Enemy Defense
        const enemyDefLabel = document.createElement('label');
        enemyDefLabel.textContent = 'Enemy Def';
        const enemyDefInput = document.createElement('input');
        enemyDefInput.type = 'number';
        enemyDefInput.className = 'battle-enemy-defense';
        enemyDefInput.value = action && action.enemy_defense ? action.enemy_defense : 10;
        enemyDefInput.addEventListener('input', onSceneModified);
        enemyDefLabel.appendChild(enemyDefInput);

        // Player Attack
        const playerAtkLabel = document.createElement('label');
        playerAtkLabel.textContent = 'Player Atk';
        const playerAtkInput = document.createElement('input');
        playerAtkInput.type = 'number';
        playerAtkInput.className = 'battle-player-attack';
        playerAtkInput.value = action && action.player_attack ? action.player_attack : 4;
        playerAtkInput.addEventListener('input', onSceneModified);
        playerAtkLabel.appendChild(playerAtkInput);

        // Player Defense
        const playerDefLabel = document.createElement('label');
        playerDefLabel.textContent = 'Player Def';
        const playerDefInput = document.createElement('input');
        playerDefInput.type = 'number';
        playerDefInput.className = 'battle-player-defense';
        playerDefInput.value = action && action.player_defense ? action.player_defense : 10;
        playerDefInput.addEventListener('input', onSceneModified);
        playerDefLabel.appendChild(playerDefInput);

        // Victory target
        const victoryLabel = document.createElement('label');
        victoryLabel.textContent = 'On victory →';
        const victoryInput = document.createElement('input');
        victoryInput.type = 'text';
        victoryInput.className = 'battle-victory';
        victoryInput.value = action && action.victory_target ? action.victory_target : '';
        victoryInput.placeholder = 'victory_scene_id';
        victoryInput.addEventListener('input', onSceneModified);
        setupAutocomplete(victoryInput);
        victoryLabel.appendChild(victoryInput);

        // Defeat target
        const defeatLabel = document.createElement('label');
        defeatLabel.textContent = 'On defeat →';
        const defeatInput = document.createElement('input');
        defeatInput.type = 'text';
        defeatInput.className = 'battle-defeat';
        defeatInput.value = action && action.defeat_target ? action.defeat_target : '';
        defeatInput.placeholder = 'defeat_scene_id';
        defeatInput.addEventListener('input', onSceneModified);
        setupAutocomplete(defeatInput);
        defeatLabel.appendChild(defeatInput);

        // Flee target
        const fleeLabel = document.createElement('label');
        fleeLabel.textContent = 'On flee →';
        const fleeInput = document.createElement('input');
        fleeInput.type = 'text';
        fleeInput.className = 'battle-flee';
        fleeInput.value = action && action.flee_target ? action.flee_target : '';
        fleeInput.placeholder = 'flee_scene_id';
        fleeInput.addEventListener('input', onSceneModified);
        setupAutocomplete(fleeInput);
        fleeLabel.appendChild(fleeInput);

        inputs.appendChild(enemyNameLabel);
        inputs.appendChild(enemyHPLabel);
        inputs.appendChild(enemyAtkLabel);
        inputs.appendChild(enemyDefLabel);
        inputs.appendChild(playerAtkLabel);
        inputs.appendChild(playerDefLabel);
        inputs.appendChild(victoryLabel);
        inputs.appendChild(defeatLabel);
        inputs.appendChild(fleeLabel);

        actionDiv.appendChild(header);
        actionDiv.appendChild(inputs);
        elements.actionsContainer.appendChild(actionDiv);
    }

    function addBattle() {
        addBattleElement();
        onSceneModified();
    }

    function getActionsFromEditor() {
        const actions = [];

        // Collect dice roll actions
        elements.actionsContainer.querySelectorAll('.action-item:not(.battle-item)').forEach(item => {
            const dice = item.querySelector('.action-dice')?.value;
            const threshold = parseInt(item.querySelector('.action-threshold')?.value) || 10;
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
        elements.actionsContainer.querySelectorAll('.battle-item').forEach(item => {
            const enemyName = item.querySelector('.battle-enemy-name')?.value.trim();
            const enemyHP = parseInt(item.querySelector('.battle-enemy-hp')?.value) || 20;
            const enemyAttack = parseInt(item.querySelector('.battle-enemy-attack')?.value) || 4;
            const enemyDefense = parseInt(item.querySelector('.battle-enemy-defense')?.value) || 10;
            const playerAttack = parseInt(item.querySelector('.battle-player-attack')?.value) || 4;
            const playerDefense = parseInt(item.querySelector('.battle-player-defense')?.value) || 10;
            const victory = item.querySelector('.battle-victory')?.value.trim();
            const defeat = item.querySelector('.battle-defeat')?.value.trim();
            const flee = item.querySelector('.battle-flee')?.value.trim();

            if (enemyName && victory && defeat) {
                const action = {
                    type: 'start_battle',
                    enemy_name: enemyName,
                    enemy_hp: enemyHP,
                    enemy_max_hp: enemyHP,
                    enemy_attack: enemyAttack,
                    enemy_defense: enemyDefense,
                    player_attack: playerAttack,
                    player_defense: playerDefense,
                    victory_target: victory,
                    defeat_target: defeat
                };
                if (flee) action.flee_target = flee;
                actions.push(action);
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
                <span class="connection-type type-${ref.type}">${ref.type}</span>
            `;
            node.title = `Click to go to ${ref.from}`;
            node.addEventListener('click', () => loadScene(ref.from));
            elements.incomingConnections.appendChild(node);
        });
    }

    function updateOutgoingConnectionsPanel(scene) {
        elements.outgoingConnections.innerHTML = '';

        const outgoing = [];

        // Collect choices (skip self-loops like battle action choices)
        if (scene.choices && scene.choices.length > 0) {
            scene.choices.forEach(choice => {
                if (choice.target && choice.target !== scene.id) {
                    outgoing.push({
                        target: choice.target,
                        type: 'choice',
                        label: choice.text ? choice.text.substring(0, 20) : 'choice'
                    });
                }
            });
        }

        // Collect action targets (dice rolls and battles)
        if (scene.actions && scene.actions.length > 0) {
            scene.actions.forEach(action => {
                // Dice roll targets
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
                // Battle targets
                if (action.win_target) {
                    outgoing.push({
                        target: action.win_target,
                        type: 'success',
                        label: 'battle win'
                    });
                }
                if (action.lose_target) {
                    outgoing.push({
                        target: action.lose_target,
                        type: 'failure',
                        label: 'battle lose'
                    });
                }
                if (action.flee_target) {
                    outgoing.push({
                        target: action.flee_target,
                        type: 'flee',
                        label: 'flee'
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
                <span class="connection-type type-${ref.type}">${ref.type}</span>
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
            add_items: [],
            remove_items: [],
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
        renderGraph();
        resetGraphView(); // Call after renderGraph so nodes exist
        setupGraphPanning();
    }

    function hideGraphModal() {
        elements.graphModal.classList.add('hidden');
    }

    function resetGraphView() {
        // Fit all nodes in view
        const container = elements.graphContainer;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const nodes = elements.graphSvg.querySelectorAll('.graph-node rect');

        if (nodes.length === 0) {
            state.graph.zoom = 1;
            state.graph.panX = 0;
            state.graph.panY = 0;
            updateGraphTransform();
            return;
        }

        // Calculate bounding box of all nodes
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(rect => {
            const x = parseFloat(rect.getAttribute('x'));
            const y = parseFloat(rect.getAttribute('y'));
            const width = parseFloat(rect.getAttribute('width'));
            const height = parseFloat(rect.getAttribute('height'));
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + width);
            maxY = Math.max(maxY, y + height);
        });

        const graphWidth = maxX - minX;
        const graphHeight = maxY - minY;
        const padding = 50;

        // Calculate zoom to fit
        const scaleX = (containerWidth - padding * 2) / graphWidth;
        const scaleY = (containerHeight - padding * 2) / graphHeight;
        state.graph.zoom = Math.min(scaleX, scaleY, 1.5); // Cap at 1.5x zoom
        state.graph.zoom = Math.max(state.graph.zoom, 0.2); // Min 0.2x zoom

        // Center the graph
        const scaledWidth = graphWidth * state.graph.zoom;
        const scaledHeight = graphHeight * state.graph.zoom;
        state.graph.panX = (containerWidth - scaledWidth) / 2 - minX * state.graph.zoom;
        state.graph.panY = (containerHeight - scaledHeight) / 2 - minY * state.graph.zoom;

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

    function openFullGraphEditor() {
        console.log('openFullGraphEditor called');
        // Save current state first
        saveScenesToStorage();
        // Navigate to the full graph editor
        window.location.href = 'node_editor.html';
    }

    function exportGraphAsPng() {
        const svg = elements.graphSvg;
        const g = svg.querySelector('g');
        if (!g) return;

        // Get bounding box of all content
        const nodes = svg.querySelectorAll('.graph-node rect');
        if (nodes.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(rect => {
            const x = parseFloat(rect.getAttribute('x'));
            const y = parseFloat(rect.getAttribute('y'));
            const width = parseFloat(rect.getAttribute('width'));
            const height = parseFloat(rect.getAttribute('height'));
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + width);
            maxY = Math.max(maxY, y + height);
        });

        const padding = 50;
        const exportWidth = maxX - minX + padding * 2;
        const exportHeight = maxY - minY + padding * 2;

        // Get computed styles for inline embedding
        const bgColor = getComputedStyle(elements.graphContainer).backgroundColor || '#1a1a2e';
        const styles = getComputedStyle(document.documentElement);
        const accentColor = styles.getPropertyValue('--accent').trim() || '#4a9eff';
        const successColor = styles.getPropertyValue('--success').trim() || '#4ade80';
        const dangerColor = styles.getPropertyValue('--danger').trim() || '#f87171';
        const warningColor = styles.getPropertyValue('--warning').trim() || '#fbbf24';
        const textColor = styles.getPropertyValue('--text-primary').trim() || '#ffffff';
        const bgTertiary = styles.getPropertyValue('--bg-tertiary').trim() || '#2a2a4a';
        const borderColor = styles.getPropertyValue('--border').trim() || '#444';

        // Clone SVG for export
        const clonedSvg = svg.cloneNode(true);
        clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clonedSvg.setAttribute('width', exportWidth);
        clonedSvg.setAttribute('height', exportHeight);
        clonedSvg.setAttribute('viewBox', `0 0 ${exportWidth} ${exportHeight}`);

        // Reset transform and translate to fit content
        const clonedG = clonedSvg.querySelector('g');
        clonedG.setAttribute('transform', `translate(${-minX + padding}, ${-minY + padding})`);

        // Add background rect
        const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgRect.setAttribute('width', exportWidth);
        bgRect.setAttribute('height', exportHeight);
        bgRect.setAttribute('fill', bgColor);
        clonedSvg.insertBefore(bgRect, clonedG);

        // Apply inline styles to edges
        clonedSvg.querySelectorAll('.graph-edge').forEach(path => {
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke-width', '1.5');
            if (path.classList.contains('choice')) {
                path.setAttribute('stroke', accentColor);
            } else if (path.classList.contains('success')) {
                path.setAttribute('stroke', successColor);
            } else if (path.classList.contains('failure')) {
                path.setAttribute('stroke', dangerColor);
            }
        });

        // Apply inline styles to arrowheads
        clonedSvg.querySelectorAll('.graph-edge-arrow').forEach(arrow => {
            if (arrow.classList.contains('success')) {
                arrow.setAttribute('fill', successColor);
            } else if (arrow.classList.contains('failure')) {
                arrow.setAttribute('fill', dangerColor);
            } else {
                arrow.setAttribute('fill', accentColor);
            }
        });

        // Apply inline styles to nodes
        clonedSvg.querySelectorAll('.graph-node').forEach(node => {
            const rect = node.querySelector('rect');
            const text = node.querySelector('text');

            if (rect) {
                rect.setAttribute('rx', '4');
                rect.setAttribute('stroke-width', '1.5');
                if (node.classList.contains('start')) {
                    rect.setAttribute('fill', accentColor);
                    rect.setAttribute('stroke', accentColor);
                } else if (node.classList.contains('missing')) {
                    rect.setAttribute('fill', 'transparent');
                    rect.setAttribute('stroke', warningColor);
                    rect.setAttribute('stroke-dasharray', '4 2');
                } else if (node.classList.contains('ending')) {
                    rect.setAttribute('fill', bgTertiary);
                    rect.setAttribute('stroke', accentColor);
                    rect.setAttribute('stroke-width', '2');
                } else {
                    rect.setAttribute('fill', bgTertiary);
                    rect.setAttribute('stroke', borderColor);
                }
            }

            if (text) {
                text.setAttribute('font-size', '11px');
                text.setAttribute('font-family', 'sans-serif');
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('dominant-baseline', 'middle');
                if (node.classList.contains('start')) {
                    text.setAttribute('fill', '#ffffff');
                } else if (node.classList.contains('missing')) {
                    text.setAttribute('fill', warningColor);
                } else {
                    text.setAttribute('fill', textColor);
                }
            }
        });

        // Export as SVG
        const svgData = new XMLSerializer().serializeToString(clonedSvg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'story-graph.svg';
        a.click();
        URL.revokeObjectURL(url);
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

        // Mouse wheel zoom - zoom towards cursor position
        container.onwheel = (e) => {
            e.preventDefault();
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = Math.max(0.2, Math.min(3, state.graph.zoom * factor));

            // Adjust pan to keep mouse position stable
            const zoomRatio = newZoom / state.graph.zoom;
            state.graph.panX = mouseX - (mouseX - state.graph.panX) * zoomRatio;
            state.graph.panY = mouseY - (mouseY - state.graph.panY) * zoomRatio;
            state.graph.zoom = newZoom;

            updateGraphTransform();
        };
    }

    function renderGraph() {
        const svg = elements.graphSvg;
        const container = elements.graphContainer;
        const width = container.clientWidth;
        const height = container.clientHeight;

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.innerHTML = '';

        // Use shared GraphModule to build graph (single source of truth)
        const { GraphData } = window.GraphModule || {};
        if (!GraphData) {
            console.error('GraphModule not loaded');
            return;
        }

        const graphData = new GraphData();
        graphData.buildFromScenes(state.scenes);

        // Convert GraphData to the format expected by chain compression and rendering
        const nodes = {};
        const edges = [...graphData.edges]; // Copy edges array

        for (const [id, node] of graphData.nodes) {
            nodes[id] = {
                id: node.id,
                exists: node.exists,
                hasFlags: node.hasFlags,
                isStart: node.isStart,
                isEnding: node.isEnding,
                type: node.type
            };
        }

        // Compress linear chains if enabled (using shared ChainCompressor)
        let displayNodes = nodes;
        let displayEdges = edges;
        const chains = {}; // chainId -> { nodes: [...], start: id, end: id }

        if (state.graph.compressChains && ChainCompressor) {
            const result = ChainCompressor.compress(nodes, edges, state.graph.expandedChains);
            displayNodes = result.nodes;
            displayEdges = result.edges;
            Object.assign(chains, result.chains);
        }

        // Layout using shared algorithm (via GraphData)
        // Convert displayNodes to GraphData format for layout
        const layoutGraphData = new GraphData();
        for (const [id, node] of Object.entries(displayNodes)) {
            layoutGraphData.nodes.set(id, {
                id,
                exists: node.exists !== false,
                isStart: node.isStart || false,
                isEnding: node.isEnding || false,
                hasFlags: node.hasFlags || false,
                type: node.type || 'scene',
                x: 0,
                y: 0
            });
        }
        layoutGraphData.edges = displayEdges;

        // Use shared layout algorithm
        layoutGraphData.autoLayout({
            horizontalSpacing: 180,
            verticalSpacing: 50,
            startX: 100,
            centerY: height / 2
        });

        // Build positions map from layoutGraphData
        const nodeList = Object.values(displayNodes);
        const positions = {};
        for (const [id, node] of layoutGraphData.nodes) {
            positions[id] = { x: node.x, y: node.y };
        }

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
            const arrow = createArrowhead(toPos, edge.type);
            g.appendChild(arrow);
        });

        // Draw nodes
        const nodeWidth = 100;
        const nodeHeight = 30;
        const chainNodeWidth = 120;

        nodeList.forEach(node => {
            const pos = positions[node.id];
            if (!pos) return;

            const isChainNode = node.isChain;
            const width = isChainNode ? chainNodeWidth : nodeWidth;

            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.classList.add('graph-node');
            group.dataset.nodeId = node.id;  // For drag handling
            if (!node.exists) group.classList.add('missing');
            if (node.isStart) group.classList.add('start');
            if (node.isEnding) group.classList.add('ending');
            if (node.hasFlags) group.classList.add('has-flags');
            if (isChainNode) group.classList.add('chain');
            if (node.id === state.currentSceneId) group.classList.add('current');
            if (state.graph.draggingNode === node.id) group.classList.add('dragging');

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', pos.x - width / 2);
            rect.setAttribute('y', pos.y - nodeHeight / 2);
            rect.setAttribute('width', width);
            rect.setAttribute('height', nodeHeight);
            group.appendChild(rect);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', pos.x);
            text.setAttribute('y', pos.y);

            // Display name
            let displayName;
            if (isChainNode) {
                displayName = node.shortName;
            } else {
                displayName = node.id.length > 14 ? node.id.substring(0, 12) + '...' : node.id;
            }
            text.textContent = displayName;
            group.appendChild(text);

            // Click handler
            group.addEventListener('click', () => {
                if (isChainNode) {
                    // Toggle chain expansion
                    if (state.graph.expandedChains.has(node.id)) {
                        state.graph.expandedChains.delete(node.id);
                    } else {
                        state.graph.expandedChains.add(node.id);
                    }
                    renderGraph();
                    resetGraphView();
                } else if (node.exists) {
                    hideGraphModal();
                    loadScene(node.id);
                } else {
                    if (confirm(`Scene "${node.id}" doesn't exist. Create it?`)) {
                        hideGraphModal();
                        createSceneWithId(node.id);
                    }
                }
            });

            // Right-click for context menu (not for chains)
            if (!isChainNode) {
                group.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    showGraphContextMenu(e, node);
                });
            }

            // Tooltip
            const title = isChainNode ? node.displayName : node.id;
            group.setAttribute('title', title);
            g.appendChild(group);
        });

        svg.appendChild(g);
        updateGraphTransform();
    }

    // Note: Chain compression is now handled by shared ChainCompressor in graph-logic.js
    // Note: Layout is now handled by shared GraphData.autoLayout() in graph-logic.js

    function createEdgePath(fromNode, toNode) {
        const nodeWidth = 100;

        // Start from right edge of from node
        const startX = fromNode.x + nodeWidth / 2;
        const startY = fromNode.y;

        // End at left edge of to node
        const endX = toNode.x - nodeWidth / 2;
        const endY = toNode.y;

        // Create curved path
        const midX = (startX + endX) / 2;

        return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
    }

    function createArrowhead(toNode, type) {
        const nodeWidth = 100;
        const endX = toNode.x - nodeWidth / 2;
        const endY = toNode.y;

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

        saveScenesToStorage();
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

        saveScenesToStorage();
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
            add_items: getItemsFromEditor('add'),
            remove_items: getItemsFromEditor('remove'),
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
        saveScenesToStorage();

        // Save .md file to scenes folder
        saveSceneToFile(scene);

        // Update UI
        elements.currentSceneName.textContent = newId;
        renderSceneList();
        updateIncomingScenes(newId);
        updateNodeConnections(scene);

        log.info('Scene saved: ' + scene.id);
    }

    /**
     * Save scene as .md file to the scenes directory
     * Uses File System Access API if available
     */
    async function saveSceneToFile(scene) {
        const md = generateMarkdown(scene);
        const fileName = `${scene.id}.md`;

        // Try to use existing directory handle
        if (state.scenesDirectoryHandle) {
            try {
                const fileHandle = await state.scenesDirectoryHandle.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(md);
                await writable.close();
                log.info(`Saved ${fileName} to scenes folder`);
                return;
            } catch (err) {
                // Permission may have been revoked, clear handle
                log.warn('Lost access to scenes folder: ' + err.message);
                state.scenesDirectoryHandle = null;
            }
        }

        // Check if File System Access API is supported
        if (!('showDirectoryPicker' in window)) {
            log.warn('File System Access API not supported - scene saved to localStorage only');
            return;
        }

        // First save - ask user to select the scenes folder
        try {
            const handle = await window.showDirectoryPicker({
                id: 'scenes-folder',
                mode: 'readwrite',
                startIn: 'documents'
            });

            // Verify it looks like a scenes folder (optional)
            state.scenesDirectoryHandle = handle;

            // Now save the file
            const fileHandle = await handle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(md);
            await writable.close();
            log.info(`Saved ${fileName} to scenes folder (folder selected: ${handle.name})`);
        } catch (err) {
            if (err.name === 'AbortError') {
                log.info('User cancelled folder selection - scene saved to localStorage only');
            } else {
                log.error('Error saving to file: ' + err.message);
            }
        }
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

    async function exportAllScenes() {
        const sceneIds = Object.keys(state.scenes);

        if (sceneIds.length === 0) {
            alert('No scenes to export.');
            return;
        }

        // Save current scene first if there's one being edited
        if (state.currentSceneId) {
            saveCurrentScene();
        }

        // Generate all markdown files and download them individually
        // Put them in a scenes/ folder structure via zip
        const files = [];

        sceneIds.forEach(sceneId => {
            const scene = state.scenes[sceneId];
            if (scene) {
                const md = generateMarkdown(scene);
                files.push({
                    name: `${scene.id}.md`,
                    content: md
                });
            }
        });

        if (files.length === 0) {
            alert('No valid scenes to export.');
            return;
        }

        // Create a simple zip file manually (no external library needed)
        const zipBlob = await createZipBlob(files);

        // Download the zip
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scenes.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        log.info('Exported ' + files.length + ' scenes to scenes.zip');
    }

    // Simple ZIP file creator (no compression, just store)
    async function createZipBlob(files) {
        const localFiles = [];
        const centralDir = [];
        let offset = 0;

        for (const file of files) {
            const fileName = new TextEncoder().encode(file.name);
            const fileContent = new TextEncoder().encode(file.content);

            // Local file header
            const localHeader = new Uint8Array(30 + fileName.length);
            const localView = new DataView(localHeader.buffer);

            localView.setUint32(0, 0x04034b50, true); // Local file header signature
            localView.setUint16(4, 20, true);          // Version needed
            localView.setUint16(6, 0, true);           // General purpose flag
            localView.setUint16(8, 0, true);           // Compression method (store)
            localView.setUint16(10, 0, true);          // File time
            localView.setUint16(12, 0, true);          // File date
            localView.setUint32(14, crc32(fileContent), true); // CRC-32
            localView.setUint32(18, fileContent.length, true); // Compressed size
            localView.setUint32(22, fileContent.length, true); // Uncompressed size
            localView.setUint16(26, fileName.length, true);    // File name length
            localView.setUint16(28, 0, true);          // Extra field length
            localHeader.set(fileName, 30);

            // Central directory header
            const centralHeader = new Uint8Array(46 + fileName.length);
            const centralView = new DataView(centralHeader.buffer);

            centralView.setUint32(0, 0x02014b50, true);  // Central dir signature
            centralView.setUint16(4, 20, true);           // Version made by
            centralView.setUint16(6, 20, true);           // Version needed
            centralView.setUint16(8, 0, true);            // General purpose flag
            centralView.setUint16(10, 0, true);           // Compression method
            centralView.setUint16(12, 0, true);           // File time
            centralView.setUint16(14, 0, true);           // File date
            centralView.setUint32(16, crc32(fileContent), true); // CRC-32
            centralView.setUint32(20, fileContent.length, true); // Compressed size
            centralView.setUint32(24, fileContent.length, true); // Uncompressed size
            centralView.setUint16(28, fileName.length, true);    // File name length
            centralView.setUint16(30, 0, true);           // Extra field length
            centralView.setUint16(32, 0, true);           // Comment length
            centralView.setUint16(34, 0, true);           // Disk number start
            centralView.setUint16(36, 0, true);           // Internal attributes
            centralView.setUint32(38, 0, true);           // External attributes
            centralView.setUint32(42, offset, true);      // Offset of local header
            centralHeader.set(fileName, 46);

            localFiles.push(localHeader, fileContent);
            centralDir.push(centralHeader);

            offset += localHeader.length + fileContent.length;
        }

        // End of central directory
        const eocd = new Uint8Array(22);
        const eocdView = new DataView(eocd.buffer);
        const centralDirSize = centralDir.reduce((sum, h) => sum + h.length, 0);

        eocdView.setUint32(0, 0x06054b50, true);  // EOCD signature
        eocdView.setUint16(4, 0, true);           // Disk number
        eocdView.setUint16(6, 0, true);           // Disk with central dir
        eocdView.setUint16(8, files.length, true);  // Entries on this disk
        eocdView.setUint16(10, files.length, true); // Total entries
        eocdView.setUint32(12, centralDirSize, true); // Central dir size
        eocdView.setUint32(16, offset, true);     // Central dir offset
        eocdView.setUint16(20, 0, true);          // Comment length

        return new Blob([...localFiles, ...centralDir, eocd], { type: 'application/zip' });
    }

    // CRC-32 calculation for ZIP
    function crc32(data) {
        let crc = 0xFFFFFFFF;
        const table = getCrc32Table();

        for (let i = 0; i < data.length; i++) {
            crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
        }

        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function getCrc32Table() {
        if (!getCrc32Table.table) {
            const table = new Uint32Array(256);
            for (let i = 0; i < 256; i++) {
                let c = i;
                for (let j = 0; j < 8; j++) {
                    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                }
                table[i] = c;
            }
            getCrc32Table.table = table;
        }
        return getCrc32Table.table;
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

        if (scene.add_items && scene.add_items.length > 0) {
            md += 'add_items:\n';
            scene.add_items.forEach(item => {
                md += `  - ${item}\n`;
            });
        }

        if (scene.remove_items && scene.remove_items.length > 0) {
            md += 'remove_items:\n';
            scene.remove_items.forEach(item => {
                md += `  - ${item}\n`;
            });
        }

        if (scene.actions && scene.actions.length > 0) {
            md += 'actions:\n';
            scene.actions.forEach(action => {
                md += `  - type: ${action.type}\n`;
                // Dice roll fields
                if (action.dice) md += `    dice: ${action.dice}\n`;
                if (action.threshold) md += `    threshold: ${action.threshold}\n`;
                if (action.modifier) md += `    modifier: ${action.modifier}\n`;
                if (action.skill) md += `    skill: ${action.skill}\n`;
                if (action.crit_text) md += `    crit_text: "${action.crit_text}"\n`;
                if (action.fumble_text) md += `    fumble_text: "${action.fumble_text}"\n`;
                if (action.success_target) md += `    success_target: ${action.success_target}\n`;
                if (action.failure_target) md += `    failure_target: ${action.failure_target}\n`;
                // Battle fields
                if (action.enemy_name) md += `    enemy_name: ${action.enemy_name}\n`;
                if (action.enemy_hp) md += `    enemy_hp: ${action.enemy_hp}\n`;
                if (action.enemy_max_hp) md += `    enemy_max_hp: ${action.enemy_max_hp}\n`;
                if (action.enemy_attack) md += `    enemy_attack: ${action.enemy_attack}\n`;
                if (action.enemy_defense) md += `    enemy_defense: ${action.enemy_defense}\n`;
                if (action.player_attack) md += `    player_attack: ${action.player_attack}\n`;
                if (action.player_defense) md += `    player_defense: ${action.player_defense}\n`;
                if (action.victory_target) md += `    victory_target: ${action.victory_target}\n`;
                if (action.defeat_target) md += `    defeat_target: ${action.defeat_target}\n`;
                if (action.flee_target) md += `    flee_target: ${action.flee_target}\n`;
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
                if (choice.sfx) {
                    choiceLine += ` [sfx: ${choice.sfx}]`;
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

        saveScenesToStorage();
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
    function saveScenesToStorage() {
        // Use shared EditorStorage
        if (Storage) {
            Storage.saveScenes(state.scenes);
            if (state.currentSceneId) {
                Storage.setCurrentScene(state.currentSceneId);
            }
        } else {
            // Fallback
            try {
                localStorage.setItem('andi_editor_scenes', JSON.stringify(state.scenes));
                if (state.currentSceneId) {
                    localStorage.setItem('andi_editor_current_scene', state.currentSceneId);
                }
            } catch (e) {
                log.warn('Could not save to localStorage: ' + e.message);
            }
        }
    }

    function restoreCurrentScene() {
        // Use shared EditorStorage
        const savedSceneId = Storage ? Storage.getCurrentScene() : null;
        if (savedSceneId && state.scenes[savedSceneId]) {
            loadScene(savedSceneId);
            return;
        }

        // Fallback
        try {
            const legacyId = localStorage.getItem('andi_editor_current_scene');
            if (legacyId && state.scenes[legacyId]) {
                loadScene(legacyId);
            }
        } catch (e) {
            log.warn('Could not restore current scene: ' + e.message);
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
                    log.error('Error importing ' + file.name + ': ' + err.message);
                }
            }

            if (imported > 0) {
                saveScenesToStorage();
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
            add_items: [],
            remove_items: [],
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
                // Remove surrounding quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                else if (!isNaN(value)) value = parseInt(value);
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
                    } else if (key === 'add_items') {
                        currentList = 'add_items';
                    } else if (key === 'remove_items') {
                        currentList = 'remove_items';
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
                    sfx: null,
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

                // Parse SFX from label [sfx: filename.ogg]
                const sfxMatch = choice.label.match(/\[sfx:\s*([^\]]+)\]/);
                if (sfxMatch) {
                    choice.sfx = sfxMatch[1].trim();
                    choice.label = choice.label.replace(/\[sfx:\s*[^\]]+\]/, '').trim();
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
document.addEventListener('DOMContentLoaded', () => {
    Editor.init();
    // Show page after initialization to prevent FOUC
    document.documentElement.classList.add('loaded');
});
