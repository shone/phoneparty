import {waitForNSeconds} from '/shared/utils.mjs';
import {players, acceptAllPlayers, stopAcceptingPlayers, listenForLeavingPlayer, stopListeningForLeavingPlayer} from '/host/players.mjs';
import {startPlayerGrid} from './allTheThings.mjs';

export default async function photoTakingScreen() {
  await waitForNSeconds(1);

  const playerPhotos = new Map();

  // Layout players as a grid of bubbles
  acceptAllPlayers(player => {
    player.classList.add('bubble');
    player.classList.add('moving-to-grid');
    if (!player.parentElement) {
      document.body.appendChild(player);
    }
  });
  const playerGrid = startPlayerGrid(playerPhotos);
  await waitForNSeconds(2.5);
  stopAcceptingPlayers();

  // Hide players, as they will transition into phones next
  for (const player of players) {
    player.classList.add('scale-down');
  }
  await waitForNSeconds(0.5);
  for (const player of players) {
    player.classList.remove('scale-down');
    player.classList.remove('bubble');
  }

  const shutterSound        = new Audio('/games/all-the-things/sounds/camera-shutter.ogg');
  const allPhotosTakenSound = new Audio('/games/all-the-things/sounds/all-photos-taken.mp3');

  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things photo-taking-screen">
      <h1>Take your photos!</h1>
    </div>
  `);
  const photoTakingScreen = document.body.lastElementChild;

  // Wait for every player to take a photo
  const photoChannels = [];
  const timers = [];
  await new Promise(resolve => {
    function checkIfAllPhotosTaken() {
      if (players.length > 0 && players.every(p => playerPhotos.has(p))) {
        resolve();
        stopAcceptingPlayers();
        stopListeningForLeavingPlayer(checkIfAllPhotosTaken);
      }
    }
    acceptAllPlayers(player => {
      player.classList.add('taking-photo');
      player.classList.add('moving-to-grid');
      player.insertAdjacentHTML('beforeend', `
        <div class="all-the-things phone">
          <div class="phone-background"></div>
          <div class="phone-switched-off-black"></div>
          <div class="phone-foreground"></div>
        </div>
      `);
      if (!player.parentElement) {
        document.body.appendChild(player);
      }
      timers.push(setTimeout(() => player.classList.add('video-not-visible'), 15000));
      const photoChannel = player.rtcConnection.createDataChannel('all-the-things_photo');
      photoChannels.push(photoChannel);
      photoChannel.onmessage = async function(event) {
        shutterSound.play().catch(() => {});
        const arrayBuffer = event.data;
        const blob = new Blob([arrayBuffer], {type: 'image/jpeg'});
        const image = new Image();
        image.src = URL.createObjectURL(blob);
        const photoContainer = document.createElement('div');
        photoContainer.classList.add('all-the-things');
        photoContainer.classList.add('photo-container');
        photoContainer.player = player;
        photoContainer.arrayBuffer = arrayBuffer;
        const cropContainer = document.createElement('div');
        cropContainer.classList.add('crop-container');
        cropContainer.appendChild(image);
        photoContainer.image = image;
        player.classList.add('photo-taken');
        photoContainer.appendChild(cropContainer);
        document.body.appendChild(photoContainer);
        playerPhotos.set(player, photoContainer);
        listenForLeavingPlayer(function callback(leavingPlayer) {
          if (leavingPlayer === player) {
            photoContainer.remove();
            playerPhotos.delete(player);
            stopListeningForLeavingPlayer(callback);
          }
        });
        playerGrid.updateLayout();
        player.classList.add('camera-shutter');
        setTimeout(() => player.classList.remove('camera-shutter'), 200);
        setTimeout(() => {
          player.remove();
          player.classList.remove('moving-to-grid');
          player.classList.remove('taking-photo');
          player.classList.remove('photo-taken');
          player.style.width  = '';
          player.style.height = '';
          player.querySelector('.phone').remove();
        }, 1000);
        checkIfAllPhotosTaken();
      }
    });
    listenForLeavingPlayer(checkIfAllPhotosTaken);
  });
  photoTakingScreen.querySelector('h1').textContent = 'All photos taken';
  allPhotosTakenSound.play().catch(() => {});
  document.body.classList.add('all-the-things_all-photos-taken');
  await waitForNSeconds(0.5);
  document.body.classList.remove('all-the-things_all-photos-taken');

  await waitForNSeconds(2);

  // Highlight all photos
  const highlightDurationSecs = 0.4;
  for (const [index, player] of players.entries()) {
    const photo = playerPhotos.get(player);
    photo.style.animationDelay = (highlightDurationSecs * (index / (players.length-1))) + 's';
    photo.classList.add('all-photos-taken-highlight');
  }
  await waitForNSeconds(1);
  for (const photo of playerPhotos.values()) {
    photo.style.animationDelay = '';
    photo.classList.remove('all-photos-taken-highlight');
  }

  // Clean up
  for (const channel of photoChannels) {
    channel.close();
  }
  photoTakingScreen.remove();
  for (const player of players) {
    player.classList.remove('video-not-visible');
  }
  for (const timerId of timers) {
    clearTimeout(timerId);
  }

  return [playerPhotos, playerGrid];
}
