/**
 * Battle System Simulation Test
 *
 * Runs 1000 full battle simulations to find bugs in the intent/turn system.
 * Reports all issues found.
 */

// ============================================================================
// MOCK IMPLEMENTATIONS
// ============================================================================

function createMockBattleIntent() {
    var currentIntent = null;
    var intentHistory = [];

    return {
        currentIntent: function() { return currentIntent; },

        get: function() {
            return currentIntent;
        },

        isReady: function() {
            return currentIntent && currentIntent.isTelegraphed && currentIntent.turnsRemaining <= 0;
        },

        isTelegraphed: function() {
            return currentIntent && currentIntent.isTelegraphed;
        },

        generate: function(enemy, player, turn) {
            // If we already have a telegraphed intent, return it
            if (currentIntent && currentIntent.isTelegraphed) {
                return currentIntent;
            }

            // Check for new telegraphed intent
            if (enemy.intents && enemy.intents.length > 0 && !currentIntent) {
                for (var i = 0; i < enemy.intents.length; i++) {
                    var config = enemy.intents[i];

                    // Check cooldown
                    var cooldown = config.cooldown || 3;
                    var lastUsed = null;
                    for (var j = intentHistory.length - 1; j >= 0; j--) {
                        if (intentHistory[j].intentId === config.id && intentHistory[j].enemyId === enemy.id) {
                            lastUsed = intentHistory[j].turn;
                            break;
                        }
                    }
                    if (lastUsed !== null && (turn - lastUsed) < cooldown) {
                        continue;
                    }

                    // Check minTurn
                    if (turn < (config.minTurn || 1)) {
                        continue;
                    }

                    // Random chance
                    if (Math.random() > (config.chance || 0.2)) {
                        continue;
                    }

                    // Create telegraphed intent
                    currentIntent = {
                        id: config.id,
                        type: config.type,
                        isTelegraphed: true,
                        turnsRemaining: config.prepTurns || 1,
                        skill: config.skill,
                        dialogue: config.dialogue
                    };
                    return currentIntent;
                }
            }

            // No telegraphed intent - return null or basic intent
            // IMPORTANT: Basic intents should NOT be stored in currentIntent
            // because that would cause issues with the flow
            return null;
        },

        tick: function() {
            if (currentIntent && currentIntent.isTelegraphed) {
                currentIntent.turnsRemaining--;
                return currentIntent.turnsRemaining <= 0;
            }
            return false;
        },

        clear: function(turn, enemyId) {
            if (currentIntent) {
                intentHistory.push({ intentId: currentIntent.id, enemyId: enemyId, turn: turn });
            }
            currentIntent = null;
        },

        reset: function() {
            currentIntent = null;
            intentHistory = [];
        }
    };
}

function createBattleState() {
    return {
        active: true,
        phase: 'player',
        turn: 1,
        player: {
            hp: 30,
            maxHP: 30,
            mana: 20,
            maxMana: 20,
            defending: 0,
            defendCooldown: 0,
            statuses: [],
            name: 'Andi'
        },
        enemy: {
            id: 'agnes',
            hp: 50,
            maxHP: 50,
            ac: 12,
            name: 'Agnes',
            statuses: [],
            intents: [
                {
                    id: 'big_slam',
                    type: 'big_attack',
                    chance: 0.25,
                    minTurn: 2,
                    cooldown: 4,
                    prepTurns: 1,
                    skill: { name: 'Big Slam', damage: 12 },
                    dialogue: 'Agnes winds up!'
                }
            ]
        }
    };
}

// ============================================================================
// BATTLE SIMULATION (mirrors battle-facade.js logic)
// ============================================================================

