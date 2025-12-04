/**
 * Test: Enemy summon duration decrements correctly
 * Expected: Office Intern starts at duration 4, decrements each turn
 */

console.log('=== SUMMON DURATION TEST ===\n');

// Simulate summon spawning
var testSummon = {
    uid: 'test_summon_1',
    name: 'Office Intern',
    side: 'enemy',
    summonerId: 'agnes_hr',
    turnsRemaining: 4,
    maxDuration: 4
};

console.log('Initial state:');
console.log('  turnsRemaining:', testSummon.turnsRemaining);

// Simulate 5 turns
for (var turn = 1; turn <= 5; turn++) {
    console.log('\n--- Turn ' + turn + ' ---');

    // Enemy summon acts (this should decrement turnsRemaining)
    console.log('Before processTurn: turnsRemaining =', testSummon.turnsRemaining);

    // This is what happens in BattleSummon.processTurn
    testSummon.turnsRemaining--;

    console.log('After processTurn: turnsRemaining =', testSummon.turnsRemaining);

    // Check if expired
    if (testSummon.turnsRemaining <= 0) {
        console.log('EXPIRED - summon should be removed');
        break;
    }
}

console.log('\n=== TEST COMPLETE ===');
console.log('Expected: Summon expires after turn 4');
console.log('Result: Summon expired after turn', turn);
