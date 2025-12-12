/**
 * Andi VN - Event Bus Module
 * @module core/event-bus
 *
 * Centralized pub/sub system for decoupled communication between modules.
 * Replaces direct function calls with event-driven architecture.
 *
 * Usage:
 *   // Subscribe
 *   var unsubscribe = eventBus.on('battle:start', function(data) { ... });
 *
 *   // Subscribe once
 *   eventBus.once('battle:end', function(data) { ... });
 *
 *   // Emit
 *   eventBus.emit('battle:start', { enemy: enemyData });
 *
 *   // Unsubscribe
 *   unsubscribe();
 */

(function() {
'use strict';

/**
 * EventBus class - centralized pub/sub
 */
function EventBusClass() {
    // Using closures for private state
    var listeners = {};
    var onceListeners = {};
    var debug = false;

    /**
     * Configure the event bus
     * @param {Object} config
     */
    this.configure = function(config) {
        if (config.debug !== undefined) {
            debug = config.debug;
        }
    };

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     * @returns {Function} Unsubscribe function
     */
    this.on = function(event, callback) {
        if (typeof callback !== 'function') {
            Logger.warn('EventBus', 'Callback must be a function for event:', event);
            return function() {};
        }

        if (!listeners[event]) {
            listeners[event] = [];
        }
        listeners[event].push(callback);

        if (debug) {
            Logger.debug('EventBus', 'Subscribed to:', event, '(total:', listeners[event].length, ')');
        }

        // Return unsubscribe function
        var self = this;
        return function() { self.off(event, callback); };
    };

    /**
     * Subscribe to an event once (auto-removes after first call)
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     * @returns {Function} Unsubscribe function
     */
    this.once = function(event, callback) {
        if (typeof callback !== 'function') {
            Logger.warn('EventBus', 'Callback must be a function for event:', event);
            return function() {};
        }

        if (!onceListeners[event]) {
            onceListeners[event] = [];
        }
        onceListeners[event].push(callback);

        return function() {
            if (onceListeners[event]) {
                var index = onceListeners[event].indexOf(callback);
                if (index !== -1) {
                    onceListeners[event].splice(index, 1);
                }
            }
        };
    };

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler to remove
     * @returns {boolean} Whether the listener was found and removed
     */
    this.off = function(event, callback) {
        if (!listeners[event]) return false;
        var index = listeners[event].indexOf(callback);
        if (index !== -1) {
            listeners[event].splice(index, 1);
            if (debug) {
                Logger.debug('EventBus', 'Unsubscribed from:', event);
            }
            return true;
        }
        return false;
    };

    /**
     * Emit an event to all subscribers
     * @param {string} event - Event name
     * @param {*} [data] - Data to pass to handlers
     */
    this.emit = function(event, data) {
        if (debug) {
            Logger.debug('EventBus', 'Emit:', event, data);
        }

        // Regular listeners
        if (listeners[event]) {
            var callbacks = listeners[event].slice();
            for (var i = 0; i < callbacks.length; i++) {
                try {
                    callbacks[i](data);
                } catch (err) {
                    Logger.error('EventBus', 'Error in handler for "' + event + '":', err);
                }
            }
        }

        // Once listeners
        if (onceListeners[event] && onceListeners[event].length > 0) {
            var onceCallbacks = onceListeners[event].slice();
            onceListeners[event] = [];
            for (var j = 0; j < onceCallbacks.length; j++) {
                try {
                    onceCallbacks[j](data);
                } catch (err) {
                    Logger.error('EventBus', 'Error in once handler for "' + event + '":', err);
                }
            }
        }
    };

    /**
     * Clear all listeners for an event (or all events)
     * @param {string} [event] - Event name (omit to clear all)
     */
    this.clear = function(event) {
        if (event) {
            delete listeners[event];
            delete onceListeners[event];
            if (debug) {
                Logger.debug('EventBus', 'Cleared listeners for:', event);
            }
        } else {
            listeners = {};
            onceListeners = {};
            if (debug) {
                Logger.debug('EventBus', 'Cleared all listeners');
            }
        }
    };

    /**
     * Get count of listeners for an event
     * @param {string} event - Event name
     * @returns {number} Number of listeners
     */
    this.listenerCount = function(event) {
        var count = 0;
        if (listeners[event]) count += listeners[event].length;
        if (onceListeners[event]) count += onceListeners[event].length;
        return count;
    };

    /**
     * Get list of all registered event names
     * @returns {string[]} Event names
     */
    this.eventNames = function() {
        var names = {};
        var key;
        for (key in listeners) {
            if (listeners.hasOwnProperty(key)) {
                names[key] = true;
            }
        }
        for (key in onceListeners) {
            if (onceListeners.hasOwnProperty(key)) {
                names[key] = true;
            }
        }
        return Object.keys(names);
    };
}

// Singleton instance
var eventBus = new EventBusClass();

// Global export
window.eventBus = eventBus;

})();
