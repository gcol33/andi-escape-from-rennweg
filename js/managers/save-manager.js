/**
 * Andi VN - Save Manager
 * @module managers/save-manager
 *
 * Handles game state persistence: save, load, and export.
 * Supports multiple save slots and auto-save.
 *
 * Usage:
 *   saveManager.save();        // Save to default slot
 *   saveManager.save(2);       // Save to slot 2
 *   saveManager.load();        // Load from default slot
 *   saveManager.export();      // Export as downloadable file
 */

(function() {
'use strict';

var SAVE_KEY_PREFIX = 'andi_vn_save';
var SETTINGS_KEY = 'andi_vn_settings';
var READ_BLOCKS_KEY = 'andi_vn_read_blocks';

/**
 * SaveManager constructor
 */
function SaveManagerClass() {
    BaseManager.call(this);
    this.name = 'SaveManager';

    // Private state via closure
    var autoSaveEnabled = true;
    var autoSaveInterval = 30000; // 30 seconds
    var autoSaveTimer = null;
    var self = this;

    /**
     * Get storage key for a slot
     * @param {number} slot
     * @returns {string}
     */
    function getSlotKey(slot) {
        return slot === 0 ? SAVE_KEY_PREFIX : SAVE_KEY_PREFIX + '_' + slot;
    }

    /**
     * Initialize the manager
     */
    this.init = function() {
        BaseManager.prototype.init.call(this);

        // Load settings
        this.loadSettings();

        // Load read blocks
        this.loadReadBlocks();

        // Start auto-save if enabled
        if (autoSaveEnabled) {
            this.startAutoSave();
        }

        this.debug('Initialized');
    };

    /**
     * Save game state to a slot
     * @param {number} [slot=0] - Save slot number
     */
    this.save = function(slot) {
        slot = slot || 0;
        var key = getSlotKey(slot);

        try {
            this.emit(StateEvents.SAVING, { slot: slot });

            var data = store.serialize();
            localStorage.setItem(key, data);

            // Also save settings separately (they persist across saves)
            this.saveSettings();

            // Save read blocks
            this.saveReadBlocks();

            this.emit(StateEvents.SAVED, { slot: slot });
            this.debug('Saved to slot:', slot);
        } catch (err) {
            this.error('Failed to save:', err);
        }
    };

    /**
     * Load game state from a slot
     * @param {number} [slot=0] - Save slot number
     * @returns {boolean} Whether load succeeded
     */
    this.load = function(slot) {
        slot = slot || 0;
        var key = getSlotKey(slot);

        try {
            var data = localStorage.getItem(key);
            if (!data) {
                this.debug('No save in slot:', slot);
                return false;
            }

            store.deserialize(data);
            this.debug('Loaded from slot:', slot);
            return true;
        } catch (err) {
            this.error('Failed to load:', err);
            return false;
        }
    };

    /**
     * Delete a save slot
     * @param {number} [slot=0] - Save slot number
     */
    this.delete = function(slot) {
        slot = slot || 0;
        var key = getSlotKey(slot);

        try {
            localStorage.removeItem(key);
            this.debug('Deleted slot:', slot);
        } catch (err) {
            this.error('Failed to delete:', err);
        }
    };

    /**
     * Check if a slot has a save
     * @param {number} [slot=0] - Save slot number
     * @returns {boolean}
     */
    this.hasSave = function(slot) {
        slot = slot || 0;
        var key = getSlotKey(slot);
        return localStorage.getItem(key) !== null;
    };

    /**
     * Get info about a save slot
     * @param {number} [slot=0] - Save slot number
     * @returns {Object|null}
     */
    this.getSaveInfo = function(slot) {
        slot = slot || 0;
        var key = getSlotKey(slot);

        try {
            var data = localStorage.getItem(key);
            if (!data) return null;

            var parsed = JSON.parse(data);
            return {
                slot: slot,
                sceneId: parsed.scene ? parsed.scene.currentId : null,
                timestamp: parsed.timestamp || null,
                exists: true
            };
        } catch (err) {
            return null;
        }
    };

    /**
     * Export save as downloadable file
     * @param {number} [slot=0] - Save slot to export
     */
    this.export = function(slot) {
        slot = slot || 0;
        var key = getSlotKey(slot);

        try {
            var data = localStorage.getItem(key) || store.serialize();
            var blob = new Blob([data], { type: 'application/json' });
            var url = URL.createObjectURL(blob);

            var a = document.createElement('a');
            a.href = url;
            a.download = 'andi_vn_save_' + slot + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.debug('Exported slot:', slot);
        } catch (err) {
            this.error('Failed to export:', err);
        }
    };

    /**
     * Import save from file
     * @param {File} file - Save file to import
     * @param {number} [slot=0] - Slot to import into
     * @returns {Promise<boolean>}
     */
    this.import = function(file, slot) {
        slot = slot || 0;
        var self = this;

        return new Promise(function(resolve) {
            var reader = new FileReader();
            reader.onload = function(e) {
                try {
                    var text = e.target.result;
                    // Validate JSON
                    JSON.parse(text);

                    var key = getSlotKey(slot);
                    localStorage.setItem(key, text);

                    self.debug('Imported to slot:', slot);
                    resolve(true);
                } catch (err) {
                    self.error('Failed to import:', err);
                    resolve(false);
                }
            };
            reader.onerror = function() {
                self.error('Failed to read file');
                resolve(false);
            };
            reader.readAsText(file);
        });
    };

    /**
     * Save settings to localStorage
     */
    this.saveSettings = function() {
        try {
            var settings = this.getState('settings');
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (err) {
            this.error('Failed to save settings:', err);
        }
    };

    /**
     * Load settings from localStorage
     */
    this.loadSettings = function() {
        try {
            var data = localStorage.getItem(SETTINGS_KEY);
            if (data) {
                var settings = JSON.parse(data);
                this.setState('settings', function(current) {
                    var merged = {};
                    for (var key in current) {
                        if (current.hasOwnProperty(key)) {
                            merged[key] = current[key];
                        }
                    }
                    for (var key in settings) {
                        if (settings.hasOwnProperty(key)) {
                            merged[key] = settings[key];
                        }
                    }
                    return merged;
                });
                this.debug('Loaded settings');
            }
        } catch (err) {
            this.error('Failed to load settings:', err);
        }
    };

    /**
     * Save read blocks to localStorage
     */
    this.saveReadBlocks = function() {
        try {
            var readBlocks = this.getState('meta.readBlocks');
            if (readBlocks) {
                localStorage.setItem(READ_BLOCKS_KEY, JSON.stringify(Array.from(readBlocks)));
            }
        } catch (err) {
            this.error('Failed to save read blocks:', err);
        }
    };

    /**
     * Load read blocks from localStorage
     */
    this.loadReadBlocks = function() {
        try {
            var data = localStorage.getItem(READ_BLOCKS_KEY);
            if (data) {
                var blocks = JSON.parse(data);
                this.setState('meta.readBlocks', function() { return new Set(blocks); });
                this.debug('Loaded read blocks:', blocks.length);
            }
        } catch (err) {
            this.error('Failed to load read blocks:', err);
        }
    };

    /**
     * Start auto-save timer
     */
    this.startAutoSave = function() {
        if (autoSaveTimer) return;

        autoSaveTimer = setInterval(function() {
            self.save(0);
            self.debug('Auto-saved');
        }, autoSaveInterval);

        this.debug('Auto-save started');
    };

    /**
     * Stop auto-save timer
     */
    this.stopAutoSave = function() {
        if (autoSaveTimer) {
            clearInterval(autoSaveTimer);
            autoSaveTimer = null;
            this.debug('Auto-save stopped');
        }
    };

    /**
     * Reset progress (clear all saves and state)
     * @param {boolean} [keepSettings=true] - Preserve settings
     */
    this.resetProgress = function(keepSettings) {
        keepSettings = keepSettings !== false;

        // Clear all save slots
        for (var i = 0; i < 10; i++) {
            this.delete(i);
        }

        // Clear read blocks
        localStorage.removeItem(READ_BLOCKS_KEY);

        // Reset store state
        store.reset(keepSettings, false);

        this.debug('Progress reset');
    };

    /**
     * Destroy the manager
     */
    this.destroy = function() {
        this.stopAutoSave();
        BaseManager.prototype.destroy.call(this);
    };
}

// Inherit from BaseManager
SaveManagerClass.prototype = Object.create(BaseManager.prototype);
SaveManagerClass.prototype.constructor = SaveManagerClass;

// Singleton instance
var saveManager = new SaveManagerClass();

// Global export
window.saveManager = saveManager;

})();
