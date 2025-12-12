/**
 * Andi VN - Core Bootstrap
 * @module core/bootstrap
 *
 * Initializes the new core architecture (store, eventBus, managers).
 * This runs after all core modules are loaded but before engine.js.
 *
 * The bootstrap:
 * 1. Ensures store is initialized with proper state
 * 2. Provides bridge functions for gradual migration
 * 3. Sets up event listeners for debugging
 */

(function() {
'use strict';

var _log = typeof Logger !== 'undefined' ? Logger : console;

/**
 * Initialize the core architecture
 * Called automatically when this script loads
 */
function initCore() {
    _log.debug('Bootstrap', 'Initializing core architecture...');

    // Verify core modules are loaded
    if (typeof store === 'undefined') {
        _log.error('Bootstrap', 'Store not loaded! Check script order in index.html');
        return;
    }
    if (typeof eventBus === 'undefined') {
        _log.error('Bootstrap', 'EventBus not loaded! Check script order in index.html');
        return;
    }

    // Enable debug mode for eventBus in dev mode
    if (typeof TUNING !== 'undefined' && TUNING.debug) {
        eventBus.setDebug(true);
    }

    // Log initial state
    _log.debug('Bootstrap', 'Store initialized with state:', Object.keys(store.getState()));
    _log.debug('Bootstrap', 'EventBus ready');

    // Initialize managers if they exist
    initManagers();

    _log.debug('Bootstrap', 'Core architecture initialized');
}

/**
 * Initialize manager singletons
 * Managers are optional - only init if they exist
 */
function initManagers() {
    // Note: These are the NEW managers in js/managers/
    // The OLD managers (engine-audio.js, etc.) are initialized by engine.js

    // For now, we don't auto-init the new managers since:
    // 1. They rely on the store having correct state
    // 2. engine.js still manages the actual game state
    // 3. We need to migrate engine.js first

    // When ready to use new managers, uncomment:
    // if (typeof audioManager !== 'undefined') audioManager.init();
    // if (typeof flagManager !== 'undefined') flagManager.init();
    // if (typeof inventoryManager !== 'undefined') inventoryManager.init();
    // if (typeof saveManager !== 'undefined') saveManager.init();
    // if (typeof inputController !== 'undefined') inputController.init();

    _log.debug('Bootstrap', 'Managers available but not auto-initialized (waiting for engine.js migration)');
}

/**
 * Bridge: Sync engine.js state to store
 * Call this when engine.js state changes to keep store in sync
 * @param {Object} engineState - The VNEngine.state object
 */
function syncEngineToStore(engineState) {
    if (!engineState) return;

    // Sync scene state
    if (engineState.currentSceneId !== undefined) {
        store.update('scene.currentId', engineState.currentSceneId);
    }
    if (engineState.currentBlockIndex !== undefined) {
        store.update('scene.blockIndex', engineState.currentBlockIndex);
    }

    // Sync player state
    if (engineState.flags) {
        store.update('player.flags', function() {
            return new Set(Object.keys(engineState.flags).filter(function(k) {
                return engineState.flags[k] === true;
            }));
        });
    }

    // Sync inventory
    if (engineState.inventory) {
        store.update('player.inventory', function() {
            return {
                keyItems: engineState.inventory.keyItems || [],
                consumables: engineState.inventory.consumables || {}
            };
        });
    }

    // Sync HP/Mana
    if (engineState.playerHP !== undefined) {
        store.update('player.hp', engineState.playerHP);
    }
    if (engineState.playerMaxHP !== undefined) {
        store.update('player.maxHp', engineState.playerMaxHP);
    }
    if (engineState.playerMana !== undefined) {
        store.update('player.mana', engineState.playerMana);
    }
    if (engineState.playerMaxMana !== undefined) {
        store.update('player.maxMana', engineState.playerMaxMana);
    }

    // Sync settings
    if (engineState.audio) {
        store.update('settings', function(settings) {
            return {
                textSpeed: settings.textSpeed,
                muted: engineState.audio.muted,
                volume: engineState.audio.volume,
                theme: settings.theme
            };
        });
    }

    // Sync meta
    if (engineState.devMode !== undefined) {
        store.update('meta.devMode', engineState.devMode);
    }
}

/**
 * Bridge: Get state from store in engine.js format
 * @returns {Object} State in VNEngine format
 */
function getEngineStateFromStore() {
    var state = store.getState();
    var flags = {};

    // Convert Set to object
    if (state.player.flags) {
        state.player.flags.forEach(function(flag) {
            flags[flag] = true;
        });
    }

    return {
        currentSceneId: state.scene.currentId,
        currentBlockIndex: state.scene.blockIndex,
        flags: flags,
        inventory: {
            keyItems: state.player.inventory.keyItems,
            consumables: state.player.inventory.consumables
        },
        playerHP: state.player.hp,
        playerMaxHP: state.player.maxHp,
        playerMana: state.player.mana,
        playerMaxMana: state.player.maxMana,
        audio: {
            muted: state.settings.muted,
            volume: state.settings.volume
        },
        devMode: state.meta.devMode
    };
}

// Export bridge functions
window.CoreBridge = {
    syncEngineToStore: syncEngineToStore,
    getEngineStateFromStore: getEngineStateFromStore,
    initCore: initCore
};

// Auto-initialize when script loads
initCore();

})();
