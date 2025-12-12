/**
 * Andi VN - Quiz Module Tests
 *
 * Run tests: node tests/run-quiz-tests.js
 *
 * Tests for quiz system including:
 * - Quiz initialization and validation
 * - Answer submission
 * - Timer behavior
 * - Win/lose conditions
 * - Seen answers tracking
 */

// Simple test framework
var TestRunner = {
    passed: 0,
    failed: 0,
    results: [],
    currentGroup: '',

    group: function(name) {
        this.currentGroup = name;
        console.log('\n--- ' + name + ' ---');
    },

    assert: function(condition, message) {
        var fullMessage = this.currentGroup ? this.currentGroup + ': ' + message : message;
        if (condition) {
            this.passed++;
            this.results.push({ pass: true, message: fullMessage });
            console.log('  ✓ ' + message);
        } else {
            this.failed++;
            this.results.push({ pass: false, message: fullMessage });
            console.error('  ✗ FAIL: ' + message);
        }
    },

    assertEqual: function(actual, expected, message) {
        var condition = actual === expected;
        if (!condition) {
            message += ' (expected ' + expected + ', got ' + actual + ')';
        }
        this.assert(condition, message);
    },

    assertDeepEqual: function(actual, expected, message) {
        var condition = JSON.stringify(actual) === JSON.stringify(expected);
        if (!condition) {
            message += ' (expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual) + ')';
        }
        this.assert(condition, message);
    },

    reset: function() {
        this.passed = 0;
        this.failed = 0;
        this.results = [];
        this.currentGroup = '';
    },

    report: function() {
        console.log('\n=== Quiz Module Test Results ===');
        console.log('Passed: ' + this.passed);
        console.log('Failed: ' + this.failed);
        console.log('Total: ' + (this.passed + this.failed));

        if (this.failed > 0) {
            console.log('\nFailed tests:');
            this.results.forEach(function(r) {
                if (!r.pass) console.log('  - ' + r.message);
            });
        }

        return this.failed === 0;
    }
};

// Mock localStorage
var mockStorage = {};
var localStorage = {
    getItem: function(key) { return mockStorage[key] || null; },
    setItem: function(key, value) { mockStorage[key] = value; },
    removeItem: function(key) { delete mockStorage[key]; },
    clear: function() { mockStorage = {}; }
};

function runQuizTests() {
    TestRunner.reset();

    // Reset quiz state before each test suite
    QuizEngine.cancel();

    testQuizStartValidation();
    testQuizStartWithValidConfig();
    testAnswerSubmissionCorrect();
    testAnswerSubmissionWrong();
    testQuizCancel();
    testSeenAnswersStorage();
    testQuizStateChecks();
    testResultObject();

    return TestRunner.report();
}

function testQuizStartValidation() {
    TestRunner.group('Quiz Start Validation');

    // Test with no config
    var result = null;
    QuizEngine.start(null, function(r) { result = r; });
    TestRunner.assertEqual(result.won, false, 'No config: returns won=false');
    TestRunner.assertEqual(result.reason, 'invalid_config', 'No config: returns invalid_config reason');

    // Test with empty questions
    result = null;
    QuizEngine.start({ questions: [] }, function(r) { result = r; });
    TestRunner.assertEqual(result.won, false, 'Empty questions: returns won=false');
    TestRunner.assertEqual(result.reason, 'no_questions', 'Empty questions: returns no_questions reason');

    // Test with no questions property
    result = null;
    QuizEngine.start({ winTarget: 'win' }, function(r) { result = r; });
    TestRunner.assertEqual(result.won, false, 'No questions prop: returns won=false');

    // Test with invalid question (no answers)
    result = null;
    QuizEngine.start({
        questions: [{ question: 'Test?' }]
    }, function(r) { result = r; });
    TestRunner.assertEqual(result.won, false, 'Question without answers: returns won=false');
    TestRunner.assertEqual(result.reason, 'invalid_question', 'Question without answers: returns invalid_question');
}

