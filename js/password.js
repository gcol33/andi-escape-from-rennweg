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

    // Lockout tracking
    let failedAttempts = 0;
    let isLockedOut = false;
    const MAX_ATTEMPTS = 3;
    const LOCKOUT_DURATION = 5000; // 5 seconds

    // Funny lockout messages (use {s} as placeholder for seconds)
    const LOCKOUT_MESSAGES = [
        "Whoa there! Take a breather... {s}s 🧘",
        "Nice try, but no. Cool down for {s} seconds!",
        "Error 418: I'm a teapot. Wait {s} seconds.",
        "Password machine broke. Try again in {s}s.",
        "Andi says: 'Not today!' Wait {s} seconds..."
    ];

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
        // Don't check if locked out
        if (isLockedOut) return;

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

        // Increment failed attempts
        failedAttempts++;

        // Clear all fields after animation
        setTimeout(function() {
            inputsContainer.classList.remove('error');

            inputs.forEach(function(input) {
                input.value = '';
                input.classList.remove('filled');
            });

            // Check if we need to lock out
            if (failedAttempts >= MAX_ATTEMPTS) {
                triggerLockout(inputs);
            } else {
                // Focus first input
                inputs[0].focus();
            }
        }, 500);
    }

    /**
     * Trigger lockout after too many failed attempts
     */
    function triggerLockout(inputs) {
        isLockedOut = true;

        // Disable all inputs
        inputs.forEach(function(input) {
            input.disabled = true;
        });

        // Pick a random message template
        const messageTemplate = LOCKOUT_MESSAGES[Math.floor(Math.random() * LOCKOUT_MESSAGES.length)];
        const totalSeconds = Math.ceil(LOCKOUT_DURATION / 1000);
        let secondsRemaining = totalSeconds;

        // Update countdown function
        function updateCountdown() {
            if (secondsRemaining > 0) {
                showLockoutMessage(messageTemplate.replace('{s}', secondsRemaining));
                secondsRemaining--;
                setTimeout(updateCountdown, 1000);
            } else {
                // Re-enable inputs
                isLockedOut = false;
                failedAttempts = 0;

                inputs.forEach(function(input) {
                    input.disabled = false;
                });

                hideLockoutMessage();
                inputs[0].focus();
            }
        }

        // Start countdown immediately
        updateCountdown();
    }

    /**
     * Show lockout message overlay
     */
    function showLockoutMessage(message) {
        let msgElement = document.getElementById('lockout-message');

        if (!msgElement) {
            msgElement = document.createElement('div');
            msgElement.id = 'lockout-message';
            msgElement.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(75, 62, 42, 0.95); color: #fffbe9; padding: 20px 30px; border-radius: 8px; font-size: 1.2rem; text-align: center; z-index: 10001; animation: fadeIn 0.3s ease-out;';
            document.getElementById('password-container').appendChild(msgElement);
        }

        msgElement.textContent = message;
        msgElement.style.display = 'block';

        // Hide the inputs visually
        document.getElementById('password-inputs').style.opacity = '0.3';
    }

    /**
     * Hide lockout message
     */
    function hideLockoutMessage() {
        const msgElement = document.getElementById('lockout-message');
        if (msgElement) {
            msgElement.style.display = 'none';
        }

        // Restore inputs visibility
        document.getElementById('password-inputs').style.opacity = '1';
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
