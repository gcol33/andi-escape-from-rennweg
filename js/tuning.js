/**
 * Andi VN - Tuning Numbers
 *
 * Centralized game feel constants for quick iteration.
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
            defaultVolume: 0.4,         // 40% volume by default
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
                damageNumberFloat: 2000,    // How long damage numbers float up
                screenShake: 300,           // Screen shake effect duration
                uiTransition: 1500,         // UI fade in/out transitions
                dialogueBubble: 2500,       // Enemy dialogue bubble duration
                fadeOut: 300                // General fade out animation time
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
                limitChargeMax: 100,            // Max limit break charge
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
            }
        },

        // =====================================================================
        // UI EFFECTS
        // =====================================================================

        ui: {
            // General timing
            errorFlash: 300,                // Error flash animation duration

            // Battle log
            battleLogMaxLines: 2,           // Max lines in battle log (oldest removed first)
            battleLogLineHeight: 2.2,       // Line height in rem units for scalability

            // Damage numbers
            damageNumberDuration: 1500,     // How long damage numbers show

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
            defaultMaxMana: 20,
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
        // Expedition 33-inspired timing system for battle combat.
        // Player Turn: Accuracy QTE affects hit chance and damage
        // Enemy Turn: Dodge QTE affects damage reduction
        //
        // Visual styling is theme-aware - colors come from CSS variables.
        //

        qte: {
            // === Global QTE Settings ===
            enabled: true,                  // Master toggle for QTE system
            enabledForAttacks: true,        // QTE on player attacks
            enabledForDodge: true,          // QTE on enemy attacks

            // === Timing Bar Settings ===
            bar: {
                duration: 2000,             // Time for one full pass (ms)
                oscillations: 2,            // Number of back-and-forth cycles
                markerSpeed: 1.0            // Speed multiplier
            },

            // === Zone Sizes (% from center) ===
            // These define the size of each zone
            // Total bar is 100%, center is at 50%
            zones: {
                perfect: 5,                 // ±5% = 10% total (blue, tiny center)
                success: 20,                // ±20% = 40% total (green, main hit zone)
                partial: 35                 // ±35% = 70% total (yellow, glancing)
                // Remaining 30% = miss zone (red, outer edges)
            },

            // === Result Modifiers ===
            // How QTE result affects combat calculations

            // Accuracy QTE (player attacking)
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

            // Dodge QTE (enemy attacking player)
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
                success: 'click.ogg',       // Good timing
                partial: 'negative.ogg',    // Partial success
                miss: 'failure.ogg'         // Missed
            }
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
