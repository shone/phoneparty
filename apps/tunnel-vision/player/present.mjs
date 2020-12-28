import routes from '/player/routes.mjs';

import {waitForNSeconds, easeInOutQuad, createChannelQueue} from '/common/utils.mjs';

import {drawPhotoOntoCanvas} from '/apps/tunnel-vision/common.mjs';

routes['#apps/tunnel-vision/present'] = async function shoot({params, waitForEnd, listenForChannel, animate}) {

  const thing = params.get('thing');

  const panelA = document.createElement('div');
  panelA.classList.add('panel-a');
  panelA.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/apps/tunnel-vision/player/present.css">
    <div id="grid"></div>
  `;
  document.getElementById('panel-A').append(panelA);
  waitForEnd().then(() => panelA.remove());

  const panelB = document.createElement('div');
  panelB.classList.add('panel-b');
  panelB.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/apps/tunnel-vision/player/present.css">
    <div id="target">
      <p>Is this photo really of:</p>
      <span>
        <img>
        <label></label>
      </span>
    </div>
    <div id="judgement">
      <push-button data-action="mark-real">Real</push-button>
      <push-button data-action="mark-fake">Fake</push-button>
    </div>
  `;
  waitForEnd().then(() => panelB.remove());

  const target = panelB.shadowRoot.getElementById('target');
  target.querySelector('img').src = `/apps/tunnel-vision/things/${thing}.svg`;
  target.querySelector('label').textContent = `${thing}?`;

  const judgement = panelB.shadowRoot.getElementById('judgement');

  const photos = new Map();
  let currentPhotoId = null;
  let currentImg = null;

  const grid = panelA.shadowRoot.getElementById('grid');
  const gridCells = new Map();
  function updateGridDimensions() {
    const gridAspect = window.innerWidth / window.innerHeight;
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

  let presentingPhotoId = null;

  async function presentPhoto(photoId) {
    presentingPhotoId = photoId;

    const gridCell = gridCells.get(photoId);
    const canvas = gridCell.canvas;

    gridCells.forEach(cell => cell.style.zIndex = cell === gridCell ? '1' : '');

    const origin      = gridCell.getBoundingClientRect();
    const destination = panelA.getBoundingClientRect();
    canvas.style.left   = `${(origin.left   / destination.width)  * 100}%`;
    canvas.style.top    = `${(origin.top    / destination.height) * 100}%`;
    canvas.style.width  = `${(origin.width  / destination.width)  * 100}%`;
    canvas.style.height = `${(origin.height / destination.height) * 100}%`;
    panelA.shadowRoot.append(canvas);
    setTimeout(() => canvas.classList.add('present'), 200);
    await waitForNSeconds(.5);
  }

  async function revealPhotoUncropped(photoId) {
    const gridCell = gridCells.get(photoId);
    const canvas = gridCell.canvas;
    const photo = photos.get(photoId);

    await animate(t => {
      drawPhotoOntoCanvas(photo.image, canvas, {cropAmount: easeInOutQuad(1 - t)});
    }, 2000);
  }

  async function unpresent() {
    if (!presentingPhotoId) {
      return;
    }

    const gridCell = gridCells.get(presentingPhotoId);
    const canvas = gridCell.canvas;

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

    presentingPhotoId = null;

    await waitForNSeconds(.5);
  }

  const photoCallbacks = [];
  async function waitForPhoto(photoId) {
    if (photos.has(photoId)) {
      return;
    }
    return new Promise(resolve => photoCallbacks.push(newPhotoId => {
      if (newPhotoId === photoId) {
        resolve();
      }
    }));
  }

  listenForChannel((channel, channelName) => {
    if (channelName === 'photos') {
      channel.binaryType = 'arraybuffer';
      const textDecoder = new TextDecoder();
      const uuidv4length = 36;
      channel.send('ready');
      channel.onmessage = async ({data}) => {
        const photoId = textDecoder.decode(data.slice(0, uuidv4length));

        const photoArrayBuffer = data.slice(uuidv4length);
        const blob = new Blob([photoArrayBuffer], {type: 'image/jpeg'});

        const image = new Image();
        image.src = URL.createObjectURL(blob);
        await new Promise(resolve => image.onload = resolve);

        photos.set(photoId, {blob, image});

        console.log(`Received photo #${photos.size} id ${photoId}, size ${Math.round(photoArrayBuffer.byteLength / 1024)}KB`);

        const canvas = document.createElement('canvas');
        canvas.classList.add('photo');
        drawPhotoOntoCanvas(image, canvas, {cropAmount: 1});

        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.photoId = photoId;
        cell.canvas = canvas;
        cell.append(canvas);
        grid.append(cell);
        gridCells.set(photoId, cell);
        updateGridDimensions();

        for (const callback of photoCallbacks) {
          callback(photoId);
        }
      }
    }
  });

  listenForChannel(async (channel, channelName) => {
    if (channelName === 'control') {

      channel.send('ready');

      judgement.onclick = ({target}) => {
        if (presentingPhotoId && target.tagName === 'PUSH-BUTTON') {
          channel.send(JSON.stringify({photoId: presentingPhotoId, action: target.dataset.action}));
        }
      }

      for await (const messageString of createChannelQueue(channel)) {

        const message = JSON.parse(messageString);

        switch (message.command) {
          case 'init':
            await waitForNSeconds(1);
            if (message.presentingPhotoId) {
              await waitForPhoto(message.presentingPhotoId);
              await presentPhoto(message.presentingPhotoId);
              await waitForNSeconds(1);
              document.getElementById('panel-B').append(panelB);
              await waitForNSeconds(.5);
              judgement.classList.add('reveal');
            }
            await Promise.all(message.revealedPhotoIds.map(async photoId => {
              await waitForPhoto(photoId);
              await revealPhotoUncropped(photoId);
            }));
            break;
          case 'present':
            await waitForPhoto(message.photoId);
            await presentPhoto(message.photoId);
            await waitForNSeconds(1);
            document.getElementById('panel-B').append(panelB);
            await waitForNSeconds(.5);
            judgement.classList.add('reveal');
            break;
          case 'reveal':
            await waitForPhoto(message.photoId);
            await revealPhotoUncropped(message.photoId)
            break;
          case 'unpresent':
            await unpresent();
            break;
        }
      }
    }
  });
}
