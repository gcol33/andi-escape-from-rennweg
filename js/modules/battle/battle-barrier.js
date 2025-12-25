/**
 * Andi VN - Battle Barrier System
 *
 * Standalone module for enemy barrier/shield mechanics.
 * Barriers absorb hits before HP damage is dealt.
 * Each hit removes 1 stack regardless of damage amount.
 *
 * Usage:
 *   BattleBarrier.init(3);           // Enemy starts with 3 barrier stacks
 *   if (BattleBarrier.hasBarrier()) {
 *       var result = BattleBarrier.removeStack(1);
 *       // result = { removed: 1, remaining: 2, broken: false }
 *   }
 */

var BattleBarrier = (function() {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    var T = typeof TUNING !== 'undefined' ? TUNING : null;
    var config = {
        damageReduction: T && T.battle.barrier ? T.battle.barrier.damageReduction : 1.0,
        stacksPerHit: T && T.battle.barrier ? T.battle.barrier.stacksPerHit : 1
    };

    // =========================================================================
    // STATE
    // =========================================================================

    var state = {
        stacks: 0,
        maxStacks: 0
    };

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        /**
         * Initialize barrier for a new battle
         * @param {number} stacks - Number of barrier stacks (1-6 typical)
         */
        init: function(stacks) {
            state.stacks = stacks || 0;
            state.maxStacks = stacks || 0;
        },

        /**
         * Check if barrier is active
         * @returns {boolean}
         */
        hasBarrier: function() {
            return state.stacks > 0;
        },

        /**
         * Get current barrier stacks
         * @returns {number}
         */
        getStacks: function() {
            return state.stacks;
        },

        /**
         * Get maximum barrier stacks
         * @returns {number}
         */
        getMaxStacks: function() {
            return state.maxStacks;
        },

        /**
         * Remove barrier stacks (called when enemy is hit)
         * @param {number} count - Stacks to remove (default: 1)
         * @returns {Object} { removed, remaining, broken }
         */
        removeStack: function(count) {
            count = count || config.stacksPerHit;
            var previous = state.stacks;
            state.stacks = Math.max(0, state.stacks - count);

            return {
                removed: previous - state.stacks,
                remaining: state.stacks,
                broken: previous > 0 && state.stacks === 0
            };
        },

        /**
         * Restore barrier stacks
         * @param {number} count - Stacks to restore
         * @returns {number} Actual stacks restored
         */
        restore: function(count) {
            var previous = state.stacks;
            state.stacks = Math.min(state.maxStacks, state.stacks + count);
            return state.stacks - previous;
        },

        /**
         * Reset barrier state
         */
        reset: function() {
            state.stacks = 0;
            state.maxStacks = 0;
        },

        /**
         * Get damage reduction while barrier is active
         * @returns {number} Reduction factor (0-1, where 1 = full block)
         */
        getDamageReduction: function() {
            return state.stacks > 0 ? config.damageReduction : 0;
        },

        /**
         * Get current state (for UI/debugging)
         * @returns {Object}
         */
        getState: function() {
            return {
                stacks: state.stacks,
                maxStacks: state.maxStacks,
                hasBarrier: state.stacks > 0
            };
        }
    };
})();
