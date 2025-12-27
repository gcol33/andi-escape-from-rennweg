/**
 * Memory Module
 *
 * Plays memory recap overlays for items/skills obtained during a run
 * before respawning after defeat.
 *
 * Displays a black overlay with "Obtained... [Item]" and memory text.
 * Provides the 'memory_chain' action handler.
 */
(function() {
    'use strict';

    var _engine = null;
    var _log = typeof Logger !== 'undefined' ? Logger : console;

    // Memory queue and state
    var memoryQueue = [];
    var fallbackScene = 'wake_up';
    var overlayElement = null;
    var typewriterInterval = null;
    var clickHandler = null;

    // Memory data: item/skill name -> { text: string[] }
    // Text arrays are shown sequentially with typewriter effect
    var MEMORY_DATA = {
        // Key items
        'Flora Book': {
            text: [
                "Moritz's flora book. Annotations in at least three languages. Pressed specimens tucked between pages.",
                "You remember now. This is yours to keep."
            ]
        },
        'Magnifying Glass': {
            text: [
                "Cool metal in your palm. The lens catches light, revealing details invisible to the naked eye.",
                "You remember now. This is yours to keep."
            ]
        },
        'Lighter': {
            text: [
                "The smokers' corner crew. 'CATS Forever' scratched into the casing. The flame dances.",
                "You remember now. This is yours to keep."
            ]
        },
        'Charcoal': {
            text: [
                "Premium Billa charcoal. The rooftop awaits. Anticipation of smoke and laughter.",
                "You remember now. This is yours to keep."
            ]
        },
        'Beer': {
            text: [
                "Victory tastes like Ottakringer. The dice finally rolled your way.",
                "You remember now. This is yours to keep."
            ]
        },
        'Coffee Mug': {
            text: [
                "Warmth in ceramic. The kitchen chaos fading behind you. A moment of peace.",
                "You remember now. This is yours to keep."
            ]
        },
        // Skills
        'Smile': {
            text: [
                "Adrian's lesson. When you smile, people smile back. A positive feedback loop.",
                "You remember how."
            ]
        },
        'Floristic Knowledge': {
            text: [
                "Dactylis glomerata. Arrhenatherum elatius. Siegrun's voice, patient, naming the meadow blade by blade.",
                "You remember the names."
            ]
        },
        'Rooftop Discovery': {
            text: [
                "Squirrels in the linden tree. Jen pointing upward. Voices drifting down from the roof.",
                "You remember the way."
            ]
        }
    };

    /**
     * Build the memory queue from newThisRun items/skills
     * @returns {Array} Array of {name, text[]} objects
     */
    function buildMemoryQueue() {
        if (typeof inventoryManager === 'undefined' || !inventoryManager.getNewThisRun) {
            return [];
        }

        var newItems = inventoryManager.getNewThisRun();
        var queue = [];

        // Add key item memories
        for (var i = 0; i < newItems.keyItems.length; i++) {
            var item = newItems.keyItems[i];
            var data = MEMORY_DATA[item];
            if (data) {
                queue.push({ name: item, text: data.text });
            } else {
                _log.warn('MemoryModule', 'No memory data for item:', item);
            }
        }

        // Add skill memories
        for (var j = 0; j < newItems.skills.length; j++) {
            var skill = newItems.skills[j];
            var skillData = MEMORY_DATA[skill];
            if (skillData) {
                queue.push({ name: skill, text: skillData.text });
            } else {
                _log.warn('MemoryModule', 'No memory data for skill:', skill);
            }
        }

        return queue;
    }

    /**
     * Create the overlay DOM element
     */
    function createOverlay() {
        if (overlayElement) return;

        var container = document.getElementById('vn-container') || document.body;

        overlayElement = document.createElement('div');
        overlayElement.className = 'memory-overlay';
        overlayElement.innerHTML =
            '<div class="memory-obtained">Obtained...</div>' +
            '<div class="memory-item-name"></div>' +
            '<div class="memory-text"></div>' +
            '<div class="memory-click-hint">Click to continue</div>';

        container.appendChild(overlayElement);
    }

    /**
     * Remove the overlay
     */
    function removeOverlay() {
        if (typewriterInterval) {
            clearInterval(typewriterInterval);
            typewriterInterval = null;
        }
        if (clickHandler && overlayElement) {
            overlayElement.removeEventListener('click', clickHandler);
            clickHandler = null;
        }
        if (overlayElement && overlayElement.parentNode) {
            overlayElement.parentNode.removeChild(overlayElement);
            overlayElement = null;
        }
    }

    /**
     * Show a memory with typewriter effect
     * @param {Object} memory - {name, text[]}
     * @param {Function} onComplete - Called when user clicks to continue
     */
    function showMemory(memory, onComplete) {
        createOverlay();

        var nameEl = overlayElement.querySelector('.memory-item-name');
        var textEl = overlayElement.querySelector('.memory-text');
        var hintEl = overlayElement.querySelector('.memory-click-hint');

        // Set item name
        nameEl.textContent = memory.name;

        // Prepare text with character spans for typewriter
        var fullText = memory.text.join('\n\n');
        var charSpans = '';
        for (var i = 0; i < fullText.length; i++) {
            var char = fullText[i];
            if (char === '\n') {
                charSpans += '<br>';
            } else if (char === ' ') {
                charSpans += '<span class="memory-char"> </span>';
            } else {
                charSpans += '<span class="memory-char">' + escapeHtml(char) + '</span>';
            }
        }
        textEl.innerHTML = charSpans;

        // Hide hint initially
        hintEl.classList.remove('visible');

        // Fade in overlay
        requestAnimationFrame(function() {
            overlayElement.classList.add('visible');
        });

        // Start typewriter after fade-in
        var chars = textEl.querySelectorAll('.memory-char');
        var charIndex = 0;
        var typewriterComplete = false;

        setTimeout(function() {
            typewriterInterval = setInterval(function() {
                if (charIndex < chars.length) {
                    chars[charIndex].classList.add('visible');
                    charIndex++;
                } else {
                    clearInterval(typewriterInterval);
                    typewriterInterval = null;
                    typewriterComplete = true;
                    hintEl.classList.add('visible');
                }
            }, 30);
        }, 600); // Wait for fade-in + name animation

        // Click handler
        clickHandler = function() {
            if (!typewriterComplete) {
                // Skip to end
                clearInterval(typewriterInterval);
                typewriterInterval = null;
                for (var j = charIndex; j < chars.length; j++) {
                    chars[j].classList.add('visible');
                }
                typewriterComplete = true;
                hintEl.classList.add('visible');
            } else {
                // Fade out and continue
                overlayElement.removeEventListener('click', clickHandler);
                overlayElement.classList.remove('visible');
                setTimeout(function() {
                    onComplete();
                }, 500);
            }
        };

        overlayElement.addEventListener('click', clickHandler);
    }

    /**
     * Escape HTML characters
     */
    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Advance to next memory or fallback
     */
    function advanceMemoryChain() {
        if (memoryQueue.length > 0) {
            var nextMemory = memoryQueue.shift();
            _log.debug('MemoryModule', 'Showing memory for:', nextMemory.name);
            showMemory(nextMemory, advanceMemoryChain);
        } else {
            _log.debug('MemoryModule', 'Memory chain complete, loading fallback:', fallbackScene);
            removeOverlay();
            _engine.loadScene(fallbackScene);
        }
    }

    /**
     * Check if current scene is a memory scene (legacy support)
     * Now memories are overlays, not scenes
     */
    function onSceneComplete(sceneId) {
        // Legacy: if somehow a memory scene is loaded, skip it
        if (sceneId && sceneId.indexOf('memory_') === 0 && sceneId !== 'memory_start') {
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
            removeOverlay();
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
             * Shows overlay for each item/skill obtained this run, then goes to fallback
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

                _log.info('MemoryModule', 'Starting memory chain with', memoryQueue.length, 'memories');

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
            return memoryQueue.length > 0 || overlayElement !== null;
        },

        /**
         * Get remaining memory count
         * @returns {number}
         */
        getRemainingCount: function() {
            return memoryQueue.length;
        }
    };

    // Register with ModuleRegistry
    if (typeof ModuleRegistry !== 'undefined') {
        ModuleRegistry.register(module);
    }

    // Expose globally
    window.MemoryModule = module;
})();
