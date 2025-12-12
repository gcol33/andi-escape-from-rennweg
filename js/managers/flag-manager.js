/**
 * Andi VN - Flag Manager
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
 * FlagManager constructor
 */
function FlagManagerClass() {
    BaseManager.call(this);
    this.name = 'FlagManager';
}

// Inherit from BaseManager
FlagManagerClass.prototype = Object.create(BaseManager.prototype);
FlagManagerClass.prototype.constructor = FlagManagerClass;

/**
 * Set a flag
 * @param {string} flag - Flag name
 */
FlagManagerClass.prototype.set = function(flag) {
    if (!flag) return;

    this.setState('player.flags', function(flags) {
        var newFlags = new Set(flags);
        newFlags.add(flag);
        return newFlags;
    });

    this.debug('Set flag:', flag);
};

/**
 * Set multiple flags
 * @param {string[]} flags - Array of flag names
 */
FlagManagerClass.prototype.setMany = function(flags) {
    if (!flags || !flags.length) return;

    this.setState('player.flags', function(currentFlags) {
        var newFlags = new Set(currentFlags);
        for (var i = 0; i < flags.length; i++) {
            newFlags.add(flags[i]);
        }
        return newFlags;
    });

    this.debug('Set flags:', flags);
};

/**
 * Check if a flag is set
 * @param {string} flag - Flag name
 * @returns {boolean}
 */
FlagManagerClass.prototype.has = function(flag) {
    var flags = this.getState('player.flags');
    return flags ? flags.has(flag) : false;
};

/**
 * Check if all flags are set
 * @param {string[]} requiredFlags - Flags to check
 * @returns {boolean}
 */
FlagManagerClass.prototype.hasAll = function(requiredFlags) {
    if (!requiredFlags || !requiredFlags.length) return true;
    var self = this;
    for (var i = 0; i < requiredFlags.length; i++) {
        if (!self.has(requiredFlags[i])) return false;
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
    var self = this;
    for (var i = 0; i < flagsToCheck.length; i++) {
        if (self.has(flagsToCheck[i])) return true;
    }
    return false;
};

/**
 * Clear a flag
 * @param {string} flag - Flag name
 */
FlagManagerClass.prototype.clear = function(flag) {
    if (!flag) return;

    this.setState('player.flags', function(flags) {
        var newFlags = new Set(flags);
        newFlags.delete(flag);
        return newFlags;
    });

    this.debug('Cleared flag:', flag);
};

/**
 * Clear multiple flags
 * @param {string[]} flags - Flags to clear
 */
FlagManagerClass.prototype.clearMany = function(flags) {
    if (!flags || !flags.length) return;

    this.setState('player.flags', function(currentFlags) {
        var newFlags = new Set(currentFlags);
        for (var i = 0; i < flags.length; i++) {
            newFlags.delete(flags[i]);
        }
        return newFlags;
    });

    this.debug('Cleared flags:', flags);
};

/**
 * Clear all flags
 */
FlagManagerClass.prototype.clearAll = function() {
    this.setState('player.flags', function() { return new Set(); });
    this.debug('Cleared all flags');
};

/**
 * Get all flags
 * @returns {string[]}
 */
FlagManagerClass.prototype.getAll = function() {
    var flags = this.getState('player.flags');
    return flags ? Array.from(flags) : [];
};

/**
 * Get count of flags
 * @returns {number}
 */
FlagManagerClass.prototype.count = function() {
    var flags = this.getState('player.flags');
    return flags ? flags.size : 0;
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

    this.setState('player.keyFlags', function(flags) {
        var newFlags = new Set(flags);
        newFlags.add(flag);
        return newFlags;
    });

    this.debug('Set key flag:', flag);
};

/**
 * Check if a key flag is set
 * @param {string} flag - Flag name
 * @returns {boolean}
 */
FlagManagerClass.prototype.hasKey = function(flag) {
    var flags = this.getState('player.keyFlags');
    return flags ? flags.has(flag) : false;
};

/**
 * Clear a key flag
 * @param {string} flag - Flag name
 */
FlagManagerClass.prototype.clearKey = function(flag) {
    if (!flag) return;

    this.setState('player.keyFlags', function(flags) {
        var newFlags = new Set(flags);
        newFlags.delete(flag);
        return newFlags;
    });

    this.debug('Cleared key flag:', flag);
};

/**
 * Get all key flags
 * @returns {string[]}
 */
FlagManagerClass.prototype.getAllKey = function() {
    var flags = this.getState('player.keyFlags');
    return flags ? Array.from(flags) : [];
};

/**
 * Clear all key flags
 */
FlagManagerClass.prototype.clearAllKey = function() {
    this.setState('player.keyFlags', function() { return new Set(); });
    this.debug('Cleared all key flags');
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
    var self = this;

    for (var i = 0; i < required.length; i++) {
        var flag = required[i];
        // Support negation: !flag_name means "does NOT have this flag"
        if (flag.charAt(0) === '!') {
            var negatedFlag = flag.substring(1);
            if (self.hasAnyType(negatedFlag)) return false;
        } else {
            if (!self.hasAnyType(flag)) return false;
        }
    }
    return true;
};

// Singleton instance
var flagManager = new FlagManagerClass();

// Global export
window.flagManager = flagManager;

})();
