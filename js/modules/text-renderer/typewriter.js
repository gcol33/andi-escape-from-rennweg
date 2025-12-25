/**
 * Typewriter Effect
 *
 * Character-by-character text display with configurable speed.
 */
var Typewriter = (function() {
    'use strict';

    var _log = typeof Logger !== 'undefined' ? Logger : console;

    // Typewriter state
    var state = {
        isTyping: false,
        timeoutId: null,
        autoAdvanceId: null,
        segments: null,
        currentSegment: 0,
        currentChar: 0,
        element: null,
        renderedHTML: '',
        onComplete: null,
        canSkip: false,
        speedOverride: null
    };

    // Speed callback - set by init()
    var _getSpeed = function() { return 18; };

    /**
     * Parse HTML into segments (tags vs text)
     * @param {string} html
     * @returns {Array}
     */
    function parseSegments(html) {
        var segments = [];
        var regex = /(<[^>]+>)|([^<]+)/g;
        var match;

        while ((match = regex.exec(html)) !== null) {
            if (match[1]) {
                segments.push({ type: 'tag', content: match[1] });
            } else if (match[2]) {
                segments.push({ type: 'text', content: match[2] });
            }
        }

        return segments;
    }

    /**
     * Type the next character
     */
    function typeNextChar() {
        if (!state.isTyping) return;
        if (!state.element) {
            // No element to render to - finish immediately
            finish();
            return;
        }

        if (state.currentSegment >= state.segments.length) {
            finish();
            return;
        }

        var segment = state.segments[state.currentSegment];

        if (segment.type === 'tag') {
            // Add entire tag at once
            state.renderedHTML += segment.content;
            state.element.innerHTML = state.renderedHTML;
            state.currentSegment++;
            state.currentChar = 0;
            typeNextChar();
        } else {
            // Add one character at a time
            if (state.currentChar < segment.content.length) {
                state.renderedHTML += segment.content[state.currentChar];
                state.element.innerHTML = state.renderedHTML;
                state.currentChar++;

                var speed = state.speedOverride !== null ? state.speedOverride : _getSpeed();

                if (speed === 0) {
                    typeNextChar();
                } else {
                    state.timeoutId = typeof TimerManager !== 'undefined'
                        ? TimerManager.setTimeout(typeNextChar, speed, 'typewriter')
                        : setTimeout(typeNextChar, speed);
                }
            } else {
                state.currentSegment++;
                state.currentChar = 0;
                typeNextChar();
            }
        }
    }

    /**
     * Stop the typewriter (clear timers)
     */
    function stop() {
        if (state.timeoutId) {
            if (typeof TimerManager !== 'undefined') {
                TimerManager.clear(state.timeoutId);
            } else {
                clearTimeout(state.timeoutId);
            }
            state.timeoutId = null;
        }
        if (state.autoAdvanceId) {
            if (typeof TimerManager !== 'undefined') {
                TimerManager.clear(state.autoAdvanceId);
            } else {
                clearTimeout(state.autoAdvanceId);
            }
            state.autoAdvanceId = null;
        }
        state.isTyping = false;
    }

    /**
     * Finish typing and call completion callback
     */
    function finish() {
        // Stop timers first
        stop();

        // Capture callbacks before clearing state
        var element = state.element;
        var onComplete = state.onComplete;

        // Add completion class
        if (element) {
            element.classList.add('typewriter-complete');
        }

        // Call completion callback synchronously
        if (onComplete) {
            onComplete();
        }
    }

    return {
        /**
         * Initialize with speed callback
         * @param {Object} options
         * @param {Function} options.getSpeed - Returns ms per character
         */
        init: function(options) {
            if (options && options.getSpeed) {
                _getSpeed = options.getSpeed;
            }
            _log.debug('Typewriter', 'Initialized');
        },

        /**
         * Start typewriter effect
         * @param {string} html - HTML content to type
         * @param {Element} element - Target DOM element
         * @param {Function} onComplete - Callback when finished
         * @param {boolean} canSkip - Allow skip via click
         * @param {number} speedOverride - Override speed (ms per char)
         */
        start: function(html, element, onComplete, canSkip, speedOverride) {
            stop();

            var segments = parseSegments(html);

            state = {
                isTyping: true,
                timeoutId: null,
                autoAdvanceId: null,
                segments: segments,
                currentSegment: 0,
                currentChar: 0,
                element: element,
                renderedHTML: '',
                onComplete: onComplete,
                canSkip: canSkip || false,
                speedOverride: speedOverride !== undefined ? speedOverride : null
            };

            // Remove completion class if present
            if (element) {
                element.classList.remove('typewriter-complete');
            }

            typeNextChar();
        },

        /**
         * Skip to end of current text
         * @returns {boolean} - True if skip occurred
         */
        skip: function() {
            // Check if there's anything to skip
            if (!state.segments || state.segments.length === 0) return false;

            // If not actively typing, check if we have an element and callback to complete
            if (!state.isTyping) {
                // Already finished or never started
                return false;
            }

            // Build complete HTML from ALL segments
            var fullHTML = '';
            for (var i = 0; i < state.segments.length; i++) {
                fullHTML += state.segments[i].content;
            }

            if (state.element) {
                state.element.innerHTML = fullHTML;
            }

            finish();
            return true;
        },

        /**
         * Stop typewriter without completing
         */
        stop: stop,

        /**
         * Check if currently typing
         * @returns {boolean}
         */
        isTyping: function() {
            return state.isTyping;
        },

        /**
         * Check if skip is allowed
         * @returns {boolean}
         */
        canSkip: function() {
            return state.canSkip;
        },

        /**
         * Get current rendered HTML
         * @returns {string}
         */
        getRenderedHTML: function() {
            return state.renderedHTML;
        },

        /**
         * Get current character position (for save/restore)
         * @returns {Object}
         */
        getPosition: function() {
            var charCount = 0;
            for (var i = 0; i < state.currentSegment; i++) {
                if (state.segments[i].type === 'text') {
                    charCount += state.segments[i].content.length;
                }
            }
            charCount += state.currentChar;
            return {
                segment: state.currentSegment,
                char: state.currentChar,
                totalChars: charCount
            };
        }
    };
})();

window.Typewriter = Typewriter;
