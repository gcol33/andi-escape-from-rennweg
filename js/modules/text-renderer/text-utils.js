/**
 * Text Utilities
 *
 * Shared helper functions for text rendering.
 */
var TextUtils = (function() {
    'use strict';

    /**
     * Convert markdown-style bold (**text**) to HTML strong tags
     * @param {string} text
     * @returns {string}
     */
    function formatMarkdownBold(text) {
        if (!text) return text;
        return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    }

    /**
     * Split text into sentences while preserving punctuation
     * @param {string} text
     * @returns {string[]}
     */
    function splitIntoSentences(text) {
        if (!text) return [];
        // Match sentences ending with . ! or ?
        var matches = text.match(/[^.!?]*[.!?]+/g);
        return matches || [text];
    }

    /**
     * Copy computed styles from source to target element
     * Used for accurate text measurement
     * @param {Element} source
     * @param {Element} target
     */
    function copyTextStyles(source, target) {
        var computed = window.getComputedStyle(source);
        var stylesToCopy = [
            'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
            'lineHeight', 'letterSpacing', 'wordSpacing',
            'textTransform', 'textIndent', 'whiteSpace',
            'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom',
            'boxSizing', 'width'
        ];

        stylesToCopy.forEach(function(prop) {
            target.style[prop] = computed[prop];
        });
    }

    /**
     * Create a hidden measurement element for calculating text dimensions
     * @param {Element} referenceElement - Element to copy styles from
     * @returns {Element}
     */
    function createMeasurementElement(referenceElement) {
        var measurer = document.createElement('div');
        measurer.style.position = 'absolute';
        measurer.style.visibility = 'hidden';
        measurer.style.left = '-9999px';
        measurer.style.top = '-9999px';
        measurer.style.overflow = 'hidden';

        if (referenceElement) {
            copyTextStyles(referenceElement, measurer);
        }

        document.body.appendChild(measurer);
        return measurer;
    }

    /**
     * Remove measurement element from DOM
     * @param {Element} measurer
     */
    function removeMeasurementElement(measurer) {
        if (measurer && measurer.parentNode) {
            measurer.parentNode.removeChild(measurer);
        }
    }

    /**
     * Measure the height of text when rendered in an element
     * @param {string} text - Text to measure
     * @param {Element} referenceElement - Element to copy styles from
     * @returns {number} - Height in pixels
     */
    function measureTextHeight(text, referenceElement) {
        var measurer = createMeasurementElement(referenceElement);
        measurer.innerHTML = formatMarkdownBold(text);
        var height = measurer.offsetHeight;
        removeMeasurementElement(measurer);
        return height;
    }

    /**
     * Measure the height of N lines of text
     * Uses reference text with ascenders and descenders (Mgy)
     * @param {number} numLines
     * @param {Element} referenceElement
     * @returns {number} - Height in pixels
     */
    function measureLineHeight(numLines, referenceElement) {
        var measurer = createMeasurementElement(referenceElement);

        // Use text with ascenders (M) and descenders (g, y) for accurate height
        var testLine = 'Mgy';
        var testText = '';
        for (var i = 0; i < numLines; i++) {
            testText += (i > 0 ? '<br>' : '') + testLine;
        }

        measurer.innerHTML = testText;
        var height = measurer.offsetHeight;
        removeMeasurementElement(measurer);
        return height;
    }

    /**
     * Parse text into segments: HTML tags vs plain text
     * Used by typewriter to preserve HTML while animating
     * @param {string} html
     * @returns {Array} - Array of {type: 'tag'|'text', content: string}
     */
    function parseHtmlSegments(html) {
        if (!html) return [];

        var segments = [];
        var tagRegex = /<[^>]+>/g;
        var lastIndex = 0;
        var match;

        while ((match = tagRegex.exec(html)) !== null) {
            // Add text before this tag
            if (match.index > lastIndex) {
                segments.push({
                    type: 'text',
                    content: html.substring(lastIndex, match.index)
                });
            }
            // Add the tag
            segments.push({
                type: 'tag',
                content: match[0]
            });
            lastIndex = tagRegex.lastIndex;
        }

        // Add remaining text after last tag
        if (lastIndex < html.length) {
            segments.push({
                type: 'text',
                content: html.substring(lastIndex)
            });
        }

        return segments;
    }

    /**
     * Check if text contains markdown formatting
     * @param {string} text
     * @returns {boolean}
     */
    function hasMarkdownFormatting(text) {
        if (!text) return false;
        return /\*\*[^*]+\*\*/.test(text);
    }

    /**
     * Check if text contains quote markers
     * @param {string} text
     * @returns {boolean}
     */
    function hasQuotes(text) {
        if (!text) return false;
        return /"[^"]*"/.test(text) || /'[^']*'/.test(text);
    }

    return {
        formatMarkdownBold: formatMarkdownBold,
        splitIntoSentences: splitIntoSentences,
        copyTextStyles: copyTextStyles,
        createMeasurementElement: createMeasurementElement,
        removeMeasurementElement: removeMeasurementElement,
        measureTextHeight: measureTextHeight,
        measureLineHeight: measureLineHeight,
        parseHtmlSegments: parseHtmlSegments,
        hasMarkdownFormatting: hasMarkdownFormatting,
        hasQuotes: hasQuotes
    };
})();

window.TextUtils = TextUtils;
