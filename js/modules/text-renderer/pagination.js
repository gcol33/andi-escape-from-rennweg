/**
 * Pagination
 *
 * Splits long text into pages that fit within a fixed-height container.
 */
var Pagination = (function() {
    'use strict';

    var _log = typeof Logger !== 'undefined' ? Logger : console;

    // Pagination state
    var state = {
        active: false,
        pages: [],
        currentPage: 0,
        fullText: ''
    };

    // Configuration
    var _config = {
        maxLines: 3,
        balanceThreshold: 0.5
    };

    // Reference element for measurements
    var _referenceElement = null;

    /**
     * Create a measurement element with matching styles
     * @param {Element} referenceElement
     * @returns {Element}
     */
    function createMeasurer(referenceElement) {
        var el = document.createElement('div');
        var computed = window.getComputedStyle(referenceElement);

        el.style.position = 'absolute';
        el.style.visibility = 'hidden';
        el.style.pointerEvents = 'none';
        el.style.width = referenceElement.clientWidth + 'px';
        el.style.height = 'auto';
        el.style.maxHeight = 'none';
        el.style.overflow = 'visible';
        el.style.fontSize = computed.fontSize;
        el.style.fontFamily = computed.fontFamily;
        el.style.lineHeight = computed.lineHeight;
        el.style.letterSpacing = computed.letterSpacing;
        el.style.wordSpacing = computed.wordSpacing;
        el.style.padding = '0';
        el.style.margin = '0';
        el.style.boxSizing = 'content-box';

        document.body.appendChild(el);
        return el;
    }

    /**
     * Format text with markdown bold converted to HTML
     * @param {string} text
     * @returns {string}
     */
    function formatText(text) {
        return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    }

    /**
     * Measure height of text in the measurer element
     * @param {Element} measurer
     * @param {string} text
     * @returns {number}
     */
    function measureHeight(measurer, text) {
        var formatted = formatText(text);
        measurer.innerHTML = '<p class="typewriter-text" style="margin:0;padding:0;display:block;">' + formatted + '</p>';
        return measurer.offsetHeight;
    }

    /**
     * Get the max height for pages from CSS variable
     * @param {Element} measurer
     * @returns {number}
     */
    function getMaxHeight(measurer) {
        var fixedHeightStr = document.documentElement.style.getPropertyValue('--story-fixed-height');
        var maxHeight = parseFloat(fixedHeightStr);

        if (isNaN(maxHeight) || maxHeight <= 0) {
            // Fallback: calculate using explicit line breaks
            var lines = [];
            for (var k = 0; k < _config.maxLines; k++) {
                lines.push('Mgy');
            }
            measurer.innerHTML = '<p class="typewriter-text" style="margin:0;padding:0;display:block;">' + lines.join('<br>') + '</p>';
            maxHeight = measurer.offsetHeight;
        }

        // No safety margin - use exact measured height
        // The measurement uses the same styles as the display
        return maxHeight;
    }

    /**
     * Split text into pages using greedy algorithm
     * @param {Element} measurer
     * @param {string} text
     * @param {number} targetHeight
     * @returns {string[]}
     */
    function doPaginate(measurer, text, targetHeight) {
        var words = text.split(/(\s+)/);  // Keep whitespace
        var pages = [];
        var currentPage = '';

        for (var i = 0; i < words.length; i++) {
            var testText = currentPage + words[i];

            if (measureHeight(measurer, testText) > targetHeight && currentPage.trim() !== '') {
                pages.push(currentPage.trim());
                currentPage = words[i];
            } else {
                currentPage = testText;
            }
        }

        if (currentPage.trim() !== '') {
            pages.push(currentPage.trim());
        }

        return pages;
    }

    /**
     * Balance pages if last page is too short
     * @param {Element} measurer
     * @param {string[]} pages
     * @param {number} maxHeight
     * @returns {string[]}
     */
    function balancePages(measurer, pages, maxHeight) {
        if (_config.balanceThreshold <= 0 || pages.length <= 1) {
            return pages;
        }

        var lastPageHeight = measureHeight(measurer, pages[pages.length - 1]);
        var fillRatio = lastPageHeight / maxHeight;

        if (fillRatio < _config.balanceThreshold) {
            // Calculate balanced target height
            var totalHeight = 0;
            for (var i = 0; i < pages.length; i++) {
                totalHeight += measureHeight(measurer, pages[i]);
            }
            var avgHeight = totalHeight / pages.length;
            var balancedTarget = Math.min(avgHeight * 1.1, maxHeight);

            // Rejoin all text and repaginate
            var fullText = pages.join(' ');
            var balancedPages = doPaginate(measurer, fullText, balancedTarget);

            if (balancedPages.length <= pages.length) {
                _log.debug('Pagination', 'Rebalanced: ' + balancedPages.length + ' pages');
                return balancedPages;
            }
        }

        return pages;
    }

    return {
        /**
         * Initialize pagination
         * @param {Object} options
         * @param {number} options.maxLines - Lines per page
         * @param {number} options.balanceThreshold - Min fill ratio for last page (0-1)
         * @param {Element} options.referenceElement - Element to copy styles from
         */
        init: function(options) {
            if (options) {
                if (options.maxLines) _config.maxLines = options.maxLines;
                if (options.balanceThreshold !== undefined) _config.balanceThreshold = options.balanceThreshold;
                if (options.referenceElement) _referenceElement = options.referenceElement;
            }
            _log.debug('Pagination', 'Initialized');
        },

        /**
         * Paginate text into pages
         * @param {string} text
         * @param {Element} referenceElement - Optional, overrides init reference
         * @returns {string[]}
         */
        paginate: function(text, referenceElement) {
            var ref = referenceElement || _referenceElement;
            if (!ref) {
                _log.warn('Pagination', 'No reference element');
                return [text];
            }

            var measurer = createMeasurer(ref);
            var maxHeight = getMaxHeight(measurer);

            // Initial greedy pagination
            var pages = doPaginate(measurer, text, maxHeight);

            // Balance if needed
            pages = balancePages(measurer, pages, maxHeight);

            // Cleanup
            if (measurer.parentNode) {
                measurer.parentNode.removeChild(measurer);
            }

            return pages.length > 0 ? pages : [text];
        },

        /**
         * Start pagination for a text block
         * @param {string} text
         * @param {Element} referenceElement
         */
        start: function(text, referenceElement) {
            var pages = this.paginate(text, referenceElement);

            state = {
                active: pages.length > 1,
                pages: pages,
                currentPage: 0,
                fullText: text
            };

            return state;
        },

        /**
         * Reset pagination state
         */
        reset: function() {
            state = {
                active: false,
                pages: [],
                currentPage: 0,
                fullText: ''
            };
        },

        /**
         * Check if more pages exist
         * @returns {boolean}
         */
        hasMorePages: function() {
            return state.active && state.currentPage < state.pages.length - 1;
        },

        /**
         * Advance to next page
         * @returns {boolean} - True if advanced
         */
        advance: function() {
            if (!this.hasMorePages()) {
                return false;
            }
            state.currentPage++;
            return true;
        },

        /**
         * Get current page text
         * @returns {string}
         */
        getCurrentPage: function() {
            if (!state.active || state.pages.length === 0) {
                return state.fullText;
            }
            return state.pages[state.currentPage];
        },

        /**
         * Get all pages
         * @returns {string[]}
         */
        getPages: function() {
            return state.pages;
        },

        /**
         * Get current page index
         * @returns {number}
         */
        getCurrentPageIndex: function() {
            return state.currentPage;
        },

        /**
         * Get total page count
         * @returns {number}
         */
        getPageCount: function() {
            return state.pages.length;
        },

        /**
         * Check if pagination is active
         * @returns {boolean}
         */
        isActive: function() {
            return state.active;
        },

        /**
         * Get full original text
         * @returns {string}
         */
        getFullText: function() {
            return state.fullText;
        },

        /**
         * Set current page (for restore after resize)
         * @param {number} pageIndex
         */
        setCurrentPage: function(pageIndex) {
            if (pageIndex >= 0 && pageIndex < state.pages.length) {
                state.currentPage = pageIndex;
            }
        },

        /**
         * Update configuration
         * @param {Object} options
         */
        configure: function(options) {
            if (options.maxLines) _config.maxLines = options.maxLines;
            if (options.balanceThreshold !== undefined) _config.balanceThreshold = options.balanceThreshold;
        }
    };
})();

window.Pagination = Pagination;
