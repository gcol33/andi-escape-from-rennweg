/**
 * @file Andi VN - Tuning Numbers
 * @description Centralized game feel constants for quick iteration.
 * All timing, speed, and balance values that affect "game feel" live here.
 *
 * How to use:
 *   - Adjust values below to tune game feel
 *   - Changes take effect on page reload
 *   - Group related values together for easier tweaking
 *
 * Categories:
 *   - TEXT: Typewriter, text display, dialogue
 *   - AUDIO: Music, sound effects, volume
 *   - BATTLE: Combat timing, animations, balance
 *   - UI: Transitions, feedback effects
 */

/**
 * @typedef {Object} TextSpeedConfig
 * @property {number} normal - Default reading pace (ms per char)
 * @property {number} fast - Faster but readable pace (ms per char)
 * @property {number} auto - Auto-advance speed (ms per char)
 * @property {number} skip - Instant display for read blocks
 */

/**
 * @typedef {Object} TextConfig
 * @property {TextSpeedConfig} speed - Typewriter speeds
 * @property {number} autoAdvanceDelay - ms to wait before auto-advancing
 * @property {number} skipModeDelay - ms delay between blocks in skip mode
 * @property {number} maxBlockLength - Characters before auto-splitting
 */

/**
 * @typedef {Object} AudioConfig
 * @property {number} defaultVolume - Default music volume (0-1)
 * @property {number} duckVolume - Music volume during SFX (0-1)
 * @property {number} sfxPreDelay - Pause before playing entry SFX (ms)
 * @property {number} sfxPostDelay - Pause after SFX before text starts (ms)
 * @property {number} sfxMinDuration - Minimum total SFX duration (ms)
 * @property {number} sfxRepeatGap - Gap between repeated SFX plays (ms)
 */

/**
 * @typedef {Object} BattleTimingConfig
 * @property {number} introDelay - "Battle Start!" display duration (ms)
 * @property {number} outroDelay - Victory/defeat screen duration (ms)
 * @property {number} actionDelay - Delay between action phases (ms)
 * @property {number} enemyTurnDelay - Delay before enemy takes turn (ms)
 * @property {number} damageNumberFloat - How long damage numbers float (ms)
 * @property {number} screenShake - Screen shake effect duration (ms)
 * @property {number} uiTransition - UI fade in/out transitions (ms)
 * @property {number} dialogueBubble - Enemy dialogue bubble duration (ms)
 * @property {number} fadeOut - General fade out animation time (ms)
 */

/**
 * @typedef {Object} BattleCombatConfig
 * @property {number} defendACBonus - AC bonus when defending
 * @property {number} defendManaRecoveryMin - Min mana on defend
 * @property {number} defendManaRecoveryMax - Max mana on defend
 * @property {number} defendStaggerReduction - Stagger reduced on defend
 * @property {number} critMultiplier - Damage multiplier on crit
 * @property {number} minDamage - Minimum damage per hit
 * @property {number} fleeThreshold - Roll needed to flee (d20)
 * @property {number} limitChargeMax - Max limit break charge
 * @property {number} limitChargeOnHit - Charge gained when hitting
 * @property {number} limitChargeOnTakeDamage - Charge gained when hurt
 * @property {number} staggerDecayPerTurn - Stagger decay per turn
 * @property {number} staggerThresholdDefault - Default stagger threshold
 */

/**
 * @typedef {Object} QTEZoneModifier
 * @property {number} [hitBonus] - Bonus to attack roll
 * @property {number} [damageMultiplier] - Damage multiplier
 * @property {number} [critChanceBonus] - Bonus to crit chance
 * @property {number} [damageReduction] - Damage reduction (0-1)
 * @property {boolean} [autoMiss] - Force miss on QTE failure
 * @property {boolean} [counterAttack] - Trigger counter attack
 */

