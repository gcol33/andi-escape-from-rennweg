/**
 * Andi VN - Tuning System Tests
 *
 * Tests for the centralized tuning configuration (js/tuning.js)
 * and the modular battle UI (js/battle-ui.js)
 */

// Simple test framework (shared with battle.test.js)
var TuningTestRunner = {
    passed: 0,
    failed: 0,
    results: [],

    assert: function(condition, message) {
        if (condition) {
            this.passed++;
            this.results.push({ pass: true, message: message });
        } else {
            this.failed++;
            this.results.push({ pass: false, message: message });
            console.error('FAIL: ' + message);
        }
    },

    assertEqual: function(actual, expected, message) {
        var condition = actual === expected;
        if (!condition) {
            message += ' (expected ' + expected + ', got ' + actual + ')';
        }
        this.assert(condition, message);
    },

    assertDefined: function(value, message) {
        this.assert(value !== undefined && value !== null, message);
    },

    assertType: function(value, expectedType, message) {
        var actualType = typeof value;
        var condition = actualType === expectedType;
        if (!condition) {
            message += ' (expected type ' + expectedType + ', got ' + actualType + ')';
        }
        this.assert(condition, message);
    },

    report: function() {
        console.log('\n=== Tuning System Test Results ===');
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

function runTuningTests() {
    console.log('\n--- Testing TUNING Object Structure ---');

    // Test TUNING exists
    TuningTestRunner.assertDefined(TUNING, 'TUNING object exists');
    TuningTestRunner.assertType(TUNING, 'object', 'TUNING is an object');

    // Test text section
    console.log('\n--- Testing TUNING.text ---');
    TuningTestRunner.assertDefined(TUNING.text, 'TUNING.text exists');
    TuningTestRunner.assertDefined(TUNING.text.speed, 'TUNING.text.speed exists');
    TuningTestRunner.assertType(TUNING.text.speed.normal, 'number', 'text.speed.normal is a number');
    TuningTestRunner.assertType(TUNING.text.speed.fast, 'number', 'text.speed.fast is a number');
    TuningTestRunner.assertType(TUNING.text.speed.auto, 'number', 'text.speed.auto is a number');
    TuningTestRunner.assertType(TUNING.text.speed.skip, 'number', 'text.speed.skip is a number');
    TuningTestRunner.assertType(TUNING.text.autoAdvanceDelay, 'number', 'text.autoAdvanceDelay is a number');
    TuningTestRunner.assertType(TUNING.text.skipModeDelay, 'number', 'text.skipModeDelay is a number');

    // Test audio section
    console.log('\n--- Testing TUNING.audio ---');
    TuningTestRunner.assertDefined(TUNING.audio, 'TUNING.audio exists');
    TuningTestRunner.assertType(TUNING.audio.defaultVolume, 'number', 'audio.defaultVolume is a number');
    TuningTestRunner.assertType(TUNING.audio.duckVolume, 'number', 'audio.duckVolume is a number');
    TuningTestRunner.assertType(TUNING.audio.sfxPreDelay, 'number', 'audio.sfxPreDelay is a number');
    TuningTestRunner.assertType(TUNING.audio.sfxPostDelay, 'number', 'audio.sfxPostDelay is a number');

    // Test battle section
    console.log('\n--- Testing TUNING.battle ---');
    TuningTestRunner.assertDefined(TUNING.battle, 'TUNING.battle exists');

    // Battle timing
    TuningTestRunner.assertDefined(TUNING.battle.timing, 'TUNING.battle.timing exists');
    TuningTestRunner.assertType(TUNING.battle.timing.introDelay, 'number', 'battle.timing.introDelay is a number');
    TuningTestRunner.assertType(TUNING.battle.timing.outroDelay, 'number', 'battle.timing.outroDelay is a number');
    TuningTestRunner.assertType(TUNING.battle.timing.actionDelay, 'number', 'battle.timing.actionDelay is a number');
    TuningTestRunner.assertType(TUNING.battle.timing.enemyTurnDelay, 'number', 'battle.timing.enemyTurnDelay is a number');
    TuningTestRunner.assertType(TUNING.battle.timing.screenShake, 'number', 'battle.timing.screenShake is a number');

    // Battle dice
    TuningTestRunner.assertDefined(TUNING.battle.dice, 'TUNING.battle.dice exists');
    TuningTestRunner.assertType(TUNING.battle.dice.spinDuration, 'number', 'battle.dice.spinDuration is a number');
    TuningTestRunner.assertType(TUNING.battle.dice.spinInterval, 'number', 'battle.dice.spinInterval is a number');

    // Battle effects
    TuningTestRunner.assertDefined(TUNING.battle.effects, 'TUNING.battle.effects exists');
    TuningTestRunner.assertType(TUNING.battle.effects.sparkleInterval, 'number', 'battle.effects.sparkleInterval is a number');
    TuningTestRunner.assertType(TUNING.battle.effects.spriteFlash, 'number', 'battle.effects.spriteFlash is a number');

    // Battle combat
    TuningTestRunner.assertDefined(TUNING.battle.combat, 'TUNING.battle.combat exists');
    TuningTestRunner.assertType(TUNING.battle.combat.defendACBonus, 'number', 'battle.combat.defendACBonus is a number');
    TuningTestRunner.assertType(TUNING.battle.combat.critMultiplier, 'number', 'battle.combat.critMultiplier is a number');
    TuningTestRunner.assertType(TUNING.battle.combat.fleeThreshold, 'number', 'battle.combat.fleeThreshold is a number');

    // Battle AI
    TuningTestRunner.assertDefined(TUNING.battle.ai, 'TUNING.battle.ai exists');
    TuningTestRunner.assertType(TUNING.battle.ai.healThreshold, 'number', 'battle.ai.healThreshold is a number');
    TuningTestRunner.assertType(TUNING.battle.ai.dialogueChance, 'number', 'battle.ai.dialogueChance is a number');

    // Test UI section
    console.log('\n--- Testing TUNING.ui ---');
    TuningTestRunner.assertDefined(TUNING.ui, 'TUNING.ui exists');
    TuningTestRunner.assertType(TUNING.ui.errorFlash, 'number', 'ui.errorFlash is a number');
    TuningTestRunner.assertType(TUNING.ui.battleLogMaxLines, 'number', 'ui.battleLogMaxLines is a number');
    TuningTestRunner.assert(TUNING.ui.battleLogMaxLines >= 1, 'ui.battleLogMaxLines is at least 1');
    TuningTestRunner.assertType(TUNING.ui.lockoutDuration, 'number', 'ui.lockoutDuration is a number');
    TuningTestRunner.assertType(TUNING.ui.maxPasswordAttempts, 'number', 'ui.maxPasswordAttempts is a number');

    // Test player defaults
    console.log('\n--- Testing TUNING.player ---');
    TuningTestRunner.assertDefined(TUNING.player, 'TUNING.player exists');
    TuningTestRunner.assertType(TUNING.player.defaultMaxHP, 'number', 'player.defaultMaxHP is a number');
    TuningTestRunner.assertType(TUNING.player.defaultMaxMana, 'number', 'player.defaultMaxMana is a number');
    TuningTestRunner.assertType(TUNING.player.defaultAC, 'number', 'player.defaultAC is a number');
    TuningTestRunner.assertType(TUNING.player.defaultAttackBonus, 'number', 'player.defaultAttackBonus is a number');
    TuningTestRunner.assertType(TUNING.player.defaultDamage, 'string', 'player.defaultDamage is a string');
    TuningTestRunner.assertType(TUNING.player.defaultStaggerThreshold, 'number', 'player.defaultStaggerThreshold is a number');
    TuningTestRunner.assert(Array.isArray(TUNING.player.defaultSkills), 'player.defaultSkills is an array');

    // Test enemy defaults
    console.log('\n--- Testing TUNING.enemy ---');
    TuningTestRunner.assertDefined(TUNING.enemy, 'TUNING.enemy exists');
    TuningTestRunner.assertType(TUNING.enemy.defaultHP, 'number', 'enemy.defaultHP is a number');
    TuningTestRunner.assertType(TUNING.enemy.defaultAC, 'number', 'enemy.defaultAC is a number');
    TuningTestRunner.assertType(TUNING.enemy.defaultAttackBonus, 'number', 'enemy.defaultAttackBonus is a number');
    TuningTestRunner.assertType(TUNING.enemy.defaultDamage, 'string', 'enemy.defaultDamage is a string');
    TuningTestRunner.assertType(TUNING.enemy.defaultStaggerThreshold, 'number', 'enemy.defaultStaggerThreshold is a number');
    TuningTestRunner.assertType(TUNING.enemy.defaultAI, 'string', 'enemy.defaultAI is a string');

    // Test TUNING.get helper function
    console.log('\n--- Testing TUNING.get() Helper ---');
    TuningTestRunner.assertType(TUNING.get, 'function', 'TUNING.get is a function');
    TuningTestRunner.assertEqual(
        TUNING.get('text.speed.normal'),
        TUNING.text.speed.normal,
        'TUNING.get returns correct nested value'
    );
    TuningTestRunner.assertEqual(
        TUNING.get('battle.timing.introDelay'),
        TUNING.battle.timing.introDelay,
        'TUNING.get works for deeply nested values'
    );
    TuningTestRunner.assertEqual(
        TUNING.get('nonexistent.path', 'fallback'),
        'fallback',
        'TUNING.get returns fallback for missing paths'
    );
    TuningTestRunner.assertEqual(
        TUNING.get('player.defaultMaxHP', 999),
        TUNING.player.defaultMaxHP,
        'TUNING.get returns value not fallback when path exists'
    );

    // Test value sanity checks
    console.log('\n--- Testing Value Sanity ---');
    TuningTestRunner.assert(TUNING.text.speed.normal > 0, 'text.speed.normal is positive');
    TuningTestRunner.assert(TUNING.text.speed.fast > 0, 'text.speed.fast is positive');
    TuningTestRunner.assert(TUNING.text.speed.fast < TUNING.text.speed.normal, 'fast speed is faster than normal');
    TuningTestRunner.assert(TUNING.audio.defaultVolume >= 0 && TUNING.audio.defaultVolume <= 1, 'audio.defaultVolume is 0-1');
    TuningTestRunner.assert(TUNING.audio.duckVolume >= 0 && TUNING.audio.duckVolume <= 1, 'audio.duckVolume is 0-1');
    TuningTestRunner.assert(TUNING.battle.combat.critMultiplier >= 1, 'critMultiplier is at least 1');
    TuningTestRunner.assert(TUNING.player.defaultMaxHP > 0, 'player defaultMaxHP is positive');
    TuningTestRunner.assert(TUNING.enemy.defaultHP > 0, 'enemy defaultHP is positive');
}

function runBattleUITests() {
    console.log('\n--- Testing BattleUI Module ---');

    // Test BattleUI exists (if loaded)
    if (typeof BattleUI === 'undefined') {
        console.log('    Skipping BattleUI tests (module not loaded)');
        return;
    }

    TuningTestRunner.assertDefined(BattleUI, 'BattleUI module exists');
    TuningTestRunner.assertType(BattleUI, 'object', 'BattleUI is an object');

    // Test BattleUI public API
    console.log('\n--- Testing BattleUI Public API ---');
    TuningTestRunner.assertType(BattleUI.createBattleUI, 'function', 'BattleUI.createBattleUI is a function');
    TuningTestRunner.assertType(BattleUI.destroyUI, 'function', 'BattleUI.destroyUI is a function');
    TuningTestRunner.assertType(BattleUI.updatePlayerHP, 'function', 'BattleUI.updatePlayerHP is a function');
    TuningTestRunner.assertType(BattleUI.updatePlayerMana, 'function', 'BattleUI.updatePlayerMana is a function');
    TuningTestRunner.assertType(BattleUI.updateEnemyHP, 'function', 'BattleUI.updateEnemyHP is a function');
    TuningTestRunner.assertType(BattleUI.showDamageNumber, 'function', 'BattleUI.showDamageNumber is a function');
    TuningTestRunner.assertType(BattleUI.flashSprite, 'function', 'BattleUI.flashSprite is a function');
    TuningTestRunner.assertType(BattleUI.shakeScreen, 'function', 'BattleUI.shakeScreen is a function');
    TuningTestRunner.assertType(BattleUI.showBattleIntro, 'function', 'BattleUI.showBattleIntro is a function');
    TuningTestRunner.assertType(BattleUI.showBattleOutro, 'function', 'BattleUI.showBattleOutro is a function');
    TuningTestRunner.assertType(BattleUI.animateDiceRoll, 'function', 'BattleUI.animateDiceRoll is a function');
}

function runIntegrationTests() {
    console.log('\n--- Testing TUNING Integration with BattleEngine ---');

    // Test that BattleEngine uses TUNING values
    if (typeof BattleEngine === 'undefined') {
        console.log('    Skipping integration tests (BattleEngine not loaded)');
        return;
    }

    // Initialize a battle to test defaults
    BattleEngine.init(
        {
            loadScene: function() {},
            playSfx: function() {}
        },
        {
            player_max_hp: TUNING.player.defaultMaxHP,
            player_max_mana: TUNING.player.defaultMaxMana,
            player_ac: TUNING.player.defaultAC,
            enemy: {
                name: 'Test Enemy',
                hp: TUNING.enemy.defaultHP,
                ac: TUNING.enemy.defaultAC
            },
            win_target: 'win',
            lose_target: 'lose'
        }
    );

    var stats = BattleEngine.getPlayerStats();
    TuningTestRunner.assertEqual(
        stats.maxHP,
        TUNING.player.defaultMaxHP,
        'BattleEngine uses TUNING.player.defaultMaxHP'
    );
    TuningTestRunner.assertEqual(
        stats.maxMana,
        TUNING.player.defaultMaxMana,
        'BattleEngine uses TUNING.player.defaultMaxMana'
    );

    // Reset battle state
    BattleEngine.reset();
}

// Export for Node.js runner
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TuningTestRunner: TuningTestRunner,
        runTuningTests: runTuningTests,
        runBattleUITests: runBattleUITests,
        runIntegrationTests: runIntegrationTests
    };
}
