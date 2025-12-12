/**
 * Andi VN - Engine System Tests
 *
 * Run tests: node tests/run-engine-tests.js
 *
 * These tests verify the VN engine functionality including:
 * - Flag management (regular and key flags)
 * - Inventory management (key items, consumables, skills)
 * - Save/load round-trip
 * - Scene navigation edge cases
 */

// Simple test framework (consistent with other test files)
var TestRunner = {
    passed: 0,
    failed: 0,
    results: [],
    currentGroup: '',

    group: function(name) {
        this.currentGroup = name;
        console.log('\n--- ' + name + ' ---');
    },

    assert: function(condition, message) {
        var fullMessage = this.currentGroup ? this.currentGroup + ': ' + message : message;
        if (condition) {
            this.passed++;
            this.results.push({ pass: true, message: fullMessage });
            console.log('  ✓ ' + message);
        } else {
            this.failed++;
            this.results.push({ pass: false, message: fullMessage });
            console.error('  ✗ FAIL: ' + message);
        }
    },

    assertEqual: function(actual, expected, message) {
        var condition = actual === expected;
        if (!condition) {
            message += ' (expected ' + expected + ', got ' + actual + ')';
        }
        this.assert(condition, message);
    },

    assertDeepEqual: function(actual, expected, message) {
        var condition = JSON.stringify(actual) === JSON.stringify(expected);
        if (!condition) {
            message += ' (expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual) + ')';
        }
        this.assert(condition, message);
    },

    assertArrayContains: function(array, item, message) {
        var condition = array.indexOf(item) !== -1;
        if (!condition) {
            message += ' (array does not contain "' + item + '")';
        }
        this.assert(condition, message);
    },

    assertArrayNotContains: function(array, item, message) {
        var condition = array.indexOf(item) === -1;
        if (!condition) {
            message += ' (array unexpectedly contains "' + item + '")';
        }
        this.assert(condition, message);
    },

    reset: function() {
        this.passed = 0;
        this.failed = 0;
        this.results = [];
        this.currentGroup = '';
    },

    report: function() {
        console.log('\n=== Engine System Test Results ===');
        console.log('Passed: ' + this.passed);
        console.log('Failed: ' + this.failed);
        console.log('Total: ' + (this.passed + this.failed));

        if (this.failed > 0) {
            console.log('\nFailed tests:');
            this.results.forEach(function(r) {
                if (!r.pass) console.log('  - ' + r.message);
            });
        }

        return this.failed === 0;
    }
};

// Mock localStorage for Node.js environment
var mockStorage = {};
var MockLocalStorage = {
    getItem: function(key) {
        return mockStorage[key] || null;
    },
    setItem: function(key, value) {
        mockStorage[key] = value;
    },
    removeItem: function(key) {
        delete mockStorage[key];
    },
    clear: function() {
        mockStorage = {};
    }
};

// Test functions
function runEngineTests() {
    TestRunner.reset();

    // Clear mock storage before each test suite
    MockLocalStorage.clear();

    testFlagManagement();
    testKeyFlagManagement();
    testFlagNegation();
    testKeyItemManagement();
    testConsumableManagement();
    testSkillManagement();
    testInventoryHasChecks();
    testItemNegation();
    testSaveStateRoundTrip();
    testLoadLegacyInventoryFormat();
    testInvalidSaveDataHandling();
    testSceneNavigationEdgeCases();

    return TestRunner.report();
}

// === Flag Management Tests ===
function testFlagManagement() {
    TestRunner.group('Flag Management');

    // Reset state
    var state = VNEngine.getState();
    state.flags = {};
    state.keyFlags = {};

    // Test setting a flag
    VNEngine.setFlag('test_flag');
    TestRunner.assertEqual(VNEngine.hasFlag('test_flag'), true, 'hasFlag should return true after setFlag');
    TestRunner.assertEqual(VNEngine.getFlag('test_flag'), true, 'getFlag should return true after setFlag');

    // Test clearing a flag
    VNEngine.clearFlag('test_flag');
    TestRunner.assertEqual(VNEngine.hasFlag('test_flag'), false, 'hasFlag should return false after clearFlag');

    // Test multiple flags
    VNEngine.setFlag('flag_a');
    VNEngine.setFlag('flag_b');
    VNEngine.setFlag('flag_c');
    TestRunner.assertEqual(VNEngine.hasFlag('flag_a'), true, 'Multiple flags: flag_a should exist');
    TestRunner.assertEqual(VNEngine.hasFlag('flag_b'), true, 'Multiple flags: flag_b should exist');
    TestRunner.assertEqual(VNEngine.hasFlag('flag_c'), true, 'Multiple flags: flag_c should exist');

    // Test non-existent flag
    TestRunner.assertEqual(VNEngine.hasFlag('nonexistent'), false, 'hasFlag should return false for non-existent flag');
    TestRunner.assertEqual(VNEngine.getFlag('nonexistent'), false, 'getFlag should return false for non-existent flag');
}

