/**
 * Node.js theme validation tests for Andi VN
 *
 * Usage: node tests/run-theme-tests.js
 *
 * This validates that theme CSS files and shared.css contain
 * the required battle system styles.
 */

var fs = require('fs');
var path = require('path');

// Test framework
var TestRunner = {
    passed: 0,
    failed: 0,
    results: [],

    assert: function(condition, message) {
        if (condition) {
            this.passed++;
            this.results.push({ pass: true, message: message });
        } else {
            this.failed++;
            this.results.push({ pass: false, message: message });
            console.error('FAIL: ' + message);
        }
    },

    reset: function() {
        this.passed = 0;
        this.failed = 0;
        this.results = [];
    },

    report: function() {
        console.log('\n=== Theme CSS Validation Results ===');
        console.log('Passed: ' + this.passed);
        console.log('Failed: ' + this.failed);
        console.log('Total: ' + (this.passed + this.failed));

        if (this.failed > 0) {
            console.log('\nFailed tests:');
            this.results.forEach(function(r) {
                if (!r.pass) console.log('  - ' + r.message);
            });
        }
        return this.failed === 0;
    }
};

// List of all themes
var themes = [
    'prototype', '90s', '70s', '80s', 'cyberpunk', 'dos',
    'dragonball', 'finalfantasy', 'gameboy', 'harrypotter',
    'lotr', 'manga', 'nes', 'snes', 'spaceopera', 'starwars',
    'vaporwave', 'y2k', 'zelda'
];

// Required selectors in shared.css for battle system
var requiredBattleSelectors = [
    // New unified stats panel
    '.battle-stats-panel',
    '.stats-header',
    '.stat-row',
    '.stat-label',
    '.stat-bar-outer',
    '.stat-bar',
    '.stat-value',
    // Battle UI
    '#battle-ui',
    '.battle-log-panel',
    '.battle-log-content',
    '.battle-log',
    '.battle-choices',
    '.status-icons',
    '.status-icon',
    '.stagger-bar',
    '.stagger-fill',
    '.terrain-indicator',
    '.attack-effect',
    '.damage-flash',
    '.battle-damage-number',
    '.skill-submenu',
    '.battle-result'
];

// Read file contents
function readFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (e) {
        return null;
    }
}

// Check if CSS contains selector (simple check)
function containsSelector(css, selector) {
    // Escape special regex chars in selector
    var escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match selector possibly followed by { or ,
    var regex = new RegExp(escaped + '\\s*[{,]', 'g');
    return regex.test(css);
}

// Run tests
console.log('========================================');
console.log('RUNNING THEME CSS VALIDATION TESTS');
console.log('========================================\n');

TestRunner.reset();

// Test 1: All theme files exist
console.log('--- Testing Theme Files Exist ---');
themes.forEach(function(theme) {
    var filePath = path.join(__dirname, '..', 'css', 'themes', theme + '.css');
    var exists = fs.existsSync(filePath);
    TestRunner.assert(exists, 'Theme file exists: ' + theme + '.css');
});

// Test 2: Shared CSS exists
console.log('\n--- Testing Shared CSS ---');
var sharedPath = path.join(__dirname, '..', 'css', 'shared.css');
var sharedExists = fs.existsSync(sharedPath);
TestRunner.assert(sharedExists, 'Shared CSS file exists');

// Test 3: Shared CSS contains all required battle selectors
if (sharedExists) {
    var sharedCSS = readFile(sharedPath);
    console.log('\n--- Testing Battle Selectors in shared.css ---');
    requiredBattleSelectors.forEach(function(selector) {
        var found = containsSelector(sharedCSS, selector);
        TestRunner.assert(found, 'shared.css contains selector: ' + selector);
    });
}

// Test 4: Fonts CSS exists
console.log('\n--- Testing Fonts CSS ---');
var fontsPath = path.join(__dirname, '..', 'css', 'fonts.css');
var fontsExists = fs.existsSync(fontsPath);
TestRunner.assert(fontsExists, 'Fonts CSS file exists');

// Test 5: Theme files have required base structure
console.log('\n--- Testing Theme CSS Structure ---');

// Required base selectors that ALL themes should have
var requiredThemeSelectors = [
    'body',
    '#vn-container',
    '#text-box',
    '.choice-button'
];

themes.forEach(function(theme) {
    var filePath = path.join(__dirname, '..', 'css', 'themes', theme + '.css');
    var css = readFile(filePath);
    if (css) {
        requiredThemeSelectors.forEach(function(selector) {
            var found = containsSelector(css, selector);
            TestRunner.assert(found, theme + '.css contains selector: ' + selector);
        });
    }
});

// Test 6: Check prototype and 90s themes have battle overrides
console.log('\n--- Testing Battle Theme Overrides ---');
var prototypeCSS = readFile(path.join(__dirname, '..', 'css', 'themes', 'prototype.css'));
var ninetiesCSS = readFile(path.join(__dirname, '..', 'css', 'themes', '90s.css'));

if (prototypeCSS) {
    TestRunner.assert(
        containsSelector(prototypeCSS, '.battle-stats-panel') || containsSelector(prototypeCSS, '.hp-container'),
        'prototype.css has battle stats panel styling'
    );
    TestRunner.assert(
        containsSelector(prototypeCSS, '.battle-log-panel') || containsSelector(prototypeCSS, '.battle-log'),
        'prototype.css has battle log styling'
    );
}

if (ninetiesCSS) {
    TestRunner.assert(
        containsSelector(ninetiesCSS, '.battle-stats-panel') || containsSelector(ninetiesCSS, '.hp-container'),
        '90s.css has battle stats panel styling'
    );
    TestRunner.assert(
        containsSelector(ninetiesCSS, '.battle-log-panel') || containsSelector(ninetiesCSS, '.battle-log'),
        '90s.css has battle log styling'
    );
}

// Test 7: Test HTML files exist
console.log('\n--- Testing Test HTML Files ---');
var battleTestHTML = path.join(__dirname, 'battle.test.html');
var themeTestHTML = path.join(__dirname, 'theme-battle.test.html');

TestRunner.assert(fs.existsSync(battleTestHTML), 'battle.test.html exists');
TestRunner.assert(fs.existsSync(themeTestHTML), 'theme-battle.test.html exists');

// Final report
console.log('');
var success = TestRunner.report();

console.log('\n========================================');
if (success) {
    console.log('SUCCESS: All CSS validation tests passed!');
} else {
    console.log('FAILURE: Some tests failed');
    process.exit(1);
}
console.log('========================================\n');
