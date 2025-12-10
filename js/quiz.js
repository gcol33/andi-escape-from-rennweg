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
        onComplete: null,
        quizId: null  // Unique ID for this quiz (for tracking seen answers)
    };

    // === Seen Answers Storage ===
    var STORAGE_KEY = 'andi_vn_quiz_seen';

    /**
     * Get the seen answers from localStorage
     * Returns object like { "quiz_excursion:0": 0, "quiz_excursion:1": 1 }
     * where key is "quizId:questionIndex" and value is the correct answer index
     */
    function getSeenAnswers() {
        try {
            var data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            return {};
        }
    }

    /**
     * Mark a correct answer as seen (called when player fails after seeing the correct one)
     * @param {string} quizId - Quiz identifier
     * @param {number} questionIndex - Question index
     * @param {number} correctIndex - Index of the correct answer
     */
    function markAnswerSeen(quizId, questionIndex, correctIndex) {
        try {
            var seen = getSeenAnswers();
            var key = quizId + ':' + questionIndex;
            seen[key] = correctIndex;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
        } catch (e) {
            console.warn('[Quiz] Could not save seen answer:', e);
        }
    }

    /**
     * Get the correct answer index if player has seen it before
     * @param {string} quizId - Quiz identifier
     * @param {number} questionIndex - Question index
     * @returns {number|null} - Index of correct answer, or null if not seen
     */
    function getSeenCorrectIndex(quizId, questionIndex) {
        var seen = getSeenAnswers();
        var key = quizId + ':' + questionIndex;
        return seen.hasOwnProperty(key) ? seen[key] : null;
    }

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
     * @param {string} config.quizId - Unique ID for tracking seen answers
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
        state.quizId = config.quizId || 'default';
        state.onComplete = onComplete;

        console.log('[Quiz] Starting with', state.questions.length, 'questions, id:', state.quizId);

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

        // Check if player has seen the correct answer before
        var seenCorrectIndex = getSeenCorrectIndex(state.quizId, state.currentIndex);

        // Notify UI to display question
        if (typeof QuizUI !== 'undefined') {
            QuizUI.showQuestion({
                questionNumber: state.currentIndex + 1,
                totalQuestions: state.questions.length,
                questionText: question.question,
                answers: question.answers,
                timeRemaining: state.timeRemaining,
                seenCorrectIndex: seenCorrectIndex  // Pass hint if player saw it before
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

        // Find the correct answer index for this question
        var correctIndex = -1;
        for (var i = 0; i < question.answers.length; i++) {
            if (question.answers[i].correct === true) {
                correctIndex = i;
                break;
            }
        }

        // Mark the correct answer as seen (so player knows it next time)
        if (correctIndex >= 0) {
            markAnswerSeen(state.quizId, state.currentIndex, correctIndex);
        }

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
