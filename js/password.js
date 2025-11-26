/**
 * Password Protection Module
 *
 * Shows a 6-character password input overlay before the game starts.
 * Auto-checks when all fields are filled. No submit button needed.
 */

const PasswordScreen = (function() {
    'use strict';

    // === Configuration ===
    // Change this value to update the password (case-insensitive)
    const CORRECT_PASSWORD = 'STRAHD';

    // Track if password has been validated
    let isValidated = false;

    // Callback to run when password is correct
    let onSuccessCallback = null;

    /**
     * Initialize the password screen
     * @param {Function} onSuccess - Callback to execute when password is correct
     */
    function init(onSuccess) {
        onSuccessCallback = onSuccess;

        const inputs = document.querySelectorAll('.password-char');
        if (inputs.length === 0) {
            // No password inputs found, skip password screen
            if (onSuccessCallback) onSuccessCallback();
            return;
        }

        setupInputHandlers(inputs);

        // Focus first input on load
        setTimeout(function() {
            inputs[0].focus();
        }, 100);
    }

    /**
     * Set up event handlers for all password input fields
     */
    function setupInputHandlers(inputs) {
        inputs.forEach(function(input, index) {
            // Handle text input
            input.addEventListener('input', function(e) {
                const value = this.value;

                // Update filled state
                if (value) {
                    this.classList.add('filled');
                } else {
                    this.classList.remove('filled');
                }

                // Auto-advance to next field if character entered
                if (value && index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }

                // Check if all fields are filled
                checkPassword(inputs);
            });

            // Handle keydown for backspace and navigation
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Backspace') {
                    if (!this.value && index > 0) {
                        // Field is empty, go back to previous field
                        e.preventDefault();
                        inputs[index - 1].value = '';
                        inputs[index - 1].classList.remove('filled');
                        inputs[index - 1].focus();
                    }
                } else if (e.key === 'ArrowLeft' && index > 0) {
                    inputs[index - 1].focus();
                } else if (e.key === 'ArrowRight' && index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }
            });

            // Select all text on focus for easy replacement
            input.addEventListener('focus', function() {
                this.select();
            });

            // Prevent paste of multi-character strings breaking the UI
            input.addEventListener('paste', function(e) {
                e.preventDefault();
                const pastedText = (e.clipboardData || window.clipboardData).getData('text');

                // Distribute pasted characters across fields
                for (let i = 0; i < pastedText.length && index + i < inputs.length; i++) {
                    inputs[index + i].value = pastedText[i];
                    inputs[index + i].classList.add('filled');
                }

                // Focus the next empty field or last field
                const nextEmptyIndex = Math.min(index + pastedText.length, inputs.length - 1);
                inputs[nextEmptyIndex].focus();

                // Check password after paste
                checkPassword(inputs);
            });
        });
    }

    /**
     * Check if entered password matches the correct password
     */
    function checkPassword(inputs) {
        // Collect all characters
        let enteredPassword = '';
        let allFilled = true;

        inputs.forEach(function(input) {
            if (!input.value) {
                allFilled = false;
            }
            enteredPassword += input.value;
        });

        // Only check when all fields are filled
        if (!allFilled) return;

        // Compare with correct password (case-insensitive)
        if (enteredPassword.toUpperCase() === CORRECT_PASSWORD) {
            handleSuccess();
        } else {
            handleError(inputs);
        }
    }

    /**
     * Handle correct password entry
     */
    function handleSuccess() {
        isValidated = true;

        const overlay = document.getElementById('password-overlay');
        if (overlay) {
            // Fade out the overlay
            overlay.classList.add('hidden');

            // Remove from DOM after transition
            setTimeout(function() {
                overlay.remove();
            }, 500);
        }

        // Execute success callback to start the game
        if (onSuccessCallback) {
            onSuccessCallback();
        }
    }

    /**
     * Handle incorrect password entry
     */
    function handleError(inputs) {
        const inputsContainer = document.getElementById('password-inputs');

        // Add error class for shake animation
        inputsContainer.classList.add('error');

        // Clear all fields after animation
        setTimeout(function() {
            inputsContainer.classList.remove('error');

            inputs.forEach(function(input) {
                input.value = '';
                input.classList.remove('filled');
            });

            // Focus first input
            inputs[0].focus();
        }, 500);
    }

    /**
     * Check if password has been validated
     */
    function isPasswordValidated() {
        return isValidated;
    }

    // === Public API ===
    return {
        init: init,
        isValidated: isPasswordValidated
    };

})();
