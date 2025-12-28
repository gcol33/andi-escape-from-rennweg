/**
 * Andi VN - Battle Intent System
 *
 * Telegraphs powerful enemy abilities before execution (like Slay the Spire).
 * Enemies "prepare" for one turn, then execute the telegraphed move.
 *
 * Intent Types:
 *   - summon: Concentrating to summon ally/allies (broken by any status effect)
 *   - big_attack: Preparing a powerful single attack (counter by defending)
 *   - multi_hit: Preparing a multi-hit attack (counter with defense-boosting skills)
 *
 * Flow:
 *   1. Trigger conditions checked (random chance, turn count, HP threshold)
 *   2. Enemy announces preparation via dialogue + battle log
 *   3. Icon appears above enemy
 *   4. Enemy still does normal attack during preparation turn
 *   5. Next turn: Enemy executes the telegraphed skill, icon disappears
 *
 * Interruption:
 *   - Concentration (summon) can be broken by applying any status effect
 *   - On break: visual/audio feedback, enemy does basic attack instead
 *
 * Usage:
 *   BattleIntent.generate(enemy, player);  // Check if intent should trigger
 *   BattleIntent.tick();                   // Decrement prep counter
 *   BattleIntent.isReady();                // Check if ready to execute
 *   BattleIntent.getSkill();               // Get skill to execute
 *   BattleIntent.clear();                  // After execution/interruption
 */

