/**
 * Andi VN - State Store Module
 * @module core/store
 *
 * Centralized state management with immutable updates.
 * Single source of truth for all game state.
 *
 * Usage:
 *   // Get state
 *   var hp = store.get('battle.player.hp');
 *
 *   // Update state
 *   store.update('battle.player.hp', function(hp) { return hp - 5; });
 *
 *   // Subscribe to changes
 *   var unsubscribe = store.subscribe(function(state) { ... });
 *
 *   // Serialize for save
 *   var json = store.serialize();
 *
 *   // Load from save
 *   store.deserialize(json);
 */

(function() {
'use strict';

/**
 * Initial state structure
 * @type {Object}
 */
var initialState = {
    // Scene state
    scene: {
        currentId: null,
        blockIndex: 0,
        history: []
    },

    // Player persistent state
    player: {
        flags: new Set(),       // Regular flags (cleared on Play Again)
        keyFlags: new Set(),    // Key flags (persist across Play Again)
        inventory: {
            keyItems: [],
            consumables: {},
            skills: []          // Learned skills (persist across soft reset)
        },
        hp: null,
        maxHp: null,
        mana: null,
        maxMana: null
    },

    // Battle state (null when not in battle)
    battle: null,

    // QTE state (null when not active)
    qte: null,

    // Quiz state (null when not active)
    quiz: null,

    // Overworld state (null when not in overworld)
    overworld: null,

    // Settings (persisted separately)
    settings: {
        textSpeed: 'normal',
        muted: false,
        volume: 0.4,
        theme: 'prototype'
    },

    // Meta state (not saved to localStorage)
    meta: {
        devMode: false,
        readBlocks: new Set(),
        sceneHistory: []
    }
};

/**
 * JSON replacer for serializing Set and Map
 * @param {string} key
 * @param {*} value
 * @returns {*}
 */
function replacer(key, value) {
    if (value instanceof Set) {
        return { __type: 'Set', data: Array.from(value) };
    }
    if (value instanceof Map) {
        return { __type: 'Map', data: Array.from(value) };
    }
    return value;
}

/**
 * JSON reviver for deserializing Set and Map
 * @param {string} key
 * @param {*} value
 * @returns {*}
 */
function reviver(key, value) {
    if (value && value.__type === 'Set') {
        return new Set(value.data);
    }
    if (value && value.__type === 'Map') {
        return new Map(value.data);
    }
    return value;
}

/**
 * Deep clone an object (handling Set/Map)
 * @param {*} obj
 * @returns {*}
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj, replacer), reviver);
}

/**
 * Get a value at a nested path
 * @param {Object} obj - Object to read from
 * @param {string} path - Dot-separated path
 * @returns {*}
 */
function getPath(obj, path) {
    if (!path) return obj;
    var parts = path.split('.');
    var value = obj;
    for (var i = 0; i < parts.length; i++) {
        if (value === null || value === undefined) return undefined;
        value = value[parts[i]];
    }
    return value;
}

/**
 * Set a value at a nested path immutably
 * @param {Object} obj - Object to update
 * @param {string[]} keys - Path keys
 * @param {*} value - New value
 * @returns {Object} New object with updated value
 */
function setPath(obj, keys, value) {
    if (keys.length === 0) return value;
    var head = keys[0];
    var tail = keys.slice(1);
    var result = {};
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            result[key] = obj[key];
        }
    }
    result[head] = setPath(obj[head] !== undefined ? obj[head] : {}, tail, value);
    return result;
}

/**
 * StoreClass - centralized state management
 */
