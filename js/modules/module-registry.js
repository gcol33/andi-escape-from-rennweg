/**
 * Module Registry
 *
 * Manages optional VN engine modules (battle, QTE, quiz, etc.).
 * Modules register themselves and are initialized when the engine starts.
 *
 * Usage:
 *   ModuleRegistry.register({ name: 'battle', init: fn, actions: {...} });
 *   ModuleRegistry.initAll(engineAPI);
 *   ModuleRegistry.getActionHandler('start_battle');
 */
var ModuleRegistry = (function() {
    'use strict';

    var modules = {};
    var initialized = {};
    var _engineAPI = null;
    var _log = typeof Logger !== 'undefined' ? Logger : console;

    /**
     * @typedef {Object} VNModule
     * @property {string} name - Unique module identifier
     * @property {string[]} [dependencies] - Other modules this requires
     * @property {Function} init - Called when module is activated, receives engineAPI
     * @property {Function} [destroy] - Called when module is deactivated
     * @property {Object} [actions] - Action handlers to register with engine
     */

    return {
        /**
         * Register a module
         * @param {VNModule} module
         * @returns {boolean}
         */
        register: function(module) {
            if (!module || !module.name) {
                _log.error('ModuleRegistry', 'Module must have a name');
                return false;
            }

            if (modules[module.name]) {
                _log.warn('ModuleRegistry', 'Module already registered:', module.name);
                return false;
            }

            modules[module.name] = module;
            _log.debug('ModuleRegistry', 'Registered:', module.name);
            return true;
        },

        /**
         * Initialize all registered modules in dependency order
         * @param {Object} engineAPI - Engine API object
         */
        initAll: function(engineAPI) {
            _engineAPI = engineAPI;

            var sorted = this._topologicalSort();

            for (var i = 0; i < sorted.length; i++) {
                this.init(sorted[i]);
            }
        },

        /**
         * Initialize a specific module
         * @param {string} name
         * @returns {boolean}
         */
        init: function(name) {
            var module = modules[name];
            if (!module) {
                _log.warn('ModuleRegistry', 'Module not found:', name);
                return false;
            }

            if (initialized[name]) {
                return true;
            }

            // Initialize dependencies first
            if (module.dependencies) {
                for (var i = 0; i < module.dependencies.length; i++) {
                    var dep = module.dependencies[i];
                    if (modules[dep] && !initialized[dep]) {
                        this.init(dep);
                    }
                }
            }

            try {
                if (typeof module.init === 'function') {
                    module.init(_engineAPI);
                }
                initialized[name] = true;
                _log.info('ModuleRegistry', 'Initialized:', name);

                if (typeof eventBus !== 'undefined') {
                    eventBus.emit('module:initialized', { name: name });
                }

                return true;
            } catch (err) {
                _log.error('ModuleRegistry', 'Failed to init ' + name + ':', err);
                return false;
            }
        },

        /**
         * Destroy all modules (reverse order)
         */
        destroyAll: function() {
            var names = Object.keys(initialized).reverse();
            for (var i = 0; i < names.length; i++) {
                this.destroy(names[i]);
            }
        },

        /**
         * Destroy a specific module
         * @param {string} name
         */
        destroy: function(name) {
            var module = modules[name];
            if (!module || !initialized[name]) return;

            try {
                if (typeof module.destroy === 'function') {
                    module.destroy();
                }
                delete initialized[name];
                _log.info('ModuleRegistry', 'Destroyed:', name);
            } catch (err) {
                _log.error('ModuleRegistry', 'Failed to destroy ' + name + ':', err);
            }
        },

        /**
         * Check if a module is registered
         * @param {string} name
         * @returns {boolean}
         */
        has: function(name) {
            return !!modules[name];
        },

        /**
         * Check if a module is initialized
         * @param {string} name
         * @returns {boolean}
         */
        isInitialized: function(name) {
            return !!initialized[name];
        },

        /**
         * Get a registered module
         * @param {string} name
         * @returns {VNModule|null}
         */
        get: function(name) {
            return modules[name] || null;
        },

        /**
         * Get action handler from any initialized module
         * @param {string} actionType
         * @returns {Function|null}
         */
        getActionHandler: function(actionType) {
            for (var name in modules) {
                if (initialized[name] &&
                    modules[name].actions &&
                    modules[name].actions[actionType]) {
                    return modules[name].actions[actionType].bind(modules[name]);
                }
            }
            return null;
        },

        /**
         * Get all registered module names
         * @returns {string[]}
         */
        list: function() {
            return Object.keys(modules);
        },

        /**
         * Get all initialized module names
         * @returns {string[]}
         */
        listInitialized: function() {
            return Object.keys(initialized);
        },

        /**
         * Topological sort for dependency resolution
         * @private
         * @returns {string[]}
         */
        _topologicalSort: function() {
            var sorted = [];
            var visited = {};
            var names = Object.keys(modules);

            function visit(name) {
                if (visited[name]) return;
                visited[name] = true;

                var module = modules[name];
                if (module.dependencies) {
                    for (var i = 0; i < module.dependencies.length; i++) {
                        var dep = module.dependencies[i];
                        if (modules[dep]) {
                            visit(dep);
                        }
                    }
                }
                sorted.push(name);
            }

            for (var i = 0; i < names.length; i++) {
                visit(names[i]);
            }

            return sorted;
        }
    };
})();

window.ModuleRegistry = ModuleRegistry;
