/**
 * Andi VN - Quiz Module
 *
 * Handles quiz logic: state management, timer, answer validation.
 * Follows the same separation pattern as battle (logic vs UI).
 *
 * Usage:
 *   QuizEngine.start(config, onComplete);
 *   // config = { questions, timePerQuestion, winTarget, loseTarget }
 *   // onComplete = function(result) where result = { won, target }
 */

var QuizEngine = (function() {
    'use strict';

    // === State ===
    var state = {
        active: false,
        questions: [],
        currentIndex: 0,
        timePerQuestion: 10,
        timeRemaining: 0,
        winTarget: null,
        loseTarget: null,
        timerInterval: null,
        onComplete: null
    };

    // === Configuration (pulled from TUNING) ===
    function getConfig() {
        var T = typeof TUNING !== 'undefined' ? TUNING.quiz : null;
        return {
            defaultTime: T ? T.defaultTimePerQuestion : 10,
            tickInterval: T ? T.tickInterval : 1000,
            urgentThreshold: T ? T.urgentThreshold : 3,
            criticalThreshold: T ? T.criticalThreshold : 2
        };
    }

    // === Public API ===

    /**
     * Start a quiz
     * @param {Object} config - Quiz configuration
     * @param {Array} config.questions - Array of question objects
     * @param {number} config.timePerQuestion - Seconds per question
     * @param {string} config.winTarget - Scene ID on success
     * @param {string} config.loseTarget - Scene ID on failure
     * @param {function} onComplete - Callback when quiz ends: function({ won, target })
     */
    function start(config, onComplete) {
        if (state.active) {
            console.warn('[Quiz] Already active, ignoring start');
            return;
        }

        var cfg = getConfig();

        state.active = true;
        state.questions = config.questions || [];
        state.currentIndex = 0;
        state.timePerQuestion = config.timePerQuestion || cfg.defaultTime;
        state.timeRemaining = state.timePerQuestion;
        state.winTarget = config.winTarget;
        state.loseTarget = config.loseTarget;
        state.onComplete = onComplete;

        console.log('[Quiz] Starting with', state.questions.length, 'questions');

        // Show first question
        showCurrentQuestion();
    }

    /**
     * Show the current question and start timer
     */
    function showCurrentQuestion() {
        if (state.currentIndex >= state.questions.length) {
            // All questions answered correctly
            endQuiz(true);
            return;
        }

        var question = state.questions[state.currentIndex];
        state.timeRemaining = state.timePerQuestion;

        // Notify UI to display question
        if (typeof QuizUI !== 'undefined') {
            QuizUI.showQuestion({
                questionNumber: state.currentIndex + 1,
                totalQuestions: state.questions.length,
                questionText: question.question,
                answers: question.answers,
                timeRemaining: state.timeRemaining
            });
        }

        // Start countdown timer
        startTimer();
    }

    /**
     * Start the countdown timer
     */
    function startTimer() {
        var cfg = getConfig();

        // Clear any existing timer
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
        }

        state.timerInterval = setInterval(function() {
            state.timeRemaining--;

            // Notify UI of time update
            if (typeof QuizUI !== 'undefined') {
                QuizUI.updateCountdown(state.timeRemaining, cfg);
            }

            // Time's up!
            if (state.timeRemaining <= 0) {
                clearInterval(state.timerInterval);
                state.timerInterval = null;
                endQuiz(false, 'timeout');
            }
        }, cfg.tickInterval);
    }

    /**
     * Stop the timer
     */
    function stopTimer() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
    }

    /**
     * Submit an answer
     * @param {number} answerIndex - Index of selected answer (0-based)
     */
    function submitAnswer(answerIndex) {
        if (!state.active) return;

        stopTimer();

        var question = state.questions[state.currentIndex];
        var selectedAnswer = question.answers[answerIndex];
        var isCorrect = selectedAnswer && selectedAnswer.correct === true;

        console.log('[Quiz] Answer submitted:', answerIndex, 'correct:', isCorrect);

        if (isCorrect) {
            // Move to next question
            state.currentIndex++;

            if (typeof QuizUI !== 'undefined') {
                QuizUI.showAnswerFeedback(true, function() {
                    showCurrentQuestion();
                });
            } else {
                showCurrentQuestion();
            }
        } else {
            // Wrong answer - quiz failed
            endQuiz(false, 'wrong');
        }
    }

    /**
     * End the quiz
     * @param {boolean} won - Whether the player won
     * @param {string} reason - 'wrong', 'timeout', or undefined for win
     */
    function endQuiz(won, reason) {
        stopTimer();
        state.active = false;

        var target = won ? state.winTarget : state.loseTarget;
        var result = {
            won: won,
            target: target,
            reason: reason,
            questionsAnswered: state.currentIndex,
            totalQuestions: state.questions.length
        };

        console.log('[Quiz] Ended:', result);

        // Show outro screen via UI
        if (typeof QuizUI !== 'undefined') {
            QuizUI.showOutro(result, function() {
                if (state.onComplete) {
                    state.onComplete(result);
                }
            });
        } else {
            if (state.onComplete) {
                state.onComplete(result);
            }
        }
    }

    /**
     * Check if quiz is active
     * @returns {boolean}
     */
    function isActive() {
        return state.active;
    }

    /**
     * Get current question index (0-based)
     * @returns {number}
     */
    function getCurrentIndex() {
        return state.currentIndex;
    }

    /**
     * Get time remaining
     * @returns {number}
     */
    function getTimeRemaining() {
        return state.timeRemaining;
    }

    /**
     * Cancel the quiz (e.g., for dev mode or scene transition)
     */
    function cancel() {
        stopTimer();
        state.active = false;

        if (typeof QuizUI !== 'undefined') {
            QuizUI.hide();
        }
    }

    // === Module Export ===
    return {
        start: start,
        submitAnswer: submitAnswer,
        isActive: isActive,
        getCurrentIndex: getCurrentIndex,
        getTimeRemaining: getTimeRemaining,
        cancel: cancel
    };

})();