/**
 * @typedef {Object} PlayerConfig
 * @property {number} defaultMaxHP - Starting max HP
 * @property {number} defaultMaxMana - Starting max mana
 * @property {number} defaultAC - Starting armor class
 * @property {number} defaultAttackBonus - Starting attack bonus
 * @property {string} defaultDamage - Starting damage dice (e.g., '1d6')
 * @property {number} defaultStaggerThreshold - Starting stagger threshold
 * @property {string} defaultLimitBreak - Default limit break ID
 * @property {string[]} defaultSkills - Starting skill IDs
 */

/**
 * Global tuning configuration object
 * @type {Object}
 */
var TUNING = (function() {
    'use strict';

    return {
        // =====================================================================
        // TEXT DISPLAY
        // =====================================================================

        text: {
            // Typewriter effect speeds (milliseconds per character)
            speed: {
                normal: 18,      // Default reading pace
                fast: 10,        // Noticeably faster but readable
                auto: 18,        // Same as normal (auto-advances when done)
                skip: 0          // Instant (only for already-read blocks)
            },

            // Auto-advance timing
            autoAdvanceDelay: 1500,     // ms to wait before auto-advancing
            skipModeDelay: 150,         // ms delay between blocks in skip mode

            // Text block limits
            maxBlockLength: 350         // Characters before auto-splitting
        },

        // =====================================================================
        // AUDIO
        // =====================================================================

        audio: {
            // Music
            defaultVolume: 0.16,        // 16% volume (reduced 60% from original 40%)
            duckVolume: 0.2,            // Music volume during SFX (20%)

            // Sound effects timing
            sfxPreDelay: 150,           // Pause before playing entry SFX
            sfxPostDelay: 200,          // Pause after SFX before text starts
            sfxMinDuration: 620,        // Minimum total SFX duration
            sfxRepeatGap: 150           // Gap between repeated SFX plays
        },

        // =====================================================================
        // BATTLE SYSTEM
        // =====================================================================

        battle: {
            // === Turn Flow Timing ===
            timing: {
                introDelay: 1500,           // "Battle Start!" display duration
                outroDelay: 2500,           // Victory/defeat screen duration
                actionDelay: 300,           // Delay between action phases
                enemyTurnDelay: 600,        // Delay before enemy takes turn
                damageNumberFloat: 4000,    // How long damage numbers float up (matches CSS animation)
                screenShake: 300,           // Screen shake effect duration
                uiTransition: 1500,         // UI fade in/out transitions
                dialogueBubble: 2500,       // Enemy dialogue bubble duration
                fadeOut: 300,               // General fade out animation time
                messageLingerDelay: 2200    // How long battle log messages linger before next message
            },

            // === Dice Roll Animation ===
            dice: {
                spinDuration: 1800,         // Total dice spin animation time
                spinInterval: 70,           // Time between number changes
                lingerDelay: 500,           // Pause after reveal before continuing
                typewriterSpeed: 25         // Characters per second in battle log
            },

            // === Visual Effects ===
            effects: {
                sparkleInterval: 150,       // Interval between victory sparkles
                sparkleLifetime: 2000,      // How long each sparkle lives
                spriteFlash: 300            // Sprite damage flash duration
            },

            // === Combat Balance ===
            combat: {
                // Defense
                defendACBonus: 4,               // AC bonus when defending
                defendManaRecoveryMin: 2,       // Min mana on defend
                defendManaRecoveryMax: 4,       // Max mana on defend
                defendStaggerReduction: 15,     // Stagger reduced on defend

                // Damage
                critMultiplier: 2,              // Damage multiplier on crit
                minDamage: 1,                   // Minimum damage per hit

                // Escape
                fleeThreshold: 10,              // Roll needed to flee (d20)

                // Limit Break
                limitChargeMax: 10,             // Max limit break charge
                limitChargeOnHit: 5,            // Charge gained when hitting
                limitChargeOnTakeDamage: 8,     // Charge gained when hurt

                // Stagger
                staggerDecayPerTurn: 15,        // Stagger decay per turn
                staggerThresholdDefault: 100    // Default stagger threshold
            },

            // === HP Thresholds (for UI colors) ===
            hpThresholds: {
                high: 50,       // Above = green/healthy
                medium: 25,     // Above = yellow/caution
                low: 25         // Below = red/critical
            },

            // === Enemy AI ===
            ai: {
                healThreshold: 0.3,         // Heal when HP below 30%
                buffThreshold: 0.7,         // Buff when HP above 70%
                aggroHealThreshold: 0.25,   // Aggressive: only heal below 25%
                dialogueChance: 0.4,        // 40% chance enemy says something
                tauntCooldown: 2            // Turns between taunts
            },

            // === Barrier System ===
            // Enemy shields that absorb hits before HP damage
            barrier: {
                damageReduction: 1.0,       // 1.0 = full damage blocked while barrier up
                stacksPerHit: 1,            // Stacks removed per hit (multi-hit removes more)
                defaultStacks: 3,           // Default barrier stacks for enemies
                maxStacks: 6,               // Maximum barrier stacks possible
                breakStagger: 30            // Bonus stagger when barrier breaks
            }
        },

        // =====================================================================
        // UI EFFECTS
        // =====================================================================

        ui: {
            // General timing
            errorFlash: 300,                // Error flash animation duration

            // Battle log sizing
            battleLogMaxLines: 2,           // Max lines visible in battle log
            battleLogLineHeight: 1.6,       // Height per line in rem (must match CSS line-height)

            // Damage numbers (WoW-style floating text)
            damageNumberDuration: 4000,     // How long damage numbers show (matches CSS animation)
            damageNumberFontSize: 1,        // Font size in rem (1 = normal text size)
            critFontSize: 1.4,              // Crit damage font size in rem
            labelFontSize: 0.85,            // Hit/Crit label font size in rem

            // Battle log dice colors (CSS variables in shared.css)
            // --battle-hit-dice-color: #ffd700 (yellow) - d20 attack/hit rolls
            // --battle-damage-dice-color: #ff4444 (red) - damage dice rolls

            // Password screen
            lockoutDuration: 5000,          // Lockout duration (5 seconds)
            maxPasswordAttempts: 3,         // Attempts before lockout

            // Ken Burns effect
            kenBurnsScale: 1.08,            // Max zoom factor
            kenBurnsDuration: 20000         // Full animation cycle (ms)
        },

        // =====================================================================
        // DEFAULT PLAYER STATS
        // =====================================================================

        player: {
            defaultMaxHP: 20,
            defaultMaxMana: 10,
            defaultAC: 10,
            defaultAttackBonus: 2,
            defaultDamage: '1d6',
            defaultStaggerThreshold: 100,
            defaultLimitBreak: 'overdrive',
            defaultSkills: ['power_strike', 'fireball', 'heal', 'fortify']
        },

        // =====================================================================
        // DEFAULT ENEMY STATS
        // =====================================================================

        enemy: {
            defaultHP: 20,
            defaultMaxMana: 20,          // For enemies that use mana
            defaultAC: 12,
            defaultAttackBonus: 3,
            defaultDamage: '1d6',
            defaultStaggerThreshold: 80,
            defaultAI: 'default'
        },

        // =====================================================================
        // QTE SYSTEM (Quick Time Events)
        // =====================================================================
        //
        // Finalized Battle System QTE - Skill-gated with advantage mechanics.
        //
        // SKILLS: QTE before roll → affects accuracy AND damage rolls
        //   - Perfect: Advantage + Bonus Damage
        //   - Good: Advantage (roll twice, take best)
        //   - Normal: Standard roll
        //   - Bad: Disadvantage (roll twice, take worst)
        //
        // DEFEND: QTE on enemy turn (only when player is defending)
        //   - Perfect: Parry (0 damage + counter damage)
        //   - Good: Dodge (0 damage)
        //   - Normal: Defend bonus persists (damage halved)
        //   - Bad: Defend immediately ends (no bonus)
        //
        // ATTACK: No QTE (reliable chip damage for barriers)
        //
        // Visual styling is theme-aware - colors come from CSS variables.
        //

        qte: {
            // === Global QTE Settings ===
            enabled: true,                  // Master toggle for QTE system
            enabledForSkills: true,         // QTE on skills (NEW)
            enabledForDefend: true,         // QTE on enemy turn when defending (NEW)
            enabledForAttacks: false,       // Attack = no QTE (reliable)
            enabledForDodge: true,          // Legacy - kept for compatibility

            // === Timing Bar Settings ===
            bar: {
                duration: 2000,             // Time for one full pass (ms)
                oscillations: 2,            // Number of back-and-forth cycles
                markerSpeed: 1.0,           // Speed multiplier
                oscillating: false          // Style 6: oscillating speed variant
            },

            // === Zone Sizes (% from center) ===
            // Finalized 4-tier system: Perfect / Good / Normal / Bad
            // Total bar is 100%, center is at 50%
            zones: {
                perfect: 5,                 // ±5% = 10% total (blue, tiny center)
                good: 15,                   // ±15% = 30% total (green)
                normal: 30,                 // ±30% = 60% total (yellow)
                // Remaining 40% = bad zone (red, outer edges)

                // Legacy mapping (for backward compatibility)
                success: 15,                // Maps to 'good'
                partial: 30                 // Maps to 'normal'
            },

            // === Result Modifiers ===
            // How QTE result affects combat calculations

            // SKILL QTE (player using skills) - NEW FINALIZED SYSTEM
            skillModifiers: {
                perfect: {
                    advantage: true,        // Roll twice, take best
                    bonusDamage: 0.25,      // +25% damage
                    bonusHealing: 0.25,     // +25% healing for heal skills
                    statusChanceBonus: 0.2  // +20% status application chance
                },
                good: {
                    advantage: true,        // Roll twice, take best
                    bonusDamage: 0,
                    bonusHealing: 0,
                    statusChanceBonus: 0.1
                },
                normal: {
                    advantage: false,       // Standard roll
                    bonusDamage: 0,
                    bonusHealing: 0,
                    statusChanceBonus: 0
                },
                bad: {
                    disadvantage: true,     // Roll twice, take worst
                    bonusDamage: -0.25,     // -25% damage
                    bonusHealing: -0.25,    // -25% healing
                    statusChanceBonus: -0.2 // -20% status chance
                }
            },

            // DEFEND QTE (enemy attacking while player defends) - NEW FINALIZED SYSTEM
            defendModifiers: {
                perfect: {
                    result: 'parry',        // Parry: 0 damage + counter
                    damageReduction: 1.0,   // Full block
                    counterAttack: true,    // Deal counter damage
                    counterDamagePercent: 0.5, // Counter = 50% of blocked damage
                    defendEnds: false       // Defend persists
                },
                good: {
                    result: 'dodge',        // Dodge: 0 damage
                    damageReduction: 1.0,   // Full dodge
                    counterAttack: false,
                    defendEnds: false       // Defend persists
                },
                normal: {
                    result: 'block',        // Block: damage halved
                    damageReduction: 0.5,   // 50% reduction
                    counterAttack: false,
                    defendEnds: false       // Defend persists
                },
                bad: {
                    result: 'broken',       // Guard broken
                    damageReduction: 0,     // Full damage
                    counterAttack: false,
                    defendEnds: true        // Defend immediately ends!
                }
            },

            // Accuracy QTE (legacy - kept for backward compatibility)
            accuracyModifiers: {
                perfect: {
                    hitBonus: 5,            // +5 to attack roll
                    damageMultiplier: 1.25, // 25% more damage
                    critChanceBonus: 0.15   // +15% crit chance
                },
                success: {
                    hitBonus: 0,            // Normal attack
                    damageMultiplier: 1.0,
                    critChanceBonus: 0
                },
                partial: {
                    hitBonus: -3,           // -3 to attack roll
                    damageMultiplier: 0.75, // 25% less damage
                    critChanceBonus: 0
                },
                miss: {
                    hitBonus: -10,          // Very likely to miss
                    damageMultiplier: 0.5,  // Half damage if somehow hits
                    critChanceBonus: 0,
                    autoMiss: true          // Force miss on QTE failure
                }
            },

            // Dodge QTE (legacy - kept for backward compatibility)
            dodgeModifiers: {
                perfect: {
                    damageReduction: 1.0,   // Full dodge (0% damage taken)
                    counterAttack: true     // Trigger counter attack
                },
                success: {
                    damageReduction: 0.5,   // 50% damage reduction
                    counterAttack: false
                },
                partial: {
                    damageReduction: 0.25,  // 25% damage reduction
                    counterAttack: false
                },
                miss: {
                    damageReduction: 0,     // Full damage taken
                    counterAttack: false
                }
            },

            // === Combo System (Optional Enhancement) ===
            combo: {
                enabled: false,             // Directional combo inputs
                maxInputs: 3,               // Number of inputs required
                inputWindow: 500,           // ms allowed per input
                bonusDamage: 0.1            // 10% bonus per successful input
            },

            // === Timing ===
            timing: {
                startDelay: 300,            // Delay before QTE starts
                resultDisplay: 800,         // Show result duration
                fadeOut: 200                // Fade out animation time
            },

            // === Difficulty Presets (for skill-based QTE scaling) ===
            difficulty: {
                easy: { zoneMultiplier: 1.5, speedMultiplier: 0.7 },
                normal: { zoneMultiplier: 1.0, speedMultiplier: 1.0 },
                hard: { zoneMultiplier: 0.7, speedMultiplier: 1.3 },
                veryHard: { zoneMultiplier: 0.5, speedMultiplier: 1.5 }
            },

            // === Visual Settings ===
            visual: {
                showZoneLabels: false,      // Show "PERFECT" etc on zones
                markerPulse: true,          // Pulse effect on marker
                screenFlash: true           // Flash screen on result
            },

            // === Sound Effects ===
            sfx: {
                start: 'alert.ogg',         // QTE appears
                perfect: 'success.ogg',     // Perfect timing
                good: 'click.ogg',          // Good timing (NEW)
                success: 'click.ogg',       // Legacy alias
                normal: 'neutral.ogg',      // Normal timing (NEW)
                partial: 'negative.ogg',    // Legacy alias
                bad: 'failure.ogg',         // Bad timing (NEW)
                miss: 'failure.ogg',        // Legacy alias
                parry: 'parry.ogg',         // Parry success (NEW)
                dodge: 'dodge.ogg'          // Dodge success (NEW)
            }
        },

        // =====================================================================
        // OVERWORLD SYSTEM (Pokemon-style top-down movement)
        // =====================================================================

        overworld: {
            // === Tile Settings ===
            tileSize: 16,               // Pixel size of each tile (16x16 Zelda-style)
            renderScale: 2,             // Scale up for display (16*2 = 32px rendered)
            viewportTilesX: 15,         // Tiles visible horizontally
            viewportTilesY: 11,         // Tiles visible vertically

            // === Movement ===
            moveSpeed: 4,               // Pixels per frame during movement
            walkAnimSpeed: 8,           // Frames between walk animation changes
            runSpeedMultiplier: 2,      // Speed when running (hold shift)

            // === Random Encounters ===
            encounterCheckDelay: 500,   // ms delay after stepping in grass
            minStepsBetweenEncounters: 5,

            // === Camera ===
            cameraSmoothing: 0.1,       // Camera follow smoothing (0-1)

            // === Input ===
            inputRepeatDelay: 150,      // ms before key repeat starts
            inputRepeatRate: 50         // ms between repeated inputs
        }
    };
})();

/**
 * Helper function to get nested tuning value with fallback
 * @param {string} path - Dot-separated path like 'battle.timing.introDelay'
 * @param {*} fallback - Default value if path not found
 */
TUNING.get = function(path, fallback) {
    var parts = path.split('.');
    var value = TUNING;
    for (var i = 0; i < parts.length; i++) {
        if (value && typeof value === 'object' && parts[i] in value) {
            value = value[parts[i]];
        } else {
            return fallback;
        }
    }
    return value;
};
