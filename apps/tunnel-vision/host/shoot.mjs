import {waitForNSeconds} from '/common/utils.mjs';

import {
  players,
  stopAcceptingPlayers,
  listenForLeavingPlayers,
  stopListeningForLeavingPlayers
} from '/host/players.mjs';

import routes from '/host/routes.mjs';

import {
  playerPhotos,
  getNextPhotoId,
} from './tunnel-vision.mjs';

routes['#apps/tunnel-vision/shoot'] = async function shoot(routeContext) {

  const {params, waitForEnd, acceptAllPlayers, listenForPlayers, createChannel, listenForLeavingPlayers} = routeContext;

  const thingName = params.get('thing');

  const container = document.createElement('div');
  container.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/apps/tunnel-vision/host/shoot.css">

    <h1>Take your photos!</h1>

    <div id="target">
      <img>
      <label></label>
    </div>

    <div id="grid"></div>
  `;
  document.body.append(container);

  const title = container.shadowRoot.querySelector('h1');

  const target = container.shadowRoot.getElementById('target');
  target.querySelector('img').src = `/apps/tunnel-vision/things/${thingName}.svg`;
  target.querySelector('label').textContent = thingName;

  const shutterSound        = new Audio('/apps/tunnel-vision/sounds/camera-shutter.wav');
  const allPhotosTakenSound = new Audio('/apps/tunnel-vision/sounds/all-photos-taken.mp3');

//   await waitForNSeconds(1);
//   title.classList.add('transition', 'reveal');
//   await waitForNSeconds(2);
//   title.classList.remove('reveal');

  setTimeout(() => target.classList.add('transition', 'reveal'), 1000);

  const grid = container.shadowRoot.getElementById('grid');
  grid.classList.add('reveal');
  const cellMap = new Map();

  function updateGridDimensions() {
    const gridAspect = grid.clientWidth / grid.clientHeight;
    let columns = 1, rows = 1;
    while (columns * rows < players.length) {
      (columns / rows) < gridAspect ? columns++ : rows++;
    }
    grid.style.gridTemplateColumns = `repeat(${columns}, 1fr`;
    grid.style.gridTemplateRows    = `repeat(${rows}, 1fr`;
  }
  window.addEventListener('resize', updateGridDimensions);
  waitForEnd().then(() => window.removeEventListener('resize', updateGridDimensions));

  acceptAllPlayers(player => {
    updateGridDimensions();

    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    if (player.stream) {
      video.srcObject = player.stream;
    } else {
      player.rtcConnection.addEventListener('track', ({streams}) => {
        video.srcObject = streams[0];
      });
    }

    const cell = document.createElement('div');
    cell.append(video);
    grid.append(cell);
    cellMap.set(player, cell);
  });

  listenForLeavingPlayers(player => {
    cellMap.get(player).remove();
    updateGridDimensions();
  });

  // Clear any photos from previous rounds of the game
  while (playerPhotos.length > 0) {
    playerPhotos.pop();
  }

  // Wait for every player to take a photo
  await new Promise(resolve => {
    function checkIfAllPhotosTaken() {
      if (players.length >= 2 && players.every(player => playerPhotos.find(photo => photo.player === player))) {
        stopAcceptingPlayers();
        stopListeningForLeavingPlayers(checkIfAllPhotosTaken);
        resolve();
      }
    }
    listenForPlayers(player => {
      createChannel(player, 'photo').onmessage = async ({data}) => {
        const canvas = makeCroppedCanvasForPhotoArraybuffer(data);
        const cell = cellMap.get(player);
        cell.append(canvas);
        cell.querySelector('video').remove();
        cell.classList.add('photo-taken');
        checkIfAllPhotosTaken();
        shutterSound.play().catch(() => {});
      }
    });
    listenForLeavingPlayers(checkIfAllPhotosTaken);
  });

  title.textContent = 'All photos taken';
  title.classList.add('reveal');
  allPhotosTakenSound.play().catch(() => {});
  await waitForNSeconds(2);
  title.classList.remove('reveal');

  await waitForEnd();

  await waitForNSeconds(2);

  // Highlight all photos
//   const highlightDurationSecs = 0.4;
//   players.forEach((player, index) => {
//     const photo = playerPhotos.find(photo => photo.player === player);
//     photo.photoContainer.style.animationDelay = `${highlightDurationSecs * (index / (players.length-1))}s`;
//     photo.photoContainer.classList.add('all-photos-taken-highlight');
//   });
//   await waitForNSeconds(1);
//   for (const photo of playerPhotos) {
//     photo.photoContainer.style.animationDelay = '';
//     photo.photoContainer.classList.remove('all-photos-taken-highlight');
//   }

  // Clean up
  container.remove();

  return `#apps/tunnel-vision/present?thing=${thingName}`;
}

function makeCroppedCanvasForPhotoArraybuffer(arrayBuffer) {
  const photoBlob = new Blob([arrayBuffer], {type: 'image/jpeg'});
  const img = new Image();
  img.src = URL.createObjectURL(photoBlob);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  img.onload = () => {
    const cropSize = Math.min(img.width, img.height) / 3;
    canvas.width  = cropSize;
    canvas.height = cropSize;
    context.drawImage(
      img,
      (img.width / 2) - (cropSize / 2), (img.height / 2) - (cropSize / 2), // Source position
      cropSize, cropSize, // Source dimensions
      0, 0, // Destination position
      cropSize, cropSize // Destination dimensions
    );
    context.globalCompositeOperation = 'destination-atop';
    context.beginPath();
    context.arc(
      cropSize / 2, cropSize / 2, // Position
      cropSize / 2, // Radius
      0, Math.PI * 2 // Angles
    );
    context.fill();
  }
  return canvas;
}

// function acceptPhotoFromPlayer(player, photoArrayBuffer) {
//   const photoBlob = new Blob([photoArrayBuffer], {type: 'image/jpeg'});
// 
//   const img = new Image();
//   img.src = URL.createObjectURL(photoBlob);
// 
//   document.body.insertAdjacentHTML('beforeend', `
//     <div class="tunnel-vision photo-container">
//       <div class="crop-container">
//         <img src="${photoUrl}">
//       </div>
//     </div>
//   `);
//   const photoContainer = document.body.lastElementChild;
//   photoContainer.player = player;
//   photoContainer.arrayBuffer = photoArrayBuffer;
// 
//   playerPhotos.push({player, photoContainer, id: getNextPhotoId()});
// 
//   player.classList.add('photo-taken', 'camera-shutter');
//   setTimeout(() => player.classList.remove('camera-shutter'), 200);
// 
//   playerGrid.updateLayout();
// 
//   setTimeout(() => {
//     player.remove();
//     player.classList.remove('moving-to-grid', 'taking-photo', 'photo-taken');
//     player.style.width  = '';
//     player.style.height = '';
//     player.querySelector('.phone').remove();
//   }, 1000);
// 
//   listenForLeavingPlayers(function callback(leavingPlayer) {
//     if (leavingPlayer === player) {
//       photoContainer.remove();
//       const playerPhoto = playerPhotos.find(photo => photo.player === player);
//       if (playerPhoto) {
//         playerPhoto.player = null;
//         playerPhoto.photoContainer = null;
//         playerPhoto.id = null;
//       }
//       stopListeningForLeavingPlayers(callback);
//     }
//   });
// }
