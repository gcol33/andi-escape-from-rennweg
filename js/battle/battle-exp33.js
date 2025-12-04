/**
 * Andi VN - Battle Style: Expedition 33
 *
 * Inspired by Expedition 33's ARK battle system featuring:
 * - AP (Action Points) system - actions cost AP, regenerates each turn
 * - Chain combos - consecutive attacks build combo multiplier
 * - Weakness targeting - hitting weak points deals bonus damage
 * - Guard Break system - heavy attacks can break guard
 * - Momentum gauge - builds with successful actions
 * - Tactical positioning (front/back row conceptually)
 *
 * Key differences from D&D:
 * - No d20 rolls, all attacks hit (but can be guarded)
 * - AP replaces mana for action economy
 * - Combo system rewards aggressive play
 * - Guard/Break mechanics add tactical depth
 */

var BattleStyleExp33 = (function() {
    'use strict';

    // =========================================================================
    // MODULE DEPENDENCY CHECK (uses BattleUtils if available)
    // =========================================================================

    var _hasBattleUtils = typeof BattleUtils !== 'undefined';
    var _hasBattleData = _hasBattleUtils ? BattleUtils.hasBattleData() : typeof BattleData !== 'undefined';

    if (!_hasBattleData) {
        console.warn('[BattleStyleExp33] BattleData module not loaded - some features will be unavailable');
    }

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    var config = {
        maxAP: 6,
        apRegenPerTurn: 3,
        baseAttackCost: 2,
        skillCostMultiplier: 1,
        comboDecayTurns: 1,
        maxCombo: 10,
        comboDamageBonus: 0.1,  // 10% per combo level
        weakpointMultiplier: 1.5,
        guardReduction: 0.5,  // 50% damage reduction when guarding
        guardBreakThreshold: 3,  // Hits to break guard
        momentumMax: 100,
        momentumPerHit: 10,
        momentumDecay: 5
    };

    // =========================================================================
    // STATE
    // =========================================================================

    var battleState = {
        playerAP: config.maxAP,
        enemyAP: config.maxAP,
        combo: 0,
        comboTimer: 0,
        momentum: 0,
        playerGuardHits: 0,
        enemyGuardHits: 0,
        lastAction: null
    };

    function resetBattleState() {
        battleState.playerAP = config.maxAP;
        battleState.enemyAP = config.maxAP;
        battleState.combo = 0;
        battleState.comboTimer = 0;
        battleState.momentum = 0;
        battleState.playerGuardHits = 0;
        battleState.enemyGuardHits = 0;
        battleState.lastAction = null;
    }

    // =========================================================================
    // AP MANAGEMENT
    // =========================================================================

    function getPlayerAP() {
        return battleState.playerAP;
    }

    function getEnemyAP() {
        return battleState.enemyAP;
    }

    function usePlayerAP(amount) {
        if (battleState.playerAP < amount) return false;
        battleState.playerAP -= amount;
        return true;
    }

    function useEnemyAP(amount) {
        if (battleState.enemyAP < amount) return false;
        battleState.enemyAP -= amount;
        return true;
    }

    function regenAP() {
        battleState.playerAP = Math.min(config.maxAP, battleState.playerAP + config.apRegenPerTurn);
        battleState.enemyAP = Math.min(config.maxAP, battleState.enemyAP + config.apRegenPerTurn);
    }

    // =========================================================================
    // COMBO SYSTEM
    // =========================================================================

    function addCombo() {
        battleState.combo = Math.min(config.maxCombo, battleState.combo + 1);
        battleState.comboTimer = config.comboDecayTurns;
    }

    function resetCombo() {
        battleState.combo = 0;
        battleState.comboTimer = 0;
    }

    function tickCombo() {
        if (battleState.comboTimer > 0) {
            battleState.comboTimer--;
            if (battleState.comboTimer <= 0) {
                resetCombo();
            }
        }
    }

    function getComboMultiplier() {
        return 1 + (battleState.combo * config.comboDamageBonus);
    }

    // =========================================================================
    // MOMENTUM SYSTEM
    // =========================================================================

    function addMomentum(amount) {
        battleState.momentum = Math.min(config.momentumMax, battleState.momentum + amount);
    }

    function useMomentum() {
        if (battleState.momentum < config.momentumMax) return false;
        battleState.momentum = 0;
        return true;
    }

    function decayMomentum() {
        battleState.momentum = Math.max(0, battleState.momentum - config.momentumDecay);
    }

    function isMomentumReady() {
        return battleState.momentum >= config.momentumMax;
    }

    // =========================================================================
    // GUARD SYSTEM
    // =========================================================================

    function hitGuard(isPlayer) {
        if (isPlayer) {
            battleState.playerGuardHits++;
            return battleState.playerGuardHits >= config.guardBreakThreshold;
        } else {
            battleState.enemyGuardHits++;
            return battleState.enemyGuardHits >= config.guardBreakThreshold;
        }
    }

    function resetGuard(isPlayer) {
        if (isPlayer) {
            battleState.playerGuardHits = 0;
        } else {
            battleState.enemyGuardHits = 0;
        }
    }

    // =========================================================================
    // DAMAGE CALCULATION
    // =========================================================================

    /**
     * Calculate damage with Exp33 mechanics
     */
    function calculateDamage(baseDamage, options) {
        options = options || {};
        var damage = baseDamage;

        // Combo multiplier
        if (options.useCombo) {
            damage = Math.floor(damage * getComboMultiplier());
        }

        // Weakpoint bonus
        if (options.isWeakpoint) {
            damage = Math.floor(damage * config.weakpointMultiplier);
        }

        // Type effectiveness
        if (options.attackType && options.defenderType && _hasBattleData) {
            var mult = BattleData.getTypeMultiplier(options.attackType, options.defenderType);
            damage = Math.floor(damage * mult);
        }

        // Terrain multiplier
        if (options.attackType) {
            var terrainMult = BattleCore.getTerrainMultiplier(options.attackType);
            damage = Math.floor(damage * terrainMult);
        }

        // Guard reduction
        if (options.isGuarded && !options.guardBroken) {
            damage = Math.floor(damage * config.guardReduction);
        }

        return Math.max(1, damage);
    }

    /**
     * Roll base damage from dice or flat number
     * Delegates to BattleUtils if available
     */
    function rollBaseDamage(diceStr) {
        // Use BattleUtils if available for centralized dice rolling
        if (_hasBattleUtils && BattleUtils.rollDamage) {
            return BattleUtils.rollDamage(diceStr, 1);
        }

        // Fallback implementation
        if (typeof diceStr === 'number') return diceStr;

        var match = diceStr.match(/(\d*)d(\d+)([+-]\d+)?/i);
        if (!match) return 5;

        var numDice = parseInt(match[1], 10) || 1;
        var sides = parseInt(match[2], 10);
        var modifier = parseInt(match[3], 10) || 0;

        var total = modifier;
        for (var i = 0; i < numDice; i++) {
            total += Math.floor(Math.random() * sides) + 1;
        }
        return Math.max(1, total);
    }

    // =========================================================================
    // ATTACK RESOLUTION
    // =========================================================================

    /**
     * Resolve an attack using Exp33 mechanics
     */
    function resolveAttack(attacker, defender, skill, options) {
        skill = skill || {};
        options = options || {};

        var baseDamage = rollBaseDamage(skill.damage || attacker.damage || '2d6');
        var attackType = skill.type || attacker.type || 'physical';

        // Check if hitting weakpoint
        var isWeakpoint = defender.weakpoint && defender.weakpoint === attackType;

        // Check guard
        var isGuarded = defender.defending;
        var guardBroken = false;

        if (isGuarded) {
            // Heavy attacks can break guard
            if (skill.isHeavy || options.isHeavy) {
                guardBroken = hitGuard(defender === BattleCore.getPlayer());
            } else {
                hitGuard(defender === BattleCore.getPlayer());
            }
        }

        // Calculate final damage
        var damage = calculateDamage(baseDamage, {
            useCombo: true,
            isWeakpoint: isWeakpoint,
            attackType: attackType,
            defenderType: defender.type,
            isGuarded: isGuarded,
            guardBroken: guardBroken
        });

        // Update combo
        addCombo();
        addMomentum(config.momentumPerHit);

        // Status effect
        var statusResult = null;
        if (skill.statusEffect) {
            statusResult = tryApplyStatus(skill, defender);
        }

        return {
            hit: true,
            damage: damage,
            baseDamage: baseDamage,
            attackType: attackType,
            isWeakpoint: isWeakpoint,
            isGuarded: isGuarded,
            guardBroken: guardBroken,
            combo: battleState.combo,
            statusResult: statusResult
        };
    }

    /**
     * Try to apply status effect from skill
     * Delegates to BattleUtils if available
     */
    function tryApplyStatus(skill, target) {
        // Use BattleUtils if available for centralized status application
        if (_hasBattleUtils && BattleUtils.tryApplyStatus) {
            return BattleUtils.tryApplyStatus(skill, target);
        }

        // Fallback implementation
        if (!skill || !skill.statusEffect) return null;

        var statusInfo = skill.statusEffect;
        var chance = statusInfo.chance || 0.5;

        if (BattleCore.shouldApplyStatus(chance)) {
            return BattleCore.applyStatus(target, statusInfo.type, statusInfo.stacks || 1);
        }
        return { applied: false };
    }

    /**
     * Resolve summon attack
     * @param {Object} summon - The summon object
     * @param {Object} defender - The target being attacked
     * @param {Object} move - Optional move object (for new enemy summon system)
     */
    function resolveSummonAttack(summon, defender, move) {
        // Handle both legacy player summons (summon.attack) and new enemy summons (move parameter)
        var attackData;
        if (move) {
            // New enemy summon system: move passed separately
            attackData = {
                damage: move.damage || summon.damage || 'd4',
                type: move.type || summon.damageType || 'physical'
            };
        } else if (summon.attack) {
            // Legacy player summon system
            attackData = {
                damage: summon.attack.damage,
                type: summon.attack.type
            };
        } else {
            // Fallback
            attackData = {
                damage: summon.damage || 'd4',
                type: summon.damageType || 'physical'
            };
        }

        return resolveAttack(attackData, defender, move || summon.attack);
    }

    // =========================================================================
    // PLAYER ACTIONS
    // =========================================================================

    /**
     * Execute player basic attack
     */
    function playerAttack(qteResult) {
        var player = BattleCore.getPlayer();
        var enemy = BattleCore.getEnemy();

        // Check AP
        if (!usePlayerAP(config.baseAttackCost)) {
            return {
                success: false,
                reason: 'no_ap',
                messages: ['Not enough AP! (' + battleState.playerAP + '/' + config.baseAttackCost + ')']
            };
        }

        var result = resolveAttack(player, enemy, null, {});

        if (result.hit) {
            BattleCore.damageEnemy(result.damage, {
                source: 'player',
                type: result.attackType,
                isCrit: result.isWeakpoint
            });

            BattleCore.addStagger(enemy, result.isWeakpoint ? 20 : 10);
        }

        var messages = [];
        messages.push(player.name + ' attacks! (Combo x' + result.combo + ')');
        messages.push('Dealt ' + result.damage + ' damage!');

        if (result.isWeakpoint) {
            messages.push('Weakpoint hit!');
        }
        if (result.isGuarded) {
            messages.push(result.guardBroken ? 'Guard broken!' : 'Attack was guarded!');
        }

        player.defending = false;
        BattleCore.playSfx('attack_physical');

        return {
            success: true,
            attackResult: result,
            messages: messages
        };
    }

    /**
     * Execute player skill
     */
    function playerSkill(skillId, qteResult) {
        var player = BattleCore.getPlayer();
        var enemy = BattleCore.getEnemy();
        var skill = _hasBattleData ? BattleData.getSkill(skillId) : null;

        if (!skill) {
            return { success: false, reason: 'unknown_skill', messages: ['Unknown skill!'] };
        }

        // Calculate AP cost
        var apCost = Math.ceil((skill.manaCost || 3) * config.skillCostMultiplier);
        if (!usePlayerAP(apCost)) {
            return {
                success: false,
                reason: 'no_ap',
                messages: ['Not enough AP! (' + battleState.playerAP + '/' + apCost + ')']
            };
        }

        var messages = [];
        messages.push(player.name + ' uses ' + skill.name + '! (Cost: ' + apCost + ' AP)');

        // Healing skill
        if (skill.isHeal) {
            var healAmount = rollBaseDamage(skill.healAmount || '2d6');
            var healResult = BattleCore.healPlayer(healAmount, 'skill');
            messages.push('Restored ' + healResult.healed + ' HP!');

            if (skill.statusEffect && skill.statusEffect.target === 'self') {
                var selfStatus = BattleCore.applyStatus(player, skill.statusEffect.type, 1);
                if (selfStatus.applied) messages.push(selfStatus.message);
            }

            BattleCore.playSfx('heal');
            return { success: true, healed: healResult.healed, messages: messages };
        }

        // Buff skill
        if (skill.isBuff) {
            if (skill.statusEffect) {
                var buffResult = BattleCore.applyStatus(player, skill.statusEffect.type, 1);
                if (buffResult.applied) messages.push(buffResult.message);
            }
            BattleCore.playSfx('buff_apply');
            return { success: true, messages: messages };
        }

        // Summon skill
        if (skill.isSummon) {
            var summonId = skill.summonId;
            if (!summonId) {
                return { success: false, reason: 'no_summon_id', messages: ['Summon skill has no target!'] };
            }

            if (typeof BattleSummon === 'undefined') {
                return { success: false, reason: 'no_summon_module', messages: ['Summon system not available!'] };
            }

            var spawnResult = BattleSummon.spawn(summonId, 'player', 'player');

            if (!spawnResult.success) {
                // Refund AP if summon failed
                battleState.playerAP = Math.min(config.maxAP, battleState.playerAP + apCost);
                return {
                    success: false,
                    reason: spawnResult.reason,
                    messages: [spawnResult.message || 'Cannot summon!']
                };
            }

            messages.push(spawnResult.message);

            var summonDialogue = BattleSummon.getDialogue(spawnResult.summon.uid, 'summon_appear');
            if (summonDialogue) {
                messages.push('"' + summonDialogue + '"');
            }

            BattleCore.playSfx('summon');
            return {
                success: true,
                summonResult: spawnResult,
                summon: spawnResult.summon,
                messages: messages
            };
        }

        // Attack skill
        var result = resolveAttack(player, enemy, skill, { isHeavy: skill.isHeavy });

        if (result.hit) {
            BattleCore.damageEnemy(result.damage, {
                source: 'player',
                type: result.attackType,
                isCrit: result.isWeakpoint
            });

            messages.push('Dealt ' + result.damage + ' damage! (Combo x' + result.combo + ')');

            if (result.isWeakpoint) messages.push('Weakpoint hit!');
            if (result.isGuarded) {
                messages.push(result.guardBroken ? 'Guard broken!' : 'Attack was guarded!');
            }
            if (result.statusResult && result.statusResult.applied) {
                messages.push(result.statusResult.message);
            }

            BattleCore.addStagger(enemy, result.isWeakpoint ? 25 : 15);
            BattleCore.playSfx('attack_' + result.attackType);
        }

        player.defending = false;
        return { success: true, attackResult: result, messages: messages };
    }

    /**
     * Defend action - guard stance
     */
    function playerDefend() {
        var player = BattleCore.getPlayer();

        player.defending = true;
        resetGuard(true);  // Reset guard hits when starting to guard

        // Regen extra AP when guarding
        battleState.playerAP = Math.min(config.maxAP, battleState.playerAP + 1);

        BattleCore.playSfx('defend');

        return {
            success: true,
            messages: [
                player.name + ' takes a defensive stance!',
                'Guard active (takes 50% damage)',
                'Recovered 1 AP'
            ]
        };
    }

    /**
     * Attempt to flee
     */
    function playerFlee() {
        // Fleeing costs AP and has a chance based on momentum
        var fleeAPCost = 2;

        if (!usePlayerAP(fleeAPCost)) {
            return {
                success: false,
                reason: 'no_ap',
                messages: ['Not enough AP to flee!']
            };
        }

        // Higher momentum = easier escape
        var fleeChance = 0.3 + (battleState.momentum / config.momentumMax) * 0.5;
        var success = Math.random() < fleeChance;

        if (success) {
            BattleCore.playSfx('flee_success');
            return {
                success: true,
                messages: ['Escaped successfully!']
            };
        } else {
            BattleCore.playSfx('flee_fail');
            return {
                success: false,
                roll: Math.floor(fleeChance * 100),
                messages: ['Failed to escape! (Chance was ' + Math.floor(fleeChance * 100) + '%)']
            };
        }
    }

    /**
     * Execute limit break (Momentum Burst)
     */
    function playerLimitBreak() {
        if (!isMomentumReady()) {
            return { success: false, reason: 'not_ready', messages: ['Momentum not full!'] };
        }

        var player = BattleCore.getPlayer();
        var enemy = BattleCore.getEnemy();
        var limitBreak = _hasBattleData ? BattleData.getLimitBreak(player.limitBreak) : null;

        if (!limitBreak) {
            return { success: false, reason: 'unknown', messages: ['Unknown Momentum Burst!'] };
        }

        useMomentum();
        BattleCore.useLimitCharge();  // Also reset standard limit

        var messages = [];
        messages.push('MOMENTUM BURST: ' + limitBreak.name + '!');

        var totalDamage = 0;
        var hits = limitBreak.hits || 3;

        for (var i = 0; i < hits; i++) {
            var hitDamage = rollBaseDamage(limitBreak.damage || '3d6');
            // Momentum bursts ignore guard
            hitDamage = calculateDamage(hitDamage, {
                useCombo: true,
                attackType: limitBreak.type,
                defenderType: enemy.type
            });

            totalDamage += hitDamage;
            BattleCore.damageEnemy(hitDamage, { source: 'limit_break', type: limitBreak.type });

            if (hits > 1) {
                messages.push('Hit ' + (i + 1) + ': ' + hitDamage + ' damage!');
            }
        }

        messages.push('Total: ' + totalDamage + ' damage!');

        if (limitBreak.selfHeal) {
            var healResult = BattleCore.healPlayer(limitBreak.selfHeal, 'limit');
            messages.push('Recovered ' + healResult.healed + ' HP!');
        }

        resetCombo();  // Big finisher resets combo
        BattleCore.playSfx('limit_activate');

        return {
            success: true,
            totalDamage: totalDamage,
            messages: messages
        };
    }

    // =========================================================================
    // ENEMY AI
    // =========================================================================

    /**
     * Select enemy move based on AP and situation
     */
    function selectEnemyMove() {
        var enemy = BattleCore.getEnemy();
        var player = BattleCore.getPlayer();
        var moves = enemy.moves || [];

        if (moves.length === 0) {
            return { name: 'Attack', damage: '2d6', type: 'physical', apCost: 2 };
        }

        var enemyHP = enemy.hp / enemy.maxHP;
        var playerHP = player.hp / player.maxHP;

        // Low HP: heal or defend
        if (enemyHP < 0.25) {
            var healMove = findMoveByType(moves, 'heal');
            if (healMove && battleState.enemyAP >= (healMove.apCost || 3)) {
                return healMove;
            }
            // Defend if low AP
            if (battleState.enemyAP < 2) {
                return { name: 'Guard', isDefend: true, apCost: 0 };
            }
        }

        // Player low HP: aggressive
        if (playerHP < 0.3) {
            var strongMove = findStrongestMove(moves);
            if (strongMove && battleState.enemyAP >= (strongMove.apCost || 2)) {
                return strongMove;
            }
        }

        // Find affordable moves
        var affordable = moves.filter(function(m) {
            return battleState.enemyAP >= (m.apCost || 2);
        });

        if (affordable.length === 0) {
            // Not enough AP, defend to regen
            return { name: 'Guard', isDefend: true, apCost: 0 };
        }

        // Random from affordable
        return affordable[Math.floor(Math.random() * affordable.length)];
    }

    function findMoveByType(moves, type) {
        for (var i = 0; i < moves.length; i++) {
            if (type === 'heal' && moves[i].isHeal) return moves[i];
            if (type === 'buff' && moves[i].isBuff) return moves[i];
        }
        return null;
    }

    function findStrongestMove(moves) {
        var best = null;
        var bestDamage = 0;

        for (var i = 0; i < moves.length; i++) {
            if (moves[i].damage) {
                var est = estimateDamage(moves[i].damage);
                if (est > bestDamage) {
                    bestDamage = est;
                    best = moves[i];
                }
            }
        }
        return best;
    }

    function estimateDamage(diceStr) {
        if (typeof diceStr === 'number') return diceStr;
        var match = diceStr.match(/(\d*)d(\d+)([+-]\d+)?/i);
        if (!match) return 5;
        var numDice = parseInt(match[1], 10) || 1;
        var sides = parseInt(match[2], 10);
        var modifier = parseInt(match[3], 10) || 0;
        return numDice * ((sides + 1) / 2) + modifier;
    }

    /**
     * Execute enemy turn
     */
    function enemyTurn(qteResult) {
        var enemy = BattleCore.getEnemy();
        var player = BattleCore.getPlayer();

        // Check if can act
        if (!BattleCore.canAct(enemy)) {
            return {
                success: false,
                reason: 'cannot_act',
                messages: [BattleCore.getCannotActMessage(enemy, enemy.name)]
            };
        }

        var move = selectEnemyMove();
        var messages = [];

        // Defend action
        if (move.isDefend) {
            enemy.defending = true;
            resetGuard(false);
            battleState.enemyAP = Math.min(config.maxAP, battleState.enemyAP + 2);
            messages.push(enemy.name + ' takes a defensive stance!');
            BattleCore.playSfx('defend');
            return { success: true, defended: true, messages: messages };
        }

        // Use AP
        var apCost = move.apCost || 2;
        useEnemyAP(apCost);

        messages.push(enemy.name + ' uses ' + (move.name || 'Attack') + '!');

        // Heal move
        if (move.isHeal) {
            var healAmount = rollBaseDamage(move.healAmount || '2d6');
            var healResult = BattleCore.healEnemy(healAmount, 'move');
            messages.push('Recovered ' + healResult.healed + ' HP!');
            BattleCore.playSfx('heal');
            return { success: true, healed: healResult.healed, messages: messages };
        }

        // Attack move
        var result = resolveAttack(enemy, player, move, { isHeavy: move.isHeavy });

        var finalDamage = result.damage;

        // QTE dodge reduction
        if (qteResult && qteResult.damageReduction) {
            finalDamage = Math.floor(finalDamage * (1 - qteResult.damageReduction));
        }

        if (finalDamage > 0) {
            BattleCore.damagePlayer(finalDamage, {
                source: 'enemy',
                type: result.attackType,
                isCrit: result.isWeakpoint
            });

            messages.push('Dealt ' + finalDamage + ' damage!');

            if (result.isGuarded) {
                messages.push(result.guardBroken ? 'Your guard was broken!' : 'Attack was guarded!');
            }
            if (result.statusResult && result.statusResult.applied) {
                messages.push(result.statusResult.message);
            }

            BattleCore.playSfx('attack_' + result.attackType);
        } else {
            messages.push('You dodged completely!');
            BattleCore.playSfx('attack_miss');
        }

        player.defending = false;

        return {
            success: true,
            attackResult: result,
            messages: messages
        };
    }

    // =========================================================================
    // TURN MANAGEMENT
    // =========================================================================

    /**
     * Called at start of each turn cycle
     */
    function onTurnStart() {
        regenAP();
        tickCombo();
        decayMomentum();
    }

    // =========================================================================
    // QTE INTEGRATION (Exp33 specific)
    // =========================================================================

    /**
     * Execute player attack with chain combo QTE
     * @param {Object} qteResult - Result from chain combo QTE
     */
    function playerAttackWithQTE(callback) {
        if (typeof QTEEngine === 'undefined') {
            // No QTE, just attack
            var result = playerAttack();
            if (callback) callback(result);
            return;
        }

        // Start chain combo QTE
        QTEEngine.startChainComboQTE({
            hits: 3,
            baseInterval: 600,
            difficulty: 'normal'
        }, function(qteResult) {
            var player = BattleCore.getPlayer();
            var enemy = BattleCore.getEnemy();

            // Calculate damage based on QTE result
            var hitsLanded = 0;
            if (qteResult.chainData) {
                hitsLanded = qteResult.chainData.hitsLanded;
            }

            var messages = [];
            messages.push(player.name + ' attacks!');

            if (hitsLanded > 0) {
                var damagePerHit = rollBaseDamage(player.damage || '2d6');
                var totalDamage = 0;

                for (var i = 0; i < hitsLanded; i++) {
                    var hitDamage = calculateDamage(damagePerHit, {
                        useCombo: true,
                        attackType: player.type,
                        defenderType: enemy.type
                    });
                    totalDamage += hitDamage;
                    BattleCore.damageEnemy(hitDamage, { source: 'player', type: player.type });
                }

                messages.push(hitsLanded + ' hits for ' + totalDamage + ' total damage!');

                // Add momentum from QTE
                if (qteResult.modifiers && qteResult.modifiers.momentumBonus) {
                    addMomentum(qteResult.modifiers.momentumBonus);
                }
            } else {
                messages.push('All attacks missed!');
            }

            BattleCore.playSfx('attack_physical');

            if (callback) callback({
                success: true,
                messages: messages,
                qteResult: qteResult
            });
        });
    }

    /**
     * Handle enemy attack with parry QTE opportunity
     */
    function enemyTurnWithQTE(callback) {
        var enemy = BattleCore.getEnemy();
        var player = BattleCore.getPlayer();

        // Check if can act
        if (!BattleCore.canAct(enemy)) {
            if (callback) callback({
                success: false,
                reason: 'cannot_act',
                messages: [BattleCore.getCannotActMessage(enemy, enemy.name)]
            });
            return;
        }

        var move = selectEnemyMove();

        // If defending, offer parry QTE instead of dodge
        if (player.defending && typeof QTEEngine !== 'undefined') {
            QTEEngine.startParryQTE({
                difficulty: 'normal',
                attackPower: move.damage
            }, function(qteResult) {
                finishEnemyTurnWithQTE(move, qteResult, callback);
            });
        } else if (typeof QTEEngine !== 'undefined') {
            // Normal dodge QTE
            QTEEngine.startDodgeQTE({
                difficulty: 'normal'
            }, function(qteResult) {
                finishEnemyTurnWithQTE(move, qteResult, callback);
            });
        } else {
            // No QTE
            var result = enemyTurn();
            if (callback) callback(result);
        }
    }

    /**
     * Finish enemy turn after QTE
     */
    function finishEnemyTurnWithQTE(move, qteResult, callback) {
        var enemy = BattleCore.getEnemy();
        var player = BattleCore.getPlayer();
        var messages = [];

        messages.push(enemy.name + ' uses ' + (move.name || 'Attack') + '!');

        // Calculate damage
        var baseDamage = rollBaseDamage(move.damage || '2d6');
        var damage = calculateDamage(baseDamage, {
            attackType: move.type,
            defenderType: player.type
        });

        // Apply QTE result
        var modifiers = qteResult.modifiers || {};
        var finalDamage = damage;

        if (modifiers.damageReduction) {
            finalDamage = Math.floor(damage * (1 - modifiers.damageReduction));
        }

        // Guard broken from failed parry
        if (modifiers.guardBroken) {
            player.defending = false;
            resetGuard(true);
            messages.push('Guard broken!');
        }

        if (finalDamage > 0) {
            BattleCore.damagePlayer(finalDamage, {
                source: 'enemy',
                type: move.type
            });
            messages.push('Dealt ' + finalDamage + ' damage!');
        } else {
            messages.push('Attack was completely blocked!');
        }

        // Counter attack from successful parry
        if (modifiers.counterAttack) {
            var counterMult = modifiers.counterDamageMultiplier || 0.5;
            var counterDamage = Math.floor(damage * counterMult);
            BattleCore.damageEnemy(counterDamage, { source: 'counter', type: 'physical' });
            messages.push('Counter attack for ' + counterDamage + ' damage!');

            // Add stagger from parry
            if (modifiers.staggerBonus) {
                BattleCore.addStagger(enemy, modifiers.staggerBonus);
            }
        }

        // Add momentum from successful defense
        if (modifiers.momentumBonus) {
            addMomentum(modifiers.momentumBonus);
        }

        player.defending = false;
        BattleCore.playSfx('attack_' + (move.type || 'physical'));

        if (callback) callback({
            success: true,
            messages: messages,
            qteResult: qteResult
        });
    }

    /**
     * Check if guard is about to break and trigger QTE
     */
    function checkGuardBreak(callback) {
        if (battleState.playerGuardHits >= config.guardBreakThreshold - 1) {
            if (typeof QTEEngine !== 'undefined') {
                QTEEngine.startGuardBreakQTE({
                    difficulty: 'hard',
                    hitsAbsorbed: battleState.playerGuardHits
                }, function(qteResult) {
                    var modifiers = qteResult.modifiers || {};

                    if (modifiers.guardRestored) {
                        resetGuard(true);
                        if (callback) callback({ guardRestored: true, qteResult: qteResult });
                    } else {
                        // Guard breaks, player may be stunned
                        resetGuard(true);
                        var player = BattleCore.getPlayer();
                        player.defending = false;

                        if (modifiers.stunned) {
                            BattleCore.applyStatus(player, 'stun', 1);
                        }

                        if (callback) callback({ guardRestored: false, stunned: modifiers.stunned, qteResult: qteResult });
                    }
                });
            } else {
                if (callback) callback({ guardRestored: false });
            }
        } else {
            if (callback) callback({ guardRestored: true });  // Guard not near breaking
        }
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        name: 'exp33',
        displayName: 'Expedition 33 Style',

        // State
        resetBattleState: resetBattleState,
        getPlayerAP: getPlayerAP,
        getEnemyAP: getEnemyAP,
        getCombo: function() { return battleState.combo; },
        getMomentum: function() { return battleState.momentum; },
        isMomentumReady: isMomentumReady,

        // Attack resolution
        resolveAttack: resolveAttack,
        resolveSummonAttack: resolveSummonAttack,

        // Player actions (standard)
        playerAttack: playerAttack,
        playerSkill: playerSkill,
        playerDefend: playerDefend,
        playerFlee: playerFlee,
        playerLimitBreak: playerLimitBreak,

        // Player actions (with QTE)
        playerAttackWithQTE: playerAttackWithQTE,

        // Enemy AI
        selectEnemyMove: selectEnemyMove,
        enemyTurn: enemyTurn,
        enemyTurnWithQTE: enemyTurnWithQTE,

        // Guard system
        checkGuardBreak: checkGuardBreak,

        // Turn management
        onTurnStart: onTurnStart,

        // No dice forcing in Exp33 style
        setForcedRollCallback: function() {}
    };
})();
