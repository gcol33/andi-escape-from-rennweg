/**
 * Andi VN - Battle Style: D&D (Dungeons & Dragons)
 *
 * D20-based combat system with:
 * - Attack rolls vs Armor Class (AC)
 * - Natural 20 = Critical hit (2x damage)
 * - Natural 1 = Fumble (auto-miss)
 * - Defend action grants +4 AC and mana regen
 * - Flee requires d20 >= 10
 * - Damage dice notation (1d6, 2d8+2, etc.)
 *
 * This is the default/original battle style for Andi VN.
 */

var BattleStyleDnD = (function() {
    'use strict';

    // =========================================================================
    // MODULE DEPENDENCY CHECK (uses BattleUtils if available)
    // =========================================================================

    var _hasBattleUtils = typeof BattleUtils !== 'undefined';
    var _hasBattleData = _hasBattleUtils ? BattleUtils.hasBattleData() : typeof BattleData !== 'undefined';
    var _hasBattleBarrier = _hasBattleUtils ? BattleUtils.hasBattleBarrier() : typeof BattleBarrier !== 'undefined';
    var _hasBattleIntent = _hasBattleUtils ? BattleUtils.hasBattleIntent() : typeof BattleIntent !== 'undefined';
    var _hasBattleDice = _hasBattleUtils ? BattleUtils.hasBattleDice() : typeof BattleDice !== 'undefined';

    if (!_hasBattleData) {
        console.warn('[BattleStyleDnD] BattleData module not loaded - some features will be unavailable');
    }

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    var T = typeof TUNING !== 'undefined' ? TUNING : null;
    var config = T ? T.battle.combat : {
        defendACBonus: 0,   // AC bonus removed (can be a skill later)
        defendDuration: 2,  // How many enemy attacks defensive stance lasts
        defendManaRecoveryMin: 2,
        defendManaRecoveryMax: 4,
        defendCooldown: 5,  // Turns before defend can be used again
        critMultiplier: 2,
        minDamage: 1,
        fleeThreshold: 10
    };

    // =========================================================================
    // DICE ROLLING (delegates to BattleDice module)
    // =========================================================================

    /**
     * Set forced roll callback for dev mode
     */
    function setForcedRollCallback(callback) {
        if (typeof BattleDice !== 'undefined') {
            BattleDice.setForcedRollCallback(callback);
        }
    }

    /**
     * Roll a d20 using the dice module
     * @returns {Object} { roll, isCrit, isFumble }
     */
    function rollD20() {
        if (typeof BattleDice !== 'undefined') {
            return BattleDice.rollD20();
        }
        // Fallback
        var roll = Math.floor(Math.random() * 20) + 1;
        return { roll: roll, isCrit: roll >= 20, isFumble: roll === 1 };
    }

    /**
     * Roll damage dice using the dice module
     */
    function rollDamage(diceStr) {
        if (typeof BattleDice !== 'undefined') {
            return BattleDice.rollDamage(diceStr, config.minDamage);
        }
        // Fallback
        if (typeof diceStr === 'number') return diceStr;
        var match = diceStr.match(/(\d*)d(\d+)([+-]\d+)?/i);
        if (!match) return 1;
        var numDice = parseInt(match[1], 10) || 1;
        var sides = parseInt(match[2], 10);
        var modifier = parseInt(match[3], 10) || 0;
        var total = modifier;
        for (var i = 0; i < numDice; i++) {
            total += Math.floor(Math.random() * sides) + 1;
        }
        return Math.max(config.minDamage, total);
    }

    /**
     * Roll heal dice
     */
    function rollHeal(diceStr) {
        return rollDamage(diceStr);
    }

    // =========================================================================
    // ATTACK RESOLUTION
    // =========================================================================

    /**
     * Resolve an attack using D&D mechanics
     * @param {Object} attacker - Attacker state { attackBonus, damage, type }
     * @param {Object} defender - Defender state { ac, statuses }
     * @param {Object} skill - Optional skill being used
     * @param {Object} qteResult - Optional QTE result modifiers
     * @returns {Object} Attack result
     */
    function resolveAttack(attacker, defender, skill, qteResult) {
        skill = skill || {};
        qteResult = qteResult || {};

        // Roll d20 (returns { roll, isCrit, isFumble })
        var rollResult = rollD20();
        var roll = rollResult.roll;
        var isCrit = rollResult.isCrit;
        var isFumble = rollResult.isFumble;

        // Track attack modifiers with sources for UI display
        var attackModifiers = [];

        // Base attack bonus
        var baseAttackBonus = attacker.attackBonus || 0;
        if (baseAttackBonus !== 0) {
            attackModifiers.push({ value: baseAttackBonus, source: 'ATK' });
        }

        // Status effect attack bonus
        var statusAttackBonus = BattleCore.getStatusAttackModifier(attacker);
        if (statusAttackBonus !== 0) {
            // Try to get status name for display
            var statusSource = 'Status';
            if (attacker.statuses && attacker.statuses.length > 0 && _hasBattleData) {
                for (var i = 0; i < attacker.statuses.length; i++) {
                    var statusDef = BattleData.getStatusEffect(attacker.statuses[i].type);
                    if (statusDef && statusDef.attackBonus) {
                        statusSource = statusDef.name || 'Status';
                        break;
                    }
                }
            }
            attackModifiers.push({ value: statusAttackBonus, source: statusSource });
        }

        // Skill attack bonus
        if (skill.attackBonus) {
            attackModifiers.push({ value: skill.attackBonus, source: 'Skill' });
        }

        // QTE hit bonus
        if (qteResult.hitBonus) {
            attackModifiers.push({ value: qteResult.hitBonus, source: 'Timing' });
        }

        // Terrain accuracy penalty
        var terrainPenalty = BattleCore.getTerrainAccuracyPenalty();
        if (terrainPenalty !== 0) {
            var terrainName = 'Terrain';
            if (_hasBattleData) {
                var terrain = BattleData.getTerrain(BattleCore.getTerrain());
                if (terrain) terrainName = terrain.name || 'Terrain';
            }
            attackModifiers.push({ value: -terrainPenalty, source: terrainName });
        }

        // Calculate total attack bonus
        var attackBonus = 0;
        for (var j = 0; j < attackModifiers.length; j++) {
            attackBonus += attackModifiers[j].value;
        }

        // Fumble (nat 1) absorbs bonuses but stays at 1
        var attackTotal = isFumble ? 1 : roll + attackBonus;

        // Crit if natural 20 OR total >= 20 (bonuses can push into crit range)
        if (!isCrit && !isFumble && attackTotal >= 20) {
            isCrit = true;
        }

        // Calculate defender AC
        var defenderAC = defender.ac || 10;
        defenderAC += BattleCore.getStatusACModifier(defender);

        // Note: Defending no longer provides AC bonus (removed)

        // Determine hit
        var hit = false;
        if (qteResult.autoMiss) {
            hit = false;  // QTE failure forces miss
        } else if (isCrit) {
            hit = true;   // Crit always hits
        } else if (isFumble) {
            hit = false;  // Nat 1 always misses
        } else {
            hit = attackTotal >= defenderAC;
        }

        // Calculate damage if hit
        var damage = 0;
        var baseDamageRoll = 0;
        var damageType = skill.type || attacker.type || 'physical';
        var damageModifiers = [];
        var isMinDamage = false;
        var isMaxDamage = false;

        // Track damage advantage for UI display
        var hasDamageAdvantage = false;
        var hasDamageDisadvantage = false;
        var damageRolls = null;

        if (hit) {
            // Roll base damage with detailed result for min/max detection
            var damageDice = skill.damage || attacker.damage || '1d6';
            var damageRollResult;
            if (typeof BattleDice !== 'undefined') {
                // Use advantage/disadvantage for damage if specified
                if (qteResult.damageAdvantage && BattleDice.rollDamageWithAdvantage) {
                    damageRollResult = BattleDice.rollDamageWithAdvantage(damageDice);
                    hasDamageAdvantage = true;
                    damageRolls = damageRollResult.bothRolls;
                } else if (qteResult.damageDisadvantage && BattleDice.rollDamageWithDisadvantage) {
                    damageRollResult = BattleDice.rollDamageWithDisadvantage(damageDice);
                    hasDamageDisadvantage = true;
                    damageRolls = damageRollResult.bothRolls;
                } else if (BattleDice.rollDamageDetailed) {
                    damageRollResult = BattleDice.rollDamageDetailed(damageDice);
                } else {
                    damageRollResult = { total: rollDamage(damageDice) };
                }
                baseDamageRoll = damageRollResult.total;
                isMinDamage = damageRollResult.isMin || false;
                isMaxDamage = damageRollResult.isMax || false;
            } else {
                baseDamageRoll = rollDamage(damageDice);
            }
            damage = baseDamageRoll;

            // Status damage bonus
            var statusDamageBonus = BattleCore.getStatusDamageModifier(attacker);
            if (statusDamageBonus !== 0) {
                var dmgStatusSource = 'Status';
                if (attacker.statuses && attacker.statuses.length > 0 && _hasBattleData) {
                    for (var k = 0; k < attacker.statuses.length; k++) {
                        var dmgStatusDef = BattleData.getStatusEffect(attacker.statuses[k].type);
                        if (dmgStatusDef && dmgStatusDef.damageBonus) {
                            dmgStatusSource = dmgStatusDef.name || 'Status';
                            break;
                        }
                    }
                }
                damageModifiers.push({ value: statusDamageBonus, source: dmgStatusSource });
                damage += statusDamageBonus;
            }

            // Apply crit multiplier (shown as x2, not additive)
            if (isCrit) {
                damageModifiers.push({ value: config.critMultiplier, source: 'CRIT', isMultiplier: true });
                damage = Math.floor(damage * config.critMultiplier);
            }

            // Apply QTE damage multiplier
            if (qteResult.damageMultiplier && qteResult.damageMultiplier !== 1) {
                var qteBonus = Math.floor(damage * (qteResult.damageMultiplier - 1));
                if (qteBonus !== 0) {
                    damageModifiers.push({ value: qteBonus, source: 'Timing' });
                    damage = Math.floor(damage * qteResult.damageMultiplier);
                }
            }

            // Apply type effectiveness
            var typeMultiplier = _hasBattleData ? BattleData.getTypeMultiplier(damageType, defender.type) : 1;
            if (typeMultiplier !== 1) {
                var typeBonus = Math.floor(damage * typeMultiplier) - damage;
                var typeSource = typeMultiplier > 1 ? 'Super Effective' : 'Resisted';
                damageModifiers.push({ value: typeBonus, source: typeSource });
                damage = Math.floor(damage * typeMultiplier);
            }

            // Apply terrain multiplier
            var terrainMultiplier = BattleCore.getTerrainMultiplier(damageType);
            if (terrainMultiplier !== 1) {
                var terrainBonus = Math.floor(damage * terrainMultiplier) - damage;
                var terrainDmgName = 'Terrain';
                if (_hasBattleData) {
                    var terrainDmg = BattleData.getTerrain(BattleCore.getTerrain());
                    if (terrainDmg) terrainDmgName = terrainDmg.name || 'Terrain';
                }
                damageModifiers.push({ value: terrainBonus, source: terrainDmgName });
                damage = Math.floor(damage * terrainMultiplier);
            }

            // Ensure minimum damage
            damage = Math.max(config.minDamage, damage);
        }

        // Try to apply status effect from skill
        // Don't apply status if attack was parried/dodged (qteResult.noStatusEffect)
        var statusResult = null;
        if (hit && skill.statusEffect && !qteResult.noStatusEffect) {
            statusResult = tryApplyStatus(skill, defender);
        }

        // Apply confusion on fumble (nat 1)
        var fumbleStatusResult = null;
        if (isFumble) {
            fumbleStatusResult = BattleCore.applyStatus(attacker, 'confusion', 1);
        }

        var result = {
            roll: roll,
            attackTotal: attackTotal,
            attackModifiers: attackModifiers,
            defenderAC: defenderAC,
            hit: hit,
            isCrit: isCrit,
            isFumble: isFumble,
            damage: damage,
            baseDamageRoll: baseDamageRoll,
            damageModifiers: damageModifiers,
            damageType: damageType,
            typeMultiplier: _hasBattleData ? BattleData.getTypeMultiplier(damageType, defender.type) : 1,
            statusResult: statusResult,
            fumbleStatusResult: fumbleStatusResult,
            isMinDamage: isMinDamage,
            isMaxDamage: isMaxDamage,
            hasDamageAdvantage: hasDamageAdvantage,
            hasDamageDisadvantage: hasDamageDisadvantage,
            damageRolls: damageRolls
        };
        return result;
    }

    /**
     * Try to apply status effect from skill
     * Delegates to BattleUtils if available, otherwise uses local implementation
     */
    function tryApplyStatus(skill, target, options) {
        // Use BattleUtils if available for centralized status application
        if (_hasBattleUtils && BattleUtils.tryApplyStatus) {
            return BattleUtils.tryApplyStatus(skill, target, options);
        }

        // Fallback implementation
        if (!skill || !skill.statusEffect) return null;

        var statusInfo = skill.statusEffect;
        var baseChance = statusInfo.chance || 0;

        // Apply terrain bonus
        if (_hasBattleData) {
            var terrain = BattleData.getTerrain(BattleCore.getTerrain());
            if (terrain && terrain.statusChanceBonus && terrain.statusChanceBonus[statusInfo.type]) {
                baseChance += terrain.statusChanceBonus[statusInfo.type];
            }
        }

        if (BattleCore.shouldApplyStatus(baseChance)) {
            var stacks = statusInfo.stacks || 1;
            return BattleCore.applyStatus(target, statusInfo.type, stacks);
        }

        return { applied: false, message: '' };
    }

    /**
     * Resolve a summon's attack
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
                attackBonus: summon.attackBonus || move.attackBonus || 0,
                damage: move.damage || summon.damage || 'd4',
                type: move.type || summon.damageType || 'physical',
                statuses: summon.statuses || []  // Ensure statuses array exists
            };
        } else if (summon.attack) {
            // Legacy player summon system: attack data on summon object
            attackData = {
                attackBonus: 2,
                damage: summon.attack.damage,
                type: summon.attack.type,
                statuses: summon.statuses || []  // Ensure statuses array exists
            };
        } else {
            // Fallback: use summon's base stats
            attackData = {
                attackBonus: summon.attackBonus || 0,
                damage: summon.damage || 'd4',
                type: summon.damageType || 'physical',
                statuses: summon.statuses || []  // Ensure statuses array exists
            };
        }

        return resolveAttack(attackData, defender, move || summon.attack);
    }

    // =========================================================================
    // PLAYER ACTIONS
    // =========================================================================

    /**
     * Execute player basic attack
     * @param {Object} qteResult - QTE result modifiers
     * @returns {Object} Attack result wrapped for facade
     */
    function playerAttack(qteResult) {
        var player = BattleCore.getPlayer();
        var enemy = BattleCore.getEnemy();

        var attackResult = resolveAttack(player, enemy, null, qteResult);
        var barrierResult = null;
        var pendingDamage = null;

        if (attackResult.hit) {
            // Check for barrier first
            if (_hasBattleBarrier && BattleBarrier.hasBarrier()) {
                barrierResult = BattleBarrier.removeStack(1);
                attackResult.barrierResult = barrierResult;
                attackResult.hadBarrier = true;
                // Barrier absorbs the hit - no HP damage
                console.log('[BattleDnD.playerAttack] Barrier absorbed hit!', barrierResult);
            } else {
                // Don't apply damage yet - store for after animation completes
                console.log('[BattleDnD.playerAttack] Hit! Storing pendingDamage:', attackResult.damage);
                pendingDamage = {
                    amount: attackResult.damage,
                    source: 'player',
                    type: attackResult.damageType,
                    isCrit: attackResult.isCrit
                };
            }

            // Add stagger
            BattleCore.addStagger(enemy, attackResult.isCrit ? 20 : 10);
        }

        // Defending persists for 2 turns, don't clear on attack

        // Wrap result for facade compatibility
        return {
            success: true,
            attackResult: attackResult,
            barrierResult: barrierResult,
            pendingDamage: pendingDamage,
            messages: []
        };
    }

    /**
     * Find a skill by ID from BattleData or player's skills array
     * @param {string} skillId - Skill ID to find
     * @returns {Object|null} Skill definition or null
     */
    function findSkill(skillId) {
        // First try BattleData
        if (_hasBattleData) {
            var skill = BattleData.getSkill(skillId);
            if (skill) return skill;
        }

        // Then try player's skills array (for skills defined in player.md)
        var player = BattleCore.getPlayer();
        var skills = player.skills || [];
        for (var i = 0; i < skills.length; i++) {
            if (typeof skills[i] === 'object' && skills[i].id === skillId) {
                return skills[i];
            }
        }

        return null;
    }

    /**
     * Execute player skill
     * @param {string} skillId - Skill to use
     * @param {Object} qteResult - QTE result modifiers
     * @returns {Object} Result
     */
    function playerSkill(skillId, qteResult) {
        var player = BattleCore.getPlayer();
        var enemy = BattleCore.getEnemy();
        var skill = findSkill(skillId);

        if (!skill) {
            return { success: false, reason: 'unknown_skill', messages: ['Unknown skill!'] };
        }

        // Check mana
        if (skill.manaCost && player.mana < skill.manaCost) {
            return { success: false, reason: 'no_mana', messages: ['Not enough MP!'] };
        }

        // Spend mana
        if (skill.manaCost) {
            BattleCore.useMana(skill.manaCost);
        }

        var messages = [];
        var result = { success: true, messages: messages, skill: skill };

        // Healing skill (check both isHeal flag and healAmount property)
        var isHealSkill = skill.isHeal || (skill.healAmount && !skill.damage);
        if (isHealSkill) {
            if (skill.healAmount) {
                // Check for advantage/disadvantage from QTE result
                qteResult = qteResult || {};
                var hasHealAdvantage = qteResult.advantage || false;
                var hasHealDisadvantage = qteResult.disadvantage || false;
                var healBonusMultiplier = 1 + (qteResult.bonusHealing || 0);

                // Use rollDamageDetailed to get min/max info for heal rolls
                var healRollResult;
                var healAmount;
                var isMinHeal = false;
                var isMaxHeal = false;

                if (typeof BattleDice !== 'undefined') {
                    if (hasHealAdvantage && BattleDice.rollDamageWithAdvantage) {
                        healRollResult = BattleDice.rollDamageWithAdvantage(skill.healAmount);
                        healAmount = healRollResult.total;
                        result.hasHealAdvantage = true;
                        result.healRolls = healRollResult.rolls;
                    } else if (hasHealDisadvantage && BattleDice.rollDamageWithDisadvantage) {
                        healRollResult = BattleDice.rollDamageWithDisadvantage(skill.healAmount);
                        healAmount = healRollResult.total;
                        result.hasHealDisadvantage = true;
                        result.healRolls = healRollResult.rolls;
                    } else if (BattleDice.rollDamageDetailed) {
                        healRollResult = BattleDice.rollDamageDetailed(skill.healAmount);
                        healAmount = healRollResult.total;
                        isMinHeal = healRollResult.isMin;
                        isMaxHeal = healRollResult.isMax;
                    } else {
                        healAmount = rollHeal(skill.healAmount);
                    }
                } else {
                    healAmount = rollHeal(skill.healAmount);
                }

                // Apply bonus healing from perfect QTE
                if (healBonusMultiplier !== 1) {
                    healAmount = Math.floor(healAmount * healBonusMultiplier);
                }

                // Calculate pending heal (don't apply yet - wait for animation)
                var healCalc = BattleCore.calculatePendingHeal(healAmount);
                messages.push('Healed for <span class="battle-number">' + healCalc.healed + ' HP</span>!');
                result.healed = healCalc.healed;
                result.healRolled = healAmount;  // Store rolled amount for overheal display
                result.isMinHeal = isMinHeal;
                result.isMaxHeal = isMaxHeal;
                // Store pending heal to apply after animation
                result.pendingHeal = {
                    amount: healAmount,
                    source: 'skill'
                };
            }

            // Store pending status to self (like regen) - apply after animation
            if (skill.statusEffect && skill.statusEffect.target === 'self') {
                // Get the message preview without applying yet
                var effectDef = typeof BattleData !== 'undefined' ? BattleData.getStatusEffect(skill.statusEffect.type) : null;
                if (effectDef) {
                    messages.push(effectDef.icon + ' Gained ' + effectDef.name + '!');
                    result.pendingStatus = {
                        target: 'player',
                        type: skill.statusEffect.type,
                        stacks: 1
                    };
                }
            }

            BattleCore.playSfx('heal');
            return result;
        }

        // Buff skill
        if (skill.isBuff) {
            if (skill.statusEffect) {
                // Get the message preview without applying yet
                var buffEffectDef = typeof BattleData !== 'undefined' ? BattleData.getStatusEffect(skill.statusEffect.type) : null;
                if (buffEffectDef) {
                    messages.push(buffEffectDef.icon + ' Gained ' + buffEffectDef.name + '!');
                    result.pendingStatus = {
                        target: 'player',
                        type: skill.statusEffect.type,
                        stacks: 1
                    };
                }
            }
            BattleCore.playSfx('buff_apply');
            return result;
        }

        // Summon skill
        if (skill.isSummon) {
            var summonId = skill.summonId;
            if (!summonId) {
                return { success: false, reason: 'no_summon_id', messages: ['Summon skill has no target!'] };
            }

            // Check if BattleSummon module is available
            if (typeof BattleSummon === 'undefined') {
                return { success: false, reason: 'no_summon_module', messages: ['Summon system not available!'] };
            }

            // Spawn the player summon
            var spawnResult = BattleSummon.spawn(summonId, 'player', 'player');

            if (!spawnResult.success) {
                // Refund mana if summon failed
                if (skill.manaCost) {
                    BattleCore.addMana(skill.manaCost);
                }
                return {
                    success: false,
                    reason: spawnResult.reason,
                    messages: [spawnResult.message || 'Cannot summon!']
                };
            }

            // Success
            messages.push(spawnResult.message);

            // Get summon dialogue if any
            var summonDialogue = BattleSummon.getDialogue(spawnResult.summon.uid, 'summon_appear');
            if (summonDialogue) {
                messages.push('"' + summonDialogue + '"');
            }

            result.summonResult = spawnResult;
            result.summon = spawnResult.summon;
            BattleCore.playSfx('summon');
            return result;
        }

        // Attack skill
        var attackResult = resolveAttack(player, enemy, skill, qteResult);
        result.attackResult = attackResult;

        if (attackResult.hit) {
            // Check for barrier - skills can remove multiple stacks based on hits
            var skillHits = skill.hits || 1;
            if (_hasBattleBarrier && BattleBarrier.hasBarrier()) {
                var barrierResult = BattleBarrier.removeStack(skillHits);
                result.barrierResult = barrierResult;
                attackResult.barrierResult = barrierResult;
                attackResult.hadBarrier = true;

                if (barrierResult.broken) {
                    messages.push(skill.name + ' shatters the barrier!');
                } else {
                    messages.push(skill.name + ' damages the barrier! (<span class="battle-number">' + barrierResult.remaining + '</span> remaining)');
                }
                BattleCore.playSfx('barrier_hit');
            } else {
                // Don't apply damage yet - store for after animation completes
                result.pendingDamage = {
                    amount: attackResult.damage,
                    source: 'player',
                    type: attackResult.damageType,
                    isCrit: attackResult.isCrit
                };

                messages.push(skill.name + ' hits for <span class="battle-number">' + attackResult.damage + ' damage</span>!');

                if (attackResult.isCrit) {
                    messages.push('Critical hit!');
                }

                // Type effectiveness message
                var effectMsg = getEffectivenessMessage(attackResult.typeMultiplier);
                if (effectMsg) messages.push(effectMsg);

                BattleCore.playSfx('attack_' + attackResult.damageType);
            }

            // Status effect message (can apply even through barrier)
            if (attackResult.statusResult && attackResult.statusResult.applied) {
                messages.push(attackResult.statusResult.message);
            }

            // Stagger
            BattleCore.addStagger(enemy, attackResult.isCrit ? 25 : 15);
        } else {
            messages.push(skill.name + ' missed!');
            BattleCore.playSfx('attack_miss');
        }

        // Defending persists for 2 turns, don't clear on skill use

        return result;
    }

    /**
     * Execute defend action
     * @returns {Object} Result
     */
    function playerDefend() {
        var player = BattleCore.getPlayer();

        // Defend lasts for configured number of enemy attacks
        var duration = config.defendDuration || 2;
        player.defending = duration;

        // Set cooldown (turns before defend can be used again)
        var cooldown = config.defendCooldown || 5;
        player.defendCooldown = cooldown;

        // Roll for mana recovery
        var rollResult = rollD20();
        var roll = rollResult.roll;

        // Mana recovery scales with roll (min 1, max 5 for roll 20)
        var manaRecovered = Math.max(1, Math.floor(roll / 4));
        var actualMana = BattleCore.restoreMana(manaRecovered);

        // Track min/max for visual styling (0 = grey if at max mana, 5 = max roll)
        var isMinMana = actualMana === 0;
        var isMaxMana = manaRecovered >= 5 && actualMana > 0;

        // Reduce stagger
        BattleCore.decayStagger(player, config.defendStaggerReduction || 15);

        BattleCore.playSfx('defend');

        return {
            success: true,
            manaRecovered: actualMana,
            manaRolled: manaRecovered,  // Amount rolled before MP cap
            isMinMana: isMinMana,
            isMaxMana: isMaxMana,
            acBonus: 0,  // AC bonus removed from defending
            cooldown: cooldown,  // Return cooldown for UI display
            roll: roll,
            rollResult: rollResult
        };
    }

    /**
     * Attempt to flee
     * @returns {Object} Result
     */
    function playerFlee() {
        var rollResult = rollD20();
        var roll = rollResult.roll;
        var success = roll >= config.fleeThreshold;

        if (success) {
            BattleCore.playSfx('flee_success');
        } else {
            BattleCore.playSfx('flee_fail');
        }

        return {
            success: success,
            roll: roll,
            rollResult: rollResult,
            threshold: config.fleeThreshold,
            messages: success
                ? ['Escaped! (Rolled ' + roll + ')']
                : ['Failed to escape! (Rolled ' + roll + ', needed ' + config.fleeThreshold + ')']
        };
    }

    /**
     * Execute limit break
     * @returns {Object} Result
     */
    function playerLimitBreak() {
        if (!BattleCore.isLimitReady()) {
            return { success: false, reason: 'not_ready', messages: ['Limit Break not ready!'] };
        }

        var player = BattleCore.getPlayer();
        var enemy = BattleCore.getEnemy();
        var limitBreak = _hasBattleData ? BattleData.getLimitBreak(player.limitBreak) : null;

        if (!limitBreak) {
            return { success: false, reason: 'unknown', messages: ['Unknown Limit Break!'] };
        }

        BattleCore.useLimitCharge();

        var messages = [];
        var totalDamage = 0;

        messages.push(limitBreak.icon + ' ' + limitBreak.name + '!');

        // Multi-hit limit breaks
        var hits = limitBreak.hits || 1;
        for (var i = 0; i < hits; i++) {
            var damage = rollDamage(limitBreak.damage);

            // Scaling damage (Last Stand)
            if (limitBreak.scalingDamage) {
                var missingHPPercent = 1 - (player.hp / player.maxHP);
                damage = Math.floor(damage * (1 + missingHPPercent * 2));
            }

            // Type effectiveness
            if (limitBreak.type && enemy.type && _hasBattleData) {
                var mult = BattleData.getTypeMultiplier(limitBreak.type, enemy.type);
                damage = Math.floor(damage * mult);
            }

            // Ignores AC (Divine Judgment)
            // Just deal damage directly

            totalDamage += damage;
            BattleCore.damageEnemy(damage, {
                source: 'limit_break',
                type: limitBreak.type,
                isCrit: false
            });

            if (hits > 1) {
                messages.push('Hit ' + (i + 1) + ': <span class="battle-number">' + damage + ' damage</span>!');
            }
        }

        if (hits === 1) {
            messages.push('<span class="battle-number">' + totalDamage + ' damage</span>!');
        } else {
            messages.push('Total: <span class="battle-number">' + totalDamage + ' damage</span>!');
        }

        // Self heal (Phoenix Flame)
        if (limitBreak.selfHeal) {
            var healResult = BattleCore.healPlayer(limitBreak.selfHeal, 'limit_break');
            messages.push('Recovered <span class="battle-number">' + healResult.healed + ' HP</span>!');
        }

        // Status effect
        if (limitBreak.statusEffect) {
            var statusResult = tryApplyStatus(limitBreak, enemy);
            if (statusResult && statusResult.applied) {
                messages.push(statusResult.message);
            }
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
     * Select enemy move based on AI type
     * @returns {Object} Selected move
     */
    function selectEnemyMove() {
        var enemy = BattleCore.getEnemy();
        var player = BattleCore.getPlayer();
        var enemyHPPercent = enemy.hp / enemy.maxHP;
        var playerHPPercent = player.hp / player.maxHP;

        var moves = enemy.moves || [];
        if (moves.length === 0) {
            // Default attack
            return { type: 'attack' };
        }

        // AI behavior based on type
        var aiType = enemy.ai || 'default';
        var T_ai = (typeof TUNING !== 'undefined' && TUNING.battle.ai) ? TUNING.battle.ai : {
            healThreshold: 0.3,
            buffThreshold: 0.7,
            aggroHealThreshold: 0.25
        };

        switch (aiType) {
            case 'aggressive':
                // Prefer high damage, only heal when critical
                if (enemyHPPercent < T_ai.aggroHealThreshold) {
                    var healMove = findMoveByType(moves, 'heal');
                    if (healMove) return healMove;
                }
                return findHighestDamageMove(moves) || moves[0];

            case 'defensive':
                // Prefer healing and buffs
                if (enemyHPPercent < 0.5) {
                    var defHeal = findMoveByType(moves, 'heal');
                    if (defHeal) return defHeal;
                }
                var buffMove = findMoveByType(moves, 'buff');
                if (buffMove && Math.random() < 0.3) return buffMove;
                return moves[Math.floor(Math.random() * moves.length)];

            case 'support':
                // Focus on debuffs and status effects
                var statusMove = findMoveWithStatus(moves);
                if (statusMove && Math.random() < 0.5) return statusMove;
                return moves[Math.floor(Math.random() * moves.length)];

            default:
                // Default: balanced
                if (enemyHPPercent < T_ai.healThreshold) {
                    var defaultHeal = findMoveByType(moves, 'heal');
                    if (defaultHeal) return defaultHeal;
                }
                // Random selection
                return moves[Math.floor(Math.random() * moves.length)];
        }
    }

    function findMoveByType(moves, type) {
        for (var i = 0; i < moves.length; i++) {
            if (moves[i].isHeal && type === 'heal') return moves[i];
            if (moves[i].isBuff && type === 'buff') return moves[i];
        }
        return null;
    }

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

    function findMoveWithStatus(moves) {
        for (var i = 0; i < moves.length; i++) {
            if (moves[i].statusEffect) return moves[i];
        }
        return null;
    }

    function estimateAverageDamage(diceStr) {
        if (typeof diceStr === 'number') return diceStr;
        var match = diceStr.match(/(\d*)d(\d+)([+-]\d+)?/i);
        if (!match) return 1;
        var numDice = parseInt(match[1], 10) || 1;
        var sides = parseInt(match[2], 10);
        var modifier = parseInt(match[3], 10) || 0;
        return numDice * ((sides + 1) / 2) + modifier;
    }

    /**
     * Execute enemy turn
     * @param {Object} qteResult - Dodge QTE result from player
     * @returns {Object} Turn result
     */
    function enemyTurn(qteResult) {
        var enemy = BattleCore.getEnemy();
        var player = BattleCore.getPlayer();

        // Check if enemy can act
        if (!BattleCore.canAct(enemy)) {
            return {
                success: false,
                reason: 'cannot_act',
                messages: [BattleCore.getCannotActMessage(enemy, enemy.name)]
            };
        }

        // Select move
        var move = selectEnemyMove();
        var messages = [];

        // Healing move
        if (move.isHeal && move.healAmount) {
            // Use rollDamageDetailed to get min/max info for heal rolls
            var healRollResult;
            var healAmount;
            var isMinHeal = false;
            var isMaxHeal = false;
            if (typeof BattleDice !== 'undefined' && BattleDice.rollDamageDetailed) {
                healRollResult = BattleDice.rollDamageDetailed(move.healAmount);
                healAmount = healRollResult.total;
                isMinHeal = healRollResult.isMin;
                isMaxHeal = healRollResult.isMax;
            } else {
                healAmount = rollHeal(move.healAmount);
            }
            var healResult = BattleCore.healEnemy(healAmount, 'move');
            messages.push(enemy.name + ' uses ' + (move.name || 'Heal') + '!');
            // Don't push recovery message - will be shown via animated roll
            // BattleCore.playSfx('heal') will be called by BattleDiceUI
            return {
                success: true,
                healed: healResult.healed,
                healRoll: {
                    amount: healResult.healed,
                    healerName: enemy.name,
                    healRolled: healAmount,
                    isMinHeal: isMinHeal,
                    isMaxHeal: isMaxHeal
                },
                messages: messages
            };
        }

        // Buff move
        if (move.isBuff && move.statusEffect) {
            var buffResult = BattleCore.applyStatus(enemy, move.statusEffect.type, 1);
            messages.push(enemy.name + ' uses ' + (move.name || 'Buff') + '!');
            if (buffResult.applied) {
                messages.push(buffResult.message);
            }
            BattleCore.playSfx('buff_apply');
            return { success: true, buffed: true, messages: messages };
        }

        // Attack move
        // Pass qteResult so status effects aren't applied on parried/dodged attacks
        var attackResult = resolveAttack(enemy, player, move, qteResult);

        messages.push(enemy.name + ' uses ' + (move.name || 'Attack') + '!');

        // Store pending damage info - will be applied after animation completes
        var pendingDamage = null;
        var pendingCounter = null;

        if (attackResult.hit) {
            // Apply QTE dodge reduction
            var finalDamage = attackResult.damage;
            if (qteResult && qteResult.damageReduction) {
                finalDamage = Math.floor(finalDamage * (1 - qteResult.damageReduction));
            }

            if (finalDamage > 0) {
                // Don't apply damage yet - store it for later
                pendingDamage = {
                    amount: finalDamage,
                    source: 'enemy',
                    type: attackResult.damageType,
                    isCrit: attackResult.isCrit
                };

                messages.push('<span class="roll-damage-normal">' + finalDamage + ' DAMAGE</span>');

                if (attackResult.isCrit) {
                    messages.push('Critical hit!');
                }

                // Status effect
                if (attackResult.statusResult && attackResult.statusResult.applied) {
                    messages.push(attackResult.statusResult.message);
                }

                // Counter attack from perfect dodge - also defer
                if (qteResult && qteResult.counterAttack) {
                    var counterDamage = Math.floor(attackResult.damage * 0.5);
                    pendingCounter = {
                        amount: counterDamage,
                        source: 'counter',
                        type: 'physical'
                    };
                    messages.push('Counter attack for <span class="roll-damage-normal">' + counterDamage + ' DAMAGE</span>!');
                }

                BattleCore.playSfx('attack_' + (attackResult.damageType || 'physical'));
            } else {
                messages.push('But you dodged completely!');
                BattleCore.playSfx('attack_miss');
            }
        } else {
            messages.push('But it missed!');
            BattleCore.playSfx('attack_miss');
        }

        // Decrement player defending (lasts 2 turns)
        if (player.defending > 0) {
            player.defending--;
        }

        return {
            success: true,
            attackResult: attackResult,
            pendingDamage: pendingDamage,
            pendingCounter: pendingCounter,
            messages: messages
        };
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    function getEffectivenessMessage(multiplier) {
        if (multiplier >= 2) return "It's super effective!";
        if (multiplier === 0) return "It has no effect...";
        if (multiplier <= 0.5) return "It's not very effective...";
        return '';
    }

    // =========================================================================
    // QTE INTEGRATION (D&D uses accuracy/dodge QTEs)
    // =========================================================================

    /**
     * Execute player attack with accuracy QTE
     * @param {Function} callback - Called with result
     */
    function playerAttackWithQTE(callback) {
        if (typeof QTEEngine === 'undefined') {
            var result = playerAttack();
            if (callback) callback(result);
            return;
        }

        QTEEngine.startAccuracyQTE({
            difficulty: 'normal'
        }, function(qteResult) {
            var result = playerAttack(qteResult.modifiers || {});
            result.qteResult = qteResult;
            if (callback) callback(result);
        });
    }

    /**
     * Execute player skill with skill QTE (advantage/disadvantage system)
     * @param {string} skillId - Skill to use
     * @param {Function} callback - Called with result
     */
    function playerSkillWithQTE(skillId, callback) {
        var skill = _hasBattleData ? BattleData.getSkill(skillId) : null;
        if (!skill) skill = findSkill(skillId);

        // Check if skill QTE is enabled
        var qteEnabled = T && T.qte && T.qte.enabledForSkills;

        // Skip QTE for summon/heal/buff skills - they don't benefit from it
        var skipQTE = skill && (skill.isSummon || skill.isHeal || skill.isBuff);

        if (typeof QTEEngine === 'undefined' || !qteEnabled || skipQTE) {
            var result = playerSkill(skillId);
            if (callback) callback(result);
            return;
        }

        // Start skill QTE - result determines advantage/disadvantage
        QTEEngine.startSkillQTE({
            difficulty: 'normal',
            skillName: skill ? skill.name : skillId
        }, function(qteResult) {
            // Get modifiers based on QTE zone (perfect/good/normal/bad)
            var zone = qteResult.zone || 'normal';
            // Use QTEEngine.getSkillModifiers for proper fallback defaults
            var skillMods = (typeof QTEEngine !== 'undefined' && QTEEngine.getSkillModifiers)
                ? QTEEngine.getSkillModifiers(zone)
                : (qteResult.modifiers || {});

            // Build modifiers for the skill
            var modifiers = {};
            if (skillMods.advantage) modifiers.advantage = true;
            if (skillMods.disadvantage) modifiers.disadvantage = true;
            if (skillMods.bonusDamage) modifiers.damageMultiplier = 1 + skillMods.bonusDamage;
            if (skillMods.bonusHealing) modifiers.bonusHealing = skillMods.bonusHealing;
            if (skillMods.statusChanceBonus) modifiers.statusChanceBonus = skillMods.statusChanceBonus;

            var result = playerSkillWithModifiers(skillId, modifiers);
            result.qteResult = qteResult;
            result.qteZone = zone;
            if (callback) callback(result);
        });
    }

    /**
     * Execute player skill with advantage/disadvantage modifiers
     */
    function playerSkillWithModifiers(skillId, modifiers) {
        modifiers = modifiers || {};
        var player = BattleCore.getPlayer();
        var enemy = BattleCore.getEnemy();
        var skill = findSkill(skillId);

        if (!skill) {
            return { success: false, reason: 'unknown_skill', messages: ['Unknown skill!'] };
        }

        // Handle heal/buff/summon skills by delegating to playerSkill with modifiers
        if (skill.isHeal || skill.isBuff || skill.isSummon || (skill.healAmount && !skill.damage)) {
            return playerSkill(skillId, modifiers);
        }

        if (skill.manaCost && player.mana < skill.manaCost) {
            return { success: false, reason: 'no_mana', messages: ['Not enough MP!'] };
        }

        if (skill.manaCost) {
            BattleCore.useMana(skill.manaCost);
        }

        var messages = [];
        var result = { success: true, messages: messages, skill: skill };

        // Roll with advantage/disadvantage for attack skills
        var hasAdvantage = modifiers.advantage || modifiers.useAdvantage;
        var hasDisadvantage = modifiers.disadvantage || modifiers.useDisadvantage;

        var rollResult;
        if (hasAdvantage && _hasBattleDice) {
            rollResult = BattleDice.rollWithAdvantage();
        } else if (hasDisadvantage && _hasBattleDice) {
            rollResult = BattleDice.rollWithDisadvantage();
        } else {
            rollResult = rollD20();
        }

        // Build attack with custom roll
        var qteResult = {
            damageMultiplier: modifiers.damageMultiplier || 1,
            statusChanceBonus: modifiers.statusChanceBonus || 0,
            damageAdvantage: hasAdvantage || false,
            damageDisadvantage: hasDisadvantage || false
        };

        var attackResult = resolveAttackWithRoll(player, enemy, skill, qteResult, rollResult);
        result.attackResult = attackResult;

        if (attackResult.hit) {
            var skillHits = skill.hits || 1;
            if (_hasBattleBarrier && BattleBarrier.hasBarrier()) {
                var barrierResult = BattleBarrier.removeStack(skillHits);
                result.barrierResult = barrierResult;
                attackResult.hadBarrier = true;

                if (barrierResult.broken) {
                    messages.push(skill.name + ' shatters the barrier!');
                } else {
                    messages.push(skill.name + ' hits barrier! (' + barrierResult.remaining + ' left)');
                }
                BattleCore.playSfx('barrier_hit');
            } else {
                // Don't apply damage yet - store for after animation completes
                result.pendingDamage = {
                    amount: attackResult.damage,
                    source: 'player',
                    type: attackResult.damageType,
                    isCrit: attackResult.isCrit
                };
                messages.push(skill.name + ' hits for <span class="battle-number">' + attackResult.damage + ' damage</span>!');
                if (attackResult.isCrit) messages.push('Critical hit!');
                BattleCore.playSfx('attack_' + attackResult.damageType);
            }

            if (attackResult.statusResult && attackResult.statusResult.applied) {
                messages.push(attackResult.statusResult.message);
            }
            BattleCore.addStagger(enemy, attackResult.isCrit ? 25 : 15);
        } else {
            messages.push(skill.name + ' missed!');
            BattleCore.playSfx('attack_miss');
        }

        return result;
    }

    /**
     * Resolve attack with a pre-rolled d20 result (for advantage/disadvantage)
     */
    function resolveAttackWithRoll(attacker, defender, skill, qteResult, rollResult) {
        skill = skill || {};
        qteResult = qteResult || {};

        var roll = rollResult.roll;
        var isCrit = rollResult.isCrit;
        var isFumble = rollResult.isFumble;

        // Build attack modifiers array (same as player attacks)
        var attackModifiers = [];

        // Base attack bonus from attacker stats
        if (attacker.attackBonus) {
            attackModifiers.push({ value: attacker.attackBonus, source: 'Attack' });
        }

        // Skill attack bonus
        if (skill.attackBonus) {
            attackModifiers.push({ value: skill.attackBonus, source: 'Skill' });
        }

        // Calculate total attack bonus
        var attackBonus = 0;
        for (var k = 0; k < attackModifiers.length; k++) {
            attackBonus += attackModifiers[k].value;
        }

        // Fumble (nat 1) absorbs bonuses but stays at 1
        var attackTotal = isFumble ? 1 : roll + attackBonus;

        // Crit if natural 20 OR total >= 20 (bonuses can push into crit range)
        if (!isCrit && !isFumble && attackTotal >= 20) {
            isCrit = true;
        }

        var defenderAC = defender.ac || 10;  // Note: Defending no longer provides AC bonus

        var hit = isCrit ? true : (isFumble ? false : attackTotal >= defenderAC);

        var damage = 0;
        var baseDamageRoll = 0;
        var damageType = skill.type || attacker.type || 'physical';
        var damageModifiers = [];
        var isMinDamage = false;
        var isMaxDamage = false;

        // Track damage advantage for UI display
        var hasDamageAdvantage = false;
        var hasDamageDisadvantage = false;
        var damageRolls = null;

        if (hit) {
            var damageDice = skill.damage || attacker.damage || '1d6';
            var damageRollResult;
            if (typeof BattleDice !== 'undefined') {
                // Use advantage/disadvantage for damage if specified
                if (qteResult.damageAdvantage && BattleDice.rollDamageWithAdvantage) {
                    damageRollResult = BattleDice.rollDamageWithAdvantage(damageDice);
                    hasDamageAdvantage = true;
                    damageRolls = damageRollResult.bothRolls;
                } else if (qteResult.damageDisadvantage && BattleDice.rollDamageWithDisadvantage) {
                    damageRollResult = BattleDice.rollDamageWithDisadvantage(damageDice);
                    hasDamageDisadvantage = true;
                    damageRolls = damageRollResult.bothRolls;
                } else if (BattleDice.rollDamageDetailed) {
                    damageRollResult = BattleDice.rollDamageDetailed(damageDice);
                } else {
                    damageRollResult = { total: rollDamage(damageDice) };
                }
                baseDamageRoll = damageRollResult.total;
                isMinDamage = damageRollResult.isMin || false;
                isMaxDamage = damageRollResult.isMax || false;
            } else {
                baseDamageRoll = rollDamage(damageDice);
            }
            damage = baseDamageRoll;

            // Apply crit multiplier (shown as x2, same as player)
            if (isCrit) {
                damageModifiers.push({ value: config.critMultiplier, source: 'CRIT', isMultiplier: true });
                damage = Math.floor(damage * config.critMultiplier);
            }

            // Apply QTE damage multiplier
            if (qteResult.damageMultiplier && qteResult.damageMultiplier !== 1) {
                var qteBonus = Math.floor(damage * (qteResult.damageMultiplier - 1));
                if (qteBonus !== 0) {
                    damageModifiers.push({ value: qteBonus, source: 'Timing' });
                    damage = Math.floor(damage * qteResult.damageMultiplier);
                }
            }

            // Apply defend damage reduction (50% reduction shown as ÷2)
            if (defender.defending && defender.defending > 0) {
                damageModifiers.push({ value: 0.5, source: 'DEFEND', isDivisor: true });
                damage = Math.floor(damage * 0.5);
            }

            damage = Math.max(config.minDamage, damage);
        }

        var statusResult = null;
        if (hit && skill.statusEffect) {
            var chance = (skill.statusEffect.chance || 0) + (qteResult.statusChanceBonus || 0);
            statusResult = BattleCore.shouldApplyStatus(chance) ? BattleCore.applyStatus(defender, skill.statusEffect.type, 1) : { applied: false };
        }

        // Apply confusion on fumble (nat 1)
        var fumbleStatusResult = null;
        if (isFumble) {
            fumbleStatusResult = BattleCore.applyStatus(attacker, 'confusion', 1);
        }

        return {
            roll: roll,
            rolls: rollResult.rolls,
            attackTotal: attackTotal,
            attackModifiers: attackModifiers,
            defenderAC: defenderAC,
            hit: hit,
            isCrit: isCrit,
            isFumble: isFumble,
            damage: damage,
            baseDamageRoll: baseDamageRoll,
            damageModifiers: damageModifiers,
            damageType: damageType,
            typeMultiplier: _hasBattleData ? BattleData.getTypeMultiplier(damageType, defender.type) : 1,
            statusResult: statusResult,
            fumbleStatusResult: fumbleStatusResult,
            hasAdvantage: rollResult.advantage || false,
            hasDisadvantage: rollResult.disadvantage || false,
            isMinDamage: isMinDamage,
            isMaxDamage: isMaxDamage,
            hasDamageAdvantage: hasDamageAdvantage,
            hasDamageDisadvantage: hasDamageDisadvantage,
            damageRolls: damageRolls
        };
    }

    /**
     * Execute enemy turn with defend QTE for player (if defending)
     * @param {Function} callback - Called with result
     */
    function enemyTurnWithQTE(callback) {
        var enemy = BattleCore.getEnemy();
        var player = BattleCore.getPlayer();

        // Check if enemy can act
        if (!BattleCore.canAct(enemy)) {
            if (callback) callback({
                success: false,
                reason: 'cannot_act',
                messages: [BattleCore.getCannotActMessage(enemy, enemy.name)]
            });
            return;
        }

        // Check if defend QTE is enabled and player is defending
        var defendQTEEnabled = T && T.qte && T.qte.enabledForDefend;
        var isDefending = player.defending && player.defending > 0;

        if (typeof QTEEngine === 'undefined' || !defendQTEEnabled || !isDefending) {
            // No QTE - normal enemy turn
            var result = enemyTurn();
            if (callback) callback(result);
            return;
        }

        // Player is defending - start defend QTE (parry/dodge/block/broken)
        QTEEngine.startDefendQTE({
            difficulty: 'normal'
        }, function(qteResult) {
            // Get modifiers based on QTE zone (perfect/good/normal/bad)
            var zone = qteResult.zone || 'normal';
            var defendMods = T && T.qte && T.qte.defendModifiers ? T.qte.defendModifiers[zone] : {};

            // Build modifiers for enemy turn
            var modifiers = {
                damageReduction: defendMods.damageReduction || 0,
                counterAttack: defendMods.counterAttack || false,
                counterDamagePercent: defendMods.counterDamagePercent || 0.5,
                defendResult: defendMods.result || 'block'
            };

            // Handle defend ending on bad QTE
            if (defendMods.defendEnds) {
                player.defending = 0;
                modifiers.defendBroken = true;
            }

            var result = enemyTurn(modifiers);
            result.qteResult = qteResult;
            result.qteZone = zone;
            result.defendOutcome = defendMods.result;
            if (callback) callback(result);
        });
    }

    /**
     * Generate enemy intent for next turn (uses BattleIntent module)
     */
    function generateIntent() {
        if (!_hasBattleIntent) return null;
        var enemy = BattleCore.getEnemy();
        var player = BattleCore.getPlayer();
        return BattleIntent.generate(enemy, player);
    }

    /**
     * Get current enemy intent
     */
    function getIntent() {
        return _hasBattleIntent ? BattleIntent.get() : null;
    }

    /**
     * Clear enemy intent
     */
    function clearIntent() {
        if (_hasBattleIntent) BattleIntent.clear();
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        name: 'dnd',
        displayName: 'D&D Style',

        // Dice
        rollD20: rollD20,
        rollDamage: rollDamage,
        rollHeal: rollHeal,

        // Attack resolution
        resolveAttack: resolveAttack,
        resolveSummonAttack: resolveSummonAttack,

        // Player actions (standard - accepts qteResult param)
        playerAttack: playerAttack,
        playerSkill: playerSkill,
        playerDefend: playerDefend,
        playerFlee: playerFlee,
        playerLimitBreak: playerLimitBreak,

        // Player actions (with QTE - handles QTE internally)
        playerAttackWithQTE: playerAttackWithQTE,
        playerSkillWithQTE: playerSkillWithQTE,

        // Player actions (with modifiers)
        playerSkillWithModifiers: playerSkillWithModifiers,
        resolveAttackWithRoll: resolveAttackWithRoll,

        // Enemy AI
        selectEnemyMove: selectEnemyMove,
        enemyTurn: enemyTurn,
        enemyTurnWithQTE: enemyTurnWithQTE,

        // Intent system (if BattleIntent loaded)
        generateIntent: generateIntent,
        getIntent: getIntent,
        clearIntent: clearIntent,

        // Barrier helpers
        hasBarrier: function() { return _hasBattleBarrier && BattleBarrier.hasBarrier(); },
        getBarrierStacks: function() { return _hasBattleBarrier ? BattleBarrier.getStacks() : 0; },
        initBarrier: function(stacks) { if (_hasBattleBarrier) BattleBarrier.init(stacks); },

        // Helpers
        getEffectivenessMessage: getEffectivenessMessage,
        setForcedRollCallback: setForcedRollCallback
    };
})();
