/**
 * Overworld Module
 *
 * Tile-based map exploration system.
 * Provides the 'start_overworld' action handler.
 *
 * Dependencies: none (battle module optional for encounters)
 */
(function() {
    'use strict';

    var _engine = null;
    var _log = typeof Logger !== 'undefined' ? Logger : console;
    var _active = false;
    var _inputCleanup = null;

    /**
     * Set up input handling for overworld movement
     */
    function setupInput() {
        var keyState = {};

        function handleKeyDown(e) {
            if (!_active) return;

            var direction = null;
            switch (e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    direction = 'up';
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    direction = 'down';
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    direction = 'left';
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    direction = 'right';
                    break;
                case ' ':
                case 'Enter':
                    if (typeof OverworldEngine !== 'undefined') {
                        OverworldEngine.interact();
                    }
                    e.preventDefault();
                    return;
            }

            if (direction && !keyState[direction]) {
                keyState[direction] = true;
                if (typeof OverworldEngine !== 'undefined') {
                    OverworldEngine.move(direction);
                }
                e.preventDefault();
            }
        }

        function handleKeyUp(e) {
            var direction = null;
            switch (e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    direction = 'up';
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    direction = 'down';
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    direction = 'left';
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    direction = 'right';
                    break;
            }

            if (direction) {
                keyState[direction] = false;
            }
        }

        // Use ListenerManager if available
        if (typeof ListenerManager !== 'undefined') {
            ListenerManager.add(document, 'keydown', handleKeyDown, 'overworld');
            ListenerManager.add(document, 'keyup', handleKeyUp, 'overworld');
            return function() {
                ListenerManager.removeAll('overworld');
            };
        } else {
            document.addEventListener('keydown', handleKeyDown);
            document.addEventListener('keyup', handleKeyUp);
            return function() {
                document.removeEventListener('keydown', handleKeyDown);
                document.removeEventListener('keyup', handleKeyUp);
            };
        }
    }

    /**
     * Handle warp to another map or scene
     */
    function handleWarp(warp) {
        if (!_engine) return;

        if (warp.scene) {
            // Warp to a VN scene - exit overworld
            stopOverworld();
            _engine.loadScene(warp.scene);
        } else if (warp.target && typeof MAPS !== 'undefined') {
            // Warp to another map
            var targetMap = MAPS.get(warp.target);
            if (targetMap) {
                var mapData = OverworldEngine.loadMap(targetMap);
                if (warp.targetX !== undefined && warp.targetY !== undefined) {
                    OverworldEngine.setPosition(warp.targetX, warp.targetY, warp.facing);
                    mapData.playerX = warp.targetX;
                    mapData.playerY = warp.targetY;
                    mapData.facing = warp.facing || mapData.facing;
                }
                if (typeof OverworldUI !== 'undefined') {
                    OverworldUI.setupMap(mapData);
                }
            }
        }
    }

    /**
     * Handle random encounter
     */
    function handleEncounter(encounters) {
        if (!_engine || !encounters || encounters.length === 0) return;

        // Pick random enemy from list
        var enemyId = encounters[Math.floor(Math.random() * encounters.length)];

        // Pause overworld and start battle
        _active = false;

        if (typeof BattleEngine !== 'undefined') {
            // Start battle with callback to resume overworld
            var battleConfig = {
                enemy: enemyId,
                onVictory: function() {
                    _active = true;
                    if (typeof OverworldUI !== 'undefined') {
                        OverworldUI.show();
                    }
                },
                onDefeat: function() {
                    stopOverworld();
                    _engine.loadScene('game_over');
                }
            };

            BattleEngine.start(battleConfig, _engine.getCurrentScene());
            _engine.setBattleActive(true);
        }
    }

    /**
     * Handle interaction with entity
     */
    function handleInteract(entity) {
        if (!_engine) return;

        if (entity.dialogue) {
            // Pause overworld and show dialogue
            _active = false;
            _engine.loadScene(entity.dialogue);
        } else if (entity.message) {
            // Show message box (sign)
            _log.info('OverworldModule', 'Sign:', entity.message);
        }
    }

    /**
     * Stop the overworld and cleanup
     */
    function stopOverworld() {
        _active = false;

        if (_inputCleanup) {
            _inputCleanup();
            _inputCleanup = null;
        }

        if (typeof OverworldEngine !== 'undefined') {
            OverworldEngine.stop();
        }

        if (typeof OverworldUI !== 'undefined') {
            OverworldUI.hide();
        }
    }

    var module = {
        name: 'overworld',
        dependencies: [],

        /**
         * Initialize the overworld module
         * @param {Object} engine - Engine API
         */
        init: function(engine) {
            _engine = engine;

            // Initialize engine with callbacks
            if (typeof OverworldEngine !== 'undefined') {
                OverworldEngine.init({
                    playSfx: engine.playSfx,
                    onWarp: handleWarp,
                    onEncounter: handleEncounter,
                    onInteract: handleInteract
                });
            }

            _log.info('OverworldModule', 'Initialized');
        },

        /**
         * Clean up the overworld module
         */
        destroy: function() {
            stopOverworld();

            if (typeof OverworldEngine !== 'undefined') {
                OverworldEngine.destroy();
            }

            if (typeof OverworldUI !== 'undefined') {
                OverworldUI.destroy();
            }

            _engine = null;
            _log.info('OverworldModule', 'Destroyed');
        },

        /**
         * Action handlers provided by this module
         */
        actions: {
            /**
             * Start overworld exploration
             * @param {Object} action - Action config
             * @param {string} action.map - Map ID to load (from MAPS)
             * @param {number} [action.x] - Starting X position (optional)
             * @param {number} [action.y] - Starting Y position (optional)
             * @param {string} [action.facing] - Starting direction (optional)
             */
            start_overworld: function(action) {
                if (typeof OverworldEngine === 'undefined') {
                    _log.error('OverworldModule', 'OverworldEngine not loaded');
                    return;
                }

                if (typeof OverworldUI === 'undefined') {
                    _log.error('OverworldModule', 'OverworldUI not loaded');
                    return;
                }

                if (!_engine) {
                    _log.error('OverworldModule', 'Module not initialized');
                    return;
                }

                // Get map data
                var mapId = action.map || 'village';
                var mapData = null;

                if (typeof MAPS !== 'undefined') {
                    mapData = MAPS.get(mapId);
                }

                if (!mapData) {
                    _log.error('OverworldModule', 'Map not found:', mapId);
                    return;
                }

                // Initialize UI if needed
                var gameContainer = document.getElementById('game-container');
                if (gameContainer) {
                    OverworldUI.init(gameContainer, {
                        onMoveComplete: function() {
                            OverworldEngine.movementComplete();
                        }
                    });
                }

                // Load assets and start
                OverworldUI.loadAssets().then(function() {
                    // Connect engine to UI
                    OverworldEngine.init({
                        playSfx: _engine.playSfx,
                        onMove: function(moveData) {
                            OverworldUI.animateMove(moveData);
                        },
                        onFacingChange: function(direction) {
                            OverworldUI.setFacing(direction);
                        },
                        onWarp: handleWarp,
                        onEncounter: handleEncounter,
                        onInteract: handleInteract
                    });

                    // Load map
                    var loadedMap = OverworldEngine.loadMap(mapData);

                    // Override starting position if specified
                    if (action.x !== undefined && action.y !== undefined) {
                        OverworldEngine.setPosition(action.x, action.y, action.facing);
                        loadedMap.playerX = action.x;
                        loadedMap.playerY = action.y;
                        if (action.facing) loadedMap.facing = action.facing;
                    }

                    // Setup UI
                    OverworldUI.setupMap(loadedMap);
                    OverworldUI.show();

                    // Setup input
                    _inputCleanup = setupInput();
                    _active = true;

                    _log.info('OverworldModule', 'Started map:', mapId);
                }).catch(function(err) {
                    _log.error('OverworldModule', 'Failed to load assets:', err);
                });
            }
        }
    };

    // Register with ModuleRegistry
    if (typeof ModuleRegistry !== 'undefined') {
        ModuleRegistry.register(module);
    }

    // Expose globally for backwards compatibility
    window.OverworldModule = module;
})();
