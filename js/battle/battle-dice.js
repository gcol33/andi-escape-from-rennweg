/**
 * Andi VN - Battle Dice Module
 *
 * Pure dice rolling logic. No UI, no side effects.
 *
 * Usage:
 *   var result = BattleDice.rollD20();
 *   var result = BattleDice.rollWithAdvantage();
 *   var damage = BattleDice.rollDamage('2d6+3');
 */

var BattleDice = (function() {
    'use strict';

    // For dev mode: forced roll callback (hit rolls d20)
    var forcedRollCallback = null;
    // For dev mode: forced damage callback
    var forcedDamageCallback = null;

    /**
     * Set callback to force specific roll values (dev mode)
     */
    function setForcedRollCallback(callback) {
        forcedRollCallback = callback;
    }

    /**
     * Set callback to force specific damage values (dev mode)
     */
    function setForcedDamageCallback(callback) {
        forcedDamageCallback = callback;
    }

    /**
     * Roll a single die
     * @param {number} sides - Number of sides (default 20)
     * @returns {number} Roll result 1-sides
     */
    function roll(sides) {
        sides = sides || 20;

        // Check for forced roll (dev mode)
        if (forcedRollCallback && sides === 20) {
            var forced = forcedRollCallback();
            if (forced !== null && forced >= 1 && forced <= 20) {
                return forced;
            }
        }

        return Math.floor(Math.random() * sides) + 1;
    }

    /**
     * Roll a d20
     * @returns {Object} { roll, isCrit, isFumble, sides }
     */
    function rollD20() {
        var result = roll(20);
        return {
            roll: result,
            sides: 20,
            isCrit: result >= 20,
            isFumble: result === 1
        };
    }

    /**
     * Roll any die type
     * @param {number} sides - Number of sides (4, 6, 8, 10, 12, 20, 100)
     * @returns {Object} { roll, sides, isMax, isMin }
     */
    function rollDie(sides) {
        var result = roll(sides);
        return {
            roll: result,
            sides: sides,
            isMax: result === sides,
            isMin: result === 1
        };
    }

    /**
     * Roll d4
     */
    function rollD4() { return rollDie(4); }

    /**
     * Roll d6
     */
    function rollD6() { return rollDie(6); }

    /**
     * Roll d8
     */
    function rollD8() { return rollDie(8); }

    /**
     * Roll d10
     */
    function rollD10() { return rollDie(10); }

    /**
     * Roll d12
     */
    function rollD12() { return rollDie(12); }

    /**
     * Roll d100 (percentile)
     */
    function rollD100() { return rollDie(100); }

    /**
     * Roll with advantage (roll twice, take higher)
     * @returns {Object} { roll, isCrit, isFumble, rolls }
     */
    function rollWithAdvantage() {
        var roll1 = roll(20);
        var roll2 = roll(20);
        var result = Math.max(roll1, roll2);

        return {
            roll: result,
            isCrit: result >= 20,
            isFumble: result === 1,
            rolls: [roll1, roll2],
            advantage: true
        };
    }

    /**
     * Roll with disadvantage (roll twice, take lower)
     * @returns {Object} { roll, isCrit, isFumble, rolls }
     */
    function rollWithDisadvantage() {
        var roll1 = roll(20);
        var roll2 = roll(20);
        var result = Math.min(roll1, roll2);

        return {
            roll: result,
            isCrit: result >= 20,
            isFumble: result === 1,
            rolls: [roll1, roll2],
            disadvantage: true
        };
    }

    /**
     * Parse and roll damage dice notation
     * @param {string|number} notation - e.g. '2d6+3', '1d8', 10
     * @param {number} minDamage - Minimum damage (default 1)
     * @returns {number} Total damage
     */
    function rollDamage(notation, minDamage) {
        minDamage = minDamage !== undefined ? minDamage : 1;

        // Check for forced damage (dev mode)
        if (forcedDamageCallback) {
            var forced = forcedDamageCallback();
            if (forced !== null && forced >= 1) {
                return Math.max(minDamage, forced);
            }
        }

        // Handle plain number
        if (typeof notation === 'number') {
            return Math.max(minDamage, notation);
        }

        // Parse dice notation: XdY+Z, XdY-Z, or dY (defaults to 1dY)
        var match = String(notation).match(/(\d*)d(\d+)([+-]\d+)?/i);
        if (!match) {
            return Math.max(minDamage, parseInt(notation) || minDamage);
        }

        var count = parseInt(match[1]) || 1;  // Default to 1 if no number before 'd'
        var sides = parseInt(match[2]);
        var modifier = match[3] ? parseInt(match[3]) : 0;

        var total = modifier;
        for (var i = 0; i < count; i++) {
            total += roll(sides);
        }

        return Math.max(minDamage, total);
    }

    /**
     * Roll damage with breakdown
     * @param {string} notation - Dice notation
     * @returns {Object} { total, rolls, modifier }
     */
    function rollDamageDetailed(notation) {
        // Check for forced damage (dev mode)
        if (forcedDamageCallback) {
            var forced = forcedDamageCallback();
            if (forced !== null && forced >= 1) {
                return {
                    total: Math.max(1, forced),
                    rolls: [forced],
                    modifier: 0,
                    notation: notation,
                    isMin: false,
                    isMax: false,
                    forced: true
                };
            }
        }

        // Support formats: "1d6", "d6", "2d6+3", "d8-1"
        var match = String(notation).match(/(\d*)d(\d+)([+-]\d+)?/i);
        if (!match) {
            var val = parseInt(notation) || 1;
            return { total: val, rolls: [val], modifier: 0, isMin: false, isMax: false };
        }

        var count = parseInt(match[1]) || 1;  // Default to 1 if no number before 'd'
        var sides = parseInt(match[2]);
        var modifier = match[3] ? parseInt(match[3]) : 0;

        var rolls = [];
        var diceTotal = 0;
        var minPossible = count;       // All 1s
        var maxPossible = count * sides; // All max
        for (var i = 0; i < count; i++) {
            var r = roll(sides);
            rolls.push(r);
            diceTotal += r;
        }

        return {
            total: Math.max(1, diceTotal + modifier),
            rolls: rolls,
            modifier: modifier,
            notation: notation,
            isMin: diceTotal === minPossible,
            isMax: diceTotal === maxPossible
        };
    }

    /**
     * Roll damage with advantage (roll twice, take higher)
     * @param {string} notation - Dice notation (e.g., "2d6+3")
     * @returns {Object} { total, rolls, bothRolls, modifier, advantage }
     */
    function rollDamageWithAdvantage(notation) {
        var roll1 = rollDamageDetailed(notation);
        var roll2 = rollDamageDetailed(notation);

        var winner = roll1.total >= roll2.total ? roll1 : roll2;

        // For advantage, isMin/isMax should reflect the CHOSEN roll's relation to possible range
        // isMin: chosen roll equals the minimum possible (only if BOTH rolls were minimum)
        // isMax: chosen roll equals the maximum possible (winner.isMax is correct since we took higher)
        return {
            total: winner.total,
            rolls: winner.rolls,
            bothRolls: [roll1.total, roll2.total],
            modifier: winner.modifier,
            notation: notation,
            isMin: roll1.isMin && roll2.isMin,  // Only min if both rolls were min
            isMax: winner.isMax,                 // Max if the higher roll was max
            advantage: true
        };
    }

    /**
     * Roll damage with disadvantage (roll twice, take lower)
     * @param {string} notation - Dice notation
     * @returns {Object} { total, rolls, bothRolls, modifier, disadvantage }
     */
    function rollDamageWithDisadvantage(notation) {
        var roll1 = rollDamageDetailed(notation);
        var roll2 = rollDamageDetailed(notation);

        var loser = roll1.total <= roll2.total ? roll1 : roll2;

        // For disadvantage, isMin/isMax should reflect the CHOSEN roll's relation to possible range
        // isMin: chosen roll equals the minimum possible (loser.isMin is correct since we took lower)
        // isMax: chosen roll equals the maximum possible (only if BOTH rolls were maximum)
        return {
            total: loser.total,
            rolls: loser.rolls,
            bothRolls: [roll1.total, roll2.total],
            modifier: loser.modifier,
            notation: notation,
            isMin: loser.isMin,                  // Min if the lower roll was min
            isMax: roll1.isMax && roll2.isMax,   // Only max if both rolls were max
            disadvantage: true
        };
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        // Configuration
        setForcedRollCallback: setForcedRollCallback,
        setForcedDamageCallback: setForcedDamageCallback,

        // Generic roll
        roll: roll,
        rollDie: rollDie,

        // Specific dice
        rollD4: rollD4,
        rollD6: rollD6,
        rollD8: rollD8,
        rollD10: rollD10,
        rollD12: rollD12,
        rollD20: rollD20,
        rollD100: rollD100,

        // Advantage/Disadvantage
        rollWithAdvantage: rollWithAdvantage,
        rollWithDisadvantage: rollWithDisadvantage,

        // Damage
        rollDamage: rollDamage,
        rollDamageDetailed: rollDamageDetailed,
        rollDamageWithAdvantage: rollDamageWithAdvantage,
        rollDamageWithDisadvantage: rollDamageWithDisadvantage
    };
})();
