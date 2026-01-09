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
    // MODULE DEPENDENCY CHECK (uses BattleUtils if available)
    // =========================================================================

    // Use BattleUtils for dependency checks if available, otherwise fall back
    var _hasBattleUtils = typeof BattleUtils !== 'undefined';
    var _hasBattleData = _hasBattleUtils ? BattleUtils.hasBattleData() : typeof BattleData !== 'undefined';
    var _hasBattleSummon = _hasBattleUtils ? BattleUtils.hasBattleSummon() : typeof BattleSummon !== 'undefined';

    // Use Logger module with fallback via Utils
    var _log = Utils.getLogger();

    if (!_hasBattleData) {
        _log.warn('BattleCore', 'BattleData module not loaded - some features will be unavailable');
    }

    /**
     * Helper to emit events if eventBus is available
     * @param {string} eventName - Event name
     * @param {*} data - Optional event data
     */
    function emitEvent(eventName, data) {
        if (typeof eventBus !== 'undefined') {
            eventBus.emit(eventName, data);
        }
    }

    // Dev mode: callback to check if status effects should be guaranteed
    var guaranteeStatusCallback = null;

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
        defaultName: 'Enemy',
        defaultHP: 20,
        defaultMaxMana: 20,
        defaultAC: 12,
        defaultAttackBonus: 3,
        defaultDamage: '1d6',
        defaultStaggerThreshold: 80,
        defaultAI: 'default'
    };
    var combatConfig = T ? T.battle.combat : {
        defendACBonus: 0,   // AC bonus removed (can be a skill later)
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
            buffs: [],    // Temporary buffs from consumables (e.g., +1 AC from Granola Bar)
            items: [],
            itemCooldown: 0  // Turns until items can be used again
        },
        enemy: createDefaultEnemyState(),
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
        emitEvent('battle:core-init');
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
     * Initialize player state from config
     * @param {Object} config - Battle configuration
     */
    function initializePlayerState(config) {
        // Priority: 1) persisted from engine (localStorage), 2) current session, 3) maxHP
        var persistedHP = config.persisted_hp !== null && config.persisted_hp !== undefined
            ? config.persisted_hp
            : state.player.hp;
        var persistedMana = config.persisted_mana !== null && config.persisted_mana !== undefined
            ? config.persisted_mana
            : state.player.mana;

        // Set maxHP/maxMana (prefer persisted, then config, then defaults)
        state.player.maxHP = config.persisted_max_hp || config.player_max_hp || playerDefaults.defaultMaxHP;
        state.player.maxMana = config.persisted_max_mana || config.player_max_mana || playerDefaults.defaultMaxMana;

        // Set current HP/Mana (use persisted if valid, otherwise full)
        state.player.hp = (persistedHP === null || persistedHP <= 0)
            ? state.player.maxHP
            : Math.min(persistedHP, state.player.maxHP);
        state.player.mana = (persistedMana === null)
            ? state.player.maxMana
            : Math.min(persistedMana, state.player.maxMana);

        state.player.ac = config.player_ac || playerDefaults.defaultAC;
        state.player.attackBonus = config.player_attack_bonus || playerDefaults.defaultAttackBonus;
        state.player.damage = config.player_damage || playerDefaults.defaultDamage;
        state.player.type = config.player_type || 'physical';
        state.player.defending = false;
        state.player.defendCooldown = 0;
        state.player.itemCooldown = 0;
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
    }

    /**
     * Initialize enemy state from config
     * @param {Object} config - Battle configuration
     */
    function initializeEnemyState(config) {
        var enemy = config.enemy || {};

        // Load from enemies.js if specified
        if (config.enemy_id) {
            if (typeof enemies === 'undefined') {
                _log.warn('BattleCore', 'enemy_id specified but enemies.js not loaded:', config.enemy_id);
            } else if (!enemies[config.enemy_id]) {
                _log.warn('BattleCore', 'enemy_id not found in enemies.js:', config.enemy_id,
                    'Available enemies:', Object.keys(enemies).join(', '));
            } else {
                var enemyData = enemies[config.enemy_id];
                enemy = Object.assign({}, enemyData, enemy);
                enemy.id = config.enemy_id;
            }
        }

        // Calculate base HP, with optional modifier from config (e.g., coffee debuff)
        var baseHP = enemy.hp || enemyDefaults.defaultHP;
        var hpModifier = config.enemy_hp_modifier || 1.0;
        var startingHP = Math.floor(baseHP * hpModifier);

        state.enemy = {
            id: enemy.id || null,
            name: enemy.name || 'Enemy',
            hp: startingHP,
            maxHP: baseHP,  // Max HP stays full for display purposes
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
            superMoves: enemy.super_moves || null,  // Unlocked in super phase
            passives: enemy.passives || [],
            dialogue: enemy.dialogue || null,
            summons: enemy.summons || null,
            intents: enemy.intents || null,
            // Phase system for multi-phase boss fights
            phases: enemy.phases || null,
            currentPhase: null,
            baseStats: null  // Store original stats for phase reference
        };

        // Initialize phase system if enemy has phases
        if (state.enemy.phases && state.enemy.phases.length > 0) {
            // Store base stats for reference
            state.enemy.baseStats = {
                attackBonus: state.enemy.attackBonus,
                damage: state.enemy.damage,
                sprite: state.enemy.sprite,
                name: state.enemy.name
            };
            // Start in first phase (highest hp_threshold)
            state.enemy.currentPhase = state.enemy.phases[0];
            _log.debug('BattleCore', 'Enemy has phases:', state.enemy.phases.length, 'Starting phase:', state.enemy.currentPhase.id);
        }
    }

    /**
     * Reset auxiliary battle state (music, dialogue)
     */
    function resetAuxiliaryState() {
        state.musicState = {
            originalTrack: null,
            currentTrack: null,
            playerLowTriggered: false,
            playerCriticalTriggered: false,
            enemyCriticalTriggered: false
        };

        state.dialogue = {
            lastTrigger: null,
            cooldown: 0
        };
    }

    /**
     * Start a new battle
     * @param {Object} config - Battle configuration (flat format from story.js)
     * @param {string} sceneId - Current scene ID
     * @returns {Object} Initial battle state
     */
    function startBattle(config, sceneId) {
        // Input validation
        if (!config) {
            _log.error('BattleCore', 'startBattle called without config');
            return null;
        }
        if (!config.win_target) {
            _log.error('BattleCore', 'startBattle requires win_target');
            return null;
        }
        if (!config.lose_target) {
            _log.error('BattleCore', 'startBattle requires lose_target');
            return null;
        }

        // Reset core state
        state.active = true;
        state.phase = 'player';
        state.turn = 1;
        state.terrain = config.terrain || 'none';
        state.currentScene = sceneId;
        state.battleLog = [];

        // Reset summon system
        if (_hasBattleSummon) {
            BattleSummon.reset();
        }

        // Set up targets
        state.targets = {
            win: config.win_target,
            lose: config.lose_target,
            flee: config.flee_target || null
        };

        // Initialize combatants
        initializePlayerState(config);
        initializeEnemyState(config);
        resetAuxiliaryState();

        // Emit event
        emitEvent('battle:start', {
            player: state.player,
            enemy: state.enemy,
            terrain: state.terrain
        });

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
        emitEvent('battle:end', { result: result, target: targetScene });

        return {
            result: result,
            target: targetScene
        };
    }

    /**
     * Reset player stats to defaults (for "Play Again" / full game reset)
     * This clears persisted HP/mana so next battle starts fresh
     */
    function resetPlayerStats() {
        state.player.hp = null;
        state.player.mana = null;
        state.player.maxHP = playerDefaults.defaultMaxHP;
        state.player.maxMana = playerDefaults.defaultMaxMana;
        state.player.limitCharge = 0;
        state.player.statuses = [];
        state.player.stagger = 0;
        state.player.defending = false;
        state.player.defendCooldown = 0;
        state.player.itemCooldown = 0;
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
        emitEvent('player:damaged', {
            amount: actualDamage,
            source: options.source,
            type: options.type,
            isCrit: options.isCrit,
            oldHP: oldHP,
            newHP: state.player.hp
        });

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

        emitEvent('player:healed', {
            amount: actualHeal,
            source: source
        });

        return {
            healed: actualHeal,
            oldHP: oldHP,
            newHP: state.player.hp
        };
    }

    /**
     * Calculate how much healing would be applied (without actually applying it)
     * Used for displaying heal amount before animation completes
     * @param {number} amount - Heal amount to calculate
     * @returns {Object} Result with calculated heal amount
     */
    function calculatePendingHeal(amount) {
        var oldHP = state.player.hp;
        var newHP = Math.min(state.player.maxHP, state.player.hp + amount);
        var actualHeal = newHP - oldHP;

        return {
            healed: actualHeal,
            oldHP: oldHP,
            newHP: newHP
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
        _log.debug('BattleCore', 'damageEnemy amount:', amount, 'actualDamage:', actualDamage, 'oldHP:', oldHP, 'newHP:', state.enemy.hp);

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

        emitEvent('enemy:damaged', {
            amount: actualDamage,
            source: options.source,
            type: options.type,
            isCrit: options.isCrit,
            oldHP: oldHP,
            newHP: state.enemy.hp
        });

        // Check for phase transition
        var phaseTransition = checkPhaseTransition();

        if (state.enemy.hp <= 0) {
            emitEvent('enemy:defeated', { enemy: state.enemy });
        }

        return {
            damage: actualDamage,
            oldHP: oldHP,
            newHP: state.enemy.hp,
            killed: state.enemy.hp <= 0,
            phaseTransition: phaseTransition
        };
    }

    /**
     * Check if enemy should transition to a new phase based on HP
     * @returns {Object|null} Phase transition info or null if no transition
     */
    function checkPhaseTransition() {
        var enemy = state.enemy;
        if (!enemy.phases || enemy.phases.length === 0) return null;

        var hpPercent = enemy.hp / enemy.maxHP;
        var currentPhaseId = enemy.currentPhase ? enemy.currentPhase.id : null;

        // Find the appropriate phase based on HP threshold
        // Phases are sorted by hp_threshold descending (1.0 = base, 0.66 = super, 0.33 = ultra)
        var newPhase = null;
        for (var i = 0; i < enemy.phases.length; i++) {
            var phase = enemy.phases[i];
            if (hpPercent <= phase.hp_threshold) {
                newPhase = phase;
            }
        }

        // Check if we've transitioned to a new phase
        if (newPhase && newPhase.id !== currentPhaseId) {
            var oldPhase = enemy.currentPhase;
            enemy.currentPhase = newPhase;

            // Apply phase stats
            if (newPhase.attack_bonus !== undefined) {
                enemy.attackBonus = newPhase.attack_bonus;
            }
            if (newPhase.damage) {
                enemy.damage = newPhase.damage;
            }
            if (newPhase.sprite) {
                enemy.sprite = newPhase.sprite;
            }
            if (newPhase.name) {
                enemy.name = newPhase.name;
            }

            // Add super moves to available moves in super+ phases
            if (enemy.superMoves && newPhase.id !== 'base') {
                // Merge super moves with regular moves
                enemy.moves = enemy.moves.concat(enemy.superMoves);
            }

            _log.info('BattleCore', 'Phase transition:', oldPhase ? oldPhase.id : 'none', '->', newPhase.id,
                '| HP:', Math.round(hpPercent * 100) + '%',
                '| New stats: ATK+' + enemy.attackBonus + ', DMG=' + enemy.damage);

            // Emit phase transition event for UI handling
            emitEvent('enemy:phase-transition', {
                enemy: enemy,
                oldPhase: oldPhase,
                newPhase: newPhase,
                dialogue: newPhase.dialogue || null,
                intentsOnly: newPhase.intents_only || false
            });

            return {
                oldPhase: oldPhase,
                newPhase: newPhase,
                dialogue: newPhase.dialogue,
                intentsOnly: newPhase.intents_only
            };
        }

        return null;
    }

    /**
     * Check if enemy is in intents-only phase (Ultra Stefan)
     * @returns {boolean}
     */
    function isIntentsOnlyPhase() {
        var enemy = state.enemy;
        return enemy.currentPhase && enemy.currentPhase.intents_only === true;
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
        _log.debug('BattleCore', 'healEnemy amount:', amount, 'source:', source, 'oldHP:', oldHP, 'newHP:', state.enemy.hp);
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

    /**
     * Add mana (alias for restoreMana, used for refunds)
     * @param {number} amount - Mana to add
     * @returns {number} Actual mana added
     */
    function addMana(amount) {
        return restoreMana(amount);
    }

    // =========================================================================
    // STATUS EFFECTS
    // =========================================================================

    /**
     * Set callback to check if status effects should be guaranteed (dev mode)
     */
    function setGuaranteeStatusCallback(callback) {
        guaranteeStatusCallback = callback;
    }

    /**
     * Check if a status effect should apply based on chance
     * Respects dev mode guarantee status setting
     * @param {number} chance - Status effect chance (0-1)
     * @returns {boolean} True if status should apply
     */
    function shouldApplyStatus(chance) {
        // Always apply status effects (100% chance)
        return true;
    }

    /**
     * Apply a status effect to a target
     * @param {Object} target - player or enemy state
     * @param {string} statusType - Status effect ID
     * @param {number} stacks - Number of stacks (default 1)
     * @param {number} customDuration - Optional custom duration (overrides default)
     * @returns {Object} { applied, message }
     */
    function applyStatus(target, statusType, stacks, customDuration) {
        if (!_hasBattleData) return { applied: false, message: '' };
        var effectDef = BattleData.getStatusEffect(statusType);
        if (!effectDef) return { applied: false, message: '' };

        // Check for immunity from buffs (only for player)
        if (target === state.player && hasBuffImmunity(statusType)) {
            return {
                applied: false,
                immune: true,
                message: '🛡️ Immune to ' + effectDef.name + '!'
            };
        }

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

            emitEvent('player:status', {
                target: target === state.player ? 'player' : 'enemy',
                status: statusType,
                applied: true
            });

            return {
                applied: true,
                message: effectDef.icon + ' Inflicted ' + effectDef.name + '!'
            };
        }
    }

    /**
     * @deprecated Use applyStatus(target, statusType, stacks, customDuration) instead
     * Kept for backwards compatibility
     */
    function applyStatusWithDuration(target, statusType, stacks, customDuration) {
        return applyStatus(target, statusType, stacks, customDuration);
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

    // =========================================================================
    // BUFF SYSTEM (temporary positive effects from consumables)
    // =========================================================================

    /**
     * Apply a buff to the player
     * @param {Object} buffData - { type, duration, acBonus, attackBonus, immuneTo, burnOnAttack, etc. }
     * @returns {Object} { applied, message }
     */
    function applyBuff(buffData) {
        if (!buffData || !buffData.type) {
            return { applied: false, message: '' };
        }

        // Check if buff already exists - refresh duration
        var existing = findBuff(buffData.type);
        if (existing) {
            // If either duration is infinite, keep infinite
            if (existing.duration === 'infinite' || buffData.duration === 'infinite') {
                existing.duration = 'infinite';
            } else {
                existing.duration = Math.max(existing.duration, buffData.duration || 99);
            }
            return {
                applied: true,
                refreshed: true,
                message: '✨ ' + buffData.type + ' refreshed!'
            };
        }

        // Add new buff
        state.player.buffs.push({
            type: buffData.type,
            duration: buffData.duration || 99,
            acBonus: buffData.acBonus || 0,
            attackBonus: buffData.attackBonus || 0,
            immuneTo: buffData.immuneTo || [],
            burnOnAttack: buffData.burnOnAttack || 0,  // Number of attacks that apply burn
            burnAttacksRemaining: buffData.burnOnAttack || 0
        });

        _log.debug('BattleCore', 'Applied buff:', buffData.type, buffData);

        return {
            applied: true,
            message: '✨ Gained ' + buffData.type + '!'
        };
    }

    /**
     * Find a buff by type
     * @param {string} buffType - Buff type to find
     * @returns {Object|null} Buff object or null
     */
    function findBuff(buffType) {
        for (var i = 0; i < state.player.buffs.length; i++) {
            if (state.player.buffs[i].type === buffType) {
                return state.player.buffs[i];
            }
        }
        return null;
    }

    /**
     * Check if player has immunity to a status effect
     * @param {string} statusType - Status to check immunity for
     * @returns {boolean}
     */
    function hasBuffImmunity(statusType) {
        for (var i = 0; i < state.player.buffs.length; i++) {
            var buff = state.player.buffs[i];
            if (buff.immuneTo && buff.immuneTo.indexOf(statusType) !== -1) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get total AC bonus from all buffs
     * @returns {number}
     */
    function getBuffACBonus() {
        var total = 0;
        for (var i = 0; i < state.player.buffs.length; i++) {
            total += state.player.buffs[i].acBonus || 0;
        }
        return total;
    }

    /**
     * Get total attack bonus from all buffs
     * @returns {number}
     */
    function getBuffAttackBonus() {
        var total = 0;
        for (var i = 0; i < state.player.buffs.length; i++) {
            total += state.player.buffs[i].attackBonus || 0;
        }
        return total;
    }

    /**
     * Check if any buff provides burn on attack
     * Consumes one burn attack charge if available
     * @returns {boolean} True if attack should apply burn
     */
    function consumeBurnOnAttack() {
        for (var i = 0; i < state.player.buffs.length; i++) {
            var buff = state.player.buffs[i];
            if (buff.burnAttacksRemaining && buff.burnAttacksRemaining > 0) {
                buff.burnAttacksRemaining--;
                _log.debug('BattleCore', 'Consumed burn attack, remaining:', buff.burnAttacksRemaining);
                return true;
            }
        }
        return false;
    }

    /**
     * Clear all status effects from player
     * @returns {Object} { cleared, messages }
     */
    function clearAllStatuses() {
        var cleared = state.player.statuses.length;
        var messages = [];

        if (cleared > 0) {
            for (var i = 0; i < state.player.statuses.length; i++) {
                var status = state.player.statuses[i];
                var def = _hasBattleData ? BattleData.getStatusEffect(status.type) : null;
                if (def) {
                    messages.push(def.icon + ' ' + def.name + ' cleared!');
                }
            }
            state.player.statuses = [];
        }

        return { cleared: cleared, messages: messages };
    }

    /**
     * Clear all buffs from player (called at battle end or when needed)
     */
    function clearAllBuffs() {
        state.player.buffs = [];
    }

    /**
     * Tick buff durations (called each turn)
     * @returns {Array} Messages for expired buffs
     */
    function tickBuffs() {
        var messages = [];
        for (var i = state.player.buffs.length - 1; i >= 0; i--) {
            var buff = state.player.buffs[i];
            // Skip infinite duration buffs (they last the whole fight)
            if (buff.duration === 'infinite') {
                continue;
            }
            buff.duration--;
            if (buff.duration <= 0) {
                messages.push('✨ ' + buff.type + ' wore off.');
                state.player.buffs.splice(i, 1);
            }
        }
        return messages;
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

                // Check if target is coaled and this is burn damage - DOUBLE the damage!
                if (status.type === 'burn' && hasStatus(target, 'coaled')) {
                    dotDamage *= 2;
                    result.messages.push('[C] Charcoal ignites! ' + def.icon + ' ' + def.name + ' ' + dotDamage + ' <span class="keyword-damage">DOUBLE DAMAGE</span>');
                } else {
                    result.messages.push(def.icon + ' ' + def.name + ' ' + dotDamage + ' <span class="keyword-damage">DAMAGE</span>');
                }
                result.damage += dotDamage;
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

            // Decrement duration BEFORE checking expiry (fixes off-by-one bug)
            // Skip decrement on first turn (justApplied)
            if (!skipDOT) {
                status.duration--;
            }

            // Check if status expired (duration reached 0 after decrement)
            if (status.duration <= 0) {
                target.statuses.splice(i, 1);
                result.expiredStatuses.push(status.type);  // Track expired status
                result.messages.push(def.icon + ' ' + def.name + ' wore off!');
                continue;  // Status expired, skip further processing
            }

            // Confusion self-damage check
            // Logic:
            // - 40% chance: hurt self (roll 1-5 damage), can't act this turn, confusion persists
            // - 60% chance: shake off confusion immediately, can act this turn
            // Skip on first turn (justApplied) - confusion shouldn't tick the turn it's applied
            if (def.selfDamageChance && !skipDOT) {
                if (Math.random() < def.selfDamageChance) {
                    // Hit self - roll damage like a combat attack
                    var effectsCfg = T && T.battle && T.battle.effects ? T.battle.effects : {};
                    var minDmg = effectsCfg.confusionDamageMin || 1;
                    var maxDmg = effectsCfg.confusionDamageMax || 5;
                    var selfDamage = Math.floor(Math.random() * (maxDmg - minDmg + 1)) + minDmg;
                    result.confusionDamage = selfDamage;  // Store separately for proper display
                    result.canAct = false;  // Can't act when confused and hurt self
                    result.confusionTriggered = true;
                    // NOTE: Duration already decremented above, don't force duration=1
                    // Confusion persists naturally until shake-off succeeds or duration expires
                } else {
                    // Shake off - clear confusion immediately, can act this turn
                    var shakeOffMsg = def.icon + ' ' + targetName + ' shakes off confusion!';
                    result.messages.push(shakeOffMsg);
                    // Remove confusion immediately
                    target.statuses.splice(i, 1);
                    result.expiredStatuses.push(status.type);
                    continue;
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
        }

        return result;
    }

    /**
     * Get AC modifier from statuses
     * Delegates to BattleUtils for efficiency when available
     */
    function getStatusACModifier(target) {
        if (_hasBattleUtils) {
            return BattleUtils.getStatusACModifier(target);
        }
        // Fallback if BattleUtils not loaded
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
     * Delegates to BattleUtils for efficiency when available
     */
    function getStatusAttackModifier(target) {
        if (_hasBattleUtils) {
            return BattleUtils.getStatusAttackModifier(target);
        }
        // Fallback if BattleUtils not loaded
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
     * Delegates to BattleUtils for efficiency when available
     */
    function getStatusDamageModifier(target) {
        if (_hasBattleUtils) {
            return BattleUtils.getStatusDamageModifier(target);
        }
        // Fallback if BattleUtils not loaded
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
     * Uses map for O(n) lookup instead of O(n²) array search
     */
    function getAvailableItems() {
        var available = [];

        if (!_hasBattleData) return available;

        if (callbacks.getInventory) {
            var inventory = callbacks.getInventory();
            var itemMap = {};  // Map itemId -> index in available array

            for (var i = 0; i < inventory.length; i++) {
                var itemName = inventory[i];
                var itemId = itemName.toLowerCase().replace(/\s+/g, '_');
                var itemDef = BattleData.getItem(itemId);

                if (itemDef) {
                    if (itemMap.hasOwnProperty(itemId)) {
                        available[itemMap[itemId]].quantity++;
                    } else {
                        itemMap[itemId] = available.length;
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
     * Create a player summon (uses BattleSummon.spawn for HP-based summons)
     */
    function createSummon(summonId) {
        if (!_hasBattleSummon) {
            return { success: false, reason: 'no_summon_module' };
        }

        // Use HP-based summon system
        var result = BattleSummon.spawn(summonId, 'player', 'player');
        if (result.success) {
            triggerDialogue('summon_appears');
            playSfx('summon_appear');
        }
        return result;
    }

    /**
     * Process HP-based player summons (new system)
     */
    function processSpawnedPlayerSummons(summons) {
        var messages = [];
        var allExpired = [];
        var attackResult = null;

        for (var i = 0; i < summons.length; i++) {
            var summon = summons[i];

            // Decrement duration
            summon.turnsRemaining--;

            // Check expiration
            if (summon.turnsRemaining <= 0) {
                var expireDialogue = BattleSummon.getDialogue(summon.uid, 'expire');
                if (expireDialogue) {
                    messages.push(summon.icon + ' "' + expireDialogue + '"');
                }
                messages.push(summon.icon + ' ' + summon.name + ' fades away...');
                BattleSummon.dismiss(summon.uid, 'expired');
                allExpired.push(summon);
                playSfx('summon_expire');
                continue;
            }

            // Summon attacks
            if (summon.canAttack) {
                // Select a move
                var move = summon.moves && summon.moves.length > 0
                    ? Utils.pickRandom(summon.moves)
                    : { name: 'Attack', damage: summon.damage, type: summon.damageType };

                // Get attack dialogue
                var attackDialogue = BattleSummon.getDialogue(summon.uid, 'attack');
                if (attackDialogue) {
                    messages.push(summon.icon + ' "' + attackDialogue + '"');
                }

                // Roll damage using BattleDice if available
                var damageRoll = 0;
                if (typeof BattleDice !== 'undefined' && BattleDice.rollDamage) {
                    damageRoll = BattleDice.rollDamage(move.damage);
                } else {
                    // Simple dice roll fallback
                    var diceMatch = (move.damage || 'd4').match(/(\d*)d(\d+)/);
                    if (diceMatch) {
                        var numDice = parseInt(diceMatch[1]) || 1;
                        var dieSize = parseInt(diceMatch[2]);
                        for (var d = 0; d < numDice; d++) {
                            damageRoll += Math.floor(Math.random() * dieSize) + 1;
                        }
                    } else {
                        damageRoll = parseInt(move.damage) || 1;
                    }
                }

                // Apply damage to enemy
                var dmgResult = damageEnemy(damageRoll, { source: 'summon', type: move.type || 'physical' });
                // Styled damage - typewriter preserves roll-* class spans via placeholder system
                messages.push(summon.icon + ' ' + summon.name + ' uses ' + move.name + ' for <span class="roll-damage-normal">' + dmgResult.damage + ' DAMAGE!</span>');

                attackResult = { hit: true, damage: dmgResult.damage };
            }
        }

        return {
            acted: messages.length > 0,
            messages: messages,
            attackResult: attackResult,
            expired: allExpired
        };
    }

    /**
     * Process player summon turn (HP-based summons only)
     */
    function processSummonTurn() {
        if (!_hasBattleSummon) {
            return { acted: false, messages: [] };
        }

        var spawnedSummons = BattleSummon.getActiveBySide('player');
        if (spawnedSummons.length > 0) {
            return processSpawnedPlayerSummons(spawnedSummons);
        }

        return { acted: false, messages: [] };
    }

    /**
     * Dismiss player summon early
     */
    function dismissSummon() {
        if (!_hasBattleSummon) return false;

        var playerSummons = BattleSummon.getActiveBySide('player');
        if (playerSummons.length === 0) return false;

        // Dismiss all player summons
        for (var i = 0; i < playerSummons.length; i++) {
            BattleSummon.dismiss(playerSummons[i].uid, 'dismissed');
        }
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
                line = Utils.pickRandom(lines);
            }
        }

        // Fall back to generic BattleData dialogue
        if (!line && _hasBattleData) {
            line = BattleData.getDialogue(trigger);
        }

        if (line) {
            state.dialogue.lastTrigger = trigger;
            // Use tuning value for dialogue cooldown
            var aiConfig = T && T.battle && T.battle.ai ? T.battle.ai : {};
            state.dialogue.cooldown = aiConfig.tauntCooldown || 2;
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
            summon: getSummon(),  // Get from BattleSummon module
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
     * Check if it's currently the player's turn
     * @returns {boolean} true if player can act, false otherwise
     */
    function isPlayerTurn() {
        return state.phase === 'player';
    }

    /**
     * Update battle button states based on current phase
     * Buttons are only interactive during 'player' phase
     */
    function updateBattleButtonsState(phase) {
        // Delegate DOM updates to BattleUI (logic/UI separation)
        if (typeof BattleUI !== 'undefined' && BattleUI.setPhaseDisplay) {
            BattleUI.setPhaseDisplay(phase);
        }

        // Always refresh battle choices - this handles both:
        // - Disabling all buttons when NOT player turn
        // - Re-enabling buttons (respecting cooldowns) when player turn
        if (typeof VNEngine !== 'undefined' && VNEngine.refreshBattleChoices) {
            VNEngine.refreshBattleChoices();
        }
    }

    function getTurn() {
        return state.turn;
    }

    function incrementTurn() {
        state.turn++;
        tickDialogueCooldown();
        // Tick defend cooldown at end of each full turn cycle
        // A turn = enemy action + player action (or QTE during defensive stance)
        tickDefendCooldown();
        tickItemCooldown();
    }

    /**
     * Decrement the defend cooldown (called when player takes an action)
     */
    function tickDefendCooldown() {
        // Skip tick if cooldown was just set this turn (prevents 3→2→1 visual bug)
        if (state.player.defendCooldownJustSet) {
            state.player.defendCooldownJustSet = false;
            return;
        }
        if (state.player.defendCooldown > 0) {
            state.player.defendCooldown--;
        }
    }

    /**
     * Decrement the item cooldown (called each turn)
     */
    function tickItemCooldown() {
        // Skip tick if cooldown was just set this turn (prevents visual bug)
        if (state.player.itemCooldownJustSet) {
            state.player.itemCooldownJustSet = false;
            return;
        }
        if (state.player.itemCooldown > 0) {
            state.player.itemCooldown--;
        }
    }

    /**
     * Set item cooldown (called when a consumable item is used)
     */
    function setItemCooldown(turns) {
        state.player.itemCooldown = turns;
        state.player.itemCooldownJustSet = true;
    }

    /**
     * Get current item cooldown
     */
    function getItemCooldown() {
        return state.player.itemCooldown || 0;
    }

    function getPlayer() {
        return state.player;
    }

    function getEnemy() {
        return state.enemy;
    }

    function getSummon() {
        // Return first active player summon (HP-based system)
        if (_hasBattleSummon) {
            var playerSummons = BattleSummon.getActiveBySide('player');
            return playerSummons.length > 0 ? playerSummons[0] : null;
        }
        return null;
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
        resetPlayerStats: resetPlayerStats,
        checkBattleEnd: checkBattleEnd,

        // HP/Mana
        damagePlayer: damagePlayer,
        healPlayer: healPlayer,
        calculatePendingHeal: calculatePendingHeal,
        damageEnemy: damageEnemy,
        healEnemy: healEnemy,
        useMana: useMana,
        restoreMana: restoreMana,
        addMana: addMana,

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
        shouldApplyStatus: shouldApplyStatus,
        setGuaranteeStatusCallback: setGuaranteeStatusCallback,
        clearAllStatuses: clearAllStatuses,

        // Buffs (temporary positive effects from consumables)
        applyBuff: applyBuff,
        hasBuffImmunity: hasBuffImmunity,
        getBuffACBonus: getBuffACBonus,
        getBuffAttackBonus: getBuffAttackBonus,
        consumeBurnOnAttack: consumeBurnOnAttack,
        clearAllBuffs: clearAllBuffs,
        tickBuffs: tickBuffs,

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
        isPlayerTurn: isPlayerTurn,
        getTurn: getTurn,
        incrementTurn: incrementTurn,
        tickDefendCooldown: tickDefendCooldown,
        tickItemCooldown: tickItemCooldown,
        setItemCooldown: setItemCooldown,
        getItemCooldown: getItemCooldown,
        getPlayer: getPlayer,
        getEnemy: getEnemy,
        isIntentsOnlyPhase: isIntentsOnlyPhase,
        getSummon: getSummon,
        getTerrain: getTerrain,
        getTargets: getTargets,
        getCombatConfig: getCombatConfig
    };
})();
