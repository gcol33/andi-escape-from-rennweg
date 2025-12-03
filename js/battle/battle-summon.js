/**
 * Andi VN - Battle Summon System
 *
 * Manages summoned entities for both enemies and players.
 * Summons are separate combatants that:
 * - Have their own HP and can be targeted/killed
 * - Act at the end of their summoner's turn
 * - Can expire after X turns
 * - Can protect their master (intercept attacks when master is low HP)
 *
 * This module handles the data/state side. Visual display is in BattleUI.
 *
 * Two modes of operation:
 * 1. Player summons (spirits/companions) - loaded from BattleData.getSummon()
 *    These are typically support summons without separate HP bars.
 * 2. Enemy summons (minions) - loaded from summons.js via BattleSummon.getDefinition()
 *    These are full combatants with HP that can be targeted.
 *
 * Usage:
 *   // For enemy summons (new system)
 *   BattleSummon.spawn(summonId, summonerId, 'enemy');
 *   BattleSummon.getActiveBySide('enemy');
 *   BattleSummon.processTurn('enemy', playerTarget);
 *   BattleSummon.takeDamage(uid, damage);
 *   BattleSummon.checkIntercept(summonerId, masterHpPercent);
 *
 *   // For player summons (legacy support, wraps existing system)
 *   BattleSummon.spawnPlayerSummon(summonId);  // Uses BattleData
 *   BattleSummon.processPlayerSummonTurn();
 */

