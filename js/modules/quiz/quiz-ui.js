/**
 * Andi VN - Quiz UI Module
 *
 * Handles all quiz UI rendering: question display, countdown, answer buttons, outro.
 * Theme-agnostic - all visual styling comes from CSS.
 *
 * Follows the same separation pattern as battle-ui.js and qte-ui.js.
 */

var QuizUI = (function() {
    'use strict';

    // Use Logger module via Utils
    var _log = Utils.getLogger();

    // === DOM Element Cache ===
    var elements = {
        container: null,      // #vn-container
        quizOverlay: null,    // Main quiz overlay
        questionText: null,   // Question text element
        answersContainer: null, // Answer buttons container
        countdown: null,      // Countdown display
        progressText: null    // "Question 1/3" text
    };

    // === Cleanup State ===
    var cleanup = {
        answerHandlers: [],   // { element, handler } pairs for answer buttons
        timeoutIds: []        // Active timeout IDs for cancellation
    };

    /**
     * Create a tracked timeout that can be cancelled on cleanup
     * @param {function} callback - Function to call
     * @param {number} delay - Delay in ms
     * @returns {number} Timeout ID
     */
    function trackedTimeout(callback, delay) {
        var id = setTimeout(function() {
            // Remove from tracking array when executed
            var idx = cleanup.timeoutIds.indexOf(id);
            if (idx !== -1) {
                cleanup.timeoutIds.splice(idx, 1);
            }
            callback();
        }, delay);
        cleanup.timeoutIds.push(id);
        return id;
    }

    /**
     * Cancel all tracked timeouts
     */
    function cancelAllTimeouts() {
        cleanup.timeoutIds.forEach(function(id) {
            clearTimeout(id);
        });
        cleanup.timeoutIds = [];
    }

    // === Configuration ===
    function getConfig() {
        var T = typeof TUNING !== 'undefined' ? TUNING.quiz : null;
        return {
            urgentThreshold: T ? T.urgentThreshold : 3,
            criticalThreshold: T ? T.criticalThreshold : 2,
            feedbackDelay: T ? T.feedbackDelay : 500,
            outroDelay: T ? T.outroDelay : 2000
        };
    }

    // === Initialization ===

    /**
     * Initialize the quiz UI
     * @param {HTMLElement} container - The VN container element
     */
    function init(container) {
        elements.container = container || document.getElementById('vn-container');
    }

    // === Question Display ===

    /**
     * Show a question with answers
     * @param {Object} data - Question data
     * @param {number} data.questionNumber - Current question (1-based)
     * @param {number} data.totalQuestions - Total questions
     * @param {string} data.questionText - The question text
     * @param {Array} data.answers - Array of answer objects with 'text' property
     * @param {number} data.timeRemaining - Initial time in seconds
     * @param {number|null} data.seenCorrectIndex - Index of correct answer if seen before
     */
    function showQuestion(data) {
        // Remove existing overlay if present
        hide();

        if (!elements.container) {
            elements.container = document.getElementById('vn-container');
        }

        // Create quiz overlay
        var overlay = document.createElement('div');
        overlay.className = 'quiz-overlay';
        overlay.id = 'quiz-overlay';

        // Progress text (Question 1/3)
        var progress = document.createElement('div');
        progress.className = 'quiz-progress';
        progress.textContent = 'Question ' + data.questionNumber + '/' + data.totalQuestions;
        elements.progressText = progress;

        // Countdown display
        var countdown = document.createElement('div');
        countdown.className = 'quiz-countdown';
        countdown.textContent = data.timeRemaining;
        elements.countdown = countdown;

        // Question text
        var questionEl = document.createElement('div');
        questionEl.className = 'quiz-question';
        questionEl.textContent = data.questionText;
        elements.questionText = questionEl;

        // Answers container
        var answersContainer = document.createElement('div');
        answersContainer.className = 'quiz-answers';
        elements.answersContainer = answersContainer;

        // Clear previous answer handlers
        cleanup.answerHandlers = [];

        // Create answer buttons
        data.answers.forEach(function(answer, index) {
            var btn = document.createElement('button');
            btn.className = 'quiz-answer-btn';
            btn.textContent = answer.text;
            btn.setAttribute('data-index', index);

            // Highlight the correct answer if player has seen it before
            if (data.seenCorrectIndex !== null && data.seenCorrectIndex === index) {
                btn.classList.add('quiz-answer-hint');
            }

            // Create handler and track for cleanup
            var handler = function() {
                handleAnswerClick(index);
            };
            cleanup.answerHandlers.push({ element: btn, handler: handler });

            // Use ListenerManager if available
            if (typeof ListenerManager !== 'undefined') {
                ListenerManager.add(btn, 'click', handler, 'quiz');
            } else {
                btn.addEventListener('click', handler);
            }

            answersContainer.appendChild(btn);
        });

        // Assemble overlay
        overlay.appendChild(progress);
        overlay.appendChild(countdown);
        overlay.appendChild(questionEl);
        overlay.appendChild(answersContainer);

        elements.quizOverlay = overlay;
        elements.container.appendChild(overlay);

        // Animate in
        requestAnimationFrame(function() {
            overlay.classList.add('quiz-visible');
        });
    }

    /**
     * Handle answer button click
     * @param {number} index - Answer index
     */
    function handleAnswerClick(index) {
        // Disable all buttons to prevent double-click
        var buttons = elements.answersContainer.querySelectorAll('.quiz-answer-btn');
        buttons.forEach(function(btn) {
            btn.disabled = true;
        });

        // Highlight selected button
        buttons[index].classList.add('quiz-answer-selected');

        // Submit to quiz engine
        if (typeof QuizEngine !== 'undefined') {
            QuizEngine.submitAnswer(index);
        }
    }

    // === Countdown Display ===

    /**
     * Update the countdown display
     * @param {number} timeRemaining - Seconds remaining
     * @param {Object} config - Config with urgentThreshold and criticalThreshold
     */
    function updateCountdown(timeRemaining, config) {
        if (!elements.countdown) return;

        var cfg = config || getConfig();

        // Update text
        elements.countdown.textContent = timeRemaining;

        // Remove previous state classes
        elements.countdown.classList.remove('quiz-countdown-pulse', 'quiz-countdown-urgent', 'quiz-countdown-critical');

        // Add urgency classes
        if (timeRemaining <= cfg.criticalThreshold) {
            elements.countdown.classList.add('quiz-countdown-critical');
        } else if (timeRemaining <= cfg.urgentThreshold) {
            elements.countdown.classList.add('quiz-countdown-urgent');
        }

        // Trigger pulse animation
        void elements.countdown.offsetWidth; // Force reflow
        elements.countdown.classList.add('quiz-countdown-pulse');
    }

    // === Answer Feedback ===

    /**
     * Show feedback for correct/wrong answer
     * @param {boolean} correct - Whether answer was correct
     * @param {function} callback - Called after feedback animation
     */
    function showAnswerFeedback(correct, callback) {
        var cfg = getConfig();

        if (correct) {
            // Brief flash of success, then proceed
            if (elements.quizOverlay) {
                elements.quizOverlay.classList.add('quiz-correct-flash');
            }

            // Play success sound
            playSfx('success.ogg');

            trackedTimeout(function() {
                if (elements.quizOverlay) {
                    elements.quizOverlay.classList.remove('quiz-correct-flash');
                }
                if (callback) callback();
            }, cfg.feedbackDelay);
        } else {
            // Wrong answer - will be handled by showOutro
            if (callback) callback();
        }
    }

    // === Outro Screen ===

    /**
     * Show victory or defeat outro
     * @param {Object} result - Quiz result from QuizEngine
     * @param {boolean} result.won - Whether player won
     * @param {string} result.reason - 'wrong', 'timeout', or undefined
     * @param {function} callback - Called after outro animation
     */
    function showOutro(result, callback) {
        var cfg = getConfig();

        // Hide current quiz UI
        if (elements.quizOverlay) {
            elements.quizOverlay.classList.remove('quiz-visible');
        }

        var mainText = '';
        var subText = '';
        var overlayClass = '';
        var soundFile = '';

        if (result.won) {
            mainText = 'Quiz Complete!';
            subText = 'All answers correct!';
            overlayClass = 'victory';
            soundFile = 'victory.ogg';
        } else {
            mainText = 'Quiz Failed';
            if (result.reason === 'timeout') {
                subText = "Time's up!";
            } else {
                subText = 'Wrong answer!';
            }
            overlayClass = 'defeat';
            soundFile = 'failure.ogg';
        }

        // Play sound
        playSfx(soundFile);

        // Create outro overlay (reusing battle outro classes)
        var outroOverlay = document.createElement('div');
        outroOverlay.className = 'quiz-outro-overlay ' + overlayClass;
        outroOverlay.id = 'quiz-outro-overlay';

        var textEl = document.createElement('div');
        textEl.className = 'quiz-outro-text ' + overlayClass;
        textEl.textContent = mainText;
        outroOverlay.appendChild(textEl);

        var subEl = document.createElement('div');
        subEl.className = 'quiz-outro-subtext';
        subEl.textContent = subText;
        outroOverlay.appendChild(subEl);

        // Add to container
        if (elements.container) {
            elements.container.appendChild(outroOverlay);
        }

        // Add sparkles for victory
        if (result.won) {
            createVictorySparkles(outroOverlay);
        }

        // Clean up after delay
        trackedTimeout(function() {
            // Remove outro overlay
            Utils.removeElement(document.getElementById('quiz-outro-overlay'));

            // Remove quiz overlay
            hide();

            if (callback) callback();
        }, cfg.outroDelay);
    }

    /**
     * Create sparkle effects for victory screen (copied from battle-ui.js)
     */
    function createVictorySparkles(container) {
        // Use shared Utils function
        Utils.createVictorySparkles(container, {
            count: 12,
            interval: 100,
            lifetime: 1500,
            topMin: 30,
            topRange: 40
        });
    }

    // === Utility ===

    /**
     * Play a sound effect
     * @param {string} filename - Sound file in assets/sfx/
     */
    function playSfx(filename) {
        if (typeof VNEngine !== 'undefined' && VNEngine.playSfx) {
            VNEngine.playSfx(filename);
        } else {
            // Fallback: try to play directly
            try {
                var audio = new Audio('assets/sfx/' + filename);
                audio.volume = 0.5;
                audio.play().catch(function() {});
            } catch (e) {
                _log.warn('QuizUI', 'Could not play SFX:', filename);
            }
        }
    }

    /**
     * Clean up event listeners
     */
    function cleanupListeners() {
        // Remove answer button listeners
        if (typeof ListenerManager !== 'undefined') {
            ListenerManager.removeAll('quiz');
        } else {
            // Manual cleanup
            cleanup.answerHandlers.forEach(function(entry) {
                entry.element.removeEventListener('click', entry.handler);
            });
        }
        cleanup.answerHandlers = [];
    }

    /**
     * Hide and remove quiz UI
     */
    function hide() {
        // Cancel pending timeouts
        cancelAllTimeouts();

        // Clean up listeners before removing elements
        cleanupListeners();

        // Remove DOM elements
        Utils.removeElement(elements.quizOverlay);

        elements.quizOverlay = null;
        elements.questionText = null;
        elements.answersContainer = null;
        elements.countdown = null;
        elements.progressText = null;
    }

    /**
     * Full cleanup - call when quiz module is being destroyed
     */
    function destroy() {
        hide();
        elements.container = null;
        _log.debug('QuizUI', 'Destroyed');
    }

    /**
     * Show an error message to the user
     * @param {string} message - Error message to display
     * @param {function} callback - Called after error is acknowledged
     */
    function showError(message, callback) {
        // Play error sound
        playSfx('failure.ogg');

        // Show error in question text if available, otherwise alert
        if (elements.questionText) {
            elements.questionText.textContent = message;
            elements.questionText.classList.add('quiz-error');
        }

        // Disable answer buttons
        if (elements.answersContainer) {
            var buttons = elements.answersContainer.querySelectorAll('button');
            for (var i = 0; i < buttons.length; i++) {
                buttons[i].disabled = true;
            }
        }

        // Call callback after brief delay
        trackedTimeout(function() {
            if (callback) callback();
        }, 1500);
    }

    /**
     * Check if quiz UI is visible
     * @returns {boolean}
     */
    function isVisible() {
        return elements.quizOverlay !== null;
    }

    // === Module Export ===
    return {
        init: init,
        destroy: destroy,
        showQuestion: showQuestion,
        updateCountdown: updateCountdown,
        showAnswerFeedback: showAnswerFeedback,
        showOutro: showOutro,
        showError: showError,
        hide: hide,
        isVisible: isVisible
    };

})();
