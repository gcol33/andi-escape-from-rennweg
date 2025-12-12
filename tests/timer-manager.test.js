/**
 * Andi VN - TimerManager Module Tests
 *
 * Run tests: node tests/run-timer-manager-tests.js
 *
 * Tests for centralized timer tracking including:
 * - setTimeout tracking and cleanup
 * - setInterval tracking and cleanup
 * - Namespace-based timer management
 * - Timer existence checks
 */

// Simple test framework
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

    assertGreaterThan: function(actual, expected, message) {
        var condition = actual > expected;
        if (!condition) {
            message += ' (expected > ' + expected + ', got ' + actual + ')';
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
        console.log('\n=== TimerManager Module Test Results ===');
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

function runTimerManagerTests() {
    TestRunner.reset();

    // Clear all timers before tests
    TimerManager.clearEverything();

    testSetTimeoutBasic();
    testSetIntervalBasic();
    testClearSpecificTimer();
    testNamespaceCleanup();
    testClearEverything();
    testTimerCount();
    testTimerExists();
    testInvalidCallback();
    testGetAll();
    testDefaultNamespace();

    // Final cleanup
    TimerManager.clearEverything();

    return TestRunner.report();
}

function testSetTimeoutBasic() {
    TestRunner.group('setTimeout Basic');

    TimerManager.clearEverything();

    // Test that setTimeout returns an ID
    var called = false;
    var id = TimerManager.setTimeout(function() { called = true; }, 1000, 'test');

    TestRunner.assertGreaterThan(id, 0, 'setTimeout returns positive ID');
    TestRunner.assertEqual(TimerManager.exists(id), true, 'Timer exists after creation');
    TestRunner.assertEqual(TimerManager.count(), 1, 'Timer count is 1');

    // Clean up
    TimerManager.clear(id);
}

function testSetIntervalBasic() {
    TestRunner.group('setInterval Basic');

    TimerManager.clearEverything();

    var callCount = 0;
    var id = TimerManager.setInterval(function() { callCount++; }, 100, 'test');

    TestRunner.assertGreaterThan(id, 0, 'setInterval returns positive ID');
    TestRunner.assertEqual(TimerManager.exists(id), true, 'Interval exists after creation');
    TestRunner.assertEqual(TimerManager.count(), 1, 'Timer count is 1');

    // Clean up
    TimerManager.clear(id);
    TestRunner.assertEqual(TimerManager.exists(id), false, 'Interval no longer exists after clear');
}

function testClearSpecificTimer() {
    TestRunner.group('Clear Specific Timer');

    TimerManager.clearEverything();

    var id1 = TimerManager.setTimeout(function() {}, 1000, 'ns1');
    var id2 = TimerManager.setTimeout(function() {}, 1000, 'ns2');
    var id3 = TimerManager.setTimeout(function() {}, 1000, 'ns1');

    TestRunner.assertEqual(TimerManager.count(), 3, 'Three timers created');

    // Clear specific timer
    var result = TimerManager.clear(id1);
    TestRunner.assertEqual(result, true, 'clear() returns true for existing timer');
    TestRunner.assertEqual(TimerManager.count(), 2, 'Two timers remain after clearing one');
    TestRunner.assertEqual(TimerManager.exists(id1), false, 'Cleared timer no longer exists');
    TestRunner.assertEqual(TimerManager.exists(id2), true, 'Other timer still exists');

    // Try to clear non-existent timer
    result = TimerManager.clear(99999);
    TestRunner.assertEqual(result, false, 'clear() returns false for non-existent timer');

    // Clean up
    TimerManager.clearEverything();
}

function testNamespaceCleanup() {
    TestRunner.group('Namespace Cleanup');

    TimerManager.clearEverything();

    // Create timers in different namespaces
    TimerManager.setTimeout(function() {}, 1000, 'battle');
    TimerManager.setTimeout(function() {}, 1000, 'battle');
    TimerManager.setTimeout(function() {}, 1000, 'qte');
    TimerManager.setInterval(function() {}, 1000, 'battle');
    TimerManager.setInterval(function() {}, 1000, 'engine');

    TestRunner.assertEqual(TimerManager.count(), 5, 'Five timers created');
    TestRunner.assertEqual(TimerManager.count('battle'), 3, 'Three battle timers');
    TestRunner.assertEqual(TimerManager.count('qte'), 1, 'One qte timer');
    TestRunner.assertEqual(TimerManager.count('engine'), 1, 'One engine timer');

    // Clear battle namespace
    var cleared = TimerManager.clearAll('battle');
    TestRunner.assertEqual(cleared, 3, 'clearAll returns count of cleared timers');
    TestRunner.assertEqual(TimerManager.count(), 2, 'Two timers remain');
    TestRunner.assertEqual(TimerManager.count('battle'), 0, 'No battle timers remain');
    TestRunner.assertEqual(TimerManager.count('qte'), 1, 'QTE timer still exists');
    TestRunner.assertEqual(TimerManager.count('engine'), 1, 'Engine timer still exists');

    // Clean up
    TimerManager.clearEverything();
}

function testClearEverything() {
    TestRunner.group('Clear Everything');

    TimerManager.clearEverything();

    // Create various timers
    TimerManager.setTimeout(function() {}, 1000, 'a');
    TimerManager.setTimeout(function() {}, 1000, 'b');
    TimerManager.setInterval(function() {}, 1000, 'c');
    TimerManager.setInterval(function() {}, 1000, 'd');

    TestRunner.assertEqual(TimerManager.count(), 4, 'Four timers created');

    var cleared = TimerManager.clearEverything();
    TestRunner.assertEqual(cleared, 4, 'clearEverything returns count');
    TestRunner.assertEqual(TimerManager.count(), 0, 'No timers remain');
}

function testTimerCount() {
    TestRunner.group('Timer Count');

    TimerManager.clearEverything();

    TestRunner.assertEqual(TimerManager.count(), 0, 'Count is 0 when empty');

    var id1 = TimerManager.setTimeout(function() {}, 1000, 'ns1');
    TestRunner.assertEqual(TimerManager.count(), 1, 'Count is 1 after adding one');

    var id2 = TimerManager.setTimeout(function() {}, 1000, 'ns1');
    var id3 = TimerManager.setTimeout(function() {}, 1000, 'ns2');
    TestRunner.assertEqual(TimerManager.count(), 3, 'Count is 3 after adding more');

    // Count by namespace
    TestRunner.assertEqual(TimerManager.count('ns1'), 2, 'Count for ns1 is 2');
    TestRunner.assertEqual(TimerManager.count('ns2'), 1, 'Count for ns2 is 1');
    TestRunner.assertEqual(TimerManager.count('nonexistent'), 0, 'Count for non-existent namespace is 0');

    TimerManager.clearEverything();
}

function testTimerExists() {
    TestRunner.group('Timer Exists');

    TimerManager.clearEverything();

    var id = TimerManager.setTimeout(function() {}, 1000, 'test');

    TestRunner.assertEqual(TimerManager.exists(id), true, 'Timer exists after creation');
    TestRunner.assertEqual(TimerManager.exists(0), false, 'ID 0 does not exist');
    TestRunner.assertEqual(TimerManager.exists(-1), false, 'Negative ID does not exist');
    TestRunner.assertEqual(TimerManager.exists(99999), false, 'Random ID does not exist');

    TimerManager.clear(id);
    TestRunner.assertEqual(TimerManager.exists(id), false, 'Timer does not exist after clear');

    TimerManager.clearEverything();
}

function testInvalidCallback() {
    TestRunner.group('Invalid Callback');

    TimerManager.clearEverything();

    // Test with invalid callbacks
    var id1 = TimerManager.setTimeout(null, 1000, 'test');
    TestRunner.assertEqual(id1, 0, 'setTimeout with null callback returns 0');

    var id2 = TimerManager.setTimeout('not a function', 1000, 'test');
    TestRunner.assertEqual(id2, 0, 'setTimeout with string callback returns 0');

    var id3 = TimerManager.setInterval(undefined, 1000, 'test');
    TestRunner.assertEqual(id3, 0, 'setInterval with undefined callback returns 0');

    TestRunner.assertEqual(TimerManager.count(), 0, 'No timers created for invalid callbacks');
}

function testGetAll() {
    TestRunner.group('Get All');

    TimerManager.clearEverything();

    var id1 = TimerManager.setTimeout(function() {}, 1000, 'battle');
    var id2 = TimerManager.setInterval(function() {}, 500, 'qte');

    var all = TimerManager.getAll();

    TestRunner.assertEqual(all.length, 2, 'getAll returns 2 entries');

    // Find entries
    var timeout = all.find(function(e) { return e.id === id1; });
    var interval = all.find(function(e) { return e.id === id2; });

    TestRunner.assert(timeout !== undefined, 'Timeout entry found');
    TestRunner.assertEqual(timeout.type, 'timeout', 'Timeout has correct type');
    TestRunner.assertEqual(timeout.namespace, 'battle', 'Timeout has correct namespace');
    TestRunner.assertEqual(timeout.delay, 1000, 'Timeout has correct delay');

    TestRunner.assert(interval !== undefined, 'Interval entry found');
    TestRunner.assertEqual(interval.type, 'interval', 'Interval has correct type');
    TestRunner.assertEqual(interval.namespace, 'qte', 'Interval has correct namespace');
    TestRunner.assertEqual(interval.delay, 500, 'Interval has correct delay');

    TimerManager.clearEverything();
}

function testDefaultNamespace() {
    TestRunner.group('Default Namespace');

    TimerManager.clearEverything();

    // Create timer without namespace
    var id = TimerManager.setTimeout(function() {}, 1000);

    var all = TimerManager.getAll();
    TestRunner.assertEqual(all[0].namespace, 'global', 'Default namespace is "global"');

    TestRunner.assertEqual(TimerManager.count('global'), 1, 'Timer is in global namespace');

    TimerManager.clearEverything();
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runTimerManagerTests: runTimerManagerTests, TestRunner: TestRunner };
}