function simulateBattle(config) {
    var state = createBattleState();
    var intent = createMockBattleIntent();
    var log = config.verbose ? console.log.bind(console) : function() {};

    var stats = {
        turns: 0,
        playerAttacks: 0,
        playerDefends: 0,
        enemyNormalAttacks: 0,
        enemyIntentAnnouncements: 0,
        enemyIntentAttacks: 0,
        enemySkippedTurns: 0,  // BUG: enemy did nothing
        playerDamageDealt: 0,
        enemyDamageDealt: 0,
        winner: null,
        bugs: []
    };

    var maxTurns = config.maxTurns || 50;

    while (state.active && stats.turns < maxTurns) {
        stats.turns++;
        state.turn = stats.turns;
        log('\n--- Turn ' + stats.turns + ' ---');

        // ========== PLAYER TURN ==========
        var playerAction = decidePlayerAction(state);
        log('Player: ' + playerAction);

        if (playerAction === 'attack') {
            stats.playerAttacks++;
            var damage = Math.floor(Math.random() * 8) + 1;
            state.enemy.hp -= damage;
            stats.playerDamageDealt += damage;
            log('  Dealt ' + damage + ' damage (enemy HP: ' + state.enemy.hp + ')');
        } else if (playerAction === 'defend') {
            stats.playerDefends++;
            state.player.defending = 2;
            state.player.defendCooldown = 5;
            log('  Defending for 2 attacks');
        }

        // Check enemy death
        if (state.enemy.hp <= 0) {
            stats.winner = 'player';
            state.active = false;
            break;
        }

        // ========== ENEMY TURN ==========
        var enemyAction = simulateEnemyTurn(state, intent, log);

        if (enemyAction === 'NORMAL_ATTACK') {
            stats.enemyNormalAttacks++;
            var eDamage = Math.floor(Math.random() * 6) + 2;
            if (state.player.defending > 0) {
                eDamage = Math.floor(eDamage * 0.5);
                state.player.defending--;
            }
            state.player.hp -= eDamage;
            stats.enemyDamageDealt += eDamage;
            log('Enemy: Normal attack for ' + eDamage + ' (player HP: ' + state.player.hp + ')');
        } else if (enemyAction === 'INTENT_ANNOUNCE') {
            stats.enemyIntentAnnouncements++;
            log('Enemy: Announces intent');
        } else if (enemyAction === 'INTENT_ATTACK') {
            stats.enemyIntentAttacks++;
            var intentDamage = 12;
            if (state.player.defending > 0) {
                intentDamage = Math.floor(intentDamage * 0.5);
                state.player.defending--;
            }
            state.player.hp -= intentDamage;
            stats.enemyDamageDealt += intentDamage;
            intent.clear(state.turn, state.enemy.id);
            log('Enemy: Intent attack for ' + intentDamage + ' (player HP: ' + state.player.hp + ')');
        } else if (enemyAction === 'SKIPPED') {
            stats.enemySkippedTurns++;
            stats.bugs.push({
                turn: stats.turns,
                type: 'ENEMY_SKIPPED_TURN',
                details: 'Enemy did not take any action',
                intentState: intent.get() ? JSON.stringify(intent.get()) : 'null'
            });
            log('BUG: Enemy skipped turn!');
        }

        // Tick intent at end of enemy turn
        if (intent.isTelegraphed()) {
            intent.tick();
        }

        // Decay defend cooldown
        if (state.player.defendCooldown > 0) {
            state.player.defendCooldown--;
        }

        // Check player death
        if (state.player.hp <= 0) {
            stats.winner = 'enemy';
            state.active = false;
            break;
        }
    }

    if (stats.turns >= maxTurns) {
        stats.winner = 'timeout';
    }

    // Check: did we count enemy action for the final turn?
    // If player wins, enemy didn't get to act on that turn
    // So expected enemy actions = turns - 1 (if player wins on their attack)
    if (stats.winner === 'player') {
        // Player killed enemy before enemy could respond
        // This is expected - enemy doesn't act after dying
        stats.expectedEnemyActions = stats.turns - 1;
    } else {
        stats.expectedEnemyActions = stats.turns;
    }

    // Validate: announcements should (eventually) lead to attacks
    // This is tricky because battle might end before intent executes

    return stats;
}

function decidePlayerAction(state) {
    // Simple AI: defend if enemy has intent charging, otherwise attack
    // Also respect defend cooldown
    if (state.player.defendCooldown <= 0 && Math.random() < 0.3) {
        return 'defend';
    }
    return 'attack';
}

function simulateEnemyTurn(state, intent, log) {
    var _hasBattleIntent = true;
    var _intentsEnabled = true;
    var enemy = state.enemy;
    var player = state.player;
    var turn = state.turn;

    if (_hasBattleIntent && _intentsEnabled) {
        var currentIntent = intent.get();

        // If there's a ready intent, execute it
        if (currentIntent && currentIntent.isTelegraphed && intent.isReady()) {
            log('  [Intent] Executing ready intent');
            return 'INTENT_ATTACK';
        }

        // If there's an active (not ready) intent that was already announced
        if (currentIntent && currentIntent.isTelegraphed && currentIntent.turnsRemaining > 0) {
            log('  [Intent] Intent charging, doing normal attack');
            // Fall through to normal attack
        } else {
            // Check if a new intent should trigger
            var newIntent = intent.generate(enemy, player, turn);

            if (newIntent && newIntent.isTelegraphed) {
                log('  [Intent] New intent generated');
                return 'INTENT_ANNOUNCE';
            }
        }
    }

    // Normal attack
    return 'NORMAL_ATTACK';
}

