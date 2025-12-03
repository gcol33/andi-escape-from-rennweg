/**
 * Unit tests for Node Editor - GraphModel
 *
 * Run with: node --experimental-vm-modules node_modules/jest/bin/jest.js editor/node_editor.test.js
 * Or with Vitest: npx vitest editor/node_editor.test.js
 */

import { GraphModel } from './node_editor.js';

describe('GraphModel', () => {
    let model;

    beforeEach(() => {
        model = new GraphModel();
    });

    describe('loadScenes', () => {
        it('should create nodes for each scene', () => {
            const scenes = {
                scene1: { id: 'scene1', choices: [] },
                scene2: { id: 'scene2', choices: [] }
            };

            model.loadScenes(scenes);

            expect(model.nodes.size).toBe(2);
            expect(model.nodes.has('scene1')).toBe(true);
            expect(model.nodes.has('scene2')).toBe(true);
        });

        it('should create edges from choices', () => {
            const scenes = {
                scene1: {
                    id: 'scene1',
                    choices: [
                        { label: 'Go to scene2', target: 'scene2' }
                    ]
                },
                scene2: { id: 'scene2', choices: [] }
            };

            model.loadScenes(scenes);

            expect(model.edges.length).toBe(1);
            expect(model.edges[0]).toEqual({
                from: 'scene1',
                to: 'scene2',
                type: 'choice',
                label: 'Go to scene2'
            });
        });

        it('should create placeholder nodes for missing targets', () => {
            const scenes = {
                scene1: {
                    id: 'scene1',
                    choices: [
                        { label: 'Go somewhere', target: 'missing_scene' }
                    ]
                }
            };

            model.loadScenes(scenes);

            expect(model.nodes.size).toBe(2);
            expect(model.nodes.get('missing_scene').exists).toBe(false);
        });

        it('should mark start nodes correctly', () => {
            const scenes = {
                start: {
                    id: 'start',
                    choices: [{ target: 'middle' }]
                },
                middle: {
                    id: 'middle',
                    choices: [{ target: 'end' }]
                },
                end: { id: 'end', choices: [] }
            };

            model.loadScenes(scenes);

            expect(model.nodes.get('start').isStart).toBe(true);
            expect(model.nodes.get('middle').isStart).toBe(false);
            expect(model.nodes.get('end').isStart).toBe(false);
        });

        it('should mark ending nodes correctly', () => {
            const scenes = {
                start: {
                    id: 'start',
                    choices: [{ target: 'middle' }]
                },
                middle: {
                    id: 'middle',
                    choices: [{ target: 'end' }]
                },
                end: { id: 'end', choices: [] }
            };

            model.loadScenes(scenes);

            expect(model.nodes.get('start').isEnding).toBe(false);
            expect(model.nodes.get('middle').isEnding).toBe(false);
            expect(model.nodes.get('end').isEnding).toBe(true);
        });

        it('should detect battle scene type', () => {
            const scenes = {
                battle: {
                    id: 'battle',
                    actions: [{ type: 'start_battle', on_win: 'win', on_lose: 'lose' }]
                },
                win: { id: 'win', choices: [] },
                lose: { id: 'lose', choices: [] }
            };

            model.loadScenes(scenes);

            expect(model.nodes.get('battle').type).toBe('battle');
        });

        it('should detect dice scene type', () => {
            const scenes = {
                dice: {
                    id: 'dice',
                    actions: [{ type: 'dice_roll', on_success: 'win', on_failure: 'lose' }]
                },
                win: { id: 'win', choices: [] },
                lose: { id: 'lose', choices: [] }
            };

            model.loadScenes(scenes);

            expect(model.nodes.get('dice').type).toBe('dice');
        });

        it('should create success/failure edges from actions', () => {
            const scenes = {
                battle: {
                    id: 'battle',
                    actions: [{ type: 'start_battle', on_win: 'win', on_lose: 'lose' }]
                },
                win: { id: 'win', choices: [] },
                lose: { id: 'lose', choices: [] }
            };

            model.loadScenes(scenes);

            const successEdge = model.edges.find(e => e.type === 'success');
            const failureEdge = model.edges.find(e => e.type === 'failure');

            expect(successEdge).toBeDefined();
            expect(successEdge.from).toBe('battle');
            expect(successEdge.to).toBe('win');

            expect(failureEdge).toBeDefined();
            expect(failureEdge.from).toBe('battle');
            expect(failureEdge.to).toBe('lose');
        });

        it('should skip _roll targets', () => {
            const scenes = {
                dice: {
                    id: 'dice',
                    choices: [{ target: '_roll' }]
                }
            };

            model.loadScenes(scenes);

            expect(model.edges.length).toBe(0);
        });
    });

    describe('addNode', () => {
        it('should add a new node', () => {
            const result = model.addNode('new_scene', 'scene');

            expect(result).toBe(true);
            expect(model.nodes.has('new_scene')).toBe(true);
            expect(model.nodes.get('new_scene').type).toBe('scene');
        });

        it('should create corresponding scene data', () => {
            model.addNode('new_scene', 'battle');

            expect(model.scenes['new_scene']).toBeDefined();
            expect(model.scenes['new_scene'].id).toBe('new_scene');
        });

        it('should return false for duplicate nodes', () => {
            model.addNode('scene1');
            const result = model.addNode('scene1');

            expect(result).toBe(false);
        });

        it('should mark new nodes as start and ending', () => {
            model.addNode('isolated');

            expect(model.nodes.get('isolated').isStart).toBe(true);
            expect(model.nodes.get('isolated').isEnding).toBe(true);
        });
    });

    describe('deleteNode', () => {
        beforeEach(() => {
            model.loadScenes({
                scene1: { id: 'scene1', choices: [{ target: 'scene2' }] },
                scene2: { id: 'scene2', choices: [] }
            });
        });

        it('should remove the node', () => {
            model.deleteNode('scene2');

            expect(model.nodes.has('scene2')).toBe(false);
        });

        it('should remove scene data', () => {
            model.deleteNode('scene2');

            expect(model.scenes['scene2']).toBeUndefined();
        });

        it('should remove connected edges', () => {
            model.deleteNode('scene2');

            expect(model.edges.length).toBe(0);
        });

        it('should return false for non-existent nodes', () => {
            const result = model.deleteNode('nonexistent');

            expect(result).toBe(false);
        });
    });

    describe('connect', () => {
        beforeEach(() => {
            model.loadScenes({
                scene1: { id: 'scene1', choices: [] },
                scene2: { id: 'scene2', choices: [] }
            });
        });

        it('should create an edge between nodes', () => {
            model.connect('scene1', 'scene2', 'choice', 'Go there');

            const edge = model.edges.find(e => e.from === 'scene1' && e.to === 'scene2');
            expect(edge).toBeDefined();
            expect(edge.type).toBe('choice');
            expect(edge.label).toBe('Go there');
        });

        it('should update scene choices for choice edges', () => {
            model.connect('scene1', 'scene2', 'choice', 'Go there');

            expect(model.scenes['scene1'].choices.length).toBe(1);
            expect(model.scenes['scene1'].choices[0].target).toBe('scene2');
        });

        it('should update isStart/isEnding flags', () => {
            model.connect('scene1', 'scene2', 'choice');

            expect(model.nodes.get('scene1').isEnding).toBe(false);
            expect(model.nodes.get('scene2').isStart).toBe(false);
        });

        it('should return false for duplicate connections', () => {
            model.connect('scene1', 'scene2', 'choice');
            const result = model.connect('scene1', 'scene2', 'choice');

            expect(result).toBe(false);
        });

        it('should return false for invalid node IDs', () => {
            const result = model.connect('scene1', 'nonexistent', 'choice');

            expect(result).toBe(false);
        });
    });

    describe('deleteEdge', () => {
        beforeEach(() => {
            model.loadScenes({
                scene1: { id: 'scene1', choices: [{ target: 'scene2', label: 'Go' }] },
                scene2: { id: 'scene2', choices: [] }
            });
        });

        it('should remove the edge', () => {
            model.deleteEdge('scene1', 'scene2', 'choice');

            expect(model.edges.length).toBe(0);
        });

        it('should update scene choices', () => {
            model.deleteEdge('scene1', 'scene2', 'choice');

            expect(model.scenes['scene1'].choices.length).toBe(0);
        });

        it('should return false for non-existent edges', () => {
            const result = model.deleteEdge('scene1', 'scene2', 'success');

            expect(result).toBe(false);
        });
    });

    describe('autoLayout', () => {
        it('should position nodes at different levels', () => {
            model.loadScenes({
                start: { id: 'start', choices: [{ target: 'middle' }] },
                middle: { id: 'middle', choices: [{ target: 'end' }] },
                end: { id: 'end', choices: [] }
            });

            model.autoLayout();

            const startX = model.nodes.get('start').x;
            const middleX = model.nodes.get('middle').x;
            const endX = model.nodes.get('end').x;

            expect(startX).toBeLessThan(middleX);
            expect(middleX).toBeLessThan(endX);
        });

        it('should handle disconnected nodes', () => {
            model.loadScenes({
                scene1: { id: 'scene1', choices: [] },
                scene2: { id: 'scene2', choices: [] }
            });

            // Should not throw
            expect(() => model.autoLayout()).not.toThrow();
        });

        it('should handle empty graph', () => {
            model.loadScenes({});

            expect(() => model.autoLayout()).not.toThrow();
        });
    });

    describe('getBounds', () => {
        it('should return bounding box of all nodes', () => {
            model.addNode('node1');
            model.addNode('node2');
            model.nodes.get('node1').x = 0;
            model.nodes.get('node1').y = 0;
            model.nodes.get('node2').x = 200;
            model.nodes.get('node2').y = 100;

            const bounds = model.getBounds();

            expect(bounds.minX).toBeLessThan(bounds.maxX);
            expect(bounds.minY).toBeLessThan(bounds.maxY);
        });

        it('should return zeros for empty graph', () => {
            const bounds = model.getBounds();

            expect(bounds).toEqual({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
        });
    });

    describe('getSceneType', () => {
        it('should return scene for regular scenes', () => {
            const type = model.getSceneType({ choices: [] });
            expect(type).toBe('scene');
        });

        it('should return battle for battle scenes', () => {
            const type = model.getSceneType({
                actions: [{ type: 'start_battle' }]
            });
            expect(type).toBe('battle');
        });

        it('should return dice for dice roll scenes', () => {
            const type = model.getSceneType({
                actions: [{ type: 'dice_roll' }]
            });
            expect(type).toBe('dice');
        });

        it('should return scene for scenes with empty actions', () => {
            const type = model.getSceneType({ actions: [] });
            expect(type).toBe('scene');
        });
    });
});
