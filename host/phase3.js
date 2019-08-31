async function phase3() {
  var phase = new function() {
    this.NUMBER_OF_IMAGES = 5

    this.sendImagesToPlayers = async function() {
      //clientid, image
      var images = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0};
      var player_list = [...players];

      //Shuffle player list
      player_list.sort(() => Math.random() - 0.5);

      for(player_index in player_list) {
        console.log("Send data to player");
        var player = player_list[player_index];
        console.log(this);
        //Add onmessage callback to every player
        player.phaseThree.onmessage = this.onPlayerVoteResponse.bind(this);

        // For image
        var data = [];

        for(var i = 0; i < this.NUMBER_OF_IMAGES; i++) {
          var image_owner = (player_index + 1 + i); // % player_list.length

          data.push({"image_owner": image_owner, "image_blob": images[image_owner]});
        }

        var string_data = JSON.stringify(data)
        console.log(string_data);

        player.phaseThree.send(string_data)
      }
    }

    this.onPlayerVoteResponse = function(event) {
      console.log(event.data);
    }

    this.start = async function() {
      console.log("Start Phase Three");

      await this.sendImagesToPlayers();

      await showText('Phase 3', 999, 'blue');
    }
  }

  await phase.start();
}
