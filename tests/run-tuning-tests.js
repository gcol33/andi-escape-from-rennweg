/**
 * Node.js test runner for Andi VN Tuning System Tests
 *
 * Usage: node tests/run-tuning-tests.js
 *
 * Tests the centralized tuning configuration and modular battle UI.
 */

// Minimal DOM mock for testing
global.document = {
    getElementById: function(id) {
        return null;
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
            remove: function() {},
            classList: {
                add: function() {},
                remove: function() {}
            },
            querySelectorAll: function() { return []; },
            querySelector: function() { return null; }
        };
    },
    querySelectorAll: function() { return []; }
};

global.window = {
    location: { search: '' }
};

// Load modules
console.log('Loading tuning module...');
var fs = require('fs');
var path = require('path');

// Load TUNING first
var tuningCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'tuning.js'), 'utf8');
eval(tuningCode);

// Load BattleUI (optional, may not work without full DOM)
try {
    var battleUICode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle-ui.js'), 'utf8');
    eval(battleUICode);
    console.log('Loaded battle-ui module');
} catch (e) {
    console.log('BattleUI module not loaded (expected in Node.js environment)');
}

// Load BattleEngine for integration tests
try {
    var battleCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle.js'), 'utf8');
    eval(battleCode);
    console.log('Loaded battle engine');
} catch (e) {
    console.log('Battle engine not loaded: ' + e.message);
}

// Load test code
var testCode = fs.readFileSync(path.join(__dirname, 'tuning.test.js'), 'utf8');
eval(testCode);

// Run tests
console.log('\n========================================');
console.log('RUNNING TUNING SYSTEM TESTS');
console.log('========================================');

runTuningTests();
runBattleUITests();
runIntegrationTests();

// Show report
TuningTestRunner.report();

console.log('\n========================================');
if (TuningTestRunner.failed === 0) {
    console.log('SUCCESS: All ' + TuningTestRunner.passed + ' tuning tests passed!');
} else {
    console.log('FAILURE: ' + TuningTestRunner.failed + ' of ' + (TuningTestRunner.passed + TuningTestRunner.failed) + ' tests failed');
    process.exit(1);
}
console.log('========================================\n');