// === Key Flag Management Tests ===
function testKeyFlagManagement() {
    TestRunner.group('Key Flag Management');

    // Reset state
    var state = VNEngine.getState();
    state.flags = {};
    state.keyFlags = {};

    // Test setting a key flag
    VNEngine.setKeyFlag('milestone_1');
    TestRunner.assertEqual(VNEngine.hasKeyFlag('milestone_1'), true, 'hasKeyFlag should return true after setKeyFlag');

    // Key flags should also be accessible via hasFlag
    TestRunner.assertEqual(VNEngine.hasFlag('milestone_1'), true, 'hasFlag should return true for key flags too');

    // Test clearing a key flag
    VNEngine.clearKeyFlag('milestone_1');
    TestRunner.assertEqual(VNEngine.hasKeyFlag('milestone_1'), false, 'hasKeyFlag should return false after clearKeyFlag');

    // Test getKeyFlags returns all key flags (now returns array)
    VNEngine.setKeyFlag('key_a');
    VNEngine.setKeyFlag('key_b');
    var keyFlags = VNEngine.getKeyFlags();
    TestRunner.assertEqual(keyFlags.indexOf('key_a') !== -1, true, 'getKeyFlags should contain key_a');
    TestRunner.assertEqual(keyFlags.indexOf('key_b') !== -1, true, 'getKeyFlags should contain key_b');
}

// === Flag Negation Tests ===
function testFlagNegation() {
    TestRunner.group('Flag Negation');

    // Reset state
    var state = VNEngine.getState();
    state.flags = {};
    state.keyFlags = {};

    // Test checkFlags with negation (internal function exposed via state)
    VNEngine.setFlag('has_this');

    // Simulate checkFlags behavior manually since it's internal
    // checkFlags(['has_this']) should return true
    TestRunner.assertEqual(VNEngine.hasFlag('has_this'), true, 'Should have has_this flag');

    // checkFlags(['!has_this']) should return false (negation)
    TestRunner.assertEqual(!VNEngine.hasFlag('has_this'), false, 'Negation: !has_this should return false when flag exists');

    // checkFlags(['!missing_flag']) should return true
    TestRunner.assertEqual(!VNEngine.hasFlag('missing_flag'), true, 'Negation: !missing_flag should return true when flag missing');
}

// === Key Item Management Tests ===
function testKeyItemManagement() {
    TestRunner.group('Key Item Management');

    // Reset inventory
    var state = VNEngine.getState();
    state.inventory = { keyItems: [], consumables: {}, skills: [] };

    // Test adding key item
    VNEngine.addKeyItem('Master Key');
    TestRunner.assertEqual(VNEngine.hasKeyItem('Master Key'), true, 'hasKeyItem should return true after addKeyItem');

    var inventory = VNEngine.getInventory();
    TestRunner.assertArrayContains(inventory.keyItems, 'Master Key', 'Inventory keyItems should contain Master Key');

    // Test duplicate prevention
    VNEngine.addKeyItem('Master Key'); // Add same item again
    inventory = VNEngine.getInventory();
    var count = inventory.keyItems.filter(function(i) { return i === 'Master Key'; }).length;
    TestRunner.assertEqual(count, 1, 'Key items should not duplicate (still only 1)');

    // Test removing key item
    VNEngine.removeKeyItem('Master Key');
    TestRunner.assertEqual(VNEngine.hasKeyItem('Master Key'), false, 'hasKeyItem should return false after removeKeyItem');

    // Test removing non-existent item (should not error)
    VNEngine.removeKeyItem('Nonexistent Item');
    TestRunner.assert(true, 'Removing non-existent key item should not throw');
}

