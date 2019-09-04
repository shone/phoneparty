function allTheThings(rtcConnection) {
  rtcConnection.addEventListener('datachannel', event => {
    if (event.channel.label === 'all-the-things_goal-confirm') {
      goalConfirm(event.channel);
    } else if(event.channel.label === 'all-the-things_photo') {
      photoMode(event.channel);
    }
  });
}

function goalConfirm(channel) {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things goal-confirm-screen">
      <h1>Ready to start looking?</h1>
      <button data-answer="yes">Yes!</button>
      <button data-answer="no">Nope</button>
    </div>
  `);
  const goalConfirmScreen = document.body.lastElementChild;
  goalConfirmScreen.addEventListener('click', event => {
    if (event.target.tagName === 'BUTTON') {
      channel.send(event.target.dataset.answer);
    }
  });

  channel.onclose = () => {
    goalConfirmScreen.remove();
  }
}

function photoMode(channel) {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things photo-screen">
      <video playsinline autoplay muted></video>
      <canvas></canvas>
      <div class="crop-guide"></div>
      <button></button>
    </div>
  `);
  const photoScreen = document.body.lastElementChild;
  const video  = photoScreen.querySelector('video');
  const canvas = photoScreen.querySelector('canvas');
  const cropGuide = photoScreen.querySelector('.crop-guide');
  const button = photoScreen.querySelector('button')

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

  button.onclick = async function() {
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    photoScreen.classList.add('photo-taken');
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
    const arrayBuffer = await new Response(blob).arrayBuffer();
    channel.send(arrayBuffer);
  }

  channel.onclose = () => {
    photoScreen.remove();
    window.removeEventListener('resize', updateCropGuide);
  }
}
