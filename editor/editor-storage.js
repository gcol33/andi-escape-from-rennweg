/**
 * Editor Storage Module
 * Shared localStorage operations for all editor components
 */

(function(global) {
'use strict';

const EditorStorage = {
    // Storage keys - single source of truth
    KEYS: {
        SCENES: 'andi_editor_scenes',
        CURRENT_SCENE: 'andi_editor_current_scene',
        GRAPH_POSITIONS: 'andi_editor_graph_positions'
    },

    /**
     * Save scenes to localStorage
     * @param {Object} scenes - Scene data object
     * @returns {boolean} Success status
     */
    saveScenes(scenes) {
        try {
            localStorage.setItem(this.KEYS.SCENES, JSON.stringify(scenes));
            return true;
        } catch (e) {
            console.warn('EditorStorage: Failed to save scenes:', e.message);
            return false;
        }
    },

    /**
     * Load scenes from localStorage
     * @returns {Object|null} Scene data or null if not found/error
     */
    loadScenes() {
        try {
            const data = localStorage.getItem(this.KEYS.SCENES);
            if (data) {
                const scenes = JSON.parse(data);
                if (scenes && typeof scenes === 'object' && Object.keys(scenes).length > 0) {
                    return scenes;
                }
            }
            return null;
        } catch (e) {
            console.warn('EditorStorage: Failed to load scenes:', e.message);
            return null;
        }
    },

    /**
     * Set current scene ID
     * @param {string} sceneId - Scene ID to save
     */
    setCurrentScene(sceneId) {
        try {
            if (sceneId) {
                localStorage.setItem(this.KEYS.CURRENT_SCENE, sceneId);
            }
        } catch (e) {
            // Ignore storage errors for non-critical data
        }
    },

    /**
     * Get current scene ID
     * @returns {string|null} Scene ID or null
     */
    getCurrentScene() {
        try {
            return localStorage.getItem(this.KEYS.CURRENT_SCENE);
        } catch (e) {
            return null;
        }
    },

    /**
     * Save graph node positions
     * @param {Object} positions - Node positions keyed by node ID
     */
    saveGraphPositions(positions) {
        try {
            localStorage.setItem(this.KEYS.GRAPH_POSITIONS, JSON.stringify(positions));
        } catch (e) {
            // Ignore
        }
    },

    /**
     * Load graph node positions
     * @returns {Object} Node positions or empty object
     */
    loadGraphPositions() {
        try {
            const data = localStorage.getItem(this.KEYS.GRAPH_POSITIONS);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            return {};
        }
    },

    /**
     * Clear all editor data from localStorage
     */
    clear() {
        try {
            Object.values(this.KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
        } catch (e) {
            console.warn('EditorStorage: Failed to clear storage:', e.message);
        }
    },

    /**
     * Auto-load scenes with fallback chain:
     * 1. localStorage
     * 2. Global story variable
     * 3. Fetch from story.js file
     *
     * @returns {Promise<Object|null>} Scene data or null
     */
    async autoLoad() {
        // 1. Try localStorage first
        const fromStorage = this.loadScenes();
        if (fromStorage) {
            console.info('EditorStorage: Loaded', Object.keys(fromStorage).length, 'scenes from localStorage');
            return fromStorage;
        }

        // 2. Try global story variable
        if (typeof story !== 'undefined' && story && Object.keys(story).length > 0) {
            console.info('EditorStorage: Loaded', Object.keys(story).length, 'scenes from global story');
            this.saveScenes(story);
            return story;
        }

        // 3. Try fetching story.js
        try {
            const response = await fetch('../js/story.js');
            if (response.ok) {
                const jsContent = await response.text();
                const startMarker = 'const story = ';
                const startIdx = jsContent.indexOf(startMarker);

                if (startIdx !== -1) {
                    const jsonStart = startIdx + startMarker.length;
                    // Find the closing brace with semicolon
                    let braceCount = 0;
                    let endIdx = jsonStart;

                    for (let i = jsonStart; i < jsContent.length; i++) {
                        if (jsContent[i] === '{') braceCount++;
                        if (jsContent[i] === '}') braceCount--;
                        if (braceCount === 0 && jsContent[i] === '}') {
                            endIdx = i + 1;
                            break;
                        }
                    }

                    const jsonStr = jsContent.substring(jsonStart, endIdx);
                    const storyData = JSON.parse(jsonStr);

                    if (storyData && Object.keys(storyData).length > 0) {
                        console.info('EditorStorage: Loaded', Object.keys(storyData).length, 'scenes from story.js file');
                        this.saveScenes(storyData);
                        return storyData;
                    }
                }
            }
        } catch (e) {
            console.info('EditorStorage: Could not load from story.js:', e.message);
        }

        console.warn('EditorStorage: No scene data found');
        return null;
    }
};

// Export for browser and CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EditorStorage;
} else {
    global.EditorStorage = EditorStorage;
}

})(typeof window !== 'undefined' ? window : global);
