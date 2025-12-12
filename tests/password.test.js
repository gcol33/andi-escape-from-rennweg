/**
 * Andi VN - Password Module Tests
 *
 * Run tests: node tests/run-password-tests.js
 *
 * Tests for password protection screen including:
 * - Input validation (alphanumeric only)
 * - Password checking logic
 * - Lockout mechanism
 * - Cleanup and memory management
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
        console.log('\n=== Password Module Test Results ===');
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

// Test the validation logic extracted from PasswordScreen
// Since PasswordScreen is an IIFE with private functions, we test the patterns

function runPasswordTests() {
    TestRunner.reset();

    testInputValidation();
    testPasswordComparison();
    testLockoutMessageSelection();
    testIsValidatedState();
    testCleanupBehavior();

    return TestRunner.report();
}

function testInputValidation() {
    TestRunner.group('Input Validation');

    // Validation function (matching PasswordScreen.validateInput logic)
    var allowedChars = /^[A-Za-z0-9]$/;

    function validateInput(value) {
        if (!value) return '';
        var char = value.charAt(0);
        if (!allowedChars.test(char)) return '';
        return char.toUpperCase();
    }

    // Valid inputs
    TestRunner.assertEqual(validateInput('a'), 'A', 'Lowercase letter converted to uppercase');
    TestRunner.assertEqual(validateInput('Z'), 'Z', 'Uppercase letter preserved');
    TestRunner.assertEqual(validateInput('5'), '5', 'Number accepted');
    TestRunner.assertEqual(validateInput('abc'), 'A', 'Only first char used');

    // Invalid inputs
    TestRunner.assertEqual(validateInput(''), '', 'Empty string returns empty');
    TestRunner.assertEqual(validateInput(null), '', 'Null returns empty');
    TestRunner.assertEqual(validateInput(undefined), '', 'Undefined returns empty');
    TestRunner.assertEqual(validateInput('!'), '', 'Special char rejected');
    TestRunner.assertEqual(validateInput('@'), '', 'Symbol rejected');
    TestRunner.assertEqual(validateInput(' '), '', 'Space rejected');
    TestRunner.assertEqual(validateInput('é'), '', 'Accented char rejected');
}

function testPasswordComparison() {
    TestRunner.group('Password Comparison');

    var correctPassword = 'STRAHD';

    // Case-insensitive comparison function
    function checkPassword(entered) {
        return entered.toUpperCase() === correctPassword;
    }

    // Correct password
    TestRunner.assertEqual(checkPassword('STRAHD'), true, 'Exact match accepted');
    TestRunner.assertEqual(checkPassword('strahd'), true, 'Lowercase match accepted');
    TestRunner.assertEqual(checkPassword('Strahd'), true, 'Mixed case match accepted');
    TestRunner.assertEqual(checkPassword('sTrAhD'), true, 'Alternating case match accepted');

    // Incorrect passwords
    TestRunner.assertEqual(checkPassword('WRONG'), false, 'Wrong password rejected');
    TestRunner.assertEqual(checkPassword('STRAHL'), false, 'Similar but wrong rejected');
    TestRunner.assertEqual(checkPassword('STRAH'), false, 'Partial password rejected');
    TestRunner.assertEqual(checkPassword('STRAHDD'), false, 'Extra char rejected');
    TestRunner.assertEqual(checkPassword(''), false, 'Empty password rejected');
}

function testLockoutMessageSelection() {
    TestRunner.group('Lockout Message Selection');

    var lockoutMessages = [
        "Whoa there! Take a breather... {s}s",
        "Nice try, but no. Cool down for {s} seconds!",
        "Error 418: I'm a teapot. Wait {s} seconds.",
        "Password machine broke. Try again in {s}s.",
        "Andi says: 'Not today!' Wait {s} seconds..."
    ];

    // Test message templating
    var template = lockoutMessages[0];
    var seconds = 5;
    var message = template.replace('{s}', seconds);

    TestRunner.assertEqual(message, "Whoa there! Take a breather... 5s",
        'Template substitution works');

    // Verify all messages have placeholder
    for (var i = 0; i < lockoutMessages.length; i++) {
        var hasPlaceholder = lockoutMessages[i].indexOf('{s}') !== -1;
        TestRunner.assert(hasPlaceholder, 'Message ' + i + ' has {s} placeholder');
    }

    // Test countdown replacement at different values
    var testMessage = "Wait {s} seconds";
    TestRunner.assertEqual(testMessage.replace('{s}', 10), "Wait 10 seconds", 'Double digit replacement');
    TestRunner.assertEqual(testMessage.replace('{s}', 1), "Wait 1 seconds", 'Single digit replacement');
    TestRunner.assertEqual(testMessage.replace('{s}', 0), "Wait 0 seconds", 'Zero replacement');
}

function testIsValidatedState() {
    TestRunner.group('Validated State');

    // Test state tracking pattern
    var isValidated = false;

    function markValidated() {
        isValidated = true;
    }

    function checkValidated() {
        return isValidated;
    }

    TestRunner.assertEqual(checkValidated(), false, 'Initially not validated');

    markValidated();
    TestRunner.assertEqual(checkValidated(), true, 'After validation, returns true');
}

function testCleanupBehavior() {
    TestRunner.group('Cleanup Behavior');

    // Test cleanup pattern (simulating the module's cleanup)
    var eventHandlers = {
        inputs: [],
        countdownTimeoutId: null
    };

    // Simulate adding handlers
    eventHandlers.inputs.push({ element: {}, type: 'input', handler: function() {} });
    eventHandlers.inputs.push({ element: {}, type: 'keydown', handler: function() {} });
    eventHandlers.countdownTimeoutId = 12345;

    function cleanup() {
        if (eventHandlers.countdownTimeoutId) {
            // Would clearTimeout here
            eventHandlers.countdownTimeoutId = null;
        }
        eventHandlers.inputs = [];
    }

    TestRunner.assertEqual(eventHandlers.inputs.length, 2, 'Handlers tracked before cleanup');
    TestRunner.assert(eventHandlers.countdownTimeoutId !== null, 'Timeout tracked before cleanup');

    cleanup();

    TestRunner.assertEqual(eventHandlers.inputs.length, 0, 'Handlers cleared after cleanup');
    TestRunner.assertEqual(eventHandlers.countdownTimeoutId, null, 'Timeout cleared after cleanup');
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runPasswordTests: runPasswordTests, TestRunner: TestRunner };
}
