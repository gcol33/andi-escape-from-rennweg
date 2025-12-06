/**
 * Editor Utilities
 * Shared utility classes for editor components
 */

(function(global) {
'use strict';

const Config = global.EditorConfig;

// ============================================
// AutocompleteHelper - Scene ID autocomplete
// ============================================

class AutocompleteHelper {
    /**
     * @param {Object} options
     * @param {Function} options.getSceneIds - Returns array of valid scene IDs
     * @param {Function} options.getCurrentSceneId - Returns current scene ID to exclude
     * @param {Function} options.onSelect - Callback when item is selected
     * @param {number} options.delay - Delay before hiding dropdown (ms)
     * @param {number} options.maxItems - Max autocomplete items to show
     */
    constructor(options = {}) {
        this.getSceneIds = options.getSceneIds || (() => []);
        this.getCurrentSceneId = options.getCurrentSceneId || (() => null);
        this.onSelect = options.onSelect || (() => {});
        this.delay = options.delay || Config?.ui?.autocompleteDelay || 150;
        this.maxItems = options.maxItems || Config?.ui?.maxAutocompleteItems || 10;

        this.activeDropdown = null;
        this.boundInputs = new WeakSet();
    }

    /**
     * Set up autocomplete on an input element
     * @param {HTMLInputElement} input - Input element to attach autocomplete to
     */
    attach(input) {
        if (this.boundInputs.has(input)) return;

        const showHandler = () => this.show(input);
        const hideHandler = () => {
            setTimeout(() => this.hide(), this.delay);
        };

        input.addEventListener('focus', showHandler);
        input.addEventListener('input', showHandler);
        input.addEventListener('blur', hideHandler);

        // Store handlers for potential cleanup
        input._autocompleteHandlers = { showHandler, hideHandler };
        this.boundInputs.add(input);
    }

    /**
     * Remove autocomplete from an input element
     * @param {HTMLInputElement} input - Input element to detach from
     */
    detach(input) {
        if (!this.boundInputs.has(input)) return;

        const handlers = input._autocompleteHandlers;
        if (handlers) {
            input.removeEventListener('focus', handlers.showHandler);
            input.removeEventListener('input', handlers.showHandler);
            input.removeEventListener('blur', handlers.hideHandler);
            delete input._autocompleteHandlers;
        }

        this.boundInputs.delete(input);
    }

    /**
     * Show autocomplete dropdown for an input
     * @param {HTMLInputElement} input - Input element
     */
    show(input) {
        this.hide();

        const value = input.value.toLowerCase();
        const currentId = this.getCurrentSceneId();
        const matches = this.getSceneIds()
            .filter(id => id.toLowerCase().includes(value) && id !== currentId)
            .slice(0, this.maxItems);

        if (matches.length === 0) return;

        const dropdown = document.createElement('div');
        dropdown.className = 'autocomplete-dropdown';

        matches.forEach(id => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.textContent = id;
            item.addEventListener('mousedown', () => {
                input.value = id;
                this.onSelect(id, input);
                this.hide();
            });
            dropdown.appendChild(item);
        });

        const rect = input.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.top = rect.bottom + 'px';
        dropdown.style.left = rect.left + 'px';
        dropdown.style.width = rect.width + 'px';
        dropdown.style.zIndex = '10000';

        document.body.appendChild(dropdown);
        this.activeDropdown = dropdown;
    }

    /**
     * Hide autocomplete dropdown
     */
    hide() {
        if (this.activeDropdown) {
            this.activeDropdown.remove();
            this.activeDropdown = null;
        }
    }

    /**
     * Destroy the helper and clean up
     */
    destroy() {
        this.hide();
    }
}

// ============================================
// TagManager - Flag and item tag management
// ============================================

class TagManager {
    /**
     * @param {Object} options
     * @param {Function} options.onModified - Callback when tags are modified
     * @param {string} options.tagClass - CSS class for tags (default: 'flag-tag')
     */
    constructor(options = {}) {
        this.onModified = options.onModified || (() => {});
        this.tagClass = options.tagClass || 'flag-tag';
    }

    /**
     * Add a tag to a container
     * @param {HTMLElement} container - Container element
     * @param {string} value - Tag value/text
     * @param {string} extraClass - Optional extra CSS class
     */
    addTag(container, value, extraClass = '') {
        const tag = document.createElement('span');
        tag.className = this.tagClass + (extraClass ? ' ' + extraClass : '');

        // Create text node for the value (so it's separate from button)
        const textNode = document.createTextNode(value);
        tag.appendChild(textNode);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'tag-remove-btn';
        removeBtn.textContent = '×';
        removeBtn.type = 'button';
        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            tag.remove();
            this.onModified();
        });

        tag.appendChild(removeBtn);
        container.appendChild(tag);
    }

    /**
     * Render tags from an array of values
     * @param {HTMLElement} container - Container element
     * @param {string[]} values - Array of tag values
     * @param {string} extraClass - Optional extra CSS class for all tags
     */
    renderTags(container, values, extraClass = '') {
        container.innerHTML = '';
        (values || []).forEach(value => {
            this.addTag(container, value, extraClass);
        });
    }

    /**
     * Get all tag values from a container
     * @param {HTMLElement} container - Container element
     * @returns {string[]} Array of tag values
     */
    getValues(container) {
        const tags = container.querySelectorAll('.' + this.tagClass);
        return Array.from(tags).map(tag => {
            // Get the text content, excluding the remove button
            const clone = tag.cloneNode(true);
            const btn = clone.querySelector('.tag-remove-btn');
            if (btn) btn.remove();
            return clone.textContent.trim();
        });
    }

    /**
     * Set up an input field to add tags on Enter
     * @param {HTMLInputElement} input - Input element
     * @param {HTMLElement} container - Container for tags
     * @param {HTMLButtonElement} addBtn - Optional add button
     * @param {string} extraClass - Optional extra CSS class for tags
     */
    setupInput(input, container, addBtn = null, extraClass = '') {
        const addTag = () => {
            const value = input.value.trim();
            if (!value) return;

            this.addTag(container, value, extraClass);
            input.value = '';
            this.onModified();
        };

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
            }
        });

        if (addBtn) {
            addBtn.addEventListener('click', (e) => {
                e.preventDefault();
                addTag();
            });
        }
    }
}