function StoreClass() {
    var state = deepClone(initialState);
    var subscribers = [];
    var debug = false;

    /**
     * Configure the store
     * @param {Object} config
     */
    this.configure = function(config) {
        if (config.debug !== undefined) {
            debug = config.debug;
        }
    };

    /**
     * Get the entire state
     * @returns {Object}
     */
    this.getState = function() {
        return state;
    };

    /**
     * Get a value at a nested path
     * @param {string} path - Dot-separated path (e.g., 'battle.player.hp')
     * @returns {*}
     */
    this.get = function(path) {
        return getPath(state, path);
    };

    /**
     * Update a value at a nested path
     * @param {string} path - Dot-separated path
     * @param {*|Function} updater - New value or updater function
     */
    this.update = function(path, updater) {
        var keys = path.split('.');
        var oldValue = this.get(path);
        var newValue = typeof updater === 'function' ? updater(oldValue) : updater;

        // Skip if value hasn't changed (for primitives)
        if (oldValue === newValue && typeof newValue !== 'object') {
            return;
        }

        // Immutable update
        state = setPath(state, keys, newValue);

        if (debug) {
            Logger.debug('Store', 'Updated:', path, oldValue, '->', newValue);
        }

        // Emit change event
        if (typeof eventBus !== 'undefined') {
            eventBus.emit(StateEvents.CHANGED, { path: path, oldValue: oldValue, newValue: newValue });
        }

        // Notify subscribers
        notifySubscribers();
    };

    /**
     * Batch multiple updates
     * @param {Function} updateFn - Function that receives store and makes updates
     */
    this.batch = function(updateFn) {
        var updates = [];
        var batchStore = {
            update: function(path, updater) {
                updates.push({ path: path, updater: updater });
            }
        };

        updateFn(batchStore);

        // Apply all updates
        var self = this;
        updates.forEach(function(item) {
            var keys = item.path.split('.');
            var oldValue = self.get(item.path);
            var newValue = typeof item.updater === 'function' ? item.updater(oldValue) : item.updater;
            state = setPath(state, keys, newValue);
        });

        // Single notification
        notifySubscribers();
    };

    /**
     * Subscribe to all state changes
     * @param {Function} callback - Called with new state
     * @returns {Function} Unsubscribe function
     */
    this.subscribe = function(callback) {
        subscribers.push(callback);
        return function() {
            var index = subscribers.indexOf(callback);
            if (index !== -1) {
                subscribers.splice(index, 1);
            }
        };
    };

    /**
     * Reset to initial state
     * @param {boolean} [keepSettings=true] - Preserve settings
     * @param {boolean} [keepMeta=true] - Preserve meta (readBlocks)
     */
    this.reset = function(keepSettings, keepMeta) {
        keepSettings = keepSettings !== false;
        keepMeta = keepMeta !== false;

        var settings = keepSettings ? state.settings : deepClone(initialState.settings);
        var meta = keepMeta ? state.meta : deepClone(initialState.meta);

        state = deepClone(initialState);
        state.settings = settings;
        state.meta = meta;

        if (typeof eventBus !== 'undefined') {
            eventBus.emit(StateEvents.RESET, state);
        }
        notifySubscribers();

        Logger.debug('Store', 'State reset');
    };

    /**
     * Serialize state for save (excludes meta)
     * @returns {string} JSON string
     */
    this.serialize = function() {
        var saveable = {};
        for (var key in state) {
            if (state.hasOwnProperty(key) && key !== 'meta') {
                saveable[key] = state[key];
            }
        }
        return JSON.stringify(saveable, replacer);
    };

    /**
     * Load state from serialized save
     * @param {string} json - JSON string from serialize()
     */
    this.deserialize = function(json) {
        try {
            var loaded = JSON.parse(json, reviver);
            var meta = state.meta; // Preserve meta
            state = loaded;
            state.meta = meta;

            if (typeof eventBus !== 'undefined') {
                eventBus.emit(StateEvents.LOADED, state);
            }
            notifySubscribers();

            Logger.debug('Store', 'State loaded');
        } catch (err) {
            Logger.error('Store', 'Failed to deserialize:', err);
        }
    };

    /**
     * Create a snapshot of current state
     * @returns {string}
     */
    this.snapshot = function() {
        return JSON.stringify(state, replacer);
    };

    /**
     * Restore from a snapshot
     * @param {string} snapshot
     */
    this.restore = function(snapshot) {
        try {
            state = JSON.parse(snapshot, reviver);
            notifySubscribers();
        } catch (err) {
            Logger.error('Store', 'Failed to restore snapshot:', err);
        }
    };

    /**
     * Notify all subscribers of state change
     */
    function notifySubscribers() {
        for (var i = 0; i < subscribers.length; i++) {
            try {
                subscribers[i](state);
            } catch (err) {
                Logger.error('Store', 'Error in subscriber:', err);
            }
        }
    }
}

// Singleton instance
var store = new StoreClass();

// Global export
window.store = store;

})();
