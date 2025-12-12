/**
 * Dev Panel Module - v0.7.0
 *
 * Modular dev panel for debugging and testing.
 * Extracted from engine.js for maintainability.
 *
 * Features:
 * - Theme selector
 * - Forced dice rolls
 * - Battle quick actions (heal, kill, mana)
 * - Intent triggers
 * - Terrain selector
 * - Ken Burns toggle
 * - Draggable panel
 * - Event Log (real-time eventBus monitoring)
 * - State Viewer (store state inspection)
 */

var DevPanel = (function() {
    'use strict';

    // =========================================================================
    // STATE
    // =========================================================================

    var elements = {
        indicator: null,
        panel: null,
        terrainSelect: null,
        eventLog: null,
        stateViewer: null
    };

    // Event log state
    var eventLogState = {
        entries: [],
        maxEntries: 50,
        paused: false,
        unsubscribers: []
    };

    var callbacks = {
        onUndo: null,
        getDevMode: null,
        setDevMode: null,
        getKenBurns: null,
        setKenBurns: null,
        getGuaranteeStatus: null,
        setGuaranteeStatus: null,
        getIntentsEnabled: null,
        setIntentsEnabled: null,
        getForcedRoll: null,
        setForcedRoll: null,
        getForcedDamage: null,
        setForcedDamage: null,
        log: console
    };

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /**
     * Initialize dev panel with callbacks
     * @param {Object} options - Callback functions
     */
    function init(options) {
        options = options || {};

        callbacks.onUndo = options.onUndo || null;
        callbacks.getDevMode = options.getDevMode || function() { return false; };
        callbacks.setDevMode = options.setDevMode || function() {};
        callbacks.getKenBurns = options.getKenBurns || function() { return false; };
        callbacks.setKenBurns = options.setKenBurns || function() {};
        callbacks.getGuaranteeStatus = options.getGuaranteeStatus || function() { return false; };
        callbacks.setGuaranteeStatus = options.setGuaranteeStatus || function() {};
        callbacks.getIntentsEnabled = options.getIntentsEnabled || function() { return false; };
        callbacks.setIntentsEnabled = options.setIntentsEnabled || function() {};
        callbacks.getForcedRoll = options.getForcedRoll || function() { return null; };
        callbacks.setForcedRoll = options.setForcedRoll || function() {};
        callbacks.getForcedDamage = options.getForcedDamage || function() { return null; };
        callbacks.setForcedDamage = options.setForcedDamage || function() {};
        callbacks.loadScene = options.loadScene || null;
        callbacks.getCurrentScene = options.getCurrentScene || function() { return null; };
        callbacks.log = options.log || console;
    }

    // =========================================================================
    // DRAGGABLE FUNCTIONALITY
    // =========================================================================

    /**
     * Make an element draggable
     * @param {HTMLElement} element - Element to make draggable
     * @param {HTMLElement} handle - Drag handle element
     */
    function makeDraggable(element, handle) {
        var isDragging = false;
        var offsetX, offsetY;

        handle.addEventListener('mousedown', startDrag);
        handle.addEventListener('touchstart', startDrag, { passive: false });

        function startDrag(e) {
            // Ignore if clicking buttons inside handle
            if (e.target.tagName === 'BUTTON') return;

            isDragging = true;
            element.classList.add('dragging');

            var rect = element.getBoundingClientRect();
            var clientX = e.touches ? e.touches[0].clientX : e.clientX;
            var clientY = e.touches ? e.touches[0].clientY : e.clientY;

            offsetX = clientX - rect.left;
            offsetY = clientY - rect.top;

            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', stopDrag);
            document.addEventListener('touchmove', drag, { passive: false });
            document.addEventListener('touchend', stopDrag);

            e.preventDefault();
        }

        function drag(e) {
            if (!isDragging) return;

            var clientX = e.touches ? e.touches[0].clientX : e.clientX;
            var clientY = e.touches ? e.touches[0].clientY : e.clientY;

            var newX = clientX - offsetX;
            var newY = clientY - offsetY;

            // Keep within viewport bounds
            var rect = element.getBoundingClientRect();
            var maxX = window.innerWidth - rect.width;
            var maxY = window.innerHeight - rect.height;

            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));

            element.style.left = newX + 'px';
            element.style.top = newY + 'px';

            e.preventDefault();
        }

        function stopDrag() {
            if (!isDragging) return;
            isDragging = false;
            element.classList.remove('dragging');

            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('touchmove', drag);
            document.removeEventListener('touchend', stopDrag);

            // Save position to localStorage
            try {
                localStorage.setItem('andi_dev_panel_pos', JSON.stringify({
                    left: element.style.left,
                    top: element.style.top
                }));
            } catch (e) {
                callbacks.log.warn('Could not save panel position:', e);
            }
        }

        // Restore saved position
        try {
            var saved = localStorage.getItem('andi_dev_panel_pos');
            if (saved) {
                var pos = JSON.parse(saved);
                element.style.position = 'fixed';
                element.style.right = 'auto';
                element.style.left = pos.left;
                element.style.top = pos.top;
            }
        } catch (e) {
            callbacks.log.warn('Could not restore panel position:', e);
        }
    }

    // =========================================================================
    // VISIBILITY
    // =========================================================================

    /**
     * Show or hide dev mode indicator and panel
     * @param {boolean} show - Whether to show
     */
    function showDevModeIndicator(show) {
        var indicator = document.getElementById('dev-mode-indicator');
        var panel = document.getElementById('theme-selector');

        if (show) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'dev-mode-indicator';
                indicator.textContent = 'DEV MODE';
                document.body.appendChild(indicator);

                indicator.addEventListener('click', function() {
                    toggleDevPanelPortrait();
                });
            }
            indicator.classList.add('visible');
            elements.indicator = indicator;

            if (!panel) {
                createPanel();
            } else {
                panel.classList.add('visible');
            }

            addUndoButton();
        } else {
            if (indicator) {
                indicator.classList.remove('visible');
                indicator.classList.remove('expanded');
            }
            if (panel) {
                panel.classList.remove('visible');
                panel.classList.remove('portrait-expanded');
            }
            removeUndoButton();
        }
    }

    /**
     * Toggle panel visibility in portrait mode
     */
    function toggleDevPanelPortrait() {
        if (window.matchMedia('(orientation: portrait)').matches) {
            var indicator = document.getElementById('dev-mode-indicator');
            var panel = document.getElementById('theme-selector');

            if (indicator && panel) {
                var isExpanded = indicator.classList.contains('expanded');
                if (isExpanded) {
                    indicator.classList.remove('expanded');
                    panel.classList.remove('portrait-expanded');
                } else {
                    indicator.classList.add('expanded');
                    panel.classList.add('portrait-expanded');
                }
            }
        }
    }

    // =========================================================================
    // UNDO BUTTON
    // =========================================================================

    function addUndoButton() {
        var textControls = document.getElementById('text-controls');
        if (!textControls || document.getElementById('dev-undo-btn')) return;

        var undoBtn = document.createElement('button');
        undoBtn.id = 'dev-undo-btn';
        undoBtn.className = 'speed-btn';
        undoBtn.title = 'Undo - go back to previous scene (Ctrl+Z)';
        undoBtn.setAttribute('aria-label', 'Undo to previous scene');
        undoBtn.innerHTML = '<span class="icon-landscape" aria-hidden="true">&lt;</span><span class="icon-portrait" aria-hidden="true">&lt;</span>';

        undoBtn.addEventListener('click', function() {
            if (callbacks.onUndo) {
                callbacks.onUndo();
            }
        });

        textControls.insertBefore(undoBtn, textControls.firstChild);
    }

    function removeUndoButton() {
        var undoBtn = document.getElementById('dev-undo-btn');
        if (undoBtn) {
            undoBtn.parentNode.removeChild(undoBtn);
        }
    }

    // =========================================================================
    // PANEL CREATION
    // =========================================================================

    /**
     * Create the main dev panel
     */
    function createPanel() {
        // Check for theme utilities (optional - panel works without them)
        var hasThemeSupport = typeof ThemeUtils !== 'undefined' &&
                              typeof themeConfig !== 'undefined' &&
                              themeConfig.available;

        if (!hasThemeSupport) {
            callbacks.log.warn('[DevPanel] Theme support not available - panel will have limited features');
        }

        var currentTheme = hasThemeSupport ? ThemeUtils.getCurrentTheme() : 'prototype';
        var link = document.getElementById('theme-css');
        if (hasThemeSupport && link && link.href) {
            var activeTheme = link.href.match(/themes\/([^.]+)\.css/);
            if (activeTheme && activeTheme[1] !== currentTheme) {
                ThemeUtils.setTheme(currentTheme);
            }
        }

        var container = document.createElement('div');
        container.id = 'theme-selector';
        container.classList.add('visible');
        elements.panel = container;

        // Draggable header
        var dragHeader = createDragHeader(container);
        container.appendChild(dragHeader);
        makeDraggable(container, dragHeader);

        // Theme selector (only if theme support available)
        if (hasThemeSupport) {
            container.appendChild(createThemeSection(currentTheme));
        }

        // Ken Burns toggle
        container.appendChild(createKenBurnsToggle());

        // Forced rolls section
        container.appendChild(createForcedRollsSection());

        // Status effects toggle
        container.appendChild(createStatusToggle());

        // Intents toggle
        container.appendChild(createIntentsToggle());

        // Terrain selector
        container.appendChild(createTerrainSection());

        // Battle section (intents + quick actions)
        container.appendChild(createBattleSection());

        // Scene jump section
        container.appendChild(createSceneJumpSection());

        // Event Log section (eventBus monitoring)
        container.appendChild(createEventLogSection());

        // State Viewer section (store inspection)
        container.appendChild(createStateViewerSection());

        document.body.appendChild(container);

        // Subscribe to events after panel is created
        subscribeToEvents();
    }

    function createDragHeader(container) {
        var dragHeader = document.createElement('div');
        dragHeader.className = 'dev-drag-header';

        var headerText = document.createElement('span');
        headerText.textContent = '⋮⋮ Dev Panel';
        headerText.className = 'dev-header-text';
        dragHeader.appendChild(headerText);

        var collapseBtn = document.createElement('button');
        collapseBtn.className = 'dev-collapse-btn';
        collapseBtn.textContent = '−';
        collapseBtn.title = 'Collapse/Expand';
        collapseBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            container.classList.toggle('collapsed');
            collapseBtn.textContent = container.classList.contains('collapsed') ? '+' : '−';
            localStorage.setItem('devPanelCollapsed', container.classList.contains('collapsed'));
        });
        dragHeader.appendChild(collapseBtn);

        // Restore collapsed state
        if (localStorage.getItem('devPanelCollapsed') === 'true') {
            container.classList.add('collapsed');
            collapseBtn.textContent = '+';
        }

        dragHeader.title = 'Drag to move';
        return dragHeader;
    }

    function createThemeSection(currentTheme) {
        var wrapper = document.createElement('div');
        wrapper.className = 'dev-section';

        var label = document.createElement('label');
        label.textContent = 'Theme: ';

        var select = document.createElement('select');
        select.id = 'theme-select';

        ThemeUtils.getAvailableThemes().forEach(function(theme) {
            var option = document.createElement('option');
            option.value = theme;
            option.textContent = theme;
            if (theme === currentTheme) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        select.addEventListener('change', function() {
            ThemeUtils.setTheme(this.value);
        });

        wrapper.appendChild(label);
        wrapper.appendChild(select);
        return wrapper;
    }

    function createKenBurnsToggle() {
        var container = document.createElement('div');
        container.className = 'ken-burns-toggle-container';

        var label = document.createElement('label');

        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'ken-burns-toggle';
        checkbox.checked = callbacks.getKenBurns();

        checkbox.addEventListener('change', function() {
            callbacks.setKenBurns(this.checked);
        });

        // Load saved preference
        try {
            var saved = localStorage.getItem('andi_ken_burns');
            if (saved === 'true') {
                checkbox.checked = true;
                callbacks.setKenBurns(true);
            }
        } catch (e) {}

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode('Ken Burns zoom'));

        container.appendChild(label);
        return container;
    }

    function createForcedRollsSection() {
        var wrapper = document.createElement('div');
        wrapper.className = 'dev-section';

        // Hit roll
        var hitContainer = document.createElement('div');
        hitContainer.className = 'forced-roll-container';

        var hitLabel = document.createElement('label');
        hitLabel.htmlFor = 'forced-hit-input';
        hitLabel.textContent = 'Hit Roll: ';

        var hitInput = document.createElement('input');
        hitInput.type = 'number';
        hitInput.id = 'forced-hit-input';
        hitInput.min = '1';
        hitInput.max = '20';
        hitInput.placeholder = 'x';
        hitInput.title = 'Force next d20 hit roll (1-20). Leave empty for random.';

        hitInput.addEventListener('input', function() {
            var val = this.value.trim();
            if (val === '') {
                callbacks.setForcedRoll(null);
            } else {
                var num = parseInt(val, 10);
                if (!isNaN(num) && num >= 1 && num <= 20) {
                    callbacks.setForcedRoll(num);
                } else {
                    callbacks.setForcedRoll(null);
                }
            }
        });

        hitContainer.appendChild(hitLabel);
        hitContainer.appendChild(hitInput);
        wrapper.appendChild(hitContainer);

        // Damage roll
        var damageContainer = document.createElement('div');
        damageContainer.className = 'forced-roll-container';

        var damageLabel = document.createElement('label');
        damageLabel.htmlFor = 'forced-damage-input';
        damageLabel.textContent = 'Damage Roll: ';

        var damageInput = document.createElement('input');
        damageInput.type = 'number';
        damageInput.id = 'forced-damage-input';
        damageInput.min = '1';
        damageInput.max = '99';
        damageInput.placeholder = 'y';
        damageInput.title = 'Force next damage roll (1-99). Leave empty for random.';

        damageInput.addEventListener('input', function() {
            var val = this.value.trim();
            if (val === '') {
                callbacks.setForcedDamage(null);
            } else {
                var num = parseInt(val, 10);
                if (!isNaN(num) && num >= 1 && num <= 99) {
                    callbacks.setForcedDamage(num);
                } else {
                    callbacks.setForcedDamage(null);
                }
            }
        });

        damageContainer.appendChild(damageLabel);
        damageContainer.appendChild(damageInput);
        wrapper.appendChild(damageContainer);

        return wrapper;
    }

    function createStatusToggle() {
        var container = document.createElement('div');
        container.className = 'guarantee-status-container';

        var label = document.createElement('label');

        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'guarantee-status-toggle';
        checkbox.checked = callbacks.getGuaranteeStatus();

        checkbox.addEventListener('change', function() {
            callbacks.setGuaranteeStatus(this.checked);
        });

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode('100% Status Effects'));

        container.appendChild(label);
        return container;
    }

    function createIntentsToggle() {
        var container = document.createElement('div');
        container.className = 'ken-burns-toggle-container';

        var label = document.createElement('label');

        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'enable-intents-toggle';
        checkbox.checked = callbacks.getIntentsEnabled();

        checkbox.addEventListener('change', function() {
            callbacks.setIntentsEnabled(this.checked);
            if (typeof BattleEngine !== 'undefined' && BattleEngine.setIntentsEnabled) {
                BattleEngine.setIntentsEnabled(this.checked);
            }
        });

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode('Enable Intents'));

        container.appendChild(label);
        return container;
    }

    function createTerrainSection() {
        var container = document.createElement('div');
        container.className = 'dev-section';

        var label = document.createElement('label');
        label.htmlFor = 'terrain-select';
        label.textContent = 'Terrain: ';

        var select = document.createElement('select');
        select.id = 'terrain-select';
        elements.terrainSelect = select;

        // Get terrain types from BattleData if available
        var terrains = [
            { id: 'none', name: 'None' },
            { id: 'lava', name: '🌋 Lava Field' },
            { id: 'ice', name: '🧊 Frozen Tundra' },
            { id: 'swamp', name: '🐸 Toxic Swamp' },
            { id: 'storm', name: '⛈️ Thunder Plains' },
            { id: 'holy_ground', name: '✨ Holy Ground' },
            { id: 'darkness', name: '🌑 Darkness' }
        ];

        terrains.forEach(function(terrain) {
            var option = document.createElement('option');
            option.value = terrain.id;
            option.textContent = terrain.name;
            select.appendChild(option);
        });

        select.addEventListener('change', function() {
            setTerrain(this.value);
        });

        container.appendChild(label);
        container.appendChild(select);
        return container;
    }

    function createBattleSection() {
        var battleSection = document.createElement('div');
        battleSection.className = 'dev-battle-section';
        battleSection.innerHTML = '<div class="dev-section-title">Intent Controls</div>';

        // Intent buttons
        var intentButtons = [
            { id: 'termination_notice', label: 'Big Attack', icon: '⚠', color: '#ff6600' },
            { id: 'policy_barrage', label: 'Multi-Hit', icon: '⚔', color: '#ff3333' },
            { id: 'call_intern', label: 'Summon', icon: '✦', color: '#9966ff' }
        ];

        intentButtons.forEach(function(intent) {
            var row = document.createElement('div');
            row.className = 'dev-intent-row';

            var triggerBtn = document.createElement('button');
            triggerBtn.type = 'button';
            triggerBtn.className = 'dev-intent-btn dev-intent-trigger';
            triggerBtn.textContent = intent.icon + ' ' + intent.label;
            triggerBtn.style.borderLeftColor = intent.color;
            triggerBtn.title = 'Trigger intent prep phase';
            triggerBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof BattleEngine !== 'undefined' && BattleEngine.devTriggerIntent) {
                    var result = BattleEngine.devTriggerIntent(intent.id);
                    callbacks.log.debug('[Dev] ' + result.message);
                }
            });

            var execBtn = document.createElement('button');
            execBtn.type = 'button';
            execBtn.className = 'dev-intent-btn dev-intent-exec';
            execBtn.textContent = '▶';
            execBtn.style.borderLeftColor = intent.color;
            execBtn.title = 'Execute immediately';
            execBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof BattleEngine !== 'undefined' && BattleEngine.devForceIntent) {
                    var result = BattleEngine.devForceIntent(intent.id);
                    callbacks.log.debug('[Dev] ' + result.message);
                }
            });

            row.appendChild(triggerBtn);
            row.appendChild(execBtn);
            battleSection.appendChild(row);
        });

        // Quick action buttons
        var quickActions = document.createElement('div');
        quickActions.className = 'dev-quick-actions';

        var healBtn = document.createElement('button');
        healBtn.type = 'button';
        healBtn.className = 'dev-quick-btn';
        healBtn.textContent = '💚 Heal';
        healBtn.title = 'Full heal player';
        healBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof BattleEngine !== 'undefined' && BattleEngine.healPlayer) {
                var state = BattleEngine.getState();
                if (state && state.player) {
                    BattleEngine.healPlayer(state.player.maxHP);
                    callbacks.log.debug('[Dev] Healed player to full HP');
                }
            }
        });

        var killBtn = document.createElement('button');
        killBtn.type = 'button';
        killBtn.className = 'dev-quick-btn';
        killBtn.textContent = '💀 Kill';
        killBtn.title = 'Kill enemy instantly';
        killBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof BattleCore !== 'undefined') {
                var enemy = BattleCore.getEnemy();
                if (enemy) {
                    BattleCore.damageEnemy(enemy.hp);
                    callbacks.log.debug('[Dev] Killed enemy');
                }
            }
        });

        var manaBtn = document.createElement('button');
        manaBtn.type = 'button';
        manaBtn.className = 'dev-quick-btn';
        manaBtn.textContent = '💙 Mana';
        manaBtn.title = 'Full mana restore';
        manaBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof BattleEngine !== 'undefined' && BattleEngine.restoreMana) {
                BattleEngine.restoreMana(100);
                callbacks.log.debug('[Dev] Restored full mana');
            }
        });

        quickActions.appendChild(healBtn);
        quickActions.appendChild(killBtn);
        quickActions.appendChild(manaBtn);
        battleSection.appendChild(quickActions);

        return battleSection;
    }

    function createSceneJumpSection() {
        var section = document.createElement('div');
        section.className = 'dev-scene-section';
        section.innerHTML = '<div class="dev-section-title">Jump to Scene</div>';

        var searchContainer = document.createElement('div');
        searchContainer.className = 'scene-search-container';

        var input = document.createElement('input');
        input.type = 'text';
        input.id = 'scene-search-input';
        input.placeholder = 'Search scenes...';
        input.autocomplete = 'off';

        var dropdown = document.createElement('div');
        dropdown.id = 'scene-search-dropdown';
        dropdown.className = 'scene-search-dropdown';

        function getSceneIds() {
            if (typeof story !== 'undefined') {
                return Object.keys(story).sort();
            }
            return [];
        }

        function filterScenes(query) {
            var scenes = getSceneIds();
            if (!query) return scenes.slice(0, 15);
            query = query.toLowerCase();
            return scenes.filter(function(id) {
                return id.toLowerCase().indexOf(query) !== -1;
            }).slice(0, 15);
        }

        function renderDropdown(scenes) {
            dropdown.innerHTML = '';
            if (scenes.length === 0) {
                dropdown.innerHTML = '<div class="scene-search-empty">No scenes found</div>';
                dropdown.classList.add('visible');
                return;
            }
            var currentScene = callbacks.getCurrentScene ? callbacks.getCurrentScene() : null;
            scenes.forEach(function(sceneId) {
                var item = document.createElement('div');
                item.className = 'scene-search-item';
                item.textContent = sceneId;
                if (sceneId === currentScene) {
                    item.classList.add('current');
                }
                item.addEventListener('click', function(e) {
                    e.stopPropagation();  // Prevent document click from closing dropdown before action
                    jumpToScene(sceneId);
                    dropdown.classList.remove('visible');
                    input.value = '';
                });
                dropdown.appendChild(item);
            });
            dropdown.classList.add('visible');
        }

        function jumpToScene(sceneId) {
            if (typeof story === 'undefined' || !story[sceneId]) {
                callbacks.log.warn('Scene not found: ' + sceneId);
                return;
            }
            if (typeof BattleEngine !== 'undefined' && BattleEngine.isActive()) {
                BattleEngine.reset();
            }
            callbacks.log.debug('[Dev] Jumping to scene: ' + sceneId);
            if (callbacks.loadScene) {
                callbacks.loadScene(sceneId);
            }
        }

        input.addEventListener('input', function() {
            renderDropdown(filterScenes(this.value));
        });

        input.addEventListener('focus', function() {
            renderDropdown(filterScenes(this.value));
        });

        document.addEventListener('click', function(e) {
            if (!searchContainer.contains(e.target)) {
                dropdown.classList.remove('visible');
            }
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                var filtered = filterScenes(this.value);
                if (filtered.length > 0) {
                    jumpToScene(filtered[0]);
                    dropdown.classList.remove('visible');
                    input.value = '';
                }
            } else if (e.key === 'Escape') {
                dropdown.classList.remove('visible');
                input.blur();
            }
        });

        searchContainer.appendChild(input);
        searchContainer.appendChild(dropdown);
        section.appendChild(searchContainer);

        return section;
    }

    // =========================================================================
    // EVENT LOG
    // =========================================================================

    /**
     * Create the event log section
     */
    function createEventLogSection() {
        var section = document.createElement('div');
        section.className = 'dev-event-log-section';

        // Header with title and controls
        var header = document.createElement('div');
        header.className = 'dev-section-header';

        var title = document.createElement('span');
        title.className = 'dev-section-title';
        title.textContent = 'Event Log';
        header.appendChild(title);

        var controls = document.createElement('div');
        controls.className = 'dev-log-controls';

        var pauseBtn = document.createElement('button');
        pauseBtn.type = 'button';
        pauseBtn.className = 'dev-log-btn';
        pauseBtn.textContent = '⏸';
        pauseBtn.title = 'Pause/Resume';
        pauseBtn.addEventListener('click', function() {
            eventLogState.paused = !eventLogState.paused;
            pauseBtn.textContent = eventLogState.paused ? '▶' : '⏸';
            pauseBtn.classList.toggle('active', eventLogState.paused);
        });
        controls.appendChild(pauseBtn);

        var clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'dev-log-btn';
        clearBtn.textContent = '🗑';
        clearBtn.title = 'Clear log';
        clearBtn.addEventListener('click', function() {
            eventLogState.entries = [];
            renderEventLog();
        });
        controls.appendChild(clearBtn);

        header.appendChild(controls);
        section.appendChild(header);

        // Log container
        var logContainer = document.createElement('div');
        logContainer.className = 'dev-event-log';
        logContainer.id = 'dev-event-log';
        elements.eventLog = logContainer;
        section.appendChild(logContainer);

        return section;
    }

    /**
     * Add an entry to the event log
     * @param {string} eventName - Event name
     * @param {*} data - Event data
     */
    function addEventLogEntry(eventName, data) {
        if (eventLogState.paused) return;

        var entry = {
            time: new Date().toLocaleTimeString('en-US', { hour12: false }),
            event: eventName,
            data: data
        };

        eventLogState.entries.unshift(entry);

        // Trim to max entries
        if (eventLogState.entries.length > eventLogState.maxEntries) {
            eventLogState.entries = eventLogState.entries.slice(0, eventLogState.maxEntries);
        }

        renderEventLog();
    }

    /**
     * Render the event log UI
     */
    function renderEventLog() {
        if (!elements.eventLog) return;

        if (eventLogState.entries.length === 0) {
            elements.eventLog.innerHTML = '<div class="dev-log-empty">No events yet...</div>';
            return;
        }

        var html = '';
        eventLogState.entries.forEach(function(entry) {
            var eventClass = getEventClass(entry.event);
            var dataStr = formatEventData(entry.data);
            html += '<div class="dev-log-entry ' + eventClass + '">';
            html += '<span class="dev-log-time">' + entry.time + '</span>';
            html += '<span class="dev-log-event">' + entry.event + '</span>';
            if (dataStr) {
                html += '<span class="dev-log-data">' + dataStr + '</span>';
            }
            html += '</div>';
        });

        elements.eventLog.innerHTML = html;
    }

    /**
     * Get CSS class for event type
     * @param {string} eventName
     * @returns {string}
     */
    function getEventClass(eventName) {
        if (eventName.indexOf('scene:') === 0) return 'event-scene';
        if (eventName.indexOf('battle:') === 0) return 'event-battle';
        if (eventName.indexOf('inventory:') === 0) return 'event-inventory';
        if (eventName.indexOf('audio:') === 0) return 'event-audio';
        if (eventName.indexOf('state:') === 0) return 'event-state';
        if (eventName.indexOf('qte:') === 0) return 'event-qte';
        return 'event-other';
    }

    /**
     * Format event data for display
     * @param {*} data
     * @returns {string}
     */
    function formatEventData(data) {
        if (!data) return '';
        if (typeof data === 'string') return data;

        // Extract key info for common events
        if (data.sceneId) return data.sceneId;
        if (data.item) return data.item + (data.type ? ' (' + data.type + ')' : '');
        if (data.flag) return data.flag;
        if (data.filename) return data.filename;
        if (data.result) return data.result;
        if (data.enemy && data.enemy.name) return 'vs ' + data.enemy.name;

        // Fallback to JSON (truncated)
        try {
            var str = JSON.stringify(data);
            return str.length > 40 ? str.substring(0, 37) + '...' : str;
        } catch (e) {
            return '[object]';
        }
    }

    // =========================================================================
    // STATE VIEWER
    // =========================================================================

    /**
     * Create the state viewer section
     */
    function createStateViewerSection() {
        var section = document.createElement('div');
        section.className = 'dev-state-viewer-section';

        // Header
        var header = document.createElement('div');
        header.className = 'dev-section-header';

        var title = document.createElement('span');
        title.className = 'dev-section-title';
        title.textContent = 'State Viewer';
        header.appendChild(title);

        var refreshBtn = document.createElement('button');
        refreshBtn.type = 'button';
        refreshBtn.className = 'dev-log-btn';
        refreshBtn.textContent = '🔄';
        refreshBtn.title = 'Refresh state';
        refreshBtn.addEventListener('click', function() {
            renderStateViewer();
        });
        header.appendChild(refreshBtn);

        section.appendChild(header);

        // State container
        var stateContainer = document.createElement('div');
        stateContainer.className = 'dev-state-viewer';
        stateContainer.id = 'dev-state-viewer';
        elements.stateViewer = stateContainer;
        section.appendChild(stateContainer);

        // Initial render
        setTimeout(renderStateViewer, 100);

        return section;
    }

    /**
     * Render the state viewer UI
     */
    function renderStateViewer() {
        if (!elements.stateViewer) return;

        var html = '';

        // Scene info from store
        if (typeof store !== 'undefined') {
            var sceneState = store.get('scene');
            if (sceneState) {
                html += '<div class="dev-state-group">';
                html += '<div class="dev-state-label">Scene</div>';
                html += '<div class="dev-state-value">' + (sceneState.currentId || 'none') + '</div>';
                html += '<div class="dev-state-sublabel">Block: ' + sceneState.blockIndex + '</div>';
                html += '</div>';
            }

            // Player state
            var playerState = store.get('player');
            if (playerState) {
                html += '<div class="dev-state-group">';
                html += '<div class="dev-state-label">Player</div>';
                if (playerState.hp !== null) {
                    html += '<div class="dev-state-value">HP: ' + playerState.hp + '/' + playerState.maxHp + '</div>';
                }
                if (playerState.mana !== null) {
                    html += '<div class="dev-state-sublabel">MP: ' + playerState.mana + '/' + playerState.maxMana + '</div>';
                }
                html += '</div>';

                // Flags
                if (playerState.flags && playerState.flags.size > 0) {
                    html += '<div class="dev-state-group">';
                    html += '<div class="dev-state-label">Flags (' + playerState.flags.size + ')</div>';
                    html += '<div class="dev-state-list">';
                    playerState.flags.forEach(function(flag) {
                        html += '<span class="dev-state-tag">' + flag + '</span>';
                    });
                    html += '</div>';
                    html += '</div>';
                }

                // Inventory
                var inv = playerState.inventory;
                if (inv && (inv.keyItems.length > 0 || Object.keys(inv.consumables).length > 0)) {
                    html += '<div class="dev-state-group">';
                    html += '<div class="dev-state-label">Inventory</div>';
                    html += '<div class="dev-state-list">';
                    inv.keyItems.forEach(function(item) {
                        html += '<span class="dev-state-tag item-key">🔑 ' + item + '</span>';
                    });
                    Object.keys(inv.consumables).forEach(function(item) {
                        html += '<span class="dev-state-tag item-consumable">📦 ' + item + ' x' + inv.consumables[item] + '</span>';
                    });
                    html += '</div>';
                    html += '</div>';
                }
            }

            // Battle state
            var battleState = store.get('battle');
            if (battleState) {
                html += '<div class="dev-state-group">';
                html += '<div class="dev-state-label">Battle</div>';
                html += '<div class="dev-state-value">Active</div>';
                html += '</div>';
            }
        } else {
            html = '<div class="dev-state-empty">Store not available</div>';
        }

        elements.stateViewer.innerHTML = html || '<div class="dev-state-empty">No state data</div>';
    }

    // =========================================================================
    // EVENT SUBSCRIPTIONS
    // =========================================================================

    /**
     * Subscribe to eventBus events for logging
     */
    function subscribeToEvents() {
        if (typeof eventBus === 'undefined') {
            callbacks.log.warn('[DevPanel] eventBus not available');
            return;
        }

        // List of events to monitor
        var eventsToMonitor = [
            // Scene events
            'scene:enter',
            'scene:exit',
            'scene:block:advance',
            'scene:choice:selected',
            // Battle events
            'battle:start',
            'battle:end',
            'battle:turn:start',
            'battle:turn:end',
            'battle:damage',
            'battle:heal',
            // Inventory events
            'inventory:item:added',
            'inventory:item:removed',
            'inventory:item:used',
            // State events
            'state:changed',
            'state:loaded',
            'state:reset',
            // Audio events
            'audio:music:play',
            'audio:music:stop',
            'audio:sfx:play',
            'audio:mute:change',
            'audio:volume:change',
            // QTE events
            'qte:start',
            'qte:result'
        ];

        eventsToMonitor.forEach(function(eventName) {
            var unsubscribe = eventBus.on(eventName, function(data) {
                addEventLogEntry(eventName, data);
            });
            eventLogState.unsubscribers.push(unsubscribe);
        });

        // Also subscribe store for state viewer updates
        if (typeof store !== 'undefined') {
            var unsubStore = store.subscribe(function() {
                // Debounce state viewer updates
                if (elements.stateViewer && callbacks.getDevMode && callbacks.getDevMode()) {
                    renderStateViewer();
                }
            });
            eventLogState.unsubscribers.push(unsubStore);
        }

        callbacks.log.debug('[DevPanel] Subscribed to ' + eventsToMonitor.length + ' events');
    }

    /**
     * Unsubscribe from all events
     */
    function unsubscribeFromEvents() {
        eventLogState.unsubscribers.forEach(function(unsub) {
            if (typeof unsub === 'function') unsub();
        });
        eventLogState.unsubscribers = [];
    }

    // =========================================================================
    // TERRAIN
    // =========================================================================

    /**
     * Set terrain during battle
     * @param {string} terrainId - Terrain ID
     */
    function setTerrain(terrainId) {
        if (typeof BattleCore === 'undefined' || !BattleCore.isActive()) {
            callbacks.log.warn('[Dev] Cannot set terrain - no active battle');
            return;
        }

        // Update battle state directly
        var state = BattleCore.getState();
        if (state) {
            state.terrain = terrainId;
            callbacks.log.debug('[Dev] Set terrain to: ' + terrainId);

            // Update UI
            if (typeof BattleUI !== 'undefined' && BattleUI.updateTerrain) {
                BattleUI.updateTerrain(terrainId, typeof BattleData !== 'undefined' ? BattleData.terrainTypes : {});
            }
        }
    }

    /**
     * Update terrain selector to match current battle terrain
     */
    function syncTerrainSelector() {
        if (!elements.terrainSelect) return;

        if (typeof BattleCore !== 'undefined' && BattleCore.isActive()) {
            var terrain = BattleCore.getTerrain();
            elements.terrainSelect.value = terrain || 'none';
        }
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        init: init,
        show: showDevModeIndicator,
        toggle: toggleDevPanelPortrait,
        setTerrain: setTerrain,
        syncTerrainSelector: syncTerrainSelector,

        // For external access
        makeDraggable: makeDraggable
    };
})();
