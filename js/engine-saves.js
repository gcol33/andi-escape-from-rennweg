/**
 * Andi VN - Save Manager Module
 *
 * Centralized save/load state management for localStorage persistence.
 * Handles state validation, history tracking for undo, and save key management.
 *
 * Usage:
 *   SaveManager.init({ saveKey: 'andi_vn_save' });
 *   SaveManager.save(gameState);
 *   var state = SaveManager.load();
 *   SaveManager.pushHistory(sceneId);
 */

var SaveManager = (function() {
    'use strict';

    // === Configuration ===
    var config = {
        saveKey: 'andi_vn_save',
        themeKey: 'andi_vn_theme',
        kenBurnsKey: 'andi_vn_ken_burns'
    };

    // === History Stack ===
    var history = [];

    // === Logging ===
    var _log = typeof Logger !== 'undefined' ? Logger : {
        debug: function() {},
        info: function(m) { var a = Array.prototype.slice.call(arguments, 1); console.log.apply(console, ['[' + m + ']'].concat(a)); },
        warn: function(m) { var a = Array.prototype.slice.call(arguments, 1); console.warn.apply(console, ['[' + m + ']'].concat(a)); },
        error: function(m) { var a = Array.prototype.slice.call(arguments, 1); console.error.apply(console, ['[' + m + ']'].concat(a)); }
    };

    /**
     * Initialize the save manager
     * @param {Object} [cfg] - Configuration
     * @param {string} [cfg.saveKey] - localStorage key for saves
     * @param {string} [cfg.themeKey] - localStorage key for theme
     * @param {string} [cfg.kenBurnsKey] - localStorage key for Ken Burns setting
     */
    function init(cfg) {
        if (cfg) {
            if (cfg.saveKey) config.saveKey = cfg.saveKey;
            if (cfg.themeKey) config.themeKey = cfg.themeKey;
            if (cfg.kenBurnsKey) config.kenBurnsKey = cfg.kenBurnsKey;
        }
        _log.debug('SaveManager', 'Initialized with saveKey:', config.saveKey);
    }

    /**
     * Validate save data structure to prevent crashes from corrupted saves
     * @param {Object} saveData - The parsed save data to validate
     * @returns {boolean} - True if valid, false otherwise
     */
    function isValid(saveData) {
        if (!saveData || typeof saveData !== 'object') {
            return false;
        }

        // currentSceneId must be a string or null
        if (saveData.currentSceneId !== null &&
            typeof saveData.currentSceneId !== 'string') {
            return false;
        }

        // currentBlockIndex must be a non-negative integer
        if (typeof saveData.currentBlockIndex !== 'undefined') {
            if (typeof saveData.currentBlockIndex !== 'number' ||
                saveData.currentBlockIndex < 0 ||
                !Number.isInteger(saveData.currentBlockIndex)) {
                return false;
            }
        }

        // flags must be an object (or undefined)
        if (saveData.flags !== undefined &&
            (typeof saveData.flags !== 'object' || Array.isArray(saveData.flags))) {
            return false;
        }

        // readBlocks must be an object (or undefined)
        if (saveData.readBlocks !== undefined &&
            (typeof saveData.readBlocks !== 'object' || Array.isArray(saveData.readBlocks))) {
            return false;
        }

        // history must be an array (or undefined)
        if (saveData.history !== undefined && !Array.isArray(saveData.history)) {
            return false;
        }

        return true;
    }

    /**
     * Save game state to localStorage
     * @param {Object} state - Game state to save
     */
    function save(state) {
        try {
            var saveData = {
                currentSceneId: state.currentSceneId,
                currentBlockIndex: state.currentBlockIndex,
                flags: state.flags,
                keyFlags: state.keyFlags,
                inventory: state.inventory,
                playerHP: state.playerHP,
                playerMaxHP: state.playerMaxHP,
                readBlocks: state.readBlocks,
                wonBattles: state.wonBattles,
                history: history
            };
            _log.debug('SaveManager', 'Saving state, history length:', history.length);
            localStorage.setItem(config.saveKey, JSON.stringify(saveData));
        } catch (e) {
            _log.warn('SaveManager', 'Could not save state:', e.message);
        }
    }

    /**
     * Load game state from localStorage
     * @returns {Object|null} - Loaded state or null if not found/invalid
     */
    function load() {
        try {
            var saved = localStorage.getItem(config.saveKey);
            if (!saved) return null;

            var saveData = JSON.parse(saved);

            // Validate save data structure
            if (!isValid(saveData)) {
                _log.warn('SaveManager', 'Invalid save data structure, clearing corrupted save');
                clear();
                return null;
            }

            // Restore history
            history = saveData.history || [];
            _log.debug('SaveManager', 'Loaded state, history length:', history.length);

            return saveData;
        } catch (e) {
            _log.warn('SaveManager', 'Could not load saved state:', e.message);
            return null;
        }
    }

    /**
     * Clear saved state from localStorage
     */
    function clear() {
        try {
            localStorage.removeItem(config.saveKey);
            history = [];
            _log.debug('SaveManager', 'Cleared saved state');
        } catch (e) {
            _log.warn('SaveManager', 'Could not clear saved state:', e.message);
        }
    }

    // =========================================================================
    // HISTORY MANAGEMENT (for undo)
    // =========================================================================

    /**
     * Push a scene to history
     * @param {string} sceneId - Scene ID to add
     */
    function pushHistory(sceneId) {
        history.push(sceneId);
        _log.debug('SaveManager', 'Pushed to history:', sceneId, 'length:', history.length);
    }

    /**
     * Pop the last scene from history
     * @returns {string|undefined} - Popped scene ID or undefined if empty
     */
    function popHistory() {
        var popped = history.pop();
        _log.debug('SaveManager', 'Popped from history:', popped, 'remaining:', history.length);
        return popped;
    }

    /**
     * Get history array (copy)
     * @returns {string[]}
     */
    function getHistory() {
        return history.slice();
    }

    /**
     * Set history array
     * @param {string[]} newHistory
     */
    function setHistory(newHistory) {
        history = newHistory.slice();
    }

    /**
     * Clear history
     */
    function clearHistory() {
        history = [];
    }

    /**
     * Get history length
     * @returns {number}
     */
    function getHistoryLength() {
        return history.length;
    }

    // =========================================================================
    // THEME/SETTINGS PERSISTENCE
    // =========================================================================

    /**
     * Save theme preference
     * @param {string} themeName
     */
    function saveTheme(themeName) {
        try {
            localStorage.setItem(config.themeKey, themeName);
        } catch (e) {
            _log.warn('SaveManager', 'Could not save theme:', e.message);
        }
    }

    /**
     * Load theme preference
     * @returns {string|null}
     */
    function loadTheme() {
        try {
            return localStorage.getItem(config.themeKey);
        } catch (e) {
            return null;
        }
    }

    /**
     * Save Ken Burns preference
     * @param {boolean} enabled
     */
    function saveKenBurns(enabled) {
        try {
            localStorage.setItem(config.kenBurnsKey, enabled ? 'true' : 'false');
        } catch (e) {
            _log.warn('SaveManager', 'Could not save Ken Burns setting:', e.message);
        }
    }

    /**
     * Load Ken Burns preference
     * @returns {boolean}
     */
    function loadKenBurns() {
        try {
            return localStorage.getItem(config.kenBurnsKey) === 'true';
        } catch (e) {
            return false;
        }
    }

    // === Public API ===
    return {
        init: init,
        isValid: isValid,
        save: save,
        load: load,
        clear: clear,
        // History
        pushHistory: pushHistory,
        popHistory: popHistory,
        getHistory: getHistory,
        setHistory: setHistory,
        clearHistory: clearHistory,
        getHistoryLength: getHistoryLength,
        // Settings
        saveTheme: saveTheme,
        loadTheme: loadTheme,
        saveKenBurns: saveKenBurns,
        loadKenBurns: loadKenBurns
    };
})();
