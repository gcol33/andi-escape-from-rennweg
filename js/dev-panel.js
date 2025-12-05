/**
 * Dev Panel Module - v0.6.0
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
 */

var DevPanel = (function() {
    'use strict';

    // =========================================================================
    // STATE
    // =========================================================================

    var elements = {
        indicator: null,
        panel: null,
        terrainSelect: null
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
        // Only create if ThemeUtils and themeConfig exist
        if (typeof ThemeUtils === 'undefined' || typeof themeConfig === 'undefined' || !themeConfig.available) {
            return;
        }

        var currentTheme = ThemeUtils.getCurrentTheme();
        var link = document.getElementById('theme-css');
        if (link && link.href) {
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

        // Theme selector
        container.appendChild(createThemeSection(currentTheme));

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

        document.body.appendChild(container);
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
        hitInput.placeholder = 'rand';
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
        damageInput.placeholder = 'rand';
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
