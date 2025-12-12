/**
 * Andi VN - Utils Module Tests
 *
 * Run tests: node tests/run-utils-tests.js
 *
 * Tests for shared utility functions including:
 * - DOM utilities (removeElement, setDisplay, addClass, etc.)
 * - Random utilities (pickRandom, randomInt, chance, shuffle)
 * - Validation utilities (isValidIndex, safeGet, hasProps)
 * - Timing utilities (guardedTimeout, debounce)
 */

// Simple test framework (consistent with other test files)
var TestRunner = {
    passed: 0,
    failed: 0,
    results: [],
    currentGroup: '',

    group: function(name) {
        this.currentGroup = name;
        console.log('\n--- ' + name + ' ---');
    },

    assert: function(condition, message) {
        var fullMessage = this.currentGroup ? this.currentGroup + ': ' + message : message;
        if (condition) {
            this.passed++;
            this.results.push({ pass: true, message: fullMessage });
            console.log('  ✓ ' + message);
        } else {
            this.failed++;
            this.results.push({ pass: false, message: fullMessage });
            console.error('  ✗ FAIL: ' + message);
        }
    },

    assertEqual: function(actual, expected, message) {
        var condition = actual === expected;
        if (!condition) {
            message += ' (expected ' + expected + ', got ' + actual + ')';
        }
        this.assert(condition, message);
    },

    assertDeepEqual: function(actual, expected, message) {
        var condition = JSON.stringify(actual) === JSON.stringify(expected);
        if (!condition) {
            message += ' (expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual) + ')';
        }
        this.assert(condition, message);
    },

    assertInRange: function(value, min, max, message) {
        var condition = value >= min && value <= max;
        if (!condition) {
            message += ' (expected ' + min + '-' + max + ', got ' + value + ')';
        }
        this.assert(condition, message);
    },

    reset: function() {
        this.passed = 0;
        this.failed = 0;
        this.results = [];
        this.currentGroup = '';
    },

    report: function() {
        console.log('\n=== Utils Module Test Results ===');
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

// Test functions
function runUtilsTests() {
    TestRunner.reset();

    testPickRandom();
    testRandomInt();
    testChance();
    testShuffle();
    testIsValidIndex();
    testSafeGet();
    testHasProps();
    testGuardedTimeout();
    testDebounce();
    testRemoveElement();
    testSetDisplay();
    testAddRemoveClass();
    testToggleClass();
    testDisableEnableButton();

    return TestRunner.report();
}

// === Random Utilities Tests ===

function testPickRandom() {
    TestRunner.group('pickRandom');

    // Test empty array
    TestRunner.assertEqual(Utils.pickRandom([]), undefined, 'Empty array returns undefined');
    TestRunner.assertEqual(Utils.pickRandom(null), undefined, 'Null returns undefined');
    TestRunner.assertEqual(Utils.pickRandom(undefined), undefined, 'Undefined returns undefined');

    // Test single element
    TestRunner.assertEqual(Utils.pickRandom([42]), 42, 'Single element array returns that element');

    // Test multiple elements (statistical test)
    var arr = ['a', 'b', 'c'];
    var picks = {};
    for (var i = 0; i < 100; i++) {
        var pick = Utils.pickRandom(arr);
        picks[pick] = (picks[pick] || 0) + 1;
    }
    TestRunner.assert(picks['a'] > 0 && picks['b'] > 0 && picks['c'] > 0,
        'All elements should be picked at least once over 100 iterations');

    // Test that picked element is from array
    var picked = Utils.pickRandom(arr);
    TestRunner.assert(arr.indexOf(picked) !== -1, 'Picked element should be from array');
}

function testRandomInt() {
    TestRunner.group('randomInt');

    // Test specific range
    for (var i = 0; i < 50; i++) {
        var result = Utils.randomInt(5, 10);
        TestRunner.assertInRange(result, 5, 10, 'randomInt(5, 10) should be in range');
        if (result < 5 || result > 10) break; // Stop on first failure
    }

    // Test same min/max
    TestRunner.assertEqual(Utils.randomInt(7, 7), 7, 'randomInt(7, 7) should return 7');

    // Test zero range
    TestRunner.assertEqual(Utils.randomInt(0, 0), 0, 'randomInt(0, 0) should return 0');

    // Test negative range
    var negResult = Utils.randomInt(-5, -2);
    TestRunner.assertInRange(negResult, -5, -2, 'randomInt with negative range');

    // Test integer output
    var result = Utils.randomInt(1, 100);
    TestRunner.assertEqual(Math.floor(result), result, 'Result should be an integer');
}

function testChance() {
    TestRunner.group('chance');

    // Test 100% chance
    var allTrue = true;
    for (var i = 0; i < 20; i++) {
        if (!Utils.chance(1)) allTrue = false;
    }
    TestRunner.assert(allTrue, 'chance(1) should always return true');

    // Test 0% chance
    var allFalse = true;
    for (var i = 0; i < 20; i++) {
        if (Utils.chance(0)) allFalse = false;
    }
    TestRunner.assert(allFalse, 'chance(0) should always return false');

    // Test 50% chance (statistical)
    var trueCount = 0;
    for (var i = 0; i < 200; i++) {
        if (Utils.chance(0.5)) trueCount++;
    }
    // Should be roughly 100, allow 60-140 range for randomness
    TestRunner.assertInRange(trueCount, 60, 140, 'chance(0.5) should return ~50% true');
}

function testShuffle() {
    TestRunner.group('shuffle');

    // Test null/undefined
    TestRunner.assertEqual(Utils.shuffle(null), null, 'shuffle(null) returns null');
    TestRunner.assertEqual(Utils.shuffle(undefined), undefined, 'shuffle(undefined) returns undefined');

    // Test empty array
    TestRunner.assertDeepEqual(Utils.shuffle([]), [], 'shuffle([]) returns empty array');

    // Test single element
    TestRunner.assertDeepEqual(Utils.shuffle([1]), [1], 'Single element array unchanged');

    // Test that shuffle returns same array reference
    var original = [1, 2, 3, 4, 5];
    var result = Utils.shuffle(original);
    TestRunner.assert(result === original, 'shuffle should return same array reference');

    // Test that all elements are preserved
    var arr = [1, 2, 3, 4, 5];
    Utils.shuffle(arr);
    var sorted = arr.slice().sort();
    TestRunner.assertDeepEqual(sorted, [1, 2, 3, 4, 5], 'All elements should be preserved after shuffle');

    // Test that shuffle actually changes order (statistical)
    var sameOrder = 0;
    for (var i = 0; i < 20; i++) {
        var test = [1, 2, 3, 4, 5];
        Utils.shuffle(test);
        if (test.join(',') === '1,2,3,4,5') sameOrder++;
    }
    TestRunner.assert(sameOrder < 20, 'Shuffle should change order at least sometimes');
}

// === Validation Utilities Tests ===

function testIsValidIndex() {
    TestRunner.group('isValidIndex');

    var arr = ['a', 'b', 'c'];

    // Valid indices
    TestRunner.assertEqual(Utils.isValidIndex(arr, 0), true, 'Index 0 is valid');
    TestRunner.assertEqual(Utils.isValidIndex(arr, 1), true, 'Index 1 is valid');
    TestRunner.assertEqual(Utils.isValidIndex(arr, 2), true, 'Index 2 is valid');

    // Invalid indices
    TestRunner.assertEqual(Utils.isValidIndex(arr, -1), false, 'Index -1 is invalid');
    TestRunner.assertEqual(Utils.isValidIndex(arr, 3), false, 'Index 3 is out of bounds');
    TestRunner.assertEqual(Utils.isValidIndex(arr, 100), false, 'Index 100 is out of bounds');

    // Edge cases
    TestRunner.assert(!Utils.isValidIndex(null, 0), 'Null array returns falsy');
    TestRunner.assertEqual(Utils.isValidIndex([], 0), false, 'Empty array, index 0 is invalid');
    TestRunner.assertEqual(Utils.isValidIndex(arr, 'string'), false, 'String index is invalid');
}

function testSafeGet() {
    TestRunner.group('safeGet');

    var arr = ['first', 'second', 'third'];

    // Valid gets
    TestRunner.assertEqual(Utils.safeGet(arr, 0), 'first', 'Get index 0');
    TestRunner.assertEqual(Utils.safeGet(arr, 1), 'second', 'Get index 1');
    TestRunner.assertEqual(Utils.safeGet(arr, 2), 'third', 'Get index 2');

    // Out of bounds with default
    TestRunner.assertEqual(Utils.safeGet(arr, 5, 'default'), 'default', 'Out of bounds returns default');
    TestRunner.assertEqual(Utils.safeGet(arr, -1, 'default'), 'default', 'Negative index returns default');

    // Out of bounds without default
    TestRunner.assertEqual(Utils.safeGet(arr, 5), undefined, 'Out of bounds without default returns undefined');

    // Null array
    TestRunner.assertEqual(Utils.safeGet(null, 0, 'fallback'), 'fallback', 'Null array returns default');
}

function testHasProps() {
    TestRunner.group('hasProps');

    var obj = { name: 'test', value: 42, active: true };

    // Has all props
    TestRunner.assertEqual(Utils.hasProps(obj, ['name']), true, 'Has single prop');
    TestRunner.assertEqual(Utils.hasProps(obj, ['name', 'value']), true, 'Has multiple props');
    TestRunner.assertEqual(Utils.hasProps(obj, ['name', 'value', 'active']), true, 'Has all props');

    // Missing props
    TestRunner.assertEqual(Utils.hasProps(obj, ['missing']), false, 'Missing prop returns false');
    TestRunner.assertEqual(Utils.hasProps(obj, ['name', 'missing']), false, 'One missing prop returns false');

    // Edge cases
    TestRunner.assertEqual(Utils.hasProps(obj, []), true, 'Empty props array returns true');
    TestRunner.assertEqual(Utils.hasProps(null, ['name']), false, 'Null object returns false');
    TestRunner.assertEqual(Utils.hasProps('string', ['length']), false, 'Non-object returns false');
    TestRunner.assertEqual(Utils.hasProps({}, ['any']), false, 'Empty object missing props returns false');

    // Undefined vs missing
    var objWithUndefined = { defined: undefined };
    TestRunner.assertEqual(Utils.hasProps(objWithUndefined, ['defined']), false, 'Undefined value treated as missing');
}

// === Timing Utilities Tests ===

function testGuardedTimeout() {
    TestRunner.group('guardedTimeout');

    // Test basic functionality (synchronous guard check)
    var executed = false;
    var guardPasses = true;

    // We can't easily test async behavior in this runner, so test the guard logic
    var guard = function() { return guardPasses; };

    // Test that it returns a timeout ID
    var id = Utils.guardedTimeout(function() { executed = true; }, 10, guard);
    TestRunner.assert(id !== undefined && id !== null, 'guardedTimeout returns a timeout ID');

    // Clear to prevent side effects
    clearTimeout(id);

    TestRunner.assert(true, 'guardedTimeout accepts callback, delay, and guard function');
}

function testDebounce() {
    TestRunner.group('debounce');

    // Test that debounce returns a function
    var fn = function() {};
    var debounced = Utils.debounce(fn, 100);
    TestRunner.assertEqual(typeof debounced, 'function', 'debounce returns a function');

    // Test that it can be called without error
    var callCount = 0;
    var debouncedFn = Utils.debounce(function() { callCount++; }, 10);

    // Call multiple times rapidly
    debouncedFn();
    debouncedFn();
    debouncedFn();

    // Immediately after, callCount should still be 0 (waiting for debounce)
    TestRunner.assertEqual(callCount, 0, 'Debounced function does not execute immediately');
}

// === DOM Utilities Tests ===

function testRemoveElement() {
    TestRunner.group('removeElement');

    // Test with mock element
    var parent = { removeChild: function(el) { this.removed = el; } };
    var child = { parentNode: parent };

    var result = Utils.removeElement(child);
    TestRunner.assertEqual(result, true, 'Returns true when element removed');
    TestRunner.assertEqual(parent.removed, child, 'Element was removed from parent');

    // Test with no parent
    result = Utils.removeElement({ parentNode: null });
    TestRunner.assertEqual(result, false, 'Returns false when no parent');

    // Test with null
    result = Utils.removeElement(null);
    TestRunner.assertEqual(result, false, 'Returns false for null element');
}

function testSetDisplay() {
    TestRunner.group('setDisplay');

    // Test with mock element
    var el = { style: {} };

    Utils.setDisplay(el, 'none');
    TestRunner.assertEqual(el.style.display, 'none', 'Sets display to none');

    Utils.setDisplay(el, 'block');
    TestRunner.assertEqual(el.style.display, 'block', 'Sets display to block');

    Utils.setDisplay(el, '');
    TestRunner.assertEqual(el.style.display, '', 'Sets display to empty string');

    // Test with null (should not throw)
    Utils.setDisplay(null, 'block');
    TestRunner.assert(true, 'setDisplay handles null element gracefully');
}

function testAddRemoveClass() {
    TestRunner.group('addClass/removeClass');

    // Test with mock element
    var addedClasses = [];
    var removedClasses = [];
    var el = {
        classList: {
            add: function(c) { addedClasses.push(c); },
            remove: function(c) { removedClasses.push(c); }
        }
    };

    Utils.addClass(el, 'test-class');
    TestRunner.assert(addedClasses.indexOf('test-class') !== -1, 'addClass adds class');

    Utils.removeClass(el, 'test-class');
    TestRunner.assert(removedClasses.indexOf('test-class') !== -1, 'removeClass removes class');

    // Test with null (should not throw)
    Utils.addClass(null, 'class');
    Utils.removeClass(null, 'class');
    TestRunner.assert(true, 'addClass/removeClass handle null gracefully');

    // Test with element without classList
    Utils.addClass({}, 'class');
    Utils.removeClass({}, 'class');
    TestRunner.assert(true, 'addClass/removeClass handle missing classList gracefully');
}

function testToggleClass() {
    TestRunner.group('toggleClass');

    var toggleCalls = [];
    var el = {
        classList: {
            toggle: function(c, force) { toggleCalls.push({ class: c, force: force }); }
        }
    };

    Utils.toggleClass(el, 'active');
    TestRunner.assertEqual(toggleCalls[0].class, 'active', 'toggleClass calls classList.toggle');

    Utils.toggleClass(el, 'visible', true);
    TestRunner.assertEqual(toggleCalls[1].force, true, 'toggleClass passes force parameter');

    Utils.toggleClass(el, 'hidden', false);
    TestRunner.assertEqual(toggleCalls[2].force, false, 'toggleClass passes false force');

    // Test with null
    Utils.toggleClass(null, 'class');
    TestRunner.assert(true, 'toggleClass handles null gracefully');
}

function testDisableEnableButton() {
    TestRunner.group('disableButton/enableButton');

    var btn = { disabled: false, style: {} };

    Utils.disableButton(btn);
    TestRunner.assertEqual(btn.disabled, true, 'disableButton sets disabled to true');
    TestRunner.assertEqual(btn.style.opacity, '0.5', 'disableButton sets opacity to 0.5');

    Utils.enableButton(btn);
    TestRunner.assertEqual(btn.disabled, false, 'enableButton sets disabled to false');
    TestRunner.assertEqual(btn.style.opacity, '', 'enableButton clears opacity');

    // Test disableButton without dim
    btn.style.opacity = '1';
    Utils.disableButton(btn, false);
    TestRunner.assertEqual(btn.disabled, true, 'disableButton with dim=false still disables');
    TestRunner.assertEqual(btn.style.opacity, '1', 'disableButton with dim=false preserves opacity');

    // Test with null
    Utils.disableButton(null);
    Utils.enableButton(null);
    TestRunner.assert(true, 'disableButton/enableButton handle null gracefully');
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runUtilsTests: runUtilsTests, TestRunner: TestRunner };
}
