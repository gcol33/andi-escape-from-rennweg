/**
 * Andi VN - Error Types
 * @module core/errors
 *
 * Custom error classes for better error handling and debugging.
 *
 * Usage:
 *   throw new SceneNotFoundError('scene_id');
 */

(function() {
'use strict';

/**
 * Base error class for engine errors
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {Object} [details] - Additional error details
 */
function EngineError(message, code, details) {
    Error.call(this, message);
    this.name = 'EngineError';
    this.message = message;
    this.code = code;
    this.details = details || {};
    this.timestamp = new Date().toISOString();

    // Capture stack trace
    if (Error.captureStackTrace) {
        Error.captureStackTrace(this, EngineError);
    }
}
EngineError.prototype = Object.create(Error.prototype);
EngineError.prototype.constructor = EngineError;

/**
 * Get a user-friendly message
 * @returns {string}
 */
EngineError.prototype.getUserMessage = function() {
    return this.message;
};

/**
 * Convert to JSON for logging
 * @returns {Object}
 */
EngineError.prototype.toJSON = function() {
    return {
        name: this.name,
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp
    };
};

/**
 * Scene not found error
 * @param {string} sceneId - The missing scene ID
 */
function SceneNotFoundError(sceneId) {
    EngineError.call(
        this,
        'Scene "' + sceneId + '" not found',
        'SCENE_NOT_FOUND',
        { sceneId: sceneId }
    );
    this.name = 'SceneNotFoundError';
}
SceneNotFoundError.prototype = Object.create(EngineError.prototype);
SceneNotFoundError.prototype.constructor = SceneNotFoundError;

SceneNotFoundError.prototype.getUserMessage = function() {
    return 'The requested scene could not be found. This may be a bug in the story data.';
};

/**
 * Invalid choice error
 * @param {number} index - The invalid choice index
 * @param {number} availableCount - Number of available choices
 */
function InvalidChoiceError(index, availableCount) {
    EngineError.call(
        this,
        'Invalid choice index: ' + index + ' (available: ' + availableCount + ')',
        'INVALID_CHOICE',
        { index: index, availableCount: availableCount }
    );
    this.name = 'InvalidChoiceError';
}
InvalidChoiceError.prototype = Object.create(EngineError.prototype);
InvalidChoiceError.prototype.constructor = InvalidChoiceError;

InvalidChoiceError.prototype.getUserMessage = function() {
    return 'That choice is not available.';
};

/**
 * Validation error for invalid data
 * @param {string} field - Field that failed validation
 * @param {*} value - The invalid value
 * @param {string} expected - What was expected
 */
function ValidationError(field, value, expected) {
    EngineError.call(
        this,
        'Invalid ' + field + ': expected ' + expected,
        'VALIDATION_ERROR',
        { field: field, value: value, expected: expected }
    );
    this.name = 'ValidationError';
}
ValidationError.prototype = Object.create(EngineError.prototype);
ValidationError.prototype.constructor = ValidationError;

ValidationError.prototype.getUserMessage = function() {
    return 'Invalid data encountered: ' + this.details.field;
};

/**
 * Battle error
 * @param {string} message - Error message
 * @param {Object} [details] - Additional details
 */
function BattleError(message, details) {
    EngineError.call(this, message, 'BATTLE_ERROR', details);
    this.name = 'BattleError';
}
BattleError.prototype = Object.create(EngineError.prototype);
BattleError.prototype.constructor = BattleError;

BattleError.prototype.getUserMessage = function() {
    return 'A battle error occurred. Please try again.';
};

/**
 * QTE error
 * @param {string} message - Error message
 * @param {Object} [details] - Additional details
 */
function QTEError(message, details) {
    EngineError.call(this, message, 'QTE_ERROR', details);
    this.name = 'QTEError';
}
QTEError.prototype = Object.create(EngineError.prototype);
QTEError.prototype.constructor = QTEError;

QTEError.prototype.getUserMessage = function() {
    return 'A timing error occurred.';
};

/**
 * Audio error
 * @param {string} message - Error message
 * @param {Object} [details] - Additional details
 */
function AudioError(message, details) {
    EngineError.call(this, message, 'AUDIO_ERROR', details);
    this.name = 'AudioError';
}
AudioError.prototype = Object.create(EngineError.prototype);
AudioError.prototype.constructor = AudioError;

AudioError.prototype.getUserMessage = function() {
    return 'Audio playback failed. This is often due to browser autoplay restrictions.';
};

/**
 * Save/Load error
 * @param {string} operation - 'save' or 'load'
 * @param {string} message - Error message
 * @param {Object} [details] - Additional details
 */
function SaveError(operation, message, details) {
    var fullDetails = details || {};
    fullDetails.operation = operation;
    EngineError.call(
        this,
        (operation === 'save' ? 'Save' : 'Load') + ' failed: ' + message,
        operation === 'save' ? 'SAVE_ERROR' : 'LOAD_ERROR',
        fullDetails
    );
    this.name = 'SaveError';
}
SaveError.prototype = Object.create(EngineError.prototype);
SaveError.prototype.constructor = SaveError;

SaveError.prototype.getUserMessage = function() {
    var operation = this.details.operation;
    if (operation === 'save') {
        return 'Failed to save game. Your browser may have storage disabled.';
    }
    return 'Failed to load save. The save file may be corrupted.';
};

/**
 * Asset loading error
 * @param {string} assetType - Type of asset (image, audio, etc.)
 * @param {string} path - Asset path
 * @param {Error} [originalError] - Original error
 */
function AssetError(assetType, path, originalError) {
    EngineError.call(
        this,
        'Failed to load ' + assetType + ': ' + path,
        'ASSET_ERROR',
        { assetType: assetType, path: path, originalError: originalError ? originalError.message : null }
    );
    this.name = 'AssetError';
}
AssetError.prototype = Object.create(EngineError.prototype);
AssetError.prototype.constructor = AssetError;

AssetError.prototype.getUserMessage = function() {
    return 'Failed to load ' + this.details.assetType + '. Please check your connection.';
};

/**
 * Check if an error is an engine error
 * @param {Error} error
 * @returns {boolean}
 */
function isEngineError(error) {
    return error instanceof EngineError;
}

/**
 * Get user-friendly message from any error
 * @param {Error} error
 * @returns {string}
 */
function getUserMessage(error) {
    if (error instanceof EngineError) {
        return error.getUserMessage();
    }
    return 'An unexpected error occurred. Please try again.';
}

// Global exports
window.EngineError = EngineError;
window.SceneNotFoundError = SceneNotFoundError;
window.InvalidChoiceError = InvalidChoiceError;
window.ValidationError = ValidationError;
window.BattleError = BattleError;
window.QTEError = QTEError;
window.AudioError = AudioError;
window.SaveError = SaveError;
window.AssetError = AssetError;
window.isEngineError = isEngineError;
window.getUserMessage = getUserMessage;

})();
