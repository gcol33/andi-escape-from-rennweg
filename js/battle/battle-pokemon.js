/**
 * Andi VN - Battle Style: Pokemon
 *
 * Pokemon-inspired combat system with:
 * - Guaranteed hits (no attack rolls)
 * - Type effectiveness (2x, 0.5x, 0x damage)
 * - Power Points (PP) per move instead of global mana
 * - Status moves vs attack moves
 * - Critical hits based on random chance (1/16 base)
 * - Accuracy stat per move (can miss at low accuracy)
 * - Priority moves
 *
 * Key differences from D&D:
 * - No d20 rolls, no AC
 * - Each skill has PP that depletes
 * - Moves can have accuracy < 100%
 * - Type matchups are central
 */

var BattleStylePokemon = (function() {
    'use strict';

    // =========================================================================
    // MODULE DEPENDENCY CHECK
    // =========================================================================

    var _hasBattleData = typeof BattleData !== 'undefined';
    if (!_hasBattleData) {
        console.warn('[BattleStylePokemon] BattleData module not loaded - some features will be unavailable');
    }

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    var config = {
        baseCritChance: 0.0625,  // 1/16 chance
        critMultiplier: 1.5,
        minDamage: 1,
        stab: 1.5,  // Same Type Attack Bonus
        defaultAccuracy: 100,
        defaultPP: 10
    };

    // =========================================================================
    // HELPERS
    // =========================================================================

    /**
     * Roll a random number between min and max (inclusive)
     */
    function randomRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Calculate damage using Pokemon formula
     * Simplified: ((2*Level/5 + 2) * Power * A/D) / 50 + 2) * modifiers
     * We'll use a simpler version since we don't have levels
     */
    function calculateDamage(power, attackStat, defenseStat) {
        // Simplified damage formula
        var base = Math.floor((power * attackStat / defenseStat) / 2) + 2;
        // Random modifier 85-100%
        var randomMod = randomRange(85, 100) / 100;
        return Math.max(config.minDamage, Math.floor(base * randomMod));
    }

    /**
     * Check accuracy
     */
    function checkAccuracy(accuracy) {
        if (!accuracy || accuracy >= 100) return true;
        return Math.random() * 100 < accuracy;
    }

    /**
     * Check for critical hit
     */
    function checkCrit(critRatio) {
        var chance = config.baseCritChance;
        if (critRatio) {
            // Higher crit ratio = higher chance
            // Ratio 1 = 1/16, Ratio 2 = 1/8, Ratio 3 = 1/4, etc.
            chance = config.baseCritChance * critRatio;
        }
        return Math.random() < Math.min(0.5, chance);  // Cap at 50%
    }

    // =========================================================================
    // MOVE PP TRACKING
    // =========================================================================

    // Track PP for player moves (skill_id -> remaining PP)
    var playerPP = {};

    function initializeMovePP(skills) {
        playerPP = {};
        if (!_hasBattleData) return;
        for (var i = 0; i < skills.length; i++) {
            var skill = BattleData.getSkill(skills[i]);
            if (skill) {
                playerPP[skills[i]] = skill.pp || config.defaultPP;
            }
        }
    }

    function getPP(skillId) {
        return playerPP[skillId] !== undefined ? playerPP[skillId] : 0;
    }

    function usePP(skillId) {
        if (playerPP[skillId] !== undefined && playerPP[skillId] > 0) {
            playerPP[skillId]--;
            return true;
        }
        return false;
    }

    function getAllPP() {
        return Object.assign({}, playerPP);
    }

    // =========================================================================
    // ATTACK RESOLUTION
    // =========================================================================

    /**
     * Resolve an attack using Pokemon mechanics
     * @param {Object} attacker - Attacker state
     * @param {Object} defender - Defender state
     * @param {Object} move - Move being used
     * @returns {Object} Attack result
     */
    function resolveAttack(attacker, defender, move) {
        move = move || {};

        // Check accuracy
        var accuracy = move.accuracy || config.defaultAccuracy;
        var hit = checkAccuracy(accuracy);

        if (!hit) {
            return {
                hit: false,
                missed: true,
                damage: 0,
                isCrit: false,
                effectiveness: 1,
                message: 'But it missed!'
            };
        }

        // Get power and stats
        var power = move.power || 40;
        var attackStat = attacker.attack || 10;
        var defenseStat = defender.defense || 10;

        // Use special attack/defense for special moves
        if (move.category === 'special') {
            attackStat = attacker.spAttack || attackStat;
            defenseStat = defender.spDefense || defenseStat;
        }

        // Calculate base damage
        var damage = calculateDamage(power, attackStat, defenseStat);

        // Type effectiveness
        var moveType = move.type || 'physical';
        var defenderType = defender.type || 'physical';
        var effectiveness = _hasBattleData ? BattleData.getTypeMultiplier(moveType, defenderType) : 1;
        damage = Math.floor(damage * effectiveness);

        // STAB (Same Type Attack Bonus)
        if (attacker.type === moveType) {
            damage = Math.floor(damage * config.stab);
        }

        // Critical hit
        var isCrit = checkCrit(move.critRatio);
        if (isCrit) {
            damage = Math.floor(damage * config.critMultiplier);
        }

        // Terrain modifiers
        var terrainMult = BattleCore.getTerrainMultiplier(moveType);
        damage = Math.floor(damage * terrainMult);

        // Ensure minimum damage
        damage = Math.max(config.minDamage, damage);

        // Status effect from move
        var statusResult = null;
        if (move.statusEffect) {
            statusResult = tryApplyStatus(move, defender);
        }

        // Build effectiveness message
        var effectMsg = '';
        if (effectiveness >= 2) effectMsg = "It's super effective!";
        else if (effectiveness === 0) effectMsg = "It doesn't affect " + defender.name + "...";
        else if (effectiveness < 1) effectMsg = "It's not very effective...";

        return {
            hit: effectiveness > 0,
            damage: effectiveness > 0 ? damage : 0,
            isCrit: isCrit,
            effectiveness: effectiveness,
            effectivenessMessage: effectMsg,
            moveType: moveType,
            statusResult: statusResult
        };
    }

    function tryApplyStatus(move, target) {
        if (!move.statusEffect) return null;

        var statusInfo = move.statusEffect;
        var baseChance = statusInfo.chance || 0;

        // Apply terrain bonus
        if (_hasBattleData) {
            var terrain = BattleData.getTerrain(BattleCore.getTerrain());
            if (terrain && terrain.statusChanceBonus && terrain.statusChanceBonus[statusInfo.type]) {
                baseChance += terrain.statusChanceBonus[statusInfo.type];
            }
        }

        if (Math.random() < baseChance) {
            return BattleCore.applyStatus(target, statusInfo.type, statusInfo.stacks || 1);
        }

        return { applied: false };
    }

    // =========================================================================
    // PLAYER ACTIONS
    // =========================================================================

    /**
     * Execute player basic attack (Struggle equivalent)
     */
    function playerAttack() {
        var player = BattleCore.getPlayer();
        var enemy = BattleCore.getEnemy();

        // Basic attack move
        var move = {
            name: 'Struggle',
            power: 50,
            type: 'physical',
            accuracy: 100,
            category: 'physical'
        };

        var result = resolveAttack(player, enemy, move);

        if (result.hit) {
            BattleCore.damageEnemy(result.damage, {
                source: 'player',
                type: result.moveType,
                isCrit: result.isCrit
            });

            // Struggle recoil
            var recoil = Math.floor(result.damage * 0.25);
            BattleCore.damagePlayer(recoil, { source: 'recoil' });
        }

        var messages = [];
        messages.push(player.name + ' used Struggle!');
        if (result.hit) {
            messages.push('Dealt <span class="battle-number">' + result.damage + ' damage</span>!');
            if (result.isCrit) messages.push('A critical hit!');
            if (result.effectivenessMessage) messages.push(result.effectivenessMessage);
            messages.push('Recoil damage!');
        } else {
            messages.push(result.message || 'But it missed!');
        }

        BattleCore.playSfx('attack_physical');

        return {
            success: true,
            attackResult: result,
            messages: messages
        };
    }

    /**
     * Execute player skill/move
     */
    function playerSkill(skillId) {
        var player = BattleCore.getPlayer();
        var enemy = BattleCore.getEnemy();
        var move = _hasBattleData ? BattleData.getSkill(skillId) : null;

        if (!move) {
            return { success: false, reason: 'unknown_move', messages: ['Unknown move!'] };
        }

        // Check PP
        var currentPP = getPP(skillId);
        if (currentPP <= 0) {
            return { success: false, reason: 'no_pp', messages: ['No PP left for this move!'] };
        }

        // Use PP
        usePP(skillId);

        var messages = [];
        messages.push(player.name + ' used ' + move.name + '!');

        // Status move (no damage)
        if (move.category === 'status') {
            if (move.statusEffect) {
                var target = move.statusEffect.target === 'self' ? player : enemy;
                var statusResult = BattleCore.applyStatus(target, move.statusEffect.type, 1);
                if (statusResult.applied) {
                    messages.push(statusResult.message);
                }
            }
            if (move.isHeal && move.healAmount) {
                var healAmount = typeof move.healAmount === 'number' ?
                    move.healAmount : randomRange(10, 20);
                var healResult = BattleCore.healPlayer(healAmount, 'move');
                messages.push('Restored <span class="battle-number">' + healResult.healed + ' HP</span>!');
            }

            BattleCore.playSfx(move.isHeal ? 'heal' : 'buff_apply');
            return { success: true, messages: messages };
        }

        // Attack move
        var result = resolveAttack(player, enemy, move);

        if (result.hit) {
            BattleCore.damageEnemy(result.damage, {
                source: 'player',
                type: result.moveType,
                isCrit: result.isCrit
            });

            messages.push('Dealt <span class="battle-number">' + result.damage + ' damage</span>!');
            if (result.isCrit) messages.push('A critical hit!');
            if (result.effectivenessMessage) messages.push(result.effectivenessMessage);
            if (result.statusResult && result.statusResult.applied) {
                messages.push(result.statusResult.message);
            }

            // Add stagger
            BattleCore.addStagger(enemy, result.isCrit ? 20 : 10);

            BattleCore.playSfx('attack_' + result.moveType);
        } else {
            messages.push(result.message || 'But it missed!');
            BattleCore.playSfx('attack_miss');
        }

        return {
            success: true,
            attackResult: result,
            messages: messages
        };
    }

    /**
     * Defend action - raises defense
     */
    function playerDefend() {
        var player = BattleCore.getPlayer();

        player.defending = true;

        // Apply defense up status
        BattleCore.applyStatus(player, 'defense_up', 1);

        // Restore some HP
        var healAmount = Math.floor(player.maxHP * 0.1);
        var healResult = BattleCore.healPlayer(healAmount, 'defend');

        BattleCore.playSfx('defend');

        return {
            success: true,
            messages: [
                player.name + ' is bracing!',
                healResult.healed > 0 ? 'Recovered ' + healResult.healed + ' HP!' : null
            ].filter(Boolean)
        };
    }

    /**
     * Attempt to flee (Run Away)
     */
    function playerFlee() {
        // In Pokemon, flee is based on speed comparison
        var player = BattleCore.getPlayer();
        var enemy = BattleCore.getEnemy();

        var playerSpeed = player.speed || 10;
        var enemySpeed = enemy.speed || 10;

        // Escape chance = (playerSpeed * 128 / enemySpeed + 30 * escapeAttempts) mod 256
        // Simplified: if faster, always escape; if slower, 50% chance
        var success = playerSpeed >= enemySpeed || Math.random() < 0.5;

        if (success) {
            BattleCore.playSfx('flee_success');
            return {
                success: true,
                messages: ['Got away safely!']
            };
        } else {
            BattleCore.playSfx('flee_fail');
            return {
                success: false,
                messages: ['Can\'t escape!']
            };
        }
    }

    /**
     * Execute limit break (Z-Move style)
     */
    function playerLimitBreak() {
        if (!BattleCore.isLimitReady()) {
            return { success: false, reason: 'not_ready', messages: ['Not ready!'] };
        }

        var player = BattleCore.getPlayer();
        var enemy = BattleCore.getEnemy();
        var limitBreak = _hasBattleData ? BattleData.getLimitBreak(player.limitBreak) : null;

        if (!limitBreak) {
            return { success: false, reason: 'unknown', messages: ['Unknown Z-Move!'] };
        }

        BattleCore.useLimitCharge();

        var messages = [];
        messages.push(player.name + ' unleashes ' + limitBreak.name + '!');

        // Calculate damage (boosted power)
        var move = {
            power: 200,  // Z-Moves have high base power
            type: limitBreak.type || 'physical',
            accuracy: 100,  // Z-Moves never miss
            category: 'physical'
        };

        var result = resolveAttack(player, enemy, move);
        var totalDamage = result.damage;

        BattleCore.damageEnemy(totalDamage, {
            source: 'limit_break',
            type: move.type,
            isCrit: result.isCrit
        });

        messages.push('Dealt <span class="battle-number">' + totalDamage + ' damage</span>!');
        if (result.isCrit) messages.push('A critical hit!');
        if (result.effectivenessMessage) messages.push(result.effectivenessMessage);

        // Self heal if specified
        if (limitBreak.selfHeal) {
            var healResult = BattleCore.healPlayer(limitBreak.selfHeal, 'limit_break');
            messages.push('Recovered <span class="battle-number">' + healResult.healed + ' HP</span>!');
        }

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
     * Select enemy move
     */
    function selectEnemyMove() {
        var enemy = BattleCore.getEnemy();
        var moves = enemy.moves || [];

        if (moves.length === 0) {
            return { name: 'Tackle', power: 40, type: 'physical', accuracy: 100 };
        }

        // Simple AI: pick based on effectiveness and situation
        var player = BattleCore.getPlayer();
        var enemyHPPercent = enemy.hp / enemy.maxHP;

        // Low HP: try to heal
        if (enemyHPPercent < 0.3) {
            var healMove = findMoveByCategory(moves, 'status', true);
            if (healMove) return healMove;
        }

        // Find most effective move
        var bestMove = null;
        var bestScore = -1;

        for (var i = 0; i < moves.length; i++) {
            var move = moves[i];
            if (move.category === 'status') continue;

            var effectiveness = _hasBattleData ? BattleData.getTypeMultiplier(move.type, player.type) : 1;
            var score = (move.power || 40) * effectiveness;

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove || moves[0];
    }

    function findMoveByCategory(moves, category, isHeal) {
        for (var i = 0; i < moves.length; i++) {
            if (moves[i].category === category) {
                if (isHeal && moves[i].isHeal) return moves[i];
                if (!isHeal) return moves[i];
            }
        }
        return null;
    }

    /**
     * Execute enemy turn
     */
    function enemyTurn(qteResult) {
        var enemy = BattleCore.getEnemy();
        var player = BattleCore.getPlayer();

        // Check if enemy can act
        if (!BattleCore.canAct(enemy)) {
            return {
                success: false,
                reason: 'cannot_act',
                messages: [enemy.name + ' can\'t move!']
            };
        }

        var move = selectEnemyMove();
        var messages = [];
        messages.push(enemy.name + ' used ' + (move.name || 'Attack') + '!');

        // Status move
        if (move.category === 'status') {
            if (move.statusEffect) {
                var target = move.statusEffect.target === 'self' ? enemy : player;
                var statusResult = BattleCore.applyStatus(target, move.statusEffect.type, 1);
                if (statusResult.applied) {
                    messages.push(statusResult.message);
                }
            }
            if (move.isHeal && move.healAmount) {
                var healAmount = typeof move.healAmount === 'number' ?
                    move.healAmount : randomRange(10, 20);
                var healResult = BattleCore.healEnemy(healAmount, 'move');
                messages.push('Restored <span class="battle-number">' + healResult.healed + ' HP</span>!');
            }

            BattleCore.playSfx(move.isHeal ? 'heal' : 'buff_apply');
            return { success: true, messages: messages };
        }

        // Attack move
        var result = resolveAttack(enemy, player, move);

        if (result.hit) {
            var finalDamage = result.damage;

            // Apply dodge QTE reduction
            if (qteResult && qteResult.damageReduction) {
                finalDamage = Math.floor(finalDamage * (1 - qteResult.damageReduction));
            }

            if (finalDamage > 0) {
                BattleCore.damagePlayer(finalDamage, {
                    source: 'enemy',
                    type: result.moveType,
                    isCrit: result.isCrit
                });

                messages.push('Dealt <span class="battle-number">' + finalDamage + ' damage</span>!');
                if (result.isCrit) messages.push('A critical hit!');
                if (result.effectivenessMessage) messages.push(result.effectivenessMessage);
                if (result.statusResult && result.statusResult.applied) {
                    messages.push(result.statusResult.message);
                }

                BattleCore.playSfx('attack_' + result.moveType);
            } else {
                messages.push('But you dodged!');
                BattleCore.playSfx('attack_miss');
            }
        } else {
            messages.push(result.message || 'But it missed!');
            BattleCore.playSfx('attack_miss');
        }

        // Clear defending
        player.defending = false;

        return {
            success: true,
            attackResult: result,
            messages: messages
        };
    }

    /**
     * Resolve summon attack
     */
    function resolveSummonAttack(summon, defender) {
        var move = summon.attack || { power: 30, type: 'physical', accuracy: 100 };
        return resolveAttack(
            { attack: 10, type: summon.attack ? summon.attack.type : 'physical' },
            defender,
            move
        );
    }

    // =========================================================================
    // QTE INTEGRATION (Optional for Pokemon style - uses dodge QTE only)
    // =========================================================================

    /**
     * Execute enemy turn with dodge QTE for player
     * Pokemon style only uses dodge QTE (attacks always hit based on accuracy)
     * @param {Function} callback - Called with result
     */
    function enemyTurnWithQTE(callback) {
        var enemy = BattleCore.getEnemy();

        if (!BattleCore.canAct(enemy)) {
            if (callback) callback({
                success: false,
                reason: 'cannot_act',
                messages: [enemy.name + ' can\'t move!']
            });
            return;
        }

        if (typeof QTEEngine === 'undefined') {
            var result = enemyTurn();
            if (callback) callback(result);
            return;
        }

        QTEEngine.startDodgeQTE({
            difficulty: 'normal'
        }, function(qteResult) {
            var result = enemyTurn(qteResult.modifiers || {});
            result.qteResult = qteResult;
            if (callback) callback(result);
        });
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        name: 'pokemon',
        displayName: 'Pokemon Style',

        // Move PP management
        initializeMovePP: initializeMovePP,
        getPP: getPP,
        getAllPP: getAllPP,

        // Attack resolution
        resolveAttack: resolveAttack,
        resolveSummonAttack: resolveSummonAttack,

        // Player actions (standard)
        playerAttack: playerAttack,
        playerSkill: playerSkill,
        playerDefend: playerDefend,
        playerFlee: playerFlee,
        playerLimitBreak: playerLimitBreak,

        // Enemy AI
        selectEnemyMove: selectEnemyMove,
        enemyTurn: enemyTurn,
        enemyTurnWithQTE: enemyTurnWithQTE,

        // No forced roll in Pokemon style (no d20)
        setForcedRollCallback: function() {}
    };
})();
