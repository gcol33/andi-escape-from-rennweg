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
    const config = {
        assetPaths: {
            bg: 'assets/bg/',
            char: 'assets/char/',
            music: 'assets/music/',
            sfx: 'assets/sfx/'
        },
        startScene: 'start',
        defaultMusic: 'default.mp3',  // fallback if scene has no music
        textSpeed: {
            normal: 18,  // milliseconds per character
            fast: 10,    // noticeably faster but still readable
            auto: 18,    // same as normal, but auto-advances
            skip: 0      // instant (only for read blocks)
        },
        autoDelay: 1500,        // ms to wait before auto-advancing
        skipModeDelay: 150,     // ms delay between blocks in skip mode
        currentSpeed: 'normal',
        saveKey: 'andi_vn_save',  // localStorage key for save data
        // Audio timing
        sfxPreDelay: 150,       // ms pause before playing entry SFX
        sfxPostDelay: 200,      // ms pause after SFX before text starts
        sfxMinDuration: 620,    // minimum total SFX duration in ms
        sfxRepeatGap: 150,      // gap between repeated SFX plays in ms
        sfxDuckVolume: 0.2,     // music volume during SFX (20% of normal)
        // Text block splitting
        maxBlockLength: 350     // max characters before auto-splitting text
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
        playerMaxHP: 20, // default max HP
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
            volume: 0.4
        },
        devMode: true,  // TODO: Set to false before release
        devKeysHeld: {},
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
            var roll1 = Math.floor(Math.random() * sides) + 1;
            var roll2 = Math.floor(Math.random() * sides) + 1;
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
            resultText += ' and got: <strong>' + result + '</strong>!';

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
         * Sets up enemy HP and battle state
         */
        start_battle: function(action) {
            var enemy = action.enemy || {};

            // Initialize player HP if not already set
            var playerMaxHP = action.player_max_hp || 20;
            if (state.playerHP === null) {
                state.playerHP = playerMaxHP;
                state.playerMaxHP = playerMaxHP;
            }

            // Set up battle state
            state.battle = {
                active: true,
                enemy: {
                    name: enemy.name || 'Enemy',
                    hp: enemy.hp || 20,
                    maxHP: enemy.hp || 20,
                    ac: enemy.ac || 10,
                    attackBonus: enemy.attack_bonus || 0,
                    damage: enemy.damage || 'd6',
                    sprite: enemy.sprite || null
                },
                player: {
                    ac: action.player_ac || 10,
                    attackBonus: action.player_attack_bonus || 0,
                    damage: action.player_damage || 'd6'
                },
                winTarget: action.win_target,
                loseTarget: action.lose_target,
                fleeTarget: action.flee_target || null
            };

            // Show battle UI
            showBattleUI();
            updateBattleDisplay();
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
            }, 300);
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
        }, 1500);
    }

    /**
     * Check if battle is over and handle victory/defeat
     * @returns {boolean} - True if battle ended
     */
    function checkBattleEnd() {
        if (!state.battle || !state.battle.active) return false;

        if (state.battle.enemy.hp <= 0) {
            // Victory!
            state.battle.active = false;
            playSfx('victory.ogg');

            setTimeout(function() {
                hideBattleUI();
                loadScene(state.battle.winTarget, '<div class="battle-result victory">Victory!</div>');
                state.battle = null;
            }, 1000);
            return true;
        }

        if (state.playerHP <= 0) {
            // Defeat
            state.battle.active = false;
            playSfx('failure.ogg');

            setTimeout(function() {
                hideBattleUI();
                loadScene(state.battle.loseTarget, '<div class="battle-result defeat">Defeated!</div>');
                state.battle = null;
            }, 1000);
            return true;
        }

        return false;
    }

    /**
     * Execute a battle action from a choice
     * @param {string} action - 'attack', 'defend', 'flee', or item use
     * @param {object} choice - The choice object with additional params
     */
    function executeBattleAction(action, choice) {
        if (!state.battle || !state.battle.active) return;

        var resultText = '';

        switch (action) {
            case 'attack':
                var playerResult = playerAttack();
                if (playerResult.crit) {
                    resultText = '<div class="battle-log">CRITICAL HIT! You deal <strong>' + playerResult.damage + '</strong> damage!</div>';
                } else if (playerResult.fumble) {
                    resultText = '<div class="battle-log">You fumble your attack!</div>';
                } else if (playerResult.hit) {
                    resultText = '<div class="battle-log">You hit for <strong>' + playerResult.damage + '</strong> damage!</div>';
                } else {
                    resultText = '<div class="battle-log">You miss! (Roll: ' + playerResult.roll + ' vs AC ' + state.battle.enemy.ac + ')</div>';
                }
                break;

            case 'defend':
                // Defending gives temporary AC bonus for enemy's turn
                state.battle.player.defending = true;
                state.battle.player.ac += 4;
                resultText = '<div class="battle-log">You brace for impact (+4 AC this turn).</div>';
                break;

            case 'flee':
                // Flee attempt - Athletics check vs DC 14
                var fleeRoll = Math.floor(Math.random() * 20) + 1;
                if (fleeRoll >= 14 && state.battle.fleeTarget) {
                    state.battle.active = false;
                    hideBattleUI();
                    loadScene(state.battle.fleeTarget, '<div class="battle-result">You escaped!</div>');
                    state.battle = null;
                    return;
                } else {
                    resultText = '<div class="battle-log">You failed to escape! (Roll: ' + fleeRoll + ')</div>';
                }
                break;

            case 'item':
                // Use item (heals specified in choice)
                if (choice && choice.heals) {
                    healPlayer(choice.heals);
                    showBattleDamageNumber(choice.heals, 'player', 'heal');
                    resultText = '<div class="battle-log">You heal for <strong>' + choice.heals + '</strong> HP!</div>';
                }
                break;
        }

        // Check if player won
        if (checkBattleEnd()) return;

        // Enemy turn (after a short delay)
        setTimeout(function() {
            if (!state.battle || !state.battle.active) return;

            var enemyResult = enemyAttack();
            var enemyText = '';

            if (enemyResult.crit) {
                enemyText = '<div class="battle-log enemy-turn">' + state.battle.enemy.name + ' lands a CRITICAL HIT for <strong>' + enemyResult.damage + '</strong> damage!</div>';
            } else if (enemyResult.fumble) {
                enemyText = '<div class="battle-log enemy-turn">' + state.battle.enemy.name + ' fumbles!</div>';
            } else if (enemyResult.hit) {
                enemyText = '<div class="battle-log enemy-turn">' + state.battle.enemy.name + ' hits you for <strong>' + enemyResult.damage + '</strong> damage!</div>';
            } else {
                enemyText = '<div class="battle-log enemy-turn">' + state.battle.enemy.name + ' misses!</div>';
            }

            // Reset defending status
            if (state.battle && state.battle.player.defending) {
                state.battle.player.ac -= 4;
                state.battle.player.defending = false;
            }

            // Check if battle ended
            if (!checkBattleEnd()) {
                // Continue battle - update text and show choices again
                var scene = story[state.currentSceneId];
                if (scene) {
                    elements.storyOutput.innerHTML = resultText + enemyText;
                    renderBattleChoices(scene.battle_actions || scene.choices);
                }
            }
        }, 800);
    }

    /**
     * Render battle action choices
     * @param {array} choices - Battle choices from scene
     */
    function renderBattleChoices(choices) {
        elements.choicesContainer.innerHTML = '';

        if (!choices || !state.battle || !state.battle.active) return;

        // Filter choices by item requirements
        var availableChoices = choices.filter(function(choice) {
            if (choice.require_items && choice.require_items.length > 0) {
                return hasItems(choice.require_items);
            }
            return true;
        });

        availableChoices.forEach(function(choice) {
            var button = document.createElement('button');
            button.className = 'choice-button battle-action';

            var labelText = choice.label;
            if (choice.uses && choice.uses.length > 0) {
                labelText += ' [Uses: ' + choice.uses.join(', ') + ']';
            }
            if (choice.heals) {
                labelText += ' [+' + choice.heals + ' HP]';
            }
            button.textContent = labelText;

            button.onclick = function() {
                // Consume items if specified
                if (choice.uses && choice.uses.length > 0) {
                    removeItems(choice.uses);
                }

                // Execute the battle action
                var action = choice.battle_action || 'attack';
                executeBattleAction(action, choice);
            };

            elements.choicesContainer.appendChild(button);
        });
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
                indicator.style.cssText = 'position: fixed; top: 10px; right: 10px; background: #00ff00; color: #000; padding: 5px 10px; font-size: 12px; font-weight: bold; border-radius: 3px; z-index: 9999;';
                document.body.appendChild(indicator);
            }
            indicator.style.display = 'block';

            // Show theme selector in dev mode
            if (!themeSelector) {
                createThemeSelector();
            } else {
                themeSelector.classList.add('visible');
            }

            // Add undo button to text controls
            addUndoButton();
        } else {
            if (indicator) {
                indicator.style.display = 'none';
            }
            // Hide theme selector
            if (themeSelector) {
                themeSelector.classList.remove('visible');
            }

            // Remove undo button from text controls
            removeUndoButton();
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
        kenBurnsContainer.style.marginTop = '8px';

        var kenBurnsLabel = document.createElement('label');
        kenBurnsLabel.style.cursor = 'pointer';

        var kenBurnsCheckbox = document.createElement('input');
        kenBurnsCheckbox.type = 'checkbox';
        kenBurnsCheckbox.id = 'ken-burns-toggle';
        kenBurnsCheckbox.checked = state.kenBurns;
        kenBurnsCheckbox.style.marginRight = '6px';

        kenBurnsCheckbox.addEventListener('change', function() {
            state.kenBurns = this.checked;
            applyKenBurns(this.checked);
            // Save preference
            try {
                localStorage.setItem('andi_vn_ken_burns', this.checked ? 'true' : 'false');
            } catch (e) {}
        });

        // Load saved preference
        try {
            var saved = localStorage.getItem('andi_vn_ken_burns');
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

        document.body.appendChild(container);
    }

    /**
     * Go back one text block, or to previous scene if at first block (dev mode only)
     */
    function undoScene() {
        console.log('undoScene: blockIndex=', state.currentBlockIndex, 'scene=', state.currentSceneId, 'historyLen=', state.history.length);

        if (!state.devMode) {
            flashUndoError();
            return false;
        }

        // Stop any ongoing typewriter effect
        stopTypewriter();

        // If we're past the first text block, go back one block
        if (state.currentBlockIndex > 0) {
            console.log('Going back one text block');
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
        if (state.history.length <= 1) {
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
            // Flash red
            undoBtn.style.backgroundColor = '#c44';
            undoBtn.style.color = '#fff';
            undoBtn.style.borderColor = '#c44';

            setTimeout(function() {
                undoBtn.style.backgroundColor = '';
                undoBtn.style.color = '';
                undoBtn.style.borderColor = '';
            }, 300);
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
        var savedTheme = localStorage.getItem('andi_vn_theme');
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
            localStorage.setItem('andi_vn_theme', themeName);
            log.info('Theme changed to: ' + themeName);
        }
    }

    // === Scene Loading ===
    function loadScene(sceneId, prependContent, entrySfx) {
        prependContent = prependContent || '';

        // Check for special roll trigger
        if (sceneId === '_roll') {
            executeActions();
            return;
        }

        var scene = story[sceneId];

        if (!scene) {
            log.error('Scene not found: ' + sceneId);
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

        // Hide continue button and choices while typing
        hideContinueButton();
        elements.choicesContainer.innerHTML = '';

        // Render text with callback
        renderText(currentText, prependContent, function() {
            if (isLastBlock) {
                // Check for actions
                if (scene.actions && scene.actions.length > 0) {
                    // Show the roll choice if there's a _roll target in choices
                    var hasRollChoice = scene.choices && scene.choices.some(function(c) {
                        return c.target === '_roll';
                    });
                    if (hasRollChoice) {
                        renderChoices(scene.choices);
                    } else {
                        // Execute actions directly
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
            // Filter choices by required flags AND required items
            var availableChoices = choices.filter(function(choice) {
                // Check flag requirements
                if (choice.require_flags && choice.require_flags.length > 0) {
                    if (!checkFlags(choice.require_flags)) return false;
                }
                // Check item requirements
                if (choice.require_items && choice.require_items.length > 0) {
                    if (!hasItems(choice.require_items)) return false;
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

        if (handler) {
            handler(action);
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
            elements.backgroundLayer.style.backgroundImage = 'url(' + path + ')';
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

        if (hasPositioning) {
            // New format: sprites with x/y positions
            // Switch to absolute positioning mode
            elements.spriteLayer.style.display = 'block';

            chars.forEach(function(char) {
                var img = document.createElement('img');
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

                img.src = config.assetPaths.char + filename;
                img.alt = filename;
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
                var img = document.createElement('img');
                img.src = config.assetPaths.char + filename;
                img.alt = filename;
                elements.spriteLayer.appendChild(img);
            });
        }
    }

    function clearCharacters() {
        if (elements.spriteLayer) {
            elements.spriteLayer.innerHTML = '';
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
        state.playerMaxHP = maxHP || 20;
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
            console.log('saveState: history=', state.history.slice()); // Debug
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
            state.playerMaxHP = saveData.playerMaxHP || 20;
            state.readBlocks = saveData.readBlocks || {};
            state.history = saveData.history || [];
            console.log('loadSavedState: loaded history=', state.history.slice()); // Debug

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
        // Position is handled by CSS: bottom-right on desktop, top-right on mobile
        var resetBtn = document.createElement('button');
        resetBtn.id = 'reset-btn';
        resetBtn.textContent = '↺';
        resetBtn.title = 'Reset Progress';
        // Touch-friendly sizing: 44x44px minimum tap target (position handled by CSS)
        resetBtn.style.cssText = 'position: fixed; width: 44px; height: 44px; background: rgba(176, 139, 90, 0.8); color: #fffbe9; border: none; border-radius: 50%; font-size: 20px; cursor: pointer; z-index: 1000; transition: background 0.2s, transform 0.1s; -webkit-tap-highlight-color: rgba(143, 111, 70, 0.5); user-select: none; -webkit-user-select: none; bottom: 10px; right: 10px;';

        resetBtn.addEventListener('mouseenter', function() {
            this.style.background = '#8f6f46';
        });
        resetBtn.addEventListener('mouseleave', function() {
            this.style.background = 'rgba(176, 139, 90, 0.8)';
        });
        // Active state for touch feedback
        resetBtn.addEventListener('touchstart', function() {
            this.style.background = '#8f6f46';
            this.style.transform = 'scale(0.95)';
        }, { passive: true });
        resetBtn.addEventListener('touchend', function() {
            this.style.background = 'rgba(176, 139, 90, 0.8)';
            this.style.transform = 'scale(1)';
        }, { passive: true });
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
        state.playerMaxHP = 20;
        state.history = [];

        // Update displays
        updateInventoryDisplay();

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