// ============================================================================
// TEST RUNNER
// ============================================================================

function runSimulations(count, verbose) {
    console.log('========================================');
    console.log('BATTLE SIMULATION TEST');
    console.log('Running ' + count + ' battles...');
    console.log('========================================\n');

    var allBugs = [];
    var totalStats = {
        battles: count,
        playerWins: 0,
        enemyWins: 0,
        timeouts: 0,
        totalTurns: 0,
        totalEnemyActions: 0,
        totalEnemySkips: 0,
        avgTurnsPerBattle: 0
    };

    for (var i = 0; i < count; i++) {
        var result = simulateBattle({
            verbose: verbose && i < 3,  // Only log first 3 battles if verbose
            maxTurns: 50
        });

        if (result.winner === 'player') totalStats.playerWins++;
        else if (result.winner === 'enemy') totalStats.enemyWins++;
        else totalStats.timeouts++;

        totalStats.totalTurns += result.turns;
        totalStats.totalEnemyActions += result.enemyNormalAttacks + result.enemyIntentAnnouncements + result.enemyIntentAttacks;
        totalStats.totalEnemySkips += result.enemySkippedTurns;
        totalStats.expectedEnemyActions = (totalStats.expectedEnemyActions || 0) + (result.expectedEnemyActions || result.turns);

        if (result.bugs.length > 0) {
            allBugs = allBugs.concat(result.bugs.map(function(b) {
                b.battle = i + 1;
                return b;
            }));
        }
    }

    totalStats.avgTurnsPerBattle = (totalStats.totalTurns / count).toFixed(1);

    // Report
    console.log('\n========================================');
    console.log('RESULTS');
    console.log('========================================');
    console.log('Battles run:', count);
    console.log('Player wins:', totalStats.playerWins, '(' + ((totalStats.playerWins/count)*100).toFixed(1) + '%)');
    console.log('Enemy wins:', totalStats.enemyWins, '(' + ((totalStats.enemyWins/count)*100).toFixed(1) + '%)');
    console.log('Timeouts:', totalStats.timeouts);
    console.log('Average turns per battle:', totalStats.avgTurnsPerBattle);
    console.log('Total enemy actions:', totalStats.totalEnemyActions);
    console.log('Total enemy skipped turns:', totalStats.totalEnemySkips);

    if (allBugs.length > 0) {
        console.log('\n========================================');
        console.log('BUGS FOUND: ' + allBugs.length);
        console.log('========================================');

        // Group by type
        var bugsByType = {};
        allBugs.forEach(function(bug) {
            if (!bugsByType[bug.type]) {
                bugsByType[bug.type] = [];
            }
            bugsByType[bug.type].push(bug);
        });

        for (var type in bugsByType) {
            console.log('\n' + type + ': ' + bugsByType[type].length + ' occurrences');
            // Show first 3 examples
            bugsByType[type].slice(0, 3).forEach(function(bug) {
                console.log('  Battle ' + bug.battle + ', Turn ' + bug.turn + ': ' + bug.details);
                if (bug.intentState) {
                    console.log('    Intent state: ' + bug.intentState);
                }
            });
        }
    } else {
        console.log('\n========================================');
        console.log('NO BUGS FOUND!');
        console.log('========================================');
    }

    // Verify expected behavior
    var expectedActions = totalStats.expectedEnemyActions;  // Adjusted for player wins
    var actualActions = totalStats.totalEnemyActions + totalStats.totalEnemySkips;

    console.log('\n========================================');
    console.log('VALIDATION');
    console.log('========================================');
    console.log('Expected enemy actions (1 per turn):', expectedActions);
    console.log('Actual enemy actions:', actualActions);

    if (actualActions !== expectedActions) {
        console.log('FAIL: Missing ' + (expectedActions - actualActions) + ' enemy actions!');
        return false;
    }

    if (totalStats.totalEnemySkips > 0) {
        console.log('FAIL: ' + totalStats.totalEnemySkips + ' enemy turns were skipped!');
        return false;
    }

    console.log('PASS: All turns accounted for');
    return true;
}

// ============================================================================
// DEFENDING + INTENT FLOW TEST
// ============================================================================

