/**
 * Andi VN - Inventory Manager
 * @module managers/inventory-manager
 *
 * Manages player inventory: key items, consumables, and skills.
 * Handles adding, removing, and checking items.
 *
 * Usage:
 *   inventoryManager.addKeyItem('Master Key');
 *   inventoryManager.addConsumable('Coffee', 3);
 *   inventoryManager.addSkill('Fireball');
 *   if (inventoryManager.hasItem('Master Key')) { ... }
 */

(function() {
'use strict';

/**
 * InventoryManager constructor
 */
function InventoryManagerClass() {
    BaseManager.call(this);
    this.name = 'InventoryManager';
}

// Inherit from BaseManager
InventoryManagerClass.prototype = Object.create(BaseManager.prototype);
InventoryManagerClass.prototype.constructor = InventoryManagerClass;

// =========================================================================
// KEY ITEMS
// =========================================================================

/**
 * Add a key item
 * @param {string} item - Item name
 */
InventoryManagerClass.prototype.addKeyItem = function(item) {
    if (!item) return;

    var isNew = !this.hasKeyItem(item);

    this.setState('player.inventory.keyItems', function(items) {
        if (items.indexOf(item) !== -1) return items;
        return items.concat([item]);
    });

    // Track as new this run if it was actually added
    if (isNew) {
        this.setState('player.newThisRun.keyItems', function(items) {
            items = items || [];
            if (items.indexOf(item) !== -1) return items;
            return items.concat([item]);
        });
    }

    this.emit(InventoryEvents.ITEM_ADDED, { item: item, type: 'key' });
    this.debug('Added key item:', item);
};

/**
 * Remove a key item
 * @param {string} item - Item name
 * @returns {boolean} Whether item was removed
 */
InventoryManagerClass.prototype.removeKeyItem = function(item) {
    var items = this.getState('player.inventory.keyItems') || [];
    var index = items.indexOf(item);

    if (index === -1) return false;

    this.setState('player.inventory.keyItems', function(items) {
        var newItems = items.slice();
        newItems.splice(index, 1);
        return newItems;
    });

    this.emit(InventoryEvents.ITEM_REMOVED, { item: item, type: 'key' });
    this.debug('Removed key item:', item);
    return true;
};

/**
 * Check if player has a key item
 * @param {string} item - Item name
 * @returns {boolean}
 */
InventoryManagerClass.prototype.hasKeyItem = function(item) {
    var items = this.getState('player.inventory.keyItems') || [];
    return items.indexOf(item) !== -1;
};

/**
 * Get all key items
 * @returns {string[]}
 */
InventoryManagerClass.prototype.getKeyItems = function() {
    return this.getState('player.inventory.keyItems') || [];
};

// =========================================================================
// SKILLS
// =========================================================================

/**
 * Add a skill
 * @param {string} skill - Skill name
 */
InventoryManagerClass.prototype.addSkill = function(skill) {
    if (!skill) return;

    var isNew = !this.hasSkill(skill);

    this.setState('player.inventory.skills', function(skills) {
        if (skills.indexOf(skill) !== -1) return skills;
        return skills.concat([skill]);
    });

    // Track as new this run if it was actually added
    if (isNew) {
        this.setState('player.newThisRun.skills', function(skills) {
            skills = skills || [];
            if (skills.indexOf(skill) !== -1) return skills;
            return skills.concat([skill]);
        });
    }

    this.emit(InventoryEvents.ITEM_ADDED, { item: skill, type: 'skill' });
    this.debug('Added skill:', skill);
};

/**
 * Remove a skill
 * @param {string} skill - Skill name
 * @returns {boolean} Whether skill was removed
 */
InventoryManagerClass.prototype.removeSkill = function(skill) {
    var skills = this.getState('player.inventory.skills') || [];
    var index = skills.indexOf(skill);

    if (index === -1) return false;

    this.setState('player.inventory.skills', function(skills) {
        var newSkills = skills.slice();
        newSkills.splice(index, 1);
        return newSkills;
    });

    this.emit(InventoryEvents.ITEM_REMOVED, { item: skill, type: 'skill' });
    this.debug('Removed skill:', skill);
    return true;
};

/**
 * Check if player has a skill
 * @param {string} skill - Skill name
 * @returns {boolean}
 */
InventoryManagerClass.prototype.hasSkill = function(skill) {
    var skills = this.getState('player.inventory.skills') || [];
    return skills.indexOf(skill) !== -1;
};

/**
 * Get all skills
 * @returns {string[]}
 */
InventoryManagerClass.prototype.getSkills = function() {
    return this.getState('player.inventory.skills') || [];
};

/**
 * Check if player has all required skills (supports negation with '!')
 * @param {string[]} required - Array of skill names
 * @returns {boolean}
 */
InventoryManagerClass.prototype.hasAllSkills = function(required) {
    if (!required || !required.length) return true;
    var self = this;
    for (var i = 0; i < required.length; i++) {
        var skill = required[i];
        // Support negation: !Skill means "does NOT have this skill"
        if (skill.charAt(0) === '!') {
            if (self.hasSkill(skill.substring(1))) return false;
        } else {
            if (!self.hasSkill(skill)) return false;
        }
    }
    return true;
};

// =========================================================================
// CONSUMABLES
// =========================================================================

/**
 * Add consumable items
 * @param {string} item - Item name
 * @param {number} [count=1] - Quantity to add
 */
InventoryManagerClass.prototype.addConsumable = function(item, count) {
    if (!item) return;
    count = count || 1;

    this.setState('player.inventory.consumables', function(consumables) {
        var newConsumables = {};
        for (var key in consumables) {
            if (consumables.hasOwnProperty(key)) {
                newConsumables[key] = consumables[key];
            }
        }
        newConsumables[item] = (newConsumables[item] || 0) + count;
        return newConsumables;
    });

    this.emit(InventoryEvents.ITEM_ADDED, { item: item, type: 'consumable', count: count });
    this.debug('Added consumable:', item, 'x', count);
};

/**
 * Remove consumable items
 * @param {string} item - Item name
 * @param {number} [count=1] - Quantity to remove
 * @returns {boolean} Whether item was removed
 */
InventoryManagerClass.prototype.removeConsumable = function(item, count) {
    count = count || 1;
    var consumables = this.getState('player.inventory.consumables') || {};
    var current = consumables[item] || 0;

    if (current < count) return false;

    this.setState('player.inventory.consumables', function(consumables) {
        var newConsumables = {};
        for (var key in consumables) {
            if (consumables.hasOwnProperty(key)) {
                newConsumables[key] = consumables[key];
            }
        }
        newConsumables[item] = current - count;
        if (newConsumables[item] <= 0) {
            delete newConsumables[item];
        }
        return newConsumables;
    });

    this.emit(InventoryEvents.ITEM_REMOVED, { item: item, type: 'consumable', count: count });
    this.debug('Removed consumable:', item, 'x', count);
    return true;
};

/**
 * Check if player has consumable item(s)
 * @param {string} item - Item name
 * @param {number} [minCount=1] - Minimum quantity required
 * @returns {boolean}
 */
InventoryManagerClass.prototype.hasConsumable = function(item, minCount) {
    minCount = minCount || 1;
    var consumables = this.getState('player.inventory.consumables') || {};
    return (consumables[item] || 0) >= minCount;
};

/**
 * Get count of a consumable
 * @param {string} item - Item name
 * @returns {number}
 */
InventoryManagerClass.prototype.getConsumableCount = function(item) {
    var consumables = this.getState('player.inventory.consumables') || {};
    return consumables[item] || 0;
};

/**
 * Get all consumables
 * @returns {Object.<string, number>}
 */
InventoryManagerClass.prototype.getConsumables = function() {
    return this.getState('player.inventory.consumables') || {};
};

// =========================================================================
// GENERIC ITEM METHODS
// =========================================================================

/**
 * Add an item (auto-detects type)
 * @param {string|Object} item - Item name or item object
 */
InventoryManagerClass.prototype.addItem = function(item) {
    if (!item) return;

    // Handle string (legacy key item format)
    if (typeof item === 'string') {
        this.addKeyItem(item);
        return;
    }

    // Handle object format
    if (item.type === 'consumable') {
        this.addConsumable(item.name, item.count || 1);
    } else {
        this.addKeyItem(item.name || item);
    }
};

/**
 * Remove an item (checks both types)
 * @param {string} item - Item name
 * @returns {boolean}
 */
InventoryManagerClass.prototype.removeItem = function(item) {
    // Try key items first
    if (this.hasKeyItem(item)) {
        return this.removeKeyItem(item);
    }
    // Then try consumables
    if (this.hasConsumable(item)) {
        return this.removeConsumable(item, 1);
    }
    return false;
};

/**
 * Check if player has an item (checks both types)
 * @param {string} item - Item name
 * @returns {boolean}
 */
InventoryManagerClass.prototype.hasItem = function(item) {
    return this.hasKeyItem(item) || this.hasConsumable(item);
};

/**
 * Use an item (removes it and emits used event)
 * @param {string} item - Item name
 * @returns {boolean}
 */
InventoryManagerClass.prototype.useItem = function(item) {
    var removed = this.removeItem(item);
    if (removed) {
        this.emit(InventoryEvents.ITEM_USED, { item: item });
        this.debug('Used item:', item);
    }
    return removed;
};

/**
 * Get entire inventory state
 * @returns {Object}
 */
InventoryManagerClass.prototype.getInventory = function() {
    return this.getState('player.inventory') || { keyItems: [], consumables: {}, skills: [] };
};

/**
 * Check if inventory is empty
 * @returns {boolean}
 */
InventoryManagerClass.prototype.isEmpty = function() {
    var keyItems = this.getKeyItems();
    var consumables = this.getConsumables();
    var skills = this.getSkills();
    return keyItems.length === 0 && Object.keys(consumables).length === 0 && skills.length === 0;
};

/**
 * Clear all items (keeps skills - they persist)
 */
InventoryManagerClass.prototype.clearAll = function() {
    var currentSkills = this.getSkills();
    this.setState('player.inventory', function() {
        return {
            keyItems: [],
            consumables: {},
            skills: currentSkills  // Skills persist
        };
    });
    this.debug('Cleared items (skills preserved)');
};

/**
 * Clear everything including skills (full reset)
 */
InventoryManagerClass.prototype.clearEverything = function() {
    this.setState('player.inventory', function() {
        return {
            keyItems: [],
            consumables: {},
            skills: []
        };
    });
    this.debug('Cleared everything including skills');
};

// =========================================================================
// NEW THIS RUN TRACKING
// =========================================================================

/**
 * Get all items and skills obtained this run
 * @returns {Object} { keyItems: string[], skills: string[] }
 */
InventoryManagerClass.prototype.getNewThisRun = function() {
    return {
        keyItems: this.getState('player.newThisRun.keyItems') || [],
        skills: this.getState('player.newThisRun.skills') || []
    };
};

/**
 * Check if anything new was obtained this run
 * @returns {boolean}
 */
InventoryManagerClass.prototype.hasNewThisRun = function() {
    var newItems = this.getNewThisRun();
    return newItems.keyItems.length > 0 || newItems.skills.length > 0;
};

/**
 * Clear the "new this run" tracking (called on soft reset)
 */
InventoryManagerClass.prototype.clearNewThisRun = function() {
    this.setState('player.newThisRun', function() {
        return { keyItems: [], skills: [] };
    });
    this.debug('Cleared newThisRun tracking');
};

// Singleton instance
var inventoryManager = new InventoryManagerClass();

// Global export
window.inventoryManager = inventoryManager;

})();
