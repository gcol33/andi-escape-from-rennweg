/**
 * Editor Configuration Module
 * Shared constants, asset lists, and configuration for all editor components
 */

(function(global) {
'use strict';

const EditorConfig = {
    // Asset paths relative to editor directory
    assetPaths: {
        bg: '../assets/bg/',
        char: '../assets/char/',
        music: '../assets/music/',
        sfx: '../assets/sfx/'
    },

    // Sprite positioning defaults
    sprite: {
        defaultX: 50,
        defaultY: 50,
        defaultScale: 1,
        minX: 5,
        maxX: 95,
        minY: 5,
        maxY: 65,
        ySnapPositions: [10, 25, 45, 65],
        ySnapThresholds: [15, 35, 55],
        scaleDragFactor: 100,
        spacing: 25
    },

    // Graph rendering defaults
    // Note: horizontalSpacing and verticalSpacing must match values in
    // graph-logic.js autoLayout() and both editor renderGraph() functions
    graph: {
        nodeWidth: 140,
        nodeHeight: 50,
        horizontalSpacing: 180,  // Matches layout algorithm
        verticalSpacing: 50,    // Matches layout algorithm
        startX: 100,
        defaultZoom: 1,
        minZoom: 0.1,
        maxZoom: 3,
        zoomStep: 1.2
    },

    // Dice roll defaults
    dice: {
        defaultType: 'd20',
        defaultThreshold: 10,
        maxThreshold: 100
    },

    // UI timing
    ui: {
        autocompleteDelay: 150,
        maxAutocompleteItems: 10,
        toastDuration: 3000
    },

    // Special scene targets that aren't actual scenes
    specialTargets: ['_roll'],

    // Asset lists
    assets: {
        backgrounds: [
            'back_stairwell_dim.jpg',
            'bedroom_morning.jpg',
            'dark_office_desk.jpg',
            'desk_computer_code.jpg',
            'hallway_dim.jpg',
            'hallway_fluorescent.jpg',
            'hallway_red_alert.jpg',
            'meeting_room_whiteboard.jpg',
            'office_corridor.jpg',
            'office_kitchen.jpg',
            'stairwell_escape.jpg',
            'stairwell_landing.jpg',
            'sunny_street_freedom.jpg'
        ],
        sprites: [
            'agnes_angry.svg',
            'agnes_blocking.svg',
            'agnes_happy.svg',
            'agnes_neutral.svg',
            'agnes_surprised.svg',
            'agnes_victorious.svg',
            'ali_friendly.svg',
            'fabio_friendly.svg',
            'gilles_explaining.svg',
            'joni_desperate.svg',
            'michi_whiteboard.svg',
            'norbert_grabbing.svg',
            'norbert_pleading.svg',
            'ruling_pointing.svg',
            'security_guard_waving.svg'
        ],
        music: [
            'BOSS_TIME.mp3',
            'coding.mp3',
            'coding_frenzy.mp3',
            'coffee.mp3',
            'default.mp3',
            'dicey_decisions.mp3',
            'game_over.mp3',
            'glitch.mp3',
            'i_can_do_it.mp3',
            'last_day.mp3',
            'legal_trap_stairwell.mp3',
            'oh_oh.mp3',
            'OH_SHIT.mp3',
            'outside.mp3',
            'questioning.mp3',
            'reading_papers.mp3',
            'rooftop.mp3',
            'running_escape.mp3',
            'spooky.mp3',
            'too_much_coffee.mp3',
            'victory.mp3',
            'zen.mp3'
        ],
        sfx: [
            'alarm.ogg',
            'alarm_clock.ogg',
            'alert.ogg',
            'chain.ogg',
            'click.ogg',
            'dice_roll.ogg',
            'door_open.ogg',
            'door_slam.ogg',
            'elevator_ding.ogg',
            'failure.ogg',
            'footstep.ogg',
            'gulp.ogg',
            'negative.ogg',
            'success.ogg',
            'thud.ogg',
            'victory.ogg',
            'warning.ogg',
            'zap.ogg'
        ]
    },

    /**
     * Get full asset path
     * @param {string} type - Asset type (bg, char, music, sfx)
     * @param {string} filename - Asset filename
     * @returns {string} Full path to asset
     */
    getAssetPath(type, filename) {
        const basePath = this.assetPaths[type];
        return basePath ? basePath + filename : filename;
    },

    /**
     * Check if a target is a special target (not an actual scene)
     * @param {string} target - Target to check
     * @returns {boolean}
     */
    isSpecialTarget(target) {
        return this.specialTargets.includes(target);
    }
};

// Export for browser and CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EditorConfig;
} else {
    global.EditorConfig = EditorConfig;
}

})(typeof window !== 'undefined' ? window : global);
