// Run in browser console to debug pagination
(function() {
    var storyOutput = document.getElementById('story-output');
    if (!storyOutput) { console.log('No story-output element'); return; }
    
    var computed = getComputedStyle(storyOutput);
    var paddingLeft = parseFloat(computed.paddingLeft) || 0;
    var paddingRight = parseFloat(computed.paddingRight) || 0;
    var contentWidth = storyOutput.clientWidth - paddingLeft - paddingRight;
    
    // Get the CSS variable
    var fixedHeightVar = document.documentElement.style.getPropertyValue('--story-fixed-height');
    console.log('--story-fixed-height (inline):', fixedHeightVar || 'NOT SET');
    
    // Create measurer like pagination does
    var measurer = document.createElement('div');
    measurer.style.cssText = 'position:absolute;visibility:hidden;width:' + contentWidth + 'px;height:auto;max-height:none;overflow:visible;font-size:' + computed.fontSize + ';font-family:' + computed.fontFamily + ';line-height:' + computed.lineHeight + ';padding:0;margin:0;';
    document.body.appendChild(measurer);
    
    // Measure 3 lines
    measurer.innerHTML = '<p class="typewriter-text" style="margin:0;padding:0;display:block;">Mgy<br>Mgy<br>Mgy</p>';
    var threeLineHeight = measurer.offsetHeight;
    
    // Measure actual text
    var testText = 'The squirrel chirps in acknowledgment, then scampers up to your shoulder. It peers down at the Monstrous Coffee with what can only be described as determination. With a mighty leap, it launches itself at the coffee cup, claws extended.';
    measurer.innerHTML = '<p class="typewriter-text" style="margin:0;padding:0;display:block;">' + testText + '</p>';
    var textHeight = measurer.offsetHeight;
    
    console.log('Content width:', contentWidth + 'px');
    console.log('3-line height:', threeLineHeight + 'px');
    console.log('Test text height:', textHeight + 'px');
    console.log('Should paginate?', textHeight > threeLineHeight ? 'YES' : 'NO');
    
    document.body.removeChild(measurer);
})();