var BattleSummon = (function() {
    'use strict';

    // =========================================================================
    // DEPENDENCIES
    // =========================================================================

    var _hasTuning = typeof TUNING !== 'undefined';
    var _hasBattleData = typeof BattleData !== 'undefined';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    var config = {
        // Max summons per summoner
        maxPerSummoner: 1,
        // Default duration (turns) if not specified
        defaultDuration: 3,
        // HP threshold for master to trigger protection intercept
        masterLowHpThreshold: _hasTuning && TUNING.battle.summon
            ? TUNING.battle.summon.masterLowHpThreshold
            : 0.4,
        // Chance for summon to intercept attack when master is low HP
        interceptChance: _hasTuning && TUNING.battle.summon
            ? TUNING.battle.summon.interceptChance
            : 0.4,
        // Turns remaining to trigger "expiring soon" warning
        expiringWarnTurns: 2
    };

    // =========================================================================
    // STATE
    // =========================================================================

    // Active summons indexed by unique ID
    // Structure: { [uniqueId]: { ... summon data ... } }
    var activeSummons = {};

    // Counter for generating unique IDs
    var nextSummonUid = 1;

    // Summon definitions loaded from summons.js
    var summonDefinitions = {};

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /**
     * Initialize the summon system
     * @param {Object} definitions - Summon definitions from summons.js
     */
    function init(definitions) {
        summonDefinitions = definitions || {};
        reset();
    }

    /**
     * Reset all summon state (call at battle start/end)
     */
    function reset() {
        activeSummons = {};
        nextSummonUid = 1;
    }

    // =========================================================================
    // SUMMON DEFINITIONS
    // =========================================================================

    /**
     * Get summon definition by ID
     * @param {string} summonId - The summon type ID (e.g., 'office_intern')
     * @returns {Object|null} Summon definition or null
     */
    function getDefinition(summonId) {
        return summonDefinitions[summonId] || null;
    }

    /**
     * Register a summon definition (for dynamic loading)
     * @param {string} summonId - Unique summon ID
     * @param {Object} definition - Summon definition object
     */
    function registerDefinition(summonId, definition) {
        summonDefinitions[summonId] = definition;
    }

    // =========================================================================
    // SPAWNING & DISMISSING
    // =========================================================================

    /**
     * Spawn a summon
     * @param {string} summonId - The summon type ID
     * @param {string} summonerId - ID of the summoner (enemy ID or 'player')
     * @param {string} side - 'enemy' or 'player'
     * @param {Object} options - Optional overrides (duration, etc.)
     * @returns {Object} { success, summon, message }
     */
    function spawn(summonId, summonerId, side, options) {
        options = options || {};

        // Get definition
        var def = getDefinition(summonId);
        if (!def) {
            console.warn('[BattleSummon] Unknown summon ID:', summonId);
            return {
                success: false,
                reason: 'unknown_summon',
                message: 'Unknown summon: ' + summonId
            };
        }

        // Check if summoner already has max summons
        var existingSummons = getActiveBySummoner(summonerId);
        if (existingSummons.length >= config.maxPerSummoner) {
            return {
                success: false,
                reason: 'max_summons',
                message: 'Cannot summon more allies!'
            };
        }

        // Create summon instance
        var uid = 'summon_' + nextSummonUid++;
        var summon = {
            uid: uid,
            id: summonId,
            summonerId: summonerId,
            side: side,
            name: def.name,
            sprite: def.sprite || null,
            icon: def.icon || '👤',

            // Combat stats
            hp: options.hp || def.hp || 10,
            maxHp: options.hp || def.hp || 10,
            ac: options.ac || def.ac || 10,
            damage: options.damage || def.damage || 'd4',
            damageType: options.damageType || def.damageType || 'physical',
            attackBonus: options.attackBonus || def.attackBonus || 0,

            // Duration
            duration: options.duration || def.duration || config.defaultDuration,
            maxDuration: options.duration || def.duration || config.defaultDuration,
            turnsRemaining: options.duration || def.duration || config.defaultDuration,

            // Behavior flags
            canProtect: def.canProtect !== false,  // Default true
            canAttack: def.canAttack !== false,    // Default true
            canHeal: def.healAmount > 0,
            healAmount: def.healAmount || 0,

            // Moves (optional, for variety)
            moves: def.moves || null,

            // Dialogue
            dialogue: def.dialogue || {},

            // Visual state
            isExpiringWarning: false,
            isLowHp: false
        };

        activeSummons[uid] = summon;

        return {
            success: true,
            summon: summon,
            message: summon.name + ' joins the battle!'
        };
    }

    /**
     * Dismiss a summon (death or expiration)
     * @param {string} uid - Unique summon ID
     * @param {string} reason - 'killed', 'expired', 'dismissed'
     * @returns {Object} { success, summon, message }
     */
    function dismiss(uid, reason) {
        var summon = activeSummons[uid];
        if (!summon) {
            return { success: false, reason: 'not_found' };
        }

        delete activeSummons[uid];

        var message = summon.name;
        switch (reason) {
            case 'killed':
                message += ' has been defeated!';
                break;
            case 'expired':
                message += ' fades away...';
                break;
            case 'dismissed':
                message += ' is recalled!';
                break;
            default:
                message += ' disappears!';
        }

        return {
            success: true,
            summon: summon,
            reason: reason,
            message: message
        };
    }

    // =========================================================================
    // QUERIES
    // =========================================================================

    /**
     * Get all active summons
     * @returns {Array} Array of active summons
     */
    function getAll() {
        var result = [];
        for (var uid in activeSummons) {
            result.push(activeSummons[uid]);
        }
        return result;
    }

    /**
     * Get active summons by side
     * @param {string} side - 'enemy' or 'player'
     * @returns {Array} Array of summons on that side
     */
    function getActiveBySide(side) {
        var result = [];
        for (var uid in activeSummons) {
            if (activeSummons[uid].side === side) {
                result.push(activeSummons[uid]);
            }
        }
        return result;
    }

    /**
     * Get active summons by summoner
     * @param {string} summonerId - Summoner ID
     * @returns {Array} Array of summons from that summoner
     */
    function getActiveBySummoner(summonerId) {
        var result = [];
        for (var uid in activeSummons) {
            if (activeSummons[uid].summonerId === summonerId) {
                result.push(activeSummons[uid]);
            }
        }
        return result;
    }

    /**
     * Get a summon by unique ID
     * @param {string} uid - Unique summon ID
     * @returns {Object|null} Summon or null
     */
    function getByUid(uid) {
        return activeSummons[uid] || null;
    }

    /**
     * Check if a side has any active summons
     * @param {string} side - 'enemy' or 'player'
     * @returns {boolean}
     */
    function hasSummons(side) {
        for (var uid in activeSummons) {
            if (activeSummons[uid].side === side) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get all valid targets on a side (for player targeting)
     * @param {string} side - 'enemy' or 'player'
     * @param {Object} mainCombatant - The main enemy or player object
     * @returns {Array} Array of { type, uid/id, name, hp, maxHp }
     */
    function getTargets(side, mainCombatant) {
        var targets = [];

        // Add main combatant first
        if (mainCombatant) {
            targets.push({
                type: 'main',
                id: mainCombatant.id || side,
                name: mainCombatant.name || (side === 'enemy' ? 'Enemy' : 'Player'),
                hp: mainCombatant.hp,
                maxHp: mainCombatant.maxHP || mainCombatant.maxHp
            });
        }

        // Add summons
        var summons = getActiveBySide(side);
        for (var i = 0; i < summons.length; i++) {
            targets.push({
                type: 'summon',
                uid: summons[i].uid,
                id: summons[i].id,
                name: summons[i].name,
                hp: summons[i].hp,
                maxHp: summons[i].maxHp
            });
        }

        return targets;
    }

    // =========================================================================
    // COMBAT
    // =========================================================================

    /**
     * Deal damage to a summon
     * @param {string} uid - Unique summon ID
     * @param {number} damage - Damage amount
     * @param {Object} options - { type, source, isCrit }
     * @returns {Object} { success, damage, killed, summon, message }
     */
    function takeDamage(uid, damage, options) {
        options = options || {};
        var summon = activeSummons[uid];
        if (!summon) {
            return { success: false, reason: 'not_found' };
        }

        var actualDamage = Math.max(0, Math.min(damage, summon.hp));
        summon.hp -= actualDamage;

        // Update low HP flag
        summon.isLowHp = summon.hp <= summon.maxHp * 0.3;

        var killed = summon.hp <= 0;
        var message = summon.name + ' takes ' + actualDamage + ' damage!';

        if (killed) {
            var dismissResult = dismiss(uid, 'killed');
            message = dismissResult.message;
        }

        return {
            success: true,
            damage: actualDamage,
            killed: killed,
            summon: summon,
            message: message
        };
    }

    /**
     * Heal a summon
     * @param {string} uid - Unique summon ID
     * @param {number} amount - Heal amount
     * @returns {Object} { success, healed, summon }
     */
    function heal(uid, amount) {
        var summon = activeSummons[uid];
        if (!summon) {
            return { success: false, reason: 'not_found' };
        }

        var actualHeal = Math.min(amount, summon.maxHp - summon.hp);
        summon.hp += actualHeal;

        // Update low HP flag
        summon.isLowHp = summon.hp <= summon.maxHp * 0.3;

        return {
            success: true,
            healed: actualHeal,
            summon: summon
        };
    }

    /**
     * Check if a summon should intercept an attack aimed at master
     * @param {string} summonerId - ID of the potential master
     * @param {number} masterHpPercent - Master's HP as percentage (0-1)
     * @returns {Object|null} Summon that will intercept, or null
     */
    function checkIntercept(summonerId, masterHpPercent) {
        // Only intercept if master is low HP
        if (masterHpPercent > config.masterLowHpThreshold) {
            return null;
        }

        // Find summons that can protect this master
        var summons = getActiveBySummoner(summonerId);
        for (var i = 0; i < summons.length; i++) {
            var summon = summons[i];
            if (!summon.canProtect) continue;
            if (summon.hp <= 0) continue;

            // Roll for intercept
            if (Math.random() < config.interceptChance) {
                return summon;
            }
        }

        return null;
    }

    // =========================================================================
    // TURN PROCESSING
    // =========================================================================

    /**
     * Process turn for all summons of a side
     * Called at end of summoner's turn
     * @param {string} side - 'enemy' or 'player'
     * @param {Object} targetSide - The opposing combatant(s) to attack
     * @returns {Object} { actions: [...], messages: [...], expired: [...] }
     */
    function processTurn(side, targetSide) {
        var summons = getActiveBySide(side);
        var result = {
            actions: [],
            messages: [],
            expired: []
        };

        for (var i = 0; i < summons.length; i++) {
            var summon = summons[i];

            // Check for expiration first (at START of their turn)
            summon.turnsRemaining--;

            // Update expiring warning flag
            summon.isExpiringWarning = summon.turnsRemaining <= config.expiringWarnTurns &&
                                       summon.turnsRemaining > 0;

            if (summon.turnsRemaining <= 0) {
                var expireResult = dismiss(summon.uid, 'expired');
                result.expired.push(summon);
                result.messages.push(expireResult.message);
                continue;
            }

            // Summon action
            var action = processSummonAction(summon, targetSide);
            if (action) {
                result.actions.push(action);
                if (action.message) {
                    result.messages.push(action.message);
                }
            }
        }

        return result;
    }

    /**
     * Process a single summon's action
     * @param {Object} summon - The summon
     * @param {Object} target - Target to attack (main combatant)
     * @returns {Object|null} Action result or null
     */
    function processSummonAction(summon, target) {
        // Summons that can heal do that (support type)
        if (summon.canHeal && summon.healAmount > 0) {
            // TODO: Implement heal targeting (master or allies)
            return {
                type: 'heal',
                summon: summon,
                amount: summon.healAmount,
                message: summon.name + ' provides support!'
            };
        }

        // Summons that can attack do that
        if (summon.canAttack && target) {
            // Select a move or use basic attack
            var move = selectMove(summon);
            return {
                type: 'attack',
                summon: summon,
                move: move,
                target: target,
                message: summon.name + ' attacks!'
            };
        }

        return null;
    }

    /**
     * Select a move for summon to use
     * @param {Object} summon - The summon
     * @returns {Object} Move to use
     */
    function selectMove(summon) {
        // If summon has moves array, pick one randomly
        if (summon.moves && summon.moves.length > 0) {
            return summon.moves[Math.floor(Math.random() * summon.moves.length)];
        }

        // Default basic attack
        return {
            name: 'Attack',
            damage: summon.damage,
            type: summon.damageType,
            attackBonus: summon.attackBonus
        };
    }

    // =========================================================================
    // DIALOGUE
    // =========================================================================

    /**
     * Get dialogue line for summon
     * @param {string} uid - Summon unique ID
     * @param {string} situation - Dialogue situation key
     * @returns {string|null} Dialogue line or null
     */
    function getDialogue(uid, situation) {
        var summon = activeSummons[uid];
        if (!summon || !summon.dialogue) return null;

        var lines = summon.dialogue[situation];
        if (!lines || lines.length === 0) return null;

        return lines[Math.floor(Math.random() * lines.length)];
    }

    // =========================================================================
    // DISPLAY HELPERS
    // =========================================================================

    /**
     * Get display data for a summon (for UI rendering)
     * @param {string} uid - Summon unique ID
     * @returns {Object|null} Display data or null
     */
    function getDisplayData(uid) {
        var summon = activeSummons[uid];
        if (!summon) return null;

        return {
            uid: summon.uid,
            name: summon.name,
            icon: summon.icon,
            sprite: summon.sprite,
            hp: summon.hp,
            maxHp: summon.maxHp,
            hpPercent: Math.round((summon.hp / summon.maxHp) * 100),
            turnsRemaining: summon.turnsRemaining,
            maxDuration: summon.maxDuration,
            isLowHp: summon.isLowHp,
            isExpiringWarning: summon.isExpiringWarning,
            side: summon.side
        };
    }

    /**
     * Get display data for all summons on a side
     * @param {string} side - 'enemy' or 'player'
     * @returns {Array} Array of display data objects
     */
    function getAllDisplayData(side) {
        var summons = side ? getActiveBySide(side) : getAll();
        var result = [];
        for (var i = 0; i < summons.length; i++) {
            result.push(getDisplayData(summons[i].uid));
        }
        return result;
    }

    // =========================================================================
    // PLAYER SUMMON LEGACY SUPPORT
    // =========================================================================

    // Legacy player summon state (for BattleData-style summons without HP)
    var playerSummon = null;

    /**
     * Spawn a player summon using BattleData definitions
     * Legacy support for the original player summon system
     * @param {string} summonId - Summon ID from BattleData
     * @returns {Object} { success, summon, message }
     */
    function spawnPlayerSummon(summonId) {
        if (!_hasBattleData) {
            return { success: false, reason: 'no_data' };
        }

        var def = BattleData.getSummon(summonId);
        if (!def) {
            return { success: false, reason: 'unknown_summon' };
        }

        if (playerSummon) {
            return { success: false, reason: 'summon_active', message: 'A summon is already active!' };
        }

        playerSummon = {
            id: summonId,
            name: def.name,
            icon: def.icon,
            duration: def.duration,
            attack: def.attack || null,
            healPerTurn: def.healPerTurn || 0,
            passive: def.passive || null,
            sprite: def.sprite || null
        };

        return {
            success: true,
            summon: playerSummon,
            message: def.icon + ' ' + def.name + ' appears!'
        };
    }

    /**
     * Get current player summon (legacy)
     * @returns {Object|null} Player summon or null
     */
    function getPlayerSummon() {
        return playerSummon;
    }

    /**
     * Dismiss player summon (legacy)
     * @returns {boolean} True if dismissed
     */
    function dismissPlayerSummon() {
        if (!playerSummon) return false;
        playerSummon = null;
        return true;
    }

    /**
     * Process player summon turn (legacy)
     * Returns action data but doesn't execute - caller should handle damage/heal
     * @param {Object} enemy - Enemy target for attacks
     * @param {Object} styleModule - Active battle style for attack resolution
     * @returns {Object} { acted, messages, healResult, attackResult }
     */
    function processPlayerSummonTurn(enemy, styleModule) {
        if (!playerSummon) return { acted: false, messages: [] };

        var messages = [];
        var healResult = null;
        var attackResult = null;

        // Healing
        if (playerSummon.healPerTurn > 0) {
            healResult = {
                amount: playerSummon.healPerTurn
            };
            // Message will be added by caller after applying heal
        }

        // Attack (delegated to style)
        if (playerSummon.attack && styleModule && styleModule.resolveSummonAttack) {
            attackResult = styleModule.resolveSummonAttack(playerSummon, enemy);
            if (attackResult.hit) {
                messages.push(playerSummon.icon + ' ' + playerSummon.name + ' uses ' +
                    playerSummon.attack.name + '!');
            } else {
                messages.push(playerSummon.icon + ' ' + playerSummon.name + '\'s ' +
                    playerSummon.attack.name + ' missed!');
            }
        }

        // Decrement duration
        playerSummon.duration--;
        var expired = playerSummon.duration <= 0;
        if (expired) {
            messages.push(playerSummon.icon + ' ' + playerSummon.name + ' fades away...');
            playerSummon = null;
        }

        return {
            acted: true,
            messages: messages,
            healResult: healResult,
            attackResult: attackResult,
            expired: expired
        };
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        // Initialization
        init: init,
        reset: reset,

        // Definitions
        getDefinition: getDefinition,
        registerDefinition: registerDefinition,

        // Spawning (enemy/general summons with HP)
        spawn: spawn,
        dismiss: dismiss,

        // Queries
        getAll: getAll,
        getActiveBySide: getActiveBySide,
        getActiveBySummoner: getActiveBySummoner,
        getByUid: getByUid,
        hasSummons: hasSummons,
        getTargets: getTargets,

        // Combat
        takeDamage: takeDamage,
        heal: heal,
        checkIntercept: checkIntercept,

        // Turn processing (enemy/general summons)
        processTurn: processTurn,

        // Dialogue
        getDialogue: getDialogue,

        // Display
        getDisplayData: getDisplayData,
        getAllDisplayData: getAllDisplayData,

        // Player summon legacy support (BattleData-style summons without HP)
        spawnPlayerSummon: spawnPlayerSummon,
        getPlayerSummon: getPlayerSummon,
        dismissPlayerSummon: dismissPlayerSummon,
        processPlayerSummonTurn: processPlayerSummonTurn,

        // Config access (for tuning)
        config: config
    };
})();
