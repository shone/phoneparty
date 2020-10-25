import {waitForNSeconds, clamp, lerp, easeInOutQuad} from '/common/utils.mjs';

import {players, stopListeningForAllPlayers} from '/host/players.mjs';

import routes from '/host/routes.mjs';
import Audience from '/host/audience.mjs';

import {photos} from './shoot.mjs';

routes['#apps/tunnel-vision/present'] = async function present(routeContext) {
  const {params, listenForPlayers, listenForLeavingPlayers, waitForEnd} = routeContext;

  const thingName = params.get('thing');

  const container = document.createElement('div');
  container.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/apps/tunnel-vision/host/present.css">

    <div id="target">
      <img>
      <label></label>
    </div>

    <div id="centered-content">
      <div id="grid"></div>
      <div id="message"></div>
      <push-button id="end-round-button">End Round</push-button>
    </div>
  `;
  const message = container.shadowRoot.getElementById('message');
  message.ontransitionend = () => {
    if (message.classList.contains('clear')) {
      message.classList.remove('clear');
      message.innerHTML = '';
    }
  }
  const centeredContent = container.shadowRoot.getElementById('centered-content');
  document.body.append(container);
  waitForEnd().then(() => container.remove());

//   await new Promise(resolve => {
//     function onPlayer(player) {
//       const photo = new Image();
//       photo.src = '/apps/tunnel-vision/loafers.jpg';
//       photo.player = player;
//       photo.onload = () => photos.set(player, photo);
//     }
//     listenForPlayers(onPlayer);
//     setTimeout(() => {
//       stopListeningForAllPlayers(onPlayer);
//       resolve();
//     }, 1000);
//   });

  if (photos.size === 0) {
    message.innerHTML = `
      <h1>No photos to present</h1>
      <push-button>Take Photos</push-button>
    `;
    const waitForButton = new Promise(resolve => message.querySelector('push-button').onclick = () => resolve('take-photos'));
    switch (await Promise.race([waitForButton, waitForEnd()])) {
      case 'take-photos': return '#apps/tunnel-vision/shoot';
      case 'route-ended': return;
    }
  }

  const audience = new Audience(routeContext);
  container.shadowRoot.append(audience);

  const target = container.shadowRoot.getElementById('target');
  target.querySelector('img').src = `/apps/tunnel-vision/things/${thingName}.svg`;
  target.querySelector('label').textContent = thingName;

  await waitForNSeconds(1);
  message.innerHTML = '<h1>Present your photos!</h1>';
  await waitForNSeconds(2);
  message.classList.add('clear');
  await waitForNSeconds(1);

  target.classList.add('transition', 'reveal');
  await waitForNSeconds(1);

  const grid = container.shadowRoot.getElementById('grid');

  const gridCells = new Map();
  for (const [player, photo] of photos.entries()) {
    const canvas = document.createElement('canvas');
    canvas.classList.add('photo');
    canvas.player = player;
    drawCroppedPhoto(canvas, photo, 1);

    const cell = document.createElement('div');
    cell.classList.add('cell');
    cell.player = player;
    cell.append(canvas);
    grid.append(cell);
    gridCells.set(player, cell);
  }

  function updateGridDimensions() {
    const gridAspect = grid.clientWidth / grid.clientHeight;
    let columns = 1, rows = 1;
    while (columns * rows < photos.size) {
      (columns / rows) < gridAspect ? columns++ : rows++;
    }
    grid.style.gridTemplateColumns = `repeat(${columns}, 1fr`;
    grid.style.gridTemplateRows    = `repeat(${rows}, 1fr`;
  }
  updateGridDimensions();
  window.addEventListener('resize', updateGridDimensions);
  waitForEnd().then(() => window.removeEventListener('resize', updateGridDimensions));

  grid.classList.add('reveal');

  grid.onclick = async event => {
    if (presentingCanvas) return;

    event.stopPropagation();

    const cell = event.target.closest('.cell');
    if (!cell) return;

    const canvas = cell.querySelector('canvas');
    presentCanvas(canvas);
  }
  centeredContent.onclick = ({target}) => {
    if (target === presentingCanvas) {
      if (!presentingCanvas.uncroppedRevealed) {
        revealPhotoUncropped(presentingCanvas);
      } else {
        unpresentCanvas();
      }
    }
  }

  let presentingCanvas = null;
  function presentCanvas(canvas) {
    presentingCanvas = canvas;

    const photo = photos.get(canvas.player);
    const cell = gridCells.get(canvas.player);

    const lastPresented = grid.querySelector('.last-presented');
    if (lastPresented) {
      lastPresented.classList.remove('last-presented');
    }
    cell.classList.add('last-presented');

    const destination = grid.getBoundingClientRect();
    const origin      = cell.getBoundingClientRect();
    canvas.style.left   = `${(origin.left   / destination.width)  * 100}%`;
    canvas.style.top    = `${(origin.top    / destination.height) * 100}%`;
    canvas.style.width  = `${(origin.width  / destination.width)  * 100}%`;
    canvas.style.height = `${(origin.height / destination.height) * 100}%`;
    centeredContent.append(canvas);
    setTimeout(() => canvas.classList.add('present'), 200);

    grid.classList.remove('reveal');
  }

  function unpresentCanvas() {
    if (presentingCanvas) {
      const canvas = presentingCanvas;

      const cell = gridCells.get(canvas.player);

      const destination = cell.getBoundingClientRect();
      const origin      = grid.getBoundingClientRect();
      cell.append(canvas);
      canvas.style.left   = `${origin.left - destination.left}px`;
      canvas.style.top    = `${origin.top  - destination.top}px`;
      canvas.style.width  = `${origin.width}px`;
      canvas.style.height = `${origin.height}px`;
      canvas.classList.remove('present');
      setTimeout(() => {
        canvas.style.left   = null;
        canvas.style.top    = null;
        canvas.style.width  = null;
        canvas.style.height = null;
      }, 200);

      presentingCanvas = null;
      grid.classList.add('reveal');
    }
  }

  function revealPhotoUncropped(canvas) {
    canvas.uncroppedRevealed = true;

    const photo = photos.get(canvas.player);

    const duration = 2000;
    const startTimestamp = performance.now();
    requestAnimationFrame(function callback(timestamp) {
      const t = clamp((timestamp - startTimestamp) / duration, 0, 1);
      drawCroppedPhoto(canvas, photo, easeInOutQuad(1 - t));
      if (timestamp - startTimestamp < duration) {
        requestAnimationFrame(callback);
      }
    });
  }

  await waitForNSeconds(1);
  const endRoundButton = container.shadowRoot.getElementById('end-round-button');
  endRoundButton.classList.add('reveal');
  const waitForEndRoundButton = await new Promise(resolve => endRoundButton.onclick = resolve);

  await Promise.race([waitForEndRoundButton, waitForEnd()]);

  return '#apps/tunnel-vision/end';
}

function drawCroppedPhoto(canvas, photo, ratio) {
  const fullyCroppedSize = Math.min(photo.width, photo.height) / 3;
  const cropWidth  = lerp(photo.width,  fullyCroppedSize, ratio);
  const cropHeight = lerp(photo.height, fullyCroppedSize, ratio);
  canvas.width  = cropWidth;
  canvas.height = cropHeight;
  const context = canvas.getContext('2d');

  context.drawImage(
    photo,
    (photo.width / 2) - (cropWidth / 2), (photo.height / 2) - (cropHeight / 2), // Source position
    cropWidth, cropHeight, // Source dimensions
    0, 0, // Destination position
    cropWidth, cropHeight // Destination dimensions
  );

  // Crop
  const uncroppedDiameter = Math.sqrt((photo.width * photo.width) + (photo.height * photo.height));
  const cropDiameter = lerp(uncroppedDiameter, fullyCroppedSize, ratio);
  context.globalCompositeOperation = 'destination-atop';
  context.beginPath();
  context.arc(
    cropWidth / 2, cropHeight / 2, // Position
    cropDiameter / 2, // Radius
    0, Math.PI * 2 // Angles
  );
  context.fill();
}

const fooledSound    = new Audio('/apps/tunnel-vision/sounds/fooled.mp3');
const notFooledSound = new Audio('/apps/tunnel-vision/sounds/not-fooled.mp3');

routes['#apps/tunnel-vision/photo-judgement'] = async function presentPhoto({route, params, createChannel}) {

  const index = parseInt(params.get('index'));
  const thing = params.get('thing');

  if (index >= playerPhotos.length) {
    // TODO: show message about invalid index?
    return '#apps/tunnel-vision/another-round';
  }

  const playerPresentingPhoto = playerPhotos[index].player;
  const photo = playerPhotos[index].photoContainer;
  if (!playerPresentingPhoto) {
    // Player has left, continue to next player
    return finish();
  }

  audienceMode.start();

  function finish() {
    if ((index < playerPhotos.length - 1) && (location.hash.split('?')[0] === route.split('?')[0])) {
      return `#apps/tunnel-vision/photo-judgement?thing=${thing}&index=${index+1}`;
    } else {
      playerGrid.stop();
      document.querySelectorAll('.photo-container').forEach(photo => photo.remove());
      while (playerPhotos.length) playerPhotos.pop();
      const thingIndicator = document.querySelector('.tunnel-vision.thing.show-in-top-right');
      if (thingIndicator) {
        thingIndicator.remove();
      }
      return '#apps/tunnel-vision/another-round';
    }
  }

  playerPresentingPhoto.classList.remove('wiggleable');
  playerPresentingPhoto.style.transform = '';
  playerPresentingPhoto.classList.add('highlight-in-audience');

  // Show photo full-screen
  photo.classList.add('fullscreen');
  document.querySelectorAll('.photo-container:not(.fullscreen').forEach(otherPhoto => otherPhoto.classList.add('de-emphasize'));
  let result = await Promise.race([waitForNSeconds(2), waitForPlayerToLeave(playerPresentingPhoto)]);
  if (result === 'player_left') {
    return finish();
  }

  result = await judgePhoto(playerPresentingPhoto, photo, createChannel);

  if (result === 'player_left') {
    players.forEach(player => clearSpeechBubblesFromPlayer(player));
    return finish();
  }

  const [selfJudgementResult, otherPlayerResponses] = result;

  const otherPlayersWithResponses = players.filter(player => otherPlayerResponses.has(player));

  // Highlight responses
  for (const otherPlayer of otherPlayersWithResponses) {
    const speechBubble = otherPlayer.querySelector('.speech-bubble:not(.cleared)');
    if (speechBubble) {
      speechBubble.classList.add('highlight');
      setTimeout(() => speechBubble.classList.remove('highlight'), 1000);
    }
  }
  await waitForNSeconds(1);

  photo.classList.add('reveal-full-photo');
  await Promise.race([waitForNSeconds(5), waitForKeypress(' ')]);

  // Reveal fooled/not-fooled state for each player
  for (const player of otherPlayersWithResponses) {
    if (players.indexOf(player) === -1) {
      continue;
    }
    const speechBubble = player.querySelector('.speech-bubble:not(.cleared)');
    if (speechBubble) {
      speechBubble.classList.add('cleared');
      await waitForNSeconds(0.5);
      speechBubble.remove();
    }

    for (const otherPhoto of [...document.getElementsByClassName('photo-container')]) {
      otherPhoto.classList.add('de-emphasize');
    }

    player.classList.add('fullscreen-in-audience', 'transitioning-to-fullscreen-in-audience');
    await waitForNSeconds(1);

    if (otherPlayerResponses.get(player) === selfJudgementResult) {
      setPlayerNotFooled(player);
    } else {
      setPlayerFooled(player);
    }
    await waitForNSeconds(2.5);

    player.classList.remove('fullscreen-in-audience');
    setTimeout(() => player.classList.remove('transitioning-to-fullscreen-in-audience'), 500);
    await waitForNSeconds(0.5);

    for (const otherPhoto of [...document.getElementsByClassName('photo-container')]) {
      otherPhoto.classList.toggle('de-emphasize', otherPhoto.player !== playerPresentingPhoto);
    }
  }

  await waitForNSeconds(2);

  for (const otherPlayer of players) {
    clearPlayerFooledState(otherPlayer);
  }

  playerPresentingPhoto.classList.remove('highlight-in-audience');
  playerPresentingPhoto.classList.add('wiggleable');
  photo.classList.remove('reveal-full-photo');
  await waitForNSeconds(2);
  photo.classList.remove('fullscreen');
  for (const otherPhoto of [...document.getElementsByClassName('photo-container')]) {
    otherPhoto.classList.remove('de-emphasize');
  }
  await waitForNSeconds(2);

  return finish();
}

