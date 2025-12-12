/**
 * Node.js test runner for ListenerManager Module Tests
 *
 * Usage: node tests/run-listener-manager-tests.js
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

console.log('Loading listener-manager module...');
var listenerManagerCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'listener-manager.js'), 'utf8');
eval(listenerManagerCode);

// Load test code
var testCode = fs.readFileSync(path.join(__dirname, 'listener-manager.test.js'), 'utf8');
eval(testCode);

// Run tests
console.log('\n========================================');
console.log('RUNNING LISTENER MANAGER MODULE TESTS');
console.log('========================================');

var success = runListenerManagerTests();

console.log('\n========================================');
if (success) {
    console.log('SUCCESS: All tests passed!');
} else {
    console.log('FAILURE: Some tests failed');
    process.exit(1);
}
console.log('========================================\n');
