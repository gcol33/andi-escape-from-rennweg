/**
 * Node.js test runner for Logger Module Tests
 *
 * Usage: node tests/run-logger-tests.js
 */

// Make window an alias to global
global.window = global;

// Load dependencies
var fs = require('fs');
var path = require('path');

console.log('Loading logger module...');
var loggerCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'logger.js'), 'utf8');
eval(loggerCode);

// Load test code
var testCode = fs.readFileSync(path.join(__dirname, 'logger.test.js'), 'utf8');
eval(testCode);

// Run tests
console.log('\n========================================');
console.log('RUNNING LOGGER MODULE TESTS');
console.log('========================================');

var success = runLoggerTests();

console.log('\n========================================');
if (success) {
    console.log('SUCCESS: All tests passed!');
} else {
    console.log('FAILURE: Some tests failed');
    process.exit(1);
}
console.log('========================================\n');
