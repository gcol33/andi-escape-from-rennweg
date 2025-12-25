/**
 * Andi VN - Overworld Module (Logic Layer)
 *
 * Pokemon-style 2D top-down movement system.
 * Handles player position, collision, tile-based movement, and map data.
 *
 * NO DOM manipulation - that's handled by overworld-ui.js
 */

var OverworldEngine = (function() {
    'use strict';

    // Read tuning values
    var config = typeof TUNING !== 'undefined' ? TUNING.overworld : {};

    // === Private State ===
    var state = {
        // Player position (tile coordinates)
        playerX: 0,
        playerY: 0,

        // Player facing direction
        facing: 'down', // 'up', 'down', 'left', 'right'

        // Movement state
        isMoving: false,
        moveQueue: [],

        // Current map data
        currentMap: null,
        mapWidth: 0,
        mapHeight: 0,

        // Collision layer (2D array: 0 = walkable, 1 = blocked)
        collisionMap: [],

        // Interactive objects/NPCs on map
        entities: [],

        // Warp points (doors, stairs, etc.)
        warps: []
    };

    // Callbacks to notify UI/engine
    var callbacks = {
        onMove: null,           // Player moved to new tile
        onFacingChange: null,   // Player changed direction
        onInteract: null,       // Player interacted with entity
        onWarp: null,           // Player stepped on warp point
        onEncounter: null,      // Random encounter triggered
        playSfx: null           // Sound effect callback
    };

    // === Direction Vectors ===
    var DIRECTIONS = {
        up:    { dx: 0,  dy: -1 },
        down:  { dx: 0,  dy: 1  },
        left:  { dx: -1, dy: 0  },
        right: { dx: 1,  dy: 0  }
    };

    // === Private Functions ===

    /**
     * Check if a tile is walkable
     */
    function canMoveTo(x, y) {
        // Bounds check
        if (x < 0 || x >= state.mapWidth || y < 0 || y >= state.mapHeight) {
            return false;
        }

        // Collision check
        if (state.collisionMap[y] && state.collisionMap[y][x] === 1) {
            return false;
        }

        // Entity collision check (NPCs block movement)
        for (var i = 0; i < state.entities.length; i++) {
            var entity = state.entities[i];
            if (entity.x === x && entity.y === y && entity.solid !== false) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get entity at position
     */
    function getEntityAt(x, y) {
        for (var i = 0; i < state.entities.length; i++) {
            var entity = state.entities[i];
            if (entity.x === x && entity.y === y) {
                return entity;
            }
        }
        return null;
    }

    /**
     * Get warp at position
     */
    function getWarpAt(x, y) {
        for (var i = 0; i < state.warps.length; i++) {
            var warp = state.warps[i];
            if (warp.x === x && warp.y === y) {
                return warp;
            }
        }
        return null;
    }

    /**
     * Check for random encounter
     */
    function checkRandomEncounter() {
        if (!state.currentMap || !state.currentMap.encounterRate) {
            return false;
        }

        var rate = state.currentMap.encounterRate;
        var roll = Math.random() * 100;

        if (roll < rate) {
            return true;
        }
        return false;
    }

    /**
     * Execute a single movement step
     */
    function executeMove(direction) {
        if (state.isMoving) return false;

        var dir = DIRECTIONS[direction];
        if (!dir) return false;

        // Update facing even if we can't move
        if (state.facing !== direction) {
            state.facing = direction;
            if (callbacks.onFacingChange) {
                callbacks.onFacingChange(direction);
            }
        }

        var newX = state.playerX + dir.dx;
        var newY = state.playerY + dir.dy;

        if (!canMoveTo(newX, newY)) {
            // Play bump sound
            if (callbacks.playSfx) {
                callbacks.playSfx('bump');
            }
            return false;
        }

        // Start movement
        state.isMoving = true;

        var oldX = state.playerX;
        var oldY = state.playerY;

        state.playerX = newX;
        state.playerY = newY;

        // Notify UI to animate
        if (callbacks.onMove) {
            callbacks.onMove({
                fromX: oldX,
                fromY: oldY,
                toX: newX,
                toY: newY,
                direction: direction
            });
        }

        // Play footstep
        if (callbacks.playSfx) {
            callbacks.playSfx('footstep');
        }

        return true;
    }

    /**
     * Called when movement animation completes
     */
    function onMoveComplete() {
        state.isMoving = false;

        // Check for warp
        var warp = getWarpAt(state.playerX, state.playerY);
        if (warp && callbacks.onWarp) {
            callbacks.onWarp(warp);
            return;
        }

        // Check for random encounter (grass tiles)
        if (checkRandomEncounter() && callbacks.onEncounter) {
            var encounters = state.currentMap.encounters || [];
            callbacks.onEncounter(encounters);
            return;
        }

        // Process queued movement
        if (state.moveQueue.length > 0) {
            var nextDir = state.moveQueue.shift();
            executeMove(nextDir);
        }
    }

    // === Public API ===
    return {
        /**
         * Initialize the overworld engine
         * @param {Object} cbs - Callback functions
         */
        init: function(cbs) {
            callbacks = Object.assign({}, callbacks, cbs || {});
        },

        /**
         * Load a map
         * @param {Object} mapData - Map configuration
         */
        loadMap: function(mapData) {
            state.currentMap = mapData;
            state.mapWidth = mapData.width || 16;
            state.mapHeight = mapData.height || 12;
            state.collisionMap = mapData.collision || [];
            state.entities = mapData.entities || [];
            state.warps = mapData.warps || [];

            // Set player start position
            if (mapData.playerStart) {
                state.playerX = mapData.playerStart.x;
                state.playerY = mapData.playerStart.y;
                state.facing = mapData.playerStart.facing || 'down';
            }

            return {
                width: state.mapWidth,
                height: state.mapHeight,
                playerX: state.playerX,
                playerY: state.playerY,
                facing: state.facing,
                tiles: mapData.tiles || [],
                entities: state.entities
            };
        },

        /**
         * Move player in direction
         * @param {string} direction - 'up', 'down', 'left', 'right'
         */
        move: function(direction) {
            if (state.isMoving) {
                // Queue movement for smooth walking
                if (state.moveQueue.length < 2) {
                    state.moveQueue.push(direction);
                }
                return;
            }

            executeMove(direction);
        },

        /**
         * Interact with entity in front of player
         */
        interact: function() {
            var dir = DIRECTIONS[state.facing];
            var targetX = state.playerX + dir.dx;
            var targetY = state.playerY + dir.dy;

            var entity = getEntityAt(targetX, targetY);
            if (entity && callbacks.onInteract) {
                callbacks.onInteract(entity);
                return true;
            }

            return false;
        },

        /**
         * Called by UI when movement animation is done
         */
        movementComplete: function() {
            onMoveComplete();
        },

        /**
         * Set player position directly (for warps)
         */
        setPosition: function(x, y, facing) {
            state.playerX = x;
            state.playerY = y;
            if (facing) {
                state.facing = facing;
            }
        },

        /**
         * Get current state (for UI)
         */
        getState: function() {
            return {
                playerX: state.playerX,
                playerY: state.playerY,
                facing: state.facing,
                isMoving: state.isMoving,
                currentMap: state.currentMap ? state.currentMap.id : null
            };
        },

        /**
         * Check if player is currently moving
         */
        isMoving: function() {
            return state.isMoving;
        },

        /**
         * Stop all movement
         */
        stop: function() {
            state.isMoving = false;
            state.moveQueue = [];
        },

        /**
         * Cleanup
         */
        destroy: function() {
            state = {
                playerX: 0,
                playerY: 0,
                facing: 'down',
                isMoving: false,
                moveQueue: [],
                currentMap: null,
                mapWidth: 0,
                mapHeight: 0,
                collisionMap: [],
                entities: [],
                warps: []
            };
        }
    };
})();
