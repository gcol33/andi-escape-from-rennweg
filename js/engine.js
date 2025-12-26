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

var VNEngine = (function() {
    'use strict';

    // === Configuration ===
    // Many values now sourced from TUNING.js for centralized game feel tuning
    var config = {
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
        // Text display mode from TUNING ('expanding' or 'fixed')
        textDisplayMode: typeof TUNING !== 'undefined' && TUNING.text.displayMode ? TUNING.text.displayMode : 'expanding',
        fixedLines: typeof TUNING !== 'undefined' && TUNING.text.fixedLines ? TUNING.text.fixedLines : 3,
        // UI timing from TUNING
        timing: {
            errorFlash: typeof TUNING !== 'undefined' && TUNING.ui ? TUNING.ui.errorFlash : 300,
            damageNumber: typeof TUNING !== 'undefined' && TUNING.ui ? TUNING.ui.damageNumberDuration : 1500,
            spriteFlash: typeof TUNING !== 'undefined' ? TUNING.battle.effects.spriteFlash : 300,
            hintTypewriterDelay: typeof TUNING !== 'undefined' && TUNING.ui ? TUNING.ui.hintTypewriterDelay : 300,
            hintTypewriterSpeed: typeof TUNING !== 'undefined' && TUNING.ui ? TUNING.ui.hintTypewriterSpeed : 45,
            hintCardRevealDelay: typeof TUNING !== 'undefined' && TUNING.ui ? TUNING.ui.hintCardRevealDelay : 500,
            tarotCardRevealDelay: typeof TUNING !== 'undefined' && TUNING.ui ? TUNING.ui.tarotCardRevealDelay : 400,
            tarotCardFlipDuration: typeof TUNING !== 'undefined' && TUNING.ui ? TUNING.ui.tarotCardFlipDuration : 600,
            choiceButtonDelay: typeof TUNING !== 'undefined' && TUNING.ui ? TUNING.ui.choiceButtonDelay : 300
        }
    };

    // === Logging Utilities ===
    // Use Logger module with fallback via Utils
    var _log = Utils.getLogger();

    // === Touch Device Detection ===
    // Detect if the device primarily uses touch input
    function isTouchDevice() {
        return ('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0) ||
               (navigator.msMaxTouchPoints > 0) ||
               (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
    }

    // === State ===
    var state = {
        currentSceneId: null,
        currentBlockIndex: 0,
        // Flags are now managed by flagManager (see js/managers/flag-manager.js)
        inventory: {
            keyItems: [],      // unique key items (no count) - persist across Play Again
            consumables: {},   // consumable items with counts { "Coffee": 2, "Snack": 1 } - cleared on Play Again
            skills: []         // learned skills/abilities (persist across soft reset)
        },
        inventoryExpanded: false, // UI state for expandable panel
        playerHP: null, // player HP (null until first battle)
        playerMaxHP: typeof TUNING !== 'undefined' ? TUNING.player.defaultMaxHP : 20,
        playerMana: null, // player Mana (null until first battle)
        playerMaxMana: typeof TUNING !== 'undefined' ? TUNING.player.defaultMaxMana : 20,
        battle: null, // active battle state
        history: [],
        readBlocks: {}, // tracks which scene+block combos have been read
        wonBattles: {}, // tracks which battles have been won (by sceneId)
        // Pagination state for fixed-height text mode
        pagination: {
            active: false,       // true when current block has multiple pages
            pages: [],           // array of text chunks for current block
            currentPage: 0,      // index of currently displayed page
            fullText: ''         // complete text of current block (before pagination)
        },
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
        devMode: false,  // Hold q+w+e+r+t to toggle dev mode
        devKeysHeld: {},
        devForcedRoll: null,  // Dev mode: force next hit roll to this value (null = random)
        devForcedDamage: null,  // Dev mode: force next damage roll to this value (null = random)
        devGuaranteeStatus: false,  // Dev mode: 100% status effect application
        devIntentsEnabled: true,  // Dev mode: enable/disable intent system
        kenBurns: false,  // Subtle zoom effect on backgrounds (Apple-style)
        currentBackground: null  // Track current background to avoid Ken Burns reset on same bg
    };

    // === Engine API for Modules ===
    // This object is passed to modules during initialization.
    // It provides access to core engine functions without exposing internals.
    var engineAPI = {
        // Scene navigation
        loadScene: function(sceneId, prefixText) {
            return loadScene(sceneId, prefixText);
        },
        getCurrentScene: function() {
            return state.currentSceneId;
        },

        // Audio
        playSfx: function(file) {
            return playSfx(file);
        },

        // Inventory
        getInventory: function() {
            return state.inventory;
        },
        hasItem: function(item) {
            return hasItem(item);
        },
        removeItem: function(item) {
            removeItems([item]);
        },
        hasSkill: function(skill) {
            return hasSkill(skill);
        },
        hasSkills: function() {
            return hasSkills();
        },

        // Player stats
        getPlayerStats: function() {
            return {
                hp: state.playerHP,
                maxHP: state.playerMaxHP,
                mana: state.playerMana,
                maxMana: state.playerMaxMana
            };
        },
        setPlayerStats: function(stats) {
            if (stats.hp !== undefined) state.playerHP = stats.hp;
            if (stats.maxHP !== undefined) state.playerMaxHP = stats.maxHP;
            if (stats.mana !== undefined) state.playerMana = stats.mana;
            if (stats.maxMana !== undefined) state.playerMaxMana = stats.maxMana;
        },

        // State
        getState: function() {
            return state;
        },
        setBattleActive: function(active) {
            state.battle = active ? { active: true } : null;
        },
        markBattleWon: function(sceneId) {
            state.wonBattles[sceneId] = true;
        },

        // Action registration
        registerAction: function(type, handler) {
            actionHandlers[type] = handler;
        },

        // Dev mode
        isDevMode: function() {
            return state.devMode === true;
        },
        getDevForcedRoll: function() {
            return state.devMode ? state.devForcedRoll : null;
        },
        getDevForcedDamage: function() {
            return state.devMode ? state.devForcedDamage : null;
        },
        getDevGuaranteeStatus: function() {
            return state.devMode && state.devGuaranteeStatus;
        },
        getDevIntentsEnabled: function() {
            return state.devIntentsEnabled;
        },

        // Logging
        log: _log
    };

    // === Action Handler Registry ===
    var actionHandlers = {
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
                _log.debug('Engine','Using forced dice roll: ' + forcedRoll);
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

            // Build result display using TextRenderer if available
            var resultText;
            if (typeof TextRenderer !== 'undefined') {
                resultText = TextRenderer.formatDiceResult({
                    roll: result,
                    sides: sides,
                    isCrit: isCrit,
                    isFumble: isFumble
                }, {
                    success: success,
                    skillName: skillName,
                    rollDescription: rollDescription,
                    critText: critText,
                    fumbleText: fumbleText
                });
            } else {
                // Fallback for when TextRenderer is not loaded
                var skillLabel = skillName ? '<div class="skill-check-label">' + skillName + ' Check</div>' : '';
                var resultClass = success ? 'dice-success' : 'dice-failure';
                var critClass = isCrit ? ' dice-crit' : (isFumble ? ' dice-fumble' : '');

                resultText = '<div class="dice-roll ' + resultClass + critClass + '">';
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
            }

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
         *
         * Security: Uses allowlist to prevent arbitrary function execution
         * Add new custom handlers to customHandlerAllowlist below
         */
        custom: function(action) {
            var handlerName = action.handler;
            var params = action.params || {};

            // Allowlist of safe custom handler names
            // Add new custom handlers here as they are created
            var customHandlerAllowlist = {
                'showSpecialEvent': true,
                'showTutorial': true,
                'unlockAchievement': true,
                'showCutscene': true,
                'triggerMinigame': true
            };

            // Check allowlist first
            if (!customHandlerAllowlist[handlerName]) {
                _log.error('Engine', 'Custom handler not in allowlist: ' + handlerName);
                return;
            }

            if (typeof window[handlerName] === 'function') {
                window[handlerName](params, state);
            } else {
                _log.warn('Engine','Custom handler not found: ' + handlerName);
            }
        },

        // NOTE: start_battle and start_quiz actions are provided by their respective modules
        // (js/modules/battle/index.js and js/modules/quiz/index.js)
        // The ModuleRegistry fallback in executeActions() handles these.

        /**
         * Reset game state action handler
         * Resets flags, inventory, HP etc.
         * Used for "wake up" scenes after bad endings
         *
         * Supports:
         * - full: true for full reset, false (default) for soft reset
         * - target: scene to navigate to after reset (with delay for click/input)
         * - delay: ms to wait before navigating (default 1500, or 0 for immediate)
         */
        reset: function(action) {
            var fullReset = action.full || false;
            var target = action.target || null;
            var delay = action.delay !== undefined ? action.delay : 1500;

            // Reset core state (but don't change scene yet)
            state.currentBlockIndex = 0;

            // Flags are always cleared on reset (via flagManager)
            if (typeof flagManager !== 'undefined') {
                flagManager.clearAll();
            }

            // Skills and key items persist across soft reset (New Game+ style)
            // Consumables are cleared on soft reset
            // Full reset clears everything including skills, key items, quiz progress
            if (fullReset) {
                state.inventory = { keyItems: [], consumables: {}, skills: [] };
                if (typeof flagManager !== 'undefined') {
                    flagManager.clearAllKey();
                }
                // Clear quiz seen answers
                if (typeof QuizEngine !== 'undefined' && QuizEngine.clearSeenAnswers) {
                    QuizEngine.clearSeenAnswers();
                }
            } else {
                // Keep skills and key items, clear only consumables
                state.inventory.consumables = {};
                // keyItems are preserved
                // skills are preserved
            }

            // Always clear read history on any reset (so "(read)" indicator doesn't appear)
            state.readBlocks = {};
            updateSkipButtonVisibility();

            // Reset HP/Mana and battle state
            state.playerHP = null;
            state.playerMaxHP = typeof TUNING !== 'undefined' ? TUNING.player.defaultMaxHP : 20;
            state.playerMana = null;
            state.playerMaxMana = typeof TUNING !== 'undefined' ? TUNING.player.defaultMaxMana : 20;
            state.battle = null;
            state.history = [];

            // Update displays
            updateInventoryDisplay();
            hideBattleUI();
            destroyBattleUI();

            // Reset BattleEngine if available
            if (typeof BattleEngine !== 'undefined') {
                BattleEngine.reset();
                BattleEngine.destroyUI();
            }

            // Ensure text box is visible
            var textBox = document.getElementById('text-box');
            if (textBox) {
                textBox.style.display = '';
                textBox.classList.remove('hidden-textbox');
                textBox.classList.remove('battle-mode');
            }

            _log.info('Engine','Game state reset' + (fullReset ? ' (full)' : ' (soft)'));
        },

        /**
         * Fade to scene action handler
         * Fades background to target scene's background, then auto-continues
         *
         * Supports:
         * - target: scene to navigate to after fade
         * - duration: fade duration in ms (default 1000)
         */
        fade_to_scene: function(action) {
            var target = action.target;
            var duration = action.duration || 1000;

            if (!target) {
                _log.error('Engine','fade_to_scene: no target specified');
                return;
            }

            var targetScene = story[target];
            if (!targetScene) {
                _log.error('Engine','fade_to_scene: target scene not found: ' + target);
                return;
            }

            var bgLayer = elements.backgroundLayer;
            if (!bgLayer) {
                // No background layer, just navigate
                loadScene(target);
                return;
            }

            // Fade out current background
            bgLayer.classList.add('fading');

            // After fade out, change background and fade in
            setTimeout(function() {
                // Set the new background
                if (targetScene.bg) {
                    var path = config.assetPaths.bg + targetScene.bg;
                    bgLayer.style.backgroundImage = 'url("' + path + '")';
                }

                // Fade in
                bgLayer.classList.remove('fading');

                // After fade in complete, navigate to target
                setTimeout(function() {
                    loadScene(target);
                }, duration);
            }, duration);
        },

        /**
         * Wake sequence action handler
         * Shows "..." → waits → erases → shows wake text + random flavor → "Wake up" button → fade to target
         *
         * Uses TimerManager for proper cleanup if sequence is aborted.
         *
         * Supports:
         * - target: scene to navigate to after wake up
         * - fade_duration: fade duration in ms (default 1000)
         * - wait_duration: time to show "..." before erasing (default 1500)
         */
        wake_sequence: function(action) {
            var target = action.target || 'start';
            var totalFadeDuration = action.fade_duration || 4000;  // Total fade across whole sequence
            var waitDuration = action.wait_duration || 1500;

            var targetScene = story[target];
            if (!targetScene) {
                _log.error('Engine','wake_sequence: target scene not found: ' + target);
                return;
            }

            // Abort token - allows cancellation if player navigates away
            var sequenceAborted = false;
            var sequenceId = state.currentSceneId;  // Track which scene started this

            // Helper to check if sequence should continue
            function isSequenceActive() {
                return !sequenceAborted && state.currentSceneId === sequenceId;
            }

            // Get random flavor from current scene
            var currentScene = story[state.currentSceneId];
            var flavorText = '';
            if (currentScene && currentScene.random_flavor && currentScene.random_flavor.length > 0) {
                flavorText = Utils.pickRandom(currentScene.random_flavor);
            }

            // Hide choices container during sequence
            if (elements.choicesContainer) {
                elements.choicesContainer.innerHTML = '';
            }

            var bgLayer = elements.backgroundLayer;
            var fadeOverlay = document.getElementById('fade-overlay');

            // Step 1: Show "..." with typewriter effect
            renderText('...', '', function() {
                if (!isSequenceActive()) return;  // Abort check

                // Step 2: Fade from black to target background
                if (fadeOverlay && targetScene.bg) {
                    // Start with black overlay visible (we're on black.svg)
                    fadeOverlay.style.transition = 'none';
                    fadeOverlay.classList.add('fade-visible');

                    // Preload target background
                    var targetPath = config.assetPaths.bg + targetScene.bg;
                    var preloadImg = new Image();
                    preloadImg.onload = function() {
                        if (!isSequenceActive()) return;  // Abort check

                        // Set new background while hidden behind black overlay
                        bgLayer.style.backgroundImage = 'url("' + targetPath + '")';

                        // Small delay to ensure background is rendered - use TimerManager
                        if (typeof TimerManager !== 'undefined') {
                            TimerManager.setTimeout(function() {
                                if (!isSequenceActive()) return;
                                // Now fade out the black overlay to reveal the new bg
                                fadeOverlay.style.transition = 'opacity ' + (totalFadeDuration / 1000) + 's ease-in-out';
                                fadeOverlay.classList.remove('fade-visible');
                            }, 50, 'wake');
                        } else {
                            setTimeout(function() {
                                if (!isSequenceActive()) return;
                                fadeOverlay.style.transition = 'opacity ' + (totalFadeDuration / 1000) + 's ease-in-out';
                                fadeOverlay.classList.remove('fade-visible');
                            }, 50);
                        }
                    };
                    preloadImg.src = targetPath;
                }

                // Step 3: After wait, show wake text (while bg is fading) - use TimerManager
                var scheduleWakeText = function() {
                    if (!isSequenceActive()) return;

                    var wakeText = 'Your eyes open.';
                    if (flavorText) {
                        wakeText += ' ' + flavorText;
                    }

                    // If player has skills or key items from a previous run, show a recap
                    var hasSkills = state.inventory.skills && state.inventory.skills.length > 0;
                    var hasKeyItems = state.inventory.keyItems && state.inventory.keyItems.length > 0;

                    if (hasSkills || hasKeyItems) {
                        wakeText += '\n\n';
                        if (hasSkills) {
                            var skillList = state.inventory.skills.join(', ');
                            wakeText += '*You remember what you learned: ' + skillList + '.*';
                        }
                        if (hasSkills && hasKeyItems) {
                            wakeText += '\n';
                        }
                        if (hasKeyItems) {
                            var itemList = state.inventory.keyItems.join(', ');
                            wakeText += '*You still have: ' + itemList + '.*';
                        }
                    }

                    renderText(wakeText, '', function() {
                        if (!isSequenceActive()) return;  // Abort check

                        // Step 4: Show "Wake up" button after text completes
                        if (elements.choicesContainer) {
                            var wakeButton = document.createElement('button');
                            wakeButton.className = 'choice-button';
                            wakeButton.textContent = 'Wake up';
                            wakeButton.onclick = function() {
                                // Mark sequence as done
                                sequenceAborted = true;
                                // Clean up any remaining wake timers
                                if (typeof TimerManager !== 'undefined') {
                                    TimerManager.clearAll('wake');
                                }
                                // Disable button
                                wakeButton.disabled = true;
                                wakeButton.style.opacity = '0.5';

                                // Navigate to target immediately
                                loadScene(target);
                            };
                            elements.choicesContainer.appendChild(wakeButton);
                        }
                    });
                };

                if (typeof TimerManager !== 'undefined') {
                    TimerManager.setTimeout(scheduleWakeText, waitDuration, 'wake');
                } else {
                    setTimeout(scheduleWakeText, waitDuration);
                }
            });
        },

        /**
         * Draw a tarot card action handler
         * Franz draws a card that hints at undiscovered items/skills
         * The card is randomly selected from cards whose requirements aren't met
         *
         * Config:
         * - target: Scene to navigate to after viewing the card
         * - ready_target: Scene to navigate to if player has everything (optional)
         */
        /**
         * Draw a 3-card tarot spread
         * Franz lays out 3 cards, reveals them one by one with flavor text,
         * then provides a combined interpretation/hint
         *
         * Config:
         * - target: Scene to navigate to after the reading
         * - ready_target: Scene if player has everything (optional)
         */
        draw_tarot: function(action) {
            var target = action.target;
            var readyTarget = action.ready_target;

            // Define tarot cards with their requirements, flavor text, and hints
            var tarotCards = [
                // === PARTY / ROOFTOP CATEGORY ===
                {
                    name: 'The Tower',
                    image: 'the_tower.svg',
                    check: function() { return !hasSkill('Rooftop Discovery'); },
                    flavor: 'A structure reaching toward the heavens... struck by sudden illumination. What was hidden becomes visible from above.',
                    hint: 'The gathering above... you must first witness it from the high place with a furry friend.',
                    category: 'party'
                },
                {
                    name: 'The Sun',
                    image: 'the_sun.svg',
                    check: function() { return !hasSkill('Smile'); },
                    flavor: 'Radiant warmth that melts all coldness. The face that welcomes is the face that belongs.',
                    hint: 'One must know how to smile. Seek the one who teaches genuine joy.',
                    category: 'party'
                },
                // === KNOWLEDGE CATEGORY ===
                {
                    name: 'The Hierophant',
                    image: 'the_hierophant.svg',
                    check: function() { return !checkFlags(['has_flora_book']); },
                    flavor: 'The keeper of ancient wisdom, holding sacred texts. Knowledge passed through trials.',
                    hint: 'A book from one who tests you on journeys through the city... prove your botanical worth.',
                    category: 'knowledge'
                },
                {
                    name: 'The Hermit',
                    image: 'the_hermit.svg',
                    check: function() { return !hasSkill('Floristic Knowledge'); },
                    flavor: 'The wanderer with lantern raised, illuminating paths through wilderness unknown.',
                    hint: 'Wisdom from one who leads excursions into the wild. Seek the wandering teacher.',
                    category: 'knowledge'
                },
                {
                    name: 'The Magician',
                    image: 'the_magician.svg',
                    check: function() { return !checkFlags(['has_magnifying_glass']); },
                    flavor: 'Tools of transformation laid upon the table. The power to see what others cannot.',
                    hint: 'The glass that magnifies... the whiteboard keeper guards it.',
                    category: 'knowledge'
                },
                // === SUPPLIES CATEGORY ===
                {
                    name: 'The Chariot',
                    image: 'the_chariot.svg',
                    check: function() { return !checkFlags(['has_charcoal']); },
                    flavor: 'Forward motion, driven by opposing forces united. The fuel for the journey ahead.',
                    hint: 'Black rocks from the market of Billa, that temple of commerce.',
                    category: 'supplies'
                },
                {
                    name: 'The Star',
                    image: 'the_star.svg',
                    check: function() { return !checkFlags(['has_lighter']); },
                    flavor: 'A spark of hope in darkness. The eternal flame that ignites new beginnings.',
                    hint: 'The spark of flame awaits at the smokers\' corner.',
                    category: 'supplies'
                },
                {
                    name: 'Temperance',
                    image: 'temperance.svg',
                    check: function() { return !checkFlags(['has_beer']); },
                    flavor: 'The blending of elements, the flow between vessels. Celebration shared among companions.',
                    hint: 'The golden liquid of friendship from the dice rollers below.',
                    category: 'supplies'
                }
            ];

            // Filter to only cards for things player is missing
            var availableCards = tarotCards.filter(function(card) {
                return card.check();
            });

            // Get the VN container
            var vnContainer = document.getElementById('vn-container');
            if (!vnContainer) return;

            // If player has everything, navigate to ready target
            if (availableCards.length === 0) {
                if (readyTarget) {
                    loadScene(readyTarget);
                    return;
                }
                // Show The World card as single centered card
                var readyOverlay = document.createElement('div');
                readyOverlay.className = 'tarot-overlay tarot-ready';
                readyOverlay.innerHTML =
                    '<div class="tarot-spread-cards" style="justify-content: center;">' +
                        '<div class="tarot-card-slot">' +
                            '<div class="tarot-card-flip flipped">' +
                                '<div class="tarot-card-inner">' +
                                    '<div class="tarot-card-back"><img src="assets/tarot/card_back.svg" alt="Card Back"></div>' +
                                    '<div class="tarot-card-front"><img src="assets/tarot/the_world.svg" alt="The World"></div>' +
                                '</div>' +
                            '</div>' +
                            '<div class="tarot-card-name show">The World</div>' +
                            '<div class="tarot-card-flavor show">Your journey of preparation is complete.</div>' +
                        '</div>' +
                    '</div>' +
                    '<button class="tarot-continue show">Continue</button>';
                vnContainer.appendChild(readyOverlay);
                readyOverlay.querySelector('.tarot-continue').onclick = function() {
                    readyOverlay.remove();
                    loadScene(target);
                };
                return;
            }

            // Shuffle available cards
            for (var i = availableCards.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = availableCards[i];
                availableCards[i] = availableCards[j];
                availableCards[j] = temp;
            }

            // Pick ONE primary card - this determines the hint
            var primaryCard = availableCards[0];
            var theHint = primaryCard.hint;

            // Build display cards: primary card + 2 others for visual variety
            // Use ALL tarot cards (not just missing ones) for the other 2 slots
            var allOtherCards = tarotCards.filter(function(c) { return c !== primaryCard; });
            // Shuffle other cards
            for (var k = allOtherCards.length - 1; k > 0; k--) {
                var m = Math.floor(Math.random() * (k + 1));
                var tmp = allOtherCards[k];
                allOtherCards[k] = allOtherCards[m];
                allOtherCards[m] = tmp;
            }

            // Select 3 cards: primary + 2 random others
            var selectedCards = [primaryCard];
            selectedCards.push(allOtherCards[0] || primaryCard);
            selectedCards.push(allOtherCards[1] || primaryCard);

            // Shuffle the 3 cards so primary isn't always first
            for (var n = selectedCards.length - 1; n > 0; n--) {
                var p = Math.floor(Math.random() * (n + 1));
                var t = selectedCards[n];
                selectedCards[n] = selectedCards[p];
                selectedCards[p] = t;
            }

            // Play mystical sound effect
            playSfx('dice_roll.ogg');

            // Create the tarot overlay
            var overlay = document.createElement('div');
            overlay.className = 'tarot-overlay';
            overlay.id = 'tarot-overlay';

            // Build the 3-card spread HTML
            var spreadHTML = '<div class="tarot-click-hint">Click to reveal</div>';
            spreadHTML += '<div class="tarot-spread-cards">';
            selectedCards.forEach(function(card, index) {
                spreadHTML += '<div class="tarot-card-slot" data-index="' + index + '">';
                spreadHTML += '<div class="tarot-card-flip" id="tarot-card-' + index + '">';
                spreadHTML += '<div class="tarot-card-inner">';
                spreadHTML += '<div class="tarot-card-back"><img src="assets/tarot/card_back.svg" alt="Card Back"></div>';
                spreadHTML += '<div class="tarot-card-front"><img src="assets/tarot/' + card.image + '" alt="' + card.name + '"></div>';
                spreadHTML += '</div></div>';
                spreadHTML += '<div class="tarot-card-name">' + card.name + '</div>';
                spreadHTML += '<div class="tarot-card-flavor">' + card.flavor + '</div>';
                spreadHTML += '</div>';
            });
            spreadHTML += '</div>';
            spreadHTML += '<button class="tarot-continue">Continue</button>';

            overlay.innerHTML = spreadHTML;
            vnContainer.appendChild(overlay);

            // Set up the sequential reveal
            var slots = overlay.querySelectorAll('.tarot-card-slot');
            var continueBtn = overlay.querySelector('.tarot-continue');
            var currentIndex = 0;

            // Check if portrait mode
            var isPortrait = window.matchMedia('(orientation: portrait)').matches;

            function revealNext() {
                if (currentIndex >= slots.length) {
                    // All cards revealed, show continue button
                    continueBtn.classList.add('show');
                    overlay.style.cursor = 'default';
                    return;
                }

                var slot = slots[currentIndex];
                var cardFlip = slot.querySelector('.tarot-card-flip');
                var cardName = slot.querySelector('.tarot-card-name');
                var cardFlavor = slot.querySelector('.tarot-card-flavor');

                // In portrait mode, reveal cards one at a time (but keep all visible)
                if (isPortrait) {
                    slot.classList.add('active');
                }

                // Flip the card
                if (cardFlip) {
                    cardFlip.classList.add('flipped');
                    playSfx('dice_roll.ogg');
                }

                // Show name and flavor after flip animation
                var isLastCard = (currentIndex === slots.length - 1);
                setTimeout(function() {
                    if (cardName) cardName.classList.add('show');
                    if (cardFlavor) cardFlavor.classList.add('show');
                    // Show continue button after last card's text appears
                    if (isLastCard) {
                        setTimeout(function() {
                            continueBtn.classList.add('show');
                            overlay.style.cursor = 'default';
                        }, config.timing.tarotCardRevealDelay);
                    }
                }, config.timing.tarotCardFlipDuration);

                currentIndex++;
            }

            // Click anywhere on overlay to reveal next card
            var clickHint = overlay.querySelector('.tarot-click-hint');
            overlay.onclick = function(e) {
                if (e.target.tagName === 'BUTTON') return;
                if (currentIndex < slots.length) {
                    // Hide click hint on first reveal
                    if (clickHint && currentIndex === 0) {
                        clickHint.classList.add('hidden');
                    }
                    revealNext();
                }
            };

            // Continue button shows hint screen
            continueBtn.onclick = function(e) {
                e.stopPropagation();
                overlay.remove();

                // Show hint screen with typewriter effect (reveal-based for centered text)
                var hintScreen = document.createElement('div');
                hintScreen.className = 'tarot-hint-screen';

                // Wrap each character in a span for reveal effect
                var wrappedChars = '';
                for (var ci = 0; ci < theHint.length; ci++) {
                    var ch = theHint[ci];
                    if (ch === ' ') {
                        wrappedChars += ' ';
                    } else {
                        wrappedChars += '<span class="hint-char">' + ch + '</span>';
                    }
                }

                hintScreen.innerHTML =
                    '<div class="tarot-hint-text">' + wrappedChars + '</div>' +
                    '<button class="tarot-hint-continue">Continue</button>';
                vnContainer.appendChild(hintScreen);

                var hintTextEl = hintScreen.querySelector('.tarot-hint-text');
                var charSpans = hintTextEl.querySelectorAll('.hint-char');
                var hintContinueBtn = hintScreen.querySelector('.tarot-hint-continue');
                hintContinueBtn.style.opacity = '0';
                hintContinueBtn.style.pointerEvents = 'none';

                // Typewriter: reveal characters one at a time
                var hintIndex = 0;
                var hintSpeed = config.timing.hintTypewriterSpeed;

                function revealNextChar() {
                    if (hintIndex < charSpans.length) {
                        charSpans[hintIndex].classList.add('visible');
                        hintIndex++;
                        setTimeout(revealNextChar, hintSpeed);
                    } else {
                        // Done typing, show continue button
                        hintContinueBtn.style.opacity = '1';
                        hintContinueBtn.style.pointerEvents = 'auto';
                    }
                }

                // Start typewriter after a brief pause
                setTimeout(revealNextChar, config.timing.hintTypewriterDelay);

                // Click to skip typewriter
                hintScreen.onclick = function(ev) {
                    if (ev.target.tagName === 'BUTTON') return;
                    if (hintIndex < charSpans.length) {
                        // Reveal all remaining
                        for (var ri = hintIndex; ri < charSpans.length; ri++) {
                            charSpans[ri].classList.add('visible');
                        }
                        hintIndex = charSpans.length;
                        hintContinueBtn.style.opacity = '1';
                        hintContinueBtn.style.pointerEvents = 'auto';
                    }
                };

                hintContinueBtn.onclick = function(evnt) {
                    evnt.stopPropagation();
                    hintScreen.remove();
                    loadScene(target);
                };
            };

            // Cards start face-down, user clicks to reveal each one
            // Add visual hint that cards are clickable
            overlay.style.cursor = 'pointer';
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
     * Mark a battle as won (for skip feature)
     * @param {string} sceneId - The scene ID where the battle occurred
     */
    function markBattleWon(sceneId) {
        state.wonBattles[sceneId] = true;
        saveState();
        syncToStore();
        _log.debug('Engine','Battle marked as won: ' + sceneId);
    }

    /**
     * Check if a battle has been won before
     * @param {string} sceneId - The scene ID to check
     * @returns {boolean}
     */
    function hasBattleBeenWon(sceneId) {
        return state.wonBattles[sceneId] === true;
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
            Utils.removeElement(damageNum);
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
                Utils.removeElement(document.getElementById('skill-submenu'));

                // Remove any item submenu that might be open
                Utils.removeElement(document.getElementById('item-submenu'));

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

                // Sync HP/Mana state
                var stats = BattleEngine.getPlayerStats();
                state.playerHP = stats.hp;
                state.playerMaxHP = stats.maxHP;
                state.playerMana = stats.mana;
                state.playerMaxMana = stats.maxMana;
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
            _log.warn('Engine','Battle choices container not found');
            return;
        }

        // Ensure container is visible (may have been hidden by skill submenu)
        battleChoicesContainer.style.display = '';

        battleChoicesContainer.innerHTML = '';

        // Remove any existing skill submenu
        Utils.removeElement(document.getElementById('skill-submenu'));

        if (!choices) return;

        // Filter choices by skill requirements, item requirements, and items to use
        var availableChoices = choices.filter(function(choice) {
            // Check skill requirements
            if (choice.require_skills && choice.require_skills.length > 0) {
                if (!hasSkills(choice.require_skills)) return false;
            }
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

            // Determine if button should be disabled
            // Two conditions: NOT player's turn, OR specific cooldowns (defend)
            var shouldDisable = false;

            if (typeof BattleCore !== 'undefined') {
                var player = BattleCore.getPlayer();
                var playerTurn = BattleCore.isPlayerTurn();

                // Rule 1: Disable all buttons if it's NOT the player's turn
                if (!playerTurn) {
                    shouldDisable = true;
                }

                // Rule 2: Player-specific cooldowns (even on player turn)
                if (player) {
                    // If player is in defensive stance, disable all buttons
                    if (player.defending && player.defending > 0) {
                        shouldDisable = true;
                        // Show cooldown on defend button
                        if (action === 'defend' && player.defendCooldown > 0) {
                            labelText += ' (' + player.defendCooldown + ')';
                        }
                    }
                    // Defend button has its own cooldown
                    else if (action === 'defend' && player.defendCooldown > 0) {
                        shouldDisable = true;
                        labelText += ' (' + player.defendCooldown + ')';
                    }
                }
            }

            // Apply disabled state
            if (shouldDisable) {
                button.classList.add('on-cooldown');
                button.disabled = true;
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

        _log.debug('Engine', '[Skill Menu] Opened with mana:', currentMana, 'skills:', playerSkills.map(function(s) {
            return { name: s.name, cost: s.manaCost, canUse: s.canUse };
        }));

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
                (function(skillData, skillElement) {
                    skillElement.onclick = function() {
                        // Re-check mana at click time to prevent race conditions
                        var currentState = BattleEngine.getState();
                        var currentMana = currentState.player.mana;
                        if (currentMana < skillData.manaCost) {
                            _log.warn('Engine', '[Skill] Mana desync detected!', {
                                skill: skillData.name,
                                skillCost: skillData.manaCost,
                                displayedCanUse: skillData.canUse,
                                actualMana: currentMana,
                                phase: currentState.phase,
                                turn: currentState.turn,
                                playerDefending: currentState.player.defending,
                                playerStatuses: currentState.player.statuses
                            });

                            // Show feedback - update this button to disabled state
                            skillElement.classList.add('disabled');
                            var costSpan = skillElement.querySelector('.skill-cost');
                            if (costSpan) costSpan.classList.add('insufficient');

                            // Show message in battle log
                            var battleLogContent = document.getElementById('battle-log-content');
                            if (battleLogContent) {
                                battleLogContent.innerHTML = '<div class="battle-log-messages"><span class="battle-message-fail">Not enough MP!</span></div>';
                            }

                            // Play fail sound
                            if (typeof BattleEngine !== 'undefined' && BattleEngine.playSfx) {
                                BattleEngine.playSfx('negative');
                            }

                            return; // Don't execute - mana changed since menu was shown
                        }

                        // Remove submenu and restore battle log content
                        Utils.removeElement(document.getElementById('skill-submenu'));
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
                        executeBattleAction('skill', { skillId: skillData.id });
                    };
                })(skill, skillItem);
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
            Utils.removeElement(document.getElementById('skill-submenu'));
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
            Utils.removeElement(existingMenu);
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
                Utils.removeElement(document.getElementById('item-submenu'));
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
            Utils.removeElement(document.getElementById('item-submenu'));
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
        setupTextDisplayMode();  // Set fixed or expanding text mode
        setupClickToSkip();
        setupSpeedControls();
        setupContinueButton();
        setupMuteButton();
        setupFirstInteraction();
        setupResetButton();
        setupTapToHide();

        // Initialize dev panel module
        if (typeof DevPanel !== 'undefined') {
            DevPanel.init({
                onUndo: undoScene,
                getDevMode: function() { return state.devMode; },
                setDevMode: function(val) { state.devMode = val; },
                getKenBurns: function() { return state.kenBurns; },
                setKenBurns: function(val) {
                    state.kenBurns = val;
                    applyKenBurns(val);
                    try {
                        localStorage.setItem(config.kenBurnsKey, val ? 'true' : 'false');
                    } catch (e) {}
                },
                getGuaranteeStatus: function() { return state.devGuaranteeStatus; },
                setGuaranteeStatus: function(val) { state.devGuaranteeStatus = val; },
                getIntentsEnabled: function() { return state.devIntentsEnabled; },
                setIntentsEnabled: function(val) { state.devIntentsEnabled = val; },
                getForcedRoll: function() { return state.devForcedRoll; },
                setForcedRoll: function(val) { state.devForcedRoll = val; },
                getForcedDamage: function() { return state.devForcedDamage; },
                setForcedDamage: function(val) { state.devForcedDamage = val; },
                loadScene: loadScene,
                getCurrentScene: function() { return state.currentSceneId; },
                log: _log
            });
        }

        // Initialize engine modules
        if (typeof AudioManager !== 'undefined') {
            AudioManager.init({
                assetPaths: config.assetPaths,
                defaultMusic: config.defaultMusic,
                sfxDuckVolume: config.sfxDuckVolume,
                sfxMinDuration: config.sfxMinDuration,
                sfxRepeatGap: config.sfxRepeatGap,
                sfxPreDelay: config.sfxPreDelay,
                sfxPostDelay: config.sfxPostDelay
            });
        }

        if (typeof InventoryManager !== 'undefined') {
            InventoryManager.init();
            // Note: Flags are now managed by flagManager, not passed as refs
            // engine-inventory.js is legacy - engine.js uses its own updateInventoryDisplay()
        }

        if (typeof SaveManager !== 'undefined') {
            SaveManager.init({
                saveKey: config.saveKey,
                themeKey: config.themeKey,
                kenBurnsKey: config.kenBurnsKey
            });
        }

        // Initialize new architecture managers (Phase 9 migration)
        // These coexist with legacy managers during gradual migration
        if (typeof sceneManager !== 'undefined' && typeof story !== 'undefined') {
            sceneManager.init(story);
            _log.debug('Engine', 'SceneManager initialized with story data');
        }

        // Initialize optional modules via ModuleRegistry
        // Modules register themselves when their scripts load.
        // This call initializes all registered modules in dependency order.
        if (typeof ModuleRegistry !== 'undefined') {
            ModuleRegistry.initAll(engineAPI);
            _log.debug('Engine', 'Modules initialized: ' + ModuleRegistry.listInitialized().join(', '));
        }

        // Listen for module events
        if (typeof eventBus !== 'undefined') {
            // Battle module emits this when battle UI is ready for choices
            eventBus.on('battle:ready', function(data) {
                var scene = story[data.sceneId || state.currentSceneId];
                if (scene && scene.choices) {
                    renderBattleChoices(scene.choices);
                }
            });
        }

        // Show dev mode indicator if enabled by default
        if (state.devMode) {
            showDevModeIndicator(true);
        }

        // Try to load saved state
        if (!loadSavedState()) {
            // No save found, start fresh
            loadScene(config.startScene);
        }

        // Reveal text box now that content is loaded (prevents flash of empty content)
        var textBox = document.getElementById('text-box');
        if (textBox) {
            textBox.classList.add('engine-ready');
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
        // Click/tap anywhere on VN container to skip typewriter
        var vnContainer = document.getElementById('vn-container');
        var clickTarget = vnContainer || document.getElementById('text-box') || elements.storyOutput;

        clickTarget.addEventListener('click', function(e) {
            // Don't skip if clicking on a button or input
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
            skipTypewriter();
        });

        // Touch event for better mobile response (fires before click)
        clickTarget.addEventListener('touchend', function(e) {
            // Don't skip if touching a button or input
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
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

    /**
     * Make an element draggable by a handle
     * @param {HTMLElement} element - The element to make draggable
     * @param {HTMLElement} handle - The drag handle element
     */
    function makeDraggable(element, handle) {
        var isDragging = false;
        var offsetX = 0;
        var offsetY = 0;

        handle.addEventListener('mousedown', startDrag);
        handle.addEventListener('touchstart', startDrag, { passive: false });

        function startDrag(e) {
            // Don't drag if clicking on interactive elements
            if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') {
                return;
            }

            isDragging = true;
            element.classList.add('dragging');

            var clientX = e.touches ? e.touches[0].clientX : e.clientX;
            var clientY = e.touches ? e.touches[0].clientY : e.clientY;

            var rect = element.getBoundingClientRect();
            offsetX = clientX - rect.left;
            offsetY = clientY - rect.top;

            // Switch to fixed positioning for dragging
            element.style.position = 'fixed';
            element.style.right = 'auto';
            element.style.left = rect.left + 'px';
            element.style.top = rect.top + 'px';

            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', stopDrag);
            document.addEventListener('touchmove', drag, { passive: false });
            document.addEventListener('touchend', stopDrag);

            e.preventDefault();
        }

        function drag(e) {
            if (!isDragging) return;

            var clientX = e.touches ? e.touches[0].clientX : e.clientX;
            var clientY = e.touches ? e.touches[0].clientY : e.clientY;

            var newX = clientX - offsetX;
            var newY = clientY - offsetY;

            // Keep within viewport bounds
            var rect = element.getBoundingClientRect();
            var maxX = window.innerWidth - rect.width;
            var maxY = window.innerHeight - rect.height;

            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));

            element.style.left = newX + 'px';
            element.style.top = newY + 'px';

            e.preventDefault();
        }

        function stopDrag() {
            if (!isDragging) return;
            isDragging = false;
            element.classList.remove('dragging');

            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('touchmove', drag);
            document.removeEventListener('touchend', stopDrag);

            // Save position to localStorage
            try {
                localStorage.setItem('andi_dev_panel_pos', JSON.stringify({
                    left: element.style.left,
                    top: element.style.top
                }));
            } catch (e) {}
        }

        // Restore saved position
        try {
            var saved = localStorage.getItem('andi_dev_panel_pos');
            if (saved) {
                var pos = JSON.parse(saved);
                element.style.position = 'fixed';
                element.style.right = 'auto';
                element.style.left = pos.left;
                element.style.top = pos.top;
            }
        } catch (e) {}
    }

    function showDevModeIndicator(show) {
        // Delegate to DevPanel module if available
        if (typeof DevPanel !== 'undefined') {
            DevPanel.show(show);
            return;
        }

        // Fallback: legacy code (kept for backwards compatibility)
        var indicator = document.getElementById('dev-mode-indicator');
        var themeSelector = document.getElementById('theme-selector');

        if (show) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'dev-mode-indicator';
                indicator.textContent = 'DEV MODE';
                document.body.appendChild(indicator);

                indicator.addEventListener('click', function() {
                    toggleDevPanelPortrait();
                });
            }
            indicator.classList.add('visible');

            if (!themeSelector) {
                createThemeSelector();
            } else {
                themeSelector.classList.add('visible');
            }

            addUndoButton();
        } else {
            if (indicator) {
                indicator.classList.remove('visible');
                indicator.classList.remove('expanded');
            }
            if (themeSelector) {
                themeSelector.classList.remove('visible');
                themeSelector.classList.remove('portrait-expanded');
            }

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
        Utils.removeElement(document.getElementById('dev-undo-btn'));
    }

    function createThemeSelector() {
        // Only create if ThemeUtils and themeConfig exist
        if (typeof ThemeUtils === 'undefined' || typeof themeConfig === 'undefined' || !themeConfig.available) {
            return;
        }

        // Apply saved theme on load (if different from current)
        var currentTheme = ThemeUtils.getCurrentTheme();
        var link = document.getElementById('theme-css');
        if (link && link.href) {
            var activeTheme = link.href.match(/themes\/([^.]+)\.css/);
            if (activeTheme && activeTheme[1] !== currentTheme) {
                ThemeUtils.setTheme(currentTheme);
            }
        }

        var container = document.createElement('div');
        container.id = 'theme-selector';
        container.classList.add('visible');
        // No inline styles - let CSS handle theming

        // Add draggable header with collapse button
        var dragHeader = document.createElement('div');
        dragHeader.className = 'dev-drag-header';

        var headerText = document.createElement('span');
        headerText.textContent = '⋮⋮ Dev Panel';
        headerText.className = 'dev-header-text';
        dragHeader.appendChild(headerText);

        var collapseBtn = document.createElement('button');
        collapseBtn.className = 'dev-collapse-btn';
        collapseBtn.textContent = '−';
        collapseBtn.title = 'Collapse/Expand';
        collapseBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            container.classList.toggle('collapsed');
            collapseBtn.textContent = container.classList.contains('collapsed') ? '+' : '−';
            localStorage.setItem('devPanelCollapsed', container.classList.contains('collapsed'));
        });
        dragHeader.appendChild(collapseBtn);

        // Restore collapsed state
        if (localStorage.getItem('devPanelCollapsed') === 'true') {
            container.classList.add('collapsed');
            collapseBtn.textContent = '+';
        }

        dragHeader.title = 'Drag to move';
        container.appendChild(dragHeader);

        // Make panel draggable
        makeDraggable(container, dragHeader);

        var label = document.createElement('label');
        label.textContent = 'Theme: ';

        var select = document.createElement('select');
        select.id = 'theme-select';
        // No inline styles - let CSS handle theming

        ThemeUtils.getAvailableThemes().forEach(function(theme) {
            var option = document.createElement('option');
            option.value = theme;
            option.textContent = theme;
            if (theme === currentTheme) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        select.addEventListener('change', function() {
            ThemeUtils.setTheme(this.value);
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

        // Forced hit roll input
        var hitRollContainer = document.createElement('div');
        hitRollContainer.className = 'forced-roll-container';

        var hitRollLabel = document.createElement('label');
        hitRollLabel.htmlFor = 'forced-hit-input';
        hitRollLabel.textContent = 'Hit Roll: ';

        var hitRollInput = document.createElement('input');
        hitRollInput.type = 'number';
        hitRollInput.id = 'forced-hit-input';
        hitRollInput.min = '1';
        hitRollInput.max = '20';
        hitRollInput.placeholder = 'rand';
        hitRollInput.title = 'Force next d20 hit roll (1-20). Leave empty for random.';

        hitRollInput.addEventListener('input', function() {
            var val = this.value.trim();
            if (val === '') {
                state.devForcedRoll = null;
                _log.debug('Engine','Forced hit roll cleared - using random');
            } else {
                var num = parseInt(val, 10);
                if (!isNaN(num) && num >= 1 && num <= 20) {
                    state.devForcedRoll = num;
                    _log.debug('Engine','Forced hit roll set to: ' + num);
                } else {
                    state.devForcedRoll = null;
                }
            }
        });

        hitRollContainer.appendChild(hitRollLabel);
        hitRollContainer.appendChild(hitRollInput);
        container.appendChild(hitRollContainer);

        // Forced damage roll input
        var damageRollContainer = document.createElement('div');
        damageRollContainer.className = 'forced-roll-container';

        var damageRollLabel = document.createElement('label');
        damageRollLabel.htmlFor = 'forced-damage-input';
        damageRollLabel.textContent = 'Damage Roll: ';

        var damageRollInput = document.createElement('input');
        damageRollInput.type = 'number';
        damageRollInput.id = 'forced-damage-input';
        damageRollInput.min = '1';
        damageRollInput.max = '99';
        damageRollInput.placeholder = 'rand';
        damageRollInput.title = 'Force next damage roll (1-99). Leave empty for random.';

        damageRollInput.addEventListener('input', function() {
            var val = this.value.trim();
            if (val === '') {
                state.devForcedDamage = null;
                _log.debug('Engine','Forced damage roll cleared - using random');
            } else {
                var num = parseInt(val, 10);
                if (!isNaN(num) && num >= 1 && num <= 99) {
                    state.devForcedDamage = num;
                    _log.debug('Engine','Forced damage roll set to: ' + num);
                } else {
                    state.devForcedDamage = null;
                }
            }
        });

        damageRollContainer.appendChild(damageRollLabel);
        damageRollContainer.appendChild(damageRollInput);
        container.appendChild(damageRollContainer);

        // Guarantee status effects checkbox
        var statusContainer = document.createElement('div');
        statusContainer.className = 'guarantee-status-container';

        var statusLabel = document.createElement('label');

        var statusCheckbox = document.createElement('input');
        statusCheckbox.type = 'checkbox';
        statusCheckbox.id = 'guarantee-status-toggle';
        statusCheckbox.checked = state.devGuaranteeStatus;

        statusCheckbox.addEventListener('change', function() {
            state.devGuaranteeStatus = this.checked;
            _log.debug('Engine','Guarantee status effects: ' + this.checked);
        });

        statusLabel.appendChild(statusCheckbox);
        statusLabel.appendChild(document.createTextNode('100% Status Effects'));

        statusContainer.appendChild(statusLabel);
        container.appendChild(statusContainer);

        // Enable Intents toggle
        var intentsContainer = document.createElement('div');
        intentsContainer.className = 'ken-burns-toggle-container';

        var intentsLabel = document.createElement('label');

        var intentsCheckbox = document.createElement('input');
        intentsCheckbox.type = 'checkbox';
        intentsCheckbox.id = 'enable-intents-toggle';
        intentsCheckbox.checked = state.devIntentsEnabled;

        intentsCheckbox.addEventListener('change', function() {
            state.devIntentsEnabled = this.checked;
            _log.debug('Engine','Intents enabled: ' + this.checked);
            // Update battle system if available
            if (typeof BattleEngine !== 'undefined' && BattleEngine.setIntentsEnabled) {
                BattleEngine.setIntentsEnabled(this.checked);
            }
        });

        intentsLabel.appendChild(intentsCheckbox);
        intentsLabel.appendChild(document.createTextNode('Enable Intents'));

        intentsContainer.appendChild(intentsLabel);
        container.appendChild(intentsContainer);

        // Battle dev controls section
        var battleSection = document.createElement('div');
        battleSection.className = 'dev-battle-section';
        battleSection.innerHTML = '<div class="dev-section-title">Intent Controls</div>';

        // Intent buttons - each has Trigger (prep phase) and Execute (immediate) modes
        var intentButtons = [
            { id: 'termination_notice', label: 'Big Attack', icon: '⚠', color: '#ff6600' },
            { id: 'policy_barrage', label: 'Multi-Hit', icon: '⚔', color: '#ff3333' },
            { id: 'call_intern', label: 'Summon', icon: '✦', color: '#9966ff' }
        ];

        intentButtons.forEach(function(intent) {
            var row = document.createElement('div');
            row.className = 'dev-intent-row';

            // Trigger button (prep phase - shows icon, announces, executes next turn)
            var triggerBtn = document.createElement('button');
            triggerBtn.type = 'button';
            triggerBtn.className = 'dev-intent-btn dev-intent-trigger';
            triggerBtn.textContent = intent.icon + ' ' + intent.label;
            triggerBtn.style.borderLeftColor = intent.color;
            triggerBtn.title = 'Trigger intent prep phase (announces, shows icon, executes next turn)';
            triggerBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof BattleEngine !== 'undefined' && BattleEngine.devTriggerIntent) {
                    var result = BattleEngine.devTriggerIntent(intent.id);
                    _log.debug('Engine','[Dev] ' + result.message);
                    if (!result.success) {
                        _log.warn('Engine',result.message);
                    }
                } else {
                    _log.warn('Engine','Battle not active or devTriggerIntent not available');
                }
            });

            // Execute button (immediate execution)
            var execBtn = document.createElement('button');
            execBtn.type = 'button';
            execBtn.className = 'dev-intent-btn dev-intent-exec';
            execBtn.textContent = '▶';
            execBtn.style.borderLeftColor = intent.color;
            execBtn.title = 'Execute immediately (skip prep phase)';
            execBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof BattleEngine !== 'undefined' && BattleEngine.devForceIntent) {
                    var result = BattleEngine.devForceIntent(intent.id);
                    _log.debug('Engine','[Dev] ' + result.message);
                    if (!result.success) {
                        _log.warn('Engine',result.message);
                    }
                } else {
                    _log.warn('Engine','Battle not active');
                }
            });

            row.appendChild(triggerBtn);
            row.appendChild(execBtn);
            battleSection.appendChild(row);
        });

        // Quick action buttons
        var quickActions = document.createElement('div');
        quickActions.className = 'dev-quick-actions';

        var healBtn = document.createElement('button');
        healBtn.type = 'button';
        healBtn.className = 'dev-quick-btn';
        healBtn.textContent = '💚 Heal';
        healBtn.title = 'Full heal player';
        healBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof BattleEngine !== 'undefined' && BattleEngine.healPlayer) {
                var state = BattleEngine.getState();
                if (state && state.player) {
                    BattleEngine.healPlayer(state.player.maxHP);
                    _log.debug('Engine','[Dev] Healed player to full HP');
                }
            }
        });

        var killBtn = document.createElement('button');
        killBtn.type = 'button';
        killBtn.className = 'dev-quick-btn';
        killBtn.textContent = '💀 Kill';
        killBtn.title = 'Kill enemy instantly';
        killBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof BattleCore !== 'undefined') {
                var enemy = BattleCore.getEnemy();
                if (enemy) {
                    BattleCore.damageEnemy(enemy.hp);
                    _log.debug('Engine','[Dev] Killed enemy');
                }
            }
        });

        var manaBtn = document.createElement('button');
        manaBtn.type = 'button';
        manaBtn.className = 'dev-quick-btn';
        manaBtn.textContent = '💙 Mana';
        manaBtn.title = 'Full mana restore';
        manaBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof BattleEngine !== 'undefined' && BattleEngine.restoreMana) {
                BattleEngine.restoreMana(100);
                _log.debug('Engine','[Dev] Restored full mana');
            }
        });

        quickActions.appendChild(healBtn);
        quickActions.appendChild(killBtn);
        quickActions.appendChild(manaBtn);
        battleSection.appendChild(quickActions);

        container.appendChild(battleSection);

        // Scene jump section
        var sceneSection = document.createElement('div');
        sceneSection.className = 'dev-scene-section';
        sceneSection.innerHTML = '<div class="dev-section-title">Jump to Scene</div>';

        var sceneSearchContainer = document.createElement('div');
        sceneSearchContainer.className = 'scene-search-container';

        var sceneInput = document.createElement('input');
        sceneInput.type = 'text';
        sceneInput.id = 'scene-search-input';
        sceneInput.placeholder = 'Search scenes...';
        sceneInput.autocomplete = 'off';

        var sceneDropdown = document.createElement('div');
        sceneDropdown.id = 'scene-search-dropdown';
        sceneDropdown.className = 'scene-search-dropdown';

        // Get all scene IDs
        function getSceneIds() {
            if (typeof story !== 'undefined') {
                return Object.keys(story).sort();
            }
            return [];
        }

        function filterScenes(query) {
            var scenes = getSceneIds();
            if (!query) return scenes.slice(0, 15); // Show first 15 when empty
            query = query.toLowerCase();
            return scenes.filter(function(id) {
                return id.toLowerCase().indexOf(query) !== -1;
            }).slice(0, 15);
        }

        function renderDropdown(scenes) {
            sceneDropdown.innerHTML = '';
            if (scenes.length === 0) {
                sceneDropdown.innerHTML = '<div class="scene-search-empty">No scenes found</div>';
                sceneDropdown.classList.add('visible');
                return;
            }
            scenes.forEach(function(sceneId) {
                var item = document.createElement('div');
                item.className = 'scene-search-item';
                item.textContent = sceneId;
                // Highlight if it's the current scene
                if (sceneId === state.currentSceneId) {
                    item.classList.add('current');
                }
                item.addEventListener('click', function() {
                    jumpToScene(sceneId);
                    sceneDropdown.classList.remove('visible');
                    sceneInput.value = '';
                });
                sceneDropdown.appendChild(item);
            });
            sceneDropdown.classList.add('visible');
        }

        function jumpToScene(sceneId) {
            if (!story[sceneId]) {
                _log.warn('Engine','Scene not found: ' + sceneId);
                return;
            }
            // End any active battle
            if (typeof BattleEngine !== 'undefined' && BattleEngine.isActive()) {
                BattleEngine.reset();
            }
            // Navigate to scene
            _log.debug('Engine','[Dev] Jumping to scene: ' + sceneId);
            loadScene(sceneId);
        }

        sceneInput.addEventListener('input', function() {
            var filtered = filterScenes(this.value);
            renderDropdown(filtered);
        });

        sceneInput.addEventListener('focus', function() {
            var filtered = filterScenes(this.value);
            renderDropdown(filtered);
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!sceneSearchContainer.contains(e.target)) {
                sceneDropdown.classList.remove('visible');
            }
        });

        // Handle enter key to jump to first match
        sceneInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                var filtered = filterScenes(this.value);
                if (filtered.length > 0) {
                    jumpToScene(filtered[0]);
                    sceneDropdown.classList.remove('visible');
                    sceneInput.value = '';
                }
            } else if (e.key === 'Escape') {
                sceneDropdown.classList.remove('visible');
                sceneInput.blur();
            }
        });

        sceneSearchContainer.appendChild(sceneInput);
        sceneSearchContainer.appendChild(sceneDropdown);
        sceneSection.appendChild(sceneSearchContainer);
        container.appendChild(sceneSection);

        document.body.appendChild(container);
    }

    /**
     * Go back one text block, or to previous scene if at first block (dev mode only)
     */
    function undoScene() {
        _log.debug('Engine','undoScene: blockIndex=' + state.currentBlockIndex + ', scene=' + state.currentSceneId + ', historyLen=' + state.history.length);

        if (!state.devMode) {
            flashUndoError();
            return false;
        }

        // If battle is active or was active, end it and clean up
        if (typeof BattleEngine !== 'undefined') {
            if (BattleEngine.isActive()) {
                _log.debug('Engine','Undo during active battle - ending battle');
                BattleEngine.reset();  // reset() calls destroyUI() and showTextBox()
            } else {
                // Even if battle is not "active", UI elements might persist
                // Always clean up to be safe when undoing
                _log.debug('Engine','Undo after battle - cleaning up battle UI');
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
            _log.debug('Engine','Going back one text block');
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
                syncToStore();
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
        // For scenes with actions (battles, dice rolls), show Continue button instead of choices
        // This lets the user read the text before the action triggers
        var currentText = textBlocks[state.currentBlockIndex] || '';
        var hasActions = scene.actions && scene.actions.length > 0;
        var hasRollChoice = scene.choices && scene.choices.some(function(c) {
            return c.target === '_roll';
        });

        renderText(currentText, '', function() {
            if (hasActions && !hasRollChoice) {
                // Check if this is a battle that has been won before
                var battleAction = scene.actions.find(function(a) { return a.type === 'start_battle'; });
                var isBattleWon = battleAction && hasBattleBeenWon(state.currentSceneId);

                if (isBattleWon) {
                    // Show Skip Battle / Fight!! buttons
                    showBattleSkipButtons(
                        function onSkip() {
                            // Skip battle - go directly to win scene
                            if (battleAction.win) {
                                loadScene(battleAction.win);
                            }
                        },
                        function onFight() {
                            // Fight battle normally
                            executeActions();
                        }
                    );

                    // Auto-skip if in skip mode
                    if (config.currentSpeed === 'skip') {
                        setTimeout(function() {
                            if (battleAction.win) {
                                var choicesContainer = document.getElementById('choices');
                                if (choicesContainer) {
                                    choicesContainer.innerHTML = '';
                                }
                                loadScene(battleAction.win);
                            }
                        }, 300); // Small delay to show buttons briefly
                    }
                } else {
                    // Normal battle flow - show Continue to trigger them
                    showContinueButton();
                    // Override Continue behavior to call renderCurrentBlock (which executes actions)
                    // Note: continueBtn normally calls advanceTextBlock which does nothing on last block
                    // We use a one-time handler to trigger actions
                    var continueBtn = elements.continueBtn;
                    var oneTimeHandler = function() {
                        continueBtn.removeEventListener('click', oneTimeHandler);
                        hideContinueButton();
                        executeActions();
                    };
                    continueBtn.addEventListener('click', oneTimeHandler);
                }
            } else if (hasRollChoice) {
                // Has _roll choice - show choices normally
                renderChoices(scene.choices);
                hideContinueButton();
            } else if (scene.choices && scene.choices.length > 0) {
                // Normal scene - show choices
                renderChoices(scene.choices);
                hideContinueButton();
            } else {
                hideContinueButton();
            }
        });

        saveState();
        syncToStore();
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
        // Delegate to ThemeUtils if available
        if (typeof ThemeUtils !== 'undefined') {
            return ThemeUtils.getCurrentTheme();
        }
        // Fallback for backwards compatibility
        var savedTheme = localStorage.getItem(config.themeKey);
        if (savedTheme && typeof themeConfig !== 'undefined' &&
            themeConfig.available && themeConfig.available.indexOf(savedTheme) !== -1) {
            return savedTheme;
        }
        return typeof themeConfig !== 'undefined' ? themeConfig.selected : 'prototype';
    }

    function setTheme(themeName) {
        // Delegate to ThemeUtils if available
        if (typeof ThemeUtils !== 'undefined') {
            ThemeUtils.setTheme(themeName);
            _log.info('Engine','Theme changed to: ' + themeName);
            return;
        }
        // Fallback for backwards compatibility
        var link = document.getElementById('theme-css');
        if (link) {
            link.href = 'css/themes/' + themeName + '.css';
            localStorage.setItem(config.themeKey, themeName);
            _log.info('Engine','Theme changed to: ' + themeName);
        }
    }

    // === Scene Resource Cleanup ===
    /**
     * Clean up scene-specific resources to prevent memory leaks
     * Called on scene transitions and game reset
     */
    function cleanupSceneResources() {
        // Cancel ongoing animations
        if (typeof AnimationManager !== 'undefined') {
            AnimationManager.cancelAll();
        }

        // Clear scene-specific timers (typewriter, auto-advance, UI feedback)
        if (typeof TimerManager !== 'undefined') {
            TimerManager.clearAll('typewriter');
            TimerManager.clearAll('auto-advance');
            TimerManager.clearAll('ui-feedback');
            TimerManager.clearAll('scene');
        }

        // Clear scene-specific listeners (dynamically created choice buttons, etc.)
        if (typeof ListenerManager !== 'undefined') {
            ListenerManager.removeAll('scene');
            ListenerManager.removeAll('choices');
        }

        // Stop any in-progress typewriter
        if (state.typewriter.isTyping) {
            clearTimeout(state.typewriter.timeoutId);
            clearTimeout(state.typewriter.autoAdvanceId);
            state.typewriter.isTyping = false;
            state.typewriter.timeoutId = null;
            state.typewriter.autoAdvanceId = null;
        }
    }

    // === Scene Loading ===
    function loadScene(sceneId, prependContent, entrySfx) {
        prependContent = prependContent || '';

        // Clean up resources from previous scene
        cleanupSceneResources();

        // Hide ending overlay if visible
        var endingOverlay = document.getElementById('ending-overlay');
        if (endingOverlay) {
            endingOverlay.classList.remove('visible');
            endingOverlay.innerHTML = '';
        }

        // Remove ending-scene class from text-box
        if (elements.textBox) {
            elements.textBox.classList.remove('ending-scene');
        }

        // Re-measure text height to ensure consistent sizing after class changes
        ensureTextBoxSizing();

        // Emit scene transition event
        if (typeof eventBus !== 'undefined') {
            eventBus.emit('scene:transition', { from: state.currentSceneId, to: sceneId });
        }

        // Check for special roll trigger
        if (sceneId === '_roll') {
            executeActions();
            return;
        }

        var scene = story[sceneId];

        if (!scene) {
            _log.error('Engine','Scene not found: ' + sceneId);
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
                _log.warn('Engine','Flag requirements not met for scene: ' + sceneId);
                return;
            }
        }

        // Set flags if specified
        if (scene.set_flags && scene.set_flags.length > 0) {
            setFlags(scene.set_flags);
        }

        // Set key flags if specified (persist across Play Again)
        if (scene.set_key_flags && scene.set_key_flags.length > 0) {
            setKeyFlags(scene.set_key_flags);
        }

        // Add skills if specified
        if (scene.set_skills && scene.set_skills.length > 0) {
            scene.set_skills.forEach(function(skill) {
                addSkill(skill);
            });
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

        // Sync state to new architecture store (Phase 9 migration)
        syncToStore();

        // Ensure text box is visible (remove any hidden state from tap-to-hide or battle mode)
        var textBox = document.getElementById('text-box');
        if (textBox) {
            textBox.classList.remove('hidden-textbox');
            textBox.classList.remove('battle-mode');
        }

        // Emit scene enter event for new architecture
        if (typeof eventBus !== 'undefined' && typeof SceneEvents !== 'undefined') {
            eventBus.emit(SceneEvents.ENTER, {
                sceneId: sceneId,
                scene: scene,
                previousId: state.history.length > 1 ? state.history[state.history.length - 2] : null
            });
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

        // Store ending title from scene frontmatter
        state.endingTitle = scene.ending_title || null;

        // Preprocess text blocks - split long ones unless it's an ending
        state.processedTextBlocks = preprocessTextBlocks(scene.textBlocks || [], isEnding);
        state.isEndingScene = isEnding;

        // Add random flavor text if scene has random_flavor array
        if (scene.random_flavor && scene.random_flavor.length > 0) {
            var flavorText = Utils.pickRandom(scene.random_flavor);
            state.processedTextBlocks.push(flavorText);
        }

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

        _log.debug('Engine', 'renderCurrentBlock:', { sceneId: state.currentSceneId, blockIndex: state.currentBlockIndex, isLastBlock: isLastBlock, hasActions: !!(scene.actions && scene.actions.length > 0) });

        // Reset pagination for new block and paginate text in fixed mode
        resetPagination();
        if (config.textDisplayMode === 'fixed') {
            var pages = paginateText(currentText, config.fixedLines);
            // Always store fullText for potential re-pagination on resize
            state.pagination.fullText = currentText;
            state.pagination.pages = pages;
            if (pages.length > 1) {
                state.pagination.active = true;
                state.pagination.currentPage = 0;
                _log.debug('Engine', 'Paginated text into ' + pages.length + ' pages');
            }
        }

        // Hide continue button and choices while typing
        hideContinueButton();
        elements.choicesContainer.innerHTML = '';

        // Render current page (or full text if not paginated)
        var textToRender = state.pagination.active
            ? state.pagination.pages[state.pagination.currentPage]
            : currentText;

        // Render text with callback
        renderText(textToRender, prependContent, function() {
            var isLastPage = !state.pagination.active || state.pagination.currentPage >= state.pagination.pages.length - 1;
            _log.debug('Engine', 'Text render complete, isLastBlock:', isLastBlock, 'isLastPage:', isLastPage, 'hasActions:', !!(scene.actions && scene.actions.length > 0));

            if (isLastBlock && isLastPage) {
                // Check for actions
                if (scene.actions && scene.actions.length > 0) {
                    // Show the roll choice if there's a _roll target in choices
                    var hasRollChoice = scene.choices && scene.choices.some(function(c) {
                        return c.target === '_roll';
                    });
                    _log.debug('Engine', 'hasRollChoice:', hasRollChoice);
                    if (hasRollChoice) {
                        renderChoices(scene.choices);
                    } else {
                        // Execute actions directly
                        _log.debug('Engine', 'Calling executeActions()');
                        executeActions();
                    }
                } else {
                    // Show choices or game over
                    renderChoices(scene.choices);
                }
            } else {
                // Show continue button (for next page or next block)
                showContinueButton();

                // Auto mode: auto-advance after delay
                if (config.currentSpeed === 'auto') {
                    state.typewriter.autoAdvanceId = typeof TimerManager !== 'undefined'
                        ? TimerManager.setTimeout(function() {
                            advanceTextBlock();
                        }, config.autoDelay, 'auto-advance')
                        : setTimeout(function() {
                            advanceTextBlock();
                        }, config.autoDelay);
                }

                // Skip mode: auto-advance quickly until choice
                if (config.currentSpeed === 'skip') {
                    state.typewriter.autoAdvanceId = typeof TimerManager !== 'undefined'
                        ? TimerManager.setTimeout(function() {
                            advanceTextBlock();
                        }, config.skipModeDelay, 'auto-advance')
                        : setTimeout(function() {
                            advanceTextBlock();
                        }, config.skipModeDelay);
                }
            }
        });
    }

    function advanceTextBlock() {
        // Cancel any auto-advance timer
        if (state.typewriter.autoAdvanceId) {
            if (typeof TimerManager !== 'undefined') {
                TimerManager.clear(state.typewriter.autoAdvanceId);
            } else {
                clearTimeout(state.typewriter.autoAdvanceId);
            }
            state.typewriter.autoAdvanceId = null;
        }

        // In fixed mode: first advance through pages before advancing blocks
        if (hasMorePages()) {
            advancePaginationPage();
            _log.debug('Engine', 'Advanced to page ' + (state.pagination.currentPage + 1) + ' of ' + state.pagination.pages.length);

            // Render the next page
            hideContinueButton();
            elements.choicesContainer.innerHTML = '';

            var textToRender = state.pagination.pages[state.pagination.currentPage];
            renderText(textToRender, '', function() {
                var scene = story[state.currentSceneId];
                var textBlocks = state.processedTextBlocks || scene.textBlocks || [];
                var isLastBlock = state.currentBlockIndex >= textBlocks.length - 1;
                var isLastPage = state.pagination.currentPage >= state.pagination.pages.length - 1;

                if (isLastBlock && isLastPage) {
                    // Last page of last block - show choices/actions
                    if (scene.actions && scene.actions.length > 0) {
                        var hasRollChoice = scene.choices && scene.choices.some(function(c) {
                            return c.target === '_roll';
                        });
                        if (hasRollChoice) {
                            renderChoices(scene.choices);
                        } else {
                            executeActions();
                        }
                    } else {
                        renderChoices(scene.choices);
                    }
                } else {
                    // More pages or blocks to go
                    showContinueButton();

                    // Auto/skip mode handling
                    if (config.currentSpeed === 'auto') {
                        state.typewriter.autoAdvanceId = typeof TimerManager !== 'undefined'
                            ? TimerManager.setTimeout(advanceTextBlock, config.autoDelay, 'auto-advance')
                            : setTimeout(advanceTextBlock, config.autoDelay);
                    }
                    if (config.currentSpeed === 'skip') {
                        state.typewriter.autoAdvanceId = typeof TimerManager !== 'undefined'
                            ? TimerManager.setTimeout(advanceTextBlock, config.skipModeDelay, 'auto-advance')
                            : setTimeout(advanceTextBlock, config.skipModeDelay);
                    }
                }
            });
            return;
        }

        // No more pages - advance to next block
        var scene = story[state.currentSceneId];
        if (!scene) return;

        // Use processed text blocks (auto-split for non-ending scenes)
        var textBlocks = state.processedTextBlocks || scene.textBlocks || [];

        if (state.currentBlockIndex < textBlocks.length - 1) {
            state.currentBlockIndex++;
            saveState();  // Auto-save on block advance
            syncToStore();

            // Emit block advance event for new architecture
            if (typeof eventBus !== 'undefined' && typeof SceneEvents !== 'undefined') {
                eventBus.emit(SceneEvents.BLOCK_ADVANCE, {
                    sceneId: state.currentSceneId,
                    blockIndex: state.currentBlockIndex,
                    totalBlocks: textBlocks.length
                });
            }

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

    /**
     * Show battle skip buttons (Skip Battle / Fight!!) for already-won battles
     * @param {Function} onSkip - Callback for skip button
     * @param {Function} onFight - Callback for fight button
     */
    function showBattleSkipButtons(onSkip, onFight) {
        hideContinueButton();

        var choicesContainer = document.getElementById('choices');
        if (!choicesContainer) return;

        // Clear existing choices
        choicesContainer.innerHTML = '';

        // Create Skip Battle button
        var skipBtn = document.createElement('button');
        skipBtn.className = 'choice-button battle-skip-button';
        skipBtn.textContent = 'Skip Battle';
        skipBtn.addEventListener('click', function() {
            choicesContainer.innerHTML = '';
            onSkip();
        });

        // Create Fight!! button
        var fightBtn = document.createElement('button');
        fightBtn.className = 'choice-button battle-fight-button';
        fightBtn.textContent = 'Fight!!';
        fightBtn.addEventListener('click', function() {
            choicesContainer.innerHTML = '';
            onFight();
        });

        choicesContainer.appendChild(skipBtn);
        choicesContainer.appendChild(fightBtn);
        choicesContainer.style.display = 'flex';
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
            showAlreadyReadIndicator(true);
            if (onComplete) onComplete();
        } else if (alreadyRead) {
            // Already-read text with normal/fast: still typewriter but can skip
            textElement.classList.add('already-read');
            showAlreadyReadIndicator(true);
            startTypewriter(formattedText, textElement, onComplete, true);
        } else if (config.currentSpeed === 'skip') {
            // Skip mode on new text: use fast speed instead
            showAlreadyReadIndicator(false);
            startTypewriter(formattedText, textElement, onComplete, false, 'fast');
        } else {
            // New text: typewriter effect (no skip allowed on first read)
            showAlreadyReadIndicator(false);
            startTypewriter(formattedText, textElement, onComplete, false);
        }
    }

    /**
     * Show or hide the "(read)" indicator in the header
     * @param {boolean} show - Whether to show the indicator
     */
    function showAlreadyReadIndicator(show) {
        var indicator = document.getElementById('already-read-indicator');
        if (indicator) {
            indicator.classList.toggle('hidden', !show);
        }
    }

    // === Typewriter Effect ===
    // Delegates to Typewriter module, maintains state.typewriter for compatibility

    function startTypewriter(html, element, onComplete, canSkip, speedOverride) {
        stopTypewriter();

        // Update state for compatibility checks
        state.typewriter = {
            isTyping: true,
            timeoutId: null,
            autoAdvanceId: null,
            element: element,
            onComplete: onComplete,
            canSkip: canSkip || false,
            speedOverride: speedOverride || null
        };

        // Delegate to Typewriter module
        if (typeof Typewriter !== 'undefined') {
            // Initialize with speed callback if not done
            Typewriter.init({
                getSpeed: getTextSpeed
            });

            Typewriter.start(html, element, function() {
                // Sync state and call original callback
                state.typewriter.isTyping = false;
                if (element) {
                    element.classList.add('typewriter-complete');
                }
                if (onComplete) {
                    onComplete();
                }
            }, canSkip, speedOverride !== undefined ? config.textSpeed[speedOverride] : undefined);
        } else {
            // Fallback: instant display if module not loaded
            element.innerHTML = html;
            element.classList.add('typewriter-complete');
            state.typewriter.isTyping = false;
            if (onComplete) onComplete();
        }
    }

    function skipTypewriter() {
        // Check both engine state AND Typewriter module state
        var engineTyping = state.typewriter.isTyping;
        var moduleTyping = typeof Typewriter !== 'undefined' && Typewriter.isTyping();

        if (!engineTyping && !moduleTyping) return false;

        // Delegate to Typewriter module
        if (typeof Typewriter !== 'undefined') {
            var skipped = Typewriter.skip();
            // Ensure engine state is synced after skip
            if (skipped) {
                state.typewriter.isTyping = false;
            }
            return skipped;
        }

        return false;
    }

    function stopTypewriter() {
        // Clear auto-advance timer (managed by engine)
        if (state.typewriter.autoAdvanceId) {
            if (typeof TimerManager !== 'undefined') {
                TimerManager.clear(state.typewriter.autoAdvanceId);
            } else {
                clearTimeout(state.typewriter.autoAdvanceId);
            }
            state.typewriter.autoAdvanceId = null;
        }

        // Stop Typewriter module
        if (typeof Typewriter !== 'undefined') {
            Typewriter.stop();
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

    // === Text Display Mode (Fixed vs Expanding) ===

    /**
     * Ensure text box sizing is correct for current display mode.
     * Single entry point for all text box sizing - call this whenever:
     * - Display mode changes
     * - Window resizes
     * - Scene transitions (class changes may affect sizing)
     */
    function ensureTextBoxSizing() {
        if (config.textDisplayMode !== 'fixed') return;
        measureTextHeight();
    }

    /**
     * Measure actual text line height and set CSS variable for fixed-height mode.
     * Creates a hidden measurement element with same styling as story-output,
     * measures the height of N lines, and sets --story-fixed-height accordingly.
     * Must be called after DOM is ready and on window resize (font uses vw units).
     * NOTE: Prefer calling ensureTextBoxSizing() instead of this directly.
     */
    function measureTextHeight() {
        var storyOutput = elements.storyOutput;
        if (!storyOutput) return;

        // Create hidden measurement element
        var measureEl = document.createElement('div');
        var computedStyle = window.getComputedStyle(storyOutput);

        // Copy ALL relevant styles from story-output for accurate measurement
        measureEl.style.position = 'absolute';
        measureEl.style.visibility = 'hidden';
        measureEl.style.pointerEvents = 'none';
        measureEl.style.width = storyOutput.clientWidth + 'px';  // Use clientWidth (content area)
        measureEl.style.height = 'auto';
        measureEl.style.maxHeight = 'none';
        measureEl.style.overflow = 'visible';
        measureEl.style.fontSize = computedStyle.fontSize;
        measureEl.style.fontFamily = computedStyle.fontFamily;
        measureEl.style.lineHeight = computedStyle.lineHeight;
        measureEl.style.letterSpacing = computedStyle.letterSpacing;
        measureEl.style.wordSpacing = computedStyle.wordSpacing;
        measureEl.style.padding = '0';
        measureEl.style.margin = '0';
        measureEl.style.boxSizing = 'content-box';

        // Add reference text for N lines (using "Mgy" for full ascender/descender/baseline)
        var lines = [];
        for (var i = 0; i < config.fixedLines; i++) {
            lines.push('Mgy');
        }
        measureEl.innerHTML = '<p class="typewriter-text" style="margin:0;padding:0;display:block;">' + lines.join('<br>') + '</p>';

        document.body.appendChild(measureEl);
        var measuredHeight = measureEl.offsetHeight;
        document.body.removeChild(measureEl);

        // Set the CSS variable with exact measured height (no buffer - padding handled by CSS)
        document.documentElement.style.setProperty('--story-fixed-height', measuredHeight + 'px');
        _log.debug('Engine', 'Measured text height for ' + config.fixedLines + ' lines: ' + measuredHeight + 'px');
    }

    // Debounced resize handler for text height measurement and re-pagination
    var resizeTimeout = null;
    function handleResizeForTextHeight() {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            // Re-measure text box sizing (handles mode check internally)
            ensureTextBoxSizing();
            // Re-paginate current text if we have stored text
            if (config.textDisplayMode === 'fixed') {
                if (state.pagination.fullText) {
                    var currentCharIndex = 0;
                    // Calculate approximate character position we were at
                    if (state.pagination.active && state.pagination.pages) {
                        for (var i = 0; i < state.pagination.currentPage; i++) {
                            currentCharIndex += state.pagination.pages[i].length;
                        }
                    }

                    // Re-paginate with new dimensions
                    var newPages = paginateText(state.pagination.fullText, config.fixedLines);

                    if (newPages.length > 1) {
                        // Find which new page contains our approximate position
                        var newPageIndex = 0;
                        var charCount = 0;
                        for (var j = 0; j < newPages.length; j++) {
                            charCount += newPages[j].length;
                            if (charCount > currentCharIndex) {
                                newPageIndex = j;
                                break;
                            }
                        }

                        state.pagination.active = true;
                        state.pagination.pages = newPages;
                        state.pagination.currentPage = Math.min(newPageIndex, newPages.length - 1);
                        _log.debug('Engine', 'Re-paginated on resize: ' + newPages.length + ' pages, now on page ' + (state.pagination.currentPage + 1));

                        // Re-render current page (instant, no typewriter)
                        var textToRender = state.pagination.pages[state.pagination.currentPage];
                        var formattedText = textToRender.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
                        elements.storyOutput.innerHTML = '<p class="typewriter-text">' + formattedText + '</p>';
                    } else {
                        // Text now fits on one page
                        state.pagination.active = false;
                        state.pagination.pages = newPages;
                        state.pagination.currentPage = 0;
                        var formattedText = newPages[0].replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
                        elements.storyOutput.innerHTML = '<p class="typewriter-text">' + formattedText + '</p>';
                    }
                }
            }
        }, 100);
    }

    /**
     * Set up the text display mode based on config.
     * Call once during init.
     */
    function setupTextDisplayMode() {
        var storyOutput = elements.storyOutput;
        var textBox = document.getElementById('text-box');

        if (config.textDisplayMode === 'fixed') {
            // Set CSS variable for fixed lines
            document.documentElement.style.setProperty('--story-fixed-lines', config.fixedLines);
            // Measure and set text box sizing
            ensureTextBoxSizing();
            // Add resize listener for vw-based font recalculation
            window.removeEventListener('resize', handleResizeForTextHeight);
            window.addEventListener('resize', handleResizeForTextHeight);
            // Add fixed-height class
            if (storyOutput) {
                storyOutput.classList.add('fixed-height');
            }
            if (textBox) {
                textBox.classList.add('fixed-text-mode');
            }
            _log.debug('Engine', 'Text display mode: fixed (' + config.fixedLines + ' lines)');
        } else {
            // Remove fixed-height class (expanding mode)
            window.removeEventListener('resize', handleResizeForTextHeight);
            if (storyOutput) {
                storyOutput.classList.remove('fixed-height');
            }
            if (textBox) {
                textBox.classList.remove('fixed-text-mode');
            }
            _log.debug('Engine', 'Text display mode: expanding');
        }
    }

    /**
     * Reset pagination state for a new text block.
     * Delegates to Pagination module.
     */
    function resetPagination() {
        if (typeof Pagination !== 'undefined') {
            Pagination.reset();
        }
        // Keep state.pagination in sync for compatibility
        state.pagination = {
            active: false,
            pages: [],
            currentPage: 0,
            fullText: ''
        };
    }

    /**
     * Paginate text to fit within fixedLines.
     * Delegates to Pagination module.
     */
    function paginateText(text, maxLines) {
        // If expanding mode, no pagination needed
        if (config.textDisplayMode !== 'fixed') {
            return [text];
        }

        // Delegate to Pagination module
        if (typeof Pagination !== 'undefined') {
            // Configure pagination
            Pagination.configure({
                maxLines: maxLines || config.fixedLines,
                balanceThreshold: typeof TUNING !== 'undefined' ? TUNING.text.pageBalanceThreshold || 0.5 : 0.5
            });

            // Start pagination and sync state
            var result = Pagination.start(text, elements.storyOutput);
            state.pagination = {
                active: result.active,
                pages: result.pages,
                currentPage: result.currentPage,
                fullText: text
            };

            return result.pages;
        }

        // Fallback: no pagination
        return [text];
    }

    /**
     * Check if there are more pages in current pagination.
     * Delegates to Pagination module.
     */
    function hasMorePages() {
        if (typeof Pagination !== 'undefined') {
            return Pagination.hasMorePages();
        }
        return state.pagination.active &&
               state.pagination.currentPage < state.pagination.pages.length - 1;
    }

    /**
     * Advance to next pagination page.
     * Returns true if advanced, false if no more pages.
     * Delegates to Pagination module.
     */
    function advancePaginationPage() {
        if (typeof Pagination !== 'undefined') {
            var advanced = Pagination.advance();
            if (advanced) {
                state.pagination.currentPage = Pagination.getCurrentPageIndex();
            }
            return advanced;
        }

        if (!hasMorePages()) {
            return false;
        }
        state.pagination.currentPage++;
        return true;
    }

    function renderChoices(choices) {
        elements.choicesContainer.innerHTML = '';
        elements.choicesContainer.classList.remove('has-game-over');
        hideContinueButton();

        if (choices && choices.length > 0) {
            // Filter choices by required flags, required skills, required items, AND items to use
            var availableChoices = choices.filter(function(choice) {
                // Check flag requirements
                if (choice.require_flags && choice.require_flags.length > 0) {
                    if (!checkFlags(choice.require_flags)) return false;
                }
                // Check skill requirements
                if (choice.require_skills && choice.require_skills.length > 0) {
                    if (!hasSkills(choice.require_skills)) return false;
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

            availableChoices.forEach(function(choice, index) {
                var button = document.createElement('button');
                // Use continue-button style if there's only one choice
                button.className = availableChoices.length === 1 ? 'continue-button' : 'choice-button';

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

                    // Emit choice selected event for new architecture
                    if (typeof eventBus !== 'undefined' && typeof SceneEvents !== 'undefined') {
                        eventBus.emit(SceneEvents.CHOICE_SELECTED, {
                            choice: choice,
                            index: index,
                            sceneId: state.currentSceneId
                        });
                    }

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
            // Game over state - show ending overlay with restart button
            var endingOverlay = document.getElementById('ending-overlay');
            if (endingOverlay) {
                // Add completion message
                var completionMsg = document.createElement('p');
                completionMsg.className = 'game-over';
                completionMsg.textContent = state.endingTitle || 'The adventure is complete!';
                endingOverlay.appendChild(completionMsg);

                // Add restart button
                var restartButton = document.createElement('button');
                restartButton.className = 'restart-button';
                restartButton.textContent = 'Play Again';
                restartButton.onclick = function() {
                    // Go to wake_up scene - reset happens there via action
                    loadScene('wake_up');
                };
                endingOverlay.appendChild(restartButton);

                // Show the overlay (darkens scene 40%)
                endingOverlay.classList.add('visible');

                // Add class to text-box for ending-specific styling
                if (elements.textBox) {
                    elements.textBox.classList.add('ending-scene');
                }
            }
        }
    }

    // === Action Execution ===
    function executeActions() {
        var scene = story[state.currentSceneId];
        if (!scene || !scene.actions || scene.actions.length === 0) {
            return;
        }

        // Execute all actions in order
        for (var i = 0; i < scene.actions.length; i++) {
            var action = scene.actions[i];

            // Try built-in handlers first
            var handler = actionHandlers[action.type];

            // Fall back to ModuleRegistry for module-provided actions
            if (!handler && typeof ModuleRegistry !== 'undefined') {
                handler = ModuleRegistry.getActionHandler(action.type);
            }

            _log.debug('Engine', 'executeActions: action type =', action.type, 'handler exists =', !!handler);

            if (handler) {
                try {
                    handler(action);
                } catch (e) {
                    _log.error('Engine', 'Error executing action:', e);
                    _log.error('Engine', 'Stack trace:', e.stack);
                }
            } else {
                _log.warn('Engine','Unknown action type: ' + action.type);
            }
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
                    _log.warn('Engine','Failed to load video background: ' + filename);
                    emitAssetError('bg', filename);
                    // Fall back to static image
                    elements.bgVideo.style.display = 'none';
                    elements.backgroundLayer.style.backgroundImage = 'url(' + config.fallbackAssets.bg + ')';
                };
                elements.bgVideo.play().catch(function(err) {
                    _log.warn('Engine','Video autoplay blocked: ' + err.message);
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
                _log.warn('Engine','Failed to load background: ' + filename);
                emitAssetError('bg', filename);
                elements.backgroundLayer.style.backgroundImage = 'url(' + config.fallbackAssets.bg + ')';
            };
            img.src = path;
        }
    }

    /**
     * Emit asset load error event (if eventBus exists)
     */
    function emitAssetError(type, filename) {
        if (typeof eventBus !== 'undefined') {
            eventBus.emit('asset:load-error', { type: type, filename: filename });
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
                _log.warn('Engine','Failed to load character sprite: ' + filename);
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
        Utils.removeElement(document.getElementById('error-overlay'));

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
        Utils.removeElement(document.getElementById('error-overlay'));
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

        // Emit audio event
        if (typeof eventBus !== 'undefined' && typeof AudioEvents !== 'undefined') {
            eventBus.emit(AudioEvents.MUSIC_PLAY, { filename: filename });
        }

        // Try to play
        tryPlayMusic();
    }

    function tryPlayMusic() {
        if (!elements.bgMusic || !state.audio.currentMusic) return;
        if (state.audio.muted) return;

        elements.bgMusic.play().catch(function() {
            // Autoplay blocked - will retry after user interaction
            _log.info('Engine','Music autoplay blocked, will retry after interaction');
        });
    }

    function stopMusic() {
        if (!elements.bgMusic) return;

        elements.bgMusic.pause();
        elements.bgMusic.currentTime = 0;
        // Don't set src to empty string or call load() - just pause and track state
        state.audio.currentMusic = null;

        // Emit audio event
        if (typeof eventBus !== 'undefined' && typeof AudioEvents !== 'undefined') {
            eventBus.emit(AudioEvents.MUSIC_STOP, {});
        }
    }

    function playSfx(filename, callback) {
        if (state.audio.muted || !filename || filename === '') {
            if (callback) callback();
            return;
        }

        var path = config.assetPaths.sfx + filename;
        var audio = new Audio(path);

        // Emit audio event
        if (typeof eventBus !== 'undefined' && typeof AudioEvents !== 'undefined') {
            eventBus.emit(AudioEvents.SFX_PLAY, { filename: filename });
        }

        // If callback provided, call it when SFX ends
        if (callback) {
            audio.addEventListener('ended', callback);
            audio.addEventListener('error', callback);
        }

        audio.play().catch(function() {
            _log.info('Engine','SFX playback failed (autoplay blocked or file not found)');
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
                    _log.info('Engine','SFX playback failed');
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
                    _log.info('Engine','SFX playback failed');
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
            _log.warn('Engine','SFX load failed: ' + filename);
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

        // Emit audio event
        if (typeof eventBus !== 'undefined' && typeof AudioEvents !== 'undefined') {
            eventBus.emit(AudioEvents.MUTE_CHANGE, { muted: state.audio.muted });
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

        // Emit audio event
        if (typeof eventBus !== 'undefined' && typeof AudioEvents !== 'undefined') {
            eventBus.emit(AudioEvents.VOLUME_CHANGE, { volume: volume });
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

    // === Flag Management (delegates to flagManager) ===
    function setFlags(flags) {
        if (typeof flagManager !== 'undefined') {
            flags.forEach(function(flag) {
                flagManager.set(flag);
            });
        }
        updateInventoryDisplay();
    }

    /**
     * Set key flags (persist across Play Again)
     * @param {string[]} flags - Array of flag names to set
     */
    function setKeyFlags(flags) {
        if (typeof flagManager !== 'undefined') {
            flags.forEach(function(flag) {
                flagManager.setKey(flag);
            });
        }
        updateInventoryDisplay();
    }

    function checkFlags(required) {
        if (typeof flagManager !== 'undefined') {
            return flagManager.checkRequired(required);
        }
        return true; // Fallback: allow if flagManager not available
    }

    function getFlag(flag) {
        if (typeof flagManager !== 'undefined') {
            return flagManager.hasAnyType(flag);
        }
        return false;
    }

    function hasKeyFlag(flag) {
        if (typeof flagManager !== 'undefined') {
            return flagManager.hasKey(flag);
        }
        return false;
    }

    function clearFlags() {
        if (typeof flagManager !== 'undefined') {
            flagManager.clearAll();
        }
    }

    // === Inventory Management ===
    /**
     * Add key item to player inventory (unique, no count)
     * @param {string} item - Key item name
     */
    function addKeyItem(item) {
        if (state.inventory.keyItems.indexOf(item) === -1) {
            state.inventory.keyItems.push(item);
            _log.info('Engine','Added key item: ' + item);
            showItemNotification(item, 'added', 'key');
            // Emit inventory event
            if (typeof eventBus !== 'undefined' && typeof InventoryEvents !== 'undefined') {
                eventBus.emit(InventoryEvents.ITEM_ADDED, { item: item, type: 'key' });
            }
        }
        updateInventoryDisplay();
    }

    /**
     * Add skill to player inventory (unique, persists across soft reset)
     * @param {string} skill - Skill name
     */
    function addSkill(skill) {
        if (state.inventory.skills.indexOf(skill) === -1) {
            state.inventory.skills.push(skill);
            _log.info('Engine','Learned skill: ' + skill);
            showItemNotification(skill, 'added', 'skill');
            // Emit inventory event
            if (typeof eventBus !== 'undefined' && typeof InventoryEvents !== 'undefined') {
                eventBus.emit(InventoryEvents.ITEM_ADDED, { item: skill, type: 'skill' });
            }
        }
        updateInventoryDisplay();
    }

    /**
     * Check if player has a skill
     * @param {string} skill - Skill name
     * @returns {boolean}
     */
    function hasSkill(skill) {
        return state.inventory.skills.indexOf(skill) !== -1;
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

    /**
     * Add consumable item to player inventory (with count)
     * @param {string} item - Consumable item name
     * @param {number} count - Number to add (default 1)
     */
    function addConsumable(item, count) {
        count = count || 1;
        if (state.inventory.consumables[item]) {
            state.inventory.consumables[item] += count;
        } else {
            state.inventory.consumables[item] = count;
        }
        _log.info('Engine','Added consumable: ' + item + ' x' + count);
        showItemNotification(item + ' x' + count, 'added', 'consumable');
        // Emit inventory event
        if (typeof eventBus !== 'undefined' && typeof InventoryEvents !== 'undefined') {
            eventBus.emit(InventoryEvents.ITEM_ADDED, { item: item, type: 'consumable', count: count });
        }
        updateInventoryDisplay();
    }

    /**
     * Add items to player inventory (legacy support + new format)
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
     * Remove key item from player inventory
     * @param {string} item - Key item name
     */
    function removeKeyItem(item) {
        var index = state.inventory.keyItems.indexOf(item);
        if (index !== -1) {
            state.inventory.keyItems.splice(index, 1);
            _log.info('Engine','Removed key item: ' + item);
            showItemNotification(item, 'used', 'key');
            // Emit inventory event
            if (typeof eventBus !== 'undefined' && typeof InventoryEvents !== 'undefined') {
                eventBus.emit(InventoryEvents.ITEM_REMOVED, { item: item, type: 'key' });
            }
        }
        updateInventoryDisplay();
    }

    /**
     * Remove consumable item from player inventory
     * @param {string} item - Consumable item name
     * @param {number} count - Number to remove (default 1)
     * @returns {boolean} - True if item was removed
     */
    function removeConsumable(item, count) {
        count = count || 1;
        if (state.inventory.consumables[item] && state.inventory.consumables[item] >= count) {
            state.inventory.consumables[item] -= count;
            if (state.inventory.consumables[item] <= 0) {
                delete state.inventory.consumables[item];
            }
            _log.info('Engine','Removed consumable: ' + item + ' x' + count);
            showItemNotification(item, 'used', 'consumable');
            // Emit inventory event
            if (typeof eventBus !== 'undefined' && typeof InventoryEvents !== 'undefined') {
                eventBus.emit(InventoryEvents.ITEM_REMOVED, { item: item, type: 'consumable', count: count });
            }
            updateInventoryDisplay();
            return true;
        }
        return false;
    }

    /**
     * Remove items from player inventory (legacy support + new format)
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
     * Check if player has a key item
     * @param {string} item - Key item name
     * @returns {boolean}
     */
    function hasKeyItem(item) {
        return state.inventory.keyItems.indexOf(item) !== -1;
    }

    /**
     * Check if player has a consumable (with optional count check)
     * @param {string} item - Consumable name
     * @param {number} count - Minimum count required (default 1)
     * @returns {boolean}
     */
    function hasConsumable(item, count) {
        count = count || 1;
        return state.inventory.consumables[item] && state.inventory.consumables[item] >= count;
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
     * Get consumable count
     * @param {string} item - Consumable name
     * @returns {number} - Count (0 if not owned)
     */
    function getConsumableCount(item) {
        return state.inventory.consumables[item] || 0;
    }

    /**
     * Check if inventory has any items
     * @returns {boolean}
     */
    function hasAnyItems() {
        return state.inventory.keyItems.length > 0 || Object.keys(state.inventory.consumables).length > 0;
    }

    /**
     * Clear all inventory items
     */
    function clearInventory() {
        state.inventory.keyItems = [];
        state.inventory.consumables = {};
        updateInventoryDisplay();
    }

    /**
     * Show a floating notification when items are added/used
     * @param {string} item - Item name
     * @param {string} action - 'added' or 'used'
     * @param {string} itemType - 'key', 'consumable', or 'skill'
     */
    function showItemNotification(item, action, itemType) {
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
                Utils.removeElement(notification);
            }, 500);
        }, 2000);
    }

    /**
     * Toggle inventory panel expanded/collapsed state
     */
    function toggleInventory() {
        state.inventoryExpanded = !state.inventoryExpanded;
        updateInventoryDisplay();
    }

    /**
     * Update the inventory display in the UI
     * NOTE: Floating inventory panel has been replaced by full-screen GameMenu.
     * This function now just hides the container. Inventory is accessed via MENU button.
     */
    function updateInventoryDisplay() {
        var inventoryContainer = document.getElementById('inventory-display');
        if (!inventoryContainer) return;

        // Hide the floating inventory panel - use GameMenu instead
        inventoryContainer.style.display = 'none';
        inventoryContainer.innerHTML = '';

        // Refresh GameMenu if it's open
        if (typeof GameMenu !== 'undefined' && GameMenu.isOpen && GameMenu.isOpen()) {
            GameMenu.refresh();
        }
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
            Utils.removeElement(damageNum);
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

        // flags must be an array or object (supports both new and legacy formats)
        if (saveData.flags !== undefined &&
            typeof saveData.flags !== 'object') {
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
            // Get flags from flagManager if available
            var flagsArr = typeof flagManager !== 'undefined' ? flagManager.getAll() : [];
            var keyFlagsArr = typeof flagManager !== 'undefined' ? flagManager.getAllKey() : [];

            var saveData = {
                currentSceneId: state.currentSceneId,
                currentBlockIndex: state.currentBlockIndex,
                flags: flagsArr,        // Save as array for JSON compatibility
                keyFlags: keyFlagsArr,  // Save as array for JSON compatibility
                inventory: state.inventory,
                playerHP: state.playerHP,
                playerMaxHP: state.playerMaxHP,
                playerMana: state.playerMana,
                playerMaxMana: state.playerMaxMana,
                readBlocks: state.readBlocks,
                wonBattles: state.wonBattles,
                history: state.history
            };
            _log.debug('Engine','saveState: history=' + JSON.stringify(state.history));
            localStorage.setItem(config.saveKey, JSON.stringify(saveData));
        } catch (e) {
            _log.warn('Engine','Could not save state: ' + e.message);
        }
    }

    /**
     * Sync engine state to the new architecture store (Phase 9 migration)
     * This bridges the legacy engine.js state with the new store system
     */
    function syncToStore() {
        if (typeof CoreBridge !== 'undefined' && CoreBridge.syncEngineToStore) {
            CoreBridge.syncEngineToStore(state);
        }
    }

    function loadSavedState() {
        try {
            var saved = localStorage.getItem(config.saveKey);
            if (!saved) return false;

            var saveData = JSON.parse(saved);

            // Validate save data structure
            if (!isValidSaveData(saveData)) {
                _log.warn('Engine','Invalid save data structure, clearing corrupted save');
                clearSavedState();
                return false;
            }

            // Restore flags to flagManager
            if (typeof flagManager !== 'undefined') {
                flagManager.clearAll();
                flagManager.clearAllKey();
                // Handle both array (new) and object (legacy) formats
                var savedFlags = saveData.flags || [];
                var savedKeyFlags = saveData.keyFlags || [];
                if (Array.isArray(savedFlags)) {
                    savedFlags.forEach(function(f) { flagManager.set(f); });
                } else {
                    // Legacy object format
                    Object.keys(savedFlags).forEach(function(f) {
                        if (savedFlags[f]) { flagManager.set(f); }
                    });
                }
                if (Array.isArray(savedKeyFlags)) {
                    savedKeyFlags.forEach(function(f) { flagManager.setKey(f); });
                } else {
                    // Legacy object format
                    Object.keys(savedKeyFlags).forEach(function(f) {
                        if (savedKeyFlags[f]) { flagManager.setKey(f); }
                    });
                }
            }
            // Handle both old (array) and new (object) inventory formats
            if (Array.isArray(saveData.inventory)) {
                // Legacy format: convert array to new format (treat as key items)
                state.inventory = {
                    keyItems: saveData.inventory,
                    consumables: {},
                    skills: []
                };
            } else if (saveData.inventory && typeof saveData.inventory === 'object') {
                state.inventory = {
                    keyItems: saveData.inventory.keyItems || [],
                    consumables: saveData.inventory.consumables || {},
                    skills: saveData.inventory.skills || []
                };
            } else {
                state.inventory = { keyItems: [], consumables: {}, skills: [] };
            }
            state.playerHP = saveData.playerHP !== undefined ? saveData.playerHP : null;
            var defaultMaxHP = typeof TUNING !== 'undefined' ? TUNING.player.defaultMaxHP : 20;
            state.playerMaxHP = saveData.playerMaxHP || defaultMaxHP;
            state.playerMana = saveData.playerMana !== undefined ? saveData.playerMana : null;
            var defaultMaxMana = typeof TUNING !== 'undefined' ? TUNING.player.defaultMaxMana : 20;
            state.playerMaxMana = saveData.playerMaxMana || defaultMaxMana;
            state.readBlocks = saveData.readBlocks || {};
            state.wonBattles = saveData.wonBattles || {};
            state.history = saveData.history || [];
            _log.debug('Engine','loadSavedState: loaded history=' + JSON.stringify(state.history));

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
                _log.info('Engine','Resuming from saved scene: ' + saveData.currentSceneId);
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
            } else if (saveData.currentSceneId) {
                // Saved scene no longer exists - clear corrupted save
                _log.warn('Engine','Saved scene "' + saveData.currentSceneId + '" no longer exists, clearing save');
                clearSavedState();
                return false;
            }
        } catch (e) {
            _log.warn('Engine','Could not load saved state: ' + e.message);
        }
        return false;
    }

    function clearSavedState() {
        try {
            localStorage.removeItem(config.saveKey);
        } catch (e) {
            _log.warn('Engine','Could not clear saved state: ' + e.message);
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
     * @param {boolean} fullReset - If true, clears EVERYTHING including skills, key items, key flags
     *                              If false (Play Again), keeps skills, key items, key flags (New Game+ style)
     */
    function resetGame(fullReset) {
        // Clean up any scene resources first
        cleanupSceneResources();

        // Reset core state
        state.currentSceneId = null;
        state.currentBlockIndex = 0;

        // Regular flags are always cleared on reset (via flagManager)
        if (typeof flagManager !== 'undefined') {
            flagManager.clearAll();
        }

        // Full reset (↺ button) clears everything including persistent items
        // Play Again keeps: skills, key items, key flags
        if (fullReset) {
            state.inventory = { keyItems: [], consumables: {}, skills: [] };
            if (typeof flagManager !== 'undefined') {
                flagManager.clearAllKey();
            }
        } else {
            // Keep skills and key items, clear only consumables
            state.inventory.consumables = {};
            // keyItems are preserved
            // skills are preserved
            // keyFlags are preserved
        }
        state.playerHP = null;
        state.playerMaxHP = typeof TUNING !== 'undefined' ? TUNING.player.defaultMaxHP : 20;
        state.playerMana = null;
        state.playerMaxMana = typeof TUNING !== 'undefined' ? TUNING.player.defaultMaxMana : 20;
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

        // Full reset also clears read history, saved state, and quiz progress
        if (fullReset) {
            state.readBlocks = {};
            clearSavedState();
            updateSkipButtonVisibility();
            // Clear quiz seen answers
            if (typeof QuizEngine !== 'undefined' && QuizEngine.clearSeenAnswers) {
                QuizEngine.clearSeenAnswers();
            }
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
        Utils.removeElement(document.getElementById('player-hp-container'));
        Utils.removeElement(document.getElementById('enemy-hp-container'));
        Utils.removeElement(document.getElementById('player-mana-container'));
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
        // Flag management (delegates to flagManager)
        getFlag: getFlag,
        hasFlag: function(flag) { return getFlag(flag); },
        setFlag: function(flag) {
            if (typeof flagManager !== 'undefined') { flagManager.set(flag); }
            updateInventoryDisplay();
        },
        clearFlag: function(flag) {
            if (typeof flagManager !== 'undefined') { flagManager.clear(flag); }
            updateInventoryDisplay();
        },
        // Key flag management (persist across Play Again)
        hasKeyFlag: hasKeyFlag,
        setKeyFlag: function(flag) {
            if (typeof flagManager !== 'undefined') { flagManager.setKey(flag); }
            updateInventoryDisplay();
        },
        clearKeyFlag: function(flag) {
            if (typeof flagManager !== 'undefined') { flagManager.clearKey(flag); }
            updateInventoryDisplay();
        },
        getKeyFlags: function() {
            if (typeof flagManager !== 'undefined') { return flagManager.getAllKey(); }
            return [];
        },
        // Inventory management
        addItem: function(item) { addItems([item]); },
        addKeyItem: addKeyItem,
        addConsumable: addConsumable,
        addSkill: addSkill,
        removeItem: function(item) { removeItems([item]); },
        removeKeyItem: removeKeyItem,
        removeConsumable: removeConsumable,
        hasItem: hasItem,
        hasKeyItem: hasKeyItem,
        hasConsumable: hasConsumable,
        hasSkill: hasSkill,
        getConsumableCount: getConsumableCount,
        getInventory: function() { return state.inventory; },
        toggleInventory: toggleInventory,
        // HP management
        getHP: function() { return state.playerHP; },
        getMaxHP: function() { return state.playerMaxHP; },
        getMana: function() { return state.playerMana; },
        getMaxMana: function() { return state.playerMaxMana; },
        getPlayerStats: function() {
            return {
                hp: state.playerHP,
                maxHP: state.playerMaxHP,
                mana: state.playerMana,
                maxMana: state.playerMaxMana
            };
        },
        heal: healPlayer,
        damage: damagePlayer,
        initHP: initPlayerHP,
        // Game control
        reset: reset,
        registerActionHandler: function(type, handler) {
            actionHandlers[type] = handler;
        },
        // Battle UI refresh (for updating cooldowns/defending state)
        refreshBattleChoices: function() {
            var scene = story[state.currentSceneId];
            if (scene && typeof BattleEngine !== 'undefined' && BattleEngine.isActive()) {
                renderBattleChoices(scene.battle_actions || scene.choices);
            }
        },
        // Battle skip feature
        markBattleWon: markBattleWon,
        hasBattleBeenWon: hasBattleBeenWon,
        // Dev mode
        showDevModeIndicator: showDevModeIndicator,
        isDevMode: function() { return state.devMode === true; },
        setDevMode: function(enabled) { state.devMode = enabled; },
        // Audio
        playSfx: playSfx,
        // Text display mode ('fixed' or 'expanding')
        getTextDisplayMode: function() { return config.textDisplayMode; },
        setTextDisplayMode: function(mode) {
            if (mode === 'fixed' || mode === 'expanding') {
                config.textDisplayMode = mode;
                setupTextDisplayMode();
                _log.debug('Engine', 'Text display mode changed to: ' + mode);
            }
        },
        getFixedLines: function() { return config.fixedLines; },
        setFixedLines: function(lines) {
            if (typeof lines === 'number' && lines >= 1 && lines <= 10) {
                config.fixedLines = lines;
                setupTextDisplayMode();
                _log.debug('Engine', 'Fixed lines changed to: ' + lines);
            }
        }
    };

})();

// Auto-initialize when DOM is ready
// Password screen must be completed before game starts
document.addEventListener('DOMContentLoaded', function() {
    // Check for URL parameters
    var urlParams = new URLSearchParams(window.location.search);
    var previewScene = urlParams.get('scene');
    var devParam = urlParams.has('dev');

    // Helper to initialize with dev mode if requested
    function initWithDevMode() {
        VNEngine.init();
        if (devParam) {
            VNEngine.setDevMode(true);
            // Show dev mode indicator
            if (typeof VNEngine.showDevModeIndicator === 'function') {
                VNEngine.showDevModeIndicator(true);
            } else {
                // Fallback: create indicator manually
                var indicator = document.getElementById('dev-mode-indicator');
                if (!indicator) {
                    indicator = document.createElement('div');
                    indicator.id = 'dev-mode-indicator';
                    indicator.textContent = 'DEV MODE';
                    document.body.appendChild(indicator);
                }
                indicator.style.display = 'block';
            }
            console.log('%c[DEV MODE ENABLED via ?dev]', 'color: #00ff00; font-weight: bold;');
        }
    }

    if (previewScene) {
        // Preview mode: skip password, hide overlay, load specific scene
        var passwordOverlay = document.getElementById('password-overlay');
        if (passwordOverlay) {
            passwordOverlay.classList.add('hidden');
        }
        initWithDevMode();
        // Override to load the preview scene
        VNEngine.loadScene(previewScene);
        return;
    }

    // Dev mode: skip password screen
    if (devParam) {
        var passwordOverlay = document.getElementById('password-overlay');
        if (passwordOverlay) {
            passwordOverlay.classList.add('hidden');
        }
        initWithDevMode();
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
