/**
 * Andi VN - Event Emitter Module
 * @module events
 *
 * Simple pub/sub system for loose coupling between modules.
 * Allows modules to communicate without direct dependencies.
 *
 * Usage:
 *   EventEmitter.on('battle:start', function(data) { ... });
 *   EventEmitter.emit('battle:start', { enemy: enemyData });
 *   EventEmitter.once('battle:end', function(data) { ... });
 *   EventEmitter.off('battle:start', myCallback);
 *
 * Standard Events:
 *   Battle: battle:start, battle:end, battle:turn-start, battle:turn-end
 *   Player: player:action, player:damaged, player:healed, player:status
 *   Enemy:  enemy:action, enemy:damaged, enemy:defeated
 *   QTE:    qte:start, qte:complete
 *   Scene:  scene:load, scene:transition, asset:load-error
 */

(function() {
'use strict';

/** @type {Object.<string, Function[]>} */
var listeners = {};

/** @type {Object.<string, Function[]>} */
var onceListeners = {};

/**
 * Subscribe to an event
 * @param {string} event - Event name
 * @param {Function} callback - Handler function
 * @returns {Function} Unsubscribe function
 */
function on(event, callback) {
    if (typeof callback !== 'function') {
        console.warn('EventEmitter: callback must be a function');
        return function() {};
    }
    if (!listeners[event]) {
        listeners[event] = [];
    }
    listeners[event].push(callback);
    return function() { off(event, callback); };
}

/**
 * Subscribe to an event once (auto-removes after first call)
 * @param {string} event - Event name
 * @param {Function} callback - Handler function
 * @returns {Function} Unsubscribe function
 */
function once(event, callback) {
    if (typeof callback !== 'function') {
        console.warn('EventEmitter: callback must be a function');
        return function() {};
    }
    if (!onceListeners[event]) {
        onceListeners[event] = [];
    }
    onceListeners[event].push(callback);
    return function() { offOnce(event, callback); };
}

/**
 * Unsubscribe from an event
 * @param {string} event - Event name
 * @param {Function} callback - Handler to remove
 * @returns {boolean} Whether the listener was found and removed
 */
function off(event, callback) {
    if (!listeners[event]) return false;
    var index = listeners[event].indexOf(callback);
    if (index !== -1) {
        listeners[event].splice(index, 1);
        return true;
    }
    return false;
}

/**
 * Unsubscribe a once listener
 * @param {string} event - Event name
 * @param {Function} callback - Handler to remove
 * @returns {boolean} Whether the listener was found and removed
 */
function offOnce(event, callback) {
    if (!onceListeners[event]) return false;
    var index = onceListeners[event].indexOf(callback);
    if (index !== -1) {
        onceListeners[event].splice(index, 1);
        return true;
    }
    return false;
}

/**
 * Emit an event to all subscribers
 * @param {string} event - Event name
 * @param {*} [data] - Data to pass to handlers
 */
function emit(event, data) {
    if (listeners[event]) {
        var callbacks = listeners[event].slice();
        for (var i = 0; i < callbacks.length; i++) {
            try {
                callbacks[i](data);
            } catch (err) {
                console.error('EventEmitter: Error in "' + event + '":', err);
            }
        }
    }
    if (onceListeners[event]) {
        var onceCallbacks = onceListeners[event].slice();
        onceListeners[event] = [];
        for (var j = 0; j < onceCallbacks.length; j++) {
            try {
                onceCallbacks[j](data);
            } catch (err) {
                console.error('EventEmitter: Error in once "' + event + '":', err);
            }
        }
    }
}

/**
 * Clear listeners for an event (or all events)
 * @param {string} [event] - Event name (omit to clear all)
 */
function clear(event) {
    if (event) {
        delete listeners[event];
        delete onceListeners[event];
    } else {
        listeners = {};
        onceListeners = {};
    }
}

/**
 * Get count of listeners for an event
 * @param {string} event - Event name
 * @returns {number} Number of listeners
 */
function listenerCount(event) {
    var count = 0;
    if (listeners[event]) count += listeners[event].length;
    if (onceListeners[event]) count += onceListeners[event].length;
    return count;
}

/**
 * EventEmitter namespace object
 * @type {Object}
 */
var EventEmitter = {
    on: on,
    once: once,
    off: off,
    emit: emit,
    clear: clear,
    listenerCount: listenerCount
};

// Global export
window.EventEmitter = EventEmitter;

})();
