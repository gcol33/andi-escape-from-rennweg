/**
 * Andi VN - Pausable Timer Module
 *
 * Shared pausable timeout system for battle animations.
 * Factory pattern - creates independent timer instances for different modules.
 *
 * Usage:
 *   var myTimer = PausableTimer.create({ name: 'MyModule' });
 *   myTimer.schedule(callback, 500);
 *   myTimer.pause();
 *   myTimer.unpause();
 */

var PausableTimer = (function() {
    'use strict';

    // Logging helper
    var _getLog = function() {
        return (typeof Utils !== 'undefined' && Utils.getLogger) ? Utils.getLogger() : {
            debug: function() {},
            warn: console.warn.bind(console),
            error: console.error.bind(console)
        };
    };

    /**
     * Create a new pausable timer instance
     * @param {Object} [options]
     * @param {string} [options.name] - Name for logging
     * @param {Function} [options.onPause] - Hook called when paused
     * @param {Function} [options.onUnpause] - Hook called when unpaused
     * @param {Function} [options.isActiveCheck] - If returns false, callbacks won't execute
     * @returns {Object} Timer instance
     */
    function create(options) {
        options = options || {};

        // Instance state
        var _isPaused = false;
        var _pausedTimeouts = [];
        var _activeTimeouts = [];
        var _nextTimeoutId = 1;

        // Instance config
        var _name = options.name || 'PausableTimer';
        var _onPause = options.onPause || null;
        var _onUnpause = options.onUnpause || null;
        var _isActiveCheck = options.isActiveCheck || null;

        var _log = _getLog();

        // -----------------------------------------------------------------
        // Core Functions
        // -----------------------------------------------------------------

        /**
         * Schedule a pausable timeout
         */
        function schedule(callback, delay) {
            // If paused, queue for later
            if (_isPaused) {
                var info = {
                    id: _nextTimeoutId++,
                    callback: callback,
                    remaining: delay,
                    startTime: null,
                    timeoutId: null
                };
                _pausedTimeouts.push(info);
                return info.id;
            }

            var info = {
                id: _nextTimeoutId++,
                callback: callback,
                remaining: delay,
                startTime: Date.now(),
                timeoutId: null
            };

            info.timeoutId = setTimeout(function() {
                removeFromActive(info.id);
                executeCallback(callback, 'schedule');
            }, delay);

            _activeTimeouts.push(info);
            return info.id;
        }

        /**
         * Cancel a scheduled timeout
         */
        function cancel(id) {
            for (var i = _activeTimeouts.length - 1; i >= 0; i--) {
                if (_activeTimeouts[i].id === id) {
                    clearTimeout(_activeTimeouts[i].timeoutId);
                    _activeTimeouts.splice(i, 1);
                    return true;
                }
            }
            for (var j = _pausedTimeouts.length - 1; j >= 0; j--) {
                if (_pausedTimeouts[j].id === id) {
                    _pausedTimeouts.splice(j, 1);
                    return true;
                }
            }
            return false;
        }

        /**
         * Clear all timeouts
         */
        function clearAll() {
            for (var i = 0; i < _activeTimeouts.length; i++) {
                clearTimeout(_activeTimeouts[i].timeoutId);
            }
            _activeTimeouts = [];
            _pausedTimeouts = [];
        }

        // -----------------------------------------------------------------
        // Pause/Unpause
        // -----------------------------------------------------------------

        function isPaused() {
            return _isPaused;
        }

        function pause() {
            if (_isPaused) return;
            _isPaused = true;

            var now = Date.now();
            for (var i = 0; i < _activeTimeouts.length; i++) {
                var info = _activeTimeouts[i];
                clearTimeout(info.timeoutId);
                info.remaining = Math.max(0, info.remaining - (now - info.startTime));
                _pausedTimeouts.push(info);
            }
            _activeTimeouts = [];

            if (_onPause) {
                try { _onPause(); } catch (e) { _log.error('[' + _name + '] onPause error:', e); }
            }

            _log.debug(_name, 'Paused -', _pausedTimeouts.length, 'timeouts frozen');
        }

        function unpause() {
            if (!_isPaused) return;
            _isPaused = false;

            if (_onUnpause) {
                try { _onUnpause(); } catch (e) { _log.error('[' + _name + '] onUnpause error:', e); }
            }

            var now = Date.now();
            var count = _pausedTimeouts.length;
            for (var i = 0; i < _pausedTimeouts.length; i++) {
                resumeTimeout(_pausedTimeouts[i], now);
            }
            _pausedTimeouts = [];

            _log.debug(_name, 'Unpaused -', count, 'timeouts resumed');
        }

        function togglePause() {
            if (_isPaused) { unpause(); } else { pause(); }
        }

        // -----------------------------------------------------------------
        // Internal Helpers
        // -----------------------------------------------------------------

        function resumeTimeout(info, startTime) {
            info.startTime = startTime;
            info.timeoutId = setTimeout(function() {
                removeFromActive(info.id);
                executeCallback(info.callback, 'resume');
            }, info.remaining);
            _activeTimeouts.push(info);
        }

        function removeFromActive(id) {
            for (var i = _activeTimeouts.length - 1; i >= 0; i--) {
                if (_activeTimeouts[i].id === id) {
                    _activeTimeouts.splice(i, 1);
                    return;
                }
            }
        }

        function executeCallback(callback, source) {
            if (_isActiveCheck && !_isActiveCheck()) {
                return;
            }
            if (typeof callback === 'function') {
                try {
                    callback();
                } catch (e) {
                    _log.error('[' + _name + '] callback error (' + source + '):', e);
                }
            } else if (callback !== undefined && callback !== null) {
                _log.warn('[' + _name + '] non-function callback:', typeof callback);
            }
        }

        // -----------------------------------------------------------------
        // Instance API
        // -----------------------------------------------------------------

        return {
            schedule: schedule,
            cancel: cancel,
            clearAll: clearAll,
            isPaused: isPaused,
            pause: pause,
            unpause: unpause,
            togglePause: togglePause,
            getActiveCount: function() { return _activeTimeouts.length; },
            getPausedCount: function() { return _pausedTimeouts.length; }
        };
    }

    // =========================================================================
    // PUBLIC API (Factory)
    // =========================================================================

    return {
        create: create
    };
})();
