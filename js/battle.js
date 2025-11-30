/**
 * Andi VN - Battle System Module
 *
 * Pokemon-style turn-based combat with D&D d20 attack rolls.
 * Features:
 *   - Turn-based: Player action → Enemy action → Repeat
 *   - D20 attack rolls vs AC (nat 20 = crit, nat 1 = fumble)
 *   - Mana system for skills (20-40 pool, Defend recovers mana)
 *   - Status effects: Burn, Poison, Stun with duration tracking
 *   - Type advantages (vulnerabilities 2x, resistances 0.5x, immunities 0x)
 *   - Critical hits (2x damage on nat 20)
 *   - Smarter Enemy AI (health-based behavior)
 *   - Custom battle UI with attack animations
 *   - Item system with inventory integration
 *   - Summons: temporary companions that act automatically
 *   - Mid-fight dialogue: reaction lines on major events
 *   - Music transitions based on HP thresholds
 *   - Limit Break: powerful ability unlocked during battle
 *   - Passives: character-specific traits
 *
 * Usage:
 *   BattleEngine.init(vnEngine);
 *   BattleEngine.start(battleConfig, sceneId);
 */

var BattleEngine = (function() {
    'use strict';

    // === Configuration Constants ===
    // Centralized timing and game balance values
    var config = {
        // Animation timing (milliseconds)
        timing: {
            battleIntro: 1500,          // Delay for "Battle Start!" message
            battleOutro: 2500,          // Delay for victory/defeat effects
            actionDelay: 300,           // Delay between action phases
            enemyTurnDelay: 600,        // Delay before enemy takes turn
            damageNumberDuration: 2000, // How long damage numbers float
            sparkleInterval: 150,       // Interval between victory sparkles
            sparkleLifetime: 2000,      // How long each sparkle lives
            screenShake: 300,           // Duration of screen shake effect
            uiTransition: 1500,         // UI fade in/out transitions
            dialogueDuration: 2500,     // How long dialogue bubbles show
            fadeOutDuration: 300        // Fade out animation time
        },
        // Dice animation settings
        dice: {
            spinDuration: 1800,  // Total dice spin animation time
            spinInterval: 70,    // Time between number changes
            lingerDelay: 500,    // Pause after reveal before continuing
            typewriterSpeed: 25  // Characters per second in battle log
        },
        // Combat balance
        combat: {
            defendACBonus: 4,           // AC bonus when defending
            defendManaRecoveryMin: 2,   // Min mana recovered on defend
            defendManaRecoveryMax: 4,   // Max mana recovered on defend
            defendStaggerReduction: 15, // Stagger reduced when defending
            critMultiplier: 2,          // Damage multiplier on crit
            fleeThreshold: 10,          // Roll needed to flee (d20)
            limitChargeMax: 100,        // Max limit break charge
            staggerThresholdDefault: 100, // Default stagger threshold
            limitChargeOnHit: 5,        // Limit charge gained when hitting
            limitChargeOnTakeDamage: 8  // Limit charge gained when hurt
        },
        // HP thresholds for color/behavior changes
        thresholds: {
            hpHigh: 50,    // Above this = green/healthy
            hpMedium: 25,  // Above this = yellow/caution
            hpLow: 25      // Below this = red/critical
        }
    };

    // === Type System (D&D-style) ===
    // Types: physical, fire, ice, lightning, poison, psychic, holy, dark
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

    // === Status Effects Definitions ===
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
            stacks: true,  // Poison can stack for more damage
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
            acBonus: -2,  // Easier to hit when frozen
            description: 'Cannot act, easier to hit'
        },
        bleed: {
            name: 'Bleed',
            icon: '🩸',
            color: '#c0392b',
            duration: 3,
            damagePerTurn: 1,
            damageOnAction: 1,  // Extra damage when attacking
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
        }
    };

    // === Skill Definitions ===
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
        }
    };

    // === Terrain Effects ===
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

    // === Battle Item Definitions ===
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
            description: 'Restores 5 HP and 5 MP',
            heals: 5,
            restoresMana: 5,
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

    // === Summon Definitions ===
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
            passive: { type: 'ac_bonus', value: 1 }, // Grants +1 AC while active
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

    // === Passive Ability Definitions ===
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

    // === Limit Break Definitions ===
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
            damage: '1d6', // Base damage, multiplied by missing HP%
            type: 'physical',
            scalingDamage: true, // Damage scales with missing HP
            chargeRequired: 100
        }
    };

    // === Mid-Fight Dialogue Triggers ===
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
        // Enemy pre-attack taunts (context-aware - see getEnemyTaunt)
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
            "A little status won't slow me down!"
        ],
        enemy_attack_player_stunned: [
            "Can't move? Too bad!",
            "Just stand there and take it!",
            "This is gonna hurt!",
            "Free hit!"
        ]
    };

    /**
     * Get dialogue lines for a specific trigger from enemy-specific or generic dialogue
     * @param {string} trigger - The dialogue trigger key (e.g., 'attack_default')
     * @returns {Array} Array of dialogue strings
     */
    function getDialogueLines(trigger) {
        // First check enemy-specific dialogue (uses 'attack_*' format)
        if (state.enemy && state.enemy.dialogue && state.enemy.dialogue[trigger]) {
            return state.enemy.dialogue[trigger];
        }
        // Fall back to generic dialogue triggers (uses 'enemy_attack_*' format)
        var genericKey = 'enemy_' + trigger;
        if (dialogueTriggers[genericKey]) {
            return dialogueTriggers[genericKey];
        }
        return [];
    }

    /**
     * Get a contextual enemy taunt before attacking
     * Considers: player HP, enemy HP, last player action, status effects
     * Uses enemy-specific dialogue if available, falls back to generic
     * Returns null ~40% of the time to avoid being repetitive
     */
    function getEnemyTaunt(context) {
        // 40% chance to skip taunt (keeps it from being annoying)
        if (Math.random() < 0.4) return null;

        context = context || {};
        var playerHPPercent = state.player.hp / state.player.maxHP;
        var enemyHPPercent = state.enemy.hp / state.enemy.maxHP;
        var candidates = [];

        // Priority-based taunt selection
        // Player is stunned/frozen - easy target
        if (context.playerAction === 'stunned') {
            candidates = getDialogueLines('attack_player_stunned');
        }
        // Player is low - enemy is confident
        else if (playerHPPercent <= 0.25) {
            candidates = getDialogueLines('attack_player_low_hp');
        }
        // Player just healed
        else if (context.playerAction === 'heal' || context.playerAction === 'item') {
            candidates = getDialogueLines('attack_player_healed');
        }
        // Player defended
        else if (context.playerAction === 'defend') {
            candidates = getDialogueLines('attack_player_defended');
        }
        // Player missed their attack
        else if (context.playerMissed) {
            candidates = getDialogueLines('attack_player_missed');
        }
        // Enemy got crit by player
        else if (context.playerCrit) {
            candidates = getDialogueLines('attack_got_crit');
        }
        // Enemy got hit
        else if (context.playerHit) {
            candidates = getDialogueLines('attack_got_hit');
        }
        // Enemy is low HP - desperation
        else if (enemyHPPercent <= 0.3) {
            candidates = getDialogueLines('attack_self_low_hp');
        }
        // Enemy has status effects
        else if (state.enemy.statuses && state.enemy.statuses.length > 0) {
            candidates = getDialogueLines('attack_has_status');
        }

        // Fallback to default if no contextual match
        if (!candidates || candidates.length === 0) {
            candidates = getDialogueLines('attack_default');
        }

        if (candidates.length === 0) return null;
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    // === Music Transition Thresholds ===
    var musicThresholds = {
        player_critical: { // Player below 25% HP
            threshold: 0.25,
            track: 'critical_hp.mp3',
            triggered: false
        },
        player_low: { // Player below 50% HP
            threshold: 0.50,
            track: 'low_hp.mp3',
            triggered: false
        },
        enemy_critical: { // Enemy below 25% HP
            threshold: 0.25,
            track: 'enemy_low.mp3',
            triggered: false
        }
    };

    // === Sound Cue Mapping ===
    // Maps battle events to sound effect files
    var soundCues = {
        // === Battle Flow ===
        battle_start: 'alert.ogg',        // Battle intro
        victory: 'victory.ogg',           // Player wins
        defeat: 'failure.ogg',            // Player loses
        flee_success: 'footstep.ogg',     // Successful escape
        flee_fail: 'negative.ogg',        // Failed escape attempt

        // === Attack Sounds ===
        attack_hit: 'thud.ogg',           // Generic attack lands
        attack_miss: 'negative.ogg',      // Attack misses
        attack_crit: 'success.ogg',       // Critical hit
        attack_fumble: 'failure.ogg',     // Critical fumble

        // === Type-specific Attack Sounds ===
        attack_physical: 'thud.ogg',
        attack_fire: 'zap.ogg',           // Fiery attack
        attack_ice: 'chain.ogg',          // Ice cracking
        attack_lightning: 'zap.ogg',      // Electric zap
        attack_poison: 'gulp.ogg',        // Poison drip
        attack_holy: 'success.ogg',       // Divine light
        attack_dark: 'warning.ogg',       // Dark energy
        attack_psychic: 'warning.ogg',    // Mental attack

        // === Defense/Recovery ===
        defend: 'click.ogg',              // Defend action
        heal: 'success.ogg',              // HP recovery
        mana_restore: 'click.ogg',        // MP recovery
        buff_apply: 'success.ogg',        // Positive status applied

        // === Status Effects ===
        status_burn: 'zap.ogg',           // Burn damage tick
        status_poison: 'gulp.ogg',        // Poison damage tick
        status_stun: 'warning.ogg',       // Stunned
        status_frozen: 'chain.ogg',       // Frozen
        status_bleed: 'thud.ogg',         // Bleed damage tick
        status_cure: 'success.ogg',       // Status cured
        status_expire: 'click.ogg',       // Status wears off

        // === Special Actions ===
        skill_use: 'click.ogg',           // Using a skill
        item_use: 'click.ogg',            // Using an item
        dice_roll: 'dice_roll.ogg',       // Rolling dice
        stagger: 'thud.ogg',              // Target staggered
        stagger_break: 'chain.ogg',       // Stagger meter full (stunned)

        // === Limit Break ===
        limit_ready: 'alert.ogg',         // Limit break ready
        limit_activate: 'zap.ogg',        // Using limit break

        // === Summons ===
        summon_appear: 'success.ogg',     // Summon appears
        summon_attack: 'thud.ogg',        // Summon attacks
        summon_expire: 'click.ogg',       // Summon leaves

        // === UI Feedback ===
        button_click: 'click.ogg',        // Menu selection
        error: 'negative.ogg',            // Invalid action
        turn_start: 'click.ogg'           // Turn begins (subtle)
    };

    /**
     * Play a battle sound cue
     * @param {string} cueKey - Key from soundCues map
     * @param {string} overrideFile - Optional override filename
     */
    function playSoundCue(cueKey, overrideFile) {
        var filename = overrideFile || soundCues[cueKey];
        if (filename) {
            playSfx(filename);
        }
    }

    // === State ===
    var state = {
        active: false,
        phase: 'player', // 'player', 'enemy', 'animating', 'ended'
        turn: 0,
        terrain: 'none',
        player: {
            name: 'Andy',
            hp: 20,
            maxHP: 20,
            mana: 20,
            maxMana: 20,
            ac: 10,           // Armor Class (to be hit)
            attackBonus: 2,   // Added to d20 roll
            damage: '1d6',    // Damage dice
            type: 'physical',
            defending: false,
            statuses: [],     // Active status effects: { type, duration, stacks }
            skills: ['power_strike', 'fireball', 'heal'],  // Available skills
            stagger: 0,       // Stagger meter (0-100)
            staggerThreshold: 100,
            limitCharge: 0,   // Limit Break charge (0-100)
            limitBreak: 'overdrive', // Current limit break ability
            passives: [],     // Array of passive ability IDs
            items: []         // Battle-usable items: { id, name, quantity }
        },
        enemy: {
            name: 'Enemy',
            hp: 20,
            maxHP: 20,
            ac: 12,
            attackBonus: 3,
            damage: '1d6',
            type: 'physical',
            sprite: null,
            moves: [],
            statuses: [],     // Active status effects
            stagger: 0,
            staggerThreshold: 80,
            ai: 'default',    // AI type: 'default', 'aggressive', 'defensive', 'support'
            passives: []      // Enemy passive abilities
        },
        summon: null,         // Active summon: { type, duration, ... }
        targets: {
            win: null,
            lose: null,
            flee: null
        },
        currentScene: null,
        battleLog: [],        // Full battle history
        dialogue: {           // Mid-fight dialogue state
            lastTrigger: null,
            cooldown: 0       // Turns until next dialogue can trigger
        },
        musicState: {         // Track music transition state
            currentTrack: null,
            playerLowTriggered: false,
            playerCriticalTriggered: false,
            enemyCriticalTriggered: false
        }
    };

    // Reference to main VN engine
    var vnEngine = null;

    // DOM elements cache
    var elements = {
        container: null,
        battleUI: null,
        playerHP: null,
        playerHPBar: null,
        playerHPText: null,
        playerMana: null,
        playerManaBar: null,
        playerManaText: null,
        enemyHP: null,
        enemyHPBar: null,
        enemyHPText: null,
        enemyLabel: null,
        battleLog: null,
        textBox: null
    };

    // === Initialization ===

    function init(engine) {
        vnEngine = engine;
        elements.container = document.getElementById('vn-container');
        elements.textBox = document.getElementById('text-box');
    }

    // === Dice Rolling ===

    /**
     * Roll a d20
     * @returns {number} - 1-20
     */
    function rollD20() {
        return Math.floor(Math.random() * 20) + 1;
    }

    /**
     * Roll damage dice (e.g., '1d6', '2d8+2')
     * @param {string} diceStr - Dice notation
     * @returns {number} - Total damage
     */
    function rollDamage(diceStr) {
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
        return Math.max(1, total);
    }

    // === Type Effectiveness ===

    function getTypeMultiplier(attackType, defenderType) {
        if (!attackType || !defenderType) return 1;
        var chart = typeChart[attackType];
        if (!chart) return 1;
        return chart[defenderType] !== undefined ? chart[defenderType] : 1;
    }

    function getEffectivenessMessage(multiplier) {
        if (multiplier >= 2) return "It's super effective!";
        if (multiplier === 0) return "It has no effect...";
        if (multiplier <= 0.5) return "It's not very effective...";
        return '';
    }

    // === Status Effect Management ===

    /**
     * Apply a status effect to a target
     * @param {object} target - player or enemy state object
     * @param {string} statusType - status effect type key
     * @param {number} stacks - number of stacks (for stackable effects)
     * @returns {object} - { applied, message }
     */
    function applyStatus(target, statusType, stacks) {
        var effectDef = statusEffects[statusType];
        if (!effectDef) return { applied: false, message: '' };

        stacks = stacks || 1;
        var existing = null;
        for (var i = 0; i < target.statuses.length; i++) {
            if (target.statuses[i].type === statusType) {
                existing = target.statuses[i];
                break;
            }
        }

        if (existing) {
            if (effectDef.stacks) {
                // Stackable effect - add stacks and refresh duration
                existing.stacks += stacks;
                existing.duration = Math.max(existing.duration, effectDef.duration);
                return {
                    applied: true,
                    message: effectDef.icon + ' ' + effectDef.name + ' x' + existing.stacks + '!'
                };
            } else {
                // Non-stackable - just refresh duration
                existing.duration = effectDef.duration;
                return {
                    applied: true,
                    message: effectDef.icon + ' ' + effectDef.name + ' refreshed!'
                };
            }
        } else {
            // New status
            target.statuses.push({
                type: statusType,
                duration: effectDef.duration,
                stacks: stacks
            });
            return {
                applied: true,
                message: effectDef.icon + ' Inflicted ' + effectDef.name + '!'
            };
        }
    }

    /**
     * Remove a status effect from target
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
     * Check if target has a status effect
     */
    function hasStatus(target, statusType) {
        for (var i = 0; i < target.statuses.length; i++) {
            if (target.statuses[i].type === statusType) {
                return target.statuses[i];
            }
        }
        return null;
    }

    /**
     * Get total AC bonus/penalty from status effects
     */
    function getStatusACModifier(target) {
        var modifier = 0;
        for (var i = 0; i < target.statuses.length; i++) {
            var status = target.statuses[i];
            var def = statusEffects[status.type];
            if (def && def.acBonus) {
                modifier += def.acBonus;
            }
        }
        return modifier;
    }

    /**
     * Get attack bonus from status effects
     */
    function getStatusAttackModifier(target) {
        var modifier = 0;
        for (var i = 0; i < target.statuses.length; i++) {
            var status = target.statuses[i];
            var def = statusEffects[status.type];
            if (def && def.attackBonus) {
                modifier += def.attackBonus;
            }
        }
        return modifier;
    }

    /**
     * Get damage bonus from status effects
     */
    function getStatusDamageModifier(target) {
        var modifier = 0;
        for (var i = 0; i < target.statuses.length; i++) {
            var status = target.statuses[i];
            var def = statusEffects[status.type];
            if (def && def.damageBonus) {
                modifier += def.damageBonus;
            }
        }
        return modifier;
    }

    /**
     * Check if target can act (not stunned/frozen)
     */
    function canAct(target) {
        for (var i = 0; i < target.statuses.length; i++) {
            var def = statusEffects[target.statuses[i].type];
            if (def && def.skipsTurn) {
                return false;
            }
        }
        return true;
    }

    /**
     * Process status effects at start of turn
     * @param {object} target - player or enemy
     * @param {string} targetName - name for messages
     * @returns {object} - { damage, heal, messages, canAct }
     */
    function tickStatuses(target, targetName) {
        var result = {
            damage: 0,
            heal: 0,
            messages: [],
            canAct: true
        };

        // Process terrain effects
        var terrain = terrainTypes[state.terrain];
        if (terrain && terrain.healPerTurn) {
            result.heal += terrain.healPerTurn;
            result.messages.push(terrain.icon + ' ' + targetName + ' heals from ' + terrain.name);
        }

        // Process each status effect
        for (var i = target.statuses.length - 1; i >= 0; i--) {
            var status = target.statuses[i];
            var def = statusEffects[status.type];
            if (!def) continue;

            // Damage over time
            if (def.damagePerTurn) {
                var dotDamage = def.damagePerTurn * (status.stacks || 1);
                result.damage += dotDamage;
                result.messages.push(def.icon + ' ' + targetName + ' takes ' + dotDamage + ' ' + def.name + ' damage!');
            }

            // Healing over time
            if (def.healPerTurn) {
                result.heal += def.healPerTurn;
                result.messages.push(def.icon + ' ' + targetName + ' recovers ' + def.healPerTurn + ' HP!');
            }

            // Check if skips turn
            if (def.skipsTurn) {
                result.canAct = false;
                result.messages.push(def.icon + ' ' + targetName + ' is ' + def.name.toLowerCase() + ' and cannot act!');
            }

            // Decrement duration
            status.duration--;
            if (status.duration <= 0) {
                target.statuses.splice(i, 1);
                result.messages.push(def.icon + ' ' + def.name + ' wore off!');
            }
        }

        return result;
    }

    /**
     * Try to apply status effect from a skill/attack
     */
    function tryApplyStatusFromSkill(skill, target, targetName) {
        if (!skill.statusEffect) return null;

        var statusInfo = skill.statusEffect;
        var baseChance = statusInfo.chance || 0;

        // Apply terrain bonus to status chance
        var terrain = terrainTypes[state.terrain];
        if (terrain && terrain.statusChanceBonus && terrain.statusChanceBonus[statusInfo.type]) {
            baseChance += terrain.statusChanceBonus[statusInfo.type];
        }

        // Roll for status
        if (Math.random() < baseChance) {
            var stacks = statusInfo.stacks || 1;
            var targetObj = statusInfo.target === 'self' ?
                (target === state.enemy ? state.player : state.enemy) : target;
            return applyStatus(targetObj, statusInfo.type, stacks);
        }

        return { applied: false, message: '' };
    }

    /**
     * Get terrain damage multiplier for attack type
     */
    function getTerrainMultiplier(attackType) {
        var terrain = terrainTypes[state.terrain];
        if (!terrain || !terrain.typeBonus) return 1;
        return terrain.typeBonus[attackType] || 1;
    }

    /**
     * Get terrain accuracy penalty
     */
    function getTerrainAccuracyPenalty() {
        var terrain = terrainTypes[state.terrain];
        if (!terrain) return 0;
        return terrain.accuracyPenalty || 0;
    }

    // === Stagger System ===

    /**
     * Add stagger to a target
     * @returns {boolean} - true if target became staggered
     */
    function addStagger(target, amount) {
        if (!amount || amount <= 0) return false;

        target.stagger = (target.stagger || 0) + amount;

        if (target.stagger >= (target.staggerThreshold || 100)) {
            target.stagger = 0;
            // Apply stun when staggered
            applyStatus(target, 'stun', 1);
            return true;
        }
        return false;
    }

    /**
     * Reduce stagger over time
     */
    function decayStagger(target, amount) {
        target.stagger = Math.max(0, (target.stagger || 0) - (amount || 10));
    }

    // === Item System ===

    /**
     * Get available battle items from inventory
     * Maps inventory items to battle item definitions
     */
    function getAvailableBattleItems() {
        var available = [];

        // Get items from VN engine inventory
        if (vnEngine && vnEngine.getInventory) {
            var inventory = vnEngine.getInventory();
            for (var i = 0; i < inventory.length; i++) {
                var itemName = inventory[i];
                // Convert item name to ID (lowercase, spaces to underscores)
                var itemId = itemName.toLowerCase().replace(/\s+/g, '_');
                var itemDef = battleItems[itemId];
                if (itemDef) {
                    // Check if already in available list
                    var found = false;
                    for (var j = 0; j < available.length; j++) {
                        if (available[j].id === itemId) {
                            available[j].quantity++;
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
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

        // Also include any items directly in battle state
        if (state.player.items) {
            for (var k = 0; k < state.player.items.length; k++) {
                var stateItem = state.player.items[k];
                var existsInAvailable = false;
                for (var l = 0; l < available.length; l++) {
                    if (available[l].id === stateItem.id) {
                        existsInAvailable = true;
                        break;
                    }
                }
                if (!existsInAvailable && stateItem.quantity > 0) {
                    var def = battleItems[stateItem.id];
                    if (def) {
                        available.push({
                            id: stateItem.id,
                            name: def.name,
                            icon: def.icon,
                            description: def.description,
                            quantity: stateItem.quantity,
                            def: def
                        });
                    }
                }
            }
        }

        return available;
    }

    /**
     * Use a battle item
     * @param {string} itemId - Item ID to use
     * @returns {object} - { success, messages, consumed }
     */
    function useBattleItem(itemId) {
        var itemDef = battleItems[itemId];
        if (!itemDef) {
            return { success: false, reason: 'unknown_item', messages: ['Unknown item!'] };
        }

        // Check if player has the item
        var hasItem = false;
        if (vnEngine && vnEngine.hasItem) {
            var itemName = itemDef.name;
            hasItem = vnEngine.hasItem(itemName);
        }

        // Also check battle state items
        if (!hasItem && state.player.items) {
            for (var i = 0; i < state.player.items.length; i++) {
                if (state.player.items[i].id === itemId && state.player.items[i].quantity > 0) {
                    hasItem = true;
                    break;
                }
            }
        }

        if (!hasItem) {
            return { success: false, reason: 'no_item', messages: ['You don\'t have this item!'] };
        }

        var messages = [];

        // Apply item effects
        if (itemDef.heals) {
            var oldHP = state.player.hp;
            state.player.hp = Math.min(state.player.maxHP, state.player.hp + itemDef.heals);
            var actualHeal = state.player.hp - oldHP;
            if (actualHeal > 0) {
                messages.push('Restored ' + actualHeal + ' HP!');
                showDamageNumber(actualHeal, 'player', 'heal');
            }
            updatePlayerHPDisplay();
        }

        if (itemDef.restoresMana) {
            var oldMana = state.player.mana;
            state.player.mana = Math.min(state.player.maxMana, state.player.mana + itemDef.restoresMana);
            var actualMana = state.player.mana - oldMana;
            if (actualMana > 0) {
                messages.push('Restored ' + actualMana + ' MP!');
            }
            updatePlayerManaDisplay();
        }

        if (itemDef.curesStatus) {
            var removed = removeStatus(state.player, itemDef.curesStatus);
            if (removed) {
                var statusDef = statusEffects[itemDef.curesStatus];
                messages.push('Cured ' + (statusDef ? statusDef.name : itemDef.curesStatus) + '!');
                updateStatusDisplay();
            }
        }

        if (itemDef.appliesStatus) {
            var statusResult = applyStatus(state.player, itemDef.appliesStatus, 1);
            if (statusResult.applied) {
                messages.push(statusResult.message);
                updateStatusDisplay();
            }
        }

        // Consume the item
        if (itemDef.consumable) {
            if (vnEngine && vnEngine.removeItem) {
                vnEngine.removeItem(itemDef.name);
            }
            // Also decrement from battle state
            if (state.player.items) {
                for (var j = 0; j < state.player.items.length; j++) {
                    if (state.player.items[j].id === itemId) {
                        state.player.items[j].quantity--;
                        if (state.player.items[j].quantity <= 0) {
                            state.player.items.splice(j, 1);
                        }
                        break;
                    }
                }
            }
        }

        playSfx('success.ogg');

        return {
            success: true,
            messages: messages,
            consumed: itemDef.consumable
        };
    }

    // === Summon System ===

    /**
     * Summon a companion to fight alongside player
     * @param {string} summonId - Summon type ID
     * @returns {object} - { success, summon, message }
     */
    function createSummon(summonId) {
        var summonDef = summonTypes[summonId];
        if (!summonDef) {
            return { success: false, reason: 'unknown_summon' };
        }

        // Only one summon at a time
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

        // Show summon dialogue
        triggerDialogue('summon_appears');

        // Update UI to show summon
        updateSummonDisplay();

        playSfx('success.ogg');

        return {
            success: true,
            summon: state.summon,
            message: summonDef.icon + ' ' + summonDef.name + ' appears!'
        };
    }

    /**
     * Process summon action at end of player turn
     * @returns {object} - { acted, messages, attackResult }
     */
    function processSummonTurn() {
        if (!state.summon) return { acted: false, messages: [] };

        var messages = [];
        var result = { acted: true, messages: messages };

        // Summon heals player if it has healPerTurn
        if (state.summon.healPerTurn > 0) {
            var oldHP = state.player.hp;
            state.player.hp = Math.min(state.player.maxHP, state.player.hp + state.summon.healPerTurn);
            var healed = state.player.hp - oldHP;
            if (healed > 0) {
                messages.push(state.summon.icon + ' ' + state.summon.name + ' heals you for ' + healed + ' HP!');
                showDamageNumber(healed, 'player', 'heal');
                updatePlayerHPDisplay();
            }
        }

        // Summon attacks if it has an attack
        if (state.summon.attack) {
            var attackResult = resolveAttack(
                { attackBonus: 2, damage: state.summon.attack.damage },
                state.enemy,
                state.summon.attack
            );

            if (attackResult.hit) {
                state.enemy.hp = Math.max(0, state.enemy.hp - attackResult.damage);
                messages.push(state.summon.icon + ' ' + state.summon.name + ' uses ' +
                    state.summon.attack.name + ' for ' + attackResult.damage + ' damage!');
                flashEnemy();
                showDamageNumber(attackResult.damage, 'enemy', 'damage');
                updateEnemyHPDisplay();

                // Apply status from summon attack
                if (attackResult.statusResult && attackResult.statusResult.applied) {
                    messages.push(attackResult.statusResult.message);
                    updateStatusDisplay();
                }
            } else {
                messages.push(state.summon.icon + ' ' + state.summon.name + '\'s ' +
                    state.summon.attack.name + ' missed!');
            }

            result.attackResult = attackResult;
        }

        // Decrement duration
        state.summon.duration--;
        if (state.summon.duration <= 0) {
            messages.push(state.summon.icon + ' ' + state.summon.name + ' fades away...');
            state.summon = null;
        }

        updateSummonDisplay();

        return result;
    }

    /**
     * Dismiss active summon early
     */
    function dismissSummon() {
        if (!state.summon) return false;

        var name = state.summon.name;
        var icon = state.summon.icon;
        state.summon = null;
        updateSummonDisplay();

        return { dismissed: true, message: icon + ' ' + name + ' was dismissed.' };
    }

    /**
     * Update summon display in UI
     */
    function updateSummonDisplay() {
        var summonContainer = document.getElementById('summon-indicator');

        if (!state.summon) {
            if (summonContainer) {
                summonContainer.style.display = 'none';
            }
            return;
        }

        if (!summonContainer && elements.container) {
            summonContainer = document.createElement('div');
            summonContainer.id = 'summon-indicator';
            summonContainer.className = 'summon-indicator';
            elements.container.appendChild(summonContainer);
        }

        if (summonContainer) {
            summonContainer.style.display = 'block';
            summonContainer.innerHTML = '<span class="summon-icon">' + state.summon.icon + '</span> ' +
                state.summon.name + ' <span class="summon-duration">(' + state.summon.duration + ' turns)</span>';
            summonContainer.title = summonTypes[state.summon.id] ?
                summonTypes[state.summon.id].description : '';
        }
    }

    // === Passive System ===

    /**
     * Get total passive bonuses for a target
     * @param {object} target - player or enemy state
     * @returns {object} - { acBonus, attackBonus, damageBonus, healPerTurn, manaPerTurn, ... }
     */
    function getPassiveBonuses(target) {
        var bonuses = {
            acBonus: 0,
            attackBonus: 0,
            damageBonus: 0,
            healPerTurn: 0,
            manaPerTurn: 0,
            lifesteal: 0,
            reflectDamage: 0,
            critRange: 20, // Default crit on 20 only
            damageReduction: 0
        };

        if (!target.passives) return bonuses;

        for (var i = 0; i < target.passives.length; i++) {
            var passiveId = target.passives[i];
            var passive = passiveTypes[passiveId];
            if (!passive) continue;

            if (passive.acBonus) bonuses.acBonus += passive.acBonus;
            if (passive.attackBonus) bonuses.attackBonus += passive.attackBonus;
            if (passive.healPerTurn) bonuses.healPerTurn += passive.healPerTurn;
            if (passive.manaPerTurn) bonuses.manaPerTurn += passive.manaPerTurn;
            if (passive.lifesteal) bonuses.lifesteal += passive.lifesteal;
            if (passive.reflectDamage) bonuses.reflectDamage += passive.reflectDamage;
            if (passive.critRange) bonuses.critRange = Math.min(bonuses.critRange, passive.critRange);
            if (passive.damageReduction) bonuses.damageReduction += passive.damageReduction;

            // Check HP-based bonuses
            var hpPercent = target.hp / target.maxHP;
            if (passive.lowHPDamageBonus && hpPercent <= passive.lowHPThreshold) {
                bonuses.damageBonus += passive.lowHPDamageBonus;
            }
            if (passive.lowHPAttackBonus && hpPercent <= passive.lowHPThreshold) {
                bonuses.attackBonus += passive.lowHPAttackBonus;
            }
        }

        // Add summon passive bonuses to player
        if (target === state.player && state.summon && state.summon.passive) {
            var summonPassive = state.summon.passive;
            if (summonPassive.type === 'ac_bonus') {
                bonuses.acBonus += summonPassive.value;
            }
        }

        return bonuses;
    }

    /**
     * Apply passive effects at start of turn
     * @param {object} target - player or enemy
     * @param {string} targetName - name for messages
     * @returns {object} - { messages, healed, manaRestored }
     */
    function applyPassiveEffects(target, targetName) {
        var result = { messages: [], healed: 0, manaRestored: 0 };
        var bonuses = getPassiveBonuses(target);

        if (bonuses.healPerTurn > 0) {
            var oldHP = target.hp;
            target.hp = Math.min(target.maxHP, target.hp + bonuses.healPerTurn);
            result.healed = target.hp - oldHP;
            if (result.healed > 0) {
                result.messages.push('💚 ' + targetName + ' recovers ' + result.healed + ' HP from passive!');
            }
        }

        if (target === state.player && bonuses.manaPerTurn > 0) {
            var oldMana = target.mana;
            target.mana = Math.min(target.maxMana, target.mana + bonuses.manaPerTurn);
            result.manaRestored = target.mana - oldMana;
            if (result.manaRestored > 0) {
                result.messages.push('💙 ' + targetName + ' recovers ' + result.manaRestored + ' MP from passive!');
            }
        }

        return result;
    }

    // === Limit Break System ===

    /**
     * Add charge to limit break meter
     * @param {number} amount - Charge to add
     */
    function addLimitCharge(amount) {
        var oldCharge = state.player.limitCharge;
        state.player.limitCharge = Math.min(100, state.player.limitCharge + amount);

        // Check if limit just became ready
        if (oldCharge < 100 && state.player.limitCharge >= 100) {
            triggerDialogue('limit_ready');
            playSfx('alert.ogg');
        }

        updateLimitDisplay();
    }

    /**
     * Check if limit break is ready
     */
    function isLimitReady() {
        return state.player.limitCharge >= 100;
    }

    /**
     * Execute limit break
     * @returns {object} - { success, damage, messages, attackResult }
     */
    function executeLimitBreak() {
        if (!isLimitReady()) {
            return { success: false, reason: 'not_ready' };
        }

        var limitId = state.player.limitBreak || 'overdrive';
        var limitDef = limitBreaks[limitId];
        if (!limitDef) {
            return { success: false, reason: 'unknown_limit' };
        }

        state.phase = 'animating';

        // Reset charge
        state.player.limitCharge = 0;
        updateLimitDisplay();

        var messages = [];
        var totalDamage = 0;
        var hits = limitDef.hits || 1;

        messages.push(limitDef.icon + ' ' + state.player.name + ' uses ' + limitDef.name + '!');

        // Play limit break animation
        playLimitBreakAnimation(limitId);
        playSfx('victory.ogg');

        // Execute hits
        for (var i = 0; i < hits; i++) {
            var attackResult;

            if (limitDef.ignoresAC) {
                // Auto-hit, just roll damage
                var damage = rollDamage(limitDef.damage);

                // Apply type effectiveness
                var multiplier = getTypeMultiplier(limitDef.type, state.enemy.type);
                damage = Math.floor(damage * multiplier);

                totalDamage += damage;
                state.enemy.hp = Math.max(0, state.enemy.hp - damage);

                if (hits > 1) {
                    messages.push('Hit ' + (i + 1) + ': ' + damage + ' damage!');
                }
            } else {
                // Normal attack resolution
                attackResult = resolveAttack(state.player, state.enemy, {
                    name: limitDef.name,
                    damage: limitDef.damage,
                    type: limitDef.type,
                    statusEffect: limitDef.statusEffect
                });

                if (attackResult.hit) {
                    // For scaling damage limits (Last Stand)
                    if (limitDef.scalingDamage) {
                        var missingHPPercent = 1 - (state.player.hp / state.player.maxHP);
                        attackResult.damage = Math.floor(attackResult.damage * (1 + missingHPPercent * 3));
                    }

                    totalDamage += attackResult.damage;
                    state.enemy.hp = Math.max(0, state.enemy.hp - attackResult.damage);

                    if (hits > 1) {
                        messages.push('Hit ' + (i + 1) + ': ' + attackResult.damage + ' damage!');
                    }
                } else {
                    messages.push('Hit ' + (i + 1) + ' missed!');
                }
            }
        }

        // Apply total damage visuals
        flashEnemy();
        showDamageNumber(totalDamage, 'enemy', 'damage');
        updateEnemyHPDisplay();

        // Apply status effect
        if (limitDef.statusEffect) {
            var statusResult = tryApplyStatusFromSkill(
                { statusEffect: limitDef.statusEffect },
                state.enemy,
                state.enemy.name
            );
            if (statusResult && statusResult.applied) {
                messages.push(statusResult.message);
                updateStatusDisplay();
            }
        }

        // Self heal if applicable
        if (limitDef.selfHeal) {
            var oldHP = state.player.hp;
            state.player.hp = Math.min(state.player.maxHP, state.player.hp + limitDef.selfHeal);
            var healed = state.player.hp - oldHP;
            if (healed > 0) {
                messages.push('Recovered ' + healed + ' HP!');
                showDamageNumber(healed, 'player', 'heal');
                updatePlayerHPDisplay();
            }
        }

        messages.push('Total: ' + totalDamage + ' damage!');

        return {
            success: true,
            damage: totalDamage,
            messages: messages
        };
    }

    /**
     * Update limit break meter display
     */
    function updateLimitDisplay() {
        // Use cached elements from the unified stats panel
        var limitBar = elements.limitBar || document.getElementById('limit-bar');
        var limitText = elements.limitText || document.getElementById('limit-text');

        if (limitBar) {
            var percent = state.player.limitCharge;
            limitBar.style.width = percent + '%';

            if (percent >= 100) {
                limitBar.className = 'stat-bar limit-bar limit-ready';
            } else if (percent >= 75) {
                limitBar.className = 'stat-bar limit-bar limit-high';
            } else {
                limitBar.className = 'stat-bar limit-bar';
            }
        }

        if (limitText) {
            limitText.textContent = Math.floor(state.player.limitCharge) + '%';
        }
    }

    /**
     * Play limit break visual effect
     */
    function playLimitBreakAnimation(limitId) {
        if (!elements.container) return;

        var effect = document.createElement('div');
        effect.className = 'limit-break-effect';
        effect.innerHTML = '<div class="limit-break-text">' +
            (limitBreaks[limitId] ? limitBreaks[limitId].icon + ' ' + limitBreaks[limitId].name : 'LIMIT BREAK') +
            '</div>';

        elements.container.appendChild(effect);

        setTimeout(function() {
            if (effect.parentNode) {
                effect.parentNode.removeChild(effect);
            }
        }, config.timing.uiTransition);
    }

    // === Mid-Fight Dialogue System ===

    /**
     * Trigger mid-fight dialogue based on event
     * @param {string} trigger - Dialogue trigger type
     * @param {object} context - Optional context data
     * @returns {string|null} - Dialogue line or null
     */
    function triggerDialogue(trigger, context) {
        // Check cooldown
        if (state.dialogue.cooldown > 0) {
            return null;
        }

        // Don't repeat same trigger too soon
        if (state.dialogue.lastTrigger === trigger) {
            return null;
        }

        var lines = dialogueTriggers[trigger];
        if (!lines || lines.length === 0) {
            return null;
        }

        // Pick random line
        var line = lines[Math.floor(Math.random() * lines.length)];

        // Set cooldown (2 turns between dialogues)
        state.dialogue.cooldown = 2;
        state.dialogue.lastTrigger = trigger;

        // Show dialogue in UI
        showBattleDialogue(line);

        return line;
    }

    /**
     * Show dialogue bubble in battle UI
     */
    function showBattleDialogue(text) {
        if (!elements.container) return;

        // Remove existing dialogue
        var existing = document.getElementById('battle-dialogue');
        if (existing) existing.remove();

        var dialogue = document.createElement('div');
        dialogue.id = 'battle-dialogue';
        dialogue.className = 'battle-dialogue';
        dialogue.innerHTML = '<div class="dialogue-bubble">' + text + '</div>';

        elements.container.appendChild(dialogue);

        // Auto-remove after delay
        setTimeout(function() {
            if (dialogue.parentNode) {
                dialogue.classList.add('fade-out');
                setTimeout(function() {
                    if (dialogue.parentNode) {
                        dialogue.parentNode.removeChild(dialogue);
                    }
                }, config.timing.fadeOutDuration);
            }
        }, config.timing.dialogueDuration);
    }

    /**
     * Check for dialogue triggers based on current state
     */
    function checkDialogueTriggers(event, context) {
        // Decrease cooldown
        if (state.dialogue.cooldown > 0) {
            state.dialogue.cooldown--;
        }

        // Check HP-based triggers
        var playerHPPercent = state.player.hp / state.player.maxHP;
        var enemyHPPercent = state.enemy.hp / state.enemy.maxHP;

        if (event === 'player_hit' && playerHPPercent <= 0.15) {
            triggerDialogue('player_very_low_hp');
        } else if (event === 'player_hit' && playerHPPercent <= 0.35) {
            triggerDialogue('player_low_hp');
        } else if (event === 'enemy_hit' && enemyHPPercent <= 0.25) {
            triggerDialogue('enemy_low_hp');
        } else if (event === 'player_crit') {
            triggerDialogue('player_crit');
        } else if (event === 'player_fumble') {
            triggerDialogue('player_fumble');
        } else if (event === 'enemy_crit') {
            triggerDialogue('enemy_crit');
        } else if (event === 'status_applied' && context && context.status) {
            triggerDialogue('status_' + context.status);
        }
    }

    // === Music Transition System ===

    /**
     * Check HP thresholds and transition music if needed
     */
    function checkMusicTransitions() {
        if (!vnEngine || !vnEngine.playMusic) return;

        var playerHPPercent = state.player.hp / state.player.maxHP;
        var enemyHPPercent = state.enemy.hp / state.enemy.maxHP;

        // Player critical HP (highest priority)
        if (playerHPPercent <= 0.25 && !state.musicState.playerCriticalTriggered) {
            state.musicState.playerCriticalTriggered = true;
            // Only change if we have the track
            if (musicThresholds.player_critical.track) {
                vnEngine.playMusic(musicThresholds.player_critical.track);
            }
            return;
        }

        // Player low HP
        if (playerHPPercent <= 0.50 && !state.musicState.playerLowTriggered &&
            !state.musicState.playerCriticalTriggered) {
            state.musicState.playerLowTriggered = true;
            if (musicThresholds.player_low.track) {
                vnEngine.playMusic(musicThresholds.player_low.track);
            }
            return;
        }

        // Enemy critical HP (victory is near!)
        if (enemyHPPercent <= 0.25 && !state.musicState.enemyCriticalTriggered &&
            !state.musicState.playerCriticalTriggered) {
            state.musicState.enemyCriticalTriggered = true;
            if (musicThresholds.enemy_critical.track) {
                vnEngine.playMusic(musicThresholds.enemy_critical.track);
            }
        }
    }

    /**
     * Set custom music tracks for battle transitions
     */
    function setMusicTracks(tracks) {
        if (tracks.playerLow) musicThresholds.player_low.track = tracks.playerLow;
        if (tracks.playerCritical) musicThresholds.player_critical.track = tracks.playerCritical;
        if (tracks.enemyCritical) musicThresholds.enemy_critical.track = tracks.enemyCritical;
    }

    // === Attack Resolution ===

    /**
     * Resolve an attack with d20 roll
     * @param {object} attacker - Attacker stats
     * @param {object} defender - Defender stats
     * @param {object} move - Move being used { name, damage, type, attackBonus, statusEffect, staggerDamage }
     * @returns {object} - { hit, roll, damage, isCrit, isFumble, multiplier, message, statusResult, staggered }
     */
    function resolveAttack(attacker, defender, move) {
        var roll = rollD20();

        // Calculate attack bonus including status effects
        var baseAttackBonus = (move && move.attackBonus !== undefined) ? move.attackBonus : attacker.attackBonus;
        var statusAttackBonus = getStatusAttackModifier(attacker);
        var terrainPenalty = getTerrainAccuracyPenalty();
        var attackBonus = baseAttackBonus + statusAttackBonus - terrainPenalty;
        var attackTotal = roll + attackBonus;

        var isCrit = roll === 20;
        var isFumble = roll === 1;

        // Calculate target AC including status effects and defending
        var statusACMod = getStatusACModifier(defender);
        var targetAC = defender.ac + (defender.defending ? 4 : 0) + statusACMod;
        var hit = isCrit || (!isFumble && attackTotal >= targetAC);

        var result = {
            hit: hit,
            roll: roll,
            attackBonus: attackBonus,
            total: attackTotal,
            targetAC: targetAC,
            isCrit: isCrit,
            isFumble: isFumble,
            damage: 0,
            multiplier: 1,
            terrainMultiplier: 1,
            message: '',
            statusResult: null,
            staggered: false
        };

        if (hit) {
            // Roll damage
            var damageStr = (move && move.damage) ? move.damage : attacker.damage;
            result.damage = rollDamage(damageStr);

            // Add status damage bonus
            var statusDamageBonus = getStatusDamageModifier(attacker);
            result.damage += statusDamageBonus;

            // Apply type effectiveness
            var attackType = (move && move.type) ? move.type : 'physical';
            result.multiplier = getTypeMultiplier(attackType, defender.type);
            result.damage = Math.floor(result.damage * result.multiplier);

            // Apply terrain multiplier
            result.terrainMultiplier = getTerrainMultiplier(attackType);
            result.damage = Math.floor(result.damage * result.terrainMultiplier);

            // Critical hit doubles damage
            if (isCrit) {
                result.damage *= 2;
            }

            result.damage = Math.max(1, result.damage);
            result.message = getEffectivenessMessage(result.multiplier);

            // Terrain effectiveness message
            if (result.terrainMultiplier > 1) {
                result.message += (result.message ? ' ' : '') + 'Terrain boosts the attack!';
            } else if (result.terrainMultiplier < 1) {
                result.message += (result.message ? ' ' : '') + 'Terrain weakens the attack...';
            }

            // Try to apply status effect from move
            if (move && move.statusEffect) {
                result.statusResult = tryApplyStatusFromSkill(move, defender, defender.name);
            }

            // Apply stagger damage
            var staggerAmount = (move && move.staggerDamage) || Math.ceil(result.damage / 2);
            result.staggered = addStagger(defender, staggerAmount);
        }

        return result;
    }

    // === Battle Start/End ===

    function start(battleConfig, sceneId) {
        var enemy = battleConfig.enemy || {};

        // Support loading enemy by ID from enemies.js
        if (battleConfig.enemy_id && typeof enemies !== 'undefined' && enemies[battleConfig.enemy_id]) {
            var enemyData = enemies[battleConfig.enemy_id];
            // Merge enemy data - inline config overrides file data
            enemy = Object.assign({}, enemyData, enemy);
            // Store enemy ID for dialogue lookup
            enemy.id = battleConfig.enemy_id;
        }

        // Initialize player stats
        if (state.player.hp === null || state.player.hp <= 0) {
            state.player.maxHP = battleConfig.player_max_hp || 20;
            state.player.hp = state.player.maxHP;
        }
        if (state.player.mana === null) {
            state.player.maxMana = battleConfig.player_max_mana || 20;
            state.player.mana = state.player.maxMana;
        }

        state.player.ac = battleConfig.player_ac || 10;
        state.player.attackBonus = battleConfig.player_attack_bonus || 2;
        state.player.damage = battleConfig.player_damage || '1d6';
        state.player.type = battleConfig.player_type || 'physical';
        state.player.defending = false;
        state.player.statuses = [];
        state.player.stagger = 0;
        state.player.staggerThreshold = battleConfig.player_stagger_threshold || 100;

        // Initialize limit break charge (persists across battles unless reset)
        if (state.player.limitCharge === undefined) {
            state.player.limitCharge = 0;
        }
        state.player.limitBreak = battleConfig.player_limit_break || 'overdrive';

        // Set player passives
        state.player.passives = battleConfig.player_passives || [];

        // Initialize battle items from inventory
        state.player.items = [];

        // Set player skills
        if (battleConfig.player_skills) {
            state.player.skills = battleConfig.player_skills;
        } else {
            state.player.skills = ['power_strike', 'fireball', 'heal', 'fortify'];
        }

        // Set enemy stats
        state.enemy = {
            id: enemy.id || null,
            name: enemy.name || 'Enemy',
            hp: enemy.hp || 20,
            maxHP: enemy.hp || 20,
            ac: enemy.ac || 12,
            attackBonus: enemy.attack_bonus || 3,
            damage: enemy.damage || '1d6',
            type: enemy.type || 'physical',
            sprite: enemy.sprite || null,
            statuses: [],
            stagger: 0,
            staggerThreshold: enemy.stagger_threshold || 80,
            ai: enemy.ai || 'default',
            moves: enemy.moves || [
                { name: 'Attack', damage: '1d6', type: 'physical' }
            ],
            passives: enemy.passives || [],
            dialogue: enemy.dialogue || null,  // Enemy-specific dialogue from enemies.js
            summons: enemy.summons || null     // Enemy summon abilities
        };

        // Set terrain
        state.terrain = battleConfig.terrain || 'none';

        // Set targets
        state.targets = {
            win: battleConfig.win_target,
            lose: battleConfig.lose_target,
            flee: battleConfig.flee_target || null
        };

        // Reset summon
        state.summon = null;

        // Reset dialogue state
        state.dialogue = {
            lastTrigger: null,
            cooldown: 0
        };

        // Reset music state
        state.musicState = {
            currentTrack: null,
            playerLowTriggered: false,
            playerCriticalTriggered: false,
            enemyCriticalTriggered: false
        };

        // Set custom music tracks if provided
        if (battleConfig.music_tracks) {
            setMusicTracks(battleConfig.music_tracks);
        }

        state.currentScene = sceneId;
        state.active = true;
        state.phase = 'animating'; // Start in animating phase during intro
        state.turn = 1;
        state.battleLog = [];

        // Show battle intro transition
        showBattleIntro(function() {
            // After intro, show battle UI and start combat
            showUI();
            updateDisplay();
            updateLimitDisplay();
            updateSummonDisplay();

            // Switch to player phase
            state.phase = 'player';

            // Trigger battle start dialogue
            triggerDialogue('battle_start');

            // Trigger callback to render choices (engine registers this)
            if (typeof state.onBattleReady === 'function') {
                state.onBattleReady();
            }
        });

        return state;
    }

    /**
     * Show battle intro transition with screen dim and announcement
     * @param {function} callback - Called when intro animation completes
     */
    function showBattleIntro(callback) {
        if (!elements.container) {
            elements.container = document.getElementById('vn-container');
        }
        if (!elements.container) {
            if (callback) callback();
            return;
        }

        // Hide text box during intro
        hideTextBox();

        // Play battle start SFX
        playSoundCue('battle_start');

        // Create intro overlay
        var overlay = document.createElement('div');
        overlay.className = 'battle-intro-overlay';
        overlay.id = 'battle-intro-overlay';

        // Create "BATTLE START" text
        var text = document.createElement('div');
        text.className = 'battle-intro-text';
        text.textContent = 'Battle Start!';
        overlay.appendChild(text);

        // Create flash effect
        var flash = document.createElement('div');
        flash.className = 'battle-intro-flash';
        flash.id = 'battle-intro-flash';

        // Add enemy slide-in animation to sprite layer
        var spriteLayer = document.getElementById('sprite-layer');
        if (spriteLayer) {
            spriteLayer.classList.add('battle-intro-enemy');
        }

        // Add elements to container
        elements.container.appendChild(flash);
        elements.container.appendChild(overlay);

        // Clean up after animation completes
        setTimeout(function() {
            // Remove intro elements
            var introOverlay = document.getElementById('battle-intro-overlay');
            if (introOverlay && introOverlay.parentNode) {
                introOverlay.parentNode.removeChild(introOverlay);
            }
            var introFlash = document.getElementById('battle-intro-flash');
            if (introFlash && introFlash.parentNode) {
                introFlash.parentNode.removeChild(introFlash);
            }

            // Remove slide-in class from sprite layer
            if (spriteLayer) {
                spriteLayer.classList.remove('battle-intro-enemy');
            }

            // Call callback to start battle
            if (callback) callback();
        }, config.timing.damageNumberDuration);
    }

    function end(result) {
        state.active = false;
        state.phase = 'ended';

        var target = null;

        switch (result) {
            case 'win':
                target = state.targets.win;
                break;
            case 'lose':
                target = state.targets.lose;
                break;
            case 'flee':
                target = state.targets.flee;
                break;
        }

        // Show battle outro transition
        showBattleOutro(result, function() {
            hideUI();
            showTextBox(); // Restore text box
            if (target && vnEngine && vnEngine.loadScene) {
                vnEngine.loadScene(target);
            }
        });
    }

    /**
     * Show battle outro transition (victory/defeat/flee)
     * @param {string} result - 'win', 'lose', or 'flee'
     * @param {function} callback - Called when outro animation completes
     */
    function showBattleOutro(result, callback) {
        if (!elements.container) {
            elements.container = document.getElementById('vn-container');
        }
        if (!elements.container) {
            if (callback) callback();
            return;
        }

        // Determine text and styles based on result
        var mainText = '';
        var subText = '';
        var overlayClass = '';
        var soundCueKey = '';
        var spriteClass = '';

        switch (result) {
            case 'win':
                mainText = 'Victory!';
                subText = state.enemy.name + ' was defeated!';
                overlayClass = 'victory';
                soundCueKey = 'victory';
                spriteClass = 'battle-outro-victory';
                break;
            case 'lose':
                mainText = 'Defeated';
                subText = 'You were overwhelmed...';
                overlayClass = 'defeat';
                soundCueKey = 'defeat';
                spriteClass = 'battle-outro-defeat';
                break;
            case 'flee':
                mainText = 'Escaped!';
                subText = 'Got away safely...';
                overlayClass = 'flee';
                soundCueKey = 'flee_success';
                spriteClass = '';
                break;
        }

        // Play result SFX
        playSoundCue(soundCueKey);

        // Add sprite animation class
        var spriteLayer = document.getElementById('sprite-layer');
        if (spriteLayer && spriteClass) {
            spriteLayer.classList.add(spriteClass);
        }

        // Create outro overlay
        var overlay = document.createElement('div');
        overlay.className = 'battle-outro-overlay ' + overlayClass;
        overlay.id = 'battle-outro-overlay';

        // Create main text
        var textEl = document.createElement('div');
        textEl.className = 'battle-outro-text ' + overlayClass;
        textEl.textContent = mainText;
        overlay.appendChild(textEl);

        // Create subtext
        var subEl = document.createElement('div');
        subEl.className = 'battle-outro-subtext';
        subEl.textContent = subText;
        overlay.appendChild(subEl);

        // Add overlay to container
        elements.container.appendChild(overlay);

        // Create victory sparkles for win result
        if (result === 'win') {
            createVictorySparkles(overlay);
        }

        // Trigger victory/defeat dialogue
        if (result === 'win') {
            triggerDialogue('victory');
        } else if (result === 'lose') {
            triggerDialogue('defeat');
        }

        // Clean up after animation (2.5 seconds for outro)
        setTimeout(function() {
            // Remove outro overlay
            var outroOverlay = document.getElementById('battle-outro-overlay');
            if (outroOverlay && outroOverlay.parentNode) {
                outroOverlay.parentNode.removeChild(outroOverlay);
            }

            // Remove sprite animation class
            if (spriteLayer && spriteClass) {
                spriteLayer.classList.remove(spriteClass);
            }

            // Call callback to transition to next scene
            if (callback) callback();
        }, config.timing.battleOutro);
    }

    /**
     * Create floating sparkle effects for victory screen
     * @param {HTMLElement} container - Container element to add sparkles to
     */
    function createVictorySparkles(container) {
        var sparkleCount = 12;
        for (var i = 0; i < sparkleCount; i++) {
            (function(index) {
                setTimeout(function() {
                    var sparkle = document.createElement('div');
                    sparkle.className = 'victory-sparkle';
                    sparkle.style.left = (Math.random() * 80 + 10) + '%';
                    sparkle.style.top = (Math.random() * 40 + 40) + '%';
                    sparkle.style.animationDelay = (Math.random() * 0.5) + 's';
                    container.appendChild(sparkle);

                    // Remove sparkle after animation
                    setTimeout(function() {
                        if (sparkle.parentNode) {
                            sparkle.parentNode.removeChild(sparkle);
                        }
                    }, config.timing.sparkleLifetime);
                }, index * config.timing.sparkleInterval);
            })(i);
        }
    }

    function reset() {
        state.active = false;
        state.phase = 'player';
        state.turn = 0;
        state.terrain = 'none';
        state.battleLog = [];
        state.player.hp = null;
        state.player.mana = null;
        state.player.defending = false;
        state.player.statuses = [];
        state.player.stagger = 0;
        state.enemy = {
            name: 'Enemy',
            hp: 20,
            maxHP: 20,
            ac: 12,
            attackBonus: 3,
            damage: '1d6',
            type: 'physical',
            sprite: null,
            moves: [],
            statuses: [],
            stagger: 0,
            staggerThreshold: 80,
            ai: 'default'
        };
        hideUI();
        destroyUI();
        showTextBox();
    }

    // === UI Management ===

    function hideTextBox() {
        if (!elements.textBox) {
            elements.textBox = document.getElementById('text-box');
        }
        if (elements.textBox) {
            elements.textBox.classList.add('battle-mode');
        }
    }

    function showTextBox() {
        if (!elements.textBox) {
            elements.textBox = document.getElementById('text-box');
        }
        if (elements.textBox) {
            elements.textBox.classList.remove('battle-mode');
        }
    }

    function showUI() {
        if (!elements.container) {
            elements.container = document.getElementById('vn-container');
        }
        if (!elements.container) return;

        // Hide normal text box during battle
        hideTextBox();

        // Create battle UI container
        if (!document.getElementById('battle-ui')) {
            var battleUI = document.createElement('div');
            battleUI.id = 'battle-ui';
            battleUI.className = 'battle-ui';

            // Terrain indicator (top center)
            var terrainIndicator = document.createElement('div');
            terrainIndicator.id = 'terrain-indicator';
            terrainIndicator.className = 'terrain-indicator';

            // === PLAYER STATS PANEL (unified HP/MP/Limit/Status) ===
            var playerStats = document.createElement('div');
            playerStats.id = 'player-stats-panel';
            playerStats.className = 'battle-stats-panel player-stats';
            playerStats.innerHTML =
                '<div class="stats-header">' + state.player.name + ' <span id="player-ac-display" class="ac-display">(AC ' + state.player.ac + ')</span></div>' +
                '<div class="stat-row hp-row">' +
                    '<span class="stat-label">HP</span>' +
                    '<div class="stat-bar-outer"><div id="player-hp-bar" class="stat-bar hp-bar hp-high"></div></div>' +
                    '<span id="player-hp-text" class="stat-value"></span>' +
                '</div>' +
                '<div class="stat-row mp-row">' +
                    '<span class="stat-label">MP</span>' +
                    '<div class="stat-bar-outer"><div id="player-mana-bar" class="stat-bar mana-bar"></div></div>' +
                    '<span id="player-mana-text" class="stat-value"></span>' +
                '</div>' +
                '<div class="stat-row limit-row">' +
                    '<span class="stat-label limit-label">LB</span>' +
                    '<div class="stat-bar-outer"><div id="limit-bar" class="stat-bar limit-bar"></div></div>' +
                    '<span id="limit-text" class="stat-value">0%</span>' +
                '</div>' +
                '<div id="player-stagger-container" class="stagger-container">' +
                    '<div id="player-stagger-bar" class="stagger-bar"><div id="player-stagger-fill" class="stagger-fill"></div></div>' +
                '</div>' +
                '<div id="player-statuses" class="status-icons"></div>';

            // === ENEMY STATS PANEL ===
            var enemyStats = document.createElement('div');
            enemyStats.id = 'enemy-stats-panel';
            enemyStats.className = 'battle-stats-panel enemy-stats';
            enemyStats.innerHTML =
                '<div id="enemy-hp-label" class="stats-header">' + state.enemy.name + '</div>' +
                '<div class="stat-row hp-row">' +
                    '<span class="stat-label">HP</span>' +
                    '<div class="stat-bar-outer"><div id="enemy-hp-bar" class="stat-bar hp-bar hp-high"></div></div>' +
                    '<span id="enemy-hp-text" class="stat-value"></span>' +
                '</div>' +
                '<div id="enemy-stagger-container" class="stagger-container">' +
                    '<div id="enemy-stagger-bar" class="stagger-bar"><div id="enemy-stagger-fill" class="stagger-fill"></div></div>' +
                '</div>' +
                '<div id="enemy-statuses" class="status-icons"></div>';

            // Battle log panel (bottom, replaces text box)
            var battleLog = document.createElement('div');
            battleLog.id = 'battle-log-panel';
            battleLog.className = 'battle-log-panel';
            battleLog.innerHTML =
                '<div id="battle-log-content" class="battle-log-content"></div>' +
                '<div id="battle-choices" class="battle-choices"></div>';

            battleUI.appendChild(terrainIndicator);
            battleUI.appendChild(playerStats);
            battleUI.appendChild(enemyStats);
            battleUI.appendChild(battleLog);
            elements.container.appendChild(battleUI);
        }

        // Cache references
        cacheElements();

        // Update terrain display
        updateTerrainDisplay();

        // Show UI
        if (elements.battleUI) elements.battleUI.style.display = 'block';
    }

    function cacheElements() {
        elements.battleUI = document.getElementById('battle-ui');
        // New unified panels
        elements.playerStats = document.getElementById('player-stats-panel');
        elements.enemyStats = document.getElementById('enemy-stats-panel');
        // HP/Mana/Limit bars
        elements.playerHPBar = document.getElementById('player-hp-bar');
        elements.playerHPText = document.getElementById('player-hp-text');
        elements.playerManaBar = document.getElementById('player-mana-bar');
        elements.playerManaText = document.getElementById('player-mana-text');
        elements.limitBar = document.getElementById('limit-bar');
        elements.limitText = document.getElementById('limit-text');
        // Status and stagger
        elements.playerStatuses = document.getElementById('player-statuses');
        elements.playerStaggerFill = document.getElementById('player-stagger-fill');
        // Enemy elements
        elements.enemyHPBar = document.getElementById('enemy-hp-bar');
        elements.enemyHPText = document.getElementById('enemy-hp-text');
        elements.enemyLabel = document.getElementById('enemy-hp-label');
        elements.enemyStatuses = document.getElementById('enemy-statuses');
        elements.enemyStaggerFill = document.getElementById('enemy-stagger-fill');
        // Other
        elements.terrainIndicator = document.getElementById('terrain-indicator');
        elements.battleLog = document.getElementById('battle-log-content');
    }

    function hideUI() {
        if (elements.battleUI) elements.battleUI.style.display = 'none';
        if (elements.playerHP) elements.playerHP.style.display = 'none';
        if (elements.playerMana) elements.playerMana.style.display = 'none';
        if (elements.enemyHP) elements.enemyHP.style.display = 'none';
    }

    function destroyUI() {
        var battleUI = document.getElementById('battle-ui');
        if (battleUI && battleUI.parentNode) {
            battleUI.parentNode.removeChild(battleUI);
        }
        elements.battleUI = null;
        elements.playerHP = null;
        elements.playerMana = null;
        elements.enemyHP = null;
        elements.battleLog = null;
    }

    function updateDisplay() {
        updatePlayerHPDisplay();
        updatePlayerManaDisplay();
        updateEnemyHPDisplay();
        updateStatusDisplay();
        updateStaggerDisplay();
        updateTerrainDisplay();
    }

    /**
     * Update status effect icons for both player and enemy
     */
    function updateStatusDisplay() {
        // Update player AC display (including defend bonus and status effects)
        var acDisplay = document.getElementById('player-ac-display');
        if (acDisplay) {
            var effectiveAC = state.player.ac;
            if (state.player.defending) effectiveAC += 4;
            // Add status effect AC bonuses
            for (var s = 0; s < state.player.statuses.length; s++) {
                var stat = state.player.statuses[s];
                var statDef = statusEffects[stat.type];
                if (statDef && statDef.acBonus) effectiveAC += statDef.acBonus;
            }
            var acText = '(AC ' + effectiveAC + ')';
            if (effectiveAC > state.player.ac) {
                acText = '(AC ' + effectiveAC + ' ↑)';
                acDisplay.style.color = '#4caf50';
            } else {
                acDisplay.style.color = '';
            }
            acDisplay.textContent = acText;
        }

        // Update player statuses
        if (elements.playerStatuses) {
            elements.playerStatuses.innerHTML = '';
            for (var i = 0; i < state.player.statuses.length; i++) {
                var status = state.player.statuses[i];
                var def = statusEffects[status.type];
                if (def) {
                    var icon = document.createElement('span');
                    icon.className = 'status-icon';
                    icon.style.color = def.color;
                    icon.title = def.name + ' (' + status.duration + ' turns)' +
                        (status.stacks > 1 ? ' x' + status.stacks : '');
                    icon.textContent = def.icon;
                    if (status.stacks > 1) {
                        var stackNum = document.createElement('sub');
                        stackNum.textContent = status.stacks;
                        icon.appendChild(stackNum);
                    }
                    elements.playerStatuses.appendChild(icon);
                }
            }
        }

        // Update enemy statuses
        if (elements.enemyStatuses) {
            elements.enemyStatuses.innerHTML = '';
            for (var j = 0; j < state.enemy.statuses.length; j++) {
                var eStatus = state.enemy.statuses[j];
                var eDef = statusEffects[eStatus.type];
                if (eDef) {
                    var eIcon = document.createElement('span');
                    eIcon.className = 'status-icon';
                    eIcon.style.color = eDef.color;
                    eIcon.title = eDef.name + ' (' + eStatus.duration + ' turns)' +
                        (eStatus.stacks > 1 ? ' x' + eStatus.stacks : '');
                    eIcon.textContent = eDef.icon;
                    if (eStatus.stacks > 1) {
                        var eStackNum = document.createElement('sub');
                        eStackNum.textContent = eStatus.stacks;
                        eIcon.appendChild(eStackNum);
                    }
                    elements.enemyStatuses.appendChild(eIcon);
                }
            }
        }
    }

    /**
     * Update stagger bars for both player and enemy
     * Bars are hidden when stagger is 0 (via CSS .has-stagger class)
     */
    function updateStaggerDisplay() {
        var playerContainer = document.getElementById('player-stagger-container');
        var enemyContainer = document.getElementById('enemy-stagger-container');

        if (elements.playerStaggerFill) {
            var playerPercent = (state.player.stagger / state.player.staggerThreshold) * 100;
            elements.playerStaggerFill.style.width = playerPercent + '%';
            // Show/hide container based on stagger value
            if (playerContainer) {
                if (state.player.stagger > 0) {
                    playerContainer.classList.add('has-stagger');
                } else {
                    playerContainer.classList.remove('has-stagger');
                }
            }
            // Color changes as stagger builds
            if (playerPercent >= 75) {
                elements.playerStaggerFill.className = 'stagger-fill stagger-danger';
            } else if (playerPercent >= 50) {
                elements.playerStaggerFill.className = 'stagger-fill stagger-warning';
            } else {
                elements.playerStaggerFill.className = 'stagger-fill';
            }
        }

        if (elements.enemyStaggerFill) {
            var enemyPercent = (state.enemy.stagger / state.enemy.staggerThreshold) * 100;
            elements.enemyStaggerFill.style.width = enemyPercent + '%';
            // Show/hide container based on stagger value
            if (enemyContainer) {
                if (state.enemy.stagger > 0) {
                    enemyContainer.classList.add('has-stagger');
                } else {
                    enemyContainer.classList.remove('has-stagger');
                }
            }
            if (enemyPercent >= 75) {
                elements.enemyStaggerFill.className = 'stagger-fill stagger-danger';
            } else if (enemyPercent >= 50) {
                elements.enemyStaggerFill.className = 'stagger-fill stagger-warning';
            } else {
                elements.enemyStaggerFill.className = 'stagger-fill';
            }
        }
    }

    /**
     * Update terrain indicator
     */
    function updateTerrainDisplay() {
        if (!elements.terrainIndicator) {
            elements.terrainIndicator = document.getElementById('terrain-indicator');
        }
        if (!elements.terrainIndicator) return;

        var terrain = terrainTypes[state.terrain];
        if (!terrain || state.terrain === 'none') {
            elements.terrainIndicator.style.display = 'none';
        } else {
            elements.terrainIndicator.style.display = 'block';
            elements.terrainIndicator.innerHTML =
                '<span class="terrain-icon" style="background-color: ' + terrain.color + '">' +
                terrain.icon + '</span> ' + terrain.name;
            elements.terrainIndicator.title = terrain.description;
        }
    }

    function updatePlayerHPDisplay() {
        if (!elements.playerHPBar || !elements.playerHPText) {
            cacheElements();
        }
        if (!elements.playerHPBar || !elements.playerHPText) return;

        var percent = (state.player.hp / state.player.maxHP) * 100;
        elements.playerHPBar.style.width = percent + '%';
        elements.playerHPText.textContent = state.player.hp + '/' + state.player.maxHP;

        // Use new unified class names
        var hpState = percent > 50 ? 'hp-high' : percent > 25 ? 'hp-medium' : 'hp-low';
        elements.playerHPBar.className = 'stat-bar hp-bar ' + hpState;
    }

    function updatePlayerManaDisplay() {
        if (!elements.playerManaBar || !elements.playerManaText) {
            cacheElements();
        }
        if (!elements.playerManaBar || !elements.playerManaText) return;

        var percent = (state.player.mana / state.player.maxMana) * 100;
        elements.playerManaBar.style.width = percent + '%';
        elements.playerManaText.textContent = state.player.mana + '/' + state.player.maxMana;
    }

    function updateEnemyHPDisplay() {
        if (!elements.enemyHPBar || !elements.enemyHPText) {
            cacheElements();
        }
        if (!elements.enemyHPBar || !elements.enemyHPText) return;

        if (elements.enemyLabel) {
            elements.enemyLabel.textContent = state.enemy.name;
        }

        var percent = (state.enemy.hp / state.enemy.maxHP) * 100;
        elements.enemyHPBar.style.width = percent + '%';
        elements.enemyHPText.textContent = state.enemy.hp + '/' + state.enemy.maxHP;

        // Use new unified class names
        var hpState = percent > 50 ? 'hp-high' : percent > 25 ? 'hp-medium' : 'hp-low';
        elements.enemyHPBar.className = 'stat-bar hp-bar ' + hpState;
    }

    // Battle log animation state (timing values from config.dice)
    var battleLogAnimation = {
        active: false,
        timeouts: [],
        damageQueue: [],       // Queue damage numbers to show after animation
        onComplete: null       // Callback when animation completes
    };

    /**
     * Queue a damage number to show after animation completes
     */
    function queueDamageNumber(amount, target, type) {
        battleLogAnimation.damageQueue.push({ amount: amount, target: target, type: type });
    }

    /**
     * Show all queued damage numbers
     */
    function flushDamageQueue() {
        battleLogAnimation.damageQueue.forEach(function(dmg) {
            showDamageNumberImmediate(dmg.amount, dmg.target, dmg.type);
        });
        battleLogAnimation.damageQueue = [];
    }

    /**
     * Complete the battle log animation - flush damage queue and mark inactive
     */
    function completeBattleLogAnimation() {
        flushDamageQueue();
        battleLogAnimation.active = false;
        if (battleLogAnimation.onComplete) {
            var cb = battleLogAnimation.onComplete;
            battleLogAnimation.onComplete = null;
            cb();
        }
    }

    /**
     * Clear any ongoing battle log animations
     */
    function clearBattleLogAnimation() {
        battleLogAnimation.timeouts.forEach(function(t) { clearTimeout(t); });
        battleLogAnimation.timeouts = [];
        battleLogAnimation.damageQueue = [];
        battleLogAnimation.onComplete = null;
        battleLogAnimation.active = false;
    }

    /**
     * Animate a dice roll number with slot-machine effect
     * @param {Element} element - The element to animate
     * @param {number} finalValue - The final value to show
     * @param {boolean} isCrit - Is this a critical hit (nat 20)
     * @param {boolean} isFumble - Is this a fumble (nat 1)
     * @param {function} callback - Called when animation completes
     */
    function animateDiceRoll(element, finalValue, isCrit, isFumble, callback) {
        var duration = config.dice.spinDuration;
        var interval = config.dice.spinInterval;
        var lingerDelay = config.dice.lingerDelay;
        var elapsed = 0;
        var maxValue = 20; // Assume d20 for battle

        // Play dice roll sound at start
        playSoundCue('dice_roll');

        function spin() {
            if (elapsed >= duration) {
                // Final reveal
                element.textContent = finalValue;
                element.classList.remove('dice-spinning');
                element.classList.add('dice-final');

                // Add special effects for crits/fumbles
                if (isCrit) {
                    element.classList.add('dice-crit');
                    playSoundCue('attack_crit');
                } else if (isFumble) {
                    element.classList.add('dice-fumble');
                    playSoundCue('attack_fumble');
                } else {
                    playSfx('click.ogg');
                }

                // Linger on the result before continuing
                if (callback) {
                    var delay = isCrit || isFumble ? lingerDelay * 1.5 : lingerDelay;
                    var t = setTimeout(callback, delay);
                    battleLogAnimation.timeouts.push(t);
                }
                return;
            }

            // Show random number (weighted towards final value as we get closer)
            var progress = elapsed / duration;
            var randomChance = 1 - (progress * progress * progress); // Cubic ease out - more suspense

            if (Math.random() < randomChance) {
                element.textContent = Math.floor(Math.random() * maxValue) + 1;
            } else {
                element.textContent = finalValue;
            }

            // Slow down significantly as we approach the end
            var currentInterval = interval + (progress * progress * interval * 3);
            elapsed += currentInterval;

            var t = setTimeout(spin, currentInterval);
            battleLogAnimation.timeouts.push(t);
        }

        element.classList.add('dice-spinning');
        spin();
    }

    /**
     * Typewriter effect for battle log text
     * @param {Element} container - Container element
     * @param {string} text - Text to type
     * @param {function} callback - Called when typing completes
     */
    function typewriterEffect(container, text, callback) {
        var index = 0;
        var speed = config.dice.typewriterSpeed;

        function typeNext() {
            if (index < text.length) {
                // Handle HTML tags - add them instantly
                if (text[index] === '<') {
                    var tagEnd = text.indexOf('>', index);
                    if (tagEnd !== -1) {
                        container.innerHTML += text.substring(index, tagEnd + 1);
                        index = tagEnd + 1;
                        typeNext();
                        return;
                    }
                }

                container.innerHTML += text[index];
                index++;
                var t = setTimeout(typeNext, speed);
                battleLogAnimation.timeouts.push(t);
            } else {
                if (callback) callback();
            }
        }

        typeNext();
    }

    /**
     * Update battle log with animated effects
     * Includes typewriter text and animated dice rolls
     */
    function updateBattleLog(html) {
        if (!elements.battleLog) {
            elements.battleLog = document.getElementById('battle-log-content');
        }
        if (!elements.battleLog) return;

        // Clear any ongoing animation
        clearBattleLogAnimation();
        battleLogAnimation.active = true;

        // Parse the HTML to extract the last battle-log entry
        var temp = document.createElement('div');
        temp.innerHTML = html;
        var allLogs = temp.querySelectorAll('.battle-log');

        var lastLog;
        if (allLogs.length > 0) {
            lastLog = allLogs[allLogs.length - 1];
        } else {
            lastLog = temp;
        }

        // Clear log and create container
        elements.battleLog.innerHTML = '';
        var logContainer = document.createElement('div');
        logContainer.className = lastLog.className || 'battle-log';
        elements.battleLog.appendChild(logContainer);

        // Check if this is a roll result (has roll-result span)
        var rollResultSpan = lastLog.querySelector('.roll-result');
        var critText = lastLog.querySelector('.crit-text');
        var fumbleText = lastLog.querySelector('.fumble-text');

        if (rollResultSpan) {
            // This is an attack/skill roll - animate the dice!
            var rollHtml = rollResultSpan.innerHTML;

            // Extract roll numbers from the text
            // Pattern: "Name rolled <strong>X</strong>" or "Name rolled <strong>X</strong> + Y = <strong>Z</strong>"
            var rollMatch = rollHtml.match(/rolled <strong>(\d+)<\/strong>/);
            var totalMatch = rollHtml.match(/= <strong>(\d+)<\/strong>/);

            if (rollMatch) {
                var naturalRoll = parseInt(rollMatch[1]);
                var isCrit = critText !== null;
                var isFumble = fumbleText !== null;

                // Create the roll result display with placeholder for animated number
                var nameMatch = rollHtml.match(/^([^<]+) rolled/);
                var name = nameMatch ? nameMatch[1] : 'You';

                // Build the display step by step
                var rollSpan = document.createElement('span');
                rollSpan.className = 'roll-result';
                logContainer.appendChild(rollSpan);

                // Type the name first
                typewriterEffect(rollSpan, name + ' rolled ', function() {
                    // Create the animated dice number
                    var diceNum = document.createElement('strong');
                    diceNum.className = 'dice-number';
                    diceNum.textContent = '?';
                    rollSpan.appendChild(diceNum);

                    // Animate the dice roll
                    animateDiceRoll(diceNum, naturalRoll, isCrit, isFumble, function() {
                        // After dice animation, show the rest
                        var restOfRoll = '';

                        // Add modifier if present
                        if (totalMatch) {
                            var total = parseInt(totalMatch[1]);
                            var modifier = total - naturalRoll;
                            if (modifier !== 0) {
                                restOfRoll += ' + ' + modifier + ' = <strong>' + total + '</strong>';
                            }
                        }

                        // Add vs AC
                        var acMatch = rollHtml.match(/vs AC (\d+)/);
                        if (acMatch) {
                            restOfRoll += ' vs AC ' + acMatch[1];
                        }

                        // Type the rest of the roll info
                        typewriterEffect(rollSpan, restOfRoll, function() {
                            // Add crit/fumble text if present
                            if (critText) {
                                var critSpan = document.createElement('span');
                                critSpan.className = 'crit-text';
                                critSpan.textContent = ' ';
                                logContainer.appendChild(critSpan);
                                typewriterEffect(critSpan, 'CRITICAL HIT!', function() {
                                    showDamageText();
                                });
                            } else if (fumbleText) {
                                var fumbleSpan = document.createElement('span');
                                fumbleSpan.className = 'fumble-text';
                                fumbleSpan.textContent = ' ';
                                logContainer.appendChild(fumbleSpan);
                                typewriterEffect(fumbleSpan, 'FUMBLE!', function() {
                                    showDamageText();
                                });
                            } else {
                                showDamageText();
                            }
                        });
                    });
                });

                // Function to show the damage/miss text
                function showDamageText() {
                    // Get remaining content (after roll-result, crit-text, fumble-text)
                    var fullHtml = lastLog.innerHTML;

                    // Find the damage/miss text (after the <br>)
                    var brIndex = fullHtml.indexOf('<br>');
                    if (brIndex !== -1) {
                        var damageText = fullHtml.substring(brIndex);
                        // Strip any remaining roll-result or crit/fumble spans we've already shown
                        damageText = damageText.replace(/<span class="roll-result">.*?<\/span>/g, '');
                        damageText = damageText.replace(/<span class="crit-text">.*?<\/span>/g, '');
                        damageText = damageText.replace(/<span class="fumble-text">.*?<\/span>/g, '');

                        typewriterEffect(logContainer, damageText, function() {
                            completeBattleLogAnimation();
                        });
                    } else {
                        completeBattleLogAnimation();
                    }
                }

            } else {
                // No roll number found, just typewriter the whole thing
                typewriterEffect(logContainer, lastLog.innerHTML, function() {
                    completeBattleLogAnimation();
                });
            }
        } else {
            // Not a roll result - just typewriter effect
            typewriterEffect(logContainer, lastLog.innerHTML, function() {
                completeBattleLogAnimation();
            });
        }
    }

    // === Visual Effects ===

    /**
     * Play attack animation on enemy sprite
     */
    function playAttackAnimation(type) {
        var spriteLayer = document.getElementById('sprite-layer');
        if (!spriteLayer) return;

        // Create attack effect overlay
        var effect = document.createElement('div');
        effect.className = 'attack-effect attack-' + (type || 'physical');
        elements.container.appendChild(effect);

        // Remove after animation
        setTimeout(function() {
            if (effect.parentNode) {
                effect.parentNode.removeChild(effect);
            }
        }, 600);
    }

    /**
     * Flash enemy sprite when hit
     */
    function flashEnemy() {
        var spriteLayer = document.getElementById('sprite-layer');
        if (!spriteLayer) return;

        var sprites = spriteLayer.querySelectorAll('img');
        sprites.forEach(function(sprite) {
            sprite.classList.add('damage-flash');
            setTimeout(function() {
                sprite.classList.remove('damage-flash');
            }, config.timing.screenShake);
        });
    }

    /**
     * Shake the screen when player is hit
     */
    function shakeScreen() {
        if (elements.container) {
            elements.container.classList.add('screen-shake');
            setTimeout(function() {
                elements.container.classList.remove('screen-shake');
            }, config.timing.screenShake);
        }
    }

    /**
     * Show floating damage number (queues if animation is active)
     */
    function showDamageNumber(amount, target, type) {
        // If battle log animation is active, queue the damage to show later
        if (battleLogAnimation.active) {
            queueDamageNumber(amount, target, type);
            return;
        }
        showDamageNumberImmediate(amount, target, type);
    }

    /**
     * Show floating damage number immediately (bypasses queue)
     */
    function showDamageNumberImmediate(amount, target, type) {
        var container = document.getElementById(target + '-hp-container');
        if (!container) container = elements.container;
        if (!container) return;

        var damageNum = document.createElement('div');
        damageNum.className = 'battle-damage-number ' + type;
        damageNum.textContent = type === 'heal' ? '+' + amount : '-' + amount;

        container.appendChild(damageNum);

        setTimeout(function() {
            if (damageNum.parentNode) {
                damageNum.parentNode.removeChild(damageNum);
            }
        }, config.timing.uiTransition);
    }

    // === Player Actions ===

    function playerAttack(move) {
        if (!state.active || state.phase !== 'player') return null;

        // Check mana cost
        var manaCost = (move && move.manaCost) || 0;
        if (state.player.mana < manaCost) {
            return { success: false, reason: 'not_enough_mana' };
        }

        state.phase = 'animating';

        // Spend mana
        if (manaCost > 0) {
            state.player.mana -= manaCost;
            updatePlayerManaDisplay();
        }

        // Get passive bonuses for attack
        var playerBonuses = getPassiveBonuses(state.player);
        var modifiedMove = Object.assign({}, move || {});

        // Apply passive attack bonus
        if (playerBonuses.attackBonus) {
            modifiedMove.attackBonus = (modifiedMove.attackBonus || state.player.attackBonus) + playerBonuses.attackBonus;
        }

        // Apply passive damage bonus
        var extraDamage = playerBonuses.damageBonus || 0;

        // Resolve attack with d20
        var result = resolveAttack(state.player, state.enemy, modifiedMove);

        // Apply extra damage from passives
        if (result.hit && extraDamage > 0) {
            result.damage += extraDamage;
        }

        // Apply damage reduction from enemy passives
        var enemyBonuses = getPassiveBonuses(state.enemy);
        if (result.hit && enemyBonuses.damageReduction > 0) {
            result.damage = Math.max(1, result.damage - enemyBonuses.damageReduction);
        }

        // Play attack animation
        playAttackAnimation(move ? move.type : 'physical');
        playSoundCue('dice_roll');

        if (result.hit) {
            // Check dialogue triggers
            if (result.isCrit) {
                checkDialogueTriggers('player_crit');
            }

            // Add limit charge when dealing damage
            var limitChargeFromDamage = Math.min(10, Math.floor(result.damage * 0.5));
            addLimitCharge(limitChargeFromDamage);

            // Apply damage after short delay (for animation)
            setTimeout(function() {
                state.enemy.hp = Math.max(0, state.enemy.hp - result.damage);
                updateEnemyHPDisplay();
                flashEnemy();
                showDamageNumber(result.damage, 'enemy', 'damage');

                // Play type-specific attack sound or crit sound
                var attackType = move ? move.type : 'physical';
                if (result.isCrit) {
                    playSoundCue('attack_crit');
                } else {
                    playSoundCue('attack_' + attackType, soundCues['attack_hit']);
                }

                // Apply lifesteal passive
                if (playerBonuses.lifesteal > 0) {
                    var lifestealed = Math.floor(result.damage * playerBonuses.lifesteal);
                    if (lifestealed > 0) {
                        state.player.hp = Math.min(state.player.maxHP, state.player.hp + lifestealed);
                        updatePlayerHPDisplay();
                        showDamageNumber(lifestealed, 'player', 'heal');
                    }
                }

                // Check for enemy low HP dialogue
                checkDialogueTriggers('enemy_hit');
            }, config.timing.actionDelay);
        } else {
            // Attack missed
            if (result.isFumble) {
                playSoundCue('attack_fumble');
                checkDialogueTriggers('player_fumble');
            } else {
                playSoundCue('attack_miss');
            }
        }

        return {
            success: true,
            move: move || { name: 'Attack' },
            hit: result.hit,
            roll: result.roll,
            total: result.total,
            targetAC: result.targetAC,
            damage: result.damage,
            isCrit: result.isCrit,
            isFumble: result.isFumble,
            multiplier: result.multiplier,
            message: result.message
        };
    }

    function playerItem(item) {
        if (!state.active || state.phase !== 'player') return null;

        state.phase = 'animating';
        var messages = [];

        playSoundCue('item_use');

        if (item.heals) {
            var healAmount = item.heals;
            state.player.hp = Math.min(state.player.maxHP, state.player.hp + healAmount);
            updatePlayerHPDisplay();
            showDamageNumber(healAmount, 'player', 'heal');
            messages.push('Restored ' + healAmount + ' HP!');
            playSoundCue('heal');
        }

        if (item.restoresMana) {
            state.player.mana = Math.min(state.player.maxMana, state.player.mana + item.restoresMana);
            updatePlayerManaDisplay();
            messages.push('Restored ' + item.restoresMana + ' MP!');
            playSoundCue('mana_restore');
        }

        return {
            success: true,
            message: messages.join(' ')
        };
    }

    function playerDefend() {
        if (!state.active || state.phase !== 'player') return null;

        state.phase = 'animating';
        state.player.defending = true;

        playSoundCue('defend');

        // Recover mana when defending (design spec: 2-4 MP)
        var manaRecovery = 2 + Math.floor(Math.random() * 3); // 2-4 MP
        var oldMana = state.player.mana;
        state.player.mana = Math.min(state.player.maxMana, state.player.mana + manaRecovery);
        var actualRecovery = state.player.mana - oldMana;
        updatePlayerManaDisplay();

        // Decay stagger when defending
        decayStagger(state.player, 15);
        updateStaggerDisplay();

        var message = state.player.name + ' is defending! (+4 AC)';
        if (actualRecovery > 0) {
            message += ' Recovered ' + actualRecovery + ' MP!';
        }

        return {
            success: true,
            manaRecovered: actualRecovery,
            message: message
        };
    }

    /**
     * Use a skill (spell/ability)
     */
    function playerSkill(skillId) {
        if (!state.active || state.phase !== 'player') return null;

        var skill = skills[skillId];
        if (!skill) {
            return { success: false, reason: 'unknown_skill' };
        }

        // Check mana cost
        if (state.player.mana < skill.manaCost) {
            return { success: false, reason: 'not_enough_mana', needed: skill.manaCost, have: state.player.mana };
        }

        state.phase = 'animating';

        playSoundCue('skill_use');

        // Spend mana
        state.player.mana -= skill.manaCost;
        updatePlayerManaDisplay();

        var result = {
            success: true,
            skill: skill,
            messages: []
        };

        // Handle healing skills
        if (skill.isHeal) {
            if (skill.healAmount) {
                var healRoll = rollDamage(skill.healAmount);
                var oldHP = state.player.hp;
                state.player.hp = Math.min(state.player.maxHP, state.player.hp + healRoll);
                var actualHeal = state.player.hp - oldHP;
                updatePlayerHPDisplay();
                showDamageNumber(actualHeal, 'player', 'heal');
                result.messages.push('Healed for ' + actualHeal + ' HP!');
                playSoundCue('heal');
            }
            // Apply status effect from heal (like regen)
            if (skill.statusEffect) {
                var statusResult = tryApplyStatusFromSkill(skill, state.player, state.player.name);
                if (statusResult && statusResult.applied) {
                    result.messages.push(statusResult.message);
                    updateStatusDisplay();
                }
            }
            return result;
        }

        // Handle buff skills
        if (skill.isBuff) {
            if (skill.statusEffect) {
                var buffResult = tryApplyStatusFromSkill(skill, state.player, state.player.name);
                if (buffResult && buffResult.applied) {
                    result.messages.push(buffResult.message);
                    updateStatusDisplay();
                }
            }
            playSfx('success.ogg');
            return result;
        }

        // Handle attack skills
        var attackResult = resolveAttack(state.player, state.enemy, skill);

        // Play attack animation
        playAttackAnimation(skill.type || 'physical');
        playSfx('dice_roll.ogg');

        result.hit = attackResult.hit;
        result.roll = attackResult.roll;
        result.total = attackResult.total;
        result.targetAC = attackResult.targetAC;
        result.damage = attackResult.damage;
        result.isCrit = attackResult.isCrit;
        result.isFumble = attackResult.isFumble;
        result.multiplier = attackResult.multiplier;
        result.effectivenessMessage = attackResult.message;

        if (attackResult.hit) {
            // Apply damage after animation
            setTimeout(function() {
                state.enemy.hp = Math.max(0, state.enemy.hp - attackResult.damage);
                updateEnemyHPDisplay();
                flashEnemy();
                showDamageNumber(attackResult.damage, 'enemy', 'damage');
                playSfx('thud.ogg');

                // Handle status effect from skill
                if (attackResult.statusResult && attackResult.statusResult.applied) {
                    result.messages.push(attackResult.statusResult.message);
                    updateStatusDisplay();
                }

                // Handle stagger
                if (attackResult.staggered) {
                    result.messages.push('💫 ' + state.enemy.name + ' is STAGGERED!');
                }
                updateStaggerDisplay();
            }, config.timing.actionDelay);
        }

        return result;
    }

    function playerFlee() {
        if (!state.active || state.phase !== 'player') return null;

        if (!state.targets.flee) {
            return { success: false, reason: 'cannot_flee' };
        }

        state.phase = 'animating';

        // Roll d20, need 10+ to escape
        var roll = rollD20();
        var success = roll >= 10;

        if (success) {
            end('flee');
            return { success: true, roll: roll };
        }

        return { success: false, reason: 'failed', roll: roll };
    }

    // === Enemy AI ===

    /**
     * Smart enemy AI that chooses moves based on health and situation
     */
    function selectEnemyMove() {
        var moves = state.enemy.moves;
        if (!moves || moves.length === 0) {
            return { name: 'Attack', damage: state.enemy.damage || '1d6', type: 'physical' };
        }

        var ai = state.enemy.ai || 'default';
        var healthPercent = (state.enemy.hp / state.enemy.maxHP) * 100;
        var playerHealthPercent = (state.player.hp / state.player.maxHP) * 100;

        // Categorize moves
        var attackMoves = [];
        var healMoves = [];
        var buffMoves = [];
        var statusMoves = [];

        for (var i = 0; i < moves.length; i++) {
            var move = moves[i];
            if (move.isHeal) {
                healMoves.push(move);
            } else if (move.isBuff) {
                buffMoves.push(move);
            } else if (move.statusEffect && !move.damage) {
                statusMoves.push(move);
            } else {
                attackMoves.push(move);
            }
        }

        // AI decision making
        var selectedMove = null;

        switch (ai) {
            case 'aggressive':
                // Always attack, prefer high damage moves
                if (attackMoves.length > 0) {
                    // Sort by damage potential and pick one of the top moves
                    selectedMove = attackMoves[Math.floor(Math.random() * Math.min(2, attackMoves.length))];
                }
                break;

            case 'defensive':
                // Heal when low, buff when healthy
                if (healthPercent < 30 && healMoves.length > 0) {
                    selectedMove = healMoves[Math.floor(Math.random() * healMoves.length)];
                } else if (healthPercent > 70 && buffMoves.length > 0 && Math.random() < 0.4) {
                    selectedMove = buffMoves[Math.floor(Math.random() * buffMoves.length)];
                } else if (attackMoves.length > 0) {
                    selectedMove = attackMoves[Math.floor(Math.random() * attackMoves.length)];
                }
                break;

            case 'support':
                // Focus on status effects and debuffs
                if (statusMoves.length > 0 && Math.random() < 0.5) {
                    selectedMove = statusMoves[Math.floor(Math.random() * statusMoves.length)];
                } else if (healthPercent < 40 && healMoves.length > 0) {
                    selectedMove = healMoves[Math.floor(Math.random() * healMoves.length)];
                } else if (attackMoves.length > 0) {
                    selectedMove = attackMoves[Math.floor(Math.random() * attackMoves.length)];
                }
                break;

            case 'default':
            default:
                // Smart behavior based on health thresholds
                // Low health: prioritize healing
                if (healthPercent < 25 && healMoves.length > 0 && Math.random() < 0.7) {
                    selectedMove = healMoves[Math.floor(Math.random() * healMoves.length)];
                }
                // Medium health: mix of attacks and buffs
                else if (healthPercent < 50 && healthPercent > 25) {
                    if (healMoves.length > 0 && Math.random() < 0.3) {
                        selectedMove = healMoves[Math.floor(Math.random() * healMoves.length)];
                    } else if (buffMoves.length > 0 && Math.random() < 0.2) {
                        selectedMove = buffMoves[Math.floor(Math.random() * buffMoves.length)];
                    }
                }
                // High health: aggressive attacks, maybe buff
                else if (healthPercent > 75) {
                    if (buffMoves.length > 0 && state.enemy.statuses.length === 0 && Math.random() < 0.25) {
                        selectedMove = buffMoves[Math.floor(Math.random() * buffMoves.length)];
                    } else if (statusMoves.length > 0 && playerHealthPercent > 50 && Math.random() < 0.3) {
                        selectedMove = statusMoves[Math.floor(Math.random() * statusMoves.length)];
                    }
                }

                // Player is low - go for the kill
                if (!selectedMove && playerHealthPercent < 25 && attackMoves.length > 0) {
                    // Pick strongest attack
                    selectedMove = attackMoves[0];
                }
                break;
        }

        // Fallback to random attack
        if (!selectedMove) {
            if (attackMoves.length > 0) {
                selectedMove = attackMoves[Math.floor(Math.random() * attackMoves.length)];
            } else {
                selectedMove = moves[Math.floor(Math.random() * moves.length)];
            }
        }

        return selectedMove || { name: 'Attack', damage: state.enemy.damage || '1d6', type: 'physical' };
    }

    // === Enemy Turn ===

    function enemyTurn() {
        if (!state.active) return null;

        state.phase = 'enemy';

        // Process enemy status effects first
        var statusResult = tickStatuses(state.enemy, state.enemy.name);

        // Apply status damage/healing
        if (statusResult.damage > 0) {
            state.enemy.hp = Math.max(0, state.enemy.hp - statusResult.damage);
            updateEnemyHPDisplay();
            showDamageNumber(statusResult.damage, 'enemy', 'dot');
        }
        if (statusResult.heal > 0) {
            state.enemy.hp = Math.min(state.enemy.maxHP, state.enemy.hp + statusResult.heal);
            updateEnemyHPDisplay();
            showDamageNumber(statusResult.heal, 'enemy', 'heal');
        }

        // Check if enemy died from status effects
        if (state.enemy.hp <= 0) {
            return {
                skipped: false,
                statusMessages: statusResult.messages,
                diedFromStatus: true
            };
        }

        // Check if enemy can act
        if (!statusResult.canAct) {
            // Decay stagger when stunned
            decayStagger(state.enemy, 20);
            updateStatusDisplay();
            updateStaggerDisplay();
            return {
                skipped: true,
                reason: 'status',
                statusMessages: statusResult.messages
            };
        }

        // Use smart AI to pick a move
        var move = selectEnemyMove();

        // Handle enemy healing
        if (move.isHeal) {
            var healAmount = rollDamage(move.healAmount || '1d6');
            state.enemy.hp = Math.min(state.enemy.maxHP, state.enemy.hp + healAmount);
            updateEnemyHPDisplay();
            showDamageNumber(healAmount, 'enemy', 'heal');
            playSoundCue('heal');
            updateStatusDisplay();

            return {
                move: move,
                healed: healAmount,
                statusMessages: statusResult.messages
            };
        }

        // Handle enemy buff
        if (move.isBuff && move.statusEffect) {
            var buffResult = applyStatus(state.enemy, move.statusEffect.type, 1);
            updateStatusDisplay();
            playSoundCue('buff_apply');

            return {
                move: move,
                buffApplied: buffResult,
                statusMessages: statusResult.messages
            };
        }

        // Resolve attack with d20
        var result = resolveAttack(state.enemy, state.player, move);

        if (result.hit) {
            // Apply damage and effects
            state.player.hp = Math.max(0, state.player.hp - result.damage);
            updatePlayerHPDisplay();
            shakeScreen();
            showDamageNumber(result.damage, 'player', 'damage');

            // Play type-specific attack sound or crit sound
            var enemyAttackType = move.type || 'physical';
            if (result.isCrit) {
                playSoundCue('attack_crit');
            } else {
                playSoundCue('attack_' + enemyAttackType, soundCues['attack_hit']);
            }

            // Handle status effect from enemy move
            if (result.statusResult && result.statusResult.applied) {
                updateStatusDisplay();
            }

            // Handle stagger on player
            if (result.staggered) {
                // Player got staggered!
                playSoundCue('stagger_break');
            }
            updateStaggerDisplay();
        } else {
            // Enemy missed
            if (result.isFumble) {
                playSoundCue('attack_fumble');
            } else {
                playSoundCue('attack_miss');
            }
        }

        // Reset defending after enemy turn
        state.player.defending = false;

        // Decay enemy stagger each turn
        decayStagger(state.enemy, 10);
        updateStaggerDisplay();

        return {
            move: move,
            hit: result.hit,
            roll: result.roll,
            total: result.total,
            targetAC: result.targetAC,
            damage: result.damage,
            isCrit: result.isCrit,
            isFumble: result.isFumble,
            multiplier: result.multiplier,
            message: result.message,
            statusResult: result.statusResult,
            staggered: result.staggered,
            statusMessages: statusResult.messages
        };
    }

    // === Battle Flow ===

    function checkBattleEnd() {
        if (!state.active) return false;

        if (state.enemy.hp <= 0) {
            end('win');
            return true;
        }

        if (state.player.hp <= 0) {
            end('lose');
            return true;
        }

        return false;
    }

    function formatRollMessage(name, result, moveName) {
        var html = '<div class="battle-log' + (result.isCrit ? ' crit' : result.isFumble ? ' fumble' : '') + '">';
        html += '<span class="roll-result">' + name + ' rolled <strong>' + result.roll + '</strong>';
        if (result.roll !== result.total) {
            html += ' + ' + (result.total - result.roll) + ' = <strong>' + result.total + '</strong>';
        }
        html += ' vs AC ' + result.targetAC + '</span>';

        if (result.isCrit) {
            html += ' <span class="crit-text">CRITICAL HIT!</span>';
        } else if (result.isFumble) {
            html += ' <span class="fumble-text">FUMBLE!</span>';
        }

        if (result.hit) {
            html += '<br>' + moveName + ' deals <strong>' + result.damage + '</strong> damage!';
            if (result.message) {
                html += ' ' + result.message;
            }
        } else {
            html += '<br>' + moveName + ' missed!';
        }

        html += '</div>';
        return html;
    }

    /**
     * Execute a complete turn
     */
    function executeAction(action, params, callback) {
        if (!state.active || state.phase !== 'player') return;

        var playerResultText = '';
        var playerResult = null;
        var statusMessages = [];

        // === PLAYER STATUS TICK (start of turn) ===
        var playerStatusResult = tickStatuses(state.player, state.player.name);
        statusMessages = statusMessages.concat(playerStatusResult.messages);

        // Apply status damage/healing to player
        if (playerStatusResult.damage > 0) {
            state.player.hp = Math.max(0, state.player.hp - playerStatusResult.damage);
            updatePlayerHPDisplay();
            showDamageNumber(playerStatusResult.damage, 'player', 'dot');
        }
        if (playerStatusResult.heal > 0) {
            state.player.hp = Math.min(state.player.maxHP, state.player.hp + playerStatusResult.heal);
            updatePlayerHPDisplay();
            showDamageNumber(playerStatusResult.heal, 'player', 'heal');
        }

        // Check if player died from status effects
        if (state.player.hp <= 0) {
            var statusDeathText = '<div class="battle-log status-messages">' +
                statusMessages.join('<br>') + '</div>';
            updateBattleLog(statusDeathText);
            checkBattleEnd();
            return;
        }

        // Check if player can act (stunned/frozen)
        if (!playerStatusResult.canAct) {
            playerResultText = '<div class="battle-log status-messages">' +
                statusMessages.join('<br>') + '</div>';
            updateBattleLog(playerResultText);

            // Skip to enemy turn (player is stunned, so enemy gloats)
            setTimeout(function() {
                processEnemyTurn(playerResultText, callback, { playerAction: 'stunned' });
            }, 600);
            return;
        }

        // Add status messages to output
        if (statusMessages.length > 0) {
            playerResultText = '<div class="battle-log status-messages">' +
                statusMessages.join('<br>') + '</div>';
        }

        // === PLAYER ACTION ===
        switch (action) {
            case 'attack':
                var attackMove = params.move || { name: 'Attack', damage: state.player.damage || '1d6', type: 'physical' };
                playerResult = playerAttack(attackMove);

                if (!playerResult.success) {
                    if (playerResult.reason === 'not_enough_mana') {
                        playerResultText += '<div class="battle-log">Not enough MP!</div>';
                        state.phase = 'player';
                        updateBattleLog(playerResultText);
                        if (callback) callback(playerResultText);
                        return;
                    }
                }

                playerResultText += formatRollMessage(state.player.name, playerResult, attackMove.name || 'Attack');
                break;

            case 'skill':
                var skillId = params.skillId || params.skill;
                playerResult = playerSkill(skillId);

                if (!playerResult.success) {
                    if (playerResult.reason === 'not_enough_mana') {
                        playerResultText += '<div class="battle-log">Not enough MP! (Need ' + playerResult.needed + ', have ' + playerResult.have + ')</div>';
                        state.phase = 'player';
                        updateBattleLog(playerResultText);
                        if (callback) callback(playerResultText);
                        return;
                    } else if (playerResult.reason === 'unknown_skill') {
                        playerResultText += '<div class="battle-log">Unknown skill!</div>';
                        state.phase = 'player';
                        updateBattleLog(playerResultText);
                        if (callback) callback(playerResultText);
                        return;
                    }
                }

                // Format skill result
                if (playerResult.skill.isHeal || playerResult.skill.isBuff) {
                    playerResultText += '<div class="battle-log">' + state.player.name + ' used ' +
                        playerResult.skill.name + '! ' + playerResult.messages.join(' ') + '</div>';
                } else {
                    playerResultText += formatRollMessage(state.player.name, playerResult, playerResult.skill.name);
                    if (playerResult.messages.length > 0) {
                        playerResultText += '<div class="battle-log">' + playerResult.messages.join(' ') + '</div>';
                    }
                }
                break;

            case 'spell':
                // Legacy support - treat as skill
                var spellMove = params.spell || params.move;
                playerResult = playerAttack(spellMove);

                if (!playerResult.success) {
                    if (playerResult.reason === 'not_enough_mana') {
                        playerResultText += '<div class="battle-log">Not enough MP!</div>';
                        state.phase = 'player';
                        updateBattleLog(playerResultText);
                        if (callback) callback(playerResultText);
                        return;
                    }
                }

                playerResultText += formatRollMessage(state.player.name, playerResult, spellMove.name || 'Spell');
                break;

            case 'item':
                // Use new item system
                if (params.itemId) {
                    playerResult = useBattleItem(params.itemId);
                    if (!playerResult.success) {
                        playerResultText += '<div class="battle-log">' + (playerResult.messages ? playerResult.messages.join(' ') : 'Cannot use item!') + '</div>';
                        state.phase = 'player';
                        updateBattleLog(playerResultText);
                        if (callback) callback(playerResultText);
                        return;
                    }
                    playerResultText += '<div class="battle-log">' + state.player.name + ' used ' +
                        battleItems[params.itemId].name + '! ' + playerResult.messages.join(' ') + '</div>';
                } else {
                    // Legacy item support with heals param
                    playerResult = playerItem(params);
                    playerResultText += '<div class="battle-log">' + state.player.name + ' used an item! ' + playerResult.message + '</div>';
                }
                break;

            case 'limit':
                // Execute Limit Break
                playerResult = executeLimitBreak();
                if (!playerResult.success) {
                    playerResultText += '<div class="battle-log">Limit Break not ready! (' + Math.floor(state.player.limitCharge) + '%)</div>';
                    state.phase = 'player';
                    updateBattleLog(playerResultText);
                    if (callback) callback(playerResultText);
                    return;
                }
                playerResultText += '<div class="battle-log limit-break">' + playerResult.messages.join('<br>') + '</div>';
                break;

            case 'summon':
                // Summon a companion
                var summonId = params.summonId || params.summon;
                playerResult = createSummon(summonId);
                if (!playerResult.success) {
                    playerResultText += '<div class="battle-log">' + (playerResult.message || 'Cannot summon!') + '</div>';
                    state.phase = 'player';
                    updateBattleLog(playerResultText);
                    if (callback) callback(playerResultText);
                    return;
                }
                playerResultText += '<div class="battle-log summon">' + playerResult.message + '</div>';
                break;

            case 'defend':
                playerResult = playerDefend();
                playerResultText += '<div class="battle-log">' + playerResult.message + '</div>';
                break;

            case 'flee':
                playerResult = playerFlee();
                if (playerResult.success) {
                    return; // Battle ended
                }
                playerResultText += '<div class="battle-log">Tried to flee (rolled ' + playerResult.roll + ')... Couldn\'t escape!</div>';
                break;

            default:
                playerResult = playerAttack({ name: 'Attack', damage: state.player.damage || '1d6', type: 'physical' });
                playerResultText += formatRollMessage(state.player.name, playerResult, 'Attack');
        }

        updateBattleLog(playerResultText);
        updateStatusDisplay();

        // Build context for enemy taunt based on player action
        var actionContext = {
            playerAction: action,
            playerHit: playerResult && playerResult.hit,
            playerMissed: playerResult && playerResult.hit === false,
            playerCrit: playerResult && playerResult.isCrit,
            playerHealed: playerResult && (playerResult.healed || (playerResult.skill && playerResult.skill.isHeal))
        };

        // Check if player won - wait before enemy attacks
        setTimeout(function() {
            if (checkBattleEnd()) return;
            processEnemyTurn(playerResultText, callback, actionContext);
        }, 2000);
    }

    /**
     * Process enemy turn after player action
     * @param {string} playerResultText - HTML text from player's action
     * @param {function} callback - Called when turn completes
     * @param {object} actionContext - Context about player's action for enemy taunt
     */
    function processEnemyTurn(playerResultText, callback, actionContext) {
        // Show enemy taunt before attacking (with slight delay for drama)
        var taunt = getEnemyTaunt(actionContext || {});
        var tauntDelay = taunt ? 1800 : 0; // Show taunt for 1.8s before attacking

        if (taunt) {
            showBattleDialogue(state.enemy.name + ': "' + taunt + '"');
        }

        setTimeout(function() {
            if (!state.active) return;

            // === PROCESS SUMMON TURN (after player action) ===
            var summonResult = processSummonTurn();
            if (summonResult.acted && summonResult.messages.length > 0) {
                playerResultText += '<div class="battle-log summon-turn">' +
                    summonResult.messages.join('<br>') + '</div>';

                // Check if summon killed enemy
                if (checkBattleEnd()) {
                    updateBattleLog(playerResultText);
                    return;
                }
            }

            var enemyResult = enemyTurn();
            var enemyText = '';

            // === APPLY ENEMY PASSIVE EFFECTS ===
            var enemyPassiveResult = applyPassiveEffects(state.enemy, state.enemy.name);
            if (enemyPassiveResult.messages.length > 0) {
                enemyText += '<div class="battle-log enemy-turn passive">' +
                    enemyPassiveResult.messages.join('<br>') + '</div>';
                if (enemyPassiveResult.healed > 0) {
                    showDamageNumber(enemyPassiveResult.healed, 'enemy', 'heal');
                    updateEnemyHPDisplay();
                }
            }

            // Add enemy status messages
            if (enemyResult.statusMessages && enemyResult.statusMessages.length > 0) {
                enemyText += '<div class="battle-log enemy-turn status-messages">' +
                    enemyResult.statusMessages.join('<br>') + '</div>';
            }

            // Check if enemy died from status
            if (enemyResult.diedFromStatus) {
                updateBattleLog(playerResultText + enemyText);
                checkBattleEnd();
                return;
            }

            // Handle skipped turn
            if (enemyResult.skipped) {
                updateBattleLog(playerResultText + enemyText);
                state.phase = 'player';
                state.turn++;
                if (callback) callback(playerResultText + enemyText);
                return;
            }

            // Handle healing
            if (enemyResult.healed) {
                enemyText += '<div class="battle-log enemy-turn">' + state.enemy.name + ' used ' +
                    enemyResult.move.name + ' and healed for ' + enemyResult.healed + ' HP!</div>';
            }
            // Handle buff
            else if (enemyResult.buffApplied) {
                enemyText += '<div class="battle-log enemy-turn">' + state.enemy.name + ' used ' +
                    enemyResult.move.name + '! ' + (enemyResult.buffApplied.message || '') + '</div>';
            }
            // Handle attack
            else if (enemyResult.move) {
                enemyText += formatRollMessage(state.enemy.name, enemyResult, enemyResult.move.name || 'Attack');
                enemyText = enemyText.replace('battle-log">', 'battle-log enemy-turn">');

                // === CHECK DIALOGUE TRIGGERS FOR ENEMY ATTACK ===
                if (enemyResult.hit) {
                    if (enemyResult.isCrit) {
                        checkDialogueTriggers('enemy_crit');
                    } else {
                        checkDialogueTriggers('player_hit');
                    }

                    // === ADD LIMIT CHARGE WHEN HIT ===
                    var limitChargeFromHit = Math.min(15, Math.floor(enemyResult.damage * 0.8));
                    addLimitCharge(limitChargeFromHit);
                }

                // Add status effect message
                if (enemyResult.statusResult && enemyResult.statusResult.applied) {
                    enemyText += '<div class="battle-log enemy-turn">' + enemyResult.statusResult.message + '</div>';
                    checkDialogueTriggers('status_applied', { status: enemyResult.statusResult.type });
                }

                // Add stagger message
                if (enemyResult.staggered) {
                    enemyText += '<div class="battle-log enemy-turn">💫 ' + state.player.name + ' is STAGGERED!</div>';
                }

                // === APPLY THORNS PASSIVE (reflect damage) ===
                var playerBonuses = getPassiveBonuses(state.player);
                if (enemyResult.hit && playerBonuses.reflectDamage > 0) {
                    state.enemy.hp = Math.max(0, state.enemy.hp - playerBonuses.reflectDamage);
                    enemyText += '<div class="battle-log">🌵 ' + state.enemy.name + ' takes ' +
                        playerBonuses.reflectDamage + ' thorns damage!</div>';
                    showDamageNumber(playerBonuses.reflectDamage, 'enemy', 'damage');
                    updateEnemyHPDisplay();
                }
            }

            updateBattleLog(playerResultText + enemyText);

            // === CHECK MUSIC TRANSITIONS ===
            checkMusicTransitions();

            // Check if enemy won
            if (checkBattleEnd()) return;

            // === APPLY PLAYER PASSIVE EFFECTS (start of next turn) ===
            var playerPassiveResult = applyPassiveEffects(state.player, state.player.name);
            if (playerPassiveResult.healed > 0) {
                showDamageNumber(playerPassiveResult.healed, 'player', 'heal');
                updatePlayerHPDisplay();
            }
            if (playerPassiveResult.manaRestored > 0) {
                updatePlayerManaDisplay();
            }

            // Next turn
            state.phase = 'player';
            state.turn++;

            // Decay dialogue cooldown
            if (state.dialogue.cooldown > 0) {
                state.dialogue.cooldown--;
            }

            if (callback) {
                callback(playerResultText + enemyText);
            }
        }, 600 + tauntDelay);  // Add taunt delay so enemy speaks before attacking
    }

    // === Utility ===

    function playSfx(filename) {
        if (vnEngine && vnEngine.playSfx) {
            vnEngine.playSfx(filename);
        }
    }

    function isActive() {
        return state.active;
    }

    function getState() {
        return JSON.parse(JSON.stringify(state));
    }

    function setState(newState) {
        state = JSON.parse(JSON.stringify(newState));
        if (state.active) {
            showUI();
            updateDisplay();
        }
    }

    function getPlayerStats() {
        return {
            hp: state.player.hp,
            maxHP: state.player.maxHP,
            mana: state.player.mana,
            maxMana: state.player.maxMana
        };
    }

    function healPlayer(amount) {
        state.player.hp = Math.min(state.player.maxHP, state.player.hp + amount);
        if (state.active) {
            updatePlayerHPDisplay();
            showDamageNumber(amount, 'player', 'heal');
        }
    }

    function restoreMana(amount) {
        state.player.mana = Math.min(state.player.maxMana, state.player.mana + amount);
        if (state.active) updatePlayerManaDisplay();
    }

    function checkEnd() {
        return checkBattleEnd();
    }

    /**
     * Get player's available skills with mana costs
     */
    function getPlayerSkills() {
        var available = [];
        for (var i = 0; i < state.player.skills.length; i++) {
            var skillId = state.player.skills[i];
            var skill = skills[skillId];
            if (skill) {
                available.push({
                    id: skillId,
                    name: skill.name,
                    manaCost: skill.manaCost,
                    description: skill.description,
                    type: skill.type || 'physical',
                    canUse: state.player.mana >= skill.manaCost
                });
            }
        }
        return available;
    }

    /**
     * Get skill by ID
     */
    function getSkill(skillId) {
        return skills[skillId] || null;
    }

    /**
     * Get all status effect definitions
     */
    function getStatusEffects() {
        return statusEffects;
    }

    /**
     * Get terrain types
     */
    function getTerrainTypes() {
        return terrainTypes;
    }

    /**
     * Manually apply status to player or enemy (for testing/debugging)
     */
    function applyStatusTo(target, statusType, stacks) {
        var targetObj = target === 'player' ? state.player : state.enemy;
        var result = applyStatus(targetObj, statusType, stacks);
        updateStatusDisplay();
        return result;
    }

    // === Public API ===
    return {
        init: init,
        start: start,
        end: end,
        reset: reset,
        hideUI: hideUI,
        destroyUI: destroyUI,
        showUI: showUI,
        updateDisplay: updateDisplay,
        executeAction: executeAction,
        healPlayer: healPlayer,
        restoreMana: restoreMana,
        isActive: isActive,
        getState: getState,
        setState: setState,
        getPlayerStats: getPlayerStats,
        getPlayerSkills: getPlayerSkills,
        getSkill: getSkill,
        checkEnd: checkEnd,
        getTypeChart: function() { return typeChart; },
        getStatusEffects: getStatusEffects,
        getTerrainTypes: getTerrainTypes,
        applyStatusTo: applyStatusTo,

        // === Item System ===
        getAvailableItems: getAvailableBattleItems,
        getBattleItems: getAvailableBattleItems,  // Alias for engine.js
        useItem: useBattleItem,
        battleItems: battleItems,

        // === Summon System ===
        summon: createSummon,
        dismissSummon: dismissSummon,
        getSummon: function() { return state.summon; },
        summonTypes: summonTypes,

        // === Limit Break System ===
        getLimitCharge: function() { return state.player.limitCharge; },
        addLimitCharge: addLimitCharge,
        isLimitReady: isLimitReady,
        executeLimitBreak: executeLimitBreak,
        limitBreaks: limitBreaks,

        // === Passive System ===
        getPassiveBonuses: getPassiveBonuses,
        passiveTypes: passiveTypes,

        // === Dialogue System ===
        triggerDialogue: triggerDialogue,
        setDialogue: function(trigger, lines) {
            if (trigger && lines) dialogueTriggers[trigger] = lines;
        },

        // === Music System ===
        setMusicTracks: setMusicTracks,
        checkMusicTransitions: checkMusicTransitions,

        // Expose definitions for UI
        skills: skills,
        statusEffects: statusEffects,
        terrainTypes: terrainTypes
    };
})();
