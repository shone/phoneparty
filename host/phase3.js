async function phase3() {
  var phase = new function() {
    this.NUMBER_OF_IMAGES = Math.min(5, players.length);
    console.log(this.NUMBER_OF_IMAGES);
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

          data.push({"image_owner": this.images[image_owner].playerId, "image_blob": this.images[image_owner].croppedImage});
        }

        var string_data = JSON.stringify(data)
        console.log(string_data);


        var delay = 10;
        var charSlice = 10000;
        var terminator = "\n";
        var data = string_data;
        var dataSent = 0;
        var intervalID = 0;

        intervalID = setInterval(function(){
          var slideEndIndex = dataSent + charSlice;
          if (slideEndIndex > data.length) {
            slideEndIndex = data.length;
          }
          player.phaseThree.send(data.slice(dataSent, slideEndIndex));
          dataSent = slideEndIndex;
          if (dataSent + 1 >= data.length) {
            player.phaseThree.send("\n");
            clearInterval(intervalID);
          }
        }, delay);

        //player.phaseThree.send(string_data)
      }
    }

    this.onPlayerVoteResponse = function(event) {
      console.log(event.data);
      this.player_responses.push(JSON.parse(event.data));
    }

    this.getResults = function() {
      console.log("get results");
      var final_results = {};
      for(var response of this.player_responses) {
        for(var image_result of response) {
          console.log(final_results);
          console.log(image_result.image_owner);
          final_results[image_result.image_owner] = final_results[image_result.image_owner] || {id: image_result.image_owner, realCount: 0, fakeCount: 0, wrongCount: 0}
          switch (image_result.result) {
            case "0":
              final_results[image_result.image_owner].realCount += 1
              break;
            case "1":
              final_results[image_result.image_owner].fakeCount += 1
              break;
            case "2":
              final_results[image_result.image_owner].wrongCount += 1
              break;
            default:
          }
        }
      }

      //Fix if no one has answered
      for(var image of this.images) {
        if(final_results[image.playerId] == undefined) {
          final_results[image.playerId] = final_results[image.playerId] || {id: image.playerId, realCount: 0, fakeCount: 0, wrongCount: 0}
        }
      }

      var wrongImageIds = [];
      var fakestImage = {id: "fake", realCount: 100, fakeCount: -100, wrongCount: -100}

      console.log(final_results);
      for(var result_id in final_results) {
        var result = final_results[result_id];
        if(result.wrongCount >= 2) {
          wrongImageIds.push(result_id);
        } else {
          if (result.realCount - result.fakeCount < fakestImage.realCount - fakestImage.fakeCount) {
            console.log("New fakes image");
            fakestImage = result;
          }
        }
      }

      return {worstPlayerIds: fakestImage.id, wrongColorPlayerIds: wrongImageIds}
    }

    this.start = async function() {
      console.log("Start Phase Three");

      this.player_responses = [];

      await this.sendImagesToPlayers();

      await countdown(20, 'It\'s voting time!', 999);
    }
  }

  await phase.start();
  var results = phase.getResults();
  imageResults = results;
}
