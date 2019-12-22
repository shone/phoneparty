import {photoJudgement, photoSelfJudgement} from './photoJudgementScreen.mjs';
import photoTakingScreen from './photoTakingScreen.mjs';

export default function allTheThings(channel, rtcConnection) {
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
  subjectPanel.insertAdjacentHTML('beforeend', `
    <h1 class="all-the-things confirmation active flash">
      ${text}
    </h1>
  `);
  const heading = subjectPanel.lastElementChild;

  const messagingPanel = document.getElementById('messaging-panel');
  messagingPanel.insertAdjacentHTML('beforeend', `
    <button class="all-the-things yes-button push-button active"></button>
  `);
  const yesButton = messagingPanel.lastElementChild;

  yesButton.onclick = () => {
    channel.send(true);
    yesButton.classList.add('selected');
    heading.classList.remove('flash');
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
