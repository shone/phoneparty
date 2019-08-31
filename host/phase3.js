async function phase3() {
  var phase = new function() {
    this.NUMBER_OF_IMAGES = 5

    this.sendImagesToPlayers = async function() {
      //clientid, image
      this.images = playerImages;

      //Shuffle player list
      this.images.sort(() => Math.random() - 0.5);

      for(player_index in players) {
        console.log("Send data to player");
        var player = players[player_index];
        console.log(this);
        //Add onmessage callback to every player
        player.phaseThree.onmessage = this.onPlayerVoteResponse.bind(this);

        // For image
        var data = [];

        var own_image_id = -1;

        for (image_index in this.images) {
          if(image_index == player.id) {
            own_image_id = image_index;
          }
        }

        for(var i = 0; i < this.NUMBER_OF_IMAGES; i++) {
          var image_owner = (own_image_id + 1 + i) % this.images.length;

          console.log(this.images, image_owner);

          data.push({"image_owner": image_owner, "image_blob": this.images[parseInt(image_owner)].croppedImage});
        }

        var string_data = JSON.stringify(data)
        console.log(string_data);

        player.phaseThree.send(string_data)
      }
    }

    this.onPlayerVoteResponse = function(event) {
      console.log(event.data);
      this.player_responses.push(JSON.parse(event.data));
    }

    this.getResults = function() {
      console.log("get results");
    }

    this.start = async function() {
      console.log("Start Phase Three");

      this.player_responses = [];

      await this.sendImagesToPlayers();

      await showText('Phase 3', 999, 'blue');
    }
  }

  await phase.start();
  var results = phase.getResults();
}
