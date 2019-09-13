"use strict";

function allTheThings(channel, rtcConnection) {
  const previousBackgroundColor = document.body.style.backgroundColor;
  document.body.style.backgroundColor = '#98947f';

  let thing = null;
  let photoCanvas = null;
  function handleNewChannel(event) {
    if (event.channel.label === 'all-the-things_ready-to-start-looking') {
      readyToStartLooking(event.channel);
    } else if (event.channel.label === 'all-the-things_photo') {
      photoMode(event.channel).then(results => {
        [thing, photoCanvas] = results;
      });
    } else if (event.channel.label === 'all-the-things_photo-self-judgement') {
      photoSelfJudgement(event.channel, thing, photoCanvas);
    }
  }
  rtcConnection.addEventListener('datachannel', handleNewChannel);

  channel.onclose = () => {
    rtcConnection.removeEventListener('datachannel', handleNewChannel);
    document.body.style.backgroundColor = previousBackgroundColor;
  }
}

function readyToStartLooking(channel) {
  const subjectPanel = document.getElementById('subject-panel');
  const heading = document.createElement('h1');
  heading.classList.add('ready-to-start-looking');
  heading.textContent = 'Ready to start looking?';
  subjectPanel.appendChild(heading);
  heading.classList.add('active');
  channel.onclose = () => {
    heading.classList.remove('active');
    setTimeout(() => {
      heading.remove();
      subjectPanel.textContent = '';
    }, 500);
  }
}

async function photoMode(channel) {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things photo-screen">
      <video playsinline autoplay muted></video>
      <canvas></canvas>
      <div class="crop-guide"></div>
      <div class="goal">
        <img>
        <div class="label"></div>
      </div>
      <button></button>
    </div>
  `);
  const photoScreen = document.body.lastElementChild;
  const video  = photoScreen.querySelector('video');
  const canvas = photoScreen.querySelector('canvas');
  const cropGuide = photoScreen.querySelector('.crop-guide');
  const button = photoScreen.querySelector('button')

  let thing = null;
  channel.onmessage = event => {
    thing = event.data;
    photoScreen.querySelector('.goal .label').textContent = thing;
    photoScreen.querySelector('.goal img').src = `/games/all-the-things/things/${thing}.svg`;
  }
  
  video.srcObject = stream;

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
    button.onclick = async function() {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      shutterSound.play();
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      photoScreen.classList.add('photo-taken');
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
      const arrayBuffer = await new Response(blob).arrayBuffer();
      channel.send(arrayBuffer);
      button.remove();
      resolve([thing, canvas]);
    }
  });
}

function photoSelfJudgement(channel, thing, photoCanvas) {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things photo-self-judgement-screen">
      <h1>Is your photo really of:</h1>
      <div class="goal">
        <img src="/games/all-the-things/things/${thing}.svg">
        <div class="label">${thing}</div>
      </div>
      <div class="be-honest">be honest</div>
      <div class="buttons">
        <button class="push-button" data-response="real">yes</button>
        <button class="push-button" data-response="fake">no</button>
      </div>
    </div>
  `);
  const selfJudgementScreen = document.body.lastElementChild;
  selfJudgementScreen.insertBefore(photoCanvas, selfJudgementScreen.firstChild);
  selfJudgementScreen.onclick = event => {
    if (event.target.tagName === 'BUTTON') {
      channel.send(event.target.dataset.response);
      event.target.classList.add('selected');
      selfJudgementScreen.querySelector('.be-honest').remove();
      selfJudgementScreen.onclick = null;
    }
  }
  channel.onclose = () => {
    selfJudgementScreen.remove();
  }
}
