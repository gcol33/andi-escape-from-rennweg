/**
 * Node Editor - Story Graph Visualization
 *
 * Architecture:
 * - GraphModel: Uses shared GraphModule for graph building
 * - GraphRenderer: SVG rendering (DOM-dependent)
 * - NodeEditorController: Coordinates model, renderer, and UI
 *
 * Dependencies (loaded via script tags):
 * - EditorConfig: Shared configuration
 * - EditorStorage: Shared localStorage operations
 * - GraphModule: Shared graph logic (GraphData, SceneGraphBuilder)
 */

(function() {
'use strict';

// Get shared modules (loaded via script tags)
const { GraphData, SceneGraphBuilder, ChainCompressor } = window.GraphModule || {};
const Storage = window.EditorStorage;
const Config = window.EditorConfig;

// Storage keys for chain compression state
const STORAGE_KEYS = {
    COMPRESS_CHAINS: 'andi_node_editor_compress_chains',
    EXPANDED_CHAINS: 'andi_node_editor_expanded_chains'
};

// Chain node width is wider to fit the "a → b" label
const CHAIN_NODE_EXTRA_WIDTH = 40;

// ============================================
// GraphModel - Wrapper around shared GraphData
// ============================================
class GraphModel {
    constructor() {
        // Use shared GraphData for graph building
        this.graphData = new GraphData();
        this.scenes = {};
    }

    // Expose nodes and edges from graphData
    get nodes() { return this.graphData.nodes; }
    get edges() { return this.graphData.edges; }

    /**
     * Load scenes and build graph using shared logic
     * @param {Object} scenes - Scene data keyed by scene ID
     */
    loadScenes(scenes) {
        this.scenes = scenes;
        // Use shared graph building logic - single source of truth
        this.graphData.buildFromScenes(scenes);
    }

    /**
     * Auto-layout using shared logic
     */
    autoLayout(options = {}) {
        // Use same layout parameters as main editor for consistency
        this.graphData.autoLayout({
            horizontalSpacing: 180,
            verticalSpacing: 50,
            startX: 100,
            centerY: 0,  // Will be centered by fitView()
            ...options
        });
    }

    /**
     * Get bounding box of all nodes
     */
    getBounds() {
        const graphConfig = Config ? Config.graph : {};
        return this.graphData.getBounds(
            graphConfig.nodeWidth || 140,
            graphConfig.nodeHeight || 50
        );
    }

    addNode(id, type = 'scene') {
        if (this.nodes.has(id)) return false;

        this.nodes.set(id, {
            id,
            type,
            exists: true,
            x: 0,
            y: 0,
            isStart: true,
            isEnding: true,
            hasFlags: false
        });

        this.scenes[id] = {
            id,
            bg: '',
            textBlocks: [''],
            choices: []
        };

        return true;
    }

    deleteNode(id) {
        if (!this.nodes.has(id)) return false;

        this.nodes.delete(id);
        delete this.scenes[id];

        // Remove connected edges
        const edges = this.graphData.edges;
        for (let i = edges.length - 1; i >= 0; i--) {
            if (edges[i].from === id || edges[i].to === id) {
                edges.splice(i, 1);
            }
        }

        return true;
    }

    connect(from, to, type, label = '') {
        if (!this.nodes.has(from) || !this.nodes.has(to)) return false;

        // Check for duplicate
        const exists = this.edges.some(e => e.from === from && e.to === to && e.type === type);
        if (exists) return false;

        this.edges.push({ from, to, type, label });

        // Update scene data
        const scene = this.scenes[from];
        if (scene) {
            if (type === 'choice') {
                if (!scene.choices) scene.choices = [];
                scene.choices.push({ label: label || 'Continue', target: to });
            }
        }

        // Update start/ending flags
        const toNode = this.nodes.get(to);
        const fromNode = this.nodes.get(from);
        if (toNode) toNode.isStart = false;
        if (fromNode) fromNode.isEnding = false;

        return true;
    }

    deleteEdge(from, to, type) {
        const edges = this.graphData.edges;
        const index = edges.findIndex(e => e.from === from && e.to === to && e.type === type);
        if (index === -1) return false;

        edges.splice(index, 1);

        // Update scene data
        const scene = this.scenes[from];
        if (scene && scene.choices) {
            scene.choices = scene.choices.filter(c => c.target !== to);
        }

        return true;
    }
}

// ============================================
// GraphRenderer - SVG rendering
// ============================================
class GraphRenderer {
    constructor(svg) {
        this.svg = svg;
        this.nodeWidth = 140;
        this.nodeHeight = 50;
    }

    render(model, viewState) {
        const { zoom, panX, panY, selectedNode, selectedEdge } = viewState;

        // Clear and set viewBox
        const rect = this.svg.getBoundingClientRect();

        if (rect.width === 0 || rect.height === 0) {
            // SVG not yet laid out, skip rendering
            return;
        }

        this.svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
        this.svg.innerHTML = '';

        // Create transform group
        const g = this.createSvgElement('g');
        g.setAttribute('transform', `translate(${panX}, ${panY}) scale(${zoom})`);
        g.id = 'graph-group';

        // Draw edges first (below nodes)
        for (const edge of model.edges) {
            const fromNode = model.nodes.get(edge.from);
            const toNode = model.nodes.get(edge.to);
            if (fromNode && toNode) {
                const edgeEl = this.renderEdge(edge, fromNode, toNode, selectedEdge);
                g.appendChild(edgeEl);
            }
        }

        // Draw nodes
        for (const node of model.nodes.values()) {
            const nodeEl = this.renderNode(node, selectedNode === node.id);
            g.appendChild(nodeEl);
        }

        this.svg.appendChild(g);
    }

    renderNode(node, isSelected, isChain = false) {
        const group = this.createSvgElement('g');
        group.classList.add('node');
        group.dataset.nodeId = node.id;

        if (!node.exists) group.classList.add('missing');
        if (node.isStart) group.classList.add('start');
        if (node.isEnding) group.classList.add('ending');
        if (node.type === 'battle') group.classList.add('battle');
        if (node.type === 'dice') group.classList.add('dice');
        if (isSelected) group.classList.add('selected');
        if (isChain || node.isChain) group.classList.add('chain');

        // Use wider node for chains
        const nodeWidth = (isChain || node.isChain) ? this.nodeWidth + CHAIN_NODE_EXTRA_WIDTH : this.nodeWidth;

        // Rectangle
        const rect = this.createSvgElement('rect');
        rect.setAttribute('x', node.x - nodeWidth / 2);
        rect.setAttribute('y', node.y - this.nodeHeight / 2);
        rect.setAttribute('width', nodeWidth);
        rect.setAttribute('height', this.nodeHeight);
        rect.setAttribute('rx', '6');
        group.appendChild(rect);

        // Label
        const text = this.createSvgElement('text');
        text.setAttribute('x', node.x);
        text.setAttribute('y', node.y);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');

        // Use shortName for chains, otherwise truncate id
        let displayName = node.shortName || node.id;
        const maxChars = Math.floor(nodeWidth / 8);
        if (displayName.length > maxChars) {
            displayName = displayName.substring(0, maxChars - 2) + '...';
        }
        text.textContent = displayName;
        group.appendChild(text);

        return group;
    }

    /**
     * Render compressed graph with chain nodes
     */
    renderCompressed(displayData, viewState, chainState) {
        const { zoom, panX, panY, selectedNode, selectedEdge } = viewState;
        const { nodes, edges } = displayData;

        // Clear and set viewBox
        const rect = this.svg.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            // SVG not yet laid out, skip rendering
            return;
        }

        this.svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
        this.svg.innerHTML = '';

        // Create transform group
        const g = this.createSvgElement('g');
        g.setAttribute('transform', `translate(${panX}, ${panY}) scale(${zoom})`);
        g.id = 'graph-group';

        // Draw edges first (below nodes)
        for (const edge of edges) {
            const fromNode = nodes[edge.from];
            const toNode = nodes[edge.to];
            if (fromNode && toNode) {
                const edgeEl = this.renderEdge(edge, fromNode, toNode, selectedEdge);
                g.appendChild(edgeEl);
            }
        }

        // Draw nodes
        for (const node of Object.values(nodes)) {
            const isChain = node.isChain || false;
            const nodeEl = this.renderNode(node, selectedNode === node.id, isChain);
            g.appendChild(nodeEl);
        }

        this.svg.appendChild(g);
    }

    renderEdge(edge, fromNode, toNode, selectedEdge) {
        const group = this.createSvgElement('g');
        group.dataset.from = edge.from;
        group.dataset.to = edge.to;
        group.dataset.type = edge.type;

        // Calculate path
        const path = this.calculateEdgePath(fromNode, toNode);

        // Draw line
        const line = this.createSvgElement('path');
        line.classList.add('edge', edge.type);
        line.setAttribute('d', path);

        if (selectedEdge && selectedEdge.from === edge.from &&
            selectedEdge.to === edge.to && selectedEdge.type === edge.type) {
            line.classList.add('selected');
        }

        group.appendChild(line);

        // Draw arrow
        const arrow = this.createArrow(fromNode, toNode, edge.type);
        group.appendChild(arrow);

        return group;
    }

    calculateEdgePath(from, to) {
        const startX = from.x + this.nodeWidth / 2;
        const startY = from.y;
        const endX = to.x - this.nodeWidth / 2;
        const endY = to.y;

        // Bezier curve
        const dx = endX - startX;
        const controlOffset = Math.min(Math.abs(dx) * 0.5, 100);

        return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
    }

    createArrow(from, to, type) {
        const endX = to.x - this.nodeWidth / 2;
        const endY = to.y;

        const arrow = this.createSvgElement('polygon');
        arrow.classList.add('edge-arrow', type);

        // Arrow pointing left into node
        const size = 8;
        arrow.setAttribute('points', `${endX},${endY} ${endX + size},${endY - size/2} ${endX + size},${endY + size/2}`);

        return arrow;
    }

    createSvgElement(tag) {
        return document.createElementNS('http://www.w3.org/2000/svg', tag);
    }

    /**
     * Convert screen coordinates to graph coordinates
     */
    screenToGraph(x, y, viewState) {
        const rect = this.svg.getBoundingClientRect();
        return {
            x: (x - rect.left - viewState.panX) / viewState.zoom,
            y: (y - rect.top - viewState.panY) / viewState.zoom
        };
    }

    /**
     * Find node at screen position
     */
    findNodeAt(x, y, model, viewState) {
        const pos = this.screenToGraph(x, y, viewState);

        for (const node of model.nodes.values()) {
            if (pos.x >= node.x - this.nodeWidth / 2 &&
                pos.x <= node.x + this.nodeWidth / 2 &&
                pos.y >= node.y - this.nodeHeight / 2 &&
                pos.y <= node.y + this.nodeHeight / 2) {
                return node;
            }
        }
        return null;
    }
}

// ============================================
// NodeEditorController - Coordinates everything
// ============================================
class NodeEditorController {
    constructor(options = {}) {
        this.model = new GraphModel();
        this.renderer = null;

        this.viewState = {
            zoom: 1,
            panX: 0,
            panY: 0,
            selectedNode: null,
            selectedEdge: null
        };

        this.dragState = {
            isDragging: false,
            isPanning: false,
            startX: 0,
            startY: 0,
            nodeId: null
        };

        // Chain compression state
        this.chainState = {
            compressChains: false,  // Default: expanded
            expandedChains: new Set(),
            chains: {},  // Current chains from compression
            cachedDisplayData: null  // Cached compressed display data
        };

        // Load saved compression preferences
        this.loadChainPreferences();

        this.elements = {};
    }

    /**
     * Load chain compression preferences from localStorage
     */
    loadChainPreferences() {
        try {
            const savedCompress = localStorage.getItem(STORAGE_KEYS.COMPRESS_CHAINS);
            if (savedCompress !== null) {
                this.chainState.compressChains = savedCompress === 'true';
            }

            const savedExpanded = localStorage.getItem(STORAGE_KEYS.EXPANDED_CHAINS);
            if (savedExpanded) {
                this.chainState.expandedChains = new Set(JSON.parse(savedExpanded));
            }
        } catch (e) {
            console.warn('Failed to load chain preferences:', e);
        }
    }

    /**
     * Save chain compression preferences to localStorage
     */
    saveChainPreferences() {
        try {
            localStorage.setItem(STORAGE_KEYS.COMPRESS_CHAINS, String(this.chainState.compressChains));
            localStorage.setItem(STORAGE_KEYS.EXPANDED_CHAINS, JSON.stringify([...this.chainState.expandedChains]));
        } catch (e) {
            console.warn('Failed to save chain preferences:', e);
        }
    }

    async init() {
        this.cacheElements();
        this.renderer = new GraphRenderer(this.elements.canvas);
        this.setupEventListeners();
        await this.loadData();
        this.render();
        this.fitView();
        this.updateSceneCount();
    }

    cacheElements() {
        this.elements = {
            canvas: document.getElementById('canvas'),
            container: document.getElementById('canvas-container'),
            sceneCount: document.getElementById('scene-count'),
            zoomLevel: document.getElementById('zoom-level'),
            contextMenu: document.getElementById('context-menu'),
            canvasContextMenu: document.getElementById('canvas-context-menu'),
            propertiesPanel: document.getElementById('properties-panel'),
            propertiesContent: document.getElementById('properties-content'),
            addDialog: document.getElementById('add-dialog'),
            connectDialog: document.getElementById('connect-dialog'),
            toastContainer: document.getElementById('toast-container')
        };
    }

    setupEventListeners() {
        // Toolbar buttons
        document.getElementById('btn-add')?.addEventListener('click', () => this.showAddDialog());
        document.getElementById('btn-layout')?.addEventListener('click', () => this.autoLayout());
        document.getElementById('btn-fit')?.addEventListener('click', () => this.fitView());
        document.getElementById('btn-save')?.addEventListener('click', () => this.save());
        document.getElementById('btn-back')?.addEventListener('click', () => this.goBack());

        // Chain compression buttons
        document.getElementById('btn-compress')?.addEventListener('click', () => this.compressAll());
        document.getElementById('btn-expand')?.addEventListener('click', () => this.expandAll());

        // Zoom controls
        document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.zoom(1.2));
        document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.zoom(0.8));

        // Canvas events
        this.elements.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.elements.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.elements.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.elements.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        this.elements.canvas.addEventListener('contextmenu', (e) => this.onContextMenu(e));
        this.elements.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));

        // Click outside to close menus
        document.addEventListener('click', (e) => {
            if (!this.elements.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
            if (!this.elements.canvasContextMenu.contains(e.target)) {
                this.hideCanvasContextMenu();
            }
        });

        // Context menu actions (on node)
        this.elements.contextMenu.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (btn) {
                const action = btn.dataset.action;
                this.handleContextAction(action);
            }
        });

        // Canvas context menu actions (on empty space)
        this.elements.canvasContextMenu?.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (btn) {
                const action = btn.dataset.action;
                this.handleCanvasContextAction(action);
            }
        });

        // Properties panel close
        document.getElementById('btn-close-panel')?.addEventListener('click', () => {
            this.elements.propertiesPanel.classList.add('hidden');
            this.viewState.selectedNode = null;
            this.render();
        });

        // Add dialog
        document.getElementById('btn-cancel-add')?.addEventListener('click', () => {
            this.elements.addDialog.close('cancel');
        });
        this.elements.addDialog?.querySelector('form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddNode();
            this.elements.addDialog.close();
        });

        // Connect dialog
        document.getElementById('btn-cancel-connect')?.addEventListener('click', () => {
            this.elements.connectDialog.close('cancel');
        });
        this.elements.connectDialog?.querySelector('form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleConnect();
            this.elements.connectDialog.close();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideContextMenu();
                this.viewState.selectedNode = null;
                this.viewState.selectedEdge = null;
                this.render();
            }
            if (e.key === 'Delete' && this.viewState.selectedNode) {
                this.deleteSelectedNode();
            }
        });
    }

    async loadData() {
        // Use shared EditorStorage for loading (same as main editor)
        if (Storage) {
            const scenes = await Storage.autoLoad();
            if (scenes) {
                this.model.loadScenes(scenes);
                this.model.autoLayout();
                return;
            }
        }

        // Fallback if EditorStorage not available
        if (typeof story !== 'undefined' && story) {
            this.model.loadScenes(story);
            this.model.autoLayout();
            this.save();
        }
    }

    save() {
        // Use shared EditorStorage for saving (same as main editor)
        if (Storage) {
            if (Storage.saveScenes(this.model.scenes)) {
                this.showToast('Saved', 'success');
            } else {
                this.showToast('Failed to save', 'error');
            }
        } else {
            // Fallback
            try {
                localStorage.setItem('andi_editor_scenes', JSON.stringify(this.model.scenes));
                this.showToast('Saved', 'success');
            } catch (e) {
                this.showToast('Failed to save', 'error');
            }
        }
    }

    render() {
        // Apply chain compression if enabled
        if (this.chainState.compressChains && ChainCompressor) {
            const displayData = this.getCompressedDisplayData();
            this.renderer.renderCompressed(displayData, this.viewState, this.chainState);
        } else {
            this.renderer.render(this.model, this.viewState);
        }
        this.elements.zoomLevel.textContent = Math.round(this.viewState.zoom * 100) + '%';
    }

    /**
     * Get compressed display data for rendering (cached)
     * @param {boolean} forceRefresh - Force recalculation even if cached
     */
    getCompressedDisplayData(forceRefresh = false) {
        // Return cached data if available and not forcing refresh
        if (!forceRefresh && this.chainState.cachedDisplayData) {
            return this.chainState.cachedDisplayData;
        }

        // Convert model nodes to plain object format for ChainCompressor
        const nodes = {};
        for (const [id, node] of this.model.nodes) {
            nodes[id] = {
                id: node.id,
                exists: node.exists,
                hasFlags: node.hasFlags,
                isStart: node.isStart,
                isEnding: node.isEnding,
                type: node.type,
                x: node.x,
                y: node.y
            };
        }

        const edges = [...this.model.edges];

        // Apply compression
        const result = ChainCompressor.compress(nodes, edges, this.chainState.expandedChains);
        this.chainState.chains = result.chains;

        // Only re-layout if there are actual collapsed chains
        // Otherwise preserve original positions
        const hasCollapsedChains = Object.keys(result.chains).some(
            chainId => !this.chainState.expandedChains.has(chainId)
        );

        if (hasCollapsedChains) {
            // Layout the compressed graph since structure changed
            const layoutData = new GraphData();
            for (const [id, node] of Object.entries(result.nodes)) {
                layoutData.nodes.set(id, {
                    ...node,
                    x: 0,
                    y: 0
                });
            }
            layoutData.edges = result.edges;
            layoutData.autoLayout({
                horizontalSpacing: 180,
                verticalSpacing: 50,
                startX: 100,
                centerY: 0
            });

            // Copy positions back
            for (const [id, node] of layoutData.nodes) {
                result.nodes[id].x = node.x;
                result.nodes[id].y = node.y;
            }
        }
        // If no collapsed chains, positions are already preserved from original nodes

        // Cache the result
        this.chainState.cachedDisplayData = result;

        return result;
    }

    /**
     * Invalidate cached display data (call when graph changes)
     */
    invalidateDisplayCache() {
        this.chainState.cachedDisplayData = null;
    }

    updateSceneCount() {
        const count = this.model.nodes.size;
        this.elements.sceneCount.textContent = `${count} scene${count !== 1 ? 's' : ''}`;
    }

    // View controls
    zoom(factor) {
        const newZoom = this.viewState.zoom * factor;
        if (newZoom >= 0.1 && newZoom <= 3) {
            this.viewState.zoom = newZoom;
            this.render();
        }
    }

    fitView() {
        const bounds = this.model.getBounds();
        const container = this.elements.container;
        const width = container.clientWidth;
        const height = container.clientHeight;

        const graphWidth = bounds.maxX - bounds.minX + 100;
        const graphHeight = bounds.maxY - bounds.minY + 100;

        const scaleX = width / graphWidth;
        const scaleY = height / graphHeight;
        this.viewState.zoom = Math.min(scaleX, scaleY, 1.5);

        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;

        this.viewState.panX = width / 2 - centerX * this.viewState.zoom;
        this.viewState.panY = height / 2 - centerY * this.viewState.zoom;

        this.render();
    }

    autoLayout() {
        this.model.autoLayout();
        this.invalidateDisplayCache();
        this.fitView();
        this.showToast('Layout updated', 'success');
    }

    // Mouse handlers
    onMouseDown(e) {
        if (e.button === 2) return; // Right click handled by contextmenu

        const node = this.renderer.findNodeAt(e.clientX, e.clientY, this.model, this.viewState);

        if (node) {
            this.viewState.selectedNode = node.id;
            this.viewState.selectedEdge = null;
            this.dragState = {
                isDragging: true,
                isPanning: false,
                startX: e.clientX,
                startY: e.clientY,
                nodeId: node.id,
                nodeStartX: node.x,
                nodeStartY: node.y
            };
        } else {
            this.viewState.selectedNode = null;
            this.dragState = {
                isDragging: false,
                isPanning: true,
                startX: e.clientX,
                startY: e.clientY,
                panStartX: this.viewState.panX,
                panStartY: this.viewState.panY
            };
        }

        this.render();
    }

    onMouseMove(e) {
        if (this.dragState.isDragging && this.dragState.nodeId) {
            const node = this.model.nodes.get(this.dragState.nodeId);
            if (node) {
                const dx = (e.clientX - this.dragState.startX) / this.viewState.zoom;
                const dy = (e.clientY - this.dragState.startY) / this.viewState.zoom;
                node.x = this.dragState.nodeStartX + dx;
                node.y = this.dragState.nodeStartY + dy;
                this.render();
            }
        } else if (this.dragState.isPanning) {
            this.viewState.panX = this.dragState.panStartX + (e.clientX - this.dragState.startX);
            this.viewState.panY = this.dragState.panStartY + (e.clientY - this.dragState.startY);
            this.render();
        }
    }

    onMouseUp() {
        this.dragState = {
            isDragging: false,
            isPanning: false,
            startX: 0,
            startY: 0,
            nodeId: null
        };
    }

    onWheel(e) {
        e.preventDefault();
        // Normalize wheel delta for touchpad vs mouse wheel
        // Touchpads send many small deltas, mice send fewer large ones
        const delta = Math.abs(e.deltaY) > 50 ? e.deltaY / 100 : e.deltaY / 500;
        const factor = 1 - delta;
        // Clamp factor to reasonable range
        const clampedFactor = Math.max(0.95, Math.min(1.05, factor));
        this.zoom(clampedFactor);
    }

    onContextMenu(e) {
        e.preventDefault();

        // Store click position for "add node at position"
        this.lastContextPosition = this.renderer.screenToGraph(
            e.clientX, e.clientY, this.viewState
        );

        const node = this.renderer.findNodeAt(e.clientX, e.clientY, this.model, this.viewState);
        if (node) {
            this.viewState.selectedNode = node.id;
            this.showContextMenu(e.clientX, e.clientY);
            this.render();
        } else {
            // Clicked on empty space - show canvas context menu
            this.showCanvasContextMenu(e.clientX, e.clientY);
        }
    }

    showContextMenu(x, y) {
        this.hideCanvasContextMenu();
        this.elements.contextMenu.style.left = x + 'px';
        this.elements.contextMenu.style.top = y + 'px';
        this.elements.contextMenu.classList.remove('hidden');

        // Show/hide chain-related options based on selected node
        const expandBtn = document.getElementById('ctx-expand-chain');
        const compressBtn = document.getElementById('ctx-compress-chain');
        const chainSeparator = this.elements.contextMenu.querySelector('.chain-separator');

        // Check if selected node is a chain
        const selectedId = this.viewState.selectedNode;
        const isChainNode = selectedId && selectedId.startsWith('chain_');

        // Check if node is part of a chain (can be compressed)
        const canCompress = selectedId && ChainCompressor &&
            ChainCompressor.findChainForNode(selectedId, this.chainState.chains);

        if (expandBtn) {
            expandBtn.classList.toggle('hidden', !isChainNode);
        }
        if (compressBtn) {
            // Show compress option if node is part of a chain that's currently expanded
            compressBtn.classList.toggle('hidden', !canCompress || isChainNode);
        }
        if (chainSeparator) {
            chainSeparator.classList.toggle('hidden', !isChainNode && !canCompress);
        }
    }

    hideContextMenu() {
        this.elements.contextMenu.classList.add('hidden');
    }

    showCanvasContextMenu(x, y) {
        this.hideContextMenu();
        this.elements.canvasContextMenu.style.left = x + 'px';
        this.elements.canvasContextMenu.style.top = y + 'px';
        this.elements.canvasContextMenu.classList.remove('hidden');
    }

    hideCanvasContextMenu() {
        this.elements.canvasContextMenu?.classList.add('hidden');
    }

    handleContextAction(action) {
        this.hideContextMenu();

        switch (action) {
            case 'edit':
                this.editSelectedNode();
                break;
            case 'connect':
                this.showConnectDialog();
                break;
            case 'attach':
                this.showAttachDialog();
                break;
            case 'delete':
                this.deleteSelectedNode();
                break;
            case 'expand-chain':
                this.expandSelectedChain();
                break;
            case 'compress-chain':
                this.compressSelectedChain();
                break;
        }
    }

    handleCanvasContextAction(action) {
        this.hideCanvasContextMenu();

        switch (action) {
            case 'add-node':
                this.showAddDialog();
                break;
            case 'fit-view':
                this.fitView();
                break;
            case 'auto-layout':
                this.autoLayout();
                break;
        }
    }

    // Node operations
    showAddDialog() {
        document.getElementById('new-node-id').value = '';
        document.getElementById('new-node-type').value = 'scene';
        this.pendingAttachFrom = null; // Not attaching to an existing node
        this.elements.addDialog.showModal();
    }

    showAttachDialog() {
        if (!this.viewState.selectedNode) return;
        document.getElementById('new-node-id').value = '';
        document.getElementById('new-node-type').value = 'scene';
        this.pendingAttachFrom = this.viewState.selectedNode;
        this.elements.addDialog.showModal();
    }

    handleAddNode() {
        const id = document.getElementById('new-node-id').value.trim();
        const type = document.getElementById('new-node-type').value;

        if (!id) {
            this.showToast('Please enter a scene ID', 'error');
            return;
        }

        if (this.model.addNode(id, type)) {
            // If we have a click position, place node there
            if (this.lastContextPosition) {
                const node = this.model.nodes.get(id);
                node.x = this.lastContextPosition.x;
                node.y = this.lastContextPosition.y;
            } else {
                this.model.autoLayout();
            }

            // If attaching to an existing node, create connection
            if (this.pendingAttachFrom) {
                this.model.connect(this.pendingAttachFrom, id, 'choice', 'Continue');
            }

            this.invalidateDisplayCache();
            this.updateSceneCount();
            this.render();
            this.showToast(`Added node: ${id}`, 'success');
        } else {
            this.showToast('Node already exists', 'error');
        }

        this.pendingAttachFrom = null;
    }

    deleteSelectedNode() {
        if (!this.viewState.selectedNode) return;

        const id = this.viewState.selectedNode;
        if (this.model.deleteNode(id)) {
            this.viewState.selectedNode = null;
            this.invalidateDisplayCache();
            this.updateSceneCount();
            this.render();
            this.showToast(`Deleted node: ${id}`, 'success');
        }
    }

    editSelectedNode() {
        if (!this.viewState.selectedNode) return;

        // Save current state and go to scene editor
        this.save();
        const url = `index.html?scene=${encodeURIComponent(this.viewState.selectedNode)}`;
        window.location.href = url;
    }

    showConnectDialog() {
        if (!this.viewState.selectedNode) return;

        const select = document.getElementById('connect-target');
        select.innerHTML = '<option value="">Select target...</option>';

        for (const node of this.model.nodes.values()) {
            if (node.id !== this.viewState.selectedNode) {
                const option = document.createElement('option');
                option.value = node.id;
                option.textContent = node.id;
                select.appendChild(option);
            }
        }

        document.getElementById('connect-type').value = 'choice';
        document.getElementById('connect-choice-text').value = '';
        this.elements.connectDialog.showModal();
    }

    handleConnect() {
        const target = document.getElementById('connect-target').value;
        const type = document.getElementById('connect-type').value;
        const label = document.getElementById('connect-choice-text').value;

        if (!target || !this.viewState.selectedNode) {
            this.showToast('Please select a target', 'error');
            return;
        }

        if (this.model.connect(this.viewState.selectedNode, target, type, label)) {
            this.invalidateDisplayCache();
            this.render();
            this.showToast('Connection added', 'success');
        } else {
            this.showToast('Connection already exists', 'error');
        }
    }

    goBack() {
        this.save();
        window.location.href = 'index.html';
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        this.elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // ============================================
    // Chain Compression Methods
    // ============================================

    /**
     * Compress all linear chains
     */
    compressAll() {
        this.chainState.compressChains = true;
        this.chainState.expandedChains.clear();
        this.invalidateDisplayCache();
        this.saveChainPreferences();

        // Check if there are any chains to compress
        const displayData = this.getCompressedDisplayData();
        const chainCount = Object.keys(this.chainState.chains).length;

        this.render();

        if (chainCount > 0) {
            this.fitView();
            this.showToast(`${chainCount} chain${chainCount > 1 ? 's' : ''} compressed`, 'success');
        } else {
            this.showToast("Can't compress - no linear chains found", 'error');
        }
    }

    /**
     * Expand all chains
     */
    expandAll() {
        this.chainState.compressChains = false;
        this.chainState.expandedChains.clear();
        this.invalidateDisplayCache();
        this.saveChainPreferences();
        this.render();
        this.fitView();
        this.showToast('Chains expanded', 'success');
    }

    /**
     * Expand a specific chain (by chain ID)
     */
    expandChain(chainId) {
        if (!chainId || !chainId.startsWith('chain_')) return;

        this.chainState.expandedChains.add(chainId);
        this.invalidateDisplayCache();
        this.saveChainPreferences();
        this.render();
        this.fitView();
    }

    /**
     * Collapse a specific chain
     */
    collapseChain(chainId) {
        if (!chainId) return;

        this.chainState.expandedChains.delete(chainId);
        this.invalidateDisplayCache();
        this.saveChainPreferences();
        this.render();
        this.fitView();
    }

    /**
     * Expand the currently selected chain
     */
    expandSelectedChain() {
        const selectedId = this.viewState.selectedNode;
        if (selectedId && selectedId.startsWith('chain_')) {
            this.expandChain(selectedId);
            this.viewState.selectedNode = null;
            this.showToast('Chain expanded', 'success');
        }
    }

    /**
     * Compress the chain containing the selected node
     */
    compressSelectedChain() {
        const selectedId = this.viewState.selectedNode;
        if (!selectedId || !ChainCompressor) return;

        const chainId = ChainCompressor.findChainForNode(selectedId, this.chainState.chains);
        if (chainId) {
            this.collapseChain(chainId);
            this.viewState.selectedNode = null;
            this.showToast('Chain compressed', 'success');
        }
    }

    /**
     * Toggle chain expansion on double-click
     */
    onDoubleClick(e) {
        // Find node at click position
        let node;
        if (this.chainState.compressChains) {
            // When compressed, need to find node in compressed display data
            const displayData = this.getCompressedDisplayData();
            const pos = this.renderer.screenToGraph(e.clientX, e.clientY, this.viewState);
            for (const n of Object.values(displayData.nodes)) {
                const nodeWidth = n.isChain ? this.renderer.nodeWidth + CHAIN_NODE_EXTRA_WIDTH : this.renderer.nodeWidth;
                if (pos.x >= n.x - nodeWidth / 2 &&
                    pos.x <= n.x + nodeWidth / 2 &&
                    pos.y >= n.y - this.renderer.nodeHeight / 2 &&
                    pos.y <= n.y + this.renderer.nodeHeight / 2) {
                    node = n;
                    break;
                }
            }
        } else {
            node = this.renderer.findNodeAt(e.clientX, e.clientY, this.model, this.viewState);
        }

        if (!node) return;

        // If it's a chain node, expand it
        if (node.isChain || (node.id && node.id.startsWith('chain_'))) {
            this.expandChain(node.id);
            this.showToast('Chain expanded', 'success');
            return;
        }

        // If compression is enabled and node is part of a chain, we can't collapse via double-click
        // (chains are already collapsed when compressChains is true)
        // If compression is disabled, offer to enable it and collapse
        if (!this.chainState.compressChains && ChainCompressor) {
            // Build chains to check if this node is part of one
            const nodes = {};
            for (const [id, n] of this.model.nodes) {
                nodes[id] = { ...n };
            }
            const edges = [...this.model.edges];
            const result = ChainCompressor.compress(nodes, edges, new Set());

            const chainId = ChainCompressor.findChainForNode(node.id, result.chains);
            if (chainId) {
                // Enable compression and collapse this specific chain
                this.chainState.compressChains = true;
                // Don't expand this chain (leave it collapsed)
                // But expand all others
                for (const cid of Object.keys(result.chains)) {
                    if (cid !== chainId) {
                        this.chainState.expandedChains.add(cid);
                    }
                }
                this.saveChainPreferences();
                this.render();
                this.fitView();
                this.showToast('Chain compressed', 'success');
            }
        }
    }
}

// ============================================
// Initialize on DOM ready
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    const controller = new NodeEditorController();
    await controller.init();

    // Expose for debugging
    window.nodeEditor = controller;
});

// Export for testing (CommonJS/ES modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GraphModel, GraphRenderer, NodeEditorController };
}

})();
