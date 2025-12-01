/**
 * Andi VN - Battle Intent System
 *
 * Standalone module for enemy intent/telegraph mechanics.
 * Enemies show what action they'll take next turn, allowing
 * strategic player decisions.
 *
 * Intent Types:
 *   - 'attack': Basic attack incoming
 *   - 'skill': Using a specific skill (moveId provided)
 *   - 'defend': Enemy will defend
 *   - 'charging': Charging a powerful attack
 *   - 'special': Unique boss action
 *
 * Usage:
 *   BattleIntent.generate(enemy, player);  // AI decides next action
 *   var intent = BattleIntent.get();       // { type, moveId, data }
 *   BattleIntent.clear();                  // After action resolves
 */

var BattleIntent = (function() {
    'use strict';

    // =========================================================================
    // DEPENDENCIES
    // =========================================================================

    var _hasBattleData = typeof BattleData !== 'undefined';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    var T = typeof TUNING !== 'undefined' ? TUNING : null;
    var config = {
        healThreshold: T && T.battle.ai ? T.battle.ai.healThreshold : 0.3,
        defendThreshold: T && T.battle.ai ? T.battle.ai.defendThreshold : 0.4,
        skillChance: 0.6  // 60% chance to use skill vs basic attack
    };

    // =========================================================================
    // INTENT ICONS
    // =========================================================================

    var INTENT_ICONS = {
        attack: '⚔️',
        skill: '✨',
        defend: '🛡️',
        charging: '⚡',
        special: '💀',
        heal: '💚',
        buff: '⬆️',
        debuff: '⬇️'
    };

    // =========================================================================
    // STATE
    // =========================================================================

    var currentIntent = null;

    // =========================================================================
    // PRIVATE FUNCTIONS
    // =========================================================================

    /**
     * Find a healing move from enemy's moveset
     */
    function findHealMove(moves) {
        if (!_hasBattleData) return null;
        for (var i = 0; i < moves.length; i++) {
            var move = BattleData.getSkill(moves[i]);
            if (move && move.healAmount) {
                return { id: moves[i], move: move };
            }
        }
        return null;
    }

    /**
     * Find a buff move from enemy's moveset
     */
    function findBuffMove(moves) {
        if (!_hasBattleData) return null;
        for (var i = 0; i < moves.length; i++) {
            var move = BattleData.getSkill(moves[i]);
            if (move && move.isBuff) {
                return { id: moves[i], move: move };
            }
        }
        return null;
    }

    /**
     * Get a random skill from enemy's moveset
     */
    function getRandomSkill(moves) {
        if (moves.length === 0) return null;
        var randomId = moves[Math.floor(Math.random() * moves.length)];
        var move = _hasBattleData ? BattleData.getSkill(randomId) : null;
        return { id: randomId, move: move };
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        /**
         * Set enemy intent directly
         * @param {string} type - Intent type
         * @param {string} moveId - Optional skill ID
         * @param {Object} data - Optional extra data
         */
        set: function(type, moveId, data) {
            currentIntent = {
                type: type,
                moveId: moveId || null,
                data: data || null,
                icon: INTENT_ICONS[type] || INTENT_ICONS.attack
            };
        },

        /**
         * Get current intent
         * @returns {Object|null} { type, moveId, data, icon }
         */
        get: function() {
            return currentIntent;
        },

        /**
         * Clear current intent
         */
        clear: function() {
            currentIntent = null;
        },

        /**
         * Generate intent based on AI behavior
         * @param {Object} enemy - Enemy state { hp, maxHP, moves, ai }
         * @param {Object} player - Player state { hp, maxHP }
         * @returns {Object} Generated intent
         */
        generate: function(enemy, player) {
            var moves = enemy.moves || [];
            var hpPercent = enemy.hp / enemy.maxHP;
            var intent = { type: 'attack', moveId: null, data: null };

            // Priority 1: Heal if low HP
            if (hpPercent < config.healThreshold) {
                var healMove = findHealMove(moves);
                if (healMove) {
                    intent = {
                        type: 'skill',
                        moveId: healMove.id,
                        data: { isHeal: true, moveName: healMove.move ? healMove.move.name : 'Heal' }
                    };
                    intent.icon = INTENT_ICONS.heal;
                    this.set(intent.type, intent.moveId, intent.data);
                    currentIntent.icon = intent.icon;
                    return currentIntent;
                }
            }

            // Priority 2: Defend occasionally when hurt
            if (hpPercent < config.defendThreshold && Math.random() < 0.2) {
                intent = { type: 'defend', moveId: null, data: null };
                this.set(intent.type, intent.moveId, intent.data);
                return currentIntent;
            }

            // Priority 3: Use skill (60% chance if available)
            if (moves.length > 0 && Math.random() < config.skillChance) {
                var skill = getRandomSkill(moves);
                if (skill) {
                    var skillIcon = INTENT_ICONS.skill;
                    if (skill.move) {
                        if (skill.move.isHeal) skillIcon = INTENT_ICONS.heal;
                        else if (skill.move.isBuff) skillIcon = INTENT_ICONS.buff;
                        else if (skill.move.statusEffect) skillIcon = INTENT_ICONS.debuff;
                    }
                    intent = {
                        type: 'skill',
                        moveId: skill.id,
                        data: { moveName: skill.move ? skill.move.name : skill.id }
                    };
                    this.set(intent.type, intent.moveId, intent.data);
                    currentIntent.icon = skillIcon;
                    return currentIntent;
                }
            }

            // Default: Basic attack
            this.set('attack', null, null);
            return currentIntent;
        },

        /**
         * Get icon for intent type
         * @param {string} type - Intent type
         * @returns {string} Emoji icon
         */
        getIcon: function(type) {
            return INTENT_ICONS[type] || INTENT_ICONS.attack;
        },

        /**
         * Get all available icons (for UI reference)
         * @returns {Object}
         */
        getIcons: function() {
            return Object.assign({}, INTENT_ICONS);
        },

        /**
         * Reset state
         */
        reset: function() {
            currentIntent = null;
        }
    };
})();
