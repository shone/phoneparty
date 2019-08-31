async function phase3() {
  await showText('Phase 3', 999, 'blue');
}


/*
    class Phase3 {
      NUMBER_OF_IMAGES = 5

      start() {
        console.log("Start Phase Three");

        for(var player of players) {
          player.currentPhaseChannel.send(3);
        }

        this.sendImagesToPlayers();
  }

  sendImagesToPlayers() {
    //clientid, image
    images = {0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null};
    player_list = [...players];

    //Shuffle player list
    player_list.sort(() => Math.random() - 0.5);

    for(player_index in player_list) {
      var player = player_list[player_id];

      // For image
      var data = [];

      for(var i = 0; i < this.NUMBER_OF_IMAGES; i++) {
        var image_owner = (player_index + 1 + i); // % player_list.length

        data.push({"image_owner": image_owner, "image_blob": images[image_owner]})
      }

      var string_data = JSON.stringify(data)

      player.phase3data.send(string_data)
    }
  }
}
*/


// Broadcast new phase
// Send images to players
