import {stream, rtcConnection} from '/player/main.mjs';
import {clamp, lerp, randomInArray, easeInOutQuad, waitForNSeconds} from '/common/utils.mjs';

import '/common/push-button.mjs';

import routes from '/player/routes.mjs';

export let canvas = null;

routes['#apps/tunnel-vision/shoot'] = async function shoot({params, waitForEnd, listenForChannel}) {
  const thing = params.get('thing');

  const container = document.createElement('div');
  container.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/apps/tunnel-vision/player/shoot.css">

    <div id="goal">
      <img>
      <div class="label"></div>
    </div>

    <video playsinline autoplay muted></video>

    <canvas></canvas>

    <push-button class="hide" id="take-photo-button"></push-button>
    <push-button class="hide" id="switch-cameras-button"></push-button>

    <div id="judgement">
      <p>Is your photo really of <span class="target"></span>?</p>
      <div class="options">
        <push-button class="yes-button">Yes</push-button>
        <push-button class="no-button">No</push-button>
      </div>
    </div>
  `;
  document.body.append(container);
  waitForEnd().then(() => container.remove());

  const goal = container.shadowRoot.getElementById('goal');
  goal.querySelector('.label').textContent = thing;
  goal.querySelector('img').src = `/apps/tunnel-vision/things/${thing}.svg`;
  setTimeout(() => goal.classList.add('transition', 'reveal'), 100);

  const video = container.shadowRoot.querySelector('video');
  canvas = container.shadowRoot.querySelector('canvas');
  const canvasCtx = canvas.getContext('2d');

  const takePhotoButton     = container.shadowRoot.getElementById('take-photo-button');
  const switchCamerasButton = container.shadowRoot.getElementById('switch-cameras-button');

  const judgement = container.shadowRoot.getElementById('judgement');
  judgement.querySelector('.target').textContent = thing;

  // Setup video streams
  async function switchCamera(options) {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: options, audio: false});
      video.srcObject = newStream;
      const flip = (options === true) || (options.facingMode && options.facingMode.exact === 'user');
      video.classList.toggle('flip', flip);
      rtcConnection.getSenders()[0].replaceTrack(newStream.getVideoTracks()[0]);
      return true;
    } catch(error) {
      return false;
    }
  }
  if (await switchCamera({facingMode: { exact: 'environment'}})) {
    let faceForward = true;
    switchCamerasButton.onclick = () => {
      faceForward = !faceForward;
      switchCamera({facingMode: { exact: faceForward ? 'environment' : 'user'}});
    }
    switchCamerasButton.classList.remove('hide');
    waitForEnd().then(() => switchCamera(true));
  } else {
    video.srcObject = stream;
    video.classList.add('flip');
  }

  const shutterSound = new Audio('/apps/tunnel-vision/sounds/camera-shutter.wav');

  function updateCropGuide() {
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const cropSize = Math.min(video.videoWidth, video.videoHeight) / 3;

    canvasCtx.globalCompositeOperation = 'source-over';
    canvasCtx.fillStyle = 'rgb(255, 255, 255, .6)';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    canvasCtx.globalCompositeOperation = 'destination-out';
    canvasCtx.beginPath();
    canvasCtx.arc(
      video.videoWidth  / 2, // X
      video.videoHeight / 2, // Y
      cropSize / 2, // Radius
      0, Math.PI * 2 // Angles
    );
    canvasCtx.fill();
  }

  video.onloadedmetadata = updateCropGuide;
  window.addEventListener('resize', updateCropGuide);
  waitForEnd().then(() => window.removeEventListener('resize', updateCropGuide));

  video.onloadeddata = () => {
    takePhotoButton.classList.remove('hide');
    takePhotoButton.onclick = function() {

      video.onloadedmetadata = null;
      window.removeEventListener('resize', updateCropGuide)

      const photo = document.createElement('canvas');
      photo.width  = video.videoWidth;
      photo.height = video.videoHeight;
      const photoCtx = photo.getContext('2d');
      if (video.classList.contains('flip')) {
        photoCtx.translate(video.videoWidth, 0);
        photoCtx.scale(-1, 1);
      }
      photoCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

      // Draw photo onto canvas
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
//       const context = canvas.getContext('2d');
//       if (video.classList.contains('flip')) {
//         canvasCtx.translate(canvas.width, 0);
//         canvasCtx.scale(-1, 1);
//       }
      canvasCtx.drawImage(photo, 0, 0, canvas.width, canvas.height);

      container.classList.add('photo-taken');
      takePhotoButton.remove();
      switchCamerasButton.remove();
      goal.classList.remove('reveal');

      (async function() {
        await waitForNSeconds(1);
        await animatePhotoCrop(photo, canvas, canvasCtx);
        await waitForNSeconds(1);
        judgement.classList.add('reveal');
      })();

      // Send photo to host
      listenForChannel(async channel => {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
        const arrayBuffer = await new Response(blob).arrayBuffer();
        // TODO: use large buffer transfer function
        channel.send(arrayBuffer);

        judgement.querySelector('.yes-button').onclick = () => channel.send('real');
        judgement.querySelector('.no-button').onclick  = () => channel.send('fake');
      });

      shutterSound.play().catch(() => {});
    }
  }
  video.onended = () => {
    takePhotoButton.classList.add('hide');
    takePhotoButton.onclick = null;
  }

  await waitForEnd();
}

async function animatePhotoCrop(photo, canvas, canvasCtx) {
  const durationMs = 500;

  const startDiameter = Math.sqrt((photo.width * photo.width) + (photo.height * photo.height));
  const endDiameter = Math.min(photo.width, photo.height) / 3;

  function draw(diameter) {
    canvasCtx.globalCompositeOperation = 'source-over';
    canvasCtx.drawImage(
      photo,
      (canvas.width / 2) - (photo.width / 2), (canvas.height / 2) - (photo.height / 2),
      photo.width, photo.height
    );

    canvasCtx.globalCompositeOperation = 'destination-atop';
    canvasCtx.beginPath();
    canvasCtx.arc(
      canvas.width  / 2, // X
      canvas.height / 2, // Y
      diameter / 2, // Radius
      0, Math.PI * 2 // Angles
    );
    canvasCtx.fill();
  }

  let startTimestamp = performance.now();
  let frameId = requestAnimationFrame(function callback(timestamp) {
    if (timestamp - startTimestamp >= durationMs) {
      frameId = null;
      return;
    }
    const t = clamp((timestamp - startTimestamp) / durationMs, 0, 1);
    const diameter = startDiameter + ((endDiameter - startDiameter) * easeInOutQuad(t));
    draw(diameter);
    frameId = requestAnimationFrame(callback);
  });
  await new Promise(resolve => setTimeout(resolve, durationMs));
  if (frameId !== null) {
    cancelAnimationFrame(frameId);
  }
  draw(endDiameter);

  startTimestamp = performance.now();
  frameId = requestAnimationFrame(function callback(timestamp) {
    if (timestamp - startTimestamp >= durationMs) {
      frameId = null;
      return;
    }
    const t = clamp((timestamp - startTimestamp) / durationMs, 0, 1);
    canvas.width  = lerp(photo.width,  endDiameter, t);
    canvas.height = lerp(photo.height, endDiameter, t);
    draw(endDiameter);
    frameId = requestAnimationFrame(callback);
  });
  await new Promise(resolve => setTimeout(resolve, durationMs));
  if (frameId !== null) {
    cancelAnimationFrame(frameId);
  }
  canvas.width  = endDiameter;
  canvas.height = endDiameter;
  draw(endDiameter);
}
