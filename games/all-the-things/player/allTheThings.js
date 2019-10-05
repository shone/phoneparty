"use strict";

function allTheThings(channel, rtcConnection) {
  const previousBackgroundColor = document.body.style.backgroundColor;
  document.body.style.backgroundColor = '#98947f';

  let thing = null;
  channel.onmessage = event => {
    thing = event.data;
  }
  async function getThing() {
    if (thing !== null) {
      return thing;
    } else {
      return new Promise(resolve => {
        channel.addEventListener('message', event => resolve(event.data), {once: true});
      });
    }
  }

  let photoCanvas = null;
  function handleNewChannel(event) {
    if (event.channel.label === 'all-the-things_ready-to-start-looking') {
      confirmation(event.channel, 'Ready to start looking?');
    } else if (event.channel.label === 'all-the-things_photo') {
      photoTakingScreen(event.channel, getThing, rtcConnection).then(canvas => photoCanvas = canvas);
    } else if (event.channel.label === 'all-the-things_photo-self-judgement') {
      photoSelfJudgement(event.channel, getThing, photoCanvas);
    } else if (event.channel.label === 'all-the-things_photo-judgement') {
      photoJudgement(event.channel, getThing);
    } else if (event.channel.label === 'all-the-things_another-round') {
      confirmation(event.channel, 'Play another round?');
    }
  }
  rtcConnection.addEventListener('datachannel', handleNewChannel);

  channel.onclose = () => {
    rtcConnection.removeEventListener('datachannel', handleNewChannel);
    document.body.style.backgroundColor = previousBackgroundColor;
  }
}

function confirmation(channel, text) {
  const subjectPanel = document.getElementById('subject-panel');
  const heading = document.createElement('h1');
  heading.classList.add('all-the-things_confirmation');
  heading.textContent = text;
  subjectPanel.appendChild(heading);
  heading.classList.add('active');

  const messagingPanel = document.getElementById('messaging-panel');
  const yesButton = document.createElement('button');
  yesButton.classList.add('push-button');
  yesButton.classList.add('all-the-things_yes-button');
  messagingPanel.appendChild(yesButton);
  yesButton.classList.add('active');

  yesButton.onclick = () => {
    channel.send(true);
    yesButton.classList.add('selected');
  }

  channel.onclose = () => {
    heading.classList.remove('active');
    yesButton.classList.remove('active');
    setTimeout(() => {
      heading.remove();
      yesButton.remove();
    }, 500);
  }
}
