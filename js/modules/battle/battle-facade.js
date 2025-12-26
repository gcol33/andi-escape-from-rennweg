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
    // MODULE DEPENDENCY CHECK (uses BattleUtils for consistency)
    // =========================================================================

    // Use BattleUtils for centralized dependency checking
    var _hasBattleUtils = typeof BattleUtils !== 'undefined';
    var _hasBattleData = _hasBattleUtils ? BattleUtils.hasBattleData() : typeof BattleData !== 'undefined';
    var _hasBattleIntent = _hasBattleUtils ? BattleUtils.hasBattleIntent() : typeof BattleIntent !== 'undefined';
    var _hasBattleUI = _hasBattleUtils ? BattleUtils.hasBattleUI() : typeof BattleUI !== 'undefined';
    var _hasBattleSummon = _hasBattleUtils ? BattleUtils.hasBattleSummon() : typeof BattleSummon !== 'undefined';
    var _intentsEnabled = true;  // Can be toggled via dev panel

    // Use Logger module with fallback via Utils
    var _log = Utils.getLogger();

    if (!_hasBattleData) {
        _log.warn('BattleEngine', 'BattleData module not loaded - some features will be unavailable');
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
            fadeOutDuration: T ? T.battle.timing.fadeOut : 300,
            intentAnnouncementDelay: T ? T.battle.timing.intentAnnouncementDelay : 1500
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
    // PAUSE SYSTEM (uses shared PausableTimer module)
    // =========================================================================

    var _pauseKeyListenerAdded = false;
    var _timer = null;

    /**
     * Get or create the pausable timer instance
     */
    function getTimer() {
        if (!_timer && typeof PausableTimer !== 'undefined') {
            _timer = PausableTimer.create({
                name: 'BattleFacade',
                isActiveCheck: function() {
                    return BattleCore.isActive();
                },
                onPause: function() {
                    // Show pause overlay via BattleUI
                    if (_hasBattleUI && BattleUI.showPauseOverlay) {
                        BattleUI.showPauseOverlay();
                    }
                    // Pause dice animations
                    if (typeof BattleDiceUI !== 'undefined' && BattleDiceUI.pause) {
                        BattleDiceUI.pause();
                    }
                },
                onUnpause: function() {
                    // Hide pause overlay via BattleUI
                    if (_hasBattleUI && BattleUI.hidePauseOverlay) {
                        BattleUI.hidePauseOverlay();
                    }
                    // Resume dice animations
                    if (typeof BattleDiceUI !== 'undefined' && BattleDiceUI.unpause) {
                        BattleDiceUI.unpause();
                    }
                }
            });
        }
        return _timer;
    }

    /**
     * Pausable setTimeout - use this instead of setTimeout in battle code
     * Delegates to shared PausableTimer module
     */
    function scheduleTimeout(callback, delay) {
        var timer = getTimer();
        if (timer) {
            return timer.schedule(callback, delay);
        }
        // Fallback if PausableTimer not available
        return setTimeout(callback, delay);
    }

    /**
     * Cancel a scheduled timeout
     */
    function cancelScheduledTimeout(id) {
        var timer = getTimer();
        if (timer) timer.cancel(id);
    }

    /**
     * Toggle pause state
     */
    function togglePause() {
        var timer = getTimer();
        if (timer) timer.togglePause();
    }

    /**
     * Pause the battle - freezes all scheduled timeouts
     */
    function pause() {
        var timer = getTimer();
        if (timer) timer.pause();
    }

    /**
     * Unpause the battle - resumes all paused timeouts
     */
    function unpause() {
        var timer = getTimer();
        if (timer) timer.unpause();
    }

    /**
     * Check if battle is paused
     */
    function isPaused() {
        var timer = getTimer();
        return timer ? timer.isPaused() : false;
    }

    // =========================================================================
    // FIXED ROW LOG SYSTEM HELPERS
    // =========================================================================

    /**
     * Get the active log row for new content (row 2)
     * Also shifts previous content to row 1
     * @returns {HTMLElement} The row element to type into
     */
    function getActiveLogRow() {
        // Shift rows: move row 2 content to row 1, clear row 2
        if (_hasBattleUI && BattleUI.prepareLogForNewMessage) {
            BattleUI.prepareLogForNewMessage();
        }
        return document.getElementById('battle-log-row-2');
    }

    /**
     * Clear all battle log content (both rows)
     */
    function clearBattleLog() {
        if (_hasBattleUI && BattleUI.clearLog) {
            BattleUI.clearLog();
        }
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
     * Remove pause key listener (call on battle end to prevent memory leaks)
     */
    function removePauseKeyListener() {
        if (_pauseKeyListenerAdded) {
            document.removeEventListener('keydown', handlePauseKey);
            _pauseKeyListenerAdded = false;
        }
    }

    /**
     * Clear all scheduled timeouts (called on battle end/reset)
     */
    function clearAllScheduledTimeouts() {
        var timer = getTimer();
        if (timer) timer.clearAll();
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
            _log.warn('BattleEngine', 'Unknown style:', name, '- falling back to dnd');
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
        }

        // Set shared SFX callback (used by BattleUI and BattleDiceUI via BattleUtils)
        if (typeof BattleUtils !== 'undefined') {
            BattleUtils.setSfxCallback(playSfx);
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
    }

    /**
     * DEV: Force trigger a specific intent by ID and immediately execute it
     * @param {string} intentId - The intent ID to trigger (e.g., 'termination_notice', 'policy_barrage')
     * @returns {Object} Result with success status and message
     */
    function devForceIntent(intentId) {
        if (!_hasBattleIntent) {
            return { success: false, message: 'BattleIntent not available' };
        }

        var enemy = BattleCore.getEnemy();
        if (!enemy) {
            return { success: false, message: 'No enemy in battle' };
        }

        if (!enemy.intents || enemy.intents.length === 0) {
            return { success: false, message: 'Enemy has no intents configured' };
        }

        // Find the intent by ID
        var intentConfig = null;
        for (var i = 0; i < enemy.intents.length; i++) {
            if (enemy.intents[i].id === intentId) {
                intentConfig = enemy.intents[i];
                break;
            }
        }

        if (!intentConfig) {
            return { success: false, message: 'Intent "' + intentId + '" not found. Available: ' + enemy.intents.map(function(i) { return i.id; }).join(', ') };
        }

        // Clear any existing intent
        BattleIntent.clear();

        // Get type definition
        var typeDef = BattleIntent.intentTypes[intentConfig.type];
        var INTENT_ICONS = BattleIntent.getIcons();

        // Manually set the intent (bypass trigger conditions)
        BattleIntent.set(intentConfig.type, intentConfig.skillId || null, {
            moveName: intentConfig.skill ? intentConfig.skill.name : intentConfig.type,
            isHeal: false
        });

        // Get the current intent and upgrade it to telegraphed
        var current = BattleIntent.get();
        current.id = intentConfig.id;
        current.skill = intentConfig.skill;
        current.enemyId = enemy.id;
        current.icon = typeDef ? typeDef.icon : INTENT_ICONS[intentConfig.type] || '⚠';
        current.cssClass = typeDef ? typeDef.cssClass : '';
        current.isTelegraphed = true;
        current.prepTurns = 0;  // Set to 0 to make it execute immediately
        current.turnsRemaining = 0;  // Ready to execute NOW
        current.dialogue = intentConfig.dialogue;
        current.executeDialogue = intentConfig.executeDialogue;
        current.canBreak = typeDef ? typeDef.canBreak : false;
        current.breakCondition = typeDef ? typeDef.breakCondition : null;

        _log.debug('BattleFacade', 'Forcing immediate intent execution:', intentId, current);

        // Immediately trigger enemy turn to execute the intent
        // Set phase to enemy so player can't act
        BattleCore.setPhase('enemy');

        // Execute enemy turn which will see the ready intent and execute it
        scheduleTimeout(function() {
            processEnemyTurn([], function() {
                // After enemy turn completes, continueFinishEnemyTurn handles:
                // - incrementTurn
                // - player status ticks
                // - setting phase back to player
                // - checking battle end
                _log.debug('BattleFacade', 'Enemy intent turn complete');
            }, { playerAction: 'dev_skip' });
        }, 100);

        return { success: true, message: 'Forcing ' + intentId + ' - executing now!', intent: current };
    }

    /**
     * DEV: Trigger an intent prep phase (enemy announces, icon appears, executes next turn)
     * @param {string} intentId - The intent ID to trigger
     * @returns {Object} Result with success status and message
     */
    function devTriggerIntent(intentId) {
        if (!_hasBattleIntent) {
            return { success: false, message: 'BattleIntent not available' };
        }

        var enemy = BattleCore.getEnemy();
        if (!enemy) {
            return { success: false, message: 'No enemy in battle' };
        }

        if (!enemy.intents || enemy.intents.length === 0) {
            return { success: false, message: 'Enemy has no intents configured' };
        }

        // Find the intent by ID
        var intentConfig = null;
        for (var i = 0; i < enemy.intents.length; i++) {
            if (enemy.intents[i].id === intentId) {
                intentConfig = enemy.intents[i];
                break;
            }
        }

        if (!intentConfig) {
            return { success: false, message: 'Intent "' + intentId + '" not found' };
        }

        // Clear any existing intent
        BattleIntent.clear();

        // Get type definition
        var typeDef = BattleIntent.intentTypes[intentConfig.type];
        var INTENT_ICONS = BattleIntent.getIcons();

        // Manually set the intent with normal prep turns (will execute next turn)
        BattleIntent.set(intentConfig.type, intentConfig.skillId || null, {
            moveName: intentConfig.skill ? intentConfig.skill.name : intentConfig.type,
            isHeal: false
        });

        // Get the current intent and upgrade it to telegraphed with prep turns
        var current = BattleIntent.get();
        current.id = intentConfig.id;
        current.skill = intentConfig.skill;
        current.enemyId = enemy.id;
        current.icon = typeDef ? typeDef.icon : INTENT_ICONS[intentConfig.type] || '⚠';
        current.cssClass = typeDef ? typeDef.cssClass : '';
        current.isTelegraphed = true;
        current.prepTurns = intentConfig.prepTurns || 1;
        current.turnsRemaining = intentConfig.prepTurns || 1;  // Will execute after this many turns
        current.dialogue = intentConfig.dialogue;
        current.executeDialogue = intentConfig.executeDialogue;
        current.canBreak = typeDef ? typeDef.canBreak : false;
        current.breakCondition = typeDef ? typeDef.breakCondition : null;

        _log.debug('BattleFacade', 'Triggering intent prep phase:', intentId, current);

        // Lock actions during the simulated enemy turn
        _actionInProgress = true;
        BattleCore.setPhase('enemy');

        // Show the intent preparation (dialogue + icon) and properly end enemy turn
        showIntentPreparation(enemy, current, function() {
            // Intent announcement IS the enemy's action - end their turn properly
            _log.debug('BattleFacade', 'Intent prep shown, finishing enemy turn');
            finishEnemyTurn([], function() {
                _log.debug('BattleFacade', 'Enemy turn finished, player can now act');
            });
        });

        return { success: true, message: 'Triggered ' + intentId + ' prep phase - will execute next turn!', intent: current };
    }

    /**
     * DEV: Get list of available intents for current enemy
     * @returns {Array} List of intent IDs
     */
    function devGetAvailableIntents() {
        var enemy = BattleCore.getEnemy();
        if (!enemy || !enemy.intents) return [];
        return enemy.intents.map(function(i) {
            return { id: i.id, type: i.type, name: i.skill ? i.skill.name : i.id };
        });
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
        _log.debug('BattleEngine', 'start() called', { battleConfig: battleConfig, sceneId: sceneId });

        // Reset battle ending flag for new battle
        _battleEnding = false;

        // Reset display state tracking from previous battles
        prevDisplayState = {
            playerHP: null,
            playerMana: null,
            playerLimit: null,
            playerAC: null,
            enemyHP: null
        };

        // Ensure pause key listener is set up
        ensurePauseKeyListener();

        // Make sure we're not paused from a previous battle
        unpause();

        // Rebind QTE inputs (cleanup unbinds them at battle end)
        if (typeof QTEEngine !== 'undefined' && QTEEngine.bindInputs) {
            QTEEngine.bindInputs();
        }

        // Determine style from config
        var styleName = battleConfig.style || 'dnd';
        setStyle(styleName);
        _log.debug('BattleEngine', 'Style set to:', styleName);

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
        _log.debug('BattleEngine', 'Calling BattleCore.startBattle...');
        BattleCore.startBattle(battleConfig, sceneId);
        _log.debug('BattleEngine', 'BattleCore.startBattle completed');

        // Get state for UI and sync to mutable battleState
        var coreState = BattleCore.getState();
        _log.debug('BattleEngine', 'Core state:', { player: coreState.player, enemy: coreState.enemy });
        battleState.player = coreState.player;
        battleState.enemy = coreState.enemy;
        battleState.onBattleReady = null;  // Reset callback

        // Show battle intro
        _log.debug('BattleEngine', 'Calling showBattleIntro...');
        showBattleIntro(coreState.enemy, function() {
            _log.debug('BattleEngine', 'Intro callback fired');
            showUI();
            _log.debug('BattleEngine', 'showUI() completed');
            updateDisplay();
            _log.debug('BattleEngine', 'updateDisplay() completed');

            // Trigger start dialogue
            var startLine = BattleCore.triggerDialogue('battle_start');
            if (startLine) {
                showDialogueBubble(startLine);
            }

            // Call onBattleReady callback if set by engine
            _log.debug('BattleEngine', 'Checking onBattleReady:', typeof battleState.onBattleReady);
            if (typeof battleState.onBattleReady === 'function') {
                _log.debug('BattleEngine', 'Calling onBattleReady...');
                battleState.onBattleReady();
            }
        });

        // Emit battle start event for new architecture
        if (typeof eventBus !== 'undefined' && typeof BattleEvents !== 'undefined') {
            eventBus.emit(BattleEvents.START, {
                sceneId: sceneId,
                enemy: coreState.enemy,
                player: coreState.player,
                style: styleName
            });
        }

        // Return mutable state for engine compatibility (allows setting callbacks)
        _log.debug('BattleEngine', 'start() returning battleState');
        return battleState;
    }

    /**
     * End the current battle
     * @param {string} result - 'win', 'lose', or 'flee'
     */
    function end(result) {
        // Clear action lock when battle ends
        _actionInProgress = false;

        // Clear all scheduled timeouts to prevent callbacks after battle ends
        clearAllScheduledTimeouts();

        // Clean up event listeners to prevent memory leaks
        removePauseKeyListener();
        if (typeof BattleDiceUI !== 'undefined' && BattleDiceUI.cleanup) {
            BattleDiceUI.cleanup();
        }

        // Clean up QTE system
        if (typeof QTEEngine !== 'undefined' && QTEEngine.cleanup) {
            QTEEngine.cleanup();
        }

        // Reset intent system (but don't cleanup BattleUI yet - outro needs it)
        if (_hasBattleIntent) {
            BattleIntent.reset();
        }
        // Hide intent indicator if visible
        if (_hasBattleUI && BattleUI.hideIntentIndicator) {
            BattleUI.hideIntentIndicator();
        }

        // Reset summon system
        if (_hasBattleSummon) {
            BattleSummon.reset();
        }
        // Clear summon sprites
        if (_hasBattleUI && BattleUI.clearAllSummons) {
            BattleUI.clearAllSummons();
        }

        var endInfo = BattleCore.endBattle(result);
        var battleSceneId = BattleCore.getState().sceneId;

        // Mark battle as won if victory
        if (result === 'win' && vnEngine && vnEngine.markBattleWon) {
            vnEngine.markBattleWon(battleSceneId);
        }

        // Emit battle end event for new architecture
        if (typeof eventBus !== 'undefined' && typeof BattleEvents !== 'undefined') {
            eventBus.emit(BattleEvents.END, {
                result: result,
                sceneId: battleSceneId,
                target: endInfo.target
            });
        }

        // Show outro transition - cleanup happens AFTER outro completes
        showBattleOutro(result, function() {
            // Now cleanup BattleUI after outro is done
            if (_hasBattleUI && BattleUI.cleanup) {
                BattleUI.cleanup();
            }

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
        // Reset battle ending flag
        _battleEnding = false;

        // Clear all pending timeouts to prevent callbacks after reset
        clearAllScheduledTimeouts();

        // Clean up event listeners to prevent memory leaks
        removePauseKeyListener();
        if (typeof BattleDiceUI !== 'undefined' && BattleDiceUI.cleanup) {
            BattleDiceUI.cleanup();
        }

        // Clean up QTE system
        if (typeof QTEEngine !== 'undefined' && QTEEngine.cleanup) {
            QTEEngine.cleanup();
        }

        // Clean up BattleUI resources
        if (_hasBattleUI && BattleUI.cleanup) {
            BattleUI.cleanup();
        }

        // Clear action lock
        _actionInProgress = false;

        // Make sure we're not paused (unpause handles hiding overlay)
        unpause();

        // Clear any pending timeouts from the timer
        var timer = getTimer();
        if (timer) timer.clearAll();

        // Reset intent system
        if (_hasBattleIntent) {
            BattleIntent.reset();
        }
        // Hide intent indicator if visible
        if (_hasBattleUI && BattleUI.hideIntentIndicator) {
            BattleUI.hideIntentIndicator();
        }

        // Reset summon system
        if (_hasBattleSummon) {
            BattleSummon.reset();
        }
        // Clear summon sprites
        if (_hasBattleUI && BattleUI.clearAllSummons) {
            BattleUI.clearAllSummons();
        }

        // End battle properly (sets active = false)
        BattleCore.endBattle('flee');

        // Reset player stats so next battle starts fresh (for "Play Again")
        BattleCore.resetPlayerStats();

        // Remove any battle overlays
        var overlays = ['battle-intro-overlay', 'battle-intro-flash', 'battle-outro-overlay'];
        overlays.forEach(function(id) {
            Utils.removeElement(document.getElementById(id));
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

    // Track if battle end has already been triggered
    var _battleEnding = false;

    /**
     * Check if battle has ended
     * ROBUST: Only triggers end sequence once, even if called multiple times
     */
    function checkEnd() {
        // Prevent multiple end triggers
        if (_battleEnding) {
            return true;  // Already ending
        }

        var result = BattleCore.checkBattleEnd();
        if (result && result.ended) {
            _battleEnding = true;  // Lock to prevent duplicate triggers

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
     * Handle failed player action - show message and reset state
     * @param {string} message - Error message to display
     * @param {Function} callback - Optional callback to invoke after reset
     */
    function handleActionFailure(message, callback) {
        updateBattleLog(message, null, function() {
            _actionInProgress = false;
            BattleCore.setPhase('player');
            if (callback) callback();
        }, { lingerDelay: 800 });  // Shorter delay for failure messages
    }

    /**
     * Execute a player action
     * @param {string} action - Action type ('attack', 'skill', 'defend', 'flee', 'item', 'limit')
     * @param {Object} params - Action parameters
     * @param {Function} callback - Completion callback
     */
    function executeAction(action, params, callback) {
        _log.debug('BattleFacade', 'executeAction called:', action, '_actionInProgress:', _actionInProgress);
        // Guard against spam-clicking race conditions
        if (_actionInProgress) {
            _log.debug('BattleFacade', 'BLOCKED - action in progress');
            return;
        }

        var state = BattleCore.getState();
        _log.debug('BattleFacade', 'state.active:', state.active, 'state.phase:', state.phase);
        if (!state.active || state.phase !== 'player') {
            _log.debug('BattleFacade', 'BLOCKED - not active or not player phase');
            return;
        }

        // Lock action processing IMMEDIATELY to prevent any queued clicks
        _actionInProgress = true;

        // Set phase to animating (also disables buttons visually)
        BattleCore.setPhase('animating');

        // NOTE: Cooldown ticks in incrementTurn() at the end of each full turn cycle
        // (after both enemy and player have acted)

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
                _log.warn('BattleEngine', 'Unknown action:', action);
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
                    handleActionFailure(messages.join('<br>'), callback);
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
                handleActionFailure(messages.join('<br>'), callback);
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

        // Get active log row (shifts previous content to row 1)
        var logEntry = getActiveLogRow();
        if (!logEntry) {
            updateDisplay();
            processEnemyTurn(messages, callback, { playerAction: 'defend' });
            return;
        }
        BattleDiceUI.showDefendRoll({
            container: logEntry,
            defender: BattleCore.getPlayer().name,
            rollResult: result.rollResult,
            acBonus: 0,  // AC bonus removed from defending
            manaRecovered: result.manaRecovered,
            manaRolled: result.manaRolled,
            cooldown: result.cooldown,
            isMinMana: result.isMinMana,
            isMaxMana: result.isMaxMana
            // onACComplete removed - no AC bonus to show
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
            handleActionFailure(messages.join('<br>'), callback);
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
            handleActionFailure(messages.join('<br>'), callback);
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
                // Continue after linger completes
                finishPlayerActionAfterRoll(actionType, result, messages, callback, { effectsApplied: true });
            }, {
                onTextComplete: function() {
                    // Apply effects when text finishes (before linger)
                    applyPlayerAttackEffects(result);
                }
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
                healRolls: result.healRolls,
                onTextComplete: function() {
                    // Apply pending heal when text finishes (before linger)
                    applyPendingEffects(result, 'player');

                    // Show floating heal number on player (only if > 0)
                    if (result.healed > 0) {
                        // Determine heal type for floating number styling
                        var healType = 'heal';
                        if (result.isMaxHeal) healType = 'maxheal';
                        else if (result.isMinHeal) healType = 'minheal';
                        showDamageNumber(result.healed, 'player', healType);
                    }

                    // Update display after heal applied
                    updateDisplay();
                }
            }, function() {
                // Continue after linger completes
                // Pass effectsApplied: true since heal was already applied in onTextComplete
                finishPlayerActionAfterRoll(actionType, result, messages, callback, { effectsApplied: true });
            });
        }
        // Buff skill with pending status (no heal/damage roll)
        else if (result.pendingStatus) {
            // Show message first, then apply status
            var statusMessages = messages.concat(result.messages || []);
            if (statusMessages.length > 0) {
                updateBattleLog(statusMessages.join('<br>'), null, function() {
                    // Continue after linger completes
                    // Pass effectsApplied: true since status was already applied in onTextComplete
                    finishPlayerActionAfterRoll(actionType, result, [], callback, { effectsApplied: true });
                }, {
                    onTextComplete: function() {
                        // Apply pending status when text finishes (before linger)
                        applyPendingEffects(result, 'player');
                        updateDisplay();
                    }
                });
            } else {
                applyPendingEffects(result, 'player');
                updateDisplay();
                finishPlayerActionAfterRoll(actionType, result, messages, callback);
            }
        }
        // Summon skill - show summon message and update UI
        else if (result.summonResult) {
            var summonMessages = messages.concat(result.messages || []);

            // Show the summon sprite if UI supports it
            if (_hasBattleUI && BattleUI.showSummonSprite && result.summon) {
                var displayData = BattleSummon.getDisplayData(result.summon.uid);
                if (displayData) {
                    BattleUI.showSummonSprite(displayData);
                }
            }

            // Show summon message
            if (summonMessages.length > 0) {
                updateBattleLog(summonMessages.join('<br>'), null, function() {
                    finishPlayerActionAfterRoll(actionType, result, [], callback);
                });
            } else {
                finishPlayerActionAfterRoll(actionType, result, messages, callback);
            }
        } else {
            // No roll (e.g., defend, item), just show messages
            finishPlayerActionAfterRoll(actionType, result, messages, callback);
        }
    }

    /**
     * Apply player attack effects (damage number, pending effects, display update)
     * Called from onTextComplete to apply effects before linger
     */
    function applyPlayerAttackEffects(result) {
        // Apply pending damage (includes intercept check)
        applyPendingEffects(result, 'enemy');

        // Check if summon intercepted
        if (result.intercepted) {
            // Show damage on the summon sprite, not enemy
            var damageType = result.attackResult && result.attackResult.isCrit ? 'crit' : 'damage';
            showDamageNumber(result.intercepted.damage, 'summon', damageType);

            // Hide summon sprite if it died
            if (result.intercepted.killed && _hasBattleUI && BattleUI.hideSummonSprite) {
                BattleUI.hideSummonSprite(result.intercepted.summon.uid, 'killed');
            }
        } else {
            // Normal damage to enemy
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
            }

            // Show miss via floating text
            if (result.attackResult && !result.attackResult.hit) {
                showDamageNumber(0, 'enemy', 'miss');
            }
        }

        updateDisplay();
    }

    function finishPlayerActionAfterRoll(actionType, result, messages, callback, options) {
        options = options || {};
        var state = BattleCore.getState();
        messages = messages.concat(result.messages || []);

        // Add intercept message if summon blocked the attack
        if (result.intercepted) {
            var interceptMsg = result.intercepted.summon.icon + ' ' + result.intercepted.summon.name + ' jumps in front!';
            if (result.intercepted.killed) {
                interceptMsg += ' ' + result.intercepted.summon.name + ' was defeated!';
            }
            messages.push(interceptMsg);
        }

        // If effects weren't already applied (via onTextComplete), apply them now
        if (!options.effectsApplied) {
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
            }

            // Show miss via WoW-style floating text (battle log is for rolls only)
            if (result.attackResult && !result.attackResult.hit) {
                showDamageNumber(0, 'enemy', 'miss');
            }

            // Show damage for limit break
            if (actionType === 'limit' && result.totalDamage) {
                showDamageNumber(result.totalDamage, 'enemy', 'limit');
            }

            // Apply pending damage now that animation is complete
            applyPendingEffects(result, 'enemy');
            updateDisplay();
        }

        // These things should always run (dialogue, intent system, fumble messages)
        if (result.attackResult && result.attackResult.hit) {
            // Trigger crit dialogue
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

        // Check if enemy died
        if (checkEnd()) return;

        // Process summon turn
        var summonResult = BattleCore.processSummonTurn();
        if (summonResult.acted) {
            // Update player summon sprites after they act
            if (_hasBattleSummon && _hasBattleUI && BattleUI.updateSummonSprite) {
                var playerSummons = BattleSummon.getActiveBySide('player');
                for (var s = 0; s < playerSummons.length; s++) {
                    BattleUI.updateSummonSprite(BattleSummon.getDisplayData(playerSummons[s].uid));
                }
            }
            // Hide expired summons
            if (summonResult.expired) {
                for (var e = 0; e < summonResult.expired.length; e++) {
                    if (_hasBattleUI && BattleUI.hideSummonSprite) {
                        BattleUI.hideSummonSprite(summonResult.expired[e].uid, 'dismiss');
                    }
                }
            }
            // Wait for summon message before proceeding to enemy turn
            updateBattleLog(summonResult.messages.join('<br>'), null, function() {
                updateDisplay();
                if (checkEnd()) return;
                proceedToEnemyTurn(actionType, messages, callback);
            }, {
                onTextComplete: function() {
                    // Show floating numbers for summon effects (damage/heal already applied in BattleCore)
                    if (summonResult.attackResult && summonResult.attackResult.hit) {
                        showDamageNumber(summonResult.attackResult.damage, 'enemy', 'damage');
                    }
                    if (summonResult.healResult && summonResult.healResult.healed > 0) {
                        showDamageNumber(summonResult.healResult.healed, 'player', 'heal');
                    }
                }
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
        // Note: Player summon turns are now processed in afterPlayerAction() via BattleCore.processSummonTurn()
        // This unifies HP-based and legacy summon processing into a single code path
        scheduleTimeout(function() {
            processEnemyTurn(messages, callback, { playerAction: actionType });
        }, config.timing.enemyTurnDelay);
    }

    /**
     * Process enemy turn
     */
    function processEnemyTurn(playerMessages, callback, context) {
        _log.debug('BattleFacade', 'processEnemyTurn called with context:', context);
        var state = BattleCore.getState();
        var style = getActiveStyle();
        var enemy = state.enemy;
        var messages = [];

        // Process enemy status effects
        var statusResult = BattleCore.tickStatuses(enemy, enemy.name);
        state._enemyStatusResult = statusResult;  // Store for fumble handling
        messages = messages.concat(statusResult.messages);

        if (statusResult.damage > 0) {
            enemy.hp -= statusResult.damage;  // Apply DOT damage (bleed, poison, burn)
            showDamageNumber(statusResult.damage, 'enemy', 'dot');
        }
        if (statusResult.heal > 0) {
            enemy.hp = Math.min(enemy.hp + statusResult.heal, enemy.maxHp);  // Apply regen
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
                // Get active log row (shifts previous content to row 1)
                var logEntry = getActiveLogRow();
                if (!logEntry) {
                    finishEnemyConfusionTurn();
                    return;
                }

                // Use modular BattleDiceUI.showSimpleDamageRoll for animated dice
                if (typeof BattleDiceUI !== 'undefined' && BattleDiceUI.showSimpleDamageRoll) {
                    BattleDiceUI.showSimpleDamageRoll({
                        container: logEntry,
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
                    logEntry.innerHTML = enemyName + ' hits themselves! <strong class="dice-number roll-damage-normal">' + confusionDmg + '</strong> <span class="damage-text roll-type-damage">DAMAGE</span>';
                    showDamageNumber(confusionDmg, 'enemy', 'damage');
                    updateDisplay();
                    setTimeout(finishEnemyConfusionTurn, 800);
                }
            }

            function finishEnemyConfusionTurn() {
                // Check if enemy died from confusion damage
                if (checkEnd()) return;

                // Enemy hit themselves - still decrement player's defensive stance if active
                // (enemy being confused counts as a "turn" for defensive stance duration)
                var endMessages = [];
                if (state.player.defending && state.player.defending > 0) {
                    state.player.defending--;
                    // Add flavor text for skipped defensive QTE
                    var flavorText = getDefendFlavorText('enemyDisabled');
                    if (flavorText) {
                        endMessages.push('<em>' + flavorText + '</em>');
                    }
                    // Show if stance wore off and apply cooldown
                    if (state.player.defending <= 0) {
                        endMessages.push('Defensive stance wore off!');
                        var cooldown = T && T.battle && T.battle.combat ? (T.battle.combat.defendCooldown || 2) : 2;
                        state.player.defendCooldown = cooldown;
                        state.player.defendCooldownJustSet = true;
                    }
                }

                // Confusion means enemy can't act - end their turn
                finishEnemyTurn(endMessages, callback);
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
            // Enemy can't attack - still decrement player's defensive stance if active
            // (enemy being stunned/frozen counts as a "turn" for defensive stance duration)
            var wasDefending = state.player.defending && state.player.defending > 0;
            if (wasDefending) {
                state.player.defending--;
                // Add flavor text for skipped defensive QTE
                var flavorText = getDefendFlavorText('enemyDisabled');
                if (flavorText) {
                    messages.push('<em>' + flavorText + '</em>');
                }
                // Show if stance wore off and apply cooldown
                if (state.player.defending <= 0) {
                    messages.push('Defensive stance wore off!');
                    var cooldown = T && T.battle && T.battle.combat ? (T.battle.combat.defendCooldown || 2) : 2;
                    state.player.defendCooldown = cooldown;
                    state.player.defendCooldownJustSet = true;
                }
            }
            // Wait for status message to complete before ending turn
            // Don't pass messages to finishEnemyTurn - already displayed above
            updateBattleLog(messages.join('<br>'), null, function() {
                finishEnemyTurn([], callback);
            });
            return;
        }

        // If there are status messages (e.g., "Frozen wore off!"), show them BEFORE attacking
        // This prevents race condition where attack roll typewriter overlaps with status messages
        if (messages.length > 0) {
            updateBattleLog(messages.join('<br>'), null, function() {
                // Clear messages since we've displayed them
                continueWithAttack([]);
            });
            return;
        }

        // No status messages - proceed directly
        continueWithAttack(messages);

        function continueWithAttack(remainingMessages) {
            // === INTENT SYSTEM: Check for telegraphed attacks ===
            if (_hasBattleIntent && _intentsEnabled) {
                var intent = BattleIntent.get();
                _log.debug('BattleFacade', 'Checking intent:', intent ? {
                    id: intent.id,
                    type: intent.type,
                    isTelegraphed: intent.isTelegraphed,
                    turnsRemaining: intent.turnsRemaining,
                    isReady: BattleIntent.isReady()
                } : 'null');

                // If there's a ready intent, execute it instead of normal attack
                if (intent && intent.isTelegraphed && BattleIntent.isReady()) {
                    _log.debug('BattleFacade', 'Executing intent attack!');
                    executeIntentAttack(style, intent, remainingMessages, callback);
                    return;
                }

                // If there's an active (not ready) intent that was already announced,
                // show concentration message and skip attack (enemy is focusing)
                if (intent && intent.isTelegraphed && intent.turnsRemaining > 0) {
                    _log.debug('BattleFacade', 'Intent active but not ready, showing concentration');
                    var concentrateMsg = '<em>' + (enemy.name || 'Enemy') + ' is concentrating...</em>';
                    updateBattleLog(concentrateMsg, null, function() {
                        finishEnemyTurn(remainingMessages, callback);
                    });
                    return;
                } else {
                    // Check if a new intent should trigger
                    var newIntent = BattleIntent.generate(enemy, state.player);
                    _log.debug('BattleFacade', 'Generated new intent:', newIntent ? newIntent.id : 'none');
                    if (newIntent && newIntent.isTelegraphed) {
                        // New intent triggered - show preparation and END TURN
                        // The preparation IS the enemy's action for this turn
                        _log.debug('BattleFacade', 'Announcing new intent - this is the enemy turn action');
                        showIntentPreparation(enemy, newIntent, function() {
                            // End enemy turn WITHOUT attacking - announcement was the action
                            finishEnemyTurn(remainingMessages, callback);
                        });
                        return;
                    }
                }
            }

            // Normal attack flow
            _log.debug('BattleFacade', 'Proceeding to normal attack');
            proceedWithNormalAttack();

            function proceedWithNormalAttack() {
                _log.debug('BattleFacade', 'In proceedWithNormalAttack');
                // Try to get an enemy taunt based on context
                var taunt = getEnemyTaunt(context);
                if (taunt) {
                    // Show dialogue bubble, then wait before attacking
                    showDialogueBubble(taunt);
                    scheduleTimeout(function() {
                        executeEnemyAttack(style, remainingMessages, callback);
                    }, config.timing.dialogueDuration);
                } else {
                    // No taunt, attack immediately
                    executeEnemyAttack(style, remainingMessages, callback);
                }
            }
        }
    }

    /**
     * Show intent preparation dialogue and UI
     * Sequence: dialogue bubble first, then delay, then battle log text
     */
    function showIntentPreparation(enemy, intent, callback) {
        var enemyName = enemy.name || 'Enemy';
        var dialogue = intent.dialogue || (enemyName + ' is preparing something...');

        // Show dialogue bubble first
        showDialogueBubble(dialogue);

        // Show intent indicator above enemy
        if (_hasBattleUI && BattleUI.showIntentIndicator) {
            var displayData = BattleIntent.getDisplayData();
            BattleUI.showIntentIndicator(displayData);
        }

        // Wait for dialogue to be read before showing battle log
        scheduleTimeout(function() {
            // Log the intent after dialogue delay
            var intentType = BattleIntent.getType(intent.type);
            var logClass = 'intent-message ' + (intent.cssClass || '');
            var logMessage = '<span class="' + logClass + '">' + enemyName + ': "' + dialogue + '"</span>';
            updateBattleLog(logMessage, null, function() {
                scheduleTimeout(callback, config.timing.dialogueDuration);
            });
        }, config.timing.intentAnnouncementDelay);
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
            _log.warn('BattleEngine', 'Intent has no skill, falling back to normal attack');
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

        // If skill is a summon, there's no attack - skip defend QTE entirely
        // Player's turn is effectively "skipped" since there's nothing to defend against
        if (skill.isSummon) {
            _log.debug('BattleFacade', 'Summon intent - no attack to defend against, skipping QTE');
            // If player was defending, decrement defending since the turn still passes
            if (player.defending && player.defending > 0) {
                player.defending--;
                if (player.defending <= 0) {
                    messages.push('Defensive stance wore off!');
                    var cooldown = T && T.battle && T.battle.combat ? (T.battle.combat.defendCooldown || 2) : 2;
                    player.defendCooldown = cooldown;
                    player.defendCooldownJustSet = true;
                }
            }
            scheduleTimeout(function() {
                executeIntentSkill(style, skill, intent, messages, callback);
            }, config.timing.dialogueDuration);
            return;
        }

        // Check if player is defending - trigger defend QTE for intent attacks too
        if (player.defending && player.defending > 0 && isQTEEnabledForDefend()) {
            _log.debug('BattleFacade', 'Player defending, triggering defend QTE for intent attack');
            scheduleTimeout(function() {
                processIntentDefendQTE(style, skill, intent, messages, callback);
            }, config.timing.dialogueDuration);
            return;
        }

        // Wait for dialogue, then execute the attack (no QTE)
        scheduleTimeout(function() {
            executeIntentSkill(style, skill, intent, messages, callback);
        }, config.timing.dialogueDuration);
    }

    /**
     * Process defend QTE for intent attacks
     * Similar to processDefendQTE but uses intent skill data
     */
    function processIntentDefendQTE(style, skill, intent, messages, callback) {
        var state = BattleCore.getState();
        var player = state.player;
        var enemy = state.enemy;
        var enemyName = enemy.name || 'Enemy';
        var playerName = player.name || 'Andi';
        var skillName = skill.name || 'Special Attack';

        // Show pre-QTE message
        var preQTEMessage = enemyName + ' uses ' + skillName + '!<br>' + playerName + ' braces himself!';

        updateBattleLog(preQTEMessage, null, function() {
            // Launch defend QTE
            var qteStarted = QTEEngine.startDefendQTE({
                difficulty: 'hard',  // Intent attacks are harder to defend
                enemyAttackName: skillName
            }, function(qteResult) {
                processIntentDefendQTEResult(style, skill, intent, qteResult, messages, callback);
            });

            // Fallback if QTE fails to start
            if (!qteStarted) {
                _log.warn('BattleEngine', 'Intent defend QTE failed to start, executing normally');
                executeIntentSkill(style, skill, intent, messages, callback);
            }
        });
    }

    /**
     * Process the result of a defend QTE against an intent attack
     */
    function processIntentDefendQTEResult(style, skill, intent, qteResult, messages, callback) {
        _log.debug('BattleFacade', 'processIntentDefendQTEResult called with:', qteResult);
        var state = BattleCore.getState();
        var player = state.player;
        var enemy = state.enemy;
        var enemyName = enemy.name || 'Enemy';
        var playerName = player.name || 'Andi';

        var zone = qteResult.zone || 'normal';
        var mods = qteResult.modifiers || QTEEngine.getDefendModifiers(zone);
        _log.debug('BattleFacade', 'Zone:', zone, 'Mods:', mods);

        // Clear the intent
        BattleIntent.clear(state.turn);

        // Calculate damage (handle multi-hit skills)
        var hits = skill.hits || 1;
        var baseDamage = 0;

        for (var i = 0; i < hits; i++) {
            var hitDamage;
            if (typeof skill.damage === 'number') {
                hitDamage = skill.damage;
            } else if (style.rollDamage) {
                hitDamage = style.rollDamage(skill.damage || '2d6');
            } else {
                hitDamage = 10;
            }
            baseDamage += hitDamage;
        }

        // Decrement defending counter
        var stanceWoreOff = false;
        if (player.defending > 0) {
            player.defending--;
            stanceWoreOff = player.defending <= 0;
        }

        var resultMessages = [];
        var skillName = skill.name || 'Special Attack';
        var isMultiHit = hits > 1;

        // Always show what attack was used
        resultMessages.push(enemyName + ' uses ' + skillName + (isMultiHit ? ' (' + hits + ' hits)!' : '!'));

        // Handle QTE outcomes
        if (mods.result === 'parry') {
            // PARRY: Reflect damage, take none
            var counterDice = mods.counterDamageDice || '1d6';
            var counterDamage = style.rollDamage ? style.rollDamage(counterDice) : Math.floor(Math.random() * 6) + 1;
            resultMessages.push('PARRY! ' + playerName + ' deflects ' + skillName + '!');
            resultMessages.push('<span class="roll-damage-normal">' + counterDamage + ' DAMAGE</span> reflected!');
            BattleCore.damageEnemy(counterDamage, { source: 'parry', type: 'physical' });
            showDamageNumber(counterDamage, 'enemy', 'damage');
        } else if (mods.result === 'dodge') {
            // DODGE: Avoid completely
            resultMessages.push('DODGE! ' + playerName + ' evades ' + skillName + '!');
            showDamageNumber(0, 'player', 'miss');
        } else {
            // CONFUSE/FUMBLE: Take damage (reduced by 50% for defending)
            var damage = Math.floor(baseDamage * 0.5);
            resultMessages.push('<span class="roll-damage-normal">' + damage + ' DAMAGE</span>');
            resultMessages.push('Defending reduced the damage!');
            BattleCore.damagePlayer(damage, { source: 'intent', type: skill.type });
            showDamageNumber(damage, 'player', 'damage');

            // Apply confusion for bad QTE
            if (mods.confused) {
                var confuseResult = BattleCore.applyStatus(player, 'confusion', 1);
                if (confuseResult && confuseResult.applied) {
                    resultMessages.push(playerName + ' is confused!');
                }
            }
        }

        if (stanceWoreOff) {
            resultMessages.push('Defensive stance wore off!');
            // Apply cooldown when stance ends
            var cooldown = T && T.battle && T.battle.combat ? (T.battle.combat.defendCooldown || 2) : 2;
            player.defendCooldown = cooldown;
            player.defendCooldownJustSet = true;  // Skip next tick
        }

        _log.debug('BattleFacade', 'Result messages:', resultMessages);
        updateDisplay();
        if (checkEnd()) return;

        _log.debug('BattleFacade', 'Showing result messages, then finishing turn');
        updateBattleLog(resultMessages.join('<br>'), null, function() {
            _log.debug('BattleFacade', 'Result shown, calling finishEnemyTurn with skipReattack');
            // Intent attacks are BIG attacks - skip the "enemy attacks again" logic
            finishEnemyTurn(messages, callback, { skipReattack: true });
        });
    }

    /**
     * Execute the actual intent skill
     */
    function executeIntentSkill(style, skill, intent, messages, callback) {
        var state = BattleCore.getState();
        var enemy = state.enemy;
        var player = state.player;
        var enemyName = enemy.name || 'Enemy';

        _log.debug('BattleFacade', 'executeIntentSkill called:', {
            skill: skill,
            isSummon: skill ? skill.isSummon : 'no skill',
            summonId: skill ? skill.summonId : 'no skill',
            intentType: intent ? intent.type : 'no intent'
        });

        // Clear the intent (record cooldown)
        BattleIntent.clear(state.turn);

        // Handle summon type
        if (skill.isSummon) {
            _log.debug('BattleFacade', 'Skill is summon, calling executeEnemySummon');
            executeEnemySummon(skill, enemy, messages, callback);
            return;
        }

        // Handle multi-hit skill
        if (skill.hits && skill.hits > 1) {
            executeMultiHitIntentSkill(style, skill, intent, messages, callback);
            return;
        }

        // Single big attack - Intent attacks ALWAYS HIT (player was warned, they had time to defend)
        // Only roll for damage, not to hit
        var damage;
        if (typeof skill.damage === 'number') {
            // Fixed damage value
            damage = skill.damage;
        } else if (style.rollDamage) {
            // Dice formula
            damage = style.rollDamage(skill.damage || '1d6');
        } else if (typeof BattleDice !== 'undefined') {
            damage = BattleDice.roll(skill.damage || '1d6');
        } else {
            damage = 5;
        }

        // Apply defend damage reduction if player is defending
        var wasDefending = player.defending && player.defending > 0;
        if (wasDefending) {
            var reduction = 0.5;  // 50% damage reduction when defending
            damage = Math.floor(damage * (1 - reduction));
            _log.debug('BattleFacade', 'Player defending! Damage reduced to:', damage);
            // Decrement defending counter (intent attack counts as an enemy attack)
            player.defending--;
        }

        _log.debug('BattleFacade', 'Always hits! Damage:', damage);

        var resultMsgs = [enemyName + ' uses ' + skill.name + '!'];
        resultMsgs.push('<span class="roll-damage-normal">' + damage + ' DAMAGE</span>');
        if (wasDefending) {
            resultMsgs.push('Defending reduced the damage!');
            // Check if stance wore off and apply cooldown
            if (player.defending <= 0) {
                resultMsgs.push('Defensive stance wore off!');
                var cooldown = T && T.battle && T.battle.combat ? (T.battle.combat.defendCooldown || 2) : 2;
                player.defendCooldown = cooldown;
                player.defendCooldownJustSet = true;
            }
        }

        applyDirectDamage({
            message: resultMsgs.join('<br>'),
            damage: damage,
            target: 'player',
            source: 'intent',
            type: skill.type,
            isCrit: false
        }, function() {
            if (checkEnd()) return;
            // Intent attacks are BIG attacks - skip the "enemy attacks again" logic
            finishEnemyTurn([], callback, { skipReattack: true });
        });
    }

    /**
     * Execute a multi-hit intent skill
     * Multi-hit intents ALWAYS HIT (player was warned, they had time to defend)
     */
    function executeMultiHitIntentSkill(style, skill, intent, messages, callback) {
        var state = BattleCore.getState();
        var enemy = state.enemy;
        var player = state.player;
        var enemyName = enemy.name || 'Enemy';
        var hits = skill.hits || 1;
        var currentHit = 0;
        var totalDamage = 0;
        var wasDefending = player.defending && player.defending > 0;

        // Decrement defending counter at start (multi-hit counts as one enemy attack)
        if (wasDefending) {
            player.defending--;
        }

        function executeHit() {
            currentHit++;
            // Re-fetch player state for current HP
            var currentPlayer = BattleCore.getState().player;

            if (currentHit > hits || currentPlayer.hp <= 0) {
                // All hits done
                var totalMsg = 'Total: <span class="roll-damage-normal">' + totalDamage + ' DAMAGE</span>';
                if (wasDefending) {
                    totalMsg += '<br>Defending reduced the damage!';
                    // Check if stance wore off and apply cooldown
                    if (player.defending <= 0) {
                        totalMsg += '<br>Defensive stance wore off!';
                        var cooldown = T && T.battle && T.battle.combat ? (T.battle.combat.defendCooldown || 2) : 2;
                        player.defendCooldown = cooldown;
                        player.defendCooldownJustSet = true;
                    }
                }
                updateBattleLog(totalMsg, null, function() {
                    updateDisplay();
                    if (checkEnd()) return;
                    // Intent attacks are BIG attacks - skip the "enemy attacks again" logic
                    finishEnemyTurn([], callback, { skipReattack: true });
                });
                return;
            }

            // Multi-hit intents ALWAYS HIT - only roll damage
            var damage;
            if (typeof skill.damage === 'number') {
                damage = skill.damage;
            } else if (style.rollDamage) {
                damage = style.rollDamage(skill.damage || '1d4');
            } else if (typeof BattleDice !== 'undefined') {
                damage = BattleDice.roll(skill.damage || '1d4');
            } else {
                damage = 2;
            }

            // Apply defend damage reduction if player was defending when intent started
            if (wasDefending) {
                var reduction = 0.5;  // 50% damage reduction when defending
                damage = Math.max(1, Math.floor(damage * (1 - reduction)));
            }

            // Small delay between hits
            scheduleTimeout(function() {
                totalDamage += damage;
                BattleCore.damagePlayer(damage, { source: 'intent', type: skill.type });
                showDamageNumber(damage, 'player', 'damage');
                updateDisplay();

                // Re-fetch player state after damage
                var afterDamagePlayer = BattleCore.getState().player;
                if (afterDamagePlayer.hp <= 0) {
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

    /**
     * Execute an enemy summon skill
     * @param {Object} skill - The summon skill with isSummon: true and summonId
     * @param {Object} enemy - The enemy doing the summoning
     * @param {Array} messages - Message array
     * @param {Function} callback - Turn completion callback
     */
    function executeEnemySummon(skill, enemy, messages, callback) {
        var enemyName = enemy.name || 'Enemy';
        var summonId = skill.summonId;

        _log.debug('BattleFacade', 'executeEnemySummon called:', {
            skill: skill,
            summonId: summonId,
            enemyId: enemy.id,
            hasBattleSummon: _hasBattleSummon,
            hasBattleUI: _hasBattleUI
        });

        if (!_hasBattleSummon) {
            _log.warn('BattleEngine', 'BattleSummon module not loaded - cannot summon');
            finishEnemyTurn([], callback, { skipReattack: true });
            return;
        }

        if (!summonId) {
            _log.warn('BattleEngine', 'Summon skill has no summonId:', skill);
            finishEnemyTurn([], callback, { skipReattack: true });
            return;
        }

        // Spawn the summon
        _log.debug('BattleFacade', 'Calling BattleSummon.spawn with:', summonId, enemy.id, 'enemy');
        var result = BattleSummon.spawn(summonId, enemy.id, 'enemy');
        _log.debug('BattleFacade', 'Spawn result:', result);

        if (!result.success) {
            // Failed to summon (e.g., max summons reached)
            var failMsg = enemyName + ' tries to call for help, but ' + (result.message || 'fails!');
            updateBattleLog(failMsg, null, function() {
                finishEnemyTurn([], callback, { skipReattack: true });
            });
            return;
        }

        // Success - show summon appearing
        var summonMsgs = [];
        summonMsgs.push(enemyName + ' calls for help!');
        summonMsgs.push(result.message);

        // Show the summon sprite
        _log.debug('BattleFacade', 'Checking for BattleUI.showSummonSprite:', _hasBattleUI, BattleUI ? !!BattleUI.showSummonSprite : 'BattleUI undefined');
        if (_hasBattleUI && BattleUI.showSummonSprite) {
            var displayData = BattleSummon.getDisplayData(result.summon.uid);
            _log.debug('BattleFacade', 'Display data:', displayData);
            BattleUI.showSummonSprite(displayData);
        }

        // Get summon dialogue if any
        var summonDialogue = BattleSummon.getDialogue(result.summon.uid, 'summon_appear');
        if (summonDialogue) {
            showDialogueBubble(summonDialogue);
        }

        updateBattleLog(summonMsgs.join('<br>'), null, function() {
            // Intent-triggered summons - skip the "enemy attacks again" logic
            finishEnemyTurn([], callback, { skipReattack: true });
        });
    }

    /**
     * Process enemy summon turns (called at end of main enemy turn)
     * @param {Function} callback - Completion callback
     */
    function processEnemySummonTurns(callback) {
        _log.debug('BattleFacade', 'processEnemySummonTurns called');
        if (!_hasBattleSummon || !BattleSummon.hasSummons('enemy')) {
            _log.debug('BattleFacade', 'No summons, calling callback');
            callback();
            return;
        }

        var state = BattleCore.getState();
        var player = state.player;
        var style = getActiveStyle();

        // Process enemy summon turns
        var result = BattleSummon.processTurn('enemy', player);

        if (!result.actions || result.actions.length === 0) {
            // No actions, just check for expirations
            if (result.messages && result.messages.length > 0) {
                // Handle expired summons
                for (var i = 0; i < result.expired.length; i++) {
                    var expired = result.expired[i];
                    if (_hasBattleUI && BattleUI.hideSummonSprite) {
                        BattleUI.hideSummonSprite(expired.uid, 'dismiss');
                    }
                }
                updateBattleLog(result.messages.join('<br>'), null, callback);
            } else {
                callback();
            }
            return;
        }

        // Process each summon action
        var actionIndex = 0;

        function processNextAction() {
            if (actionIndex >= result.actions.length) {
                // All actions done - show any remaining messages from expiration
                if (result.messages && result.messages.length > 0) {
                    updateBattleLog(result.messages.join('<br>'), null, function() {
                        updateDisplay();
                        callback();
                    });
                } else {
                    callback();
                }
                return;
            }

            var action = result.actions[actionIndex];
            actionIndex++;

            if (action.type === 'attack') {
                // Resolve summon attack against player
                var attackResult = null;
                if (style && style.resolveSummonAttack) {
                    // Pass the move as third parameter for new enemy summon system
                    attackResult = style.resolveSummonAttack(action.summon, player, action.move);
                } else {
                    // Simple fallback - use BattleDice if available
                    var damage = (typeof BattleDice !== 'undefined' && BattleDice.rollDamage)
                        ? BattleDice.rollDamage(action.move.damage)
                        : 3;
                    attackResult = { hit: true, damage: damage };
                }

                // Build combined message (no dice roll animation for summons - too long)
                // Styled damage - typewriter preserves roll-* class spans via placeholder system
                var message;
                if (attackResult.hit) {
                    message = action.summon.name + ' attacks for <span class="roll-damage-normal">' + attackResult.damage + ' DAMAGE!</span>';
                } else {
                    message = action.summon.name + ' attacks and misses!';
                }

                // Show message with deferred damage application
                updateBattleLog(message, null, function() {
                    // After linger, check for death and continue
                    if (checkEnd()) return;
                    processNextAction();
                }, {
                    onTextComplete: function() {
                        // Apply damage and show floating numbers (unified)
                        applyDamageWithFloatingNumber(attackResult, 'player', {
                            source: 'summon',
                            type: action.move.type || 'physical',
                            showRoll: true
                        });
                        updateDisplay();
                    }
                });
            } else if (action.type === 'heal') {
                // Summon healing (heals their master, the enemy)
                var healAmount = action.amount;
                var message = action.summon.name + ' heals ' + state.enemy.name +
                    ' for <span class="battle-number">' + healAmount + ' HP</span>!';

                // Show message with deferred heal application
                updateBattleLog(message, null, function() {
                    // After linger, continue
                    processNextAction();
                }, {
                    onTextComplete: function() {
                        // Apply heal when text finishes (before linger)
                        BattleCore.healEnemy(healAmount, 'summon');
                        showDamageNumber(healAmount, 'enemy', 'heal');
                        updateDisplay();
                    }
                });
            } else {
                // Unknown action type
                processNextAction();
            }
        }

        // Handle expired summons first
        for (var j = 0; j < result.expired.length; j++) {
            var expired = result.expired[j];
            if (_hasBattleUI && BattleUI.hideSummonSprite) {
                BattleUI.hideSummonSprite(expired.uid, 'dismiss');
            }
        }

        // Update summon displays
        var activeSummons = BattleSummon.getActiveBySide('enemy');
        for (var k = 0; k < activeSummons.length; k++) {
            if (_hasBattleUI && BattleUI.updateSummonSprite) {
                BattleUI.updateSummonSprite(BattleSummon.getDisplayData(activeSummons[k].uid));
            }
        }

        processNextAction();
    }

    // Note: processPlayerSummonTurn has been removed - summon turns are now unified in
    // afterPlayerAction() via BattleCore.processSummonTurn() which handles both HP-based
    // and legacy summons in a single code path. Floating numbers are shown via onTextComplete.

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
        _log.debug('BattleFacade', 'processDefendQTE called');
        var state = BattleCore.getState();
        var player = state.player;
        var enemy = state.enemy;
        var enemyName = enemy.name || 'Enemy';
        var playerName = player.name || 'Andi';

        // Select enemy move first to know incoming attack
        var move = style.selectEnemyMove ? style.selectEnemyMove() : { name: 'Attack' };
        var moveName = move.name || 'Attack';
        _log.debug('BattleFacade', 'Enemy move:', moveName, move);

        // Check if this is an attack move (not a heal or buff)
        var isAttackMove = !move.isHeal && !move.isBuff && !move.isDefend;

        // If not an attack, skip the defend QTE and just execute the enemy turn normally
        if (!isAttackMove) {
            _log.debug('BattleFacade', 'Not an attack move, skipping QTE');
            var result = style.enemyTurn();
            finishEnemyAction(result, messages, callback);
            return;
        }

        // Show enemy attack announcement and player bracing before QTE
        var preQTEMessage = enemyName + ' uses ' + moveName + '!<br>' + playerName + ' braces himself!';
        _log.debug('BattleFacade', 'Showing pre-QTE message');

        updateBattleLog(preQTEMessage, null, function() {
            _log.debug('BattleFacade', 'Pre-QTE message shown, starting QTE');
            // Now launch the defend QTE
            var qteStarted = QTEEngine.startDefendQTE({
                difficulty: 'normal',
                enemyAttackName: moveName
            }, function(qteResult) {
                _log.debug('BattleFacade', 'QTE completed with result:', qteResult);
                processDefendQTEResult(style, player, enemy, move, qteResult, callback);
            });
            _log.debug('BattleFacade', 'QTE started:', qteStarted);

            // If QTE failed to start (e.g., already active), fall back to normal attack flow
            if (!qteStarted) {
                _log.warn('BattleEngine', 'Defend QTE failed to start, falling back to normal attack');
                var result = style.enemyTurn();
                finishEnemyAction(result, messages, callback);
            }
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

        // For parry/dodge, the attack effectively "misses" - don't apply status effects
        // Pass this to enemyTurn so status effects aren't applied on parried/dodged attacks
        var qteModifiers = {};
        if (mods.result === 'parry' || mods.result === 'dodge') {
            qteModifiers.noStatusEffect = true;  // Attack was parried/dodged, no status effect
        }

        // Execute enemy attack to get the roll (but don't apply damage yet for parry/dodge)
        // NOTE: enemyTurn() already decrements player.defending, so don't decrement here
        var attackResult = style.enemyTurn ? style.enemyTurn(qteModifiers) : null;

        // Check if stance wore off (after enemyTurn decremented it)
        // Defensive stance always lasts exactly 2 turns - no early termination
        var stanceWoreOff = player.defending <= 0;

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
        var state = BattleCore.getState();
        var enemyName = state.enemy.name || 'Enemy';
        var pendingParryDamage = null; // Store parry counter for deferred application
        var pendingPlayerDamage = null; // Store fumble damage for deferred application

        // Check if enemy fumbled (rolled natural 1) - this takes priority over QTE outcome
        var enemyFumbled = attackResult && attackResult.attackResult && attackResult.attackResult.isFumble;
        if (enemyFumbled) {
            // Enemy fumbled - show fumble message and enemy gets confused
            defendMessages.push('FUMBLE! ' + enemyName + ' stumbles and gets confused!');
            // The confusion was already applied in resolveAttack via fumbleStatusResult
            // Show stance wore off if applicable
            if (stanceWoreOff) {
                defendMessages.push('Defensive stance wore off!');
                // Apply cooldown when stance ends
                var cooldown = T && T.battle && T.battle.combat ? (T.battle.combat.defendCooldown || 2) : 2;
                player.defendCooldown = cooldown;
                player.defendCooldownJustSet = true;  // Skip next tick
            }
            updateDisplay();
            if (checkEnd()) return;
            if (defendMessages.length > 0) {
                updateBattleLog(defendMessages.join('<br>'), null, function() {
                    finishEnemyTurn([], callback);
                });
            } else {
                finishEnemyTurn([], callback);
            }
            return;
        }

        // Apply confused status for normal/bad outcomes (player gets confused from bad QTE)
        if (mods.confused) {
            var confuseResult = BattleCore.applyStatus(player, 'confusion', 1);
            if (confuseResult && confuseResult.applied) {
                defendMessages.push(playerName + ' is confused!');
            }
        }

        // Handle defend outcomes
        if (mods.result === 'parry') {
            // Check which parry model to use
            var parryModel = T && T.qte && T.qte.parryModel ? T.qte.parryModel : 'fixed';

            if (parryModel === 'reflect') {
                // REFLECT MODEL: Roll attack with advantage against enemy
                BattleCore.playSfx('defend');

                // Roll d20 with advantage
                var rollResult = BattleDice.rollWithAdvantage();
                var roll = rollResult.roll;
                var isCrit = rollResult.isCrit;
                var isFumble = rollResult.isFumble;

                // Get player attack bonus
                var attackModifiers = [];
                var baseAttackBonus = player.attackBonus || 0;
                if (baseAttackBonus !== 0) {
                    attackModifiers.push({ value: baseAttackBonus, source: 'ATK' });
                }
                var attackBonus = baseAttackBonus;
                var attackTotal = isFumble ? 1 : roll + attackBonus;

                // Get enemy AC
                var enemyAC = state.enemy.ac || 10;

                // Determine hit (crits always hit, fumbles always miss)
                var counterHit = false;
                if (isCrit) {
                    counterHit = true;
                } else if (isFumble) {
                    counterHit = false;
                } else {
                    counterHit = attackTotal >= enemyAC;
                }

                // Roll damage if hit
                var counterDamage = 0;
                var baseDamageRoll = 0;
                var damageModifiers = [];
                var isMinDamage = false;
                var isMaxDamage = false;

                if (counterHit) {
                    // Get player damage dice
                    var damageDice = player.damage || '1d6';
                    var damageRollResult;
                    if (typeof BattleDice !== 'undefined' && BattleDice.rollDamageDetailed) {
                        damageRollResult = BattleDice.rollDamageDetailed(damageDice);
                    } else {
                        damageRollResult = { total: style.rollDamage ? style.rollDamage(damageDice) : Math.floor(Math.random() * 6) + 1 };
                    }
                    baseDamageRoll = damageRollResult.total;
                    counterDamage = baseDamageRoll;
                    isMinDamage = damageRollResult.isMin || false;
                    isMaxDamage = damageRollResult.isMax || false;

                    // Apply crit multiplier
                    if (isCrit) {
                        var critMult = T && T.battle && T.battle.combat ? T.battle.combat.critMultiplier || 2 : 2;
                        damageModifiers.push({ value: critMult, source: 'CRIT', isMultiplier: true });
                        counterDamage = Math.floor(counterDamage * critMult);
                    }
                }

                // Build attackResult object for showAttackRoll
                var counterAttackResult = {
                    roll: roll,
                    rolls: rollResult.rolls,
                    hasAdvantage: true,
                    hasDisadvantage: false,
                    isCrit: isCrit,
                    isFumble: isFumble,
                    attackTotal: attackTotal,
                    attackModifiers: attackModifiers,
                    defenderAC: enemyAC,
                    hit: counterHit,
                    baseDamageRoll: baseDamageRoll,
                    damage: counterDamage,
                    damageModifiers: damageModifiers,
                    isMinDamage: isMinDamage,
                    isMaxDamage: isMaxDamage
                };

                // Show parry message first
                var parryMessage = 'PARRY! ' + playerName + ' counter-attacks!';
                var parryFlavor = getDefendFlavorText('parry');
                if (parryFlavor) {
                    parryMessage += '<br><em>' + parryFlavor + '</em>';
                }

                // Add stance wore off message
                if (stanceWoreOff) {
                    parryMessage += '<br>Defensive stance wore off!';
                    var cooldown = T && T.battle && T.battle.combat ? (T.battle.combat.defendCooldown || 2) : 2;
                    player.defendCooldown = cooldown;
                    player.defendCooldownJustSet = true;
                }

                updateBattleLog(parryMessage, null, function() {
                    // Show counter-attack roll with dice animation
                    showAttackRoll(playerName, counterAttackResult, true, function() {
                        // Apply damage after animation
                        if (counterHit && counterDamage > 0) {
                            BattleCore.damageEnemy(counterDamage, { source: 'parry', type: 'physical', isCrit: isCrit });
                            showDamageNumber(counterDamage, 'enemy', isCrit ? 'crit' : 'damage');
                        } else {
                            showDamageNumber(0, 'enemy', 'miss');
                        }
                        updateDisplay();
                        if (checkEnd()) return;
                        finishEnemyTurn([], callback);
                    }, {
                        onTextComplete: function() {
                            // Effects applied after dice animation in the callback above
                        }
                    });
                });
                return; // Early return - flow handled by callbacks
            } else {
                // FIXED MODEL: Roll counterDamageDice (original behavior)
                var counterDice = mods.counterDamageDice || (T && T.qte && T.qte.defendModifiers && T.qte.defendModifiers.perfect && T.qte.defendModifiers.perfect.counterDamageDice) || '1d5';
                var counterDamage = style.rollDamage ? style.rollDamage(counterDice) : Math.floor(Math.random() * 5) + 1;
                // Store for deferred application (damage applied after message shown)
                pendingParryDamage = counterDamage;
                defendMessages.push('PARRY! ' + playerName + ' reflects <span class="roll-damage-normal">' + counterDamage + ' DAMAGE</span>!');
                // Add flavored parry text
                var parryFlavor = getDefendFlavorText('parry');
                if (parryFlavor) {
                    defendMessages.push('<em>' + parryFlavor + '</em>');
                }
                // Play parry SFX
                BattleCore.playSfx('defend');
                // Don't apply pending damage - parry blocks it
            }
        } else if (mods.result === 'dodge') {
            // DODGE: No damage taken
            defendMessages.push('DODGE! ' + playerName + ' avoids the attack!');
            // Add flavored dodge text
            var dodgeFlavor = getDefendFlavorText('dodge');
            if (dodgeFlavor) {
                defendMessages.push('<em>' + dodgeFlavor + '</em>');
            }
            showDamageNumber(0, 'player', 'miss');
            // Play dodge SFX (same as defend for now)
            BattleCore.playSfx('defend');
            // Don't apply pending damage - dodge avoids it
        } else {
            // CONFUSE or FUMBLE: Store damage for deferred application (sync with HP bar update)
            if (damage > 0) {
                pendingPlayerDamage = {
                    attackResult: attackResult,
                    damage: damage
                };
            }

            // Add attack messages (but filter out the "uses X" message since we showed it before QTE)
            if (attackResult && attackResult.messages) {
                attackResult.messages.forEach(function(msg) {
                    if (msg.indexOf(' uses ') === -1) {
                        defendMessages.push(msg);
                    }
                });
            }
        }

        // Show stance wore off message
        if (stanceWoreOff) {
            defendMessages.push('Defensive stance wore off!');
            // Apply cooldown when stance ends
            var cooldown = T && T.battle && T.battle.combat ? (T.battle.combat.defendCooldown || 2) : 2;
            player.defendCooldown = cooldown;
            player.defendCooldownJustSet = true;  // Skip next tick
        }

        // Check if player died (before applying parry damage)
        if (checkEnd()) return;

        // Show messages and finish turn - apply deferred damage when text completes
        if (defendMessages.length > 0) {
            updateBattleLog(defendMessages.join('<br>'), null, function() {
                // Continue after linger
                if (checkEnd()) return;
                finishEnemyTurn([], callback);
            }, {
                onTextComplete: function() {
                    // Apply fumble damage when text finishes (sync with HP bar update)
                    if (pendingPlayerDamage !== null) {
                        applyPendingEffects(pendingPlayerDamage.attackResult, 'player');
                        showDamageNumber(pendingPlayerDamage.damage, 'player', 'damage');
                    }
                    // Apply parry counter damage when text finishes (before linger)
                    if (pendingParryDamage !== null) {
                        BattleCore.damageEnemy(pendingParryDamage, { source: 'parry', type: 'physical' });
                        showDamageNumber(pendingParryDamage, 'enemy', 'damage');
                    }
                    updateDisplay();
                }
            });
        } else {
            // No messages but still might have pending damage
            if (pendingPlayerDamage !== null) {
                applyPendingEffects(pendingPlayerDamage.attackResult, 'player');
                showDamageNumber(pendingPlayerDamage.damage, 'player', 'damage');
                updateDisplay();
            }
            if (pendingParryDamage !== null) {
                BattleCore.damageEnemy(pendingParryDamage, { source: 'parry', type: 'physical' });
                showDamageNumber(pendingParryDamage, 'enemy', 'damage');
                updateDisplay();
            }
            if (checkEnd()) return;
            finishEnemyTurn([], callback);
        }
    }

    /**
     * Apply enemy attack effects (damage number, pending effects, display update)
     * Called from onTextComplete to apply effects before linger
     */
    function applyEnemyAttackEffects(result) {
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
            showDamageNumber(result.attackResult.damage, 'player', damageType);
        }

        // Show miss via floating text
        if (result.attackResult && !result.attackResult.hit) {
            showDamageNumber(0, 'player', 'miss');
        }

        // Apply pending damage
        applyPendingEffects(result, 'player');
        updateDisplay();
    }

    /**
     * Apply enemy heal effects (floating number, pending effects, display update)
     * Called from onTextComplete to apply effects before linger
     */
    function applyEnemyHealEffects(result) {
        // Show enemy heal with floating number
        if (result.healed && result.healed > 0) {
            showDamageNumber(result.healed, 'enemy', 'heal');
        }

        // Apply pending heal (if using pending pattern for enemy heals)
        applyPendingEffects(result, 'enemy');
        updateDisplay();
    }

    function finishEnemyAction(result, messages, callback) {
        var state = BattleCore.getState();

        // If enemy has an attack roll, show animated dice roll (same as player)
        if (result.attackResult && result.attackResult.roll !== undefined) {
            var enemyName = state.enemy.name || 'Enemy';

            showAttackRoll(enemyName, result.attackResult, false, function() {
                // Continue after brief display
                finishEnemyActionAfterRoll(result, messages, callback, { effectsApplied: true });
            }, {
                onTextComplete: function() {
                    // Apply effects when text finishes
                    applyEnemyAttackEffects(result);
                }
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
                    isMaxHeal: result.healRoll.isMaxHeal,
                    onTextComplete: function() {
                        // Apply effects when text finishes (before linger)
                        applyEnemyHealEffects(result);
                    }
                },
                function() {
                    // Continue after linger completes
                    finishEnemyActionAfterRoll(result, messages, callback, { effectsApplied: true });
                }
            );
        } else {
            finishEnemyActionAfterRoll(result, messages, callback);
        }
    }

    function finishEnemyActionAfterRoll(result, messages, callback, options) {
        options = options || {};

        // Only add result.messages for non-attacks and non-heals
        // Attack messages are shown via showAttackRoll
        // Heal messages are shown via showHealRoll
        if (!result.attackResult && !result.healRoll) {
            messages = messages.concat(result.messages || []);
        }

        // For attacks, extract and add status effect messages (they're not shown in attack roll)
        // Status messages contain icons like 🩸, ⚔️, 🛡️, etc. and usually start with status icon
        if (result.attackResult && result.attackResult.statusResult && result.attackResult.statusResult.applied) {
            messages.push(result.attackResult.statusResult.message);
        }

        // If effects weren't already applied (via onTextComplete), apply them now
        if (!options.effectsApplied) {
            // Show damage number
            if (result.attackResult && result.attackResult.hit) {
                var damageType = 'damage';
                if (result.attackResult.isCrit) {
                    damageType = 'crit';
                } else if (result.attackResult.isMaxDamage) {
                    damageType = 'maxdamage';
                } else if (result.attackResult.isMinDamage) {
                    damageType = 'mindamage';
                }
                showDamageNumber(result.attackResult.damage, 'player', damageType);
            }

            // Show miss via WoW-style floating text (battle log is for rolls only)
            if (result.attackResult && !result.attackResult.hit) {
                showDamageNumber(0, 'player', 'miss');
            }

            // Show enemy heal with floating number
            if (result.healed && result.healed > 0) {
                showDamageNumber(result.healed, 'enemy', 'heal');
            }

            // Apply pending damage/heal now that animation is complete
            applyPendingEffects(result, 'player');
            updateDisplay();
        }

        // These things should always run (dialogue, fumble messages)
        var state = BattleCore.getState();
        if (result.attackResult && result.attackResult.hit) {
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

        // Enemy fumble handling (miss was already shown if !effectsApplied)
        if (result.attackResult && !result.attackResult.hit && result.attackResult.isFumble) {
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

        // Show heal dialogue if available
        if (result.healed && result.healed > 0) {
            var healLine = BattleCore.triggerDialogue('move_break_room_retreat');
            if (healLine) showDialogueBubble(healLine);
        }

        // Check if player died
        if (checkEnd()) return;

        finishEnemyTurn(messages, callback);
    }

    function finishEnemyTurn(messages, callback, options) {
        _log.debug('BattleFacade', 'finishEnemyTurn called', options);
        options = options || {};

        // Function to continue after messages are displayed
        function continueAfterMessages() {
            // === INTENT SYSTEM: Tick intent counter at end of enemy turn ===
            if (_hasBattleIntent && BattleIntent.isTelegraphed()) {
                BattleIntent.tick();
                // Update the indicator to show remaining turns
                if (_hasBattleUI && BattleUI.updateIntentIndicator) {
                    BattleUI.updateIntentIndicator(BattleIntent.getDisplayData());
                }
            }

            // === SUMMON SYSTEM: Process enemy summon turns ===
            processEnemySummonTurns(function() {
                continueFinishEnemyTurn(callback, options);
            });
        }

        // Display any messages (heal notifications, etc.) in the battle log
        // Don't add enemy name prefix - messages already include context
        // IMPORTANT: Wait for typewriter to complete before continuing to avoid race condition
        if (messages && messages.length > 0) {
            var msgHtml = messages.join('<br>');
            updateBattleLog(msgHtml, null, continueAfterMessages);
        } else {
            continueAfterMessages();
        }
    }

    /**
     * Continue finishing enemy turn after summons have acted
     * @param {function} callback - Callback when turn ends
     * @param {Object} options - { skipReattack: boolean } - Skip "enemy attacks again" for intent attacks
     */
    function continueFinishEnemyTurn(callback, options) {
        options = options || {};
        _log.debug('BattleFacade', 'continueFinishEnemyTurn called', options);
        // incrementTurn() handles: turn counter++, dialogue cooldown, AND defend cooldown
        // Cooldown ticks once per full turn cycle (enemy action + player action)
        BattleCore.incrementTurn();
        updateDisplay(); // Show updated cooldown immediately

        // Process player regen/status ticks AFTER enemy turn, BEFORE player can act
        var state = BattleCore.getState();
        var statusResult = BattleCore.tickStatuses(state.player, state.player.name);
        _log.debug('BattleFacade', 'Player status result:', statusResult);

        // Apply status damage/healing/mana
        if (statusResult.damage > 0) {
            state.player.hp -= statusResult.damage;  // Apply DOT damage (bleed, poison, burn)
            showDamageNumber(statusResult.damage, 'player', 'dot');
        }
        if (statusResult.heal > 0) {
            state.player.hp = Math.min(state.player.hp + statusResult.heal, state.player.maxHp);  // Apply regen
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

                // Get active log row (shifts previous content to row 1)
                var logEntry = getActiveLogRow();
                if (!logEntry) {
                    finishConfusionTurn();
                    return;
                }

                // Use modular BattleDiceUI.showSimpleDamageRoll for animated dice
                if (typeof BattleDiceUI !== 'undefined' && BattleDiceUI.showSimpleDamageRoll) {
                    BattleDiceUI.showSimpleDamageRoll({
                        container: logEntry,
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
                    logEntry.innerHTML = playerName + ' hits themselves! <strong class="dice-number roll-damage-normal">' + confusionDmg + '</strong> <span class="damage-text roll-type-damage">DAMAGE</span>';
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

                // If player is still in defensive stance, enemy attacks again automatically
                // Skip this for intent attacks (skipReattack) - big attacks end the enemy's turn
                if (!options.skipReattack && state.player.defending && state.player.defending > 0) {
                    _log.debug('BattleFacade', 'Player still defending (' + state.player.defending + ' attacks remaining), enemy attacks again');
                    state._playerStatusResult = null;
                    processEnemyTurn([], callback, { playerAction: 'defending' });
                    return;
                }

                // Clear the log before returning control to player
                clearBattleLog();

                BattleCore.setPhase('player');
                updateDisplay();
                // Refresh battle choices to show updated cooldowns
                if (typeof VNEngine !== 'undefined' && VNEngine.refreshBattleChoices) {
                    VNEngine.refreshBattleChoices();
                }

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

        // If player is still in defensive stance, enemy attacks again automatically
        // Skip this for intent attacks (skipReattack) - big attacks end the enemy's turn
        if (!options.skipReattack && state.player.defending && state.player.defending > 0) {
            _log.debug('BattleFacade', 'Player still defending (' + state.player.defending + ' attacks remaining), enemy attacks again');
            state._playerStatusResult = null;
            processEnemyTurn([], callback, { playerAction: 'defending' });
            return;
        }

        _log.debug('BattleFacade', 'Setting phase to player, unlocking actions');
        BattleCore.setPhase('player');
        updateDisplay();
        // Refresh battle choices to show updated cooldowns
        if (typeof VNEngine !== 'undefined' && VNEngine.refreshBattleChoices) {
            VNEngine.refreshBattleChoices();
        }

        // Clear action lock - player can now act again
        _actionInProgress = false;
        _log.debug('BattleFacade', 'Player can now act!');

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

        var qteStarted = QTEEngine.startAttackQTE({}, function(qteResult) {
            callback(qteResult || {});
        });
        // If QTE failed to start, fall back with empty result
        if (!qteStarted) {
            _log.warn('BattleEngine', 'Attack QTE failed to start');
            callback({});
        }
    }

    function processEnemyAttackWithQTE(callback) {
        if (typeof QTEEngine === 'undefined') {
            callback({});
            return;
        }

        var qteStarted = QTEEngine.startDodgeQTE({}, function(qteResult) {
            callback(qteResult || {});
        });
        // If QTE failed to start, fall back with empty result
        if (!qteStarted) {
            _log.warn('BattleEngine', 'Dodge QTE failed to start');
            callback({});
        }
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

            // Clear battle log from previous battle
            clearBattleLog();
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
            // Note: Defending no longer provides AC bonus (removed)

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
            _log.debug('BattleFacade', 'updateDisplay enemy HP:', state.enemy.hp, '/', state.enemy.maxHP);
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
     * @param {object} options - Optional { onTextComplete: function } called when text finishes but BEFORE linger
     */
    function updateBattleLog(html, rollData, callback, options) {
        // Apply glued tokens (emoji + word stay together with non-breaking space)
        if (html) {
            html = applyGluedTokens(html);
        }

        if (typeof BattleUI !== 'undefined') {
            BattleUI.updateBattleLog(html, rollData, callback, options);
        } else {
            // Fallback: call both callbacks immediately
            if (options && options.onTextComplete) options.onTextComplete();
            if (callback) callback();
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
     * @param {function} callback - Called AFTER linger delay
     * @param {Object} options - Optional { onTextComplete: function } called when text finishes but BEFORE linger
     */
    function showAttackRoll(attackerName, attackResult, isPlayer, callback, options) {
        // Handle old signature (attackerName, attackResult, callback)
        if (typeof isPlayer === 'function') {
            callback = isPlayer;
            isPlayer = true; // Default to player for backwards compatibility
            options = {};
        }
        options = options || {};

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
            if (options.onTextComplete) options.onTextComplete();
            if (callback) callback();
            return;
        }

        // Get active log row (shifts previous content to row 1)
        var logEntry = getActiveLogRow();
        if (!logEntry) {
            if (options.onTextComplete) options.onTextComplete();
            if (callback) callback();
            return;
        }

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
            damageRolls: attackResult.damageRolls,
            onTextComplete: options.onTextComplete
        }, callback);
    }

    /**
     * Show quick enemy attack result (no dice animation)
     * DnD-style: just shows HIT/MISS and damage
     * @param {string} attackerName - Enemy name
     * @param {Object} attackResult - Result from resolveAttack
     * @param {function} callback - Called after brief display
     * @param {Object} options - { onTextComplete }
     */
    function showEnemyAttackQuick(attackerName, attackResult, callback, options) {
        options = options || {};

        // Get active log row (shifts previous content to row 1)
        var logEntry = getActiveLogRow();
        if (!logEntry) {
            if (options.onTextComplete) options.onTextComplete();
            if (callback) callback();
            return;
        }

        // For hits (including crits), show animated damage roll if BattleDiceUI available
        if (attackResult.hit && typeof BattleDiceUI !== 'undefined' && BattleDiceUI.showSimpleDamageRoll) {

            // Use unified roll classes for consistent styling
            var introText = attackerName + ' ';
            if (attackResult.isCrit) {
                introText += '<span class="roll-result-text roll-hit-crit">CRITICAL HIT!</span> ';
            } else {
                introText += '<span class="roll-result-text roll-hit-normal">HIT!</span> ';
            }

            BattleDiceUI.showSimpleDamageRoll({
                container: logEntry,
                text: introText,
                damage: attackResult.damage,
                sides: 20,  // Assume d20-ish range for animation
                damageText: 'DAMAGE',
                onTextComplete: options.onTextComplete
            }, callback);
            return;
        }

        // Static text fallback (for misses, fumbles, or when BattleDiceUI unavailable)
        var html = '<div class="roll-result">';
        html += '<span class="roll-attacker">' + attackerName + '</span> ';

        if (attackResult.isCrit) {
            // Critical hit fallback - yellow with crit glow
            html += '<span class="roll-result-text roll-hit-crit">CRITICAL HIT!</span> ';
            html += '<strong class="dice-number roll-damage-crit">' + attackResult.damage + '</strong> ';
            html += '<span class="damage-text roll-type-damage">DAMAGE</span>';
        } else if (attackResult.isFumble) {
            // Fumble - grey with fail glow
            html += '<span class="roll-result-text roll-hit-fail">FUMBLE!</span>';
        } else if (attackResult.hit) {
            // Normal hit - yellow
            html += '<span class="roll-result-text roll-hit-normal">HIT!</span> ';
            var damageClass = 'roll-damage-normal';
            if (attackResult.isMaxDamage) damageClass = 'roll-damage-max';
            if (attackResult.isMinDamage) damageClass = 'roll-damage-min';
            html += '<strong class="dice-number ' + damageClass + '">' + attackResult.damage + '</strong> ';
            html += '<span class="damage-text roll-type-damage">DAMAGE</span>';
        } else {
            // Miss - grey/neutral
            html += '<span class="roll-result-text roll-neutral-normal">MISS!</span>';
        }

        // Remove wrapper div - just the content for fixed row
        logEntry.innerHTML = html.replace(/<\/?div[^>]*>/g, '');

        // Call onTextComplete immediately
        if (options.onTextComplete) options.onTextComplete();

        // Brief delay then callback
        var displayTime = TUNING && TUNING.battle && TUNING.battle.timing && TUNING.battle.timing.enemyResultDisplay
            ? TUNING.battle.timing.enemyResultDisplay
            : 800;

        setTimeout(function() {
            if (callback) callback();
        }, displayTime);
    }

    /**
     * Show animated heal roll for player/enemy recovery
     * @param {string} healerName - Name of the healer
     * @param {number} healAmount - Actual amount healed (after HP cap)
     * @param {number} healRolled - Amount rolled (before HP cap), for overheal display
     * @param {Object} options - Optional { isMinHeal, isMaxHeal, onTextComplete }
     * @param {function} callback - Called AFTER linger delay
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
            if (options.onTextComplete) options.onTextComplete();
            if (callback) callback();
            return;
        }

        // Get active log row (shifts previous content to row 1)
        var logEntry = getActiveLogRow();
        if (!logEntry) {
            if (options.onTextComplete) options.onTextComplete();
            if (callback) callback();
            return;
        }

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
            healRolls: options.healRolls,
            onTextComplete: options.onTextComplete
        }, callback);
    }

    function showDamageNumber(amount, target, type) {
        if (typeof BattleUI !== 'undefined') {
            BattleUI.showDamageNumber(amount, target, type);
        }
    }

    /**
     * Apply damage and show floating number in one unified action
     * @param {Object} attackResult - Attack result with hit, damage, isCrit, etc.
     * @param {string} target - 'player' or 'enemy'
     * @param {Object} options - { source, type }
     */
    function applyDamageWithFloatingNumber(attackResult, target, options) {
        options = options || {};

        if (!attackResult) return;

        // Note: showRoll option removed - was passing string to showDamageNumber which expects number
        // The battle log already shows roll results with proper formatting

        // Apply damage and show damage number
        if (attackResult.hit) {
            // Apply the damage
            if (target === 'player') {
                BattleCore.damagePlayer(attackResult.damage, {
                    source: options.source || 'attack',
                    type: options.type || 'physical',
                    isCrit: attackResult.isCrit
                });
            } else {
                BattleCore.damageEnemy(attackResult.damage, {
                    source: options.source || 'attack',
                    type: options.type || 'physical',
                    isCrit: attackResult.isCrit
                });
            }

            // Determine damage type for floating number styling
            var damageType = 'damage';
            if (attackResult.isCrit) {
                damageType = 'crit';
            } else if (attackResult.isMaxDamage) {
                damageType = 'maxdamage';
            } else if (attackResult.isMinDamage) {
                damageType = 'mindamage';
            }

            // Show damage floating number
            showDamageNumber(attackResult.damage, target, damageType);

            // ROBUST: Check for battle end immediately after damage
            // This ensures we catch deaths even if callback chains break
            checkEnd();
        } else {
            // Show miss
            showDamageNumber(0, target, 'miss');
        }
    }

    /**
     * Apply pending effects from a result object after animation completes
     * Handles damage, healing, status effects, and counter damage with proper timing
     * @param {Object} result - Result object containing pendingDamage, pendingHeal, pendingStatus, and/or pendingCounter
     * @param {string} target - 'enemy' or 'player' - who receives the effect
     */
    function applyPendingEffects(result, target) {
        if (!result) return;

        var state = BattleCore.getState();

        // Apply pending damage
        if (target === 'enemy' && result.pendingDamage) {
            // Check if enemy summon should intercept (only if attack would kill enemy)
            var interceptingSummon = null;
            if (_hasBattleSummon) {
                var enemy = state.enemy;
                interceptingSummon = BattleSummon.checkIntercept(
                    enemy.id,
                    enemy.hp,
                    result.pendingDamage.amount
                );
            }

            if (interceptingSummon) {
                // Summon takes the hit instead!
                var interceptResult = BattleSummon.takeDamage(
                    interceptingSummon.uid,
                    result.pendingDamage.amount,
                    {
                        source: result.pendingDamage.source,
                        type: result.pendingDamage.type,
                        isCrit: result.pendingDamage.isCrit
                    }
                );

                // Store intercept info for later display
                result.intercepted = {
                    summon: interceptingSummon,
                    damage: result.pendingDamage.amount,
                    killed: interceptResult.killed
                };
            } else {
                // Normal damage to enemy
                BattleCore.damageEnemy(result.pendingDamage.amount, {
                    source: result.pendingDamage.source,
                    type: result.pendingDamage.type,
                    isCrit: result.pendingDamage.isCrit
                });
            }
        } else if (target === 'player' && result.pendingDamage) {
            BattleCore.damagePlayer(result.pendingDamage.amount, {
                source: result.pendingDamage.source,
                type: result.pendingDamage.type,
                isCrit: result.pendingDamage.isCrit
            });
        }

        // Apply pending heal
        if (target === 'player' && result.pendingHeal) {
            BattleCore.healPlayer(result.pendingHeal.amount, result.pendingHeal.source);
        } else if (target === 'enemy' && result.pendingHeal) {
            BattleCore.healEnemy(result.pendingHeal.amount, result.pendingHeal.source);
        }

        // Apply pending status effect
        if (result.pendingStatus) {
            var statusTarget = result.pendingStatus.target === 'player' ? state.player : state.enemy;
            BattleCore.applyStatus(statusTarget, result.pendingStatus.type, result.pendingStatus.stacks || 1);
        }

        // Apply pending self status (e.g., Beer causes confusion to self)
        if (result.pendingSelfStatus) {
            var selfTarget = result.pendingSelfStatus.target === 'player' ? state.player : state.enemy;
            if (result.pendingSelfStatus.duration && BattleCore.applyStatusWithDuration) {
                BattleCore.applyStatusWithDuration(selfTarget, result.pendingSelfStatus.type, result.pendingSelfStatus.stacks || 1, result.pendingSelfStatus.duration);
            } else {
                BattleCore.applyStatus(selfTarget, result.pendingSelfStatus.type, result.pendingSelfStatus.stacks || 1);
            }
        }

        // Handle counter damage (player counters enemy)
        if (result.pendingCounter) {
            BattleCore.damageEnemy(result.pendingCounter.amount, {
                source: result.pendingCounter.source,
                type: result.pendingCounter.type
            });
        }

        // ROBUST: Check for battle end immediately after any damage
        checkEnd();
    }

    /**
     * Apply direct damage (no dice animation) with proper UI timing.
     * Shows message first, then applies damage and floating number in callback.
     * Use this for: intents, summons, limit breaks, parry counters, etc.
     *
     * @param {Object} options
     * @param {string} options.message - Battle log message to display
     * @param {number} options.damage - Damage amount
     * @param {string} options.target - 'player' or 'enemy'
     * @param {string} options.source - Damage source (e.g., 'intent', 'summon', 'parry')
     * @param {string} options.type - Damage type (e.g., 'physical', 'fire')
     * @param {boolean} [options.isCrit] - Whether this is a critical hit
     * @param {function} callback - Called after damage applied and UI updated
     */
    function applyDirectDamage(options, callback) {
        var message = options.message;
        var damage = options.damage;
        var target = options.target;
        var source = options.source || 'direct';
        var type = options.type || 'physical';
        var isCrit = options.isCrit || false;

        updateBattleLog(message, null, function() {
            // Apply damage after text is rendered
            if (target === 'player') {
                BattleCore.damagePlayer(damage, { source: source, type: type, isCrit: isCrit });
            } else if (target === 'enemy') {
                BattleCore.damageEnemy(damage, { source: source, type: type, isCrit: isCrit });
            }
            showDamageNumber(damage, target, 'damage');
            updateDisplay();

            // ROBUST: Check for battle end immediately after damage
            if (checkEnd()) return;

            if (callback) callback();
        });
    }

    /**
     * Get a random flavored text for dodge or parry outcomes
     * @param {string} type - 'dodge' or 'parry'
     * @returns {string|null} - Random flavor text or null if not available
     */
    function getDefendFlavorText(type) {
        if (!T || !T.qte || !T.qte.defendFlavorText) return null;
        var textArray = T.qte.defendFlavorText[type];
        if (!textArray || textArray.length === 0) return null;
        return Utils.pickRandom(textArray);
    }

    function showDialogueBubble(text) {
        if (typeof BattleUI !== 'undefined') {
            BattleUI.showDialogueBubble(text, config.timing.dialogueDuration);
        }
    }

    function showBattleIntro(enemy, callback) {
        _log.debug('BattleEngine', 'showBattleIntro called, BattleUI defined:', typeof BattleUI !== 'undefined');
        if (typeof BattleUI !== 'undefined') {
            _log.debug('BattleEngine', 'Calling BattleUI.showIntro...');
            BattleUI.showIntro(enemy, callback);
        } else {
            _log.debug('BattleEngine', 'BattleUI not defined, using fallback timeout');
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
        // Use BattleUI.hideTextBox() to add 'battle-mode' class for proper hiding
        if (_hasBattleUI && BattleUI.hideTextBox) {
            BattleUI.hideTextBox();
        } else if (elements.textBox) {
            elements.textBox.style.display = 'none';
            elements.textBox.classList.add('battle-mode');
        }
    }

    function showTextBox() {
        // Must use BattleUI.showTextBox() to remove 'battle-mode' class
        // The class has 'display: none !important' which overrides inline styles
        if (_hasBattleUI && BattleUI.showTextBox) {
            BattleUI.showTextBox();
        } else if (elements.textBox) {
            elements.textBox.style.display = '';
            elements.textBox.classList.remove('battle-mode');
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
                // Check if skill requires an item the player doesn't have
                if (skillDef.requiresItem) {
                    if (typeof VNEngine !== 'undefined' && VNEngine.hasItem) {
                        if (!VNEngine.hasItem(skillDef.requiresItem)) {
                            continue; // Skip this skill - player doesn't have required item
                        }
                    }
                }

                // Check if skill requires a flag the player doesn't have
                if (skillDef.requiresFlag) {
                    if (typeof VNEngine !== 'undefined' && VNEngine.hasFlag) {
                        if (!VNEngine.hasFlag(skillDef.requiresFlag)) {
                            continue; // Skip this skill - player doesn't have required flag
                        }
                    }
                }

                // Determine if it's a heal skill
                var isHeal = skillDef.isHeal || !!skillDef.healAmount;

                hydratedSkills.push({
                    id: skillId,
                    name: skillDef.name,
                    manaCost: skillDef.manaCost || 0,
                    damage: skillDef.damage,
                    healAmount: skillDef.healAmount,
                    healsToFull: skillDef.healsToFull || false,
                    type: skillDef.type,
                    description: skillDef.description || '',
                    isHeal: isHeal,
                    isBuff: skillDef.isBuff || false,
                    statusEffect: skillDef.statusEffect,
                    critBonus: skillDef.critBonus || 0,
                    consumesItem: skillDef.consumesItem || false,
                    requiresItem: skillDef.requiresItem,
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
        return Utils.pickRandom(candidates);
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
        devForceIntent: devForceIntent,
        devTriggerIntent: devTriggerIntent,
        devGetAvailableIntents: devGetAvailableIntents,
        setIntentsEnabled: function(enabled) {
            _intentsEnabled = enabled;
            // If disabling, clear any active intent
            if (!enabled && _hasBattleIntent) {
                BattleIntent.clear();
                if (_hasBattleUI && BattleUI.hideIntentIndicator) {
                    BattleUI.hideIntentIndicator('cancel');
                }
            }
            _log.debug('BattleEngine', 'Intents ' + (enabled ? 'enabled' : 'disabled'));
        },
        getIntentsEnabled: function() { return _intentsEnabled; },

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
