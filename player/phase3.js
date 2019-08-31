async function phase3() {


  channels.phaseThree.onmessage = function(event) {
    data = JSON.parse(event.data);


  };
}
