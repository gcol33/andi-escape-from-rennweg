/**
 * Node.js test runner for Andi VN Battle System Tests
 *
 * Usage: node tests/run-tests.js
 *
 * This creates a minimal DOM environment to run the battle tests
 * without requiring a browser.
 */

// Minimal DOM mock for testing
global.document = {
    getElementById: function(id) {
        return null; // Most tests don't need actual DOM elements
    },
    createElement: function(tag) {
        return {
            id: '',
            className: '',
            style: {},
            innerHTML: '',
            textContent: '',
            title: '',
            appendChild: function() {},
            classList: {
                add: function() {},
                remove: function() {}
            },
            querySelectorAll: function() { return []; }
        };
    }
};

global.window = {
    location: { search: '' }
};

// Load battle engine
console.log('Loading battle engine...');
var fs = require('fs');
var path = require('path');

var battleCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle.js'), 'utf8');
eval(battleCode);

// Load test code
var testCode = fs.readFileSync(path.join(__dirname, 'battle.test.js'), 'utf8');
eval(testCode);

// Run tests
console.log('\n========================================');
console.log('RUNNING BATTLE SYSTEM TESTS');
console.log('========================================\n');

runTests();

// Wait for async tests to complete then show report
setTimeout(function() {
    console.log('\n========================================');
    if (TestRunner.failed === 0) {
        console.log('SUCCESS: All ' + TestRunner.passed + ' tests passed!');
    } else {
        console.log('FAILURE: ' + TestRunner.failed + ' of ' + (TestRunner.passed + TestRunner.failed) + ' tests failed');
        process.exit(1);
    }
    console.log('========================================\n');
}, 4000);
