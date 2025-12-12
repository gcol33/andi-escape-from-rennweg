/**
 * Andi VN - Logger Module
 * @module logger
 *
 * Centralized logging utility for consistent debug output.
 * All logs are prefixed with module name for easy filtering.
 * Debug logs are hidden in production (when devMode is false).
 *
 * Usage:
 *   Logger.debug('BattleEngine', 'Starting turn', { turn: 5 });
 *   Logger.info('Engine', 'Scene loaded:', sceneId);
 *   Logger.warn('QTE', 'Missing callback');
 *   Logger.error('Audio', 'Failed to load:', filename);
 *
 * Filtering in browser console:
 *   - Filter by "[BattleEngine]" to see only battle logs
 *   - Filter by "[Engine]" to see only engine logs
 */

(function() {
'use strict';

/**
 * Check if dev mode is enabled
 * @returns {boolean}
 */
function isDevMode() {
    // Check VNEngine state first, then fall back to window flag
    if (typeof VNEngine !== 'undefined' && VNEngine.state) {
        return VNEngine.state.devMode === true;
    }
    return window.__DEV_MODE__ === true;
}

/**
 * Format log prefix with module name
 * @param {string} module - Module name
 * @returns {string}
 */
function formatPrefix(module) {
    return '[' + module + ']';
}

/**
 * Debug log - only shown in dev mode
 * Use for detailed debugging info that's too noisy for production.
 * @param {string} module - Module name (e.g., 'BattleEngine', 'QTE')
 * @param {...*} args - Values to log
 */
function debug(module) {
    if (!isDevMode()) return;
    var args = Array.prototype.slice.call(arguments, 1);
    console.log.apply(console, [formatPrefix(module)].concat(args));
}

/**
 * Info log - always shown
 * Use for important state changes that should be visible.
 * @param {string} module - Module name
 * @param {...*} args - Values to log
 */
function info(module) {
    var args = Array.prototype.slice.call(arguments, 1);
    console.log.apply(console, [formatPrefix(module)].concat(args));
}

/**
 * Warning log - always shown
 * Use for non-critical issues that might indicate problems.
 * @param {string} module - Module name
 * @param {...*} args - Values to log
 */
function warn(module) {
    var args = Array.prototype.slice.call(arguments, 1);
    console.warn.apply(console, [formatPrefix(module)].concat(args));
}

/**
 * Error log - always shown
 * Use for errors that affect functionality.
 * @param {string} module - Module name
 * @param {...*} args - Values to log
 */
function error(module) {
    var args = Array.prototype.slice.call(arguments, 1);
    console.error.apply(console, [formatPrefix(module)].concat(args));
}

/**
 * Group log - for collapsible sections (dev mode only)
 * @param {string} module - Module name
 * @param {string} label - Group label
 */
function group(module, label) {
    if (!isDevMode()) return;
    console.group(formatPrefix(module) + ' ' + label);
}

/**
 * End group
 */
function groupEnd() {
    if (!isDevMode()) return;
    console.groupEnd();
}

/**
 * Table log - for structured data (dev mode only)
 * @param {string} module - Module name
 * @param {Array|Object} data - Data to display as table
 */
function table(module, data) {
    if (!isDevMode()) return;
    console.log(formatPrefix(module) + ' Table:');
    console.table(data);
}

/**
 * Time tracking - start timer (dev mode only)
 * @param {string} module - Module name
 * @param {string} label - Timer label
 */
function time(module, label) {
    if (!isDevMode()) return;
    console.time(formatPrefix(module) + ' ' + label);
}

/**
 * Time tracking - end timer (dev mode only)
 * @param {string} module - Module name
 * @param {string} label - Timer label
 */
function timeEnd(module, label) {
    if (!isDevMode()) return;
    console.timeEnd(formatPrefix(module) + ' ' + label);
}

/**
 * Logger namespace object
 * @type {Object}
 */
var Logger = {
    debug: debug,
    info: info,
    warn: warn,
    error: error,
    group: group,
    groupEnd: groupEnd,
    table: table,
    time: time,
    timeEnd: timeEnd,
    isDevMode: isDevMode
};

// Global export
window.Logger = Logger;

})();
