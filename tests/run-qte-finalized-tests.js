/**
 * Node.js test runner for Andi VN QTE Finalized System Tests
 *
 * Usage: node tests/run-qte-finalized-tests.js
 *
 * This creates a minimal environment to run the finalized QTE tests
 * without requiring a browser.
 */

// Minimal globals for Node.js
global.document = {
    getElementById: function() { return null; },
    createElement: function() {
        return {
            id: '',
            className: '',
            style: {},
            innerHTML: '',
            appendChild: function() {},
            classList: { add: function() {}, remove: function() {} }
        };
    },
    body: { appendChild: function() {} },
    addEventListener: function() {}
};

global.window = {
    requestAnimationFrame: function(cb) { return setTimeout(cb, 16); },
    cancelAnimationFrame: function(id) { clearTimeout(id); }
};

global.requestAnimationFrame = global.window.requestAnimationFrame;
global.cancelAnimationFrame = global.window.cancelAnimationFrame;

global.performance = {
    now: function() { return Date.now(); }
};

// Load dependencies
console.log('Loading dependencies...');
var fs = require('fs');
var path = require('path');

// Load TUNING first
console.log('  - Loading tuning.js...');
try {
    var tuningCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'tuning.js'), 'utf8');
    eval(tuningCode);
} catch (e) {
    console.log('    Note: TUNING not loaded, using defaults');
}

// Load QTE UI (optional, QTE Engine may use it)
console.log('  - Loading qte-ui.js...');
try {
    var qteUICode = fs.readFileSync(path.join(__dirname, '..', 'js', 'qte-ui.js'), 'utf8');
    eval(qteUICode);
} catch (e) {
    console.log('    Note: QTEUI not loaded');
}

// Load the module under test
console.log('  - Loading qte.js...');
var qteCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'qte.js'), 'utf8');
eval(qteCode);

// Load test code
console.log('  - Loading qte-finalized.test.js...');
var testCode = fs.readFileSync(path.join(__dirname, 'qte-finalized.test.js'), 'utf8');
eval(testCode);

// Run tests
console.log('\n========================================');
console.log('RUNNING QTE FINALIZED SYSTEM TESTS');
console.log('========================================');

var success = runQTEFinalizedTests();

// Show results
console.log('\n========================================');
if (success) {
    console.log('SUCCESS: All tests passed!');
} else {
    console.log('FAILURE: Some tests failed');
    process.exit(1);
}
console.log('========================================\n');
