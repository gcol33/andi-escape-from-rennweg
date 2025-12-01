/**
 * Node.js test runner for Andi VN QTE System Tests
 *
 * Usage: node tests/run-qte-tests.js
 *
 * This creates a minimal DOM environment to run the QTE tests
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
            removeChild: function() {},
            parentNode: null,
            classList: {
                add: function() {},
                remove: function() {}
            },
            querySelectorAll: function() { return []; },
            setAttribute: function() {}
        };
    },
    body: {
        appendChild: function() {}
    }
};

global.window = {
    location: { search: '' },
    addEventListener: function() {},
    requestAnimationFrame: function(cb) { return setTimeout(cb, 16); },
    cancelAnimationFrame: function(id) { clearTimeout(id); }
};

global.requestAnimationFrame = global.window.requestAnimationFrame;
global.cancelAnimationFrame = global.window.cancelAnimationFrame;

// Load dependencies
console.log('Loading dependencies...');
var fs = require('fs');
var path = require('path');

// Load TUNING first (QTE and Battle depend on it)
console.log('  - Loading tuning.js...');
var tuningCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'tuning.js'), 'utf8');
eval(tuningCode);

// Load QTE UI (QTE Engine depends on it)
console.log('  - Loading qte-ui.js...');
var qteUICode = fs.readFileSync(path.join(__dirname, '..', 'js', 'qte-ui.js'), 'utf8');
eval(qteUICode);

// Load QTE Engine
console.log('  - Loading qte.js...');
var qteCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'qte.js'), 'utf8');
eval(qteCode);

// Load modular battle system (for integration tests)
console.log('  - Loading modular battle system...');
var battleDataCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'battle-data.js'), 'utf8');
eval(battleDataCode);
var battleDiceCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'battle-dice.js'), 'utf8');
eval(battleDiceCode);
var battleCoreCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'battle-core.js'), 'utf8');
eval(battleCoreCode);
var battleDndCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'battle-dnd.js'), 'utf8');
eval(battleDndCode);
var battlePokemonCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'battle-pokemon.js'), 'utf8');
eval(battlePokemonCode);
var battleExp33Code = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'battle-exp33.js'), 'utf8');
eval(battleExp33Code);
var battleFinalizedCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'battle-finalized.js'), 'utf8');
eval(battleFinalizedCode);
var battleFacadeCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'battle-facade.js'), 'utf8');
eval(battleFacadeCode);

// Load test code
console.log('  - Loading qte.test.js...');
var testCode = fs.readFileSync(path.join(__dirname, 'qte.test.js'), 'utf8');
eval(testCode);

// Run tests
console.log('\n========================================');
console.log('RUNNING QTE SYSTEM TESTS');
console.log('========================================\n');

runQTETests();

// Show results (QTE tests are synchronous)
console.log('\n========================================');
if (TestRunner.failed === 0) {
    console.log('SUCCESS: All ' + TestRunner.passed + ' tests passed!');
} else {
    console.log('FAILURE: ' + TestRunner.failed + ' of ' + (TestRunner.passed + TestRunner.failed) + ' tests failed');
    process.exit(1);
}
console.log('========================================\n');
