/**
 * Andi VN - Inventory Manager Module
 *
 * Centralized inventory management for key items, consumables, and skills.
 * Handles item operations and UI display updates.
 *
 * Usage:
 *   InventoryManager.init();
 *   InventoryManager.addKeyItem('Master Key');
 *   InventoryManager.addConsumable('Coffee', 3);
 *   InventoryManager.addSkill('Fireball');
 */

var InventoryManager = (function() {
    'use strict';

    // === State ===
    var state = {
        keyItems: [],       // unique key items (no count)
        consumables: {},    // consumable items with counts { "Coffee": 2 }
        skills: [],         // learned skills/abilities
        expanded: false     // UI state for expandable panel
    };

    // External state references (for flags display)
    var externalState = {
        flags: null,
        keyFlags: null
    };

    // === Logging ===
    var _log = typeof Logger !== 'undefined' ? Logger : {
        debug: function() {},
        info: function(m) { var a = Array.prototype.slice.call(arguments, 1); console.log.apply(console, ['[' + m + ']'].concat(a)); },
        warn: function(m) { var a = Array.prototype.slice.call(arguments, 1); console.warn.apply(console, ['[' + m + ']'].concat(a)); },
        error: function(m) { var a = Array.prototype.slice.call(arguments, 1); console.error.apply(console, ['[' + m + ']'].concat(a)); }
    };

    /**
     * Initialize the inventory manager
     * @param {Object} [cfg] - Configuration
     * @param {Object} [cfg.flagsRef] - Reference to flags object
     * @param {Object} [cfg.keyFlagsRef] - Reference to keyFlags object
     */
    function init(cfg) {
        if (cfg) {
            if (cfg.flagsRef) externalState.flags = cfg.flagsRef;
            if (cfg.keyFlagsRef) externalState.keyFlags = cfg.keyFlagsRef;
        }
        _log.debug('InventoryManager', 'Initialized');
    }

    /**
     * Set external state references (for flags display in inventory)
     * @param {Object} refs - { flags, keyFlags }
     */
    function setExternalRefs(refs) {
        if (refs.flags) externalState.flags = refs.flags;
        if (refs.keyFlags) externalState.keyFlags = refs.keyFlags;
    }

    // =========================================================================
    // KEY ITEMS
    // =========================================================================

    /**
     * Add key item to inventory (unique, no count)
     * @param {string} item - Key item name
     */
    function addKeyItem(item) {
        if (state.keyItems.indexOf(item) === -1) {
            state.keyItems.push(item);
            _log.info('InventoryManager', 'Added key item:', item);
            showNotification(item, 'added', 'key');
        }
        updateDisplay();
    }

    /**
     * Remove key item from inventory
     * @param {string} item - Key item name
     */
    function removeKeyItem(item) {
        var index = state.keyItems.indexOf(item);
        if (index !== -1) {
            state.keyItems.splice(index, 1);
            _log.info('InventoryManager', 'Removed key item:', item);
            showNotification(item, 'used', 'key');
        }
        updateDisplay();
    }

    /**
     * Check if player has a key item
     * @param {string} item - Key item name
     * @returns {boolean}
     */
    function hasKeyItem(item) {
        return state.keyItems.indexOf(item) !== -1;
    }

    // =========================================================================
    // SKILLS
    // =========================================================================

    /**
     * Add skill to inventory (unique, persists across soft reset)
     * @param {string} skill - Skill name
     */
    function addSkill(skill) {
        if (state.skills.indexOf(skill) === -1) {
            state.skills.push(skill);
            _log.info('InventoryManager', 'Learned skill:', skill);
            showNotification(skill, 'added', 'skill');
        }
        updateDisplay();
    }

    /**
     * Check if player has a skill
     * @param {string} skill - Skill name
     * @returns {boolean}
     */
    function hasSkill(skill) {
        return state.skills.indexOf(skill) !== -1;
    }

    /**
     * Check if player has all required skills
     * @param {string[]} skills - Array of skill names (supports !Skill for negation)
     * @returns {boolean}
     */
    function hasSkills(skills) {
        return skills.every(function(skill) {
            // Support negation: !Skill Name means "does NOT have this skill"
            if (skill.charAt(0) === '!') {
                var negatedSkill = skill.substring(1);
                return !hasSkill(negatedSkill);
            }
            return hasSkill(skill);
        });
    }

    // =========================================================================
    // CONSUMABLES
    // =========================================================================

    /**
     * Add consumable item to inventory (with count)
     * @param {string} item - Consumable item name
     * @param {number} [count=1] - Number to add
     */
    function addConsumable(item, count) {
        count = count || 1;
        if (state.consumables[item]) {
            state.consumables[item] += count;
        } else {
            state.consumables[item] = count;
        }
        _log.info('InventoryManager', 'Added consumable:', item, 'x' + count);
        showNotification(item + ' x' + count, 'added', 'consumable');
        updateDisplay();
    }

    /**
     * Remove consumable item from inventory
     * @param {string} item - Consumable item name
     * @param {number} [count=1] - Number to remove
     * @returns {boolean} - True if item was removed
     */
    function removeConsumable(item, count) {
        count = count || 1;
        if (state.consumables[item] && state.consumables[item] >= count) {
            state.consumables[item] -= count;
            if (state.consumables[item] <= 0) {
                delete state.consumables[item];
            }
            _log.info('InventoryManager', 'Removed consumable:', item, 'x' + count);
            showNotification(item, 'used', 'consumable');
            updateDisplay();
            return true;
        }
        return false;
    }

    /**
     * Check if player has a consumable (with optional count check)
     * @param {string} item - Consumable name
     * @param {number} [count=1] - Minimum count required
     * @returns {boolean}
     */
    function hasConsumable(item, count) {
        count = count || 1;
        return state.consumables[item] && state.consumables[item] >= count;
    }

    /**
     * Get consumable count
     * @param {string} item - Consumable name
     * @returns {number} - Count (0 if not owned)
     */
    function getConsumableCount(item) {
        return state.consumables[item] || 0;
    }

    // =========================================================================
    // GENERIC ITEM OPERATIONS
    // =========================================================================

    /**
     * Add items to inventory (legacy support + new format)
     * @param {string[]|object[]} items - Array of item names or item objects
     * Item object format: { name: "Item", type: "key"|"consumable", count: 1 }
     */
    function addItems(items) {
        items.forEach(function(item) {
            if (typeof item === 'string') {
                // Legacy format: assume key item
                addKeyItem(item);
            } else if (typeof item === 'object') {
                // New format with type
                if (item.type === 'consumable') {
                    addConsumable(item.name, item.count || 1);
                } else {
                    addKeyItem(item.name);
                }
            }
        });
    }

    /**
     * Remove items from inventory (legacy support + new format)
     * @param {string[]|object[]} items - Array of item names or item objects
     */
    function removeItems(items) {
        items.forEach(function(item) {
            if (typeof item === 'string') {
                // Legacy format: try key item first, then consumable
                if (hasKeyItem(item)) {
                    removeKeyItem(item);
                } else if (hasConsumable(item)) {
                    removeConsumable(item, 1);
                }
            } else if (typeof item === 'object') {
                if (item.type === 'consumable') {
                    removeConsumable(item.name, item.count || 1);
                } else {
                    removeKeyItem(item.name);
                }
            }
        });
    }

    /**
     * Check if player has specific items (legacy support)
     * @param {string[]} items - Array of item names to check (supports !Item for negation)
     * @returns {boolean} - True if player has all items (or doesn't have negated items)
     */
    function hasItems(items) {
        return items.every(function(item) {
            // Support negation: !Item Name means "does NOT have this item"
            if (item.charAt(0) === '!') {
                var negatedItem = item.substring(1);
                return !hasKeyItem(negatedItem) && !hasConsumable(negatedItem);
            }
            return hasKeyItem(item) || hasConsumable(item);
        });
    }

    /**
     * Check if player has a specific item (legacy support)
     * @param {string} item - Item name
     * @returns {boolean} - True if player has the item
     */
    function hasItem(item) {
        return hasKeyItem(item) || hasConsumable(item);
    }

    /**
     * Check if inventory has any items
     * @returns {boolean}
     */
    function hasAnyItems() {
        return state.keyItems.length > 0 || Object.keys(state.consumables).length > 0;
    }

    // =========================================================================
    // STATE MANAGEMENT
    // =========================================================================

    /**
     * Clear all inventory items (but keep skills by default)
     * @param {boolean} [clearSkills=false] - Also clear skills
     */
    function clear(clearSkills) {
        state.keyItems = [];
        state.consumables = {};
        if (clearSkills) {
            state.skills = [];
        }
        updateDisplay();
    }

    /**
     * Get full inventory state (for saving)
     * @returns {Object}
     */
    function getState() {
        return {
            keyItems: state.keyItems.slice(),
            consumables: Object.assign({}, state.consumables),
            skills: state.skills.slice(),
            expanded: state.expanded
        };
    }

    /**
     * Set inventory state (for loading)
     * @param {Object} savedState
     */
    function setState(savedState) {
        if (savedState.keyItems) state.keyItems = savedState.keyItems.slice();
        if (savedState.consumables) state.consumables = Object.assign({}, savedState.consumables);
        if (savedState.skills) state.skills = savedState.skills.slice();
        if (savedState.expanded !== undefined) state.expanded = savedState.expanded;
        updateDisplay();
    }

    // =========================================================================
    // UI
    // =========================================================================

    /**
     * Toggle inventory panel expanded/collapsed state
     */
    function toggle() {
        state.expanded = !state.expanded;
        updateDisplay();
    }

    /**
     * Show a floating notification when items are added/used
     * @param {string} item - Item name
     * @param {string} action - 'added' or 'used'
     * @param {string} itemType - 'key', 'consumable', or 'skill'
     */
    function showNotification(item, action, itemType) {
        var notification = document.createElement('div');
        notification.className = 'item-notification item-' + action;
        if (itemType) {
            notification.classList.add('item-type-' + itemType);
        }

        var icon = action === 'added' ? '+' : '−';
        var typeIcon = '';
        if (itemType === 'key') {
            typeIcon = '🔑 ';
        } else if (itemType === 'skill') {
            typeIcon = '✨ ';
        }
        notification.innerHTML = '<span class="item-icon">' + icon + '</span> ' + typeIcon + item;

        document.body.appendChild(notification);

        // Trigger animation
        setTimeout(function() {
            notification.classList.add('show');
        }, 10);

        // Remove after animation
        setTimeout(function() {
            notification.classList.add('fade-out');
            setTimeout(function() {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 500);
        }, 2000);
    }

    /**
     * Update the inventory display in the UI
     */
    function updateDisplay() {
        var inventoryContainer = document.getElementById('inventory-display');
        if (!inventoryContainer) return;

        // Get external state for flags display
        var flags = externalState.flags || {};
        var keyFlags = externalState.keyFlags || {};

        var hasSkillsContent = state.skills.length > 0;
        var hasKeyItems = state.keyItems.length > 0;
        var hasConsumables = Object.keys(state.consumables).length > 0;
        var hasKeyFlagsContent = Object.keys(keyFlags).length > 0;
        var hasFlagsContent = Object.keys(flags).length > 0;
        var hasAnyContent = hasSkillsContent || hasKeyItems || hasConsumables || hasKeyFlagsContent || hasFlagsContent;

        // Always show inventory container (even when empty)
        inventoryContainer.style.display = 'block';

        // Build the inventory HTML
        var html = '';

        // Header with toggle button
        html += '<div class="inventory-header" onclick="InventoryManager.toggle()">';
        html += '<span class="inventory-toggle">' + (state.expanded ? '▼' : '▶') + '</span>';
        html += '<span class="inventory-label">Inventory</span>';

        // Total count badge
        var totalItems = state.skills.length + state.keyItems.length +
                         Object.keys(state.consumables).length +
                         Object.keys(keyFlags).length + Object.keys(flags).length;
        html += '<span class="inventory-count">' + totalItems + '</span>';
        html += '</div>';

        // Expanded content
        if (state.expanded) {
            html += '<div class="inventory-content">';

            if (!hasAnyContent) {
                html += '<div class="inventory-empty">No items yet...</div>';
            } else {
                // Skills section
                if (hasSkillsContent) {
                    html += '<div class="inventory-section">';
                    html += '<div class="inventory-section-label">✨ Skills</div>';
                    state.skills.forEach(function(skill) {
                        html += '<div class="inventory-item inventory-item-skill">' + skill + '</div>';
                    });
                    html += '</div>';
                }

                // Key Items section
                if (hasKeyItems) {
                    html += '<div class="inventory-section">';
                    html += '<div class="inventory-section-label">🔑 Key Items</div>';
                    state.keyItems.forEach(function(item) {
                        html += '<div class="inventory-item inventory-item-key">' + item + '</div>';
                    });
                    html += '</div>';
                }

                // Consumables section
                if (hasConsumables) {
                    html += '<div class="inventory-section">';
                    html += '<div class="inventory-section-label">📦 Consumables</div>';
                    Object.keys(state.consumables).forEach(function(item) {
                        var count = state.consumables[item];
                        html += '<div class="inventory-item inventory-item-consumable">';
                        html += item + ' <span class="item-count">x' + count + '</span>';
                        html += '</div>';
                    });
                    html += '</div>';
                }

                // Key Flags section (milestones)
                if (hasKeyFlagsContent) {
                    html += '<div class="inventory-section">';
                    html += '<div class="inventory-section-label">⭐ Milestones</div>';
                    Object.keys(keyFlags).forEach(function(flag) {
                        var displayName = flag.replace(/_/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); });
                        html += '<div class="inventory-item inventory-item-keyflag">' + displayName + '</div>';
                    });
                    html += '</div>';
                }

                // Regular Flags section
                if (hasFlagsContent) {
                    html += '<div class="inventory-section">';
                    html += '<div class="inventory-section-label">🚩 Progress</div>';
                    Object.keys(flags).forEach(function(flag) {
                        var displayName = flag.replace(/_/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); });
                        html += '<div class="inventory-item inventory-item-flag">' + displayName + '</div>';
                    });
                    html += '</div>';
                }
            }

            html += '</div>';
        }

        inventoryContainer.innerHTML = html;
    }

    // === Public API ===
    return {
        init: init,
        setExternalRefs: setExternalRefs,
        // Key Items
        addKeyItem: addKeyItem,
        removeKeyItem: removeKeyItem,
        hasKeyItem: hasKeyItem,
        // Skills
        addSkill: addSkill,
        hasSkill: hasSkill,
        hasSkills: hasSkills,
        // Consumables
        addConsumable: addConsumable,
        removeConsumable: removeConsumable,
        hasConsumable: hasConsumable,
        getConsumableCount: getConsumableCount,
        // Generic
        addItems: addItems,
        removeItems: removeItems,
        hasItem: hasItem,
        hasItems: hasItems,
        hasAnyItems: hasAnyItems,
        // State
        clear: clear,
        getState: getState,
        setState: setState,
        // UI
        toggle: toggle,
        showNotification: showNotification,
        updateDisplay: updateDisplay
    };
})();
