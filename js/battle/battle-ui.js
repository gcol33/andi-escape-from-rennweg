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
            battleLogPadding: T ? T.ui.battleLogPadding : 1.5        // rem - panel padding
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
        battleLog: null,
        battleChoices: null
    };

    // Animation state
    var animationState = {
        active: false,
        timeouts: [],
        damageQueue: [],
        statUpdateQueue: [],  // Queue for HP/mana/limit bar updates
        onComplete: null
    };

    // Sound callback (set by BattleEngine)
    var playSfxCallback = null;

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

    /**
     * Set the sound effect callback function
     * @param {function} callback - Function to call with SFX filename
     */
    function setSfxCallback(callback) {
        playSfxCallback = callback;
    }

    /**
     * Play a sound effect via callback
     */
    function playSfx(filename) {
        if (playSfxCallback) {
            playSfxCallback(filename);
        }
    }

    // === Text Box Management ===

    function hideTextBox() {
        if (!elements.textBox) {
            elements.textBox = document.getElementById('text-box');
        }
        if (elements.textBox) {
            elements.textBox.classList.add('battle-mode');
        }
    }

    function showTextBox() {
        if (!elements.textBox) {
            elements.textBox = document.getElementById('text-box');
        }
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

        // Terrain indicator (top center)
        var terrainIndicator = document.createElement('div');
        terrainIndicator.id = 'terrain-indicator';
        terrainIndicator.className = 'terrain-indicator';

        // Player stats panel
        var playerStats = createPlayerStatsPanel(playerState);

        // Enemy stats panel
        var enemyStats = createEnemyStatsPanel(enemyState);

        // Battle log panel
        var battleLog = document.createElement('div');
        battleLog.id = 'battle-log-panel';
        battleLog.className = 'battle-log-panel';

        // Calculate log content height from max lines (including padding for box-sizing: border-box)
        var maxLines = config.ui.battleLogMaxLines || 2;
        var lineHeight = config.ui.battleLogLineHeight || 1.6;  // Must match CSS line-height in rem
        var verticalPadding = 1.0; // 0.5rem top + 0.5rem bottom (must match CSS padding)
        var logContentHeight = (maxLines * lineHeight) + verticalPadding;
        battleLog.style.setProperty('--battle-log-content-height', logContentHeight + 'rem');

        battleLog.innerHTML =
            '<div id="battle-log-content" class="battle-log-content"></div>' +
            '<div id="battle-choices" class="battle-choices"></div>';

        battleUI.appendChild(terrainIndicator);
        battleUI.appendChild(playerStats);
        battleUI.appendChild(enemyStats);
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
        panel.className = 'battle-stats-panel player-stats';
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
        panel.className = 'battle-stats-panel enemy-stats';
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
        elements.battleLog = document.getElementById('battle-log-content');
        elements.battleChoices = document.getElementById('battle-choices');
    }

    // === UI Visibility ===

    function showUI() {
        if (elements.battleUI) {
            elements.battleUI.style.display = 'block';
        }
    }

    function hideUI() {
        if (elements.battleUI) elements.battleUI.style.display = 'none';
    }

    function destroyUI() {
        var battleUI = document.getElementById('battle-ui');
        if (battleUI && battleUI.parentNode) {
            battleUI.parentNode.removeChild(battleUI);
        }
        // Clear cached references
        elements.battleUI = null;
        elements.playerStats = null;
        elements.enemyStats = null;
        elements.battleLog = null;
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
     */
    function updateBattleLog(html, rollData, callback) {
        if (!elements.battleLog) {
            elements.battleLog = document.getElementById('battle-log-content');
        }
        if (!elements.battleLog) return;

        // Clear previous animation state
        clearAnimationState();

        // Clear entire log and show only the latest entry (like old battle.js)
        elements.battleLog.innerHTML = '';

        // Wrapper to add linger delay before callback
        var lingerCallback = function() {
            if (callback) {
                var t = setTimeout(callback, config.timing.messageLingerDelay);
                animationState.timeouts.push(t);
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
        animationState.active = false;
    }

    /**
     * Complete animation and flush damage queue
     */
    function completeAnimation() {
        flushDamageQueue();
        animationState.active = false;
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
     * Scroll container to bottom if content overflows significantly
     * Only scrolls when there's actually hidden content below the current view
     * @param {HTMLElement} container - The scrollable container
     */
    function scrollToBottomIfNeeded(container) {
        if (!container) return;
        // Only scroll if there's content hidden below the current scroll position
        // (scrollHeight - scrollTop - clientHeight > threshold means there's hidden content below)
        var hiddenBelow = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (hiddenBelow > 5) {  // 5px threshold to avoid micro-scrolls from rounding
            container.scrollTop = container.scrollHeight - container.clientHeight;
        }
    }

    /**
     * Typewriter effect for text
     * Types text character by character, scrolling when content overflows
     */
    function typewriterEffect(container, text, callback) {
        var index = 0;
        var speed = config.dice.typewriterSpeed;

        container.innerHTML = '';

        function typeNext() {
            if (index < text.length) {
                // Skip HTML tags instantly, including their full content for styled spans
                if (text[index] === '<') {
                    var tagEnd = text.indexOf('>', index);
                    if (tagEnd !== -1) {
                        var tagContent = text.substring(index, tagEnd + 1);
                        // Check if this is an opening tag with a class (styled content)
                        // If so, include everything up to and including the closing tag
                        var classMatch = tagContent.match(/^<(\w+)\s+class=/);
                        if (classMatch) {
                            var tagName = classMatch[1];
                            var closingTag = '</' + tagName + '>';
                            var closeIndex = text.indexOf(closingTag, tagEnd);
                            if (closeIndex !== -1) {
                                // Add the entire styled element at once (opening tag + content + closing tag)
                                container.innerHTML += text.substring(index, closeIndex + closingTag.length);
                                index = closeIndex + closingTag.length;
                                scrollToBottomIfNeeded(container);
                                typeNext();
                                return;
                            }
                        }
                        // Regular tag without class - just add the tag
                        container.innerHTML += tagContent;
                        index = tagEnd + 1;
                        // Check for <br> tags that add new lines
                        if (tagContent.toLowerCase() === '<br>' || tagContent.toLowerCase() === '<br/>') {
                            scrollToBottomIfNeeded(container);
                        }
                        typeNext();
                        return;
                    }
                }

                container.innerHTML += text[index];
                index++;

                // Scroll on newlines
                if (text[index - 1] === '\n') {
                    scrollToBottomIfNeeded(container);
                }

                var t = setTimeout(typeNext, 1000 / speed);
                animationState.timeouts.push(t);
            } else {
                // Animation complete - final scroll
                scrollToBottomIfNeeded(container);
                if (callback) {
                    callback();
                }
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
        if (animationState.active) {
            queueDamageNumber(amount, target, type);
        } else {
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
                if (hitLabel.parentNode) {
                    hitLabel.parentNode.removeChild(hitLabel);
                }
            }, config.timing.damageNumberDuration);
        }

        setTimeout(function() {
            if (damageNum.parentNode) {
                damageNum.parentNode.removeChild(damageNum);
            }
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
            if (statNum.parentNode) {
                statNum.parentNode.removeChild(statNum);
            }
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
            if (announcement.parentNode) {
                announcement.parentNode.removeChild(announcement);
            }
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
            if (effect.parentNode) {
                effect.parentNode.removeChild(effect);
            }
        }, config.effects.spriteFlash);
    }

    /**
     * Flash sprite when hit
     * @param {string} target - 'player' or 'enemy'
     */
    function flashSprite(target) {
        var spriteLayer = document.getElementById('sprite-layer');
        if (!spriteLayer) return;

        var sprite = target === 'enemy' ?
            spriteLayer.querySelector('.character-sprite') :
            spriteLayer; // For player, flash the whole layer

        if (sprite) {
            sprite.classList.add('damage-flash');
            setTimeout(function() {
                sprite.classList.remove('damage-flash');
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

        var dialogue = document.createElement('div');
        dialogue.id = 'battle-dialogue';
        dialogue.className = 'battle-dialogue';
        dialogue.innerHTML = '<div class="dialogue-bubble">' + text + '</div>';

        elements.container.appendChild(dialogue);

        setTimeout(function() {
            if (dialogue.parentNode) {
                dialogue.classList.add('fade-out');
                setTimeout(function() {
                    if (dialogue.parentNode) {
                        dialogue.parentNode.removeChild(dialogue);
                    }
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
            if (effect.parentNode) {
                effect.parentNode.removeChild(effect);
            }
        }, config.timing.uiTransition);
    }

    // === Battle Intro/Outro Transitions ===

    /**
     * Show battle intro transition
     * @param {function} callback - Called when intro completes
     */
    function showBattleIntro(callback) {
        console.log('[BattleUI] showBattleIntro called');
        if (!elements.container) {
            elements.container = document.getElementById('vn-container');
        }
        if (!elements.container) {
            console.log('[BattleUI] No container found, calling callback immediately');
            if (callback) callback();
            return;
        }

        console.log('[BattleUI] Container found, hiding text box and playing sfx');
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
        console.log('[BattleUI] Intro overlay appended, starting timeout:', config.timing.battleIntro, 'ms');

        setTimeout(function() {
            console.log('[BattleUI] Intro timeout fired, cleaning up');
            var introOverlay = document.getElementById('battle-intro-overlay');
            if (introOverlay && introOverlay.parentNode) {
                introOverlay.parentNode.removeChild(introOverlay);
            }
            var introFlash = document.getElementById('battle-intro-flash');
            if (introFlash && introFlash.parentNode) {
                introFlash.parentNode.removeChild(introFlash);
            }
            if (spriteLayer) {
                spriteLayer.classList.remove('battle-intro-enemy');
            }
            console.log('[BattleUI] Calling callback');
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
            var outroOverlay = document.getElementById('battle-outro-overlay');
            if (outroOverlay && outroOverlay.parentNode) {
                outroOverlay.parentNode.removeChild(outroOverlay);
            }
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
        var sparkleCount = 12;
        for (var i = 0; i < sparkleCount; i++) {
            (function(index) {
                setTimeout(function() {
                    var sparkle = document.createElement('div');
                    sparkle.className = 'victory-sparkle';
                    sparkle.style.left = (Math.random() * 80 + 10) + '%';
                    sparkle.style.top = (Math.random() * 40 + 40) + '%';
                    sparkle.style.animationDelay = (Math.random() * 0.5) + 's';
                    container.appendChild(sparkle);

                    setTimeout(function() {
                        if (sparkle.parentNode) {
                            sparkle.parentNode.removeChild(sparkle);
                        }
                    }, config.timing.sparkleLifetime);
                }, index * config.timing.sparkleInterval);
            })(i);
        }
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
                if (indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
            }, 500);
        } else {
            // Remove immediately
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
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

        // Intent display (telegraphed enemy attacks)
        showIntentIndicator: showIntentIndicator,
        hideIntentIndicator: hideIntentIndicator,
        updateIntentIndicator: updateIntentIndicator,

        // Expose config for external timing needs
        config: config,

        // Element access (for engine.js choice rendering)
        getElements: function() { return elements; },
        getBattleChoicesContainer: function() {
            return elements.battleChoices || document.getElementById('battle-choices');
        }
    };
})();
