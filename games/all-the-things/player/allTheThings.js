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
      photoTakingScreen(event.channel).then(results => {
        [thing, photoCanvas] = results;
      });
    } else if (event.channel.label === 'all-the-things_photo-self-judgement') {
      photoSelfJudgement(event.channel, thing, photoCanvas);
    } else if (event.channel.label === 'all-the-things_photo-judgement') {
      photoJudgement(event.channel, thing);
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
    }, 500);
  }
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