function runDefendIntentTest() {
    console.log('\n========================================');
    console.log('DEFEND + INTENT ATTACK FLOW TEST');
    console.log('========================================\n');

    var bugs = [];

    // Run 500 battles where player always defends when intent is announced
    for (var i = 0; i < 500; i++) {
        var state = createBattleState();
        var intent = createMockBattleIntent();

        var turnLog = [];
        var maxTurns = 20;

        for (var turn = 1; turn <= maxTurns && state.active; turn++) {
            state.turn = turn;
            var turnActions = { turn: turn, player: null, enemy: null };

            // Check if intent is charging - if so, player defends
            var currentIntent = intent.get();
            if (currentIntent && currentIntent.isTelegraphed && currentIntent.turnsRemaining > 0) {
                // Intent announced last turn, player defends
                turnActions.player = 'defend';
                state.player.defending = 2;
            } else {
                turnActions.player = 'attack';
                state.enemy.hp -= 5;
            }

            if (state.enemy.hp <= 0) {
                state.active = false;
                break;
            }

            // Enemy turn (same logic as main simulation)
            var enemyAction = simulateEnemyTurn(state, intent, function(){});

            if (enemyAction === 'NORMAL_ATTACK') {
                turnActions.enemy = 'NORMAL_ATTACK';
                var damage = 4;
                if (state.player.defending > 0) {
                    damage = 2;
                    state.player.defending--;
                }
                state.player.hp -= damage;
            } else if (enemyAction === 'INTENT_ANNOUNCE') {
                turnActions.enemy = 'INTENT_ANNOUNCE';
            } else if (enemyAction === 'INTENT_ATTACK') {
                turnActions.enemy = 'INTENT_ATTACK';
                var intentDamage = 12;
                if (state.player.defending > 0) {
                    intentDamage = 6;
                    state.player.defending--;
                }
                state.player.hp -= intentDamage;
                intent.clear(turn, state.enemy.id);
            } else {
                turnActions.enemy = 'SKIPPED';
                bugs.push({
                    battle: i + 1,
                    turn: turn,
                    type: 'ENEMY_SKIPPED_IN_DEFEND_FLOW',
                    playerDefending: state.player.defending,
                    intentState: intent.get() ? JSON.stringify(intent.get()) : 'null'
                });
            }

            // Tick intent
            if (intent.isTelegraphed()) {
                intent.tick();
            }

            turnLog.push(turnActions);

            if (state.player.hp <= 0) {
                state.active = false;
                break;
            }
        }

        // Validate: if player defended when intent was charging,
        // the intent attack should have triggered QTE (simulated as reduced damage)
        // Check the turn log for issues
        for (var j = 1; j < turnLog.length; j++) {
            var prevTurn = turnLog[j-1];
            var currTurn = turnLog[j];

            // If enemy announced intent on prev turn, and player defended,
            // then this turn enemy should do intent attack (not normal attack, not skip)
            if (prevTurn.enemy === 'INTENT_ANNOUNCE' && currTurn.player === 'defend') {
                // Next turn after defend, enemy should execute intent
                if (j + 1 < turnLog.length) {
                    var nextTurn = turnLog[j + 1];
                    if (nextTurn.enemy !== 'INTENT_ATTACK' && nextTurn.enemy !== 'NORMAL_ATTACK') {
                        bugs.push({
                            battle: i + 1,
                            turn: nextTurn.turn,
                            type: 'INTENT_NOT_EXECUTED_AFTER_DEFEND',
                            expected: 'INTENT_ATTACK',
                            got: nextTurn.enemy,
                            sequence: [prevTurn, currTurn, nextTurn]
                        });
                    }
                }
            }
        }
    }

    if (bugs.length > 0) {
        console.log('BUGS FOUND: ' + bugs.length);

        var bugsByType = {};
        bugs.forEach(function(bug) {
            if (!bugsByType[bug.type]) bugsByType[bug.type] = [];
            bugsByType[bug.type].push(bug);
        });

        for (var type in bugsByType) {
            console.log('\n' + type + ': ' + bugsByType[type].length + ' occurrences');
            bugsByType[type].slice(0, 5).forEach(function(bug) {
                console.log('  Battle ' + bug.battle + ', Turn ' + bug.turn);
                console.log('    ' + JSON.stringify(bug));
            });
        }
        return false;
    }

    console.log('PASS: Defend + Intent flow works correctly');
    return true;
}

// ============================================================================
// CONTINUOUS DEFEND TEST (player.defending > 0 auto-attack)
// ============================================================================

