/**
 * Andi VN - Base Manager
 * @module managers/base-manager
 *
 * Abstract base class for all managers.
 * Provides common functionality and enforces interface.
 *
 * Usage:
 *   function MyManager() {
 *     BaseManager.call(this);
 *     this.name = 'MyManager';
 *   }
 *   MyManager.prototype = Object.create(BaseManager.prototype);
 *   MyManager.prototype.constructor = MyManager;
 */

(function() {
'use strict';

/**
 * Base manager constructor
 */
function BaseManager() {
    this.name = 'BaseManager';
    this._unsubscribers = [];
}

/**
 * Initialize the manager
 * Override in subclasses
 */
BaseManager.prototype.init = function() {
    Logger.debug(this.name, 'Initialized');
};

/**
 * Clean up the manager
 * Automatically unsubscribes from all events
 */
BaseManager.prototype.destroy = function() {
    for (var i = 0; i < this._unsubscribers.length; i++) {
        this._unsubscribers[i]();
    }
    this._unsubscribers = [];
    Logger.debug(this.name, 'Destroyed');
};

/**
 * Subscribe to an event with automatic cleanup
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @returns {Function} Unsubscribe function
 */
BaseManager.prototype.on = function(event, handler) {
    var unsub = eventBus.on(event, handler);
    this._unsubscribers.push(unsub);
    return unsub;
};

/**
 * Emit an event
 * @param {string} event - Event name
 * @param {*} data - Event data
 */
BaseManager.prototype.emit = function(event, data) {
    eventBus.emit(event, data);
};

/**
 * Get state value
 * @param {string} path - State path
 * @returns {*}
 */
BaseManager.prototype.getState = function(path) {
    return store.get(path);
};

/**
 * Update state value
 * @param {string} path - State path
 * @param {*|Function} updater - New value or updater function
 */
BaseManager.prototype.setState = function(path, updater) {
    store.update(path, updater);
};

/**
 * Log debug message
 */
BaseManager.prototype.debug = function() {
    var args = [this.name];
    for (var i = 0; i < arguments.length; i++) {
        args.push(arguments[i]);
    }
    Logger.debug.apply(Logger, args);
};

/**
 * Log info message
 */
BaseManager.prototype.info = function() {
    var args = [this.name];
    for (var i = 0; i < arguments.length; i++) {
        args.push(arguments[i]);
    }
    Logger.info.apply(Logger, args);
};

/**
 * Log warning message
 */
BaseManager.prototype.warn = function() {
    var args = [this.name];
    for (var i = 0; i < arguments.length; i++) {
        args.push(arguments[i]);
    }
    Logger.warn.apply(Logger, args);
};

/**
 * Log error message
 */
BaseManager.prototype.error = function() {
    var args = [this.name];
    for (var i = 0; i < arguments.length; i++) {
        args.push(arguments[i]);
    }
    Logger.error.apply(Logger, args);
};

// Global export
window.BaseManager = BaseManager;

})();
