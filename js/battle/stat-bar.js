/**
 * Andi VN - Stat Bar Helper Module
 *
 * Consolidates repeated bar update logic for HP, Mana, Limit, Stagger bars.
 * Eliminates duplicate code patterns across battle-ui.js.
 *
 * Usage:
 *   StatBar.updateBar(barEl, textEl, current, max, thresholds);
 *   StatBar.updateHP(barEl, textEl, hp, maxHP, hasRegen);
 *   StatBar.updateMana(barEl, textEl, mana, maxMana, hasRegen);
 */

var StatBar = (function() {
    'use strict';

    // === Configuration ===

    /**
     * Default HP thresholds for color changes
     */
    var HP_THRESHOLDS = {
        high: 50,    // > 50% = green (hp-high)
        medium: 25   // > 25% = yellow (hp-medium), else red (hp-low)
    };

    /**
     * Default limit bar thresholds
     */
    var LIMIT_THRESHOLDS = {
        high: 75,    // >= 75% = high charge
        ready: 100   // >= 100% = ready to use
    };

    // === Core Bar Update Functions ===

    /**
     * Generic bar update with percentage width and optional class switching
     * @param {HTMLElement} barEl - The bar fill element
     * @param {HTMLElement} textEl - The text display element (optional)
     * @param {number} current - Current value
     * @param {number} max - Maximum value
     * @param {object} options - { baseClass, thresholds, showPercent, textFormat }
     */
    function updateBar(barEl, textEl, current, max, options) {
        if (!barEl) return;

        options = options || {};
        var percent = max > 0 ? (current / max) * 100 : 0;
        barEl.style.width = percent + '%';

        // Update text if element provided
        if (textEl) {
            if (options.showPercent) {
                textEl.textContent = Math.floor(percent) + '%';
            } else if (options.textFormat) {
                textEl.textContent = options.textFormat(current, max);
            } else {
                textEl.textContent = current + '/' + max;
            }
        }

        // Apply threshold classes if provided
        if (options.thresholds && options.baseClass) {
            applyThresholdClass(barEl, percent, options.thresholds, options.baseClass);
        }

        return percent;
    }

    /**
     * Apply threshold-based class to bar element
     * @param {HTMLElement} el - Element to update
     * @param {number} percent - Current percentage
     * @param {object} thresholds - { high, medium, ready } percentages
     * @param {string} baseClass - Base class name (e.g., 'hp-bar')
     */
    function applyThresholdClass(el, percent, thresholds, baseClass) {
        // Remove existing threshold classes
        el.className = el.className.replace(/\b(hp-high|hp-medium|hp-low|limit-high|limit-ready|stagger-warning|stagger-danger)\b/g, '').trim();

        // Ensure base classes are present
        if (baseClass && el.className.indexOf(baseClass) === -1) {
            el.className = 'stat-bar ' + baseClass + ' ' + el.className;
        }

        // Apply new threshold class
        if (thresholds.ready !== undefined && percent >= thresholds.ready) {
            el.classList.add(baseClass.replace('-bar', '-ready'));
        } else if (thresholds.high !== undefined && percent >= thresholds.high) {
            el.classList.add(baseClass.replace('-bar', '-high'));
        } else if (thresholds.medium !== undefined && percent > thresholds.medium) {
            el.classList.add(baseClass.replace('-bar', '-medium'));
        } else {
            el.classList.add(baseClass.replace('-bar', '-low'));
        }
    }

    // === Specialized Bar Updates ===

    /**
     * Update HP bar with color thresholds and optional regen glow
     * @param {HTMLElement} barEl - HP bar fill element
     * @param {HTMLElement} textEl - HP text element
     * @param {number} hp - Current HP
     * @param {number} maxHP - Maximum HP
     * @param {boolean} hasRegen - Whether HP regen is active
     * @param {HTMLElement} labelEl - Optional label element for regen styling
     */
    function updateHP(barEl, textEl, hp, maxHP, hasRegen, labelEl) {
        if (!barEl) return;

        var percent = updateBar(barEl, textEl, hp, maxHP);

        // Determine HP state class
        var hpState = percent > HP_THRESHOLDS.high ? 'hp-high' :
                      percent > HP_THRESHOLDS.medium ? 'hp-medium' : 'hp-low';

        var regenClass = hasRegen ? ' hp-regen' : '';
        barEl.className = 'stat-bar hp-bar ' + hpState + regenClass;

        // Apply regen pulse to text element
        if (textEl) {
            textEl.className = 'stat-value' + regenClass;
        }

        // Apply regen pulse to label element
        if (labelEl) {
            labelEl.className = 'stat-label' + regenClass;
        }

        return percent;
    }

    /**
     * Update Mana bar with optional regen glow
     * @param {HTMLElement} barEl - Mana bar fill element
     * @param {HTMLElement} textEl - Mana text element
     * @param {number} mana - Current mana
     * @param {number} maxMana - Maximum mana
     * @param {boolean} hasRegen - Whether mana regen is active
     * @param {HTMLElement} labelEl - Optional label element for regen styling
     */
    function updateMana(barEl, textEl, mana, maxMana, hasRegen, labelEl) {
        if (!barEl) return;

        updateBar(barEl, textEl, mana, maxMana);

        var regenClass = hasRegen ? ' mana-regen' : '';
        barEl.className = 'stat-bar mana-bar' + regenClass;

        // Apply regen pulse to text element
        if (textEl) {
            textEl.className = 'stat-value' + regenClass;
        }

        // Apply regen pulse to label element
        if (labelEl) {
            labelEl.className = 'stat-label' + regenClass;
        }
    }

    /**
     * Update Limit Break bar with ready/high states
     * @param {HTMLElement} barEl - Limit bar fill element
     * @param {HTMLElement} textEl - Limit text element
     * @param {number} charge - Current limit charge (0-100)
     */
    function updateLimit(barEl, textEl, charge) {
        if (!barEl) return;

        barEl.style.width = charge + '%';

        // Determine limit state
        if (charge >= LIMIT_THRESHOLDS.ready) {
            barEl.className = 'stat-bar limit-bar limit-ready';
        } else if (charge >= LIMIT_THRESHOLDS.high) {
            barEl.className = 'stat-bar limit-bar limit-high';
        } else {
            barEl.className = 'stat-bar limit-bar';
        }

        if (textEl) {
            textEl.textContent = Math.floor(charge) + '%';
        }
    }

    /**
     * Update Stagger bar with warning/danger states
     * @param {HTMLElement} fillEl - Stagger fill element
     * @param {HTMLElement} containerEl - Stagger container element (for show/hide)
     * @param {number} stagger - Current stagger value
     * @param {number} threshold - Stagger threshold
     */
    function updateStagger(fillEl, containerEl, stagger, threshold) {
        if (!fillEl) return;

        var percent = threshold > 0 ? (stagger / threshold) * 100 : 0;
        fillEl.style.width = percent + '%';

        // Show/hide container based on stagger value
        if (containerEl) {
            if (stagger > 0) {
                containerEl.classList.add('has-stagger');
            } else {
                containerEl.classList.remove('has-stagger');
            }
        }

        // Color changes as stagger builds
        if (percent >= 75) {
            fillEl.className = 'stagger-fill stagger-danger';
        } else if (percent >= 50) {
            fillEl.className = 'stagger-fill stagger-warning';
        } else {
            fillEl.className = 'stagger-fill';
        }
    }

    // === AC Display ===

    /**
     * Update AC display with boost/reduce indicators
     * @param {HTMLElement} acEl - AC display element
     * @param {number} baseAC - Base AC value
     * @param {number} effectiveAC - Effective AC with modifiers
     */
    function updateAC(acEl, baseAC, effectiveAC) {
        if (!acEl) return;

        // Compact format: (AC XX) or (AC XX+) or (AC XX-)
        var acText = '(AC ' + effectiveAC + ')';
        acEl.classList.remove('boosted', 'reduced');

        if (effectiveAC > baseAC) {
            acText = '(AC ' + effectiveAC + '+)';
            acEl.classList.add('boosted');
        } else if (effectiveAC < baseAC) {
            acText = '(AC ' + effectiveAC + '-)';
            acEl.classList.add('reduced');
        }

        acEl.textContent = acText;
    }

    // === Public API ===
    return {
        // Generic
        updateBar: updateBar,
        applyThresholdClass: applyThresholdClass,

        // Specialized
        updateHP: updateHP,
        updateMana: updateMana,
        updateLimit: updateLimit,
        updateStagger: updateStagger,
        updateAC: updateAC,

        // Constants (exposed for external use/customization)
        HP_THRESHOLDS: HP_THRESHOLDS,
        LIMIT_THRESHOLDS: LIMIT_THRESHOLDS
    };
})();