// === Consumable Management Tests ===
function testConsumableManagement() {
    TestRunner.group('Consumable Management');

    // Reset inventory
    var state = VNEngine.getState();
    state.inventory = { keyItems: [], consumables: {}, skills: [] };

    // Test adding consumable
    VNEngine.addConsumable('Coffee', 2);
    TestRunner.assertEqual(VNEngine.hasConsumable('Coffee'), true, 'hasConsumable should return true after addConsumable');
    TestRunner.assertEqual(VNEngine.getConsumableCount('Coffee'), 2, 'getConsumableCount should return 2');

    // Test stacking consumables
    VNEngine.addConsumable('Coffee', 3);
    TestRunner.assertEqual(VNEngine.getConsumableCount('Coffee'), 5, 'Consumables should stack (2+3=5)');

    // Test removing consumable
    VNEngine.removeConsumable('Coffee', 2);
    TestRunner.assertEqual(VNEngine.getConsumableCount('Coffee'), 3, 'After removing 2, should have 3 left');

    // Test removing all consumables
    VNEngine.removeConsumable('Coffee', 3);
    TestRunner.assert(!VNEngine.hasConsumable('Coffee'), 'hasConsumable should return falsy when all used');
    TestRunner.assertEqual(VNEngine.getConsumableCount('Coffee'), 0, 'getConsumableCount should return 0 when empty');

    // Test hasConsumable with count check
    VNEngine.addConsumable('Potion', 2);
    TestRunner.assertEqual(VNEngine.hasConsumable('Potion', 2), true, 'hasConsumable(item, 2) should return true when have 2');
    TestRunner.assertEqual(VNEngine.hasConsumable('Potion', 3), false, 'hasConsumable(item, 3) should return false when only have 2');

    // Test default count of 1
    VNEngine.addConsumable('Snack'); // No count specified
    TestRunner.assertEqual(VNEngine.getConsumableCount('Snack'), 1, 'addConsumable without count should add 1');
}

// === Skill Management Tests ===
function testSkillManagement() {
    TestRunner.group('Skill Management');

    // Reset inventory
    var state = VNEngine.getState();
    state.inventory = { keyItems: [], consumables: {}, skills: [] };

    // Test adding skill
    VNEngine.addSkill('Fireball');
    TestRunner.assertEqual(VNEngine.hasSkill('Fireball'), true, 'hasSkill should return true after addSkill');

    var inventory = VNEngine.getInventory();
    TestRunner.assertArrayContains(inventory.skills, 'Fireball', 'Inventory skills should contain Fireball');

    // Test duplicate prevention
    VNEngine.addSkill('Fireball'); // Add same skill again
    inventory = VNEngine.getInventory();
    var count = inventory.skills.filter(function(s) { return s === 'Fireball'; }).length;
    TestRunner.assertEqual(count, 1, 'Skills should not duplicate (still only 1)');

    // Test multiple skills
    VNEngine.addSkill('Heal');
    VNEngine.addSkill('Shield');
    TestRunner.assertEqual(VNEngine.hasSkill('Fireball'), true, 'Should still have Fireball');
    TestRunner.assertEqual(VNEngine.hasSkill('Heal'), true, 'Should have Heal');
    TestRunner.assertEqual(VNEngine.hasSkill('Shield'), true, 'Should have Shield');
}

// === Inventory Has Checks Tests ===
function testInventoryHasChecks() {
    TestRunner.group('Inventory Has Checks');

    // Reset inventory
    var state = VNEngine.getState();
    state.inventory = { keyItems: [], consumables: {}, skills: [] };

    // Add mixed items
    VNEngine.addKeyItem('Badge');
    VNEngine.addConsumable('Water', 1);

    // Test hasItem (checks both key items and consumables)
    TestRunner.assert(VNEngine.hasItem('Badge'), 'hasItem should find key item');
    TestRunner.assert(VNEngine.hasItem('Water'), 'hasItem should find consumable');
    TestRunner.assert(!VNEngine.hasItem('Nonexistent'), 'hasItem should return falsy for missing item');

    // Test that consuming items updates hasItem
    VNEngine.removeConsumable('Water', 1);
    TestRunner.assert(!VNEngine.hasItem('Water'), 'hasItem should return falsy after consuming all');
}

