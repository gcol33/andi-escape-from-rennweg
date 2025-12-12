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

// Make window an alias to global so IIFE exports work (window.X = X)
global.window = global;
global.window.location = { search: '' };
global.window.addEventListener = function() {};
global.window.requestAnimationFrame = function(cb) { return setTimeout(cb, 16); };
global.window.cancelAnimationFrame = function(id) { clearTimeout(id); };

global.requestAnimationFrame = global.window.requestAnimationFrame;
global.cancelAnimationFrame = global.window.cancelAnimationFrame;

// Load dependencies
console.log('Loading dependencies...');
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

// Load Logger first (Utils.getLogger depends on it)
console.log('  - Loading logger.js...');
var loggerCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'logger.js'), 'utf8');
eval(loggerCode);

// Load TUNING (QTE and Battle depend on it)
console.log('  - Loading tuning.js...');
var tuningCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'tuning.js'), 'utf8');
eval(tuningCode);

// Load Utils (many modules depend on it for logging)
console.log('  - Loading utils.js...');
var utilsCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'utils.js'), 'utf8');
eval(utilsCode);

// Load QTE UI (QTE Engine depends on it)
console.log('  - Loading qte-ui.js...');
var qteUICode = fs.readFileSync(path.join(__dirname, '..', 'js', 'qte-ui.js'), 'utf8');
eval(stripESModuleSyntax(qteUICode));

// Load QTE Engine
console.log('  - Loading qte.js...');
var qteCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'qte.js'), 'utf8');
eval(stripESModuleSyntax(qteCode));

// Load modular battle system (for integration tests)
console.log('  - Loading modular battle system...');
var battleDataCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'battle-data.js'), 'utf8');
eval(stripESModuleSyntax(battleDataCode));
var battleDiceCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'battle-dice.js'), 'utf8');
eval(stripESModuleSyntax(battleDiceCode));
var battleCoreCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'battle-core.js'), 'utf8');
eval(stripESModuleSyntax(battleCoreCode));
var battleDndCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'battle-dnd.js'), 'utf8');
eval(stripESModuleSyntax(battleDndCode));
var battlePokemonCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'battle-pokemon.js'), 'utf8');
eval(stripESModuleSyntax(battlePokemonCode));
var battleExp33Code = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'battle-exp33.js'), 'utf8');
eval(stripESModuleSyntax(battleExp33Code));
var battleFacadeCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle', 'battle-facade.js'), 'utf8');
eval(stripESModuleSyntax(battleFacadeCode));

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
