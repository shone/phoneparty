import {waitForNSeconds, getMessageFromChannel} from '/common/utils.mjs';

import {
  players,
  stopAcceptingPlayers,
  listenForLeavingPlayers,
  stopListeningForLeavingPlayers
} from '/host/players.mjs';

import routes from '/host/routes.mjs';

export const photos = new Map();

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
  waitForEnd().then(() => container.remove());

  const title = container.shadowRoot.querySelector('h1');

  const target = container.shadowRoot.getElementById('target');
  target.querySelector('img').src = `/apps/tunnel-vision/things/${thingName}.svg`;
  target.querySelector('label').textContent = thingName;

  const shutterSound        = new Audio('/apps/tunnel-vision/sounds/camera-shutter.wav');
  const allPhotosTakenSound = new Audio('/apps/tunnel-vision/sounds/all-photos-taken.mp3');

  await waitForNSeconds(1);
  title.classList.add('transition', 'reveal');
  await waitForNSeconds(2);
  title.classList.remove('reveal');

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
  photos.clear();

  // Wait for every player to take a photo
  const waitResult = await new Promise(resolve => {
    function checkIfAllPhotosTaken() {
      if (players.length >= 2 && players.every(player => photos.has(player))) {
        stopAcceptingPlayers();
        stopListeningForLeavingPlayers(checkIfAllPhotosTaken);
        resolve('all-photos-taken');
        return true;
      } else {
        return false;
      }
    }
    waitForEnd().then(() => resolve('route-ended'));
    listenForPlayers(player => {
      const channel = createChannel(player);
      (async function() {
        while (true) {
          let [message, error] = await getMessageFromChannel(channel);
          if (error !== null) {
            return;
          }

          const cell = cellMap.get(player);

          const photoBlob = new Blob([message], {type: 'image/jpeg'});
          const photo = new Image();
          photo.src = URL.createObjectURL(photoBlob);

          [message, error] = await getMessageFromChannel(channel);
          if (error !== null) {
            return;
          }

          if (message === 'retake') {
            continue;
          }

          photo.judgement = message;

          if (!photo.complete) {
            await new Promise(resolve => photo.onload = resolve);
          }
          const canvas = makeCroppedCanvasForImage(photo);
          cell.append(canvas);

          shutterSound.play().catch(() => {});

          cell.classList.add('photo-taken');
          photos.set(player, photo);

          if (checkIfAllPhotosTaken()) {
            break;
          }

          while (true) {
            [message, error] = await getMessageFromChannel(channel);
            if (error !== null) {
              return;
            }

            if (message === 'retake') {
              cell.querySelector('canvas').remove();
              cell.classList.remove('photo-taken');
              photos.delete(player);
              break;
            } else {
              photo.judgement = message;
            }
          }
        }
      })();
    });
    listenForLeavingPlayers(checkIfAllPhotosTaken);
  });

  if (waitResult === 'route-ended') {
    return;
  }

  title.textContent = 'All photos taken';
  title.classList.add('reveal');
  allPhotosTakenSound.play().catch(() => {});
  await waitForNSeconds(2);
  title.classList.remove('reveal');

  await waitForNSeconds(2);

  return `#apps/tunnel-vision/present?thing=${thingName}`;
}

function makeCroppedCanvasForImage(image) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  // Draw image
  const cropSize = Math.min(image.width, image.height) / 3;
  canvas.width  = cropSize;
  canvas.height = cropSize;
  context.drawImage(
    image,
    (image.width / 2) - (cropSize / 2), (image.height / 2) - (cropSize / 2), // Source position
    cropSize, cropSize, // Source dimensions
    0, 0, // Destination position
    cropSize, cropSize // Destination dimensions
  );

  // Crop
  context.globalCompositeOperation = 'destination-atop';
  context.beginPath();
  context.arc(
    cropSize / 2, cropSize / 2, // Position
    cropSize / 2, // Radius
    0, Math.PI * 2 // Angles
  );
  context.fill();

  return canvas;
}