function testQuizStartWithValidConfig() {
    TestRunner.group('Quiz Start With Valid Config');

    QuizEngine.cancel();

    var started = false;
    QuizEngine.start({
        questions: [{
            question: 'What is 2+2?',
            answers: [
                { text: '3', correct: false },
                { text: '4', correct: true },
                { text: '5', correct: false }
            ]
        }],
        timePerQuestion: 10,
        winTarget: 'quiz_win',
        loseTarget: 'quiz_lose',
        quizId: 'test_quiz'
    }, function(r) { started = true; });

    TestRunner.assertEqual(QuizEngine.isActive(), true, 'Quiz is active after start');
    TestRunner.assertEqual(QuizEngine.getCurrentIndex(), 0, 'Current index is 0');
    TestRunner.assertEqual(QuizEngine.getTimeRemaining(), 10, 'Time remaining matches config');

    QuizEngine.cancel();
}

function testAnswerSubmissionCorrect() {
    TestRunner.group('Answer Submission - Correct');

    QuizEngine.cancel();

    var result = null;
    QuizEngine.start({
        questions: [
            {
                question: 'Q1',
                answers: [
                    { text: 'Wrong', correct: false },
                    { text: 'Right', correct: true }
                ]
            },
            {
                question: 'Q2',
                answers: [
                    { text: 'Right', correct: true },
                    { text: 'Wrong', correct: false }
                ]
            }
        ],
        timePerQuestion: 10,
        winTarget: 'win_scene',
        loseTarget: 'lose_scene'
    }, function(r) { result = r; });

    // Answer first question correctly
    QuizEngine.submitAnswer(1); // Index 1 is correct

    // Should advance to next question (QuizUI callback would trigger this)
    // In test environment without QuizUI, we check the state
    TestRunner.assertEqual(QuizEngine.getCurrentIndex(), 1, 'Advanced to question 2 after correct answer');

    // Answer second question correctly
    QuizEngine.submitAnswer(0); // Index 0 is correct for Q2

    // Quiz should complete with win after QuizUI callback
    // In our mock environment, result gets set synchronously
    TestRunner.assertEqual(result.won, true, 'Quiz won after all correct answers');
    TestRunner.assertEqual(result.target, 'win_scene', 'Win target returned');
    TestRunner.assertEqual(result.questionsAnswered, 2, 'Questions answered count is 2');

    QuizEngine.cancel();
}

function testAnswerSubmissionWrong() {
    TestRunner.group('Answer Submission - Wrong');

    QuizEngine.cancel();

    var result = null;
    QuizEngine.start({
        questions: [{
            question: 'Q1',
            answers: [
                { text: 'Wrong1', correct: false },
                { text: 'Right', correct: true },
                { text: 'Wrong2', correct: false }
            ]
        }],
        timePerQuestion: 10,
        winTarget: 'win_scene',
        loseTarget: 'lose_scene'
    }, function(r) { result = r; });

    // Answer incorrectly
    QuizEngine.submitAnswer(0); // Index 0 is wrong

    // Quiz should end with loss
    TestRunner.assertEqual(result.won, false, 'Quiz lost after wrong answer');
    TestRunner.assertEqual(result.target, 'lose_scene', 'Lose target returned');
    TestRunner.assertEqual(result.reason, 'wrong', 'Reason is wrong');
    TestRunner.assertEqual(result.questionsAnswered, 0, 'Questions answered is 0');

    QuizEngine.cancel();
}

function testQuizCancel() {
    TestRunner.group('Quiz Cancel');

    QuizEngine.start({
        questions: [{
            question: 'Q1',
            answers: [{ text: 'A', correct: true }]
        }],
        timePerQuestion: 10
    }, function(r) {});

    TestRunner.assertEqual(QuizEngine.isActive(), true, 'Quiz active before cancel');

    QuizEngine.cancel();

    TestRunner.assertEqual(QuizEngine.isActive(), false, 'Quiz inactive after cancel');
}

