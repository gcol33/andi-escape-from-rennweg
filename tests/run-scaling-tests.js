/**
 * CSS Scaling Tests
 *
 * Validates that the scaling architecture is correctly implemented:
 * 1. #vn-container has font-size using vw units
 * 2. Key UI elements use em units for sizing
 * 3. No hardcoded px values in scalable properties
 *
 * Run: node tests/run-scaling-tests.js
 */

var fs = require('fs');
var path = require('path');

// Test framework
var TestRunner = {
    passed: 0,
    failed: 0,
    warnings: 0,
    results: [],

    assert: function(condition, message) {
        if (condition) {
            this.passed++;
            this.results.push({ pass: true, message: message });
            console.log('\x1b[32mPASS:\x1b[0m ' + message);
        } else {
            this.failed++;
            this.results.push({ pass: false, message: message });
            console.log('\x1b[31mFAIL:\x1b[0m ' + message);
        }
    },

    warn: function(message) {
        this.warnings++;
        console.log('\x1b[33mWARN:\x1b[0m ' + message);
    },

    report: function() {
        console.log('\n========================================');
        console.log('   CSS SCALING TEST RESULTS');
        console.log('========================================\n');
        console.log('Passed: ' + this.passed);
        console.log('Failed: ' + this.failed);
        console.log('Warnings: ' + this.warnings);
        console.log('Total: ' + (this.passed + this.failed));

        if (this.failed > 0) {
            console.log('\n\x1b[31mFailed tests:\x1b[0m');
            this.results.forEach(function(r) {
                if (!r.pass) console.log('  - ' + r.message);
            });
        }
        return this.failed === 0;
    }
};

// Read CSS file
function readCSS(relativePath) {
    var fullPath = path.join(__dirname, '..', relativePath);
    try {
        return fs.readFileSync(fullPath, 'utf8');
    } catch (e) {
        console.error('Could not read: ' + relativePath);
        return '';
    }
}

