/**
 * Password Protection Module
 *
 * Shows a 6-character password input overlay before the game starts.
 * Auto-checks when all fields are filled. No submit button needed.
 */

const PasswordScreen = (function() {
    'use strict';

    // === Configuration ===
    const config = {
        // Change this value to update the password (case-insensitive)
        password: 'STRAHD',
        // Validation settings
        maxLength: 1,                        // Max chars per input field
        allowedChars: /^[A-Za-z0-9]$/,       // Only alphanumeric allowed
        // Lockout settings
        maxAttempts: 3,
        lockoutDuration: 5000,  // 5 seconds
        // Animation timing (milliseconds)
        timing: {
            focusDelay: 100,      // Delay before focusing first input
            overlayFade: 500,     // Overlay fade out duration
            errorShake: 500,      // Error shake animation duration
            countdownInterval: 1000  // Countdown update interval
        },
        // Funny lockout messages (use {s} as placeholder for seconds)
        lockoutMessages: [
            "Whoa there! Take a breather... {s}s 🧘",
            "Nice try, but no. Cool down for {s} seconds!",
            "Error 418: I'm a teapot. Wait {s} seconds.",
            "Password machine broke. Try again in {s}s.",
            "Andi says: 'Not today!' Wait {s} seconds..."
        ]
    };

    /**
     * Validate and sanitize input value
     * @param {string} value - Raw input value
     * @returns {string} Validated value (empty string if invalid)
     */
    function validateInput(value) {
        if (!value) return '';

        // Only keep the first character
        const char = value.charAt(0);

        // Check if alphanumeric
        if (!config.allowedChars.test(char)) {
            return '';
        }

        // Convert to uppercase for consistency
        return char.toUpperCase();
    }

    // Track if password has been validated
    let isValidated = false;

    // Track if handlers are already set up (prevent duplicate listeners)
    let handlersSetup = false;

    // Callback to run when password is correct
    let onSuccessCallback = null;

    // Lockout tracking
    let failedAttempts = 0;
    let isLockedOut = false;

    // Store event handler references for cleanup
    const eventHandlers = {
        inputs: [],      // Array of { element, type, handler } for cleanup
        countdownTimeoutId: null  // Track lockout countdown timeout for cancellation
    };

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
        }, config.timing.focusDelay);
    }

    /**
     * Add an event listener and track it for cleanup
     */
    function addTrackedListener(element, type, handler, options) {
        element.addEventListener(type, handler, options);
        eventHandlers.inputs.push({ element: element, type: type, handler: handler, options: options });
    }

    /**
     * Set up event handlers for all password input fields
     */
    function setupInputHandlers(inputs) {
        // Prevent duplicate handler setup
        if (handlersSetup) return;
        handlersSetup = true;

        inputs.forEach(function(input, index) {
            // Handle text input with validation
            const inputHandler = function(e) {
                // Validate and sanitize the input
                const validated = validateInput(this.value);

                // Update input value if validation changed it
                if (validated !== this.value) {
                    this.value = validated;
                }

                // Update filled state
                if (validated) {
                    this.classList.add('filled');
                } else {
                    this.classList.remove('filled');
                }

                // Auto-advance to next field if valid character entered
                if (validated && index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }

                // Check if all fields are filled
                checkPassword(inputs);
            };
            addTrackedListener(input, 'input', inputHandler);

            // Handle keydown for backspace and navigation
            const keydownHandler = function(e) {
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
            };
            addTrackedListener(input, 'keydown', keydownHandler);

            // Select all text on focus for easy replacement
            const focusHandler = function() {
                this.select();
            };
            addTrackedListener(input, 'focus', focusHandler);

            // Prevent paste of multi-character strings breaking the UI
            const pasteHandler = function(e) {
                e.preventDefault();
                const pastedText = (e.clipboardData || window.clipboardData).getData('text');

                // Distribute pasted characters across fields with validation
                let validCharsAdded = 0;
                for (let i = 0; i < pastedText.length && index + validCharsAdded < inputs.length; i++) {
                    const validated = validateInput(pastedText[i]);
                    if (validated) {
                        inputs[index + validCharsAdded].value = validated;
                        inputs[index + validCharsAdded].classList.add('filled');
                        validCharsAdded++;
                    }
                }

                // Focus the next empty field or last field
                const nextEmptyIndex = Math.min(index + validCharsAdded, inputs.length - 1);
                inputs[nextEmptyIndex].focus();

                // Check password after paste
                checkPassword(inputs);
            };
            addTrackedListener(input, 'paste', pasteHandler);
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
        if (enteredPassword.toUpperCase() === config.password) {
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

        // Clean up event listeners to prevent memory leaks
        cleanup();

        const overlay = document.getElementById('password-overlay');
        if (overlay) {
            // Fade out the overlay
            overlay.classList.add('hidden');

            // Wait for fade transition to complete before starting game
            // This prevents visual flash during transition
            setTimeout(function() {
                overlay.remove();
                // Execute success callback to start the game AFTER overlay is gone
                if (onSuccessCallback) {
                    onSuccessCallback();
                }
            }, config.timing.overlayFade);
        } else {
            // No overlay, start immediately
            if (onSuccessCallback) {
                onSuccessCallback();
            }
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
            if (failedAttempts >= config.maxAttempts) {
                triggerLockout(inputs);
            } else {
                // Focus first input
                inputs[0].focus();
            }
        }, config.timing.errorShake);
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
        const messageTemplate = Utils.pickRandom(config.lockoutMessages);
        const totalSeconds = Math.ceil(config.lockoutDuration / 1000);
        let secondsRemaining = totalSeconds;

        // Update countdown function with tracked timeout
        function updateCountdown() {
            if (secondsRemaining > 0) {
                showLockoutMessage(messageTemplate.replace('{s}', secondsRemaining));
                secondsRemaining--;
                // Track the timeout ID so it can be cancelled on cleanup
                eventHandlers.countdownTimeoutId = setTimeout(updateCountdown, config.timing.countdownInterval);
            } else {
                // Re-enable inputs
                isLockedOut = false;
                failedAttempts = 0;
                eventHandlers.countdownTimeoutId = null;

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
            // Styles defined in shared.css
            document.getElementById('password-container').appendChild(msgElement);
        }

        msgElement.textContent = message;
        msgElement.classList.add('visible');

        // Hide the inputs visually
        document.getElementById('password-inputs').classList.add('dimmed');
    }

    /**
     * Hide lockout message
     */
    function hideLockoutMessage() {
        const msgElement = document.getElementById('lockout-message');
        if (msgElement) {
            msgElement.classList.remove('visible');
        }

        // Restore inputs visibility
        document.getElementById('password-inputs').classList.remove('dimmed');
    }

    /**
     * Check if password has been validated
     */
    function isPasswordValidated() {
        return isValidated;
    }

    /**
     * Clean up all event listeners (for page unload or reset)
     * This prevents memory leaks if the password screen is dynamically recreated
     */
    function cleanup() {
        // Clear lockout countdown timeout if active
        if (eventHandlers.countdownTimeoutId) {
            clearTimeout(eventHandlers.countdownTimeoutId);
            eventHandlers.countdownTimeoutId = null;
        }

        // Remove all tracked event listeners
        for (let i = 0; i < eventHandlers.inputs.length; i++) {
            const entry = eventHandlers.inputs[i];
            entry.element.removeEventListener(entry.type, entry.handler, entry.options);
        }
        eventHandlers.inputs = [];

        // Reset state for potential re-initialization
        handlersSetup = false;
        isLockedOut = false;
        failedAttempts = 0;
    }

    // === Public API ===
    return {
        init: init,
        isValidated: isPasswordValidated,
        cleanup: cleanup  // For memory leak prevention if needed
    };

})();
