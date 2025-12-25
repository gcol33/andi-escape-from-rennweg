/**
 * Text Renderer Module
 *
 * Unified text rendering system with:
 * - Typewriter effect (character-by-character display)
 * - Pagination (splitting text into pages for fixed-height mode)
 * - Display modes (fixed vs expanding text box)
 * - Text preprocessing utilities
 *
 * Dependencies: None (core module)
 */
(function() {
    'use strict';

    var _engine = null;
    var _log = typeof Logger !== 'undefined' ? Logger : console;

    // Display mode state
    var _displayMode = 'expanding';  // 'fixed' or 'expanding'
    var _fixedLines = 3;
    var _storyOutput = null;

    /**
     * Set up CSS for fixed-height text mode
     */
    function setupFixedMode() {
        if (!_storyOutput) return;

        _storyOutput.classList.add('fixed-height');
        _storyOutput.classList.remove('expanding-height');

        // Measure and set the fixed height
        measureAndSetFixedHeight();

        _log.debug('TextRenderer', 'Fixed mode enabled (' + _fixedLines + ' lines)');
    }

    /**
     * Set up CSS for expanding text mode
     */
    function setupExpandingMode() {
        if (!_storyOutput) return;

        _storyOutput.classList.remove('fixed-height');
        _storyOutput.classList.add('expanding-height');

        // Clear fixed height CSS variable
        document.documentElement.style.removeProperty('--story-fixed-height');
        document.documentElement.style.removeProperty('--story-fixed-lines');

        _log.debug('TextRenderer', 'Expanding mode enabled');
    }

    /**
     * Measure text height and set CSS variable for fixed mode
     */
    function measureAndSetFixedHeight() {
        if (!_storyOutput || _displayMode !== 'fixed') return;

        var height = TextUtils.measureLineHeight(_fixedLines, _storyOutput);

        document.documentElement.style.setProperty('--story-fixed-height', height + 'px');
        document.documentElement.style.setProperty('--story-fixed-lines', _fixedLines);

        _log.debug('TextRenderer', 'Fixed height set to ' + height + 'px for ' + _fixedLines + ' lines');
    }

    /**
     * Handle window resize - recalculate fixed height
     */
    var resizeTimeout = null;
    function handleResize() {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            if (_displayMode === 'fixed') {
                measureAndSetFixedHeight();

                // Re-paginate current text if pagination is active
                if (Pagination.isActive()) {
                    var currentCharPos = estimateCharPosition();
                    var fullText = Pagination.getFullText();

                    Pagination.start(fullText, _storyOutput);

                    // Try to restore approximate position
                    restoreCharPosition(currentCharPos);
                }
            }
        }, 100);
    }

    /**
     * Estimate current character position for resize restore
     */
    function estimateCharPosition() {
        var pageIndex = Pagination.getCurrentPageIndex();
        var pages = Pagination.getPages();
        var charCount = 0;

        for (var i = 0; i < pageIndex; i++) {
            charCount += pages[i].length;
        }

        return charCount;
    }

    /**
     * Restore to approximate character position after re-pagination
     */
    function restoreCharPosition(targetChars) {
        var pages = Pagination.getPages();
        var charCount = 0;

        for (var i = 0; i < pages.length; i++) {
            charCount += pages[i].length;
            if (charCount >= targetChars) {
                Pagination.setCurrentPage(i);
                return;
            }
        }
    }

    var module = {
        name: 'text-renderer',
        dependencies: [],

        /**
         * Initialize the text renderer module
         * @param {Object} engine - Engine API
         */
        init: function(engine) {
            _engine = engine;

            // Get configuration from TUNING if available
            if (typeof TUNING !== 'undefined' && TUNING.text) {
                _displayMode = TUNING.text.displayMode || 'expanding';
                _fixedLines = TUNING.text.fixedLines || 3;
            }

            // Get story output element
            _storyOutput = document.getElementById('story-output');

            // Initialize sub-modules
            Typewriter.init({
                getSpeed: function() {
                    // Get speed from engine config or TUNING
                    if (typeof TUNING !== 'undefined' && TUNING.text && TUNING.text.speed) {
                        var currentSpeed = 'normal';  // Default
                        if (_engine && _engine.getState) {
                            var state = _engine.getState();
                            currentSpeed = state.currentSpeed || 'normal';
                        }
                        return TUNING.text.speed[currentSpeed] || 18;
                    }
                    return 18;
                }
            });

            Pagination.init({
                maxLines: _fixedLines,
                balanceThreshold: typeof TUNING !== 'undefined' && TUNING.text
                    ? TUNING.text.pageBalanceThreshold || 0.5
                    : 0.5,
                referenceElement: _storyOutput
            });

            // Initialize text effects with SFX callback
            if (typeof TextEffects !== 'undefined') {
                TextEffects.init({
                    playSfx: _engine && _engine.playSfx ? _engine.playSfx : function() {}
                });
            }

            // Set up display mode
            if (_displayMode === 'fixed') {
                setupFixedMode();
            } else {
                setupExpandingMode();
            }

            // Listen for window resize
            window.addEventListener('resize', handleResize);

            _log.info('TextRenderer', 'Initialized (mode: ' + _displayMode + ')');
        },

        /**
         * Clean up the text renderer module
         */
        destroy: function() {
            window.removeEventListener('resize', handleResize);
            Typewriter.stop();
            Pagination.reset();
            if (typeof TextEffects !== 'undefined') {
                TextEffects.cleanup();
            }
            _engine = null;
            _storyOutput = null;
            _log.info('TextRenderer', 'Destroyed');
        },

        // === Public API ===

        /**
         * Render text with typewriter effect
         * @param {string} text - Text to render
         * @param {Element} element - Target element
         * @param {Object} options
         * @param {Function} options.onComplete - Callback when done
         * @param {boolean} options.canSkip - Allow skip
         * @param {number} options.speed - Speed override
         * @param {boolean} options.instant - Skip typewriter, show instantly
         */
        render: function(text, element, options) {
            options = options || {};

            // Format markdown
            var html = TextUtils.formatMarkdownBold(text);

            if (options.instant) {
                element.innerHTML = html;
                element.classList.add('typewriter-complete');
                if (options.onComplete) options.onComplete();
            } else {
                Typewriter.start(html, element, options.onComplete, options.canSkip, options.speed);
            }
        },

        /**
         * Paginate text for fixed-height mode
         * @param {string} text
         * @returns {Object} - Pagination state
         */
        paginate: function(text) {
            if (_displayMode !== 'fixed') {
                return { active: false, pages: [text], currentPage: 0 };
            }
            return Pagination.start(text, _storyOutput);
        },

        /**
         * Skip current typewriter animation
         * @returns {boolean}
         */
        skip: function() {
            return Typewriter.skip();
        },

        /**
         * Stop typewriter
         */
        stop: function() {
            Typewriter.stop();
        },

        /**
         * Check if typing
         * @returns {boolean}
         */
        isTyping: function() {
            return Typewriter.isTyping();
        },

        /**
         * Check if more pages exist
         * @returns {boolean}
         */
        hasMorePages: function() {
            return Pagination.hasMorePages();
        },

        /**
         * Advance to next page
         * @returns {boolean}
         */
        advancePage: function() {
            return Pagination.advance();
        },

        /**
         * Get current page text
         * @returns {string}
         */
        getCurrentPage: function() {
            return Pagination.getCurrentPage();
        },

        /**
         * Reset pagination
         */
        resetPagination: function() {
            Pagination.reset();
        },

        /**
         * Set display mode
         * @param {string} mode - 'fixed' or 'expanding'
         */
        setDisplayMode: function(mode) {
            if (mode !== 'fixed' && mode !== 'expanding') return;

            _displayMode = mode;

            if (mode === 'fixed') {
                setupFixedMode();
            } else {
                setupExpandingMode();
            }
        },

        /**
         * Get current display mode
         * @returns {string}
         */
        getDisplayMode: function() {
            return _displayMode;
        },

        /**
         * Set fixed lines count
         * @param {number} lines
         */
        setFixedLines: function(lines) {
            if (lines < 1 || lines > 10) return;

            _fixedLines = lines;
            Pagination.configure({ maxLines: lines });

            if (_displayMode === 'fixed') {
                measureAndSetFixedHeight();
            }
        },

        /**
         * Get fixed lines count
         * @returns {number}
         */
        getFixedLines: function() {
            return _fixedLines;
        },

        /**
         * Ensure text box sizing is correct
         */
        ensureSizing: function() {
            if (_displayMode === 'fixed') {
                measureAndSetFixedHeight();
            }
        },

        /**
         * Preprocess text blocks (split long blocks)
         * @param {string[]} blocks
         * @param {boolean} isEnding - Don't split ending scenes
         * @returns {string[]}
         */
        preprocessBlocks: function(blocks, isEnding) {
            if (!blocks || blocks.length === 0) return blocks;
            if (isEnding) return blocks;  // Don't split endings

            var maxLength = typeof TUNING !== 'undefined' && TUNING.text
                ? TUNING.text.maxBlockLength || 350
                : 350;

            var result = [];

            for (var i = 0; i < blocks.length; i++) {
                var block = blocks[i];

                // Don't split if has formatting
                if (TextUtils.hasMarkdownFormatting(block) || TextUtils.hasQuotes(block)) {
                    result.push(block);
                    continue;
                }

                // Split if too long
                if (block.length > maxLength) {
                    var sentences = TextUtils.splitIntoSentences(block);
                    var current = '';

                    for (var j = 0; j < sentences.length; j++) {
                        if (current.length + sentences[j].length > maxLength && current.length > 0) {
                            result.push(current.trim());
                            current = sentences[j];
                        } else {
                            current += sentences[j];
                        }
                    }

                    if (current.trim()) {
                        result.push(current.trim());
                    }
                } else {
                    result.push(block);
                }
            }

            return result;
        },

        // === Text Effects API ===

        /**
         * Get keywords constant for highlighting
         * @returns {Object}
         */
        getKeywords: function() {
            return typeof TextEffects !== 'undefined' ? TextEffects.KEYWORDS : {};
        },

        /**
         * Highlight keywords in text
         * @param {string} text
         * @returns {string} - HTML with highlighted keywords
         */
        highlightKeywords: function(text) {
            return typeof TextEffects !== 'undefined'
                ? TextEffects.highlightKeywords(text)
                : text;
        },

        /**
         * Format a number for display (damage, healing, etc.)
         * @param {number} value
         * @param {string} type - 'damage', 'heal', 'mana', 'neutral'
         * @returns {string} - HTML string
         */
        formatNumber: function(value, type) {
            return typeof TextEffects !== 'undefined'
                ? TextEffects.formatNumber(value, type)
                : String(value);
        },

        /**
         * Animate a dice roll with slot machine effect
         * @param {Element} element
         * @param {Object} rollResult - { roll, sides, isCrit, isFumble, isMax, isMin }
         * @param {Object} options - { rollType, onComplete, playSfx }
         */
        animateDiceRoll: function(element, rollResult, options) {
            if (typeof TextEffects !== 'undefined') {
                TextEffects.animateDiceRoll(element, rollResult, options);
            }
        },

        /**
         * Format a dice result for display
         * @param {Object} rollResult - { roll, sides, isCrit, isFumble }
         * @param {Object} options - { threshold, success, skillName }
         * @returns {string} - HTML string
         */
        formatDiceResult: function(rollResult, options) {
            return typeof TextEffects !== 'undefined'
                ? TextEffects.formatDiceResult(rollResult, options)
                : 'Rolled: ' + rollResult.roll;
        },

        /**
         * Skip all active dice animations
         */
        skipDiceAnimations: function() {
            if (typeof TextEffects !== 'undefined') {
                TextEffects.skipAllAnimations();
            }
        },

        /**
         * Get CSS class for roll result
         * @param {string} rollType - 'hit', 'damage', 'heal', 'status', 'neutral'
         * @param {string} resultCategory - 'crit', 'fail', 'max', 'min', 'normal'
         * @returns {string}
         */
        getRollClass: function(rollType, resultCategory) {
            return typeof TextEffects !== 'undefined'
                ? TextEffects.getRollClass(rollType, resultCategory)
                : 'roll-' + rollType + '-' + resultCategory;
        },

        /**
         * Get result category from roll result
         * @param {Object} rollResult
         * @returns {string}
         */
        getResultCategory: function(rollResult) {
            return typeof TextEffects !== 'undefined'
                ? TextEffects.getResultCategory(rollResult)
                : 'normal';
        }
    };

    // Register with ModuleRegistry
    if (typeof ModuleRegistry !== 'undefined') {
        ModuleRegistry.register(module);
    }

    // Expose globally
    window.TextRenderer = module;
})();
