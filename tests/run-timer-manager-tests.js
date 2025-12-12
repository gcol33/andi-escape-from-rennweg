/**
 * Node.js test runner for TimerManager Module Tests
 *
 * Usage: node tests/run-timer-manager-tests.js
 */

// Make window an alias to global
global.window = global;

// Mock Logger
global.Logger = {
    debug: function() {},
    info: function() {},
    warn: function() {},
    error: function() {}
};

// Load dependencies
var fs = require('fs');
var path = require('path');

console.log('Loading timer-manager module...');
var timerManagerCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'timer-manager.js'), 'utf8');
eval(timerManagerCode);

// Load test code
var testCode = fs.readFileSync(path.join(__dirname, 'timer-manager.test.js'), 'utf8');
eval(testCode);

// Run tests
console.log('\n========================================');
console.log('RUNNING TIMER MANAGER MODULE TESTS');
console.log('========================================');

var success = runTimerManagerTests();

console.log('\n========================================');
if (success) {
    console.log('SUCCESS: All tests passed!');
} else {
    console.log('FAILURE: Some tests failed');
    process.exit(1);
}
console.log('========================================\n');