// ============================================
// InputFactory - Common input element creation
// ============================================

class InputFactory {
    /**
     * Create a labeled input group
     * @param {string} labelText - Label text
     * @param {string} inputType - Input type (text, number, etc.)
     * @param {string} className - CSS class for input
     * @param {Object} options - Input options (value, placeholder, min, max)
     * @param {Function} onChange - Change handler
     * @returns {HTMLElement} Label element containing input
     */
    static createInput(labelText, inputType, className, options = {}, onChange = null) {
        const group = document.createElement('label');
        group.textContent = labelText;

        const input = document.createElement('input');
        input.type = inputType;
        input.className = className;

        if (options.value !== undefined) input.value = options.value;
        if (options.placeholder) input.placeholder = options.placeholder;
        if (options.min !== undefined) input.min = options.min;
        if (options.max !== undefined) input.max = options.max;
        if (options.required) input.required = true;
        if (options.readonly) input.readOnly = true;

        if (onChange) {
            input.addEventListener('input', onChange);
            input.addEventListener('change', onChange);
        }

        group.appendChild(input);
        return group;
    }

    /**
     * Create a labeled select group
     * @param {string} labelText - Label text
     * @param {string} className - CSS class for select
     * @param {Array} options - Array of {value, text} or strings
     * @param {string} selectedValue - Currently selected value
     * @param {Function} onChange - Change handler
     * @returns {HTMLElement} Label element containing select
     */
    static createSelect(labelText, className, options, selectedValue = '', onChange = null) {
        const group = document.createElement('label');
        group.textContent = labelText;

        const select = document.createElement('select');
        select.className = className;

        options.forEach(opt => {
            const option = document.createElement('option');
            if (typeof opt === 'string') {
                option.value = opt;
                option.textContent = opt;
            } else {
                option.value = opt.value;
                option.textContent = opt.text;
            }
            select.appendChild(option);
        });

        select.value = selectedValue;

        if (onChange) {
            select.addEventListener('change', onChange);
        }

        group.appendChild(select);
        return group;
    }

    /**
     * Create a header with delete button
     * @param {string} title - Header title
     * @param {Function} onDelete - Delete callback
     * @param {string} className - CSS class for header
     * @returns {HTMLElement} Header element
     */
    static createHeader(title, onDelete, className = 'item-header') {
        const header = document.createElement('div');
        header.className = className;

        const label = document.createElement('span');
        label.textContent = title;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-icon';
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Delete';
        deleteBtn.type = 'button';
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            onDelete();
        });

        header.appendChild(label);
        header.appendChild(deleteBtn);
        return header;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AutocompleteHelper, TagManager, InputFactory };
} else {
    global.AutocompleteHelper = AutocompleteHelper;
    global.TagManager = TagManager;
    global.InputFactory = InputFactory;
}

})(typeof window !== 'undefined' ? window : global);
