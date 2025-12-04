/**
 * Andi VN - Theme Utilities
 *
 * Shared theme management for both game and editor.
 * Supports two modes:
 * - CSS Link mode (game): Changes <link id="theme-css"> href
 * - Body Class mode (editor): Adds theme-* class to <body>
 */

const ThemeUtils = (function() {
    'use strict';

    const STORAGE_KEY = 'andi_vn_theme';
    const DEFAULT_THEME = 'prototype';

    // Detect which mode to use based on presence of theme-css link
    function getMode() {
        return document.getElementById('theme-css') ? 'css-link' : 'body-class';
    }

    /**
     * Get list of available themes from themeConfig
     */
    function getAvailableThemes() {
        if (typeof themeConfig !== 'undefined' && themeConfig.available) {
            return themeConfig.available;
        }
        return [DEFAULT_THEME];
    }

    /**
     * Get the default theme from themeConfig
     */
    function getDefaultTheme() {
        if (typeof themeConfig !== 'undefined' && themeConfig.selected) {
            return themeConfig.selected;
        }
        return DEFAULT_THEME;
    }

    /**
     * Get current theme from localStorage or fall back to default
     */
    function getCurrentTheme() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            const available = getAvailableThemes();
            if (saved && available.includes(saved)) {
                return saved;
            }
        } catch (e) {
            // localStorage may be unavailable
        }
        return getDefaultTheme();
    }

    /**
     * Apply theme using the appropriate mode
     * CSS Link mode: changes href on <link id="theme-css">
     * Body Class mode: adds theme-* class to <body>
     */
    function applyTheme(themeName) {
        const mode = getMode();

        if (mode === 'css-link') {
            // Game mode: change CSS file
            const link = document.getElementById('theme-css');
            if (link) {
                link.href = 'css/themes/' + themeName + '.css';
            }
        } else {
            // Editor mode: change body class
            const body = document.body;

            // Remove all existing theme classes
            const themeClasses = Array.from(body.classList).filter(c => c.startsWith('theme-'));
            themeClasses.forEach(c => body.classList.remove(c));

            // Add new theme class
            if (themeName) {
                body.classList.add('theme-' + themeName);
            }
        }
    }

    /**
     * Set theme - applies it and saves to localStorage
     */
    function setTheme(themeName) {
        const available = getAvailableThemes();
        if (!available.includes(themeName)) {
            console.warn('Theme not available:', themeName);
            return false;
        }

        applyTheme(themeName);

        try {
            localStorage.setItem(STORAGE_KEY, themeName);
        } catch (e) {
            console.warn('Could not save theme to localStorage:', e);
        }

        return true;
    }

    /**
     * Initialize theme on page load
     * Call this early (before DOMContentLoaded if possible)
     */
    function initTheme() {
        const theme = getCurrentTheme();
        applyTheme(theme);
        return theme;
    }

    /**
     * Populate a select element with theme options
     * @param {HTMLSelectElement} selectElement - The select to populate
     * @param {Function} [onChange] - Optional callback when theme changes
     */
    function initThemeSelector(selectElement, onChange) {
        if (!selectElement) return;

        const themes = getAvailableThemes();
        const currentTheme = getCurrentTheme();

        // Clear existing options
        selectElement.innerHTML = '';

        // Add options for each theme
        themes.forEach(theme => {
            const option = document.createElement('option');
            option.value = theme;
            // Capitalize first letter for display
            option.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
            selectElement.appendChild(option);
        });

        // Set current value
        selectElement.value = currentTheme;

        // Handle changes
        selectElement.addEventListener('change', function() {
            const newTheme = this.value;
            setTheme(newTheme);
            if (typeof onChange === 'function') {
                onChange(newTheme);
            }
        });
    }

    // Public API
    return {
        STORAGE_KEY: STORAGE_KEY,
        getAvailableThemes: getAvailableThemes,
        getDefaultTheme: getDefaultTheme,
        getCurrentTheme: getCurrentTheme,
        applyTheme: applyTheme,
        setTheme: setTheme,
        initTheme: initTheme,
        initThemeSelector: initThemeSelector
    };
})();

// Export for CommonJS/Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeUtils;
}
