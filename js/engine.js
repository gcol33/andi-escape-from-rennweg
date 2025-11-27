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
        autoDelay: 1500, // ms to wait before auto-advancing
        currentSpeed: 'normal',
        saveKey: 'andi_vn_save'  // localStorage key for save data
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
        setupMuteButton();
        setupFirstInteraction();
        setupResetButton();
        setupTapToHide();

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
    function loadScene(sceneId, prependContent, entrySfx) {
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

        // Auto-save progress
        saveState();

        // Render the scene (pass entry SFX if provided)
        renderScene(scene, prependContent, entrySfx);
    }

    // === Text Splitting ===
    // Maximum characters before auto-splitting (approximate, will split at sentence boundary)
    var MAX_BLOCK_LENGTH = 350;

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

    function balanceSplitText(text, maxLength) {
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
                var splitBlocks = balanceSplitText(block, MAX_BLOCK_LENGTH);

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
        if (entrySfx) {
            // Small pause before SFX, then play SFX, then pause before text
            setTimeout(function() {
                playSfxWithDucking(entrySfx, function() {
                    // Pause after SFX before starting text
                    setTimeout(function() {
                        // Now start music and text
                        var musicToPlay = scene.music || config.defaultMusic;
                        setMusic(musicToPlay);
                        renderCurrentBlock(prependContent);
                    }, 200); // 200ms pause after SFX
                });
            }, 150); // 150ms pause before SFX
        } else {
            // No SFX - start music and text immediately
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
                    }, 150); // Short delay for skip mode
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
                    tryPlayMusic(); // Retry music on user interaction
                    // Set flags from choice
                    if (choice.set_flags && choice.set_flags.length > 0) {
                        setFlags(choice.set_flags);
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

        elements.bgMusic.play().catch(function(e) {
            // Autoplay blocked - will retry after user interaction
            console.log('VNEngine: Music autoplay blocked, will retry after interaction');
        });
    }

    function stopMusic() {
        if (!elements.bgMusic) return;

        elements.bgMusic.pause();
        elements.bgMusic.currentTime = 0;
        elements.bgMusic.src = '';
        state.audio.currentMusic = null;
    }

    function playSfx(filename, callback) {
        if (state.audio.muted) {
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

        audio.play().catch(function(e) {
            console.log('VNEngine: SFX playback failed:', e);
            if (callback) callback();
        });
    }

    /**
     * Play SFX with music ducking (VN-style)
     * Ducks music volume, plays SFX, then restores music and calls callback
     */
    function playSfxWithDucking(filename, callback) {
        if (state.audio.muted) {
            if (callback) callback();
            return;
        }

        var path = config.assetPaths.sfx + filename;
        var audio = new Audio(path);
        var originalVolume = state.audio.volume;
        var duckedVolume = originalVolume * 0.2; // Duck to 20% of original

        // Duck music
        if (elements.bgMusic) {
            elements.bgMusic.volume = duckedVolume;
        }

        // Restore music and call callback when SFX ends
        var onEnd = function() {
            if (elements.bgMusic) {
                elements.bgMusic.volume = originalVolume;
            }
            if (callback) callback();
        };

        audio.addEventListener('ended', onEnd);
        audio.addEventListener('error', onEnd);

        audio.play().catch(function(e) {
            console.log('VNEngine: SFX playback failed:', e);
            onEnd();
        });
    }

    function toggleMute() {
        state.audio.muted = !state.audio.muted;

        if (elements.bgMusic) {
            elements.bgMusic.muted = state.audio.muted;
        }

        // Update mute button appearance
        if (elements.muteBtn) {
            updateMuteButtonIcon(state.audio.muted);
            elements.muteBtn.title = state.audio.muted ? 'Unmute' : 'Mute';
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

    // === Save/Load System ===
    function saveState() {
        try {
            var saveData = {
                currentSceneId: state.currentSceneId,
                currentBlockIndex: state.currentBlockIndex,
                flags: state.flags,
                readBlocks: state.readBlocks,
                history: state.history
            };
            localStorage.setItem(config.saveKey, JSON.stringify(saveData));
        } catch (e) {
            console.warn('VNEngine: Could not save state:', e);
        }
    }

    function loadSavedState() {
        try {
            var saved = localStorage.getItem(config.saveKey);
            if (!saved) return false;

            var saveData = JSON.parse(saved);

            // Restore state
            state.flags = saveData.flags || {};
            state.readBlocks = saveData.readBlocks || {};
            state.history = saveData.history || [];

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
            console.warn('VNEngine: Could not load saved state:', e);
        }
        return false;
    }

    function clearSavedState() {
        try {
            localStorage.removeItem(config.saveKey);
        } catch (e) {
            console.warn('VNEngine: Could not clear saved state:', e);
        }
    }

    function setupResetButton() {
        // Create reset button in bottom-right corner (touch-friendly 44x44 minimum)
        var resetBtn = document.createElement('button');
        resetBtn.id = 'reset-btn';
        resetBtn.textContent = '↺';
        resetBtn.title = 'Reset Progress';
        // Touch-friendly sizing: 44x44px minimum tap target
        resetBtn.style.cssText = 'position: fixed; bottom: 10px; right: 10px; width: 44px; height: 44px; background: rgba(176, 139, 90, 0.8); color: #fffbe9; border: none; border-radius: 50%; font-size: 20px; cursor: pointer; z-index: 1000; transition: background 0.2s, transform 0.1s; -webkit-tap-highlight-color: rgba(143, 111, 70, 0.5); user-select: none; -webkit-user-select: none;';

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
    function reset() {
        state.currentSceneId = null;
        state.currentBlockIndex = 0;
        state.flags = {};
        state.history = [];
        clearBackground();
        clearCharacters();
        stopMusic();
        loadScene(config.startScene);
    }

    function fullReset() {
        // Clear everything including read blocks and saved state
        state.currentSceneId = null;
        state.currentBlockIndex = 0;
        state.flags = {};
        state.history = [];
        state.readBlocks = {};
        clearSavedState();
        updateSkipButtonVisibility();
        clearBackground();
        clearCharacters();
        stopMusic();
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
