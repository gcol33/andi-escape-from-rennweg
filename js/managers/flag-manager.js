/**
 * Andi VN - Flag Manager (Standalone)
 * @module managers/flag-manager
 *
 * Manages game flags (story state variables).
 * Supports two flag types:
 *   - Regular flags: cleared on "Play Again" (soft reset)
 *   - Key flags: persist across "Play Again" (like skills)
 *
 * Usage:
 *   flagManager.set('met_agnes');
 *   if (flagManager.has('met_agnes')) { ... }
 *   flagManager.clear('met_agnes');
 *
 *   // Key flags (persistent)
 *   flagManager.setKey('completed_tutorial');
 *   if (flagManager.hasKey('completed_tutorial')) { ... }
 */

(function() {
'use strict';

/**
 * FlagManager constructor (standalone, no BaseManager dependency)
 */
function FlagManagerClass() {
    this.name = 'FlagManager';
    this._flags = new Set();
    this._keyFlags = new Set();
}

/**
 * Set a flag
 * @param {string} flag - Flag name
 */
FlagManagerClass.prototype.set = function(flag) {
    if (!flag) return;
    this._flags.add(flag);
};

/**
 * Set multiple flags
 * @param {string[]} flags - Array of flag names
 */
FlagManagerClass.prototype.setMany = function(flags) {
    if (!flags || !flags.length) return;
    for (var i = 0; i < flags.length; i++) {
        this._flags.add(flags[i]);
    }
};

/**
 * Check if a flag is set
 * @param {string} flag - Flag name
 * @returns {boolean}
 */
FlagManagerClass.prototype.has = function(flag) {
    return this._flags.has(flag);
};

/**
 * Check if all flags are set
 * @param {string[]} requiredFlags - Flags to check
 * @returns {boolean}
 */
FlagManagerClass.prototype.hasAll = function(requiredFlags) {
    if (!requiredFlags || !requiredFlags.length) return true;
    for (var i = 0; i < requiredFlags.length; i++) {
        if (!this.has(requiredFlags[i])) return false;
    }
    return true;
};

/**
 * Check if any flag is set
 * @param {string[]} flagsToCheck - Flags to check
 * @returns {boolean}
 */
FlagManagerClass.prototype.hasAny = function(flagsToCheck) {
    if (!flagsToCheck || !flagsToCheck.length) return false;
    for (var i = 0; i < flagsToCheck.length; i++) {
        if (this.has(flagsToCheck[i])) return true;
    }
    return false;
};

/**
 * Clear a flag
 * @param {string} flag - Flag name
 */
FlagManagerClass.prototype.clear = function(flag) {
    if (!flag) return;
    this._flags.delete(flag);
};

/**
 * Clear multiple flags
 * @param {string[]} flags - Flags to clear
 */
FlagManagerClass.prototype.clearMany = function(flags) {
    if (!flags || !flags.length) return;
    for (var i = 0; i < flags.length; i++) {
        this._flags.delete(flags[i]);
    }
};

/**
 * Clear all flags
 */
FlagManagerClass.prototype.clearAll = function() {
    this._flags = new Set();
};

/**
 * Get all flags
 * @returns {string[]}
 */
FlagManagerClass.prototype.getAll = function() {
    return Array.from(this._flags);
};

/**
 * Get count of flags
 * @returns {number}
 */
FlagManagerClass.prototype.count = function() {
    return this._flags.size;
};

/**
 * Toggle a flag
 * @param {string} flag - Flag name
 * @returns {boolean} New state
 */
FlagManagerClass.prototype.toggle = function(flag) {
    if (this.has(flag)) {
        this.clear(flag);
        return false;
    } else {
        this.set(flag);
        return true;
    }
};

// =====================
// Key Flags (persistent across Play Again)
// =====================

/**
 * Set a key flag (persistent)
 * @param {string} flag - Flag name
 */
FlagManagerClass.prototype.setKey = function(flag) {
    if (!flag) return;
    this._keyFlags.add(flag);
};

/**
 * Check if a key flag is set
 * @param {string} flag - Flag name
 * @returns {boolean}
 */
FlagManagerClass.prototype.hasKey = function(flag) {
    return this._keyFlags.has(flag);
};

/**
 * Clear a key flag
 * @param {string} flag - Flag name
 */
FlagManagerClass.prototype.clearKey = function(flag) {
    if (!flag) return;
    this._keyFlags.delete(flag);
};

/**
 * Get all key flags
 * @returns {string[]}
 */
FlagManagerClass.prototype.getAllKey = function() {
    return Array.from(this._keyFlags);
};

/**
 * Clear all key flags
 */
FlagManagerClass.prototype.clearAllKey = function() {
    this._keyFlags = new Set();
};

// =====================
// Combined checks (regular + key flags)
// =====================

/**
 * Check if flag exists in either regular or key flags
 * @param {string} flag - Flag name
 * @returns {boolean}
 */
FlagManagerClass.prototype.hasAnyType = function(flag) {
    return this.has(flag) || this.hasKey(flag);
};

/**
 * Check all required flags (supports negation with '!')
 * Checks both regular and key flags
 * @param {string[]} required - Array of flag names (prefix with ! for negation)
 * @returns {boolean}
 */
FlagManagerClass.prototype.checkRequired = function(required) {
    if (!required || !required.length) return true;

    for (var i = 0; i < required.length; i++) {
        var flag = required[i];
        // Support negation: !flag_name means "does NOT have this flag"
        if (flag.charAt(0) === '!') {
            var negatedFlag = flag.substring(1);
            if (this.hasAnyType(negatedFlag)) return false;
        } else {
            if (!this.hasAnyType(flag)) return false;
        }
    }
    return true;
};

// Singleton instance
var flagManager = new FlagManagerClass();

// Global export
window.flagManager = flagManager;

})();
