/**
 * Andi VN - Battle Utilities Module
 *
 * Shared utility functions and module dependency management for the battle system.
 * This module centralizes common patterns to reduce code duplication across:
 * - battle-core.js
 * - battle-dnd.js
 * - battle-pokemon.js
 * - battle-exp33.js
 * - battle-facade.js
 *
 * Usage:
 *   BattleUtils.hasBattleData()  // Check if BattleData is loaded
 *   BattleUtils.getStatusModifiers(target)  // Get all status modifiers at once
 *   BattleUtils.tryApplyStatus(skill, target)  // Unified status application
 */

var BattleUtils = (function() {
    'use strict';

    // =========================================================================
    // MODULE DEPENDENCY CACHE
    // =========================================================================

    // Cache dependency checks at load time for performance
    var _dependencies = {
        BattleData: typeof BattleData !== 'undefined',
        BattleCore: typeof BattleCore !== 'undefined',
        BattleDice: typeof BattleDice !== 'undefined',
        BattleBarrier: typeof BattleBarrier !== 'undefined',
        BattleIntent: typeof BattleIntent !== 'undefined',
        BattleSummon: typeof BattleSummon !== 'undefined',
        BattleUI: typeof BattleUI !== 'undefined',
        QTEEngine: typeof QTEEngine !== 'undefined',
        EventEmitter: typeof EventEmitter !== 'undefined'
    };

    /**
     * Check if a module is available
     * @param {string} moduleName - Name of the module to check
     * @returns {boolean} True if module is loaded
     */
    function hasModule(moduleName) {
        // Re-check at runtime in case module was loaded after BattleUtils
        if (!_dependencies[moduleName]) {
            _dependencies[moduleName] = typeof window[moduleName] !== 'undefined';
        }
        return _dependencies[moduleName];
    }

    // Convenience methods for common checks
    function hasBattleData() { return hasModule('BattleData'); }
    function hasBattleCore() { return hasModule('BattleCore'); }
    function hasBattleDice() { return hasModule('BattleDice'); }
    function hasBattleBarrier() { return hasModule('BattleBarrier'); }
    function hasBattleIntent() { return hasModule('BattleIntent'); }
    function hasBattleSummon() { return hasModule('BattleSummon'); }
    function hasBattleUI() { return hasModule('BattleUI'); }
    function hasQTEEngine() { return hasModule('QTEEngine'); }

    /**
     * Refresh all dependency checks
     * Call this after dynamically loading modules
     */
    function refreshDependencies() {
        for (var key in _dependencies) {
            _dependencies[key] = typeof window[key] !== 'undefined';
        }
    }

    // =========================================================================
    // STATUS EFFECT UTILITIES
    // =========================================================================

    /**
     * Get all status modifiers for a target in one call
     * More efficient than calling individual getStatusXModifier functions
     * @param {Object} target - Target with statuses array
     * @returns {Object} { ac, attack, damage }
     */
    function getStatusModifiers(target) {
        var modifiers = {
            ac: 0,
            attack: 0,
            damage: 0
        };

        if (!hasBattleData() || !target || !target.statuses) {
            return modifiers;
        }

        for (var i = 0; i < target.statuses.length; i++) {
            var def = BattleData.getStatusEffect(target.statuses[i].type);
            if (def) {
                if (def.acBonus) modifiers.ac += def.acBonus;
                if (def.attackBonus) modifiers.attack += def.attackBonus;
                if (def.damageBonus) modifiers.damage += def.damageBonus;
            }
        }

        return modifiers;
    }

    /**
     * Get AC modifier from statuses
     * @param {Object} target - Target with statuses array
     * @returns {number} AC modifier
     */
    function getStatusACModifier(target) {
        return getStatusModifiers(target).ac;
    }

    /**
     * Get attack modifier from statuses
     * @param {Object} target - Target with statuses array
     * @returns {number} Attack modifier
     */
    function getStatusAttackModifier(target) {
        return getStatusModifiers(target).attack;
    }

    /**
     * Get damage modifier from statuses
     * @param {Object} target - Target with statuses array
     * @returns {number} Damage modifier
     */
    function getStatusDamageModifier(target) {
        return getStatusModifiers(target).damage;
    }

    /**
     * Unified status effect application with terrain bonus support
     * @param {Object} skill - Skill with statusEffect property
     * @param {Object} target - Target to apply status to
     * @param {Object} options - Optional { terrainId, bonusChance }
     * @returns {Object|null} { applied, message } or null
     */
    function tryApplyStatus(skill, target, options) {
        if (!skill || !skill.statusEffect) return null;
        options = options || {};

        var statusInfo = skill.statusEffect;
        var baseChance = statusInfo.chance || 0;

        // Apply terrain bonus if available
        if (hasBattleData()) {
            var terrainId = options.terrainId;
            if (!terrainId && hasBattleCore()) {
                terrainId = BattleCore.getTerrain();
            }
            if (terrainId) {
                var terrain = BattleData.getTerrain(terrainId);
                if (terrain && terrain.statusChanceBonus && terrain.statusChanceBonus[statusInfo.type]) {
                    baseChance += terrain.statusChanceBonus[statusInfo.type];
                }
            }
        }

        // Apply bonus chance from options (e.g., from QTE)
        if (options.bonusChance) {
            baseChance += options.bonusChance;
        }

        // Check if status applies
        var shouldApply = false;
        if (hasBattleCore() && BattleCore.shouldApplyStatus) {
            shouldApply = BattleCore.shouldApplyStatus(baseChance);
        } else {
            shouldApply = Math.random() < baseChance;
        }

        if (shouldApply && hasBattleCore()) {
            var stacks = statusInfo.stacks || 1;
            return BattleCore.applyStatus(target, statusInfo.type, stacks);
        }

        return { applied: false, message: '' };
    }

    /**
     * Find a status effect source name for UI display
     * @param {Object} target - Target with statuses
     * @param {string} property - Property to look for (attackBonus, acBonus, damageBonus)
     * @returns {string} Status name or 'Status'
     */
    function findStatusSourceName(target, property) {
        if (!hasBattleData() || !target || !target.statuses) {
            return 'Status';
        }

        for (var i = 0; i < target.statuses.length; i++) {
            var def = BattleData.getStatusEffect(target.statuses[i].type);
            if (def && def[property]) {
                return def.name || 'Status';
            }
        }
        return 'Status';
    }

    // =========================================================================
    // DICE ROLLING UTILITIES
    // =========================================================================

    /**
     * Parse dice string into components
     * @param {string} diceStr - Dice notation (e.g., '2d6+3')
     * @returns {Object|null} { numDice, sides, modifier } or null if invalid
     */
    function parseDiceString(diceStr) {
        if (typeof diceStr === 'number') {
            return { numDice: 0, sides: 0, modifier: diceStr, isFlat: true };
        }

        var match = diceStr.match(/(\d*)d(\d+)([+-]\d+)?/i);
        if (!match) return null;

        return {
            numDice: parseInt(match[1], 10) || 1,
            sides: parseInt(match[2], 10),
            modifier: parseInt(match[3], 10) || 0,
            isFlat: false
        };
    }

    /**
     * Roll damage from dice string (fallback when BattleDice not available)
     * @param {string|number} diceStr - Dice notation or flat number
     * @param {number} minDamage - Minimum damage (default 1)
     * @returns {number} Rolled damage
     */
    function rollDamage(diceStr, minDamage) {
        minDamage = minDamage !== undefined ? minDamage : 1;

        // Delegate to BattleDice if available
        if (hasBattleDice()) {
            return BattleDice.rollDamage(diceStr, minDamage);
        }

        // Fallback implementation
        if (typeof diceStr === 'number') return Math.max(minDamage, diceStr);

        var parsed = parseDiceString(diceStr);
        if (!parsed) return minDamage;
        if (parsed.isFlat) return Math.max(minDamage, parsed.modifier);

        var total = parsed.modifier;
        for (var i = 0; i < parsed.numDice; i++) {
            total += Math.floor(Math.random() * parsed.sides) + 1;
        }
        return Math.max(minDamage, total);
    }

    /**
     * Estimate average damage from dice string (for AI decision making)
     * @param {string|number} diceStr - Dice notation or flat number
     * @returns {number} Estimated average damage
     */
    function estimateAverageDamage(diceStr) {
        if (typeof diceStr === 'number') return diceStr;

        var parsed = parseDiceString(diceStr);
        if (!parsed) return 1;
        if (parsed.isFlat) return parsed.modifier;

        return parsed.numDice * ((parsed.sides + 1) / 2) + parsed.modifier;
    }

    // =========================================================================
    // TYPE EFFECTIVENESS UTILITIES
    // =========================================================================

    /**
     * Get type effectiveness multiplier
     * @param {string} attackType - Attack type
     * @param {string} defenderType - Defender type
     * @returns {number} Multiplier (0, 0.5, 1, 2)
     */
    function getTypeMultiplier(attackType, defenderType) {
        if (!hasBattleData()) return 1;
        return BattleData.getTypeMultiplier(attackType, defenderType);
    }

    /**
     * Get effectiveness message for UI
     * @param {number} multiplier - Type multiplier
     * @returns {string} Message or empty string
     */
    function getEffectivenessMessage(multiplier) {
        if (multiplier >= 2) return "It's super effective!";
        if (multiplier === 0) return "It has no effect...";
        if (multiplier <= 0.5) return "It's not very effective...";
        return '';
    }

    // =========================================================================
    // TERRAIN UTILITIES
    // =========================================================================

    /**
     * Get terrain damage multiplier for attack type
     * @param {string} attackType - Type of attack
     * @returns {number} Terrain multiplier
     */
    function getTerrainMultiplier(attackType) {
        if (hasBattleCore()) {
            return BattleCore.getTerrainMultiplier(attackType);
        }
        return 1;
    }

    /**
     * Get terrain accuracy penalty
     * @returns {number} Accuracy penalty
     */
    function getTerrainAccuracyPenalty() {
        if (hasBattleCore()) {
            return BattleCore.getTerrainAccuracyPenalty();
        }
        return 0;
    }

    // =========================================================================
    // AI UTILITIES
    // =========================================================================

    /**
     * Find a move by type/category from moves array
     * @param {Array} moves - Array of move objects
     * @param {string} type - Type to find ('heal', 'buff', 'attack')
     * @param {boolean} isHeal - Look for heal moves
     * @returns {Object|null} Found move or null
     */
    function findMoveByType(moves, type, isHeal) {
        for (var i = 0; i < moves.length; i++) {
            if (type === 'heal' && moves[i].isHeal) return moves[i];
            if (type === 'buff' && moves[i].isBuff) return moves[i];
            if (type === 'attack' && moves[i].damage && !moves[i].isHeal && !moves[i].isBuff) {
                return moves[i];
            }
        }
        return null;
    }

    /**
     * Find the highest damage move
     * @param {Array} moves - Array of move objects
     * @returns {Object|null} Highest damage move or null
     */
    function findHighestDamageMove(moves) {
        var best = null;
        var bestDamage = 0;

        for (var i = 0; i < moves.length; i++) {
            if (moves[i].damage) {
                var avg = estimateAverageDamage(moves[i].damage);
                if (avg > bestDamage) {
                    bestDamage = avg;
                    best = moves[i];
                }
            }
        }
        return best;
    }

    /**
     * Find a move with status effect
     * @param {Array} moves - Array of move objects
     * @returns {Object|null} Move with status effect or null
     */
    function findMoveWithStatus(moves) {
        for (var i = 0; i < moves.length; i++) {
            if (moves[i].statusEffect) return moves[i];
        }
        return null;
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        // Module dependency checks
        hasModule: hasModule,
        hasBattleData: hasBattleData,
        hasBattleCore: hasBattleCore,
        hasBattleDice: hasBattleDice,
        hasBattleBarrier: hasBattleBarrier,
        hasBattleIntent: hasBattleIntent,
        hasBattleSummon: hasBattleSummon,
        hasBattleUI: hasBattleUI,
        hasQTEEngine: hasQTEEngine,
        refreshDependencies: refreshDependencies,

        // Status effect utilities
        getStatusModifiers: getStatusModifiers,
        getStatusACModifier: getStatusACModifier,
        getStatusAttackModifier: getStatusAttackModifier,
        getStatusDamageModifier: getStatusDamageModifier,
        tryApplyStatus: tryApplyStatus,
        findStatusSourceName: findStatusSourceName,

        // Dice utilities
        parseDiceString: parseDiceString,
        rollDamage: rollDamage,
        estimateAverageDamage: estimateAverageDamage,

        // Type effectiveness
        getTypeMultiplier: getTypeMultiplier,
        getEffectivenessMessage: getEffectivenessMessage,

        // Terrain utilities
        getTerrainMultiplier: getTerrainMultiplier,
        getTerrainAccuracyPenalty: getTerrainAccuracyPenalty,

        // AI utilities
        findMoveByType: findMoveByType,
        findHighestDamageMove: findHighestDamageMove,
        findMoveWithStatus: findMoveWithStatus
    };
})();
