async function phase3() {
  await showText('Phase 3', 999, 'blue');
}

Phase3 = function() {
  console.log("Start Phase Three");
  for(var player of players) {
    player.currentPhaseChannel.send(3)
  }

  this.start = function() {
    
  }
}
