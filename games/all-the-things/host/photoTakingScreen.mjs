import {waitForNSeconds} from '/shared/utils.mjs';

import {
  players,
  acceptAllPlayers,
  stopAcceptingPlayers,
  listenForLeavingPlayer,
  stopListeningForLeavingPlayer
} from '/host/players.mjs';

import * as playerGrid from './playerGrid.mjs';
import * as audienceMode from '/host/audienceMode.mjs';

import routes, {acceptAllPlayersOnCurrentRoute} from '/host/routes.mjs';

import {
  playerPhotos,
  getNextPhotoId,
  routesWithPlayerGrid,
  setupCurrentThingIndicator,
  currentThingIndicatorRouteEnd
} from './allTheThings.mjs';

routes['#games/all-the-things/photo-taking'] = async function photoTakingScreen() {
  document.body.style.backgroundColor = '#98947f';

  const chosenThingElement = setupCurrentThingIndicator();

  const shutterSound        = new Audio('/games/all-the-things/sounds/camera-shutter.ogg');
  const allPhotosTakenSound = new Audio('/games/all-the-things/sounds/all-photos-taken.mp3');

  audienceMode.stop();

  await waitForNSeconds(1);

  while (playerPhotos.length > 0) {
    playerPhotos.pop();
  }

  // Layout players as a grid of bubbles
  acceptAllPlayersOnCurrentRoute(player => {
    player.classList.add('bubble', 'moving-to-grid');
    if (!player.parentElement) {
      document.body.appendChild(player);
    }
  });
  playerGrid.start();
  await waitForNSeconds(2.5);
  stopAcceptingPlayers();

  // Hide players, as they will transition into phones next
  for (const player of players) {
    player.classList.add('scale-down');
  }
  await waitForNSeconds(0.5);
  for (const player of players) {
    player.classList.remove('scale-down', 'bubble');
  }

  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things photo-taking-screen">
      <h1>Take your photos!</h1>
    </div>
  `);
  const photoTakingScreen = document.body.lastElementChild;

  // Wait for every player to take a photo
  await new Promise(resolve => {
    const timers = [];
    function checkIfAllPhotosTaken() {
      if (players.length >= 2 && players.every(player => playerPhotos.find(photo => photo.player === player))) {
        stopAcceptingPlayers();
        stopListeningForLeavingPlayer(checkIfAllPhotosTaken);
        while (timers.length > 0) clearTimeout(timers.pop());
        resolve();
      }
    }
    acceptAllPlayersOnCurrentRoute(player => {
      player.classList.add('taking-photo', 'moving-to-grid');
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
      player.createChannelOnCurrentRoute().onmessage = async function(event) {
        shutterSound.play().catch(() => {});
        acceptPhotoFromPlayer(player, event.data);
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
    const photo = playerPhotos.find(photo => photo.player === player);
    photo.photoContainer.style.animationDelay = (highlightDurationSecs * (index / (players.length-1))) + 's';
    photo.photoContainer.classList.add('all-photos-taken-highlight');
  }
  await waitForNSeconds(1);
  for (const photo of playerPhotos) {
    photo.photoContainer.style.animationDelay = '';
    photo.photoContainer.classList.remove('all-photos-taken-highlight');
  }

  // Clean up
  photoTakingScreen.remove();
  for (const player of players) {
    player.classList.remove('video-not-visible');
  }

  if (!routesWithPlayerGrid.has(location.hash.split('?')[0])) {
    playerGrid.stop();
  }

  currentThingIndicatorRouteEnd();

  return `#games/all-the-things/present-photos?thing=${chosenThingElement.dataset.name}`;
}

function acceptPhotoFromPlayer(player, photoArrayBuffer) {
  const photoBlob = new Blob([photoArrayBuffer], {type: 'image/jpeg'});
  const photoUrl = URL.createObjectURL(photoBlob);

  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things photo-container">
      <div class="crop-container">
        <img src="${photoUrl}">
      </div>
    </div>
  `);
  const photoContainer = document.body.lastElementChild;
  photoContainer.player = player;
  photoContainer.arrayBuffer = photoArrayBuffer;

  playerPhotos.push({player, photoContainer, id: getNextPhotoId()});

  player.classList.add('photo-taken', 'camera-shutter');
  setTimeout(() => player.classList.remove('camera-shutter'), 200);

  playerGrid.updateLayout();

  setTimeout(() => {
    player.remove();
    player.classList.remove('moving-to-grid', 'taking-photo', 'photo-taken');
    player.style.width  = '';
    player.style.height = '';
    player.querySelector('.phone').remove();
  }, 1000);

  listenForLeavingPlayer(function callback(leavingPlayer) {
    if (leavingPlayer === player) {
      photoContainer.remove();
      const playerPhoto = playerPhotos.find(photo => photo.player === player);
      if (playerPhoto) {
        playerPhoto.player = null;
        playerPhoto.photoContainer = null;
        playerPhoto.id = null;
      }
      stopListeningForLeavingPlayer(callback);
    }
  });
}