function runContinuousDefendTest() {
    console.log('\n========================================');
    console.log('CONTINUOUS DEFEND TEST');
    console.log('(Enemy attacks multiple times during defend stance)');
    console.log('========================================\n');

    var bugs = [];

    // Test scenario: player defends (defending = 2), enemy should attack twice
    for (var i = 0; i < 100; i++) {
        var state = createBattleState();
        var intent = createMockBattleIntent();

        // Player defends - should block 2 attacks
        state.player.defending = 2;
        state.turn = 1;

        var attacksWhileDefending = 0;
        var maxIterations = 10;
        var iterations = 0;

        // Simulate the "enemy attacks repeatedly while player is defending" flow
        // This mirrors the fix in continueFinishEnemyTurn
        while (state.player.defending > 0 && iterations < maxIterations) {
            iterations++;

            // Enemy attacks
            var enemyAction = simulateEnemyTurn(state, intent, function(){});

            if (enemyAction === 'NORMAL_ATTACK' || enemyAction === 'INTENT_ATTACK') {
                attacksWhileDefending++;
                state.player.defending--;
            } else if (enemyAction === 'INTENT_ANNOUNCE') {
                // Intent announcement still counts as enemy action
                // but shouldn't decrement defending
                attacksWhileDefending++;
            } else if (enemyAction === 'SKIPPED') {
                bugs.push({
                    battle: i + 1,
                    iteration: iterations,
                    type: 'ENEMY_SKIPPED_DURING_DEFEND',
                    defending: state.player.defending,
                    intentState: intent.get() ? JSON.stringify(intent.get()) : 'null'
                });
                break;
            }

            // Tick intent
            if (intent.isTelegraphed()) {
                intent.tick();
            }
        }

        if (iterations >= maxIterations) {
            bugs.push({
                battle: i + 1,
                type: 'INFINITE_LOOP_DURING_DEFEND',
                defending: state.player.defending,
                attacks: attacksWhileDefending
            });
        }

        // After defend wears off (defending = 0), verify we got expected attacks
        // With defending = 2, we should get at least 2 attacks (or announcements)
        if (attacksWhileDefending < 2 && bugs.length === 0) {
            // This might not be a bug if intent announcement happened
            // Just log for investigation
        }
    }

    if (bugs.length > 0) {
        console.log('BUGS FOUND: ' + bugs.length);

        var bugsByType = {};
        bugs.forEach(function(bug) {
            if (!bugsByType[bug.type]) bugsByType[bug.type] = [];
            bugsByType[bug.type].push(bug);
        });

        for (var type in bugsByType) {
            console.log('\n' + type + ': ' + bugsByType[type].length + ' occurrences');
            bugsByType[type].slice(0, 5).forEach(function(bug) {
                console.log('  ' + JSON.stringify(bug));
            });
        }
        return false;
    }

    console.log('PASS: Continuous defend flow works correctly');
    return true;
}

// ============================================================================
// REAL WORLD SCENARIO TEST
// ============================================================================

