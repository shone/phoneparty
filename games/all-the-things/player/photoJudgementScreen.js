"use strict";

function photoJudgement(channel, thing) {
  const subjectPanel = document.getElementById('subject-panel');
  const judgementScreen = document.createElement('div');
  judgementScreen.classList.add('all-the-things');
  judgementScreen.classList.add('photo-judgement-screen');
  judgementScreen.insertAdjacentHTML('beforeend', `
    <h1>Is this photo really of:</h1>
    <div class="goal">
      <img src="/games/all-the-things/things/${thing}.svg">
      <div class="label">${thing}</div>
      <canvas></canvas>
    </div>
  `);
  subjectPanel.appendChild(judgementScreen);
  judgementScreen.classList.add('active');
  channel.onmessage = event => {
    const arrayBuffer = event.data;
    const blob = new Blob([arrayBuffer], {type: 'image/jpeg'});
    const image = new Image();
    image.src = URL.createObjectURL(blob);

    const cropContainer = document.createElement('div');
    cropContainer.classList.add('crop-container');
    cropContainer.appendChild(image);

    const photoContainer = document.createElement('div');
    photoContainer.classList.add('photo-container');
    photoContainer.appendChild(cropContainer);

    judgementScreen.appendChild(photoContainer);
  }
  channel.onclose = () => {
    judgementScreen.classList.remove('active');
    setTimeout(() => {
      judgementScreen.remove();
    }, 500);
  }
}