async function judgePhoto(playerPresentingPhoto, photo, createChannel) {
  const croppedPhotoArrayBuffer = await makeCroppedImageArrayBuffer(photo.querySelector('img'));

  const selfJudgementChannel = createChannel(playerPresentingPhoto, 'self-judgement');
  const otherPlayerChannels = [];

  const getAllPlayerResponses = new Promise(resolve => {
    let selfJudgementResult = null;
    const otherPlayerResponses = new Map();
    function checkAllPlayersResponded() {
      const otherPlayers = players.filter(player => player !== playerPresentingPhoto);
      if (selfJudgementResult !== null && otherPlayers.length >= 1 && otherPlayers.every(player => otherPlayerResponses.has(player))) {
        resolve([selfJudgementResult, otherPlayerResponses]);
        stopListeningForAllPlayers(handlePlayer);
        stopListeningForLeavingPlayers(checkAllPlayersResponded);
      } else if (players.indexOf(playerPresentingPhoto) === -1) {
        stopListeningForAllPlayers(handlePlayer);
        stopListeningForLeavingPlayers(checkAllPlayersResponded);
      }
    }
    selfJudgementChannel.onmessage = event => {
      selfJudgementResult = event.data;
      checkAllPlayersResponded();
    }
    function handlePlayer(player) {
      if (player === playerPresentingPhoto) {
        return;
      }
      const channel = createChannel(player, 'judgement');
      channel.onopen = () => channel.send(croppedPhotoArrayBuffer);
      channel.onmessage = event => {
        otherPlayerResponses.set(player, event.data);
        checkAllPlayersResponded();
        clearSpeechBubblesFromPlayer(player);
        addSpeechBubbleToPlayer(player, event.data);
      }
      otherPlayerChannels.push(channel);
    }
    listenForAllPlayers(handlePlayer);
    listenForLeavingPlayers(checkAllPlayersResponded);
  });

  const result = await Promise.race([
    getAllPlayerResponses,
    waitForPlayerToLeave(playerPresentingPhoto)
  ]);
  selfJudgementChannel.close();
  for (const channel of otherPlayerChannels) {
    channel.close();
  }

  return result;
}

