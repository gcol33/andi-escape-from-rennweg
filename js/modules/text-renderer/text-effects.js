/**
 * Text Effects
 *
 * Visual effects for text display:
 * - Dice rolling animation (slot machine effect)
 * - Keyword highlighting
 * - Number formatting (damage, healing, etc.)
 */
var TextEffects = (function() {
    'use strict';

    var _log = typeof Logger !== 'undefined' ? Logger : console;

    // Configuration (can be overridden via init)
    var config = {
        dice: {
            spinDuration: 1800,
            spinInterval: 70,
            lingerDelay: 500
        }
    };

    // Active animations for click-to-skip
    var activeAnimations = [];
    var listenersAdded = false;

    // Timer for pausable animations
    var _timer = null;

    // SFX callback
    var _playSfx = function() {};

    // =========================================================================
    // KEYWORDS - Centralized text for highlighting
    // =========================================================================

    var KEYWORDS = {
        // Attack results
        CRITICAL_HIT: 'CRITICAL HIT!',
        CRITICAL: 'CRITICAL!',
        HIT: 'HIT!',
        MISS: 'MISS!',
        FUMBLE: 'FUMBLE!',

        // Scene dice results
        CRITICAL_SUCCESS: 'CRITICAL SUCCESS!',
        CRITICAL_FAILURE: 'CRITICAL FAILURE!',

        // Damage/Heal
        DAMAGE: 'DAMAGE',
        HEALED: 'HEALED!',
        HP: 'HP',
        MP: 'MP!',

        // Status
        POISONED: 'POISONED',
        STUNNED: 'STUNNED',
        CONFUSED: 'CONFUSED',
        BURNED: 'BURNED',
        FROZEN: 'FROZEN'
    };

    // Keyword to CSS class mapping
    var KEYWORD_CLASSES = {
        'CRITICAL HIT!': 'keyword-crit',
        'CRITICAL!': 'keyword-crit',
        'CRITICAL SUCCESS!': 'keyword-crit',
        'HIT!': 'keyword-hit',
        'MISS!': 'keyword-miss',
        'FUMBLE!': 'keyword-fumble',
        'CRITICAL FAILURE!': 'keyword-fumble',
        'DAMAGE': 'keyword-damage',
        'HEALED!': 'keyword-heal',
        'HP': 'keyword-hp',
        'MP!': 'keyword-mana'
    };

    // =========================================================================
    // HELPERS
    // =========================================================================

    function getTimer() {
        if (!_timer && typeof PausableTimer !== 'undefined') {
            _timer = PausableTimer.create({ name: 'TextEffects' });
        }
        return _timer;
    }

    function scheduleTimeout(callback, delay) {
        var timer = getTimer();
        if (timer) {
            return timer.schedule(callback, delay);
        }
        return setTimeout(callback, delay);
    }

    function isPaused() {
        var timer = getTimer();
        return timer ? timer.isPaused() : false;
    }

    // =========================================================================
    // DICE ANIMATION
    // =========================================================================

    /**
     * Get CSS class for roll result
     * @param {string} rollType - 'hit', 'damage', 'heal', 'status', 'neutral'
     * @param {string} resultCategory - 'crit', 'fail', 'max', 'min', 'normal'
     */
    function getRollClass(rollType, resultCategory) {
        return 'roll-' + rollType + '-' + resultCategory;
    }

    /**
     * Determine result category from roll flags
     */
    function getResultCategory(rollResult) {
        if (rollResult.isCrit) return 'crit';
        if (rollResult.isFumble) return 'fail';
        if (rollResult.isMax) return 'max';
        if (rollResult.isMin) return 'min';
        return 'normal';
    }

    /**
     * Skip all active animations
     */
    function skipAllAnimations() {
        var animations = activeAnimations.slice();
        for (var i = 0; i < animations.length; i++) {
            if (animations[i].skip) {
                animations[i].skip();
            }
        }
    }

    function handleGlobalClick() {
        if (activeAnimations.length > 0) {
            skipAllAnimations();
        }
    }

    function handleGlobalKeydown(event) {
        if (event.code === 'Space' && activeAnimations.length > 0) {
            event.preventDefault();
            skipAllAnimations();
        }
    }

    function ensureClickListener() {
        if (listenersAdded) return;
        document.addEventListener('click', handleGlobalClick);
        document.addEventListener('keydown', handleGlobalKeydown);
        listenersAdded = true;
    }

    /**
     * Animate a dice roll with slot machine effect
     * @param {Element} element - Element to animate
     * @param {Object} rollResult - { roll, sides, isCrit, isFumble, isMax, isMin }
     * @param {Object} options - { rollType, onComplete, playSfx }
     */
    function animateDiceRoll(element, rollResult, options) {
        options = options || {};
        var duration = config.dice.spinDuration;
        var interval = config.dice.spinInterval;
        var elapsed = 0;
        var sides = rollResult.sides || 20;
        var finished = false;
        var type = options.rollType || (sides === 20 ? 'hit' : 'damage');

        ensureClickListener();

        function finishAnimation() {
            if (finished) return;
            finished = true;

            // Remove from active animations
            for (var i = activeAnimations.length - 1; i >= 0; i--) {
                if (activeAnimations[i].element === element) {
                    activeAnimations.splice(i, 1);
                    break;
                }
            }

            // Show final value
            element.textContent = rollResult.roll;
            element.classList.remove('dice-spinning');
            element.classList.add('dice-final');

            // Apply styling based on result
            var resultCategory = getResultCategory(rollResult);
            var rollClass = getRollClass(type, resultCategory);
            element.classList.add(rollClass);

            // Play sound
            if (resultCategory === 'crit' || resultCategory === 'max') {
                _playSfx('success.ogg');
            } else if (resultCategory === 'fail') {
                _playSfx('fail.ogg');
            }

            scheduleTimeout(function() {
                if (options.onComplete) options.onComplete();
            }, config.dice.lingerDelay);
        }

        // Register for click-to-skip
        var animationState = {
            element: element,
            skip: finishAnimation
        };
        activeAnimations.push(animationState);

        _playSfx('dice_roll.ogg');
        element.classList.add('dice-spinning');
        element.classList.add('dice-d' + sides);

        function spin() {
            if (finished) return;

            if (isPaused()) {
                scheduleTimeout(spin, 50);
                return;
            }

            if (elapsed >= duration) {
                finishAnimation();
                return;
            }

            element.textContent = Math.floor(Math.random() * sides) + 1;
            elapsed += interval;

            var nextInterval = interval;
            if (elapsed > duration * 0.7) nextInterval = interval * 2;
            if (elapsed > duration * 0.9) nextInterval = interval * 3;

            scheduleTimeout(spin, nextInterval);
        }

        spin();
    }

    // =========================================================================
    // KEYWORD HIGHLIGHTING
    // =========================================================================

    /**
     * Highlight keywords in text
     * @param {string} text - Text to process
     * @returns {string} - HTML with highlighted keywords
     */
    function highlightKeywords(text) {
        if (!text) return text;

        var result = text;

        // Sort keywords by length (longest first) to avoid partial matches
        var keywords = Object.keys(KEYWORD_CLASSES).sort(function(a, b) {
            return b.length - a.length;
        });

        keywords.forEach(function(keyword) {
            var cssClass = KEYWORD_CLASSES[keyword];
            var regex = new RegExp('(' + escapeRegex(keyword) + ')', 'gi');
            result = result.replace(regex, '<span class="' + cssClass + '">$1</span>');
        });

        return result;
    }

    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Format a number for display (damage, healing, etc.)
     * @param {number} value - The number
     * @param {string} type - 'damage', 'heal', 'mana', 'neutral'
     * @returns {string} - HTML string
     */
    function formatNumber(value, type) {
        type = type || 'neutral';
        var cssClass = 'battle-number number-' + type;
        var prefix = '';

        if (type === 'heal' || type === 'mana') {
            prefix = '+';
        } else if (type === 'damage') {
            prefix = '-';
        }

        return '<span class="' + cssClass + '">' + prefix + value + '</span>';
    }

    /**
     * Format a dice result for display
     * @param {Object} rollResult - { roll, sides, isCrit, isFumble }
     * @param {Object} options - { threshold, success, skillName }
     * @returns {string} - HTML string
     */
    function formatDiceResult(rollResult, options) {
        options = options || {};
        var roll = rollResult.roll;
        var sides = rollResult.sides || 20;
        var isCrit = rollResult.isCrit;
        var isFumble = rollResult.isFumble;
        var success = options.success;

        var resultClass = success ? 'dice-success' : 'dice-failure';
        var critClass = isCrit ? ' dice-crit' : (isFumble ? ' dice-fumble' : '');

        var html = '<div class="dice-roll ' + resultClass + critClass + '">';

        if (options.skillName) {
            html += '<div class="skill-check-label">' + options.skillName + ' Check</div>';
        }

        html += 'You rolled a d' + sides;
        if (options.rollDescription) {
            html += ' ' + options.rollDescription;
        }
        html += ' and got: <span class="battle-number">' + roll + '</span>!';

        if (isCrit) {
            html += '<div class="crit-text">' + (options.critText || KEYWORDS.CRITICAL_SUCCESS) + '</div>';
        } else if (isFumble) {
            html += '<div class="fumble-text">' + (options.fumbleText || KEYWORDS.CRITICAL_FAILURE) + '</div>';
        }

        html += '</div>';

        return html;
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        /**
         * Initialize text effects
         * @param {Object} options
         * @param {Function} options.playSfx - Sound effect callback
         * @param {Object} options.dice - Dice animation config
         */
        init: function(options) {
            options = options || {};
            if (options.playSfx) _playSfx = options.playSfx;
            if (options.dice) {
                if (options.dice.spinDuration) config.dice.spinDuration = options.dice.spinDuration;
                if (options.dice.spinInterval) config.dice.spinInterval = options.dice.spinInterval;
                if (options.dice.lingerDelay) config.dice.lingerDelay = options.dice.lingerDelay;
            }
            _log.debug('TextEffects', 'Initialized');
        },

        /**
         * Clean up (call on battle end)
         */
        cleanup: function() {
            if (listenersAdded) {
                document.removeEventListener('click', handleGlobalClick);
                document.removeEventListener('keydown', handleGlobalKeydown);
                listenersAdded = false;
            }
            activeAnimations = [];
            var timer = getTimer();
            if (timer) timer.clearAll();
        },

        // Dice animation
        animateDiceRoll: animateDiceRoll,
        skipAllAnimations: skipAllAnimations,

        // Keywords and highlighting
        KEYWORDS: KEYWORDS,
        highlightKeywords: highlightKeywords,

        // Formatting
        formatNumber: formatNumber,
        formatDiceResult: formatDiceResult,

        // Utilities
        getRollClass: getRollClass,
        getResultCategory: getResultCategory
    };
})();

window.TextEffects = TextEffects;
