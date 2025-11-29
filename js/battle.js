/**
 * Andi VN - Battle System Module
 *
 * Pokemon-style turn-based combat with D&D d20 attack rolls.
 * Features:
 *   - Turn-based: Player action → Enemy action → Repeat
 *   - D20 attack rolls vs AC
 *   - Mana system for special moves
 *   - Type advantages (vulnerabilities/resistances)
 *   - Custom battle UI with attack animations
 *
 * Usage:
 *   BattleEngine.init(vnEngine);
 *   BattleEngine.start(battleConfig, sceneId);
 */

var BattleEngine = (function() {
    'use strict';

    // === Type System (D&D-style) ===
    // Types: physical, fire, ice, lightning, poison, psychic, holy, dark
    var typeChart = {
        physical: { /* neutral to all */ },
        fire: { ice: 2, fire: 0.5 },
        ice: { fire: 0.5, lightning: 2, ice: 0.5 },
        lightning: { ice: 0.5, lightning: 0.5 },
        poison: { poison: 0.5, psychic: 2 },
        psychic: { psychic: 0.5, dark: 0 },
        holy: { dark: 2, holy: 0.5 },
        dark: { holy: 0.5, psychic: 2, dark: 0.5 }
    };

    // === State ===
    var state = {
        active: false,
        phase: 'player', // 'player', 'enemy', 'animating', 'ended'
        turn: 0,
        player: {
            name: 'Andy',
            hp: 20,
            maxHP: 20,
            mana: 10,
            maxMana: 10,
            ac: 10,           // Armor Class (to be hit)
            attackBonus: 2,   // Added to d20 roll
            damage: '1d6',    // Damage dice
            type: 'physical',
            defending: false
        },
        enemy: {
            name: 'Enemy',
            hp: 20,
            maxHP: 20,
            ac: 12,
            attackBonus: 3,
            damage: '1d6',
            type: 'physical',
            sprite: null,
            moves: []
        },
        targets: {
            win: null,
            lose: null,
            flee: null
        },
        currentScene: null
    };

    // Reference to main VN engine
    var vnEngine = null;

    // DOM elements cache
    var elements = {
        container: null,
        battleUI: null,
        playerHP: null,
        playerHPBar: null,
        playerHPText: null,
        playerMana: null,
        playerManaBar: null,
        playerManaText: null,
        enemyHP: null,
        enemyHPBar: null,
        enemyHPText: null,
        enemyLabel: null,
        battleLog: null,
        textBox: null
    };

    // === Initialization ===

    function init(engine) {
        vnEngine = engine;
        elements.container = document.getElementById('vn-container');
        elements.textBox = document.getElementById('text-box');
    }

    // === Dice Rolling ===

    /**
     * Roll a d20
     * @returns {number} - 1-20
     */
    function rollD20() {
        return Math.floor(Math.random() * 20) + 1;
    }

    /**
     * Roll damage dice (e.g., '1d6', '2d8+2')
     * @param {string} diceStr - Dice notation
     * @returns {number} - Total damage
     */
    function rollDamage(diceStr) {
        if (typeof diceStr === 'number') return diceStr;

        var match = diceStr.match(/(\d*)d(\d+)([+-]\d+)?/i);
        if (!match) return 1;

        var numDice = parseInt(match[1], 10) || 1;
        var sides = parseInt(match[2], 10);
        var modifier = parseInt(match[3], 10) || 0;

        var total = modifier;
        for (var i = 0; i < numDice; i++) {
            total += Math.floor(Math.random() * sides) + 1;
        }
        return Math.max(1, total);
    }

    // === Type Effectiveness ===

    function getTypeMultiplier(attackType, defenderType) {
        if (!attackType || !defenderType) return 1;
        var chart = typeChart[attackType];
        if (!chart) return 1;
        return chart[defenderType] !== undefined ? chart[defenderType] : 1;
    }

    function getEffectivenessMessage(multiplier) {
        if (multiplier >= 2) return "It's super effective!";
        if (multiplier === 0) return "It has no effect...";
        if (multiplier <= 0.5) return "It's not very effective...";
        return '';
    }

    // === Attack Resolution ===

    /**
     * Resolve an attack with d20 roll
     * @param {object} attacker - Attacker stats
     * @param {object} defender - Defender stats
     * @param {object} move - Move being used { name, damage, type, attackBonus }
     * @returns {object} - { hit, roll, damage, isCrit, isFumble, multiplier, message }
     */
    function resolveAttack(attacker, defender, move) {
        var roll = rollD20();
        var attackBonus = (move && move.attackBonus !== undefined) ? move.attackBonus : attacker.attackBonus;
        var attackTotal = roll + attackBonus;

        var isCrit = roll === 20;
        var isFumble = roll === 1;
        var targetAC = defender.ac + (defender.defending ? 4 : 0);
        var hit = isCrit || (!isFumble && attackTotal >= targetAC);

        var result = {
            hit: hit,
            roll: roll,
            total: attackTotal,
            targetAC: targetAC,
            isCrit: isCrit,
            isFumble: isFumble,
            damage: 0,
            multiplier: 1,
            message: ''
        };

        if (hit) {
            // Roll damage
            var damageStr = (move && move.damage) ? move.damage : attacker.damage;
            result.damage = rollDamage(damageStr);

            // Apply type effectiveness
            var attackType = (move && move.type) ? move.type : 'physical';
            result.multiplier = getTypeMultiplier(attackType, defender.type);
            result.damage = Math.floor(result.damage * result.multiplier);

            // Critical hit doubles damage
            if (isCrit) {
                result.damage *= 2;
            }

            result.damage = Math.max(1, result.damage);
            result.message = getEffectivenessMessage(result.multiplier);
        }

        return result;
    }

    // === Battle Start/End ===

    function start(battleConfig, sceneId) {
        var enemy = battleConfig.enemy || {};

        // Initialize player stats
        if (state.player.hp === null || state.player.hp <= 0) {
            state.player.maxHP = battleConfig.player_max_hp || 20;
            state.player.hp = state.player.maxHP;
        }
        if (state.player.mana === null) {
            state.player.maxMana = battleConfig.player_max_mana || 10;
            state.player.mana = state.player.maxMana;
        }

        state.player.ac = battleConfig.player_ac || 10;
        state.player.attackBonus = battleConfig.player_attack_bonus || 2;
        state.player.damage = battleConfig.player_damage || '1d6';
        state.player.type = battleConfig.player_type || 'physical';
        state.player.defending = false;

        // Set enemy stats
        state.enemy = {
            name: enemy.name || 'Enemy',
            hp: enemy.hp || 20,
            maxHP: enemy.hp || 20,
            ac: enemy.ac || 12,
            attackBonus: enemy.attack_bonus || 3,
            damage: enemy.damage || '1d6',
            type: enemy.type || 'physical',
            sprite: enemy.sprite || null,
            moves: enemy.moves || [
                { name: 'Attack', damage: '1d6', type: 'physical' }
            ]
        };

        // Set targets
        state.targets = {
            win: battleConfig.win_target,
            lose: battleConfig.lose_target,
            flee: battleConfig.flee_target || null
        };

        state.currentScene = sceneId;
        state.active = true;
        state.phase = 'player';
        state.turn = 1;

        // Show battle UI
        showUI();
        updateDisplay();

        return state;
    }

    function end(result) {
        state.active = false;
        state.phase = 'ended';

        var target = null;
        var message = '';

        switch (result) {
            case 'win':
                target = state.targets.win;
                message = '<div class="battle-result victory">Victory!</div>';
                playSfx('victory.ogg');
                break;
            case 'lose':
                target = state.targets.lose;
                message = '<div class="battle-result defeat">Defeated!</div>';
                playSfx('failure.ogg');
                break;
            case 'flee':
                target = state.targets.flee;
                message = '<div class="battle-result">Got away safely!</div>';
                break;
        }

        // Delay transition to show result
        setTimeout(function() {
            hideUI();
            showTextBox(); // Restore text box
            if (target && vnEngine && vnEngine.loadScene) {
                vnEngine.loadScene(target, message);
            }
        }, 1500);
    }

    function reset() {
        state.active = false;
        state.phase = 'player';
        state.turn = 0;
        state.player.hp = null;
        state.player.mana = null;
        state.player.defending = false;
        state.enemy = {
            name: 'Enemy',
            hp: 20,
            maxHP: 20,
            ac: 12,
            attackBonus: 3,
            damage: '1d6',
            type: 'physical',
            sprite: null,
            moves: []
        };
        hideUI();
        destroyUI();
        showTextBox();
    }

    // === UI Management ===

    function hideTextBox() {
        if (!elements.textBox) {
            elements.textBox = document.getElementById('text-box');
        }
        if (elements.textBox) {
            elements.textBox.classList.add('battle-mode');
        }
    }

    function showTextBox() {
        if (!elements.textBox) {
            elements.textBox = document.getElementById('text-box');
        }
        if (elements.textBox) {
            elements.textBox.classList.remove('battle-mode');
        }
    }

    function showUI() {
        if (!elements.container) {
            elements.container = document.getElementById('vn-container');
        }
        if (!elements.container) return;

        // Hide normal text box during battle
        hideTextBox();

        // Create battle UI container
        if (!document.getElementById('battle-ui')) {
            var battleUI = document.createElement('div');
            battleUI.id = 'battle-ui';
            battleUI.className = 'battle-ui';

            // Player HP bar (bottom left)
            var playerHP = document.createElement('div');
            playerHP.id = 'player-hp-container';
            playerHP.className = 'hp-container player-hp battle-hp';
            playerHP.innerHTML =
                '<div class="hp-label">' + state.player.name + '</div>' +
                '<div class="hp-bar"><div id="player-hp-bar" class="hp-fill hp-high"></div></div>' +
                '<div id="player-hp-text" class="hp-text"></div>';

            // Player Mana bar (below HP)
            var playerMana = document.createElement('div');
            playerMana.id = 'player-mana-container';
            playerMana.className = 'mana-container player-mana battle-mana';
            playerMana.innerHTML =
                '<div class="mana-label">MP</div>' +
                '<div class="mana-bar"><div id="player-mana-bar" class="mana-fill"></div></div>' +
                '<div id="player-mana-text" class="mana-text"></div>';

            // Enemy HP bar (top right)
            var enemyHP = document.createElement('div');
            enemyHP.id = 'enemy-hp-container';
            enemyHP.className = 'hp-container enemy-hp battle-hp';
            enemyHP.innerHTML =
                '<div id="enemy-hp-label" class="hp-label">' + state.enemy.name + '</div>' +
                '<div class="hp-bar"><div id="enemy-hp-bar" class="hp-fill hp-high"></div></div>' +
                '<div id="enemy-hp-text" class="hp-text"></div>';

            // Battle log panel (bottom, replaces text box)
            var battleLog = document.createElement('div');
            battleLog.id = 'battle-log-panel';
            battleLog.className = 'battle-log-panel';
            battleLog.innerHTML =
                '<div id="battle-log-content" class="battle-log-content"></div>' +
                '<div id="battle-choices" class="battle-choices"></div>';

            battleUI.appendChild(playerHP);
            battleUI.appendChild(playerMana);
            battleUI.appendChild(enemyHP);
            battleUI.appendChild(battleLog);
            elements.container.appendChild(battleUI);
        }

        // Cache references
        cacheElements();

        // Show UI
        if (elements.battleUI) elements.battleUI.style.display = 'block';
        if (elements.playerHP) elements.playerHP.style.display = 'block';
        if (elements.playerMana) elements.playerMana.style.display = 'block';
        if (elements.enemyHP) elements.enemyHP.style.display = 'block';
    }

    function cacheElements() {
        elements.battleUI = document.getElementById('battle-ui');
        elements.playerHP = document.getElementById('player-hp-container');
        elements.playerHPBar = document.getElementById('player-hp-bar');
        elements.playerHPText = document.getElementById('player-hp-text');
        elements.playerMana = document.getElementById('player-mana-container');
        elements.playerManaBar = document.getElementById('player-mana-bar');
        elements.playerManaText = document.getElementById('player-mana-text');
        elements.enemyHP = document.getElementById('enemy-hp-container');
        elements.enemyHPBar = document.getElementById('enemy-hp-bar');
        elements.enemyHPText = document.getElementById('enemy-hp-text');
        elements.enemyLabel = document.getElementById('enemy-hp-label');
        elements.battleLog = document.getElementById('battle-log-content');
    }

    function hideUI() {
        if (elements.battleUI) elements.battleUI.style.display = 'none';
        if (elements.playerHP) elements.playerHP.style.display = 'none';
        if (elements.playerMana) elements.playerMana.style.display = 'none';
        if (elements.enemyHP) elements.enemyHP.style.display = 'none';
    }

    function destroyUI() {
        var battleUI = document.getElementById('battle-ui');
        if (battleUI && battleUI.parentNode) {
            battleUI.parentNode.removeChild(battleUI);
        }
        elements.battleUI = null;
        elements.playerHP = null;
        elements.playerMana = null;
        elements.enemyHP = null;
        elements.battleLog = null;
    }

    function updateDisplay() {
        updatePlayerHPDisplay();
        updatePlayerManaDisplay();
        updateEnemyHPDisplay();
    }

    function updatePlayerHPDisplay() {
        if (!elements.playerHPBar || !elements.playerHPText) {
            cacheElements();
        }
        if (!elements.playerHPBar || !elements.playerHPText) return;

        var percent = (state.player.hp / state.player.maxHP) * 100;
        elements.playerHPBar.style.width = percent + '%';
        elements.playerHPText.textContent = state.player.hp + ' / ' + state.player.maxHP;

        elements.playerHPBar.className = 'hp-fill ' +
            (percent > 50 ? 'hp-high' : percent > 25 ? 'hp-medium' : 'hp-low');
    }

    function updatePlayerManaDisplay() {
        if (!elements.playerManaBar || !elements.playerManaText) {
            cacheElements();
        }
        if (!elements.playerManaBar || !elements.playerManaText) return;

        var percent = (state.player.mana / state.player.maxMana) * 100;
        elements.playerManaBar.style.width = percent + '%';
        elements.playerManaText.textContent = state.player.mana + ' / ' + state.player.maxMana;
    }

    function updateEnemyHPDisplay() {
        if (!elements.enemyHPBar || !elements.enemyHPText) {
            cacheElements();
        }
        if (!elements.enemyHPBar || !elements.enemyHPText) return;

        if (elements.enemyLabel) {
            elements.enemyLabel.textContent = state.enemy.name;
        }

        var percent = (state.enemy.hp / state.enemy.maxHP) * 100;
        elements.enemyHPBar.style.width = percent + '%';
        elements.enemyHPText.textContent = state.enemy.hp + ' / ' + state.enemy.maxHP;

        elements.enemyHPBar.className = 'hp-fill ' +
            (percent > 50 ? 'hp-high' : percent > 25 ? 'hp-medium' : 'hp-low');
    }

    function updateBattleLog(html) {
        if (!elements.battleLog) {
            elements.battleLog = document.getElementById('battle-log-content');
        }
        if (elements.battleLog) {
            elements.battleLog.innerHTML = html;
        }
    }

    // === Visual Effects ===

    /**
     * Play attack animation on enemy sprite
     */
    function playAttackAnimation(type) {
        var spriteLayer = document.getElementById('sprite-layer');
        if (!spriteLayer) return;

        // Create attack effect overlay
        var effect = document.createElement('div');
        effect.className = 'attack-effect attack-' + (type || 'physical');
        elements.container.appendChild(effect);

        // Remove after animation
        setTimeout(function() {
            if (effect.parentNode) {
                effect.parentNode.removeChild(effect);
            }
        }, 600);
    }

    /**
     * Flash enemy sprite when hit
     */
    function flashEnemy() {
        var spriteLayer = document.getElementById('sprite-layer');
        if (!spriteLayer) return;

        var sprites = spriteLayer.querySelectorAll('img');
        sprites.forEach(function(sprite) {
            sprite.classList.add('damage-flash');
            setTimeout(function() {
                sprite.classList.remove('damage-flash');
            }, 300);
        });
    }

    /**
     * Shake the screen when player is hit
     */
    function shakeScreen() {
        if (elements.container) {
            elements.container.classList.add('screen-shake');
            setTimeout(function() {
                elements.container.classList.remove('screen-shake');
            }, 300);
        }
    }

    /**
     * Show floating damage number
     */
    function showDamageNumber(amount, target, type) {
        var container = document.getElementById(target + '-hp-container');
        if (!container) container = elements.container;
        if (!container) return;

        var damageNum = document.createElement('div');
        damageNum.className = 'battle-damage-number ' + type;
        damageNum.textContent = type === 'heal' ? '+' + amount : '-' + amount;

        container.appendChild(damageNum);

        setTimeout(function() {
            if (damageNum.parentNode) {
                damageNum.parentNode.removeChild(damageNum);
            }
        }, 1500);
    }

    // === Player Actions ===

    function playerAttack(move) {
        if (!state.active || state.phase !== 'player') return null;

        // Check mana cost
        var manaCost = (move && move.manaCost) || 0;
        if (state.player.mana < manaCost) {
            return { success: false, reason: 'not_enough_mana' };
        }

        state.phase = 'animating';

        // Spend mana
        if (manaCost > 0) {
            state.player.mana -= manaCost;
            updatePlayerManaDisplay();
        }

        // Resolve attack with d20
        var result = resolveAttack(state.player, state.enemy, move);

        // Play attack animation
        playAttackAnimation(move ? move.type : 'physical');
        playSfx('dice_roll.ogg');

        if (result.hit) {
            // Apply damage after short delay (for animation)
            setTimeout(function() {
                state.enemy.hp = Math.max(0, state.enemy.hp - result.damage);
                updateEnemyHPDisplay();
                flashEnemy();
                showDamageNumber(result.damage, 'enemy', 'damage');
                playSfx('thud.ogg');
            }, 300);
        }

        return {
            success: true,
            move: move || { name: 'Attack' },
            hit: result.hit,
            roll: result.roll,
            total: result.total,
            targetAC: result.targetAC,
            damage: result.damage,
            isCrit: result.isCrit,
            isFumble: result.isFumble,
            multiplier: result.multiplier,
            message: result.message
        };
    }

    function playerItem(item) {
        if (!state.active || state.phase !== 'player') return null;

        state.phase = 'animating';
        var messages = [];

        if (item.heals) {
            var healAmount = item.heals;
            state.player.hp = Math.min(state.player.maxHP, state.player.hp + healAmount);
            updatePlayerHPDisplay();
            showDamageNumber(healAmount, 'player', 'heal');
            messages.push('Restored ' + healAmount + ' HP!');
            playSfx('success.ogg');
        }

        if (item.restoresMana) {
            state.player.mana = Math.min(state.player.maxMana, state.player.mana + item.restoresMana);
            updatePlayerManaDisplay();
            messages.push('Restored ' + item.restoresMana + ' MP!');
        }

        return {
            success: true,
            message: messages.join(' ')
        };
    }

    function playerDefend() {
        if (!state.active || state.phase !== 'player') return null;

        state.phase = 'animating';
        state.player.defending = true;

        return {
            success: true,
            message: state.player.name + ' is defending! (+4 AC)'
        };
    }

    function playerFlee() {
        if (!state.active || state.phase !== 'player') return null;

        if (!state.targets.flee) {
            return { success: false, reason: 'cannot_flee' };
        }

        state.phase = 'animating';

        // Roll d20, need 10+ to escape
        var roll = rollD20();
        var success = roll >= 10;

        if (success) {
            end('flee');
            return { success: true, roll: roll };
        }

        return { success: false, reason: 'failed', roll: roll };
    }

    // === Enemy Turn ===

    function enemyTurn() {
        if (!state.active) return null;

        state.phase = 'enemy';

        // Pick a random move
        var move = state.enemy.moves[Math.floor(Math.random() * state.enemy.moves.length)];
        if (!move) {
            move = { name: 'Attack', damage: '1d6', type: 'physical' };
        }

        // Resolve attack with d20
        var result = resolveAttack(state.enemy, state.player, move);

        if (result.hit) {
            // Apply damage and effects
            state.player.hp = Math.max(0, state.player.hp - result.damage);
            updatePlayerHPDisplay();
            shakeScreen();
            showDamageNumber(result.damage, 'player', 'damage');
            playSfx('thud.ogg');
        }

        // Reset defending after enemy turn
        state.player.defending = false;

        return {
            move: move,
            hit: result.hit,
            roll: result.roll,
            total: result.total,
            targetAC: result.targetAC,
            damage: result.damage,
            isCrit: result.isCrit,
            isFumble: result.isFumble,
            multiplier: result.multiplier,
            message: result.message
        };
    }

    // === Battle Flow ===

    function checkBattleEnd() {
        if (!state.active) return false;

        if (state.enemy.hp <= 0) {
            end('win');
            return true;
        }

        if (state.player.hp <= 0) {
            end('lose');
            return true;
        }

        return false;
    }

    function formatRollMessage(name, result, moveName) {
        var html = '<div class="battle-log' + (result.isCrit ? ' crit' : result.isFumble ? ' fumble' : '') + '">';
        html += '<span class="roll-result">' + name + ' rolled <strong>' + result.roll + '</strong>';
        if (result.roll !== result.total) {
            html += ' + ' + (result.total - result.roll) + ' = <strong>' + result.total + '</strong>';
        }
        html += ' vs AC ' + result.targetAC + '</span>';

        if (result.isCrit) {
            html += ' <span class="crit-text">CRITICAL HIT!</span>';
        } else if (result.isFumble) {
            html += ' <span class="fumble-text">FUMBLE!</span>';
        }

        if (result.hit) {
            html += '<br>' + moveName + ' deals <strong>' + result.damage + '</strong> damage!';
            if (result.message) {
                html += ' ' + result.message;
            }
        } else {
            html += '<br>' + moveName + ' missed!';
        }

        html += '</div>';
        return html;
    }

    /**
     * Execute a complete turn
     */
    function executeAction(action, params, callback) {
        if (!state.active || state.phase !== 'player') return;

        var playerResultText = '';
        var playerResult = null;

        // === PLAYER TURN ===
        switch (action) {
            case 'attack':
            case 'spell':
                var move = params.move || params.spell || { name: 'Attack', damage: '1d6', type: 'physical' };
                playerResult = playerAttack(move);

                if (!playerResult.success) {
                    if (playerResult.reason === 'not_enough_mana') {
                        playerResultText = '<div class="battle-log">Not enough MP!</div>';
                        state.phase = 'player';
                        updateBattleLog(playerResultText);
                        if (callback) callback(playerResultText);
                        return;
                    }
                }

                playerResultText = formatRollMessage(state.player.name, playerResult, move.name || 'Attack');
                break;

            case 'item':
                playerResult = playerItem(params);
                playerResultText = '<div class="battle-log">' + state.player.name + ' used an item! ' + playerResult.message + '</div>';
                break;

            case 'defend':
                playerResult = playerDefend();
                playerResultText = '<div class="battle-log">' + playerResult.message + '</div>';
                break;

            case 'flee':
                playerResult = playerFlee();
                if (playerResult.success) {
                    return; // Battle ended
                }
                playerResultText = '<div class="battle-log">Tried to flee (rolled ' + playerResult.roll + ')... Couldn\'t escape!</div>';
                break;

            default:
                playerResult = playerAttack({ name: 'Attack', damage: '1d6', type: 'physical' });
                playerResultText = formatRollMessage(state.player.name, playerResult, 'Attack');
        }

        updateBattleLog(playerResultText);

        // Check if player won
        setTimeout(function() {
            if (checkBattleEnd()) return;

            // === ENEMY TURN ===
            setTimeout(function() {
                if (!state.active) return;

                var enemyResult = enemyTurn();
                var enemyText = formatRollMessage(state.enemy.name, enemyResult, enemyResult.move.name || 'Attack');
                enemyText = enemyText.replace('battle-log', 'battle-log enemy-turn');

                updateBattleLog(playerResultText + enemyText);

                // Check if enemy won
                if (checkBattleEnd()) return;

                // Next turn
                state.phase = 'player';
                state.turn++;

                if (callback) {
                    callback(playerResultText + enemyText);
                }
            }, 600);
        }, 400);
    }

    // === Utility ===

    function playSfx(filename) {
        if (vnEngine && vnEngine.playSfx) {
            vnEngine.playSfx(filename);
        }
    }

    function isActive() {
        return state.active;
    }

    function getState() {
        return JSON.parse(JSON.stringify(state));
    }

    function setState(newState) {
        state = JSON.parse(JSON.stringify(newState));
        if (state.active) {
            showUI();
            updateDisplay();
        }
    }

    function getPlayerStats() {
        return {
            hp: state.player.hp,
            maxHP: state.player.maxHP,
            mana: state.player.mana,
            maxMana: state.player.maxMana
        };
    }

    function healPlayer(amount) {
        state.player.hp = Math.min(state.player.maxHP, state.player.hp + amount);
        if (state.active) {
            updatePlayerHPDisplay();
            showDamageNumber(amount, 'player', 'heal');
        }
    }

    function restoreMana(amount) {
        state.player.mana = Math.min(state.player.maxMana, state.player.mana + amount);
        if (state.active) updatePlayerManaDisplay();
    }

    function checkEnd() {
        return checkBattleEnd();
    }

    // === Public API ===
    return {
        init: init,
        start: start,
        end: end,
        reset: reset,
        hideUI: hideUI,
        destroyUI: destroyUI,
        showUI: showUI,
        updateDisplay: updateDisplay,
        executeAction: executeAction,
        healPlayer: healPlayer,
        restoreMana: restoreMana,
        isActive: isActive,
        getState: getState,
        setState: setState,
        getPlayerStats: getPlayerStats,
        checkEnd: checkEnd,
        getTypeChart: function() { return typeChart; }
    };
})();
