/**
 * Andi VN - QTE Finalized System Tests
 *
 * Run tests: node tests/run-qte-finalized-tests.js
 *
 * Tests for the finalized QTE system including:
 * - 4-tier zone calculation (Perfect/Good/Normal/Bad)
 * - Skill QTE modifiers
 * - Defend QTE modifiers
 * - State management for skill/defend QTEs
 */

// Simple test framework
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

    assertDeepEqual: function(actual, expected, message) {
        var condition = JSON.stringify(actual) === JSON.stringify(expected);
        if (!condition) {
            message += ' (expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual) + ')';
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
        console.log('\n=== QTE Finalized System Test Results ===');
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

// Run all tests
function runQTEFinalizedTests() {
    TestRunner.reset();

    testFinalizedMethodsExist();
    testFinalizedZoneCalculation();
    testSkillModifiers();
    testDefendModifiers();
    testZoneThresholds();
    testModifierValues();

    return TestRunner.report();
}

// === Test: Finalized Methods Exist ===
function testFinalizedMethodsExist() {
    TestRunner.group('Finalized Methods Existence');

    TestRunner.assert(
        typeof QTEEngine !== 'undefined',
        'QTEEngine should be defined'
    );

    // Check finalized-specific methods exist
    TestRunner.assert(
        typeof QTEEngine.getZoneForPositionFinalized === 'function',
        'getZoneForPositionFinalized should exist'
    );

    TestRunner.assert(
        typeof QTEEngine.startSkillQTE === 'function',
        'startSkillQTE should exist'
    );

    TestRunner.assert(
        typeof QTEEngine.startDefendQTE === 'function',
        'startDefendQTE should exist'
    );

    TestRunner.assert(
        typeof QTEEngine.handleInputFinalized === 'function',
        'handleInputFinalized should exist'
    );

    TestRunner.assert(
        typeof QTEEngine.getSkillModifiers === 'function',
        'getSkillModifiers should exist'
    );

    TestRunner.assert(
        typeof QTEEngine.getDefendModifiers === 'function',
        'getDefendModifiers should exist'
    );
}

// === Test: Finalized Zone Calculation ===
function testFinalizedZoneCalculation() {
    TestRunner.group('Finalized Zone Calculation (4-tier)');

    // The finalized system uses: Perfect/Good/Normal/Bad
    // Default zones (from TUNING or fallback):
    //   perfect: 5%  (position 45-55)
    //   good: 15%    (position 35-45 and 55-65)
    //   normal: 30%  (position 20-35 and 65-80)
    //   bad: rest    (position 0-20 and 80-100)

    // Test Perfect zone (center)
    TestRunner.assertEqual(
        QTEEngine.getZoneForPositionFinalized(50),
        'perfect',
        'Center position (50) should be perfect zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPositionFinalized(52),
        'perfect',
        'Position 52 (2% from center) should be perfect zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPositionFinalized(48),
        'perfect',
        'Position 48 (2% from center) should be perfect zone'
    );

    // Edge of perfect (5% = position 45 and 55)
    TestRunner.assertEqual(
        QTEEngine.getZoneForPositionFinalized(55),
        'perfect',
        'Position 55 (5% from center) should still be perfect zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPositionFinalized(45),
        'perfect',
        'Position 45 (5% from center) should still be perfect zone'
    );

    // Good zone (just outside perfect, within good threshold)
    TestRunner.assertEqual(
        QTEEngine.getZoneForPositionFinalized(56),
        'good',
        'Position 56 (6% from center) should be good zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPositionFinalized(44),
        'good',
        'Position 44 (6% from center) should be good zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPositionFinalized(40),
        'good',
        'Position 40 (10% from center) should be good zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPositionFinalized(60),
        'good',
        'Position 60 (10% from center) should be good zone'
    );

    // Normal zone (outside good, within normal threshold)
    TestRunner.assertEqual(
        QTEEngine.getZoneForPositionFinalized(66),
        'normal',
        'Position 66 (16% from center) should be normal zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPositionFinalized(34),
        'normal',
        'Position 34 (16% from center) should be normal zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPositionFinalized(25),
        'normal',
        'Position 25 (25% from center) should be normal zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPositionFinalized(75),
        'normal',
        'Position 75 (25% from center) should be normal zone'
    );

    // Bad zone (outside normal threshold)
    TestRunner.assertEqual(
        QTEEngine.getZoneForPositionFinalized(10),
        'bad',
        'Position 10 (40% from center) should be bad zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPositionFinalized(90),
        'bad',
        'Position 90 (40% from center) should be bad zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPositionFinalized(0),
        'bad',
        'Position 0 (50% from center) should be bad zone'
    );

    TestRunner.assertEqual(
        QTEEngine.getZoneForPositionFinalized(100),
        'bad',
        'Position 100 (50% from center) should be bad zone'
    );

    // Verify it returns correct type names (not legacy names)
    var validZones = ['perfect', 'good', 'normal', 'bad'];

    for (var pos = 0; pos <= 100; pos += 10) {
        var zone = QTEEngine.getZoneForPositionFinalized(pos);
        TestRunner.assert(
            validZones.indexOf(zone) !== -1,
            'Position ' + pos + ' should return valid zone name: ' + zone
        );
    }
}

// === Test: Skill Modifiers ===
function testSkillModifiers() {
    TestRunner.group('Skill Modifiers');

    // Test getSkillModifiers returns correct structure for each zone
    var perfectMods = QTEEngine.getSkillModifiers('perfect');
    var goodMods = QTEEngine.getSkillModifiers('good');
    var normalMods = QTEEngine.getSkillModifiers('normal');
    var badMods = QTEEngine.getSkillModifiers('bad');

    // Perfect should have advantage and bonus damage
    TestRunner.assertEqual(
        perfectMods.advantage,
        true,
        'Perfect skill should have advantage'
    );

    TestRunner.assert(
        perfectMods.bonusDamage > 0,
        'Perfect skill should have positive bonusDamage'
    );

    TestRunner.assert(
        perfectMods.bonusHealing > 0,
        'Perfect skill should have positive bonusHealing'
    );

    TestRunner.assert(
        perfectMods.statusChanceBonus > 0,
        'Perfect skill should have positive statusChanceBonus'
    );

    // Good should have advantage but no bonus damage
    TestRunner.assertEqual(
        goodMods.advantage,
        true,
        'Good skill should have advantage'
    );

    TestRunner.assertEqual(
        goodMods.bonusDamage,
        0,
        'Good skill should have 0 bonusDamage'
    );

    // Normal should have no advantage/disadvantage
    TestRunner.assert(
        !normalMods.advantage,
        'Normal skill should not have advantage'
    );

    TestRunner.assert(
        !normalMods.disadvantage,
        'Normal skill should not have disadvantage'
    );

    TestRunner.assertEqual(
        normalMods.bonusDamage,
        0,
        'Normal skill should have 0 bonusDamage'
    );

    // Bad should have disadvantage and negative bonuses
    TestRunner.assertEqual(
        badMods.disadvantage,
        true,
        'Bad skill should have disadvantage'
    );

    TestRunner.assert(
        badMods.bonusDamage < 0,
        'Bad skill should have negative bonusDamage'
    );

    TestRunner.assert(
        badMods.statusChanceBonus < 0,
        'Bad skill should have negative statusChanceBonus'
    );

    // Test invalid zone fallback
    var invalidMods = QTEEngine.getSkillModifiers('invalid');

    TestRunner.assert(
        invalidMods !== undefined && invalidMods !== null,
        'Invalid zone should return fallback modifiers'
    );
}

// === Test: Defend Modifiers ===
function testDefendModifiers() {
    TestRunner.group('Defend Modifiers');

    // Test getDefendModifiers returns correct structure for each zone
    var perfectMods = QTEEngine.getDefendModifiers('perfect');
    var goodMods = QTEEngine.getDefendModifiers('good');
    var normalMods = QTEEngine.getDefendModifiers('normal');
    var badMods = QTEEngine.getDefendModifiers('bad');

    // Perfect = Parry (0 damage, counter)
    TestRunner.assertEqual(
        perfectMods.result,
        'parry',
        'Perfect defend should be parry'
    );

    TestRunner.assertEqual(
        perfectMods.damageReduction,
        1.0,
        'Parry should have 100% damage reduction'
    );

    TestRunner.assertEqual(
        perfectMods.counterAttack,
        true,
        'Parry should enable counter attack'
    );

    TestRunner.assert(
        perfectMods.counterDamagePercent > 0,
        'Parry should have positive counter damage percent'
    );

    TestRunner.assertEqual(
        perfectMods.defendEnds,
        false,
        'Parry should not end defend'
    );

    // Good = Dodge (0 damage, no counter)
    TestRunner.assertEqual(
        goodMods.result,
        'dodge',
        'Good defend should be dodge'
    );

    TestRunner.assertEqual(
        goodMods.damageReduction,
        1.0,
        'Dodge should have 100% damage reduction'
    );

    TestRunner.assertEqual(
        goodMods.counterAttack,
        false,
        'Dodge should not enable counter attack'
    );

    TestRunner.assertEqual(
        goodMods.defendEnds,
        false,
        'Dodge should not end defend'
    );

    // Normal = Block (50% damage)
    TestRunner.assertEqual(
        normalMods.result,
        'block',
        'Normal defend should be block'
    );

    TestRunner.assertEqual(
        normalMods.damageReduction,
        0.5,
        'Block should have 50% damage reduction'
    );

    TestRunner.assertEqual(
        normalMods.counterAttack,
        false,
        'Block should not enable counter attack'
    );

    TestRunner.assertEqual(
        normalMods.defendEnds,
        false,
        'Block should not end defend'
    );

    // Bad = Broken (full damage, defend ends)
    TestRunner.assertEqual(
        badMods.result,
        'broken',
        'Bad defend should be broken'
    );

    TestRunner.assertEqual(
        badMods.damageReduction,
        0,
        'Broken should have 0% damage reduction'
    );

    TestRunner.assertEqual(
        badMods.counterAttack,
        false,
        'Broken should not enable counter attack'
    );

    TestRunner.assertEqual(
        badMods.defendEnds,
        true,
        'Broken should end defend'
    );

    // Test invalid zone fallback
    var invalidMods = QTEEngine.getDefendModifiers('invalid');

    TestRunner.assert(
        invalidMods !== undefined && invalidMods !== null,
        'Invalid zone should return fallback modifiers'
    );
}

// === Test: Zone Thresholds ===
function testZoneThresholds() {
    TestRunner.group('Zone Thresholds');

    // Verify zone sizes follow the expected hierarchy
    // Perfect < Good < Normal (from center outward)

    var config = QTEEngine.getConfig();

    if (config.zones) {
        var perfectSize = config.zones.perfect || 5;
        var goodSize = config.zones.good || config.zones.success || 15;
        var normalSize = config.zones.normal || config.zones.partial || 30;

        TestRunner.assert(
            perfectSize > 0,
            'Perfect zone should be positive: ' + perfectSize
        );

        TestRunner.assert(
            goodSize > perfectSize,
            'Good zone (' + goodSize + ') should be larger than perfect (' + perfectSize + ')'
        );

        TestRunner.assert(
            normalSize > goodSize,
            'Normal zone (' + normalSize + ') should be larger than good (' + goodSize + ')'
        );

        // Bad zone is implicitly everything else (>normal threshold)
        TestRunner.assert(
            normalSize < 50,
            'Normal zone should not extend past 50% (which would cover everything)'
        );
    } else {
        TestRunner.assert(true, 'Config zones not available, using defaults');
    }
}

// === Test: Modifier Values ===
function testModifierValues() {
    TestRunner.group('Modifier Value Consistency');

    // Test that modifiers follow logical progression
    // Perfect > Good > Normal > Bad

    // Skill modifiers
    var skillPerfect = QTEEngine.getSkillModifiers('perfect');
    var skillGood = QTEEngine.getSkillModifiers('good');
    var skillNormal = QTEEngine.getSkillModifiers('normal');
    var skillBad = QTEEngine.getSkillModifiers('bad');

    // Bonus damage progression
    TestRunner.assert(
        skillPerfect.bonusDamage > skillGood.bonusDamage,
        'Perfect bonusDamage should be greater than good'
    );

    TestRunner.assert(
        skillGood.bonusDamage >= skillNormal.bonusDamage,
        'Good bonusDamage should be >= normal'
    );

    TestRunner.assert(
        skillNormal.bonusDamage > skillBad.bonusDamage,
        'Normal bonusDamage should be greater than bad'
    );

    // Status chance progression
    TestRunner.assert(
        skillPerfect.statusChanceBonus > skillGood.statusChanceBonus,
        'Perfect statusChanceBonus should be greater than good'
    );

    TestRunner.assert(
        skillGood.statusChanceBonus >= skillNormal.statusChanceBonus,
        'Good statusChanceBonus should be >= normal'
    );

    TestRunner.assert(
        skillNormal.statusChanceBonus > skillBad.statusChanceBonus,
        'Normal statusChanceBonus should be greater than bad'
    );

    // Defend modifiers damage reduction progression
    var defendPerfect = QTEEngine.getDefendModifiers('perfect');
    var defendGood = QTEEngine.getDefendModifiers('good');
    var defendNormal = QTEEngine.getDefendModifiers('normal');
    var defendBad = QTEEngine.getDefendModifiers('bad');

    TestRunner.assert(
        defendPerfect.damageReduction >= defendGood.damageReduction,
        'Perfect damageReduction should be >= good'
    );

    TestRunner.assert(
        defendGood.damageReduction >= defendNormal.damageReduction,
        'Good damageReduction should be >= normal'
    );

    TestRunner.assert(
        defendNormal.damageReduction > defendBad.damageReduction,
        'Normal damageReduction should be greater than bad'
    );

    // Only perfect allows counter
    TestRunner.assertEqual(
        defendPerfect.counterAttack && !defendGood.counterAttack &&
        !defendNormal.counterAttack && !defendBad.counterAttack,
        true,
        'Only perfect should allow counter attack'
    );

    // Only bad ends defend
    TestRunner.assertEqual(
        !defendPerfect.defendEnds && !defendGood.defendEnds &&
        !defendNormal.defendEnds && defendBad.defendEnds,
        true,
        'Only bad should end defend'
    );
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runQTEFinalizedTests: runQTEFinalizedTests, TestRunner: TestRunner };
}

// Auto-run in browser
if (typeof window !== 'undefined') {
    window.runQTEFinalizedTests = runQTEFinalizedTests;
}
