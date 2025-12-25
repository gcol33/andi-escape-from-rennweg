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
    // SHARED SFX CALLBACK
    // =========================================================================
    // Consolidated from battle-ui.js and battle-dice-ui.js to avoid duplication

    var _sfxCallback = null;

    /**
     * Set the sound effect callback function
     * @param {function} callback - Function to call with SFX filename
     */
    function setSfxCallback(callback) {
        _sfxCallback = callback;
    }

    /**
     * Play a sound effect via callback
     * @param {string} filename - SFX filename to play
     */
    function playSfx(filename) {
        if (_sfxCallback) {
            _sfxCallback(filename);
        }
    }

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

    /**
     * Get all dependency statuses at once
     * Useful for debugging and consolidated checks
     * @returns {Object} All dependency statuses
     */
    function getAllDependencies() {
        refreshDependencies();
        return {
            BattleData: _dependencies.BattleData,
            BattleCore: _dependencies.BattleCore,
            BattleDice: _dependencies.BattleDice,
            BattleBarrier: _dependencies.BattleBarrier,
            BattleIntent: _dependencies.BattleIntent,
            BattleSummon: _dependencies.BattleSummon,
            BattleUI: _dependencies.BattleUI,
            QTEEngine: _dependencies.QTEEngine,
            EventEmitter: _dependencies.EventEmitter,
            TimerManager: typeof TimerManager !== 'undefined',
            ListenerManager: typeof ListenerManager !== 'undefined'
        };
    }

    /**
     * Validate required dependencies and log warnings
     * @param {string[]} required - Array of required module names
     * @param {string} callerName - Name of calling module for logging
     * @returns {boolean} True if all required dependencies are available
     */
    function validateDependencies(required, callerName) {
        var allPresent = true;
        var missing = [];

        for (var i = 0; i < required.length; i++) {
            if (!hasModule(required[i])) {
                allPresent = false;
                missing.push(required[i]);
            }
        }

        if (!allPresent && typeof Logger !== 'undefined') {
            Logger.warn(callerName, 'Missing dependencies:', missing.join(', '));
        }

        return allPresent;
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
     * Roll a d20 using BattleDice if available, with fallback
     * @returns {Object} { roll, isCrit, isFumble }
     */
    function rollD20() {
        if (hasBattleDice()) {
            return BattleDice.rollD20();
        }
        // Fallback implementation
        var roll = Math.floor(Math.random() * 20) + 1;
        return { roll: roll, isCrit: roll >= 20, isFumble: roll === 1 };
    }

    /**
     * Roll with advantage using BattleDice if available
     * @returns {Object} { roll, isCrit, isFumble, rolls, hadAdvantage }
     */
    function rollWithAdvantage() {
        if (hasBattleDice() && BattleDice.rollWithAdvantage) {
            return BattleDice.rollWithAdvantage();
        }
        // Fallback: roll twice, take higher
        var roll1 = Math.floor(Math.random() * 20) + 1;
        var roll2 = Math.floor(Math.random() * 20) + 1;
        var roll = Math.max(roll1, roll2);
        return {
            roll: roll,
            isCrit: roll >= 20,
            isFumble: roll === 1,
            rolls: [roll1, roll2],
            hadAdvantage: true
        };
    }

    /**
     * Roll with disadvantage using BattleDice if available
     * @returns {Object} { roll, isCrit, isFumble, rolls, hadDisadvantage }
     */
    function rollWithDisadvantage() {
        if (hasBattleDice() && BattleDice.rollWithDisadvantage) {
            return BattleDice.rollWithDisadvantage();
        }
        // Fallback: roll twice, take lower
        var roll1 = Math.floor(Math.random() * 20) + 1;
        var roll2 = Math.floor(Math.random() * 20) + 1;
        var roll = Math.min(roll1, roll2);
        return {
            roll: roll,
            isCrit: roll >= 20,
            isFumble: roll === 1,
            rolls: [roll1, roll2],
            hadDisadvantage: true
        };
    }

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
    // TEXT UTILITIES (for battle log rendering)
    // =========================================================================

    /**
     * Measure text and split into lines that fit within a container width.
     * Uses a hidden measurement element to calculate where line breaks occur.
     * Words are kept as units (including trailing punctuation like ., , ! ? : ;)
     * @param {string} text - Plain text to measure (HTML should be stripped)
     * @param {HTMLElement} container - Container to measure against (for width/font)
     * @returns {string[]} Array of line strings
     */
    function measureTextLines(text, container) {
        if (!container || !text) return [text || ''];

        // Create measurement element with same styling as container
        var measure = document.createElement('span');
        measure.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;';
        // Copy font styling from container
        var style = window.getComputedStyle(container);
        measure.style.font = style.font;
        measure.style.fontSize = style.fontSize;
        measure.style.fontFamily = style.fontFamily;
        measure.style.letterSpacing = style.letterSpacing;
        document.body.appendChild(measure);

        // Use parent's clientWidth if container has no width (rows inherit from content)
        var containerWidth = container.clientWidth;
        if (containerWidth === 0 && container.parentElement) {
            containerWidth = container.parentElement.clientWidth;
        }
        var lines = [];
        var currentLine = '';

        // Split by whitespace but keep words with their punctuation as units
        // \S+ matches non-whitespace sequences (words + punctuation together)
        // \s+ matches whitespace sequences
        var tokens = text.match(/\S+|\s+/g) || [];

        for (var i = 0; i < tokens.length; i++) {
            var token = tokens[i];
            var testLine = currentLine + token;
            measure.textContent = testLine;

            if (measure.offsetWidth > containerWidth && currentLine !== '') {
                // Current line is full, start new line
                lines.push(currentLine);
                // Skip leading whitespace for new line
                currentLine = /^\s/.test(token) ? '' : token;
            } else {
                currentLine = testLine;
            }
        }

        // Don't forget the last line
        if (currentLine) {
            lines.push(currentLine);
        }

        document.body.removeChild(measure);
        return lines.length > 0 ? lines : [''];
    }

    /**
     * Get the two fixed row elements for battle log
     * @returns {Object|null} { row1, row2 } or null if not available
     */
    function getBattleLogRows() {
        var row1 = document.getElementById('battle-log-row-1');
        var row2 = document.getElementById('battle-log-row-2');
        if (!row1 || !row2) return null;
        return { row1: row1, row2: row2 };
    }

    /**
     * Shift battle log rows: move row2 content to row1, clear row2
     * @param {Object} rows - { row1, row2 } from getBattleLogRows
     */
    function shiftBattleLogRows(rows) {
        if (!rows) return;
        rows.row1.innerHTML = rows.row2.innerHTML;
        rows.row2.innerHTML = '';
    }

    /**
     * Clear both battle log rows
     * @param {Object} rows - { row1, row2 } from getBattleLogRows
     */
    function clearBattleLogRows(rows) {
        if (!rows) return;
        rows.row1.innerHTML = '';
        rows.row2.innerHTML = '';
    }

    /**
     * Check if row2 has overflowed (content taller than one line).
     * Uses actual DOM measurements. Does NOT modify anything.
     * @param {Object} rows - { row1, row2 } from getBattleLogRows (optional, will fetch if not provided)
     * @returns {boolean} - true if overflow detected
     */
    function checkBattleLogOverflow(rows) {
        rows = rows || getBattleLogRows();
        if (!rows || !rows.row2) {
            return false;
        }

        // Get computed line height for comparison
        var style = window.getComputedStyle(rows.row2);
        var lineHeight = parseFloat(style.lineHeight);
        if (isNaN(lineHeight)) {
            // Fallback: line-height might be 'normal', use font-size * 1.6
            lineHeight = parseFloat(style.fontSize) * 1.6;
        }

        // Check if row2 content height exceeds single line height (with small tolerance)
        var contentHeight = rows.row2.scrollHeight;
        return contentHeight > (lineHeight * 1.2);
    }

    /**
     * Check and handle overflow - shifts rows if overflow detected.
     * @param {Object} rows - { row1, row2 } from getBattleLogRows (optional, will fetch if not provided)
     * @returns {boolean} - true if a shift occurred
     */
    function handleBattleLogOverflow(rows) {
        rows = rows || getBattleLogRows();
        if (checkBattleLogOverflow(rows)) {
            shiftBattleLogRows(rows);
            return true;
        }
        return false;
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        // Shared SFX callback
        setSfxCallback: setSfxCallback,
        playSfx: playSfx,

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
        getAllDependencies: getAllDependencies,
        validateDependencies: validateDependencies,

        // Status effect utilities
        getStatusModifiers: getStatusModifiers,
        getStatusACModifier: getStatusACModifier,
        getStatusAttackModifier: getStatusAttackModifier,
        getStatusDamageModifier: getStatusDamageModifier,
        tryApplyStatus: tryApplyStatus,
        findStatusSourceName: findStatusSourceName,

        // Dice utilities
        rollD20: rollD20,
        rollWithAdvantage: rollWithAdvantage,
        rollWithDisadvantage: rollWithDisadvantage,
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
        findMoveWithStatus: findMoveWithStatus,

        // Text utilities (for battle log rendering)
        measureTextLines: measureTextLines,
        getBattleLogRows: getBattleLogRows,
        shiftBattleLogRows: shiftBattleLogRows,
        clearBattleLogRows: clearBattleLogRows,
        checkBattleLogOverflow: checkBattleLogOverflow,
        handleBattleLogOverflow: handleBattleLogOverflow
    };
})();
