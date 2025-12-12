/**
 * Andi VN - Audio Manager
 * @module managers/audio-manager
 *
 * Handles all audio playback: background music and sound effects.
 * Manages ducking, crossfading, and mute state.
 *
 * Usage:
 *   audioManager.playMusic('battle_theme.mp3');
 *   audioManager.playSFX('hit.ogg');
 *   audioManager.setMuted(true);
 */

(function() {
'use strict';

/**
 * AudioManager constructor
 */
function AudioManagerClass() {
    BaseManager.call(this);
    this.name = 'AudioManager';

    // Private state via closure
    var musicElement = null;
    var sfxElement = null;
    var muted = false;
    var volume = 0.4;
    var currentMusic = null;
    var ducking = false;
    var duckVolume = 0.2;
    var self = this;

    /**
     * Start ducking music volume
     */
    function startDucking() {
        if (ducking || !musicElement || muted) return;
        ducking = true;
        musicElement.volume = duckVolume;
    }

    /**
     * End ducking and restore volume
     */
    function endDucking() {
        if (!ducking || !musicElement || muted) return;
        ducking = false;
        musicElement.volume = volume;
    }

    /**
     * Initialize the manager
     */
    this.init = function() {
        BaseManager.prototype.init.call(this);

        // Get audio elements
        musicElement = document.getElementById('bg-music');
        sfxElement = document.createElement('audio');

        // Load settings from store
        var settings = this.getState('settings');
        if (settings) {
            muted = settings.muted || false;
            volume = settings.volume || 0.4;
        }

        // Apply initial state
        if (musicElement) {
            musicElement.volume = muted ? 0 : volume;
        }

        // Subscribe to events
        this.on(AudioEvents.MUSIC_PLAY, function(data) { self.playMusic(data.file, data.options); });
        this.on(AudioEvents.MUSIC_STOP, function() { self.stopMusic(); });
        this.on(AudioEvents.SFX_PLAY, function(data) { self.playSFX(data.file); });
        this.on(AudioEvents.MUTE_CHANGE, function(data) { self.setMuted(data.muted); });
        this.on(AudioEvents.VOLUME_CHANGE, function(data) { self.setVolume(data.volume); });

        this.debug('Initialized with volume:', volume, 'muted:', muted);
    };

    /**
     * Play background music
     * @param {string} file - Music filename
     * @param {Object} [options]
     */
    this.playMusic = function(file, options) {
        if (!musicElement || !file) return;

        options = options || {};
        var loop = options.loop !== false;

        // Handle 'none' to stop music
        if (file === 'none') {
            this.stopMusic();
            return;
        }

        // Skip if same track already playing
        if (currentMusic === file && !musicElement.paused) {
            return;
        }

        var src = 'assets/music/' + file;
        musicElement.src = src;
        musicElement.loop = loop;
        musicElement.volume = muted ? 0 : (ducking ? duckVolume : volume);
        currentMusic = file;

        musicElement.play().catch(function(err) {
            self.debug('Music play failed (autoplay policy):', err.message);
        });

        this.debug('Playing music:', file);
    };

    /**
     * Stop background music
     */
    this.stopMusic = function() {
        if (!musicElement) return;

        musicElement.pause();
        musicElement.currentTime = 0;
        currentMusic = null;

        this.debug('Music stopped');
    };

    /**
     * Play a sound effect
     * @param {string} file - SFX filename
     */
    this.playSFX = function(file) {
        if (!file || muted) return;

        var src = 'assets/sfx/' + file;

        // Create a new audio element for concurrent playback
        var audio = new Audio(src);
        audio.volume = volume;

        // Duck music during SFX
        startDucking();

        audio.play().catch(function(err) {
            self.debug('SFX play failed:', err.message);
        });

        audio.addEventListener('ended', function() {
            endDucking();
        });

        this.debug('Playing SFX:', file);
    };

    /**
     * Set mute state
     * @param {boolean} isMuted
     */
    this.setMuted = function(isMuted) {
        muted = isMuted;

        if (musicElement) {
            musicElement.volume = isMuted ? 0 : volume;
        }

        // Persist to settings
        this.setState('settings.muted', isMuted);

        this.debug('Muted:', isMuted);
    };

    /**
     * Toggle mute state
     * @returns {boolean} New mute state
     */
    this.toggleMute = function() {
        this.setMuted(!muted);
        return muted;
    };

    /**
     * Set volume level
     * @param {number} newVolume - 0 to 1
     */
    this.setVolume = function(newVolume) {
        volume = Math.max(0, Math.min(1, newVolume));

        if (musicElement && !muted) {
            musicElement.volume = ducking ? duckVolume : volume;
        }

        // Persist to settings
        this.setState('settings.volume', volume);

        this.debug('Volume:', volume);
    };

    /**
     * Get current volume
     * @returns {number}
     */
    this.getVolume = function() {
        return volume;
    };

    /**
     * Check if muted
     * @returns {boolean}
     */
    this.isMuted = function() {
        return muted;
    };

    /**
     * Get currently playing music
     * @returns {string|null}
     */
    this.getCurrentMusic = function() {
        return currentMusic;
    };

    /**
     * Destroy the manager
     */
    this.destroy = function() {
        this.stopMusic();
        BaseManager.prototype.destroy.call(this);
    };
}

// Inherit from BaseManager
AudioManagerClass.prototype = Object.create(BaseManager.prototype);
AudioManagerClass.prototype.constructor = AudioManagerClass;

// Singleton instance
var audioManager = new AudioManagerClass();

// Global export
window.audioManager = audioManager;

})();
