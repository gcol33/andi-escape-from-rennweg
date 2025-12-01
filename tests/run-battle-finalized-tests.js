/**
 * Node.js test runner for Andi VN Finalized Battle System Tests
 *
 * Usage: node tests/run-battle-finalized-tests.js
 *
 * This creates a minimal environment to run the finalized battle tests
 * without requiring a browser.
 */

// Minimal globals for Node.js
global.window = {};
global.document = {
    getElementById: function() { return null; },
    createElement: function() { return { style: {} }; },
    body: { appendChild: function() {} }
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

// Load BattleData (for skill definitions)
console.log('  - Loading battle-data.js...');
try {
    var dataCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'battle-data.js'), 'utf8');
    eval(dataCode);
} catch (e) {
    console.log('    Note: BattleData not loaded');
}

// Load BattleDice (if available)
console.log('  - Loading battle-dice.js...');
try {
    var diceCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'battle-dice.js'), 'utf8');
    eval(diceCode);
} catch (e) {
    console.log('    Note: BattleDice not loaded, using built-in dice');
}

// Load the module under test
console.log('  - Loading battle-finalized.js...');
var finalizedCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'battle-finalized.js'), 'utf8');
eval(finalizedCode);

// Load test code
console.log('  - Loading battle-finalized.test.js...');
var testCode = fs.readFileSync(path.join(__dirname, 'battle-finalized.test.js'), 'utf8');
eval(testCode);

// Run tests
console.log('\n========================================');
console.log('RUNNING FINALIZED BATTLE SYSTEM TESTS');
console.log('========================================');

var success = runFinalizedBattleTests();

// Show results
console.log('\n========================================');
if (success) {
    console.log('SUCCESS: All tests passed!');
} else {
    console.log('FAILURE: Some tests failed');
    process.exit(1);
}
console.log('========================================\n');