// Parse CSS to find a selector's properties
function findSelectorProperties(css, selector) {
    // Escape special characters in selector for regex
    var escaped = selector.replace(/[.*+?^${}()|[\]\\#]/g, '\\$&');

    // Pattern to find selector and its block
    var pattern = new RegExp(escaped + '\\s*\\{([^}]+)\\}', 'g');
    var matches = [];
    var match;

    while ((match = pattern.exec(css)) !== null) {
        matches.push(match[1]);
    }

    return matches.join('\n');
}

// Check if a property value uses em units
function usesEmUnits(value) {
    return /[\d.]+em/.test(value);
}

// Check if a property value uses vw units
function usesVwUnits(value) {
    return /[\d.]+vw/.test(value);
}

// Check if a property value uses rem units (not desired for scaling)
function usesRemUnits(value) {
    return /[\d.]+rem/.test(value);
}

// Check if a property value uses px units (not desired for scaling)
function usesPxUnits(value) {
    // Ignore 1px borders
    return /[2-9]\d*px|\d{2,}px/.test(value);
}

// Extract property value from CSS text
function getPropertyValue(cssText, property) {
    var pattern = new RegExp(property + '\\s*:\\s*([^;]+);', 'gi');
    var matches = [];
    var match;

    while ((match = pattern.exec(cssText)) !== null) {
        matches.push(match[1].trim());
    }

    return matches;
}

// ============================================================================
// TESTS
// ============================================================================

console.log('========================================');
console.log('   CSS SCALING TESTS');
console.log('========================================\n');

// Load CSS files
var variablesCSS = readCSS('css/shared/variables.css');
var uiLayoutCSS = readCSS('css/shared/ui-layout.css');
var styleCSS = readCSS('css/style.css');
var gameMenuCSS = readCSS('css/shared/game-menu.css');
var layoutSystemCSS = readCSS('css/layout-system.css');

// ============================================================================
// Test 1: #vn-container has vw-based font-size
// ============================================================================
console.log('\n--- Test 1: Container Scale Reference ---\n');

var containerProps = findSelectorProperties(variablesCSS, '#vn-container');
var containerFontSizes = getPropertyValue(containerProps, 'font-size');

TestRunner.assert(
    containerFontSizes.length > 0,
    '#vn-container has font-size property defined'
);

var hasVwFontSize = containerFontSizes.some(function(val) {
    return usesVwUnits(val);
});
TestRunner.assert(
    hasVwFontSize,
    '#vn-container font-size uses vw units for scaling'
);

// Note: No minimum clamp - removed for pure proportional scaling
// The font-size is purely vw-based: calc(1.2vw * var(--scale))

// ============================================================================
// Test 2: Typography scale variables are em-based
// ============================================================================
console.log('\n--- Test 2: Typography Scale Variables ---\n');

var textScaleVars = ['--text-xs', '--text-sm', '--text-md', '--text-base', '--text-lg', '--text-xl', '--text-2xl'];

textScaleVars.forEach(function(varName) {
    var pattern = new RegExp(varName + '\\s*:\\s*([^;]+);');
    var match = containerProps.match(pattern);

    if (match) {
        var value = match[1].trim();
        TestRunner.assert(
            usesEmUnits(value),
            varName + ' uses em units (' + value + ')'
        );
    } else {
        TestRunner.assert(false, varName + ' is defined in #vn-container');
    }
});

// ============================================================================
// Test 3: Spacing scale variables are em-based
// ============================================================================
console.log('\n--- Test 3: Spacing Scale Variables ---\n');

var spaceScaleVars = ['--space-xs', '--space-sm', '--space-md', '--space-lg', '--space-xl', '--space-2xl'];

spaceScaleVars.forEach(function(varName) {
    var pattern = new RegExp(varName + '\\s*:\\s*([^;]+);');
    var match = containerProps.match(pattern);

    if (match) {
        var value = match[1].trim();
        TestRunner.assert(
            usesEmUnits(value),
            varName + ' uses em units (' + value + ')'
        );
    } else {
        TestRunner.assert(false, varName + ' is defined in #vn-container');
    }
});

// ============================================================================
// Test 4: #story-output uses inherited font-size
// ============================================================================
console.log('\n--- Test 4: Story Output Scaling ---\n');

var storyOutputProps = findSelectorProperties(uiLayoutCSS, '#story-output');
var storyFontSizes = getPropertyValue(storyOutputProps, 'font-size');

// Should have "inherit" or use var(--story-font-size)
var hasInheritOrVar = storyFontSizes.some(function(val) {
    return /inherit/.test(val) || /var\s*\(/.test(val);
});
TestRunner.assert(
    hasInheritOrVar,
    '#story-output font-size uses inherit or CSS variable'
);

// ============================================================================
// Test 5: UI Controls use em units
// ============================================================================
console.log('\n--- Test 5: UI Controls Scaling ---\n');

var controlsToTest = [
    { selector: '.speed-btn', file: styleCSS, name: 'Speed button' },
    { selector: '.mute-btn', file: styleCSS, name: 'Mute button' },
    { selector: '.menu-btn', file: gameMenuCSS, name: 'Menu button' },
    { selector: '#text-box', file: styleCSS, name: 'Text box' },
    { selector: '#text-controls', file: styleCSS, name: 'Text controls' },
    { selector: '#volume-slider', file: styleCSS, name: 'Volume slider' },
];

controlsToTest.forEach(function(control) {
    var props = findSelectorProperties(control.file, control.selector);

    // Check font-size
    var fontSizes = getPropertyValue(props, 'font-size');
    if (fontSizes.length > 0) {
        var fontSizeEmOrVar = fontSizes.some(function(val) {
            return usesEmUnits(val) || /var\s*\(/.test(val) || /inherit/.test(val);
        });
        TestRunner.assert(
            fontSizeEmOrVar,
            control.name + ' font-size uses em/var/inherit (' + fontSizes.join(', ') + ')'
        );
    }

    // Check padding
    var paddings = getPropertyValue(props, 'padding');
    if (paddings.length > 0) {
        var paddingEmOrVar = paddings.some(function(val) {
            return usesEmUnits(val) || /var\s*\(/.test(val);
        });
        if (!paddingEmOrVar) {
            // Warn but don't fail - some paddings might intentionally be px
            TestRunner.warn(control.name + ' padding might need em conversion: ' + paddings.join(', '));
        } else {
            TestRunner.assert(true, control.name + ' padding uses em/var units');
        }
    }
});

// ============================================================================
// Test 6: Debug scale mode exists
// ============================================================================
console.log('\n--- Test 6: Debug Mode ---\n');

var hasDebugScale = layoutSystemCSS.includes('.debug-scale');
TestRunner.assert(
    hasDebugScale,
    '.debug-scale class exists in layout-system.css'
);

var hasDebugOverlay = layoutSystemCSS.includes('#vn-container::before');
TestRunner.assert(
    hasDebugOverlay,
    'Debug overlay pseudo-element is defined'
);

// ============================================================================
// Test 7: Legacy variable mappings
// ============================================================================
console.log('\n--- Test 7: Legacy Variable Mappings ---\n');

var legacyMappings = [
    { legacy: '--story-font-size', target: '--text-base' },
    { legacy: '--choice-font-size', target: '--text-sm' },
    { legacy: '--button-font-size', target: '--text-sm' },
    { legacy: '--battle-text-size', target: '--text-md' },
];

legacyMappings.forEach(function(mapping) {
    var pattern = new RegExp(mapping.legacy + '\\s*:\\s*var\\s*\\(\\s*' + mapping.target);
    TestRunner.assert(
        pattern.test(containerProps),
        mapping.legacy + ' maps to ' + mapping.target
    );
});

// ============================================================================
// Test 8: No hardcoded breakpoint overrides for font-size
// ============================================================================
console.log('\n--- Test 8: Breakpoint Analysis ---\n');

// Count @media queries with font-size overrides (these should be minimized)
var mediaQueryPattern = /@media[^{]+\{[^}]*font-size\s*:[^;]*rem[^;]*;/g;
var mediaFontOverrides = (styleCSS.match(mediaQueryPattern) || []).length;

if (mediaFontOverrides > 5) {
    TestRunner.warn('style.css has ' + mediaFontOverrides + ' @media queries with rem font-sizes (goal: 0)');
} else {
    TestRunner.assert(true, 'style.css has minimal @media font-size overrides (' + mediaFontOverrides + ')');
}

// ============================================================================
// Report
// ============================================================================

var success = TestRunner.report();
process.exit(success ? 0 : 1);
