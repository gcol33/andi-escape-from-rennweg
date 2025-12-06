/**
 * Canvas Preview Component
 * Shared scene preview with background and sprite positioning
 *
 * Usage:
 *   const preview = new CanvasPreview({
 *       container: document.getElementById('preview-container'),
 *       onModified: () => { ... },  // Called when scene is modified
 *       readOnly: false             // Set true for view-only mode
 *   });
 *
 *   preview.loadScene(scene);
 *   preview.getSceneData();  // Returns { bg, chars }
 */

(function(global) {
'use strict';

const Config = global.EditorConfig;

class CanvasPreview {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container - Container element for the preview
     * @param {Function} options.onModified - Callback when scene is modified
     * @param {boolean} options.readOnly - If true, disable editing (default: false)
     * @param {boolean} options.showTextBox - If true, show text editing box (default: true)
     */
    constructor(options = {}) {
        this.container = options.container;
        this.onModified = options.onModified || (() => {});
        this.readOnly = options.readOnly || false;
        this.showTextBox = options.showTextBox !== false;

        // Get sprite config from EditorConfig or use defaults
        this.spriteConfig = Config?.sprite || {
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
        };

        this.assetPaths = Config?.assetPaths || {
            bg: '../assets/bg/',
            char: '../assets/char/'
        };

        // State
        this.state = {
            draggedSprite: null,
            selectedSprite: null,
            resizingSprite: null,
            initialResizeData: null,
            textBlocks: [''],
            currentTextBlockIndex: 0
        };

        // DOM elements (will be created or found)
        this.elements = {};

        this._init();
    }

    _init() {
        if (!this.container) {
            console.error('CanvasPreview: container element is required');
            return;
        }

        // Create DOM structure
        this._createDOM();

        // Set up event listeners
        if (!this.readOnly) {
            this._setupEventListeners();
        }
    }

    _createDOM() {
        // Clear container
        this.container.innerHTML = '';
        this.container.classList.add('canvas-preview-component');

        // Create preview structure
        const preview = document.createElement('div');
        preview.className = 'canvas-preview';
        preview.id = 'canvas-preview';

        // Background layer
        const bgLayer = document.createElement('div');
        bgLayer.className = 'preview-background';
        bgLayer.id = 'preview-background';
        preview.appendChild(bgLayer);
        this.elements.background = bgLayer;

        // Sprites layer
        const spritesLayer = document.createElement('div');
        spritesLayer.className = 'preview-sprites';
        spritesLayer.id = 'preview-sprites';
        preview.appendChild(spritesLayer);
        this.elements.sprites = spritesLayer;

        // Text box (optional)
        if (this.showTextBox) {
            const textBox = document.createElement('div');
            textBox.className = 'preview-textbox';
            textBox.id = 'preview-textbox';

            // Text navigation
            const textNav = document.createElement('div');
            textNav.className = 'text-nav';
            textNav.id = 'text-nav';

            const prevBtn = document.createElement('button');
            prevBtn.className = 'text-nav-btn';
            prevBtn.id = 'text-prev-btn';
            prevBtn.title = 'Previous block';
            prevBtn.textContent = '←';
            this.elements.textPrevBtn = prevBtn;

            const indicator = document.createElement('span');
            indicator.className = 'text-block-indicator';
            indicator.id = 'text-block-indicator';
            indicator.textContent = 'Block 1 / 1';
            this.elements.textBlockIndicator = indicator;

            const nextBtn = document.createElement('button');
            nextBtn.className = 'text-nav-btn';
            nextBtn.id = 'text-next-btn';
            nextBtn.title = 'Next block';
            nextBtn.textContent = '→';
            this.elements.textNextBtn = nextBtn;

            const addBtn = document.createElement('button');
            addBtn.className = 'text-nav-btn';
            addBtn.id = 'text-add-btn';
            addBtn.title = 'Add new block';
            addBtn.textContent = '+';
            this.elements.textAddBtn = addBtn;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'text-nav-btn';
            deleteBtn.id = 'text-delete-btn';
            deleteBtn.title = 'Delete this block';
            deleteBtn.textContent = '×';
            this.elements.textDeleteBtn = deleteBtn;

            textNav.appendChild(prevBtn);
            textNav.appendChild(indicator);
            textNav.appendChild(nextBtn);
            textNav.appendChild(addBtn);
            textNav.appendChild(deleteBtn);
            textBox.appendChild(textNav);

            // Text area
            const textarea = document.createElement('textarea');
            textarea.id = 'preview-text';
            textarea.placeholder = 'Click here to write your story text...';
            if (this.readOnly) {
                textarea.readOnly = true;
            }
            this.elements.textarea = textarea;
            textBox.appendChild(textarea);

            preview.appendChild(textBox);
            this.elements.textBox = textBox;
        }

        this.container.appendChild(preview);
        this.elements.preview = preview;
    }

    _setupEventListeners() {
        // Sprite layer events
        this.elements.sprites.addEventListener('mousedown', this._onSpriteMouseDown.bind(this));
        document.addEventListener('mousemove', this._onSpriteMouseMove.bind(this));
        document.addEventListener('mouseup', this._onSpriteMouseUp.bind(this));

        // Click to deselect
        this.elements.preview.addEventListener('click', (e) => {
            if (e.target === this.elements.sprites || e.target === this.elements.background) {
                this.deselectSprite();
            }
        });

        // Text block events (if text box is shown)
        if (this.showTextBox) {
            this.elements.textPrevBtn.addEventListener('click', () => this._navigateTextBlock(-1));
            this.elements.textNextBtn.addEventListener('click', () => this._navigateTextBlock(1));
            this.elements.textAddBtn.addEventListener('click', () => this._addTextBlock());
            this.elements.textDeleteBtn.addEventListener('click', () => this._deleteTextBlock());
            this.elements.textarea.addEventListener('input', () => this._onTextInput());
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Delete selected sprite
            if (e.key === 'Delete' && this.state.selectedSprite) {
                this.state.selectedSprite.remove();
                this.state.selectedSprite = null;
                this.onModified();
            }
        });
    }

    // === Sprite Management ===

    addSprite(spriteFile, x, y, scale, autoSelect = true) {
        x = x !== undefined ? x : this.spriteConfig.defaultX;
        y = y !== undefined ? y : this.spriteConfig.defaultY;
        scale = scale !== undefined ? scale : this.spriteConfig.defaultScale;

        const sprite = document.createElement('div');
        sprite.className = 'sprite';
        sprite.dataset.file = spriteFile;
        sprite.dataset.x = x;
        sprite.dataset.y = y;
        sprite.dataset.scale = scale;

        sprite.style.left = x + '%';
        sprite.style.top = y + '%';
        sprite.style.transform = `translate(-50%, -50%) scale(${scale})`;
        sprite.style.transformOrigin = 'center center';

        const img = document.createElement('img');
        img.src = this.assetPaths.char + spriteFile;
        img.alt = spriteFile;
        img.draggable = false;

        if (!this.readOnly) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'sprite-delete-btn';
            deleteBtn.title = 'Remove sprite';
            deleteBtn.innerHTML = '<svg viewBox="0 0 10 10" width="8" height="8"><line x1="1" y1="1" x2="9" y2="9" stroke="white" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                sprite.remove();
                this.onModified();
            });
            sprite.appendChild(deleteBtn);
        }

        sprite.appendChild(img);
        sprite.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectSprite(sprite);
        });

        this.elements.sprites.appendChild(sprite);

        if (autoSelect && !this.readOnly) {
            this.selectSprite(sprite);
            this.onModified();
        }

        return sprite;
    }

    selectSprite(sprite) {
        this.deselectSprite();
        sprite.classList.add('selected');
        this.state.selectedSprite = sprite;
    }

    deselectSprite() {
        if (this.state.selectedSprite) {
            this.state.selectedSprite.classList.remove('selected');
            this.state.selectedSprite = null;
        }
    }

    _onSpriteMouseDown(e) {
        const sprite = e.target.closest('.sprite');
        if (sprite && !e.target.classList.contains('sprite-delete-btn')) {
            this.selectSprite(sprite);
            e.preventDefault();

            if (e.shiftKey) {
                // Shift+drag = resize
                this.state.resizingSprite = sprite;
                this.state.initialResizeData = {
                    startY: e.clientY,
                    startScale: parseFloat(sprite.dataset.scale) || 1
                };
                sprite.classList.add('resizing');
            } else {
                // Normal drag = move
                this.state.draggedSprite = sprite;
                sprite.classList.add('dragging');
            }
        }
    }

    _onSpriteMouseMove(e) {
        if (this.state.draggedSprite) {
            const rect = this.elements.sprites.getBoundingClientRect();
            let x = ((e.clientX - rect.left) / rect.width) * 100;
            let y = ((e.clientY - rect.top) / rect.height) * 100;

            // Clamp to bounds
            x = Math.max(this.spriteConfig.minX, Math.min(this.spriteConfig.maxX, x));
            y = Math.max(this.spriteConfig.minY, Math.min(this.spriteConfig.maxY, y));

            this.state.draggedSprite.style.left = x + '%';
            this.state.draggedSprite.style.top = y + '%';
            this.state.draggedSprite.dataset.x = x;
            this.state.draggedSprite.dataset.y = y;
        }

        if (this.state.resizingSprite && this.state.initialResizeData) {
            const deltaY = this.state.initialResizeData.startY - e.clientY;
            const scaleFactor = deltaY / this.spriteConfig.scaleDragFactor;
            let newScale = this.state.initialResizeData.startScale + scaleFactor;

            // Clamp scale between 0.2 and 3
            newScale = Math.max(0.2, Math.min(3, newScale));

            this.state.resizingSprite.dataset.scale = newScale;
            this.state.resizingSprite.style.transform = `translate(-50%, -50%) scale(${newScale})`;
        }
    }

    _onSpriteMouseUp() {
        if (this.state.draggedSprite) {
            this.state.draggedSprite.classList.remove('dragging');
            this.state.draggedSprite = null;
            this.onModified();
        }

        if (this.state.resizingSprite) {
            this.state.resizingSprite.classList.remove('resizing');
            this.state.resizingSprite = null;
            this.state.initialResizeData = null;
            this.onModified();
        }
    }

    // === Text Block Management ===

    _updateTextBlockDisplay() {
        if (!this.showTextBox) return;

        const total = this.state.textBlocks.length;
        const current = this.state.currentTextBlockIndex + 1;

        this.elements.textBlockIndicator.textContent = `Block ${current} / ${total}`;
        this.elements.textarea.value = this.state.textBlocks[this.state.currentTextBlockIndex] || '';

        this.elements.textPrevBtn.disabled = this.state.currentTextBlockIndex <= 0;
        this.elements.textNextBtn.disabled = this.state.currentTextBlockIndex >= total - 1;
        this.elements.textDeleteBtn.disabled = total <= 1;
    }

    _navigateTextBlock(direction) {
        this._saveCurrentTextBlock();

        const newIndex = this.state.currentTextBlockIndex + direction;
        if (newIndex >= 0 && newIndex < this.state.textBlocks.length) {
            this.state.currentTextBlockIndex = newIndex;
            this._updateTextBlockDisplay();
        }
    }

    _saveCurrentTextBlock() {
        if (!this.showTextBox) return;
        this.state.textBlocks[this.state.currentTextBlockIndex] = this.elements.textarea.value;
    }

    _onTextInput() {
        this._saveCurrentTextBlock();
        this.onModified();
    }

    _addTextBlock() {
        this._saveCurrentTextBlock();
        this.state.currentTextBlockIndex++;
        this.state.textBlocks.splice(this.state.currentTextBlockIndex, 0, '');
        this._updateTextBlockDisplay();
        this.elements.textarea.focus();
        this.onModified();
    }

    _deleteTextBlock() {
        if (this.state.textBlocks.length <= 1) return;

        this.state.textBlocks.splice(this.state.currentTextBlockIndex, 1);

        if (this.state.currentTextBlockIndex >= this.state.textBlocks.length) {
            this.state.currentTextBlockIndex = this.state.textBlocks.length - 1;
        }

        this._updateTextBlockDisplay();
        this.onModified();
    }

    // === Background ===

    setBackground(bgFilename) {
        if (bgFilename) {
            this.elements.background.style.backgroundImage = `url(${this.assetPaths.bg}${bgFilename})`;
        } else {
            this.elements.background.style.backgroundImage = 'none';
        }
    }

    // === Public API ===

    /**
     * Load a scene into the preview
     * @param {Object} scene - Scene data with bg, chars, textBlocks
     */
    loadScene(scene) {
        // Clear sprites
        this.elements.sprites.innerHTML = '';
        this.deselectSprite();

        // Set background
        this.setBackground(scene.bg);

        // Add sprites
        if (scene.chars && scene.chars.length > 0) {
            scene.chars.forEach((char, index) => {
                if (typeof char === 'string') {
                    // Old format: distribute evenly
                    const x = this.spriteConfig.defaultX + (index - (scene.chars.length - 1) / 2) * this.spriteConfig.spacing;
                    this.addSprite(char, x, this.spriteConfig.defaultY, this.spriteConfig.defaultScale, false);
                } else {
                    // New format with position
                    this.addSprite(
                        char.file,
                        char.x || this.spriteConfig.defaultX,
                        char.y || this.spriteConfig.defaultY,
                        char.scale || this.spriteConfig.defaultScale,
                        false
                    );
                }
            });
        }

        // Load text blocks
        if (this.showTextBox) {
            this.state.textBlocks = scene.textBlocks && scene.textBlocks.length > 0
                ? [...scene.textBlocks]
                : [''];
            this.state.currentTextBlockIndex = 0;
            this._updateTextBlockDisplay();
        }
    }

    /**
     * Clear the preview
     */
    clear() {
        this.elements.sprites.innerHTML = '';
        this.elements.background.style.backgroundImage = 'none';
        this.deselectSprite();

        if (this.showTextBox) {
            this.state.textBlocks = [''];
            this.state.currentTextBlockIndex = 0;
            this._updateTextBlockDisplay();
        }
    }

    /**
     * Get current scene data from the preview
     * @returns {Object} Scene data with bg, chars, textBlocks
     */
    getSceneData() {
        // Save current text block
        if (this.showTextBox) {
            this._saveCurrentTextBlock();
        }

        // Get sprites
        const sprites = [];
        this.elements.sprites.querySelectorAll('.sprite').forEach(sprite => {
            const spriteData = {
                file: sprite.dataset.file,
                x: parseFloat(sprite.dataset.x),
                y: parseFloat(sprite.dataset.y)
            };
            const scale = parseFloat(sprite.dataset.scale);
            if (scale !== 1) {
                spriteData.scale = scale;
            }
            sprites.push(spriteData);
        });

        // Get background from style
        const bgStyle = this.elements.background.style.backgroundImage;
        let bg = null;
        if (bgStyle && bgStyle !== 'none') {
            const match = bgStyle.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (match) {
                bg = match[1].split('/').pop();
            }
        }

        return {
            bg: bg,
            chars: sprites,
            textBlocks: this.showTextBox ? [...this.state.textBlocks] : undefined
        };
    }

    /**
     * Get current text blocks
     * @returns {string[]} Array of text blocks
     */
    getTextBlocks() {
        if (this.showTextBox) {
            this._saveCurrentTextBlock();
            return [...this.state.textBlocks];
        }
        return [];
    }

    /**
     * Set up drag-and-drop from a sprite gallery
     * @param {HTMLElement} gallery - The sprite gallery element
     */
    setupSpriteGallery(gallery) {
        if (this.readOnly) return;

        gallery.addEventListener('dragstart', (e) => {
            const thumb = e.target.closest('.sprite-thumb');
            if (thumb) {
                e.dataTransfer.setData('text/plain', thumb.dataset.sprite);
                thumb.classList.add('dragging');
            }
        });

        gallery.addEventListener('dragend', (e) => {
            const thumb = e.target.closest('.sprite-thumb');
            if (thumb) {
                thumb.classList.remove('dragging');
            }
        });

        // Drop on canvas
        this.elements.preview.addEventListener('dragover', (e) => {
            if (e.dataTransfer.types.includes('text/plain')) {
                e.preventDefault();
            }
        });

        this.elements.preview.addEventListener('drop', (e) => {
            const spriteFile = e.dataTransfer.getData('text/plain');
            if (spriteFile && spriteFile.endsWith('.svg')) {
                e.preventDefault();

                const rect = this.elements.sprites.getBoundingClientRect();
                let x = ((e.clientX - rect.left) / rect.width) * 100;
                let y = ((e.clientY - rect.top) / rect.height) * 100;

                // Y snap
                const thresholds = this.spriteConfig.ySnapThresholds;
                const positions = this.spriteConfig.ySnapPositions;
                if (y < thresholds[0]) y = positions[0];
                else if (y < thresholds[1]) y = positions[1];
                else if (y < thresholds[2]) y = positions[2];
                else y = positions[3];

                // Clamp X
                x = Math.max(this.spriteConfig.minX, Math.min(this.spriteConfig.maxX, x));

                this.addSprite(spriteFile, x, y);
            }
        });
    }

    /**
     * Destroy the component and clean up event listeners
     */
    destroy() {
        // Remove event listeners
        document.removeEventListener('mousemove', this._onSpriteMouseMove);
        document.removeEventListener('mouseup', this._onSpriteMouseUp);

        // Clear container
        this.container.innerHTML = '';
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasPreview;
} else {
    global.CanvasPreview = CanvasPreview;
}

})(typeof window !== 'undefined' ? window : global);
