/**
 * Shared Graph Logic Module
 * Used by both the main editor and node editor for consistent graph rendering
 *
 * IMPORTANT: This is the SINGLE SOURCE OF TRUTH for graph building logic.
 * Both editors MUST use this module to ensure consistent graphs.
 */

(function(global) {
'use strict';

// Special targets that should be ignored (not actual scenes)
const SPECIAL_TARGETS = new Set(['_roll']);

// ============================================
// GraphData - Pure data model
// ============================================
class GraphData {
    constructor() {
        this.nodes = new Map();
        this.edges = [];
    }

    clear() {
        this.nodes.clear();
        this.edges = [];
    }

    /**
     * Build graph from scene data
     * This logic MUST match exactly between all editors
     *
     * @param {Object} scenes - Scene data keyed by scene ID
     */
    buildFromScenes(scenes) {
        this.clear();

        const hasIncoming = new Set();
        const hasOutgoing = new Set();
        const missingTargets = new Set();

        // Create nodes for each scene
        for (const [id, scene] of Object.entries(scenes)) {
            this.nodes.set(id, {
                id,
                type: GraphData.getSceneType(scene),
                exists: true,
                x: 0,
                y: 0,
                isStart: false,
                isEnding: false,
                hasFlags: scene.require_flags && scene.require_flags.length > 0
            });
        }

        // Build edges from choices and actions
        for (const [id, scene] of Object.entries(scenes)) {
            // Standard choices
            if (scene.choices) {
                for (const choice of scene.choices) {
                    if (choice.target && !SPECIAL_TARGETS.has(choice.target)) {
                        this.addEdgeTracked(id, choice.target, 'choice', choice.label || '', hasOutgoing, hasIncoming, missingTargets);
                    }
                }
            }

            // Actions (battles, dice rolls)
            if (scene.actions) {
                for (const action of scene.actions) {
                    // Dice roll actions (success_target/failure_target)
                    if (action.success_target && !SPECIAL_TARGETS.has(action.success_target)) {
                        this.addEdgeTracked(id, action.success_target, 'success', 'Success', hasOutgoing, hasIncoming, missingTargets);
                    }
                    if (action.failure_target && !SPECIAL_TARGETS.has(action.failure_target)) {
                        this.addEdgeTracked(id, action.failure_target, 'failure', 'Failure', hasOutgoing, hasIncoming, missingTargets);
                    }

                    // Battle actions (win_target/lose_target or victory_target/defeat_target)
                    const winTarget = action.win_target || action.victory_target;
                    const loseTarget = action.lose_target || action.defeat_target;

                    if (winTarget && !SPECIAL_TARGETS.has(winTarget)) {
                        this.addEdgeTracked(id, winTarget, 'success', 'Win', hasOutgoing, hasIncoming, missingTargets);
                    }
                    if (loseTarget && !SPECIAL_TARGETS.has(loseTarget)) {
                        this.addEdgeTracked(id, loseTarget, 'failure', 'Lose', hasOutgoing, hasIncoming, missingTargets);
                    }
                    if (action.flee_target && !SPECIAL_TARGETS.has(action.flee_target)) {
                        this.addEdgeTracked(id, action.flee_target, 'choice', 'Flee', hasOutgoing, hasIncoming, missingTargets);
                    }
                }
            }
        }

        // Add missing targets as placeholder nodes
        for (const id of missingTargets) {
            this.nodes.set(id, {
                id,
                type: 'scene',
                exists: false,
                x: 0,
                y: 0,
                isStart: false,
                isEnding: false,
                hasFlags: false
            });
        }

        // Mark start/ending nodes
        for (const [id, node] of this.nodes) {
            if (node.exists) {
                node.isStart = !hasIncoming.has(id);
                node.isEnding = !hasOutgoing.has(id);
            }
        }
    }

    /**
     * Add edge with tracking for start/ending detection
     */
    addEdgeTracked(from, to, type, label, hasOutgoing, hasIncoming, missingTargets) {
        // Track for start/ending detection
        hasOutgoing.add(from);
        hasIncoming.add(to);

        // Track missing targets
        if (!this.nodes.has(to)) {
            missingTargets.add(to);
        }

        // Avoid duplicate edges
        const exists = this.edges.some(e => e.from === from && e.to === to && e.type === type);
        if (!exists) {
            this.edges.push({ from, to, type, label });
        }
    }

    addEdge(from, to, type, label = '') {
        // Create placeholder node if target doesn't exist
        if (!this.nodes.has(to)) {
            this.nodes.set(to, {
                id: to,
                type: 'scene',
                exists: false,
                x: 0,
                y: 0,
                isStart: false,
                isEnding: false
            });
        }

        // Avoid duplicate edges
        const exists = this.edges.some(e => e.from === from && e.to === to && e.type === type);
        if (!exists) {
            this.edges.push({ from, to, type, label });
        }
    }

    static getSceneType(scene) {
        if (!scene.actions || scene.actions.length === 0) return 'scene';
        const action = scene.actions[0];
        if (action.type === 'start_battle') return 'battle';
        if (action.type === 'dice_roll') return 'dice';
        return 'scene';
    }

    /**
     * Auto-layout nodes using BFS levels
     */
    autoLayout(options = {}) {
        const {
            horizontalSpacing = 200,
            verticalSpacing = 80,
            nodeWidth = 140,
            nodeHeight = 40
        } = options;

        const nodeList = Array.from(this.nodes.values());
        if (nodeList.length === 0) return;

        // Find start nodes
        const startNodes = nodeList.filter(n => n.isStart && n.exists);
        const processed = new Set();
        const levels = new Map();

        // BFS to assign levels
        const queue = startNodes.length > 0 ? [...startNodes] : [nodeList[0]];
        queue.forEach(n => levels.set(n.id, 0));

        while (queue.length > 0) {
            const node = queue.shift();
            if (processed.has(node.id)) continue;
            processed.add(node.id);

            const level = levels.get(node.id);
            const outgoing = this.edges.filter(e => e.from === node.id);

            for (const edge of outgoing) {
                const targetNode = this.nodes.get(edge.to);
                if (targetNode && !levels.has(edge.to)) {
                    levels.set(edge.to, level + 1);
                    queue.push(targetNode);
                }
            }
        }

        // Handle disconnected nodes
        for (const node of nodeList) {
            if (!levels.has(node.id)) {
                levels.set(node.id, 0);
            }
        }

        // Group by level
        const levelGroups = new Map();
        for (const [id, level] of levels) {
            if (!levelGroups.has(level)) levelGroups.set(level, []);
            levelGroups.get(level).push(id);
        }

        // Position nodes
        for (const [level, ids] of levelGroups) {
            const totalHeight = ids.length * verticalSpacing;
            const startY = -totalHeight / 2 + verticalSpacing / 2;

            ids.forEach((id, index) => {
                const node = this.nodes.get(id);
                node.x = level * horizontalSpacing;
                node.y = startY + index * verticalSpacing;
            });
        }
    }

    /**
     * Get bounding box of all nodes
     */
    getBounds(nodeWidth = 140, nodeHeight = 40) {
        const nodeList = Array.from(this.nodes.values());
        if (nodeList.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (const node of nodeList) {
            minX = Math.min(minX, node.x - nodeWidth / 2);
            maxX = Math.max(maxX, node.x + nodeWidth / 2);
            minY = Math.min(minY, node.y - nodeHeight / 2);
            maxY = Math.max(maxY, node.y + nodeHeight / 2);
        }

        return {
            minX, maxX, minY, maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }
}

// ============================================
// GraphColors - Unified color scheme
// ============================================
const GraphColors = {
    // Node colors
    node: {
        fill: '#2f2f4a',
        stroke: '#404060',
        text: '#e8e8e8',
        selectedStroke: '#4a9eff',
        hoverStroke: '#4a9eff'
    },
    // Node type colors
    nodeTypes: {
        start: {
            fill: '#3a7ecc',
            stroke: '#4a9eff'
        },
        ending: {
            stroke: '#888',
            strokeDasharray: '4 2'
        },
        missing: {
            fill: 'transparent',
            stroke: '#ff9800',
            strokeDasharray: '4 2',
            text: '#ff9800'
        },
        battle: {
            stroke: '#f44336'
        },
        dice: {
            stroke: '#ff9800'
        }
    },
    // Edge colors
    edge: {
        choice: '#4a9eff',
        success: '#4caf50',
        failure: '#f44336'
    },
    // Background
    background: '#1a1a2e',
    grid: '#404060'
};

// ============================================
// GraphRenderer - SVG rendering utilities
// ============================================
const GraphRenderer = {
    /**
     * Create an SVG element
     */
    createSvgElement(tag) {
        return document.createElementNS('http://www.w3.org/2000/svg', tag);
    },

    /**
     * Render a node to SVG
     */
    renderNode(node, options = {}) {
        const {
            nodeWidth = 140,
            nodeHeight = 40,
            isSelected = false,
            colors = GraphColors
        } = options;

        const group = this.createSvgElement('g');
        group.classList.add('graph-node');
        group.dataset.nodeId = node.id;

        if (!node.exists) group.classList.add('missing');
        if (node.isStart) group.classList.add('start');
        if (node.isEnding) group.classList.add('ending');
        if (node.type === 'battle') group.classList.add('battle');
        if (node.type === 'dice') group.classList.add('dice');
        if (isSelected) group.classList.add('selected');

        // Determine colors
        let fill = colors.node.fill;
        let stroke = colors.node.stroke;
        let strokeDasharray = null;
        let textColor = colors.node.text;

        if (node.isStart && node.exists) {
            fill = colors.nodeTypes.start.fill;
            stroke = colors.nodeTypes.start.stroke;
        }
        if (!node.exists) {
            fill = colors.nodeTypes.missing.fill;
            stroke = colors.nodeTypes.missing.stroke;
            strokeDasharray = colors.nodeTypes.missing.strokeDasharray;
            textColor = colors.nodeTypes.missing.text;
        }
        if (node.type === 'battle') {
            stroke = colors.nodeTypes.battle.stroke;
        }
        if (node.type === 'dice') {
            stroke = colors.nodeTypes.dice.stroke;
        }
        if (node.isEnding && node.exists && !node.isStart) {
            strokeDasharray = colors.nodeTypes.ending.strokeDasharray;
        }
        if (isSelected) {
            stroke = colors.node.selectedStroke;
        }

        // Rectangle
        const rect = this.createSvgElement('rect');
        rect.setAttribute('x', node.x - nodeWidth / 2);
        rect.setAttribute('y', node.y - nodeHeight / 2);
        rect.setAttribute('width', nodeWidth);
        rect.setAttribute('height', nodeHeight);
        rect.setAttribute('rx', '6');
        rect.setAttribute('fill', fill);
        rect.setAttribute('stroke', stroke);
        rect.setAttribute('stroke-width', isSelected ? '2.5' : '1.5');
        if (strokeDasharray) {
            rect.setAttribute('stroke-dasharray', strokeDasharray);
        }
        group.appendChild(rect);

        // Label
        const text = this.createSvgElement('text');
        text.setAttribute('x', node.x);
        text.setAttribute('y', node.y);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('fill', textColor);
        text.setAttribute('font-size', '11px');
        text.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, sans-serif');
        text.setAttribute('pointer-events', 'none');

        let displayName = node.id;
        const maxChars = Math.floor(nodeWidth / 8);
        if (displayName.length > maxChars) {
            displayName = displayName.substring(0, maxChars - 2) + '...';
        }
        text.textContent = displayName;
        group.appendChild(text);

        return group;
    },

    /**
     * Render an edge to SVG
     */
    renderEdge(edge, fromNode, toNode, options = {}) {
        const {
            nodeWidth = 140,
            isSelected = false,
            colors = GraphColors
        } = options;

        const group = this.createSvgElement('g');
        group.classList.add('graph-edge');
        group.dataset.from = edge.from;
        group.dataset.to = edge.to;
        group.dataset.type = edge.type;

        const color = colors.edge[edge.type] || colors.edge.choice;

        // Calculate path
        const startX = fromNode.x + nodeWidth / 2;
        const startY = fromNode.y;
        const endX = toNode.x - nodeWidth / 2;
        const endY = toNode.y;

        const dx = endX - startX;
        const controlOffset = Math.min(Math.abs(dx) * 0.5, 100);

        const pathD = `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;

        // Draw line
        const path = this.createSvgElement('path');
        path.setAttribute('d', pathD);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', isSelected ? '3' : '2');
        group.appendChild(path);

        // Draw arrow
        const arrowSize = 8;
        const arrow = this.createSvgElement('polygon');
        arrow.setAttribute('points', `${endX},${endY} ${endX + arrowSize},${endY - arrowSize/2} ${endX + arrowSize},${endY + arrowSize/2}`);
        arrow.setAttribute('fill', color);
        group.appendChild(arrow);

        return group;
    },

    /**
     * Render complete graph to SVG
     */
    renderGraph(svg, graphData, options = {}) {
        const {
            zoom = 1,
            panX = 0,
            panY = 0,
            selectedNode = null,
            selectedEdge = null,
            nodeWidth = 140,
            nodeHeight = 40,
            colors = GraphColors
        } = options;

        const rect = svg.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
        svg.innerHTML = '';

        // Create transform group
        const g = this.createSvgElement('g');
        g.setAttribute('transform', `translate(${panX}, ${panY}) scale(${zoom})`);
        g.id = 'graph-group';

        // Draw edges first
        for (const edge of graphData.edges) {
            const fromNode = graphData.nodes.get(edge.from);
            const toNode = graphData.nodes.get(edge.to);
            if (fromNode && toNode) {
                const isEdgeSelected = selectedEdge &&
                    selectedEdge.from === edge.from &&
                    selectedEdge.to === edge.to;
                const edgeEl = this.renderEdge(edge, fromNode, toNode, {
                    nodeWidth,
                    isSelected: isEdgeSelected,
                    colors
                });
                g.appendChild(edgeEl);
            }
        }

        // Draw nodes
        for (const node of graphData.nodes.values()) {
            const nodeEl = this.renderNode(node, {
                nodeWidth,
                nodeHeight,
                isSelected: selectedNode === node.id,
                colors
            });
            g.appendChild(nodeEl);
        }

        svg.appendChild(g);
    },

    /**
     * Convert screen coordinates to graph coordinates
     */
    screenToGraph(svg, x, y, zoom, panX, panY) {
        const rect = svg.getBoundingClientRect();
        return {
            x: (x - rect.left - panX) / zoom,
            y: (y - rect.top - panY) / zoom
        };
    },

    /**
     * Find node at screen position
     */
    findNodeAt(svg, graphData, x, y, zoom, panX, panY, nodeWidth = 140, nodeHeight = 40) {
        const pos = this.screenToGraph(svg, x, y, zoom, panX, panY);

        for (const node of graphData.nodes.values()) {
            if (pos.x >= node.x - nodeWidth / 2 &&
                pos.x <= node.x + nodeWidth / 2 &&
                pos.y >= node.y - nodeHeight / 2 &&
                pos.y <= node.y + nodeHeight / 2) {
                return node;
            }
        }
        return null;
    }
};

// ============================================
// SceneGraphBuilder - Convenience wrapper
// ============================================
const SceneGraphBuilder = {
    /**
     * Build a graph from scenes with optional auto-layout
     * @param {Object} scenes - Scene data
     * @param {Object} options - Layout options
     * @returns {GraphData}
     */
    build(scenes, options = {}) {
        const graph = new GraphData();
        graph.buildFromScenes(scenes);
        if (options.autoLayout !== false) {
            graph.autoLayout(options);
        }
        return graph;
    },

    /**
     * Check if a target is a special target (not a real scene)
     */
    isSpecialTarget(target) {
        return SPECIAL_TARGETS.has(target);
    },

    /**
     * Get the set of special targets
     */
    getSpecialTargets() {
        return new Set(SPECIAL_TARGETS);
    }
};

// ============================================
// Export
// ============================================
const GraphModule = {
    GraphData,
    GraphColors,
    GraphRenderer,
    SceneGraphBuilder,
    SPECIAL_TARGETS
};

// Support both browser globals and CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GraphModule;
} else {
    global.GraphModule = GraphModule;
}

})(typeof window !== 'undefined' ? window : global);
