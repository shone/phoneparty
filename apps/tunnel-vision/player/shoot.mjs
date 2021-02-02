import {clamp, lerp, randomInArray, easeInOutQuad, waitForNSeconds} from '/common/utils.mjs';

import '/common/push-button.mjs';

import routes from '/player/routes.mjs';

routes['#apps/tunnel-vision/shoot'] = async function shoot({params, waitForEnd, listenForChannel}) {
  const thing = params.get('thing');

  const container = document.createElement('div');
  container.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/apps/tunnel-vision/player/shoot.css">

    <video playsinline autoplay muted></video>

    <canvas id="crop-guide"></canvas>

    <div id="goal">
      <img>
      <div class="label"></div>
    </div>

    <canvas id="photo-display"></canvas>

    <push-button class="hide" id="take-photo-button"></push-button>
    <push-button class="hide" id="switch-cameras-button"></push-button>

    <div id="camera-status"></div>

    <div id="judgement">
      <p>Is your photo really of <span class="target"></span>?</p>
      <div class="options">
        <push-button data-action="mark-real">Yes</push-button>
        <push-button data-action="mark-fake">No</push-button>
        <br>
        <push-button data-action="retake">Retake</push-button>
      </div>
    </div>
  `;
  document.body.append(container);
  waitForEnd().then(() => container.remove());

  const video = container.shadowRoot.querySelector('video');
  const cameraStatus = container.shadowRoot.getElementById('camera-status');

  const photoDisplayCanvas = container.shadowRoot.getElementById('photo-display');
  const photoDisplayCanvasCtx = photoDisplayCanvas.getContext('2d');

  const takePhotoButton     = container.shadowRoot.getElementById('take-photo-button');
  const switchCamerasButton = container.shadowRoot.getElementById('switch-cameras-button');

  const judgement = container.shadowRoot.getElementById('judgement');
  judgement.querySelector('.target').textContent = thing;

  if (!navigator.mediaDevices) {
    cameraStatus.innerHTML = `
      <h1>Can't search for cameras</h1>
      <p>navigator.mediaDevices unavailable. <span class="reason"></span></p>
      <push-button>Reload</push-button>
    `;
    if (location.protocol !== 'https:') {
      cameraStatus.querySelector('.reason').textContent = 'Probably because HTTPS is unavailable.';
    }
    cameraStatus.querySelector('push-button').onclick = async () => {
      cameraStatus.innerHTML = '<h1>Reloading...</h1>';
      await waitForNSeconds(1);
      location.reload();
    }
    await waitForEnd();
    return;
  }

  const shutterSound = new Audio('/apps/tunnel-vision/sounds/camera-shutter.wav');

  let mediaStream = null;
  let cameraConstraints = { video: {facingMode: 'environment'}, audio: false };

  let videoInputDevices = []
  async function ondevicechange() {
    try {
      videoInputDevices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput');
    } catch (error) {
      // TODO: show error
      videoInputDevices = [];
    }
    switchCamerasButton.classList.toggle('hide', videoInputDevices.length <= 1);
  }
  ondevicechange();
  navigator.mediaDevices.addEventListener('devicechange', ondevicechange);
  waitForEnd().then(() => navigator.mediaDevices.removeEventListener('devicechange', ondevicechange));

  let switchCameraButtonCallback = null;
  switchCamerasButton.onclick = async () => {
    if (videoInputDevices.length <= 1) {
      return;
    }

    let currentDeviceIndex = 0;
    {
      const videoTracks = mediaStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const currentDeviceId = videoTracks[0].getSettings().deviceId;
        currentDeviceIndex = videoInputDevices.findIndex(device => device.deviceId === currentDeviceId);
      }
    }

    let newDeviceIndex = currentDeviceIndex + 1;
    if (newDeviceIndex >= videoInputDevices.length) {
      newDeviceIndex = 0;
    }

    cameraConstraints = { video: {deviceId: videoInputDevices[newDeviceIndex].deviceId}, audio: false};
    if (switchCameraButtonCallback) switchCameraButtonCallback();
  }

  async function acquireCameraLoop() {
    while (true) {
      cameraStatus.innerHTML = '<h1>Acquiring camera...</h1>';

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(cameraConstraints);
      } catch (error) {
        cameraStatus.innerHTML = `
          <h1>Couldn't acquire camera</h1>
          <p></p>
          <push-button>Retry</push-button>
        `;
        if (error.name === 'NotFoundError') {
          cameraStatus.querySelector('p').textContent = 'A camera could not be found on your device.';
        } else if (error.name === 'NotAllowedError') {
          cameraStatus.querySelector('p').textContent = 'Camera permissions not granted. Please set your web browser to allow this app to access your camera.';
        } else {
          cameraStatus.querySelector('p').textContent = error;
        }
        const waitForRetry = new Promise(resolve => cameraStatus.querySelector('push-button').onclick = () => resolve('retry'));
        switch (await Promise.race([waitForRetry, waitForEnd()])) {
          case 'retry':
            cameraStatus.innerHTML = '<h1>Acquiring camera...</h1>';
            await waitForNSeconds(1);
            continue;
          case 'route-ended':
            return;
        }
      }

      video.srcObject = mediaStream;

      // Flip video display horizontally if using a user-facing camera
      const videoTrack = mediaStream.getVideoTracks()[0];
      const isUserFacingCamera = !videoTrack.getCapabilities || !videoTrack.getCapabilities().facingMode.includes('environment');
      video.classList.toggle('flip', isUserFacingCamera);

      cameraStatus.innerHTML = '';

      const waitForTrackEnded = new Promise(resolve => videoTrack.onended = () => resolve('track-ended'));
      const waitForSwitchCamera = new Promise(resolve => switchCameraButtonCallback = () => resolve('switch-camera'));
      switch (await Promise.race([waitForTrackEnded, waitForSwitchCamera, waitForEnd()])) {
        case 'switch-camera':
          continue;
        case 'track-ended':
          cameraStatus.innerHTML = '<h1>Video stream lost</h1>';
          await waitForNSeconds(1);
          continue;
        case 'route-ended':
          return;
      }
    }
  }

  const cropGuide = container.shadowRoot.getElementById('crop-guide');
  const cropGuideCtx = cropGuide.getContext('2d');
  video.onresize = () => {
    // Resize the crop guide to match the video

    cropGuide.width  = video.videoWidth  || window.innerWidth;;
    cropGuide.height = video.videoHeight || window.innerHeight;
    const cropSize = Math.min(cropGuide.width, cropGuide.height) / 3;

    // Fill with translucent white
    cropGuideCtx.globalCompositeOperation = 'source-over';
    cropGuideCtx.fillStyle = 'rgb(255, 255, 255, .6)';
    cropGuideCtx.fillRect(0, 0, cropGuide.width, cropGuide.height);

    // Make circle in the middle transparent
    cropGuideCtx.globalCompositeOperation = 'destination-out';
    cropGuideCtx.beginPath();
    cropGuideCtx.arc(
      cropGuide.width  / 2, // X
      cropGuide.height / 2, // Y
      cropSize / 2, // Radius
      0, Math.PI * 2 // Angles
    );
    cropGuideCtx.fill();
  }

  video.onloadeddata = () => {
    takePhotoButton.classList.remove('hide');
    takePhotoButton.onclick = function() {

      // TODO: Use ImageCapture API (currently Chrome only)

      const photo = document.createElement('canvas');
      photo.width  = video.videoWidth;
      photo.height = video.videoHeight;
      const photoCtx = photo.getContext('2d');
      if (video.classList.contains('flip')) {
        photoCtx.translate(video.videoWidth, 0);
        photoCtx.scale(-1, 1);
      }
      photoCtx.drawImage(video, 0, 0);

      // Draw photo onto canvas
      photoDisplayCanvas.width  = photo.width;
      photoDisplayCanvas.height = photo.height;
      photoDisplayCanvasCtx.drawImage(photo, 0, 0);

      container.classList.add('photo-taken');
      goal.classList.remove('reveal');

      (async function() {
        await waitForNSeconds(1);
        await animatePhotoCrop(photo, photoDisplayCanvas, photoDisplayCanvasCtx);
        await waitForNSeconds(1);
        judgement.classList.add('reveal');
      })();

      // Send photo to host
      listenForChannel(async channel => {
        const blob = await new Promise(resolve => photo.toBlob(resolve, 'image/jpeg'));

        // Must convert to an ArrayBuffer as Chrome (as of v88) doesn't support sending blobs over an RTCDataChannel.
        // Must use Response.arrayBuffer() as Safari (as of v13) doesn't support Blob.arrayBuffer()
        const arrayBuffer = await new Response(blob).arrayBuffer();

        // TODO: RTCDataChannel can have a maximum message size which might be exceeded with a high-resolution image.
        // May need to split up the ArrayBuffer into parts.
        channel.send(arrayBuffer);

        function setRealFake(state) {
          channel.send(state);
          for (const button of judgement.querySelectorAll('push-button')) {
            button.classList.toggle('selected', button.dataset.action === state);
          }
        }

        judgement.querySelector('.options').onclick = ({target}) => {
          if (target.dataset.action) {
            if (target.dataset.action === 'retake') {
              channel.send('retake');
              judgement.querySelector('.options').onclick = null;
              [...judgement.querySelectorAll('.options .selected')].forEach(button => button.classList.remove('selected'));
              photoDisplayCanvasCtx.clearRect(0, 0, photoDisplayCanvas.width, photoDisplayCanvas.height);
              container.classList.remove('photo-taken');
              judgement.classList.remove('reveal');
              goal.classList.add('reveal');
            } else {
              setRealFake(target.dataset.action);
            }
          }
        }
      });

      shutterSound.play().catch(() => {});
    }
  }

  video.onended = () => {
    takePhotoButton.classList.add('hide');
    takePhotoButton.onclick = null;
  }

  acquireCameraLoop();

  const goal = container.shadowRoot.getElementById('goal');
  goal.querySelector('.label').textContent = thing;
  goal.querySelector('img').src = `/apps/tunnel-vision/things/${thing}.svg`;
  setTimeout(() => goal.classList.add('transition', 'reveal'), 100);

  await waitForEnd();
}

async function animatePhotoCrop(photo, canvas, canvasCtx) {
  const durationMs = 500;

  const startDiameter = Math.sqrt((photo.width * photo.width) + (photo.height * photo.height));
  const endDiameter = Math.min(photo.width, photo.height) / 3;

  function drawCroppedPhoto(diameter) {
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

  // Animate cropping down to a circle a third the size of the canvas
  let startTimestamp = performance.now();
  let frameId = requestAnimationFrame(function callback(timestamp) {
    if (timestamp - startTimestamp >= durationMs) {
      frameId = null;
      return;
    }
    const t = clamp((timestamp - startTimestamp) / durationMs, 0, 1);
    const diameter = startDiameter + ((endDiameter - startDiameter) * easeInOutQuad(t));
    drawCroppedPhoto(diameter);
    frameId = requestAnimationFrame(callback);
  });
  await new Promise(resolve => setTimeout(resolve, durationMs));
  if (frameId !== null) {
    cancelAnimationFrame(frameId);
  }
  drawCroppedPhoto(endDiameter);

  // Animate scaling down the canvas to fit the circle
  startTimestamp = performance.now();
  frameId = requestAnimationFrame(function callback(timestamp) {
    if (timestamp - startTimestamp >= durationMs) {
      frameId = null;
      return;
    }
    const t = clamp((timestamp - startTimestamp) / durationMs, 0, 1);
    canvas.width  = lerp(photo.width,  endDiameter, t);
    canvas.height = lerp(photo.height, endDiameter, t);
    drawCroppedPhoto(endDiameter);
    frameId = requestAnimationFrame(callback);
  });
  await new Promise(resolve => setTimeout(resolve, durationMs));
  if (frameId !== null) {
    cancelAnimationFrame(frameId);
  }
  canvas.width  = endDiameter;
  canvas.height = endDiameter;
  drawCroppedPhoto(endDiameter);
}
