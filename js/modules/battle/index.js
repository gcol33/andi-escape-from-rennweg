/**
 * Battle Module
 *
 * Wraps the battle system (BattleEngine, BattleUI, etc.) as an optional module.
 * Provides the 'start_battle' action handler.
 *
 * Dependencies: qte (for timing-based combat)
 */
(function() {
    'use strict';

    var _engine = null;
    var _log = typeof Logger !== 'undefined' ? Logger : console;

    var module = {
        name: 'battle',
        dependencies: ['qte'],

        /**
         * Initialize the battle module
         * @param {Object} engine - Engine API
         */
        init: function(engine) {
            _engine = engine;

            // Initialize BattleEngine if available
            if (typeof BattleEngine !== 'undefined' && !BattleEngine.isInitialized()) {
                BattleEngine.init({
                    loadScene: engine.loadScene,
                    playSfx: engine.playSfx,
                    getInventory: engine.getInventory,
                    hasItem: engine.hasItem,
                    removeItem: engine.removeItem
                });

                // Set up dev mode callbacks
                BattleEngine.setForcedRollCallback(function() {
                    return engine.getDevForcedRoll();
                });

                if (BattleEngine.setForcedDamageCallback) {
                    BattleEngine.setForcedDamageCallback(function() {
                        return engine.getDevForcedDamage();
                    });
                }

                if (BattleEngine.setGuaranteeStatusCallback) {
                    BattleEngine.setGuaranteeStatusCallback(function() {
                        return engine.getDevGuaranteeStatus();
                    });
                }
            }

            _log.info('BattleModule', 'Initialized');
        },

        /**
         * Clean up the battle module
         */
        destroy: function() {
            if (typeof BattleEngine !== 'undefined') {
                BattleEngine.reset();
                if (BattleEngine.destroyUI) {
                    BattleEngine.destroyUI();
                }
            }
            _engine = null;
            _log.info('BattleModule', 'Destroyed');
        },

        /**
         * Action handlers provided by this module
         */
        actions: {
            /**
             * Start a battle encounter
             */
            start_battle: function(action) {
                if (typeof BattleEngine === 'undefined') {
                    _log.error('BattleModule', 'BattleEngine not loaded');
                    return;
                }

                if (!_engine) {
                    _log.error('BattleModule', 'Module not initialized');
                    return;
                }

                var stats = _engine.getPlayerStats();

                // Pass persisted HP/Mana from engine state to battle
                var battleConfig = Object.assign({}, action, {
                    persisted_hp: stats.hp,
                    persisted_max_hp: stats.maxHP,
                    persisted_mana: stats.mana,
                    persisted_max_mana: stats.maxMana
                });

                var battleState = BattleEngine.start(battleConfig, _engine.getCurrentScene());

                // Sync player HP/Mana with engine state for saving
                _engine.setPlayerStats({
                    hp: battleState.player.hp,
                    maxHP: battleState.player.maxHP,
                    mana: battleState.player.mana,
                    maxMana: battleState.player.maxMana
                });

                _engine.setBattleActive(true);

                // Register callback for when battle UI is ready
                battleState.onBattleReady = function() {
                    // Emit event for engine to render battle choices
                    if (typeof eventBus !== 'undefined') {
                        eventBus.emit('battle:ready', {
                            sceneId: _engine.getCurrentScene()
                        });
                    }
                };
            }
        }
    };

    // Register with ModuleRegistry
    if (typeof ModuleRegistry !== 'undefined') {
        ModuleRegistry.register(module);
    }

    // Expose globally for backwards compatibility
    window.BattleModule = module;
})();
