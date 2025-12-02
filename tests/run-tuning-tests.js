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

// Load BattleUI helper modules (optional, may not work without full DOM)
try {
    var elementUtilsCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'element-utils.js'), 'utf8');
    eval(elementUtilsCode);
    var statBarCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'stat-bar.js'), 'utf8');
    eval(statBarCode);
    var floatingNumberCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'floating-number.js'), 'utf8');
    eval(floatingNumberCode);
    console.log('Loaded battle UI helper modules');
} catch (e) {
    console.log('Battle UI helper modules not loaded (expected in Node.js environment)');
}

// Load BattleUI (optional, may not work without full DOM)
try {
    var battleUICode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'battle-ui.js'), 'utf8');
    eval(battleUICode);
    console.log('Loaded battle-ui module');
} catch (e) {
    console.log('BattleUI module not loaded (expected in Node.js environment)');
}

// Load modular battle system for integration tests
try {
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
    console.log('Loaded modular battle system');
} catch (e) {
    console.log('Battle system not loaded: ' + e.message);
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
