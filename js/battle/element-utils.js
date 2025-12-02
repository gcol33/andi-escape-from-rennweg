/**
 * Andi VN - Element Utilities Module
 *
 * Shared DOM manipulation utilities for battle UI and related modules.
 * Provides consistent element creation, removal, and class management.
 *
 * Usage:
 *   ElementUtils.createElement('div', 'my-class', 'Hello');
 *   ElementUtils.removeElement(element);
 *   ElementUtils.removeById('my-element');
 */

var ElementUtils = (function() {
    'use strict';

    // === Element Creation ===

    /**
     * Create an element with class and optional content
     * @param {string} tag - HTML tag name
     * @param {string} className - CSS class(es) to apply
     * @param {string} content - Optional text content
     * @param {object} attrs - Optional attributes object
     * @returns {HTMLElement} Created element
     */
    function createElement(tag, className, content, attrs) {
        var el = document.createElement(tag);
        if (className) {
            el.className = className;
        }
        if (content !== undefined && content !== null) {
            el.textContent = content;
        }
        if (attrs) {
            for (var key in attrs) {
                if (attrs.hasOwnProperty(key)) {
                    if (key === 'style' && typeof attrs[key] === 'object') {
                        // Handle style object
                        for (var styleProp in attrs[key]) {
                            if (attrs[key].hasOwnProperty(styleProp)) {
                                el.style[styleProp] = attrs[key][styleProp];
                            }
                        }
                    } else if (key.indexOf('data-') === 0) {
                        el.setAttribute(key, attrs[key]);
                    } else {
                        el[key] = attrs[key];
                    }
                }
            }
        }
        return el;
    }

    /**
     * Create an element with innerHTML
     * @param {string} tag - HTML tag name
     * @param {string} className - CSS class(es)
     * @param {string} html - Inner HTML content
     * @returns {HTMLElement} Created element
     */
    function createElementWithHTML(tag, className, html) {
        var el = document.createElement(tag);
        if (className) {
            el.className = className;
        }
        if (html) {
            el.innerHTML = html;
        }
        return el;
    }

    // === Element Removal ===

    /**
     * Safely remove an element from its parent
     * @param {HTMLElement} element - Element to remove
     */
    function removeElement(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }

    /**
     * Remove an element by ID
     * @param {string} id - Element ID
     */
    function removeById(id) {
        var el = document.getElementById(id);
        removeElement(el);
    }

    /**
     * Remove multiple elements by IDs
     * @param {Array<string>} ids - Array of element IDs
     */
    function removeByIds(ids) {
        ids.forEach(function(id) {
            removeById(id);
        });
    }

    /**
     * Remove all children from an element
     * @param {HTMLElement} element - Parent element
     */
    function clearChildren(element) {
        if (!element) return;
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    // === Class Management ===

    /**
     * Toggle a class on an element
     * @param {HTMLElement} element - Target element
     * @param {string} className - Class to toggle
     * @param {boolean} force - Optional force add/remove
     */
    function toggleClass(element, className, force) {
        if (!element) return;
        if (force !== undefined) {
            if (force) {
                element.classList.add(className);
            } else {
                element.classList.remove(className);
            }
        } else {
            element.classList.toggle(className);
        }
    }

    /**
     * Add multiple classes to an element
     * @param {HTMLElement} element - Target element
     * @param {Array<string>} classes - Classes to add
     */
    function addClasses(element, classes) {
        if (!element) return;
        classes.forEach(function(cls) {
            element.classList.add(cls);
        });
    }

    /**
     * Remove multiple classes from an element
     * @param {HTMLElement} element - Target element
     * @param {Array<string>} classes - Classes to remove
     */
    function removeClasses(element, classes) {
        if (!element) return;
        classes.forEach(function(cls) {
            element.classList.remove(cls);
        });
    }

    /**
     * Replace a class with another
     * @param {HTMLElement} element - Target element
     * @param {string} oldClass - Class to remove
     * @param {string} newClass - Class to add
     */
    function replaceClass(element, oldClass, newClass) {
        if (!element) return;
        element.classList.remove(oldClass);
        element.classList.add(newClass);
    }

    // === Visibility ===

    /**
     * Show an element (set display to block or specified value)
     * @param {HTMLElement} element - Target element
     * @param {string} displayValue - Optional display value (default: 'block')
     */
    function show(element, displayValue) {
        if (!element) return;
        element.style.display = displayValue || 'block';
    }

    /**
     * Hide an element (set display to none)
     * @param {HTMLElement} element - Target element
     */
    function hide(element) {
        if (!element) return;
        element.style.display = 'none';
    }

    /**
     * Toggle element visibility
     * @param {HTMLElement} element - Target element
     * @param {boolean} visible - Whether to show or hide
     * @param {string} displayValue - Display value when shown
     */
    function setVisible(element, visible, displayValue) {
        if (!element) return;
        element.style.display = visible ? (displayValue || 'block') : 'none';
    }

    // === Timeout Management ===

    /**
     * Create a managed timeout that can be tracked and cleared
     * @param {function} callback - Function to call
     * @param {number} delay - Delay in ms
     * @param {Array} timeoutArray - Array to store timeout ID for cleanup
     * @returns {number} Timeout ID
     */
    function managedTimeout(callback, delay, timeoutArray) {
        var id = setTimeout(function() {
            // Remove from tracking array when executed
            if (timeoutArray) {
                var index = timeoutArray.indexOf(id);
                if (index > -1) {
                    timeoutArray.splice(index, 1);
                }
            }
            callback();
        }, delay);

        if (timeoutArray) {
            timeoutArray.push(id);
        }
        return id;
    }

    /**
     * Clear all managed timeouts
     * @param {Array} timeoutArray - Array of timeout IDs
     */
    function clearAllTimeouts(timeoutArray) {
        if (!timeoutArray) return;
        timeoutArray.forEach(function(id) {
            clearTimeout(id);
        });
        timeoutArray.length = 0;
    }

    // === Animation Helpers ===

    /**
     * Add a temporary class that auto-removes after duration
     * @param {HTMLElement} element - Target element
     * @param {string} className - Class to add temporarily
     * @param {number} duration - Duration in ms
     * @param {function} callback - Optional callback after removal
     */
    function flashClass(element, className, duration, callback) {
        if (!element) return;
        element.classList.add(className);
        setTimeout(function() {
            element.classList.remove(className);
            if (callback) callback();
        }, duration);
    }

    /**
     * Fade out and remove an element
     * @param {HTMLElement} element - Target element
     * @param {number} duration - Fade duration in ms
     * @param {function} callback - Optional callback after removal
     */
    function fadeOutAndRemove(element, duration, callback) {
        if (!element) {
            if (callback) callback();
            return;
        }
        element.style.transition = 'opacity ' + duration + 'ms';
        element.style.opacity = '0';
        setTimeout(function() {
            removeElement(element);
            if (callback) callback();
        }, duration);
    }

    // === Query Helpers ===

    /**
     * Query selector with null safety
     * @param {string} selector - CSS selector
     * @param {HTMLElement} parent - Optional parent (default: document)
     * @returns {HTMLElement|null}
     */
    function query(selector, parent) {
        return (parent || document).querySelector(selector);
    }

    /**
     * Query all matching elements
     * @param {string} selector - CSS selector
     * @param {HTMLElement} parent - Optional parent (default: document)
     * @returns {NodeList}
     */
    function queryAll(selector, parent) {
        return (parent || document).querySelectorAll(selector);
    }

    /**
     * Get element by ID with optional caching
     * @param {string} id - Element ID
     * @param {object} cache - Optional cache object
     * @param {string} cacheKey - Optional key for cache (defaults to id)
     * @returns {HTMLElement|null}
     */
    function getById(id, cache, cacheKey) {
        if (cache) {
            var key = cacheKey || id;
            if (!cache[key]) {
                cache[key] = document.getElementById(id);
            }
            return cache[key];
        }
        return document.getElementById(id);
    }

    // === Public API ===
    return {
        // Creation
        createElement: createElement,
        createElementWithHTML: createElementWithHTML,

        // Removal
        removeElement: removeElement,
        removeById: removeById,
        removeByIds: removeByIds,
        clearChildren: clearChildren,

        // Classes
        toggleClass: toggleClass,
        addClasses: addClasses,
        removeClasses: removeClasses,
        replaceClass: replaceClass,

        // Visibility
        show: show,
        hide: hide,
        setVisible: setVisible,

        // Timeouts
        managedTimeout: managedTimeout,
        clearAllTimeouts: clearAllTimeouts,

        // Animation
        flashClass: flashClass,
        fadeOutAndRemove: fadeOutAndRemove,

        // Query
        query: query,
        queryAll: queryAll,
        getById: getById
    };
})();
