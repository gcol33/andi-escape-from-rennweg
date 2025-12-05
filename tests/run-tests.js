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
    },
    addEventListener: function(event, handler) {
        // Mock - do nothing in tests
    },
    removeEventListener: function(event, handler) {
        // Mock - do nothing in tests
    }
};

global.window = {
    location: { search: '' }
};

// Load battle engine (modular system)
console.log('Loading battle engine...');
var fs = require('fs');
var path = require('path');

// Load tuning first (battle modules depend on it)
var tuningCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'tuning.js'), 'utf8');
eval(tuningCode);

// Load modular battle system in dependency order
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
// Note: battle-finalized.js was removed/merged - skipping
var battleFacadeCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'battle-facade.js'), 'utf8');
eval(battleFacadeCode);

// Load test code
var testCode = fs.readFileSync(path.join(__dirname, 'battle.test.js'), 'utf8');
eval(testCode);

// Run tests
console.log('\n========================================');
console.log('RUNNING BATTLE SYSTEM TESTS');
console.log('========================================\n');

runTests();

// Wait for async tests to complete then show report
// Most tests are now synchronous, but battle intro callbacks still need time
setTimeout(function() {
    console.log('\n========================================');
    if (TestRunner.failed === 0) {
        console.log('SUCCESS: All ' + TestRunner.passed + ' tests passed!');
    } else {
        console.log('FAILURE: ' + TestRunner.failed + ' of ' + (TestRunner.passed + TestRunner.failed) + ' tests failed');
        process.exit(1);
    }
    console.log('========================================\n');
}, 5000);
