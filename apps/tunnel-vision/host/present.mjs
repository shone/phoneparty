import {waitForNSeconds, clamp, easeInOutQuad, uuidv4, getMessageFromChannel} from '/common/utils.mjs';
import {drawPhotoOntoCanvas} from '/apps/tunnel-vision/common.mjs';

import {players, stopListeningForAllPlayers} from '/host/players.mjs';

import routes from '/host/routes.mjs';
import Audience from '/host/audience.mjs';
import SpeechBubble from '/host/speech-bubble.mjs';

import {photos} from './shoot.mjs';

routes['#apps/tunnel-vision/present'] = async function present(routeContext) {
  const {params, listenForPlayers, listenForLeavingPlayers, waitForEnd, createChannel, animate} = routeContext;

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

  const audience = new Audience(routeContext);
  container.shadowRoot.append(audience);

  document.body.append(container);
  waitForEnd().then(() => container.remove());

  if (!params.has('thing')) {
    message.innerHTML = `
      <h1>No goal given</h1>
      <p>Needs ?thing= url query parameter</p>
    `;
    return waitForEnd();
  }
  const thingName = params.get('thing');
  const target = container.shadowRoot.getElementById('target');
  target.querySelector('img').src = `/apps/tunnel-vision/things/${thingName}.svg`;
  target.querySelector('label').textContent = thingName;

  // Test photos
  if (thingName === 'test') {
    const testPhotos = ['sausages_on_the_beach_cropped.jpg', 'loafers.jpg', 'loafers.jpg'];
    message.innerHTML = `
      <h1>Waiting for ${testPhotos.length} players</h1>
      <p>(for test photos)</p>
    `;
    audience.setMinPlayerCount(testPhotos.length);
    let testPhotoIndex = 0;
    await new Promise(resolve => {
      async function onPlayer(player) {
        const response = await fetch(`/apps/tunnel-vision/test_photos/${testPhotos[testPhotoIndex++]}`);
        const blob = await response.blob();
        const image = new Image();
        image.src = URL.createObjectURL(blob);
        photos.set(player, {id: uuidv4(), image, blob, judgement: 'mark-fake'});
        if (photos.size >= 3) {
          stopListeningForAllPlayers(onPlayer);
          resolve();
        }
      }
      listenForPlayers(onPlayer);
    });
    message.innerHTML = '';
  }

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

  let presentingPhoto = null;

  // Send all photos to all players
  listenForPlayers(player => {
    const photosChannel = createChannel(player, 'photos');
    photosChannel.onopen = async () => {
      await getMessageFromChannel(photosChannel); // Wait for 'ready' message
      const uuidv4length = 36;
      const textEncoder = new TextEncoder();
      for (const photo of photos.values()) {
        const message = new Uint8Array(uuidv4length + photo.blob.size);
        textEncoder.encodeInto(photo.id, message);
        const arrayBuffer = await photo.blob.arrayBuffer();
        message.set(new Uint8Array(arrayBuffer), uuidv4length);
        photosChannel.send(message.buffer);
      }
    }
  });

  const controlChannels = new Set();
  listenForPlayers(player => {
    const controlChannel = createChannel(player, 'control');
    controlChannels.add(controlChannel);
    controlChannel.onmessage = ({data}) => {
      if (data === 'ready') {
        const revealedPhotos = [...photos.values()].filter(photo => photo.uncroppedRevealed);
        controlChannel.send(JSON.stringify({
          command: 'init',
          presentingPhotoId: presentingPhoto ? presentingPhoto.id : null,
          revealedPhotoIds: revealedPhotos.map(photo => photo.id)
        }));
      } else {
        const message = JSON.parse(data);
        const playerBubble = audience.getPlayerBubble(player);
        const speechBubble = new SpeechBubble(message.action);
        playerBubble.append(speechBubble);
        const photo = [...photos.values()].find(photo => photo.id === message.photoId);
        photo.judgements.set(player, message.action);
      }
    }
    controlChannel.onclose = () => controlChannels.delete(controlChannel);
  });

  await waitForNSeconds(1);
  message.innerHTML = '<h1>Present your photos!</h1>';
  await waitForNSeconds(2);
  message.classList.add('clear');
  await waitForNSeconds(1);

  target.classList.add('transition', 'reveal');
  await waitForNSeconds(1);

  const grid = container.shadowRoot.getElementById('grid');
  grid.innerHTML = [...photos.values()].map(photo => `
    <div class="cell" data-photo-id="${photo.id}">
      <canvas class="photo" data-photo-id="${photo.id}"></canvas>
    </div>
  `).join('');
  const photoCanvases = new Map();
  for (const cell of grid.children) {
    const photo = [...photos.values()].find(photo => photo.id === cell.dataset.photoId);
    const canvas = cell.querySelector('canvas');
    photoCanvases.set(photo, canvas);
    drawPhotoOntoCanvas(photo.image, canvas, {cropAmount: 1});
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
    event.stopPropagation();
    if (presentingPhoto) return;

    const cell = event.target.closest('.cell');
    if (!cell) return;
    const photo = [...photos.values()].find(photo => photo.id === cell.dataset.photoId);
    presentPhoto(photo);
  }
//   centeredContent.onclick = ({target}) => {
//     if (target === presentingCanvas) {
//       const photo = [...photos.values()].find(photo => photo.id === presentingCanvas.dataset.photoId);
//       if (!photo.uncroppedRevealed) {
//         revealPhotoUncropped(presentingCanvas);
//         photo.uncroppedRevealed = true;
//       } else {
//         unpresentCanvas();
//       }
//     }
//   }

  function presentPhoto(photo) {
    if (presentingPhoto === photo) {
      return;
    }
    presentingPhoto = photo;

    const command = JSON.stringify({command: 'present', photoId: photo.id});
    controlChannels.forEach(channel => channel.send(command));

    const lastPresented = grid.querySelector('.last-presented');
    if (lastPresented) {
      lastPresented.classList.remove('last-presented');
    }
    gridCell.classList.add('last-presented');

    const gridCell = grid.querySelector(`[data-photo-id="${photo.id}"]`);
    const canvas = gridCell.querySelector('canvas');

    const origin      = gridCell.getBoundingClientRect();
    const destination = grid.getBoundingClientRect();
    canvas.style.left   = `${(origin.left   / destination.width)  * 100}%`;
    canvas.style.top    = `${(origin.top    / destination.height) * 100}%`;
    canvas.style.width  = `${(origin.width  / destination.width)  * 100}%`;
    canvas.style.height = `${(origin.height / destination.height) * 100}%`;
    centeredContent.append(canvas);
    setTimeout(() => canvas.classList.add('present'), 200);

    grid.classList.remove('reveal');
  }

  function stopPresentingPhoto() {
    if (!presentingPhoto) {
      return;
    }

    const command = JSON.stringify({command: 'unpresent'});
    controlChannels.forEach(channel => channel.send(command));

    const gridCell = grid.querySelector(`.cell[data-photo-id="${presentingPhoto.id}"]`);
    const canvas = photoCanvases.get(presentingPhoto);

    const origin      = grid.getBoundingClientRect();
    const destination = gridCell.getBoundingClientRect();
    gridCell.append(canvas);
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

    presentingPhoto = null;
    grid.classList.add('reveal');
  }

  function revealPhotoUncropped(canvas) {
    const photo = photos.get(canvas.player);

    const command = JSON.stringify({command: 'reveal', photoId: photo.id});
    controlChannels.forEach(channel => channel.send(command));

    animate(t => {
      drawPhotoOntoCanvas(photo.image, canvas, {cropAmount: easeInOutQuad(1 - t)});
    }, 2000);
  }

  await waitForNSeconds(1);

  const endRoundButton = container.shadowRoot.getElementById('end-round-button');
  endRoundButton.classList.add('reveal');
  const waitForEndRoundButton = new Promise(resolve => endRoundButton.onclick = resolve);
  await Promise.race([waitForEndRoundButton, waitForEnd()]);

  return '#apps/tunnel-vision/end';
}
