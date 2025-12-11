/**
 * Andi VN - Audio Manager Module
 *
 * Centralized audio management for music and sound effects.
 * Handles music playback, SFX with ducking, volume control, and mute.
 *
 * Usage:
 *   AudioManager.init(config);
 *   AudioManager.setMusic('track.mp3');
 *   AudioManager.playSfx('click.ogg');
 *   AudioManager.playSfxWithDucking('alert.ogg', callback);
 */

var AudioManager = (function() {
    'use strict';

    // === Configuration ===
    var config = {
        assetPaths: {
            music: 'assets/music/',
            sfx: 'assets/sfx/'
        },
        defaultMusic: 'default.mp3',
        sfxPreDelay: 150,
        sfxPostDelay: 200,
        sfxMinDuration: 620,
        sfxRepeatGap: 150,
        sfxDuckVolume: 0.2
    };

    // === State ===
    var state = {
        currentMusic: null,
        muted: false,
        volume: 0.16
    };

    // === DOM References ===
    var elements = {
        bgMusic: null,
        muteBtn: null,
        volumeSlider: null
    };

    // === Logging ===
    var _log = Utils.getLogger();

    /**
     * Initialize the audio manager
     * @param {Object} cfg - Configuration object
     * @param {Object} cfg.assetPaths - Paths to audio assets
     * @param {string} cfg.defaultMusic - Default music track
     * @param {number} cfg.sfxDuckVolume - Volume multiplier when ducking
     * @param {number} cfg.sfxMinDuration - Minimum SFX duration before repeating
     * @param {number} cfg.sfxRepeatGap - Gap between SFX repeats
     */
    function init(cfg) {
        // Merge config
        if (cfg) {
            if (cfg.assetPaths) {
                if (cfg.assetPaths.music) config.assetPaths.music = cfg.assetPaths.music;
                if (cfg.assetPaths.sfx) config.assetPaths.sfx = cfg.assetPaths.sfx;
            }
            if (cfg.defaultMusic) config.defaultMusic = cfg.defaultMusic;
            if (cfg.sfxDuckVolume !== undefined) config.sfxDuckVolume = cfg.sfxDuckVolume;
            if (cfg.sfxMinDuration !== undefined) config.sfxMinDuration = cfg.sfxMinDuration;
            if (cfg.sfxRepeatGap !== undefined) config.sfxRepeatGap = cfg.sfxRepeatGap;
            if (cfg.sfxPreDelay !== undefined) config.sfxPreDelay = cfg.sfxPreDelay;
            if (cfg.sfxPostDelay !== undefined) config.sfxPostDelay = cfg.sfxPostDelay;
        }

        // Cache DOM elements
        elements.bgMusic = document.getElementById('music-player');
        elements.muteBtn = document.getElementById('mute-btn');
        elements.volumeSlider = document.getElementById('volume-slider');

        _log.debug('AudioManager', 'Initialized');
    }

    /**
     * Set background music
     * @param {string} filename - Music filename or 'none' to stop
     */
    function setMusic(filename) {
        if (!elements.bgMusic) return;

        // Fall back to default music if empty string
        if (filename === '') {
            filename = config.defaultMusic;
        }

        // If same music, do nothing
        if (filename === state.currentMusic) return;

        // Stop music if 'none' or null
        if (!filename || filename === 'none') {
            stopMusic();
            return;
        }

        // Set new music
        var path = config.assetPaths.music + filename;
        elements.bgMusic.src = path;
        elements.bgMusic.loop = true;
        elements.bgMusic.volume = state.volume;
        state.currentMusic = filename;

        // Try to play
        tryPlayMusic();
    }

    /**
     * Try to play music (may fail due to autoplay policy)
     */
    function tryPlayMusic() {
        if (!elements.bgMusic || !state.currentMusic) return;
        if (state.muted) return;

        elements.bgMusic.play().catch(function() {
            // Autoplay blocked - will retry after user interaction
            _log.info('AudioManager', 'Music autoplay blocked, will retry after interaction');
        });
    }

    /**
     * Stop background music
     */
    function stopMusic() {
        if (!elements.bgMusic) return;

        elements.bgMusic.pause();
        elements.bgMusic.currentTime = 0;
        state.currentMusic = null;
    }

    /**
     * Play a sound effect
     * @param {string} filename - SFX filename
     * @param {Function} [callback] - Called when SFX ends
     */
    function playSfx(filename, callback) {
        if (state.muted || !filename || filename === '') {
            if (callback) callback();
            return;
        }

        var path = config.assetPaths.sfx + filename;
        var audio = new Audio(path);

        // If callback provided, call it when SFX ends
        if (callback) {
            audio.addEventListener('ended', callback);
            audio.addEventListener('error', callback);
        }

        audio.play().catch(function() {
            _log.info('AudioManager', 'SFX playback failed (autoplay blocked or file not found)');
            if (callback) callback();
        });
    }

    /**
     * Play SFX with music ducking (VN-style)
     * Ducks music volume, plays SFX, then restores music and calls callback
     * Short sounds are repeated to avoid jarring quick audio
     * @param {string} filename - SFX filename
     * @param {Function} [callback] - Called when complete
     */
    function playSfxWithDucking(filename, callback) {
        if (state.muted || !filename || filename === '') {
            if (callback) callback();
            return;
        }

        var path = config.assetPaths.sfx + filename;
        var audio = new Audio(path);
        var originalVolume = state.volume;
        var duckedVolume = originalVolume * config.sfxDuckVolume;
        var minDuration = config.sfxMinDuration;
        var gapBetweenRepeats = config.sfxRepeatGap;

        // Duck music
        if (elements.bgMusic) {
            elements.bgMusic.volume = duckedVolume;
        }

        // Restore music and call callback
        var onComplete = function() {
            if (elements.bgMusic) {
                elements.bgMusic.volume = originalVolume;
            }
            if (callback) callback();
        };

        // Wait for metadata to get duration, then play (possibly with repeats)
        audio.addEventListener('loadedmetadata', function() {
            var durationMs = audio.duration * 1000;

            if (durationMs >= minDuration) {
                // Long enough, just play once
                audio.addEventListener('ended', onComplete);
                audio.addEventListener('error', onComplete);
                audio.play().catch(function() {
                    _log.info('AudioManager', 'SFX playback failed');
                    onComplete();
                });
            } else {
                // Short sound - calculate repeats needed
                var repeatInterval = durationMs + gapBetweenRepeats;
                var repeatsNeeded = Math.ceil(minDuration / repeatInterval);
                var totalTime = repeatsNeeded * repeatInterval;

                // Play first instance
                audio.play().catch(function() {
                    _log.info('AudioManager', 'SFX playback failed');
                    onComplete();
                });

                // Schedule additional plays
                for (var i = 1; i < repeatsNeeded; i++) {
                    (function(delay) {
                        setTimeout(function() {
                            var repeatAudio = new Audio(path);
                            repeatAudio.play().catch(function() {});
                        }, delay);
                    })(i * repeatInterval);
                }

                // Call callback after total duration
                setTimeout(onComplete, totalTime);
            }
        });

        // Handle case where metadata fails to load
        audio.addEventListener('error', function() {
            _log.warn('AudioManager', 'SFX load failed:', filename);
            onComplete();
        });

        // Trigger load
        audio.load();
    }

    /**
     * Toggle mute state
     */
    function toggleMute() {
        state.muted = !state.muted;

        if (elements.bgMusic) {
            elements.bgMusic.muted = state.muted;
        }

        // Update mute button appearance and accessibility
        if (elements.muteBtn) {
            updateMuteButtonIcon(state.muted);
            elements.muteBtn.title = state.muted ? 'Unmute' : 'Mute';
            elements.muteBtn.setAttribute('aria-pressed', state.muted ? 'true' : 'false');
            elements.muteBtn.setAttribute('aria-label', state.muted ? 'Unmute audio' : 'Mute audio');
        }
    }

    /**
     * Update mute button icon
     * @param {boolean} muted - Current mute state
     */
    function updateMuteButtonIcon(muted) {
        if (!elements.muteBtn) return;
        var soundOn = elements.muteBtn.querySelector('.sound-on');
        var soundOff = elements.muteBtn.querySelector('.sound-off');
        if (soundOn) soundOn.style.display = muted ? 'none' : 'block';
        if (soundOff) soundOff.style.display = muted ? 'block' : 'none';
    }

    /**
     * Set volume level
     * @param {number} volume - Volume 0-1
     */
    function setVolume(volume) {
        state.volume = volume;

        if (elements.bgMusic) {
            elements.bgMusic.volume = volume;
        }

        // Update mute button icon based on volume
        if (elements.muteBtn && !state.muted) {
            updateMuteButtonIcon(volume === 0);
        }
    }

    /**
     * Update volume slider fill visual
     */
    function updateVolumeSliderFill() {
        if (elements.volumeSlider) {
            var percent = elements.volumeSlider.value + '%';
            elements.volumeSlider.style.background = 'linear-gradient(to right, #b08b5a ' + percent + ', #d3c2a8 ' + percent + ')';
        }
    }

    /**
     * Get current mute state
     * @returns {boolean}
     */
    function isMuted() {
        return state.muted;
    }

    /**
     * Get current volume
     * @returns {number}
     */
    function getVolume() {
        return state.volume;
    }

    /**
     * Get currently playing music filename
     * @returns {string|null}
     */
    function getCurrentMusic() {
        return state.currentMusic;
    }

    /**
     * Get full audio state (for saving)
     * @returns {Object}
     */
    function getState() {
        return {
            currentMusic: state.currentMusic,
            muted: state.muted,
            volume: state.volume
        };
    }

    /**
     * Set audio state (for loading)
     * @param {Object} savedState
     */
    function setState(savedState) {
        if (savedState.muted !== undefined) state.muted = savedState.muted;
        if (savedState.volume !== undefined) state.volume = savedState.volume;
        if (savedState.currentMusic !== undefined) state.currentMusic = savedState.currentMusic;

        // Apply state to DOM
        if (elements.bgMusic) {
            elements.bgMusic.muted = state.muted;
            elements.bgMusic.volume = state.volume;
        }
        if (elements.muteBtn) {
            updateMuteButtonIcon(state.muted);
        }
    }

    // === Public API ===
    return {
        init: init,
        setMusic: setMusic,
        tryPlayMusic: tryPlayMusic,
        stopMusic: stopMusic,
        playSfx: playSfx,
        playSfxWithDucking: playSfxWithDucking,
        toggleMute: toggleMute,
        updateMuteButtonIcon: updateMuteButtonIcon,
        setVolume: setVolume,
        updateVolumeSliderFill: updateVolumeSliderFill,
        isMuted: isMuted,
        getVolume: getVolume,
        getCurrentMusic: getCurrentMusic,
        getState: getState,
        setState: setState
    };
})();
