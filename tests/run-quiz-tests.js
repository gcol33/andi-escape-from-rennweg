/**
 * Node.js test runner for Quiz Module Tests
 *
 * Usage: node tests/run-quiz-tests.js
 */

// Minimal DOM mock
global.document = {
    getElementById: function(id) { return null; },
    createElement: function(tag) {
        return {
            style: {},
            classList: { add: function() {}, remove: function() {} }
        };
    }
};

// Make window an alias to global
global.window = global;

// Mock localStorage
var mockStorage = {};
global.localStorage = {
    getItem: function(key) { return mockStorage[key] || null; },
    setItem: function(key, value) { mockStorage[key] = value; },
    removeItem: function(key) { delete mockStorage[key]; },
    clear: function() { mockStorage = {}; }
};

// Mock Logger
global.Logger = {
    debug: function() {},
    info: function() {},
    warn: function() {},
    error: function() {}
};

// Mock TUNING
global.TUNING = {
    quiz: {
        defaultTimePerQuestion: 10,
        tickInterval: 1000,
        urgentThreshold: 3,
        criticalThreshold: 2
    }
};

// Mock TimerManager
var timers = {};
var timerId = 1;
global.TimerManager = {
    setTimeout: function(cb, delay, ns) {
        var id = timerId++;
        timers[id] = setTimeout(cb, delay);
        return id;
    },
    setInterval: function(cb, delay, ns) {
        var id = timerId++;
        timers[id] = setInterval(cb, delay);
        return id;
    },
    clear: function(id) {
        if (timers[id]) {
            clearTimeout(timers[id]);
            clearInterval(timers[id]);
            delete timers[id];
        }
    },
    clearAll: function() {
        for (var id in timers) {
            clearTimeout(timers[id]);
            clearInterval(timers[id]);
        }
        timers = {};
    }
};

// Load dependencies
var fs = require('fs');
var path = require('path');

console.log('Loading utils module...');
var utilsCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'utils.js'), 'utf8');
eval(utilsCode);

console.log('Loading quiz module...');
var quizCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'quiz.js'), 'utf8');
eval(quizCode);

// Load test code
var testCode = fs.readFileSync(path.join(__dirname, 'quiz.test.js'), 'utf8');
eval(testCode);

// Run tests
console.log('\n========================================');
console.log('RUNNING QUIZ MODULE TESTS');
console.log('========================================');

var success = runQuizTests();

// Clean up timers
TimerManager.clearAll();

console.log('\n========================================');
if (success) {
    console.log('SUCCESS: All tests passed!');
} else {
    console.log('FAILURE: Some tests failed');
    process.exit(1);
}
console.log('========================================\n');
