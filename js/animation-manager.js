/**
 * Andi VN - Animation Manager Module
 *
 * Centralized tracking of requestAnimationFrame handles.
 * Allows proper cleanup of animations on scene transitions.
 *
 * Usage:
 *   // Register an animation
 *   var rafId = requestAnimationFrame(myAnimation);
 *   AnimationManager.register('my-anim', rafId);
 *
 *   // Cancel specific animation
 *   AnimationManager.cancel('my-anim');
 *
 *   // Cancel all animations (on scene transition)
 *   AnimationManager.cancelAll();
 */

var AnimationManager = (function() {
    'use strict';

    /**
     * Map of animation IDs to RAF handles
     * @type {Object.<string, number>}
     */
    var animations = {};

    /**
     * Map of animation IDs to timeout handles
     * @type {Object.<string, Array<number>>}
     */
    var timeouts = {};

    /**
     * Map of animation IDs to interval handles
     * @type {Object.<string, Array<number>>}
     */
    var intervals = {};

    /**
     * Register an animation frame handle
     * @param {string} id - Unique identifier for this animation
     * @param {number} rafHandle - Handle from requestAnimationFrame
     */
    function register(id, rafHandle) {
        // Cancel existing if same ID
        if (animations[id]) {
            cancelAnimationFrame(animations[id]);
        }
        animations[id] = rafHandle;
    }

    /**
     * Register a timeout
     * @param {string} id - Group identifier (multiple timeouts can share an ID)
     * @param {number} timeoutHandle - Handle from setTimeout
     */
    function registerTimeout(id, timeoutHandle) {
        if (!timeouts[id]) {
            timeouts[id] = [];
        }
        timeouts[id].push(timeoutHandle);
    }

    /**
     * Register an interval
     * @param {string} id - Group identifier
     * @param {number} intervalHandle - Handle from setInterval
     */
    function registerInterval(id, intervalHandle) {
        if (!intervals[id]) {
            intervals[id] = [];
        }
        intervals[id].push(intervalHandle);
    }

    /**
     * Cancel a specific animation by ID
     * @param {string} id - Animation identifier
     * @returns {boolean} True if animation was found and cancelled
     */
    function cancel(id) {
        var found = false;

        // Cancel RAF
        if (animations[id]) {
            cancelAnimationFrame(animations[id]);
            delete animations[id];
            found = true;
        }

        // Cancel timeouts
        if (timeouts[id]) {
            for (var i = 0; i < timeouts[id].length; i++) {
                clearTimeout(timeouts[id][i]);
            }
            delete timeouts[id];
            found = true;
        }

        // Cancel intervals
        if (intervals[id]) {
            for (var j = 0; j < intervals[id].length; j++) {
                clearInterval(intervals[id][j]);
            }
            delete intervals[id];
            found = true;
        }

        return found;
    }

    /**
     * Cancel all registered animations
     * Call this on scene transitions to prevent orphaned animations
     */
    function cancelAll() {
        // Cancel all RAFs
        for (var id in animations) {
            cancelAnimationFrame(animations[id]);
        }
        animations = {};

        // Cancel all timeouts
        for (var tid in timeouts) {
            for (var i = 0; i < timeouts[tid].length; i++) {
                clearTimeout(timeouts[tid][i]);
            }
        }
        timeouts = {};

        // Cancel all intervals
        for (var iid in intervals) {
            for (var j = 0; j < intervals[iid].length; j++) {
                clearInterval(intervals[iid][j]);
            }
        }
        intervals = {};

        // Emit event for any listeners
        if (typeof EventEmitter !== 'undefined') {
            EventEmitter.emit('animations:cancelled');
        }
    }

    /**
     * Check if an animation is currently registered
     * @param {string} id - Animation identifier
     * @returns {boolean} True if animation exists
     */
    function isActive(id) {
        return !!(animations[id] || timeouts[id] || intervals[id]);
    }

    /**
     * Get count of active animations
     * @returns {number} Number of active animation groups
     */
    function count() {
        return Object.keys(animations).length +
               Object.keys(timeouts).length +
               Object.keys(intervals).length;
    }

    /**
     * Get list of active animation IDs
     * @returns {Array<string>} Array of active IDs
     */
    function getActiveIds() {
        var ids = {};
        for (var key in animations) ids[key] = true;
        for (var key2 in timeouts) ids[key2] = true;
        for (var key3 in intervals) ids[key3] = true;
        return Object.keys(ids);
    }

    return {
        register: register,
        registerTimeout: registerTimeout,
        registerInterval: registerInterval,
        cancel: cancel,
        cancelAll: cancelAll,
        isActive: isActive,
        count: count,
        getActiveIds: getActiveIds
    };
})();
