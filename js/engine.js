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
            sfx: 'assets/sfx/'
        },
        startScene: 'start',
        textSpeed: {
            normal: 30,  // milliseconds per character
            fast: 10,    // 3x faster
            auto: 30,    // same as normal, but auto-advances
            skip: 0      // instant (only for read blocks)
        },
        autoDelay: 1500, // ms to wait before auto-advancing
        currentSpeed: 'normal'
    };

    // === State ===
    const state = {
        currentSceneId: null,
        currentBlockIndex: 0,
        flags: {},
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
        devMode: false,
        devKeysHeld: {}
    };

    // === Action Handler Registry ===
    const actionHandlers = {
        /**
         * Roll dice action handler
         * Rolls specified dice, compares to threshold, navigates to success/failure scene
         */
        roll_dice: function(action) {
            var diceType = action.dice || 'd20';
            var threshold = action.threshold || 10;
            var successTarget = action.success_target;
            var failureTarget = action.failure_target;

            // Parse dice type (e.g., 'd20' -> 20 sides)
            var sides = 20;
            var match = diceType.match(/d(\d+)/i);
            if (match) {
                sides = parseInt(match[1], 10);
            }

            // Roll the dice
            var result = Math.floor(Math.random() * sides) + 1;
            var success = result <= threshold;

            // Display roll result
            var resultText = '<div class="dice-roll">You rolled a ' + diceType +
                ' and got: <strong>' + result + '</strong>!</div>';

            // Navigate to appropriate scene
            if (success) {
                loadScene(successTarget, resultText);
            } else {
                loadScene(failureTarget, resultText);
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
                console.warn('VNEngine: Custom handler not found:', handlerName);
            }
        }
    };

    // === DOM References ===
    var elements = {};

    // === Initialization ===
    function init() {
        cacheElements();
        setupClickToSkip();
        setupSpeedControls();
        setupContinueButton();
        loadScene(config.startScene);
    }

    function cacheElements() {
        elements = {
            storyOutput: document.getElementById('story-output'),
            choicesContainer: document.getElementById('choices-container'),
            backgroundLayer: document.getElementById('background-layer'),
            spriteLayer: document.getElementById('sprite-layer'),
            continueBtn: document.getElementById('continue-btn')
        };
    }

    function setupContinueButton() {
        if (elements.continueBtn) {
            elements.continueBtn.addEventListener('click', function() {
                advanceTextBlock();
            });
        }
    }

    function setupSpeedControls() {
        var buttons = document.querySelectorAll('.speed-btn');
        buttons.forEach(function(btn) {
            btn.addEventListener('click', function() {
                var speed = this.getAttribute('data-speed');
                setTextSpeed(speed);

                // Update active state
                buttons.forEach(function(b) { b.classList.remove('active'); });
                this.classList.add('active');
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
        return config.textSpeed[config.currentSpeed] || config.textSpeed.normal;
    }

    function setupClickToSkip() {
        // Click on story output to skip typewriter
        elements.storyOutput.addEventListener('click', function() {
            skipTypewriter();
        });

        // Also allow spacebar to skip or continue
        document.addEventListener('keydown', function(e) {
            if (e.code === 'Space' || e.key === ' ') {
                // Only if not focused on a button
                if (document.activeElement.tagName !== 'BUTTON') {
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
            skipBtn.style.display = hasReadBlocks ? 'inline-block' : 'none';
        }
    }

    function showDevModeIndicator(show) {
        var indicator = document.getElementById('dev-mode-indicator');

        if (show) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'dev-mode-indicator';
                indicator.textContent = 'DEV MODE';
                indicator.style.cssText = 'position: fixed; top: 10px; right: 10px; background: #00ff00; color: #000; padding: 5px 10px; font-size: 12px; font-weight: bold; border-radius: 3px; z-index: 9999;';
                document.body.appendChild(indicator);
            }
            indicator.style.display = 'block';
        } else if (indicator) {
            indicator.style.display = 'none';
        }
    }

    // === Scene Loading ===
    function loadScene(sceneId, prependContent) {
        prependContent = prependContent || '';

        // Check for special roll trigger
        if (sceneId === '_roll') {
            executeActions();
            return;
        }

        var scene = story[sceneId];

        if (!scene) {
            console.error('VNEngine: Scene not found:', sceneId);
            return;
        }

        // Check flag requirements
        if (scene.require_flags && scene.require_flags.length > 0) {
            if (!checkFlags(scene.require_flags)) {
                console.warn('VNEngine: Flag requirements not met for scene:', sceneId);
                return;
            }
        }

        // Set flags if specified
        if (scene.set_flags && scene.set_flags.length > 0) {
            setFlags(scene.set_flags);
        }

        // Update state
        state.currentSceneId = sceneId;
        state.currentBlockIndex = 0;
        state.history.push(sceneId);

        // Render the scene
        renderScene(scene, prependContent);
    }

    // === Rendering ===
    function renderScene(scene, prependContent) {
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

        // Clear choices while showing text
        elements.choicesContainer.innerHTML = '';

        // Show first text block
        renderCurrentBlock(prependContent);
    }

    function renderCurrentBlock(prependContent) {
        prependContent = prependContent || '';

        var scene = story[state.currentSceneId];
        if (!scene) return;

        var textBlocks = scene.textBlocks || [];
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

        var textBlocks = scene.textBlocks || [];

        if (state.currentBlockIndex < textBlocks.length - 1) {
            state.currentBlockIndex++;
            renderCurrentBlock();
        }
    }

    function showContinueButton() {
        if (elements.continueBtn) {
            elements.continueBtn.style.display = 'inline-block';
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
            if (onComplete) onComplete();
        } else if (alreadyRead) {
            // Already-read text with normal/fast: still typewriter but can skip
            textElement.classList.add('already-read');
            startTypewriter(formattedText, textElement, onComplete, true);
        } else {
            // New text: typewriter effect (no skip allowed on first read)
            startTypewriter(formattedText, textElement, onComplete, false);
        }
    }

    // === Typewriter Effect ===
    function startTypewriter(html, element, onComplete, canSkip) {
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
            canSkip: canSkip || false
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
        hideContinueButton();

        if (choices && choices.length > 0) {
            // Filter choices by required flags
            var availableChoices = choices.filter(function(choice) {
                if (choice.require_flags && choice.require_flags.length > 0) {
                    return checkFlags(choice.require_flags);
                }
                return true;
            });

            availableChoices.forEach(function(choice) {
                var button = document.createElement('button');
                button.className = 'choice-button';
                button.textContent = choice.label;
                button.onclick = function() {
                    // Set flags from choice
                    if (choice.set_flags && choice.set_flags.length > 0) {
                        setFlags(choice.set_flags);
                    }
                    // Navigate to target
                    loadScene(choice.target);
                };
                elements.choicesContainer.appendChild(button);
            });
        } else {
            // Game over state - add restart button
            elements.storyOutput.innerHTML += '<p class="game-over">The adventure is complete!</p>';

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
            console.warn('VNEngine: Unknown action type:', action.type);
        }
    }

    // === Asset Management ===
    function setBackground(filename) {
        if (elements.backgroundLayer) {
            var path = config.assetPaths.bg + filename;
            elements.backgroundLayer.style.backgroundImage = 'url(' + path + ')';
        }
    }

    function clearBackground() {
        if (elements.backgroundLayer) {
            elements.backgroundLayer.style.backgroundImage = 'none';
        }
    }

    function setCharacters(chars) {
        if (!elements.spriteLayer) return;

        elements.spriteLayer.innerHTML = '';

        chars.forEach(function(filename) {
            var img = document.createElement('img');
            img.src = config.assetPaths.char + filename;
            img.alt = filename;
            elements.spriteLayer.appendChild(img);
        });
    }

    function clearCharacters() {
        if (elements.spriteLayer) {
            elements.spriteLayer.innerHTML = '';
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

    // === Game Reset ===
    function reset() {
        state.currentSceneId = null;
        state.currentBlockIndex = 0;
        state.flags = {};
        state.history = [];
        clearBackground();
        clearCharacters();
        loadScene(config.startScene);
    }

    // === Public API ===
    return {
        init: init,
        loadScene: loadScene,
        getState: function() { return state; },
        getFlag: getFlag,
        setFlag: function(flag) { state.flags[flag] = true; },
        clearFlag: function(flag) { delete state.flags[flag]; },
        reset: reset,
        registerActionHandler: function(type, handler) {
            actionHandlers[type] = handler;
        }
    };

})();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    VNEngine.init();
});