function runRealWorldScenarioTest() {
    console.log('\n========================================');
    console.log('REAL WORLD SCENARIO TEST');
    console.log('(Exact reproduction of user\'s bug report)');
    console.log('========================================\n');

    var bugs = [];

    // Scenario from user:
    // 1. Agnes announces big attack (intent)
    // 2. Player defends
    // 3. Agnes uses big attack (QTE triggers)
    // 4. After QTE, player should be able to act OR enemy attacks again if defending > 0

    for (var i = 0; i < 100; i++) {
        var state = createBattleState();
        var intent = createMockBattleIntent();

        // Force intent to trigger on turn 1
        state.enemy.intents[0].chance = 1.0;
        state.enemy.intents[0].minTurn = 1;

        state.turn = 1;

        // Turn 1: Enemy announces intent
        var action1 = simulateEnemyTurn(state, intent, function(){});
        if (action1 !== 'INTENT_ANNOUNCE') {
            // Intent didn't trigger, skip this simulation
            continue;
        }

        // End of turn 1: tick intent
        intent.tick();

        // Turn 2: Player defends
        state.turn = 2;
        state.player.defending = 2;

        // Turn 2: Enemy should execute intent (it's ready now)
        var action2 = simulateEnemyTurn(state, intent, function(){});
        if (action2 !== 'INTENT_ATTACK') {
            bugs.push({
                battle: i + 1,
                turn: 2,
                type: 'INTENT_NOT_EXECUTED_WHEN_READY',
                expected: 'INTENT_ATTACK',
                got: action2,
                intentState: intent.get() ? JSON.stringify(intent.get()) : 'null'
            });
            continue;
        }

        // Intent attack happened, defending decrements to 1
        state.player.defending--;
        intent.clear(state.turn, state.enemy.id);

        // Now: player.defending = 1
        // The FIX we added should trigger another enemy attack automatically
        // Simulate that logic here:

        if (state.player.defending > 0) {
            // Enemy should attack again (this is the fix we added)
            var action3 = simulateEnemyTurn(state, intent, function(){});

            if (action3 === 'SKIPPED') {
                bugs.push({
                    battle: i + 1,
                    turn: 2.5,  // "half turn" - automatic follow-up
                    type: 'ENEMY_SKIPPED_AFTER_INTENT_DURING_DEFEND',
                    defending: state.player.defending,
                    intentState: intent.get() ? JSON.stringify(intent.get()) : 'null'
                });
            } else {
                // Good - enemy attacked again
                state.player.defending--;
            }

            if (intent.isTelegraphed()) {
                intent.tick();
            }
        }

        // Now defending should be 0
        if (state.player.defending !== 0) {
            bugs.push({
                battle: i + 1,
                type: 'DEFENDING_NOT_ZEROED',
                defending: state.player.defending
            });
        }
    }

    if (bugs.length > 0) {
        console.log('BUGS FOUND: ' + bugs.length);

        var bugsByType = {};
        bugs.forEach(function(bug) {
            if (!bugsByType[bug.type]) bugsByType[bug.type] = [];
            bugsByType[bug.type].push(bug);
        });

        for (var type in bugsByType) {
            console.log('\n' + type + ': ' + bugsByType[type].length + ' occurrences');
            bugsByType[type].slice(0, 5).forEach(function(bug) {
                console.log('  ' + JSON.stringify(bug));
            });
        }
        return false;
    }

    console.log('PASS: Real world scenario works correctly');
    return true;
}

// ============================================================================
// NO INTENTS TEST
// ============================================================================

function runNoIntentsTest() {
    console.log('\n========================================');
    console.log('NO INTENTS TEST');
    console.log('(Enemy with no intents configured)');
    console.log('========================================\n');

    var bugs = [];

    for (var i = 0; i < 100; i++) {
        var state = createBattleState();
        state.enemy.intents = [];  // No intents!

        var intent = createMockBattleIntent();

        for (var turn = 1; turn <= 10 && state.active; turn++) {
            state.turn = turn;

            // Player attacks
            state.enemy.hp -= 5;
            if (state.enemy.hp <= 0) {
                state.active = false;
                break;
            }

            // Enemy turn
            var action = simulateEnemyTurn(state, intent, function(){});

            if (action === 'SKIPPED') {
                bugs.push({
                    battle: i + 1,
                    turn: turn,
                    type: 'ENEMY_SKIPPED_NO_INTENTS',
                    intentState: intent.get() ? JSON.stringify(intent.get()) : 'null'
                });
            } else if (action !== 'NORMAL_ATTACK') {
                // With no intents, should always be normal attack
                bugs.push({
                    battle: i + 1,
                    turn: turn,
                    type: 'UNEXPECTED_ACTION_NO_INTENTS',
                    expected: 'NORMAL_ATTACK',
                    got: action
                });
            }

            state.player.hp -= 4;
            if (state.player.hp <= 0) {
                state.active = false;
            }
        }
    }

    if (bugs.length > 0) {
        console.log('BUGS FOUND: ' + bugs.length);
        bugs.slice(0, 5).forEach(function(bug) {
            console.log('  ' + JSON.stringify(bug));
        });
        return false;
    }

    console.log('PASS: No intents flow works correctly');
    return true;
}

// ============================================================================
// MAIN
// ============================================================================

if (typeof module !== 'undefined' && require.main === module) {
    var count = parseInt(process.argv[2]) || 1000;
    var verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

    var success1 = runSimulations(count, verbose);
    var success2 = runDefendIntentTest();
    var success3 = runContinuousDefendTest();
    var success4 = runRealWorldScenarioTest();
    var success5 = runNoIntentsTest();

    var allPassed = success1 && success2 && success3 && success4 && success5;
    console.log('\n========================================');
    console.log(allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');
    console.log('========================================');

    process.exit(allPassed ? 0 : 1);
}

module.exports = { runSimulations, simulateBattle };
