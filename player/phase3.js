bigData = "";

function phase3(channels) {
  new function(channels) {
    console.log("Starting phase 3");

    this.imageTypes = {REAL: 0, FAKE: 1, WRONG_COLOR: 2};

    // Add callbacks
    this.onPhaseThreeMessage = function(event) {
      if (event.data == "\n") {
        var allData = JSON.parse(bigData)
        this.data = allData.data;
        this.color = allData.color;
        this.colorCode = allData.colorCode;
        console.log("colorCode", allData.colorCode);
        this.searchedItem = allData.item;
        this.image_counter = 0;
        console.log(this.data);

        this.response = [];

        this.createDisplay();
        this.displayNextImage();
      } else {
        bigData += event.data;
        //trace("Data chunk received");
      }
      //this.data = JSON.parse(event.data);

      console.log("Adding listeners");
      document.addEventListener('touchstart', (evt) => { this.handleTouchStart(evt) }, false);
      document.addEventListener('touchmove', (evt) => {this.handleTouchMove(evt) }, false);
    }.bind(this);


    var xDown = null;
    var yDown = null;

    this.getTouches = function(evt) {
      return evt.touches ||             // browser API
        evt.originalEvent.touches; // jQuery
    }

    this.handleTouchStart = function(evt) {
      const firstTouch = this.getTouches(evt)[0];
      xDown = firstTouch.clientX;
      yDown = firstTouch.clientY;
    };

    this.handleTouchMove = function(evt) {
      if ( ! xDown || ! yDown ) {
        return;
      }

      var xUp = evt.touches[0].clientX;
      var yUp = evt.touches[0].clientY;

      var xDiff = xDown - xUp;
      var yDiff = yDown - yUp;

      if ( Math.abs( xDiff ) > Math.abs( yDiff ) ) {/*most significant*/
        if ( xDiff > 0 ) {
          console.log("left");
          this.onImageIsReal();
        } else {
          console.log("right");
          this.onImageIsFake();
        }
      } else {
        if ( yDiff > 0 ) {
          /* up swipe */
        } else {
          /* down swipe */
        }
      }
      /* reset values */
      xDown = null;
      yDown = null;
    };

    this.onKeyPress = function(event) {
      switch (event.code) {
        case "KeyA":
          this.onImageIsReal();
          break;
        case "KeyD":
          this.onImageIsFake();
          break;
        case "KeyW":
          this.onImageIsWrongColor();
          break;
      }
    }

    this.createDisplay = function() {
      //Remove existing things
      var phase1 = document.getElementById("phase1");
      if(phase1) {phase1.remove();}
      var phase2 = document.getElementById("camera-screen");
      if(phase2) {phase2.remove();}

      var container = document.createElement("div");
      document.body.append(container);
      container.id = "phase3";
      container.style.position = "absolute";

      this.preview = document.createElement("div");
      container.append(this.preview);
      this.preview.style.overflow = "hidden";
      this.preview.style.height = "80vw";
      this.preview.style.width = "80vw";
      this.preview.style.marginLeft = "10vw";
      this.preview.style.marginTop = "10vw";
      this.preview.border = "5px solid gray"
      this.preview.boxShadow = "2px 2px 5px black"

      this.preview.image = document.createElement("img");
      this.preview.image.style.height = "100%";
      this.preview.image.style.width = "200%";

      this.preview.append(this.preview.image);

      this.realButton = document.createElement("button");
      container.append(this.realButton);

      this.realButton.addEventListener("click", this.onImageIsReal.bind(this));
      this.realButton.innerHTML = "Real " + this.searchedItem;
      this.realButton.style.width = "25vw";
      this.realButton.style.height = "25vw";
      this.realButton.style.position = "absolute";
      this.realButton.style.bottom = "10vw";
      this.realButton.style.left = "10vw";
      this.realButton.style.fontSize = "15px";
      this.realButton.style.backgroundColor = "green";
      this.realButton.style.color = "black";
      this.realButton.style.fontFamily = "arial";

      this.wrongButton = document.createElement("button");
      container.append(this.wrongButton);

      this.wrongButton.addEventListener("click", this.onImageIsWrongColor.bind(this));
      this.wrongButton.innerHTML = "This is not even " + this.color;
      this.wrongButton.style.width = "25vw";
      this.wrongButton.style.height = "25vw";
      this.wrongButton.style.position = "absolute";
      this.wrongButton.style.bottom = "15vw";
      this.wrongButton.style.left = "37.5vw";
      this.wrongButton.style.fontSize = "15px";
      this.wrongButton.style.backgroundColor = "blue";
      this.wrongButton.style.color = "black";
      this.wrongButton.style.fontFamily = "arial";

      this.fakeButton = document.createElement("button");
      container.append(this.fakeButton);

      this.fakeButton.addEventListener("click", this.onImageIsFake.bind(this));
      this.fakeButton.innerHTML = "Fake! This is not a " + this.selectedItemd;
      this.fakeButton.style.width = "25vw";
      this.fakeButton.style.height = "25vw";
      this.fakeButton.style.position = "absolute";
      this.fakeButton.style.bottom = "10vw";
      this.fakeButton.style.left = "65vw";
      this.fakeButton.style.fontSize = "15px";
      this.fakeButton.style.backgroundColor = "red";
      this.fakeButton.style.color = "black";
      this.fakeButton.style.fontFamily = "arial";

      container.style.width = "100%";
      container.style.height = "100%";
      console.log(this.colorCode);
      container.style.backgroundColor = this.colorCode;
    }

    this.displayNextImage = function() {
      this.block_input = false;
      console.log("display next image");

      // Remove swipe classes
      this.preview.image.classList.remove("swipeLeft")
      this.preview.image.classList.remove("swipeRight")
      this.preview.image.classList.remove("swipeUp")

      var next_image = this.getNextImage();

      if(next_image == null) {
        if(!this.response_send) {
          console.log("No images left, send data to server");
          var string_data = JSON.stringify(this.response);
          channels.phaseThree.send(string_data);

          this.response_send = true;
        }
        this.preview.image.style.display = "none";
      } else {
        this.preview.image.src = next_image;
      }
    }

    this.getNextImage = function() {
      if (this.image_counter < this.data.length) {
        console.log("Image " + (this.image_counter+1) + " out of " + this.data.length);
        return this.data[this.image_counter++].image_blob;
      }
      return null;
    }

    this.onImageIsReal = function() {
      if(this.block_input) {return;}

      console.log("real");
      this.preview.image.classList.add("swipeLeft");
      this.setCurrentImageAs(this.imageTypes.REAL);
    }

    this.onImageIsFake = function() {
      if(this.block_input) {return;}

      console.log("Fake");
      this.preview.image.classList.add("swipeRight");
      this.setCurrentImageAs(this.imageTypes.FAKE);
    }

    this.onImageIsWrongColor = function() {
      if(this.block_input) {return;}

      console.log("Wrong color");
      this.preview.image.classList.add("swipeUp");
      this.setCurrentImageAs(this.imageTypes.WRONG_COLOR);
    }

    this.setCurrentImageAs = function(type) {
      this.response.push({"image_owner": this.data[this.image_counter - 1].image_owner, "result": type});

      window.setTimeout(this.displayNextImage.bind(this), 1000);
      this.block_input = true;
    }

    document.addEventListener("keypress", this.onKeyPress.bind(this));
    channels.phaseThree.onmessage = this.onPhaseThreeMessage;
  }(channels);
}
