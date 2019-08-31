Phase3 = function() {
  console.log("Start Phase Three");
  for(var player of players) {
    player.currentPhaseChannel.send(3)
  }

  this.start = function() {
    
  }
}
