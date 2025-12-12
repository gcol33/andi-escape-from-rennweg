/**
 * Node.js test runner for Password Module Tests
 *
 * Usage: node tests/run-password-tests.js
 *
 * Note: These tests verify the password validation and comparison logic
 * without requiring a full DOM environment, since the PasswordScreen
 * module is heavily DOM-dependent.
 */

// Make window an alias to global
global.window = global;

// Load test code
var fs = require('fs');
var path = require('path');

var testCode = fs.readFileSync(path.join(__dirname, 'password.test.js'), 'utf8');
eval(testCode);

// Run tests
console.log('\n========================================');
console.log('RUNNING PASSWORD MODULE TESTS');
console.log('========================================');

var success = runPasswordTests();

console.log('\n========================================');
if (success) {
    console.log('SUCCESS: All tests passed!');
} else {
    console.log('FAILURE: Some tests failed');
    process.exit(1);
}
console.log('========================================\n');
