/**
 * Andi VN - QTE System Module
 *
 * Expedition 33-inspired Quick Time Event system for battle combat.
 * Integrates with BattleEngine to add skill-based timing elements.
 *
 * Features:
 *   - Player Turn QTE: Accuracy timing bar for attack/skill hits
 *   - Enemy Turn QTE: Dodge/Parry timing bar for defense
 *   - Sliding marker precision meter (Style 5)
 *   - Zone-based results: Miss / Partial / Hit / Perfect
 *   - Optional directional combo inputs (Style 6 enhancement)
 *
 * Architecture:
 *   - QTEEngine: Core logic (no DOM manipulation)
 *   - QTEUI: Visual rendering (separate module)
 *   - Integrates via hooks in BattleEngine
 *
 * Usage:
 *   QTEEngine.init(battleEngine);
 *   QTEEngine.startAccuracyQTE(params, callback);
 *   QTEEngine.startDodgeQTE(params, callback);
 */

var QTEEngine = (function() {
    'use strict';

    // === Logging ===
    // Use Logger module with fallback (safe for test environments without Utils)
    var _log = (function() {
        // Try Utils.getLogger() first
        if (typeof Utils !== 'undefined' && typeof Utils.getLogger === 'function') {
            return Utils.getLogger();
        }
        // Try Logger directly
        if (typeof Logger !== 'undefined') {
            return Logger;
        }
        // Fallback for test environments
        return {
            debug: function() {},
            info: function() { console.log.apply(console, arguments); },
            warn: function() { console.warn.apply(console, arguments); },
            error: function() { console.error.apply(console, arguments); }
        };
    })();

    // === Configuration ===
    // Values sourced from TUNING.js when available
    var T = typeof TUNING !== 'undefined' ? TUNING : null;
    var qteConfig = T && T.qte ? T.qte : null;

    var config = {
        // Timing bar settings
        bar: {
            duration: qteConfig ? qteConfig.bar.duration : 2000,        // Total time for one pass
            oscillations: qteConfig ? qteConfig.bar.oscillations : 2,   // Back-and-forth cycles
            markerSpeed: qteConfig ? qteConfig.bar.markerSpeed : 1.0    // Speed multiplier
        },

        // Zone sizes (percentages of bar width, from center)
        // Note: TUNING.qte.zones is the source of truth, these are fallbacks
        zones: {
            perfect: qteConfig && qteConfig.zones ? qteConfig.zones.perfect : 10,  // ±10% = center (blue)
            good: qteConfig && qteConfig.zones ? qteConfig.zones.good : 25,        // ±25% (green) - finalized name
            normal: qteConfig && qteConfig.zones ? qteConfig.zones.normal : 40,    // ±40% (yellow) - finalized name
            // Legacy aliases for backward compatibility
            success: qteConfig && qteConfig.zones ? qteConfig.zones.success : 25,  // Maps to 'good'
            partial: qteConfig && qteConfig.zones ? qteConfig.zones.partial : 40   // Maps to 'normal'
            // Remaining = bad zone (red)
        },

        // Result modifiers
        modifiers: {
            // Accuracy QTE (player attack)
            accuracy: {
                perfect: { hitBonus: 5, damageMultiplier: 1.25, critChanceBonus: 0.15 },
                success: { hitBonus: 0, damageMultiplier: 1.0, critChanceBonus: 0 },
                partial: { hitBonus: -3, damageMultiplier: 0.75, critChanceBonus: 0 },
                miss: { hitBonus: -10, damageMultiplier: 0.5, critChanceBonus: 0, autoMiss: true }
            },
            // Dodge QTE (enemy attack)
            dodge: {
                perfect: { damageReduction: 1.0, counterAttack: true },   // Full dodge + counter
                success: { damageReduction: 0.5, counterAttack: false },  // 50% damage reduction
                partial: { damageReduction: 0.25, counterAttack: false }, // 25% reduction
                miss: { damageReduction: 0, counterAttack: false }        // Full damage
            },
            // Parry QTE (Exp33 style - tighter timing, bigger reward)
            parry: {
                perfect: { damageReduction: 1.0, counterAttack: true, counterDamageMultiplier: 1.5, staggerBonus: 30 },
                success: { damageReduction: 0.75, counterAttack: true, counterDamageMultiplier: 0.5, staggerBonus: 15 },
                partial: { damageReduction: 0.25, counterAttack: false, staggerBonus: 5 },
                miss: { damageReduction: 0, counterAttack: false, guardBroken: true }  // Failed parry = guard broken
            },
            // Guard Break QTE (when guard is about to break)
            guardBreak: {
                perfect: { guardRestored: true, damageReduction: 1.0, momentumBonus: 20 },
                success: { guardRestored: true, damageReduction: 0.5, momentumBonus: 10 },
                partial: { guardRestored: false, damageReduction: 0.25, momentumBonus: 0 },
                miss: { guardRestored: false, damageReduction: 0, stunned: true }  // Guard breaks, player stunned
            },
            // Chain Combo QTE (multi-hit attacks in Exp33)
            chainCombo: {
                perfect: { hitsLanded: 'all', damageMultiplier: 1.5, momentumBonus: 25 },
                success: { hitsLanded: 'most', damageMultiplier: 1.0, momentumBonus: 15 },
                partial: { hitsLanded: 'some', damageMultiplier: 0.75, momentumBonus: 5 },
                miss: { hitsLanded: 'few', damageMultiplier: 0.5, momentumBonus: 0 }
            }
        },

        // Combo inputs (for enhanced QTE)
        combo: {
            enabled: qteConfig ? qteConfig.combo.enabled : false,
            maxInputs: qteConfig ? qteConfig.combo.maxInputs : 3,
            inputWindow: qteConfig ? qteConfig.combo.inputWindow : 500,  // ms per input
            directions: ['up', 'down', 'left', 'right']
        },

        // Difficulty scaling
        difficulty: {
            easy: { zoneMultiplier: 1.5, speedMultiplier: 0.7 },
            normal: { zoneMultiplier: 1.0, speedMultiplier: 1.0 },
            hard: { zoneMultiplier: 0.7, speedMultiplier: 1.3 }
        },

        // Timing
        timing: {
            startDelay: qteConfig ? qteConfig.timing.startDelay : 300,      // Delay before QTE starts
            resultDisplay: qteConfig ? qteConfig.timing.resultDisplay : 800, // Show result duration
            fadeOut: qteConfig ? qteConfig.timing.fadeOut : 200,            // Fade out time
            countdownDuration: qteConfig && qteConfig.timing.countdownDuration ? qteConfig.timing.countdownDuration : 5
        }
    };

    // === State ===
    var state = {
        active: false,
        type: null,           // 'accuracy' or 'dodge'
        phase: 'idle',        // 'idle', 'waiting', 'running', 'input', 'result'
        markerPosition: 0,    // 0-100 (center = 50)
        markerDirection: 1,   // 1 = right, -1 = left
        targetPosition: 50,   // Random target for perfect zone (10-90%)
        startTime: 0,
        inputTime: null,      // When player pressed
        result: null,         // 'perfect', 'success', 'partial', 'miss'
        combo: {
            required: [],     // Required inputs for combo
            entered: [],      // Player's inputs
            currentIndex: 0
        },
        callback: null,       // Called when QTE completes
        animationFrame: null,
        timeoutId: null,      // Track pending timeout for cleanup
        difficulty: 'normal'
    };

    // === Countdown State ===
    var countdown = {
        remaining: 0,         // Seconds remaining
        timerId: null,        // Timer ID for interval
        onTick: null,         // Callback when countdown ticks
        onTimeout: null       // Callback when countdown reaches 0
    };

    // Reference to battle engine
    var battleEngine = null;

    // Reference to UI module
    var qteUI = null;

    // === Initialization ===

    /**
     * Initialize the QTE engine
     * @param {object} engine - Reference to BattleEngine
     */
    function init(engine) {
        battleEngine = engine;
        if (typeof QTEUI !== 'undefined') {
            qteUI = QTEUI;
        }
        // Bind input handlers (click, space, touch)
        bindInputs();
    }

    /**
     * Set the UI module reference
     * @param {object} ui - Reference to QTEUI
     */
    function setUI(ui) {
        qteUI = ui;
    }

    /**
     * Set difficulty level
     * @param {string} level - 'easy', 'normal', or 'hard'
     */
    function setDifficulty(level) {
        if (config.difficulty[level]) {
            state.difficulty = level;
        }
    }

    // === Core QTE Logic ===

    /**
     * Calculate zone for a given position (legacy 4-tier system)
     * @param {number} position - Marker position (0-100, center = 50)
     * @returns {string} - 'perfect', 'success', 'partial', or 'miss'
     */
    function getZoneForPosition(position) {
        var distanceFromCenter = Math.abs(position - 50);
        var diffMod = config.difficulty[state.difficulty];
        var zoneMult = diffMod ? diffMod.zoneMultiplier : 1;

        // Scale zones by difficulty
        var perfectZone = config.zones.perfect * zoneMult;
        var successZone = config.zones.success * zoneMult;
        var partialZone = config.zones.partial * zoneMult;

        if (distanceFromCenter <= perfectZone) {
            return 'perfect';
        } else if (distanceFromCenter <= successZone) {
            return 'success';
        } else if (distanceFromCenter <= partialZone) {
            return 'partial';
        } else {
            return 'miss';
        }
    }

    /**
     * Calculate zone for finalized battle system (Perfect/Good/Normal/Bad)
     * Uses distance from random target position (not fixed center)
     * @param {number} position - Marker position (0-100)
     * @returns {string} - 'perfect', 'good', 'normal', or 'bad'
     */
    function getZoneForPositionFinalized(position) {
        // Distance from the random target position
        var distanceFromTarget = Math.abs(position - state.targetPosition);
        var diffMod = config.difficulty[state.difficulty];
        var zoneMult = diffMod ? diffMod.zoneMultiplier : 1;

        // Apply zone scale (defend QTE uses 0.7, skill uses 1.0)
        var zoneScale = state.zoneScale || 1;

        // Use finalized zone names from config (already sourced from TUNING)
        var perfectZone = (config.zones.perfect || 10) * zoneMult * zoneScale;
        var goodZone = (config.zones.good || config.zones.success || 25) * zoneMult * zoneScale;
        var normalZone = (config.zones.normal || config.zones.partial || 40) * zoneMult * zoneScale;

        if (distanceFromTarget <= perfectZone) {
            return 'perfect';
        } else if (distanceFromTarget <= goodZone) {
            return 'good';
        } else if (distanceFromTarget <= normalZone) {
            return 'normal';
        } else {
            return 'bad';
        }
    }

    /**
     * Update marker position based on elapsed time using requestAnimationFrame.
     *
     * Uses sine wave oscillation to move marker smoothly across the timing bar.
     * The marker position (0-100) represents percentage from left edge.
     *
     * Supports two animation modes:
     *   - Style 5 (default): Standard smooth sine wave oscillation
     *     - Marker moves at constant speed, reversing direction at edges
     *     - Position calculated as: 50 + sin(phase) * 50
     *
     *   - Style 6: Oscillating speed variant (speeds up/slows down)
     *     - Marker speed varies based on nested sine wave
     *     - Creates more challenging, unpredictable timing
     *     - Enabled via config.bar.oscillating or state.oscillatingMode
     *
     * Math explanation (Style 5):
     *   - cycleTime = duration / oscillations (ms per one-way sweep)
     *   - phase = (adjustedTime / cycleTime) * PI
     *   - position = 50 + sin(phase) * 50
     *   - sin(0) = 0, sin(PI/2) = 1, sin(PI) = 0, sin(3PI/2) = -1
     *   - So: position oscillates 0 → 100 → 0 → etc.
     *
     * @private
     * @returns {void}
     */
    function updateMarkerPosition() {
        if (!state.active || state.phase !== 'running') return;

        var now = performance.now();
        var elapsed = now - state.startTime;
        var diffMod = config.difficulty[state.difficulty];
        var speedMult = diffMod ? diffMod.speedMultiplier : 1;

        var cycleTime = config.bar.duration / config.bar.oscillations;
        var adjustedTime = elapsed * speedMult * config.bar.markerSpeed;

        // Check if we're using oscillating speed variant (Style 6)
        var useOscillating = state.oscillatingMode || (config.bar && config.bar.oscillating);

        if (useOscillating) {
            // Style 6: Oscillating speed - marker speeds up and slows down
            // Uses a combination of sine waves for variable speed
            var basePhase = (adjustedTime / cycleTime) * Math.PI;
            var speedOscillation = 1 + 0.5 * Math.sin(basePhase * 2); // Speed varies 0.5x to 1.5x
            var modifiedPhase = basePhase * speedOscillation;

            // Add some unpredictability near the edges
            var edgeFactor = Math.sin(adjustedTime / 500) * 0.1;
            state.markerPosition = 50 + (Math.sin(modifiedPhase) * (50 + edgeFactor * 10));
        } else {
            // Style 5: Standard smooth sine wave
            var phase = (adjustedTime / cycleTime) * Math.PI;
            state.markerPosition = 50 + (Math.sin(phase) * 50);
        }

        // Clamp to 0-100
        state.markerPosition = Math.max(0, Math.min(100, state.markerPosition));

        // Update UI if available
        if (qteUI && typeof qteUI.updateMarker === 'function') {
            qteUI.updateMarker(state.markerPosition);
        }

        // Continue animation loop
        if (state.active && state.phase === 'running') {
            state.animationFrame = requestAnimationFrame(updateMarkerPosition);
        }
    }

    /**
     * Handle player input (tap/click/keypress)
     */
    function handleInput() {
        // Guard against rapid double-input race condition
        if (!state.active || state.phase !== 'running') return;

        // Route to finalized battle handler for skill/defend QTEs
        // These handlers manage their own phase transition
        if (state.type === 'skill' || state.type === 'defend') {
            handleInputFinalized();
            return;
        }

        // Route to chain combo handler if in chain combo mode
        if (state.type === 'chainCombo') {
            handleChainInput();
            return;
        }

        // Set phase AFTER routing to prevent race condition with sub-handlers
        state.phase = 'input';
        state.inputTime = performance.now();

        // Stop animation
        if (state.animationFrame) {
            cancelAnimationFrame(state.animationFrame);
            state.animationFrame = null;
        }

        // Determine result based on marker position
        state.result = getZoneForPosition(state.markerPosition);

        // Show result in UI
        if (qteUI) {
            qteUI.showResult(state.result, state.markerPosition);
        }

        // Delay before completing (show result) - track timeout for cleanup
        state.timeoutId = setTimeout(function() {
            state.timeoutId = null;
            completeQTE();
        }, config.timing.resultDisplay);
    }

    /**
     * Handle timeout (player didn't input in time)
     */
    function handleTimeout() {
        if (!state.active || state.phase !== 'running') return;

        state.phase = 'timeout';
        state.result = 'miss';

        if (state.animationFrame) {
            cancelAnimationFrame(state.animationFrame);
            state.animationFrame = null;
        }

        if (qteUI) {
            qteUI.showResult('miss', state.markerPosition);
        }

        // Track timeout for cleanup
        state.timeoutId = setTimeout(function() {
            state.timeoutId = null;
            completeQTE();
        }, config.timing.resultDisplay);
    }

    /**
     * Complete the QTE and return result to caller
     */
    function completeQTE() {
        // Zone scaling is now via state.zoneScale, no config mutation to restore

        var result = {
            type: state.type,
            zone: state.result,
            position: state.markerPosition,
            modifiers: getResultModifiers()
        };

        // Add chain combo specific data
        if (state.type === 'chainCombo' && state.chainCombo) {
            result.chainData = {
                totalHits: state.chainCombo.totalHits,
                hitsLanded: state.chainCombo.hitsLanded,
                results: state.chainCombo.results
            };
        }

        // Clean up UI
        if (qteUI) {
            qteUI.hide();
        }

        // Reset state
        var callback = state.callback;
        resetState();

        // Invoke callback with result
        if (callback) {
            callback(result);
        }
    }

    /**
     * Get modifiers based on QTE result
     * @returns {object} - Modifier values for battle calculation
     */
    function getResultModifiers() {
        var modType = state.type === 'accuracy' ? 'accuracy' : 'dodge';
        var zone = state.result || 'miss';
        return config.modifiers[modType][zone] || config.modifiers[modType].miss;
    }

    /**
     * Reset QTE state
     */
    function resetState() {
        if (state.animationFrame) {
            cancelAnimationFrame(state.animationFrame);
        }

        // Clear any pending timeouts (single tracked)
        if (state.timeoutId) {
            clearTimeout(state.timeoutId);
            state.timeoutId = null;
        }

        // Clear all pending timeouts (array)
        if (state.pendingTimeouts && state.pendingTimeouts.length > 0) {
            for (var i = 0; i < state.pendingTimeouts.length; i++) {
                clearTimeout(state.pendingTimeouts[i]);
            }
            state.pendingTimeouts = [];
        }

        state.active = false;
        state.type = null;
        state.phase = 'idle';
        state.markerPosition = 0;
        state.markerDirection = 1;
        state.targetPosition = 50;
        state.zoneScale = 1.0;
        state.startTime = 0;
        state.inputTime = null;
        state.result = null;
        state.callback = null;
        state.animationFrame = null;
        state.chainCombo = null;     // For chain combo state
        state.combo = {
            required: [],
            entered: [],
            currentIndex: 0
        };
    }

    /**
     * Full cleanup - call when battle ends or game resets
     * Removes all event listeners and clears state
     */
    function cleanup() {
        // Stop countdown FIRST - unconditionally to prevent orphaned intervals
        stopCountdown();

        // Cancel any running QTE
        if (state.active) {
            cancel();
        }

        // Unbind all input handlers
        unbindInputs();

        // Clear any pending animation frames
        if (state.animationFrame) {
            cancelAnimationFrame(state.animationFrame);
            state.animationFrame = null;
        }

        // Clear any pending timeouts
        if (state.timeoutId) {
            clearTimeout(state.timeoutId);
            state.timeoutId = null;
        }

        // Reset state to idle
        resetState();
    }

    // === Countdown Management ===

    /**
     * Start the countdown timer (5,4,3,2,1 then auto-commit)
     * @param {number} seconds - Starting countdown value (default 5)
     * @param {object} callbacks - { onTick, onTimeout }
     */
    function startCountdown(seconds, callbacks) {
        callbacks = callbacks || {};
        countdown.remaining = seconds || 5;
        countdown.onTick = callbacks.onTick || null;
        countdown.onTimeout = callbacks.onTimeout || null;

        // Notify UI of initial value
        if (qteUI && qteUI.updateCountdownDisplay) {
            qteUI.updateCountdownDisplay(countdown.remaining);
        }

        // Use TimerManager if available, otherwise fallback to setInterval
        var tickFn = function() {
            countdown.remaining--;

            // Notify UI of tick
            if (qteUI && qteUI.updateCountdownDisplay) {
                qteUI.updateCountdownDisplay(countdown.remaining);
            }

            // Notify callback if provided
            if (countdown.onTick) {
                countdown.onTick(countdown.remaining);
            }

            // Check for timeout (after showing 1, commit when it reaches 0)
            if (countdown.remaining <= 0) {
                stopCountdown();

                // Auto-commit at current position if still running
                if (state.phase === 'running') {
                    if (state.type === 'skill' || state.type === 'defend') {
                        handleTimeoutFinalized();
                    } else {
                        handleTimeout();
                    }
                }

                // Notify timeout callback
                if (countdown.onTimeout) {
                    countdown.onTimeout();
                }
            }
        };

        if (typeof TimerManager !== 'undefined') {
            countdown.timerId = TimerManager.setInterval(tickFn, 1000, 'qte-countdown');
        } else {
            countdown.timerId = setInterval(tickFn, 1000);
        }
    }

    /**
     * Stop the countdown timer
     */
    function stopCountdown() {
        if (countdown.timerId) {
            if (typeof TimerManager !== 'undefined') {
                TimerManager.clear(countdown.timerId);
            } else {
                clearInterval(countdown.timerId);
            }
            countdown.timerId = null;
        }
        countdown.remaining = 0;
        countdown.onTick = null;
        countdown.onTimeout = null;
    }

    /**
     * Get current countdown remaining
     * @returns {number} Seconds remaining
     */
    function getCountdownRemaining() {
        return countdown.remaining;
    }

    /**
     * Check if countdown is active
     * @returns {boolean}
     */
    function isCountdownActive() {
        return countdown.timerId !== null;
    }

    // === Public QTE Starters ===

    /**
     * Start an accuracy QTE (player attacking)
     * @param {object} params - { difficulty, comboEnabled, onComplete }
     * @param {function} callback - Called with result when complete
     */
    function startAccuracyQTE(params, callback) {
        if (state.active) {
            _log.warn('QTE', 'QTE already active');
            return false;
        }

        params = params || {};
        state.active = true;
        state.type = 'accuracy';
        state.phase = 'waiting';
        state.callback = callback;

        if (params.difficulty) {
            state.difficulty = params.difficulty;
        }

        // Show UI
        if (qteUI) {
            qteUI.show('accuracy', config, state.difficulty);
        }

        // Start after delay
        setTimeout(function() {
            state.phase = 'running';
            state.startTime = performance.now();
            state.markerPosition = 0; // Start from left

            // Begin animation
            state.animationFrame = requestAnimationFrame(updateMarkerPosition);

            // Set timeout for auto-fail
            var totalDuration = config.bar.duration * config.bar.oscillations;
            var diffMod = config.difficulty[state.difficulty];
            if (diffMod) {
                totalDuration /= diffMod.speedMultiplier;
            }

            setTimeout(function() {
                if (state.active && state.phase === 'running') {
                    handleTimeout();
                }
            }, totalDuration + 100);

        }, config.timing.startDelay);

        return true;
    }

    /**
     * Start a dodge QTE (enemy attacking)
     * @param {object} params - { difficulty, enemyAttackType, onComplete }
     * @param {function} callback - Called with result when complete
     */
    function startDodgeQTE(params, callback) {
        if (state.active) {
            _log.warn('QTE', 'QTE already active');
            return false;
        }

        params = params || {};
        state.active = true;
        state.type = 'dodge';
        state.phase = 'waiting';
        state.callback = callback;

        if (params.difficulty) {
            state.difficulty = params.difficulty;
        }

        // Show UI
        if (qteUI) {
            qteUI.show('dodge', config, state.difficulty);
        }

        // Start after delay
        setTimeout(function() {
            state.phase = 'running';
            state.startTime = performance.now();
            state.markerPosition = 0;

            // Begin animation
            state.animationFrame = requestAnimationFrame(updateMarkerPosition);

            // Set timeout
            var totalDuration = config.bar.duration * config.bar.oscillations;
            var diffMod = config.difficulty[state.difficulty];
            if (diffMod) {
                totalDuration /= diffMod.speedMultiplier;
            }

            setTimeout(function() {
                if (state.active && state.phase === 'running') {
                    handleTimeout();
                }
            }, totalDuration + 100);

        }, config.timing.startDelay);

        return true;
    }

    // === Finalized Battle System QTEs ===

    /**
     * Start a Skill QTE (player using a skill)
     * Finalized battle system: QTE affects advantage/disadvantage on rolls
     *
     * Results:
     *   - Perfect: Advantage + Bonus Damage (+25%)
     *   - Good: Advantage (roll twice, take best)
     *   - Normal: Standard roll
     *   - Bad: Disadvantage (roll twice, take worst)
     *
     * @param {object} params - { difficulty, skillId, skillName, oscillating }
     * @param {function} callback - Called with result when complete
     */
    function startSkillQTE(params, callback) {
        if (state.active) {
            _log.warn('QTE', 'QTE already active');
            return false;
        }

        params = params || {};
        state.active = true;
        state.type = 'skill';
        state.phase = 'waiting';
        state.callback = callback;
        state.skillId = params.skillId || null;
        state.skillName = params.skillName || 'SKILL';
        state.oscillatingMode = params.oscillating || false;

        if (params.difficulty) {
            state.difficulty = params.difficulty;
        }

        // Generate random target position within middle 80% of bar (10% to 90%)
        // Target position from tuning (defaults: 10-90%)
        var targetMin = qteConfig && qteConfig.targetPosition ? qteConfig.targetPosition.min : 10;
        var targetMax = qteConfig && qteConfig.targetPosition ? qteConfig.targetPosition.max : 90;
        state.targetPosition = targetMin + Math.random() * (targetMax - targetMin);

        // Skill QTE uses normal zone sizes
        state.zoneScale = 1.0;

        // Show UI with skill label and target position
        if (qteUI) {
            qteUI.show('skill', config, state.difficulty, {
                label: state.skillName.toUpperCase() + '!',
                zones: {
                    perfect: config.zones.perfect,
                    good: config.zones.good || config.zones.success,
                    normal: config.zones.normal || config.zones.partial
                },
                targetPosition: state.targetPosition
            });
        }

        // Start after delay
        setTimeout(function() {
            state.phase = 'running';
            state.startTime = performance.now();
            state.markerPosition = 0; // Start from left

            // Begin animation
            state.animationFrame = requestAnimationFrame(updateMarkerPosition);

            // Start countdown timer (configurable, default 5 seconds)
            // Engine manages timing, UI just displays
            startCountdown(config.timing.countdownDuration || 5);

        }, config.timing.startDelay);

        return true;
    }

    /**
     * Start a Defend QTE (enemy attacking while player is defending)
     * Finalized battle system: QTE determines defense outcome
     *
     * Results:
     *   - Perfect: PARRY (0 damage + counter damage)
     *   - Good: DODGE (0 damage)
     *   - Normal: BLOCK (damage halved, defend persists)
     *   - Bad: BROKEN (full damage, defend ends immediately)
     *
     * @param {object} params - { difficulty, enemyAttackName, incomingDamage, oscillating }
     * @param {function} callback - Called with result when complete
     */
    function startDefendQTE(params, callback) {
        if (state.active) {
            _log.warn('QTE', 'QTE already active');
            return false;
        }

        params = params || {};
        state.active = true;
        state.type = 'defend';
        state.phase = 'waiting';
        state.callback = callback;
        state.incomingDamage = params.incomingDamage || 0;
        state.enemyAttackName = params.enemyAttackName || 'ATTACK';
        state.oscillatingMode = params.oscillating || false;

        if (params.difficulty) {
            state.difficulty = params.difficulty;
        }

        // Generate random target position within middle 80% of bar (10% to 90%)
        // Target position from tuning (defaults: 10-90%)
        var targetMin = qteConfig && qteConfig.targetPosition ? qteConfig.targetPosition.min : 10;
        var targetMax = qteConfig && qteConfig.targetPosition ? qteConfig.targetPosition.max : 90;
        state.targetPosition = targetMin + Math.random() * (targetMax - targetMin);

        // Defend QTE has tighter zones (harder than skill)
        state.zoneScale = 0.7; // 70% of normal zone sizes

        // Show UI with defend label and tighter zones
        if (qteUI) {
            qteUI.show('defend', config, state.difficulty, {
                label: 'DEFEND!',
                subLabel: state.enemyAttackName,
                zones: {
                    perfect: (config.zones.perfect || 5) * state.zoneScale,
                    good: (config.zones.good || config.zones.success || 15) * state.zoneScale,
                    normal: (config.zones.normal || config.zones.partial || 30) * state.zoneScale
                },
                targetPosition: state.targetPosition
            });
        }

        // Start after shorter delay (defense is reactive)
        setTimeout(function() {
            state.phase = 'running';
            state.startTime = performance.now();
            state.markerPosition = 0;

            // Begin animation
            state.animationFrame = requestAnimationFrame(updateMarkerPosition);

            // Start countdown timer (configurable, default 5 seconds)
            // Engine manages timing, UI just displays
            startCountdown(config.timing.countdownDuration || 5);

        }, config.timing.startDelay * 0.4); // Even faster start for defend

        return true;
    }

    /**
     * Handle input for finalized battle QTEs (Skill/Defend)
     * Uses the 4-tier zone system: Perfect/Good/Normal/Bad
     */
    function handleInputFinalized() {
        if (!state.active || state.phase !== 'running') return;
        if (state.type !== 'skill' && state.type !== 'defend') {
            // Fall back to legacy handler
            handleInput();
            return;
        }

        state.inputTime = performance.now();
        state.phase = 'input';

        // Stop countdown timer (engine-managed)
        stopCountdown();

        // Hide countdown display
        if (qteUI && qteUI.hideCountdown) {
            qteUI.hideCountdown();
        }

        // Stop animation
        if (state.animationFrame) {
            cancelAnimationFrame(state.animationFrame);
            state.animationFrame = null;
        }

        // Determine result using finalized 4-tier zones
        state.result = getZoneForPositionFinalized(state.markerPosition);

        // Show result in UI
        if (qteUI) {
            qteUI.showResultFinalized(state.result, state.markerPosition, state.type);
        }

        // Delay before completing (show result)
        setTimeout(function() {
            completeQTEFinalized();
        }, config.timing.resultDisplay);
    }

    /**
     * Handle timeout for finalized battle QTEs
     * Auto-commits at current marker position (countdown mechanic)
     * This gives players time to position the marker, then it locks in
     */
    function handleTimeoutFinalized() {
        if (!state.active || state.phase !== 'running') return;

        state.phase = 'timeout';

        // Hide countdown display (engine already stopped the timer)
        if (qteUI && qteUI.hideCountdown) {
            qteUI.hideCountdown();
        }

        if (state.animationFrame) {
            cancelAnimationFrame(state.animationFrame);
            state.animationFrame = null;
        }

        // Auto-commit at current position (not forced 'bad')
        // This is the gaming trick - countdown gives you time to position,
        // then it commits wherever you are
        state.result = getZoneForPositionFinalized(state.markerPosition);

        if (qteUI) {
            qteUI.showResultFinalized(state.result, state.markerPosition, state.type);
        }

        setTimeout(function() {
            completeQTEFinalized();
        }, config.timing.resultDisplay);
    }

    /**
     * Complete a finalized battle QTE and return result
     */
    function completeQTEFinalized() {
        var modifiers;

        // Get appropriate modifiers based on QTE type
        if (state.type === 'skill') {
            modifiers = getSkillModifiers(state.result);
        } else if (state.type === 'defend') {
            modifiers = getDefendModifiers(state.result);
        } else {
            modifiers = getResultModifiers();
        }

        var result = {
            type: state.type,
            zone: state.result,
            position: state.markerPosition,
            modifiers: modifiers,
            skillId: state.skillId,
            skillName: state.skillName,
            incomingDamage: state.incomingDamage
        };

        // Clean up UI
        if (qteUI) {
            qteUI.hide();
        }

        // Reset state
        var callback = state.callback;
        resetState();

        // Invoke callback with result
        if (callback) {
            callback(result);
        }
    }

    /**
     * Get skill QTE modifiers based on result
     * @param {string} zone - 'perfect', 'good', 'normal', or 'bad'
     * @returns {object} - Modifier values for skill execution
     */
    function getSkillModifiers(zone) {
        var T = typeof TUNING !== 'undefined' ? TUNING : null;
        var skillMods = T && T.qte && T.qte.skillModifiers ? T.qte.skillModifiers : null;

        if (skillMods && skillMods[zone]) {
            return skillMods[zone];
        }

        // Fallback defaults
        var defaults = {
            perfect: { advantage: true, bonusDamage: 0.25, bonusHealing: 0.25, statusChanceBonus: 0.2 },
            good: { advantage: true, bonusDamage: 0, bonusHealing: 0, statusChanceBonus: 0.1 },
            normal: { advantage: false, bonusDamage: 0, bonusHealing: 0, statusChanceBonus: 0 },
            bad: { disadvantage: true, bonusDamage: -0.25, bonusHealing: -0.25, statusChanceBonus: -0.2 }
        };

        return defaults[zone] || defaults.normal;
    }

    /**
     * Get defend QTE modifiers based on result
     * @param {string} zone - 'perfect', 'good', 'normal', or 'bad'
     * @returns {object} - Modifier values for defense resolution
     *
     * Results:
     *   - Perfect (PARRY): Reflect 1d5 damage back to attacker, no damage taken
     *   - Good (DODGE): Avoid the attack completely
     *   - Normal (CONFUSE): Get confused AND hit (full damage)
     *   - Bad (FUMBLE): Get confused AND hit, lose AC bonus
     */
    function getDefendModifiers(zone) {
        var T = typeof TUNING !== 'undefined' ? TUNING : null;
        var defendMods = T && T.qte && T.qte.defendModifiers ? T.qte.defendModifiers : null;

        if (defendMods && defendMods[zone]) {
            return defendMods[zone];
        }

        // Fallback defaults
        var defaults = {
            perfect: { result: 'parry', damageReduction: 1.0, counterAttack: true, counterDamageDice: '1d5', defendEnds: false },
            good: { result: 'dodge', damageReduction: 1.0, counterAttack: false, defendEnds: false },
            normal: { result: 'confuse', damageReduction: 0, counterAttack: false, confused: true, defendEnds: false },
            bad: { result: 'fumble', damageReduction: 0, counterAttack: false, confused: true, loseACBonus: true, defendEnds: true }
        };

        return defaults[zone] || defaults.normal;
    }

    // === Expedition 33 Style QTEs ===

    /**
     * Start a parry QTE (Exp33 style - tighter timing window)
     * Parry requires more precise timing than dodge but offers counter-attack
     * @param {object} params - { difficulty, attackPower, attackType }
     * @param {function} callback - Called with result when complete
     */
    function startParryQTE(params, callback) {
        if (state.active) {
            _log.warn('QTE', 'QTE already active');
            return false;
        }

        params = params || {};
        state.active = true;
        state.type = 'parry';
        state.phase = 'waiting';
        state.callback = callback;
        state.difficulty = params.difficulty || 'normal';

        // Parry has tighter zones - use zoneScale instead of mutating config
        // This prevents race conditions if multiple QTEs start simultaneously
        state.zoneScale = 0.65;  // 65% of normal zone sizes for parry

        // Show UI with parry styling (pass scaled zones for display)
        if (qteUI) {
            qteUI.show('parry', config, state.difficulty, {
                zoneScale: state.zoneScale
            });
        }

        // Start after delay
        setTimeout(function() {
            state.phase = 'running';
            state.startTime = performance.now();
            state.markerPosition = 0;

            state.animationFrame = requestAnimationFrame(updateMarkerPosition);

            // Parry has shorter window
            var totalDuration = (config.bar.duration * 0.75) * config.bar.oscillations;
            var diffMod = config.difficulty[state.difficulty];
            if (diffMod) {
                totalDuration /= diffMod.speedMultiplier;
            }

            setTimeout(function() {
                if (state.active && state.phase === 'running') {
                    handleTimeout();
                }
            }, totalDuration + 100);

        }, config.timing.startDelay * 0.5);  // Faster start for parry

        return true;
    }

    /**
     * Start a guard break QTE (when player's guard is about to break)
     * Success restores guard, failure results in stun
     * @param {object} params - { difficulty, hitsAbsorbed }
     * @param {function} callback - Called with result when complete
     */
    function startGuardBreakQTE(params, callback) {
        if (state.active) {
            _log.warn('QTE', 'QTE already active');
            return false;
        }

        params = params || {};
        state.active = true;
        state.type = 'guardBreak';
        state.phase = 'waiting';
        state.callback = callback;
        state.difficulty = params.difficulty || 'normal';

        // Guard break has very tight timing - use zoneScale instead of mutating config
        state.zoneScale = 0.55;  // 55% of normal zone sizes for guard break

        if (qteUI) {
            qteUI.show('guardBreak', config, state.difficulty, {
                zoneScale: state.zoneScale
            });
        }

        setTimeout(function() {
            state.phase = 'running';
            state.startTime = performance.now();
            state.markerPosition = 0;

            state.animationFrame = requestAnimationFrame(updateMarkerPosition);

            // Very short window for guard break
            var totalDuration = (config.bar.duration * 0.5);
            var diffMod = config.difficulty[state.difficulty];
            if (diffMod) {
                totalDuration /= diffMod.speedMultiplier;
            }

            setTimeout(function() {
                if (state.active && state.phase === 'running') {
                    handleTimeout();
                }
            }, totalDuration + 100);

        }, config.timing.startDelay * 0.3);  // Very fast start

        return true;
    }

    /**
     * Start a chain combo QTE (multi-hit attack sequence)
     * Player must hit multiple timing windows in succession
     * @experimental Chain combo system - not yet integrated into main game loop
     * @param {object} params - { difficulty, hits, baseInterval }
     * @param {function} callback - Called with result when complete
     */
    function startChainComboQTE(params, callback) {
        if (state.active) {
            _log.warn('QTE', 'QTE already active');
            return false;
        }

        params = params || {};
        var totalHits = params.hits || 3;
        var baseInterval = params.baseInterval || 600;

        state.active = true;
        state.type = 'chainCombo';
        state.phase = 'waiting';
        state.callback = callback;
        state.difficulty = params.difficulty || 'normal';

        // Chain combo state
        state.chainCombo = {
            totalHits: totalHits,
            currentHit: 0,
            hitsLanded: 0,
            results: [],
            baseInterval: baseInterval
        };

        if (qteUI) {
            qteUI.show('chainCombo', config, state.difficulty);
            qteUI.updateChainProgress(0, totalHits);
        }

        // Start first hit
        setTimeout(function() {
            startNextChainHit();
        }, config.timing.startDelay);

        return true;
    }

    /**
     * Process next hit in chain combo
     */
    function startNextChainHit() {
        if (!state.active || state.type !== 'chainCombo') return;

        var chain = state.chainCombo;
        if (chain.currentHit >= chain.totalHits) {
            // All hits processed, complete QTE
            finishChainCombo();
            return;
        }

        state.phase = 'running';
        state.startTime = performance.now();
        state.markerPosition = 0;

        if (qteUI) {
            qteUI.showChainHit(chain.currentHit + 1, chain.totalHits);
        }

        state.animationFrame = requestAnimationFrame(updateMarkerPosition);

        // Each subsequent hit is faster
        var speedIncrease = 1 + (chain.currentHit * 0.15);
        var hitDuration = chain.baseInterval / speedIncrease;

        setTimeout(function() {
            if (state.active && state.phase === 'running') {
                // Missed this hit
                chain.results.push('miss');
                chain.currentHit++;

                if (qteUI) {
                    qteUI.showChainResult('miss');
                }

                setTimeout(function() {
                    startNextChainHit();
                }, 200);
            }
        }, hitDuration);
    }

    /**
     * Handle input during chain combo
     */
    function handleChainInput() {
        if (!state.active || state.type !== 'chainCombo' || state.phase !== 'running') return;

        // Stop current hit animation
        if (state.animationFrame) {
            cancelAnimationFrame(state.animationFrame);
            state.animationFrame = null;
        }

        var chain = state.chainCombo;
        var hitResult = getZoneForPosition(state.markerPosition);

        chain.results.push(hitResult);
        if (hitResult === 'perfect' || hitResult === 'success') {
            chain.hitsLanded++;
        }
        chain.currentHit++;

        if (qteUI) {
            qteUI.showChainResult(hitResult);
            qteUI.updateChainProgress(chain.currentHit, chain.totalHits);
        }

        state.phase = 'input';

        // Brief pause then next hit
        setTimeout(function() {
            startNextChainHit();
        }, 250);
    }

    /**
     * Finish chain combo and calculate result
     */
    function finishChainCombo() {
        var chain = state.chainCombo;
        var hitRatio = chain.hitsLanded / chain.totalHits;

        // Determine overall result
        if (hitRatio >= 1.0) {
            state.result = 'perfect';
        } else if (hitRatio >= 0.7) {
            state.result = 'success';
        } else if (hitRatio >= 0.4) {
            state.result = 'partial';
        } else {
            state.result = 'miss';
        }

        if (qteUI) {
            qteUI.showResult(state.result, 50);
        }

        setTimeout(function() {
            completeQTE();
        }, config.timing.resultDisplay);
    }

    /**
     * Cancel current QTE (e.g., battle ended)
     */
    function cancel() {
        if (!state.active) return;

        if (qteUI) {
            qteUI.hide();
        }

        resetState();
    }

    // === Input Binding ===

    /** @type {boolean} - Track if inputs are bound */
    var inputsBound = false;

    /**
     * Bind input handlers for QTE
     * Should be called once during setup
     */
    function bindInputs() {
        // Prevent double-binding
        if (inputsBound) return;
        inputsBound = true;

        var hasListenerManager = typeof ListenerManager !== 'undefined';

        // Keyboard handler
        var keyHandler = function(e) {
            if (!state.active || state.phase !== 'running') return;

            // Space or Enter to confirm timing
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                handleInput();
            }
        };

        // Click handler - accepts clicks anywhere on VN container
        var clickHandler = function(e) {
            if (!state.active || state.phase !== 'running') return;

            // Accept clicks anywhere on VN container (not just QTE area)
            var vnContainer = document.getElementById('vn-container');
            if (vnContainer && vnContainer.contains(e.target)) {
                // Don't trigger on button clicks
                if (e.target.tagName === 'BUTTON') return;
                e.preventDefault();
                handleInput();
            }
        };

        // Touch handler - accepts touches anywhere on VN container
        var touchHandler = function(e) {
            if (!state.active || state.phase !== 'running') return;

            var vnContainer = document.getElementById('vn-container');
            if (vnContainer && vnContainer.contains(e.target)) {
                // Don't trigger on button touches
                if (e.target.tagName === 'BUTTON') return;
                e.preventDefault();
                handleInput();
            }
        };

        // Bind with ListenerManager if available, otherwise direct
        if (hasListenerManager) {
            ListenerManager.add(document, 'keydown', keyHandler, 'qte');
            ListenerManager.add(document, 'click', clickHandler, 'qte');
            ListenerManager.add(document, 'touchstart', touchHandler, 'qte', { passive: false });
        } else {
            document.addEventListener('keydown', keyHandler);
            document.addEventListener('click', clickHandler);
            document.addEventListener('touchstart', touchHandler, { passive: false });
        }
    }

    /**
     * Unbind input handlers (for cleanup)
     */
    function unbindInputs() {
        if (typeof ListenerManager !== 'undefined') {
            ListenerManager.removeAll('qte');
        }
        inputsBound = false;
    }

    // === Combo System (Future Enhancement) ===

    /**
     * Generate a random combo sequence
     * @experimental Combo system - not yet integrated into main game loop
     * Enable via TUNING.qte.combo.enabled = true
     * @param {number} length - Number of inputs required
     * @returns {Array} - Array of direction strings
     */
    function generateCombo(length) {
        var combo = [];
        for (var i = 0; i < length; i++) {
            combo.push(Utils.pickRandom(config.combo.directions));
        }
        return combo;
    }

    /**
     * Handle directional input for combo
     * @experimental Combo system - not yet integrated into main game loop
     * Enable via TUNING.qte.combo.enabled = true
     * @param {string} direction - 'up', 'down', 'left', 'right'
     */
    function handleComboInput(direction) {
        if (!state.active || state.phase !== 'combo') return;

        var expected = state.combo.required[state.combo.currentIndex];

        if (direction === expected) {
            state.combo.entered.push(direction);
            state.combo.currentIndex++;

            if (qteUI) {
                qteUI.updateCombo(state.combo.currentIndex, state.combo.required.length);
            }

            // Check if combo complete
            if (state.combo.currentIndex >= state.combo.required.length) {
                state.result = 'perfect'; // Successful combo
                completeQTE();
            }
        } else {
            // Wrong input - combo failed
            state.result = 'partial'; // Partial success for trying
            if (qteUI) {
                qteUI.showComboFail();
            }
            setTimeout(function() {
                completeQTE();
            }, config.timing.resultDisplay / 2);
        }
    }

    // === State Queries ===

    /**
     * Check if QTE system is enabled globally
     * @returns {boolean}
     */
    function isEnabled() {
        var T = window.TUNING;
        return T && T.qte && T.qte.enabled;
    }

    /**
     * Check if QTE is currently active
     * @returns {boolean}
     */
    function isActive() {
        return state.active;
    }

    /**
     * Get current QTE type
     * @returns {string|null} - 'accuracy', 'dodge', or null
     */
    function getType() {
        return state.type;
    }

    /**
     * Get current phase
     * @returns {string} - 'idle', 'waiting', 'running', 'input', 'result'
     */
    function getPhase() {
        return state.phase;
    }

    /**
     * Get configuration (for UI or debugging)
     * @returns {object}
     */
    function getConfig() {
        return config;
    }

    // === Public API ===
    return {
        // Initialization
        init: init,
        setUI: setUI,
        setDifficulty: setDifficulty,
        bindInputs: bindInputs,
        unbindInputs: unbindInputs,
        cleanup: cleanup,  // Full cleanup for battle end/game reset

        // QTE control - Finalized Battle System (NEW)
        startSkillQTE: startSkillQTE,       // Skills: advantage/disadvantage on rolls
        startDefendQTE: startDefendQTE,     // Defend: parry/dodge/block/broken

        // QTE control - Standard (Legacy)
        startAccuracyQTE: startAccuracyQTE,
        startDodgeQTE: startDodgeQTE,

        // QTE control - Expedition 33 Style
        startParryQTE: startParryQTE,
        startGuardBreakQTE: startGuardBreakQTE,
        startChainComboQTE: startChainComboQTE,

        // Aliases for BattleEngine integration
        startAttackQTE: startAccuracyQTE,  // Alias

        handleInput: handleInput,
        handleInputFinalized: handleInputFinalized,  // NEW: For skill/defend QTEs
        handleChainInput: handleChainInput,
        cancel: cancel,

        // Combo system
        generateCombo: generateCombo,
        handleComboInput: handleComboInput,

        // State queries
        isEnabled: isEnabled,
        isActive: isActive,
        getType: getType,
        getPhase: getPhase,
        getConfig: getConfig,

        // Countdown management (engine owns timing, UI displays)
        startCountdown: startCountdown,
        stopCountdown: stopCountdown,
        getCountdownRemaining: getCountdownRemaining,
        isCountdownActive: isCountdownActive,

        // Expose config for external access
        config: config,

        // Zone calculation (for testing/UI)
        getZoneForPosition: getZoneForPosition,
        getZoneForPositionFinalized: getZoneForPositionFinalized,  // NEW: 4-tier zones

        // Modifier getters (for battle integration)
        getSkillModifiers: getSkillModifiers,
        getDefendModifiers: getDefendModifiers
    };
})();
