/**
 * Andi VN - Event Emitter Module
 *
 * Simple pub/sub system for loose coupling between modules.
 * Allows modules to communicate without direct dependencies.
 *
 * Usage:
 *   EventEmitter.on('battle:start', function(data) { ... });
 *   EventEmitter.emit('battle:start', { enemy: enemyData });
 *   EventEmitter.once('battle:end', function(data) { ... });
 *   EventEmitter.off('battle:start', myCallback);
 *
 * Standard Events:
 *   Battle: battle:start, battle:end, battle:turn-start, battle:turn-end
 *   Player: player:action, player:damaged, player:healed, player:status
 *   Enemy:  enemy:action, enemy:damaged, enemy:defeated
 *   QTE:    qte:start, qte:complete
 *   Scene:  scene:load, scene:transition, asset:load-error
 */

var EventEmitter = (function() {
    'use strict';

    var listeners = {};
    var onceListeners = {};

    function on(event, callback) {
        if (typeof callback !== 'function') {
            console.warn('EventEmitter: callback must be a function');
            return function() {};
        }
        if (!listeners[event]) {
            listeners[event] = [];
        }
        listeners[event].push(callback);
        return function() { off(event, callback); };
    }

    function once(event, callback) {
        if (typeof callback !== 'function') {
            console.warn('EventEmitter: callback must be a function');
            return function() {};
        }
        if (!onceListeners[event]) {
            onceListeners[event] = [];
        }
        onceListeners[event].push(callback);
        return function() { offOnce(event, callback); };
    }

    function off(event, callback) {
        if (!listeners[event]) return false;
        var index = listeners[event].indexOf(callback);
        if (index !== -1) {
            listeners[event].splice(index, 1);
            return true;
        }
        return false;
    }

    function offOnce(event, callback) {
        if (!onceListeners[event]) return false;
        var index = onceListeners[event].indexOf(callback);
        if (index !== -1) {
            onceListeners[event].splice(index, 1);
            return true;
        }
        return false;
    }

    function emit(event, data) {
        if (listeners[event]) {
            var callbacks = listeners[event].slice();
            for (var i = 0; i < callbacks.length; i++) {
                try {
                    callbacks[i](data);
                } catch (err) {
                    console.error('EventEmitter: Error in "' + event + '":', err);
                }
            }
        }
        if (onceListeners[event]) {
            var onceCallbacks = onceListeners[event].slice();
            onceListeners[event] = [];
            for (var j = 0; j < onceCallbacks.length; j++) {
                try {
                    onceCallbacks[j](data);
                } catch (err) {
                    console.error('EventEmitter: Error in once "' + event + '":', err);
                }
            }
        }
    }

    function clear(event) {
        if (event) {
            delete listeners[event];
            delete onceListeners[event];
        } else {
            listeners = {};
            onceListeners = {};
        }
    }

    function listenerCount(event) {
        var count = 0;
        if (listeners[event]) count += listeners[event].length;
        if (onceListeners[event]) count += onceListeners[event].length;
        return count;
    }

    return {
        on: on,
        once: once,
        off: off,
        emit: emit,
        clear: clear,
        listenerCount: listenerCount
    };
})();
