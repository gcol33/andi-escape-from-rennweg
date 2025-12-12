/**
 * Andi VN - Timer Manager Module
 * @module timer-manager
 *
 * Centralized timeout/interval tracking and cleanup.
 * Prevents memory leaks from orphaned timers.
 * Parallel to ListenerManager for event listeners.
 *
 * Usage:
 *   // Add timeout with automatic tracking
 *   TimerManager.setTimeout(callback, 1000, 'battle');
 *
 *   // Add interval with automatic tracking
 *   TimerManager.setInterval(callback, 500, 'qte');
 *
 *   // Remove all timers for a namespace
 *   TimerManager.clearAll('battle');  // Clean up battle timers
 *
 *   // Clear specific timer
 *   var id = TimerManager.setTimeout(callback, 1000, 'engine');
 *   TimerManager.clear(id);
 *
 * Namespaces help organize timers by module:
 *   'engine', 'battle', 'qte', 'quiz', 'password', 'overworld', 'wake'
 */

(function() {
'use strict';

/**
 * @typedef {Object} TimerEntry
 * @property {number} id - Internal timer ID
 * @property {number} nativeId - Native setTimeout/setInterval ID
 * @property {string} type - 'timeout' or 'interval'
 * @property {Function} callback - Timer callback function
 * @property {number} delay - Delay/interval in ms
 * @property {string} namespace - Module namespace
 * @property {number} createdAt - Timestamp when timer was created
 */

/** @type {Object.<number, TimerEntry>} */
var timers = {};

/** @type {number} */
var nextId = 1;

/**
 * Create a tracked setTimeout
 * @param {Function} callback - Function to call
 * @param {number} delay - Delay in milliseconds
 * @param {string} [namespace='global'] - Namespace for grouping
 * @returns {number} - Timer ID for clearing
 */
function setTimeout_(callback, delay, namespace) {
    if (typeof callback !== 'function') {
        Logger.warn('TimerManager', 'Invalid callback');
        return 0;
    }

    namespace = namespace || 'global';
    var id = nextId++;

    var nativeId = setTimeout(function() {
        // Remove from tracking when executed
        delete timers[id];
        // Execute callback
        callback();
    }, delay);

    timers[id] = {
        id: id,
        nativeId: nativeId,
        type: 'timeout',
        callback: callback,
        delay: delay,
        namespace: namespace,
        createdAt: Date.now()
    };

    return id;
}

/**
 * Create a tracked setInterval
 * @param {Function} callback - Function to call
 * @param {number} interval - Interval in milliseconds
 * @param {string} [namespace='global'] - Namespace for grouping
 * @returns {number} - Timer ID for clearing
 */
function setInterval_(callback, interval, namespace) {
    if (typeof callback !== 'function') {
        Logger.warn('TimerManager', 'Invalid callback');
        return 0;
    }

    namespace = namespace || 'global';
    var id = nextId++;

    var nativeId = setInterval(callback, interval);

    timers[id] = {
        id: id,
        nativeId: nativeId,
        type: 'interval',
        callback: callback,
        delay: interval,
        namespace: namespace,
        createdAt: Date.now()
    };

    return id;
}

/**
 * Clear a specific timer
 * @param {number} id - Timer ID returned from setTimeout_/setInterval_
 * @returns {boolean} - Whether timer was found and cleared
 */
function clear(id) {
    var entry = timers[id];
    if (!entry) {
        return false;
    }

    if (entry.type === 'timeout') {
        clearTimeout(entry.nativeId);
    } else {
        clearInterval(entry.nativeId);
    }

    delete timers[id];
    return true;
}

/**
 * Clear all timers for a namespace
 * @param {string} namespace - Namespace to clean up
 * @returns {number} - Number of timers cleared
 */
function clearAll(namespace) {
    var count = 0;
    var keys = Object.keys(timers);

    for (var i = 0; i < keys.length; i++) {
        var entry = timers[keys[i]];
        if (entry.namespace === namespace) {
            if (entry.type === 'timeout') {
                clearTimeout(entry.nativeId);
            } else {
                clearInterval(entry.nativeId);
            }
            delete timers[keys[i]];
            count++;
        }
    }

    Logger.debug('TimerManager', 'Cleared', count, 'timers for namespace:', namespace);
    return count;
}

/**
 * Clear ALL tracked timers
 * @returns {number} - Number of timers cleared
 */
function clearEverything() {
    var count = 0;
    var keys = Object.keys(timers);

    for (var i = 0; i < keys.length; i++) {
        var entry = timers[keys[i]];
        if (entry.type === 'timeout') {
            clearTimeout(entry.nativeId);
        } else {
            clearInterval(entry.nativeId);
        }
        count++;
    }

    timers = {};
    Logger.debug('TimerManager', 'Cleared all', count, 'timers');
    return count;
}

/**
 * Get count of timers by namespace
 * @param {string} [namespace] - Optional namespace filter
 * @returns {number} - Timer count
 */
function count(namespace) {
    if (!namespace) {
        return Object.keys(timers).length;
    }

    var c = 0;
    var keys = Object.keys(timers);
    for (var i = 0; i < keys.length; i++) {
        if (timers[keys[i]].namespace === namespace) {
            c++;
        }
    }
    return c;
}

/**
 * Check if a timer exists
 * @param {number} id - Timer ID
 * @returns {boolean}
 */
function exists(id) {
    return !!timers[id];
}

/**
 * Debug: Get all tracked timers (dev mode only)
 * @returns {Array} - Array of timer entries
 */
function getAll() {
    var result = [];
    var keys = Object.keys(timers);
    for (var i = 0; i < keys.length; i++) {
        result.push(timers[keys[i]]);
    }
    return result;
}

/**
 * TimerManager namespace object
 * @type {Object}
 */
var TimerManager = {
    setTimeout: setTimeout_,
    setInterval: setInterval_,
    clear: clear,
    clearAll: clearAll,
    clearEverything: clearEverything,
    count: count,
    exists: exists,
    getAll: getAll
};

// Global export
window.TimerManager = TimerManager;

})();
