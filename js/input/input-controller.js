/**
 * Andi VN - Input Controller
 * @module input/input-controller
 *
 * Centralized input handling for keyboard, mouse, and touch.
 * Emits input events to event bus for decoupled handling.
 *
 * Usage:
 *   inputController.init();
 *   inputController.enable();
 *   inputController.disable();
 */

(function() {
'use strict';

/**
 * InputController constructor
 */
function InputControllerClass() {
    // Private state via closure
    var enabled = true;
    var initialized = false;
    var heldKeys = {};
    var devModeTimer = null;
    var self = this;

    /**
     * Check for dev mode key combination (q+w+e+r+t)
     */
    function checkDevMode() {
        var devKeys = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT'];
        var allHeld = true;
        for (var i = 0; i < devKeys.length; i++) {
            if (!heldKeys[devKeys[i]]) {
                allHeld = false;
                break;
            }
        }

        if (allHeld) {
            // Clear any existing timer
            if (devModeTimer) {
                clearTimeout(devModeTimer);
            }

            // Require holding for a moment to prevent accidental triggers
            devModeTimer = setTimeout(function() {
                var currentDevMode = store.get('meta.devMode');
                store.update('meta.devMode', !currentDevMode);
                Logger.info('InputController', 'Dev mode:', !currentDevMode);

                // Emit event for UI to react
                eventBus.emit('ui:devmode:toggle', { enabled: !currentDevMode });
            }, 100);
        }
    }

    /**
     * Handle battle keyboard shortcuts
     * @param {KeyboardEvent} e
     */
    function handleBattleKey(e) {
        var keyMap = {
            'Digit1': 'attack',
            'KeyA': 'attack',
            'Digit2': 'skill',
            'KeyS': 'skill',
            'Digit3': 'defend',
            'KeyD': 'defend',
            'Digit4': 'item',
            'KeyI': 'item',
            'Digit5': 'flee',
            'KeyF': 'flee'
        };

        var action = keyMap[e.code];
        if (action) {
            e.preventDefault();
            eventBus.emit(InputEvents.BATTLE_ACTION, { action: action });
        }
    }

    /**
     * Handle keydown events
     * @param {KeyboardEvent} e
     */
    function onKeyDown(e) {
        // Track held keys for dev mode
        heldKeys[e.code] = true;
        checkDevMode();

        if (!enabled) return;

        var state = store.getState();

        // QTE takes priority
        if (state.qte && state.qte.active) {
            if (e.code === 'Space') {
                e.preventDefault();
                eventBus.emit(InputEvents.QTE_CONFIRM);
            }
            return;
        }

        // Quiz takes priority
        if (state.quiz && state.quiz.active) {
            // Quiz uses click/touch for answers
            return;
        }

        // Battle shortcuts
        if (state.battle && state.battle.phase === 'player') {
            handleBattleKey(e);
            return;
        }

        // Scene navigation
        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            eventBus.emit(InputEvents.ADVANCE);
        }

        // Skip text with Escape
        if (e.code === 'Escape') {
            eventBus.emit(InputEvents.SKIP_TYPEWRITER);
        }
    }

    /**
     * Handle keyup events
     * @param {KeyboardEvent} e
     */
    function onKeyUp(e) {
        delete heldKeys[e.code];
    }

    /**
     * Handle click events
     * @param {MouseEvent} e
     */
    function onClick(e) {
        if (!enabled) return;

        var target = e.target;

        // Choice buttons
        if (target.matches && target.matches('.choice-button')) {
            var index = parseInt(target.dataset.index, 10);
            if (!isNaN(index)) {
                eventBus.emit(InputEvents.CHOICE, { index: index });
            }
            return;
        }

        // Continue button
        if (target.matches && (target.matches('#continue-btn') || target.matches('.continue-button'))) {
            eventBus.emit(InputEvents.ADVANCE);
            return;
        }

        // Restart button
        if (target.matches && target.matches('.restart-button')) {
            eventBus.emit(InputEvents.ADVANCE); // Handled same as continue for restart
            return;
        }

        // Battle action buttons
        if (target.matches && target.matches('.battle-action-button')) {
            var action = target.dataset.action;
            if (action) {
                eventBus.emit(InputEvents.BATTLE_ACTION, { action: action });
            }
            return;
        }

        // Skill buttons
        if (target.matches && target.matches('.skill-button')) {
            var skillId = target.dataset.skillId;
            if (skillId) {
                eventBus.emit(InputEvents.BATTLE_ACTION, { action: 'skill', skillId: skillId });
            }
            return;
        }

        // Text box click (skip typewriter)
        if (target.closest && target.closest('#text-box') && !target.closest('button')) {
            eventBus.emit(InputEvents.SKIP_TYPEWRITER);
        }
    }

    /**
     * Handle touch events
     * @param {TouchEvent} e
     */
    function onTouchStart(e) {
        // Touch is handled similarly to click via event propagation
        // The click event will fire after touchstart
    }

    /**
     * Initialize input listeners
     */
    this.init = function() {
        if (initialized) return;

        // Keyboard
        ListenerManager.add(document, 'keydown', onKeyDown, 'input');
        ListenerManager.add(document, 'keyup', onKeyUp, 'input');

        // Mouse
        ListenerManager.add(document, 'click', onClick, 'input');

        // Touch
        ListenerManager.add(document, 'touchstart', onTouchStart, 'input', { passive: true });

        initialized = true;
        Logger.debug('InputController', 'Initialized');
    };

    /**
     * Enable input handling
     */
    this.enable = function() {
        enabled = true;
        Logger.debug('InputController', 'Enabled');
    };

    /**
     * Disable input handling
     */
    this.disable = function() {
        enabled = false;
        Logger.debug('InputController', 'Disabled');
    };

    /**
     * Check if input is enabled
     * @returns {boolean}
     */
    this.isEnabled = function() {
        return enabled;
    };

    /**
     * Destroy and clean up
     */
    this.destroy = function() {
        ListenerManager.removeAll('input');
        initialized = false;
        Logger.debug('InputController', 'Destroyed');
    };
}

// Singleton instance
var inputController = new InputControllerClass();

// Global export
window.inputController = inputController;

})();
