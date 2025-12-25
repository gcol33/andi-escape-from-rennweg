/**
 * Quiz Module
 *
 * Timed multiple-choice quiz system.
 * Provides the 'start_quiz' action handler.
 */
(function() {
    'use strict';

    var _engine = null;
    var _log = typeof Logger !== 'undefined' ? Logger : console;

    var module = {
        name: 'quiz',
        dependencies: [],

        /**
         * Initialize the quiz module
         * @param {Object} engine - Engine API
         */
        init: function(engine) {
            _engine = engine;

            // Initialize QuizUI if available
            if (typeof QuizUI !== 'undefined') {
                var container = document.getElementById('vn-container');
                if (container) {
                    QuizUI.init(container);
                }
            }

            _log.info('QuizModule', 'Initialized');
        },

        /**
         * Clean up the quiz module
         */
        destroy: function() {
            _engine = null;
            _log.info('QuizModule', 'Destroyed');
        },

        /**
         * Action handlers provided by this module
         */
        actions: {
            /**
             * Start a quiz
             */
            start_quiz: function(action) {
                if (typeof QuizEngine === 'undefined') {
                    _log.error('QuizModule', 'QuizEngine not loaded');
                    return;
                }

                if (!_engine) {
                    _log.error('QuizModule', 'Module not initialized');
                    return;
                }

                // Start quiz - use current scene ID as quiz ID for tracking
                QuizEngine.start({
                    questions: action.questions || [],
                    timePerQuestion: action.time_per_question || 10,
                    winTarget: action.win_target,
                    loseTarget: action.lose_target,
                    quizId: _engine.getCurrentScene()
                }, function(result) {
                    // Quiz completed - navigate to appropriate scene
                    if (result.target) {
                        _engine.loadScene(result.target);
                    } else {
                        _log.error('QuizModule', 'Quiz ended without target scene');
                    }
                });
            }
        }
    };

    // Register with ModuleRegistry
    if (typeof ModuleRegistry !== 'undefined') {
        ModuleRegistry.register(module);
    }

    // Expose globally for backwards compatibility
    window.QuizModule = module;
})();
