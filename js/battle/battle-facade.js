/**
 * Andi VN - Battle Engine Facade
 *
 * This is the main interface for the battle system. It delegates to:
 * - BattleCore: State management, HP/Mana, status effects, items, summons
 * - BattleData: Pure data tables (skills, items, status effects, etc.)
 * - BattleStyle*: Combat resolution (DnD, Pokemon, Exp33)
 * - BattleUI: Visual presentation
 *
 * Usage:
 *   BattleEngine.init(vnEngine);
 *   BattleEngine.setStyle('dnd');  // Optional, 'dnd' is default
 *   BattleEngine.start(battleConfig, sceneId);
 */

var BattleEngine = (function() {
    'use strict';

    // =========================================================================
    // MODULE DEPENDENCY CHECK
    // =========================================================================

    var _hasBattleData = typeof BattleData !== 'undefined';
    var _hasBattleIntent = typeof BattleIntent !== 'undefined';
    var _hasBattleUI = typeof BattleUI !== 'undefined';

    if (!_hasBattleData) {
        console.warn('[BattleEngine] BattleData module not loaded - some features will be unavailable');
    }

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    var T = typeof TUNING !== 'undefined' ? TUNING : null;
    var config = {
        timing: {
            battleIntro: T ? T.battle.timing.introDelay : 1500,
            battleOutro: T ? T.battle.timing.outroDelay : 2500,
            actionDelay: T ? T.battle.timing.actionDelay : 300,
            enemyTurnDelay: T ? T.battle.timing.enemyTurnDelay : 600,
            damageNumberDuration: T ? T.battle.timing.damageNumberFloat : 4000,
            sparkleInterval: T ? T.battle.effects.sparkleInterval : 150,
            sparkleLifetime: T ? T.battle.effects.sparkleLifetime : 2000,
            screenShake: T ? T.battle.timing.screenShake : 300,
            uiTransition: T ? T.battle.timing.uiTransition : 1500,
            dialogueDuration: T ? T.battle.timing.dialogueBubble : 2500,
            fadeOutDuration: T ? T.battle.timing.fadeOut : 300
        },
        dice: {
            spinDuration: T ? T.battle.dice.spinDuration : 1800,
            spinInterval: T ? T.battle.dice.spinInterval : 70,
            lingerDelay: T ? T.battle.dice.lingerDelay : 500,
            typewriterSpeed: T ? T.battle.dice.typewriterSpeed : 25
        }
    };

    // Track previous state for showing stat change notifications
    var prevDisplayState = {
        playerHP: null,
        playerMana: null,
        playerLimit: null,
        playerAC: null,
        enemyHP: null
    };

    // =========================================================================
    // PAUSE SYSTEM
    // =========================================================================

    var _isPaused = false;
    var _pauseOverlay = null;
    var _pauseKeyListenerAdded = false;
    var _pausedTimeouts = [];  // Track paused timeouts with remaining time
    var _activeTimeouts = [];  // Track active timeout IDs and their info
    var _nextTimeoutId = 1;

    /**
     * Pausable setTimeout - use this instead of setTimeout in battle code
     * Returns an ID that can be used to cancel
     */
    function scheduleTimeout(callback, delay) {
        if (_isPaused) {
            // If paused, queue it for when we unpause
            var timeoutInfo = {
                id: _nextTimeoutId++,
                callback: callback,
                remaining: delay,
                startTime: null,
                timeoutId: null
            };
            _pausedTimeouts.push(timeoutInfo);
            return timeoutInfo.id;
        }

        var timeoutInfo = {
            id: _nextTimeoutId++,
            callback: callback,
            remaining: delay,
            startTime: Date.now(),
            timeoutId: null
        };

        timeoutInfo.timeoutId = setTimeout(function() {
            // Remove from active list
            for (var i = _activeTimeouts.length - 1; i >= 0; i--) {
                if (_activeTimeouts[i].id === timeoutInfo.id) {
                    _activeTimeouts.splice(i, 1);
                    break;
                }
            }
            // Only execute if battle is still active
            if (BattleCore.isActive()) {
                callback();
            }
        }, delay);

        _activeTimeouts.push(timeoutInfo);
        return timeoutInfo.id;
    }

    /**
     * Cancel a scheduled timeout
     */
    function cancelScheduledTimeout(id) {
        // Check active timeouts
        for (var i = _activeTimeouts.length - 1; i >= 0; i--) {
            if (_activeTimeouts[i].id === id) {
                clearTimeout(_activeTimeouts[i].timeoutId);
                _activeTimeouts.splice(i, 1);
                return;
            }
        }
        // Check paused timeouts
        for (var j = _pausedTimeouts.length - 1; j >= 0; j--) {
            if (_pausedTimeouts[j].id === id) {
                _pausedTimeouts.splice(j, 1);
                return;
            }
        }
    }

    /**
     * Toggle pause state
     */
    function togglePause() {
        if (_isPaused) {
            unpause();
        } else {
            pause();
        }
    }

    /**
     * Pause the battle - freezes all scheduled timeouts
     */
    function pause() {
        if (_isPaused) return;
        _isPaused = true;

        // Pause all active timeouts - calculate remaining time
        var now = Date.now();
        for (var i = 0; i < _activeTimeouts.length; i++) {
            var info = _activeTimeouts[i];
            clearTimeout(info.timeoutId);
            info.remaining = Math.max(0, info.remaining - (now - info.startTime));
            _pausedTimeouts.push(info);
        }
        _activeTimeouts = [];

        // Create pause overlay if it doesn't exist
        if (!_pauseOverlay) {
            _pauseOverlay = document.createElement('div');
            _pauseOverlay.id = 'battle-pause-overlay';
            _pauseOverlay.className = 'battle-pause-overlay';
            _pauseOverlay.innerHTML = '<div class="pause-text">PAUSED</div><div class="pause-hint">Press P to resume</div>';
        }

        var container = document.getElementById('vn-container');
        if (container) {
            container.appendChild(_pauseOverlay);
        }

        // Pause dice animations
        if (typeof BattleDiceUI !== 'undefined' && BattleDiceUI.pause) {
            BattleDiceUI.pause();
        }

        console.log('[BattleEngine] Paused -', _pausedTimeouts.length, 'timeouts frozen');
    }

    /**
     * Unpause the battle - resumes all paused timeouts
     */
    function unpause() {
        if (!_isPaused) return;
        _isPaused = false;

        if (_pauseOverlay && _pauseOverlay.parentNode) {
            _pauseOverlay.parentNode.removeChild(_pauseOverlay);
        }

        // Resume dice animations
        if (typeof BattleDiceUI !== 'undefined' && BattleDiceUI.unpause) {
            BattleDiceUI.unpause();
        }

        // Resume all paused timeouts with their remaining time
        var now = Date.now();
        for (var i = 0; i < _pausedTimeouts.length; i++) {
            var info = _pausedTimeouts[i];
            info.startTime = now;
            (function(capturedInfo) {
                capturedInfo.timeoutId = setTimeout(function() {
                    // Remove from active list
                    for (var j = _activeTimeouts.length - 1; j >= 0; j--) {
                        if (_activeTimeouts[j].id === capturedInfo.id) {
                            _activeTimeouts.splice(j, 1);
                            break;
                        }
                    }
                    capturedInfo.callback();
                }, capturedInfo.remaining);
            })(info);
            _activeTimeouts.push(info);
        }

        console.log('[BattleEngine] Unpaused -', _pausedTimeouts.length, 'timeouts resumed');
        _pausedTimeouts = [];
    }

    /**
     * Check if battle is paused
     */
    function isPaused() {
        return _isPaused;
    }

    /**
     * Handle pause key press
     */
    function handlePauseKey(event) {
        if (event.code === 'KeyP' && isActive()) {
            event.preventDefault();
            togglePause();
        }
    }

    /**
     * Set up pause key listener
     */
    function ensurePauseKeyListener() {
        if (_pauseKeyListenerAdded) return;
        document.addEventListener('keydown', handlePauseKey);
        _pauseKeyListenerAdded = true;
    }

    /**
     * Clear all scheduled timeouts (called on battle end/reset)
     */
    function clearAllScheduledTimeouts() {
        for (var i = 0; i < _activeTimeouts.length; i++) {
            clearTimeout(_activeTimeouts[i].timeoutId);
        }
        _activeTimeouts = [];
        _pausedTimeouts = [];
    }

    // =========================================================================
    // STYLE REGISTRY
    // =========================================================================

    var styles = {};
    var activeStyleName = 'dnd';

    /**
     * Register a battle style
     * @param {string} name - Style identifier
     * @param {Object} style - Style module
     */
    function registerStyle(name, style) {
        styles[name] = style;
    }

    /**
     * Set active battle style
     * @param {string} name - Style name ('dnd', 'pokemon', 'exp33')
     */
    function setStyle(name) {
        if (!styles[name]) {
            console.warn('[BattleEngine] Unknown style:', name, '- falling back to dnd');
            name = 'dnd';
        }
        activeStyleName = name;
        BattleCore.setStyle(styles[name]);
    }

    /**
     * Get current style name
     */
    function getStyleName() {
        return activeStyleName;
    }

    /**
     * Get active style module
     */
    function getActiveStyle() {
        return styles[activeStyleName];
    }

    // =========================================================================
    // REFERENCES
    // =========================================================================

    var vnEngine = null;
    var _initialized = false;  // Track initialization state internally
    var _actionInProgress = false;  // Prevent race conditions from spam-clicking
    var elements = {
        container: null,
        textBox: null,
        battleUI: null,
        battleLog: null
    };

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /**
     * Check if battle engine is initialized
     * @returns {boolean} True if initialized
     */
    function isInitialized() {
        return _initialized;
    }

    /**
     * Initialize the battle engine
     * @param {Object} engine - VN Engine reference
     */
    function init(engine) {
        if (_initialized) return;  // Prevent double initialization

        vnEngine = engine;
        elements.container = document.getElementById('vn-container');
        elements.textBox = document.getElementById('text-box');

        // Initialize BattleCore with engine callbacks
        BattleCore.init({
            loadScene: engine ? engine.loadScene : null,
            playSfx: engine ? engine.playSfx : null,
            getInventory: engine ? engine.getInventory : null,
            hasItem: engine ? engine.hasItem : null,
            removeItem: engine ? engine.removeItem : null
        });

        // Register default styles
        if (typeof BattleStyleDnD !== 'undefined') {
            registerStyle('dnd', BattleStyleDnD);
        }
        if (typeof BattleStylePokemon !== 'undefined') {
            registerStyle('pokemon', BattleStylePokemon);
        }
        if (typeof BattleStyleExp33 !== 'undefined') {
            registerStyle('exp33', BattleStyleExp33);
        }

        // Set default style
        setStyle('dnd');

        // Initialize BattleUI module
        if (typeof BattleUI !== 'undefined') {
            BattleUI.init(elements.container, elements.textBox);
            BattleUI.setSfxCallback(playSfx);
        }

        // Initialize BattleDiceUI module
        if (typeof BattleDiceUI !== 'undefined') {
            BattleDiceUI.setSfxCallback(playSfx);
        }

        // Initialize QTE system
        if (typeof QTEEngine !== 'undefined') {
            QTEEngine.init(window.BattleEngine);
            // Initialize and set UI reference if QTEUI is available
            if (typeof QTEUI !== 'undefined') {
                QTEUI.init(elements.container);
                QTEEngine.setUI(QTEUI);
            }
            // Bind input handlers for QTE (keyboard/click/touch)
            QTEEngine.bindInputs();
        }

        _initialized = true;
    }

    // =========================================================================
    // FORCED ROLL / DAMAGE / STATUS (DEV MODE)
    // =========================================================================

    var forcedRollCallback = null;
    var forcedDamageCallback = null;
    var guaranteeStatusCallback = null;

    function setForcedRollCallback(callback) {
        forcedRollCallback = callback;
        // Pass to active style
        var style = getActiveStyle();
        if (style && style.setForcedRollCallback) {
            style.setForcedRollCallback(callback);
        }
    }

    function setForcedDamageCallback(callback) {
        forcedDamageCallback = callback;
        // Pass to dice module
        if (typeof BattleDice !== 'undefined' && BattleDice.setForcedDamageCallback) {
            BattleDice.setForcedDamageCallback(callback);
        }
    }

    function setGuaranteeStatusCallback(callback) {
        guaranteeStatusCallback = callback;
        // Pass to core module
        if (typeof BattleCore !== 'undefined' && BattleCore.setGuaranteeStatusCallback) {
            BattleCore.setGuaranteeStatusCallback(callback);
        }
    }

    // =========================================================================
    // BATTLE FLOW
    // =========================================================================

    // Mutable state object for engine callbacks (like onBattleReady)
    var battleState = {
        player: null,
        enemy: null,
        onBattleReady: null
    };

    /**
     * Start a new battle
     * @param {Object} battleConfig - Battle configuration
     * @param {string} sceneId - Current scene ID
     * @returns {Object} Battle state for engine compatibility
     */
    function start(battleConfig, sceneId) {
        console.log('[BattleEngine] start() called', { battleConfig: battleConfig, sceneId: sceneId });

        // Ensure pause key listener is set up
        ensurePauseKeyListener();

        // Make sure we're not paused from a previous battle
        _isPaused = false;

        // Determine style from config
        var styleName = battleConfig.style || 'dnd';
        setStyle(styleName);
        console.log('[BattleEngine] Style set to:', styleName);

        // Pass forced roll to style
        var style = getActiveStyle();
        if (style && style.setForcedRollCallback && forcedRollCallback) {
            style.setForcedRollCallback(forcedRollCallback);
        }

        // Pass forced damage to dice module
        if (typeof BattleDice !== 'undefined' && BattleDice.setForcedDamageCallback && forcedDamageCallback) {
            BattleDice.setForcedDamageCallback(forcedDamageCallback);
        }

        // Pass guarantee status to core module
        if (typeof BattleCore !== 'undefined' && BattleCore.setGuaranteeStatusCallback && guaranteeStatusCallback) {
            BattleCore.setGuaranteeStatusCallback(guaranteeStatusCallback);
        }

        // Reset music state for new battle
        resetMusicState();

        // Start battle in core (accepts flat config format from story.js)
        console.log('[BattleEngine] Calling BattleCore.startBattle...');
        BattleCore.startBattle(battleConfig, sceneId);
        console.log('[BattleEngine] BattleCore.startBattle completed');

        // Get state for UI and sync to mutable battleState
        var coreState = BattleCore.getState();
        console.log('[BattleEngine] Core state:', { player: coreState.player, enemy: coreState.enemy });
        battleState.player = coreState.player;
        battleState.enemy = coreState.enemy;
        battleState.onBattleReady = null;  // Reset callback

        // Show battle intro
        console.log('[BattleEngine] Calling showBattleIntro...');
        showBattleIntro(coreState.enemy, function() {
            console.log('[BattleEngine] Intro callback fired');
            showUI();
            console.log('[BattleEngine] showUI() completed');
            updateDisplay();
            console.log('[BattleEngine] updateDisplay() completed');

            // Trigger start dialogue
            var startLine = BattleCore.triggerDialogue('battle_start');
            if (startLine) {
                showDialogueBubble(startLine);
            }

            // Call onBattleReady callback if set by engine
            console.log('[BattleEngine] Checking onBattleReady:', typeof battleState.onBattleReady);
            if (typeof battleState.onBattleReady === 'function') {
                console.log('[BattleEngine] Calling onBattleReady...');
                battleState.onBattleReady();
            }
        });

        // Return mutable state for engine compatibility (allows setting callbacks)
        console.log('[BattleEngine] start() returning battleState');
        return battleState;
    }

    /**
     * End the current battle
     * @param {string} result - 'win', 'lose', or 'flee'
     */
    function end(result) {
        // Clear action lock when battle ends
        _actionInProgress = false;

        // Reset intent system
        if (_hasBattleIntent) {
            BattleIntent.reset();
        }
        // Hide intent indicator if visible
        if (_hasBattleUI && BattleUI.hideIntentIndicator) {
            BattleUI.hideIntentIndicator();
        }

        var endInfo = BattleCore.endBattle(result);

        // Show outro transition
        showBattleOutro(result, function() {
            hideUI();
            showTextBox();

            if (endInfo.target && vnEngine && vnEngine.loadScene) {
                vnEngine.loadScene(endInfo.target);
            }
        });
    }

    /**
     * Reset battle state
     */
    function reset() {
        // Clear all pending timeouts to prevent callbacks after reset
        clearAllScheduledTimeouts();

        // Clear action lock
        _actionInProgress = false;

        // Make sure we're not paused
        _isPaused = false;
        if (_pauseOverlay && _pauseOverlay.parentNode) {
            _pauseOverlay.parentNode.removeChild(_pauseOverlay);
        }

        // Reset intent system
        if (_hasBattleIntent) {
            BattleIntent.reset();
        }
        // Hide intent indicator if visible
        if (_hasBattleUI && BattleUI.hideIntentIndicator) {
            BattleUI.hideIntentIndicator();
        }

        // End battle properly (sets active = false)
        BattleCore.endBattle('flee');

        // Remove any battle overlays
        var overlays = ['battle-intro-overlay', 'battle-intro-flash', 'battle-outro-overlay'];
        overlays.forEach(function(id) {
            var el = document.getElementById(id);
            if (el && el.parentNode) el.parentNode.removeChild(el);
        });

        // Remove sprite animation classes
        var spriteLayer = document.getElementById('sprite-layer');
        if (spriteLayer) {
            spriteLayer.classList.remove('battle-intro-enemy');
        }

        hideUI();
        destroyUI();
        showTextBox();
    }

    /**
     * Check if battle has ended
     */
    function checkEnd() {
        var result = BattleCore.checkBattleEnd();
        if (result && result.ended) {
            // Trigger dialogue
            var dialogueType = result.result === 'win' ? 'victory' : 'defeat';
            var line = BattleCore.triggerDialogue(dialogueType);
            if (line) {
                showDialogueBubble(line);
            }

            scheduleTimeout(function() {
                end(result.result);
            }, config.timing.battleOutro);

            return true;
        }
        return false;
    }

    // =========================================================================
    // ACTION EXECUTION
    // =========================================================================

    /**
     * Execute a player action
     * @param {string} action - Action type ('attack', 'skill', 'defend', 'flee', 'item', 'limit')
     * @param {Object} params - Action parameters
     * @param {Function} callback - Completion callback
     */
    function executeAction(action, params, callback) {
        // Guard against spam-clicking race conditions
        if (_actionInProgress) return;

        var state = BattleCore.getState();
        if (!state.active || state.phase !== 'player') return;

        // Lock action processing IMMEDIATELY to prevent any queued clicks
        _actionInProgress = true;

        // Set phase to animating (also disables buttons visually)
        BattleCore.setPhase('animating');

        params = params || {};
        var style = getActiveStyle();
        var messages = [];
        var result = null;

        // Check if player can act (status was already ticked in finishEnemyTurn)
        var statusResult = state._playerStatusResult;
        if (statusResult && !statusResult.canAct) {
            // Clear the stored result
            state._playerStatusResult = null;
            // Skip to enemy turn
            processEnemyTurn(messages, callback, { playerAction: 'stunned' });
            return;
        }
        // Clear stored result after use
        state._playerStatusResult = null;

        // Handle action based on type
        switch (action) {
            case 'attack':
                handleAttackAction(style, params, messages, callback);
                break;

            case 'skill':
                handleSkillAction(style, params, messages, callback);
                break;

            case 'defend':
                handleDefendAction(style, messages, callback);
                break;

            case 'flee':
                handleFleeAction(style, messages, callback);
                break;

            case 'item':
                handleItemAction(params, messages, callback);
                break;

            case 'limit':
                handleLimitBreakAction(style, messages, callback);
                break;

            default:
                console.warn('[BattleEngine] Unknown action:', action);
                BattleCore.setPhase('player');
        }
    }

    function handleAttackAction(style, params, messages, callback) {
        // Check if QTE is enabled for attacks
        if (isQTEEnabledForAttacks()) {
            executeAttackWithQTE(function(qteResult) {
                var result = style.playerAttack(qteResult);
                finishPlayerAction('attack', result, messages, callback);
            });
        } else {
            var result = style.playerAttack();
            finishPlayerAction('attack', result, messages, callback);
        }
    }

    function handleSkillAction(style, params, messages, callback) {
        var skillId = params.skill || params.skillId;

        // Check if QTE is enabled for skills and style supports it
        if (isQTEEnabledForSkills() && style.playerSkillWithQTE) {
            style.playerSkillWithQTE(skillId, function(result) {
                if (!result.success) {
                    messages.push(result.messages ? result.messages[0] : 'Skill failed!');
                    updateBattleLog(messages.join('<br>'), null, function() {
                        BattleCore.setPhase('player');
                    });
                    return;
                }
                // Update mana display immediately after skill is used (before dice animation)
                updateDisplay();
                finishPlayerAction('skill', result, messages, callback);
            });
        } else {
            var result = style.playerSkill(skillId);

            if (!result.success) {
                messages.push(result.messages ? result.messages[0] : 'Skill failed!');
                updateBattleLog(messages.join('<br>'), null, function() {
                    BattleCore.setPhase('player');
                });
                return;
            }

            // Update mana display immediately after skill is used (before dice animation)
            updateDisplay();
            finishPlayerAction('skill', result, messages, callback);
        }
    }

    function handleDefendAction(style, messages, callback) {
        var result = style.playerDefend();
        // NOTE: Don't updateDisplay() here - wait until animation completes
        // so MP bar updates at the same time as the "Recovered +X MP!" text

        // But DO refresh battle choices immediately to show defending countdown
        if (typeof VNEngine !== 'undefined' && VNEngine.refreshBattleChoices) {
            VNEngine.refreshBattleChoices();
        }

        var battleLogContent = document.getElementById('battle-log-content');
        battleLogContent.innerHTML = '';
        // Create wrapper div for consistent styling with attack rolls
        var logEntry = document.createElement('div');
        logEntry.className = 'battle-log-messages';
        battleLogContent.appendChild(logEntry);
        BattleDiceUI.showDefendRoll({
            container: logEntry,
            defender: BattleCore.getPlayer().name,
            rollResult: result.rollResult,
            acBonus: result.acBonus,
            manaRecovered: result.manaRecovered,
            manaRolled: result.manaRolled,
            cooldown: result.cooldown,
            isMinMana: result.isMinMana,
            isMaxMana: result.isMaxMana,
            onACComplete: function(acBonus) {
                // Show floating +AC number on player after AC text completes
                showDamageNumber(acBonus, 'player', 'ac-boost');
            }
        }, function() {
            updateDisplay();  // Update MP bar after animation completes
            processEnemyTurn(messages, callback, { playerAction: 'defend' });
        });
    }

    function handleFleeAction(style, messages, callback) {
        var result = style.playerFlee();
        messages = messages.concat(result.messages || []);

        // Wait for battle log animation to complete
        updateBattleLog(messages.join('<br>'), null, function() {
            if (result.success) {
                end('flee');
            } else {
                processEnemyTurn(messages, callback, { playerAction: 'flee' });
            }
        });
    }

    function handleItemAction(params, messages, callback) {
        var itemId = params.item || params.itemId;
        var result = BattleCore.useItem(itemId);

        if (!result.success) {
            messages.push(result.messages ? result.messages[0] : 'Item failed!');
            updateBattleLog(messages.join('<br>'), null, function() {
                BattleCore.setPhase('player');
            });
            return;
        }

        messages = messages.concat(result.messages || []);
        updateDisplay();

        // Wait for battle log animation to complete before enemy turn
        updateBattleLog(messages.join('<br>'), null, function() {
            processEnemyTurn(messages, callback, { playerAction: 'item' });
        });
    }

    function handleLimitBreakAction(style, messages, callback) {
        var result = style.playerLimitBreak();

        if (!result.success) {
            messages.push(result.messages ? result.messages[0] : 'Limit Break not ready!');
            updateBattleLog(messages.join('<br>'), null, function() {
                BattleCore.setPhase('player');
            });
            return;
        }

        finishPlayerAction('limit', result, messages, callback);
    }

    function finishPlayerAction(actionType, result, messages, callback) {
        var state = BattleCore.getState();

        // If we have an attack result with a roll, show animated dice roll
        if (result.attackResult && result.attackResult.roll !== undefined) {
            var attackerName = state.player.name || 'Andi';

            showAttackRoll(attackerName, result.attackResult, true, function() {
                // After animation, show result and continue
                finishPlayerActionAfterRoll(actionType, result, messages, callback);
            });
        }
        // If player used a heal skill, show animated heal roll
        else if (result.healed !== undefined) {
            var playerName = state.player.name || 'Andi';
            var healRolled = result.healRolled || result.healed;  // Rolled amount (before cap)
            showHealRoll(playerName, result.healed, healRolled, {
                isMinHeal: result.isMinHeal,
                isMaxHeal: result.isMaxHeal,
                hasHealAdvantage: result.hasHealAdvantage,
                hasHealDisadvantage: result.hasHealDisadvantage,
                healRolls: result.healRolls
            }, function() {
                // Show floating heal number on player (only if > 0)
                if (result.healed > 0) {
                    // Determine heal type for floating number styling
                    var healType = 'heal';
                    if (result.isMaxHeal) healType = 'maxheal';
                    else if (result.isMinHeal) healType = 'minheal';
                    showDamageNumber(result.healed, 'player', healType);
                }
                finishPlayerActionAfterRoll(actionType, result, messages, callback);
            });
        } else {
            // No roll (e.g., defend, item), just show messages
            finishPlayerActionAfterRoll(actionType, result, messages, callback);
        }
    }

    function finishPlayerActionAfterRoll(actionType, result, messages, callback) {
        var state = BattleCore.getState();
        messages = messages.concat(result.messages || []);

        // Show damage number if attack hit
        if (result.attackResult && result.attackResult.hit) {
            var damageType = 'damage';
            if (result.attackResult.isCrit) {
                damageType = 'crit';
            } else if (result.attackResult.isMaxDamage) {
                damageType = 'maxdamage';
            } else if (result.attackResult.isMinDamage) {
                damageType = 'mindamage';
            }
            showDamageNumber(result.attackResult.damage, 'enemy', damageType);

            // Trigger crit/fumble dialogue
            if (result.attackResult.isCrit) {
                var critLine = BattleCore.triggerDialogue('player_crit');
                if (critLine) showDialogueBubble(critLine);
            }

            // === INTENT SYSTEM: Check if status effect breaks concentration ===
            if (_hasBattleIntent && result.attackResult.statusResult && result.attackResult.statusResult.applied) {
                var statusType = result.attackResult.statusResult.type ||
                    (result.skill && result.skill.statusEffect && result.skill.statusEffect.type);
                if (statusType && BattleIntent.wouldBreak(statusType)) {
                    var breakResult = BattleIntent.breakIntent(state.turn);
                    if (breakResult.broken) {
                        // Show visual feedback
                        if (_hasBattleUI && BattleUI.hideIntentIndicator) {
                            BattleUI.hideIntentIndicator('broken');
                        }
                        // Add message to battle log
                        var enemyName = state.enemy.name || 'Enemy';
                        messages.push('<span class="intent-broken-message">' + enemyName + '\'s ' + breakResult.message + '</span>');
                    }
                }
            }
        } else if (result.attackResult && result.attackResult.isFumble) {
            // Show fumble message with confusion status
            var playerName = state.player.name || 'Andi';
            var fumbleText = BattleCore.triggerDialogue('fumble_text') || 'trips over their own feet';
            var fumbleMsg = playerName + ' ' + fumbleText + '!';
            if (result.attackResult.fumbleStatusResult && result.attackResult.fumbleStatusResult.applied) {
                // Check if confusion just expired this turn (re-applying = "stays confused")
                var statusResult = state._playerStatusResult;
                var confusionJustExpired = statusResult && statusResult.expiredStatuses &&
                    statusResult.expiredStatuses.indexOf('confusion') !== -1;

                if (confusionJustExpired) {
                    // Remove the "wore off" message since we're staying confused
                    if (statusResult.messages) {
                        for (var i = statusResult.messages.length - 1; i >= 0; i--) {
                            if (statusResult.messages[i].indexOf('wore off') !== -1 &&
                                statusResult.messages[i].indexOf('Confusion') !== -1) {
                                statusResult.messages.splice(i, 1);
                                break;
                            }
                        }
                    }
                    fumbleMsg += ' ' + playerName + ' stays confused!';
                } else {
                    fumbleMsg += ' ' + playerName + ' is confused!';
                }
                // Show confusion dialogue (takes priority over fumble dialogue)
                var confusionLine = BattleCore.triggerDialogue('status_confusion');
                if (confusionLine) showDialogueBubble(confusionLine);
            } else {
                // No confusion, show fumble dialogue
                var fumbleLine = BattleCore.triggerDialogue('player_fumble');
                if (fumbleLine) showDialogueBubble(fumbleLine);
            }
            messages.push(fumbleMsg);
        }

        // Show damage for limit break
        if (actionType === 'limit' && result.totalDamage) {
            showDamageNumber(result.totalDamage, 'enemy', 'limit');
        }

        // Show miss via WoW-style floating text (battle log is for rolls only)
        if (result.attackResult && !result.attackResult.hit) {
            showDamageNumber(0, 'enemy', 'miss');
        }

        updateDisplay();

        // Check if enemy died
        if (checkEnd()) return;

        // Process summon turn
        var summonResult = BattleCore.processSummonTurn();
        if (summonResult.acted) {
            // Wait for summon message before proceeding to enemy turn
            updateBattleLog(summonResult.messages.join('<br>'), null, function() {
                updateDisplay();
                if (checkEnd()) return;
                proceedToEnemyTurn(actionType, messages, callback);
            });
            return;
        }

        // If there are fumble/miss messages to display, show them before enemy turn
        if (result.attackResult && result.attackResult.isFumble && messages.length > 0) {
            updateBattleLog(messages.join('<br>'), null, function() {
                proceedToEnemyTurn(actionType, [], callback);
            });
            return;
        }

        // Proceed to enemy turn after a short delay (for visual effects to register)
        proceedToEnemyTurn(actionType, messages, callback);
    }

    function proceedToEnemyTurn(actionType, messages, callback) {
        scheduleTimeout(function() {
            processEnemyTurn(messages, callback, { playerAction: actionType });
        }, config.timing.enemyTurnDelay);
    }

    /**
     * Process enemy turn
     */
    function processEnemyTurn(playerMessages, callback, context) {
        var state = BattleCore.getState();
        var style = getActiveStyle();
        var enemy = state.enemy;
        var messages = [];

        // Process enemy status effects
        var statusResult = BattleCore.tickStatuses(enemy, enemy.name);
        state._enemyStatusResult = statusResult;  // Store for fumble handling
        messages = messages.concat(statusResult.messages);

        if (statusResult.damage > 0) {
            showDamageNumber(statusResult.damage, 'enemy', 'dot');
        }
        if (statusResult.heal > 0) {
            showDamageNumber(statusResult.heal, 'enemy', 'heal');
        }

        // Handle enemy confusion self-damage with animated dice roll (using modular BattleDiceUI)
        if (statusResult.confusionDamage > 0) {
            var confusionDmg = statusResult.confusionDamage;
            var enemyName = enemy.name;

            // Show any other status messages first, then show confusion roll
            function showEnemyConfusionRoll() {
                // Apply damage to enemy
                enemy.hp -= confusionDmg;

                // Get battle log container
                var battleLog = document.getElementById('battle-log-content');
                if (!battleLog) {
                    finishEnemyConfusionTurn();
                    return;
                }

                // Use modular BattleDiceUI.showSimpleDamageRoll for animated dice
                if (typeof BattleDiceUI !== 'undefined' && BattleDiceUI.showSimpleDamageRoll) {
                    BattleDiceUI.showSimpleDamageRoll({
                        container: battleLog,
                        text: enemyName + ' hits themselves! ',
                        damage: confusionDmg,
                        sides: 5  // d5 for confusion damage
                    }, function() {
                        showDamageNumber(confusionDmg, 'enemy', 'damage');
                        updateDisplay();
                        finishEnemyConfusionTurn();
                    });
                } else {
                    // Fallback without animation
                    battleLog.innerHTML = '<div class="roll-result">' + enemyName + ' hits themselves! <strong class="dice-number roll-damage-normal">' + confusionDmg + '</strong> <span class="damage-text roll-type-damage">DAMAGE</span></div>';
                    showDamageNumber(confusionDmg, 'enemy', 'damage');
                    updateDisplay();
                    setTimeout(finishEnemyConfusionTurn, 800);
                }
            }

            function finishEnemyConfusionTurn() {
                // Check if enemy died from confusion damage
                if (checkEnd()) return;

                // Confusion means enemy can't act - end their turn
                finishEnemyTurn([], callback);
            }

            // If there are other status messages, show them first
            if (messages.length > 0) {
                updateBattleLog(messages.join('<br>'), null, showEnemyConfusionRoll);
            } else {
                showEnemyConfusionRoll();
            }
            return;
        }

        // Check if enemy died from status
        if (checkEnd()) return;

        // Check if enemy can act
        if (!statusResult.canAct) {
            // Wait for status message to complete before ending turn
            // Don't pass messages to finishEnemyTurn - already displayed above
            updateBattleLog(messages.join('<br>'), null, function() {
                finishEnemyTurn([], callback);
            });
            return;
        }

        // === INTENT SYSTEM: Check for telegraphed attacks ===
        if (_hasBattleIntent) {
            var intent = BattleIntent.get();

            // If there's a ready intent, execute it instead of normal attack
            if (intent && intent.isTelegraphed && BattleIntent.isReady()) {
                executeIntentAttack(style, intent, messages, callback);
                return;
            }

            // If there's an active (not ready) intent, show the enemy is preparing
            // and still do a normal attack
            if (intent && intent.isTelegraphed && intent.turnsRemaining > 0) {
                // Intent already displayed, just proceed with normal attack
            } else {
                // Check if a new intent should trigger
                var newIntent = BattleIntent.generate(enemy, state.player);
                if (newIntent && newIntent.isTelegraphed) {
                    // New intent triggered - show preparation
                    showIntentPreparation(enemy, newIntent, function() {
                        // After showing intent, proceed with normal attack
                        proceedWithNormalAttack();
                    });
                    return;
                }
            }
        }

        // Normal attack flow
        proceedWithNormalAttack();

        function proceedWithNormalAttack() {
            // Try to get an enemy taunt based on context
            var taunt = getEnemyTaunt(context);
            if (taunt) {
                // Show dialogue bubble, then wait before attacking
                showDialogueBubble(taunt);
                scheduleTimeout(function() {
                    executeEnemyAttack(style, messages, callback);
                }, config.timing.dialogueDuration);
            } else {
                // No taunt, attack immediately
                executeEnemyAttack(style, messages, callback);
            }
        }
    }

    /**
     * Show intent preparation dialogue and UI
     */
    function showIntentPreparation(enemy, intent, callback) {
        var enemyName = enemy.name || 'Enemy';
        var dialogue = intent.dialogue || (enemyName + ' is preparing something...');

        // Show dialogue bubble
        showDialogueBubble(dialogue);

        // Show intent indicator above enemy
        if (_hasBattleUI && BattleUI.showIntentIndicator) {
            var displayData = BattleIntent.getDisplayData();
            BattleUI.showIntentIndicator(displayData);
        }

        // Log the intent
        var intentType = BattleIntent.getType(intent.type);
        var logClass = 'intent-message ' + (intent.cssClass || '');
        var logMessage = '<span class="' + logClass + '">' + enemyName + ' ' + dialogue + '</span>';
        updateBattleLog(logMessage, null, function() {
            scheduleTimeout(callback, config.timing.dialogueDuration);
        });
    }

    /**
     * Execute a telegraphed intent attack
     */
    function executeIntentAttack(style, intent, messages, callback) {
        var state = BattleCore.getState();
        var enemy = state.enemy;
        var player = state.player;
        var enemyName = enemy.name || 'Enemy';

        // Get the skill from the intent
        var skill = intent.skill || BattleIntent.getSkill();
        if (!skill) {
            console.warn('[BattleEngine] Intent has no skill, falling back to normal attack');
            BattleIntent.clear(state.turn);
            if (_hasBattleUI && BattleUI.hideIntentIndicator) {
                BattleUI.hideIntentIndicator('execute');
            }
            executeEnemyAttack(style, messages, callback);
            return;
        }

        // Show execution dialogue
        var execDialogue = intent.executeDialogue || (enemyName + ' unleashes ' + skill.name + '!');
        showDialogueBubble(execDialogue);

        // Hide intent indicator with execute animation
        if (_hasBattleUI && BattleUI.hideIntentIndicator) {
            BattleUI.hideIntentIndicator('execute');
        }

        // Wait for dialogue, then execute the attack
        scheduleTimeout(function() {
            executeIntentSkill(style, skill, intent, messages, callback);
        }, config.timing.dialogueDuration);
    }

    /**
     * Execute the actual intent skill
     */
    function executeIntentSkill(style, skill, intent, messages, callback) {
        var state = BattleCore.getState();
        var enemy = state.enemy;
        var player = state.player;
        var enemyName = enemy.name || 'Enemy';

        // Clear the intent (record cooldown)
        BattleIntent.clear(state.turn);

        // Handle summon type (not implemented yet - placeholder)
        if (skill.isSummon) {
            var summonMsg = enemyName + ' calls for reinforcements!';
            updateBattleLog(summonMsg, null, function() {
                // TODO: Implement actual summon logic
                finishEnemyTurn([], callback);
            });
            return;
        }

        // Handle multi-hit skill
        if (skill.hits && skill.hits > 1) {
            executeMultiHitIntentSkill(style, skill, intent, messages, callback);
            return;
        }

        // Single big attack - resolve like normal enemy attack
        var attackResult = style.resolveAttack ?
            style.resolveAttack(enemy, player, skill) :
            { hit: true, damage: style.rollDamage ? style.rollDamage(skill.damage) : 5 };

        var resultMsgs = [];
        resultMsgs.push(enemyName + ' uses ' + skill.name + '!');

        if (attackResult.hit) {
            var damage = attackResult.damage || 5;
            BattleCore.damagePlayer(damage, { source: 'intent', type: skill.type });
            resultMsgs.push('<span class="roll-damage-normal">' + damage + ' DAMAGE</span>');
            showDamageNumber(damage, 'player', 'damage');

            if (attackResult.isCrit) {
                resultMsgs.push('Critical hit!');
            }
        } else {
            resultMsgs.push('But it missed!');
        }

        updateBattleLog(resultMsgs.join('<br>'), null, function() {
            updateDisplay();
            if (checkEnd()) return;
            finishEnemyTurn([], callback);
        });
    }

    /**
     * Execute a multi-hit intent skill
     */
    function executeMultiHitIntentSkill(style, skill, intent, messages, callback) {
        var state = BattleCore.getState();
        var enemy = state.enemy;
        var player = state.player;
        var enemyName = enemy.name || 'Enemy';
        var hits = skill.hits || 1;
        var currentHit = 0;
        var totalDamage = 0;

        function executeHit() {
            currentHit++;
            if (currentHit > hits || player.hp <= 0) {
                // All hits done
                var totalMsg = 'Total: <span class="roll-damage-normal">' + totalDamage + ' DAMAGE</span>';
                updateBattleLog(totalMsg, null, function() {
                    updateDisplay();
                    if (checkEnd()) return;
                    finishEnemyTurn([], callback);
                });
                return;
            }

            // Resolve single hit
            var attackResult = style.resolveAttack ?
                style.resolveAttack(enemy, player, skill) :
                { hit: true, damage: style.rollDamage ? style.rollDamage(skill.damage) : 2 };

            if (attackResult.hit) {
                var damage = attackResult.damage || 2;
                totalDamage += damage;
                BattleCore.damagePlayer(damage, { source: 'intent', type: skill.type });
                showDamageNumber(damage, 'player', 'damage');
            }

            // Small delay between hits
            scheduleTimeout(function() {
                updateDisplay();
                if (player.hp <= 0) {
                    checkEnd();
                    return;
                }
                executeHit();
            }, 300);
        }

        // Start the multi-hit sequence
        updateBattleLog(enemyName + ' uses ' + skill.name + '!', null, function() {
            executeHit();
        });
    }

    function executeEnemyAttack(style, messages, callback) {
        var state = BattleCore.getState();
        var player = state.player;

        // Check if player is in defensive stance - trigger defend QTE
        if (player.defending && player.defending > 0 && isQTEEnabledForDefend()) {
            processDefendQTE(style, messages, callback);
            return;
        }

        // Check QTE for dodge (standard non-defending)
        if (isQTEEnabledForDodge()) {
            processEnemyAttackWithQTE(function(qteResult) {
                var result = style.enemyTurn(qteResult);
                finishEnemyAction(result, messages, callback);
            });
        } else {
            var result = style.enemyTurn();
            finishEnemyAction(result, messages, callback);
        }
    }

    /**
     * Check if defend QTE is enabled
     */
    function isQTEEnabledForDefend() {
        return typeof QTEEngine !== 'undefined' && QTEEngine.isEnabled &&
            QTEEngine.isEnabled() && T && T.qte && T.qte.enabledForDefend;
    }

    /**
     * Process defend QTE when player is in defensive stance
     * Outcomes:
     *   - Perfect (PARRY): Reflect 1d5 damage, no damage taken
     *   - Good (DODGE): Avoid attack completely
     *   - Normal (CONFUSE): Get confused AND hit
     *   - Bad (FUMBLE): Confused, hit, lose AC bonus
     */
    function processDefendQTE(style, messages, callback) {
        var state = BattleCore.getState();
        var player = state.player;
        var enemy = state.enemy;
        var enemyName = enemy.name || 'Enemy';
        var playerName = player.name || 'Andi';

        // Select enemy move first to know incoming attack
        var move = style.selectEnemyMove ? style.selectEnemyMove() : { name: 'Attack' };
        var moveName = move.name || 'Attack';

        // Check if this is an attack move (not a heal or buff)
        var isAttackMove = !move.isHeal && !move.isBuff && !move.isDefend;

        // If not an attack, skip the defend QTE and just execute the enemy turn normally
        if (!isAttackMove) {
            var result = style.enemyTurn();
            finishEnemyAction(result, messages, callback);
            return;
        }

        // Show enemy attack announcement and player bracing before QTE
        var preQTEMessage = enemyName + ' uses ' + moveName + '!<br>' + playerName + ' braces himself!';

        updateBattleLog(preQTEMessage, null, function() {
            // Now launch the defend QTE
            QTEEngine.startDefendQTE({
                difficulty: 'normal',
                enemyAttackName: moveName
            }, function(qteResult) {
                processDefendQTEResult(style, player, enemy, move, qteResult, callback);
            });
        });
    }

    /**
     * Process the result of a defend QTE
     * Flow: QTE done -> Show enemy attack roll -> Show result (parry/dodge/hit)
     */
    function processDefendQTEResult(style, player, enemy, move, qteResult, callback) {
        var enemyName = enemy.name || 'Enemy';
        var playerName = player.name || 'Andi';

        var zone = qteResult.zone || 'normal';
        var mods = qteResult.modifiers || QTEEngine.getDefendModifiers(zone);

        // Decrement defending counter
        player.defending--;

        // Check if stance wore off
        var stanceWoreOff = player.defending <= 0;

        // Force end defend on fumble
        if (mods.defendEnds) {
            player.defending = 0;
            stanceWoreOff = true;
        }

        // Execute enemy attack to get the roll (but don't apply damage yet for parry/dodge)
        var attackResult = style.enemyTurn ? style.enemyTurn() : null;
        var rollData = null;
        var damage = 0;

        if (attackResult && attackResult.attackResult) {
            rollData = attackResult.attackResult;
            damage = rollData.damage || 0;
        }

        // Show enemy attack roll animation, then show outcome
        if (rollData && rollData.roll !== undefined) {
            showAttackRoll(enemyName, rollData, false, function() {
                showDefendOutcome(style, player, playerName, mods, damage, stanceWoreOff, attackResult, callback);
            });
        } else {
            // No roll data, just show outcome
            showDefendOutcome(style, player, playerName, mods, damage, stanceWoreOff, attackResult, callback);
        }
    }

    /**
     * Show the outcome of a defend QTE after the attack roll is displayed
     */
    function showDefendOutcome(style, player, playerName, mods, damage, stanceWoreOff, attackResult, callback) {
        var defendMessages = [];

        // Apply confused status for normal/bad outcomes
        if (mods.confused) {
            var confuseResult = BattleCore.applyStatus(player, 'confusion', 1);
            if (confuseResult && confuseResult.applied) {
                defendMessages.push(playerName + ' is confused!');
            }
        }

        // Handle defend outcomes
        if (mods.result === 'parry') {
            // PARRY: Reflect damage back, take no damage
            var counterDice = mods.counterDamageDice || '1d5';
            var counterDamage = style.rollDamage ? style.rollDamage(counterDice) : Math.floor(Math.random() * 5) + 1;
            BattleCore.damageEnemy(counterDamage, { source: 'parry', type: 'physical' });
            defendMessages.push('PARRY! ' + playerName + ' reflects <span class="roll-damage-normal">' + counterDamage + ' DAMAGE</span>!');
            showDamageNumber(counterDamage, 'enemy', 'damage');
            // Don't apply pending damage - parry blocks it
        } else if (mods.result === 'dodge') {
            // DODGE: No damage taken
            defendMessages.push('DODGE! ' + playerName + ' avoids the attack!');
            showDamageNumber(0, 'player', 'miss');
            // Don't apply pending damage - dodge avoids it
        } else {
            // CONFUSE or FUMBLE: Take full damage - apply pending damage now
            if (attackResult && attackResult.pendingDamage) {
                BattleCore.damagePlayer(attackResult.pendingDamage.amount, {
                    source: attackResult.pendingDamage.source,
                    type: attackResult.pendingDamage.type,
                    isCrit: attackResult.pendingDamage.isCrit
                });
            }
            if (damage > 0) {
                showDamageNumber(damage, 'player', 'damage');
            }

            // Add attack messages (but filter out the "uses X" message since we showed it before QTE)
            if (attackResult && attackResult.messages) {
                attackResult.messages.forEach(function(msg) {
                    if (msg.indexOf(' uses ') === -1) {
                        defendMessages.push(msg);
                    }
                });
            }

            // Lose AC bonus on fumble
            if (mods.loseACBonus) {
                defendMessages.push(playerName + '\'s guard is broken!');
            }
        }

        // Show stance wore off message
        if (stanceWoreOff) {
            defendMessages.push('Defensive stance wore off!');
        }

        updateDisplay();

        // Check if player died
        if (checkEnd()) return;

        // Show messages and finish turn
        if (defendMessages.length > 0) {
            updateBattleLog(defendMessages.join('<br>'), null, function() {
                finishEnemyTurn([], callback);
            });
        } else {
            finishEnemyTurn([], callback);
        }
    }

    function finishEnemyAction(result, messages, callback) {
        var state = BattleCore.getState();

        // If enemy has an attack roll, show animated dice roll
        if (result.attackResult && result.attackResult.roll !== undefined) {
            var enemyName = state.enemy.name || 'Enemy';

            showAttackRoll(enemyName, result.attackResult, false, function() {
                finishEnemyActionAfterRoll(result, messages, callback);
            });
        }
        // If enemy has a heal roll, show animated heal roll
        else if (result.healRoll && result.healRoll.amount > 0) {
            showHealRoll(
                result.healRoll.healerName,
                result.healRoll.amount,
                result.healRoll.healRolled || result.healRoll.amount,
                {
                    isMinHeal: result.healRoll.isMinHeal,
                    isMaxHeal: result.healRoll.isMaxHeal
                },
                function() {
                    finishEnemyActionAfterRoll(result, messages, callback);
                }
            );
        } else {
            finishEnemyActionAfterRoll(result, messages, callback);
        }
    }

    function finishEnemyActionAfterRoll(result, messages, callback) {
        // Only add result.messages for non-attacks and non-heals
        // Attack messages are shown via showAttackRoll
        // Heal messages are shown via showHealRoll
        if (!result.attackResult && !result.healRoll) {
            messages = messages.concat(result.messages || []);
        }

        // Show damage number
        if (result.attackResult && result.attackResult.hit) {
            var state = BattleCore.getState();
            var damageType = 'damage';
            if (result.attackResult.isCrit) {
                damageType = 'crit';
            } else if (result.attackResult.isMaxDamage) {
                damageType = 'maxdamage';
            } else if (result.attackResult.isMinDamage) {
                damageType = 'mindamage';
            }
            showDamageNumber(result.attackResult.damage, 'player', damageType);

            // Enemy crit dialogue (takes priority)
            if (result.attackResult.isCrit) {
                var critLine = BattleCore.triggerDialogue('enemy_crit');
                if (critLine) showDialogueBubble(critLine);
            }
            // Check HP thresholds for dialogue (only if not crit)
            else {
                var hpPercent = state.player.hp / state.player.maxHP;
                if (hpPercent < 0.25) {
                    var lowLine = BattleCore.triggerDialogue('player_very_low_hp');
                    if (lowLine) showDialogueBubble(lowLine);
                } else if (hpPercent < 0.5) {
                    var medLine = BattleCore.triggerDialogue('player_low_hp');
                    if (medLine) showDialogueBubble(medLine);
                }
            }
        }

        // Show miss via WoW-style floating text (battle log is for rolls only)
        if (result.attackResult && !result.attackResult.hit) {
            showDamageNumber(0, 'player', 'miss');

            // Enemy fumble dialogue and confusion status
            if (result.attackResult.isFumble) {
                // Show fumble message - keep it short to avoid wrapping
                var fumbleState = BattleCore.getState();
                var enemyName = fumbleState.enemy.name || 'Enemy';
                var fumbleText = BattleCore.triggerDialogue('fumble_text') || 'trips over their own feet';
                var fumbleMsg = enemyName + ' ' + fumbleText + '!';
                if (result.attackResult.fumbleStatusResult && result.attackResult.fumbleStatusResult.applied) {
                    // Check if confusion just expired this turn (re-applying = "stays confused")
                    var enemyStatusResult = fumbleState._enemyStatusResult;
                    var confusionJustExpired = enemyStatusResult && enemyStatusResult.expiredStatuses &&
                        enemyStatusResult.expiredStatuses.indexOf('confusion') !== -1;

                    if (confusionJustExpired) {
                        // Remove the "wore off" message since enemy is staying confused
                        if (enemyStatusResult.messages) {
                            for (var j = enemyStatusResult.messages.length - 1; j >= 0; j--) {
                                if (enemyStatusResult.messages[j].indexOf('wore off') !== -1 &&
                                    enemyStatusResult.messages[j].indexOf('Confusion') !== -1) {
                                    enemyStatusResult.messages.splice(j, 1);
                                    break;
                                }
                            }
                        }
                        fumbleMsg += ' 💫 Stays confused!';
                    } else {
                        fumbleMsg += ' 💫 Confused!';
                    }
                    // Show confusion dialogue (takes priority over fumble dialogue)
                    var confusionLine = BattleCore.triggerDialogue('status_confusion');
                    if (confusionLine) showDialogueBubble(confusionLine);
                } else {
                    // No confusion, show fumble dialogue
                    var fumbleLine = BattleCore.triggerDialogue('enemy_fumble');
                    if (fumbleLine) showDialogueBubble(fumbleLine);
                }
                messages.push(fumbleMsg);
            }
        }

        // Show enemy heal with floating number and dialogue
        if (result.healed && result.healed > 0) {
            showDamageNumber(result.healed, 'enemy', 'heal');

            // Show heal dialogue if available
            var healLine = BattleCore.triggerDialogue('move_break_room_retreat');
            if (healLine) showDialogueBubble(healLine);
        }

        // Apply pending damage now that animation is complete
        if (result.pendingDamage) {
            BattleCore.damagePlayer(result.pendingDamage.amount, {
                source: result.pendingDamage.source,
                type: result.pendingDamage.type,
                isCrit: result.pendingDamage.isCrit
            });
        }

        // Apply pending counter damage
        if (result.pendingCounter) {
            BattleCore.damageEnemy(result.pendingCounter.amount, {
                source: result.pendingCounter.source,
                type: result.pendingCounter.type
            });
        }

        updateDisplay();

        // Check if player died
        if (checkEnd()) return;

        finishEnemyTurn(messages, callback);
    }

    function finishEnemyTurn(messages, callback) {
        // Display any messages (heal notifications, etc.) in the battle log
        // Don't add enemy name prefix - messages already include context
        if (messages && messages.length > 0) {
            var msgHtml = messages.join('<br>');
            updateBattleLog(msgHtml);
        }

        // === INTENT SYSTEM: Tick intent counter at end of enemy turn ===
        if (_hasBattleIntent && BattleIntent.isTelegraphed()) {
            BattleIntent.tick();
            // Update the indicator to show remaining turns
            if (_hasBattleUI && BattleUI.updateIntentIndicator) {
                BattleUI.updateIntentIndicator(BattleIntent.getDisplayData());
            }
        }

        BattleCore.incrementTurn();

        // Process player regen/status ticks AFTER enemy turn, BEFORE player can act
        var state = BattleCore.getState();
        var statusResult = BattleCore.tickStatuses(state.player, state.player.name);

        // Apply status damage/healing/mana
        if (statusResult.damage > 0) {
            showDamageNumber(statusResult.damage, 'player', 'dot');
        }
        if (statusResult.heal > 0) {
            showDamageNumber(statusResult.heal, 'player', 'heal');
        }
        if (statusResult.mana > 0) {
            BattleCore.restoreMana(statusResult.mana);
        }

        // Store status result for executeAction to check canAct
        state._playerStatusResult = statusResult;

        // Handle confusion self-damage with animated dice roll (using modular BattleDiceUI)
        if (statusResult.confusionDamage > 0) {
            var confusionDmg = statusResult.confusionDamage;
            var playerName = state.player.name || 'Player';

            // Show any other status messages first (regen, etc.), then show confusion roll
            var otherMessages = statusResult.messages.slice(); // Copy messages without confusion

            function showConfusionRoll() {
                // Apply damage to player
                BattleCore.getPlayer().hp -= confusionDmg;

                // Get battle log container
                var battleLog = document.getElementById('battle-log-content');
                if (!battleLog) {
                    finishConfusionTurn();
                    return;
                }

                // Use modular BattleDiceUI.showSimpleDamageRoll for animated dice
                if (typeof BattleDiceUI !== 'undefined' && BattleDiceUI.showSimpleDamageRoll) {
                    BattleDiceUI.showSimpleDamageRoll({
                        container: battleLog,
                        text: playerName + ' hits themselves! ',
                        damage: confusionDmg,
                        sides: 5  // d5 for confusion damage
                    }, function() {
                        // Show floating damage number
                        showDamageNumber(confusionDmg, 'player', 'damage');
                        updateDisplay();
                        finishConfusionTurn();
                    });
                } else {
                    // Fallback without animation
                    battleLog.innerHTML = '<div class="roll-result">' + playerName + ' hits themselves! <strong class="dice-number roll-damage-normal">' + confusionDmg + '</strong> <span class="damage-text roll-type-damage">DAMAGE</span></div>';
                    showDamageNumber(confusionDmg, 'player', 'damage');
                    updateDisplay();
                    setTimeout(finishConfusionTurn, 800);
                }
            }

            function finishConfusionTurn() {
                // Check death from confusion damage
                if (state.player.hp <= 0) {
                    checkEnd();
                    return;
                }

                // Confusion always means can't act - skip to enemy turn
                state._playerStatusResult = null;
                processEnemyTurn([], callback, { playerAction: 'stunned' });
            }

            // If there are other status messages, show them first
            if (otherMessages.length > 0) {
                updateBattleLog(otherMessages.join('<br>'), null, showConfusionRoll);
            } else {
                showConfusionRoll();
            }
            return;
        }

        // Show regen messages if any, waiting for text to complete before UI update
        if (statusResult.messages.length > 0) {
            updateBattleLog(statusResult.messages.join('<br>'), null, function() {
                // Check death from status
                if (state.player.hp <= 0) {
                    checkEnd();
                    return;
                }

                // If player can't act (stun, etc.), skip to enemy turn
                if (!statusResult.canAct) {
                    state._playerStatusResult = null;  // Clear stored result
                    processEnemyTurn([], callback, { playerAction: 'stunned' });
                    return;
                }

                // If player is in defensive stance, skip their turn (they can't act)
                if (state.player.defending && state.player.defending > 0) {
                    state._playerStatusResult = null;
                    processEnemyTurn([], callback, { playerAction: 'defending' });
                    return;
                }

                // Clear the status message before returning control to player
                var battleLogContent = document.getElementById('battle-log-content');
                if (battleLogContent) battleLogContent.innerHTML = '';

                BattleCore.setPhase('player');
                updateDisplay();

                // Clear action lock - player can now act again
                _actionInProgress = false;

                if (callback) callback();
            });
            return;
        }

        // Check death from status (no messages to show)
        if (state.player.hp <= 0) {
            checkEnd();
            return;
        }

        // If player can't act (stun, etc.), skip to enemy turn
        if (!statusResult.canAct) {
            state._playerStatusResult = null;  // Clear stored result
            processEnemyTurn([], callback, { playerAction: 'stunned' });
            return;
        }

        // If player is in defensive stance, skip their turn (they can't act)
        if (state.player.defending && state.player.defending > 0) {
            state._playerStatusResult = null;
            processEnemyTurn([], callback, { playerAction: 'defending' });
            return;
        }

        BattleCore.setPhase('player');
        updateDisplay();

        // Clear action lock - player can now act again
        _actionInProgress = false;

        if (callback) callback();
    }

    function formatStatusMessages(messages) {
        if (messages.length === 0) return '';
        return '<div class="battle-log status-messages">' + messages.join('<br>') + '</div>';
    }

    // =========================================================================
    // QTE INTEGRATION
    // =========================================================================

    function isQTEEnabledForAttacks() {
        return typeof QTEEngine !== 'undefined' && QTEEngine.isEnabled &&
            QTEEngine.isEnabled() && T && T.qte && T.qte.enableForAttacks;
    }

    function isQTEEnabledForDodge() {
        return typeof QTEEngine !== 'undefined' && QTEEngine.isEnabled &&
            QTEEngine.isEnabled() && T && T.qte && T.qte.enableForDodge;
    }

    function isQTEEnabledForSkills() {
        return typeof QTEEngine !== 'undefined' && QTEEngine.isEnabled &&
            QTEEngine.isEnabled() && T && T.qte && T.qte.enabledForSkills;
    }

    function executeAttackWithQTE(callback) {
        if (typeof QTEEngine === 'undefined') {
            callback({});
            return;
        }

        QTEEngine.startAttackQTE({}, function(qteResult) {
            callback(qteResult || {});
        });
    }

    function processEnemyAttackWithQTE(callback) {
        if (typeof QTEEngine === 'undefined') {
            callback({});
            return;
        }

        QTEEngine.startDodgeQTE({}, function(qteResult) {
            callback(qteResult || {});
        });
    }

    // =========================================================================
    // UI DELEGATION
    // =========================================================================

    function showUI() {
        if (typeof BattleUI !== 'undefined') {
            var state = BattleCore.getState();
            BattleUI.createBattleUI(state.player, state.enemy);
            BattleUI.showUI();
            hideTextBox();
        }
    }

    function hideUI() {
        if (typeof BattleUI !== 'undefined') {
            BattleUI.hideUI();
        }
    }

    function destroyUI() {
        if (typeof BattleUI !== 'undefined') {
            BattleUI.destroyUI();
        }
    }

    function updateDisplay() {
        if (typeof BattleUI !== 'undefined') {
            var state = BattleCore.getState();

            // Calculate effective AC first (needed for change detection)
            var baseAC = state.player.baseAC || state.player.ac || 10;
            var effectiveAC = baseAC + BattleCore.getStatusACModifier(state.player);
            if (state.player.defending) {
                effectiveAC += BattleCore.getCombatConfig().defendACBonus || 2;
            }

            // Show stat change notifications sequentially: HP/AC -> Mana -> LB
            // HP changes are shown via showDamageNumber calls in battle.js
            // AC changes show at the same time as HP (no delay)
            // We add delays for mana/limit to create the cascade effect
            var statDelay = 200;  // Delay between each stat popup
            var baseDelay = 0;

            // Check if HP changed (HP popup would have been shown already)
            var hpChanged = prevDisplayState.playerHP !== null &&
                           state.player.hp !== prevDisplayState.playerHP;

            // Check if AC increased - only show positive AC changes (defend bonus)
            // Don't show negative AC changes (defend wearing off) as it's confusing
            if (prevDisplayState.playerAC !== null) {
                var acDiff = effectiveAC - prevDisplayState.playerAC;
                if (acDiff > 0) {
                    // AC shows immediately (same timing as HP)
                    BattleUI.showStatChange('ac', acDiff, 'player');
                }
            }

            // If HP or AC changed, add delay before mana
            if (hpChanged || (prevDisplayState.playerAC !== null && effectiveAC !== prevDisplayState.playerAC)) {
                baseDelay = statDelay;
            }

            if (prevDisplayState.playerMana !== null) {
                var manaDiff = state.player.mana - prevDisplayState.playerMana;
                if (manaDiff !== 0) {
                    (function(diff, delay) {
                        scheduleTimeout(function() {
                            BattleUI.showStatChange('mana', diff, 'player');
                        }, delay);
                    })(manaDiff, baseDelay);
                    baseDelay += statDelay;  // Increment for next stat
                }
            }
            if (prevDisplayState.playerLimit !== null) {
                var limitDiff = state.player.limitCharge - prevDisplayState.playerLimit;
                if (limitDiff > 0) {
                    (function(diff, delay) {
                        scheduleTimeout(function() {
                            BattleUI.showStatChange('limit', diff, 'player');
                        }, delay);
                    })(limitDiff, baseDelay);
                }
            }

            // Check for regen statuses to apply glow effects
            var hasHPRegen = BattleCore.hasStatus(state.player, 'regen') !== null;
            var hasManaRegen = BattleCore.hasStatus(state.player, 'mana_regen') !== null;

            // Update UI
            console.log('[BattleFacade.updateDisplay] enemy HP:', state.enemy.hp, '/', state.enemy.maxHP);
            BattleUI.updateHP('player', state.player.hp, state.player.maxHP, null, hasHPRegen);
            BattleUI.updateHP('enemy', state.enemy.hp, state.enemy.maxHP);
            BattleUI.updateMana(state.player.mana, state.player.maxMana, hasManaRegen);

            // Build player statuses list, including defending stance icon if active
            var playerStatuses = (state.player.statuses || []).slice(); // Clone array
            if (state.player.defending) {
                // Add defending as a pseudo-status at the front
                // Use defending value as duration if it's a number, otherwise 1
                var defendDuration = typeof state.player.defending === 'number' ? state.player.defending : 1;
                playerStatuses.unshift({ type: 'defending', duration: defendDuration });
            }
            // Get status definitions - include defending as fallback even if BattleData not loaded
            var statusDefs = _hasBattleData ? BattleData.statusEffects : {};
            if (!statusDefs.defending) {
                statusDefs.defending = {
                    name: 'Defending',
                    icon: '🙅',
                    color: '#3498db',
                    duration: 1,
                    description: 'Defensive stance - cannot act, QTE to dodge/parry attacks'
                };
            }
            BattleUI.updateStatuses('player', playerStatuses, statusDefs);
            BattleUI.updateStatuses('enemy', state.enemy.statuses || [], statusDefs);
            BattleUI.updateStagger('player', state.player.stagger, state.player.staggerThreshold);
            BattleUI.updateStagger('enemy', state.enemy.stagger, state.enemy.staggerThreshold);
            BattleUI.updateLimitBar(state.player.limitCharge, BattleCore.getCombatConfig().limitChargeMax);
            BattleUI.updateTerrain(state.terrain, _hasBattleData ? BattleData.terrainTypes : {});
            BattleUI.updatePlayerAC(baseAC, effectiveAC);

            // Track previous state for next update
            prevDisplayState.playerHP = state.player.hp;
            prevDisplayState.playerMana = state.player.mana;
            prevDisplayState.playerLimit = state.player.limitCharge;
            prevDisplayState.playerAC = effectiveAC;
            prevDisplayState.enemyHP = state.enemy.hp;

            // Refresh battle choices to update cooldown display (especially during defending)
            if (typeof VNEngine !== 'undefined' && VNEngine.refreshBattleChoices) {
                VNEngine.refreshBattleChoices();
            }
        }
        // Check for music transitions based on HP thresholds
        checkMusicTransitions();
    }

    /**
     * Update battle log with optional callback when animation/linger completes
     * @param {string} html - HTML content to display
     * @param {object} rollData - Optional roll data { roll, isCrit, isFumble }
     * @param {function} callback - Called after typewriter + linger delay completes
     */
    function updateBattleLog(html, rollData, callback) {
        // Apply glued tokens (emoji + word stay together with non-breaking space)
        if (html) {
            html = applyGluedTokens(html);
        }

        if (typeof BattleUI !== 'undefined') {
            BattleUI.updateBattleLog(html, rollData, callback);
        } else if (callback) {
            callback();
        }
    }

    /**
     * Apply non-breaking spaces to keep certain tokens together
     * This prevents awkward line breaks like "💫" on one line and "Confused!" on the next
     * @param {string} text - The text to process
     * @returns {string} Text with glued tokens
     */
    function applyGluedTokens(text) {
        // Glue emoji + following word (e.g., "💫 Confused!" -> "💫\u00A0Confused!")
        // Wide Unicode range covering most emojis
        text = text.replace(/([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}])\s+(\w+)/gu, '$1\u00A0$2');

        // Glue number + unit (e.g., "5 HP" -> "5\u00A0HP")
        text = text.replace(/(\d+)\s+(HP|MP|AC|Damage|damage|DAMAGE)/g, '$1\u00A0$2');

        // Glue +/- number + unit (e.g., "-2 HP" -> "-2\u00A0HP")
        text = text.replace(/([+-]\d+)\s+(HP|MP|AC)/g, '$1\u00A0$2');

        // Glue "is/stays" + status (e.g., "is confused" -> "is\u00A0confused")
        text = text.replace(/\b(is|stays)\s+(confused|stunned|poisoned)/gi, '$1\u00A0$2');

        return text;
    }

    /**
     * Show attack roll with dice animation
     * @param {string} attackerName - Name of attacker
     * @param {Object} attackResult - Result from BattleStyleDnD.resolveAttack
     * @param {boolean} isPlayer - Whether attacker is the player (shows modifier breakdown)
     * @param {function} callback - Called when animation completes
     */
    function showAttackRoll(attackerName, attackResult, isPlayer, callback) {
        // Handle old signature (attackerName, attackResult, callback)
        if (typeof isPlayer === 'function') {
            callback = isPlayer;
            isPlayer = true; // Default to player for backwards compatibility
        }

        if (typeof BattleDiceUI === 'undefined') {
            // Fallback: just show text
            var msg = attackerName + ' rolled ' + attackResult.roll;
            if (attackResult.isCrit) msg += ' CRITICAL HIT!';
            if (attackResult.isFumble) msg += ' FUMBLE!';
            if (attackResult.hit) {
                msg += ' HIT! ' + attackResult.damage + ' DAMAGE';
            } else {
                msg += ' MISS!';
            }
            updateBattleLog(msg);
            if (callback) callback();
            return;
        }

        // Get battle log container
        var battleLog = document.getElementById('battle-log-content');
        if (!battleLog) {
            if (callback) callback();
            return;
        }

        // Clear previous content and create log entry container
        battleLog.innerHTML = '';
        var logEntry = document.createElement('div');
        logEntry.className = 'battle-log-messages';
        battleLog.appendChild(logEntry);

        // Use BattleDiceUI to animate the roll with new phased system
        BattleDiceUI.showAttackRoll({
            container: logEntry,
            attacker: attackerName,
            rollResult: {
                roll: attackResult.roll,
                sides: 20,
                isCrit: attackResult.isCrit,
                isFumble: attackResult.isFumble,
                advantage: attackResult.hasAdvantage,
                disadvantage: attackResult.hasDisadvantage,
                rolls: attackResult.rolls
            },
            attackTotal: attackResult.attackTotal,
            attackModifiers: attackResult.attackModifiers || [],
            defenderAC: attackResult.defenderAC,  // Pass AC for color threshold logic
            hit: attackResult.hit,
            baseDamageRoll: attackResult.baseDamageRoll || attackResult.damage,
            damage: attackResult.damage,
            damageModifiers: attackResult.damageModifiers || [],
            isPlayer: isPlayer,
            isMinDamage: attackResult.isMinDamage,
            isMaxDamage: attackResult.isMaxDamage,
            damageAdvantage: attackResult.hasDamageAdvantage,
            damageDisadvantage: attackResult.hasDamageDisadvantage,
            damageRolls: attackResult.damageRolls
        }, callback);
    }

    /**
     * Show animated heal roll for player/enemy recovery
     * @param {string} healerName - Name of the healer
     * @param {number} healAmount - Actual amount healed (after HP cap)
     * @param {number} healRolled - Amount rolled (before HP cap), for overheal display
     * @param {Object} options - Optional { isMinHeal, isMaxHeal }
     * @param {function} callback - Called when animation completes
     */
    function showHealRoll(healerName, healAmount, healRolled, options, callback) {
        // Support old signature (healerName, healAmount, callback)
        if (typeof healRolled === 'function') {
            callback = healRolled;
            healRolled = healAmount;
            options = {};
        } else if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        options = options || {};

        if (typeof BattleDiceUI === 'undefined') {
            // Fallback: just show text
            var msg = healerName + ' rolled ' + healAmount + ' HEALED!';
            updateBattleLog(msg);
            if (callback) callback();
            return;
        }

        // Get battle log container
        var battleLog = document.getElementById('battle-log-content');
        if (!battleLog) {
            if (callback) callback();
            return;
        }

        // Clear previous content and create log entry container
        battleLog.innerHTML = '';
        var logEntry = document.createElement('div');
        logEntry.className = 'battle-log-messages';
        battleLog.appendChild(logEntry);

        // Use BattleDiceUI to animate the heal roll
        BattleDiceUI.showHealRoll({
            container: logEntry,
            healer: healerName,
            healAmount: healAmount,
            healRolled: healRolled,
            isMinHeal: options.isMinHeal,
            isMaxHeal: options.isMaxHeal,
            hasHealAdvantage: options.hasHealAdvantage,
            hasHealDisadvantage: options.hasHealDisadvantage,
            healRolls: options.healRolls
        }, callback);
    }

    function showDamageNumber(amount, target, type) {
        if (typeof BattleUI !== 'undefined') {
            BattleUI.showDamageNumber(amount, target, type);
        }
    }

    function showDialogueBubble(text) {
        if (typeof BattleUI !== 'undefined') {
            BattleUI.showDialogueBubble(text, config.timing.dialogueDuration);
        }
    }

    function showBattleIntro(enemy, callback) {
        console.log('[BattleEngine] showBattleIntro called, BattleUI defined:', typeof BattleUI !== 'undefined');
        if (typeof BattleUI !== 'undefined') {
            console.log('[BattleEngine] Calling BattleUI.showIntro...');
            BattleUI.showIntro(enemy, callback);
        } else {
            console.log('[BattleEngine] BattleUI not defined, using fallback timeout');
            scheduleTimeout(callback, config.timing.battleIntro);
        }
    }

    function showBattleOutro(result, callback) {
        if (typeof BattleUI !== 'undefined') {
            BattleUI.showOutro(result, callback);
        } else {
            scheduleTimeout(callback, config.timing.battleOutro);
        }
    }

    function hideTextBox() {
        if (elements.textBox) {
            elements.textBox.style.display = 'none';
        }
    }

    function showTextBox() {
        if (elements.textBox) {
            elements.textBox.style.display = '';
        }
    }

    // =========================================================================
    // SOUND CUE SYSTEM
    // =========================================================================

    // Maps battle events to sound effect files
    var soundCues = {
        // === Battle Flow ===
        battle_start: 'alert.ogg',        // Battle intro
        victory: 'victory.ogg',           // Player wins
        defeat: 'failure.ogg',            // Player loses
        flee_success: 'footstep.ogg',     // Successful escape
        flee_fail: 'negative.ogg',        // Failed escape attempt

        // === Attack Sounds ===
        attack_hit: 'thud.ogg',           // Generic attack lands
        attack_miss: 'negative.ogg',      // Attack misses
        attack_crit: 'success.ogg',       // Critical hit
        attack_fumble: 'failure.ogg',     // Critical fumble

        // === Type-specific Attack Sounds ===
        attack_physical: 'thud.ogg',
        attack_fire: 'zap.ogg',           // Fiery attack
        attack_ice: 'chain.ogg',          // Ice cracking
        attack_lightning: 'zap.ogg',      // Electric zap
        attack_poison: 'gulp.ogg',        // Poison drip
        attack_holy: 'success.ogg',       // Divine light
        attack_dark: 'warning.ogg',       // Dark energy
        attack_psychic: 'warning.ogg',    // Mental attack

        // === Defense/Recovery ===
        defend: 'click.ogg',              // Defend action
        heal: 'success.ogg',              // HP recovery
        mana_restore: 'click.ogg',        // MP recovery
        buff_apply: 'success.ogg',        // Positive status applied

        // === Status Effects ===
        status_burn: 'zap.ogg',           // Burn damage tick
        status_poison: 'gulp.ogg',        // Poison damage tick
        status_stun: 'warning.ogg',       // Stunned
        status_frozen: 'chain.ogg',       // Frozen
        status_bleed: 'thud.ogg',         // Bleed damage tick
        status_cure: 'success.ogg',       // Status cured
        status_expire: 'click.ogg',       // Status wears off

        // === Special Actions ===
        skill_use: 'click.ogg',           // Using a skill
        item_use: 'click.ogg',            // Using an item
        dice_roll: 'dice_roll.ogg',       // Rolling dice
        stagger: 'thud.ogg',              // Target staggered
        stagger_break: 'chain.ogg',       // Stagger meter full (stunned)

        // === Limit Break ===
        limit_ready: 'alert.ogg',         // Limit break ready
        limit_activate: 'zap.ogg',        // Using limit break

        // === Summons ===
        summon_appear: 'success.ogg',     // Summon appears
        summon_attack: 'thud.ogg',        // Summon attacks
        summon_expire: 'click.ogg',       // Summon leaves

        // === UI Feedback ===
        button_click: 'click.ogg',        // Menu selection
        error: 'negative.ogg',            // Invalid action
        turn_start: 'click.ogg'           // Turn begins (subtle)
    };

    /**
     * Play a battle sound cue
     * @param {string} cueKey - Key from soundCues map
     * @param {string} overrideFile - Optional override filename
     */
    function playSoundCue(cueKey, overrideFile) {
        var filename = overrideFile || soundCues[cueKey];
        if (filename) {
            playSfx(filename);
        }
    }

    function playSfx(filename) {
        if (vnEngine && vnEngine.playSfx) {
            vnEngine.playSfx(filename);
        }
    }

    // =========================================================================
    // MUSIC TRANSITION SYSTEM
    // =========================================================================

    var musicThresholds = {
        player_critical: { // Player below 25% HP
            threshold: 0.25,
            track: 'critical_hp.mp3',
            triggered: false
        },
        player_low: { // Player below 50% HP
            threshold: 0.50,
            track: 'low_hp.mp3',
            triggered: false
        },
        enemy_critical: { // Enemy below 25% HP
            threshold: 0.25,
            track: 'enemy_low.mp3',
            triggered: false
        }
    };

    // Track music state across turns
    var musicState = {
        playerCriticalTriggered: false,
        playerLowTriggered: false,
        enemyCriticalTriggered: false
    };

    /**
     * Reset music state for new battle
     */
    function resetMusicState() {
        musicState.playerCriticalTriggered = false;
        musicState.playerLowTriggered = false;
        musicState.enemyCriticalTriggered = false;
    }

    /**
     * Check HP thresholds and transition music if needed
     */
    function checkMusicTransitions() {
        if (!vnEngine || !vnEngine.playMusic) return;

        var state = BattleCore.getState();
        var playerHPPercent = state.player.hp / state.player.maxHP;
        var enemyHPPercent = state.enemy.hp / state.enemy.maxHP;

        // Player critical HP (highest priority)
        if (playerHPPercent <= musicThresholds.player_critical.threshold &&
            !musicState.playerCriticalTriggered) {
            musicState.playerCriticalTriggered = true;
            if (musicThresholds.player_critical.track) {
                vnEngine.playMusic(musicThresholds.player_critical.track);
            }
            return;
        }

        // Player low HP
        if (playerHPPercent <= musicThresholds.player_low.threshold &&
            !musicState.playerLowTriggered &&
            !musicState.playerCriticalTriggered) {
            musicState.playerLowTriggered = true;
            if (musicThresholds.player_low.track) {
                vnEngine.playMusic(musicThresholds.player_low.track);
            }
            return;
        }

        // Enemy critical HP (victory is near!)
        if (enemyHPPercent <= musicThresholds.enemy_critical.threshold &&
            !musicState.enemyCriticalTriggered &&
            !musicState.playerCriticalTriggered) {
            musicState.enemyCriticalTriggered = true;
            if (musicThresholds.enemy_critical.track) {
                vnEngine.playMusic(musicThresholds.enemy_critical.track);
            }
        }
    }

    /**
     * Set custom music tracks for battle transitions
     * @param {object} tracks - { playerLow, playerCritical, enemyCritical }
     */
    function setMusicTracks(tracks) {
        if (tracks.playerLow) musicThresholds.player_low.track = tracks.playerLow;
        if (tracks.playerCritical) musicThresholds.player_critical.track = tracks.playerCritical;
        if (tracks.enemyCritical) musicThresholds.enemy_critical.track = tracks.enemyCritical;
    }

    // =========================================================================
    // STATE ACCESSORS (for backward compatibility)
    // =========================================================================

    function isActive() {
        return BattleCore.isActive();
    }

    function getState() {
        return BattleCore.getState();
    }

    function setState(newState) {
        // Limited state override for compatibility
        var state = BattleCore.getState();
        if (newState.player) Object.assign(state.player, newState.player);
        if (newState.enemy) Object.assign(state.enemy, newState.enemy);
    }

    function getPlayerStats() {
        return BattleCore.getPlayer();
    }

    function getPlayerSkills() {
        var player = BattleCore.getPlayer();
        var skills = player.skills || [];
        var currentMana = player.mana || 0;
        var hydratedSkills = [];

        for (var i = 0; i < skills.length; i++) {
            var skill = skills[i];
            var skillDef = null;
            var skillId = null;

            // Handle both formats: string ID or full skill object
            if (typeof skill === 'string') {
                // Legacy format: skill ID that needs lookup from BattleData
                skillId = skill;
                skillDef = _hasBattleData ? BattleData.getSkill(skillId) : null;
            } else if (typeof skill === 'object' && skill.id) {
                // New format: full skill object from player config
                skillId = skill.id;
                skillDef = skill;
            }

            if (skillDef) {
                // Determine if it's a heal skill
                var isHeal = skillDef.isHeal || !!skillDef.healAmount;

                hydratedSkills.push({
                    id: skillId,
                    name: skillDef.name,
                    manaCost: skillDef.manaCost || 0,
                    damage: skillDef.damage,
                    healAmount: skillDef.healAmount,
                    type: skillDef.type,
                    description: skillDef.description || '',
                    isHeal: isHeal,
                    isBuff: skillDef.isBuff || false,
                    statusEffect: skillDef.statusEffect,
                    canUse: currentMana >= (skillDef.manaCost || 0)
                });
            }
        }

        return hydratedSkills;
    }

    function getSkill(skillId) {
        // First try BattleData
        if (_hasBattleData) {
            var skill = BattleData.getSkill(skillId);
            if (skill) return skill;
        }

        // Then try player's skills array (for skills defined in player.md)
        var player = BattleCore.getPlayer();
        var skills = player.skills || [];
        for (var i = 0; i < skills.length; i++) {
            if (typeof skills[i] === 'object' && skills[i].id === skillId) {
                return skills[i];
            }
        }

        return null;
    }

    function healPlayer(amount) {
        var result = BattleCore.healPlayer(amount, 'external');
        updateDisplay();
        return result;
    }

    function restoreMana(amount) {
        var result = BattleCore.restoreMana(amount);
        updateDisplay();
        return result;
    }

    function getStatusEffects() {
        return _hasBattleData ? BattleData.statusEffects : {};
    }

    function getTerrainTypes() {
        return _hasBattleData ? BattleData.terrainTypes : {};
    }

    function applyStatusTo(target, statusType, stacks) {
        var targetObj = target === 'player' ? BattleCore.getPlayer() : BattleCore.getEnemy();
        var result = BattleCore.applyStatus(targetObj, statusType, stacks);
        updateDisplay();
        return result;
    }

    // =========================================================================
    // ENEMY TAUNT DIALOGUE SYSTEM
    // =========================================================================

    /**
     * Get a context-aware enemy taunt
     * Considers: player HP, enemy HP, last player action, status effects
     * Uses enemy-specific dialogue if available, falls back to generic
     * Enemies ALWAYS talk when attacking (no skip chance)
     * @param {object} context - { playerAction, playerHit, playerMissed, playerCrit }
     * @returns {string|null} Taunt line or null
     */
    function getEnemyTaunt(context) {
        context = context || {};
        var state = BattleCore.getState();
        var playerHPPercent = state.player.hp / state.player.maxHP;
        var enemyHPPercent = state.enemy.hp / state.enemy.maxHP;
        var candidates = [];

        // Helper to get dialogue lines from BattleCore
        function getDialogueLines(trigger) {
            var line = BattleCore.triggerDialogue(trigger);
            return line ? [line] : [];
        }

        // Priority-based taunt selection
        // Player is stunned/frozen - easy target
        if (context.playerAction === 'stunned') {
            candidates = getDialogueLines('attack_player_stunned');
        }
        // Player is low - enemy is confident
        else if (playerHPPercent <= 0.25) {
            candidates = getDialogueLines('attack_player_low_hp');
        }
        // Player just healed
        else if (context.playerAction === 'heal' || context.playerAction === 'item') {
            candidates = getDialogueLines('attack_player_healed');
        }
        // Player defended
        else if (context.playerAction === 'defend') {
            candidates = getDialogueLines('attack_player_defended');
        }
        // Player missed their attack
        else if (context.playerMissed) {
            candidates = getDialogueLines('attack_player_missed');
        }
        // Enemy got crit by player
        else if (context.playerCrit) {
            candidates = getDialogueLines('attack_got_crit');
        }
        // Enemy got hit
        else if (context.playerHit) {
            candidates = getDialogueLines('attack_got_hit');
        }
        // Enemy is low HP - desperation
        else if (enemyHPPercent <= 0.3) {
            candidates = getDialogueLines('attack_self_low_hp');
        }
        // Enemy has status effects
        else if (state.enemy.statuses && state.enemy.statuses.length > 0) {
            candidates = getDialogueLines('attack_has_status');
        }

        // Fallback to default if no contextual match
        if (!candidates || candidates.length === 0) {
            candidates = getDialogueLines('attack_default');
        }

        if (candidates.length === 0) return null;
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        // Initialization
        init: init,
        isInitialized: isInitialized,
        registerStyle: registerStyle,
        setStyle: setStyle,
        getStyleName: getStyleName,

        // Battle flow
        start: start,
        end: end,
        reset: reset,
        checkEnd: checkEnd,

        // Actions
        executeAction: executeAction,

        // UI
        showUI: showUI,
        hideUI: hideUI,
        destroyUI: destroyUI,
        updateDisplay: updateDisplay,

        // State accessors (backward compatibility)
        isActive: isActive,
        getState: getState,
        setState: setState,
        getPlayerStats: getPlayerStats,
        getPlayerSkills: getPlayerSkills,
        getSkill: getSkill,
        healPlayer: healPlayer,
        restoreMana: restoreMana,

        // Data accessors
        getTypeChart: function() { return _hasBattleData ? BattleData.typeChart : {}; },
        getStatusEffects: getStatusEffects,
        getTerrainTypes: getTerrainTypes,
        applyStatusTo: applyStatusTo,

        // Dev mode
        setForcedRollCallback: setForcedRollCallback,
        setForcedDamageCallback: setForcedDamageCallback,
        setGuaranteeStatusCallback: setGuaranteeStatusCallback,

        // Item system
        getAvailableItems: function() { return BattleCore.getAvailableItems(); },
        getBattleItems: function() { return BattleCore.getAvailableItems(); },
        useItem: function(itemId) { return BattleCore.useItem(itemId); },
        battleItems: _hasBattleData ? BattleData.battleItems : {},

        // Summon system
        summon: function(id) { return BattleCore.createSummon(id); },
        dismissSummon: function() { return BattleCore.dismissSummon(); },
        getSummon: function() { return BattleCore.getSummon(); },
        summonTypes: _hasBattleData ? BattleData.summonTypes : {},

        // Limit break system
        getLimitCharge: function() { return BattleCore.getPlayer().limitCharge; },
        addLimitCharge: function(amount) { BattleCore.addLimitCharge(amount); },
        isLimitReady: function() { return BattleCore.isLimitReady(); },
        executeLimitBreak: function() {
            var style = getActiveStyle();
            return style ? style.playerLimitBreak() : { success: false };
        },
        limitBreaks: _hasBattleData ? BattleData.limitBreaks : {},

        // Passive system
        getPassiveBonuses: function() { return BattleCore.getPassiveBonuses(BattleCore.getPlayer()); },
        passiveTypes: _hasBattleData ? BattleData.passiveTypes : {},

        // Dialogue system
        triggerDialogue: function(trigger) { return BattleCore.triggerDialogue(trigger); },
        setDialogue: function(trigger, lines) { /* For custom dialogue, extend BattleData */ },
        getEnemyTaunt: getEnemyTaunt,

        // Music system
        setMusicTracks: setMusicTracks,
        checkMusicTransitions: checkMusicTransitions,

        // Sound cue system
        playSoundCue: playSoundCue,
        soundCues: soundCues,

        // QTE system
        isQTEEnabledForAttacks: isQTEEnabledForAttacks,
        isQTEEnabledForDodge: isQTEEnabledForDodge,
        isQTEEnabledForSkills: isQTEEnabledForSkills,
        executeAttackWithQTE: executeAttackWithQTE,
        processEnemyAttackWithQTE: processEnemyAttackWithQTE,

        // Expose data for UI
        skills: _hasBattleData ? BattleData.skills : {},
        statusEffects: _hasBattleData ? BattleData.statusEffects : {},
        terrainTypes: _hasBattleData ? BattleData.terrainTypes : {},

        // Pause system
        pause: pause,
        unpause: unpause,
        togglePause: togglePause,
        isPaused: isPaused,
        scheduleTimeout: scheduleTimeout
    };
})();
