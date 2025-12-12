/**
 * Andi VN - Logger Module Tests
 *
 * Run tests: node tests/run-logger-tests.js
 *
 * Tests for centralized logging utility including:
 * - Log level methods (debug, info, warn, error)
 * - Dev mode toggle
 * - Prefix formatting
 * - Group and table logging
 * - Time tracking
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

    assertContains: function(str, substr, message) {
        var condition = str.indexOf(substr) !== -1;
        if (!condition) {
            message += ' (string does not contain "' + substr + '")';
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
        console.log('\n=== Logger Module Test Results ===');
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

// Capture console output for testing
var capturedLogs = [];
var capturedWarns = [];
var capturedErrors = [];
var originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    group: console.group,
    groupEnd: console.groupEnd,
    table: console.table,
    time: console.time,
    timeEnd: console.timeEnd
};

function startCapture() {
    capturedLogs = [];
    capturedWarns = [];
    capturedErrors = [];
    console.log = function() {
        capturedLogs.push(Array.prototype.slice.call(arguments).join(' '));
    };
    console.warn = function() {
        capturedWarns.push(Array.prototype.slice.call(arguments).join(' '));
    };
    console.error = function() {
        capturedErrors.push(Array.prototype.slice.call(arguments).join(' '));
    };
}

function stopCapture() {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
}

function runLoggerTests() {
    TestRunner.reset();

    testLoggerExists();
    testInfoLogging();
    testWarnLogging();
    testErrorLogging();
    testDebugLoggingDevModeOff();
    testDebugLoggingDevModeOn();
    testPrefixFormatting();
    testMultipleArguments();
    testIsDevMode();

    return TestRunner.report();
}

function testLoggerExists() {
    TestRunner.group('Logger Exists');

    TestRunner.assert(typeof Logger !== 'undefined', 'Logger is defined');
    TestRunner.assertEqual(typeof Logger.debug, 'function', 'Logger.debug is a function');
    TestRunner.assertEqual(typeof Logger.info, 'function', 'Logger.info is a function');
    TestRunner.assertEqual(typeof Logger.warn, 'function', 'Logger.warn is a function');
    TestRunner.assertEqual(typeof Logger.error, 'function', 'Logger.error is a function');
    TestRunner.assertEqual(typeof Logger.group, 'function', 'Logger.group is a function');
    TestRunner.assertEqual(typeof Logger.groupEnd, 'function', 'Logger.groupEnd is a function');
    TestRunner.assertEqual(typeof Logger.table, 'function', 'Logger.table is a function');
    TestRunner.assertEqual(typeof Logger.time, 'function', 'Logger.time is a function');
    TestRunner.assertEqual(typeof Logger.timeEnd, 'function', 'Logger.timeEnd is a function');
    TestRunner.assertEqual(typeof Logger.isDevMode, 'function', 'Logger.isDevMode is a function');
}

function testInfoLogging() {
    TestRunner.group('Info Logging');

    startCapture();
    Logger.info('TestModule', 'Test message');
    stopCapture();

    TestRunner.assertEqual(capturedLogs.length, 1, 'Info produces one log');
    TestRunner.assertContains(capturedLogs[0], '[TestModule]', 'Info includes module prefix');
    TestRunner.assertContains(capturedLogs[0], 'Test message', 'Info includes message');
}

function testWarnLogging() {
    TestRunner.group('Warn Logging');

    startCapture();
    Logger.warn('WarnModule', 'Warning message');
    stopCapture();

    TestRunner.assertEqual(capturedWarns.length, 1, 'Warn produces one warning');
    TestRunner.assertContains(capturedWarns[0], '[WarnModule]', 'Warn includes module prefix');
    TestRunner.assertContains(capturedWarns[0], 'Warning message', 'Warn includes message');
}

function testErrorLogging() {
    TestRunner.group('Error Logging');

    startCapture();
    Logger.error('ErrorModule', 'Error message');
    stopCapture();

    TestRunner.assertEqual(capturedErrors.length, 1, 'Error produces one error');
    TestRunner.assertContains(capturedErrors[0], '[ErrorModule]', 'Error includes module prefix');
    TestRunner.assertContains(capturedErrors[0], 'Error message', 'Error includes message');
}

function testDebugLoggingDevModeOff() {
    TestRunner.group('Debug Logging (Dev Mode Off)');

    // Ensure dev mode is off
    window.__DEV_MODE__ = false;
    if (typeof VNEngine !== 'undefined' && VNEngine.state) {
        VNEngine.state.devMode = false;
    }

    startCapture();
    Logger.debug('DebugModule', 'Debug message');
    stopCapture();

    TestRunner.assertEqual(capturedLogs.length, 0, 'Debug produces no output when dev mode is off');
}

function testDebugLoggingDevModeOn() {
    TestRunner.group('Debug Logging (Dev Mode On)');

    // Enable dev mode
    window.__DEV_MODE__ = true;

    startCapture();
    Logger.debug('DebugModule', 'Debug message');
    stopCapture();

    TestRunner.assertEqual(capturedLogs.length, 1, 'Debug produces output when dev mode is on');
    TestRunner.assertContains(capturedLogs[0], '[DebugModule]', 'Debug includes module prefix');
    TestRunner.assertContains(capturedLogs[0], 'Debug message', 'Debug includes message');

    // Reset dev mode
    window.__DEV_MODE__ = false;
}

function testPrefixFormatting() {
    TestRunner.group('Prefix Formatting');

    startCapture();
    Logger.info('MyModule', 'message');
    stopCapture();

    // Should have format: [MyModule] message
    TestRunner.assertContains(capturedLogs[0], '[MyModule]', 'Prefix has brackets');

    startCapture();
    Logger.info('Battle', 'Turn started');
    stopCapture();

    TestRunner.assertContains(capturedLogs[0], '[Battle]', 'Different module names work');
}

function testMultipleArguments() {
    TestRunner.group('Multiple Arguments');

    startCapture();
    Logger.info('Test', 'Value is', 42, 'and', true);
    stopCapture();

    TestRunner.assertContains(capturedLogs[0], 'Value is', 'First arg included');
    TestRunner.assertContains(capturedLogs[0], '42', 'Number arg included');
    TestRunner.assertContains(capturedLogs[0], 'true', 'Boolean arg included');

    startCapture();
    Logger.warn('Test', 'Object:', { a: 1 });
    stopCapture();

    TestRunner.assertEqual(capturedWarns.length, 1, 'Warn with object works');
}

function testIsDevMode() {
    TestRunner.group('isDevMode');

    // Test with window flag
    window.__DEV_MODE__ = false;
    TestRunner.assertEqual(Logger.isDevMode(), false, 'isDevMode returns false when __DEV_MODE__ is false');

    window.__DEV_MODE__ = true;
    TestRunner.assertEqual(Logger.isDevMode(), true, 'isDevMode returns true when __DEV_MODE__ is true');

    // Reset
    window.__DEV_MODE__ = false;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runLoggerTests: runLoggerTests, TestRunner: TestRunner };
}
