/**
 * Node.js test runner for Andi VN Engine Tests
 *
 * Usage: node tests/run-engine-tests.js
 *
 * This creates a minimal DOM environment to run the engine tests
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
                remove: function() {},
                contains: function() { return false; }
            },
            querySelectorAll: function() { return []; },
            querySelector: function() { return null; }
        };
    },
    addEventListener: function(event, handler) {
        // Mock - do nothing in tests
    },
    removeEventListener: function(event, handler) {
        // Mock - do nothing in tests
    },
    body: {
        appendChild: function() {},
        removeChild: function() {}
    }
};

// Make window an alias to global so IIFE exports work (window.X = X)
global.window = global;
global.window.location = { search: '' };

// Mock localStorage
var mockStorage = {};
global.localStorage = {
    getItem: function(key) {
        return mockStorage[key] || null;
    },
    setItem: function(key, value) {
        mockStorage[key] = value;
    },
    removeItem: function(key) {
        delete mockStorage[key];
    },
    clear: function() {
        mockStorage = {};
    }
};

// Mock Audio for sound effects
global.Audio = function(src) {
    return {
        src: src,
        play: function() { return Promise.resolve(); },
        pause: function() {},
        load: function() {},
        addEventListener: function() {},
        removeEventListener: function() {},
        volume: 1,
        currentTime: 0,
        loop: false
    };
};

// Mock Image for background loading
global.Image = function() {
    var img = {
        src: '',
        onload: null,
        onerror: null
    };
    // Trigger onload after setting src
    setTimeout(function() {
        if (img.onload) img.onload();
    }, 0);
    return img;
};

// Mock matchMedia
global.matchMedia = function() {
    return {
        matches: false,
        addListener: function() {},
        removeListener: function() {}
    };
};

// Mock navigator
global.navigator = {
    maxTouchPoints: 0,
    msMaxTouchPoints: 0
};

// Load modules in dependency order
console.log('Loading engine modules...');
var fs = require('fs');
var path = require('path');

/**
 * Strip ES module syntax for eval() compatibility
 * @param {string} code - Source code
 * @returns {string} Code with ES module syntax removed
 */
function stripESModuleSyntax(code) {
    return code
        .replace(/^export function /gm, 'function ')
        .replace(/^export const /gm, 'var ')
        .replace(/^export let /gm, 'var ')
        .replace(/^export var /gm, 'var ')
        .replace(/^const /gm, 'var ')
        .replace(/^let /gm, 'var ')
        .replace(/^export default .*?;?\s*$/gm, '')
        .replace(/^export \{[^}]*\};?\s*$/gm, '')
        .replace(/^import .*? from .*?;?\s*$/gm, '');
}

// Load logger first (Utils.getLogger depends on it)
var loggerCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'logger.js'), 'utf8');
eval(loggerCode);

// Load utils (provides shared utilities like getLogger)
var utilsCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'utils.js'), 'utf8');
eval(utilsCode);

// Load tuning (engine depends on it)
var tuningCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'tuning.js'), 'utf8');
eval(tuningCode);

// Load listener-manager (engine uses it)
var listenerManagerCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'listener-manager.js'), 'utf8');
eval(listenerManagerCode);

// Load timer-manager (engine uses it)
var timerManagerCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'timer-manager.js'), 'utf8');
eval(timerManagerCode);

// Load core modules (new architecture)
var errorsCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'core', 'errors.js'), 'utf8');
eval(errorsCode);

var eventBusCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'core', 'event-bus.js'), 'utf8');
eval(eventBusCode);

// Load events (must be before store, which uses StateEvents)
var eventsCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'core', 'events.js'), 'utf8');
eval(eventsCode);

var storeCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'core', 'store.js'), 'utf8');
eval(storeCode);

// Load managers (engine now delegates to these)
var baseManagerCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'managers', 'base-manager.js'), 'utf8');
eval(baseManagerCode);

var flagManagerCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'managers', 'flag-manager.js'), 'utf8');
eval(flagManagerCode);

var inventoryManagerCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'managers', 'inventory-manager.js'), 'utf8');
eval(inventoryManagerCode);

// Mock story data (engine needs this)
global.story = {
    start: {
        id: 'start',
        textBlocks: ['Welcome to the test.'],
        choices: [{ label: 'Continue', target: 'scene2' }]
    },
    scene2: {
        id: 'scene2',
        textBlocks: ['This is scene 2.'],
        choices: []
    },
    test_scene: {
        id: 'test_scene',
        textBlocks: ['Test scene content.'],
        choices: []
    }
};

// Load engine
var engineCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'engine.js'), 'utf8');
eval(engineCode);

// Load test code
var testCode = fs.readFileSync(path.join(__dirname, 'engine.test.js'), 'utf8');
eval(testCode);

// Run tests
console.log('\n========================================');
console.log('RUNNING ENGINE SYSTEM TESTS');
console.log('========================================');

var success = runEngineTests();

console.log('\n========================================');
if (success) {
    console.log('SUCCESS: All ' + TestRunner.passed + ' tests passed!');
} else {
    console.log('FAILURE: ' + TestRunner.failed + ' of ' + (TestRunner.passed + TestRunner.failed) + ' tests failed');
    process.exit(1);
}
console.log('========================================\n');
