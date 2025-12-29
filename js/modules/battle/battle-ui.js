/**
 * Andi VN - Battle UI Module
 *
 * Handles all battle UI rendering, DOM manipulation, and visual effects.
 * This module is theme-agnostic - all visual styling comes from CSS.
 * The battle logic (BattleEngine) uses this module for all display updates.
 *
 * Separation of concerns:
 *   - BattleUI: DOM manipulation, element creation, animations, visual feedback
 *   - BattleEngine: Game state, combat logic, turn management
 *
 * Dependencies:
 *   - FloatingNumber: Floating damage/heal number animations
 *   - StatBar: Stat bar update helpers (HP, Mana, Limit, etc.)
 *   - ElementUtils: DOM manipulation utilities
 *
 * Usage:
 *   BattleUI.init(containerElement);
 *   BattleUI.createBattleUI(playerState, enemyState);
 *   BattleUI.updateHP('player', currentHP, maxHP);
 */

var BattleUI = (function() {
    'use strict';

    // === Module Dependencies ===
    // These modules are optional but provide cleaner code when available
    var _hasFloatingNumber = typeof FloatingNumber !== 'undefined';
    var _hasStatBar = typeof StatBar !== 'undefined';
    var _hasElementUtils = typeof ElementUtils !== 'undefined';

    // Use Logger module with fallback via Utils
    var _log = Utils.getLogger();

    // === Configuration ===
    // Values sourced from TUNING.js when available, with fallbacks
    var T = typeof TUNING !== 'undefined' ? TUNING : null;

    var config = {
        timing: {
            damageNumberDuration: T ? T.battle.timing.damageNumberFloat : 4000,
            screenShake: T ? T.battle.timing.screenShake : 300,
            fadeOutDuration: T ? T.battle.timing.fadeOut : 300,
            dialogueDuration: T ? T.battle.timing.dialogueBubble : 2500,
            battleIntro: T ? T.battle.timing.introDelay : 1500,
            battleOutro: T ? T.battle.timing.outroDelay : 2500,
            sparkleInterval: T ? T.battle.effects.sparkleInterval : 150,
            sparkleLifetime: T ? T.battle.effects.sparkleLifetime : 2000,
            uiTransition: T ? T.battle.timing.uiTransition : 1500,
            messageLingerDelay: T ? T.battle.timing.messageLingerDelay : 2200,
            statChangeDelay: 200  // Delay between sequential stat popups (HP -> Mana -> LB)
        },
        dice: {
            spinDuration: T ? T.battle.dice.spinDuration : 1800,
            spinInterval: T ? T.battle.dice.spinInterval : 70,
            lingerDelay: T ? T.battle.dice.lingerDelay : 500,
            typewriterSpeed: T ? T.battle.dice.typewriterSpeed : 25
        },
        effects: {
            spriteFlash: T ? T.battle.effects.spriteFlash : 300
        },
        ui: {
            battleLogMaxLines: T ? T.ui.battleLogMaxLines : 2,
            battleLogLineHeight: T ? T.ui.battleLogLineHeight : 2.2,  // rem units
            battleChoicesHeight: T ? T.ui.battleChoicesHeight : 7.5,  // rem - 2 rows of buttons
            battleLogPadding: T ? T.ui.battleLogPadding : 1.5,       // rem - panel padding
            scrollThreshold: T ? T.ui.battleLogScrollThreshold : 5   // px hidden before auto-scroll
        }
    };

    // === DOM Element Cache ===
    var elements = {
        container: null,
        battleUI: null,
        textBox: null,
        // Player stats
        playerStats: null,
        playerHPBar: null,
        playerHPText: null,
        playerHPLabel: null,
        playerManaBar: null,
        playerManaText: null,
        playerManaLabel: null,
        playerStatuses: null,
        playerStaggerFill: null,
        playerACDisplay: null,
        // Enemy stats
        enemyStats: null,
        enemyHPBar: null,
        enemyHPText: null,
        enemyLabel: null,
        enemyStatuses: null,
        enemyStaggerFill: null,
        // Other UI
        limitBar: null,
        limitText: null,
        terrainIndicator: null,
        battleLogContent: null,
        battleLogRow1: null,
        battleLogRow2: null,
        battleLog: null,
        battleChoices: null
    };

    // Animation state
    var animationState = {
        active: false,
        timeouts: [],
        damageQueue: [],
        statUpdateQueue: [],  // Queue for HP/mana/limit bar updates
        onComplete: null,
        // Click-to-skip state
        typewriterSkipData: null,  // { segments, styledElements, rows, callback }
        isTyping: false
    };

    // === Initialization ===

    /**
     * Initialize the UI module
     * @param {HTMLElement} containerEl - The main VN container element
     * @param {HTMLElement} textBoxEl - The text box element
     */
    function init(containerEl, textBoxEl) {
        elements.container = containerEl || document.getElementById('vn-container');
        elements.textBox = textBoxEl || document.getElementById('text-box');
    }

    // SFX delegated to shared BattleUtils
    function setSfxCallback(callback) {
        if (typeof BattleUtils !== 'undefined') BattleUtils.setSfxCallback(callback);
    }
    function playSfx(filename) {
        if (typeof BattleUtils !== 'undefined') BattleUtils.playSfx(filename);
    }

    // === Text Box Management ===

    function hideTextBox() {
        // elements.textBox is cached in init() - only fallback query if init wasn't called
        if (!elements.textBox) {
            elements.textBox = document.getElementById('text-box');
        }
        if (elements.textBox) {
            elements.textBox.classList.add('battle-mode');
        }
    }

    function showTextBox() {
        // elements.textBox is cached in init() - use cached reference
        if (elements.textBox) {
            elements.textBox.classList.remove('battle-mode');
        }
    }

    // === Main Battle UI Creation ===

    /**
     * Create the battle UI elements
     * @param {object} playerState - Player state object
     * @param {object} enemyState - Enemy state object
     */
    function createBattleUI(playerState, enemyState) {
        if (!elements.container) {
            elements.container = document.getElementById('vn-container');
        }
        if (!elements.container) return;

        hideTextBox();

        // Don't recreate if already exists
        if (document.getElementById('battle-ui')) {
            cacheElements();
            return;
        }

        var battleUI = document.createElement('div');
        battleUI.id = 'battle-ui';
        battleUI.className = 'battle-ui';

        // Terrain indicator (top center) - uses anchor system
        var terrainIndicator = document.createElement('div');
        terrainIndicator.id = 'terrain-indicator';
        terrainIndicator.className = 'terrain-indicator anchor anchor--top-center';

        // Player stats panel
        var playerStats = createPlayerStatsPanel(playerState);

        // Enemy stats panel
        var enemyStats = createEnemyStatsPanel(enemyState);

        // Battle log panel - uses anchor--bottom-flush for full-width bottom positioning
        var battleLog = document.createElement('div');
        battleLog.id = 'battle-log-panel';
        battleLog.className = 'battle-log-panel anchor anchor--bottom-flush';

        // Calculate log content height for fixed rows
        // Each row = fontSize * lineHeight, plus padding and gap between rows
        var maxLines = config.ui.battleLogMaxLines || 2;
        var fontSize = T && T.ui ? T.ui.battleTextSize : 0.95;  // rem
        var lineHeight = config.ui.battleLogLineHeight || 1.6;
        var rowHeight = fontSize * lineHeight;
        var padding = T && T.ui ? T.ui.battleLogPadding : 0.5;
        var gap = T && T.ui ? T.ui.battleLogRowGap : 0.2;
        var logContentHeight = (maxLines * rowHeight) + padding + ((maxLines - 1) * gap);
        battleLog.style.setProperty('--battle-log-content-height', logContentHeight + 'rem');

        // Create battle log with fixed row containers (no scrolling needed)
        battleLog.innerHTML =
            '<div id="battle-log-content" class="battle-log-content">' +
                '<div id="battle-log-row-1" class="battle-log-row"></div>' +
                '<div id="battle-log-row-2" class="battle-log-row"></div>' +
            '</div>' +
            '<div id="battle-choices" class="battle-choices"></div>';

        // Create player row container (for portrait mode: stats + summon side by side)
        var playerRow = document.createElement('div');
        playerRow.id = 'player-row';
        playerRow.className = 'player-row';
        playerRow.appendChild(playerStats);
        // Player summon slot - summons will be moved here in portrait mode
        var playerSummonSlot = document.createElement('div');
        playerSummonSlot.id = 'player-summon-slot';
        playerSummonSlot.className = 'player-summon-slot';
        playerRow.appendChild(playerSummonSlot);

        // Create enemy row container (for portrait mode: summon + stats side by side)
        var enemyRow = document.createElement('div');
        enemyRow.id = 'enemy-row';
        enemyRow.className = 'enemy-row';
        // Enemy summon slot - summons will be moved here in portrait mode
        var enemySummonSlot = document.createElement('div');
        enemySummonSlot.id = 'enemy-summon-slot';
        enemySummonSlot.className = 'enemy-summon-slot';
        enemyRow.appendChild(enemySummonSlot);
        enemyRow.appendChild(enemyStats);

        battleUI.appendChild(terrainIndicator);
        battleUI.appendChild(playerRow);
        battleUI.appendChild(enemyRow);
        battleUI.appendChild(battleLog);
        elements.container.appendChild(battleUI);

        cacheElements();
    }

    /**
     * Create player stats panel HTML
     */
    function createPlayerStatsPanel(playerState) {
        var panel = document.createElement('div');
        panel.id = 'player-stats-panel';
        // Use both legacy class for backwards compat AND new anchor classes
        panel.className = 'battle-stats-panel player-stats anchor anchor--bottom-left';
        panel.innerHTML =
            '<div class="stats-header">' +
                '<span class="player-name-text">' + (playerState.name || 'Player') + '</span>' +
                '<span id="player-statuses" class="status-icon-slot"></span>' +
                '<span id="player-ac-display" class="ac-display">(AC ' + (playerState.ac || 10) + ')</span>' +
            '</div>' +
            '<div class="stat-row hp-row">' +
                '<span id="player-hp-label" class="stat-label">HP</span>' +
                '<div class="stat-bar-outer"><div id="player-hp-bar" class="stat-bar hp-bar hp-high"></div></div>' +
                '<span id="player-hp-text" class="stat-value"></span>' +
            '</div>' +
            '<div class="stat-row mp-row">' +
                '<span id="player-mana-label" class="stat-label">MP</span>' +
                '<div class="stat-bar-outer"><div id="player-mana-bar" class="stat-bar mana-bar"></div></div>' +
                '<span id="player-mana-text" class="stat-value"></span>' +
            '</div>' +
            '<div class="stat-row limit-row">' +
                '<span class="stat-label limit-label">LB</span>' +
                '<div class="stat-bar-outer"><div id="limit-bar" class="stat-bar limit-bar"></div></div>' +
                '<span id="limit-text" class="stat-value">0%</span>' +
            '</div>' +
            '<div id="player-stagger-container" class="stagger-container">' +
                '<div id="player-stagger-bar" class="stagger-bar"><div id="player-stagger-fill" class="stagger-fill"></div></div>' +
            '</div>';
        return panel;
    }

    /**
     * Create enemy stats panel HTML
     */
    function createEnemyStatsPanel(enemyState) {
        var panel = document.createElement('div');
        panel.id = 'enemy-stats-panel';
        // Use both legacy class for backwards compat AND new anchor classes
        panel.className = 'battle-stats-panel enemy-stats anchor anchor--top-right';
        panel.innerHTML =
            '<div class="stats-header">' +
                '<span id="enemy-hp-label" class="enemy-name-text">' + (enemyState.name || 'Enemy') + '</span>' +
                '<span id="enemy-statuses" class="status-icon-slot"></span>' +
            '</div>' +
            '<div class="stat-row hp-row">' +
                '<span class="stat-label">HP</span>' +
                '<div class="stat-bar-outer"><div id="enemy-hp-bar" class="stat-bar hp-bar hp-high"></div></div>' +
                '<span id="enemy-hp-text" class="stat-value"></span>' +
            '</div>' +
            '<div id="enemy-stagger-container" class="stagger-container">' +
                '<div id="enemy-stagger-bar" class="stagger-bar"><div id="enemy-stagger-fill" class="stagger-fill"></div></div>' +
            '</div>';
        return panel;
    }

    /**
     * Cache DOM element references
     */
    function cacheElements() {
        elements.battleUI = document.getElementById('battle-ui');
        elements.playerStats = document.getElementById('player-stats-panel');
        elements.enemyStats = document.getElementById('enemy-stats-panel');
        elements.playerHPBar = document.getElementById('player-hp-bar');
        elements.playerHPText = document.getElementById('player-hp-text');
        elements.playerHPLabel = document.getElementById('player-hp-label');
        elements.playerManaBar = document.getElementById('player-mana-bar');
        elements.playerManaText = document.getElementById('player-mana-text');
        elements.playerManaLabel = document.getElementById('player-mana-label');
        elements.limitBar = document.getElementById('limit-bar');
        elements.limitText = document.getElementById('limit-text');
        elements.playerStatuses = document.getElementById('player-statuses');
        elements.playerStaggerFill = document.getElementById('player-stagger-fill');
        elements.playerACDisplay = document.getElementById('player-ac-display');
        elements.enemyHPBar = document.getElementById('enemy-hp-bar');
        elements.enemyHPText = document.getElementById('enemy-hp-text');
        elements.enemyLabel = document.getElementById('enemy-hp-label');
        elements.enemyStatuses = document.getElementById('enemy-statuses');
        elements.enemyStaggerFill = document.getElementById('enemy-stagger-fill');
        elements.terrainIndicator = document.getElementById('terrain-indicator');
        elements.battleLogContent = document.getElementById('battle-log-content');
        elements.battleLogRow1 = document.getElementById('battle-log-row-1');
        elements.battleLogRow2 = document.getElementById('battle-log-row-2');
        // battleLog points to row 2 - the active typing row
        elements.battleLog = elements.battleLogRow2;
        elements.battleChoices = document.getElementById('battle-choices');
    }

    /**
     * Get the active row for new content (row 2)
     * Also handles shifting content when starting a new message
     */
    function getActiveLogRow() {
        return elements.battleLogRow2 || document.getElementById('battle-log-row-2');
    }

    /**
     * Prepare log for new message - shift existing content up
     * Call this before starting a new typewriter message
     */
    function prepareLogForNewMessage() {
        // Stop any ongoing typewriter to prevent race conditions when rapidly skipping
        if (animationState.isTyping) {
            animationState.timeouts.forEach(function(t) { clearTimeout(t); });
            animationState.timeouts = [];
            animationState.isTyping = false;
            animationState.typewriterSkipData = null;
        }

        var row1 = elements.battleLogRow1 || document.getElementById('battle-log-row-1');
        var row2 = elements.battleLogRow2 || document.getElementById('battle-log-row-2');
        if (!row1 || !row2) return;

        // Move row 2 content to row 1
        row1.innerHTML = row2.innerHTML;
        // Clear row 2 for new content
        row2.innerHTML = '';
    }

    /**
     * Clear all log content (both rows)
     */
    function clearLog() {
        var row1 = elements.battleLogRow1 || document.getElementById('battle-log-row-1');
        var row2 = elements.battleLogRow2 || document.getElementById('battle-log-row-2');
        if (row1) row1.innerHTML = '';
        if (row2) row2.innerHTML = '';
    }

    // === UI Visibility ===

    function showUI() {
        if (elements.battleUI) {
            elements.battleUI.style.display = 'block';
        }
    }

    function hideUI() {
        // Query DOM directly - cached reference may be null after cleanup()
        var battleUI = document.getElementById('battle-ui');
        if (battleUI) battleUI.style.display = 'none';
    }

    function destroyUI() {
        Utils.removeElement(document.getElementById('battle-ui'));
        // Clear cached references
        elements.battleUI = null;
        elements.playerStats = null;
        elements.enemyStats = null;
        elements.battleLog = null;
    }

    /**
     * Full cleanup of battle UI resources
     * Call when battle ends or scene changes to prevent memory leaks
     */
    function cleanup() {
        // Clear animation state and tracked timeouts
        clearAnimationState();

        // Clear battle-specific timers via TimerManager
        if (typeof TimerManager !== 'undefined') {
            TimerManager.clearAll('battle');
            TimerManager.clearAll('battle-ui');
            TimerManager.clearAll('ui-feedback');
        }

        // Clear battle-specific listeners via ListenerManager
        if (typeof ListenerManager !== 'undefined') {
            ListenerManager.removeAll('battle');
            ListenerManager.removeAll('battle-ui');
        }

        // Remove any floating damage numbers still in DOM
        var floatingNumbers = document.querySelectorAll('.floating-number, .floating-damage, .stat-change-popup');
        floatingNumbers.forEach(function(el) {
            Utils.removeElement(el);
        });

        // Remove any lingering battle effects
        var battleEffects = document.querySelectorAll('.attack-effect, .screen-flash, .battle-intro-overlay, .battle-outro-overlay');
        battleEffects.forEach(function(el) {
            Utils.removeElement(el);
        });

        // Clear all summon sprites
        clearAllSummons();

        _log.debug('BattleUI', 'Cleanup complete');
    }

    // === HP/MP/Limit Display Updates ===

    /**
     * Update player HP display
     * @param {number} hp - Current HP
     * @param {number} maxHP - Maximum HP
     * @param {boolean} hasRegen - Whether player has active HP regen
     */
    function updatePlayerHP(hp, maxHP, hasRegen) {
        if (!elements.playerHPBar) cacheElements();
        if (!elements.playerHPBar || !elements.playerHPText) return;

        // Use StatBar module if available
        if (_hasStatBar) {
            StatBar.updateHP(elements.playerHPBar, elements.playerHPText, hp, maxHP, hasRegen, elements.playerHPLabel);
            return;
        }

        // Fallback implementation
        var percent = (hp / maxHP) * 100;
        elements.playerHPBar.style.width = percent + '%';
        elements.playerHPText.textContent = hp + '/' + maxHP;

        var hpState = percent > 50 ? 'hp-high' : percent > 25 ? 'hp-medium' : 'hp-low';
        var regenClass = hasRegen ? ' hp-regen' : '';
        elements.playerHPBar.className = 'stat-bar hp-bar ' + hpState + regenClass;
        // Apply regen pulse to text and label elements
        elements.playerHPText.className = 'stat-value' + regenClass;
        if (elements.playerHPLabel) {
            elements.playerHPLabel.className = 'stat-label' + regenClass;
        }
    }

    /**
     * Update player mana display
     * @param {number} mana - Current mana
     * @param {number} maxMana - Maximum mana
     * @param {boolean} hasRegen - Whether player has active mana regen
     */
    function updatePlayerMana(mana, maxMana, hasRegen) {
        if (!elements.playerManaBar) cacheElements();
        if (!elements.playerManaBar || !elements.playerManaText) return;

        // Use StatBar module if available
        if (_hasStatBar) {
            StatBar.updateMana(elements.playerManaBar, elements.playerManaText, mana, maxMana, hasRegen, elements.playerManaLabel);
            return;
        }

        // Fallback implementation
        var percent = (mana / maxMana) * 100;
        elements.playerManaBar.style.width = percent + '%';
        elements.playerManaText.textContent = mana + '/' + maxMana;

        var regenClass = hasRegen ? ' mana-regen' : '';
        elements.playerManaBar.className = 'stat-bar mana-bar' + regenClass;
        // Apply regen pulse to text and label elements
        elements.playerManaText.className = 'stat-value' + regenClass;
        if (elements.playerManaLabel) {
            elements.playerManaLabel.className = 'stat-label' + regenClass;
        }
    }

    /**
     * Update enemy HP display
     * @param {number} hp - Current HP
     * @param {number} maxHP - Maximum HP
     * @param {string} name - Enemy name (optional)
     */
    function updateEnemyHP(hp, maxHP, name) {
        if (!elements.enemyHPBar) cacheElements();
        if (!elements.enemyHPBar || !elements.enemyHPText) return;

        if (name && elements.enemyLabel) {
            elements.enemyLabel.textContent = name;
        }

        // Use StatBar module if available (no regen for enemies)
        if (_hasStatBar) {
            StatBar.updateHP(elements.enemyHPBar, elements.enemyHPText, hp, maxHP, false, null);
            return;
        }

        // Fallback implementation
        var percent = (hp / maxHP) * 100;
        elements.enemyHPBar.style.width = percent + '%';
        elements.enemyHPText.textContent = hp + '/' + maxHP;

        var hpState = percent > 50 ? 'hp-high' : percent > 25 ? 'hp-medium' : 'hp-low';
        elements.enemyHPBar.className = 'stat-bar hp-bar ' + hpState;
    }

    /**
     * Update limit break meter display
     * @param {number} charge - Current limit charge (0-100)
     */
    function updateLimitBar(charge) {
        if (!elements.limitBar) cacheElements();
        if (!elements.limitBar) return;

        // Use StatBar module if available
        if (_hasStatBar) {
            StatBar.updateLimit(elements.limitBar, elements.limitText, charge);
            return;
        }

        // Fallback implementation
        elements.limitBar.style.width = charge + '%';

        if (charge >= 100) {
            elements.limitBar.className = 'stat-bar limit-bar limit-ready';
        } else if (charge >= 75) {
            elements.limitBar.className = 'stat-bar limit-bar limit-high';
        } else {
            elements.limitBar.className = 'stat-bar limit-bar';
        }

        if (elements.limitText) {
            elements.limitText.textContent = Math.floor(charge) + '%';
        }
    }

    // === AC Display ===

    /**
     * Update player AC display
     * @param {number} baseAC - Base AC value
     * @param {number} effectiveAC - Effective AC with modifiers
     */
    function updatePlayerAC(baseAC, effectiveAC) {
        if (!elements.playerACDisplay) {
            elements.playerACDisplay = document.getElementById('player-ac-display');
        }
        if (!elements.playerACDisplay) return;

        // Use StatBar module if available
        if (_hasStatBar) {
            StatBar.updateAC(elements.playerACDisplay, baseAC, effectiveAC);
            return;
        }

        // Fallback implementation
        // Compact format: (AC XX) or (AC XX+) or (AC XX-)
        var acText = '(AC ' + effectiveAC + ')';
        elements.playerACDisplay.classList.remove('boosted', 'reduced');

        if (effectiveAC > baseAC) {
            acText = '(AC ' + effectiveAC + '+)';
            elements.playerACDisplay.classList.add('boosted');
        } else if (effectiveAC < baseAC) {
            acText = '(AC ' + effectiveAC + '-)';
            elements.playerACDisplay.classList.add('reduced');
        }

        elements.playerACDisplay.textContent = acText;
    }

    // === Status Effects Display ===

    /**
     * Update status icons for a target
     * @param {string} target - 'player' or 'enemy'
     * @param {Array} statuses - Array of { type, duration, stacks }
     * @param {object} statusDefs - Status effect definitions
     */
    function updateStatuses(target, statuses, statusDefs) {
        var container = target === 'player' ? elements.playerStatuses : elements.enemyStatuses;
        if (!container) {
            container = document.getElementById(target + '-statuses');
        }
        if (!container) return;

        container.innerHTML = '';

        for (var i = 0; i < statuses.length; i++) {
            var status = statuses[i];
            var def = statusDefs[status.type];
            if (!def) continue;

            var icon = document.createElement('span');
            icon.className = 'status-icon';
            icon.style.color = def.color;
            icon.title = def.name + ' (' + status.duration + ' turns)' +
                (status.stacks > 1 ? ' x' + status.stacks : '');
            icon.textContent = def.icon;

            if (status.stacks > 1) {
                var stackNum = document.createElement('sub');
                stackNum.textContent = status.stacks;
                icon.appendChild(stackNum);
            }

            container.appendChild(icon);
        }
    }

    // === Stagger Display ===

    /**
     * Update stagger bar for a target
     * @param {string} target - 'player' or 'enemy'
     * @param {number} stagger - Current stagger value
     * @param {number} threshold - Stagger threshold
     */
    function updateStagger(target, stagger, threshold) {
        var fill = target === 'player' ? elements.playerStaggerFill : elements.enemyStaggerFill;
        var containerId = target + '-stagger-container';
        var container = document.getElementById(containerId);

        if (!fill) {
            fill = document.getElementById(target + '-stagger-fill');
        }
        if (!fill) return;

        var percent = (stagger / threshold) * 100;
        fill.style.width = percent + '%';

        // Show/hide container based on stagger value
        if (container) {
            if (stagger > 0) {
                container.classList.add('has-stagger');
            } else {
                container.classList.remove('has-stagger');
            }
        }

        // Color changes as stagger builds
        if (percent >= 75) {
            fill.className = 'stagger-fill stagger-danger';
        } else if (percent >= 50) {
            fill.className = 'stagger-fill stagger-warning';
        } else {
            fill.className = 'stagger-fill';
        }
    }

    // === Terrain Display ===

    /**
     * Update terrain indicator
     * @param {string} terrainId - Terrain type ID
     * @param {object} terrainDefs - Terrain type definitions
     */
    function updateTerrain(terrainId, terrainDefs) {
        if (!elements.terrainIndicator) {
            elements.terrainIndicator = document.getElementById('terrain-indicator');
        }
        if (!elements.terrainIndicator) return;

        var terrain = terrainDefs[terrainId];
        if (!terrain || terrainId === 'none') {
            elements.terrainIndicator.style.display = 'none';
        } else {
            elements.terrainIndicator.style.display = 'block';
            elements.terrainIndicator.innerHTML =
                '<span class="terrain-icon" style="background-color: ' + terrain.color + '">' +
                terrain.icon + '</span> ' + terrain.name;
            elements.terrainIndicator.title = terrain.description;
        }
    }

    // === Summon Display ===

    /**
     * Update summon indicator
     * @param {object} summon - Summon state or null
     * @param {object} summonDefs - Summon type definitions
     */
    function updateSummon(summon, summonDefs) {
        var summonContainer = document.getElementById('summon-indicator');

        if (!summon) {
            if (summonContainer) {
                summonContainer.style.display = 'none';
            }
            return;
        }

        if (!summonContainer && elements.container) {
            summonContainer = document.createElement('div');
            summonContainer.id = 'summon-indicator';
            summonContainer.className = 'summon-indicator';
            elements.container.appendChild(summonContainer);
        }

        if (summonContainer) {
            summonContainer.style.display = 'block';
            summonContainer.innerHTML = '<span class="summon-icon">' + summon.icon + '</span> ' +
                summon.name + ' <span class="summon-duration">(' + summon.duration + ' turns)</span>';
            summonContainer.title = summonDefs && summonDefs[summon.id] ?
                summonDefs[summon.id].description : '';
        }
    }

    // === Battle Log ===

    /**
     * Update battle log content with optional dice animation
     * Like old battle.js: clears log and shows only the latest entry
     * @param {string} html - HTML content to display
     * @param {object} rollData - Optional roll animation data { roll, isCrit, isFumble }
     * @param {function} callback - Optional callback when animation/linger completes
     * @param {object} options - Optional { onTextComplete: function } called when text finishes but BEFORE linger
     */
    function updateBattleLog(html, rollData, callback, options) {
        // Get row containers for the fixed row system
        var rows = BattleUtils.getBattleLogRows();
        if (!rows) {
            // Element not found - still call callbacks to prevent freeze
            if (options && options.onTextComplete) options.onTextComplete();
            if (callback) callback();
            return;
        }

        // Debug: detect if we're interrupting an existing animation
        if (animationState.active) {
            _log.warn('BattleUI', 'updateBattleLog called while animation active! Current text:', rows.row1.textContent + ' | ' + rows.row2.textContent, '| New html:', html ? html.substring(0, 50) : html);
        }

        // Clear previous animation state
        clearAnimationState();

        // Shift rows - move previous message to row1, prepare row2 for new message
        BattleUtils.shiftBattleLogRows(rows);

        // Store onTextComplete callback for completeAnimation to call
        animationState.onTextComplete = options && options.onTextComplete ? options.onTextComplete : null;

        // Wrapper to add linger delay before callback (skippable via click/space)
        var lingerCallback = function() {
            if (callback) {
                var delay = (options && options.lingerDelay !== undefined) ? options.lingerDelay : config.timing.messageLingerDelay;
                // Use skippable timeout if BattleDiceUI available
                if (typeof BattleDiceUI !== 'undefined' && BattleDiceUI.diceTimeout) {
                    BattleDiceUI.diceTimeout(callback, delay);
                } else {
                    var t = setTimeout(callback, delay);
                    animationState.timeouts.push(t);
                }
            }
        };

        // Check if we need to animate a dice roll
        if (rollData && rollData.roll !== undefined) {
            animationState.active = true;
            animationState.onComplete = lingerCallback;

            // Parse the HTML to find the roll value and animate it
            var temp = document.createElement('div');
            temp.innerHTML = html;

            var rollResultSpan = temp.querySelector('.roll-result strong');
            if (rollResultSpan) {
                // Replace the roll value with animated dice placeholder
                rollResultSpan.innerHTML = '<span class="dice-number">?</span>';
                html = temp.innerHTML;
            }

            elements.battleLog.innerHTML = html;
            // Scroll to bottom so newest content is visible
            scrollToBottomIfNeeded(elements.battleLog);

            var diceNum = elements.battleLog.querySelector('.dice-number');
            if (diceNum) {
                animateDiceRoll(diceNum, rollData.roll, rollData.isCrit, rollData.isFumble, function() {
                    completeAnimation();
                });
            } else {
                typewriterEffect(elements.battleLog, html, function() {
                    completeAnimation();
                });
            }
        } else {
            // Use typewriter effect for all non-roll messages (e.g., "Defending!")
            animationState.active = true;
            animationState.onComplete = lingerCallback;
            typewriterEffect(elements.battleLog, html, function() {
                // Typewriter uses placeholder that reserves space, so scroll is already correct
                completeAnimation();
            });
        }
    }

    /**
     * Clear any ongoing animations
     */
    function clearAnimationState() {
        animationState.timeouts.forEach(function(t) { clearTimeout(t); });
        animationState.timeouts = [];
        animationState.damageQueue = [];
        animationState.statUpdateQueue = [];
        animationState.onComplete = null;
        animationState.onTextComplete = null;
        animationState.active = false;
        animationState.typewriterSkipData = null;
        animationState.isTyping = false;
    }

    /**
     * Skip typewriter animation - skip to end of current row only
     * Multiple clicks required for multi-row text (better scroll behavior)
     * @returns {boolean} True if typewriter was skipped, false if nothing to skip
     */
    function skipTypewriter() {
        if (!animationState.isTyping || !animationState.typewriterSkipData) {
            return false;
        }

        var skipData = animationState.typewriterSkipData;
        var rows = skipData.rows;
        var segments = skipData.segments;
        var styledElements = skipData.styledElements;
        var position = skipData.getPosition();
        var segmentIndex = position.segmentIndex;

        // Clear pending timeouts
        animationState.timeouts.forEach(function(t) { clearTimeout(t); });
        animationState.timeouts = [];

        // Re-verify rows are valid
        if (!rows || !rows.row2 || !rows.row2.parentNode) {
            rows = BattleUtils.getBattleLogRows();
            skipData.rows = rows;
        }

        if (!rows || segmentIndex >= segments.length) {
            var callback = skipData.callback;
            animationState.typewriterSkipData = null;
            animationState.isTyping = false;
            if (callback) callback();
            return true;
        }

        // Skip pressed: complete current segment (one row at a time)
        var currentSegment = segments[segmentIndex];

        // Clear row2 and render the complete current segment
        rows.row2.innerHTML = '';
        for (var j = 0; j < currentSegment.length; j++) {
            var ch = currentSegment[j];
            if (ch === '\x00') {
                var pEnd = currentSegment.indexOf('\x00', j + 1);
                if (pEnd !== -1) {
                    var ph = currentSegment.substring(j, pEnd + 1);
                    var m = ph.match(/\x00STYLED(\d+)\x00/);
                    if (m && styledElements[parseInt(m[1])]) {
                        var st = styledElements[parseInt(m[1])];
                        var sp = document.createElement('span');
                        sp.className = st.className;
                        sp.textContent = st.content;
                        rows.row2.appendChild(sp);
                        j = pEnd;
                        continue;
                    }
                }
            }
            rows.row2.appendChild(document.createTextNode(ch));
        }

        // Check if this was the last segment
        if (segmentIndex >= segments.length - 1) {
            // Complete the animation
            var callback = skipData.callback;
            animationState.typewriterSkipData = null;
            animationState.isTyping = false;
            if (callback) callback();
        } else {
            // More segments - shift rows, update position, and continue typing
            BattleUtils.shiftBattleLogRows(rows);
            skipData.setPosition(segmentIndex + 1, 0);
            // Restart typewriter for next segment
            if (skipData.renderNextChar) {
                skipData.renderNextChar();
            }
        }

        return true;
    }

    /**
     * Full cleanup - call when battle ends to clear DOM cache and prevent memory leaks
     */
    function cleanup() {
        // Clear any ongoing animations
        clearAnimationState();

        // Clear DOM element cache to prevent memory leaks
        for (var key in elements) {
            if (elements.hasOwnProperty(key)) {
                elements[key] = null;
            }
        }

        // Clear battle log rows
        var rows = BattleUtils.getBattleLogRows();
        if (rows) {
            BattleUtils.clearBattleLogRows(rows);
        }
    }

    /**
     * Complete animation and flush damage queue
     * Order: flush damage queue -> onTextComplete -> linger -> onComplete
     */
    function completeAnimation() {
        flushDamageQueue();
        animationState.active = false;

        // Call onTextComplete BEFORE linger (so effects apply immediately when text finishes)
        if (animationState.onTextComplete) {
            var textCb = animationState.onTextComplete;
            animationState.onTextComplete = null;
            textCb();
        }

        // Now start linger delay, then call onComplete
        if (animationState.onComplete) {
            var cb = animationState.onComplete;
            animationState.onComplete = null;
            cb();
        }
    }

    /**
     * Queue a damage number for display after animation
     */
    function queueDamageNumber(amount, target, type) {
        animationState.damageQueue.push({ amount: amount, target: target, type: type });
    }

    /**
     * Queue a stat change for display after animation
     */
    function queueStatChange(statType, amount, target, label) {
        animationState.damageQueue.push({ statType: statType, amount: amount, target: target, label: label, isStatChange: true });
    }

    /**
     * Display all queued damage numbers, stat changes, and stat bar updates
     */
    function flushDamageQueue() {
        // First, apply queued stat bar updates (HP/mana/limit)
        animationState.statUpdateQueue.forEach(function(update) {
            switch (update.type) {
                case 'playerHP':
                    updatePlayerHP(update.hp, update.maxHP, update.hasRegen);
                    break;
                case 'playerMana':
                    updatePlayerMana(update.mana, update.maxMana, update.hasRegen);
                    break;
                case 'enemyHP':
                    updateEnemyHP(update.hp, update.maxHP, update.name);
                    break;
                case 'limitBar':
                    updateLimitBar(update.charge);
                    break;
            }
        });
        animationState.statUpdateQueue = [];

        // Then show floating damage numbers and stat change popups
        animationState.damageQueue.forEach(function(dmg) {
            if (dmg.isStatChange) {
                showStatChangeImmediate(dmg.statType, dmg.amount, dmg.target, dmg.label);
            } else {
                showDamageNumberImmediate(dmg.amount, dmg.target, dmg.type);
            }
        });
        animationState.damageQueue = [];
    }

    // === Dice Roll Animation ===

    /**
     * Animate a dice roll with slot machine effect
     * @param {Element} element - The element to animate
     * @param {number} finalValue - The final roll value
     * @param {boolean} isCrit - Is this a critical hit
     * @param {boolean} isFumble - Is this a fumble
     * @param {function} callback - Called when animation completes
     */
    function animateDiceRoll(element, finalValue, isCrit, isFumble, callback) {
        var duration = config.dice.spinDuration;
        var interval = config.dice.spinInterval;
        var lingerDelay = config.dice.lingerDelay;
        var elapsed = 0;
        var maxValue = 20;

        playSfx('dice_roll.ogg');

        function spin() {
            if (elapsed >= duration) {
                element.textContent = finalValue;
                element.classList.remove('dice-spinning');
                element.classList.add('dice-final');

                if (isCrit) {
                    element.classList.add('dice-crit');
                    playSfx('success.ogg');
                } else if (isFumble) {
                    element.classList.add('dice-fumble');
                    playSfx('failure.ogg');
                } else {
                    playSfx('click.ogg');
                }

                if (callback) {
                    var delay = isCrit || isFumble ? lingerDelay * 1.5 : lingerDelay;
                    var t = setTimeout(callback, delay);
                    animationState.timeouts.push(t);
                }
                return;
            }

            var progress = elapsed / duration;
            var randomChance = 1 - (progress * progress * progress);

            if (Math.random() < randomChance) {
                element.textContent = Math.floor(Math.random() * maxValue) + 1;
            } else {
                element.textContent = finalValue;
            }

            var currentInterval = interval + (progress * progress * interval * 3);
            elapsed += currentInterval;

            var t = setTimeout(spin, currentInterval);
            animationState.timeouts.push(t);
        }

        element.classList.add('dice-spinning');
        spin();
    }

    /**
     * Legacy function - kept for API compatibility but no longer shifts mid-typing
     * Row shifting now happens via prepareLogForNewMessage() before each message
     */
    function scrollToBottomIfNeeded(container) {
        // No-op: row shifting is handled by real-time overflow detection in typewriterEffect
    }

    /**
     * Typewriter effect with real-time overflow detection.
     * ALWAYS types into row2. When overflow detected, shifts (row2→row1) and continues.
     */
    function typewriterEffect(container, text, callback) {
        var speed = config.dice.typewriterSpeed;

        // Ensure click listener is active for click-to-skip
        if (typeof BattleDiceUI !== 'undefined' && BattleDiceUI.ensureClickListener) {
            BattleDiceUI.ensureClickListener();
        }

        // Get the row containers using shared utility
        var rows = BattleUtils.getBattleLogRows();

        // If no row system, fall back to simple typing
        if (!rows) {
            typewriterEffectSimple(container, text, callback);
            return;
        }

        // Ensure row2 is clear before starting (handles edge cases where previous content remains)
        if (rows.row2.innerHTML !== '') {
            rows.row2.innerHTML = '';
        }

        // Convert <br> tags to newlines before stripping other HTML
        var textWithNewlines = text.replace(/<br\s*\/?>/gi, '\n');

        // Preserve styled elements by converting them to placeholders
        // Matches <span class="roll-...">content</span> and stores for later restoration
        var styledElements = [];
        var textWithPlaceholders = textWithNewlines.replace(
            /<span\s+class="(roll-[^"]+)"[^>]*>([^<]+)<\/span>/gi,
            function(_match, className, content) {
                var placeholder = '\x00STYLED' + styledElements.length + '\x00';
                styledElements.push({ className: className, content: content });
                return placeholder;
            }
        );

        // Strip remaining HTML (but placeholders are preserved)
        var plainText = textWithPlaceholders.replace(/<[^>]*>/g, '');

        // Split by newlines to get segments
        var segments = plainText.split('\n').filter(function(s) { return s.trim(); });
        var segmentIndex = 0;
        var charIndex = 0;

        // Store skip data for click-to-skip (includes mutable position tracking)
        animationState.isTyping = true;
        animationState.typewriterSkipData = {
            segments: segments,
            styledElements: styledElements,
            rows: rows,
            // Mutable position - updated by renderNextChar, read by skipTypewriter
            getPosition: function() { return { segmentIndex: segmentIndex, charIndex: charIndex }; },
            setPosition: function(si, ci) { segmentIndex = si; charIndex = ci; },
            renderNextChar: null, // Set below after function is defined
            callback: function() {
                animationState.isTyping = false;
                animationState.typewriterSkipData = null;
                if (callback) callback();
            }
        };

        function renderNextChar() {
            if (segmentIndex >= segments.length) {
                animationState.isTyping = false;
                animationState.typewriterSkipData = null;
                if (callback) callback();
                return;
            }

            // Re-verify rows are still valid (could become stale if UI updates mid-animation)
            if (!rows || !rows.row2 || !rows.row2.parentNode) {
                rows = BattleUtils.getBattleLogRows();
                if (!rows) {
                    typewriterEffectSimple(container, segments.slice(segmentIndex).join(' '), callback);
                    return;
                }
            }

            var currentSegment = segments[segmentIndex];

            // End of segment - move to next
            if (charIndex >= currentSegment.length) {
                segmentIndex++;
                charIndex = 0;
                // Force a shift for new segment (acts like line break)
                if (segmentIndex < segments.length) {
                    BattleUtils.shiftBattleLogRows(rows);
                }
                renderNextChar();
                return;
            }

            var char = currentSegment[charIndex];

            // Handle styled element placeholders (inserted as complete styled spans)
            if (char === '\x00') {
                // Find the end of the placeholder
                var placeholderEnd = currentSegment.indexOf('\x00', charIndex + 1);
                if (placeholderEnd !== -1) {
                    var placeholder = currentSegment.substring(charIndex, placeholderEnd + 1);
                    var match = placeholder.match(/\x00STYLED(\d+)\x00/);
                    if (match && styledElements[parseInt(match[1])]) {
                        var styled = styledElements[parseInt(match[1])];
                        var styledSpan = document.createElement('span');
                        styledSpan.className = styled.className;
                        styledSpan.textContent = styled.content;
                        rows.row2.appendChild(styledSpan);

                        // ROBUST: Check for overflow after inserting styled element
                        // Styled spans can be large and cause overflow
                        try {
                            if (BattleUtils.checkBattleLogOverflow(rows)) {
                                // Move all text content to row1, keep styled span in row2
                                var textNodes = [];
                                var nodesToRemove = [];
                                rows.row2.childNodes.forEach(function(node) {
                                    if (node !== styledSpan) {
                                        if (node.nodeType === Node.TEXT_NODE) {
                                            textNodes.push(node.textContent);
                                        } else if (node.nodeType === Node.ELEMENT_NODE) {
                                            textNodes.push(node.outerHTML);
                                        }
                                        nodesToRemove.push(node);
                                    }
                                });
                                nodesToRemove.forEach(function(node) { node.remove(); });
                                if (textNodes.length > 0) {
                                    rows.row1.innerHTML = textNodes.join('');
                                }
                            }
                        } catch (e) {
                            console.error('[Typewriter] Styled overflow error:', e);
                        }

                        charIndex = placeholderEnd + 1;
                        var t = setTimeout(renderNextChar, 1000 / speed);
                        animationState.timeouts.push(t);
                        return;
                    }
                }
            }

            // Handle surrogate pairs (emoji, etc.)
            if (char.charCodeAt(0) >= 0xD800 && char.charCodeAt(0) <= 0xDBFF &&
                charIndex + 1 < currentSegment.length) {
                var nextChar = currentSegment[charIndex + 1];
                if (nextChar.charCodeAt(0) >= 0xDC00 && nextChar.charCodeAt(0) <= 0xDFFF) {
                    char = char + nextChar;
                    charIndex++;
                }
            }

            // Shift at word boundaries: when we're about to type a space, check if we should shift first
            // This prevents the visual "overflow then snap back" effect
            var shouldShiftBeforeTyping = false;
            if (char === ' ') {
                // About to type a space - check if row2 is getting close to full
                // We shift BEFORE adding the space, so the completed word goes to row1
                try {
                    if (BattleUtils.checkBattleLogOverflow(rows)) {
                        // Row2 is overflowing - shift current content to row1 before adding space
                        var currentContent = rows.row2.textContent || '';
                        if (currentContent.trim()) {
                            rows.row1.textContent = currentContent;
                            rows.row2.textContent = '';
                            shouldShiftBeforeTyping = true;
                        }
                    }
                } catch (e) {
                    console.error('[Typewriter] Pre-shift error:', e);
                }
            }

            // Now add the character
            var textNode = document.createTextNode(char);
            rows.row2.appendChild(textNode);

            // If we didn't shift on space, check for overflow now (fallback for edge cases)
            if (!shouldShiftBeforeTyping) {
                try {
                    if (BattleUtils.checkBattleLogOverflow(rows)) {
                        var fullText = rows.row2.textContent || '';
                        var lastSpaceIndex = fullText.lastIndexOf(' ');

                        if (lastSpaceIndex > 0) {
                            var beforeSpace = fullText.substring(0, lastSpaceIndex);
                            var afterSpace = fullText.substring(lastSpaceIndex + 1);

                            rows.row1.textContent = beforeSpace;
                            rows.row2.textContent = afterSpace;
                        }
                    }
                } catch (e) {
                    console.error('[Typewriter] Overflow error:', e);
                }
            }
            charIndex++;

            var t = setTimeout(renderNextChar, 1000 / speed);
            animationState.timeouts.push(t);
        }

        // Store reference for skip-to-row-end functionality
        animationState.typewriterSkipData.renderNextChar = renderNextChar;

        renderNextChar();
    }

    /**
     * Simple typewriter fallback (no row system)
     */
    function typewriterEffectSimple(container, text, callback) {
        var index = 0;
        var speed = config.dice.typewriterSpeed;

        function typeNext() {
            if (index < text.length) {
                if (text[index] === '<') {
                    var tagEnd = text.indexOf('>', index);
                    if (tagEnd !== -1) {
                        var tagContent = text.substring(index, tagEnd + 1);
                        var classMatch = tagContent.match(/^<(\w+)\s+class=/);
                        if (classMatch) {
                            var tagName = classMatch[1];
                            var closingTag = '</' + tagName + '>';
                            var closeIndex = text.indexOf(closingTag, tagEnd);
                            if (closeIndex !== -1) {
                                container.insertAdjacentHTML('beforeend', text.substring(index, closeIndex + closingTag.length));
                                index = closeIndex + closingTag.length;
                                typeNext();
                                return;
                            }
                        }
                        container.insertAdjacentHTML('beforeend', tagContent);
                        index = tagEnd + 1;
                        typeNext();
                        return;
                    }
                }

                var char = text[index];
                if (char.charCodeAt(0) >= 0xD800 && char.charCodeAt(0) <= 0xDBFF &&
                    index + 1 < text.length) {
                    var nextChar = text[index + 1];
                    if (nextChar.charCodeAt(0) >= 0xDC00 && nextChar.charCodeAt(0) <= 0xDFFF) {
                        char = char + nextChar;
                        index++;
                    }
                }

                container.appendChild(document.createTextNode(char));
                index++;

                var t = setTimeout(typeNext, 1000 / speed);
                animationState.timeouts.push(t);
            } else {
                if (callback) callback();
            }
        }

        typeNext();
    }

    // === Visual Effects ===

    // Track damage number positions for WoW-style staggering
    var damageNumberState = {
        lastX: 0,
        lastTime: 0,
        counter: 0
    };

    /**
     * Show floating damage number (WoW-style on sprites)
     * Uses the unified roll display system for consistent colors.
     *
     * @param {number} amount - Damage/heal amount
     * @param {string} target - 'player' or 'enemy'
     * @param {string} type - 'damage', 'heal', 'dot', 'crit', 'maxdamage', 'mindamage', 'miss'
     */
    function showDamageNumber(amount, target, type) {
        _log.debug('BattleUI', 'showDamageNumber amount:', amount, 'target:', target, 'type:', type, 'animationState.active:', animationState.active);
        if (animationState.active) {
            _log.debug('BattleUI', 'showDamageNumber Queuing damage number (animation active)');
            queueDamageNumber(amount, target, type);
        } else {
            _log.debug('BattleUI', 'showDamageNumber Showing immediately (animation not active)');
            showDamageNumberImmediate(amount, target, type);
        }
    }

    /**
     * Helper to get unified roll class for floating numbers.
     * Maps legacy type strings to the unified roll-{type}-{emphasis} system.
     */
    function getFloatingRollClass(type) {
        // Use BattleDiceUI helper if available, otherwise inline
        var getRollClass = (typeof BattleDiceUI !== 'undefined' && BattleDiceUI.getRollClass)
            ? BattleDiceUI.getRollClass
            : function(rollType, resultCategory) { return 'roll-' + rollType + '-' + resultCategory; };

        switch (type) {
            case 'crit':
                return getRollClass('damage', 'crit');
            case 'maxdamage':
                return getRollClass('damage', 'max');
            case 'mindamage':
                return getRollClass('damage', 'min');
            case 'damage':
            case 'dot':
                return getRollClass('damage', 'normal');
            case 'heal':
                return getRollClass('heal', 'normal');
            case 'maxheal':
                return getRollClass('heal', 'max');
            case 'minheal':
                return getRollClass('heal', 'min');
            case 'miss':
                return getRollClass('neutral', 'normal');
            default:
                return getRollClass('damage', 'normal');
        }
    }

    function showDamageNumberImmediate(amount, target, type) {
        // Use FloatingNumber module if available
        if (_hasFloatingNumber) {
            FloatingNumber.show(amount, target, type);
            return;
        }

        // Fallback implementation
        if (!elements.container) {
            elements.container = document.getElementById('vn-container');
        }
        if (!elements.container) return;

        var isCrit = type === 'crit';
        var isMaxDamage = type === 'maxdamage';
        var isMinDamage = type === 'mindamage';
        var isHeal = type === 'heal' || type === 'maxheal' || type === 'minheal';
        var isDot = type === 'dot';
        var isMiss = type === 'miss';
        var isACBoost = type === 'ac-boost';
        var damageNum = document.createElement('div');

        // Get unified roll class for consistent styling
        var rollClass = getFloatingRollClass(type);

        // For crit/max/min damage floating numbers, don't use the roll class (avoid glow effects)
        // Just use the base damage color class instead
        var floatingClass = rollClass;
        if (isCrit || isMaxDamage || isMinDamage) {
            floatingClass = 'roll-damage-normal';
        }

        // Set class and text based on type
        // Use Math.abs to prevent double minus signs if amount is already negative
        var displayAmount = Math.abs(amount);
        if (isMiss) {
            damageNum.className = 'damage-number wow-style ' + floatingClass;
            damageNum.textContent = 'MISS';
        } else if (isACBoost) {
            // AC boost uses its own class and shows +X AC format
            damageNum.className = 'damage-number wow-style ac-boost';
            damageNum.textContent = '+' + displayAmount + ' AC';
        } else {
            damageNum.className = 'damage-number wow-style ' + floatingClass;
            damageNum.textContent = (isHeal ? '+' : '-') + displayAmount;
        }

        // WoW-style: show a label above the damage number
        // Labels use the same unified color system
        var hitLabel = null;
        if (isCrit) {
            // Crits show "CRIT!" label - no rollClass to avoid orange glow on floating numbers
            hitLabel = document.createElement('div');
            hitLabel.className = 'damage-number wow-style crit-label';
            hitLabel.textContent = 'CRIT!';
        } else if (isMaxDamage) {
            // Max damage rolls show "MAX!" label - no rollClass to avoid orange glow on floating numbers
            hitLabel = document.createElement('div');
            hitLabel.className = 'damage-number wow-style max-label';
            hitLabel.textContent = 'MAX!';
        } else if (isMinDamage) {
            // Min damage rolls show "MIN" label - no rollClass to avoid glow on floating numbers
            hitLabel = document.createElement('div');
            hitLabel.className = 'damage-number wow-style min-label';
            hitLabel.textContent = 'MIN';
        } else if (isDot) {
            // DOT damage (bleed, poison, etc.) shows "DAMAGE" label in red
            hitLabel = document.createElement('div');
            var dotLabelClass = (typeof BattleDiceUI !== 'undefined' && BattleDiceUI.getRollClass)
                ? BattleDiceUI.getRollClass('damage', 'normal')
                : 'roll-damage-normal';
            hitLabel.className = 'damage-number wow-style dot-label ' + dotLabelClass;
            hitLabel.textContent = 'DAMAGE';
        } else if (!isHeal && !isMiss && !isACBoost) {
            // Normal hits show "Hit" label (yellow, normal emphasis)
            hitLabel = document.createElement('div');
            var hitLabelClass = (typeof BattleDiceUI !== 'undefined' && BattleDiceUI.getRollClass)
                ? BattleDiceUI.getRollClass('hit', 'normal')
                : 'roll-hit-normal';
            hitLabel.className = 'damage-number wow-style hit-label ' + hitLabelClass;
            hitLabel.textContent = 'Hit';
        }

        // Position damage numbers near the stats panels instead of sprites
        var container = elements.container;

        // Stagger horizontal position to avoid overlap (alternating left/right of center)
        var now = Date.now();
        if (now - damageNumberState.lastTime > 500) {
            damageNumberState.counter = 0;
        }
        damageNumberState.counter++;
        damageNumberState.lastTime = now;

        // Calculate position - center on the enemy sprite
        // The sprite-layer is centered horizontally, so enemy is at 50%
        var baseX, baseY;
        var containerRect = container.getBoundingClientRect();

        // Try to get the actual sprite position for more accurate centering
        var spriteLayer = document.getElementById('sprite-layer');
        var spriteImg = spriteLayer ? spriteLayer.querySelector('img') : null;

        // Get battle log height to know where sprite area ends
        var battleLogPanel = document.querySelector('.battle-log-panel');
        var battleLogHeight = battleLogPanel ? battleLogPanel.offsetHeight : 0;
        var spriteAreaBottom = containerRect.height - battleLogHeight;

        // Position at lower 1/3 of sprite area (roughly 50-65% from top)
        var spriteAreaBottomPercent = (spriteAreaBottom / containerRect.height) * 100;
        var targetY = spriteAreaBottomPercent - 15; // ~15% above the battle log

        if (target === 'player') {
            // Player damage - left side near player stats panel
            var playerPanel = document.getElementById('player-stats-panel');
            if (playerPanel) {
                var panelRect = playerPanel.getBoundingClientRect();
                baseX = ((panelRect.left + panelRect.width / 2 - containerRect.left) / containerRect.width) * 100;
            } else {
                baseX = 20;
            }
            baseY = targetY;
            // Add some random spread
            baseX += (Math.random() * 10 - 5);
            baseY += (Math.random() * 8 - 4);
        } else {
            // Enemy damage - centered on the enemy sprite (sprite-layer is centered)
            if (spriteImg) {
                var imgRect = spriteImg.getBoundingClientRect();
                baseX = ((imgRect.left + imgRect.width / 2 - containerRect.left) / containerRect.width) * 100;
                // Position vertically on the sprite (upper-middle area for better visibility)
                baseY = ((imgRect.top + imgRect.height * 0.3 - containerRect.top) / containerRect.height) * 100;
            } else {
                // Fallback: center of screen horizontally
                baseX = 50;
                baseY = targetY;
            }
            // Add some random spread to avoid overlap
            var spread = (damageNumberState.counter % 2 === 0 ? -1 : 1) * (3 + Math.random() * 5);
            baseX += spread;
            baseY += (Math.random() * 8 - 4);
        }

        damageNum.style.left = baseX + '%';
        damageNum.style.top = baseY + '%';

        container.appendChild(damageNum);

        // WoW-style: add label above the damage number (Hit/CRIT!)
        // Position is same as damage number - CSS handles the vertical offset
        if (hitLabel) {
            hitLabel.style.left = baseX + '%';
            hitLabel.style.top = baseY + '%';
            container.appendChild(hitLabel);

            setTimeout(function() {
                Utils.removeElement(hitLabel);
            }, config.timing.damageNumberDuration);
        }

        setTimeout(function() {
            Utils.removeElement(damageNum);
        }, config.timing.damageNumberDuration);
    }

    /**
     * Show floating stat change notification near a stat bar
     * @param {string} statType - 'hp', 'mana', 'limit', 'ac'
     * @param {number} amount - Change amount (positive = gain, negative = loss)
     * @param {string} target - 'player' or 'enemy'
     * @param {string} label - Optional label text (e.g., "AC" for AC changes)
     */
    function showStatChange(statType, amount, target, label) {
        if (amount === 0) return;
        if (animationState.active) {
            queueStatChange(statType, amount, target, label);
        } else {
            showStatChangeImmediate(statType, amount, target, label);
        }
    }

    function showStatChangeImmediate(statType, amount, target, label) {
        if (amount === 0) return;

        // Use FloatingNumber module if available
        if (_hasFloatingNumber) {
            FloatingNumber.showStatChange(statType, amount, target, label, elements);
            return;
        }

        // Fallback implementation
        if (!elements.container) {
            elements.container = document.getElementById('vn-container');
        }
        if (!elements.container) return;

        var container = elements.container;
        var containerRect = container.getBoundingClientRect();

        // Determine the stat element to position near
        var statElement = null;
        var displayClass = '';
        var prefix = '';

        switch (statType) {
            case 'hp':
                statElement = target === 'player' ? elements.playerHPBar : elements.enemyHPBar;
                displayClass = amount > 0 ? 'heal' : 'damage';
                prefix = amount > 0 ? '+' : '';
                break;
            case 'mana':
                statElement = elements.playerManaBar;
                displayClass = 'mana-change';
                prefix = amount > 0 ? '+' : '';
                break;
            case 'limit':
                statElement = elements.limitBar;
                displayClass = 'limit-change purple';
                prefix = amount > 0 ? '+' : '';
                break;
            case 'ac':
                statElement = elements.playerACDisplay;
                displayClass = amount > 0 ? 'ac-boost' : 'ac-reduce';
                prefix = amount > 0 ? '+' : '';
                break;
            default:
                return;
        }

        if (!statElement) {
            cacheElements();
            switch (statType) {
                case 'hp':
                    statElement = target === 'player' ? elements.playerHPBar : elements.enemyHPBar;
                    break;
                case 'mana':
                    statElement = elements.playerManaBar;
                    break;
                case 'limit':
                    statElement = elements.limitBar;
                    break;
                case 'ac':
                    statElement = elements.playerACDisplay;
                    break;
            }
        }

        // Create the floating number
        var statNum = document.createElement('div');
        statNum.className = 'damage-number wow-style stat-change ' + displayClass;
        statNum.textContent = prefix + amount + (label ? ' ' + label : '');

        // Position near the stat bar
        var baseX, baseY;
        if (statElement) {
            var statRect = statElement.getBoundingClientRect();
            baseX = ((statRect.left + statRect.width / 2 - containerRect.left) / containerRect.width) * 100;
            baseY = ((statRect.top - containerRect.top) / containerRect.height) * 100;
        } else {
            // Fallback positions
            baseX = target === 'player' ? 20 : 80;
            baseY = 70;
        }

        // Add small random offset
        baseX += (Math.random() * 6 - 3);

        statNum.style.left = baseX + '%';
        statNum.style.top = baseY + '%';

        container.appendChild(statNum);

        setTimeout(function() {
            Utils.removeElement(statNum);
        }, config.timing.damageNumberDuration);
    }

    /**
     * Show multiple stat changes sequentially with delays
     * Order: HP -> Mana -> Limit Break
     * @param {object} changes - { hp: {amount, target, type}, mana: {amount, target}, limit: {amount, target} }
     */
    function showStatChangesSequential(changes) {
        var queue = [];
        var delay = config.timing.statChangeDelay;

        // Build queue in order: HP, Mana, LB
        if (changes.hp && changes.hp.amount !== 0) {
            queue.push({ type: 'damage', data: changes.hp });
        }
        if (changes.mana && changes.mana.amount !== 0) {
            queue.push({ type: 'stat', statType: 'mana', data: changes.mana });
        }
        if (changes.limit && changes.limit.amount !== 0) {
            queue.push({ type: 'stat', statType: 'limit', data: changes.limit });
        }

        // Show each change with a delay
        queue.forEach(function(item, index) {
            setTimeout(function() {
                if (item.type === 'damage') {
                    showDamageNumberImmediate(item.data.amount, item.data.target, item.data.damageType || 'heal');
                } else {
                    showStatChangeImmediate(item.statType, item.data.amount, item.data.target);
                }
            }, index * delay);
        });
    }

    /**
     * Show mid-screen combat announcement (CRITICAL HIT, FUMBLE, etc.)
     * @param {string} type - 'critical' or 'fumble'
     */
    function showCombatAnnouncement(type) {
        if (!elements.container) return;

        var announcement = document.createElement('div');
        announcement.className = 'combat-announcement ' + type;

        if (type === 'critical') {
            announcement.textContent = 'CRITICAL!';
        } else if (type === 'fumble') {
            announcement.textContent = 'FUMBLE!';
        } else {
            announcement.textContent = type.toUpperCase();
        }

        elements.container.appendChild(announcement);

        // Remove after animation completes
        setTimeout(function() {
            Utils.removeElement(announcement);
        }, 1500);
    }

    /**
     * Show type-colored attack effect overlay
     * @param {string} type - Attack type (fire, ice, etc.)
     */
    function showAttackEffect(type) {
        if (!elements.container) return;

        var typeColors = {
            physical: 'rgba(255, 255, 255, 0.3)',
            fire: 'rgba(255, 100, 0, 0.4)',
            ice: 'rgba(100, 200, 255, 0.4)',
            lightning: 'rgba(255, 255, 100, 0.4)',
            poison: 'rgba(100, 255, 100, 0.4)',
            holy: 'rgba(255, 255, 200, 0.4)',
            dark: 'rgba(100, 50, 150, 0.4)',
            psychic: 'rgba(200, 100, 200, 0.4)'
        };

        var effect = document.createElement('div');
        effect.className = 'attack-effect';
        effect.style.backgroundColor = typeColors[type] || typeColors.physical;

        elements.container.appendChild(effect);

        setTimeout(function() {
            Utils.removeElement(effect);
        }, config.effects.spriteFlash);
    }

    /**
     * Flash sprite when hit (falls back to background if no sprite)
     * @param {string} target - 'player' or 'enemy'
     */
    function flashSprite(target) {
        var spriteLayer = document.getElementById('sprite-layer');
        var elementToFlash = null;

        if (target === 'enemy') {
            // Try to find character sprite first
            if (spriteLayer) {
                elementToFlash = spriteLayer.querySelector('.character-sprite');
            }
            // Fall back to background if no sprite
            if (!elementToFlash) {
                elementToFlash = document.getElementById('background-layer');
            }
        } else {
            // For player, flash the whole sprite layer (or background as fallback)
            elementToFlash = spriteLayer || document.getElementById('background-layer');
        }

        if (elementToFlash) {
            // Remove class first and force reflow to restart animation
            elementToFlash.classList.remove('damage-flash');
            void elementToFlash.offsetWidth; // Force reflow
            elementToFlash.classList.add('damage-flash');
            setTimeout(function() {
                elementToFlash.classList.remove('damage-flash');
            }, config.effects.spriteFlash / 2); // Flash is half the attack effect duration
        }
    }

    /**
     * Shake the screen
     */
    function shakeScreen() {
        if (!elements.container) return;

        elements.container.classList.add('screen-shake');
        setTimeout(function() {
            elements.container.classList.remove('screen-shake');
        }, config.timing.screenShake);
    }

    // === Battle Dialogue ===

    /**
     * Show dialogue bubble
     * @param {string} text - Dialogue text
     */
    function showDialogue(text) {
        if (!elements.container) return;

        // Remove existing dialogue
        var existing = document.getElementById('battle-dialogue');
        if (existing) existing.remove();

        // Highlight action keywords in red (DEFEND, ATTACK, etc.)
        var highlightedText = text.replace(/\b(DEFEND|ATTACK|HEAL)\b/g, '<span class="dialogue-keyword">$1</span>');

        var dialogue = document.createElement('div');
        dialogue.id = 'battle-dialogue';
        dialogue.className = 'battle-dialogue';
        dialogue.innerHTML = '<div class="dialogue-bubble">' + highlightedText + '</div>';

        elements.container.appendChild(dialogue);

        setTimeout(function() {
            if (dialogue.parentNode) {
                dialogue.classList.add('fade-out');
                setTimeout(function() {
                    Utils.removeElement(dialogue);
                }, config.timing.fadeOutDuration);
            }
        }, config.timing.dialogueDuration);
    }

    // === Limit Break Animation ===

    /**
     * Play limit break visual effect
     * @param {string} limitId - Limit break ID
     * @param {object} limitDefs - Limit break definitions
     */
    function playLimitBreakAnimation(limitId, limitDefs) {
        if (!elements.container) return;

        var limitDef = limitDefs[limitId];
        var effect = document.createElement('div');
        effect.className = 'limit-break-effect';
        effect.innerHTML = '<div class="limit-break-text">' +
            (limitDef ? limitDef.icon + ' ' + limitDef.name : 'LIMIT BREAK') +
            '</div>';

        elements.container.appendChild(effect);

        setTimeout(function() {
            Utils.removeElement(effect);
        }, config.timing.uiTransition);
    }

    // === Battle Intro/Outro Transitions ===

    /**
     * Show battle intro transition
     * @param {function} callback - Called when intro completes
     */
    function showBattleIntro(callback) {
        _log.debug('BattleUI', 'showBattleIntro called');
        if (!elements.container) {
            elements.container = document.getElementById('vn-container');
        }
        if (!elements.container) {
            _log.debug('BattleUI', 'No container found, calling callback immediately');
            if (callback) callback();
            return;
        }

        _log.debug('BattleUI', 'Container found, hiding text box and playing sfx');
        hideTextBox();
        playSfx('alert.ogg');

        // Create intro overlay
        var overlay = document.createElement('div');
        overlay.className = 'battle-intro-overlay';
        overlay.id = 'battle-intro-overlay';

        var text = document.createElement('div');
        text.className = 'battle-intro-text';
        text.textContent = 'Battle Start!';
        overlay.appendChild(text);

        var flash = document.createElement('div');
        flash.className = 'battle-intro-flash';
        flash.id = 'battle-intro-flash';

        var spriteLayer = document.getElementById('sprite-layer');
        if (spriteLayer) {
            spriteLayer.classList.add('battle-intro-enemy');
        }

        elements.container.appendChild(flash);
        elements.container.appendChild(overlay);
        _log.debug('BattleUI', 'Intro overlay appended, starting timeout:', config.timing.battleIntro, 'ms');

        setTimeout(function() {
            _log.debug('BattleUI', 'Intro timeout fired, cleaning up');
            Utils.removeElement(document.getElementById('battle-intro-overlay'));
            Utils.removeElement(document.getElementById('battle-intro-flash'));
            if (spriteLayer) {
                spriteLayer.classList.remove('battle-intro-enemy');
            }
            _log.debug('BattleUI', 'Calling callback');
            if (callback) callback();
        }, config.timing.battleIntro);
    }

    /**
     * Show battle outro transition
     * @param {string} result - 'win', 'lose', or 'flee'
     * @param {string} enemyName - Enemy name for victory message
     * @param {function} callback - Called when outro completes
     */
    function showBattleOutro(result, enemyName, callback) {
        if (!elements.container) {
            elements.container = document.getElementById('vn-container');
        }
        if (!elements.container) {
            if (callback) callback();
            return;
        }

        var mainText = '';
        var subText = '';
        var overlayClass = '';
        var soundFile = '';
        var spriteClass = '';

        switch (result) {
            case 'win':
                mainText = 'Victory!';
                subText = (enemyName || 'Enemy') + ' was defeated!';
                overlayClass = 'victory';
                soundFile = 'victory.ogg';
                spriteClass = 'battle-outro-victory';
                break;
            case 'lose':
                mainText = 'Defeated';
                subText = 'You were overwhelmed...';
                overlayClass = 'defeat';
                soundFile = 'failure.ogg';
                spriteClass = 'battle-outro-defeat';
                break;
            case 'flee':
                mainText = 'Escaped!';
                subText = 'Got away safely...';
                overlayClass = 'flee';
                soundFile = 'footstep.ogg';
                spriteClass = '';
                break;
        }

        playSfx(soundFile);

        var spriteLayer = document.getElementById('sprite-layer');
        if (spriteLayer && spriteClass) {
            spriteLayer.classList.add(spriteClass);
        }

        var overlay = document.createElement('div');
        overlay.className = 'battle-outro-overlay ' + overlayClass;
        overlay.id = 'battle-outro-overlay';

        var textEl = document.createElement('div');
        textEl.className = 'battle-outro-text ' + overlayClass;
        textEl.textContent = mainText;
        overlay.appendChild(textEl);

        var subEl = document.createElement('div');
        subEl.className = 'battle-outro-subtext';
        subEl.textContent = subText;
        overlay.appendChild(subEl);

        elements.container.appendChild(overlay);

        if (result === 'win') {
            createVictorySparkles(overlay);
        }

        setTimeout(function() {
            Utils.removeElement(document.getElementById('battle-outro-overlay'));
            if (spriteLayer && spriteClass) {
                spriteLayer.classList.remove(spriteClass);
            }
            if (callback) callback();
        }, config.timing.battleOutro);
    }

    /**
     * Create sparkle effects for victory screen
     */
    function createVictorySparkles(container) {
        // Use shared Utils function
        Utils.createVictorySparkles(container, {
            count: 12,
            interval: config.timing.sparkleInterval,
            lifetime: config.timing.sparkleLifetime,
            topMin: 40,
            topRange: 40
        });
    }

    // === Pause Overlay ===

    var _pauseOverlay = null;

    /**
     * Show pause overlay
     */
    function showPauseOverlay() {
        if (!_pauseOverlay) {
            _pauseOverlay = document.createElement('div');
            _pauseOverlay.id = 'battle-pause-overlay';
            _pauseOverlay.className = 'battle-pause-overlay';
            _pauseOverlay.innerHTML = '<div class="pause-text">PAUSED</div><div class="pause-hint">Press P to resume</div>';
        }

        if (!elements.container) cacheElements();
        if (elements.container && !_pauseOverlay.parentNode) {
            elements.container.appendChild(_pauseOverlay);
        }
    }

    /**
     * Hide pause overlay
     */
    function hidePauseOverlay() {
        Utils.removeElement(_pauseOverlay);
    }

    // === Intent Display ===

    /**
     * Show intent indicator above enemy sprite
     * @param {Object} intentData - Intent display data from BattleIntent.getDisplayData()
     */
    function showIntentIndicator(intentData) {
        if (!intentData) return;

        // Remove existing indicator if present
        hideIntentIndicator();

        // Get sprite layer to position relative to enemy
        var spriteLayer = document.getElementById('sprite-layer');
        if (!spriteLayer) return;

        // Create intent indicator container
        var indicator = document.createElement('div');
        indicator.id = 'enemy-intent-indicator';
        indicator.className = 'enemy-intent-indicator';

        // Create icon element
        var icon = document.createElement('div');
        icon.className = 'intent-icon ' + (intentData.cssClass || '') + ' intent-appear';
        icon.textContent = intentData.icon || '?';

        // Create label element
        var label = document.createElement('div');
        label.className = 'intent-label';
        label.textContent = intentData.name || 'Preparing...';

        indicator.appendChild(icon);
        indicator.appendChild(label);
        spriteLayer.appendChild(indicator);

        // Play sound effect
        playSfx('intent_prepare');
    }

    /**
     * Hide the intent indicator (after execution or interruption)
     * @param {string} animationType - 'execute' or 'broken' for different animations
     */
    function hideIntentIndicator(animationType) {
        var indicator = document.getElementById('enemy-intent-indicator');
        if (!indicator) return;

        var icon = indicator.querySelector('.intent-icon');
        if (icon && animationType) {
            // Apply exit animation
            icon.classList.remove('intent-appear', 'intent-pulse');
            icon.classList.add('intent-' + animationType);

            // Play appropriate sound
            if (animationType === 'broken') {
                playSfx('intent_broken');
            } else if (animationType === 'execute') {
                playSfx('intent_execute');
            }

            // Remove after animation
            setTimeout(function() {
                Utils.removeElement(indicator);
            }, 500);
        } else {
            // Remove immediately
            Utils.removeElement(indicator);
        }
    }

    /**
     * Update the intent indicator (e.g., decrement turns remaining)
     * @param {Object} intentData - Updated intent display data
     */
    function updateIntentIndicator(intentData) {
        var indicator = document.getElementById('enemy-intent-indicator');
        if (!indicator || !intentData) return;

        var label = indicator.querySelector('.intent-label');
        if (label && intentData.turnsRemaining !== undefined) {
            if (intentData.turnsRemaining > 0) {
                label.textContent = intentData.name + ' (' + intentData.turnsRemaining + ')';
            } else {
                label.textContent = intentData.name + '!';
            }
        }
    }

    // === Summon Display (Enemy/Player summons with HP) ===

    /**
     * Show a spawned summon on the battlefield
     * @param {Object} displayData - Display data from BattleSummon.getDisplayData()
     */
    function showSummonSprite(displayData) {
        _log.debug('BattleUI', 'showSummonSprite called with:', displayData);
        if (!displayData) {
            _log.debug('BattleUI', 'No displayData, returning');
            return;
        }

        var spriteLayer = document.getElementById('sprite-layer');
        if (!spriteLayer) {
            _log.debug('BattleUI', 'No sprite-layer element found, returning');
            return;
        }
        _log.debug('BattleUI', 'Found sprite-layer, creating summon element');

        // Remove existing summon with same UID
        hideSummonSprite(displayData.uid);

        // Create summon container - uses CSS variables for positioning
        var container = document.createElement('div');
        container.id = 'summon-' + displayData.uid;
        container.className = 'summon-container summon-' + displayData.side + ' summon-appear';
        container.dataset.uid = displayData.uid;
        container.dataset.side = displayData.side;

        // Combined name + duration badge (above sprite)
        var infoBadge = document.createElement('div');
        infoBadge.className = 'summon-info-badge';

        var nameSpan = document.createElement('span');
        nameSpan.className = 'summon-badge-name';
        nameSpan.textContent = displayData.name;
        infoBadge.appendChild(nameSpan);

        var durationSpan = document.createElement('span');
        durationSpan.className = 'summon-badge-duration';
        durationSpan.textContent = '(' + displayData.turnsRemaining + ')';
        infoBadge.appendChild(durationSpan);

        container.appendChild(infoBadge);

        // Sprite wrapper
        var spriteWrapper = document.createElement('div');
        spriteWrapper.className = 'summon-sprite-wrapper';

        // Sprite image
        if (displayData.sprite) {
            var sprite = document.createElement('img');
            sprite.className = 'summon-sprite';
            sprite.src = 'assets/sprites/' + displayData.sprite;
            sprite.alt = displayData.name;
            sprite.onerror = function() {
                // Fallback to icon if sprite not found
                this.style.display = 'none';
                var iconFallback = document.createElement('div');
                iconFallback.className = 'summon-sprite summon-icon-fallback';
                iconFallback.textContent = displayData.icon || '?';
                iconFallback.style.fontSize = '3rem';
                spriteWrapper.appendChild(iconFallback);
            };
            spriteWrapper.appendChild(sprite);
        } else {
            // No sprite, use icon
            var iconEl = document.createElement('div');
            iconEl.className = 'summon-sprite summon-icon-fallback';
            iconEl.textContent = displayData.icon || '?';
            iconEl.style.fontSize = '3rem';
            spriteWrapper.appendChild(iconEl);
        }

        container.appendChild(spriteWrapper);

        // Add click handler for selection (use ListenerManager if available)
        var clickHandler = function() {
            if (container.classList.contains('summon-targetable')) {
                // Dispatch custom event for target selection
                var event = new CustomEvent('summon-selected', {
                    detail: { uid: displayData.uid, side: displayData.side }
                });
                document.dispatchEvent(event);
            }
        };

        if (typeof ListenerManager !== 'undefined') {
            ListenerManager.add(container, 'click', clickHandler, 'battle-summons');
        } else {
            container.addEventListener('click', clickHandler);
        }

        // Summons always go to their respective slots (aligned with stats panels)
        // CSS handles orientation: vertical stack in landscape, horizontal in portrait
        var playerSummonSlot = document.getElementById('player-summon-slot');
        var enemySummonSlot = document.getElementById('enemy-summon-slot');

        if (displayData.side === 'player' && playerSummonSlot) {
            playerSummonSlot.appendChild(container);
        } else if (displayData.side === 'enemy' && enemySummonSlot) {
            enemySummonSlot.appendChild(container);
        } else {
            // Fallback to sprite-layer if slots don't exist
            spriteLayer.appendChild(container);
        }

        // Play spawn sound
        playSfx('summon_appear');

        // Remove appear animation class after animation completes
        setTimeout(function() {
            container.classList.remove('summon-appear');
        }, 500);
    }

    /**
     * Update summon display state (HP, expiring, etc.)
     * @param {Object} displayData - Updated display data
     */
    function updateSummonSprite(displayData) {
        if (!displayData) return;

        var container = document.getElementById('summon-' + displayData.uid);
        if (!container) return;

        // Update duration in badge
        var durationSpan = container.querySelector('.summon-badge-duration');
        if (durationSpan) {
            durationSpan.textContent = '(' + displayData.turnsRemaining + ')';
        }

        // Update expiring warning state (blink when 1 turn left)
        if (displayData.isExpiringWarning) {
            container.classList.add('summon-expiring');
        } else {
            container.classList.remove('summon-expiring');
        }
    }

    /**
     * Hide/remove a summon sprite
     * @param {string} uid - Summon unique ID
     * @param {string} animationType - 'dismiss', 'death', or null for immediate
     */
    function hideSummonSprite(uid, animationType) {
        var container = document.getElementById('summon-' + uid);
        if (!container) return;

        if (animationType) {
            container.classList.add('summon-' + animationType);

            // Play appropriate sound
            if (animationType === 'death') {
                playSfx('summon_death');
            } else if (animationType === 'dismiss') {
                playSfx('summon_expire');
            }

            // Remove after animation
            setTimeout(function() {
                Utils.removeElement(container);
            }, 600);
        } else {
            // Remove immediately
            Utils.removeElement(container);
        }
    }

    /**
     * Set summons as targetable (for player target selection)
     * @param {string} side - 'enemy' or 'player'
     * @param {boolean} targetable - Whether summons can be targeted
     */
    function setSummonsTargetable(side, targetable) {
        var containers = document.querySelectorAll('.summon-container.summon-' + side);
        containers.forEach(function(container) {
            if (targetable) {
                container.classList.add('summon-targetable');
            } else {
                container.classList.remove('summon-targetable');
            }
        });
    }

    /**
     * Show intercept animation on a summon
     * @param {string} uid - Summon unique ID
     */
    function showSummonIntercept(uid) {
        var container = document.getElementById('summon-' + uid);
        if (!container) return;

        container.classList.add('summon-intercept');
        playSfx('summon_intercept');

        setTimeout(function() {
            container.classList.remove('summon-intercept');
        }, 400);
    }

    /**
     * Clear all summon sprites from the battlefield
     */
    function clearAllSummons() {
        // Clean up summon listeners first
        if (typeof ListenerManager !== 'undefined') {
            ListenerManager.removeAll('battle-summons');
        }

        var containers = document.querySelectorAll('.summon-container');
        containers.forEach(function(container) {
            Utils.removeElement(container);
        });
    }

    // === Phase Display ===

    /**
     * Update UI elements based on battle phase.
     * Called by BattleCore.setPhase() to maintain logic/UI separation.
     * @param {string} phase - 'player', 'enemy', 'animating', 'ended'
     */
    function setPhaseDisplay(phase) {
        if (!elements.battleChoices) cacheElements();
        if (!elements.battleChoices) return;

        var playerTurn = (phase === 'player');

        // Clear battle log when player turn starts
        // Prevents "Stun wore off!" from showing alongside active buttons
        if (playerTurn) {
            // Must clear both rows - elements.battleLog only points to row2
            var rows = BattleUtils.getBattleLogRows();
            if (rows) {
                BattleUtils.clearBattleLogRows(rows);
            }
        }

        // Update container class for styling
        if (playerTurn) {
            elements.battleChoices.classList.remove('waiting');
        } else {
            elements.battleChoices.classList.add('waiting');
        }
    }

    // === Public API ===
    return {
        // Initialization
        init: init,
        setSfxCallback: setSfxCallback,

        // Text box
        hideTextBox: hideTextBox,
        showTextBox: showTextBox,

        // Battle UI creation/destruction
        createBattleUI: createBattleUI,
        showUI: showUI,
        hideUI: hideUI,
        destroyUI: destroyUI,
        cleanup: cleanup,
        cacheElements: cacheElements,

        // Display updates (these also queue when animation is active)
        updatePlayerHP: function(hp, maxHP, hasRegen) {
            if (animationState.active) {
                animationState.statUpdateQueue.push({
                    type: 'playerHP',
                    hp: hp,
                    maxHP: maxHP,
                    hasRegen: hasRegen
                });
            } else {
                updatePlayerHP(hp, maxHP, hasRegen);
            }
        },
        updatePlayerMana: function(mana, maxMana, hasRegen) {
            if (animationState.active) {
                animationState.statUpdateQueue.push({
                    type: 'playerMana',
                    mana: mana,
                    maxMana: maxMana,
                    hasRegen: hasRegen
                });
            } else {
                updatePlayerMana(mana, maxMana, hasRegen);
            }
        },
        updateEnemyHP: function(hp, maxHP, name) {
            if (animationState.active) {
                animationState.statUpdateQueue.push({
                    type: 'enemyHP',
                    hp: hp,
                    maxHP: maxHP,
                    name: name
                });
            } else {
                updateEnemyHP(hp, maxHP, name);
            }
        },
        updateLimitBar: function(charge) {
            if (animationState.active) {
                animationState.statUpdateQueue.push({
                    type: 'limitBar',
                    charge: charge
                });
            } else {
                updateLimitBar(charge);
            }
        },
        updatePlayerAC: updatePlayerAC,
        updateStatuses: updateStatuses,
        updateStagger: updateStagger,
        updateTerrain: updateTerrain,
        updateSummon: updateSummon,

        // Facade-compatible aliases (used by battle-facade.js)
        // These queue updates when animation is active so HP/mana changes appear after text
        updateHP: function(target, hp, maxHP, name, hasRegen) {
            if (animationState.active) {
                // Queue the update to apply after animation completes
                if (target === 'player') {
                    animationState.statUpdateQueue.push({
                        type: 'playerHP',
                        hp: hp,
                        maxHP: maxHP,
                        hasRegen: hasRegen
                    });
                } else {
                    animationState.statUpdateQueue.push({
                        type: 'enemyHP',
                        hp: hp,
                        maxHP: maxHP,
                        name: name
                    });
                }
            } else {
                // Apply immediately when no animation is running
                if (target === 'player') {
                    updatePlayerHP(hp, maxHP, hasRegen);
                } else {
                    updateEnemyHP(hp, maxHP, name);
                }
            }
        },
        updateMana: function(mana, maxMana, hasRegen) {
            if (animationState.active) {
                animationState.statUpdateQueue.push({
                    type: 'playerMana',
                    mana: mana,
                    maxMana: maxMana,
                    hasRegen: hasRegen
                });
            } else {
                updatePlayerMana(mana, maxMana, hasRegen);
            }
        },
        addLogEntry: function(html) {
            updateBattleLog(html);
        },
        showIntro: function(_enemy, callback) {
            showBattleIntro(callback);
        },
        showOutro: function(result, callback) {
            showBattleOutro(result, null, callback);
        },
        showDialogueBubble: function(text, _duration) {
            showDialogue(text);
        },

        // Battle log
        updateBattleLog: updateBattleLog,
        clearAnimationState: clearAnimationState,
        cleanup: cleanup,

        // Visual effects
        showDamageNumber: showDamageNumber,
        showStatChange: showStatChange,
        showStatChangesSequential: showStatChangesSequential,
        showCombatAnnouncement: showCombatAnnouncement,
        showAttackEffect: showAttackEffect,
        flashSprite: flashSprite,
        shakeScreen: shakeScreen,
        showDialogue: showDialogue,
        playLimitBreakAnimation: playLimitBreakAnimation,

        // Transitions
        showBattleIntro: showBattleIntro,
        showBattleOutro: showBattleOutro,

        // Animation utilities
        animateDiceRoll: animateDiceRoll,
        scrollToBottomIfNeeded: scrollToBottomIfNeeded,
        typewriterEffect: typewriterEffect,
        skipTypewriter: skipTypewriter,
        isTyping: function() {
            return animationState.isTyping;
        },

        // Fixed row log system
        getActiveLogRow: getActiveLogRow,
        prepareLogForNewMessage: prepareLogForNewMessage,
        clearLog: clearLog,

        // Intent display (telegraphed enemy attacks)
        showIntentIndicator: showIntentIndicator,
        hideIntentIndicator: hideIntentIndicator,
        updateIntentIndicator: updateIntentIndicator,

        // Summon display (enemy/player summons with HP)
        showSummonSprite: showSummonSprite,
        updateSummonSprite: updateSummonSprite,
        hideSummonSprite: hideSummonSprite,
        setSummonsTargetable: setSummonsTargetable,
        showSummonIntercept: showSummonIntercept,
        clearAllSummons: clearAllSummons,

        // Phase display (called by BattleCore for logic/UI separation)
        setPhaseDisplay: setPhaseDisplay,

        // Pause overlay (called by BattleFacade for logic/UI separation)
        showPauseOverlay: showPauseOverlay,
        hidePauseOverlay: hidePauseOverlay,

        // Expose config for external timing needs
        config: config,

        // Element access (for engine.js choice rendering)
        getElements: function() { return elements; },
        getBattleChoicesContainer: function() {
            return elements.battleChoices || document.getElementById('battle-choices');
        }
    };
})();
