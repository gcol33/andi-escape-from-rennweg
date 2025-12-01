/**
 * Andi VN - Overworld UI Module (Rendering Layer)
 *
 * Pokemon/Zelda-style 2D top-down rendering.
 * Handles canvas drawing, sprite animations, and camera.
 * Uses 16x16 tiles scaled 2x for display.
 *
 * NO game logic - that's handled by overworld.js
 */

var OverworldUI = (function() {
    'use strict';

    // Read tuning values
    var config = typeof TUNING !== 'undefined' ? TUNING.overworld : {};

    // === Constants ===
    var TILE_SIZE = config.tileSize || 16;
    var RENDER_SCALE = config.renderScale || 2;
    var SCALED_TILE = TILE_SIZE * RENDER_SCALE;
    var VIEWPORT_TILES_X = config.viewportTilesX || 15;
    var VIEWPORT_TILES_Y = config.viewportTilesY || 11;

    // === Private State ===
    var elements = {
        container: null,
        canvas: null,
        ctx: null
    };

    var state = {
        // Camera position (in pixels, scaled)
        cameraX: 0,
        cameraY: 0,

        // Player visual position (for smooth movement, in scaled pixels)
        playerPixelX: 0,
        playerPixelY: 0,
        targetPixelX: 0,
        targetPixelY: 0,

        // Animation
        isAnimating: false,
        animationFrame: null,

        // Sprites
        playerSprite: null,
        tilesetImage: null,

        // Player animation
        walkFrame: 0,
        walkTimer: 0,
        facing: 'down'
    };

    var mapData = {
        width: 0,
        height: 0,
        tiles: [],
        entities: []
    };

    // Callbacks
    var callbacks = {
        onMoveComplete: null
    };

    // === Player Sprite Configuration ===
    // The character.png has 16x16 sprites arranged in rows
    // Row 0: down idle + walk frames
    // Row 1: up idle + walk frames
    // Row 2: right idle + walk frames
    // Row 3: left idle + walk frames
    // Each direction has: idle, walk1, walk2, walk3 (4 frames)
    var SPRITE_WIDTH = 16;
    var SPRITE_HEIGHT = 16;

    var PLAYER_FRAMES = {
        down:  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 }],
        up:    [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 2, y: 1 }],
        right: [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 2 }],
        left:  [{ x: 0, y: 3 }, { x: 1, y: 3 }, { x: 0, y: 3 }, { x: 2, y: 3 }]
    };

    // === Tile Definitions ===
    // Maps tile IDs to positions in the Overworld.png tileset
    // The tileset is not a regular grid, so we define specific pixel coords
    var TILE_DEFS = {
        // Basic terrain (using simple grass/path tiles)
        0: { x: 0, y: 64, w: 16, h: 16 },      // Grass
        1: { x: 32, y: 176, w: 16, h: 16 },    // Path/dirt
        2: { x: 112, y: 0, w: 16, h: 16 },     // Water
        3: { x: 0, y: 160, w: 16, h: 16 },     // Tree top
        4: { x: 0, y: 176, w: 16, h: 16 },     // Tree bottom
        5: { x: 80, y: 64, w: 16, h: 16 },     // Grass with flower
        6: { x: 272, y: 192, w: 16, h: 16 },   // Stone floor
        7: { x: 192, y: 112, w: 16, h: 16 },   // Wooden floor
        8: { x: 64, y: 64, w: 16, h: 16 },     // Tall grass (encounters)
        9: { x: 160, y: 128, w: 16, h: 16 }    // Sign
    };

    // === Private Functions ===

    /**
     * Create the canvas element
     */
    function createCanvas(parent) {
        elements.container = document.createElement('div');
        elements.container.className = 'overworld-container';

        elements.canvas = document.createElement('canvas');
        elements.canvas.className = 'overworld-canvas';
        elements.canvas.width = VIEWPORT_TILES_X * SCALED_TILE;
        elements.canvas.height = VIEWPORT_TILES_Y * SCALED_TILE;

        elements.ctx = elements.canvas.getContext('2d');
        elements.ctx.imageSmoothingEnabled = false; // Pixel art crisp

        elements.container.appendChild(elements.canvas);
        parent.appendChild(elements.container);
    }

    /**
     * Load an image
     */
    function loadImage(src) {
        return new Promise(function(resolve, reject) {
            var img = new Image();
            img.onload = function() { resolve(img); };
            img.onerror = function() { reject(new Error('Failed to load: ' + src)); };
            img.src = src;
        });
    }

    /**
     * Update camera to follow player
     */
    function updateCamera() {
        var canvasW = elements.canvas.width;
        var canvasH = elements.canvas.height;
        var mapPixelW = mapData.width * SCALED_TILE;
        var mapPixelH = mapData.height * SCALED_TILE;

        // Center camera on player
        var targetCamX = state.playerPixelX - canvasW / 2 + SCALED_TILE / 2;
        var targetCamY = state.playerPixelY - canvasH / 2 + SCALED_TILE / 2;

        // Clamp to map bounds
        state.cameraX = Math.max(0, Math.min(targetCamX, mapPixelW - canvasW));
        state.cameraY = Math.max(0, Math.min(targetCamY, mapPixelH - canvasH));
    }

    /**
     * Draw a tile from tileset
     */
    function drawTile(tileId, destX, destY) {
        if (!state.tilesetImage) return;

        var tileDef = TILE_DEFS[tileId] || TILE_DEFS[0];

        elements.ctx.drawImage(
            state.tilesetImage,
            tileDef.x, tileDef.y, tileDef.w, tileDef.h,
            destX, destY, SCALED_TILE, SCALED_TILE
        );
    }

    /**
     * Draw the map tiles
     */
    function drawMap() {
        var ctx = elements.ctx;
        var startTileX = Math.floor(state.cameraX / SCALED_TILE);
        var startTileY = Math.floor(state.cameraY / SCALED_TILE);
        var offsetX = -(state.cameraX % SCALED_TILE);
        var offsetY = -(state.cameraY % SCALED_TILE);

        // Draw visible tiles + 1 buffer
        for (var y = 0; y <= VIEWPORT_TILES_Y + 1; y++) {
            for (var x = 0; x <= VIEWPORT_TILES_X + 1; x++) {
                var tileX = startTileX + x;
                var tileY = startTileY + y;

                if (tileX >= 0 && tileX < mapData.width &&
                    tileY >= 0 && tileY < mapData.height) {
                    var tileId = mapData.tiles[tileY] ? mapData.tiles[tileY][tileX] : 0;
                    var drawX = x * SCALED_TILE + offsetX;
                    var drawY = y * SCALED_TILE + offsetY;
                    drawTile(tileId, drawX, drawY);
                }
            }
        }
    }

    /**
     * Draw the player sprite
     */
    function drawPlayer() {
        if (!state.playerSprite) return;

        var ctx = elements.ctx;
        var frames = PLAYER_FRAMES[state.facing] || PLAYER_FRAMES.down;
        var frame = frames[state.walkFrame];

        var srcX = frame.x * SPRITE_WIDTH;
        var srcY = frame.y * SPRITE_HEIGHT;

        var drawX = state.playerPixelX - state.cameraX;
        var drawY = state.playerPixelY - state.cameraY;

        ctx.drawImage(
            state.playerSprite,
            srcX, srcY, SPRITE_WIDTH, SPRITE_HEIGHT,
            drawX, drawY, SCALED_TILE, SCALED_TILE
        );
    }

    /**
     * Draw entities (NPCs, objects)
     */
    function drawEntities() {
        var ctx = elements.ctx;

        mapData.entities.forEach(function(entity) {
            var drawX = entity.x * SCALED_TILE - state.cameraX;
            var drawY = entity.y * SCALED_TILE - state.cameraY;

            // Only draw if on screen
            if (drawX > -SCALED_TILE && drawX < elements.canvas.width &&
                drawY > -SCALED_TILE && drawY < elements.canvas.height) {

                if (entity.sprite) {
                    ctx.drawImage(entity.sprite, drawX, drawY, SCALED_TILE, SCALED_TILE);
                } else {
                    // Placeholder for entities without sprites
                    ctx.fillStyle = entity.color || '#ff00ff';
                    ctx.fillRect(drawX + 4, drawY + 4, SCALED_TILE - 8, SCALED_TILE - 8);
                }
            }
        });
    }

    /**
     * Main render function
     */
    function render() {
        var ctx = elements.ctx;

        // Clear canvas
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, elements.canvas.width, elements.canvas.height);

        // Draw layers
        drawMap();
        drawEntities();
        drawPlayer();
    }

    /**
     * Animation loop for smooth movement
     */
    function animate(timestamp) {
        if (!state.isAnimating) return;

        var speed = (config.moveSpeed || 4); // pixels per frame (in scaled space)
        var dx = state.targetPixelX - state.playerPixelX;
        var dy = state.targetPixelY - state.playerPixelY;

        // Move towards target
        if (Math.abs(dx) > speed) {
            state.playerPixelX += dx > 0 ? speed : -speed;
        } else {
            state.playerPixelX = state.targetPixelX;
        }

        if (Math.abs(dy) > speed) {
            state.playerPixelY += dy > 0 ? speed : -speed;
        } else {
            state.playerPixelY = state.targetPixelY;
        }

        // Update walk animation
        state.walkTimer++;
        if (state.walkTimer >= (config.walkAnimSpeed || 8)) {
            state.walkTimer = 0;
            state.walkFrame = (state.walkFrame + 1) % 4;
        }

        // Update camera and render
        updateCamera();
        render();

        // Check if movement complete
        if (state.playerPixelX === state.targetPixelX &&
            state.playerPixelY === state.targetPixelY) {
            state.isAnimating = false;
            state.walkFrame = 0;
            render(); // Final render with standing frame

            if (callbacks.onMoveComplete) {
                callbacks.onMoveComplete();
            }
        } else {
            state.animationFrame = requestAnimationFrame(animate);
        }
    }

    // === Public API ===
    return {
        /**
         * Initialize the overworld UI
         * @param {HTMLElement} parent - Container element
         * @param {Object} cbs - Callbacks
         */
        init: function(parent, cbs) {
            callbacks = Object.assign({}, callbacks, cbs || {});
            createCanvas(parent);
        },

        /**
         * Load required assets
         * @returns {Promise}
         */
        loadAssets: function() {
            return Promise.all([
                loadImage('assets/overworld/player.png').then(function(img) {
                    state.playerSprite = img;
                }),
                loadImage('assets/overworld/tileset.png').then(function(img) {
                    state.tilesetImage = img;
                })
            ]);
        },

        /**
         * Set up the map display
         * @param {Object} data - Map data from OverworldEngine.loadMap()
         */
        setupMap: function(data) {
            mapData.width = data.width;
            mapData.height = data.height;
            mapData.tiles = data.tiles;
            mapData.entities = data.entities;

            // Set initial player position (in scaled pixels)
            state.playerPixelX = data.playerX * SCALED_TILE;
            state.playerPixelY = data.playerY * SCALED_TILE;
            state.targetPixelX = state.playerPixelX;
            state.targetPixelY = state.playerPixelY;
            state.facing = data.facing;

            updateCamera();
            render();
        },

        /**
         * Start movement animation
         * @param {Object} moveData - Movement info from OverworldEngine
         */
        animateMove: function(moveData) {
            state.targetPixelX = moveData.toX * SCALED_TILE;
            state.targetPixelY = moveData.toY * SCALED_TILE;
            state.facing = moveData.direction;
            state.isAnimating = true;
            state.walkTimer = 0;

            if (!state.animationFrame) {
                state.animationFrame = requestAnimationFrame(animate);
            }
        },

        /**
         * Update facing direction without moving
         */
        setFacing: function(direction) {
            state.facing = direction;
            render();
        },

        /**
         * Immediately set player position (for warps)
         */
        setPosition: function(x, y, facing) {
            state.playerPixelX = x * SCALED_TILE;
            state.playerPixelY = y * SCALED_TILE;
            state.targetPixelX = state.playerPixelX;
            state.targetPixelY = state.playerPixelY;
            if (facing) state.facing = facing;

            updateCamera();
            render();
        },

        /**
         * Show the overworld
         */
        show: function() {
            if (elements.container) {
                elements.container.classList.add('active');
            }
        },

        /**
         * Hide the overworld
         */
        hide: function() {
            if (elements.container) {
                elements.container.classList.remove('active');
            }
        },

        /**
         * Force a re-render
         */
        render: function() {
            render();
        },

        /**
         * Get canvas dimensions
         */
        getDimensions: function() {
            return {
                width: elements.canvas ? elements.canvas.width : 0,
                height: elements.canvas ? elements.canvas.height : 0,
                tileSize: SCALED_TILE
            };
        },

        /**
         * Cleanup
         */
        destroy: function() {
            if (state.animationFrame) {
                cancelAnimationFrame(state.animationFrame);
            }
            if (elements.container && elements.container.parentNode) {
                elements.container.parentNode.removeChild(elements.container);
            }
            elements = { container: null, canvas: null, ctx: null };
            state.playerSprite = null;
            state.tilesetImage = null;
        }
    };
})();
