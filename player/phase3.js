function phase3(channels) {
  console.log("Starting phase 3");

  this.imageTypes = {REAL: 0, FAKE: 1, WRONG_COLOR: 2};

  // Add callbacks
  this.onPhaseThreeMessage = function(event) {
    this.data = JSON.parse(event.data);
    this.image_counter = 0;
    console.log(this.data);

    this.response = [];

    console.log(this);
    this.displayNextImage();
  }.bind(this);


  this.onKeyPress = function(event) {
    switch (event.code) {
      case "KeyA":
        this.onImageIsReal();
        break;
      case "KeyD":
        this.onImageIsFake();
        break;
      case "KeyS":
        this.onImageIsWrongColor();
        break;
    }
  }

  this.createDisplay = function() {
    var container = document.createElement("div");
    document.body.append(container);

    this.preview = document.createElement("div");
    container.append(this.preview);

    this.preview.image = document.createElement("img");

    this.preview.append(this.preview.image);
  }

  this.displayNextImage = function() {
    this.block_input = false;
    console.log("display next image", this.image_counter);

    // Remove swipe classes
    this.preview.image.classList.remove("swipeLeft")
    this.preview.image.classList.remove("swipeRight")
    this.preview.image.classList.remove("swipeUp")

    var next_image = this.getNextImage();

    if(next_image == null) {
      console.log("No images left, send data to server");
      var string_data = JSON.stringify(this.response);
      channels.phaseThree.send(string_data);
    }

    this.preview.image.src = "https://loremflickr.com/cache/resized/65535_48234486291_3d66356db3_350_225_nofilter.jpg";
  }

  this.getNextImage = function() {
    if (this.image_counter < this.data.length) {
      return this.data[this.image_counter];
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
    this.response.push({"owner_id": this.data[this.image_counter].owner_id, "result": type});

    window.setTimeout(this.displayNextImage.bind(this), 1000);
    this.block_input = true;
  }

  this.createDisplay();
  document.addEventListener("keypress", this.onKeyPress.bind(this));
  channels.phaseThree.onmessage = this.onPhaseThreeMessage;
}
