import {stream, rtcConnection} from '/main.mjs';
import {randomInArray} from '/shared/utils.mjs';

import routes, {
  currentRoute,
  waitForRouteToEnd,
  listenForChannelOnCurrentRoute
} from '/routes.mjs';

export let canvas = null;

routes['#games/all-the-things/photo-taking'] = async function photoTakingScreen() {
  const routeParams = new URLSearchParams(currentRoute.split('?')[1]);
  const thing = routeParams.get('thing');

  document.body.style.backgroundColor = '#98947f';
  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things photo-screen">
      <video playsinline autoplay muted></video>
      <canvas></canvas>
      <div class="crop-guide"></div>
      <div class="goal">
        <img>
        <div class="label"></div>
      </div>
      <button class="push-button hide take-photo-button"></button>
      <button class="push-button hide switch-cameras-button"></button>
    </div>
  `);
  const photoScreen = document.body.lastElementChild;
  const video  = photoScreen.querySelector('video');
  canvas = photoScreen.querySelector('canvas');
  const cropGuide = photoScreen.querySelector('.crop-guide');
  const takePhotoButton = photoScreen.querySelector('.take-photo-button');
  const switchCamerasButton = photoScreen.querySelector('.switch-cameras-button');
  const cleanups = [() => photoScreen.remove()];

  photoScreen.querySelector('.goal .label').textContent = thing;
  photoScreen.querySelector('.goal img').src = `/games/all-the-things/things/${thing}.svg`;

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
    let facingMode = 'environment';
    switchCamerasButton.onclick = () => {
      if (facingMode === 'environment') {
        facingMode = 'user';
      } else {
        facingMode = 'environment';
      }
      switchCamera({facingMode: { exact: facingMode}});
    }
    switchCamerasButton.classList.remove('hide');
    cleanups.unshift(() => switchCamera(true));
  } else {
    video.srcObject = stream;
    video.classList.add('flip');
  }

  // Wait for video stream to load
  if (video.srcObject) {
    const waitForVideoResult = await Promise.race([new Promise(resolve => video.onloadeddata = () => resolve('video-loaded')), waitForRouteToEnd()]);
    if (waitForVideoResult === 'route-ended') {
      cleanups.forEach(f => f());
      return null;
    }
    takePhotoButton.classList.remove('hide');
  } else if (location.hostname === 'localhost') {
    takePhotoButton.classList.remove('hide');
  }

  // Handle crop guide
  function updateCropGuide() {
    const windowAspectRatio = window.innerWidth / window.innerHeight;
    const videoAspectRatio  = video.videoWidth  / video.videoHeight;
    let cropSize = null;
    if (videoAspectRatio < windowAspectRatio) {
      // Window height is less than video height
      cropSize = '25vw';
    } else {
      // Window width is less than video width
      cropSize = '25vh';
    }
    cropGuide.style.borderLeftWidth   = `calc(50vw - (${cropSize} / 2))`;
    cropGuide.style.borderRightWidth  = `calc(50vw - (${cropSize} / 2))`;
    cropGuide.style.borderTopWidth    = `calc(50vh - (${cropSize} / 2))`;
    cropGuide.style.borderBottomWidth = `calc(50vh - (${cropSize} / 2))`;
  }
  window.addEventListener('resize', updateCropGuide);
  cleanups.unshift(() => window.removeEventListener('resize', updateCropGuide));
  video.onloadedmetadata = updateCropGuide;
  updateCropGuide();

  const shutterSound = new Audio('/games/all-the-things/sounds/camera-shutter.wav');

  takePhotoButton.onclick = async function() {

    shutterSound.play().catch(() => {});

    // Draw photo onto canvas
    if (video.srcObject) {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (video.classList.contains('flip')) {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
    } else if (location.hostname === 'localhost') {
      const testImage = new Image();
      testImage.src = `/games/all-the-things/test_photos/${randomInArray(['1', '2', '3', '4'])}.jpg`;
      await new Promise(resolve => testImage.onload = resolve);
      canvas.width  = testImage.width;
      canvas.height = testImage.height;
      const context = canvas.getContext('2d');
      context.drawImage(testImage, 0, 0, canvas.width, canvas.height);
    }

    // Send photo to host
    listenForChannelOnCurrentRoute(async channel => {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
      const arrayBuffer = await new Response(blob).arrayBuffer();
      // TODO: determine maximum message size
      channel.send(arrayBuffer);
    });

    photoScreen.classList.add('photo-taken');
    takePhotoButton.remove();
    switchCamerasButton.remove();
  }

  await waitForRouteToEnd();

  cleanups.forEach(f => f());
}
