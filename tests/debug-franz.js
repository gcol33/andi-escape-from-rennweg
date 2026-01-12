/**
 * Debug test for double Franz bug
 * Run in browser console after loading the game
 */

(function() {
    console.log('=== FRANZ DEBUG TEST ===\n');

    // Simulate the state after meeting Franz
    console.log('1. Setting up state: met_franz = true, visited_4th_floor = true');
    flagManager.set('met_franz');
    flagManager.set('visited_4th_floor');

    console.log('   Flags:', flagManager.getAll());
    console.log('   met_franz:', flagManager.has('met_franz'));

    // Check the elevator1 scene
    console.log('\n2. Checking elevator1 scene choices:');
    var elevator1 = story.elevator1;

    if (!elevator1) {
        console.error('   ERROR: elevator1 scene not found!');
        return;
    }

    console.log('   Total choices:', elevator1.choices.length);

    elevator1.choices.forEach(function(choice, i) {
        console.log('\n   Choice ' + i + ': "' + choice.label + '" -> ' + choice.target);
        console.log('   require_flags:', choice.require_flags || 'none');
        console.log('   require_skills:', choice.require_skills || 'none');

        // Check flag requirements
        var flagPass = true;
        if (choice.require_flags && choice.require_flags.length > 0) {
            flagPass = flagManager.checkRequired(choice.require_flags);
            console.log('   Flag check result:', flagPass);
        }

        // Check skill requirements
        var skillPass = true;
        if (choice.require_skills && choice.require_skills.length > 0) {
            // Get current skills
            var currentSkills = typeof VNEngine !== 'undefined' && VNEngine.getSkills ? VNEngine.getSkills() : [];
            var hasAllSkills = choice.require_skills.every(function(s) {
                return currentSkills.indexOf(s) !== -1;
            });
            skillPass = hasAllSkills;
            console.log('   Skill check result:', skillPass, '(have:', currentSkills, ')');
        }

        var wouldShow = flagPass && skillPass;
        console.log('   >>> WOULD SHOW:', wouldShow);
    });

    // Simulate what renderChoices would do
    console.log('\n3. Simulating renderChoices filter:');

    var availableChoices = elevator1.choices.filter(function(choice) {
        if (choice.require_flags && choice.require_flags.length > 0) {
            if (!flagManager.checkRequired(choice.require_flags)) return false;
        }
        // Note: We can't easily check skills without VNEngine internals
        return true;
    });

    console.log('   Choices that pass FLAG filter:');
    availableChoices.forEach(function(c) {
        console.log('   - "' + c.label + '" -> ' + c.target);
    });

    // Check if "Continue" is in the list
    var hasContinue = availableChoices.some(function(c) {
        return c.label === 'Continue';
    });

    console.log('\n4. RESULT:');
    if (hasContinue) {
        console.error('   BUG: "Continue" choice is still available despite met_franz=true!');
    } else {
        console.log('   OK: "Continue" choice correctly filtered out');
    }

    // Check the actual choice that would lead to Franz
    var franzChoice = elevator1.choices.find(function(c) {
        return c.target && c.target.indexOf('FRANZ') !== -1;
    });

    if (franzChoice) {
        console.log('\n5. Franz choice details:');
        console.log('   Label:', franzChoice.label);
        console.log('   Target:', franzChoice.target);
        console.log('   require_flags:', JSON.stringify(franzChoice.require_flags));
        console.log('   checkRequired result:', flagManager.checkRequired(franzChoice.require_flags));
    }

    console.log('\n=== END DEBUG TEST ===');
})();
