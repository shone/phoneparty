async function phase2() {
  players.forEach(player => {

    player.phaseTwo.onmessage = event => {
      console.log(JSON.parse(event.data));
      let data = JSON.parse(event.data);
      if (data.message === "TAKEN") {
        const video = player.video;
        const screenshotCanvas = document.createElement("canvas");
        $(screenshotCanvas).css({
          'position' : 'absolute',
          'z-index' : '2',
          'width'  : '100%',
          'height' : '100%',
          'object-fit' : 'cover',
          'transform' : 'scaleX(-1)'
        });
        screenshotCanvas.width = video.videoWidth;
        screenshotCanvas.height = video.videoHeight;
        $(player).prepend(screenshotCanvas);
        const context = screenshotCanvas.getContext('2d');
        context.drawImage(video, 0, 0, screenshotCanvas.width, screenshotCanvas.height);


        const boxSize = data.boxSize;
        let croppedCanvas = document.createElement("canvas");
        let croppedContext = croppedCanvas.getContext("2d");
        croppedContext.drawImage(screenshotCanvas,
          (screenshotCanvas.width - boxSize) / 2,   // sx
          (screenshotCanvas.height - boxSize) / 2,  // sy
          boxSize, boxSize, 0, 0, boxSize, boxSize);  // sw, sh, dx, dy, dw, dh


        const imageCode = screenshotCanvas.toDataURL();
        const croppedCode = croppedCanvas.toDataURL();

        console.log(imageCode);
        console.log(croppedCode);

        playerImages.push({
          playerId: player.id,
          image: imageCode,
          croppedImage: croppedCode
        });

        document.body.dispatchEvent(new Event('imageAdded'));
      }
    };

    player.phaseTwo.send("COUNTDOWN");

  });

  return new Promise(resolve => {
    if (playerImages.length >= numberOfPlayers) {
      resolve();
    } else {
      document.body.addEventListener('imageAdded', function callback() {
        if (playerImages.length >= numberOfPlayers) {
          resolve();
          document.body.removeEventListener('imageAdded', callback);
        }
      });
    }
  });
}
