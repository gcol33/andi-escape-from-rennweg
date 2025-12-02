/**
 * Andi VN - Battle Core Module
 *
 * Shared battle logic used by all battle styles (DnD, Pokemon, Expedition33).
 * Handles:
 * - Battle state management
 * - HP/Mana manipulation
 * - Status effect system
 * - Stagger system
 * - Item usage
 * - Summon system
 * - Limit break charging
 * - Terrain effects
 * - Dialogue triggers
 * - Music transitions
 *
 * This module is style-agnostic - specific attack resolution is delegated
 * to the active battle style module.
 */

var BattleCore = (function() {
    'use strict';

    // =========================================================================
    // MODULE DEPENDENCY CHECK
    // =========================================================================

    // BattleData is required for this module to function
    var _hasBattleData = typeof BattleData !== 'undefined';
    if (!_hasBattleData) {
        console.warn('[BattleCore] BattleData module not loaded - some features will be unavailable');
    }

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    var T = typeof TUNING !== 'undefined' ? TUNING : null;
    // Use playerConfig from player.js if available, fall back to TUNING, then hardcoded defaults
    var P = typeof playerConfig !== 'undefined' ? playerConfig : null;
    var playerDefaults = {
        defaultName: P ? P.name : (T && T.player ? T.player.defaultName : 'Player'),
        defaultMaxHP: P ? P.hp : (T && T.player ? T.player.defaultMaxHP : 20),
        defaultMaxMana: P ? P.mana : (T && T.player ? T.player.defaultMaxMana : 20),
        defaultAC: P ? P.ac : (T && T.player ? T.player.defaultAC : 10),
        defaultAttackBonus: P ? P.attack_bonus : (T && T.player ? T.player.defaultAttackBonus : 2),
        defaultDamage: P ? P.damage : (T && T.player ? T.player.defaultDamage : '1d6'),
        defaultStaggerThreshold: P ? P.stagger_threshold : (T && T.player ? T.player.defaultStaggerThreshold : 100),
        defaultLimitBreak: P && P.limit_break ? P.limit_break : (T && T.player ? T.player.defaultLimitBreak : 'overdrive'),
        defaultSkills: P && P.skills ? P.skills : (T && T.player ? T.player.defaultSkills : ['power_strike', 'fireball', 'heal', 'fortify'])
    };
    var enemyDefaults = T ? T.enemy : {
        defaultHP: 20,
        defaultMaxMana: 20,
        defaultAC: 12,
        defaultAttackBonus: 3,
        defaultDamage: '1d6',
        defaultStaggerThreshold: 80,
        defaultAI: 'default'
    };
    var combatConfig = T ? T.battle.combat : {
        defendACBonus: 4,
        defendManaRecoveryMin: 2,
        defendManaRecoveryMax: 4,
        defendStaggerReduction: 15,
        critMultiplier: 2,
        minDamage: 1,
        fleeThreshold: 10,
        limitChargeMax: 100,
        limitChargeOnHit: 5,
        limitChargeOnTakeDamage: 8,
        staggerDecayPerTurn: 15,
        staggerThresholdDefault: 100
    };

    // =========================================================================
    // STATE
    // =========================================================================

    var state = {
        active: false,
        phase: 'player',  // 'player', 'enemy', 'animating', 'ended'
        turn: 0,
        terrain: 'none',
        player: {
            name: playerDefaults.defaultName,
            hp: null,       // null = not initialized yet (will be set on first battle)
            maxHP: null,
            mana: null,
            maxMana: null,
            ac: 10,
            attackBonus: 2,
            damage: '1d6',
            type: 'physical',
            defending: false,
            statuses: [],
            skills: [],
            stagger: 0,
            staggerThreshold: 100,
            limitCharge: undefined,  // undefined = not initialized
            limitBreak: 'overdrive',
            passives: [],
            items: []
        },
        enemy: createDefaultEnemyState(),
        summon: null,
        targets: {
            win: null,
            lose: null,
            flee: null
        },
        currentScene: null,
        battleLog: [],
        dialogue: {
            lastTrigger: null,
            cooldown: 0
        },
        musicState: {
            originalTrack: null,
            currentTrack: null,
            playerLowTriggered: false,
            playerCriticalTriggered: false,
            enemyCriticalTriggered: false
        }
    };

    // Engine references
    var vnEngine = null;
    var activeStyle = null;  // Reference to current battle style (DnD, Pokemon, etc.)

    // Callbacks
    var callbacks = {
        playSfx: null,
        loadScene: null,
        getInventory: null,
        hasItem: null,
        removeItem: null
    };

    // =========================================================================
    // STATE FACTORIES
    // =========================================================================

    function createDefaultPlayerState() {
        return {
            name: playerDefaults.defaultName,
            hp: playerDefaults.defaultMaxHP,
            maxHP: playerDefaults.defaultMaxHP,
            mana: playerDefaults.defaultMaxMana,
            maxMana: playerDefaults.defaultMaxMana,
            ac: playerDefaults.defaultAC,
            attackBonus: playerDefaults.defaultAttackBonus,
            damage: playerDefaults.defaultDamage,
            type: 'physical',
            defending: false,
            statuses: [],
            skills: playerDefaults.defaultSkills.slice(),
            stagger: 0,
            staggerThreshold: playerDefaults.defaultStaggerThreshold,
            limitCharge: 0,
            limitBreak: playerDefaults.defaultLimitBreak,
            passives: [],
            items: []
        };
    }

    function createDefaultEnemyState() {
        return {
            name: 'Enemy',
            hp: enemyDefaults.defaultHP,
            maxHP: enemyDefaults.defaultHP,
            mana: enemyDefaults.defaultMaxMana,
            maxMana: enemyDefaults.defaultMaxMana,
            ac: enemyDefaults.defaultAC,
            attackBonus: enemyDefaults.defaultAttackBonus,
            damage: enemyDefaults.defaultDamage,
            type: 'physical',
            sprite: null,
            moves: [],
            statuses: [],
            stagger: 0,
            staggerThreshold: enemyDefaults.defaultStaggerThreshold,
            ai: enemyDefaults.defaultAI,
            passives: [],
            dialogue: null
        };
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /**
     * Initialize the battle core
     * @param {Object} engine - VN engine reference with callbacks
     */
    function init(engine) {
        vnEngine = engine;

        if (engine) {
            callbacks.loadScene = engine.loadScene;
            callbacks.playSfx = engine.playSfx;
            callbacks.getInventory = engine.getInventory;
            callbacks.hasItem = engine.hasItem;
            callbacks.removeItem = engine.removeItem;
        }

        // Emit init event
        if (typeof EventEmitter !== 'undefined') {
            EventEmitter.emit('battle:core-init');
        }
    }

    /**
     * Set the active battle style module
     * @param {Object} style - Battle style module (BattleStyleDnD, etc.)
     */
    function setStyle(style) {
        activeStyle = style;
    }

    /**
     * Get the active battle style
     * @returns {Object} Active style module
     */
    function getStyle() {
        return activeStyle;
    }

    // =========================================================================
    // BATTLE FLOW
    // =========================================================================

    /**
     * Start a new battle
     * @param {Object} config - Battle configuration (flat format from story.js)
     * @param {string} sceneId - Current scene ID
     * @returns {Object} Initial battle state
     */
    function startBattle(config, sceneId) {
        // Reset state
        state.active = true;
        state.phase = 'player';
        state.turn = 1;
        state.terrain = config.terrain || 'none';
        state.currentScene = sceneId;
        state.battleLog = [];
        state.summon = null;

        // Set up targets
        state.targets = {
            win: config.win_target,
            lose: config.lose_target,
            flee: config.flee_target || null
        };

        // Initialize player stats (matching original battle.js logic)
        // Keep HP if persisted from previous battle
        var persistedHP = state.player.hp;
        var persistedMana = state.player.mana;

        if (persistedHP === null || persistedHP <= 0) {
            state.player.maxHP = config.player_max_hp || playerDefaults.defaultMaxHP;
            state.player.hp = state.player.maxHP;
        }
        if (persistedMana === null) {
            state.player.maxMana = config.player_max_mana || playerDefaults.defaultMaxMana;
            state.player.mana = state.player.maxMana;
        }

        state.player.ac = config.player_ac || playerDefaults.defaultAC;
        state.player.attackBonus = config.player_attack_bonus || playerDefaults.defaultAttackBonus;
        state.player.damage = config.player_damage || playerDefaults.defaultDamage;
        state.player.type = config.player_type || 'physical';
        state.player.defending = false;
        state.player.defendCooldown = 0;  // Turns until defend is available again
        state.player.statuses = [];
        state.player.stagger = 0;
        state.player.staggerThreshold = config.player_stagger_threshold || playerDefaults.defaultStaggerThreshold;

        // Keep limit charge across battles unless reset
        if (state.player.limitCharge === undefined) {
            state.player.limitCharge = 0;
        }
        state.player.limitBreak = config.player_limit_break || playerDefaults.defaultLimitBreak;
        state.player.passives = config.player_passives || [];
        state.player.skills = config.player_skills || playerDefaults.defaultSkills.slice();
        state.player.items = [];

        // Set up enemy from enemies.js if specified
        var enemy = config.enemy || {};
        if (config.enemy_id && typeof enemies !== 'undefined' && enemies[config.enemy_id]) {
            var enemyData = enemies[config.enemy_id];
            enemy = Object.assign({}, enemyData, enemy);
            enemy.id = config.enemy_id;
        }

        state.enemy = {
            id: enemy.id || null,
            name: enemy.name || 'Enemy',
            hp: enemy.hp || enemyDefaults.defaultHP,
            maxHP: enemy.hp || enemyDefaults.defaultHP,
            mana: enemy.mana || enemyDefaults.defaultMaxMana,
            maxMana: enemy.mana || enemyDefaults.defaultMaxMana,
            ac: enemy.ac || enemyDefaults.defaultAC,
            attackBonus: enemy.attack_bonus || enemyDefaults.defaultAttackBonus,
            damage: enemy.damage || enemyDefaults.defaultDamage,
            type: enemy.type || 'physical',
            sprite: enemy.sprite || null,
            statuses: [],
            stagger: 0,
            staggerThreshold: enemy.stagger_threshold || enemyDefaults.defaultStaggerThreshold,
            ai: enemy.ai || enemyDefaults.defaultAI,
            moves: enemy.moves || [{ name: 'Attack', damage: '1d6', type: 'physical' }],
            passives: enemy.passives || [],
            dialogue: enemy.dialogue || null,
            summons: enemy.summons || null
        };

        // Reset music state
        state.musicState = {
            originalTrack: null,
            currentTrack: null,
            playerLowTriggered: false,
            playerCriticalTriggered: false,
            enemyCriticalTriggered: false
        };

        // Reset dialogue state
        state.dialogue = {
            lastTrigger: null,
            cooldown: 0
        };

        // Emit event
        if (typeof EventEmitter !== 'undefined') {
            EventEmitter.emit('battle:start', {
                player: state.player,
                enemy: state.enemy,
                terrain: state.terrain
            });
        }

        return getState();
    }

    /**
     * End the current battle
     * @param {string} result - 'win', 'lose', or 'flee'
     */
    function endBattle(result) {
        state.active = false;
        state.phase = 'ended';

        var targetScene = null;
        switch (result) {
            case 'win':
                targetScene = state.targets.win;
                break;
            case 'lose':
                targetScene = state.targets.lose;
                break;
            case 'flee':
                targetScene = state.targets.flee || state.targets.win;
                break;
        }

        // Emit event
        if (typeof EventEmitter !== 'undefined') {
            EventEmitter.emit('battle:end', { result: result, target: targetScene });
        }

        return {
            result: result,
            target: targetScene
        };
    }

    /**
     * Check if battle should end
     * @returns {Object|null} End result or null if battle continues
     */
    function checkBattleEnd() {
        if (state.enemy.hp <= 0) {
            return { ended: true, result: 'win' };
        }
        if (state.player.hp <= 0) {
            return { ended: true, result: 'lose' };
        }
        return null;
    }

    // =========================================================================
    // HP / MANA MANAGEMENT
    // =========================================================================

    /**
     * Damage the player
     * @param {number} amount - Damage amount
     * @param {Object} options - { source, type, isCrit }
     * @returns {Object} Result with actual damage dealt
     */
    function damagePlayer(amount, options) {
        options = options || {};
        var actualDamage = Math.max(combatConfig.minDamage, amount);

        // Apply damage reduction from passives
        var reduction = getPassiveValue(state.player, 'damageReduction');
        actualDamage = Math.max(combatConfig.minDamage, actualDamage - reduction);

        var oldHP = state.player.hp;
        state.player.hp = Math.max(0, state.player.hp - actualDamage);

        // Add limit charge when taking damage
        addLimitCharge(combatConfig.limitChargeOnTakeDamage);

        // Emit event
        if (typeof EventEmitter !== 'undefined') {
            EventEmitter.emit('player:damaged', {
                amount: actualDamage,
                source: options.source,
                type: options.type,
                isCrit: options.isCrit,
                oldHP: oldHP,
                newHP: state.player.hp
            });
        }

        return {
            damage: actualDamage,
            oldHP: oldHP,
            newHP: state.player.hp,
            killed: state.player.hp <= 0
        };
    }

    /**
     * Heal the player
     * @param {number} amount - Heal amount
     * @param {string} source - Source of healing
     * @returns {Object} Result with actual healing done
     */
    function healPlayer(amount, source) {
        var oldHP = state.player.hp;
        state.player.hp = Math.min(state.player.maxHP, state.player.hp + amount);
        var actualHeal = state.player.hp - oldHP;

        if (typeof EventEmitter !== 'undefined') {
            EventEmitter.emit('player:healed', {
                amount: actualHeal,
                source: source
            });
        }

        return {
            healed: actualHeal,
            oldHP: oldHP,
            newHP: state.player.hp
        };
    }

    /**
     * Damage the enemy
     * @param {number} amount - Damage amount
     * @param {Object} options - { source, type, isCrit }
     * @returns {Object} Result with actual damage dealt
     */
    function damageEnemy(amount, options) {
        options = options || {};
        var actualDamage = Math.max(combatConfig.minDamage, amount);

        // Apply damage reduction from passives
        var reduction = getPassiveValue(state.enemy, 'damageReduction');
        actualDamage = Math.max(combatConfig.minDamage, actualDamage - reduction);

        var oldHP = state.enemy.hp;
        state.enemy.hp = Math.max(0, state.enemy.hp - actualDamage);
        console.log('[BattleCore.damageEnemy] amount:', amount, 'actualDamage:', actualDamage, 'oldHP:', oldHP, 'newHP:', state.enemy.hp);

        // Add limit charge when dealing damage
        addLimitCharge(combatConfig.limitChargeOnHit);

        // Apply lifesteal if player has it
        var lifesteal = getPassiveValue(state.player, 'lifesteal');
        if (lifesteal > 0) {
            var healAmount = Math.floor(actualDamage * lifesteal);
            if (healAmount > 0) {
                healPlayer(healAmount, 'lifesteal');
            }
        }

        if (typeof EventEmitter !== 'undefined') {
            EventEmitter.emit('enemy:damaged', {
                amount: actualDamage,
                source: options.source,
                type: options.type,
                isCrit: options.isCrit,
                oldHP: oldHP,
                newHP: state.enemy.hp
            });
        }

        if (state.enemy.hp <= 0) {
            if (typeof EventEmitter !== 'undefined') {
                EventEmitter.emit('enemy:defeated', { enemy: state.enemy });
            }
        }

        return {
            damage: actualDamage,
            oldHP: oldHP,
            newHP: state.enemy.hp,
            killed: state.enemy.hp <= 0
        };
    }

    /**
     * Heal the enemy
     * @param {number} amount - Heal amount
     * @param {string} source - Source of healing
     * @returns {Object} Result
     */
    function healEnemy(amount, source) {
        var oldHP = state.enemy.hp;
        state.enemy.hp = Math.min(state.enemy.maxHP, state.enemy.hp + amount);
        console.log('[BattleCore.healEnemy] amount:', amount, 'source:', source, 'oldHP:', oldHP, 'newHP:', state.enemy.hp);
        return {
            healed: state.enemy.hp - oldHP,
            oldHP: oldHP,
            newHP: state.enemy.hp
        };
    }

    /**
     * Use player mana
     * @param {number} amount - Mana to spend
     * @returns {boolean} True if successful
     */
    function useMana(amount) {
        if (state.player.mana < amount) return false;
        state.player.mana -= amount;
        return true;
    }

    /**
     * Restore player mana
     * @param {number} amount - Mana to restore
     * @returns {number} Actual mana restored
     */
    function restoreMana(amount) {
        var oldMana = state.player.mana;
        state.player.mana = Math.min(state.player.maxMana, state.player.mana + amount);
        return state.player.mana - oldMana;
    }

    // =========================================================================
    // STATUS EFFECTS
    // =========================================================================

    /**
     * Apply a status effect to a target
     * @param {Object} target - player or enemy state
     * @param {string} statusType - Status effect ID
     * @param {number} stacks - Number of stacks
     * @returns {Object} { applied, message }
     */
    function applyStatus(target, statusType, stacks) {
        if (!_hasBattleData) return { applied: false, message: '' };
        var effectDef = BattleData.getStatusEffect(statusType);
        if (!effectDef) return { applied: false, message: '' };

        stacks = stacks || 1;
        var existing = findStatus(target, statusType);

        if (existing) {
            if (effectDef.stacks) {
                existing.stacks += stacks;
                existing.duration = Math.max(existing.duration, effectDef.duration);
                return {
                    applied: true,
                    message: effectDef.icon + ' ' + effectDef.name + ' x' + existing.stacks + '!'
                };
            } else {
                existing.duration = effectDef.duration;
                return {
                    applied: true,
                    message: effectDef.icon + ' ' + effectDef.name + ' refreshed!'
                };
            }
        } else {
            target.statuses.push({
                type: statusType,
                duration: effectDef.duration,
                stacks: stacks,
                justApplied: true  // Skip first tick for DOT effects
            });

            if (typeof EventEmitter !== 'undefined') {
                EventEmitter.emit('player:status', {
                    target: target === state.player ? 'player' : 'enemy',
                    status: statusType,
                    applied: true
                });
            }

            return {
                applied: true,
                message: effectDef.icon + ' Inflicted ' + effectDef.name + '!'
            };
        }
    }

    /**
     * Apply a status effect with optional custom duration
     * @param {Object} target - player or enemy state
     * @param {string} statusType - Status effect ID
     * @param {number} stacks - Number of stacks
     * @param {number} customDuration - Optional custom duration (overrides default)
     * @returns {Object} { applied, message }
     */
    function applyStatusWithDuration(target, statusType, stacks, customDuration) {
        if (!_hasBattleData) return { applied: false, message: '' };
        var effectDef = BattleData.getStatusEffect(statusType);
        if (!effectDef) return { applied: false, message: '' };

        stacks = stacks || 1;
        var duration = customDuration || effectDef.duration;
        var existing = findStatus(target, statusType);

        if (existing) {
            if (effectDef.stacks) {
                existing.stacks += stacks;
                existing.duration = Math.max(existing.duration, duration);
                return {
                    applied: true,
                    message: effectDef.icon + ' ' + effectDef.name + ' x' + existing.stacks + '!'
                };
            } else {
                existing.duration = duration;
                return {
                    applied: true,
                    message: effectDef.icon + ' ' + effectDef.name + ' refreshed!'
                };
            }
        } else {
            target.statuses.push({
                type: statusType,
                duration: duration,
                stacks: stacks,
                justApplied: true  // Skip first tick for DOT effects
            });

            if (typeof EventEmitter !== 'undefined') {
                EventEmitter.emit('player:status', {
                    target: target === state.player ? 'player' : 'enemy',
                    status: statusType,
                    applied: true
                });
            }

            return {
                applied: true,
                message: effectDef.icon + ' ' + effectDef.name + ' applied!'
            };
        }
    }

    /**
     * Remove a status effect
     * @param {Object} target - Target state
     * @param {string} statusType - Status to remove
     * @returns {boolean} True if removed
     */
    function removeStatus(target, statusType) {
        for (var i = target.statuses.length - 1; i >= 0; i--) {
            if (target.statuses[i].type === statusType) {
                target.statuses.splice(i, 1);
                return true;
            }
        }
        return false;
    }

    /**
     * Check if target has a status
     * @param {Object} target - Target state
     * @param {string} statusType - Status to check
     * @returns {Object|null} Status object or null
     */
    function hasStatus(target, statusType) {
        return findStatus(target, statusType);
    }

    function findStatus(target, statusType) {
        for (var i = 0; i < target.statuses.length; i++) {
            if (target.statuses[i].type === statusType) {
                return target.statuses[i];
            }
        }
        return null;
    }

    /**
     * Process status effects at turn start
     * @param {Object} target - Target state
     * @param {string} targetName - Name for messages
     * @returns {Object} { damage, heal, messages, canAct }
     */
    function tickStatuses(target, targetName) {
        var result = {
            damage: 0,
            heal: 0,
            mana: 0,
            messages: [],
            canAct: true,
            expiredStatuses: []  // Track which statuses expired this turn
        };

        if (!_hasBattleData) return result;

        // Process terrain effects
        var terrain = BattleData.getTerrain(state.terrain);
        if (terrain && terrain.healPerTurn) {
            result.heal += terrain.healPerTurn;
            result.messages.push(terrain.icon + ' ' + targetName + ' heals from ' + terrain.name);
        }

        // Process each status
        for (var i = target.statuses.length - 1; i >= 0; i--) {
            var status = target.statuses[i];
            var def = BattleData.getStatusEffect(status.type);
            if (!def) continue;

            // Clear justApplied flag (used to skip first DOT tick)
            var skipDOT = status.justApplied;
            if (status.justApplied) {
                status.justApplied = false;
            }

            // Damage over time (skip first tick for newly applied statuses)
            if (def.damagePerTurn && !skipDOT) {
                var dotDamage = def.damagePerTurn * (status.stacks || 1);
                result.damage += dotDamage;
                result.messages.push(def.icon + ' ' + targetName + ' takes <span class="battle-number">' + dotDamage + '</span> ' + def.name + ' damage!');
            }

            // Healing over time (skip first tick for newly applied statuses)
            if (def.healPerTurn && !skipDOT) {
                result.heal += def.healPerTurn;
                result.messages.push(targetName + ' recovers <span class="regen-hp">+' + def.healPerTurn + ' HP</span>!');
            }

            // Mana regen over time (skip first tick for newly applied statuses)
            if (def.manaPerTurn && !skipDOT) {
                result.mana += def.manaPerTurn;
                result.messages.push(targetName + ' recovers <span class="regen-mp">+' + def.manaPerTurn + ' MP</span>!');
            }

            // Check if status is marked for removal (reached 0 on previous turn)
            if (status.duration <= 0) {
                target.statuses.splice(i, 1);
                result.expiredStatuses.push(status.type);  // Track expired status
                result.messages.push(def.icon + ' ' + def.name + ' wore off!');
                continue;  // Status cleared at start of turn, skip processing
            }

            // Confusion self-damage check
            // Logic:
            // - 40% chance: hurt self (roll 1-5 damage), can't act this turn, confusion stays (will auto-clear next turn)
            // - 60% chance: shake off confusion immediately, can act this turn
            if (def.selfDamageChance) {
                if (Math.random() < def.selfDamageChance) {
                    // Hit self - roll 1-5 damage like a combat attack
                    var selfDamage = Math.floor(Math.random() * 5) + 1;  // 1-5 damage
                    result.confusionDamage = selfDamage;  // Store separately for proper display
                    result.canAct = false;  // Can't act when confused and hurt self
                    result.confusionTriggered = true;
                    // Set duration to 1 so it clears at START of next turn
                    status.duration = 1;
                } else {
                    // Shake off - clear confusion immediately, can act this turn
                    var shakeOffMsg = def.icon + ' ' + targetName + ' shakes off confusion!';
                    result.messages.push(shakeOffMsg);
                    // Remove confusion immediately
                    target.statuses.splice(i, 1);
                    result.expiredStatuses.push(status.type);
                    continue;  // Skip duration decrement since we removed it
                }
            }

            // Check if skips turn
            if (def.skipsTurn) {
                result.canAct = false;
                // Use past participle form for status names (stun -> stunned, freeze -> frozen)
                var statusVerb = def.name.toLowerCase();
                if (statusVerb === 'stun') statusVerb = 'stunned';
                else if (statusVerb === 'freeze') statusVerb = 'frozen';
                result.messages.push(def.icon + ' ' + targetName + ' is ' + statusVerb + ' and cannot act!');
            }

            // Decrement duration at end of turn processing
            // If it reaches 0, status will be cleared at START of next turn
            status.duration--;
        }

        return result;
    }

    /**
     * Get AC modifier from statuses
     */
    function getStatusACModifier(target) {
        var modifier = 0;
        if (!_hasBattleData) return modifier;
        for (var i = 0; i < target.statuses.length; i++) {
            var def = BattleData.getStatusEffect(target.statuses[i].type);
            if (def && def.acBonus) modifier += def.acBonus;
        }
        return modifier;
    }

    /**
     * Get attack modifier from statuses
     */
    function getStatusAttackModifier(target) {
        var modifier = 0;
        if (!_hasBattleData) return modifier;
        for (var i = 0; i < target.statuses.length; i++) {
            var def = BattleData.getStatusEffect(target.statuses[i].type);
            if (def && def.attackBonus) modifier += def.attackBonus;
        }
        return modifier;
    }

    /**
     * Get damage modifier from statuses
     */
    function getStatusDamageModifier(target) {
        var modifier = 0;
        if (!_hasBattleData) return modifier;
        for (var i = 0; i < target.statuses.length; i++) {
            var def = BattleData.getStatusEffect(target.statuses[i].type);
            if (def && def.damageBonus) modifier += def.damageBonus;
        }
        return modifier;
    }

    /**
     * Check if target can act
     */
    function canAct(target) {
        if (!_hasBattleData) return true;
        for (var i = 0; i < target.statuses.length; i++) {
            var def = BattleData.getStatusEffect(target.statuses[i].type);
            if (def && def.skipsTurn) return false;
        }
        return true;
    }

    /**
     * Get message explaining why target cannot act
     * @param {Object} target - Target state
     * @param {string} targetName - Name for messages
     * @returns {string} Message with icon and reason (e.g. "💫 Agnes is stunned and cannot act!")
     */
    function getCannotActMessage(target, targetName) {
        if (!_hasBattleData) return targetName + ' cannot act!';
        for (var i = 0; i < target.statuses.length; i++) {
            var def = BattleData.getStatusEffect(target.statuses[i].type);
            if (def && def.skipsTurn) {
                var statusVerb = def.name.toLowerCase();
                if (statusVerb === 'stun') statusVerb = 'stunned';
                else if (statusVerb === 'freeze') statusVerb = 'frozen';
                return def.icon + ' ' + targetName + ' is ' + statusVerb + ' and cannot act!';
            }
        }
        return targetName + ' cannot act!';
    }

    // =========================================================================
    // STAGGER SYSTEM
    // =========================================================================

    /**
     * Add stagger to target
     * @returns {boolean} True if target became stunned
     */
    function addStagger(target, amount) {
        if (!amount || amount <= 0) return false;

        target.stagger = (target.stagger || 0) + amount;

        if (target.stagger >= (target.staggerThreshold || combatConfig.staggerThresholdDefault)) {
            target.stagger = 0;
            applyStatus(target, 'stun', 1);
            return true;
        }
        return false;
    }

    /**
     * Reduce stagger over time
     */
    function decayStagger(target, amount) {
        target.stagger = Math.max(0, (target.stagger || 0) - (amount || combatConfig.staggerDecayPerTurn));
    }

    // =========================================================================
    // LIMIT BREAK SYSTEM
    // =========================================================================

    /**
     * Add limit break charge
     */
    function addLimitCharge(amount) {
        var oldCharge = state.player.limitCharge;
        state.player.limitCharge = Math.min(
            combatConfig.limitChargeMax,
            state.player.limitCharge + amount
        );

        // Trigger dialogue when limit becomes ready
        if (oldCharge < combatConfig.limitChargeMax && state.player.limitCharge >= combatConfig.limitChargeMax) {
            triggerDialogue('limit_ready');
        }
    }

    /**
     * Check if limit break is ready
     */
    function isLimitReady() {
        return state.player.limitCharge >= combatConfig.limitChargeMax;
    }

    /**
     * Use limit break charge
     */
    function useLimitCharge() {
        if (!isLimitReady()) return false;
        state.player.limitCharge = 0;
        return true;
    }

    // =========================================================================
    // PASSIVE SYSTEM
    // =========================================================================

    /**
     * Get passive value for a target
     */
    function getPassiveValue(target, property) {
        var total = 0;
        if (!target.passives || !_hasBattleData) return total;

        for (var i = 0; i < target.passives.length; i++) {
            var passive = BattleData.getPassive(target.passives[i]);
            if (passive && passive[property]) {
                total += passive[property];
            }
        }
        return total;
    }

    /**
     * Get all passive bonuses for a target
     */
    function getPassiveBonuses(target) {
        return {
            acBonus: getPassiveValue(target, 'acBonus'),
            attackBonus: getPassiveValue(target, 'attackBonus'),
            damageBonus: getPassiveValue(target, 'damageBonus'),
            damageReduction: getPassiveValue(target, 'damageReduction'),
            healPerTurn: getPassiveValue(target, 'healPerTurn'),
            manaPerTurn: getPassiveValue(target, 'manaPerTurn'),
            lifesteal: getPassiveValue(target, 'lifesteal'),
            critRange: getPassiveValue(target, 'critRange') || 20
        };
    }

    // =========================================================================
    // ITEM SYSTEM
    // =========================================================================

    /**
     * Get available battle items
     */
    function getAvailableItems() {
        var available = [];

        if (!_hasBattleData) return available;

        if (callbacks.getInventory) {
            var inventory = callbacks.getInventory();
            for (var i = 0; i < inventory.length; i++) {
                var itemName = inventory[i];
                var itemId = itemName.toLowerCase().replace(/\s+/g, '_');
                var itemDef = BattleData.getItem(itemId);

                if (itemDef) {
                    var existing = findItemInList(available, itemId);
                    if (existing) {
                        existing.quantity++;
                    } else {
                        available.push({
                            id: itemId,
                            name: itemDef.name,
                            icon: itemDef.icon,
                            description: itemDef.description,
                            quantity: 1,
                            def: itemDef
                        });
                    }
                }
            }
        }

        return available;
    }

    function findItemInList(list, itemId) {
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === itemId) return list[i];
        }
        return null;
    }

    /**
     * Use a battle item
     */
    function useItem(itemId) {
        if (!_hasBattleData) {
            return { success: false, reason: 'no_data', messages: ['Item system unavailable!'] };
        }
        var itemDef = BattleData.getItem(itemId);
        if (!itemDef) {
            return { success: false, reason: 'unknown_item', messages: ['Unknown item!'] };
        }

        // Check if player has item
        var hasItem = false;
        if (callbacks.hasItem) {
            hasItem = callbacks.hasItem(itemDef.name);
        }

        if (!hasItem) {
            return { success: false, reason: 'no_item', messages: ['You don\'t have this item!'] };
        }

        var messages = [];

        // Apply effects - combine HP/MP restoration into single message
        var hpRestored = 0;
        var mpRestored = 0;

        if (itemDef.heals) {
            var healResult = healPlayer(itemDef.heals, 'item');
            hpRestored = healResult.healed;
        }

        if (itemDef.restoresFullMana) {
            var oldMana = state.player.mana;
            state.player.mana = state.player.maxMana;
            mpRestored = state.player.mana - oldMana;
        } else if (itemDef.restoresMana) {
            mpRestored = restoreMana(itemDef.restoresMana);
        }

        // Build combined restoration message
        if (hpRestored > 0 && mpRestored > 0) {
            messages.push('Restored <span class="battle-number-hp">' + hpRestored + ' HP</span>, <span class="battle-number-mp">' + mpRestored + ' MP</span>!');
        } else if (hpRestored > 0) {
            messages.push('Restored <span class="battle-number-hp">' + hpRestored + ' HP</span>!');
        } else if (mpRestored > 0) {
            messages.push('Restored <span class="battle-number-mp">' + mpRestored + ' MP</span>!');
        }

        if (itemDef.curesStatus) {
            var removed = removeStatus(state.player, itemDef.curesStatus);
            if (removed) {
                var statusDef = BattleData.getStatusEffect(itemDef.curesStatus);
                messages.push('Cured ' + (statusDef ? statusDef.name : itemDef.curesStatus) + '!');
            }
        }

        if (itemDef.appliesStatus) {
            // Support both simple string format and object format with custom duration
            var statusType, customDuration;
            if (typeof itemDef.appliesStatus === 'string') {
                statusType = itemDef.appliesStatus;
                customDuration = null;
            } else {
                statusType = itemDef.appliesStatus.type;
                customDuration = itemDef.appliesStatus.duration;
            }
            var statusResult = applyStatusWithDuration(state.player, statusType, 1, customDuration);
            if (statusResult.applied) {
                messages.push(statusResult.message);
            }
        }

        // Consume item
        if (itemDef.consumable && callbacks.removeItem) {
            callbacks.removeItem(itemDef.name);
        }

        playSfx('item_use');

        return {
            success: true,
            messages: messages,
            consumed: itemDef.consumable
        };
    }

    // =========================================================================
    // SUMMON SYSTEM
    // =========================================================================

    /**
     * Create a summon
     */
    function createSummon(summonId) {
        if (!_hasBattleData) {
            return { success: false, reason: 'no_data' };
        }
        var summonDef = BattleData.getSummon(summonId);
        if (!summonDef) {
            return { success: false, reason: 'unknown_summon' };
        }

        if (state.summon) {
            return { success: false, reason: 'summon_active', message: 'A summon is already active!' };
        }

        state.summon = {
            id: summonId,
            name: summonDef.name,
            icon: summonDef.icon,
            duration: summonDef.duration,
            attack: summonDef.attack || null,
            healPerTurn: summonDef.healPerTurn || 0,
            passive: summonDef.passive || null
        };

        triggerDialogue('summon_appears');
        playSfx('summon_appear');

        return {
            success: true,
            summon: state.summon,
            message: summonDef.icon + ' ' + summonDef.name + ' appears!'
        };
    }

    /**
     * Process summon turn
     */
    function processSummonTurn() {
        if (!state.summon) return { acted: false, messages: [] };

        var messages = [];

        // Healing
        if (state.summon.healPerTurn > 0) {
            var healResult = healPlayer(state.summon.healPerTurn, 'summon');
            if (healResult.healed > 0) {
                messages.push(state.summon.icon + ' ' + state.summon.name + ' heals you for <span class="battle-number">' + healResult.healed + ' HP</span>!');
            }
        }

        // Attack (delegated to active style)
        var attackResult = null;
        if (state.summon.attack && activeStyle && activeStyle.resolveSummonAttack) {
            attackResult = activeStyle.resolveSummonAttack(state.summon, state.enemy);
            if (attackResult.hit) {
                var dmgResult = damageEnemy(attackResult.damage, { source: 'summon', type: state.summon.attack.type });
                messages.push(state.summon.icon + ' ' + state.summon.name + ' uses ' +
                    state.summon.attack.name + ' for <span class="battle-number">' + dmgResult.damage + ' damage</span>!');
            } else {
                messages.push(state.summon.icon + ' ' + state.summon.name + '\'s ' +
                    state.summon.attack.name + ' missed!');
            }
        }

        // Decrement duration
        state.summon.duration--;
        if (state.summon.duration <= 0) {
            messages.push(state.summon.icon + ' ' + state.summon.name + ' fades away...');
            state.summon = null;
            playSfx('summon_expire');
        }

        return {
            acted: true,
            messages: messages,
            attackResult: attackResult
        };
    }

    /**
     * Dismiss summon early
     */
    function dismissSummon() {
        if (!state.summon) return false;
        state.summon = null;
        return true;
    }

    // =========================================================================
    // TERRAIN
    // =========================================================================

    /**
     * Get terrain damage multiplier for attack type
     */
    function getTerrainMultiplier(attackType) {
        if (!_hasBattleData) return 1;
        var terrain = BattleData.getTerrain(state.terrain);
        if (!terrain || !terrain.typeBonus) return 1;
        return terrain.typeBonus[attackType] || 1;
    }

    /**
     * Get terrain accuracy penalty
     */
    function getTerrainAccuracyPenalty() {
        if (!_hasBattleData) return 0;
        var terrain = BattleData.getTerrain(state.terrain);
        return (terrain && terrain.accuracyPenalty) || 0;
    }

    // =========================================================================
    // DIALOGUE
    // =========================================================================

    /**
     * Trigger a dialogue event
     * Checks enemy-specific dialogue first, then falls back to generic BattleData
     */
    function triggerDialogue(trigger) {
        if (state.dialogue.cooldown > 0) return null;

        var line = null;

        // First, check enemy-specific dialogue
        if (state.enemy && state.enemy.dialogue && state.enemy.dialogue[trigger]) {
            var lines = state.enemy.dialogue[trigger];
            if (lines && lines.length > 0) {
                line = lines[Math.floor(Math.random() * lines.length)];
            }
        }

        // Fall back to generic BattleData dialogue
        if (!line && _hasBattleData) {
            line = BattleData.getDialogue(trigger);
        }

        if (line) {
            state.dialogue.lastTrigger = trigger;
            state.dialogue.cooldown = 2;  // Turns until next dialogue
            return line;
        }
        return null;
    }

    /**
     * Decrement dialogue cooldown
     */
    function tickDialogueCooldown() {
        if (state.dialogue.cooldown > 0) {
            state.dialogue.cooldown--;
        }
    }

    // =========================================================================
    // SOUND
    // =========================================================================

    function playSfx(cue) {
        var filename = (_hasBattleData && BattleData.getSoundCue(cue)) || cue;
        if (callbacks.playSfx && filename) {
            callbacks.playSfx(filename);
        }
    }

    // =========================================================================
    // STATE ACCESS
    // =========================================================================

    function getState() {
        return {
            active: state.active,
            phase: state.phase,
            turn: state.turn,
            terrain: state.terrain,
            player: state.player,
            enemy: state.enemy,
            summon: state.summon,
            targets: state.targets
        };
    }

    function isActive() {
        return state.active;
    }

    function getPhase() {
        return state.phase;
    }

    function setPhase(phase) {
        state.phase = phase;
        // Update UI to reflect phase change (disable/enable buttons)
        updateBattleButtonsState(phase);
    }

    /**
     * Update battle button states based on current phase
     * Buttons are only interactive during 'player' phase
     */
    function updateBattleButtonsState(phase) {
        var battleChoices = document.getElementById('battle-choices');
        if (!battleChoices) return;

        var buttons = battleChoices.querySelectorAll('.choice-button');
        var isPlayerTurn = (phase === 'player');

        buttons.forEach(function(button) {
            button.disabled = !isPlayerTurn;
            if (isPlayerTurn) {
                button.classList.remove('waiting');
            } else {
                button.classList.add('waiting');
            }
        });

        // Also update battle choices container class for styling
        if (isPlayerTurn) {
            battleChoices.classList.remove('waiting');
        } else {
            battleChoices.classList.add('waiting');
        }
    }

    function getTurn() {
        return state.turn;
    }

    function incrementTurn() {
        state.turn++;
        tickDialogueCooldown();

        // Decrement defend cooldown
        if (state.player.defendCooldown > 0) {
            state.player.defendCooldown--;
        }
    }

    function getPlayer() {
        return state.player;
    }

    function getEnemy() {
        return state.enemy;
    }

    function getSummon() {
        return state.summon;
    }

    function getTerrain() {
        return state.terrain;
    }

    function getTargets() {
        return state.targets;
    }

    function getCombatConfig() {
        return combatConfig;
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        // Initialization
        init: init,
        setStyle: setStyle,
        getStyle: getStyle,

        // Battle flow
        startBattle: startBattle,
        endBattle: endBattle,
        checkBattleEnd: checkBattleEnd,

        // HP/Mana
        damagePlayer: damagePlayer,
        healPlayer: healPlayer,
        damageEnemy: damageEnemy,
        healEnemy: healEnemy,
        useMana: useMana,
        restoreMana: restoreMana,

        // Status effects
        applyStatus: applyStatus,
        removeStatus: removeStatus,
        hasStatus: hasStatus,
        tickStatuses: tickStatuses,
        getStatusACModifier: getStatusACModifier,
        getStatusAttackModifier: getStatusAttackModifier,
        getStatusDamageModifier: getStatusDamageModifier,
        canAct: canAct,
        getCannotActMessage: getCannotActMessage,

        // Stagger
        addStagger: addStagger,
        decayStagger: decayStagger,

        // Limit break
        addLimitCharge: addLimitCharge,
        isLimitReady: isLimitReady,
        useLimitCharge: useLimitCharge,

        // Passives
        getPassiveValue: getPassiveValue,
        getPassiveBonuses: getPassiveBonuses,

        // Items
        getAvailableItems: getAvailableItems,
        useItem: useItem,

        // Summons
        createSummon: createSummon,
        processSummonTurn: processSummonTurn,
        dismissSummon: dismissSummon,

        // Terrain
        getTerrainMultiplier: getTerrainMultiplier,
        getTerrainAccuracyPenalty: getTerrainAccuracyPenalty,

        // Dialogue
        triggerDialogue: triggerDialogue,

        // Sound
        playSfx: playSfx,

        // State access
        getState: getState,
        isActive: isActive,
        getPhase: getPhase,
        setPhase: setPhase,
        getTurn: getTurn,
        incrementTurn: incrementTurn,
        getPlayer: getPlayer,
        getEnemy: getEnemy,
        getSummon: getSummon,
        getTerrain: getTerrain,
        getTargets: getTargets,
        getCombatConfig: getCombatConfig
    };
})();