function setPlayerFooled(player) {
  fooledSound.play().catch(() => {});

  player.insertAdjacentHTML('beforeend', `
    <div class="tunnel-vision fooled-overlay"></div>
    <div class="tunnel-vision fooled-stamp">FOOLED</div>
  `);
}

function setPlayerNotFooled(player) {
  notFooledSound.play().catch(() => {});

  player.insertAdjacentHTML('beforeend', '<div class="tunnel-vision not-fooled-stamp">not fooled</div>');

  const lightbulbsCount = 6;
  for (let i=0; i < lightbulbsCount; i++) {
    const lightbulb = document.createElement('div');
    lightbulb.classList.add('tunnel-vision', 'lightbulb');
    const x     = ((Math.random() - 0.5) * 2) * 250;
    const y     = ((Math.random() - 0.5) * 2) * 250;
    const angle = ((Math.random() - 0.5) * 2) * 40;
    lightbulb.style.transform = `translate(${x}%, ${y}%) rotate(${angle}deg)`;
    lightbulb.style.animationDelay = `${0.7 * (i / lightbulbsCount)}s`;
    player.appendChild(lightbulb);
  }
}

function clearPlayerFooledState(player) {
  const elements = player.querySelectorAll('.fooled-stamp, .fooled-overlay, .not-fooled-stamp, .lightbulb');
  elements.forEach(element => element.remove());
}

async function makeCroppedImageArrayBuffer(image) {
  const croppedSize = Math.min(image.naturalWidth, image.naturalHeight) / 3;

  const canvas = document.createElement('canvas');
  canvas.width  = croppedSize;
  canvas.height = croppedSize;

  const context = canvas.getContext('2d');
  context.drawImage(
    image,
    (image.naturalWidth  / 2) - (croppedSize / 2), // Source X
    (image.naturalHeight / 2) - (croppedSize / 2), // Source Y
    croppedSize, croppedSize, // Source dimensions
    0, 0, // Destination position
    croppedSize, croppedSize // Destination dimensions
  );

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
  const arrayBuffer = await new Response(blob).arrayBuffer();
  return arrayBuffer;
}
