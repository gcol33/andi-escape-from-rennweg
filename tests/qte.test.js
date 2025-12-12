/**
 * Andi VN - QTE System Tests
 *
 * Run tests: node tests/run-qte-tests.js
 *
 * These tests verify the QTE engine functionality including:
 * - Zone calculation
 * - Marker position tracking
 * - Result modifiers
 * - State management
 * - Configuration loading
 */

// Simple test framework (same as battle.test.js)
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

    assertInRange: function(value, min, max, message) {
        var condition = value >= min && value <= max;
        if (!condition) {
            message += ' (expected ' + min + '-' + max + ', got ' + value + ')';
        }
        this.assert(condition, message);
    },

    assertApproxEqual: function(actual, expected, tolerance, message) {
        var condition = Math.abs(actual - expected) <= tolerance;
        if (!condition) {
            message += ' (expected ~' + expected + '±' + tolerance + ', got ' + actual + ')';
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
        console.log('\n=== QTE System Test Results ===');
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

// Test functions
function runQTETests() {
    TestRunner.reset();

    testZoneCalculation();
    testConfigLoading();
    testResultModifiers();
    testStateManagement();
    testDifficultyScaling();
    testQTEIntegrationWithBattle();

    TestRunner.report();
}

// === Zone Calculation Tests ===
function testZoneCalculation() {
    TestRunner.group('Zone Calculation');

    // Test getZoneForPosition with tuning.js config
    // Actual zones from TUNING.qte.zones: perfect=10%, success=25%, partial=40%

    // Perfect zone (center ±10%)
    TestRunner.assertEqual(
        QTEEngine.getZoneForPosition(50),
        'perfect',
        'Center position (50) should be perfect zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPosition(55),
        'perfect',
        'Position 55 (5% from center) should be perfect zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPosition(45),
        'perfect',
        'Position 45 (5% from center) should be perfect zone'
    );

    // Edge of perfect zone (±10%)
    TestRunner.assertEqual(
        QTEEngine.getZoneForPosition(60),
        'perfect',
        'Position 60 (10% from center) should still be perfect zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPosition(40),
        'perfect',
        'Position 40 (10% from center) should still be perfect zone'
    );

    // Success zone (10-25% from center)
    TestRunner.assertEqual(
        QTEEngine.getZoneForPosition(62),
        'success',
        'Position 62 (12% from center) should be success zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPosition(35),
        'success',
        'Position 35 (15% from center) should be success zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPosition(75),
        'success',
        'Position 75 (25% from center) should be success zone'
    );

    // Partial zone (25-40% from center)
    TestRunner.assertEqual(
        QTEEngine.getZoneForPosition(78),
        'partial',
        'Position 78 (28% from center) should be partial zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPosition(15),
        'partial',
        'Position 15 (35% from center) should be partial zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPosition(90),
        'partial',
        'Position 90 (40% from center) should be partial zone'
    );

    // Miss zone (>40% from center)
    TestRunner.assertEqual(
        QTEEngine.getZoneForPosition(8),
        'miss',
        'Position 8 (42% from center) should be miss zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPosition(92),
        'miss',
        'Position 92 (42% from center) should be miss zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPosition(0),
        'miss',
        'Position 0 (50% from center) should be miss zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPosition(100),
        'miss',
        'Position 100 (50% from center) should be miss zone'
    );
}

// === Config Loading Tests ===
function testConfigLoading() {
    TestRunner.group('Config Loading');

    var config = QTEEngine.getConfig();

    // Check bar settings exist
    TestRunner.assert(config.bar !== undefined, 'Config should have bar settings');
    TestRunner.assert(config.bar.duration > 0, 'Bar duration should be positive');
    TestRunner.assert(config.bar.oscillations > 0, 'Bar oscillations should be positive');
    TestRunner.assert(config.bar.markerSpeed > 0, 'Marker speed should be positive');

    // Check zones exist
    TestRunner.assert(config.zones !== undefined, 'Config should have zones');
    TestRunner.assert(config.zones.perfect > 0, 'Perfect zone should be positive');
    TestRunner.assert(config.zones.success > config.zones.perfect, 'Success zone should be larger than perfect');
    TestRunner.assert(config.zones.partial > config.zones.success, 'Partial zone should be larger than success');

    // Check modifiers exist
    TestRunner.assert(config.modifiers !== undefined, 'Config should have modifiers');
    TestRunner.assert(config.modifiers.accuracy !== undefined, 'Config should have accuracy modifiers');
    TestRunner.assert(config.modifiers.dodge !== undefined, 'Config should have dodge modifiers');

    // Check accuracy modifiers
    var accMods = config.modifiers.accuracy;
    TestRunner.assert(accMods.perfect !== undefined, 'Should have perfect accuracy modifier');
    TestRunner.assert(accMods.success !== undefined, 'Should have success accuracy modifier');
    TestRunner.assert(accMods.partial !== undefined, 'Should have partial accuracy modifier');
    TestRunner.assert(accMods.miss !== undefined, 'Should have miss accuracy modifier');

    // Check dodge modifiers
    var dodgeMods = config.modifiers.dodge;
    TestRunner.assert(dodgeMods.perfect !== undefined, 'Should have perfect dodge modifier');
    TestRunner.assert(dodgeMods.success !== undefined, 'Should have success dodge modifier');

    // Check timing settings
    TestRunner.assert(config.timing !== undefined, 'Config should have timing settings');
    TestRunner.assert(config.timing.startDelay >= 0, 'Start delay should be non-negative');
    TestRunner.assert(config.timing.resultDisplay > 0, 'Result display should be positive');
}

// === Result Modifiers Tests ===
function testResultModifiers() {
    TestRunner.group('Result Modifiers');

    var config = QTEEngine.getConfig();

    // Test accuracy modifiers ordering (better zones = better bonuses)
    var accMods = config.modifiers.accuracy;

    TestRunner.assert(
        accMods.perfect.hitBonus > accMods.success.hitBonus,
        'Perfect hit bonus should be greater than success'
    );

    TestRunner.assert(
        accMods.success.hitBonus >= accMods.partial.hitBonus,
        'Success hit bonus should be >= partial'
    );

    TestRunner.assert(
        accMods.partial.hitBonus > accMods.miss.hitBonus,
        'Partial hit bonus should be greater than miss'
    );

    // Test damage multipliers
    TestRunner.assert(
        accMods.perfect.damageMultiplier >= accMods.success.damageMultiplier,
        'Perfect damage multiplier should be >= success'
    );

    TestRunner.assertEqual(
        accMods.success.damageMultiplier,
        1.0,
        'Success should have 1.0 damage multiplier (baseline)'
    );

    TestRunner.assert(
        accMods.partial.damageMultiplier < 1.0,
        'Partial should have damage multiplier less than 1.0'
    );

    // Test dodge modifiers ordering
    var dodgeMods = config.modifiers.dodge;

    TestRunner.assertEqual(
        dodgeMods.perfect.damageReduction,
        1.0,
        'Perfect dodge should have 100% damage reduction'
    );

    TestRunner.assert(
        dodgeMods.success.damageReduction > dodgeMods.partial.damageReduction,
        'Success dodge reduction should be greater than partial'
    );

    TestRunner.assertEqual(
        dodgeMods.miss.damageReduction,
        0,
        'Miss dodge should have 0 damage reduction'
    );

    // Test counter attack
    TestRunner.assertEqual(
        dodgeMods.perfect.counterAttack,
        true,
        'Perfect dodge should enable counter attack'
    );

    TestRunner.assertEqual(
        dodgeMods.success.counterAttack,
        false,
        'Success dodge should not enable counter attack'
    );
}

// === State Management Tests ===
function testStateManagement() {
    TestRunner.group('State Management');

    // Test initial state
    TestRunner.assertEqual(QTEEngine.isActive(), false, 'QTE should not be active initially');
    TestRunner.assertEqual(QTEEngine.getType(), null, 'Type should be null initially');
    TestRunner.assertEqual(QTEEngine.getPhase(), 'idle', 'Phase should be idle initially');

    // Test cancel when not active
    QTEEngine.cancel();
    TestRunner.assertEqual(QTEEngine.isActive(), false, 'Cancel on inactive QTE should be safe');
}

// === Difficulty Scaling Tests ===
function testDifficultyScaling() {
    TestRunner.group('Difficulty Scaling');

    var config = QTEEngine.getConfig();

    // Check difficulty settings exist
    TestRunner.assert(config.difficulty !== undefined, 'Config should have difficulty settings');
    TestRunner.assert(config.difficulty.easy !== undefined, 'Should have easy difficulty');
    TestRunner.assert(config.difficulty.normal !== undefined, 'Should have normal difficulty');
    TestRunner.assert(config.difficulty.hard !== undefined, 'Should have hard difficulty');

    // Easy should have larger zones and slower speed
    TestRunner.assert(
        config.difficulty.easy.zoneMultiplier > config.difficulty.normal.zoneMultiplier,
        'Easy zone multiplier should be greater than normal'
    );

    TestRunner.assert(
        config.difficulty.easy.speedMultiplier < config.difficulty.normal.speedMultiplier,
        'Easy speed multiplier should be less than normal'
    );

    // Hard should have smaller zones and faster speed
    TestRunner.assert(
        config.difficulty.hard.zoneMultiplier < config.difficulty.normal.zoneMultiplier,
        'Hard zone multiplier should be less than normal'
    );

    TestRunner.assert(
        config.difficulty.hard.speedMultiplier > config.difficulty.normal.speedMultiplier,
        'Hard speed multiplier should be greater than normal'
    );

    // Normal should be baseline (1.0)
    TestRunner.assertEqual(
        config.difficulty.normal.zoneMultiplier,
        1.0,
        'Normal zone multiplier should be 1.0'
    );

    TestRunner.assertEqual(
        config.difficulty.normal.speedMultiplier,
        1.0,
        'Normal speed multiplier should be 1.0'
    );
}

// === Battle Integration Tests ===
function testQTEIntegrationWithBattle() {
    TestRunner.group('Battle Integration');

    // Check if BattleEngine has QTE methods
    if (typeof BattleEngine === 'undefined') {
        console.log('  (Skipping - BattleEngine not loaded)');
        return;
    }

    // Test QTE enabled check methods
    TestRunner.assert(
        typeof BattleEngine.isQTEEnabledForAttacks === 'function',
        'BattleEngine should have isQTEEnabledForAttacks method'
    );

    TestRunner.assert(
        typeof BattleEngine.isQTEEnabledForDodge === 'function',
        'BattleEngine should have isQTEEnabledForDodge method'
    );

    TestRunner.assert(
        typeof BattleEngine.isQTEEnabledForSkills === 'function',
        'BattleEngine should have isQTEEnabledForSkills method'
    );

    // Test QTE attack execution method exists
    TestRunner.assert(
        typeof BattleEngine.executeAttackWithQTE === 'function',
        'BattleEngine should have executeAttackWithQTE method'
    );

    // Test QTE enemy attack processing method exists
    TestRunner.assert(
        typeof BattleEngine.processEnemyAttackWithQTE === 'function',
        'BattleEngine should have processEnemyAttackWithQTE method'
    );

    // Test QTEEngine modifier getters
    TestRunner.assert(
        typeof QTEEngine.getSkillModifiers === 'function',
        'QTEEngine should have getSkillModifiers method'
    );

    TestRunner.assert(
        typeof QTEEngine.getDefendModifiers === 'function',
        'QTEEngine should have getDefendModifiers method'
    );

    // Test skill modifiers for each zone
    var perfectMods = QTEEngine.getSkillModifiers('perfect');
    TestRunner.assert(
        perfectMods !== null && perfectMods !== undefined,
        'getSkillModifiers should return modifiers for perfect zone'
    );

    TestRunner.assert(
        perfectMods.advantage === true,
        'Perfect skill modifier should grant advantage'
    );

    var goodMods = QTEEngine.getSkillModifiers('good');
    TestRunner.assert(
        goodMods !== null && goodMods !== undefined,
        'getSkillModifiers should return modifiers for good zone'
    );

    var normalMods = QTEEngine.getSkillModifiers('normal');
    TestRunner.assert(
        normalMods !== null && normalMods !== undefined,
        'getSkillModifiers should return modifiers for normal zone'
    );

    var badMods = QTEEngine.getSkillModifiers('bad');
    TestRunner.assert(
        badMods !== null && badMods !== undefined,
        'getSkillModifiers should return modifiers for bad zone'
    );

    TestRunner.assert(
        badMods.disadvantage === true,
        'Bad skill modifier should grant disadvantage'
    );

    // Test defend modifiers for each zone
    var perfectDefend = QTEEngine.getDefendModifiers('perfect');
    TestRunner.assert(
        perfectDefend !== null && perfectDefend !== undefined,
        'getDefendModifiers should return modifiers for perfect zone'
    );

    TestRunner.assert(
        perfectDefend.counterAttack === true,
        'Perfect defend should enable counter attack'
    );

    TestRunner.assertEqual(
        perfectDefend.damageReduction,
        1.0,
        'Perfect defend should have 100% damage reduction'
    );

    var badDefend = QTEEngine.getDefendModifiers('bad');
    TestRunner.assertEqual(
        badDefend.damageReduction,
        0,
        'Bad defend should have 0 damage reduction'
    );
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runQTETests: runQTETests, TestRunner: TestRunner };
}
