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
 * Usage:
 *   BattleUI.init(containerElement);
 *   BattleUI.createBattleUI(playerState, enemyState);
 *   BattleUI.updateHP('player', currentHP, maxHP);
 */

var BattleUI = (function() {
    'use strict';

    // === Configuration ===
    // Values sourced from TUNING.js when available, with fallbacks
    var T = typeof TUNING !== 'undefined' ? TUNING : null;

    var config = {
        timing: {
            damageNumberDuration: T ? T.battle.timing.damageNumberFloat : 2000,
            screenShake: T ? T.battle.timing.screenShake : 300,
            fadeOutDuration: T ? T.battle.timing.fadeOut : 300,
            dialogueDuration: T ? T.battle.timing.dialogueBubble : 2500,
            battleIntro: T ? T.battle.timing.introDelay : 1500,
            battleOutro: T ? T.battle.timing.outroDelay : 2500,
            sparkleInterval: T ? T.battle.effects.sparkleInterval : 150,
            sparkleLifetime: T ? T.battle.effects.sparkleLifetime : 2000,
            uiTransition: T ? T.battle.timing.uiTransition : 1500
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
            battleLogMaxLines: T ? T.ui.battleLogMaxLines : 2
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
        playerManaBar: null,
        playerManaText: null,
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
        // Set CSS variable for max log lines (each line ~35px)
        var lineHeight = 35;
        var maxLines = config.ui.battleLogMaxLines;
        battleLog.style.setProperty('--battle-log-lines', maxLines);
        battleLog.style.setProperty('--battle-log-content-height', (lineHeight * maxLines) + 'px');
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
            '<div class="stats-header">' + (playerState.name || 'Player') +
            ' <span id="player-ac-display" class="ac-display">(AC ' + (playerState.ac || 10) + ')</span></div>' +
            '<div class="stat-row hp-row">' +
                '<span class="stat-label">HP</span>' +
                '<div class="stat-bar-outer"><div id="player-hp-bar" class="stat-bar hp-bar hp-high"></div></div>' +
                '<span id="player-hp-text" class="stat-value"></span>' +
            '</div>' +
            '<div class="stat-row mp-row">' +
                '<span class="stat-label">MP</span>' +
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
            '</div>' +
            '<div id="player-statuses" class="status-icons"></div>';
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
            '<div id="enemy-hp-label" class="stats-header">' + (enemyState.name || 'Enemy') + '</div>' +
            '<div class="stat-row hp-row">' +
                '<span class="stat-label">HP</span>' +
                '<div class="stat-bar-outer"><div id="enemy-hp-bar" class="stat-bar hp-bar hp-high"></div></div>' +
                '<span id="enemy-hp-text" class="stat-value"></span>' +
            '</div>' +
            '<div id="enemy-stagger-container" class="stagger-container">' +
                '<div id="enemy-stagger-bar" class="stagger-bar"><div id="enemy-stagger-fill" class="stagger-fill"></div></div>' +
            '</div>' +
            '<div id="enemy-statuses" class="status-icons"></div>';
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
        elements.playerManaBar = document.getElementById('player-mana-bar');
        elements.playerManaText = document.getElementById('player-mana-text');
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
     */
    function updatePlayerHP(hp, maxHP) {
        if (!elements.playerHPBar) cacheElements();
        if (!elements.playerHPBar || !elements.playerHPText) return;

        var percent = (hp / maxHP) * 100;
        elements.playerHPBar.style.width = percent + '%';
        elements.playerHPText.textContent = hp + '/' + maxHP;

        var hpState = percent > 50 ? 'hp-high' : percent > 25 ? 'hp-medium' : 'hp-low';
        elements.playerHPBar.className = 'stat-bar hp-bar ' + hpState;
    }

    /**
     * Update player mana display
     * @param {number} mana - Current mana
     * @param {number} maxMana - Maximum mana
     */
    function updatePlayerMana(mana, maxMana) {
        if (!elements.playerManaBar) cacheElements();
        if (!elements.playerManaBar || !elements.playerManaText) return;

        var percent = (mana / maxMana) * 100;
        elements.playerManaBar.style.width = percent + '%';
        elements.playerManaText.textContent = mana + '/' + maxMana;
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

        var acText = '(AC ' + effectiveAC + ')';
        elements.playerACDisplay.classList.remove('boosted', 'reduced');

        if (effectiveAC > baseAC) {
            acText = '(AC ' + effectiveAC + ' ↑)';
            elements.playerACDisplay.classList.add('boosted');
        } else if (effectiveAC < baseAC) {
            acText = '(AC ' + effectiveAC + ' ↓)';
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
     * @param {string} html - HTML content to display
     * @param {object} rollData - Optional roll animation data { roll, isCrit, isFumble }
     * @param {function} callback - Optional callback when animation completes
     */
    function updateBattleLog(html, rollData, callback) {
        if (!elements.battleLog) {
            elements.battleLog = document.getElementById('battle-log-content');
        }
        if (!elements.battleLog) return;

        // Clear previous animation state
        clearAnimationState();

        // Create new log entry
        var logContainer = document.createElement('div');
        logContainer.className = 'battle-log-messages';

        // Append new entry to battle log
        elements.battleLog.appendChild(logContainer);

        // Remove oldest entries if over max lines
        var maxLines = config.ui.battleLogMaxLines;
        var entries = elements.battleLog.querySelectorAll('.battle-log-messages');
        while (entries.length > maxLines) {
            entries[0].parentNode.removeChild(entries[0]);
            entries = elements.battleLog.querySelectorAll('.battle-log-messages');
        }

        // Check if we need to animate a dice roll
        if (rollData && rollData.roll !== undefined) {
            animationState.active = true;
            animationState.onComplete = callback;

            // Parse the HTML to find the roll value and animate it
            var temp = document.createElement('div');
            temp.innerHTML = html;

            var rollResultSpan = temp.querySelector('.roll-result strong');
            if (rollResultSpan) {
                var rollHtml = rollResultSpan.innerHTML;
                rollResultSpan.innerHTML = '<span class="dice-number">?</span>';
                html = temp.innerHTML;
            }

            logContainer.innerHTML = html;

            var diceNum = logContainer.querySelector('.dice-number');
            if (diceNum) {
                animateDiceRoll(diceNum, rollData.roll, rollData.isCrit, rollData.isFumble, function() {
                    completeAnimation();
                });
            } else {
                typewriterEffect(logContainer, html, function() {
                    completeAnimation();
                });
            }
        } else {
            logContainer.innerHTML = html;
            if (callback) callback();
        }
    }

    /**
     * Clear any ongoing animations
     */
    function clearAnimationState() {
        animationState.timeouts.forEach(function(t) { clearTimeout(t); });
        animationState.timeouts = [];
        animationState.damageQueue = [];
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
     * Display all queued damage numbers
     */
    function flushDamageQueue() {
        animationState.damageQueue.forEach(function(dmg) {
            showDamageNumberImmediate(dmg.amount, dmg.target, dmg.type);
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
     * Typewriter effect for text
     */
    function typewriterEffect(container, text, callback) {
        var index = 0;
        var speed = config.dice.typewriterSpeed;

        function typeNext() {
            if (index < text.length) {
                if (text[index] === '<') {
                    var tagEnd = text.indexOf('>', index);
                    if (tagEnd !== -1) {
                        container.innerHTML += text.substring(index, tagEnd + 1);
                        index = tagEnd + 1;
                        typeNext();
                        return;
                    }
                }

                container.innerHTML += text[index];
                index++;

                var t = setTimeout(typeNext, 1000 / speed);
                animationState.timeouts.push(t);
            } else if (callback) {
                callback();
            }
        }

        container.innerHTML = '';
        typeNext();
    }

    // === Visual Effects ===

    /**
     * Show floating damage number
     * @param {number} amount - Damage/heal amount
     * @param {string} target - 'player' or 'enemy'
     * @param {string} type - 'damage', 'heal', or 'dot'
     */
    function showDamageNumber(amount, target, type) {
        if (animationState.active) {
            queueDamageNumber(amount, target, type);
        } else {
            showDamageNumberImmediate(amount, target, type);
        }
    }

    function showDamageNumberImmediate(amount, target, type) {
        if (!elements.container) return;

        var damageNum = document.createElement('div');
        damageNum.className = 'damage-number ' + (type || 'damage');
        damageNum.textContent = (type === 'heal' ? '+' : '-') + amount;

        // Position based on target
        var container = elements.container;
        var rect = container.getBoundingClientRect();

        if (target === 'player') {
            damageNum.style.left = '25%';
            damageNum.style.bottom = '40%';
        } else {
            damageNum.style.right = '25%';
            damageNum.style.top = '30%';
        }

        container.appendChild(damageNum);

        setTimeout(function() {
            if (damageNum.parentNode) {
                damageNum.parentNode.removeChild(damageNum);
            }
        }, config.timing.damageNumberDuration);
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
        if (!elements.container) {
            elements.container = document.getElementById('vn-container');
        }
        if (!elements.container) {
            if (callback) callback();
            return;
        }

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

        setTimeout(function() {
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
            if (callback) callback();
        }, config.timing.damageNumberDuration);
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

        // Display updates
        updatePlayerHP: updatePlayerHP,
        updatePlayerMana: updatePlayerMana,
        updateEnemyHP: updateEnemyHP,
        updateLimitBar: updateLimitBar,
        updatePlayerAC: updatePlayerAC,
        updateStatuses: updateStatuses,
        updateStagger: updateStagger,
        updateTerrain: updateTerrain,
        updateSummon: updateSummon,

        // Battle log
        updateBattleLog: updateBattleLog,
        clearAnimationState: clearAnimationState,

        // Visual effects
        showDamageNumber: showDamageNumber,
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
        typewriterEffect: typewriterEffect,

        // Expose config for external timing needs
        config: config,

        // Element access (for engine.js choice rendering)
        getElements: function() { return elements; },
        getBattleChoicesContainer: function() {
            return elements.battleChoices || document.getElementById('battle-choices');
        }
    };
})();
