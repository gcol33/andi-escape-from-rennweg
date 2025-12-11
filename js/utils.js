/**
 * Andi VN - Shared Utilities Module
 *
 * Common utility functions used across multiple modules.
 * Eliminates code duplication for DOM operations, random utilities, and logging.
 *
 * Usage:
 *   Utils.removeElement(el);
 *   Utils.pickRandom(array);
 *   Utils.getLogger('ModuleName');
 */

var Utils = (function() {
    'use strict';

    // =========================================================================
    // DOM UTILITIES
    // =========================================================================

    /**
     * Safely remove an element from the DOM
     * @param {Element} el - Element to remove
     * @returns {boolean} True if element was removed
     */
    function removeElement(el) {
        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
            return true;
        }
        return false;
    }

    /**
     * Safely query a single element
     * @param {string} selector - CSS selector
     * @param {Element} [parent=document] - Parent element to search within
     * @returns {Element|null}
     */
    function $(selector, parent) {
        return (parent || document).querySelector(selector);
    }

    /**
     * Safely query multiple elements
     * @param {string} selector - CSS selector
     * @param {Element} [parent=document] - Parent element to search within
     * @returns {Element[]}
     */
    function $$(selector, parent) {
        return Array.prototype.slice.call((parent || document).querySelectorAll(selector));
    }

    /**
     * Get element by ID with null safety
     * @param {string} id - Element ID
     * @returns {Element|null}
     */
    function byId(id) {
        return document.getElementById(id);
    }

    /**
     * Set element display style safely
     * @param {Element} el - Element
     * @param {string} display - Display value ('none', 'block', 'flex', '')
     */
    function setDisplay(el, display) {
        if (el) {
            el.style.display = display;
        }
    }

    /**
     * Add class to element safely
     * @param {Element} el - Element
     * @param {string} className - Class to add
     */
    function addClass(el, className) {
        if (el && el.classList) {
            el.classList.add(className);
        }
    }

    /**
     * Remove class from element safely
     * @param {Element} el - Element
     * @param {string} className - Class to remove
     */
    function removeClass(el, className) {
        if (el && el.classList) {
            el.classList.remove(className);
        }
    }

    /**
     * Toggle class on element safely
     * @param {Element} el - Element
     * @param {string} className - Class to toggle
     * @param {boolean} [force] - Force add (true) or remove (false)
     */
    function toggleClass(el, className, force) {
        if (el && el.classList) {
            el.classList.toggle(className, force);
        }
    }

    /**
     * Disable a button and optionally add visual feedback
     * @param {Element} btn - Button element
     * @param {boolean} dim - Whether to dim the button (default: true)
     */
    function disableButton(btn, dim) {
        if (btn) {
            btn.disabled = true;
            if (dim !== false) {
                btn.style.opacity = '0.5';
            }
        }
    }

    /**
     * Enable a button
     * @param {Element} btn - Button element
     */
    function enableButton(btn) {
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '';
        }
    }

    // =========================================================================
    // RANDOM UTILITIES
    // =========================================================================

    /**
     * Pick a random element from an array
     * @param {Array} arr - Array to pick from
     * @returns {*} Random element, or undefined if empty
     */
    function pickRandom(arr) {
        if (!arr || arr.length === 0) return undefined;
        return arr[Math.floor(Math.random() * arr.length)];
    }

    /**
     * Generate a random integer in range [min, max] inclusive
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random integer
     */
    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Random chance check
     * @param {number} probability - Probability 0-1 (e.g., 0.3 for 30%)
     * @returns {boolean} True if success
     */
    function chance(probability) {
        return Math.random() < probability;
    }

    /**
     * Shuffle an array in place (Fisher-Yates)
     * @param {Array} arr - Array to shuffle
     * @returns {Array} The shuffled array (same reference)
     */
    function shuffle(arr) {
        if (!arr) return arr;
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = arr[i];
            arr[i] = arr[j];
            arr[j] = temp;
        }
        return arr;
    }

    // =========================================================================
    // VALIDATION UTILITIES
    // =========================================================================

    /**
     * Check if value is a valid array index
     * @param {Array} arr - Array to check against
     * @param {number} index - Index to validate
     * @returns {boolean}
     */
    function isValidIndex(arr, index) {
        return arr && typeof index === 'number' && index >= 0 && index < arr.length;
    }

    /**
     * Safely get array element with bounds check
     * @param {Array} arr - Array
     * @param {number} index - Index
     * @param {*} [defaultValue] - Default if out of bounds
     * @returns {*}
     */
    function safeGet(arr, index, defaultValue) {
        if (isValidIndex(arr, index)) {
            return arr[index];
        }
        return defaultValue;
    }

    /**
     * Check if object has required properties
     * @param {Object} obj - Object to check
     * @param {string[]} props - Required property names
     * @returns {boolean}
     */
    function hasProps(obj, props) {
        if (!obj || typeof obj !== 'object') return false;
        for (var i = 0; i < props.length; i++) {
            if (obj[props[i]] === undefined) return false;
        }
        return true;
    }

    // =========================================================================
    // LOGGING UTILITIES
    // =========================================================================

    /**
     * Fallback logger that mimics Logger API
     * Used when Logger module hasn't loaded yet
     */
    var fallbackLogger = {
        debug: function() {},
        info: function(m) {
            var a = Array.prototype.slice.call(arguments, 1);
            console.log.apply(console, ['[' + m + ']'].concat(a));
        },
        warn: function(m) {
            var a = Array.prototype.slice.call(arguments, 1);
            console.warn.apply(console, ['[' + m + ']'].concat(a));
        },
        error: function(m) {
            var a = Array.prototype.slice.call(arguments, 1);
            console.error.apply(console, ['[' + m + ']'].concat(a));
        }
    };

    /**
     * Get a logger instance (uses Logger if available, fallback otherwise)
     * @returns {Object} Logger with debug/info/warn/error methods
     */
    function getLogger() {
        return typeof Logger !== 'undefined' ? Logger : fallbackLogger;
    }

    // =========================================================================
    // TIMING UTILITIES
    // =========================================================================

    /**
     * Create a guarded timeout that only executes if condition is still true
     * Useful for preventing callbacks from running after scene changes
     * @param {function} callback - Function to call
     * @param {number} delay - Delay in ms
     * @param {function} guard - Guard function that returns true if callback should execute
     * @returns {number} Timeout ID
     */
    function guardedTimeout(callback, delay, guard) {
        return setTimeout(function() {
            if (guard && !guard()) return;
            callback();
        }, delay);
    }

    /**
     * Debounce a function
     * @param {function} fn - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {function}
     */
    function debounce(fn, wait) {
        var timeout;
        return function() {
            var context = this;
            var args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(function() {
                fn.apply(context, args);
            }, wait);
        };
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        // DOM
        removeElement: removeElement,
        $: $,
        $$: $$,
        byId: byId,
        setDisplay: setDisplay,
        addClass: addClass,
        removeClass: removeClass,
        toggleClass: toggleClass,
        disableButton: disableButton,
        enableButton: enableButton,

        // Random
        pickRandom: pickRandom,
        randomInt: randomInt,
        chance: chance,
        shuffle: shuffle,

        // Validation
        isValidIndex: isValidIndex,
        safeGet: safeGet,
        hasProps: hasProps,

        // Logging
        getLogger: getLogger,

        // Timing
        guardedTimeout: guardedTimeout,
        debounce: debounce
    };
})();
