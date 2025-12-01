/**
 * Andi VN - Battle Data Module
 *
 * Pure data definitions for the battle system.
 * Contains no logic - just lookup tables for:
 * - Type chart (damage effectiveness)
 * - Status effects
 * - Skills
 * - Terrain types
 * - Battle items
 * - Summons
 * - Passives
 * - Limit breaks
 * - Dialogue triggers
 *
 * This module is shared across all battle styles (DnD, Pokemon, Expedition33).
 */

var BattleData = (function() {
    'use strict';

    // =========================================================================
    // TYPE SYSTEM
    // =========================================================================

    /**
     * Type effectiveness chart
     * Values: 2 = super effective, 0.5 = not very effective, 0 = immune
     * Missing entries = neutral (1x)
     * @type {Object.<string, Object.<string, number>>}
     */
    var typeChart = {
        physical: { /* neutral to all */ },
        fire: { ice: 2, fire: 0.5 },
        ice: { fire: 0.5, lightning: 2, ice: 0.5 },
        lightning: { ice: 0.5, lightning: 0.5 },
        poison: { poison: 0.5, psychic: 2 },
        psychic: { psychic: 0.5, dark: 0 },
        holy: { dark: 2, holy: 0.5 },
        dark: { holy: 0.5, psychic: 2, dark: 0.5 }
    };

    // =========================================================================
    // STATUS EFFECTS
    // =========================================================================

    /**
     * Status effect definitions
     * @type {Object.<string, Object>}
     */
    var statusEffects = {
        burn: {
            name: 'Burn',
            icon: '🔥',
            color: '#ff6b35',
            duration: 3,
            damagePerTurn: 2,
            description: 'Takes fire damage each turn'
        },
        poison: {
            name: 'Poison',
            icon: '☠️',
            color: '#9b59b6',
            duration: 4,
            damagePerTurn: 1,
            stacks: true,
            description: 'Takes poison damage each turn (stacks)'
        },
        stun: {
            name: 'Stun',
            icon: '⚡',
            color: '#f1c40f',
            duration: 1,
            skipsTurn: true,
            description: 'Cannot act for one turn'
        },
        frozen: {
            name: 'Frozen',
            icon: '❄️',
            color: '#3498db',
            duration: 2,
            skipsTurn: true,
            acBonus: -2,
            description: 'Cannot act, easier to hit'
        },
        bleed: {
            name: 'Bleed',
            icon: '🩸',
            color: '#c0392b',
            duration: 3,
            damagePerTurn: 1,
            damageOnAction: 1,
            description: 'Takes damage each turn, more when attacking'
        },
        defense_up: {
            name: 'Defense Up',
            icon: '🛡️',
            color: '#27ae60',
            duration: 2,
            acBonus: 2,
            description: '+2 AC for 2 turns'
        },
        attack_up: {
            name: 'Attack Up',
            icon: '⚔️',
            color: '#e74c3c',
            duration: 3,
            attackBonus: 2,
            damageBonus: 2,
            description: '+2 to attack and damage'
        },
        regen: {
            name: 'Regen',
            icon: '💚',
            color: '#2ecc71',
            duration: 3,
            healPerTurn: 2,
            description: 'Recovers HP each turn'
        },
        mana_regen: {
            name: 'Mana Regen',
            icon: '💙',
            color: '#3498db',
            duration: 3,
            manaPerTurn: 5,
            description: 'Recovers MP each turn'
        },
        confusion: {
            name: 'Confusion',
            icon: '💫',
            color: '#ff69b4',
            duration: 2,
            selfDamageChance: 0.4,
            selfDamagePercent: 0.05,
            description: '40% chance to hurt yourself for 5% max HP'
        }
    };

    // =========================================================================
    // SKILLS
    // =========================================================================

    /**
     * Skill definitions
     * @type {Object.<string, Object>}
     */
    var skills = {
        // Physical skills
        power_strike: {
            name: 'Power Strike',
            manaCost: 3,
            damage: '2d6',
            type: 'physical',
            attackBonus: 1,
            description: 'A powerful melee attack'
        },
        whirlwind: {
            name: 'Whirlwind',
            manaCost: 5,
            damage: '1d8',
            type: 'physical',
            description: 'Spinning attack'
        },
        // Fire skills
        fireball: {
            name: 'Fireball',
            manaCost: 4,
            damage: '2d6',
            type: 'fire',
            statusEffect: { type: 'burn', chance: 0.3 },
            description: 'Fire magic, may cause burn'
        },
        flame_burst: {
            name: 'Flame Burst',
            manaCost: 6,
            damage: '3d4',
            type: 'fire',
            statusEffect: { type: 'burn', chance: 0.5 },
            description: 'Intense flames, high burn chance'
        },
        // Ice skills
        ice_shard: {
            name: 'Ice Shard',
            manaCost: 3,
            damage: '1d8',
            type: 'ice',
            statusEffect: { type: 'frozen', chance: 0.2 },
            description: 'Ice projectile, may freeze'
        },
        blizzard: {
            name: 'Blizzard',
            manaCost: 7,
            damage: '2d6',
            type: 'ice',
            statusEffect: { type: 'frozen', chance: 0.4 },
            description: 'Freezing storm'
        },
        // Lightning skills
        shock: {
            name: 'Shock',
            manaCost: 3,
            damage: '1d10',
            type: 'lightning',
            statusEffect: { type: 'stun', chance: 0.25 },
            description: 'Electric jolt, may stun'
        },
        thunderbolt: {
            name: 'Thunderbolt',
            manaCost: 6,
            damage: '2d8',
            type: 'lightning',
            statusEffect: { type: 'stun', chance: 0.35 },
            description: 'Powerful lightning strike'
        },
        // Poison skills
        toxic_strike: {
            name: 'Toxic Strike',
            manaCost: 2,
            damage: '1d4',
            type: 'poison',
            statusEffect: { type: 'poison', chance: 0.6 },
            description: 'Weak hit but high poison chance'
        },
        venom_spray: {
            name: 'Venom Spray',
            manaCost: 4,
            damage: '1d6',
            type: 'poison',
            statusEffect: { type: 'poison', chance: 0.8, stacks: 2 },
            description: 'Applies 2 poison stacks'
        },
        // Holy/healing skills
        smite: {
            name: 'Smite',
            manaCost: 4,
            damage: '2d6',
            type: 'holy',
            description: 'Holy damage'
        },
        heal: {
            name: 'Heal',
            manaCost: 4,
            isHeal: true,
            healAmount: '2d4+2',
            description: 'Restore HP'
        },
        regenerate: {
            name: 'Regenerate',
            manaCost: 5,
            isHeal: true,
            statusEffect: { type: 'regen', chance: 1.0, target: 'self' },
            description: 'Apply regen buff'
        },
        // Buff skills
        fortify: {
            name: 'Fortify',
            manaCost: 3,
            isBuff: true,
            statusEffect: { type: 'defense_up', chance: 1.0, target: 'self' },
            description: 'Boost defense temporarily'
        },
        empower: {
            name: 'Empower',
            manaCost: 3,
            isBuff: true,
            statusEffect: { type: 'attack_up', chance: 1.0, target: 'self' },
            description: 'Boost attack temporarily'
        },

        // =====================================================================
        // FINALIZED BATTLE SYSTEM SKILLS
        // =====================================================================
        // Multi-hit skills (good for barrier breaking)
        // Barrier-focused skills
        // High-risk high-reward skills (designed for QTE gating)

        // Multi-hit skills (strong vs barriers)
        rapid_strike: {
            name: 'Rapid Strike',
            manaCost: 4,
            damage: '1d4',
            type: 'physical',
            hits: 3,  // 3 hits = removes 3 barrier stacks
            description: 'Three rapid strikes. Effective against barriers.'
        },
        flurry: {
            name: 'Flurry',
            manaCost: 6,
            damage: '1d3',
            type: 'physical',
            hits: 5,  // 5 hits!
            description: 'Five-hit combo. Devastating against barriers.'
        },
        chain_lightning: {
            name: 'Chain Lightning',
            manaCost: 5,
            damage: '1d6',
            type: 'lightning',
            hits: 2,
            statusEffect: { type: 'stun', chance: 0.15 },
            description: 'Lightning that jumps twice. May stun.'
        },
        meteor_shower: {
            name: 'Meteor Shower',
            manaCost: 8,
            damage: '1d8',
            type: 'fire',
            hits: 4,
            statusEffect: { type: 'burn', chance: 0.2 },
            description: 'Raining fire. Four hits, may burn.'
        },

        // Barrier-specific skills
        barrier_break: {
            name: 'Barrier Break',
            manaCost: 5,
            damage: '1d6',
            type: 'physical',
            barrierDamage: 2,  // Removes 2 barrier stacks instead of 1
            description: 'Specialized anti-barrier technique.'
        },
        shatter: {
            name: 'Shatter',
            manaCost: 7,
            damage: '2d4',
            type: 'ice',
            barrierDamage: 3,  // Removes 3 barrier stacks
            statusEffect: { type: 'frozen', chance: 0.1 },
            description: 'Breaks through barriers. May freeze.'
        },

        // High-power skills (designed for QTE perfect hits)
        critical_edge: {
            name: 'Critical Edge',
            manaCost: 6,
            damage: '3d6',
            type: 'physical',
            attackBonus: 3,
            description: 'Precise strike. High damage on good timing.'
        },
        inferno: {
            name: 'Inferno',
            manaCost: 8,
            damage: '4d6',
            type: 'fire',
            statusEffect: { type: 'burn', chance: 0.6 },
            description: 'Massive fire attack. Risky but powerful.'
        },
        divine_judgment: {
            name: 'Divine Judgment',
            manaCost: 10,
            damage: '5d6',
            type: 'holy',
            description: 'Ultimate holy strike. Devastating with perfect timing.'
        },

        // Utility skills for finalized system
        guard_stance: {
            name: 'Guard Stance',
            manaCost: 2,
            isBuff: true,
            buff: { acBonus: 4, duration: 2 },
            description: 'Defensive stance. +4 AC for 2 turns.'
        },
        focus: {
            name: 'Focus',
            manaCost: 3,
            isBuff: true,
            buff: { nextSkillAdvantage: true },
            description: 'Grants advantage on next skill.'
        },
        drain_life: {
            name: 'Drain Life',
            manaCost: 5,
            damage: '2d4',
            type: 'dark',
            lifesteal: 0.5,  // Heal for 50% of damage dealt
            description: 'Dark magic. Heals for half damage dealt.'
        }
    };

    // =========================================================================
    // TERRAIN
    // =========================================================================

    /**
     * Terrain type definitions
     * @type {Object.<string, Object>}
     */
    var terrainTypes = {
        none: {
            name: 'Normal',
            description: 'No special effects'
        },
        lava: {
            name: 'Lava Field',
            icon: '🌋',
            color: '#e74c3c',
            description: 'Fire attacks +25%, Ice attacks -25%, burn chance +20%',
            typeBonus: { fire: 1.25, ice: 0.75 },
            statusChanceBonus: { burn: 0.2 }
        },
        ice: {
            name: 'Frozen Tundra',
            icon: '🧊',
            color: '#3498db',
            description: 'Ice attacks +25%, Fire attacks -25%, freeze chance +20%',
            typeBonus: { ice: 1.25, fire: 0.75 },
            statusChanceBonus: { frozen: 0.2 }
        },
        swamp: {
            name: 'Toxic Swamp',
            icon: '🐸',
            color: '#27ae60',
            description: 'Poison attacks +25%, poison chance +30%',
            typeBonus: { poison: 1.25 },
            statusChanceBonus: { poison: 0.3 }
        },
        storm: {
            name: 'Thunder Plains',
            icon: '⛈️',
            color: '#9b59b6',
            description: 'Lightning attacks +25%, stun chance +15%',
            typeBonus: { lightning: 1.25 },
            statusChanceBonus: { stun: 0.15 }
        },
        holy_ground: {
            name: 'Sacred Ground',
            icon: '✨',
            color: '#f1c40f',
            description: 'Holy attacks +50%, Dark attacks -50%, regen to all each turn',
            typeBonus: { holy: 1.5, dark: 0.5 },
            healPerTurn: 1
        },
        darkness: {
            name: 'Shroud of Darkness',
            icon: '🌑',
            color: '#2c3e50',
            description: 'Dark attacks +50%, Holy attacks -50%, accuracy -10%',
            typeBonus: { dark: 1.5, holy: 0.5 },
            accuracyPenalty: 2
        }
    };

    // =========================================================================
    // ITEMS
    // =========================================================================

    /**
     * Battle item definitions
     * @type {Object.<string, Object>}
     */
    var battleItems = {
        health_potion: {
            name: 'Health Potion',
            icon: '🧪',
            description: 'Restores 10 HP',
            heals: 10,
            consumable: true
        },
        greater_health_potion: {
            name: 'Greater Health Potion',
            icon: '🧪',
            description: 'Restores 20 HP',
            heals: 20,
            consumable: true
        },
        mana_potion: {
            name: 'Mana Potion',
            icon: '💧',
            description: 'Restores 10 MP',
            restoresMana: 10,
            consumable: true
        },
        antidote: {
            name: 'Antidote',
            icon: '💊',
            description: 'Cures poison',
            curesStatus: 'poison',
            consumable: true
        },
        burn_salve: {
            name: 'Burn Salve',
            icon: '🩹',
            description: 'Cures burn',
            curesStatus: 'burn',
            consumable: true
        },
        smelling_salts: {
            name: 'Smelling Salts',
            icon: '👃',
            description: 'Cures stun',
            curesStatus: 'stun',
            consumable: true
        },
        coffee_mug: {
            name: 'Coffee Mug',
            icon: '☕',
            description: 'Restores full MP and +5 MP per turn for 2 turns',
            restoresFullMana: true,
            appliesStatus: { type: 'mana_regen', duration: 2 },
            consumable: true
        },
        energy_drink: {
            name: 'Energy Drink',
            icon: '🥤',
            description: 'Grants Attack Up for 3 turns',
            appliesStatus: 'attack_up',
            consumable: true
        },
        shield_scroll: {
            name: 'Shield Scroll',
            icon: '📜',
            description: 'Grants Defense Up for 2 turns',
            appliesStatus: 'defense_up',
            consumable: true
        }
    };

    // =========================================================================
    // SUMMONS
    // =========================================================================

    /**
     * Summon type definitions
     * @type {Object.<string, Object>}
     */
    var summonTypes = {
        fire_sprite: {
            name: 'Fire Sprite',
            icon: '🔥',
            description: 'A small flame spirit that attacks each turn',
            duration: 3,
            attack: { name: 'Flame Lick', damage: '1d4', type: 'fire', statusEffect: { type: 'burn', chance: 0.2 } },
            sprite: 'fire_sprite.svg'
        },
        ice_golem: {
            name: 'Ice Golem',
            icon: '❄️',
            description: 'A slow but sturdy ice construct',
            duration: 4,
            attack: { name: 'Frost Punch', damage: '1d6', type: 'ice', statusEffect: { type: 'frozen', chance: 0.15 } },
            passive: { type: 'ac_bonus', value: 1 },
            sprite: 'ice_golem.svg'
        },
        lightning_wisp: {
            name: 'Lightning Wisp',
            icon: '⚡',
            description: 'A fast electrical spirit',
            duration: 2,
            attack: { name: 'Zap', damage: '2d4', type: 'lightning', statusEffect: { type: 'stun', chance: 0.25 } },
            sprite: 'lightning_wisp.svg'
        },
        healing_fairy: {
            name: 'Healing Fairy',
            icon: '🧚',
            description: 'A gentle fairy that heals each turn',
            duration: 3,
            healPerTurn: 3,
            sprite: 'healing_fairy.svg'
        },
        shadow_hound: {
            name: 'Shadow Hound',
            icon: '🐺',
            description: 'A dark beast from the shadows',
            duration: 3,
            attack: { name: 'Dark Bite', damage: '1d8', type: 'dark' },
            sprite: 'shadow_hound.svg'
        },
        office_assistant: {
            name: 'Office Assistant',
            icon: '📎',
            description: 'It looks like you\'re trying to fight! Would you like help?',
            duration: 4,
            healPerTurn: 2,
            attack: { name: 'Papercut', damage: '1d4', type: 'physical', statusEffect: { type: 'bleed', chance: 0.3 } },
            sprite: 'clippy.svg'
        }
    };

    // =========================================================================
    // PASSIVES
    // =========================================================================

    /**
     * Passive ability definitions
     * @type {Object.<string, Object>}
     */
    var passiveTypes = {
        // Player passives
        resilience: {
            name: 'Resilience',
            description: 'Recover 1 HP at the start of each turn',
            healPerTurn: 1
        },
        mana_flow: {
            name: 'Mana Flow',
            description: 'Recover 1 MP at the start of each turn',
            manaPerTurn: 1
        },
        thick_skin: {
            name: 'Thick Skin',
            description: '+2 AC permanently',
            acBonus: 2
        },
        sharp_mind: {
            name: 'Sharp Mind',
            description: '+1 to all attack rolls',
            attackBonus: 1
        },
        vampiric: {
            name: 'Vampiric',
            description: 'Heal 20% of damage dealt',
            lifesteal: 0.2
        },
        thorns: {
            name: 'Thorns',
            description: 'Deal 2 damage to attackers when hit',
            reflectDamage: 2
        },
        lucky: {
            name: 'Lucky',
            description: 'Critical hits on 19 or 20',
            critRange: 19
        },
        berserker: {
            name: 'Berserker',
            description: '+3 damage when below 25% HP',
            lowHPDamageBonus: 3,
            lowHPThreshold: 0.25
        },
        // Enemy passives
        regenerating: {
            name: 'Regenerating',
            description: 'Recovers 2 HP each turn',
            healPerTurn: 2
        },
        armored: {
            name: 'Armored',
            description: 'Takes 2 less damage from all attacks (min 1)',
            damageReduction: 2
        },
        enraged: {
            name: 'Enraged',
            description: 'Gains +2 attack when below 50% HP',
            lowHPAttackBonus: 2,
            lowHPThreshold: 0.5
        },
        poisonous: {
            name: 'Poisonous',
            description: 'All attacks have 30% chance to poison',
            autoStatusEffect: { type: 'poison', chance: 0.3 }
        }
    };

    // =========================================================================
    // LIMIT BREAKS
    // =========================================================================

    /**
     * Limit break definitions
     * @type {Object.<string, Object>}
     */
    var limitBreaks = {
        overdrive: {
            name: 'Overdrive',
            description: 'A devastating multi-hit attack',
            icon: '💥',
            hits: 3,
            damage: '2d6',
            type: 'physical',
            chargeRequired: 100
        },
        phoenix_flame: {
            name: 'Phoenix Flame',
            description: 'Massive fire damage and self-heal',
            icon: '🔥',
            damage: '4d6',
            type: 'fire',
            selfHeal: 10,
            statusEffect: { type: 'burn', chance: 0.8 },
            chargeRequired: 100
        },
        absolute_zero: {
            name: 'Absolute Zero',
            description: 'Freezing blast that always freezes',
            icon: '❄️',
            damage: '3d8',
            type: 'ice',
            statusEffect: { type: 'frozen', chance: 1.0 },
            chargeRequired: 100
        },
        divine_judgment: {
            name: 'Divine Judgment',
            description: 'Holy light that ignores defenses',
            icon: '✨',
            damage: '5d6',
            type: 'holy',
            ignoresAC: true,
            chargeRequired: 100
        },
        last_stand: {
            name: 'Last Stand',
            description: 'Desperate attack - more damage the lower your HP',
            icon: '⚔️',
            damage: '1d6',
            type: 'physical',
            scalingDamage: true,
            chargeRequired: 100
        }
    };

    // =========================================================================
    // DIALOGUE TRIGGERS
    // =========================================================================

    /**
     * Mid-fight dialogue triggers
     * @type {Object.<string, string[]>}
     */
    var dialogueTriggers = {
        player_crit: [
            "Critical hit! Nice!",
            "That's gonna leave a mark!",
            "Direct hit!"
        ],
        player_fumble: [
            "Oops... that didn't go well.",
            "Not my best moment...",
            "Ugh, missed badly!"
        ],
        fumble_text: [
            "trips over their own feet",
            "swings wildly and misses everything",
            "somehow hits themselves with their own weapon",
            "gets distracted by a shiny object",
            "forgets how arms work for a moment"
        ],
        status_confusion: [
            "Everything's spinning...",
            "Wait, which way is up?",
            "My head hurts..."
        ],
        confusion_self_damage: [
            "Ow! I hit myself!",
            "That was my own foot!",
            "Why did I do that?!"
        ],
        player_low_hp: [
            "This isn't looking good...",
            "I need to be careful!",
            "Just a scratch... okay, more than a scratch."
        ],
        player_very_low_hp: [
            "I can't give up now!",
            "One more hit and I'm done...",
            "C'mon, hang in there!"
        ],
        enemy_low_hp: [
            "Almost got 'em!",
            "Just a little more!",
            "They're weakening!"
        ],
        enemy_crit: [
            "Ow! That really hurt!",
            "What a cheap shot!",
            "Okay, that was impressive... unfortunately."
        ],
        status_burn: [
            "Hot hot hot!",
            "I'm on fire! Not in a good way!",
            "Burns like my coffee!"
        ],
        status_poison: [
            "Feeling queasy...",
            "That's... not good for my health.",
            "Note to self: avoid that."
        ],
        status_stun: [
            "Can't... move...",
            "Everything's spinning...",
            "Ugh, stunned!"
        ],
        limit_ready: [
            "I can feel the power building!",
            "It's time to finish this!",
            "Limit Break ready!"
        ],
        summon_appears: [
            "I've got backup!",
            "You're not alone in this!",
            "Reinforcements!"
        ],
        battle_start: [
            "Here we go!",
            "Time to fight!",
            "Let's do this!"
        ],
        victory: [
            "Yes! We did it!",
            "That's how it's done!",
            "Another victory!"
        ],
        defeat: [
            "No... not like this...",
            "I'll get them next time...",
            "This can't be happening..."
        ],
        // Enemy pre-attack taunts
        enemy_attack_default: [
            "My turn!",
            "Here it comes!",
            "Take this!"
        ],
        enemy_attack_player_low_hp: [
            "Time to finish this!",
            "You're barely standing!",
            "This ends now!",
            "One more hit should do it!"
        ],
        enemy_attack_player_healed: [
            "Healing won't save you!",
            "Back to full? Not for long!",
            "That won't help!"
        ],
        enemy_attack_player_defended: [
            "Hiding behind your shield?",
            "Defense won't save you!",
            "Let's test that defense!"
        ],
        enemy_attack_player_missed: [
            "Ha! You missed!",
            "Nice try!",
            "That all you got?",
            "Pathetic!"
        ],
        enemy_attack_got_hit: [
            "Ow! You'll pay for that!",
            "Lucky shot! My turn!",
            "That hurt! Now watch this!"
        ],
        enemy_attack_got_crit: [
            "Impressive... but not enough!",
            "You'll regret that!",
            "Oh, it's ON now!"
        ],
        enemy_attack_self_low_hp: [
            "I'm not done yet!",
            "You think you've won?!",
            "I won't go down easy!"
        ],
        enemy_attack_has_status: [
            "This burning won't stop me!",
            "Even weakened, I can fight!",
            "Pain means nothing!"
        ]
    };

    // =========================================================================
    // SOUND CUES
    // =========================================================================

    /**
     * Sound effect filenames for battle events
     * @type {Object.<string, string>}
     */
    var soundCues = {
        battle_start: 'alert.ogg',
        attack_hit: 'thud.ogg',
        attack_miss: 'negative.ogg',
        attack_crit: 'success.ogg',
        player_hurt: 'negative.ogg',
        enemy_hurt: 'thud.ogg',
        heal: 'success.ogg',
        buff: 'click.ogg',
        status_apply: 'negative.ogg',
        status_tick: 'negative.ogg',
        victory: 'success.ogg',
        defeat: 'failure.ogg',
        flee_success: 'click.ogg',
        flee_fail: 'negative.ogg',
        item_use: 'click.ogg',
        skill_use: 'click.ogg',
        limit_break: 'success.ogg',
        dice_roll: 'dice_roll.ogg'
    };

    // =========================================================================
    // HELPER FUNCTIONS
    // =========================================================================

    /**
     * Get type effectiveness multiplier
     * @param {string} attackType - The attack's type
     * @param {string} defenderType - The defender's type (optional)
     * @returns {number} Damage multiplier (2, 1, 0.5, or 0)
     */
    function getTypeMultiplier(attackType, defenderType) {
        if (!defenderType || !typeChart[attackType]) {
            return 1;
        }
        return typeChart[attackType][defenderType] || 1;
    }

    /**
     * Get a random dialogue line for a trigger
     * @param {string} trigger - The dialogue trigger key
     * @returns {string|null} Random dialogue line or null
     */
    function getDialogue(trigger) {
        var lines = dialogueTriggers[trigger];
        if (!lines || lines.length === 0) {
            return null;
        }
        return lines[Math.floor(Math.random() * lines.length)];
    }

    /**
     * Get skill by ID
     * @param {string} skillId - Skill identifier
     * @returns {Object|null} Skill definition or null
     */
    function getSkill(skillId) {
        return skills[skillId] || null;
    }

    /**
     * Get status effect by ID
     * @param {string} statusId - Status identifier
     * @returns {Object|null} Status definition or null
     */
    function getStatusEffect(statusId) {
        return statusEffects[statusId] || null;
    }

    /**
     * Get item by ID
     * @param {string} itemId - Item identifier
     * @returns {Object|null} Item definition or null
     */
    function getItem(itemId) {
        return battleItems[itemId] || null;
    }

    /**
     * Get passive by ID
     * @param {string} passiveId - Passive identifier
     * @returns {Object|null} Passive definition or null
     */
    function getPassive(passiveId) {
        return passiveTypes[passiveId] || null;
    }

    /**
     * Get limit break by ID
     * @param {string} limitId - Limit break identifier
     * @returns {Object|null} Limit break definition or null
     */
    function getLimitBreak(limitId) {
        return limitBreaks[limitId] || null;
    }

    /**
     * Get terrain by ID
     * @param {string} terrainId - Terrain identifier
     * @returns {Object|null} Terrain definition or null
     */
    function getTerrain(terrainId) {
        return terrainTypes[terrainId] || terrainTypes.none;
    }

    /**
     * Get summon by ID
     * @param {string} summonId - Summon identifier
     * @returns {Object|null} Summon definition or null
     */
    function getSummon(summonId) {
        return summonTypes[summonId] || null;
    }

    /**
     * Get sound cue filename
     * @param {string} cueId - Sound cue identifier
     * @returns {string|null} Filename or null
     */
    function getSoundCue(cueId) {
        return soundCues[cueId] || null;
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        // Raw data (for iteration/extension)
        typeChart: typeChart,
        statusEffects: statusEffects,
        skills: skills,
        terrainTypes: terrainTypes,
        battleItems: battleItems,
        summonTypes: summonTypes,
        passiveTypes: passiveTypes,
        limitBreaks: limitBreaks,
        dialogueTriggers: dialogueTriggers,
        soundCues: soundCues,

        // Helper functions
        getTypeMultiplier: getTypeMultiplier,
        getDialogue: getDialogue,
        getSkill: getSkill,
        getStatusEffect: getStatusEffect,
        getItem: getItem,
        getPassive: getPassive,
        getLimitBreak: getLimitBreak,
        getTerrain: getTerrain,
        getSummon: getSummon,
        getSoundCue: getSoundCue
    };
})();
