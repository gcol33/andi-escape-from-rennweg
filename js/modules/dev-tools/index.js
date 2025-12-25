/**
 * Dev Tools Module
 *
 * Developer panel for testing and debugging.
 * Activated by holding q+w+e+r+t simultaneously.
 *
 * No action handlers - purely a dev utility.
 */
(function() {
    'use strict';

    var _engine = null;
    var _log = typeof Logger !== 'undefined' ? Logger : console;

    var module = {
        name: 'dev-tools',
        dependencies: [],

        /**
         * Initialize the dev tools module
         * @param {Object} engine - Engine API
         */
        init: function(engine) {
            _engine = engine;

            // DevPanel is initialized by engine.js directly
            // This module just registers it for proper lifecycle tracking

            _log.info('DevToolsModule', 'Initialized');
        },

        /**
         * Clean up the dev tools module
         */
        destroy: function() {
            _engine = null;
            _log.info('DevToolsModule', 'Destroyed');
        }

        // No action handlers - dev panel is activated via keyboard chord
    };

    // Register with ModuleRegistry
    if (typeof ModuleRegistry !== 'undefined') {
        ModuleRegistry.register(module);
    }

    // Expose globally for backwards compatibility
    window.DevToolsModule = module;
})();
