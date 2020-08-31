import {stream, rtcConnection} from '/player/main.mjs';
import {clamp, randomInArray, waitForNSeconds} from '/common/utils.mjs';

import '/common/push-button.mjs';

import routes from '/player/routes.mjs';

export let canvas = null;

routes['#apps/tunnel-vision/shoot'] = async function shoot({params, waitForEnd, listenForChannel}) {
  const thing = params.get('thing');

  const container = document.createElement('div');
  container.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/apps/tunnel-vision/player/shoot.css">

    <video playsinline autoplay muted></video>

    <canvas></canvas>

    <div id="goal">
      <img>
      <div class="label"></div>
    </div>

    <push-button class="hide" id="take-photo-button"></push-button>
    <push-button class="hide" id="switch-cameras-button"></push-button>
  `;
  document.body.append(container);
  waitForEnd().then(() => container.remove());

  const video = container.shadowRoot.querySelector('video');
  canvas = container.shadowRoot.querySelector('canvas');
  const canvasCtx = canvas.getContext('2d');

  const takePhotoButton     = container.shadowRoot.getElementById('take-photo-button');
  const switchCamerasButton = container.shadowRoot.getElementById('switch-cameras-button');

  container.shadowRoot.querySelector('#goal .label').textContent = thing;
  container.shadowRoot.querySelector('#goal img').src = `/apps/tunnel-vision/things/${thing}.svg`;

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

      const fullPhoto = document.createElement('canvas');
      fullPhoto.width  = video.videoWidth;
      fullPhoto.height = video.videoHeight;
      const fullPhotoCtx = fullPhoto.getContext('2d');
      if (video.classList.contains('flip')) {
        fullPhotoCtx.translate(video.videoWidth, 0);
        fullPhotoCtx.scale(-1, 1);
      }
      fullPhotoCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

      // Draw photo onto canvas
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
//       if (video.classList.contains('flip')) {
//         context.translate(canvas.width, 0);
//         context.scale(-1, 1);
//       }
      context.drawImage(fullPhoto, 0, 0, canvas.width, canvas.height);

      (async function() {
        await waitForNSeconds(1);
        await cropDown(fullPhoto, canvas);
        await waitForNSeconds(.1);
        canvas.classList.add('scale-up');
      })();

      // Send photo to host
      listenForChannel(async channel => {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
        const arrayBuffer = await new Response(blob).arrayBuffer();
        // TODO: use large buffer transfer function
        channel.send(arrayBuffer);
      });

      container.classList.add('photo-taken');
      takePhotoButton.remove();
      switchCamerasButton.remove();

      shutterSound.play().catch(() => {});
    }
  }
  video.onended = () => {
    takePhotoButton.classList.add('hide');
    takePhotoButton.onclick = null;
  }

  await waitForEnd();
}

function cropDown(fullPhoto, destination) {
  const context = destination.getContext('2d');

  context.fillStyle = 'red';

  const startTimestamp = performance.now();
  const duration = 500;

  const startDiameter = Math.sqrt((fullPhoto.width * fullPhoto.width) + (fullPhoto.height * fullPhoto.height));
  const endDiameter = Math.min(fullPhoto.width, fullPhoto.height) / 3;

  function easeInOutQuad(t) {
    return t<.5 ? 2*t*t : -1+(4-2*t)*t;
  }

  window.requestAnimationFrame(function callback(timestamp) {
    context.globalCompositeOperation = 'source-over';
    context.drawImage(
      fullPhoto,
      0, 0,
      fullPhoto.width, fullPhoto.height
    );

    context.globalCompositeOperation = 'destination-atop';
    context.beginPath();
    const t = clamp((timestamp - startTimestamp) / duration, 0, 1);
    const diameter = startDiameter + ((endDiameter - startDiameter) * easeInOutQuad(t));
    console.log(diameter);
    context.arc(
      fullPhoto.width  / 2, // X
      fullPhoto.height / 2, // Y
      diameter / 2, // Radius
      0, Math.PI * 2 // Angles
    );
    context.fill();
    if (timestamp - startTimestamp < duration) {
      window.requestAnimationFrame(callback);
    }
  });

  return new Promise(resolve => setTimeout(resolve, duration));
}
