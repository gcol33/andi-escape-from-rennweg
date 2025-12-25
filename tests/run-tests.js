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

// Make window an alias to global so IIFE exports work (window.X = X)
global.window = global;
global.window.location = { search: '' };

// Load battle engine (modular system)
console.log('Loading battle engine...');
var fs = require('fs');
var path = require('path');

/**
 * Strip ES module syntax for eval() compatibility
 * Converts ES modules to work in Node.js CommonJS context
 * @param {string} code - Source code
 * @returns {string} Code with ES module syntax removed
 */
function stripESModuleSyntax(code) {
    return code
        // Remove "export function" -> "function"
        .replace(/^export function /gm, 'function ')
        // Remove "export const" -> "var" (var is hoisted to global in eval)
        .replace(/^export const /gm, 'var ')
        // Remove "export let" -> "var"
        .replace(/^export let /gm, 'var ')
        // Remove "export var" -> "var"
        .replace(/^export var /gm, 'var ')
        // Convert const to var (var is hoisted in eval context)
        .replace(/^const /gm, 'var ')
        // Convert let to var
        .replace(/^let /gm, 'var ')
        // Remove "export default X;" lines
        .replace(/^export default .*?;?\s*$/gm, '')
        // Remove "export { ... };" lines
        .replace(/^export \{[^}]*\};?\s*$/gm, '')
        // Remove "import ... from ..." lines
        .replace(/^import .*? from .*?;?\s*$/gm, '');
}

// Load logger first (Utils.getLogger depends on it)
var loggerCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'logger.js'), 'utf8');
eval(loggerCode);

// Load utils (provides shared utilities like getLogger)
var utilsCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'utils.js'), 'utf8');
eval(utilsCode);

// Load tuning (battle modules depend on it)
var tuningCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'tuning.js'), 'utf8');
eval(tuningCode);

// Load modular battle system in dependency order (from js/modules/battle/)
var battleDataCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'modules', 'battle', 'battle-data.js'), 'utf8');
eval(stripESModuleSyntax(battleDataCode));
var battleDiceCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'modules', 'battle', 'battle-dice.js'), 'utf8');
eval(stripESModuleSyntax(battleDiceCode));
var battleSummonCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'modules', 'battle', 'battle-summon.js'), 'utf8');
eval(stripESModuleSyntax(battleSummonCode));
var summonsCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'summons.js'), 'utf8');
eval(stripESModuleSyntax(summonsCode));
var battleCoreCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'modules', 'battle', 'battle-core.js'), 'utf8');
eval(stripESModuleSyntax(battleCoreCode));
var battleDndCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'modules', 'battle', 'battle-dnd.js'), 'utf8');
eval(stripESModuleSyntax(battleDndCode));
var battlePokemonCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'modules', 'battle', 'battle-pokemon.js'), 'utf8');
eval(stripESModuleSyntax(battlePokemonCode));
var battleExp33Code = fs.readFileSync(path.join(__dirname, '..', 'js', 'modules', 'battle', 'battle-exp33.js'), 'utf8');
eval(stripESModuleSyntax(battleExp33Code));
// Note: battle-finalized.js was removed/merged - skipping
var battleFacadeCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'modules', 'battle', 'battle-facade.js'), 'utf8');
eval(stripESModuleSyntax(battleFacadeCode));

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