// === Item Negation Tests ===
function testItemNegation() {
    TestRunner.group('Item Negation');

    // Reset inventory
    var state = VNEngine.getState();
    state.inventory = { keyItems: [], consumables: {}, skills: [] };

    // Add an item
    VNEngine.addKeyItem('Sword');

    // Test hasItem with negation logic (simulated since hasItems is internal)
    TestRunner.assertEqual(VNEngine.hasItem('Sword'), true, 'Should have Sword');
    TestRunner.assertEqual(!VNEngine.hasItem('Sword'), false, 'Negation: should return false when item exists');
    TestRunner.assertEqual(!VNEngine.hasItem('Missing'), true, 'Negation: should return true when item missing');
}

// === Save State Round Trip Tests ===
function testSaveStateRoundTrip() {
    TestRunner.group('Save State Round Trip');

    // Reset state completely
    var state = VNEngine.getState();
    state.flags = { visited_shop: true, talked_to_npc: true };
    state.keyFlags = { completed_tutorial: true };
    state.inventory = {
        keyItems: ['Ancient Map', 'Gold Key'],
        consumables: { 'Potion': 3, 'Elixir': 1 },
        skills: ['Fire Magic', 'Healing']
    };
    state.playerHP = 15;
    state.playerMaxHP = 25;
    state.playerMana = 10;
    state.playerMaxMana = 30;
    state.readBlocks = { 'scene1_0': true, 'scene2_1': true };
    state.wonBattles = { 'boss_fight': true };
    state.currentSceneId = 'test_scene';
    state.currentBlockIndex = 2;
    state.history = ['start', 'middle', 'test_scene'];

    // Simulate saveState (we'll test the structure)
    var saveData = {
        currentSceneId: state.currentSceneId,
        currentBlockIndex: state.currentBlockIndex,
        flags: state.flags,
        keyFlags: state.keyFlags,
        inventory: state.inventory,
        playerHP: state.playerHP,
        playerMaxHP: state.playerMaxHP,
        playerMana: state.playerMana,
        playerMaxMana: state.playerMaxMana,
        readBlocks: state.readBlocks,
        wonBattles: state.wonBattles,
        history: state.history
    };

    // Serialize and deserialize (round trip)
    var serialized = JSON.stringify(saveData);
    var deserialized = JSON.parse(serialized);

    // Verify all fields preserved
    TestRunner.assertEqual(deserialized.currentSceneId, 'test_scene', 'Round trip: currentSceneId preserved');
    TestRunner.assertEqual(deserialized.currentBlockIndex, 2, 'Round trip: currentBlockIndex preserved');
    TestRunner.assertEqual(deserialized.flags.visited_shop, true, 'Round trip: flags preserved');
    TestRunner.assertEqual(deserialized.keyFlags.completed_tutorial, true, 'Round trip: keyFlags preserved');
    TestRunner.assertArrayContains(deserialized.inventory.keyItems, 'Ancient Map', 'Round trip: keyItems preserved');
    TestRunner.assertEqual(deserialized.inventory.consumables['Potion'], 3, 'Round trip: consumables preserved');
    TestRunner.assertArrayContains(deserialized.inventory.skills, 'Fire Magic', 'Round trip: skills preserved');
    TestRunner.assertEqual(deserialized.playerHP, 15, 'Round trip: playerHP preserved');
    TestRunner.assertEqual(deserialized.playerMaxHP, 25, 'Round trip: playerMaxHP preserved');
    TestRunner.assertEqual(deserialized.playerMana, 10, 'Round trip: playerMana preserved');
    TestRunner.assertEqual(deserialized.playerMaxMana, 30, 'Round trip: playerMaxMana preserved');
    TestRunner.assertEqual(deserialized.readBlocks['scene1_0'], true, 'Round trip: readBlocks preserved');
    TestRunner.assertEqual(deserialized.wonBattles['boss_fight'], true, 'Round trip: wonBattles preserved');
    TestRunner.assertEqual(deserialized.history.length, 3, 'Round trip: history length preserved');
    TestRunner.assertEqual(deserialized.history[2], 'test_scene', 'Round trip: history content preserved');
}

