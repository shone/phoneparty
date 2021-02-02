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

    <div id="main-content">
      <div id="grid"></div>
      <div id="message"></div>
    </div>

    <div id="buttons">
      <push-button id="back-button">back</push-button>
      <push-button id="reveal-button">reveal</push-button>
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
        const arrayBuffer = await new Response(blob).arrayBuffer();
        const image = new Image();
        image.src = URL.createObjectURL(blob);
        photos.set(player, {
          id: uuidv4(),
          image,
          blob,
          arrayBuffer,
          isReal: false,
          judgements: new Map(),
          isRevealed: false,
        });
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
        message.set(new Uint8Array(photo.arrayBuffer), uuidv4length);
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
        const revealedPhotos = [...photos.values()].filter(photo => photo.isRevealed);
        controlChannel.send(JSON.stringify({
          command: 'init',
          presentingPhotoId: presentingPhoto ? presentingPhoto.id : null,
          revealedPhotoIds: revealedPhotos.map(photo => photo.id)
        }));
      } else {
        const message = JSON.parse(data);
        const playerBubble = audience.getPlayerBubble(player);
        const speechBubble = new SpeechBubble(message.action === 'mark-real' ? 'real' : 'fake');
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
      <canvas class="photo"></canvas>
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
    if (presentingPhoto) {
      stopPresentingPhoto();
    } else {
      const cell = event.target.closest('.cell');
      if (!cell) return;
      const photo = [...photos.values()].find(photo => photo.id === cell.dataset.photoId);
      presentPhoto(photo);
    }
  }

  const revealButton = container.shadowRoot.getElementById('reveal-button');
  revealButton.onclick = () => {
    if (presentingPhoto && !presentingPhoto.isRevealed) {
      revealPhoto(presentingPhoto);
    }
  }

  const backButton = container.shadowRoot.getElementById('back-button');
  backButton.onclick = () => {
    stopPresentingPhoto();
  }

  function presentPhoto(photo) {
    if (presentingPhoto === photo) {
      return;
    }
    presentingPhoto = photo;

    const gridCell = grid.querySelector(`[data-photo-id="${photo.id}"]`);
    const canvas = gridCell.querySelector('canvas');

    // If the web animations API is available, animate the transition
    if (canvas.animate) {
      animateElementToFillNewParent(canvas, grid);
    }

    // Make the photo fill the screen
    gridCell.classList.add('present');

    // Fade out the other photos
    grid.classList.add('fade-out');

    revealButton.classList.toggle('reveal', !photo.isRevealed);
    backButton.classList.add('reveal');
    endRoundButton.classList.remove('reveal');

    // Present the photo on all players screens too
    const command = JSON.stringify({command: 'present', photoId: photo.id});
    controlChannels.forEach(channel => channel.send(command));
  }

  function stopPresentingPhoto() {
    if (!presentingPhoto) {
      return;
    }

    const gridCell = grid.querySelector(`.cell[data-photo-id="${presentingPhoto.id}"]`);
    const canvas = photoCanvases.get(presentingPhoto);

    // If the web animations API is available, animate the transition
    if (canvas.animate) {
      animateElementToFillNewParent(canvas, gridCell);
    }

    // Restore the photo to its grid cell
    gridCell.classList.remove('present');

    // Fade-in the other photos
    grid.classList.remove('fade-out');

    revealButton.classList.remove('reveal');
    backButton.classList.remove('reveal');
    endRoundButton.classList.add('reveal');

    presentingPhoto = null;

    // Stop presenting the photo on all players screens too
    const command = JSON.stringify({command: 'unpresent'});
    controlChannels.forEach(channel => channel.send(command));
  }

  function revealPhoto(photo) {
    revealButton.classList.remove('reveal');

    const command = JSON.stringify({command: 'reveal', photoId: photo.id});
    controlChannels.forEach(channel => channel.send(command));

    const canvas = photoCanvases.get(photo);
    animate(t => {
      drawPhotoOntoCanvas(photo.image, canvas, {cropAmount: easeInOutQuad(1 - t)});
    }, 2000);

    photo.isRevealed = true;
  }

  await waitForNSeconds(1);

  const endRoundButton = container.shadowRoot.getElementById('end-round-button');
  endRoundButton.classList.add('reveal');
  const waitForEndRoundButton = new Promise(resolve => endRoundButton.onclick = resolve);
  await Promise.race([waitForEndRoundButton, waitForEnd()]);

  return '#apps/tunnel-vision/end';
}

function animateElementToFillNewParent(element, destinationParent) {
  // Uses the FLIP animation technique
  // See https://css-tricks.com/animating-layouts-with-the-flip-technique/

  const origin      = element.getBoundingClientRect();
  const destination = destinationParent.getBoundingClientRect();

  return element.animate([
    {
      left:   `${((origin.left - destination.left) / destination.width)  * 100}%`,
      top:    `${((origin.top  - destination.top)  / destination.height) * 100}%`,
      width:  `${(origin.width  / destination.width)  * 100}%`,
      height: `${(origin.height / destination.height) * 100}%`,
      zIndex: '1',
    },
    {
      left: '0',
      top:  '0',
      width:  '100%',
      height: '100%',
      zIndex: '1',
    }
  ], {duration: 500, easing: 'ease', fill: 'forwards'});
}
