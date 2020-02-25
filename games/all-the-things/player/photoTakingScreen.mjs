import {stream} from '/main.mjs';
import {randomInArray} from '/shared/utils.mjs';
import routes, {waitForRouteToEnd, listenForChannelOnCurrentRoute} from '/routes.mjs';

routes['#games/all-the-things/photo-taking'] = async function photoTakingScreen() {
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
      <button class="take-photo-button hide"></button>
      <button class="push-button switch-cameras-button hide"></button>
    </div>
  `);
  const photoScreen = document.body.lastElementChild;
  const video  = photoScreen.querySelector('video');
  const canvas = photoScreen.querySelector('canvas');
  const cropGuide = photoScreen.querySelector('.crop-guide');
  const takePhotoButton = photoScreen.querySelector('.take-photo-button');
  const switchCamerasButton = photoScreen.querySelector('.switch-cameras-button');
  const cleanups = [() => photoScreen.remove()];

  const thing = 'sock';// await getThing();
  photoScreen.querySelector('.goal .label').textContent = thing;
  photoScreen.querySelector('.goal img').src = `/games/all-the-things/things/${thing}.svg`;

  // Setup video streams
  async function switchCamera(options) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: options, audio: false});
      video.srcObject = stream;
      const flip = (options === true) || (options.facingMode && options.facingMode.exact === 'user');
      video.classList.toggle('flip', flip);
      rtcConnection.getSenders()[0].replaceTrack(stream.getVideoTracks()[0]);
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
    const [videoLoaded, channelClosed] = await new Promise(resolve => {
      video.onloadeddata = () => resolve([true, false]);
      channel.addEventListener('close', () => resolve([false, true]), {once: true});
    });
    if (channelClosed) {
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

  // TODO: convert to mp3
  const shutterSound = new Audio('/games/all-the-things/sounds/camera-shutter.ogg');

  // Wait for photo to be taken (or channel closed)
  return await new Promise(resolve => {
    takePhotoButton.onclick = async function() {
      shutterSound.play().catch(() => {});
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
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
      const arrayBuffer = await new Response(blob).arrayBuffer();
      // TODO: determine maximum message size
      channel.send(arrayBuffer);
      photoScreen.classList.add('photo-taken');
      takePhotoButton.remove();
      switchCamerasButton.remove();
      resolve(canvas);
    }

    channel.onclose = channel.onerror = event => {
      cleanups.forEach(f => f());
      resolve(null);
    }
  });
}
