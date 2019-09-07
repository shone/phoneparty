"use strict";

async function photoTakingScreen() {
  for (const player of players) {
    player.classList.add('moving-to-grid');
  }

  const playerGrid = startPlayerGrid();
//   await waitForNSeconds(2.5);

  for (const player of players) {
    player.classList.add('scale-down');
  }  
  await waitForNSeconds(0.5);

  // Photo taking screen
  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things photo-taking-screen">
      <h1>Take your photos!</h1>
    </div>
  `);
  const photoTakingScreen = document.body.lastElementChild;
  await new Promise(resolve => {
    acceptAllPlayers(player => {
      player.insertAdjacentHTML('beforeend', `
        <div class="all-the-things phone">
          <div class="phone-background"></div>
          <div class="phone-switched-off-black"></div>
          <div class="phone-foreground"></div>
        </div>
      `);
      player.classList.remove('bubble');
      player.classList.add('taking-photo');
      player.classList.add('moving-to-grid');
      player.classList.remove('scale-down');
      if (!player.parentElement) {
        playerGrid.updateLayout();
        document.body.appendChild(player);
      }
      const photoChannel = player.rtcConnection.createDataChannel('all-the-things_photo');
      photoChannel.onmessage = async function(event) {
        const arrayBuffer = event.data;
        const blob = new Blob([arrayBuffer], {type: 'image/jpeg'});
        const image = new Image();
        image.src = URL.createObjectURL(blob);
        const photoContainer = document.createElement('div');
        photoContainer.classList.add('all-the-things');
        photoContainer.classList.add('photo-container');
        const cropContainer = document.createElement('div');
        cropContainer.classList.add('crop-container');
        cropContainer.appendChild(image);
        player.classList.add('photo-taken');
        photoContainer.appendChild(cropContainer);
        document.body.appendChild(photoContainer);
        player.photo = photoContainer;
        playerGrid.updateLayout();
        setTimeout(() => {
          player.classList.add('hide');
          player.classList.remove('moving-to-grid');
          player.classList.remove('taking-photo');
          player.classList.remove('photo-taken');
          player.style.width  = '';
          player.style.height = '';
          player.querySelector('.phone').remove();
        }, 2000);
        if (players.every(player => player.classList.contains('photo-taken'))) {
          resolve();
        }
      }
    });
  });
  photoTakingScreen.querySelector('h1').textContent = 'All photos taken';
  await waitForKeypress(' ');

  photoTakingScreen.remove();

  return playerGrid;
}
