"use strict";

async function photoTakingScreen(channel) {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things photo-screen">
      <video playsinline autoplay muted></video>
      <canvas></canvas>
      <div class="crop-guide"></div>
      <div class="goal">
        <img>
        <div class="label"></div>
      </div>
      <button class="take-photo-button"></button>
      <button class="push-button switch-cameras-button"></button>
    </div>
  `);
  const photoScreen = document.body.lastElementChild;
  const video  = photoScreen.querySelector('video');
  const canvas = photoScreen.querySelector('canvas');
  const cropGuide = photoScreen.querySelector('.crop-guide');
  const takePhotoButton = photoScreen.querySelector('.take-photo-button')
  const switchCamerasButton = photoScreen.querySelector('.switch-cameras-button')

  let thing = null;
  channel.onmessage = event => {
    thing = event.data;
    photoScreen.querySelector('.goal .label').textContent = thing;
    photoScreen.querySelector('.goal img').src = `/games/all-the-things/things/${thing}.svg`;
  }

  try {
    const alternateStream = await navigator.mediaDevices.getUserMedia({ video: {facingMode: { exact: "environment"}  }, audio: false});
    video.srcObject = alternateStream;
    switchCamerasButton.onclick = () => {
      if (video.srcObject === alternateStream) {
        video.srcObject = stream;
        video.classList.add('flip');
      } else {
        video.srcObject = alternateStream;
        video.classList.remove('flip');
      }
    }
  } catch(error) {
    video.srcObject = stream;
    video.classList.add('flip');
    switchCamerasButton.remove();
  }

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
  video.onloadedmetadata = updateCropGuide;
  updateCropGuide();

  const shutterSound = new Audio('/games/all-the-things/sounds/camera-shutter.ogg');

  channel.onclose = () => {
    photoScreen.remove();
    window.removeEventListener('resize', updateCropGuide);
  }

  return await new Promise(resolve => {
    takePhotoButton.onclick = async function() {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      shutterSound.play();
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      photoScreen.classList.add('photo-taken');
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
      const arrayBuffer = await new Response(blob).arrayBuffer();
      channel.send(arrayBuffer);
      takePhotoButton.remove();
      switchCamerasButton.remove();
      resolve([thing, canvas]);
    }
  });
}
