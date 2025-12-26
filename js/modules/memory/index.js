/**
 * Memory Module
 *
 * Plays memory recap scenes for items/skills obtained during a run
 * before respawning after defeat.
 *
 * Provides the 'memory_chain' action handler.
 */
(function() {
    'use strict';

    var _engine = null;
    var _log = typeof Logger !== 'undefined' ? Logger : console;

    // Memory scene queue
    var memoryQueue = [];
    var fallbackScene = 'wake_up';

    // Mapping from item/skill names to memory scene IDs
    var MEMORY_SCENES = {
        // Key items
        'Flora Book': 'memory_flora_book',
        'Magnifying Glass': 'memory_magnifying_glass',
        'Lighter': 'memory_lighter',
        'Charcoal': 'memory_charcoal',
        'Beer': 'memory_beer',
        'Coffee Mug': 'memory_coffee_mug',
        // Skills
        'Smile': 'memory_smile',
        'Rooftop Discovery': 'memory_rooftop_discovery',
        'Floristic Knowledge': 'memory_floristic_knowledge'
    };

    /**
     * Build the memory scene queue from newThisRun items/skills
     * @returns {string[]} Array of scene IDs
     */
    function buildMemoryQueue() {
        if (typeof inventoryManager === 'undefined' || !inventoryManager.getNewThisRun) {
            return [];
        }

        var newItems = inventoryManager.getNewThisRun();
        var queue = [];

        // Add key item memory scenes
        for (var i = 0; i < newItems.keyItems.length; i++) {
            var item = newItems.keyItems[i];
            var sceneId = MEMORY_SCENES[item];
            if (sceneId) {
                queue.push(sceneId);
            } else {
                _log.warn('MemoryModule', 'No memory scene for item:', item);
            }
        }

        // Add skill memory scenes
        for (var j = 0; j < newItems.skills.length; j++) {
            var skill = newItems.skills[j];
            var skillSceneId = MEMORY_SCENES[skill];
            if (skillSceneId) {
                queue.push(skillSceneId);
            } else {
                _log.warn('MemoryModule', 'No memory scene for skill:', skill);
            }
        }

        return queue;
    }

    /**
     * Advance to next memory scene or fallback
     */
    function advanceMemoryChain() {
        if (memoryQueue.length > 0) {
            var nextScene = memoryQueue.shift();
            _log.debug('MemoryModule', 'Loading next memory scene:', nextScene);
            _engine.loadScene(nextScene);
        } else {
            _log.debug('MemoryModule', 'Memory chain complete, loading fallback:', fallbackScene);
            _engine.loadScene(fallbackScene);
        }
    }

    /**
     * Check if current scene is a memory scene and handle auto-advance
     * Called when a scene completes (no more text blocks, no choices)
     */
    function onSceneComplete(sceneId) {
        // Only auto-advance if we're in a memory chain
        if (memoryQueue.length === 0 && !isMemoryScene(sceneId)) {
            return false;
        }

        // Check if this is a memory scene
        if (isMemoryScene(sceneId)) {
            advanceMemoryChain();
            return true;
        }

        return false;
    }

    /**
     * Check if a scene ID is a memory scene
     */
    function isMemoryScene(sceneId) {
        return sceneId && sceneId.indexOf('memory_') === 0;
    }

    var module = {
        name: 'memory',
        dependencies: [],

        /**
         * Initialize the memory module
         * @param {Object} engine - Engine API
         */
        init: function(engine) {
            _engine = engine;
            memoryQueue = [];
            _log.info('MemoryModule', 'Initialized');
        },

        /**
         * Clean up the memory module
         */
        destroy: function() {
            _engine = null;
            memoryQueue = [];
            _log.info('MemoryModule', 'Destroyed');
        },

        /**
         * Action handlers provided by this module
         */
        actions: {
            /**
             * Start a memory chain
             * Plays one scene per item/skill obtained this run, then goes to fallback
             *
             * @param {Object} action
             * @param {string} [action.fallback='wake_up'] - Scene to load after all memories
             */
            memory_chain: function(action) {
                if (!_engine) {
                    _log.error('MemoryModule', 'Module not initialized');
                    return;
                }

                fallbackScene = action.fallback || 'wake_up';
                memoryQueue = buildMemoryQueue();

                _log.info('MemoryModule', 'Starting memory chain with', memoryQueue.length, 'scenes');

                if (memoryQueue.length === 0) {
                    // No new items this run, go directly to fallback
                    _engine.loadScene(fallbackScene);
                } else {
                    // Start the chain
                    advanceMemoryChain();
                }
            }
        },

        /**
         * Called when a scene completes (exposed for engine integration)
         * @param {string} sceneId
         * @returns {boolean} True if memory module handled the completion
         */
        onSceneComplete: onSceneComplete,

        /**
         * Check if currently in a memory chain
         * @returns {boolean}
         */
        isInMemoryChain: function() {
            return memoryQueue.length > 0;
        },

        /**
         * Get remaining memory scenes
         * @returns {string[]}
         */
        getRemainingScenes: function() {
            return memoryQueue.slice();
        }
    };

    // Register with ModuleRegistry
    if (typeof ModuleRegistry !== 'undefined') {
        ModuleRegistry.register(module);
    }

    // Expose globally
    window.MemoryModule = module;
})();
