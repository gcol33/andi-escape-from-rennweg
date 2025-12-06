/**
 * Editor Validation Library
 * Shared validation utilities for scene editors
 *
 * Usage:
 *   const validator = new EditorValidator({
 *       getSceneIds: () => Object.keys(scenes)
 *   });
 *
 *   const result = validator.validateScene(scene);
 *   if (!result.valid) {
 *       console.log(result.errors);
 *   }
 */

(function(global) {
'use strict';

const Config = global.EditorConfig;

class EditorValidator {
    /**
     * @param {Object} options
     * @param {Function} options.getSceneIds - Returns array of all scene IDs
     */
    constructor(options = {}) {
        this.getSceneIds = options.getSceneIds || (() => []);
        this.specialTargets = Config?.specialTargets || ['_roll'];
    }

    /**
     * Validate a scene ID format
     * @param {string} id - Scene ID to validate
     * @returns {Object} { valid: boolean, error?: string }
     */
    validateSceneId(id) {
        if (!id || typeof id !== 'string') {
            return { valid: false, error: 'Scene ID is required' };
        }

        if (id.trim() !== id) {
            return { valid: false, error: 'Scene ID cannot have leading/trailing whitespace' };
        }

        if (id.includes(' ')) {
            return { valid: false, error: 'Scene ID cannot contain spaces (use underscores)' };
        }

        if (!/^[a-z][a-z0-9_]*$/.test(id)) {
            return { valid: false, error: 'Scene ID must start with lowercase letter and contain only lowercase letters, numbers, and underscores' };
        }

        if (id.length < 2) {
            return { valid: false, error: 'Scene ID must be at least 2 characters' };
        }

        if (id.length > 64) {
            return { valid: false, error: 'Scene ID must be 64 characters or less' };
        }

        return { valid: true };
    }

    /**
     * Check if a scene ID already exists
     * @param {string} id - Scene ID to check
     * @param {string} excludeId - ID to exclude from check (for renaming)
     * @returns {boolean}
     */
    sceneIdExists(id, excludeId = null) {
        const ids = this.getSceneIds();
        return ids.some(existingId => existingId === id && existingId !== excludeId);
    }

    /**
     * Validate a target scene reference
     * @param {string} target - Target scene ID
     * @param {boolean} allowMissing - Allow references to non-existent scenes
     * @returns {Object} { valid: boolean, error?: string, warning?: string }
     */
    validateTarget(target, allowMissing = true) {
        if (!target || typeof target !== 'string') {
            return { valid: false, error: 'Target scene is required' };
        }

        const trimmed = target.trim();
        if (trimmed !== target) {
            return { valid: false, error: 'Target cannot have leading/trailing whitespace' };
        }

        // Check if it's a special target
        if (this.specialTargets.includes(target)) {
            return { valid: true };
        }

        // Check if target exists
        const exists = this.getSceneIds().includes(target);
        if (!exists && !allowMissing) {
            return { valid: false, error: `Target scene "${target}" does not exist` };
        }

        if (!exists) {
            return { valid: true, warning: `Target scene "${target}" does not exist yet` };
        }

        return { valid: true };
    }

    /**
     * Validate a flag name
     * @param {string} flag - Flag name to validate
     * @returns {Object} { valid: boolean, error?: string }
     */
    validateFlagName(flag) {
        if (!flag || typeof flag !== 'string') {
            return { valid: false, error: 'Flag name is required' };
        }

        if (flag.trim() !== flag) {
            return { valid: false, error: 'Flag name cannot have leading/trailing whitespace' };
        }

        if (!/^[a-z][a-z0-9_]*$/.test(flag)) {
            return { valid: false, error: 'Flag name must start with lowercase letter and contain only lowercase letters, numbers, and underscores' };
        }

        return { valid: true };
    }

    /**
     * Validate a choice object
     * @param {Object} choice - Choice to validate
     * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
     */
    validateChoice(choice) {
        const errors = [];
        const warnings = [];

        if (!choice) {
            return { valid: false, errors: ['Choice is required'], warnings: [] };
        }

        // Label validation
        if (!choice.label || typeof choice.label !== 'string' || !choice.label.trim()) {
            errors.push('Choice label is required');
        }

        // Target validation
        const targetResult = this.validateTarget(choice.target, true);
        if (!targetResult.valid) {
            errors.push(targetResult.error);
        } else if (targetResult.warning) {
            warnings.push(targetResult.warning);
        }

        // Flags validation
        if (choice.require_flags) {
            choice.require_flags.forEach((flag, i) => {
                const result = this.validateFlagName(flag);
                if (!result.valid) {
                    errors.push(`Require flag ${i + 1}: ${result.error}`);
                }
            });
        }

        if (choice.set_flags) {
            choice.set_flags.forEach((flag, i) => {
                const result = this.validateFlagName(flag);
                if (!result.valid) {
                    errors.push(`Set flag ${i + 1}: ${result.error}`);
                }
            });
        }

        return { valid: errors.length === 0, errors, warnings };
    }

    /**
     * Validate a dice roll action
     * @param {Object} action - Dice roll action to validate
     * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
     */
    validateDiceRollAction(action) {
        const errors = [];
        const warnings = [];

        if (!action) {
            return { valid: false, errors: ['Action is required'], warnings: [] };
        }

        // Dice type
        const validDice = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
        if (!action.dice || !validDice.includes(action.dice)) {
            errors.push('Valid dice type is required (d4, d6, d8, d10, d12, d20, d100)');
        }

        // Threshold
        if (typeof action.threshold !== 'number' || action.threshold < 1) {
            errors.push('Threshold must be a positive number');
        } else {
            const maxThreshold = Config?.dice?.maxThreshold || 100;
            if (action.threshold > maxThreshold) {
                errors.push(`Threshold cannot exceed ${maxThreshold}`);
            }
        }

        // Success target
        const successResult = this.validateTarget(action.success_target, true);
        if (!successResult.valid) {
            errors.push(`Success target: ${successResult.error}`);
        } else if (successResult.warning) {
            warnings.push(`Success target: ${successResult.warning}`);
        }

        // Failure target
        const failureResult = this.validateTarget(action.failure_target, true);
        if (!failureResult.valid) {
            errors.push(`Failure target: ${failureResult.error}`);
        } else if (failureResult.warning) {
            warnings.push(`Failure target: ${failureResult.warning}`);
        }

        // Modifier
        if (action.modifier && !['advantage', 'disadvantage'].includes(action.modifier)) {
            errors.push('Modifier must be "advantage" or "disadvantage"');
        }

        return { valid: errors.length === 0, errors, warnings };
    }

    /**
     * Validate a battle action
     * @param {Object} action - Battle action to validate
     * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
     */
    validateBattleAction(action) {
        const errors = [];
        const warnings = [];

        if (!action) {
            return { valid: false, errors: ['Action is required'], warnings: [] };
        }

        // Enemy identification (either enemy_id or enemy_name required)
        if (!action.enemy_id && !action.enemy_name) {
            errors.push('Either enemy_id or enemy_name is required');
        }

        // Victory target
        const victoryResult = this.validateTarget(action.victory_target, true);
        if (!victoryResult.valid) {
            errors.push(`Victory target: ${victoryResult.error}`);
        } else if (victoryResult.warning) {
            warnings.push(`Victory target: ${victoryResult.warning}`);
        }

        // Defeat target
        const defeatResult = this.validateTarget(action.defeat_target, true);
        if (!defeatResult.valid) {
            errors.push(`Defeat target: ${defeatResult.error}`);
        } else if (defeatResult.warning) {
            warnings.push(`Defeat target: ${defeatResult.warning}`);
        }

        // Flee target (optional)
        if (action.flee_target) {
            const fleeResult = this.validateTarget(action.flee_target, true);
            if (!fleeResult.valid) {
                errors.push(`Flee target: ${fleeResult.error}`);
            } else if (fleeResult.warning) {
                warnings.push(`Flee target: ${fleeResult.warning}`);
            }
        }

        // Numeric validations for inline enemy
        if (!action.enemy_id) {
            if (action.enemy_hp !== undefined && (typeof action.enemy_hp !== 'number' || action.enemy_hp < 1)) {
                errors.push('Enemy HP must be a positive number');
            }
        }

        return { valid: errors.length === 0, errors, warnings };
    }

    /**
     * Validate a complete scene
     * @param {Object} scene - Scene to validate
     * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
     */
    validateScene(scene) {
        const errors = [];
        const warnings = [];

        if (!scene) {
            return { valid: false, errors: ['Scene is required'], warnings: [] };
        }

        // Scene ID
        const idResult = this.validateSceneId(scene.id);
        if (!idResult.valid) {
            errors.push(`Scene ID: ${idResult.error}`);
        }

        // Text blocks
        if (!scene.textBlocks || !Array.isArray(scene.textBlocks) || scene.textBlocks.length === 0) {
            warnings.push('Scene has no text blocks');
        } else {
            const emptyBlocks = scene.textBlocks.filter(b => !b || !b.trim()).length;
            if (emptyBlocks > 0) {
                warnings.push(`Scene has ${emptyBlocks} empty text block(s)`);
            }
        }

        // Choices
        if (scene.choices && Array.isArray(scene.choices)) {
            scene.choices.forEach((choice, i) => {
                const choiceResult = this.validateChoice(choice);
                if (!choiceResult.valid) {
                    choiceResult.errors.forEach(err => {
                        errors.push(`Choice ${i + 1}: ${err}`);
                    });
                }
                choiceResult.warnings.forEach(warn => {
                    warnings.push(`Choice ${i + 1}: ${warn}`);
                });
            });
        }

        // Actions
        if (scene.actions && Array.isArray(scene.actions)) {
            scene.actions.forEach((action, i) => {
                let actionResult;
                if (action.type === 'roll_dice') {
                    actionResult = this.validateDiceRollAction(action);
                } else if (action.type === 'start_battle') {
                    actionResult = this.validateBattleAction(action);
                } else {
                    actionResult = { valid: true, errors: [], warnings: [`Unknown action type: ${action.type}`] };
                }

                if (!actionResult.valid) {
                    actionResult.errors.forEach(err => {
                        errors.push(`Action ${i + 1}: ${err}`);
                    });
                }
                actionResult.warnings.forEach(warn => {
                    warnings.push(`Action ${i + 1}: ${warn}`);
                });
            });
        }

        // Check for ending scene (no choices + no actions = ending)
        const hasChoices = scene.choices && scene.choices.length > 0;
        const hasActions = scene.actions && scene.actions.length > 0;
        if (!hasChoices && !hasActions) {
            warnings.push('Scene has no choices or actions - this is an ending scene');
        }

        // Flags validation
        if (scene.set_flags) {
            scene.set_flags.forEach((flag, i) => {
                const result = this.validateFlagName(flag);
                if (!result.valid) {
                    errors.push(`Set flag ${i + 1}: ${result.error}`);
                }
            });
        }

        if (scene.require_flags) {
            scene.require_flags.forEach((flag, i) => {
                const result = this.validateFlagName(flag);
                if (!result.valid) {
                    errors.push(`Require flag ${i + 1}: ${result.error}`);
                }
            });
        }

        return { valid: errors.length === 0, errors, warnings };
    }

    /**
     * Find all scenes that reference a given scene ID
     * @param {string} targetId - Scene ID to find references to
     * @param {Object} scenes - All scenes keyed by ID
     * @returns {Array} Array of { sceneId, type, label? }
     */
    findReferences(targetId, scenes) {
        const references = [];

        Object.values(scenes).forEach(scene => {
            // Check choices
            if (scene.choices) {
                scene.choices.forEach(choice => {
                    if (choice.target === targetId) {
                        references.push({
                            sceneId: scene.id,
                            type: 'choice',
                            label: choice.label
                        });
                    }
                });
            }

            // Check actions
            if (scene.actions) {
                scene.actions.forEach(action => {
                    if (action.type === 'roll_dice') {
                        if (action.success_target === targetId) {
                            references.push({
                                sceneId: scene.id,
                                type: 'dice_success'
                            });
                        }
                        if (action.failure_target === targetId) {
                            references.push({
                                sceneId: scene.id,
                                type: 'dice_failure'
                            });
                        }
                    } else if (action.type === 'start_battle') {
                        if (action.victory_target === targetId) {
                            references.push({
                                sceneId: scene.id,
                                type: 'battle_victory'
                            });
                        }
                        if (action.defeat_target === targetId) {
                            references.push({
                                sceneId: scene.id,
                                type: 'battle_defeat'
                            });
                        }
                        if (action.flee_target === targetId) {
                            references.push({
                                sceneId: scene.id,
                                type: 'battle_flee'
                            });
                        }
                    }
                });
            }
        });

        return references;
    }

    /**
     * Find all orphaned scenes (no incoming references)
     * @param {Object} scenes - All scenes keyed by ID
     * @param {string} startSceneId - The starting scene ID (not orphaned by definition)
     * @returns {Array} Array of orphaned scene IDs
     */
    findOrphanedScenes(scenes, startSceneId = 'start') {
        const referencedIds = new Set();
        referencedIds.add(startSceneId);

        Object.values(scenes).forEach(scene => {
            // Choices
            if (scene.choices) {
                scene.choices.forEach(choice => {
                    if (choice.target) referencedIds.add(choice.target);
                });
            }

            // Actions
            if (scene.actions) {
                scene.actions.forEach(action => {
                    if (action.success_target) referencedIds.add(action.success_target);
                    if (action.failure_target) referencedIds.add(action.failure_target);
                    if (action.victory_target) referencedIds.add(action.victory_target);
                    if (action.defeat_target) referencedIds.add(action.defeat_target);
                    if (action.flee_target) referencedIds.add(action.flee_target);
                });
            }
        });

        return Object.keys(scenes).filter(id => !referencedIds.has(id));
    }

    /**
     * Find all missing target references
     * @param {Object} scenes - All scenes keyed by ID
     * @returns {Array} Array of { sceneId, target, type }
     */
    findMissingTargets(scenes) {
        const sceneIds = new Set(Object.keys(scenes));
        const missing = [];

        Object.values(scenes).forEach(scene => {
            // Choices
            if (scene.choices) {
                scene.choices.forEach(choice => {
                    if (choice.target && !sceneIds.has(choice.target) && !this.specialTargets.includes(choice.target)) {
                        missing.push({
                            sceneId: scene.id,
                            target: choice.target,
                            type: 'choice'
                        });
                    }
                });
            }

            // Actions
            if (scene.actions) {
                scene.actions.forEach(action => {
                    const targets = [];
                    if (action.success_target) targets.push({ target: action.success_target, type: 'dice_success' });
                    if (action.failure_target) targets.push({ target: action.failure_target, type: 'dice_failure' });
                    if (action.victory_target) targets.push({ target: action.victory_target, type: 'battle_victory' });
                    if (action.defeat_target) targets.push({ target: action.defeat_target, type: 'battle_defeat' });
                    if (action.flee_target) targets.push({ target: action.flee_target, type: 'battle_flee' });

                    targets.forEach(t => {
                        if (!sceneIds.has(t.target) && !this.specialTargets.includes(t.target)) {
                            missing.push({
                                sceneId: scene.id,
                                target: t.target,
                                type: t.type
                            });
                        }
                    });
                });
            }
        });

        return missing;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EditorValidator;
} else {
    global.EditorValidator = EditorValidator;
}

})(typeof window !== 'undefined' ? window : global);
