/**
 * Andi VN - Engine
 *
 * Generic visual novel engine that loads and renders story scenes.
 * No story text or narrative-specific code should be placed here.
 *
 * Dependencies:
 * - story: global object from story.js (generated)
 *
 * Features:
 * - Scene-based story rendering with multiple text blocks
 * - "Continue" button for text block progression
 * - Choice handling at end of scenes
 * - Action system with handler registry (dice rolls, etc.)
 * - Flag management
 * - Background and character sprite loading
 * - Typewriter text effect with speed controls
 */

const VNEngine = (function() {
    'use strict';

    // === Configuration ===
    // Many values now sourced from TUNING.js for centralized game feel tuning
    const config = {
        assetPaths: {
            bg: 'assets/bg/',
            char: 'assets/char/',
            music: 'assets/music/',
            sfx: 'assets/sfx/'
        },
        // Fallback assets for when loading fails
        fallbackAssets: {
            bg: 'assets/bg/fallback.svg',
            char: 'assets/char/fallback.svg'
            // No fallback for audio - silence is fine
        },
        startScene: 'start',
        defaultMusic: 'default.mp3',
        // Text speed values from TUNING (with fallbacks)
        textSpeed: typeof TUNING !== 'undefined' ? TUNING.text.speed : {
            normal: 18,
            fast: 10,
            auto: 18,
            skip: 0
        },
        autoDelay: typeof TUNING !== 'undefined' ? TUNING.text.autoAdvanceDelay : 1500,
        skipModeDelay: typeof TUNING !== 'undefined' ? TUNING.text.skipModeDelay : 150,
        currentSpeed: 'normal',
        // localStorage keys
        saveKey: 'andi_vn_save',
        themeKey: 'andi_vn_theme',
        kenBurnsKey: 'andi_vn_ken_burns',
        // Audio timing from TUNING
        sfxPreDelay: typeof TUNING !== 'undefined' ? TUNING.audio.sfxPreDelay : 150,
        sfxPostDelay: typeof TUNING !== 'undefined' ? TUNING.audio.sfxPostDelay : 200,
        sfxMinDuration: typeof TUNING !== 'undefined' ? TUNING.audio.sfxMinDuration : 620,
        sfxRepeatGap: typeof TUNING !== 'undefined' ? TUNING.audio.sfxRepeatGap : 150,
        sfxDuckVolume: typeof TUNING !== 'undefined' ? TUNING.audio.duckVolume : 0.2,
        // Text block splitting from TUNING
        maxBlockLength: typeof TUNING !== 'undefined' ? TUNING.text.maxBlockLength : 350,
        // UI timing from TUNING
        timing: {
            errorFlash: typeof TUNING !== 'undefined' ? TUNING.ui.errorFlash : 300,
            damageNumber: typeof TUNING !== 'undefined' ? TUNING.ui.damageNumberDuration : 1500,
            spriteFlash: typeof TUNING !== 'undefined' ? TUNING.battle.effects.spriteFlash : 300
        }
    };

    // === Logging Utilities ===
    // Standardized logging with consistent prefixes
    var log = {
        info: function(msg) {
            console.log('VNEngine: ' + msg);
        },
        warn: function(msg) {
            console.warn('VNEngine: ' + msg);
        },
        error: function(msg) {
            console.error('VNEngine: ' + msg);
        },
        debug: function(msg) {
            if (state.devMode) {
                console.log('VNEngine [DEBUG]: ' + msg);
            }
        }
    };

    // === Touch Device Detection ===
    // Detect if the device primarily uses touch input
    function isTouchDevice() {
        return ('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0) ||
               (navigator.msMaxTouchPoints > 0) ||
               (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
    }

    // === State ===
    const state = {
        currentSceneId: null,
        currentBlockIndex: 0,
        flags: {},
        inventory: [], // item names the player has collected
        playerHP: null, // player HP (null until first battle)
        playerMaxHP: typeof TUNING !== 'undefined' ? TUNING.player.defaultMaxHP : 20,
        battle: null, // active battle state
        history: [],
        readBlocks: {}, // tracks which scene+block combos have been read
        typewriter: {
            isTyping: false,
            timeoutId: null,
            autoAdvanceId: null,
            segments: null,
            currentSegment: 0,
            currentChar: 0,
            element: null,
            renderedHTML: '',
            onComplete: null,
            canSkip: false
        },
        audio: {
            currentMusic: null,  // filename of currently playing music
            muted: false,
            volume: 0.16
        },
        devMode: true,  // TODO: Set to false before release
        devKeysHeld: {},
        devForcedRoll: null,  // Dev mode: force next dice roll to this value (null = random)
        kenBurns: false,  // Subtle zoom effect on backgrounds (Apple-style)
        currentBackground: null  // Track current background to avoid Ken Burns reset on same bg
    };

    // === Action Handler Registry ===
    const actionHandlers = {
        /**
         * Roll dice action handler
         * Rolls specified dice, compares to threshold, navigates to success/failure scene
         *
         * Supports:
         * - modifier: 'advantage' (roll 2, take highest) or 'disadvantage' (roll 2, take lowest)
         * - skill: Display name for the check (e.g., "Persuasion Check")
         * - crit_text: Custom text shown on natural 20 (d20 only)
         * - fumble_text: Custom text shown on natural 1 (d20 only)
         */
        roll_dice: function(action) {
            var diceType = action.dice || 'd20';
            var threshold = action.threshold || 10;
            var successTarget = action.success_target;
            var failureTarget = action.failure_target;
            var modifier = action.modifier || 'normal';
            var skillName = action.skill || null;
            var critText = action.crit_text || null;
            var fumbleText = action.fumble_text || null;

            // Parse dice type (e.g., 'd20' -> 20 sides)
            var sides = 20;
            var match = diceType.match(/d(\d+)/i);
            if (match) {
                sides = parseInt(match[1], 10);
            }

            // Roll the dice (with advantage/disadvantage support)
            // Dev mode: use forced roll if set
            var forcedRoll = state.devForcedRoll;
            var roll1, roll2;
            if (state.devMode && forcedRoll !== null && forcedRoll >= 1 && forcedRoll <= sides) {
                roll1 = forcedRoll;
                roll2 = forcedRoll;
                log.debug('Using forced dice roll: ' + forcedRoll);
            } else {
                roll1 = Math.floor(Math.random() * sides) + 1;
                roll2 = Math.floor(Math.random() * sides) + 1;
            }
            var result, rollDescription;

            if (modifier === 'advantage') {
                result = Math.max(roll1, roll2);
                rollDescription = 'with advantage (' + roll1 + ', ' + roll2 + ')';
            } else if (modifier === 'disadvantage') {
                result = Math.min(roll1, roll2);
                rollDescription = 'with disadvantage (' + roll1 + ', ' + roll2 + ')';
            } else {
                result = roll1;
                rollDescription = '';
            }

            var success = result <= threshold;

            // Check for critical hit/fumble (d20 only)
            var isCrit = (sides === 20 && result === 20);
            var isFumble = (sides === 20 && result === 1);

            // Override success/failure for crits and fumbles
            if (isCrit) success = true;
            if (isFumble) success = false;

            // Build result display
            var skillLabel = skillName ? '<div class="skill-check-label">' + skillName + ' Check</div>' : '';
            var resultClass = success ? 'dice-success' : 'dice-failure';
            var critClass = isCrit ? ' dice-crit' : (isFumble ? ' dice-fumble' : '');

            var resultText = '<div class="dice-roll ' + resultClass + critClass + '">';
            resultText += skillLabel;
            resultText += 'You rolled a ' + diceType;
            if (rollDescription) {
                resultText += ' ' + rollDescription;
            }
            resultText += ' and got: <span class="battle-number">' + result + '</span>!';

            // Add crit/fumble text
            if (isCrit && critText) {
                resultText += '<div class="crit-text">' + critText + '</div>';
            } else if (isFumble && fumbleText) {
                resultText += '<div class="fumble-text">' + fumbleText + '</div>';
            } else if (isCrit) {
                resultText += '<div class="crit-text">CRITICAL SUCCESS!</div>';
            } else if (isFumble) {
                resultText += '<div class="fumble-text">CRITICAL FAILURE!</div>';
            }

            resultText += '</div>';

            // Play appropriate SFX
            if (isCrit) {
                playSfx('success.ogg');
            } else if (isFumble) {
                playSfx('failure.ogg');
            } else {
                playSfx('dice_roll.ogg');
            }

            // Navigate to appropriate scene
            if (success) {
                loadScene(successTarget, resultText);
            } else {
                loadScene(failureTarget, resultText);
            }
        },

        /**
         * Play sound effect action handler
         * Plays a one-shot sound effect
         */
        play_sfx: function(action) {
            var file = action.file;
            if (file) {
                playSfx(file);
            }
        },

        /**
         * Custom action handler for extensibility
         * Calls named handler functions with params
         */
        custom: function(action) {
            var handlerName = action.handler;
            var params = action.params || {};

            if (typeof window[handlerName] === 'function') {
                window[handlerName](params, state);
            } else {
                log.warn('Custom handler not found: ' + handlerName);
            }
        },

        /**
         * Start a battle encounter
         * Delegates to BattleEngine module
         */
        start_battle: function(action) {
            // Initialize BattleEngine if not done yet
            if (typeof BattleEngine !== 'undefined' && !BattleEngine.isInitialized()) {
                BattleEngine.init({
                    loadScene: loadScene,
                    playSfx: playSfx,
                    getInventory: function() { return state.inventory.slice(); },
                    hasItem: hasItem,
                    removeItem: function(item) { removeItems([item]); }
                });
                // Set up forced roll callback for dev mode
                BattleEngine.setForcedRollCallback(function() {
                    return state.devMode ? state.devForcedRoll : null;
                });
            }

            // Start battle using the module
            if (typeof BattleEngine !== 'undefined') {
                var battleState = BattleEngine.start(action, state.currentSceneId);
                // Sync player HP with engine state for saving
                state.playerHP = battleState.player.hp;
                state.playerMaxHP = battleState.player.maxHP;
                state.battle = { active: true }; // Flag for engine to know battle is active

                // Register callback for when battle UI is ready (after intro animation)
                battleState.onBattleReady = function() {
                    // Show battle choices in the battle UI panel (not normal choices container)
                    var scene = story[state.currentSceneId];
                    if (scene && scene.choices) {
                        renderBattleChoices(scene.choices);
                    }
                };
            } else {
                log.error('BattleEngine module not loaded');
            }
        }
    };

    // === Battle System ===
    /**
     * Show the battle UI elements (HP bars)
     */
    function showBattleUI() {
        var container = document.getElementById('vn-container');
        if (!container) return;

        // Create player HP bar if not exists
        if (!document.getElementById('player-hp-container')) {
            var playerHP = document.createElement('div');
            playerHP.id = 'player-hp-container';
            playerHP.className = 'hp-container player-hp';
            playerHP.innerHTML = '<div class="hp-label">You</div>' +
                '<div class="hp-bar"><div id="player-hp-bar" class="hp-fill hp-high"></div></div>' +
                '<div id="player-hp-text" class="hp-text"></div>';
            container.appendChild(playerHP);
        }

        // Create enemy HP bar if not exists
        if (!document.getElementById('enemy-hp-container')) {
            var enemyHP = document.createElement('div');
            enemyHP.id = 'enemy-hp-container';
            enemyHP.className = 'hp-container enemy-hp';
            enemyHP.innerHTML = '<div id="enemy-hp-label" class="hp-label">Enemy</div>' +
                '<div class="hp-bar"><div id="enemy-hp-bar" class="hp-fill hp-high"></div></div>' +
                '<div id="enemy-hp-text" class="hp-text"></div>';
            container.appendChild(enemyHP);
        }

        // Show HP containers
        document.getElementById('player-hp-container').style.display = 'block';
        document.getElementById('enemy-hp-container').style.display = 'block';
    }

    /**
     * Hide the battle UI elements
     */
    function hideBattleUI() {
        var playerHP = document.getElementById('player-hp-container');
        var enemyHP = document.getElementById('enemy-hp-container');
        if (playerHP) playerHP.style.display = 'none';
        if (enemyHP) enemyHP.style.display = 'none';
    }

    /**
     * Update both player and enemy HP displays
     */
    function updateBattleDisplay() {
        updatePlayerHPDisplay();
        updateEnemyHPDisplay();
    }

    /**
     * Update enemy HP bar display
     */
    function updateEnemyHPDisplay() {
        if (!state.battle) return;

        var hpBar = document.getElementById('enemy-hp-bar');
        var hpText = document.getElementById('enemy-hp-text');
        var hpLabel = document.getElementById('enemy-hp-label');

        if (hpLabel) {
            hpLabel.textContent = state.battle.enemy.name;
        }

        if (hpBar) {
            var percent = (state.battle.enemy.hp / state.battle.enemy.maxHP) * 100;
            hpBar.style.width = percent + '%';

            // Color based on health
            if (percent > 50) {
                hpBar.className = 'hp-fill hp-high';
            } else if (percent > 25) {
                hpBar.className = 'hp-fill hp-medium';
            } else {
                hpBar.className = 'hp-fill hp-low';
            }
        }

        if (hpText) {
            hpText.textContent = state.battle.enemy.hp + ' / ' + state.battle.enemy.maxHP;
        }
    }

    /**
     * Roll damage dice (e.g., 'd6', '2d8', 'd10+2')
     * @param {string} diceStr - Dice string like 'd6', '2d8+3'
     * @returns {number} - Total damage rolled
     */
    function rollDamage(diceStr) {
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

    /**
     * Player attacks the enemy
     * @returns {object} - Attack result {hit, damage, crit, fumble}
     */
    function playerAttack() {
        if (!state.battle || !state.battle.active) return null;

        var roll = Math.floor(Math.random() * 20) + 1;
        var attackTotal = roll + state.battle.player.attackBonus;
        var isCrit = roll === 20;
        var isFumble = roll === 1;
        var hit = isCrit || (!isFumble && attackTotal >= state.battle.enemy.ac);

        var result = {
            roll: roll,
            total: attackTotal,
            hit: hit,
            crit: isCrit,
            fumble: isFumble,
            damage: 0
        };

        if (hit) {
            result.damage = rollDamage(state.battle.player.damage);
            if (isCrit) result.damage *= 2; // Critical hit doubles damage

            state.battle.enemy.hp = Math.max(0, state.battle.enemy.hp - result.damage);
            updateEnemyHPDisplay();
            flashEnemySprite();
            showBattleDamageNumber(result.damage, 'enemy', 'damage');

            // Play hit sound
            playSfx('thud.ogg');
        } else {
            // Play miss sound
            playSfx('negative.ogg');
        }

        return result;
    }

    /**
     * Enemy attacks the player
     * @returns {object} - Attack result {hit, damage, crit, fumble}
     */
    function enemyAttack() {
        if (!state.battle || !state.battle.active) return null;

        var roll = Math.floor(Math.random() * 20) + 1;
        var attackTotal = roll + state.battle.enemy.attackBonus;
        var isCrit = roll === 20;
        var isFumble = roll === 1;
        var hit = isCrit || (!isFumble && attackTotal >= state.battle.player.ac);

        var result = {
            roll: roll,
            total: attackTotal,
            hit: hit,
            crit: isCrit,
            fumble: isFumble,
            damage: 0
        };

        if (hit) {
            result.damage = rollDamage(state.battle.enemy.damage);
            if (isCrit) result.damage *= 2;

            state.playerHP = Math.max(0, state.playerHP - result.damage);
            updatePlayerHPDisplay();
            flashSprite('player');
            showBattleDamageNumber(result.damage, 'player', 'damage');

            // Play hit sound
            playSfx('thud.ogg');
        } else {
            playSfx('negative.ogg');
        }

        return result;
    }

    /**
     * Flash enemy sprite red
     */
    function flashEnemySprite() {
        var spriteLayer = elements.spriteLayer;
        if (!spriteLayer) return;

        var sprites = spriteLayer.querySelectorAll('img');
        sprites.forEach(function(sprite) {
            sprite.classList.add('damage-flash');
            setTimeout(function() {
                sprite.classList.remove('damage-flash');
            }, config.timing.spriteFlash);
        });
    }

    /**
     * Show battle damage number (floating above character)
     * @param {number} amount - Damage/heal amount
     * @param {string} target - 'player' or 'enemy'
     * @param {string} type - 'damage' or 'heal'
     */
    function showBattleDamageNumber(amount, target, type) {
        var container = document.getElementById(target + '-hp-container');
        if (!container) {
            container = document.getElementById('vn-container');
        }
        if (!container) return;

        var damageNum = document.createElement('div');
        damageNum.className = 'battle-damage-number ' + type;
        damageNum.textContent = type === 'heal' ? '+' + amount : '-' + amount;

        container.appendChild(damageNum);

        setTimeout(function() {
            if (damageNum.parentNode) {
                damageNum.parentNode.removeChild(damageNum);
            }
        }, config.timing.damageNumber);
    }

    /**
     * Check if battle is over and handle victory/defeat
     * Delegates to BattleEngine module
     * @returns {boolean} - True if battle ended
     */
    function checkBattleEnd() {
        if (typeof BattleEngine !== 'undefined') {
            return BattleEngine.checkEnd();
        }
        return false;
    }

    /**
     * Execute a battle action from a choice
     * Delegates to BattleEngine module
     * @param {string} action - 'attack', 'defend', 'flee', 'item', or 'spell'
     * @param {object} choice - The choice object with additional params
     */
    function executeBattleAction(action, choice) {
        if (typeof BattleEngine === 'undefined' || !BattleEngine.isActive()) return;

        // Execute action through BattleEngine
        BattleEngine.executeAction(action, choice, function(resultText) {
            // Callback after enemy turn - re-render choices for next turn
            var scene = story[state.currentSceneId];
            if (scene && BattleEngine.isActive()) {
                // Remove any skill submenu that might be open
                var existingSubmenu = document.getElementById('skill-submenu');
                if (existingSubmenu) {
                    existingSubmenu.parentNode.removeChild(existingSubmenu);
                }

                // Remove any item submenu that might be open
                var existingItemMenu = document.getElementById('item-submenu');
                if (existingItemMenu) {
                    existingItemMenu.parentNode.removeChild(existingItemMenu);
                }

                // Restore choices container and battle log content display
                var battleChoicesContainer = document.getElementById('battle-choices');
                var battleLogContent = document.getElementById('battle-log-content');
                if (battleChoicesContainer) {
                    battleChoicesContainer.style.display = '';
                }
                if (battleLogContent) {
                    battleLogContent.style.display = '';
                }

                // Note: Battle log is updated by BattleEngine.updateBattleLog()
                // We just need to re-render the choices
                renderBattleChoices(scene.battle_actions || scene.choices);

                // Sync HP state
                var stats = BattleEngine.getPlayerStats();
                state.playerHP = stats.hp;
                state.playerMaxHP = stats.maxHP;
            }
        });
    }

    /**
     * Render battle action choices into the battle UI panel
     * @param {array} choices - Battle choices from scene
     */
    function renderBattleChoices(choices) {
        // Get the battle choices container (inside battle UI)
        var battleChoicesContainer = document.getElementById('battle-choices');
        if (!battleChoicesContainer) {
            log.warn('Battle choices container not found');
            return;
        }

        // Ensure container is visible (may have been hidden by skill submenu)
        battleChoicesContainer.style.display = '';

        battleChoicesContainer.innerHTML = '';

        // Remove any existing skill submenu
        var existingSubmenu = document.getElementById('skill-submenu');
        if (existingSubmenu && existingSubmenu.parentNode) {
            existingSubmenu.parentNode.removeChild(existingSubmenu);
        }

        if (!choices) return;

        // Filter choices by item requirements and items to use
        var availableChoices = choices.filter(function(choice) {
            if (choice.require_items && choice.require_items.length > 0) {
                if (!hasItems(choice.require_items)) return false;
            }
            // Check items that will be consumed (uses) - must have them to show choice
            if (choice.uses && choice.uses.length > 0) {
                if (!hasItems(choice.uses)) return false;
            }
            return true;
        });

        availableChoices.forEach(function(choice) {
            var button = document.createElement('button');
            button.className = 'choice-button battle-action';

            // Determine action type: explicit battle_action, or 'item' if heals, otherwise 'attack'
            var action = choice.battle_action || (choice.heals ? 'item' : 'attack');
            button.setAttribute('data-action', action);

            var labelText = choice.label;
            if (choice.uses && choice.uses.length > 0) {
                labelText += ' [Uses: ' + choice.uses.join(', ') + ']';
            }
            if (choice.heals) {
                labelText += ' [+' + choice.heals + ' HP]';
            }

            // Check defend cooldown
            var isOnCooldown = false;
            if (action === 'defend' && typeof BattleCore !== 'undefined') {
                var player = BattleCore.getPlayer();
                if (player && player.defendCooldown > 0) {
                    isOnCooldown = true;
                    labelText += ' (' + player.defendCooldown + ')';
                    button.classList.add('on-cooldown');
                    button.disabled = true;
                }
            }

            button.textContent = labelText;

            button.onclick = function() {
                // Play SFX if specified
                if (choice.sfx) {
                    playSfx(choice.sfx);
                }

                // Special handling for skill action - show skill menu
                if (action === 'skill') {
                    showSkillSubmenu(battleChoicesContainer, choices);
                    return;
                }

                // Special handling for item action - show item menu
                if (action === 'item') {
                    showItemSubmenu(battleChoicesContainer, choices);
                    return;
                }

                // Consume items if specified
                if (choice.uses && choice.uses.length > 0) {
                    removeItems(choice.uses);
                }

                // Execute the battle action (pass choice for heals/damage info)
                executeBattleAction(action, choice);
            };

            battleChoicesContainer.appendChild(button);
        });
    }

    /**
     * Show skill selection submenu
     */
    function showSkillSubmenu(container, originalChoices) {
        if (typeof BattleEngine === 'undefined') return;

        // Create submenu
        var submenu = document.createElement('div');
        submenu.id = 'skill-submenu';
        submenu.className = 'skill-submenu active';

        var title = document.createElement('div');
        title.className = 'skill-submenu-title';
        title.textContent = 'Select Skill';
        submenu.appendChild(title);

        var skillList = document.createElement('div');
        skillList.className = 'skill-list';

        // Get available skills from BattleEngine
        var playerSkills = BattleEngine.getPlayerSkills();
        var battleState = BattleEngine.getState();
        var currentMana = battleState.player.mana;

        playerSkills.forEach(function(skill) {
            var skillItem = document.createElement('div');
            skillItem.className = 'skill-item' + (skill.canUse ? '' : ' disabled');

            var skillName = document.createElement('span');
            skillName.className = 'skill-name';
            skillName.textContent = skill.name;

            var skillCost = document.createElement('span');
            skillCost.className = 'skill-cost' + (skill.canUse ? '' : ' insufficient');
            skillCost.textContent = skill.manaCost + ' MP';

            // Effect icon slot - reserves space to prevent layout shift
            var effectSlot = document.createElement('span');
            effectSlot.className = 'skill-effect-slot';
            if (skill.statusEffect && typeof BattleData !== 'undefined') {
                var effectDef = BattleData.getStatusEffect(skill.statusEffect.type);
                if (effectDef && effectDef.icon) {
                    effectSlot.textContent = effectDef.icon;
                    effectSlot.title = effectDef.name;
                    effectSlot.style.color = effectDef.color || '#fff';
                }
            }

            skillItem.appendChild(skillName);
            skillItem.appendChild(effectSlot);
            skillItem.appendChild(skillCost);

            if (skill.canUse) {
                skillItem.onclick = function() {
                    // Remove submenu and restore battle log content
                    var menu = document.getElementById('skill-submenu');
                    if (menu) menu.parentNode.removeChild(menu);
                    // Show battle choices and log content again
                    var battleChoices = document.getElementById('battle-choices');
                    var battleLogContent = document.getElementById('battle-log-content');
                    var battleLogPanel = document.querySelector('.battle-log-panel');
                    var playerStats = document.getElementById('player-stats-panel');
                    if (battleChoices) {
                        battleChoices.style.display = '';
                    }
                    if (battleLogContent) {
                        battleLogContent.style.display = '';
                    }
                    // Remove expanded class
                    if (battleLogPanel) {
                        battleLogPanel.classList.remove('menu-expanded');
                    }
                    if (playerStats) {
                        playerStats.classList.remove('menu-expanded');
                    }

                    // Execute skill action
                    executeBattleAction('skill', { skillId: skill.id });
                };
            }

            skillItem.title = skill.description || '';
            skillList.appendChild(skillItem);
        });

        // Add empty locked slots to show player can earn more skills (up to 6 total)
        var maxSkills = 6;
        var emptySlots = maxSkills - playerSkills.length;
        for (var i = 0; i < emptySlots; i++) {
            var emptyItem = document.createElement('div');
            emptyItem.className = 'skill-item skill-item-locked';

            var emptyName = document.createElement('span');
            emptyName.className = 'skill-name skill-name-locked';
            emptyName.textContent = '???';

            var emptyHint = document.createElement('span');
            emptyHint.className = 'skill-cost skill-cost-locked';
            emptyHint.textContent = 'Locked';

            emptyItem.appendChild(emptyName);
            emptyItem.appendChild(emptyHint);
            emptyItem.title = 'Earn new skills by progressing through the story';
            skillList.appendChild(emptyItem);
        }

        submenu.appendChild(skillList);

        // Back button
        var backBtn = document.createElement('button');
        backBtn.className = 'skill-back-btn';
        backBtn.textContent = '← Back';
        backBtn.onclick = function() {
            var menu = document.getElementById('skill-submenu');
            if (menu) menu.parentNode.removeChild(menu);
            // Show battle choices and log content again
            var battleChoices = document.getElementById('battle-choices');
            var battleLogContent = document.getElementById('battle-log-content');
            var battleLogPanel = document.querySelector('.battle-log-panel');
            var playerStats = document.getElementById('player-stats-panel');
            if (battleChoices) {
                battleChoices.style.display = '';
            }
            if (battleLogContent) {
                battleLogContent.style.display = '';
            }
            // Remove expanded class
            if (battleLogPanel) {
                battleLogPanel.classList.remove('menu-expanded');
            }
            if (playerStats) {
                playerStats.classList.remove('menu-expanded');
            }
        };
        submenu.appendChild(backBtn);

        // Add to battle log panel (replaces entire panel content)
        var battleLogPanel = document.querySelector('.battle-log-panel');
        var battleChoices = document.getElementById('battle-choices');
        var battleLogContent = document.getElementById('battle-log-content');
        var playerStats = document.getElementById('player-stats-panel');
        if (battleLogPanel && battleChoices) {
            // Hide both battle choices and log content - skill menu takes full space
            battleChoices.style.display = 'none';
            if (battleLogContent) {
                battleLogContent.style.display = 'none';
            }
            // Add class to indicate expanded menu (for player stats positioning)
            battleLogPanel.classList.add('menu-expanded');
            if (playerStats) {
                playerStats.classList.add('menu-expanded');
            }
            // Insert at the start of the panel
            battleLogPanel.insertBefore(submenu, battleLogPanel.firstChild);
        }
    }

    /**
     * Show item selection submenu (appears below choices, scrollable)
     */
    function showItemSubmenu(container, originalChoices) {
        if (typeof BattleEngine === 'undefined') return;

        // Remove any existing item submenu
        var existingMenu = document.getElementById('item-submenu');
        if (existingMenu) {
            existingMenu.parentNode.removeChild(existingMenu);
            // If clicking Item again while menu open, just close it
            return;
        }

        // Create submenu
        var submenu = document.createElement('div');
        submenu.id = 'item-submenu';
        submenu.className = 'item-submenu';

        var title = document.createElement('div');
        title.className = 'item-submenu-title';
        title.textContent = 'Items';
        submenu.appendChild(title);

        var itemList = document.createElement('div');
        itemList.className = 'item-list';

        // Get battle items from BattleEngine
        var battleItems = BattleEngine.getBattleItems ? BattleEngine.getBattleItems() : [];
        var hasItems = false;

        battleItems.forEach(function(item) {
            if (item.quantity <= 0) return;
            hasItems = true;

            var itemRow = document.createElement('div');
            itemRow.className = 'item-row';

            var itemIcon = document.createElement('span');
            itemIcon.className = 'item-icon';
            itemIcon.textContent = item.icon || '📦';

            var itemName = document.createElement('span');
            itemName.className = 'item-name';
            itemName.textContent = item.name;

            var itemQty = document.createElement('span');
            itemQty.className = 'item-qty';
            itemQty.textContent = 'x' + item.quantity;

            itemRow.appendChild(itemIcon);
            itemRow.appendChild(itemName);
            itemRow.appendChild(itemQty);

            itemRow.onclick = function() {
                // Remove submenu
                var menu = document.getElementById('item-submenu');
                if (menu) menu.parentNode.removeChild(menu);
                // Show battle choices and log content again
                var battleChoices = document.getElementById('battle-choices');
                var battleLogContent = document.getElementById('battle-log-content');
                var battleLogPanel = document.querySelector('.battle-log-panel');
                var playerStats = document.getElementById('player-stats-panel');
                if (battleChoices) {
                    battleChoices.style.display = '';
                }
                if (battleLogContent) {
                    battleLogContent.style.display = '';
                }
                // Remove expanded class
                if (battleLogPanel) {
                    battleLogPanel.classList.remove('menu-expanded');
                }
                if (playerStats) {
                    playerStats.classList.remove('menu-expanded');
                }

                // Execute item action
                executeBattleAction('item', { itemId: item.id });
            };

            itemRow.title = item.description || '';
            itemList.appendChild(itemRow);
        });

        // If no items, show empty message
        if (!hasItems) {
            var emptyMsg = document.createElement('div');
            emptyMsg.className = 'item-row disabled';
            emptyMsg.textContent = 'No items available';
            itemList.appendChild(emptyMsg);
        }

        // Add back button
        var backBtn = document.createElement('button');
        backBtn.className = 'skill-back-btn';
        backBtn.innerHTML = '← Back';
        backBtn.onclick = function() {
            var menu = document.getElementById('item-submenu');
            if (menu) menu.parentNode.removeChild(menu);
            // Show battle choices and log content again
            var battleChoices = document.getElementById('battle-choices');
            var battleLogContent = document.getElementById('battle-log-content');
            var battleLogPanel = document.querySelector('.battle-log-panel');
            var playerStats = document.getElementById('player-stats-panel');
            if (battleChoices) {
                battleChoices.style.display = '';
            }
            if (battleLogContent) {
                battleLogContent.style.display = '';
            }
            // Remove expanded class
            if (battleLogPanel) {
                battleLogPanel.classList.remove('menu-expanded');
            }
            if (playerStats) {
                playerStats.classList.remove('menu-expanded');
            }
        };

        submenu.appendChild(itemList);
        submenu.appendChild(backBtn);

        // Add inside the battle-log-panel (replaces battle-choices area)
        var battleLogPanel = document.querySelector('.battle-log-panel');
        var battleChoices = document.getElementById('battle-choices');
        var battleLogContent = document.getElementById('battle-log-content');
        var playerStats = document.getElementById('player-stats-panel');
        if (battleLogPanel && battleChoices) {
            // Hide both battle choices and log content - item menu takes full space
            battleChoices.style.display = 'none';
            if (battleLogContent) {
                battleLogContent.style.display = 'none';
            }
            // Add class to indicate expanded menu (for player stats positioning)
            battleLogPanel.classList.add('menu-expanded');
            if (playerStats) {
                playerStats.classList.add('menu-expanded');
            }
            // Insert before the hidden battle-choices so it takes its place
            battleLogPanel.insertBefore(submenu, battleChoices);
        }
    }

    // === DOM References ===
    var elements = {};

    // === Initialization ===
    function init() {
        cacheElements();
        setupClickToSkip();
        setupSpeedControls();
        setupContinueButton();
        setupMuteButton();
        setupFirstInteraction();
        setupResetButton();
        setupTapToHide();

        // Show dev mode indicator if enabled by default
        if (state.devMode) {
            showDevModeIndicator(true);
        }

        // Try to load saved state
        if (!loadSavedState()) {
            // No save found, start fresh
            loadScene(config.startScene);
        }
    }

    function setupFirstInteraction() {
        // Browser autoplay policy requires user interaction before audio can play.
        // Listen for any click on the VN container to try starting music.
        var vnContainer = document.getElementById('vn-container');
        if (vnContainer) {
            var tryStart = function() {
                tryPlayMusic();
                vnContainer.removeEventListener('click', tryStart);
            };
            vnContainer.addEventListener('click', tryStart);
        }
    }

    function cacheElements() {
        elements = {
            storyOutput: document.getElementById('story-output'),
            choicesContainer: document.getElementById('choices-container'),
            backgroundLayer: document.getElementById('background-layer'),
            bgVideo: document.getElementById('bg-video'),
            spriteLayer: document.getElementById('sprite-layer'),
            continueBtn: document.getElementById('continue-btn'),
            bgMusic: document.getElementById('bg-music'),
            muteBtn: document.getElementById('mute-btn'),
            volumeSlider: document.getElementById('volume-slider')
        };
    }

    function setupContinueButton() {
        if (elements.continueBtn) {
            elements.continueBtn.addEventListener('click', function() {
                tryPlayMusic(); // Retry music on user interaction
                advanceTextBlock();
            });
        }
    }

    function setupMuteButton() {
        if (elements.muteBtn) {
            elements.muteBtn.addEventListener('click', function() {
                toggleMute();
            });
        }

        if (elements.volumeSlider) {
            elements.volumeSlider.addEventListener('input', function() {
                setVolume(this.value / 100);
                updateVolumeSliderFill();
            });
            // Initialize fill on load
            updateVolumeSliderFill();
        }
    }

    function setupSpeedControls() {
        var buttons = document.querySelectorAll('.speed-btn');
        buttons.forEach(function(btn) {
            btn.addEventListener('click', function() {
                var speed = this.getAttribute('data-speed');
                setTextSpeed(speed);

                // Update active state and aria-pressed
                buttons.forEach(function(b) {
                    b.classList.remove('active');
                    b.setAttribute('aria-pressed', 'false');
                });
                this.classList.add('active');
                this.setAttribute('aria-pressed', 'true');
            });
        });
    }

    function setTextSpeed(speed) {
        config.currentSpeed = speed;

        // If skip mode and currently typing already-read text, skip immediately
        if (speed === 'skip' && state.typewriter.isTyping && state.typewriter.canSkip) {
            skipTypewriter();
        }
    }

    function getTextSpeed() {
        // Use speed override if set (for skip mode on new text)
        if (state.typewriter.speedOverride) {
            return config.textSpeed[state.typewriter.speedOverride] || config.textSpeed.normal;
        }
        return config.textSpeed[config.currentSpeed] || config.textSpeed.normal;
    }

    function setupClickToSkip() {
        // Click/tap on story output to skip typewriter
        elements.storyOutput.addEventListener('click', function() {
            skipTypewriter();
        });

        // Touch event for better mobile response (fires before click)
        elements.storyOutput.addEventListener('touchend', function(e) {
            // Prevent double-firing with click event
            if (skipTypewriter()) {
                e.preventDefault();
            }
        }, { passive: false });

        // Allow spacebar to skip or continue (desktop keyboard)
        document.addEventListener('keydown', function(e) {
            if (e.code === 'Space' || e.key === ' ') {
                // Only if not focused on a button or input
                var activeTag = document.activeElement.tagName;
                if (activeTag !== 'BUTTON' && activeTag !== 'INPUT') {
                    e.preventDefault();

                    // If typing, try to skip
                    if (state.typewriter.isTyping) {
                        skipTypewriter();
                    } else if (elements.continueBtn &&
                               elements.continueBtn.style.display !== 'none') {
                        // If continue button visible, click it
                        advanceTextBlock();
                    }
                }
            }

            // Ctrl+Z for undo in dev mode
            if (e.ctrlKey && e.key === 'z' && state.devMode) {
                e.preventDefault();
                undoScene();
            }
        });

        // Developer bypass: hold q+w+e+r+t together to toggle dev mode
        var devKeys = ['q', 'w', 'e', 'r', 't'];

        document.addEventListener('keydown', function(e) {
            var key = e.key.toLowerCase();
            if (devKeys.indexOf(key) !== -1) {
                state.devKeysHeld[key] = true;

                var allHeld = devKeys.every(function(k) {
                    return state.devKeysHeld[k];
                });

                if (allHeld) {
                    state.devMode = !state.devMode;
                    state.devKeysHeld = {};

                    if (state.devMode) {
                        console.log('%c[DEV MODE ENABLED]', 'color: #00ff00; font-weight: bold;');
                        showDevModeIndicator(true);
                    } else {
                        console.log('%c[DEV MODE DISABLED]', 'color: #ff0000; font-weight: bold;');
                        showDevModeIndicator(false);
                    }
                }
            }
        });

        document.addEventListener('keyup', function(e) {
            var key = e.key.toLowerCase();
            if (devKeys.indexOf(key) !== -1) {
                delete state.devKeysHeld[key];
            }
        });
    }

    function updateSkipButtonVisibility() {
        var skipBtn = document.getElementById('skip-btn');
        if (skipBtn) {
            var hasReadBlocks = Object.keys(state.readBlocks).length > 0;
            // Use class toggle instead of display to prevent layout shift
            skipBtn.classList.toggle('visible', hasReadBlocks);
        }
    }

    function showDevModeIndicator(show) {
        var indicator = document.getElementById('dev-mode-indicator');
        var themeSelector = document.getElementById('theme-selector');

        if (show) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'dev-mode-indicator';
                indicator.textContent = 'DEV MODE';
                // Styles defined in shared.css #dev-mode-indicator
                document.body.appendChild(indicator);

                // Add click handler for portrait mode toggle
                indicator.addEventListener('click', function() {
                    toggleDevPanelPortrait();
                });
            }
            indicator.classList.add('visible');

            // Show theme selector in dev mode (landscape only, portrait uses toggle)
            if (!themeSelector) {
                createThemeSelector();
            } else {
                themeSelector.classList.add('visible');
            }

            // Add undo button to text controls
            addUndoButton();
        } else {
            if (indicator) {
                indicator.classList.remove('visible');
                indicator.classList.remove('expanded');
            }
            // Hide theme selector
            if (themeSelector) {
                themeSelector.classList.remove('visible');
                themeSelector.classList.remove('portrait-expanded');
            }

            // Remove undo button from text controls
            removeUndoButton();
        }
    }

    function toggleDevPanelPortrait() {
        // Only toggle in portrait mode
        if (window.matchMedia('(orientation: portrait)').matches) {
            var indicator = document.getElementById('dev-mode-indicator');
            var themeSelector = document.getElementById('theme-selector');

            if (indicator && themeSelector) {
                var isExpanded = indicator.classList.contains('expanded');
                if (isExpanded) {
                    indicator.classList.remove('expanded');
                    themeSelector.classList.remove('portrait-expanded');
                } else {
                    indicator.classList.add('expanded');
                    themeSelector.classList.add('portrait-expanded');
                }
            }
        }
    }

    function addUndoButton() {
        var textControls = document.getElementById('text-controls');
        if (!textControls || document.getElementById('dev-undo-btn')) return;

        var undoBtn = document.createElement('button');
        undoBtn.id = 'dev-undo-btn';
        undoBtn.className = 'speed-btn';
        undoBtn.title = 'Undo - go back to previous scene (Ctrl+Z)';
        undoBtn.setAttribute('aria-label', 'Undo to previous scene');
        undoBtn.innerHTML = '<span class="icon-landscape" aria-hidden="true">&lt;</span><span class="icon-portrait" aria-hidden="true">&lt;</span>';

        undoBtn.addEventListener('click', function() {
            undoScene();
        });

        // Insert at the beginning of text controls
        textControls.insertBefore(undoBtn, textControls.firstChild);
    }

    function removeUndoButton() {
        var undoBtn = document.getElementById('dev-undo-btn');
        if (undoBtn) {
            undoBtn.parentNode.removeChild(undoBtn);
        }
    }

    function createThemeSelector() {
        // Only create if themeConfig exists
        if (typeof themeConfig === 'undefined' || !themeConfig.available) {
            return;
        }

        // Apply saved theme on load (if different from current)
        var currentTheme = getCurrentTheme();
        var link = document.getElementById('theme-css');
        if (link && link.href) {
            var activeTheme = link.href.match(/themes\/([^.]+)\.css/);
            if (activeTheme && activeTheme[1] !== currentTheme) {
                setTheme(currentTheme);
            }
        }

        var container = document.createElement('div');
        container.id = 'theme-selector';
        container.classList.add('visible');
        // No inline styles - let CSS handle theming

        var label = document.createElement('label');
        label.textContent = 'Theme: ';

        var select = document.createElement('select');
        select.id = 'theme-select';
        // No inline styles - let CSS handle theming

        themeConfig.available.forEach(function(theme) {
            var option = document.createElement('option');
            option.value = theme;
            option.textContent = theme;
            if (theme === currentTheme) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        select.addEventListener('change', function() {
            setTheme(this.value);
        });

        container.appendChild(label);
        container.appendChild(select);

        // Ken Burns toggle
        var kenBurnsContainer = document.createElement('div');
        kenBurnsContainer.className = 'ken-burns-toggle-container';

        var kenBurnsLabel = document.createElement('label');
        // Styles defined in shared.css .ken-burns-toggle-container label

        var kenBurnsCheckbox = document.createElement('input');
        kenBurnsCheckbox.type = 'checkbox';
        kenBurnsCheckbox.id = 'ken-burns-toggle';
        kenBurnsCheckbox.checked = state.kenBurns;
        // Styles defined in shared.css .ken-burns-toggle-container input[type="checkbox"]

        kenBurnsCheckbox.addEventListener('change', function() {
            state.kenBurns = this.checked;
            applyKenBurns(this.checked);
            // Save preference
            try {
                localStorage.setItem(config.kenBurnsKey, this.checked ? 'true' : 'false');
            } catch (e) {}
        });

        // Load saved preference
        try {
            var saved = localStorage.getItem(config.kenBurnsKey);
            if (saved === 'true') {
                state.kenBurns = true;
                kenBurnsCheckbox.checked = true;
                applyKenBurns(true);
            }
        } catch (e) {}

        kenBurnsLabel.appendChild(kenBurnsCheckbox);
        kenBurnsLabel.appendChild(document.createTextNode('Ken Burns zoom'));

        kenBurnsContainer.appendChild(kenBurnsLabel);
        container.appendChild(kenBurnsContainer);

        // Forced dice roll input
        var diceRollContainer = document.createElement('div');
        diceRollContainer.className = 'forced-roll-container';

        var diceRollLabel = document.createElement('label');
        diceRollLabel.htmlFor = 'forced-roll-input';
        diceRollLabel.textContent = 'Force roll: ';

        var diceRollInput = document.createElement('input');
        diceRollInput.type = 'number';
        diceRollInput.id = 'forced-roll-input';
        diceRollInput.min = '1';
        diceRollInput.max = '20';
        diceRollInput.placeholder = 'rand';
        diceRollInput.title = 'Force next dice roll (1-20). Leave empty for random.';

        diceRollInput.addEventListener('input', function() {
            var val = this.value.trim();
            if (val === '') {
                state.devForcedRoll = null;
                log.debug('Forced roll cleared - using random');
            } else {
                var num = parseInt(val, 10);
                if (!isNaN(num) && num >= 1 && num <= 20) {
                    state.devForcedRoll = num;
                    log.debug('Forced roll set to: ' + num);
                } else {
                    state.devForcedRoll = null;
                }
            }
        });

        diceRollContainer.appendChild(diceRollLabel);
        diceRollContainer.appendChild(diceRollInput);
        container.appendChild(diceRollContainer);

        document.body.appendChild(container);
    }

    /**
     * Go back one text block, or to previous scene if at first block (dev mode only)
     */
    function undoScene() {
        log.debug('undoScene: blockIndex=' + state.currentBlockIndex + ', scene=' + state.currentSceneId + ', historyLen=' + state.history.length);

        if (!state.devMode) {
            flashUndoError();
            return false;
        }

        // If battle is active or was active, end it and clean up
        if (typeof BattleEngine !== 'undefined') {
            if (BattleEngine.isActive()) {
                log.debug('Undo during active battle - ending battle');
                BattleEngine.reset();  // reset() calls destroyUI() and showTextBox()
            } else {
                // Even if battle is not "active", UI elements might persist
                // Always clean up to be safe when undoing
                log.debug('Undo after battle - cleaning up battle UI');
                BattleEngine.destroyUI();
            }
        }
        // Clear battle state flag in engine
        state.battle = null;
        // Ensure text box is visible (remove battle-mode class if present)
        var textBox = document.getElementById('text-box');
        if (textBox) {
            textBox.classList.remove('battle-mode');
        }

        // Check if we can undo BEFORE stopping typewriter
        // Can't undo if we're at block 0 of the first scene
        if (state.currentBlockIndex === 0 && state.history.length <= 1) {
            flashUndoError();
            return false;
        }

        // Stop any ongoing typewriter effect
        stopTypewriter();

        // If we're past the first text block, go back one block
        if (state.currentBlockIndex > 0) {
            log.debug('Going back one text block');
            state.currentBlockIndex--;

            // Clear choices immediately when going back
            elements.choicesContainer.innerHTML = '';

            // Re-render the current block using renderText
            var scene = story[state.currentSceneId];
            if (scene) {
                var textBlocks = state.processedTextBlocks || scene.textBlocks || [];
                var currentText = textBlocks[state.currentBlockIndex] || '';
                var isLastBlock = state.currentBlockIndex >= textBlocks.length - 1;

                // Render text with callback to show continue button
                renderText(currentText, '', function() {
                    if (!isLastBlock) {
                        showContinueButton();
                    }
                });

                saveState();
            }
            return true;
        }

        // At first block - go to previous scene's LAST text block
        // Note: The early check at the start of this function should prevent
        // reaching here with history.length <= 1, but keep this as a safety net
        if (state.history.length <= 1) {
            // This shouldn't happen, but re-render current block to recover
            renderCurrentBlock();
            flashUndoError();
            return false;
        }

        // Remove current scene from history
        state.history.pop();

        // Get the previous scene (don't pop - we'll stay on it)
        var previousSceneId = state.history[state.history.length - 1];

        var scene = story[previousSceneId];
        if (!scene) {
            flashUndoError();
            return false;
        }

        // Set up the previous scene at its LAST text block
        state.currentSceneId = previousSceneId;

        // Clear choices immediately when going back to previous scene
        elements.choicesContainer.innerHTML = '';

        // Preprocess text blocks for the scene
        var isEnding = !scene.choices || scene.choices.length === 0;
        state.processedTextBlocks = preprocessTextBlocks(scene.textBlocks || [], isEnding);
        state.isEndingScene = isEnding;

        // Go to the last text block
        var textBlocks = state.processedTextBlocks;
        state.currentBlockIndex = textBlocks.length - 1;

        // Render the scene visuals (background, characters, music)
        if (scene.bg) {
            setBackground(scene.bg);
        } else {
            clearBackground();
        }
        if (scene.chars && scene.chars.length > 0) {
            setCharacters(scene.chars);
        } else {
            clearCharacters();
        }
        var musicToPlay = scene.music || config.defaultMusic;
        setMusic(musicToPlay);

        // Render the last text block
        var currentText = textBlocks[state.currentBlockIndex] || '';
        renderText(currentText, '', function() {
            // Show choices since we're on the last block
            if (scene.choices && scene.choices.length > 0) {
                renderChoices(scene.choices);
            }
            hideContinueButton();
        });

        saveState();
        return true;
    }

    /**
     * Flash the undo button red and play error sound when undo fails
     */
    function flashUndoError() {
        var undoBtn = document.getElementById('dev-undo-btn');
        if (undoBtn) {
            // Flash red using CSS class (defined in shared.css)
            undoBtn.classList.add('error');

            setTimeout(function() {
                undoBtn.classList.remove('error');
            }, config.timing.errorFlash);
        }

        // Play error SFX
        playSfx('negative.ogg');
    }

    function applyKenBurns(enabled) {
        var bgLayer = elements.backgroundLayer;
        var bgVideo = elements.bgVideo;

        if (enabled) {
            if (bgLayer) bgLayer.classList.add('ken-burns');
            if (bgVideo) bgVideo.classList.add('ken-burns');
        } else {
            if (bgLayer) bgLayer.classList.remove('ken-burns');
            if (bgVideo) bgVideo.classList.remove('ken-burns');
        }
    }

    function getCurrentTheme() {
        // Check localStorage first for persisted theme
        var savedTheme = localStorage.getItem(config.themeKey);
        if (savedTheme && typeof themeConfig !== 'undefined' &&
            themeConfig.available && themeConfig.available.indexOf(savedTheme) !== -1) {
            return savedTheme;
        }

        var link = document.getElementById('theme-css');
        if (link && link.href) {
            var match = link.href.match(/themes\/([^.]+)\.css/);
            return match ? match[1] : 'prototype';
        }
        return typeof themeConfig !== 'undefined' ? themeConfig.selected : 'prototype';
    }

    function setTheme(themeName) {
        var link = document.getElementById('theme-css');
        if (link) {
            link.href = 'css/themes/' + themeName + '.css';
            // Persist theme choice to localStorage
            localStorage.setItem(config.themeKey, themeName);
            log.info('Theme changed to: ' + themeName);
        }
    }

    // === Scene Loading ===
    function loadScene(sceneId, prependContent, entrySfx) {
        prependContent = prependContent || '';

        // Cancel any ongoing animations from previous scene
        if (typeof AnimationManager !== 'undefined') {
            AnimationManager.cancelAll();
        }

        // Emit scene transition event
        if (typeof EventEmitter !== 'undefined') {
            EventEmitter.emit('scene:transition', { from: state.currentSceneId, to: sceneId });
        }

        // Check for special roll trigger
        if (sceneId === '_roll') {
            executeActions();
            return;
        }

        var scene = story[sceneId];

        if (!scene) {
            log.error('Scene not found: ' + sceneId);
            showErrorScreen({
                title: 'Scene Not Found',
                message: 'Could not find scene: "' + sceneId + '"',
                suggestion: 'Check that the scene ID is correct in your story files.',
                canGoBack: state.history.length > 1
            });
            return;
        }

        // Check flag requirements
        if (scene.require_flags && scene.require_flags.length > 0) {
            if (!checkFlags(scene.require_flags)) {
                log.warn('Flag requirements not met for scene: ' + sceneId);
                return;
            }
        }

        // Set flags if specified
        if (scene.set_flags && scene.set_flags.length > 0) {
            setFlags(scene.set_flags);
        }

        // Add items if specified
        if (scene.add_items && scene.add_items.length > 0) {
            addItems(scene.add_items);
        }

        // Remove items if specified
        if (scene.remove_items && scene.remove_items.length > 0) {
            removeItems(scene.remove_items);
        }

        // Update state
        state.currentSceneId = sceneId;
        state.currentBlockIndex = 0;
        state.history.push(sceneId);

        // Auto-save progress
        saveState();

        // Ensure text box is visible (remove any hidden state from tap-to-hide or battle mode)
        var textBox = document.getElementById('text-box');
        if (textBox) {
            textBox.classList.remove('hidden-textbox');
            textBox.classList.remove('battle-mode');
        }

        // Render the scene (pass entry SFX if provided)
        renderScene(scene, prependContent, entrySfx);
    }

    // === Text Splitting ===

    function splitTextIntoSentences(text) {
        // Split on sentence endings (. ! ?) followed by space or newline
        // Keep the punctuation with the sentence
        var sentences = [];
        var regex = /[^.!?]*[.!?]+(?:\s|$)|[^.!?]+$/g;
        var match;

        while ((match = regex.exec(text)) !== null) {
            var sentence = match[0].trim();
            if (sentence) {
                sentences.push(sentence);
            }
        }

        return sentences;
    }

    function balanceSplitText(text) {
        var maxLength = config.maxBlockLength;
        // If text is short enough, return as single block
        if (text.length <= maxLength) {
            return [text];
        }

        var sentences = splitTextIntoSentences(text);

        // If only one sentence (or couldn't split), return as is
        if (sentences.length <= 1) {
            return [text];
        }

        // Calculate how many blocks we need
        var numBlocks = Math.ceil(text.length / maxLength);
        var targetLength = text.length / numBlocks;

        var blocks = [];
        var currentBlock = '';

        for (var i = 0; i < sentences.length; i++) {
            var sentence = sentences[i];
            var potentialBlock = currentBlock ? currentBlock + ' ' + sentence : sentence;

            // If adding this sentence would exceed target and we have content,
            // and we're not on the last sentence, consider starting a new block
            if (currentBlock && potentialBlock.length > targetLength && i < sentences.length - 1) {
                // Check if current block is reasonably sized
                if (currentBlock.length >= targetLength * 0.5) {
                    blocks.push(currentBlock.trim());
                    currentBlock = sentence;
                } else {
                    currentBlock = potentialBlock;
                }
            } else {
                currentBlock = potentialBlock;
            }
        }

        // Add the last block
        if (currentBlock.trim()) {
            blocks.push(currentBlock.trim());
        }

        return blocks;
    }

    /**
     * Check if text contains formatting that shouldn't be split
     * (bold markers, quotes, etc.)
     */
    function hasFormattingMarkers(text) {
        // Check for markdown bold **text**
        if (/\*\*[^*]+\*\*/.test(text)) return true;
        // Check for quotes "text"
        if (/"[^"]+"/.test(text)) return true;
        // Check for single quotes 'text'
        if (/'[^']+'/.test(text)) return true;
        // Check for italics *text*
        if (/(?<!\*)\*[^*]+\*(?!\*)/.test(text)) return true;
        return false;
    }

    function preprocessTextBlocks(textBlocks, isEnding) {
        // If it's an ending screen, don't split - allow expansion
        if (isEnding) {
            return textBlocks;
        }

        var processedBlocks = [];

        for (var i = 0; i < textBlocks.length; i++) {
            var block = textBlocks[i];

            // Don't split blocks that contain formatting markers
            if (hasFormattingMarkers(block)) {
                processedBlocks.push(block);
            } else {
                var splitBlocks = balanceSplitText(block);

                for (var j = 0; j < splitBlocks.length; j++) {
                    processedBlocks.push(splitBlocks[j]);
                }
            }
        }

        return processedBlocks;
    }

    // === Rendering ===
    function renderScene(scene, prependContent, entrySfx) {
        prependContent = prependContent || '';

        // Update background if specified
        if (scene.bg) {
            setBackground(scene.bg);
        } else {
            clearBackground();
        }

        // Update character sprites
        if (scene.chars && scene.chars.length > 0) {
            setCharacters(scene.chars);
        } else {
            clearCharacters();
        }

        // Clear choices and text while transitioning
        elements.choicesContainer.innerHTML = '';
        elements.storyOutput.innerHTML = '';

        // Check if this is an ending (no choices)
        var isEnding = !scene.choices || scene.choices.length === 0;

        // Preprocess text blocks - split long ones unless it's an ending
        state.processedTextBlocks = preprocessTextBlocks(scene.textBlocks || [], isEnding);
        state.isEndingScene = isEnding;

        // Update text box class for ending scenes
        var textBox = document.getElementById('text-box');
        if (textBox) {
            if (isEnding) {
                textBox.classList.add('ending-scene');
            } else {
                textBox.classList.remove('ending-scene');
            }
        }

        // If there's an entry SFX, play it with music ducking then start text
        // Skip SFX in skip mode for faster navigation
        if (entrySfx && config.currentSpeed !== 'skip') {
            // Small pause before SFX, then play SFX, then pause before text
            setTimeout(function() {
                playSfxWithDucking(entrySfx, function() {
                    // Pause after SFX before starting text
                    setTimeout(function() {
                        // Now start music and text
                        var musicToPlay = scene.music || config.defaultMusic;
                        setMusic(musicToPlay);
                        renderCurrentBlock(prependContent);
                    }, config.sfxPostDelay);
                });
            }, config.sfxPreDelay);
        } else {
            // No SFX or skip mode - start music and text immediately
            var musicToPlay = scene.music || config.defaultMusic;
            setMusic(musicToPlay);
            renderCurrentBlock(prependContent);
        }
    }

    function renderCurrentBlock(prependContent) {
        prependContent = prependContent || '';

        var scene = story[state.currentSceneId];
        if (!scene) return;

        // Use processed text blocks (auto-split for non-ending scenes)
        var textBlocks = state.processedTextBlocks || scene.textBlocks || [];
        var currentText = textBlocks[state.currentBlockIndex] || '';
        var isLastBlock = state.currentBlockIndex >= textBlocks.length - 1;

        console.log('[Engine] renderCurrentBlock:', { sceneId: state.currentSceneId, blockIndex: state.currentBlockIndex, isLastBlock: isLastBlock, hasActions: !!(scene.actions && scene.actions.length > 0) });

        // Hide continue button and choices while typing
        hideContinueButton();
        elements.choicesContainer.innerHTML = '';

        // Render text with callback
        renderText(currentText, prependContent, function() {
            console.log('[Engine] Text render complete, isLastBlock:', isLastBlock, 'hasActions:', !!(scene.actions && scene.actions.length > 0));
            if (isLastBlock) {
                // Check for actions
                if (scene.actions && scene.actions.length > 0) {
                    // Show the roll choice if there's a _roll target in choices
                    var hasRollChoice = scene.choices && scene.choices.some(function(c) {
                        return c.target === '_roll';
                    });
                    console.log('[Engine] hasRollChoice:', hasRollChoice);
                    if (hasRollChoice) {
                        renderChoices(scene.choices);
                    } else {
                        // Execute actions directly
                        console.log('[Engine] Calling executeActions()');
                        executeActions();
                    }
                } else {
                    // Show choices or game over
                    renderChoices(scene.choices);
                }
            } else {
                // Show continue button
                showContinueButton();

                // Auto mode: auto-advance after delay
                if (config.currentSpeed === 'auto') {
                    state.typewriter.autoAdvanceId = setTimeout(function() {
                        advanceTextBlock();
                    }, config.autoDelay);
                }

                // Skip mode: auto-advance quickly until choice
                if (config.currentSpeed === 'skip') {
                    state.typewriter.autoAdvanceId = setTimeout(function() {
                        advanceTextBlock();
                    }, config.skipModeDelay);
                }
            }
        });
    }

    function advanceTextBlock() {
        // Cancel any auto-advance timer
        if (state.typewriter.autoAdvanceId) {
            clearTimeout(state.typewriter.autoAdvanceId);
            state.typewriter.autoAdvanceId = null;
        }

        var scene = story[state.currentSceneId];
        if (!scene) return;

        // Use processed text blocks (auto-split for non-ending scenes)
        var textBlocks = state.processedTextBlocks || scene.textBlocks || [];

        if (state.currentBlockIndex < textBlocks.length - 1) {
            state.currentBlockIndex++;
            saveState();  // Auto-save on block advance
            renderCurrentBlock();
        }
    }

    function showContinueButton() {
        if (elements.continueBtn) {
            elements.continueBtn.style.display = 'inline-block';
            // On touch devices, update button text to hint at tapping
            if (isTouchDevice()) {
                elements.continueBtn.textContent = 'Tap to Continue';
            } else {
                elements.continueBtn.textContent = 'Continue';
            }
        }
    }

    function hideContinueButton() {
        if (elements.continueBtn) {
            elements.continueBtn.style.display = 'none';
        }
    }

    function renderText(text, prependContent, onComplete) {
        prependContent = prependContent || '';

        // Convert markdown bold (**text**) to HTML <strong>
        var formattedText = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Check if this block was already read
        var blockKey = state.currentSceneId + ':' + state.currentBlockIndex;
        var alreadyRead = state.readBlocks[blockKey];

        // Mark block as read
        state.readBlocks[blockKey] = true;

        // Update skip button visibility
        updateSkipButtonVisibility();

        // Set up the container with prepend content
        elements.storyOutput.innerHTML = prependContent + '<p class="typewriter-text"></p>';
        var textElement = elements.storyOutput.querySelector('.typewriter-text');

        if (alreadyRead && config.currentSpeed === 'skip') {
            // Skip mode on already-read text: instant display
            textElement.innerHTML = formattedText;
            textElement.classList.add('typewriter-complete');
            textElement.classList.add('already-read');
            // Fallback for browsers without :has() support
            elements.storyOutput.classList.add('has-already-read');
            if (onComplete) onComplete();
        } else if (alreadyRead) {
            // Already-read text with normal/fast: still typewriter but can skip
            textElement.classList.add('already-read');
            // Fallback for browsers without :has() support
            elements.storyOutput.classList.add('has-already-read');
            startTypewriter(formattedText, textElement, onComplete, true);
        } else if (config.currentSpeed === 'skip') {
            // Skip mode on new text: use fast speed instead
            elements.storyOutput.classList.remove('has-already-read');
            startTypewriter(formattedText, textElement, onComplete, false, 'fast');
        } else {
            // New text: typewriter effect (no skip allowed on first read)
            elements.storyOutput.classList.remove('has-already-read');
            startTypewriter(formattedText, textElement, onComplete, false);
        }
    }

    // === Typewriter Effect ===
    function startTypewriter(html, element, onComplete, canSkip, speedOverride) {
        stopTypewriter();

        var segments = parseHTMLSegments(html);

        state.typewriter = {
            isTyping: true,
            timeoutId: null,
            autoAdvanceId: null,
            segments: segments,
            currentSegment: 0,
            currentChar: 0,
            element: element,
            renderedHTML: '',
            onComplete: onComplete,
            canSkip: canSkip || false,
            speedOverride: speedOverride || null
        };

        typeNextChar();
    }

    function parseHTMLSegments(html) {
        var segments = [];
        var regex = /(<[^>]+>)|([^<]+)/g;
        var match;

        while ((match = regex.exec(html)) !== null) {
            if (match[1]) {
                segments.push({ type: 'tag', content: match[1] });
            } else if (match[2]) {
                segments.push({ type: 'text', content: match[2] });
            }
        }

        return segments;
    }

    function typeNextChar() {
        var tw = state.typewriter;

        if (!tw.isTyping) return;

        if (tw.currentSegment >= tw.segments.length) {
            finishTypewriter();
            return;
        }

        var segment = tw.segments[tw.currentSegment];

        if (segment.type === 'tag') {
            tw.renderedHTML += segment.content;
            tw.element.innerHTML = tw.renderedHTML;
            tw.currentSegment++;
            tw.currentChar = 0;
            typeNextChar();
        } else {
            if (tw.currentChar < segment.content.length) {
                tw.renderedHTML += segment.content[tw.currentChar];
                tw.element.innerHTML = tw.renderedHTML;
                tw.currentChar++;
                var speed = getTextSpeed();
                if (speed === 0) {
                    typeNextChar();
                } else {
                    tw.timeoutId = setTimeout(typeNextChar, speed);
                }
            } else {
                tw.currentSegment++;
                tw.currentChar = 0;
                typeNextChar();
            }
        }
    }

    function skipTypewriter() {
        var tw = state.typewriter;

        if (!tw.isTyping || !tw.segments) return false;

        // Only allow skip if this block was already read (or dev mode)
        if (!tw.canSkip && !state.devMode) return false;

        // Build complete HTML
        var fullHTML = tw.renderedHTML || '';

        if (tw.currentSegment < tw.segments.length) {
            var currentSeg = tw.segments[tw.currentSegment];
            if (currentSeg.type === 'text' && tw.currentChar > 0) {
                fullHTML += currentSeg.content.substring(tw.currentChar);
                for (var i = tw.currentSegment + 1; i < tw.segments.length; i++) {
                    fullHTML += tw.segments[i].content;
                }
            } else {
                for (var i = tw.currentSegment; i < tw.segments.length; i++) {
                    fullHTML += tw.segments[i].content;
                }
            }
        }

        if (tw.element) {
            tw.element.innerHTML = fullHTML;
        }
        finishTypewriter();
        return true;
    }

    function stopTypewriter() {
        if (state.typewriter.timeoutId) {
            clearTimeout(state.typewriter.timeoutId);
        }
        if (state.typewriter.autoAdvanceId) {
            clearTimeout(state.typewriter.autoAdvanceId);
        }
        state.typewriter.isTyping = false;
    }

    function finishTypewriter() {
        stopTypewriter();
        if (state.typewriter.element) {
            state.typewriter.element.classList.add('typewriter-complete');
        }
        if (state.typewriter.onComplete) {
            state.typewriter.onComplete();
        }
    }

    function renderChoices(choices) {
        elements.choicesContainer.innerHTML = '';
        elements.choicesContainer.classList.remove('has-game-over');
        hideContinueButton();

        if (choices && choices.length > 0) {
            // Filter choices by required flags, required items, AND items to use
            var availableChoices = choices.filter(function(choice) {
                // Check flag requirements
                if (choice.require_flags && choice.require_flags.length > 0) {
                    if (!checkFlags(choice.require_flags)) return false;
                }
                // Check item requirements
                if (choice.require_items && choice.require_items.length > 0) {
                    if (!hasItems(choice.require_items)) return false;
                }
                // Check items that will be consumed (uses) - must have them to show choice
                if (choice.uses && choice.uses.length > 0) {
                    if (!hasItems(choice.uses)) return false;
                }
                return true;
            });

            availableChoices.forEach(function(choice) {
                var button = document.createElement('button');
                button.className = 'choice-button';

                // Add item requirement indicator to label if uses item
                var labelText = choice.label;
                if (choice.uses && choice.uses.length > 0) {
                    labelText += ' [Uses: ' + choice.uses.join(', ') + ']';
                }
                if (choice.heals) {
                    labelText += ' [+' + choice.heals + ' HP]';
                }
                button.textContent = labelText;

                button.onclick = function() {
                    tryPlayMusic(); // Retry music on user interaction

                    // Check if this is a battle action or battle item use
                    var isBattleActive = typeof BattleEngine !== 'undefined' && BattleEngine.isActive();
                    if (isBattleActive && (choice.battle_action || choice.heals)) {
                        // Consume items if specified
                        if (choice.uses && choice.uses.length > 0) {
                            removeItems(choice.uses);
                        }
                        // Play SFX if specified
                        if (choice.sfx) {
                            playSfx(choice.sfx);
                        }
                        // Execute the battle action (heals count as 'item' action)
                        var battleAction = choice.battle_action || (choice.heals ? 'item' : 'attack');
                        executeBattleAction(battleAction, choice);
                        return;
                    }

                    // Set flags from choice
                    if (choice.set_flags && choice.set_flags.length > 0) {
                        setFlags(choice.set_flags);
                    }

                    // Use (consume) items from choice
                    if (choice.uses && choice.uses.length > 0) {
                        removeItems(choice.uses);
                    }

                    // Heal player if specified
                    if (choice.heals) {
                        healPlayer(choice.heals);
                    }

                    // Navigate to target, passing SFX to play on new scene
                    loadScene(choice.target, '', choice.sfx || null);
                };
                elements.choicesContainer.appendChild(button);
            });
        } else {
            // Game over state - add completion message and restart button
            var completionMsg = document.createElement('p');
            completionMsg.className = 'game-over';
            completionMsg.textContent = 'The adventure is complete!';
            elements.choicesContainer.appendChild(completionMsg);
            // Fallback for browsers without :has() support
            elements.choicesContainer.classList.add('has-game-over');

            var restartButton = document.createElement('button');
            restartButton.className = 'restart-button';
            restartButton.textContent = 'Play Again';
            restartButton.onclick = function() {
                reset();
            };
            elements.choicesContainer.appendChild(restartButton);
        }
    }

    // === Action Execution ===
    function executeActions() {
        var scene = story[state.currentSceneId];
        if (!scene || !scene.actions || scene.actions.length === 0) {
            return;
        }

        // Execute first action (for now, we only support one action per scene)
        var action = scene.actions[0];
        var handler = actionHandlers[action.type];

        console.log('[Engine] executeActions: action type =', action.type, 'handler exists =', !!handler);

        if (handler) {
            try {
                handler(action);
            } catch (e) {
                console.error('[Engine] Error executing action:', e);
                console.error('[Engine] Stack trace:', e.stack);
            }
        } else {
            log.warn('Unknown action type: ' + action.type);
        }
    }

    // === Asset Management ===

    // Video extensions that require <video> element
    var videoExtensions = ['webm', 'mp4'];

    function getFileExtension(filename) {
        var parts = filename.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : '';
    }

    function isVideoBackground(filename) {
        var ext = getFileExtension(filename);
        return videoExtensions.indexOf(ext) !== -1;
    }

    function setBackground(filename) {
        if (!elements.backgroundLayer) return;

        var path = config.assetPaths.bg + filename;

        // Only restart Ken Burns if background actually changed
        var backgroundChanged = (state.currentBackground !== filename);
        if (state.kenBurns && backgroundChanged) {
            restartKenBurns();
        }

        // Track current background
        state.currentBackground = filename;

        if (isVideoBackground(filename)) {
            // Use video element for WebM/MP4
            elements.backgroundLayer.style.backgroundImage = 'none';
            if (elements.bgVideo) {
                elements.bgVideo.src = path;
                elements.bgVideo.style.display = 'block';
                elements.bgVideo.onerror = function() {
                    log.warn('Failed to load video background: ' + filename);
                    emitAssetError('bg', filename);
                    // Fall back to static image
                    elements.bgVideo.style.display = 'none';
                    elements.backgroundLayer.style.backgroundImage = 'url(' + config.fallbackAssets.bg + ')';
                };
                elements.bgVideo.play().catch(function(err) {
                    log.warn('Video autoplay blocked: ' + err.message);
                });
            }
        } else {
            // Use CSS background for static images, GIF, WebP
            if (elements.bgVideo) {
                elements.bgVideo.pause();
                elements.bgVideo.removeAttribute('src');
                elements.bgVideo.style.display = 'none';
            }
            // Preload image to detect errors
            var img = new Image();
            img.onload = function() {
                elements.backgroundLayer.style.backgroundImage = 'url(' + path + ')';
            };
            img.onerror = function() {
                log.warn('Failed to load background: ' + filename);
                emitAssetError('bg', filename);
                elements.backgroundLayer.style.backgroundImage = 'url(' + config.fallbackAssets.bg + ')';
            };
            img.src = path;
        }
    }

    /**
     * Emit asset load error event (if EventEmitter exists)
     */
    function emitAssetError(type, filename) {
        if (typeof EventEmitter !== 'undefined') {
            EventEmitter.emit('asset:load-error', { type: type, filename: filename });
        }
    }

    function restartKenBurns() {
        // Restart animation by toggling the class
        var bgLayer = elements.backgroundLayer;
        var bgVideo = elements.bgVideo;

        if (bgLayer) {
            bgLayer.classList.remove('ken-burns');
            // Force reflow to restart animation
            void bgLayer.offsetWidth;
            bgLayer.classList.add('ken-burns');
        }
        if (bgVideo) {
            bgVideo.classList.remove('ken-burns');
            void bgVideo.offsetWidth;
            bgVideo.classList.add('ken-burns');
        }
    }

    function clearBackground() {
        if (elements.backgroundLayer) {
            elements.backgroundLayer.style.backgroundImage = 'none';
        }
        if (elements.bgVideo) {
            elements.bgVideo.pause();
            elements.bgVideo.removeAttribute('src');
            elements.bgVideo.style.display = 'none';
        }
    }

    function setCharacters(chars) {
        if (!elements.spriteLayer) return;

        elements.spriteLayer.innerHTML = '';

        // Check if using new positioned format or old simple format
        var hasPositioning = chars.some(function(char) {
            return typeof char === 'object' && char.file;
        });

        /**
         * Create image with error handling
         */
        function createCharImage(filename, onError) {
            var img = document.createElement('img');
            img.alt = filename;
            img.onerror = function() {
                log.warn('Failed to load character sprite: ' + filename);
                emitAssetError('char', filename);
                // Use fallback image
                if (config.fallbackAssets.char) {
                    this.src = config.fallbackAssets.char;
                    this.onerror = null; // Prevent infinite loop
                }
            };
            img.src = config.assetPaths.char + filename;
            return img;
        }

        if (hasPositioning) {
            // New format: sprites with x/y positions
            // Switch to absolute positioning mode
            elements.spriteLayer.style.display = 'block';

            chars.forEach(function(char) {
                var filename, x, y, scale;

                if (typeof char === 'object') {
                    filename = char.file;
                    x = char.x !== undefined ? char.x : 50;
                    y = char.y !== undefined ? char.y : 85;
                    scale = char.scale !== undefined ? char.scale : 1;
                } else {
                    filename = char;
                    x = 50;
                    y = 85;
                    scale = 1;
                }

                var img = createCharImage(filename);
                img.style.position = 'absolute';
                img.style.left = x + '%';
                img.style.bottom = (100 - y) + '%';
                img.style.transform = 'translateX(-50%) scale(' + scale + ')';
                img.style.transformOrigin = 'center bottom';
                img.style.maxHeight = '100%';
                img.style.maxWidth = '300px';

                elements.spriteLayer.appendChild(img);
            });
        } else {
            // Old format: simple filenames, use flexbox centering
            elements.spriteLayer.style.display = 'flex';

            chars.forEach(function(filename) {
                var img = createCharImage(filename);
                elements.spriteLayer.appendChild(img);
            });
        }
    }

    function clearCharacters() {
        if (elements.spriteLayer) {
            elements.spriteLayer.innerHTML = '';
        }
    }

    // === Error Handling ===

    /**
     * Show a user-friendly error screen overlay
     * @param {Object} options - Error display options
     * @param {string} options.title - Error title
     * @param {string} options.message - Error message
     * @param {string} [options.suggestion] - Helpful suggestion text
     * @param {boolean} [options.canGoBack] - Show "Go Back" button
     */
    function showErrorScreen(options) {
        // Remove any existing error overlay
        var existing = document.getElementById('error-overlay');
        if (existing) {
            existing.parentNode.removeChild(existing);
        }

        var overlay = document.createElement('div');
        overlay.id = 'error-overlay';
        overlay.className = 'error-overlay';
        overlay.innerHTML =
            '<div class="error-dialog">' +
                '<h2 class="error-title">' + (options.title || 'Error') + '</h2>' +
                '<p class="error-message">' + (options.message || 'An error occurred.') + '</p>' +
                (options.suggestion ? '<p class="error-suggestion">' + options.suggestion + '</p>' : '') +
                '<div class="error-buttons">' +
                    (options.canGoBack ? '<button class="error-btn error-btn-back">Go Back</button>' : '') +
                    '<button class="error-btn error-btn-restart">Restart</button>' +
                '</div>' +
            '</div>';

        // Add button handlers
        var backBtn = overlay.querySelector('.error-btn-back');
        var restartBtn = overlay.querySelector('.error-btn-restart');

        if (backBtn) {
            backBtn.addEventListener('click', function() {
                hideErrorScreen();
                undo();
            });
        }

        if (restartBtn) {
            restartBtn.addEventListener('click', function() {
                hideErrorScreen();
                resetGame();
                loadScene(config.startScene);
            });
        }

        // Add to DOM
        var container = elements.container || document.getElementById('vn-container');
        if (container) {
            container.appendChild(overlay);
        } else {
            document.body.appendChild(overlay);
        }
    }

    /**
     * Hide the error screen overlay
     */
    function hideErrorScreen() {
        var overlay = document.getElementById('error-overlay');
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }

    // === Audio Management ===
    function setMusic(filename) {
        if (!elements.bgMusic) return;

        // Fall back to default music if empty string
        if (filename === '') {
            filename = config.defaultMusic;
        }

        // If same music, do nothing
        if (filename === state.audio.currentMusic) return;

        // Stop music if 'none' or null
        if (!filename || filename === 'none') {
            stopMusic();
            return;
        }

        // Set new music
        var path = config.assetPaths.music + filename;
        elements.bgMusic.src = path;
        elements.bgMusic.loop = true;
        elements.bgMusic.volume = state.audio.volume;
        state.audio.currentMusic = filename;

        // Try to play
        tryPlayMusic();
    }

    function tryPlayMusic() {
        if (!elements.bgMusic || !state.audio.currentMusic) return;
        if (state.audio.muted) return;

        elements.bgMusic.play().catch(function() {
            // Autoplay blocked - will retry after user interaction
            log.info('Music autoplay blocked, will retry after interaction');
        });
    }

    function stopMusic() {
        if (!elements.bgMusic) return;

        elements.bgMusic.pause();
        elements.bgMusic.currentTime = 0;
        // Don't set src to empty string or call load() - just pause and track state
        state.audio.currentMusic = null;
    }

    function playSfx(filename, callback) {
        if (state.audio.muted || !filename || filename === '') {
            if (callback) callback();
            return;
        }

        var path = config.assetPaths.sfx + filename;
        var audio = new Audio(path);

        // If callback provided, call it when SFX ends
        if (callback) {
            audio.addEventListener('ended', callback);
            audio.addEventListener('error', callback);
        }

        audio.play().catch(function() {
            log.info('SFX playback failed (autoplay blocked or file not found)');
            if (callback) callback();
        });
    }

    /**
     * Play SFX with music ducking (VN-style)
     * Ducks music volume, plays SFX, then restores music and calls callback
     * Short sounds are repeated to avoid jarring quick audio
     */
    function playSfxWithDucking(filename, callback) {
        if (state.audio.muted || !filename || filename === '') {
            if (callback) callback();
            return;
        }

        var path = config.assetPaths.sfx + filename;
        var audio = new Audio(path);
        var originalVolume = state.audio.volume;
        var duckedVolume = originalVolume * config.sfxDuckVolume;
        var minDuration = config.sfxMinDuration;
        var gapBetweenRepeats = config.sfxRepeatGap;

        // Duck music
        if (elements.bgMusic) {
            elements.bgMusic.volume = duckedVolume;
        }

        // Restore music and call callback
        var onComplete = function() {
            if (elements.bgMusic) {
                elements.bgMusic.volume = originalVolume;
            }
            if (callback) callback();
        };

        // Wait for metadata to get duration, then play (possibly with repeats)
        audio.addEventListener('loadedmetadata', function() {
            var durationMs = audio.duration * 1000;

            if (durationMs >= minDuration) {
                // Long enough, just play once
                audio.addEventListener('ended', onComplete);
                audio.addEventListener('error', onComplete);
                audio.play().catch(function() {
                    log.info('SFX playback failed');
                    onComplete();
                });
            } else {
                // Short sound - calculate repeats needed
                var repeatInterval = durationMs + gapBetweenRepeats;
                var repeatsNeeded = Math.ceil(minDuration / repeatInterval);
                var totalTime = repeatsNeeded * repeatInterval;
                var playsRemaining = repeatsNeeded;

                // Play first instance
                audio.play().catch(function() {
                    log.info('SFX playback failed');
                    onComplete();
                });
                playsRemaining--;

                // Schedule additional plays
                for (var i = 1; i < repeatsNeeded; i++) {
                    (function(delay) {
                        setTimeout(function() {
                            var repeatAudio = new Audio(path);
                            repeatAudio.play().catch(function() {});
                        }, delay);
                    })(i * repeatInterval);
                }

                // Call callback after total duration
                setTimeout(onComplete, totalTime);
            }
        });

        // Handle case where metadata fails to load
        audio.addEventListener('error', function() {
            log.warn('SFX load failed: ' + filename);
            onComplete();
        });

        // Trigger load
        audio.load();
    }

    function toggleMute() {
        state.audio.muted = !state.audio.muted;

        if (elements.bgMusic) {
            elements.bgMusic.muted = state.audio.muted;
        }

        // Update mute button appearance and accessibility
        if (elements.muteBtn) {
            updateMuteButtonIcon(state.audio.muted);
            elements.muteBtn.title = state.audio.muted ? 'Unmute' : 'Mute';
            elements.muteBtn.setAttribute('aria-pressed', state.audio.muted ? 'true' : 'false');
            elements.muteBtn.setAttribute('aria-label', state.audio.muted ? 'Unmute audio' : 'Mute audio');
        }
    }

    function updateMuteButtonIcon(muted) {
        if (!elements.muteBtn) return;
        var soundOn = elements.muteBtn.querySelector('.sound-on');
        var soundOff = elements.muteBtn.querySelector('.sound-off');
        if (soundOn) soundOn.style.display = muted ? 'none' : 'block';
        if (soundOff) soundOff.style.display = muted ? 'block' : 'none';
    }

    function setVolume(volume) {
        state.audio.volume = volume;

        if (elements.bgMusic) {
            elements.bgMusic.volume = volume;
        }

        // Update mute button icon based on volume
        if (elements.muteBtn && !state.audio.muted) {
            updateMuteButtonIcon(volume === 0);
        }
    }

    function updateVolumeSliderFill() {
        if (elements.volumeSlider) {
            var percent = elements.volumeSlider.value + '%';
            elements.volumeSlider.style.background = 'linear-gradient(to right, #b08b5a ' + percent + ', #d3c2a8 ' + percent + ')';
        }
    }

    // === Flag Management ===
    function setFlags(flags) {
        flags.forEach(function(flag) {
            state.flags[flag] = true;
        });
    }

    function checkFlags(required) {
        return required.every(function(flag) {
            return state.flags[flag] === true;
        });
    }

    function getFlag(flag) {
        return state.flags[flag] || false;
    }

    function clearFlags() {
        state.flags = {};
    }

    // === Inventory Management ===
    /**
     * Add items to player inventory
     * @param {string[]} items - Array of item names to add
     */
    function addItems(items) {
        items.forEach(function(item) {
            if (state.inventory.indexOf(item) === -1) {
                state.inventory.push(item);
                log.info('Added item: ' + item);
                showItemNotification(item, 'added');
            }
        });
        updateInventoryDisplay();
    }

    /**
     * Remove items from player inventory
     * @param {string[]} items - Array of item names to remove
     */
    function removeItems(items) {
        items.forEach(function(item) {
            var index = state.inventory.indexOf(item);
            if (index !== -1) {
                state.inventory.splice(index, 1);
                log.info('Removed item: ' + item);
                showItemNotification(item, 'used');
            }
        });
        updateInventoryDisplay();
    }

    /**
     * Check if player has specific items
     * @param {string[]} items - Array of item names to check
     * @returns {boolean} - True if player has all items
     */
    function hasItems(items) {
        return items.every(function(item) {
            return state.inventory.indexOf(item) !== -1;
        });
    }

    /**
     * Get a specific item from inventory (for display purposes)
     * @param {string} item - Item name
     * @returns {boolean} - True if player has the item
     */
    function hasItem(item) {
        return state.inventory.indexOf(item) !== -1;
    }

    /**
     * Clear all inventory items
     */
    function clearInventory() {
        state.inventory = [];
        updateInventoryDisplay();
    }

    /**
     * Show a floating notification when items are added/used
     * @param {string} item - Item name
     * @param {string} action - 'added' or 'used'
     */
    function showItemNotification(item, action) {
        var notification = document.createElement('div');
        notification.className = 'item-notification item-' + action;
        notification.innerHTML = action === 'added'
            ? '<span class="item-icon">+</span> ' + item
            : '<span class="item-icon">−</span> ' + item;

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
    function updateInventoryDisplay() {
        var inventoryContainer = document.getElementById('inventory-display');
        if (!inventoryContainer) return;

        if (state.inventory.length === 0) {
            inventoryContainer.style.display = 'none';
            return;
        }

        inventoryContainer.style.display = 'block';
        inventoryContainer.innerHTML = '<div class="inventory-label">Items:</div>';

        state.inventory.forEach(function(item) {
            var itemEl = document.createElement('span');
            itemEl.className = 'inventory-item';
            itemEl.textContent = item;
            inventoryContainer.appendChild(itemEl);
        });
    }

    // === HP Management ===
    /**
     * Initialize player HP (called when entering first battle)
     * @param {number} maxHP - Maximum HP value
     */
    function initPlayerHP(maxHP) {
        var defaultHP = typeof TUNING !== 'undefined' ? TUNING.player.defaultMaxHP : 20;
        state.playerMaxHP = maxHP || defaultHP;
        if (state.playerHP === null) {
            state.playerHP = state.playerMaxHP;
        }
        updatePlayerHPDisplay();
    }

    /**
     * Heal the player
     * @param {number} amount - Amount to heal
     */
    function healPlayer(amount) {
        if (state.playerHP === null) return;
        state.playerHP = Math.min(state.playerHP + amount, state.playerMaxHP);
        updatePlayerHPDisplay();
        showDamageNumber(amount, 'heal');
    }

    /**
     * Damage the player
     * @param {number} amount - Amount of damage
     * @returns {boolean} - True if player is still alive
     */
    function damagePlayer(amount) {
        if (state.playerHP === null) return true;
        state.playerHP = Math.max(state.playerHP - amount, 0);
        updatePlayerHPDisplay();
        showDamageNumber(amount, 'damage');
        flashSprite('player');
        return state.playerHP > 0;
    }

    /**
     * Update player HP bar display
     */
    function updatePlayerHPDisplay() {
        var hpBar = document.getElementById('player-hp-bar');
        var hpText = document.getElementById('player-hp-text');

        if (hpBar && state.playerHP !== null) {
            var percent = (state.playerHP / state.playerMaxHP) * 100;
            hpBar.style.width = percent + '%';

            // Color based on health
            if (percent > 50) {
                hpBar.className = 'hp-fill hp-high';
            } else if (percent > 25) {
                hpBar.className = 'hp-fill hp-medium';
            } else {
                hpBar.className = 'hp-fill hp-low';
            }
        }

        if (hpText && state.playerHP !== null) {
            hpText.textContent = state.playerHP + ' / ' + state.playerMaxHP;
        }
    }

    /**
     * Show floating damage/heal number
     * @param {number} amount - Amount to display
     * @param {string} type - 'damage' or 'heal'
     */
    function showDamageNumber(amount, type) {
        var container = document.getElementById('vn-container');
        if (!container) return;

        var damageNum = document.createElement('div');
        damageNum.className = 'damage-number ' + type;
        damageNum.textContent = type === 'heal' ? '+' + amount : '-' + amount;

        container.appendChild(damageNum);

        // Remove after animation
        setTimeout(function() {
            if (damageNum.parentNode) {
                damageNum.parentNode.removeChild(damageNum);
            }
        }, 1500);
    }

    /**
     * Flash a sprite (for damage feedback)
     * @param {string} target - 'player' or 'enemy'
     */
    function flashSprite(target) {
        var spriteLayer = elements.spriteLayer;
        if (!spriteLayer) return;

        var sprites = spriteLayer.querySelectorAll('img');
        sprites.forEach(function(sprite) {
            sprite.classList.add('damage-flash');
            setTimeout(function() {
                sprite.classList.remove('damage-flash');
            }, 300);
        });
    }

    // === Save/Load System ===
    /**
     * Validate save data structure to prevent crashes from corrupted saves
     * @param {Object} saveData - The parsed save data to validate
     * @returns {boolean} - True if valid, false otherwise
     */
    function isValidSaveData(saveData) {
        if (!saveData || typeof saveData !== 'object') {
            return false;
        }

        // currentSceneId must be a string or null
        if (saveData.currentSceneId !== null &&
            typeof saveData.currentSceneId !== 'string') {
            return false;
        }

        // currentBlockIndex must be a non-negative integer
        if (typeof saveData.currentBlockIndex !== 'undefined') {
            if (typeof saveData.currentBlockIndex !== 'number' ||
                saveData.currentBlockIndex < 0 ||
                !Number.isInteger(saveData.currentBlockIndex)) {
                return false;
            }
        }

        // flags must be an object (or undefined)
        if (saveData.flags !== undefined &&
            (typeof saveData.flags !== 'object' || Array.isArray(saveData.flags))) {
            return false;
        }

        // readBlocks must be an object (or undefined)
        if (saveData.readBlocks !== undefined &&
            (typeof saveData.readBlocks !== 'object' || Array.isArray(saveData.readBlocks))) {
            return false;
        }

        // history must be an array (or undefined)
        if (saveData.history !== undefined && !Array.isArray(saveData.history)) {
            return false;
        }

        return true;
    }

    function saveState() {
        try {
            var saveData = {
                currentSceneId: state.currentSceneId,
                currentBlockIndex: state.currentBlockIndex,
                flags: state.flags,
                inventory: state.inventory,
                playerHP: state.playerHP,
                playerMaxHP: state.playerMaxHP,
                readBlocks: state.readBlocks,
                history: state.history
            };
            log.debug('saveState: history=' + JSON.stringify(state.history));
            localStorage.setItem(config.saveKey, JSON.stringify(saveData));
        } catch (e) {
            log.warn('Could not save state: ' + e.message);
        }
    }

    function loadSavedState() {
        try {
            var saved = localStorage.getItem(config.saveKey);
            if (!saved) return false;

            var saveData = JSON.parse(saved);

            // Validate save data structure
            if (!isValidSaveData(saveData)) {
                log.warn('Invalid save data structure, clearing corrupted save');
                clearSavedState();
                return false;
            }

            // Restore state
            state.flags = saveData.flags || {};
            state.inventory = saveData.inventory || [];
            state.playerHP = saveData.playerHP !== undefined ? saveData.playerHP : null;
            var defaultMaxHP = typeof TUNING !== 'undefined' ? TUNING.player.defaultMaxHP : 20;
            state.playerMaxHP = saveData.playerMaxHP || defaultMaxHP;
            state.readBlocks = saveData.readBlocks || {};
            state.history = saveData.history || [];
            log.debug('loadSavedState: loaded history=' + JSON.stringify(state.history));

            // Update inventory and HP displays
            updateInventoryDisplay();
            if (state.playerHP !== null) {
                updatePlayerHPDisplay();
            }

            // If history is empty but we have a current scene, initialize history with it
            // (handles saves from before history was added)
            if (state.history.length === 0 && saveData.currentSceneId) {
                state.history = [saveData.currentSceneId];
            }

            // Update skip button visibility based on loaded read blocks
            updateSkipButtonVisibility();

            // Load the saved scene
            if (saveData.currentSceneId && story[saveData.currentSceneId]) {
                state.currentSceneId = saveData.currentSceneId;
                state.currentBlockIndex = saveData.currentBlockIndex || 0;

                // Render the scene at the saved position
                var scene = story[saveData.currentSceneId];
                var isEnding = !scene.choices || scene.choices.length === 0;
                state.processedTextBlocks = preprocessTextBlocks(scene.textBlocks || [], isEnding);
                state.isEndingScene = isEnding;

                // Render scene visuals
                if (scene.bg) {
                    setBackground(scene.bg);
                }
                if (scene.chars && scene.chars.length > 0) {
                    setCharacters(scene.chars);
                }
                var musicToPlay = scene.music || config.defaultMusic;
                setMusic(musicToPlay);

                // Update text box class for ending scenes
                var textBox = document.getElementById('text-box');
                if (textBox) {
                    if (isEnding) {
                        textBox.classList.add('ending-scene');
                    } else {
                        textBox.classList.remove('ending-scene');
                    }
                }

                renderCurrentBlock();
                return true;
            }
        } catch (e) {
            log.warn('Could not load saved state: ' + e.message);
        }
        return false;
    }

    function clearSavedState() {
        try {
            localStorage.removeItem(config.saveKey);
        } catch (e) {
            log.warn('Could not clear saved state: ' + e.message);
        }
    }

    function setupResetButton() {
        // Create reset button (touch-friendly 44x44 minimum)
        // All styles defined in shared.css #reset-btn, themes can override
        var resetBtn = document.createElement('button');
        resetBtn.id = 'reset-btn';
        resetBtn.textContent = '↺';
        resetBtn.title = 'Reset Progress';

        resetBtn.addEventListener('click', function() {
            if (confirm('Reset all progress? This will clear your saved game.')) {
                fullReset();
            }
        });

        document.body.appendChild(resetBtn);
    }

    // === Tap-to-Hide Feature ===
    function setupTapToHide() {
        var textBox = document.getElementById('text-box');
        var bgLayer = document.getElementById('background-layer');
        var spriteLayer = document.getElementById('sprite-layer');
        if (!textBox) return;

        // Click on background or sprite layer toggles text box
        function toggleTextBox(e) {
            textBox.classList.toggle('hidden-textbox');
            e.stopPropagation();
        }

        if (bgLayer) bgLayer.addEventListener('click', toggleTextBox);
        if (spriteLayer) spriteLayer.addEventListener('click', toggleTextBox);
    }

    // === Game Reset ===
    /**
     * Reset game state and restart from beginning
     * @param {boolean} clearReadHistory - If true, also clears read blocks and saved state
     */
    function resetGame(clearReadHistory) {
        // Reset core state
        state.currentSceneId = null;
        state.currentBlockIndex = 0;
        state.flags = {};
        state.inventory = [];
        state.playerHP = null;
        state.playerMaxHP = typeof TUNING !== 'undefined' ? TUNING.player.defaultMaxHP : 20;
        state.battle = null;
        state.history = [];

        // Update displays
        updateInventoryDisplay();

        // Hide and remove battle UI
        hideBattleUI();
        destroyBattleUI();

        // Reset BattleEngine if available
        if (typeof BattleEngine !== 'undefined') {
            BattleEngine.reset();
            BattleEngine.destroyUI();
        }

        // Ensure text box is visible after battle reset
        var textBox = document.getElementById('text-box');
        if (textBox) {
            textBox.style.display = '';
            textBox.classList.remove('hidden-textbox');
            textBox.classList.remove('battle-mode');
        }

        // Optionally clear read history (for full reset)
        if (clearReadHistory) {
            state.readBlocks = {};
            clearSavedState();
            updateSkipButtonVisibility();
        }

        // Clear visuals and audio
        clearBackground();
        clearCharacters();
        stopMusic();

        // Start fresh
        loadScene(config.startScene);
    }

    /**
     * Completely remove battle UI elements from DOM
     */
    function destroyBattleUI() {
        var playerHP = document.getElementById('player-hp-container');
        var enemyHP = document.getElementById('enemy-hp-container');
        var playerMana = document.getElementById('player-mana-container');

        if (playerHP && playerHP.parentNode) playerHP.parentNode.removeChild(playerHP);
        if (enemyHP && enemyHP.parentNode) enemyHP.parentNode.removeChild(enemyHP);
        if (playerMana && playerMana.parentNode) playerMana.parentNode.removeChild(playerMana);
    }

    function reset() {
        resetGame(false);
    }

    function fullReset() {
        resetGame(true);
    }

    // === Public API ===
    return {
        init: init,
        loadScene: loadScene,
        getState: function() { return state; },
        // Flag management
        getFlag: getFlag,
        setFlag: function(flag) { state.flags[flag] = true; },
        clearFlag: function(flag) { delete state.flags[flag]; },
        // Inventory management
        addItem: function(item) { addItems([item]); },
        removeItem: function(item) { removeItems([item]); },
        hasItem: hasItem,
        getInventory: function() { return state.inventory.slice(); },
        // HP management
        getHP: function() { return state.playerHP; },
        getMaxHP: function() { return state.playerMaxHP; },
        heal: healPlayer,
        damage: damagePlayer,
        initHP: initPlayerHP,
        // Game control
        reset: reset,
        registerActionHandler: function(type, handler) {
            actionHandlers[type] = handler;
        }
    };

})();

// Auto-initialize when DOM is ready
// Password screen must be completed before game starts
document.addEventListener('DOMContentLoaded', function() {
    // Check for ?scene= parameter (editor preview mode)
    var urlParams = new URLSearchParams(window.location.search);
    var previewScene = urlParams.get('scene');

    if (previewScene) {
        // Preview mode: skip password, hide overlay, load specific scene
        var passwordOverlay = document.getElementById('password-overlay');
        if (passwordOverlay) {
            passwordOverlay.classList.add('hidden');
        }
        VNEngine.init();
        // Override to load the preview scene
        VNEngine.loadScene(previewScene);
        return;
    }

    // Normal mode: check if password screen exists
    var passwordOverlay = document.getElementById('password-overlay');

    if (passwordOverlay && typeof PasswordScreen !== 'undefined') {
        // Initialize password screen, pass VNEngine.init as callback
        PasswordScreen.init(function() {
            VNEngine.init();
        });
    } else {
        // No password screen, start game directly
        VNEngine.init();
    }
});