var BattleIntent = (function() {
    'use strict';

    // Use Logger module with fallback via Utils
    var _log = Utils.getLogger();

    // =========================================================================
    // INTENT TYPE DEFINITIONS
    // =========================================================================

    var intentTypes = {
        summon: {
            id: 'summon',
            name: 'Summoning',
            icon: '✦',
            cssClass: 'intent-summon',
            description: 'Concentrating to summon reinforcements',
            canBreak: true,
            breakCondition: 'status',
            breakMessage: 'Concentration broken!'
        },
        big_attack: {
            id: 'big_attack',
            name: 'Big Attack',
            icon: '⚠',
            cssClass: 'intent-big-attack',
            description: 'Preparing a devastating attack',
            canBreak: false,
            counterHint: 'Defend to reduce damage!'
        },
        multi_hit: {
            id: 'multi_hit',
            name: 'Multi-Hit',
            icon: '⚔',
            cssClass: 'intent-multi-hit',
            description: 'Preparing a multi-hit combo',
            canBreak: false,
            counterHint: 'Boost defense to mitigate!'
        }
    };

    // Legacy icons for basic intent display (backwards compatibility)
    var INTENT_ICONS = {
        attack: '⚔️',
        skill: '✨',
        defend: '🛡️',
        charging: '⚡',
        special: '💀',
        heal: '💚',
        buff: '⬆️',
        debuff: '⬇️',
        // New telegraphed types
        summon: '✦',
        big_attack: '⚠',
        multi_hit: '⚔'
    };

    // =========================================================================
    // STATE
    // =========================================================================

    var currentIntent = null;
    var intentHistory = [];

    // =========================================================================
    // CONFIGURATION HELPERS
    // =========================================================================

    /**
     * Get intent configuration for a specific enemy
     */
    function getIntentConfig(enemy) {
        return enemy.intents || null;
    }

    /**
     * Check if enemy has telegraphed intent skills configured
     */
    function hasIntents(enemy) {
        return enemy.intents && enemy.intents.length > 0;
    }

    // =========================================================================
    // TRIGGER CONDITIONS
    // =========================================================================

    /**
     * Check if an intent should trigger this turn
     */
    function shouldTrigger(intentConfig, enemy, player, turn, forceGenerate) {
        // Check cooldown (still applies even in force mode)
        var cooldown = intentConfig.cooldown || 3;
        var lastUsed = getLastUsedTurn(intentConfig.id, enemy.id);
        if (lastUsed !== null && (turn - lastUsed) < cooldown) {
            return false;
        }

        // Check minimum turn requirement
        var minTurn = intentConfig.minTurn || 1;
        if (turn < minTurn) return false;

        // Check HP threshold
        if (intentConfig.hpThreshold) {
            var hpPercent = enemy.hp / enemy.maxHP;
            if (hpPercent > intentConfig.hpThreshold) return false;
        }

        // In force mode (intents-only phase), skip random chance
        if (forceGenerate) {
            return true;
        }

        // Random chance
        var chance = intentConfig.chance || 0.2;
        if (Math.random() > chance) return false;

        return true;
    }

    function getLastUsedTurn(intentId, enemyId) {
        for (var i = intentHistory.length - 1; i >= 0; i--) {
            var record = intentHistory[i];
            if (record.intentId === intentId && record.enemyId === enemyId) {
                return record.turn;
            }
        }
        return null;
    }

    function recordIntentUsed(intentId, enemyId, turn) {
        intentHistory.push({
            intentId: intentId,
            enemyId: enemyId,
            turn: turn
        });
        if (intentHistory.length > 50) {
            intentHistory.shift();
        }
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        // Intent type definitions
        intentTypes: intentTypes,

        /**
         * Get intent type definition
         */
        getType: function(typeId) {
            return intentTypes[typeId] || null;
        },

        /**
         * Set enemy intent directly (legacy support)
         */
        set: function(type, moveId, data) {
            currentIntent = {
                type: type,
                moveId: moveId || null,
                data: data || null,
                icon: INTENT_ICONS[type] || INTENT_ICONS.attack,
                // Telegraphed intent fields (for new system)
                isTelegraphed: false,
                turnsRemaining: 0
            };
        },

        /**
         * Get current intent
         */
        get: function() {
            return currentIntent;
        },

        /**
         * Check if there's an active intent
         */
        isActive: function() {
            return currentIntent !== null;
        },

        /**
         * Check if current intent is a telegraphed (preparation) intent
         */
        isTelegraphed: function() {
            return currentIntent && currentIntent.isTelegraphed;
        },

        /**
         * Clear current intent
         */
        clear: function(turn) {
            if (currentIntent && currentIntent.isTelegraphed && turn !== undefined) {
                recordIntentUsed(currentIntent.id, currentIntent.enemyId, turn);
            }
            currentIntent = null;
        },

        /**
         * Generate intent based on AI behavior
         * Now checks for telegraphed intents first, then falls back to basic intent
         * @param {Object} enemy - Enemy state
         * @param {Object} player - Player state
         * @param {boolean|number} forceGenerate - If true, force intent generation (intents-only phase)
         */
        generate: function(enemy, player, forceGenerate) {
            // Get turn from BattleCore
            var turn = 1;
            if (typeof BattleCore !== 'undefined') {
                var state = BattleCore.getState();
                turn = state.turn || 1;
            }

            // === NEW: Check for telegraphed intents first ===
            // Note: Must check when no intent OR when current intent is basic (non-telegraphed)
            // Otherwise the basic intent from LEGACY code blocks all future telegraphed checks
            if (hasIntents(enemy) && (!currentIntent || !currentIntent.isTelegraphed)) {
                var intents = enemy.intents;
                for (var i = 0; i < intents.length; i++) {
                    var intentConfig = intents[i];
                    if (shouldTrigger(intentConfig, enemy, player, turn, forceGenerate)) {
                        // Create telegraphed intent
                        var typeDef = intentTypes[intentConfig.type];
                        currentIntent = {
                            type: intentConfig.type,
                            id: intentConfig.id,
                            moveId: intentConfig.skillId || null,
                            skill: intentConfig.skill,
                            enemyId: enemy.id,
                            data: {
                                moveName: intentConfig.skill ? intentConfig.skill.name : intentConfig.type,
                                isHeal: false
                            },
                            icon: typeDef ? typeDef.icon : INTENT_ICONS[intentConfig.type] || '⚠',
                            cssClass: typeDef ? typeDef.cssClass : '',
                            // Telegraphed fields
                            isTelegraphed: true,
                            prepTurns: intentConfig.prepTurns || 1,
                            turnsRemaining: intentConfig.prepTurns || 1,
                            dialogue: intentConfig.dialogue,
                            executeDialogue: intentConfig.executeDialogue,
                            canBreak: typeDef ? typeDef.canBreak : false,
                            breakCondition: typeDef ? typeDef.breakCondition : null
                        };
                        return currentIntent;
                    }
                }
            }

            // If we already have a telegraphed intent, return it
            if (currentIntent && currentIntent.isTelegraphed) {
                return currentIntent;
            }

            // No telegraphed intent triggered this turn
            return null;
        },

        /**
         * Decrement turn counter for telegraphed intents
         * @returns {boolean} True if intent should execute next turn
         */
        tick: function() {
            if (!currentIntent || !currentIntent.isTelegraphed) {
                _log.debug('BattleIntent', 'tick() - no telegraphed intent');
                return false;
            }
            currentIntent.turnsRemaining--;
            _log.debug('BattleIntent', 'tick() - turnsRemaining now:', currentIntent.turnsRemaining);
            return currentIntent.turnsRemaining <= 0;
        },

        /**
         * Check if telegraphed intent is ready to execute
         */
        isReady: function() {
            return currentIntent && currentIntent.isTelegraphed && currentIntent.turnsRemaining <= 0;
        },

        /**
         * Get the skill data for the current telegraphed intent
         */
        getSkill: function() {
            if (!currentIntent || !currentIntent.skill) return null;
            return currentIntent.skill;
        },

        /**
         * Get icon for intent type
         */
        getIcon: function(type) {
            if (type === undefined && currentIntent) {
                return currentIntent.icon;
            }
            return INTENT_ICONS[type] || INTENT_ICONS.attack;
        },

        /**
         * Get CSS class for current intent
         */
        getCssClass: function() {
            if (!currentIntent) return '';
            return currentIntent.cssClass || '';
        },

        /**
         * Get all available icons
         */
        getIcons: function() {
            return Object.assign({}, INTENT_ICONS);
        },

        /**
         * Get display data for UI rendering
         */
        getDisplayData: function() {
            if (!currentIntent) return null;

            var typeDef = intentTypes[currentIntent.type];
            return {
                icon: currentIntent.icon,
                name: typeDef ? typeDef.name : currentIntent.type,
                cssClass: currentIntent.cssClass || '',
                description: typeDef ? typeDef.description : '',
                turnsRemaining: currentIntent.turnsRemaining || 0,
                counterHint: typeDef ? typeDef.counterHint : null,
                isTelegraphed: currentIntent.isTelegraphed || false
            };
        },

        // =====================================================================
        // INTERRUPTION
        // =====================================================================

        /**
         * Check if intent can be broken
         */
        canBreak: function() {
            if (!currentIntent || !currentIntent.isTelegraphed) return false;
            return currentIntent.canBreak || false;
        },

        /**
         * Check if a status effect would break the current intent
         */
        wouldBreak: function(statusType) {
            if (!currentIntent || !currentIntent.isTelegraphed) return false;
            if (!currentIntent.canBreak) return false;

            // Concentration is broken by ANY status effect
            if (currentIntent.breakCondition === 'status') {
                return true;
            }
            return false;
        },

        /**
         * Break the current intent
         */
        breakIntent: function(turn) {
            if (!currentIntent || !currentIntent.isTelegraphed) {
                return { broken: false };
            }

            var typeDef = intentTypes[currentIntent.type];
            var message = typeDef ? typeDef.breakMessage : 'Intent interrupted!';

            var result = {
                broken: true,
                intentType: currentIntent.type,
                message: message
            };

            this.clear(turn);
            return result;
        },

        // =====================================================================
        // DIALOGUE HELPERS
        // =====================================================================

        /**
         * Get the preparation dialogue for current intent
         */
        getPrepDialogue: function() {
            if (!currentIntent || !currentIntent.isTelegraphed) return null;
            return currentIntent.dialogue || null;
        },

        /**
         * Get the execution dialogue for current intent
         */
        getExecuteDialogue: function() {
            if (!currentIntent || !currentIntent.isTelegraphed) return null;
            return currentIntent.executeDialogue || null;
        },

        // =====================================================================
        // STATE MANAGEMENT
        // =====================================================================

        /**
         * Check if enemy has telegraphed intents configured
         */
        hasIntents: hasIntents,

        /**
         * Get intent configuration for enemy
         */
        getIntentConfig: getIntentConfig,

        /**
         * Reset all intent state
         */
        reset: function() {
            currentIntent = null;
            intentHistory = [];
        }
    };
})();
