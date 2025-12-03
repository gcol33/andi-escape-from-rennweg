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
     * Auto-layout nodes using longest-path depth calculation
     * This ensures consistent layout between main editor and node editor
     */
    autoLayout(options = {}) {
        const {
            horizontalSpacing = 180,
            verticalSpacing = 50,
            startX = 100,
            centerY = 0  // Will be adjusted based on container if provided
        } = options;

        const nodeList = Array.from(this.nodes.values());
        if (nodeList.length === 0) return;

        // Build adjacency maps
        const outgoing = new Map();
        const incoming = new Map();
        const nodeIds = new Set(nodeList.map(n => n.id));

        // Initialize maps for all nodes
        for (const node of nodeList) {
            outgoing.set(node.id, []);
            incoming.set(node.id, []);
        }

        // Add edges only between known nodes
        for (const edge of this.edges) {
            if (nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
                outgoing.get(edge.from).push(edge.to);
                incoming.get(edge.to).push(edge.from);
            }
        }

        // Calculate depth using longest path from any root
        // We need to ensure children always come after their parents
        const depth = new Map();
        const inProgress = new Set(); // For cycle detection

        const calcDepth = (nodeId, currentDepth) => {
            // Cycle detection - don't recurse into nodes we're currently processing
            if (inProgress.has(nodeId)) {
                return;
            }

            const existingDepth = depth.get(nodeId) || 0;

            // Only process if this path gives us a greater depth
            if (currentDepth <= existingDepth && depth.has(nodeId)) {
                return;
            }

            depth.set(nodeId, currentDepth);
            inProgress.add(nodeId);

            const targets = outgoing.get(nodeId) || [];
            for (const targetId of targets) {
                calcDepth(targetId, currentDepth + 1);
            }

            inProgress.delete(nodeId);
        };

        // Start from nodes with no incoming edges (roots)
        const roots = nodeList.filter(n => (incoming.get(n.id) || []).length === 0);
        if (roots.length === 0 && nodeList.length > 0) {
            // No clear roots, start from first node
            roots.push(nodeList[0]);
        }

        for (const root of roots) {
            calcDepth(root.id, 0);
        }

        // Handle any unvisited nodes (disconnected or in cycles)
        for (const node of nodeList) {
            if (!depth.has(node.id)) {
                calcDepth(node.id, 0);
            }
        }

        // Group nodes by depth (layer)
        const layers = new Map();
        for (const node of nodeList) {
            const d = depth.get(node.id) || 0;
            if (!layers.has(d)) layers.set(d, []);
            layers.get(d).push(node.id);
        }

        // Sort layer indices
        const layerIndices = Array.from(layers.keys()).sort((a, b) => a - b);

        // Position nodes
        for (let i = 0; i < layerIndices.length; i++) {
            const layerIdx = layerIndices[i];
            const layer = layers.get(layerIdx);
            const layerHeight = layer.length * verticalSpacing;
            const layerStartY = centerY - layerHeight / 2 + verticalSpacing / 2;

            layer.forEach((nodeId, nodeIndex) => {
                const node = this.nodes.get(nodeId);
                node.x = startX + i * horizontalSpacing;
                node.y = layerStartY + nodeIndex * verticalSpacing;
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
// ChainCompressor - Linear chain compression
// ============================================
const ChainCompressor = {
    /**
     * Compress linear chains (nodes with exactly 1 in and 1 out edge) into single nodes
     * @param {Object} nodes - Node map keyed by ID
     * @param {Array} edges - Edge array
     * @param {Set} expandedChains - Set of chain IDs that should remain expanded
     * @returns {Object} { nodes, edges, chains }
     */
    compress(nodes, edges, expandedChains = new Set()) {
        // Build adjacency
        const outgoing = {}; // nodeId -> [{ to, edge }]
        const incoming = {}; // nodeId -> [{ from, edge }]

        Object.keys(nodes).forEach(id => {
            outgoing[id] = [];
            incoming[id] = [];
        });

        edges.forEach(edge => {
            if (outgoing[edge.from]) outgoing[edge.from].push({ to: edge.to, edge });
            if (incoming[edge.to]) incoming[edge.to].push({ from: edge.from, edge });
        });

        // Find chain-able nodes: exactly 1 incoming, exactly 1 outgoing, same edge type
        const isChainable = (nodeId) => {
            const node = nodes[nodeId];
            if (!node || !node.exists) return false;
            if (node.isStart || node.isEnding) return false;
            if (node.hasFlags) return false; // Don't compress nodes with flags
            const inc = incoming[nodeId];
            const out = outgoing[nodeId];
            if (inc.length !== 1 || out.length !== 1) return false;
            // Must be same edge type (all choices)
            if (inc[0].edge.type !== 'choice' || out[0].edge.type !== 'choice') return false;
            return true;
        };

        // Find chains
        const visited = new Set();
        const chains = {};
        let chainId = 0;

        Object.keys(nodes).forEach(startId => {
            if (visited.has(startId)) return;
            if (!nodes[startId].exists) return;

            // Try to build a chain starting from this node
            const chain = [];
            let current = startId;

            // First, go backwards to find the start of any chain this node is part of
            while (true) {
                const inc = incoming[current];
                if (inc.length !== 1) break;
                const prevId = inc[0].from;
                if (!isChainable(prevId) && !isChainable(current)) break;
                if (visited.has(prevId)) break;
                current = prevId;
            }

            // Now go forward and collect the chain
            while (true) {
                if (visited.has(current)) break;

                const out = outgoing[current];
                if (out.length !== 1) {
                    // End of potential chain - only add if chainable
                    if (chain.length > 0 && isChainable(current)) {
                        chain.push(current);
                        visited.add(current);
                    }
                    break;
                }

                const nextId = out[0].to;

                // Current node can be part of chain if it's chainable
                if (isChainable(current)) {
                    chain.push(current);
                    visited.add(current);
                    current = nextId;
                } else {
                    // Not chainable, but might start a new chain
                    if (chain.length > 0) break;
                    current = nextId;
                }
            }

            // Only create chain if we have 2+ consecutive chainable nodes
            // All nodes in a valid chain must have exactly 1 outgoing edge
            if (chain.length >= 2) {
                const lastNode = chain[chain.length - 1];
                const lastOut = outgoing[lastNode];
                const firstIn = incoming[chain[0]];

                // Only create chain if first has incoming and last has outgoing
                if (firstIn && firstIn.length > 0 && lastOut && lastOut.length > 0) {
                    const id = `chain_${chainId++}`;
                    chains[id] = {
                        nodes: chain,
                        start: firstIn[0].from,
                        end: lastOut[0].to,
                        startEdge: firstIn[0].edge,
                        endEdge: lastOut[0].edge
                    };
                }
            }
        });

        // Build new nodes and edges
        const newNodes = {};
        const newEdges = [];
        const chainedNodes = new Set();

        // Mark all nodes that are part of chains
        Object.values(chains).forEach(chain => {
            chain.nodes.forEach(id => chainedNodes.add(id));
        });

        // Add non-chained nodes
        Object.keys(nodes).forEach(id => {
            if (!chainedNodes.has(id)) {
                newNodes[id] = { ...nodes[id] };
            }
        });

        // Add chain nodes (or expanded chain nodes)
        Object.entries(chains).forEach(([chainId, chain]) => {
            if (expandedChains.has(chainId)) {
                // Expanded - add all individual nodes
                chain.nodes.forEach(id => {
                    newNodes[id] = { ...nodes[id] };
                });
            } else {
                // Collapsed - add single chain node with display name showing first → ... → last
                const firstName = chain.nodes[0];
                const lastName = chain.nodes[chain.nodes.length - 1];
                newNodes[chainId] = {
                    id: chainId,
                    exists: true,
                    isChain: true,
                    chainNodes: chain.nodes,
                    chainLength: chain.nodes.length,
                    displayName: `${firstName} → ... → ${lastName}`,
                    shortName: `${firstName} → ${lastName}`
                };
            }
        });

        // Add edges
        edges.forEach(edge => {
            // Find which chain (if any) contains from/to
            let fromChainId = null, toChainId = null;
            Object.entries(chains).forEach(([cid, chain]) => {
                if (chain.nodes.includes(edge.from)) fromChainId = cid;
                if (chain.nodes.includes(edge.to)) toChainId = cid;
            });

            // Skip internal chain edges
            if (fromChainId && toChainId && fromChainId === toChainId && !expandedChains.has(fromChainId)) {
                return;
            }

            let newFrom = edge.from;
            let newTo = edge.to;

            // Replace with chain node if collapsed
            if (fromChainId && !expandedChains.has(fromChainId)) {
                // Only if this is the exit edge from the chain
                const chain = chains[fromChainId];
                if (edge.from === chain.nodes[chain.nodes.length - 1]) {
                    newFrom = fromChainId;
                } else {
                    return; // Internal edge, skip
                }
            }
            if (toChainId && !expandedChains.has(toChainId)) {
                // Only if this is the entry edge to the chain
                const chain = chains[toChainId];
                if (edge.to === chain.nodes[0]) {
                    newTo = toChainId;
                } else {
                    return; // Internal edge, skip
                }
            }

            // Avoid duplicate edges
            const edgeKey = `${newFrom}->${newTo}`;
            if (!newEdges.find(e => `${e.from}->${e.to}` === edgeKey)) {
                newEdges.push({ ...edge, from: newFrom, to: newTo });
            }
        });

        return { nodes: newNodes, edges: newEdges, chains };
    },

    /**
     * Find which chain a node belongs to
     * @param {string} nodeId - Node ID to look for
     * @param {Object} chains - Chains object from compress()
     * @returns {string|null} Chain ID or null
     */
    findChainForNode(nodeId, chains) {
        for (const [chainId, chain] of Object.entries(chains)) {
            if (chain.nodes.includes(nodeId)) {
                return chainId;
            }
        }
        return null;
    },

    /**
     * Get all chain IDs
     * @param {Object} chains - Chains object from compress()
     * @returns {Array<string>} Array of chain IDs
     */
    getChainIds(chains) {
        return Object.keys(chains);
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
    ChainCompressor,
    SPECIAL_TARGETS
};

// Support both browser globals and CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GraphModule;
} else {
    global.GraphModule = GraphModule;
}

})(typeof window !== 'undefined' ? window : global);
