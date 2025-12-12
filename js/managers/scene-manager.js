/**
 * Andi VN - Scene Manager
 * @module managers/scene-manager
 *
 * Manages scene navigation, text block progression, and choice filtering.
 * Acts as a bridge between the new store architecture and the existing engine.js.
 *
 * During migration, this manager:
 * - Reads from the store when possible
 * - Delegates rendering to VNEngine
 * - Emits events for other modules to react to
 *
 * Usage:
 *   sceneManager.init(story);
 *   sceneManager.goToScene('scene_id');
 *   sceneManager.advanceBlock();
 *   var choices = sceneManager.getAvailableChoices();
 */

(function() {
'use strict';

/**
 * SceneManager constructor
 */
function SceneManagerClass() {
    BaseManager.call(this);
    this.name = 'SceneManager';

    // Private state via closure
    var story = null;
    var self = this;

    /**
     * Initialize the manager with story data
     * @param {Object} storyData - The story object from story.js
     */
    this.init = function(storyData) {
        BaseManager.prototype.init.call(this);

        if (!storyData) {
            this.error('No story data provided!');
            return;
        }

        story = storyData;

        // Subscribe to input events
        this.on(InputEvents.ADVANCE, function() { self.advanceBlock(); });
        this.on(InputEvents.CHOICE, function(data) { self.selectChoice(data.index); });

        this.debug('Initialized with', Object.keys(story).length, 'scenes');
    };

    /**
     * Navigate to a scene
     * @param {string} sceneId - Scene ID to navigate to
     * @param {Object} [options] - Navigation options
     * @param {string} [options.prependContent] - HTML to prepend to first block
     * @param {string} [options.entrySfx] - SFX to play on entry
     */
    this.goToScene = function(sceneId, options) {
        options = options || {};

        var scene = story[sceneId];
        if (!scene) {
            this.error('Scene not found:', sceneId);
            this.emit(SceneEvents.SCENE_ERROR, {
                error: new SceneNotFoundError(sceneId),
                sceneId: sceneId
            });
            return false;
        }

        var previousId = this.getState('scene.currentId');

        // Update store state
        this.setState('scene', function(current) {
            return {
                currentId: sceneId,
                blockIndex: 0,
                history: current.history.concat([previousId]).filter(Boolean).slice(-50)
            };
        });

        // Process scene entry effects (flags, items)
        this._processSceneEffects(scene);

        // Emit scene enter event
        this.emit(SceneEvents.SCENE_ENTER, {
            scene: scene,
            sceneId: sceneId,
            previousId: previousId,
            prependContent: options.prependContent,
            entrySfx: options.entrySfx
        });

        // Handle music changes
        if (scene.music) {
            this.emit(AudioEvents.MUSIC_PLAY, { file: scene.music });
        }

        this.debug('Navigated to scene:', sceneId);
        return true;
    };

    /**
     * Advance to the next text block
     * @returns {boolean} True if advanced, false if at end
     */
    this.advanceBlock = function() {
        var scene = this.getCurrentScene();
        if (!scene) return false;

        var blockIndex = this.getState('scene.blockIndex');
        var totalBlocks = scene.textBlocks ? scene.textBlocks.length : 0;

        if (blockIndex < totalBlocks - 1) {
            // More blocks to show
            this.setState('scene.blockIndex', function(i) { return i + 1; });

            this.emit(SceneEvents.BLOCK_ADVANCE, {
                index: blockIndex + 1,
                total: totalBlocks,
                text: scene.textBlocks[blockIndex + 1]
            });

            this.debug('Advanced to block', blockIndex + 1, 'of', totalBlocks);
            return true;
        }

        // At the last block - emit complete event
        this.emit(SceneEvents.BLOCK_COMPLETE, {
            scene: scene,
            hasChoices: scene.choices && scene.choices.length > 0,
            hasActions: scene.actions && scene.actions.length > 0
        });

        this.debug('Reached end of text blocks');
        return false;
    };

    /**
     * Select a choice by index
     * @param {number} index - Choice index
     */
    this.selectChoice = function(index) {
        var choices = this.getAvailableChoices();
        if (index < 0 || index >= choices.length) {
            this.warn('Invalid choice index:', index);
            return;
        }

        var choice = choices[index];

        // Emit choice selected event
        this.emit(SceneEvents.CHOICE_SELECTED, {
            index: index,
            choice: choice
        });

        // Process choice effects
        this._processChoiceEffects(choice);

        // Navigate to target scene
        if (choice.target) {
            this.goToScene(choice.target, {
                entrySfx: choice.sfx
            });
        }
    };

    /**
     * Get the current scene object
     * @returns {Object|null}
     */
    this.getCurrentScene = function() {
        var id = this.getState('scene.currentId');
        return id ? story[id] : null;
    };

    /**
     * Get the current text block
     * @returns {string|null}
     */
    this.getCurrentBlock = function() {
        var scene = this.getCurrentScene();
        if (!scene || !scene.textBlocks) return null;

        var index = this.getState('scene.blockIndex');
        return scene.textBlocks[index] || null;
    };

    /**
     * Get filtered choices based on requirements
     * @returns {Array}
     */
    this.getAvailableChoices = function() {
        var scene = this.getCurrentScene();
        if (!scene || !scene.choices) return [];

        var flags = this.getState('player.flags') || new Set();
        var inventory = this.getState('player.inventory') || { keyItems: [], consumables: {} };
        var self = this;

        return scene.choices.filter(function(choice) {
            // Check flag requirements
            if (choice.require_flags && choice.require_flags.length > 0) {
                var hasAllFlags = choice.require_flags.every(function(flag) {
                    // Support negation: !flag_name
                    if (flag.charAt(0) === '!') {
                        return !flags.has(flag.substring(1));
                    }
                    return flags.has(flag);
                });
                if (!hasAllFlags) return false;
            }

            // Check item requirements
            if (choice.require_items) {
                var items = Array.isArray(choice.require_items) ? choice.require_items : [choice.require_items];
                var hasAllItems = items.every(function(item) {
                    return inventory.keyItems.indexOf(item) !== -1 ||
                           (inventory.consumables[item] && inventory.consumables[item] > 0);
                });
                if (!hasAllItems) return false;
            }

            // Check skill requirements
            if (choice.require_skills && choice.require_skills.length > 0) {
                // Skills are stored separately - delegate to inventory manager or VNEngine
                // For now, emit event and let VNEngine handle
                // TODO: Add skills to store
            }

            return true;
        });
    };

    /**
     * Check if current scene is an ending (no choices, no actions)
     * @returns {boolean}
     */
    this.isEnding = function() {
        var scene = this.getCurrentScene();
        if (!scene) return false;

        var hasChoices = scene.choices && scene.choices.length > 0;
        var hasActions = scene.actions && scene.actions.length > 0;

        return !hasChoices && !hasActions;
    };

    /**
     * Go back to previous scene (undo)
     * @returns {boolean} True if successfully went back
     */
    this.goBack = function() {
        var history = this.getState('scene.history') || [];
        if (history.length === 0) {
            this.debug('No history to go back to');
            return false;
        }

        var previousId = history[history.length - 1];

        // Update history (remove last entry)
        this.setState('scene.history', function(h) {
            return h.slice(0, -1);
        });

        // Navigate without adding to history
        var scene = story[previousId];
        if (!scene) return false;

        this.setState('scene.currentId', previousId);
        this.setState('scene.blockIndex', 0);

        this.emit(SceneEvents.SCENE_ENTER, {
            scene: scene,
            sceneId: previousId,
            isUndo: true
        });

        this.debug('Went back to:', previousId);
        return true;
    };

    /**
     * Process scene entry effects (flags, items)
     * @param {Object} scene
     * @private
     */
    this._processSceneEffects = function(scene) {
        // Set flags
        if (scene.set_flags && scene.set_flags.length > 0) {
            this.setState('player.flags', function(flags) {
                var newFlags = new Set(flags);
                scene.set_flags.forEach(function(f) { newFlags.add(f); });
                return newFlags;
            });

            this.emit(StateEvents.FLAGS_CHANGED, { added: scene.set_flags });
        }

        // Add items
        if (scene.add_items && scene.add_items.length > 0) {
            this.emit(InventoryEvents.ITEMS_ADD, { items: scene.add_items });
        }

        // Remove items
        if (scene.remove_items && scene.remove_items.length > 0) {
            this.emit(InventoryEvents.ITEMS_REMOVE, { items: scene.remove_items });
        }
    };

    /**
     * Process choice effects (flags, items, healing)
     * @param {Object} choice
     * @private
     */
    this._processChoiceEffects = function(choice) {
        // Set flags from choice
        if (choice.set_flags && choice.set_flags.length > 0) {
            this.setState('player.flags', function(flags) {
                var newFlags = new Set(flags);
                choice.set_flags.forEach(function(f) { newFlags.add(f); });
                return newFlags;
            });

            this.emit(StateEvents.FLAGS_CHANGED, { added: choice.set_flags });
        }

        // Use items
        if (choice.uses) {
            this.emit(InventoryEvents.ITEM_USE, { item: choice.uses });
        }

        // Heal
        if (choice.heals) {
            this.emit(BattleEvents.PLAYER_HEAL, { amount: choice.heals });
        }

        // Play SFX
        if (choice.sfx) {
            this.emit(AudioEvents.SFX_PLAY, { file: choice.sfx });
        }
    };

    /**
     * Get scene by ID
     * @param {string} sceneId
     * @returns {Object|null}
     */
    this.getScene = function(sceneId) {
        return story[sceneId] || null;
    };

    /**
     * Get all scene IDs
     * @returns {string[]}
     */
    this.getAllSceneIds = function() {
        return Object.keys(story || {});
    };

    /**
     * Check if a scene exists
     * @param {string} sceneId
     * @returns {boolean}
     */
    this.hasScene = function(sceneId) {
        return story && story[sceneId] !== undefined;
    };

    /**
     * Destroy the manager
     */
    this.destroy = function() {
        story = null;
        BaseManager.prototype.destroy.call(this);
    };
}

// Inherit from BaseManager
SceneManagerClass.prototype = Object.create(BaseManager.prototype);
SceneManagerClass.prototype.constructor = SceneManagerClass;

// Singleton instance
var sceneManager = new SceneManagerClass();

// Global export
window.sceneManager = sceneManager;

})();
