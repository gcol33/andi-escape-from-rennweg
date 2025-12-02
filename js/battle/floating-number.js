/**
 * Andi VN - Floating Number Module
 *
 * Centralized floating damage/heal/stat number animations.
 * Used by BattleUI and any other module that needs floating numbers.
 *
 * Features:
 * - WoW-style floating numbers on sprites
 * - Staggered positioning to avoid overlap
 * - Unified styling through CSS classes
 * - Support for damage, heal, miss, crit, status changes
 *
 * Usage:
 *   FloatingNumber.show(amount, target, type);
 *   FloatingNumber.showStatChange(statType, amount, target, label);
 */

var FloatingNumber = (function() {
    'use strict';

    // === Configuration ===
    var T = typeof TUNING !== 'undefined' ? TUNING : null;

    var config = {
        duration: T ? T.battle.timing.damageNumberFloat : 4000,
        statChangeDelay: 200  // Delay between sequential stat popups
    };

    // Track positions to avoid overlap
    var positionState = {
        lastX: 0,
        lastTime: 0,
        counter: 0
    };

    // Container element (cached)
    var _container = null;

    // === Initialization ===

    /**
     * Initialize with container element
     * @param {HTMLElement} container - Container for floating numbers (typically vn-container)
     */
    function init(container) {
        _container = container;
    }

    /**
     * Get container element (lazy init if needed)
     */
    function getContainer() {
        if (!_container) {
            _container = document.getElementById('vn-container');
        }
        return _container;
    }

    // === Styling Helpers ===

    /**
     * Get CSS class for floating number based on type
     * Uses unified roll display system when BattleDiceUI is available
     * @param {string} type - 'damage', 'heal', 'crit', 'maxdamage', 'mindamage', 'miss', 'dot', etc.
     * @returns {string} CSS class name
     */
    function getFloatingClass(type) {
        // Use BattleDiceUI helper if available for consistent styling
        var getRollClass = (typeof BattleDiceUI !== 'undefined' && BattleDiceUI.getRollClass)
            ? BattleDiceUI.getRollClass
            : function(rollType, resultCategory) { return 'roll-' + rollType + '-' + resultCategory; };

        switch (type) {
            case 'crit':
                return getRollClass('damage', 'crit');
            case 'maxdamage':
                return getRollClass('damage', 'max');
            case 'mindamage':
                return getRollClass('damage', 'min');
            case 'damage':
            case 'dot':
                return getRollClass('damage', 'normal');
            case 'heal':
                return getRollClass('heal', 'normal');
            case 'maxheal':
                return getRollClass('heal', 'max');
            case 'minheal':
                return getRollClass('heal', 'min');
            case 'miss':
                return getRollClass('neutral', 'normal');
            default:
                return getRollClass('damage', 'normal');
        }
    }

    // === Position Calculation ===

    /**
     * Calculate position for floating number based on target
     * @param {string} target - 'player' or 'enemy'
     * @param {HTMLElement} container - Container element
     * @returns {object} { x: percentage, y: percentage }
     */
    function calculatePosition(target, container) {
        var containerRect = container.getBoundingClientRect();
        var baseX, baseY;

        // Update stagger state
        var now = Date.now();
        if (now - positionState.lastTime > 500) {
            positionState.counter = 0;
        }
        positionState.counter++;
        positionState.lastTime = now;

        // Get battle log height to know where sprite area ends
        var battleLogPanel = document.querySelector('.battle-log-panel');
        var battleLogHeight = battleLogPanel ? battleLogPanel.offsetHeight : 0;
        var spriteAreaBottom = containerRect.height - battleLogHeight;
        var spriteAreaBottomPercent = (spriteAreaBottom / containerRect.height) * 100;
        var targetY = spriteAreaBottomPercent - 15; // ~15% above the battle log

        if (target === 'player') {
            // Player damage - left side near player stats panel
            var playerPanel = document.getElementById('player-stats-panel');
            if (playerPanel) {
                var panelRect = playerPanel.getBoundingClientRect();
                baseX = ((panelRect.left + panelRect.width / 2 - containerRect.left) / containerRect.width) * 100;
            } else {
                baseX = 20;
            }
            baseY = targetY;
            // Add some random spread
            baseX += (Math.random() * 10 - 5);
            baseY += (Math.random() * 8 - 4);
        } else {
            // Enemy damage - centered on the enemy sprite
            var spriteLayer = document.getElementById('sprite-layer');
            var spriteImg = spriteLayer ? spriteLayer.querySelector('img') : null;

            if (spriteImg) {
                var imgRect = spriteImg.getBoundingClientRect();
                baseX = ((imgRect.left + imgRect.width / 2 - containerRect.left) / containerRect.width) * 100;
                // Position vertically on the sprite (upper-middle area for better visibility)
                baseY = ((imgRect.top + imgRect.height * 0.3 - containerRect.top) / containerRect.height) * 100;
            } else {
                // Fallback: center of screen horizontally
                baseX = 50;
                baseY = targetY;
            }
            // Add some random spread to avoid overlap
            var spread = (positionState.counter % 2 === 0 ? -1 : 1) * (3 + Math.random() * 5);
            baseX += spread;
            baseY += (Math.random() * 8 - 4);
        }

        return { x: baseX, y: baseY };
    }

    /**
     * Calculate position near a stat bar element
     * @param {HTMLElement} statElement - The stat bar element
     * @param {string} target - 'player' or 'enemy'
     * @param {HTMLElement} container - Container element
     * @returns {object} { x: percentage, y: percentage }
     */
    function calculateStatPosition(statElement, target, container) {
        var containerRect = container.getBoundingClientRect();
        var baseX, baseY;

        if (statElement) {
            var statRect = statElement.getBoundingClientRect();
            baseX = ((statRect.left + statRect.width / 2 - containerRect.left) / containerRect.width) * 100;
            baseY = ((statRect.top - containerRect.top) / containerRect.height) * 100;
        } else {
            // Fallback positions
            baseX = target === 'player' ? 20 : 80;
            baseY = 70;
        }

        // Add small random offset
        baseX += (Math.random() * 6 - 3);

        return { x: baseX, y: baseY };
    }

    // === Main Display Functions ===

    /**
     * Show floating damage/heal number
     * @param {number} amount - Damage/heal amount
     * @param {string} target - 'player' or 'enemy'
     * @param {string} type - 'damage', 'heal', 'dot', 'crit', 'maxdamage', 'mindamage', 'miss', 'ac-boost'
     */
    function show(amount, target, type) {
        var container = getContainer();
        if (!container) return;

        var isCrit = type === 'crit';
        var isMaxDamage = type === 'maxdamage';
        var isMinDamage = type === 'mindamage';
        var isHeal = type === 'heal' || type === 'maxheal' || type === 'minheal';
        var isDot = type === 'dot';
        var isMiss = type === 'miss';
        var isACBoost = type === 'ac-boost';

        var damageNum = document.createElement('div');

        // Get unified roll class for consistent styling
        var rollClass = getFloatingClass(type);

        // For crit/max/min damage floating numbers, don't use the roll class (avoid glow effects)
        // Just use the base damage color class instead
        var floatingClass = rollClass;
        if (isCrit || isMaxDamage || isMinDamage) {
            floatingClass = 'roll-damage-normal';
        }

        // Set class and text based on type
        var displayAmount = Math.abs(amount);
        if (isMiss) {
            damageNum.className = 'damage-number wow-style ' + floatingClass;
            damageNum.textContent = 'MISS';
        } else if (isACBoost) {
            damageNum.className = 'damage-number wow-style ac-boost';
            damageNum.textContent = '+' + displayAmount + ' AC';
        } else {
            damageNum.className = 'damage-number wow-style ' + floatingClass;
            damageNum.textContent = (isHeal ? '+' : '-') + displayAmount;
        }

        // Create labels for special hits
        var hitLabel = createHitLabel(type, isDot);

        // Calculate position
        var pos = calculatePosition(target, container);
        damageNum.style.left = pos.x + '%';
        damageNum.style.top = pos.y + '%';

        container.appendChild(damageNum);

        // Add label if present
        if (hitLabel) {
            hitLabel.style.left = pos.x + '%';
            hitLabel.style.top = pos.y + '%';
            container.appendChild(hitLabel);

            setTimeout(function() {
                if (hitLabel.parentNode) {
                    hitLabel.parentNode.removeChild(hitLabel);
                }
            }, config.duration);
        }

        // Remove damage number after animation
        setTimeout(function() {
            if (damageNum.parentNode) {
                damageNum.parentNode.removeChild(damageNum);
            }
        }, config.duration);
    }

    /**
     * Create hit label element (CRIT!, MAX!, MIN, Hit, DAMAGE for DOT)
     * @param {string} type - Damage type
     * @param {boolean} isDot - Whether this is DOT damage
     * @returns {HTMLElement|null} Label element or null
     */
    function createHitLabel(type, isDot) {
        var hitLabel = null;
        var getRollClass = (typeof BattleDiceUI !== 'undefined' && BattleDiceUI.getRollClass)
            ? BattleDiceUI.getRollClass
            : function(rollType, resultCategory) { return 'roll-' + rollType + '-' + resultCategory; };

        if (type === 'crit') {
            hitLabel = document.createElement('div');
            hitLabel.className = 'damage-number wow-style crit-label';
            hitLabel.textContent = 'CRIT!';
        } else if (type === 'maxdamage') {
            hitLabel = document.createElement('div');
            hitLabel.className = 'damage-number wow-style max-label';
            hitLabel.textContent = 'MAX!';
        } else if (type === 'mindamage') {
            hitLabel = document.createElement('div');
            hitLabel.className = 'damage-number wow-style min-label';
            hitLabel.textContent = 'MIN';
        } else if (isDot) {
            hitLabel = document.createElement('div');
            var dotLabelClass = getRollClass('damage', 'normal');
            hitLabel.className = 'damage-number wow-style dot-label ' + dotLabelClass;
            hitLabel.textContent = 'DAMAGE';
        } else if (type === 'damage') {
            // Normal hits show "Hit" label
            hitLabel = document.createElement('div');
            var hitLabelClass = getRollClass('hit', 'normal');
            hitLabel.className = 'damage-number wow-style hit-label ' + hitLabelClass;
            hitLabel.textContent = 'Hit';
        }

        return hitLabel;
    }

    /**
     * Show floating stat change notification near a stat bar
     * @param {string} statType - 'hp', 'mana', 'limit', 'ac'
     * @param {number} amount - Change amount (positive = gain, negative = loss)
     * @param {string} target - 'player' or 'enemy'
     * @param {string} label - Optional label text (e.g., "AC" for AC changes)
     * @param {object} elements - Optional cached element references
     */
    function showStatChange(statType, amount, target, label, elements) {
        if (amount === 0) return;

        var container = getContainer();
        if (!container) return;

        elements = elements || {};

        // Determine the stat element to position near
        var statElement = null;
        var displayClass = '';
        var prefix = '';

        switch (statType) {
            case 'hp':
                statElement = target === 'player'
                    ? (elements.playerHPBar || document.getElementById('player-hp-bar'))
                    : (elements.enemyHPBar || document.getElementById('enemy-hp-bar'));
                displayClass = amount > 0 ? 'heal' : 'damage';
                prefix = amount > 0 ? '+' : '';
                break;
            case 'mana':
                statElement = elements.playerManaBar || document.getElementById('player-mana-bar');
                displayClass = 'mana-change';
                prefix = amount > 0 ? '+' : '';
                break;
            case 'limit':
                statElement = elements.limitBar || document.getElementById('limit-bar');
                displayClass = 'limit-change purple';
                prefix = amount > 0 ? '+' : '';
                break;
            case 'ac':
                statElement = elements.playerACDisplay || document.getElementById('player-ac-display');
                displayClass = amount > 0 ? 'ac-boost' : 'ac-reduce';
                prefix = amount > 0 ? '+' : '';
                break;
            default:
                return;
        }

        // Create the floating number
        var statNum = document.createElement('div');
        statNum.className = 'damage-number wow-style stat-change ' + displayClass;
        statNum.textContent = prefix + amount + (label ? ' ' + label : '');

        // Position near the stat bar
        var pos = calculateStatPosition(statElement, target, container);
        statNum.style.left = pos.x + '%';
        statNum.style.top = pos.y + '%';

        container.appendChild(statNum);

        setTimeout(function() {
            if (statNum.parentNode) {
                statNum.parentNode.removeChild(statNum);
            }
        }, config.duration);
    }

    /**
     * Show multiple stat changes sequentially with delays
     * Order: HP -> Mana -> Limit Break
     * @param {object} changes - { hp: {amount, target, type}, mana: {amount, target}, limit: {amount, target} }
     */
    function showSequential(changes) {
        var queue = [];
        var delay = config.statChangeDelay;

        // Build queue in order: HP, Mana, LB
        if (changes.hp && changes.hp.amount !== 0) {
            queue.push({ type: 'damage', data: changes.hp });
        }
        if (changes.mana && changes.mana.amount !== 0) {
            queue.push({ type: 'stat', statType: 'mana', data: changes.mana });
        }
        if (changes.limit && changes.limit.amount !== 0) {
            queue.push({ type: 'stat', statType: 'limit', data: changes.limit });
        }

        // Show each change with a delay
        queue.forEach(function(item, index) {
            setTimeout(function() {
                if (item.type === 'damage') {
                    show(item.data.amount, item.data.target, item.data.damageType || 'heal');
                } else {
                    showStatChange(item.statType, item.data.amount, item.data.target);
                }
            }, index * delay);
        });
    }

    // === Public API ===
    return {
        init: init,
        show: show,
        showStatChange: showStatChange,
        showSequential: showSequential,
        config: config
    };
})();