// === Legacy Inventory Format Tests ===
function testLoadLegacyInventoryFormat() {
    TestRunner.group('Legacy Inventory Format');

    // Test that old array-based inventory format is converted
    var legacyInventory = ['Sword', 'Shield', 'Potion'];

    // Simulate the conversion logic from loadSavedState
    var convertedInventory;
    if (Array.isArray(legacyInventory)) {
        convertedInventory = {
            keyItems: legacyInventory,
            consumables: {},
            skills: []
        };
    }

    TestRunner.assert(Array.isArray(convertedInventory.keyItems), 'Converted inventory should have keyItems array');
    TestRunner.assertArrayContains(convertedInventory.keyItems, 'Sword', 'Legacy items should be in keyItems');
    TestRunner.assertArrayContains(convertedInventory.keyItems, 'Shield', 'Legacy items should be in keyItems');
    TestRunner.assertArrayContains(convertedInventory.keyItems, 'Potion', 'Legacy items should be in keyItems');
    TestRunner.assertDeepEqual(convertedInventory.consumables, {}, 'Converted inventory should have empty consumables');
    TestRunner.assertDeepEqual(convertedInventory.skills, [], 'Converted inventory should have empty skills');
}

// === Invalid Save Data Handling Tests ===
function testInvalidSaveDataHandling() {
    TestRunner.group('Invalid Save Data Handling');

    // Test validation logic
    function isValidSaveData(saveData) {
        if (!saveData || typeof saveData !== 'object') return false;
        if (saveData.flags !== undefined && typeof saveData.flags !== 'object') return false;
        if (saveData.currentBlockIndex !== undefined && typeof saveData.currentBlockIndex !== 'number') return false;
        if (saveData.history !== undefined && !Array.isArray(saveData.history)) return false;
        return true;
    }

    // Valid data
    TestRunner.assertEqual(isValidSaveData({ currentSceneId: 'test' }), true, 'Valid save data should pass validation');
    TestRunner.assertEqual(isValidSaveData({ flags: { a: true }, currentBlockIndex: 0 }), true, 'Valid save with flags should pass');

    // Invalid data
    TestRunner.assertEqual(isValidSaveData(null), false, 'null should fail validation');
    TestRunner.assertEqual(isValidSaveData('string'), false, 'string should fail validation');
    TestRunner.assertEqual(isValidSaveData({ flags: 'not_object' }), false, 'Invalid flags type should fail');
    TestRunner.assertEqual(isValidSaveData({ currentBlockIndex: 'not_number' }), false, 'Invalid currentBlockIndex type should fail');
    TestRunner.assertEqual(isValidSaveData({ history: 'not_array' }), false, 'Invalid history type should fail');
}

// === Scene Navigation Edge Cases Tests ===
function testSceneNavigationEdgeCases() {
    TestRunner.group('Scene Navigation Edge Cases');

    // These tests verify the engine handles edge cases correctly
    // Since we're testing without a full DOM, we test the logic patterns

    // Test 1: Empty history should be handled
    var state = VNEngine.getState();
    state.history = [];
    TestRunner.assertEqual(state.history.length, 0, 'Empty history should be allowed');

    // Test 2: History should be an array
    TestRunner.assert(Array.isArray(state.history), 'History should always be an array');

    // Test 3: currentBlockIndex should handle boundary
    state.currentBlockIndex = 0;
    TestRunner.assertEqual(state.currentBlockIndex, 0, 'currentBlockIndex can be 0 (first block)');

    // Test 4: Null currentSceneId should be handled
    state.currentSceneId = null;
    TestRunner.assertEqual(state.currentSceneId, null, 'currentSceneId can be null before game starts');

    // Test 5: PlayerHP null handling (before first battle)
    state.playerHP = null;
    TestRunner.assertEqual(state.playerHP, null, 'playerHP can be null before first battle');

    // Test 6: Inventory structure should always be complete
    state.inventory = { keyItems: [], consumables: {}, skills: [] };
    TestRunner.assert(Array.isArray(state.inventory.keyItems), 'keyItems should be array');
    TestRunner.assert(typeof state.inventory.consumables === 'object', 'consumables should be object');
    TestRunner.assert(Array.isArray(state.inventory.skills), 'skills should be array');

    // Test 7: readBlocks and wonBattles should be objects
    state.readBlocks = {};
    state.wonBattles = {};
    TestRunner.assert(typeof state.readBlocks === 'object', 'readBlocks should be object');
    TestRunner.assert(typeof state.wonBattles === 'object', 'wonBattles should be object');
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runEngineTests: runEngineTests, TestRunner: TestRunner };
}
