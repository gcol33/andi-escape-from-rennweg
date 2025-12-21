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
 * Internal log helper - prepends manager name to arguments
 * @private
 */
BaseManager.prototype._log = function(level, args) {
    var logArgs = [this.name];
    for (var i = 0; i < args.length; i++) {
        logArgs.push(args[i]);
    }
    Logger[level].apply(Logger, logArgs);
};

/** Log debug message */
BaseManager.prototype.debug = function() { this._log('debug', arguments); };

/** Log info message */
BaseManager.prototype.info = function() { this._log('info', arguments); };

/** Log warning message */
BaseManager.prototype.warn = function() { this._log('warn', arguments); };

/** Log error message */
BaseManager.prototype.error = function() { this._log('error', arguments); };

// Global export
window.BaseManager = BaseManager;

})();
