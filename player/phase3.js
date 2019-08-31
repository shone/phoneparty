function phase3(channels) {
  console.log("Starting phase 3");

  channels.phaseThree.onmessage = function(event) {
    data = JSON.parse(event.data);
    console.log("Foo");
    console.log(data);
  };
}
