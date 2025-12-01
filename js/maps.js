/**
 * Andi VN - Map Data
 *
 * Defines overworld maps with tile layouts, collision, entities, and warps.
 *
 * Tile IDs:
 *   0 = Grass
 *   1 = Path/dirt
 *   2 = Water (blocked)
 *   3 = Tree top (blocked)
 *   4 = Tree bottom (blocked)
 *   5 = Grass with flower
 *   6 = Stone floor
 *   7 = Wooden floor
 *   8 = Tall grass (random encounters)
 *   9 = Sign (interactable)
 */

var MAPS = (function() {
    'use strict';

    // Helper to generate collision from tiles (auto-block certain tile types)
    function generateCollision(tiles) {
        var blockedTiles = [2, 3, 4, 9]; // Water, trees, signs block movement
        return tiles.map(function(row) {
            return row.map(function(tile) {
                return blockedTiles.indexOf(tile) !== -1 ? 1 : 0;
            });
        });
    }

    // === VILLAGE MAP ===
    var villageTiles = [
        // Row 0 - top border with trees
        [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
        // Row 2-3 - grass and path
        [3, 4, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 3, 4],
        [3, 4, 0, 5, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 5, 0, 0, 3, 4],
        // Row 4-5 - path continues
        [3, 4, 0, 0, 0, 0, 1, 0, 0, 9, 0, 0, 1, 0, 0, 0, 0, 0, 3, 4],
        [3, 4, 0, 0, 8, 8, 1, 0, 0, 0, 0, 0, 1, 8, 8, 0, 0, 0, 3, 4],
        // Row 6-7 - center area
        [3, 4, 0, 0, 8, 8, 1, 1, 1, 1, 1, 1, 1, 8, 8, 0, 0, 0, 3, 4],
        [3, 4, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 5, 0, 3, 4],
        // Row 8-9
        [3, 4, 5, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 3, 4],
        [3, 4, 0, 0, 0, 3, 4, 0, 0, 1, 0, 0, 3, 4, 0, 0, 0, 0, 3, 4],
        // Row 10-11 - more trees and water
        [3, 4, 0, 0, 0, 3, 4, 0, 0, 1, 0, 0, 3, 4, 0, 2, 2, 2, 2, 2],
        [3, 4, 0, 8, 8, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2],
        // Row 12-13
        [3, 4, 0, 8, 8, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 3, 4],
        [3, 4, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 5, 0, 0, 0, 3, 4],
        // Row 14 - bottom border
        [3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]
    ];

    return {
        village: {
            id: 'village',
            name: 'Starting Village',
            width: 20,
            height: 16,
            tiles: villageTiles,
            collision: generateCollision(villageTiles),

            // Player starting position
            playerStart: {
                x: 9,
                y: 7,
                facing: 'down'
            },

            // NPCs and interactive objects
            entities: [
                {
                    id: 'sign_welcome',
                    type: 'sign',
                    x: 9,
                    y: 4,
                    message: 'Welcome to the village!\nPress SPACE to interact.'
                },
                {
                    id: 'npc_villager',
                    type: 'npc',
                    x: 7,
                    y: 7,
                    solid: true,
                    color: '#3498db',
                    dialogue: 'intro_villager'
                }
            ],

            // Warp points (exits to other maps/scenes)
            warps: [
                {
                    x: 9,
                    y: 15,
                    target: 'forest',
                    targetX: 10,
                    targetY: 1,
                    facing: 'down'
                }
            ],

            // Random encounter settings
            encounterRate: 10, // % chance per step in tall grass
            encounters: ['slime', 'goblin']
        },

        forest: {
            id: 'forest',
            name: 'Dark Forest',
            width: 20,
            height: 16,
            tiles: [
                [3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3],
                [4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 1, 4, 4, 4, 4, 4, 4, 4, 4, 4],
                [3, 4, 8, 8, 8, 0, 0, 0, 0, 1, 1, 0, 0, 0, 8, 8, 8, 0, 3, 4],
                [3, 4, 8, 8, 8, 8, 0, 0, 0, 1, 1, 0, 0, 8, 8, 8, 8, 0, 3, 4],
                [3, 4, 8, 8, 8, 8, 8, 0, 1, 1, 1, 1, 0, 8, 8, 8, 8, 0, 3, 4],
                [3, 4, 0, 8, 8, 8, 0, 0, 1, 0, 0, 1, 0, 0, 8, 8, 0, 0, 3, 4],
                [3, 4, 0, 0, 8, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 3, 4],
                [3, 4, 0, 0, 0, 0, 3, 4, 1, 0, 0, 1, 3, 4, 0, 0, 0, 0, 3, 4],
                [3, 4, 0, 0, 0, 0, 3, 4, 1, 1, 1, 1, 3, 4, 0, 0, 0, 0, 3, 4],
                [3, 4, 8, 8, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 8, 8, 3, 4],
                [3, 4, 8, 8, 8, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 8, 8, 8, 3, 4],
                [3, 4, 8, 8, 8, 8, 0, 0, 1, 1, 1, 1, 0, 0, 8, 8, 8, 8, 3, 4],
                [3, 4, 0, 8, 8, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 8, 8, 0, 3, 4],
                [3, 4, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 3, 4],
                [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
                [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]
            ],
            collision: null, // Will be generated
            playerStart: { x: 10, y: 1, facing: 'down' },
            entities: [],
            warps: [
                {
                    x: 9,
                    y: 0,
                    target: 'village',
                    targetX: 9,
                    targetY: 14,
                    facing: 'up'
                }
            ],
            encounterRate: 25,
            encounters: ['wolf', 'bear', 'goblin']
        },

        // Get a map by ID
        get: function(mapId) {
            var map = this[mapId];
            if (map && !map.collision) {
                map.collision = generateCollision(map.tiles);
            }
            return map || null;
        }
    };
})();
