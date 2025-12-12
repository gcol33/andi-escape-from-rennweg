/**
 * Node.js test runner for Utils Module Tests
 *
 * Usage: node tests/run-utils-tests.js
 */

// Minimal DOM mock for testing
global.document = {
    getElementById: function(id) { return null; },
    createElement: function(tag) {
        return {
            id: '',
            className: '',
            style: {},
            innerHTML: '',
            textContent: '',
            appendChild: function() {},
            classList: {
                add: function() {},
                remove: function() {},
                toggle: function() {}
            },
            querySelectorAll: function() { return []; }
        };
    },
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; }
};

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

console.log('Loading utils module...');
var utilsCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'utils.js'), 'utf8');
eval(utilsCode);

// Load test code
var testCode = fs.readFileSync(path.join(__dirname, 'utils.test.js'), 'utf8');
eval(testCode);

// Run tests
console.log('\n========================================');
console.log('RUNNING UTILS MODULE TESTS');
console.log('========================================');

var success = runUtilsTests();

console.log('\n========================================');
if (success) {
    console.log('SUCCESS: All tests passed!');
} else {
    console.log('FAILURE: Some tests failed');
    process.exit(1);
}
console.log('========================================\n');
