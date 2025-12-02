/**
 * Andi VN - QTE UI Module
 *
 * Handles all QTE visual rendering, DOM manipulation, and animations.
 * This module is theme-agnostic - all visual styling comes from CSS.
 *
 * Separation of concerns:
 *   - QTEUI: DOM manipulation, element creation, animations, visual feedback
 *   - QTEEngine: Game logic, timing, input handling, result calculation
 *
 * Visual Design:
 *   - Horizontal timing bar with colored zones
 *   - Sliding vertical marker
 *   - Zone colors: Red (miss) → Yellow (partial) → Green (success) → Blue (perfect)
 *   - Centered in battle area during combat
 *
 * Usage:
 *   QTEUI.init(containerElement);
 *   QTEUI.show('accuracy', config, difficulty);
 *   QTEUI.updateMarker(position);
 *   QTEUI.showResult('perfect', position);
 *   QTEUI.hide();
 */

var QTEUI = (function() {
    'use strict';

    // === Configuration ===
    var T = typeof TUNING !== 'undefined' ? TUNING : null;
    var qteConfig = T && T.qte ? T.qte : null;

    var config = {
        timing: {
            resultFlash: qteConfig ? qteConfig.timing.resultDisplay : 800,
            fadeIn: 200,
            fadeOut: qteConfig ? qteConfig.timing.fadeOut : 200,
            markerPulse: 100
        },
        colors: {
            miss: '#e74c3c',       // Red
            partial: '#f39c12',    // Yellow/Orange
            success: '#27ae60',    // Green
            perfect: '#3498db',    // Blue
            marker: '#ffffff',     // White
            markerGlow: 'rgba(255, 255, 255, 0.5)'
        },
        sizes: {
            barHeight: 40,
            markerWidth: 6,
            containerPadding: 20
        }
    };

    // === DOM Element Cache ===
    var elements = {
        container: null,      // Main VN container
        qteContainer: null,   // QTE overlay container
        qteBar: null,         // The timing bar
        qteMarker: null,      // The sliding marker
        qteLabel: null,       // "ATTACK!" or "DODGE!" label
        qteZones: null,       // Zone visualization
        qteResult: null,      // Result text display
        qteInstructions: null // "Press SPACE" text
    };

    // Current state
    var uiState = {
        visible: false,
        type: null,
        zones: null,
        difficulty: 'normal'
    };

    // === Initialization ===

    /**
     * Initialize the QTE UI module
     * @param {HTMLElement} containerEl - The main VN container element
     */
    function init(containerEl) {
        elements.container = containerEl || document.getElementById('vn-container');
    }

    // === UI Creation ===

    /**
     * Create the QTE UI elements
     * @param {string} type - 'accuracy', 'dodge', 'skill', or 'defend'
     * @param {object} engineConfig - Configuration from QTEEngine
     * @param {string} difficulty - Current difficulty level
     * @param {object} options - Optional: { label, subLabel, zones }
     */
    function show(type, engineConfig, difficulty, options) {
        if (uiState.visible) {
            hide();
        }

        options = options || {};
        uiState.type = type;
        uiState.difficulty = difficulty || 'normal';

        // Calculate zone sizes based on difficulty
        var diffMod = engineConfig.difficulty[difficulty] || { zoneMultiplier: 1 };
        var zoneMult = diffMod.zoneMultiplier;

        // Use provided zones or fallback to engine config
        var baseZones = options.zones || engineConfig.zones;

        // Support both finalized (perfect/good/normal) and legacy (perfect/success/partial) zones
        uiState.zones = {
            perfect: (baseZones.perfect || 5) * zoneMult,
            good: (baseZones.good || baseZones.success || 15) * zoneMult,
            normal: (baseZones.normal || baseZones.partial || 30) * zoneMult,
            // Legacy aliases
            success: (baseZones.good || baseZones.success || 15) * zoneMult,
            partial: (baseZones.normal || baseZones.partial || 30) * zoneMult
        };

        // Determine if using finalized 4-tier system
        uiState.finalized = (type === 'skill' || type === 'defend');

        // Use target position from options (set by engine) or generate random fallback
        // Target is within middle 80% of bar (10% to 90%)
        uiState.targetPosition = options.targetPosition !== undefined
            ? options.targetPosition
            : 10 + Math.random() * 80;

        // Create container
        var qteContainer = document.createElement('div');
        qteContainer.id = 'qte-container';
        qteContainer.className = 'qte-container qte-' + type;

        // Create label
        var label = document.createElement('div');
        label.className = 'qte-label';
        label.textContent = options.label || getLabelForType(type);

        // Create sub-label if provided (for defend QTE showing enemy attack name)
        if (options.subLabel) {
            var subLabel = document.createElement('div');
            subLabel.className = 'qte-sublabel';
            subLabel.textContent = options.subLabel;
            label.appendChild(subLabel);
        }

        // Create timing bar wrapper
        var barWrapper = document.createElement('div');
        barWrapper.className = 'qte-bar-wrapper';

        // Create zone visualization (use finalized zones for skill/defend)
        var zones = uiState.finalized
            ? createZoneVisualizationFinalized(uiState.zones)
            : createZoneVisualization(uiState.zones);

        // Create timing bar
        var bar = document.createElement('div');
        bar.className = 'qte-bar';

        // Create marker
        var marker = document.createElement('div');
        marker.className = 'qte-marker';
        bar.appendChild(marker);

        barWrapper.appendChild(zones);
        barWrapper.appendChild(bar);

        // Create instructions
        var instructions = document.createElement('div');
        instructions.className = 'qte-instructions';
        instructions.innerHTML = '<span class="qte-hit-red">HIT RED</span> - Press <span class="qte-key">SPACE</span> or <span class="qte-key">CLICK</span>';

        // Create result display (hidden initially)
        var result = document.createElement('div');
        result.className = 'qte-result';
        result.style.display = 'none';

        // Assemble
        qteContainer.appendChild(label);
        qteContainer.appendChild(barWrapper);
        qteContainer.appendChild(instructions);
        qteContainer.appendChild(result);

        // Cache elements
        elements.qteContainer = qteContainer;
        elements.qteBar = bar;
        elements.qteMarker = marker;
        elements.qteLabel = label;
        elements.qteZones = zones;
        elements.qteResult = result;
        elements.qteInstructions = instructions;

        // Add to container
        if (elements.container) {
            elements.container.appendChild(qteContainer);
        } else {
            document.body.appendChild(qteContainer);
        }

        // Animate in
        requestAnimationFrame(function() {
            qteContainer.classList.add('qte-visible');
        });

        uiState.visible = true;
    }

    /**
     * Get default label for QTE type
     * @param {string} type
     * @returns {string}
     */
    function getLabelForType(type) {
        switch (type) {
            case 'accuracy': return 'ATTACK!';
            case 'dodge': return 'DODGE!';
            case 'skill': return 'SKILL!';
            case 'defend': return 'DEFEND!';
            case 'parry': return 'PARRY!';
            case 'guardBreak': return 'GUARD BREAK!';
            case 'chainCombo': return 'COMBO!';
            default: return 'TIMING!';
        }
    }

    /**
     * Create zone visualization with colored sections
     * @param {object} zones - Zone sizes { perfect, success, partial }
     * @returns {HTMLElement}
     */
    function createZoneVisualization(zones) {
        var container = document.createElement('div');
        container.className = 'qte-zones';

        // Calculate zone widths
        // The zones are mirrored around the center
        // miss | partial | success | perfect | success | partial | miss

        var perfectWidth = zones.perfect * 2;     // Perfect is centered
        var successWidth = (zones.success - zones.perfect) * 2;
        var partialWidth = (zones.partial - zones.success) * 2;
        var missWidth = (50 - zones.partial) * 2;

        // Create zones (left to right)
        var leftMiss = createZoneSegment('miss', missWidth / 2);
        var leftPartial = createZoneSegment('partial', partialWidth / 2);
        var leftSuccess = createZoneSegment('success', successWidth / 2);
        var center = createZoneSegment('perfect', perfectWidth);
        var rightSuccess = createZoneSegment('success', successWidth / 2);
        var rightPartial = createZoneSegment('partial', partialWidth / 2);
        var rightMiss = createZoneSegment('miss', missWidth / 2);

        container.appendChild(leftMiss);
        container.appendChild(leftPartial);
        container.appendChild(leftSuccess);
        container.appendChild(center);
        container.appendChild(rightSuccess);
        container.appendChild(rightPartial);
        container.appendChild(rightMiss);

        return container;
    }

    /**
     * Create a single zone segment
     * @param {string} type - Zone type
     * @param {number} width - Width percentage
     * @returns {HTMLElement}
     */
    function createZoneSegment(type, width) {
        var segment = document.createElement('div');
        segment.className = 'qte-zone qte-zone-' + type;
        segment.style.width = width + '%';
        return segment;
    }

    /**
     * Create zone visualization for finalized battle system (4-tier: Perfect/Good/Normal/Bad)
     * Perfect zone is positioned at a random target within 80% of bar width
     * @param {object} zones - Zone sizes { perfect, good, normal }
     * @returns {HTMLElement}
     */
    function createZoneVisualizationFinalized(zones) {
        var container = document.createElement('div');
        container.className = 'qte-zones qte-zones-finalized';
        container.style.position = 'relative';

        // Target position is randomly placed within 10-90% of the bar
        var target = uiState.targetPosition;

        // Zone half-widths (zones extend both directions from target)
        var perfectHalf = zones.perfect;
        var goodHalf = zones.good;
        var normalHalf = zones.normal;

        // Calculate zone boundaries (clamped to 0-100)
        var perfectLeft = Math.max(0, target - perfectHalf);
        var perfectRight = Math.min(100, target + perfectHalf);
        var goodLeft = Math.max(0, target - goodHalf);
        var goodRight = Math.min(100, target + goodHalf);
        var normalLeft = Math.max(0, target - normalHalf);
        var normalRight = Math.min(100, target + normalHalf);

        // Create zones using absolute positioning
        // Bad zone is the background (full width)
        var badZone = document.createElement('div');
        badZone.className = 'qte-zone qte-zone-bad';
        badZone.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;';

        // Normal zone
        var normalZone = document.createElement('div');
        normalZone.className = 'qte-zone qte-zone-normal';
        normalZone.style.cssText = 'position:absolute;top:0;height:100%;left:' + normalLeft + '%;width:' + (normalRight - normalLeft) + '%;';

        // Good zone
        var goodZone = document.createElement('div');
        goodZone.className = 'qte-zone qte-zone-good';
        goodZone.style.cssText = 'position:absolute;top:0;height:100%;left:' + goodLeft + '%;width:' + (goodRight - goodLeft) + '%;';

        // Perfect zone
        var perfectZone = document.createElement('div');
        perfectZone.className = 'qte-zone qte-zone-perfect';
        perfectZone.style.cssText = 'position:absolute;top:0;height:100%;left:' + perfectLeft + '%;width:' + (perfectRight - perfectLeft) + '%;';

        // Add in order (bad first as background, then layers on top)
        container.appendChild(badZone);
        container.appendChild(normalZone);
        container.appendChild(goodZone);
        container.appendChild(perfectZone);

        return container;
    }

    // === Marker Updates ===

    /**
     * Update marker position
     * @param {number} position - Position 0-100 (center = 50)
     */
    function updateMarker(position) {
        if (!elements.qteMarker) return;

        // Convert position to percentage
        elements.qteMarker.style.left = position + '%';

        // Add visual feedback based on zone (use finalized zones for skill/defend)
        var zone = uiState.finalized
            ? getZoneFromPositionFinalized(position)
            : getZoneFromPosition(position);
        elements.qteMarker.className = 'qte-marker qte-marker-' + zone;
    }

    /**
     * Determine zone from position (legacy 4-tier)
     * @param {number} position - 0-100
     * @returns {string} - Zone name
     */
    function getZoneFromPosition(position) {
        if (!uiState.zones) return 'miss';

        var distanceFromCenter = Math.abs(position - 50);

        if (distanceFromCenter <= uiState.zones.perfect) {
            return 'perfect';
        } else if (distanceFromCenter <= uiState.zones.success) {
            return 'success';
        } else if (distanceFromCenter <= uiState.zones.partial) {
            return 'partial';
        } else {
            return 'miss';
        }
    }

    /**
     * Determine zone from position for finalized battle system
     * Uses distance from random target position (not center)
     * @param {number} position - 0-100
     * @returns {string} - 'perfect', 'good', 'normal', or 'bad'
     */
    function getZoneFromPositionFinalized(position) {
        if (!uiState.zones) return 'bad';

        // Distance from the random target position
        var distanceFromTarget = Math.abs(position - uiState.targetPosition);

        if (distanceFromTarget <= uiState.zones.perfect) {
            return 'perfect';
        } else if (distanceFromTarget <= uiState.zones.good) {
            return 'good';
        } else if (distanceFromTarget <= uiState.zones.normal) {
            return 'normal';
        } else {
            return 'bad';
        }
    }

    // === Result Display ===

    /**
     * Show QTE result
     * @param {string} result - 'perfect', 'success', 'partial', 'miss'
     * @param {number} position - Final marker position
     */
    function showResult(result, position) {
        if (!elements.qteResult || !elements.qteMarker) return;

        // Stop marker animation
        elements.qteMarker.classList.add('qte-marker-stopped');

        // Hide instructions
        if (elements.qteInstructions) {
            elements.qteInstructions.style.display = 'none';
        }

        // Show result
        var resultText = getResultText(result);
        elements.qteResult.textContent = resultText;
        elements.qteResult.className = 'qte-result qte-result-' + result;
        elements.qteResult.style.display = 'block';

        // Flash effect on the zone
        if (elements.qteZones) {
            elements.qteZones.classList.add('qte-zones-flash-' + result);
        }

        // Add container result class for overall effect
        if (elements.qteContainer) {
            elements.qteContainer.classList.add('qte-result-' + result);
        }

        // Marker visual feedback
        elements.qteMarker.classList.add('qte-marker-result-' + result);
    }

    /**
     * Get display text for result (legacy)
     * @param {string} result - Zone name
     * @returns {string}
     */
    function getResultText(result) {
        switch (result) {
            case 'perfect':
                return uiState.type === 'accuracy' ? 'PERFECT!' : 'PERFECT DODGE!';
            case 'success':
                return uiState.type === 'accuracy' ? 'HIT!' : 'DODGED!';
            case 'partial':
                return uiState.type === 'accuracy' ? 'GLANCING...' : 'GRAZED!';
            case 'miss':
            default:
                return uiState.type === 'accuracy' ? 'MISS!' : 'HIT!';
        }
    }

    /**
     * Show QTE result for finalized battle system
     * @param {string} result - 'perfect', 'good', 'normal', or 'bad'
     * @param {number} position - Final marker position
     * @param {string} qteType - 'skill' or 'defend'
     */
    function showResultFinalized(result, position, qteType) {
        if (!elements.qteResult || !elements.qteMarker) return;

        // Stop marker animation
        elements.qteMarker.classList.add('qte-marker-stopped');

        // Hide instructions
        if (elements.qteInstructions) {
            elements.qteInstructions.style.display = 'none';
        }

        // Show result
        var resultText = getResultTextFinalized(result, qteType);
        elements.qteResult.textContent = resultText;
        elements.qteResult.className = 'qte-result qte-result-' + result;
        elements.qteResult.style.display = 'block';

        // Flash effect on the zone
        if (elements.qteZones) {
            elements.qteZones.classList.add('qte-zones-flash-' + result);
        }

        // Add container result class for overall effect
        if (elements.qteContainer) {
            elements.qteContainer.classList.add('qte-result-' + result);
        }

        // Marker visual feedback
        elements.qteMarker.classList.add('qte-marker-result-' + result);
    }

    /**
     * Get display text for finalized battle system results
     * @param {string} result - 'perfect', 'good', 'normal', or 'bad'
     * @param {string} qteType - 'skill' or 'defend'
     * @returns {string}
     */
    function getResultTextFinalized(result, qteType) {
        if (qteType === 'skill') {
            // Skill QTE result text
            switch (result) {
                case 'perfect':
                    return 'PERFECT! +Advantage +Bonus';
                case 'good':
                    return 'GOOD! +Advantage';
                case 'normal':
                    return 'OK';
                case 'bad':
                default:
                    return 'BAD... Disadvantage';
            }
        } else if (qteType === 'defend') {
            // Defend QTE result text
            switch (result) {
                case 'perfect':
                    return 'PARRY! Reflect 1d5!';
                case 'good':
                    return 'DODGE!';
                case 'normal':
                    return 'CONFUSED! Hit!';
                case 'bad':
                default:
                    return 'FUMBLE! Hit + No AC!';
            }
        }

        // Fallback
        return result.toUpperCase() + '!';
    }

    // === Combo Display (Future Enhancement) ===

    /**
     * Show combo input sequence
     * @param {Array} combo - Array of directions
     */
    function showCombo(combo) {
        if (!elements.qteContainer) return;

        var comboContainer = document.createElement('div');
        comboContainer.className = 'qte-combo';
        comboContainer.id = 'qte-combo';

        for (var i = 0; i < combo.length; i++) {
            var input = document.createElement('span');
            input.className = 'qte-combo-input qte-combo-pending';
            input.setAttribute('data-direction', combo[i]);
            input.textContent = getDirectionSymbol(combo[i]);
            comboContainer.appendChild(input);
        }

        elements.qteContainer.appendChild(comboContainer);
    }

    /**
     * Update combo progress
     * @param {number} currentIndex - Current input index
     * @param {number} total - Total inputs required
     */
    function updateCombo(currentIndex, total) {
        var comboContainer = document.getElementById('qte-combo');
        if (!comboContainer) return;

        var inputs = comboContainer.querySelectorAll('.qte-combo-input');
        for (var i = 0; i < inputs.length; i++) {
            if (i < currentIndex) {
                inputs[i].className = 'qte-combo-input qte-combo-success';
            } else if (i === currentIndex) {
                inputs[i].className = 'qte-combo-input qte-combo-current';
            }
        }
    }

    /**
     * Show combo failure
     */
    function showComboFail() {
        var comboContainer = document.getElementById('qte-combo');
        if (comboContainer) {
            comboContainer.classList.add('qte-combo-fail');
        }
    }

    // === Chain Combo Display ===

    /**
     * Show current chain hit indicator
     * @param {number} currentHit - Current hit number (1-indexed)
     * @param {number} totalHits - Total hits in the chain
     */
    function showChainHit(currentHit, totalHits) {
        if (!elements.qteLabel) return;

        elements.qteLabel.textContent = 'HIT ' + currentHit + '/' + totalHits;
        elements.qteLabel.classList.add('qte-chain-hit');
    }

    /**
     * Show result for a single chain hit
     * @param {string} result - 'perfect', 'success', 'partial', or 'miss'
     */
    function showChainResult(result) {
        if (!elements.qteContainer) return;

        // Brief flash for hit result
        var flash = document.createElement('div');
        flash.className = 'qte-chain-flash qte-chain-flash-' + result;
        flash.textContent = result === 'perfect' ? '!' : (result === 'miss' ? 'X' : '');
        elements.qteContainer.appendChild(flash);

        // Remove after animation
        setTimeout(function() {
            if (flash.parentNode) {
                flash.parentNode.removeChild(flash);
            }
        }, 300);
    }

    /**
     * Update chain progress indicator
     * @param {number} currentHit - Number of hits completed
     * @param {number} totalHits - Total hits in chain
     */
    function updateChainProgress(currentHit, totalHits) {
        // Find or create progress container
        var progress = document.getElementById('qte-chain-progress');
        if (!progress && elements.qteContainer) {
            progress = document.createElement('div');
            progress.id = 'qte-chain-progress';
            progress.className = 'qte-chain-progress';
            elements.qteContainer.appendChild(progress);
        }

        if (!progress) return;

        // Update dots
        progress.innerHTML = '';
        for (var i = 0; i < totalHits; i++) {
            var dot = document.createElement('span');
            dot.className = 'qte-chain-dot';
            if (i < currentHit) {
                dot.classList.add('qte-chain-dot-complete');
            } else if (i === currentHit) {
                dot.classList.add('qte-chain-dot-current');
            }
            progress.appendChild(dot);
        }
    }

    /**
     * Get arrow symbol for direction
     * @param {string} direction
     * @returns {string}
     */
    function getDirectionSymbol(direction) {
        switch (direction) {
            case 'up': return '↑';
            case 'down': return '↓';
            case 'left': return '←';
            case 'right': return '→';
            default: return '?';
        }
    }

    // === Cleanup ===

    /**
     * Hide and remove QTE UI
     */
    function hide() {
        if (!elements.qteContainer) return;

        // Animate out
        elements.qteContainer.classList.remove('qte-visible');
        elements.qteContainer.classList.add('qte-hiding');

        setTimeout(function() {
            if (elements.qteContainer && elements.qteContainer.parentNode) {
                elements.qteContainer.parentNode.removeChild(elements.qteContainer);
            }

            // Clear element references
            elements.qteContainer = null;
            elements.qteBar = null;
            elements.qteMarker = null;
            elements.qteLabel = null;
            elements.qteZones = null;
            elements.qteResult = null;
            elements.qteInstructions = null;

            uiState.visible = false;
            uiState.type = null;
            uiState.zones = null;
        }, config.timing.fadeOut);
    }

    /**
     * Immediately destroy QTE UI (no animation)
     */
    function destroy() {
        if (elements.qteContainer && elements.qteContainer.parentNode) {
            elements.qteContainer.parentNode.removeChild(elements.qteContainer);
        }

        elements.qteContainer = null;
        elements.qteBar = null;
        elements.qteMarker = null;
        elements.qteLabel = null;
        elements.qteZones = null;
        elements.qteResult = null;
        elements.qteInstructions = null;

        uiState.visible = false;
        uiState.type = null;
        uiState.zones = null;
    }

    // === State Queries ===

    /**
     * Check if QTE UI is visible
     * @returns {boolean}
     */
    function isVisible() {
        return uiState.visible;
    }

    /**
     * Get current QTE type being displayed
     * @returns {string|null}
     */
    function getType() {
        return uiState.type;
    }

    // === Public API ===
    return {
        // Initialization
        init: init,

        // Display control
        show: show,
        hide: hide,
        destroy: destroy,

        // Marker updates
        updateMarker: updateMarker,

        // Result display
        showResult: showResult,
        showResultFinalized: showResultFinalized,  // NEW: For skill/defend QTEs

        // Chain combo display
        showCombo: showCombo,
        updateCombo: updateCombo,
        showComboFail: showComboFail,
        showChainHit: showChainHit,
        showChainResult: showChainResult,
        updateChainProgress: updateChainProgress,

        // State queries
        isVisible: isVisible,
        getType: getType,

        // Zone helpers
        getZoneFromPosition: getZoneFromPosition,
        getZoneFromPositionFinalized: getZoneFromPositionFinalized,

        // Expose config
        config: config
    };
})();
