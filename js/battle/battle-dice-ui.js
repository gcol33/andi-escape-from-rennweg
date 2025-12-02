/**
 * Andi VN - Battle Dice UI Module
 *
 * Pure dice animation/display. No rolling logic.
 * Receives roll results, animates them.
 *
 * Usage:
 *   BattleDiceUI.animateRoll(element, rollResult, callback);
 *   BattleDiceUI.showRollInLog(rollResult, attackerName, defenderAC, callback);
 */

var BattleDiceUI = (function() {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    var T = typeof TUNING !== 'undefined' ? TUNING : null;
    var config = {
        spinDuration: T ? T.battle.dice.spinDuration : 1800,
        spinInterval: T ? T.battle.dice.spinInterval : 70,
        lingerDelay: T ? T.battle.dice.lingerDelay : 500,
        typewriterSpeed: T ? T.battle.dice.typewriterSpeed : 25
    };

    // =========================================================================
    // KEYWORDS - Centralized text for battle UI consistency
    // =========================================================================

    var KEYWORDS = {
        // Attack results
        CRITICAL_HIT: 'CRITICAL HIT!',
        HIT: 'HIT!',
        MISS: 'MISS!',
        FUMBLE: 'FUMBLE!',

        // Damage/Heal
        DAMAGE: 'DAMAGE',
        HEALED: 'HEALED!',

        // Defend/Mana
        MP: 'MP!'
    };

    // =========================================================================
    // STATE
    // =========================================================================

    var playSfxCallback = null;

    // Track active animations for click-to-skip
    var activeAnimations = [];

    // Pause state
    var _isPaused = false;
    var _pausedTimeouts = [];  // {callback, delay, remaining, startTime}
    var _activeTimeouts = [];
    var _nextTimeoutId = 1;

    function setSfxCallback(callback) {
        playSfxCallback = callback;
    }

    /**
     * Check if dice UI is paused
     */
    function isDicePaused() {
        return _isPaused;
    }

    /**
     * Pausable setTimeout for dice animations
     */
    function diceTimeout(callback, delay) {
        if (_isPaused) {
            var info = {
                id: _nextTimeoutId++,
                callback: callback,
                remaining: delay,
                startTime: null,
                timeoutId: null
            };
            _pausedTimeouts.push(info);
            return info.id;
        }

        var info = {
            id: _nextTimeoutId++,
            callback: callback,
            remaining: delay,
            startTime: Date.now(),
            timeoutId: null
        };

        info.timeoutId = setTimeout(function() {
            // Remove from active list
            for (var i = _activeTimeouts.length - 1; i >= 0; i--) {
                if (_activeTimeouts[i].id === info.id) {
                    _activeTimeouts.splice(i, 1);
                    break;
                }
            }
            callback();
        }, delay);

        _activeTimeouts.push(info);
        return info.id;
    }

    /**
     * Pause all dice animations - freezes everything
     */
    function pauseDice() {
        if (_isPaused) return;
        _isPaused = true;

        // Pause all active timeouts - calculate remaining time
        var now = Date.now();
        for (var i = 0; i < _activeTimeouts.length; i++) {
            var info = _activeTimeouts[i];
            clearTimeout(info.timeoutId);
            info.remaining = Math.max(0, info.remaining - (now - info.startTime));
            _pausedTimeouts.push(info);
        }
        _activeTimeouts = [];

        // Add paused class to freeze CSS animations
        var container = document.getElementById('vn-container');
        if (container) {
            container.classList.add('battle-paused');
        }
    }

    /**
     * Unpause all dice animations - resumes everything
     */
    function unpauseDice() {
        if (!_isPaused) return;
        _isPaused = false;

        // Remove paused class to resume CSS animations
        var container = document.getElementById('vn-container');
        if (container) {
            container.classList.remove('battle-paused');
        }

        // Resume all paused timeouts with their remaining time
        var now = Date.now();
        for (var i = 0; i < _pausedTimeouts.length; i++) {
            var info = _pausedTimeouts[i];
            info.startTime = now;
            (function(capturedInfo) {
                capturedInfo.timeoutId = setTimeout(function() {
                    // Remove from active list
                    for (var j = _activeTimeouts.length - 1; j >= 0; j--) {
                        if (_activeTimeouts[j].id === capturedInfo.id) {
                            _activeTimeouts.splice(j, 1);
                            break;
                        }
                    }
                    capturedInfo.callback();
                }, capturedInfo.remaining);
            })(info);
            _activeTimeouts.push(info);
        }
        _pausedTimeouts = [];
    }

    function playSfx(filename) {
        if (playSfxCallback) playSfxCallback(filename);
    }

    /**
     * Skip all active roll animations - instantly reveal results
     */
    function skipAllAnimations() {
        var animations = activeAnimations.slice(); // Copy to avoid mutation during iteration
        for (var i = 0; i < animations.length; i++) {
            if (animations[i].skip) {
                animations[i].skip();
            }
        }
    }

    // Global click handler for skipping rolls
    function handleGlobalClick() {
        if (activeAnimations.length > 0) {
            skipAllAnimations();
        }
    }

    // Global keydown handler for skipping rolls (spacebar)
    function handleGlobalKeydown(event) {
        if (event.code === 'Space' && activeAnimations.length > 0) {
            event.preventDefault();
            skipAllAnimations();
        }
    }

    // Set up global click and keydown listeners (once)
    var listenersAdded = false;
    function ensureClickListener() {
        if (listenersAdded) return;
        document.addEventListener('click', handleGlobalClick);
        document.addEventListener('keydown', handleGlobalKeydown);
        listenersAdded = true;
    }

    // =========================================================================
    // DICE ANIMATION
    // =========================================================================

    // =========================================================================
    // UNIFIED ROLL DISPLAY HELPERS
    // =========================================================================

    /**
     * Get the CSS class for a roll based on type and result category.
     * Uses the unified roll display system.
     *
     * @param {string} rollType - 'hit', 'damage', 'heal', 'status', 'neutral'
     * @param {string} resultCategory - 'crit', 'fail', 'max', 'min', 'normal'
     * @returns {string} CSS class like 'roll-hit-crit' or 'roll-damage-normal'
     */
    function getRollClass(rollType, resultCategory) {
        return 'roll-' + rollType + '-' + resultCategory;
    }

    /**
     * Determine the result category from roll result flags.
     * @param {Object} rollResult - { isCrit, isFumble, isMax, isMin }
     * @returns {string} 'crit', 'fail', 'max', 'min', or 'normal'
     */
    function getResultCategory(rollResult) {
        if (rollResult.isCrit) return 'crit';
        if (rollResult.isFumble) return 'fail';
        if (rollResult.isMax) return 'max';
        if (rollResult.isMin) return 'min';
        return 'normal';
    }

    /**
     * Animate a dice roll with slot machine effect
     * @param {Element} element - Element to animate
     * @param {Object} rollResult - { roll, sides, isCrit, isFumble, isMax, isMin, rollType } from BattleDice
     * @param {function} callback - Called when done
     * @param {string} rollType - Optional override: 'hit', 'damage', 'heal', 'status', 'neutral'
     */
    function animateRoll(element, rollResult, callback, rollType) {
        var duration = config.spinDuration;
        var interval = config.spinInterval;
        var elapsed = 0;
        var sides = rollResult.sides || 20;
        var finished = false;

        // Determine roll type - default based on die size if not specified
        var type = rollType || rollResult.rollType || (sides === 20 ? 'hit' : 'damage');

        // Ensure click listener is set up
        ensureClickListener();

        // Function to finish the animation (called normally or on skip)
        function finishAnimation() {
            if (finished) return;
            finished = true;

            // Remove from active animations
            for (var i = activeAnimations.length - 1; i >= 0; i--) {
                if (activeAnimations[i].element === element) {
                    activeAnimations.splice(i, 1);
                    break;
                }
            }

            // Show final value
            element.textContent = rollResult.roll;
            element.classList.remove('dice-spinning');
            element.classList.add('dice-final');

            // Apply unified roll styling based on type + result category
            var resultCategory = getResultCategory(rollResult);
            var rollClass = getRollClass(type, resultCategory);
            element.classList.add(rollClass);

            // Play sound based on result category
            if (resultCategory === 'crit' || resultCategory === 'max') {
                playSfx('success.ogg');
            } else if (resultCategory === 'fail') {
                playSfx('fail.ogg');
            }

            diceTimeout(function() {
                if (callback) callback();
            }, config.lingerDelay);
        }

        // Register this animation for click-to-skip
        var animationState = {
            element: element,
            skip: finishAnimation
        };
        activeAnimations.push(animationState);

        playSfx('dice_roll.ogg');
        element.classList.add('dice-spinning');
        element.classList.add('dice-d' + sides);

        function spin() {
            if (finished || _isPaused) return;

            if (elapsed >= duration) {
                finishAnimation();
                return;
            }

            // Random number during spin (based on die size)
            element.textContent = Math.floor(Math.random() * sides) + 1;
            elapsed += interval;

            // Slow down near end
            var nextInterval = interval;
            if (elapsed > duration * 0.7) nextInterval = interval * 2;
            if (elapsed > duration * 0.9) nextInterval = interval * 3;

            diceTimeout(spin, nextInterval);
        }

        spin();
    }

    /**
     * Animate advantage/disadvantage roll (show both dice rolling simultaneously)
     * Both dice roll grey, then loser collapses into winner, winner pops up with color
     * @param {Element} container - Container for dice elements
     * @param {Object} rollResult - { roll, rolls, advantage, disadvantage, isCrit, isFumble }
     * @param {function} callback - Called with winner element when done
     * @param {Object} hitInfo - Optional { defenderAC, hit } to determine color
     */
    function animateAdvantageRoll(container, rollResult, callback, hitInfo) {
        var isDisadvantage = rollResult.disadvantage;
        hitInfo = hitInfo || {};

        // Create two dice elements - both start grey
        // Use <strong> to match normal dice behavior
        var dice1 = document.createElement('strong');
        dice1.className = 'dice-number advantage-die';
        dice1.textContent = '?';

        var dice2 = document.createElement('strong');
        dice2.className = 'dice-number advantage-die';
        dice2.textContent = '?';

        var separator = document.createElement('span');
        separator.className = 'advantage-separator';
        separator.textContent = '/';

        container.appendChild(dice1);
        container.appendChild(separator);
        container.appendChild(dice2);

        // Individual rolls
        var roll1 = { roll: rollResult.rolls[0], sides: 20, isCrit: false, isFumble: false };
        var roll2 = { roll: rollResult.rolls[1], sides: 20, isCrit: false, isFumble: false };

        // Track when both dice finish rolling
        var diceFinished = 0;

        function onDiceFinished() {
            diceFinished++;
            if (diceFinished < 2) return; // Wait for both

            // Both dice finished - determine winner
            var roll1Higher = rollResult.rolls[0] >= rollResult.rolls[1];
            var winner, loser, loserIsLeft;

            if (isDisadvantage) {
                // Disadvantage: lower roll wins
                winner = roll1Higher ? dice2 : dice1;
                loser = roll1Higher ? dice1 : dice2;
                loserIsLeft = roll1Higher; // dice1 is on the left
            } else {
                // Advantage: higher roll wins
                winner = roll1Higher ? dice1 : dice2;
                loser = roll1Higher ? dice2 : dice1;
                loserIsLeft = !roll1Higher; // loser is dice2 (right) when roll1 is higher
            }

            // Clear minWidth on BOTH dice BEFORE collapse so numbers snap to correct positions
            dice1.style.minWidth = '';
            dice1.style.textAlign = '';
            dice1.style.display = '';
            dice2.style.minWidth = '';
            dice2.style.textAlign = '';
            dice2.style.display = '';

            // Fade out loser and separator
            loser.style.opacity = '0';
            loser.style.transition = 'opacity 0.2s ease';
            separator.style.opacity = '0';
            separator.style.transition = 'opacity 0.2s ease';

            // If winner is on right (loser is left), collapse loser/separator width so winner slides left
            if (loserIsLeft) {
                loser.style.width = '0';
                loser.style.overflow = 'hidden';
                loser.style.transition = 'opacity 0.2s ease, width 0.2s ease';
                separator.style.width = '0';
                separator.style.transition = 'opacity 0.2s ease, width 0.2s ease';
            }

            // After animation, finalize (keep loser/separator in DOM but hidden)
            diceTimeout(function() {
                // Don't remove - just hide completely
                loser.style.display = 'none';
                separator.style.display = 'none';

                // Remove grey class from rolling
                winner.classList.remove(getRollClass('neutral', 'normal'));

                // Determine color based on hit/miss result
                var rollType, resultCategory;
                if (rollResult.isCrit) {
                    rollType = 'hit';
                    resultCategory = 'crit';
                } else if (rollResult.isFumble) {
                    rollType = 'neutral';
                    resultCategory = 'fail';
                } else if (hitInfo.hit) {
                    rollType = 'hit';
                    resultCategory = 'normal';
                } else {
                    rollType = 'neutral';
                    resultCategory = 'normal';
                }

                winner.classList.remove('advantage-die');
                winner.classList.add(getRollClass(rollType, resultCategory));
                winner.classList.add('advantage-winner');

                diceTimeout(function() {
                    // Clean up advantage-specific classes
                    winner.classList.remove('advantage-winner');
                    callback(winner);
                }, config.lingerDelay);
            }, 200); // Match fade duration
        }

        // Animate BOTH dice simultaneously (start at the same time)
        animateRollGrey(dice1, roll1, onDiceFinished);
        animateRollGrey(dice2, roll2, onDiceFinished);
    }

    /**
     * Animate a dice roll that stays grey (for advantage/disadvantage display)
     * @param {Element} element - The dice element
     * @param {Object} rollResult - { roll, sides }
     * @param {function} callback - Called when done
     */
    function animateRollGrey(element, rollResult, callback) {
        var duration = config.spinDuration;
        var interval = config.spinInterval;
        var elapsed = 0;
        var sides = rollResult.sides || 20;
        var finished = false;

        // Ensure click listener is set up
        ensureClickListener();

        function finishAnimation() {
            if (finished) return;
            finished = true;

            // Remove from active animations
            for (var i = activeAnimations.length - 1; i >= 0; i--) {
                if (activeAnimations[i].element === element) {
                    activeAnimations.splice(i, 1);
                    break;
                }
            }

            // Show final value - stays grey (neutral)
            element.textContent = rollResult.roll;
            element.classList.remove('dice-spinning');
            element.classList.add('dice-final');
            element.classList.add(getRollClass('neutral', 'normal'));

            diceTimeout(function() {
                if (callback) callback();
            }, 100); // Short delay between the two dice
        }

        // Register this animation for click-to-skip
        var animationState = {
            element: element,
            skip: finishAnimation
        };
        activeAnimations.push(animationState);

        playSfx('dice_roll.ogg');
        element.classList.add('dice-spinning');
        element.classList.add('dice-d' + sides);

        function spin() {
            if (finished || _isPaused) return;

            if (elapsed >= duration) {
                finishAnimation();
                return;
            }

            element.textContent = Math.floor(Math.random() * sides) + 1;
            elapsed += interval;

            var nextInterval = interval;
            if (elapsed > duration * 0.7) nextInterval = interval * 2;
            if (elapsed > duration * 0.9) nextInterval = interval * 3;

            diceTimeout(spin, nextInterval);
        }

        spin();
    }

    /**
     * Animate advantage/disadvantage damage roll (show both totals rolling simultaneously)
     * Both roll grey, then winner slides to first position while loser/separator fade
     * @param {Element} container - Container for dice elements
     * @param {Object} rollResult - { roll, rolls (both totals), advantage, disadvantage, isCrit, isMax, isMin }
     * @param {function} callback - Called with winning dice element
     */
    function animateAdvantageDamageRoll(container, rollResult, callback) {
        var isDisadvantage = rollResult.disadvantage;

        // Create two damage dice elements - both start grey
        // Use <strong> to match normal dice behavior
        var dice1 = document.createElement('strong');
        dice1.className = 'dice-number advantage-die';
        dice1.textContent = '?';

        var dice2 = document.createElement('strong');
        dice2.className = 'dice-number advantage-die';
        dice2.textContent = '?';

        var separator = document.createElement('span');
        separator.className = 'advantage-separator';
        separator.textContent = '/';

        container.appendChild(dice1);
        container.appendChild(separator);
        container.appendChild(dice2);

        // Individual rolls
        var roll1 = { roll: rollResult.rolls[0], sides: 6, isCrit: false, isFumble: false };
        var roll2 = { roll: rollResult.rolls[1], sides: 6, isCrit: false, isFumble: false };

        // Track when both dice finish rolling
        var diceFinished = 0;

        function onDiceFinished() {
            diceFinished++;
            if (diceFinished < 2) return; // Wait for both

            // Both dice finished - determine winner
            var roll1Higher = rollResult.rolls[0] >= rollResult.rolls[1];
            var winner, loser, winnerIsRight;

            if (isDisadvantage) {
                // Disadvantage: lower roll wins
                winner = roll1Higher ? dice2 : dice1;
                loser = roll1Higher ? dice1 : dice2;
                winnerIsRight = roll1Higher; // if roll1 is higher, winner (dice2) is on right
            } else {
                // Advantage: higher roll wins
                winner = roll1Higher ? dice1 : dice2;
                loser = roll1Higher ? dice2 : dice1;
                winnerIsRight = !roll1Higher; // if roll1 is higher, winner (dice1) is on left
            }

            // Fade out loser and separator
            loser.style.opacity = '0';
            loser.style.transition = 'opacity 0.2s ease';
            separator.style.opacity = '0';
            separator.style.transition = 'opacity 0.2s ease';

            // If winner is on right, it needs to slide left to take first position
            if (winnerIsRight) {
                // Collapse separator and loser width so winner slides left
                separator.style.width = '0';
                separator.style.transition = 'opacity 0.2s ease, width 0.2s ease';
                loser.style.width = '0';
                loser.style.overflow = 'hidden';
                loser.style.transition = 'opacity 0.2s ease, width 0.2s ease';
            }

            // After animation, clean up and finalize
            diceTimeout(function() {
                // Remove loser and separator completely - they've served their purpose
                loser.remove();
                separator.remove();

                // Apply damage color
                winner.classList.remove(getRollClass('neutral', 'normal'));
                winner.classList.remove('advantage-die');
                var resultCategory = rollResult.isCrit ? 'crit' : (rollResult.isMax ? 'max' : (rollResult.isMin ? 'min' : 'normal'));
                winner.classList.add(getRollClass('damage', resultCategory));

                callback(winner);
            }, 200);
        }

        // Animate BOTH dice simultaneously (start at the same time)
        animateRollGrey(dice1, roll1, onDiceFinished);
        animateRollGrey(dice2, roll2, onDiceFinished);
    }

    // =========================================================================
    // TYPEWRITER EFFECT
    // =========================================================================

    /**
     * Typewriter text effect
     * Always scrolls to bottom as content is typed to keep it visible
     * @param {Element} element - Element to type into
     * @param {string} text - Text (can include HTML tags)
     * @param {function} callback - Called when done
     */
    function typewriter(element, text, callback) {
        var speed = config.typewriterSpeed;
        var index = 0;
        var isTag = false;
        var tagBuffer = '';

        // Find scrollable container (battle-log-content)
        var scrollContainer = element.closest('.battle-log-content') ||
                              document.getElementById('battle-log-content');

        function scrollToBottom() {
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }

        function type() {
            if (index >= text.length) {
                scrollToBottom();
                if (callback) callback();
                return;
            }

            var char = text[index];

            // Handle HTML tags instantly
            if (char === '<') {
                isTag = true;
                tagBuffer = '<';
                index++;
                type();
                return;
            }

            if (isTag) {
                tagBuffer += char;
                if (char === '>') {
                    isTag = false;
                    element.innerHTML += tagBuffer;
                    tagBuffer = '';
                }
                index++;
                type();
                return;
            }

            element.innerHTML += char;
            index++;
            // Always scroll to keep newest content visible
            scrollToBottom();
            diceTimeout(type, speed);
        }

        type();
    }

    // =========================================================================
    // COMPOSITE DISPLAYS
    // =========================================================================

    /**
     * Create and animate a full attack roll display:
     * All on ONE LINE with collapsing modifiers from left to right
     *
     * Flow:
     * "Agnes rolled 15"
     * "Agnes rolled 15 + 2 (ATK)"
     * "Agnes rolled 15 + 2 (ATK) + 1 (Rage)"
     * "Agnes rolled 17 + 1 (Rage)"           ← first mod collapsed into number
     * "Agnes rolled 18"                       ← second mod collapsed
     * "Agnes rolled 18 HIT!"
     * "Agnes rolled 18 HIT! deals 6"
     * "Agnes rolled 18 HIT! deals 6 + 2 (CRIT)"
     * "Agnes rolled 18 HIT! deals 8 DAMAGE"
     *
     * @param {Object} options
     * @param {function} callback
     */
    function showAttackRoll(options, callback) {
        var container = options.container;
        var rollResult = options.rollResult;
        var isPlayer = options.isPlayer !== false;

        // Single line for everything
        var line = document.createElement('div');
        line.className = 'roll-result';
        container.appendChild(line);

        // Phase 1: Type attacker name
        typewriter(line, options.attacker + ' rolled ', function() {
            // Get AC for determining when roll "hits"
            var defenderAC = options.defenderAC || 10;

            // For attack rolls, start neutral (grey) - only turn yellow when we know it hits
            // Exception: crits (nat 20) always hit, fumbles (nat 1) always miss
            var initialRollType = 'neutral';
            if (rollResult.isCrit) {
                initialRollType = 'hit';  // Nat 20 always hits - show yellow immediately
            } else if (rollResult.isFumble) {
                initialRollType = 'neutral';  // Nat 1 always misses - stays grey
            } else if (rollResult.roll >= defenderAC) {
                initialRollType = 'hit';  // Base roll alone beats AC - show yellow
            }
            // Otherwise stays neutral/grey until bonuses push it over

            // Variable to track the winning dice element (for modifier collapse later)
            var attackNum;

            // Animate the d20 roll
            if (rollResult.advantage || rollResult.disadvantage) {
                // Pass hit info so winner color depends on whether attack hits
                animateAdvantageRoll(line, rollResult, function(winnerElement) {
                    attackNum = winnerElement;
                    afterAttackRoll();
                }, {
                    defenderAC: defenderAC,
                    hit: options.hit
                });
            } else {
                // Create dice element for single attack roll
                attackNum = document.createElement('strong');
                attackNum.className = 'dice-number';
                attackNum.textContent = '?';
                line.appendChild(attackNum);
                animateRoll(attackNum, rollResult, afterAttackRoll, initialRollType);
            }

            function afterAttackRoll() {
                var attackModifiers = options.attackModifiers || [];
                // options.attackTotal is the authoritative value from battle-dnd.js
                var finalAttackTotal = options.attackTotal;

                if (isPlayer && attackModifiers.length > 0) {
                    // Show ALL modifiers first, then collapse them one by one
                    // Pass AC so we can turn yellow when bonuses push us over
                    showAllThenCollapseWithAC(line, attackNum, rollResult.roll, attackModifiers, defenderAC, rollResult, function(collapsedTotal) {
                        // Safety: ensure displayed value matches actual attack total
                        attackNum.textContent = finalAttackTotal;
                        showHitMiss();
                    });
                } else {
                    showHitMiss();
                }
            }

            function showHitMiss() {
                // Add space before result
                var space = document.createTextNode(' ');
                line.appendChild(space);

                // Determine result text and unified roll class
                var resultText, rollClass, diceRollClass;
                if (rollResult.isCrit) {
                    resultText = KEYWORDS.CRITICAL_HIT;
                    rollClass = getRollClass('hit', 'crit');
                    diceRollClass = getRollClass('hit', 'crit');
                } else if (rollResult.isFumble) {
                    resultText = KEYWORDS.FUMBLE;
                    rollClass = getRollClass('hit', 'fail');  // Fumble uses grey + fail emphasis
                    diceRollClass = getRollClass('hit', 'fail');
                } else if (options.hit) {
                    resultText = KEYWORDS.HIT;
                    rollClass = getRollClass('hit', 'normal');
                    diceRollClass = getRollClass('hit', 'normal');
                } else {
                    resultText = KEYWORDS.MISS;
                    rollClass = getRollClass('neutral', 'normal');  // Miss is neutral/grey
                    diceRollClass = getRollClass('neutral', 'normal');  // Dice should also be grey for miss
                }

                // Update the attack dice color to match hit/miss outcome
                // Remove any existing roll classes and apply the correct one
                attackNum.className = attackNum.className.replace(/roll-\w+-\w+/g, '');
                attackNum.classList.add(diceRollClass);

                var resultSpan = document.createElement('span');
                resultSpan.className = 'roll-result-text ' + rollClass;
                resultSpan.textContent = resultText;
                line.appendChild(resultSpan);

                // Play sound
                if (rollResult.isCrit) {
                    playSfx('success.ogg');
                } else if (rollResult.isFumble) {
                    playSfx('fail.ogg');
                } else if (options.hit) {
                    playSfx('thud.ogg');
                }

                if (!options.hit) {
                    diceTimeout(callback, config.lingerDelay);
                    return;
                }

                // Continue with damage on same line
                diceTimeout(showDamage, 400);
            }

            function showDamage() {
                // Add " deals " text
                typewriter(line, ' deals ', function() {
                    // IMPORTANT: Use final damage value for consistency
                    // options.damage is the authoritative value from battle-dnd.js
                    var finalDamage = options.damage;
                    var baseDamageRoll = options.baseDamageRoll || finalDamage;
                    var damageModifiers = options.damageModifiers || [];

                    // Check if damage has advantage/disadvantage
                    var hasDamageAdvantage = options.damageAdvantage && options.damageRolls;
                    var hasDamageDisadvantage = options.damageDisadvantage && options.damageRolls;

                    // If no modifiers to show, animate directly to final damage
                    var displayRoll = (isPlayer && damageModifiers.length > 0) ? baseDamageRoll : finalDamage;

                    // Determine damage result category
                    var damageResultCategory = 'normal';
                    if (rollResult.isCrit) {
                        damageResultCategory = 'crit';
                    } else if (options.isMaxDamage) {
                        damageResultCategory = 'max';
                    } else if (options.isMinDamage) {
                        damageResultCategory = 'min';
                    }

                    // Shorter spin for damage
                    var originalDuration = config.spinDuration;
                    config.spinDuration = 1000;

                    if (hasDamageAdvantage || hasDamageDisadvantage) {
                        // Show two damage dice for advantage/disadvantage
                        var damageAdvResult = {
                            roll: displayRoll,
                            rolls: options.damageRolls,
                            sides: 6,
                            advantage: hasDamageAdvantage,
                            disadvantage: hasDamageDisadvantage,
                            isCrit: rollResult.isCrit,
                            isMax: options.isMaxDamage === true,
                            isMin: options.isMinDamage === true
                        };

                        animateAdvantageDamageRoll(line, damageAdvResult, function(damageNum) {
                            config.spinDuration = originalDuration;

                            if (isPlayer && damageModifiers.length > 0) {
                                showAllThenCollapse(line, damageNum, baseDamageRoll, damageModifiers, function(collapsedTotal) {
                                    damageNum.textContent = finalDamage;
                                    showDamageText(damageResultCategory);
                                });
                            } else {
                                showDamageText(damageResultCategory);
                            }
                        });
                    } else {
                        // Single damage die (normal roll)
                        var damageNum = document.createElement('strong');
                        damageNum.className = 'dice-number damage-dice';
                        damageNum.textContent = '?';
                        line.appendChild(damageNum);

                        var damageRollResult = {
                            roll: displayRoll,
                            sides: 6,
                            isCrit: rollResult.isCrit,
                            isFumble: false,
                            isMax: options.isMaxDamage === true,
                            isMin: options.isMinDamage === true
                        };

                        // Pass 'damage' as roll type for unified styling
                        animateRoll(damageNum, damageRollResult, function() {
                            config.spinDuration = originalDuration;

                            if (isPlayer && damageModifiers.length > 0) {
                                // Collapse modifiers, ensuring final value equals options.damage
                                showAllThenCollapse(line, damageNum, baseDamageRoll, damageModifiers, function(collapsedTotal) {
                                    // Safety: ensure displayed value matches actual damage
                                    damageNum.textContent = finalDamage;
                                    showDamageText(damageResultCategory);
                                });
                            } else {
                                // No modifiers - value already shows finalDamage
                                showDamageText(damageResultCategory);
                            }
                        }, 'damage');
                    }
                });
            }

            function showDamageText(damageResultCategory) {
                var space = document.createTextNode(' ');
                line.appendChild(space);

                var damageText = document.createElement('span');
                // Just red color for text, no special outline/glow
                damageText.className = 'damage-text roll-type-damage';
                damageText.textContent = KEYWORDS.DAMAGE;
                line.appendChild(damageText);

                diceTimeout(callback, config.lingerDelay);
            }
        });
    }

    /**
     * Show ALL modifiers first, then collapse them one by one from left to right
     * WITH AC tracking: dice turns yellow (hit) when running total >= AC
     *
     * This improves UX by:
     * - Roll stays grey initially (neutral)
     * - Turns yellow when bonuses push total to hit threshold
     * - If base roll alone hits, it's already yellow from animateRoll
     *
     * @param {Element} line - The line element containing the roll
     * @param {Element} numElement - The dice number element
     * @param {number} startValue - Base roll value
     * @param {Array} modifiers - Array of { value, source, isMultiplier? }
     * @param {number} targetAC - The AC threshold to beat
     * @param {Object} rollResult - Original roll result for determining emphasis
     * @param {function} callback - Called when done with final total
     */
    function showAllThenCollapseWithAC(line, numElement, startValue, modifiers, targetAC, rollResult, callback) {
        var modSpans = [];
        var runningTotal = startValue;
        var hasHitThreshold = startValue >= targetAC;  // Track if we've already turned yellow
        var isFumble = rollResult.isFumble;

        // On fumble, immediately apply the fumble styling - bonuses are "absorbed"
        if (isFumble) {
            numElement.className = numElement.className.replace(/roll-\w+-\w+/g, '');
            numElement.classList.add(getRollClass('hit', 'fail'));
        }

        // Phase 1: Show all modifiers one by one, tracking running total
        var showIndex = 0;
        function showNext() {
            if (showIndex >= modifiers.length) {
                // All shown, now start collapsing
                diceTimeout(function() {
                    collapseFromLeft(0, startValue);
                }, 300);
                return;
            }

            var mod = modifiers[showIndex];
            var modSpan = document.createElement('span');
            modSpan.className = 'mod-part mod-animate-in';

            if (mod.isMultiplier) {
                modSpan.innerHTML = ' x ' + mod.value + ' <span class="mod-source">(' + mod.source + ')</span>';
                runningTotal = Math.floor(runningTotal * mod.value);
            } else {
                var sign = mod.value >= 0 ? ' + ' : ' - ';
                modSpan.innerHTML = sign + Math.abs(mod.value) + ' <span class="mod-source">(' + mod.source + ')</span>';
                runningTotal = runningTotal + mod.value;
            }

            line.appendChild(modSpan);
            modSpans.push({ span: modSpan, value: mod.value, isMultiplier: mod.isMultiplier });

            // Check if this bonus pushed us over the AC threshold (but not on fumble - fumble absorbs everything)
            if (!isFumble && !hasHitThreshold && runningTotal >= targetAC) {
                hasHitThreshold = true;
                // Turn dice yellow! Remove neutral class and add hit class
                numElement.className = numElement.className.replace(/roll-\w+-\w+/g, '');
                var resultCategory = getResultCategory(rollResult);
                numElement.classList.add(getRollClass('hit', resultCategory));
                numElement.classList.add('dice-pop');
                diceTimeout(function() {
                    numElement.classList.remove('dice-pop');
                }, 200);
            }

            showIndex++;
            diceTimeout(showNext, 250);
        }

        // Phase 2: Collapse modifiers from left to right
        function collapseFromLeft(collapseIndex, currentTotal) {
            if (collapseIndex >= modSpans.length) {
                // On fumble, final value stays at 1 (bonuses absorbed)
                callback(isFumble ? 1 : currentTotal);
                return;
            }

            var modData = modSpans[collapseIndex];
            var newTotal;

            if (modData.isMultiplier) {
                newTotal = Math.floor(currentTotal * modData.value);
            } else {
                newTotal = currentTotal + modData.value;
            }

            modData.span.classList.add('mod-collapsing');

            diceTimeout(function() {
                modData.span.remove();
                // On fumble, number stays at 1 as bonuses get absorbed
                numElement.textContent = isFumble ? 1 : newTotal;
                numElement.classList.add('dice-pop');

                diceTimeout(function() {
                    numElement.classList.remove('dice-pop');
                    collapseFromLeft(collapseIndex + 1, newTotal);
                }, 200);
            }, 250);
        }

        showNext();
    }

    /**
     * Show ALL modifiers first, then collapse them one by one from left to right
     *
     * Supports both additive (+2) and multiplicative (x2) modifiers:
     * 4 + 2 (STR) x2 (CRIT)   ← all appear
     * 6 x2 (CRIT)             ← first collapses into number
     * 12                       ← multiplier collapses
     *
     * Modifier format: { value, source, isMultiplier? }
     * - Additive: { value: 2, source: 'STR' } → " + 2 (STR)"
     * - Multiplier: { value: 2, source: 'CRIT', isMultiplier: true } → " x2 (CRIT)"
     */
    function showAllThenCollapse(line, numElement, startValue, modifiers, callback) {
        var modSpans = [];

        // Phase 1: Show all modifiers one by one
        var showIndex = 0;
        function showNext() {
            if (showIndex >= modifiers.length) {
                // All shown, now start collapsing
                diceTimeout(function() {
                    collapseFromLeft(0, startValue);
                }, 300);
                return;
            }

            var mod = modifiers[showIndex];
            var modSpan = document.createElement('span');
            modSpan.className = 'mod-part mod-animate-in';

            if (mod.isMultiplier) {
                // Multiplier display: " x 2 (CRIT)"
                modSpan.innerHTML = ' x ' + mod.value + ' <span class="mod-source">(' + mod.source + ')</span>';
            } else {
                // Additive display: " + 2 (ATK)" or " - 1 (Curse)"
                var sign = mod.value >= 0 ? ' + ' : ' - ';
                modSpan.innerHTML = sign + Math.abs(mod.value) + ' <span class="mod-source">(' + mod.source + ')</span>';
            }

            line.appendChild(modSpan);
            modSpans.push({ span: modSpan, value: mod.value, isMultiplier: mod.isMultiplier });

            showIndex++;
            diceTimeout(showNext, 250);
        }

        // Phase 2: Collapse modifiers from left to right
        function collapseFromLeft(collapseIndex, currentTotal) {
            if (collapseIndex >= modSpans.length) {
                callback(currentTotal);
                return;
            }

            var modData = modSpans[collapseIndex];
            var newTotal;

            if (modData.isMultiplier) {
                // Multiplier: multiply current total
                newTotal = Math.floor(currentTotal * modData.value);
            } else {
                // Additive: add to current total
                newTotal = currentTotal + modData.value;
            }

            // Collapse animation on this modifier
            modData.span.classList.add('mod-collapsing');

            diceTimeout(function() {
                // Remove the modifier
                modData.span.remove();

                // Update the number with pop
                numElement.textContent = newTotal;
                numElement.classList.add('dice-pop');

                diceTimeout(function() {
                    numElement.classList.remove('dice-pop');
                    // Collapse next
                    collapseFromLeft(collapseIndex + 1, newTotal);
                }, 200);
            }, 250);
        }

        showNext();
    }

    // Legacy compatibility
    function showHitMissResult(rollLine, isCrit, isFumble, hit, callback) {
        if (callback) callback();
    }

    function showDamagePhase(container, options, callback) {
        if (callback) callback();
    }

    function showDamageResult(damageLine, isCrit, callback) {
        if (callback) callback();
    }

    function showModifiersAnimated(container, modifiers, callback) {
        if (callback) callback();
    }

    function morphToResult(rollLine, attacker, roll, total, isCrit, isFumble, hit, callback) {
        if (callback) callback();
    }

    function morphToDamage(damageLine, attacker, damage, isCrit, callback) {
        if (callback) callback();
    }

    function collapseModifiersSequentially(rollLine, diceNum, startValue, modifiers, callback) {
        showAllThenCollapse(rollLine, diceNum, startValue, modifiers, callback);
    }

    /**
     * Legacy function for backward compatibility
     */
    function showAttackRollLegacy(options, callback) {
        var container = options.container;
        var rollResult = options.rollResult;

        var rollLine = document.createElement('span');
        rollLine.className = 'roll-result';
        container.appendChild(rollLine);

        typewriter(rollLine, options.attacker + ' rolled ', function() {
            var diceNum = document.createElement('strong');
            diceNum.className = 'dice-number';
            diceNum.textContent = '?';
            rollLine.appendChild(diceNum);

            animateRoll(diceNum, rollResult, function() {
                var modifier = options.attackTotal - rollResult.roll;
                var modText = '';
                if (modifier > 0) {
                    modText = ' + ' + modifier + ' = <strong>' + options.attackTotal + '</strong>';
                } else if (modifier < 0) {
                    modText = ' - ' + Math.abs(modifier) + ' = <strong>' + options.attackTotal + '</strong>';
                }
                modText += ' vs AC ' + options.defenderAC;

                typewriter(rollLine, modText, function() {
                    if (rollResult.isCrit) {
                        var critSpan = document.createElement('span');
                        critSpan.className = 'crit-text';
                        container.appendChild(critSpan);
                        typewriter(critSpan, ' CRITICAL HIT!', callback);
                    } else if (rollResult.isFumble) {
                        var fumbleSpan = document.createElement('span');
                        fumbleSpan.className = 'fumble-text';
                        container.appendChild(fumbleSpan);
                        typewriter(fumbleSpan, ' FUMBLE!', callback);
                    } else {
                        if (callback) callback();
                    }
                });
            });
        });
    }

    // =========================================================================
    // HEAL ROLL DISPLAY
    // =========================================================================

    /**
     * Show animated heal roll for player/enemy recovery
     * Format: "Andi rolled 5 HEALED!" or "Andi rolled 5 (-2) → 3 HEALED!" for overheal
     * Supports advantage/disadvantage: shows 2 dice rolling, winner pops up
     *
     * @param {Object} options - { container, healAmount, healRolled, healer, isMaxHeal, isMinHeal, hasHealAdvantage, hasHealDisadvantage, healRolls }
     * @param {function} callback
     */
    function showHealRoll(options, callback) {
        var container = options.container;
        var healAmount = options.healAmount;        // Actual heal (after HP cap)
        var healRolled = options.healRolled || healAmount;  // Rolled amount (before cap)
        var healerName = options.healer || 'Enemy';
        var overheal = healRolled - healAmount;     // Amount wasted due to HP cap

        // Defensive check for container
        if (!container) {
            console.warn('[BattleDiceUI] showHealRoll: container is null');
            if (callback) callback();
            return;
        }

        // Single line for heal display
        var line = document.createElement('div');
        line.className = 'roll-result heal-roll';
        container.appendChild(line);

        // Determine heal result category
        var healResultCategory = 'normal';
        if (options.isMaxHeal) {
            healResultCategory = 'max';
        } else if (options.isMinHeal) {
            healResultCategory = 'min';
        }

        // Phase 1: Type healer name
        typewriter(line, healerName + ' rolled ', function() {
            // Check for advantage/disadvantage heal roll
            if ((options.hasHealAdvantage || options.hasHealDisadvantage) && options.healRolls && options.healRolls.length === 2) {
                // Show advantage animation for heal (2 dice, winner pops up green)
                var healAdvResult = {
                    rolls: options.healRolls,
                    total: healRolled,
                    advantage: options.hasHealAdvantage,
                    disadvantage: options.hasHealDisadvantage
                };

                animateAdvantageHealRoll(line, healAdvResult, function(healNum) {
                    // If there's overheal, show the reduction then collapse
                    if (overheal > 0) {
                        showOverhealCollapse(line, healNum, healRolled, overheal, healAmount, healResultCategory, callback);
                    } else {
                        // No overheal - just show HEALED!
                        finishHealDisplay(line, healResultCategory, callback);
                    }
                });
            } else {
                // Normal single dice roll
                var healNum = document.createElement('strong');
                healNum.className = 'dice-number';
                healNum.textContent = '?';
                line.appendChild(healNum);

                // Create roll result for animation - show the ROLLED amount first
                var healRollResult = {
                    roll: healRolled,
                    sides: 6,
                    isCrit: false,
                    isFumble: false,
                    isMax: options.isMaxHeal && overheal === 0,  // Only show max if no overheal
                    isMin: options.isMinHeal
                };

                // Shorter spin for heal
                var originalDuration = config.spinDuration;
                config.spinDuration = 1000;

                // Pass 'heal' as roll type for unified styling (green base color)
                animateRoll(healNum, healRollResult, function() {
                    config.spinDuration = originalDuration;

                    // If there's overheal, show the reduction then collapse
                    if (overheal > 0) {
                        showOverhealCollapse(line, healNum, healRolled, overheal, healAmount, healResultCategory, callback);
                    } else {
                        // No overheal - just show HEALED!
                        finishHealDisplay(line, healResultCategory, callback);
                    }
                }, 'heal');
            }
        });
    }

    /**
     * Animate advantage/disadvantage roll for heal (2 grey dice, winner turns green)
     * Similar to animateAdvantageDamageRoll but uses green for heal
     */
    function animateAdvantageHealRoll(container, rollResult, callback) {
        var isDisadvantage = rollResult.disadvantage;

        // Create two heal dice elements - both start grey
        // d6 only has 1 digit (1-6), no minWidth needed
        var dice1 = document.createElement('span');
        dice1.className = 'dice-number advantage-die';
        dice1.textContent = '?';

        var dice2 = document.createElement('span');
        dice2.className = 'dice-number advantage-die';
        dice2.textContent = '?';

        // Add separator
        var separator = document.createElement('span');
        separator.textContent = '/';
        separator.className = 'advantage-separator';

        container.appendChild(dice1);
        container.appendChild(separator);
        container.appendChild(dice2);

        var rolls = rollResult.rolls || [rollResult.total, rollResult.total];
        var roll1 = rolls[0];
        var roll2 = rolls[1];

        // Determine winner and loser
        var winner, loser, winnerRoll, loserRoll;
        if (isDisadvantage) {
            // Disadvantage: take lower
            if (roll1 <= roll2) {
                winner = dice1; loser = dice2;
                winnerRoll = roll1; loserRoll = roll2;
            } else {
                winner = dice2; loser = dice1;
                winnerRoll = roll2; loserRoll = roll1;
            }
        } else {
            // Advantage: take higher
            if (roll1 >= roll2) {
                winner = dice1; loser = dice2;
                winnerRoll = roll1; loserRoll = roll2;
            } else {
                winner = dice2; loser = dice1;
                winnerRoll = roll2; loserRoll = roll1;
            }
        }

        // Create roll results for both dice (grey during roll)
        var rollResult1 = { roll: roll1, sides: 6, isCrit: false, isFumble: false };
        var rollResult2 = { roll: roll2, sides: 6, isCrit: false, isFumble: false };

        // Animate both dice simultaneously
        var completed = 0;
        var originalDuration = config.spinDuration;
        config.spinDuration = 1000;

        function onBothComplete() {
            completed++;
            if (completed < 2) return;

            config.spinDuration = originalDuration;

            // Brief pause then collapse loser into winner
            diceTimeout(function() {
                // Determine collapse direction
                var loserIsLeft = (loser === dice1);
                loser.classList.add(loserIsLeft ? 'advantage-loser-right' : 'advantage-loser-left');

                // Pop up winner with green color
                winner.classList.add('advantage-winner');

                diceTimeout(function() {
                    // Remove loser and separator
                    loser.remove();
                    separator.remove();

                    // Remove advantage classes for normal modifier collapse behavior
                    winner.classList.remove('advantage-die', 'advantage-winner');

                    // Apply green heal color
                    winner.classList.add('roll-heal-normal');

                    if (callback) callback(winner);
                }, 300);
            }, 200);
        }

        // Roll both dice simultaneously (grey)
        animateRollGrey(dice1, rollResult1, onBothComplete);
        animateRollGrey(dice2, rollResult2, onBothComplete);
    }

    /**
     * Show overheal modifier then collapse to final value
     * Example: 5 (-2) → 3
     */
    function showOverhealCollapse(line, healNum, healRolled, overheal, finalHeal, healResultCategory, callback) {
        // Show the overheal modifier
        var modSpan = document.createElement('span');
        modSpan.className = 'mod-part mod-animate-in';
        modSpan.innerHTML = ' <span class="overheal-mod">(-' + overheal + ')</span>';
        line.appendChild(modSpan);

        // Wait, then collapse
        diceTimeout(function() {
            modSpan.classList.add('mod-collapsing');

            diceTimeout(function() {
                modSpan.remove();
                // Update the heal number to final value
                healNum.textContent = finalHeal;
                healNum.classList.add('dice-pop');

                diceTimeout(function() {
                    healNum.classList.remove('dice-pop');
                    // Show HEALED!
                    finishHealDisplay(line, healResultCategory, callback);
                }, 200);
            }, 250);
        }, 400);
    }

    /**
     * Finish heal display with HEALED! text
     */
    function finishHealDisplay(line, healResultCategory, callback) {
        // Add space before result
        var space = document.createTextNode(' ');
        line.appendChild(space);

        // Show HEALED! text - just green color, no special outline/glow
        var healedSpan = document.createElement('span');
        healedSpan.className = 'roll-result-text roll-type-heal';
        healedSpan.textContent = KEYWORDS.HEALED;
        line.appendChild(healedSpan);

        // Play heal sound
        playSfx('heal.ogg');

        diceTimeout(callback, config.lingerDelay);
    }

    // =========================================================================
    // DEFEND ROLL DISPLAY
    // =========================================================================

    /**
     * Show animated defend roll for mana recovery
     * Format: "Andi increases defense +4 AC and rolls [X]... Recovered +3 MP! Cooldown 5"
     * Or with overmana: "... Recovered +5 (-2) → +3 MP! Cooldown 5"
     *
     * @param {Object} options - { container, rollResult, defender, acBonus, manaRecovered, manaRolled, cooldown, isMinMana, isMaxMana, onACComplete }
     * @param {function} callback
     */
    function showDefendRoll(options, callback) {
        var container = options.container;
        var rollResult = options.rollResult;
        var defenderName = options.defender || 'Player';
        var acBonus = options.acBonus || 4;
        var manaRecovered = options.manaRecovered || 0;
        var manaRolled = options.manaRolled || manaRecovered;  // Rolled amount (before MP cap)
        var overmana = manaRolled - manaRecovered;  // Amount wasted due to MP cap
        var cooldown = options.cooldown || 0;  // Turns until defend available again
        var isMinMana = options.isMinMana || false;
        var isMaxMana = options.isMaxMana || false;
        var onACComplete = options.onACComplete || null;  // Callback when AC text finishes

        // Determine roll type and color class based on result
        var rollType = 'status';  // Default blue
        var manaColorClass = getRollClass('status', 'normal');

        if (isMinMana) {
            rollType = 'fumble';  // Grey for both roll and MP when 0
            manaColorClass = getRollClass('status', 'fumble');
        } else if (isMaxMana && overmana === 0) {
            rollType = 'crit';    // Special styling for max roll (only if no overmana)
            manaColorClass = getRollClass('status', 'crit');
        }

        // Single line for defend display (matches attack roll structure)
        var line = document.createElement('div');
        line.className = 'roll-result defend-roll';
        container.appendChild(line);

        // Helper to finish with cooldown display
        function finishWithCooldown() {
            if (cooldown > 0) {
                // Add cooldown label text
                var cooldownLabel = document.createElement('span');
                cooldownLabel.className = 'defend-cooldown-text';
                cooldownLabel.textContent = ' Cooldown ';
                line.appendChild(cooldownLabel);

                // Add cooldown number (normal size, same style as label)
                var cooldownNum = document.createElement('span');
                cooldownNum.className = 'defend-cooldown-number';
                cooldownNum.textContent = cooldown;
                line.appendChild(cooldownNum);
            }
            // Longer linger for defend results
            diceTimeout(callback, config.lingerDelay * 2);
        }

        // Phase 1: Type intro text then defender name
        typewriter(line, defenderName + ' assumes a defensive stance, Kung-Fu Panda style! ' + defenderName + ' increases defense ', function() {
            // Show AC bonus in dark green (normal font size)
            var acSpan = document.createElement('span');
            acSpan.className = 'ac-bonus-text';
            line.appendChild(acSpan);

            typewriter(acSpan, '+' + acBonus + ' AC', function() {
                // Fire the AC complete callback (for floating +AC number)
                if (onACComplete) {
                    onACComplete(acBonus);
                }

                // Add " and rolls " text with typewriter
                typewriter(line, ' and rolls ', function() {
                    // Create dice element
                    var diceNum = document.createElement('strong');
                    diceNum.className = 'dice-number';
                    diceNum.textContent = '?';
                    line.appendChild(diceNum);

                    // Animate the roll with appropriate type (grey if 0 MP, blue otherwise)
                    animateRoll(diceNum, rollResult, function() {
                        // Add result text with typewriter
                        typewriter(line, '... Recovered ', function() {
                            // Show MP - show rolled amount first if there's overmana
                            var manaSpan = document.createElement('span');
                            manaSpan.className = 'dice-number ' + manaColorClass;
                            line.appendChild(manaSpan);

                            var displayMana = overmana > 0 ? manaRolled : manaRecovered;
                            typewriter(manaSpan, '+' + displayMana, function() {
                                // If there's overmana, show collapse animation
                                if (overmana > 0) {
                                    showOvermanaCollapse(line, manaSpan, manaRolled, overmana, manaRecovered, cooldown, finishWithCooldown);
                                } else {
                                    // No overmana - just finish with MP! and cooldown
                                    typewriter(line, ' ' + KEYWORDS.MP, finishWithCooldown);
                                }
                            });
                        });
                    }, rollType);
                });
            });
        });
    }

    /**
     * Show overmana modifier then collapse to final value (like overheal)
     * Example: +5 (-2) → +3 MP! Cooldown 5
     */
    function showOvermanaCollapse(line, manaSpan, manaRolled, overmana, finalMana, cooldown, finishCallback) {
        // Show the overmana modifier
        var modSpan = document.createElement('span');
        modSpan.className = 'mod-part mod-animate-in';
        modSpan.innerHTML = ' <span class="overheal-mod">(-' + overmana + ')</span>';
        line.appendChild(modSpan);

        // Wait, then collapse
        diceTimeout(function() {
            modSpan.classList.add('mod-collapsing');

            diceTimeout(function() {
                modSpan.remove();
                // Update the mana number to final value
                manaSpan.textContent = '+' + finalMana;
                manaSpan.classList.add('dice-pop');

                diceTimeout(function() {
                    manaSpan.classList.remove('dice-pop');
                    // Finish with MP! then show cooldown via callback
                    typewriter(line, ' ' + KEYWORDS.MP, finishCallback);
                }, 200);
            }, 250);
        }, 400);
    }

    // =========================================================================
    // SIMPLE DAMAGE ROLL (for confusion, status effects, etc.)
    // =========================================================================

    /**
     * Show a simple damage roll with animated dice
     * Format: "Name hits themselves! [dice] DAMAGE"
     *
     * @param {Object} options
     * @param {Element} options.container - Container element to append to
     * @param {string} options.text - Text before the roll (e.g., "Andi hits themselves! ")
     * @param {number} options.damage - Final damage value
     * @param {number} options.sides - Dice sides (default 5 for confusion d5)
     * @param {string} options.damageText - Text after damage (default "DAMAGE")
     * @param {function} callback - Called when animation completes
     */
    function showSimpleDamageRoll(options, callback) {
        var container = options.container;
        var damage = options.damage;
        var sides = options.sides || 5;
        var damageText = options.damageText || KEYWORDS.DAMAGE;

        // Clear container and create roll result line
        container.innerHTML = '';
        var line = document.createElement('div');
        line.className = 'roll-result';
        container.appendChild(line);

        // Phase 1: Type the intro text
        typewriter(line, options.text, function() {
            // Phase 2: Create and animate the damage dice
            var damageNum = document.createElement('strong');
            damageNum.className = 'dice-number';
            damageNum.textContent = '?';
            line.appendChild(damageNum);

            // Shorter spin for simple damage rolls
            var originalDuration = config.spinDuration;
            config.spinDuration = 800;

            animateRoll(damageNum, {
                roll: damage,
                sides: sides,
                isCrit: false,
                isFumble: false,
                isMax: damage === sides,
                isMin: damage === 1
            }, function() {
                config.spinDuration = originalDuration;

                // Phase 3: Add damage text
                var textSpan = document.createElement('span');
                textSpan.className = 'damage-text roll-type-damage';
                textSpan.textContent = ' ' + damageText;
                line.appendChild(textSpan);

                // Linger then callback
                diceTimeout(function() {
                    if (callback) callback();
                }, config.lingerDelay);
            }, 'damage');
        });
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        // Config
        setSfxCallback: setSfxCallback,
        config: config,

        // Keywords - centralized text for UI consistency
        KEYWORDS: KEYWORDS,

        // Unified Roll Display System helpers
        // Use these to get consistent styling across combat log and floating numbers
        getRollClass: getRollClass,
        getResultCategory: getResultCategory,

        // Core animations
        animateRoll: animateRoll,
        animateAdvantageRoll: animateAdvantageRoll,
        typewriter: typewriter,

        // Composite displays
        showAttackRoll: showAttackRoll,
        showAttackRollLegacy: showAttackRollLegacy,
        showHealRoll: showHealRoll,
        showDefendRoll: showDefendRoll,
        showSimpleDamageRoll: showSimpleDamageRoll,

        // Individual phase functions (for custom flows)
        showModifiersAnimated: showModifiersAnimated,
        morphToResult: morphToResult,
        showDamagePhase: showDamagePhase,
        morphToDamage: morphToDamage,

        // Pause system
        pause: pauseDice,
        unpause: unpauseDice
    };
})();
