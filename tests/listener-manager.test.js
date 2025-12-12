/**
 * Andi VN - ListenerManager Module Tests
 *
 * Run tests: node tests/run-listener-manager-tests.js
 *
 * Tests for centralized event listener tracking including:
 * - Adding listeners with tracking
 * - Removing specific listeners
 * - Namespace-based listener cleanup
 * - Listener count tracking
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

    reset: function() {
        this.passed = 0;
        this.failed = 0;
        this.results = [];
        this.currentGroup = '';
    },

    report: function() {
        console.log('\n=== ListenerManager Module Test Results ===');
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

// Mock element factory for testing
function createMockElement() {
    var listeners = {};
    return {
        listeners: listeners,
        addEventListener: function(type, handler, options) {
            if (!listeners[type]) listeners[type] = [];
            listeners[type].push({ handler: handler, options: options });
        },
        removeEventListener: function(type, handler, options) {
            if (!listeners[type]) return;
            listeners[type] = listeners[type].filter(function(l) {
                return l.handler !== handler;
            });
        },
        getListenerCount: function(type) {
            return listeners[type] ? listeners[type].length : 0;
        }
    };
}

function runListenerManagerTests() {
    TestRunner.reset();

    // Clear all listeners before tests
    ListenerManager.clear();

    testAddListener();
    testRemoveSpecificListener();
    testNamespaceCleanup();
    testClearAll();
    testListenerCount();
    testRemovalFunction();
    testInvalidInputs();
    testGetAll();
    testDefaultNamespace();
    testOptions();

    // Final cleanup
    ListenerManager.clear();

    return TestRunner.report();
}

function testAddListener() {
    TestRunner.group('Add Listener');

    ListenerManager.clear();

    var el = createMockElement();
    var handler = function() {};

    var remover = ListenerManager.add(el, 'click', handler, 'test');

    TestRunner.assertEqual(typeof remover, 'function', 'add() returns a removal function');
    TestRunner.assertEqual(ListenerManager.count(), 1, 'Listener count is 1');
    TestRunner.assertEqual(el.getListenerCount('click'), 1, 'Element has 1 click listener');

    ListenerManager.clear();
}

function testRemoveSpecificListener() {
    TestRunner.group('Remove Specific Listener');

    ListenerManager.clear();

    var el = createMockElement();
    var handler1 = function() { return 1; };
    var handler2 = function() { return 2; };

    ListenerManager.add(el, 'click', handler1, 'test');
    ListenerManager.add(el, 'click', handler2, 'test');
    ListenerManager.add(el, 'keydown', handler1, 'test');

    TestRunner.assertEqual(ListenerManager.count(), 3, 'Three listeners added');

    // Remove specific listener
    var result = ListenerManager.remove(el, 'click', handler1);
    TestRunner.assertEqual(result, true, 'remove() returns true for existing listener');
    TestRunner.assertEqual(ListenerManager.count(), 2, 'Two listeners remain');
    TestRunner.assertEqual(el.getListenerCount('click'), 1, 'Element has 1 click listener');

    // Try to remove non-existent listener
    result = ListenerManager.remove(el, 'click', handler1); // Already removed
    TestRunner.assertEqual(result, false, 'remove() returns false for non-existent listener');

    // Remove by wrong type
    result = ListenerManager.remove(el, 'mouseover', handler2);
    TestRunner.assertEqual(result, false, 'remove() returns false for wrong event type');

    ListenerManager.clear();
}

function testNamespaceCleanup() {
    TestRunner.group('Namespace Cleanup');

    ListenerManager.clear();

    var el1 = createMockElement();
    var el2 = createMockElement();
    var handler = function() {};

    // Add listeners to different namespaces
    ListenerManager.add(el1, 'click', handler, 'battle');
    ListenerManager.add(el1, 'keydown', handler, 'battle');
    ListenerManager.add(el2, 'click', handler, 'qte');
    ListenerManager.add(el2, 'mousemove', handler, 'engine');

    TestRunner.assertEqual(ListenerManager.count(), 4, 'Four listeners added');
    TestRunner.assertEqual(ListenerManager.count('battle'), 2, 'Two battle listeners');
    TestRunner.assertEqual(ListenerManager.count('qte'), 1, 'One qte listener');
    TestRunner.assertEqual(ListenerManager.count('engine'), 1, 'One engine listener');

    // Clear battle namespace
    var removed = ListenerManager.removeAll('battle');
    TestRunner.assertEqual(removed, 2, 'removeAll returns count of removed listeners');
    TestRunner.assertEqual(ListenerManager.count(), 2, 'Two listeners remain');
    TestRunner.assertEqual(ListenerManager.count('battle'), 0, 'No battle listeners remain');
    TestRunner.assertEqual(el1.getListenerCount('click'), 0, 'Element 1 click listeners removed');
    TestRunner.assertEqual(el1.getListenerCount('keydown'), 0, 'Element 1 keydown listeners removed');
    TestRunner.assertEqual(el2.getListenerCount('click'), 1, 'Element 2 click listener still exists');

    ListenerManager.clear();
}

function testClearAll() {
    TestRunner.group('Clear All');

    ListenerManager.clear();

    var el = createMockElement();
    var handler = function() {};

    ListenerManager.add(el, 'click', handler, 'a');
    ListenerManager.add(el, 'keydown', handler, 'b');
    ListenerManager.add(el, 'mouseup', handler, 'c');

    TestRunner.assertEqual(ListenerManager.count(), 3, 'Three listeners added');

    var cleared = ListenerManager.clear();
    TestRunner.assertEqual(cleared, 3, 'clear() returns count');
    TestRunner.assertEqual(ListenerManager.count(), 0, 'No listeners remain');
    TestRunner.assertEqual(el.getListenerCount('click'), 0, 'Element has no click listeners');
    TestRunner.assertEqual(el.getListenerCount('keydown'), 0, 'Element has no keydown listeners');
}

function testListenerCount() {
    TestRunner.group('Listener Count');

    ListenerManager.clear();

    TestRunner.assertEqual(ListenerManager.count(), 0, 'Count is 0 when empty');

    var el = createMockElement();
    var handler = function() {};

    ListenerManager.add(el, 'click', handler, 'ns1');
    TestRunner.assertEqual(ListenerManager.count(), 1, 'Count is 1 after adding one');

    ListenerManager.add(el, 'keydown', handler, 'ns1');
    ListenerManager.add(el, 'mouseup', handler, 'ns2');
    TestRunner.assertEqual(ListenerManager.count(), 3, 'Count is 3 after adding more');

    // Count by namespace
    TestRunner.assertEqual(ListenerManager.count('ns1'), 2, 'Count for ns1 is 2');
    TestRunner.assertEqual(ListenerManager.count('ns2'), 1, 'Count for ns2 is 1');
    TestRunner.assertEqual(ListenerManager.count('nonexistent'), 0, 'Count for non-existent namespace is 0');

    ListenerManager.clear();
}

function testRemovalFunction() {
    TestRunner.group('Removal Function');

    ListenerManager.clear();

    var el = createMockElement();
    var handler = function() {};

    var remover = ListenerManager.add(el, 'click', handler, 'test');

    TestRunner.assertEqual(ListenerManager.count(), 1, 'Listener added');

    // Use the returned removal function
    remover();
    TestRunner.assertEqual(ListenerManager.count(), 0, 'Listener removed via removal function');
    TestRunner.assertEqual(el.getListenerCount('click'), 0, 'Element listener also removed');

    // Calling remover again should be safe (no-op)
    remover();
    TestRunner.assert(true, 'Calling remover twice does not throw');

    ListenerManager.clear();
}

function testInvalidInputs() {
    TestRunner.group('Invalid Inputs');

    ListenerManager.clear();

    // Test with null element
    var remover = ListenerManager.add(null, 'click', function() {}, 'test');
    TestRunner.assertEqual(typeof remover, 'function', 'Returns function even for null element');
    TestRunner.assertEqual(ListenerManager.count(), 0, 'No listener added for null element');

    // Test with invalid handler
    var el = createMockElement();
    remover = ListenerManager.add(el, 'click', null, 'test');
    TestRunner.assertEqual(ListenerManager.count(), 0, 'No listener added for null handler');

    remover = ListenerManager.add(el, 'click', 'not a function', 'test');
    TestRunner.assertEqual(ListenerManager.count(), 0, 'No listener added for non-function handler');

    ListenerManager.clear();
}

function testGetAll() {
    TestRunner.group('Get All');

    ListenerManager.clear();

    var el1 = createMockElement();
    var el2 = createMockElement();
    var handler1 = function() { return 1; };
    var handler2 = function() { return 2; };

    ListenerManager.add(el1, 'click', handler1, 'battle');
    ListenerManager.add(el2, 'keydown', handler2, 'qte');

    var all = ListenerManager.getAll();

    TestRunner.assertEqual(all.length, 2, 'getAll returns 2 entries');

    // Verify entries
    var clickEntry = all.find(function(e) { return e.type === 'click'; });
    var keydownEntry = all.find(function(e) { return e.type === 'keydown'; });

    TestRunner.assert(clickEntry !== undefined, 'Click entry found');
    TestRunner.assertEqual(clickEntry.element, el1, 'Click entry has correct element');
    TestRunner.assertEqual(clickEntry.handler, handler1, 'Click entry has correct handler');
    TestRunner.assertEqual(clickEntry.namespace, 'battle', 'Click entry has correct namespace');

    TestRunner.assert(keydownEntry !== undefined, 'Keydown entry found');
    TestRunner.assertEqual(keydownEntry.element, el2, 'Keydown entry has correct element');
    TestRunner.assertEqual(keydownEntry.handler, handler2, 'Keydown entry has correct handler');
    TestRunner.assertEqual(keydownEntry.namespace, 'qte', 'Keydown entry has correct namespace');

    // Verify it's a copy (modifying it doesn't affect internal state)
    all.pop();
    TestRunner.assertEqual(ListenerManager.count(), 2, 'getAll returns a copy');

    ListenerManager.clear();
}

function testDefaultNamespace() {
    TestRunner.group('Default Namespace');

    ListenerManager.clear();

    var el = createMockElement();
    var handler = function() {};

    // Add without namespace
    ListenerManager.add(el, 'click', handler);

    var all = ListenerManager.getAll();
    TestRunner.assertEqual(all[0].namespace, 'global', 'Default namespace is "global"');
    TestRunner.assertEqual(ListenerManager.count('global'), 1, 'Listener is in global namespace');

    ListenerManager.clear();
}

function testOptions() {
    TestRunner.group('Listener Options');

    ListenerManager.clear();

    var el = createMockElement();
    var handler = function() {};

    // Add with options
    ListenerManager.add(el, 'scroll', handler, 'test', { passive: true });

    var all = ListenerManager.getAll();
    TestRunner.assert(all[0].options !== undefined, 'Options are stored');
    TestRunner.assertEqual(all[0].options.passive, true, 'Options contain passive: true');

    // Verify options are passed to element
    TestRunner.assertEqual(el.listeners['scroll'][0].options.passive, true,
        'Options passed to addEventListener');

    ListenerManager.clear();
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runListenerManagerTests: runListenerManagerTests, TestRunner: TestRunner };
}
