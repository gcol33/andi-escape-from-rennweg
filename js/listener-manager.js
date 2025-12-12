/**
 * Andi VN - Listener Manager Module
 * @module listener-manager
 *
 * Centralized event listener tracking and cleanup.
 * Prevents memory leaks from orphaned event listeners.
 *
 * Usage:
 *   // Add listener with automatic tracking
 *   ListenerManager.add(element, 'click', handler, 'battle');
 *   ListenerManager.add(document, 'keydown', handler, 'qte', { passive: true });
 *
 *   // Remove all listeners for a namespace
 *   ListenerManager.removeAll('battle');  // Clean up battle listeners
 *
 *   // Remove specific listener
 *   ListenerManager.remove(element, 'click', handler);
 *
 * Namespaces help organize listeners by module:
 *   'engine', 'battle', 'qte', 'quiz', 'password', 'overworld'
 */

(function() {
'use strict';

/**
 * @typedef {Object} ListenerEntry
 * @property {EventTarget} element - DOM element or event target
 * @property {string} type - Event type (click, keydown, etc.)
 * @property {Function} handler - Event handler function
 * @property {string} namespace - Module namespace
 * @property {Object} [options] - addEventListener options
 */

/** @type {ListenerEntry[]} */
var listeners = [];

/**
 * Add an event listener with tracking
 * @param {EventTarget} element - Element to attach listener to
 * @param {string} type - Event type
 * @param {Function} handler - Event handler
 * @param {string} [namespace='global'] - Namespace for grouping
 * @param {Object} [options] - addEventListener options
 * @returns {Function} - Removal function
 */
function add(element, type, handler, namespace, options) {
    if (!element || typeof handler !== 'function') {
        Logger.warn('ListenerManager', 'Invalid element or handler');
        return function() {};
    }

    namespace = namespace || 'global';
    options = options || false;

    // Add the listener
    element.addEventListener(type, handler, options);

    // Track it
    var entry = {
        element: element,
        type: type,
        handler: handler,
        namespace: namespace,
        options: options
    };
    listeners.push(entry);

    // Return removal function
    return function() {
        remove(element, type, handler);
    };
}

/**
 * Remove a specific event listener
 * @param {EventTarget} element - Element with listener
 * @param {string} type - Event type
 * @param {Function} handler - Event handler
 * @returns {boolean} - Whether listener was found and removed
 */
function remove(element, type, handler) {
    for (var i = listeners.length - 1; i >= 0; i--) {
        var entry = listeners[i];
        if (entry.element === element &&
            entry.type === type &&
            entry.handler === handler) {

            // Remove from DOM
            element.removeEventListener(type, handler, entry.options);

            // Remove from tracking
            listeners.splice(i, 1);
            return true;
        }
    }
    return false;
}

/**
 * Remove all listeners for a namespace
 * @param {string} namespace - Namespace to clean up
 * @returns {number} - Number of listeners removed
 */
function removeAll(namespace) {
    var count = 0;
    for (var i = listeners.length - 1; i >= 0; i--) {
        var entry = listeners[i];
        if (entry.namespace === namespace) {
            // Remove from DOM
            entry.element.removeEventListener(entry.type, entry.handler, entry.options);

            // Remove from tracking
            listeners.splice(i, 1);
            count++;
        }
    }

    Logger.debug('ListenerManager', 'Removed', count, 'listeners for namespace:', namespace);
    return count;
}

/**
 * Remove all tracked listeners
 * @returns {number} - Number of listeners removed
 */
function clear() {
    var count = listeners.length;

    for (var i = listeners.length - 1; i >= 0; i--) {
        var entry = listeners[i];
        entry.element.removeEventListener(entry.type, entry.handler, entry.options);
    }

    listeners = [];

    Logger.debug('ListenerManager', 'Cleared all', count, 'listeners');
    return count;
}

/**
 * Get count of listeners by namespace
 * @param {string} [namespace] - Optional namespace filter
 * @returns {number} - Listener count
 */
function count(namespace) {
    if (!namespace) {
        return listeners.length;
    }

    var c = 0;
    for (var i = 0; i < listeners.length; i++) {
        if (listeners[i].namespace === namespace) {
            c++;
        }
    }
    return c;
}

/**
 * Debug: Get all tracked listeners (dev mode only)
 * @returns {Array} - Copy of listeners array
 */
function getAll() {
    return listeners.slice();
}

/**
 * ListenerManager namespace object
 * @type {Object}
 */
var ListenerManager = {
    add: add,
    remove: remove,
    removeAll: removeAll,
    clear: clear,
    count: count,
    getAll: getAll
};

// Global export
window.ListenerManager = ListenerManager;

})();
