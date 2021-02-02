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

  function presentPhoto(photoId) {
    if (presentingPhotoId === photoId) {
      return;
    }
    presentingPhotoId = photoId;

    const gridCell = gridCells.get(photoId);
    const canvas = gridCell.canvas;

    // If the web animations API is available, animate the transition
    if (canvas.animate) {
      animateElementToFillNewParent(canvas, grid);
    }

    // Make the photo fill the screen
    gridCell.classList.add('present');

    // Fade out the other photos
    grid.classList.add('fade-out');
  }

  async function revealPhotoUncropped(photoId) {
    const gridCell = gridCells.get(photoId);
    const canvas = gridCell.canvas;
    const photo = photos.get(photoId);

    await animate(t => {
      drawPhotoOntoCanvas(photo.image, canvas, {cropAmount: easeInOutQuad(1 - t)});
    }, 2000);
  }

  function stopPresentingPhoto() {
    if (!presentingPhotoId) {
      return;
    }

    const gridCell = gridCells.get(presentingPhotoId);
    const canvas = gridCell.canvas;

    // If the web animations API is available, animate the transition
    if (canvas.animate) {
      animateElementToFillNewParent(canvas, gridCell);
    }

    // Restore the photo to its grid cell
    gridCell.classList.remove('present');

    // Fade-in the other photos
    grid.classList.remove('fade-out');

    presentingPhotoId = null;
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
        try {
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
        } catch (e) {
          alert(e);
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

      let revealJudgementPanelTimer = null;

      for await (const messageString of createChannelQueue(channel)) {

        const message = JSON.parse(messageString);

        switch (message.command) {
          case 'init':
            await waitForNSeconds(1);
            if (message.presentingPhotoId) {
              await waitForPhoto(message.presentingPhotoId);
              presentPhoto(message.presentingPhotoId);
              await waitForNSeconds(1);
              if (!message.revealedPhotoIds.includes(message.presentingPhotoId)) {
                document.getElementById('panel-B').append(panelB);
                await waitForNSeconds(.5);
                panelB.classList.add('reveal');
              }
            }
            await Promise.all(message.revealedPhotoIds.map(async photoId => {
              await waitForPhoto(photoId);
              await revealPhotoUncropped(photoId);
            }));
            break;
          case 'present':
            await waitForPhoto(message.photoId);
            presentPhoto(message.photoId);
            revealJudgementPanelTimer = setTimeout(() => {
              document.getElementById('panel-B').append(panelB);
              revealJudgementPanelTimer = setTimeout(() => {
                panelB.classList.add('reveal');
              }, 500);
            }, 1000);
            break;
          case 'reveal':
            if (panelB.classList.contains('reveal')) {
              panelB.remove();
              panelB.classList.remove('reveal');
              clearTimeout(revealJudgementPanelTimer);
              await waitForNSeconds(.5);
            }
            await waitForPhoto(message.photoId);
            await revealPhotoUncropped(message.photoId)
            break;
          case 'unpresent':
            stopPresentingPhoto();
            panelB.remove();
            panelB.classList.remove('reveal');
            clearTimeout(revealJudgementPanelTimer);
            break;
        }
      }
    }
  });
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
