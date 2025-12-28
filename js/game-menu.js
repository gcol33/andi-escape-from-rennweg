/**
 * Game Menu - Full-Screen RPG Menu System
 *
 * Provides a tabbed menu overlay with:
 * - Items (key items + consumables)
 * - Skills (learned abilities)
 * - Stats (HP/MP/combat stats)
 * - Journal (visited scenes with recap)
 * - Save/Load (multiple save slots)
 */

var GameMenu = (function() {
    'use strict';

    // DOM element references
    var overlay = null;
    var container = null;
    var tabs = null;
    var tabPanels = {};
    var menuBtn = null;
    var closeBtn = null;

    // State
    var isOpen = false;
    var activeTab = 'items';
    var initialized = false;

    // Event handler references for cleanup
    var handlers = {
        menuBtnClick: null,
        closeBtnClick: null,
        overlayClick: null,
        keydown: null,
        tabClicks: []
    };

    // Save slot configuration
    var SAVE_SLOTS = [
        { id: 0, name: 'Auto-Save', isAuto: true },
        { id: 1, name: 'Slot 1', isAuto: false },
        { id: 2, name: 'Slot 2', isAuto: false },
        { id: 3, name: 'Slot 3', isAuto: false }
    ];

    /**
     * Initialize the game menu system
     */
    function init() {
        if (initialized) return;

        // Cache DOM elements
        overlay = document.getElementById('game-menu-overlay');
        container = document.getElementById('game-menu-container');
        menuBtn = document.getElementById('menu-btn');

        if (!overlay || !container) {
            console.warn('GameMenu: Required elements not found');
            return;
        }

        closeBtn = overlay.querySelector('.menu-close-btn');
        tabs = overlay.querySelectorAll('.menu-tab');

        // Cache tab panels
        tabPanels = {
            items: document.getElementById('tab-items'),
            skills: document.getElementById('tab-skills'),
            stats: document.getElementById('tab-stats'),
            journal: document.getElementById('tab-journal'),
            save: document.getElementById('tab-save')
        };

        // Create named handler functions for cleanup
        handlers.menuBtnClick = function() { open(); };
        handlers.closeBtnClick = function() { close(); };
        handlers.overlayClick = function(e) {
            if (e.target === overlay) {
                close();
            }
        };
        handlers.keydown = function(e) {
            if (e.key === 'Escape' && isOpen) {
                close();
            }
        };

        // Bind event listeners (use ListenerManager if available)
        if (typeof ListenerManager !== 'undefined') {
            if (menuBtn) {
                ListenerManager.add(menuBtn, 'click', handlers.menuBtnClick, 'game-menu');
            }
            if (closeBtn) {
                ListenerManager.add(closeBtn, 'click', handlers.closeBtnClick, 'game-menu');
            }
            ListenerManager.add(overlay, 'click', handlers.overlayClick, 'game-menu');
            ListenerManager.add(document, 'keydown', handlers.keydown, 'game-menu');

            // Tab switching
            tabs.forEach(function(tab) {
                var handler = function() { switchTab(tab.dataset.tab); };
                handlers.tabClicks.push({ element: tab, handler: handler });
                ListenerManager.add(tab, 'click', handler, 'game-menu');
            });
        } else {
            // Fallback to direct addEventListener
            if (menuBtn) {
                menuBtn.addEventListener('click', handlers.menuBtnClick);
            }
            if (closeBtn) {
                closeBtn.addEventListener('click', handlers.closeBtnClick);
            }
            overlay.addEventListener('click', handlers.overlayClick);
            document.addEventListener('keydown', handlers.keydown);

            // Tab switching
            tabs.forEach(function(tab) {
                var handler = function() { switchTab(tab.dataset.tab); };
                handlers.tabClicks.push({ element: tab, handler: handler });
                tab.addEventListener('click', handler);
            });
        }

        initialized = true;
        console.log('GameMenu initialized');
    }

    /**
     * Clean up event listeners and reset state
     */
    function destroy() {
        if (!initialized) return;

        // Close menu if open
        if (isOpen) {
            close();
        }

        // Remove event listeners
        if (typeof ListenerManager !== 'undefined') {
            ListenerManager.removeAll('game-menu');
        } else {
            // Manual cleanup
            if (menuBtn && handlers.menuBtnClick) {
                menuBtn.removeEventListener('click', handlers.menuBtnClick);
            }
            if (closeBtn && handlers.closeBtnClick) {
                closeBtn.removeEventListener('click', handlers.closeBtnClick);
            }
            if (overlay && handlers.overlayClick) {
                overlay.removeEventListener('click', handlers.overlayClick);
            }
            if (handlers.keydown) {
                document.removeEventListener('keydown', handlers.keydown);
            }
            handlers.tabClicks.forEach(function(entry) {
                entry.element.removeEventListener('click', entry.handler);
            });
        }

        // Reset handler references
        handlers = {
            menuBtnClick: null,
            closeBtnClick: null,
            overlayClick: null,
            keydown: null,
            tabClicks: []
        };

        // Reset state
        overlay = null;
        container = null;
        tabs = null;
        tabPanels = {};
        menuBtn = null;
        closeBtn = null;
        isOpen = false;
        activeTab = 'items';
        initialized = false;

        console.log('GameMenu destroyed');
    }

    /**
     * Open the menu
     */
    function open() {
        if (isOpen) return;

        isOpen = true;
        overlay.classList.remove('hidden');

        // Render current tab content
        renderTab(activeTab);

        // Focus first tab for keyboard navigation
        if (tabs.length > 0) {
            tabs[0].focus();
        }
    }

    /**
     * Close the menu
     */
    function close() {
        if (!isOpen) return;

        isOpen = false;
        overlay.classList.add('hidden');

        // Return focus to menu button
        if (menuBtn) {
            menuBtn.focus();
        }
    }

    /**
     * Toggle menu open/closed
     */
    function toggle() {
        if (isOpen) {
            close();
        } else {
            open();
        }
    }

    /**
     * Switch to a specific tab
     */
    function switchTab(tabId) {
        if (!tabPanels[tabId]) return;

        activeTab = tabId;

        // Update tab active states
        tabs.forEach(function(tab) {
            var isActive = tab.dataset.tab === tabId;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        // Update panel visibility
        Object.keys(tabPanels).forEach(function(key) {
            if (tabPanels[key]) {
                tabPanels[key].classList.toggle('active', key === tabId);
            }
        });

        // Render tab content
        renderTab(tabId);
    }

    /**
     * Render content for a specific tab
     */
    function renderTab(tabId) {
        switch (tabId) {
            case 'items':
                renderItems();
                break;
            case 'skills':
                renderSkills();
                break;
            case 'stats':
                renderStats();
                break;
            case 'journal':
                renderJournal();
                break;
            case 'save':
                renderSaveLoad();
                break;
        }
    }

    /**
     * Get inventory from engine
     */
    function getInventory() {
        if (typeof VNEngine !== 'undefined' && VNEngine.getState) {
            var state = VNEngine.getState();
            console.log('[GameMenu] getInventory - state:', state);
            console.log('[GameMenu] getInventory - inventory:', state ? state.inventory : 'no state');
            return state.inventory || { keyItems: [], consumables: {}, skills: [] };
        }
        console.warn('[GameMenu] VNEngine not available');
        return { keyItems: [], consumables: {}, skills: [] };
    }

    /**
     * Render Items tab
     */
    function renderItems() {
        var panel = tabPanels.items;
        if (!panel) return;

        var inventory = getInventory();
        var html = '';

        // Key Items section
        html += '<div class="menu-section">';
        html += '<div class="menu-section-title">Key Items</div>';

        if (inventory.keyItems && inventory.keyItems.length > 0) {
            inventory.keyItems.forEach(function(item) {
                html += '<div class="menu-item menu-item-key">' + escapeHtml(item) + '</div>';
            });
        } else {
            html += '<div class="menu-empty">No key items</div>';
        }
        html += '</div>';

        // Consumables section
        html += '<div class="menu-section">';
        html += '<div class="menu-section-title">Consumables</div>';

        var consumables = inventory.consumables || {};
        var consumableKeys = Object.keys(consumables);

        if (consumableKeys.length > 0) {
            consumableKeys.forEach(function(item) {
                var count = consumables[item];
                html += '<div class="menu-item menu-item-consumable">';
                html += '<span>' + escapeHtml(item) + '</span>';
                html += '<span class="menu-item-count">x' + count + '</span>';
                html += '</div>';
            });
        } else {
            html += '<div class="menu-empty">No consumables</div>';
        }
        html += '</div>';

        panel.innerHTML = html;
    }

    /**
     * Render Skills tab
     * Organized like Items: Knowledge (story discoveries) + Abilities (battle skills)
     */
    function renderSkills() {
        var panel = tabPanels.skills;
        console.log('[GameMenu] renderSkills - panel:', panel);
        if (!panel) {
            console.error('[GameMenu] renderSkills - panel not found!');
            return;
        }

        var inventory = getInventory();
        var playerSkills = inventory.skills || [];
        console.log('[GameMenu] renderSkills - playerSkills:', playerSkills);
        var html = '';

        // Get skill definitions from player config (these are battle abilities)
        var skillDefs = {};
        if (typeof playerConfig !== 'undefined' && playerConfig.skills) {
            playerConfig.skills.forEach(function(skill) {
                skillDefs[skill.id] = skill;
            });
        }

        // Separate into knowledge (story skills) and abilities (battle skills)
        var knowledge = [];
        var abilities = [];

        playerSkills.forEach(function(skillId) {
            if (skillDefs[skillId]) {
                abilities.push({ id: skillId, def: skillDefs[skillId] });
            } else {
                knowledge.push(skillId);
            }
        });

        // Knowledge section (story discoveries like "Smile", "Rooftop Discovery")
        html += '<div class="menu-section">';
        html += '<div class="menu-section-title">Knowledge</div>';

        if (knowledge.length > 0) {
            knowledge.forEach(function(skillName) {
                html += '<div class="menu-item menu-item-knowledge">' + escapeHtml(skillName) + '</div>';
            });
        } else {
            html += '<div class="menu-empty">No discoveries yet</div>';
        }
        html += '</div>';

        // Abilities section (battle skills with mana costs)
        html += '<div class="menu-section">';
        html += '<div class="menu-section-title">Abilities</div>';

        if (abilities.length > 0) {
            abilities.forEach(function(entry) {
                var skill = entry.def;
                var canUse = checkSkillRequirements(skill);

                html += '<div class="skill-item' + (canUse ? '' : ' menu-item-disabled') + '">';
                html += '<div class="skill-header">';
                html += '<span class="skill-name">' + escapeHtml(skill.name || skill.id) + '</span>';
                if (skill.manaCost > 0) {
                    html += '<span class="skill-cost">' + skill.manaCost + ' MP</span>';
                }
                html += '</div>';

                if (skill.description) {
                    html += '<div class="skill-description">' + escapeHtml(skill.description) + '</div>';
                }

                if (!canUse && skill.requiresItem) {
                    html += '<div class="skill-requirement">Requires: ' + escapeHtml(skill.requiresItem) + '</div>';
                }
                if (!canUse && skill.requiresFlag) {
                    html += '<div class="skill-requirement">Requires: ' + escapeHtml(skill.requiresFlag) + '</div>';
                }

                html += '</div>';
            });
        } else {
            html += '<div class="menu-empty">No abilities learned</div>';
        }
        html += '</div>';

        panel.innerHTML = html;
    }

    /**
     * Check if skill requirements are met
     */
    function checkSkillRequirements(skill) {
        if (!skill) return true;

        // Check item requirement
        if (skill.requiresItem) {
            if (typeof VNEngine !== 'undefined' && VNEngine.hasItem) {
                if (!VNEngine.hasItem(skill.requiresItem)) {
                    return false;
                }
            }
        }

        // Check flag requirement
        if (skill.requiresFlag) {
            if (typeof VNEngine !== 'undefined' && VNEngine.hasFlag) {
                if (!VNEngine.hasFlag(skill.requiresFlag)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Render Stats tab
     */
    function renderStats() {
        var panel = tabPanels.stats;
        if (!panel) return;

        var hp = 0, maxHp = 0, mana = 0, maxMana = 0, ac = 10, attackBonus = 0;

        // Get stats from engine
        if (typeof VNEngine !== 'undefined' && VNEngine.getPlayerStats) {
            var stats = VNEngine.getPlayerStats();
            console.log('[GameMenu] renderStats - engine stats:', stats);
            hp = stats.hp || 0;
            maxHp = stats.maxHP || stats.maxHp || 0;
            mana = stats.mana || 0;
            maxMana = stats.maxMana || stats.maxMP || 0;
        } else {
            console.warn('[GameMenu] renderStats - VNEngine.getPlayerStats not available');
        }

        // Get base stats from player config
        if (typeof playerConfig !== 'undefined') {
            console.log('[GameMenu] renderStats - playerConfig:', playerConfig);
            if (!maxHp) maxHp = playerConfig.hp || 42;
            if (!maxMana) maxMana = playerConfig.mana || 10;
            ac = playerConfig.ac || 11;
            attackBonus = playerConfig.attack_bonus || 0;
        } else {
            console.warn('[GameMenu] renderStats - playerConfig not available');
        }

        // Use max as current if not in battle
        if (hp === 0 || hp === null) hp = maxHp;
        if (mana === 0 || mana === null) mana = maxMana;

        var hpPercent = maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0;
        var manaPercent = maxMana > 0 ? Math.round((mana / maxMana) * 100) : 0;

        var html = '';

        // HP bar
        html += '<div class="stat-block">';
        html += '<div class="stat-label"><span>HP</span><span>' + hp + ' / ' + maxHp + '</span></div>';
        html += '<div class="stat-bar-outer">';
        html += '<div class="stat-bar-inner stat-bar-hp" style="width: ' + hpPercent + '%"></div>';
        html += '</div>';
        html += '</div>';

        // Mana bar
        html += '<div class="stat-block">';
        html += '<div class="stat-label"><span>Mana</span><span>' + mana + ' / ' + maxMana + '</span></div>';
        html += '<div class="stat-bar-outer">';
        html += '<div class="stat-bar-inner stat-bar-mana" style="width: ' + manaPercent + '%"></div>';
        html += '</div>';
        html += '</div>';

        // Combat stats
        html += '<div class="menu-section">';
        html += '<div class="menu-section-title">Combat Stats</div>';
        html += '<div class="stat-row"><span>Armor Class</span><span class="stat-value">' + ac + '</span></div>';
        html += '<div class="stat-row"><span>Attack Bonus</span><span class="stat-value">+' + attackBonus + '</span></div>';
        html += '</div>';

        panel.innerHTML = html;
    }

    /**
     * Render Journal tab
     */
    function renderJournal() {
        var panel = tabPanels.journal;
        if (!panel) return;

        var history = [];

        // Get scene history from engine
        if (typeof VNEngine !== 'undefined' && VNEngine.getState) {
            var state = VNEngine.getState();
            history = state.history || [];
        }

        var html = '';

        if (history.length > 0) {
            // Show scenes in reverse order (most recent first)
            var reversedHistory = history.slice().reverse();
            var seenScenes = {};

            reversedHistory.forEach(function(sceneId) {
                // Skip duplicates
                if (seenScenes[sceneId]) return;
                seenScenes[sceneId] = true;

                // Get scene data
                var scene = null;
                if (typeof story !== 'undefined' && story[sceneId]) {
                    scene = story[sceneId];
                }

                // Show all scenes with titles (recap is optional)
                if (scene && scene.title) {
                    html += '<div class="journal-entry">';
                    html += '<div class="journal-title">' + escapeHtml(scene.title) + '</div>';
                    if (scene.recap) {
                        html += '<div class="journal-recap">' + escapeHtml(scene.recap) + '</div>';
                    }
                    html += '</div>';
                }
            });
        }

        if (html === '') {
            html = '<div class="menu-empty">No journal entries yet</div>';
        }

        panel.innerHTML = html;
    }

    /**
     * Render Save/Load tab
     */
    function renderSaveLoad() {
        var panel = tabPanels.save;
        if (!panel) return;

        var html = '';

        SAVE_SLOTS.forEach(function(slot) {
            var saveInfo = getSaveInfo(slot.id);
            var isEmpty = !saveInfo;

            html += '<div class="save-slot">';
            html += '<div class="save-slot-info">';
            html += '<div class="save-slot-name">' + escapeHtml(slot.name) + '</div>';

            if (isEmpty) {
                html += '<div class="save-slot-details save-slot-empty">Empty</div>';
            } else {
                var details = saveInfo.sceneId || 'Unknown scene';
                if (saveInfo.timestamp) {
                    details += ' - ' + formatTimestamp(saveInfo.timestamp);
                }
                html += '<div class="save-slot-details">' + escapeHtml(details) + '</div>';
            }

            html += '</div>';
            html += '<div class="save-slot-actions">';

            if (!slot.isAuto) {
                html += '<button class="save-slot-btn save-btn" onclick="GameMenu.saveGame(' + slot.id + ')">Save</button>';
            }

            if (!isEmpty) {
                html += '<button class="save-slot-btn load-btn" onclick="GameMenu.loadGame(' + slot.id + ')">Load</button>';
                if (!slot.isAuto) {
                    html += '<button class="save-slot-btn delete-btn" onclick="GameMenu.deleteSave(' + slot.id + ')">Delete</button>';
                }
            }

            html += '</div>';
            html += '</div>';
        });

        panel.innerHTML = html;
    }

    /**
     * Get save info for a slot
     */
    function getSaveInfo(slotId) {
        var key = slotId === 0 ? 'andi_vn_save' : 'andi_vn_save_' + slotId;
        try {
            var data = localStorage.getItem(key);
            if (data) {
                var parsed = JSON.parse(data);
                return {
                    sceneId: parsed.currentSceneId,
                    timestamp: parsed.timestamp || null
                };
            }
        } catch (e) {
            console.warn('GameMenu: Error reading save slot ' + slotId, e);
        }
        return null;
    }

    /**
     * Save game to a slot
     */
    function saveGame(slotId) {
        if (slotId === 0) {
            console.warn('GameMenu: Cannot manually save to auto-save slot');
            return;
        }

        var key = 'andi_vn_save_' + slotId;

        // Get current game state
        if (typeof VNEngine !== 'undefined' && VNEngine.getState) {
            var state = VNEngine.getState();
            var saveData = {
                currentSceneId: state.currentSceneId,
                currentBlockIndex: state.currentBlockIndex,
                flags: state.flags || {},
                keyFlags: state.keyFlags || {},
                inventory: state.inventory || { keyItems: [], consumables: {}, skills: [] },
                playerHP: state.playerHP,
                playerMaxHP: state.playerMaxHP,
                playerMana: state.playerMana,
                playerMaxMana: state.playerMaxMana,
                readBlocks: state.readBlocks || {},
                wonBattles: state.wonBattles || {},
                history: state.history || [],
                timestamp: Date.now()
            };

            try {
                localStorage.setItem(key, JSON.stringify(saveData));
                console.log('GameMenu: Saved to slot ' + slotId);
                renderSaveLoad(); // Refresh display
            } catch (e) {
                console.error('GameMenu: Error saving to slot ' + slotId, e);
                alert('Failed to save game. Storage may be full.');
            }
        }
    }

    /**
     * Load game from a slot
     */
    function loadGame(slotId) {
        var key = slotId === 0 ? 'andi_vn_save' : 'andi_vn_save_' + slotId;

        try {
            var data = localStorage.getItem(key);
            if (!data) {
                console.warn('GameMenu: No save data in slot ' + slotId);
                return;
            }

            // Close menu first
            close();

            // Copy to main save slot and reload
            if (slotId !== 0) {
                localStorage.setItem('andi_vn_save', data);
            }

            // Reload the page to apply save
            location.reload();
        } catch (e) {
            console.error('GameMenu: Error loading from slot ' + slotId, e);
            alert('Failed to load save data.');
        }
    }

    /**
     * Delete a save slot
     */
    function deleteSave(slotId) {
        if (slotId === 0) {
            console.warn('GameMenu: Cannot delete auto-save slot');
            return;
        }

        if (!confirm('Delete this save? This cannot be undone.')) {
            return;
        }

        var key = 'andi_vn_save_' + slotId;

        try {
            localStorage.removeItem(key);
            console.log('GameMenu: Deleted save slot ' + slotId);
            renderSaveLoad(); // Refresh display
        } catch (e) {
            console.error('GameMenu: Error deleting slot ' + slotId, e);
        }
    }

    /**
     * Format timestamp for display
     */
    function formatTimestamp(timestamp) {
        var date = new Date(timestamp);
        var now = new Date();

        // Today - show time only
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        // This year - show month/day
        if (date.getFullYear() === now.getFullYear()) {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }

        // Different year - show full date
        return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (typeof text !== 'string') return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Check if menu is currently open
     */
    function isMenuOpen() {
        return isOpen;
    }

    // Public API
    return {
        init: init,
        destroy: destroy,
        open: open,
        close: close,
        toggle: toggle,
        switchTab: switchTab,
        isOpen: isMenuOpen,
        saveGame: saveGame,
        loadGame: loadGame,
        deleteSave: deleteSave,
        refresh: function() {
            if (isOpen) {
                renderTab(activeTab);
            }
        }
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', GameMenu.init);
} else {
    GameMenu.init();
}