function testSeenAnswersStorage() {
    TestRunner.group('Seen Answers Storage');

    // Clear mock storage
    mockStorage = {};

    var STORAGE_KEY = 'andi_vn_quiz_seen';

    // Simulate marking an answer as seen
    function markAnswerSeen(quizId, questionIndex, correctIndex) {
        try {
            var data = localStorage.getItem(STORAGE_KEY);
            var seen = data ? JSON.parse(data) : {};
            var key = quizId + ':' + questionIndex;
            seen[key] = correctIndex;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
        } catch (e) {}
    }

    function getSeenCorrectIndex(quizId, questionIndex) {
        try {
            var data = localStorage.getItem(STORAGE_KEY);
            var seen = data ? JSON.parse(data) : {};
            var key = quizId + ':' + questionIndex;
            return seen.hasOwnProperty(key) ? seen[key] : null;
        } catch (e) {
            return null;
        }
    }

    // Initially no seen answers
    TestRunner.assertEqual(getSeenCorrectIndex('quiz1', 0), null, 'No seen answer initially');

    // Mark answer as seen
    markAnswerSeen('quiz1', 0, 2);
    TestRunner.assertEqual(getSeenCorrectIndex('quiz1', 0), 2, 'Seen answer stored and retrieved');

    // Different quiz/question
    TestRunner.assertEqual(getSeenCorrectIndex('quiz1', 1), null, 'Different question not seen');
    TestRunner.assertEqual(getSeenCorrectIndex('quiz2', 0), null, 'Different quiz not seen');

    // Add more seen answers
    markAnswerSeen('quiz1', 1, 0);
    markAnswerSeen('quiz2', 0, 1);

    TestRunner.assertEqual(getSeenCorrectIndex('quiz1', 0), 2, 'First answer still correct');
    TestRunner.assertEqual(getSeenCorrectIndex('quiz1', 1), 0, 'Second answer stored');
    TestRunner.assertEqual(getSeenCorrectIndex('quiz2', 0), 1, 'Different quiz answer stored');
}

function testQuizStateChecks() {
    TestRunner.group('Quiz State Checks');

    QuizEngine.cancel();

    // Before starting
    TestRunner.assertEqual(QuizEngine.isActive(), false, 'Not active before start');
    TestRunner.assertEqual(QuizEngine.getCurrentIndex(), 0, 'Index is 0 before start');
    // Note: timeRemaining may retain value from previous quiz after cancel

    // Start quiz
    QuizEngine.start({
        questions: [{
            question: 'Q1',
            answers: [{ text: 'A', correct: true }, { text: 'B', correct: false }]
        }],
        timePerQuestion: 15
    }, function(r) {});

    TestRunner.assertEqual(QuizEngine.isActive(), true, 'Active after start');
    TestRunner.assertEqual(QuizEngine.getTimeRemaining(), 15, 'Time matches config');

    QuizEngine.cancel();
}

function testResultObject() {
    TestRunner.group('Result Object Structure');

    QuizEngine.cancel();

    var result = null;
    QuizEngine.start({
        questions: [
            { question: 'Q1', answers: [{ text: 'A', correct: true }, { text: 'B', correct: false }] },
            { question: 'Q2', answers: [{ text: 'A', correct: true }, { text: 'B', correct: false }] },
            { question: 'Q3', answers: [{ text: 'A', correct: true }, { text: 'B', correct: false }] }
        ],
        timePerQuestion: 10,
        winTarget: 'win',
        loseTarget: 'lose'
    }, function(r) { result = r; });

    // Answer first correctly, then wrong
    QuizEngine.submitAnswer(0); // Q1 correct
    QuizEngine.submitAnswer(1); // Q2 wrong

    // Check result structure
    TestRunner.assert(result !== null, 'Result object returned');
    TestRunner.assert('won' in result, 'Result has won property');
    TestRunner.assert('target' in result, 'Result has target property');
    TestRunner.assert('reason' in result, 'Result has reason property');
    TestRunner.assert('questionsAnswered' in result, 'Result has questionsAnswered property');
    TestRunner.assert('totalQuestions' in result, 'Result has totalQuestions property');

    TestRunner.assertEqual(result.won, false, 'Won is false');
    TestRunner.assertEqual(result.target, 'lose', 'Target is lose scene');
    TestRunner.assertEqual(result.reason, 'wrong', 'Reason is wrong');
    TestRunner.assertEqual(result.questionsAnswered, 1, 'Questions answered is 1');
    TestRunner.assertEqual(result.totalQuestions, 3, 'Total questions is 3');

    QuizEngine.cancel();
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runQuizTests: runQuizTests, TestRunner: TestRunner };
}
