import './titleScreen.mjs';
import {photoJudgement, photoSelfJudgement} from './photoJudgementScreen.mjs';
import './thingChoosingScreen.mjs';
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
    switch (event.channel.label) {
//       case 'all-the-things_thing-choosing':
//         event.channel.addEventListener('message', event => thing = event.data);
//         return thingChoosingScreen(event.channel);
      case 'all-the-things_ready-to-start-looking':
        return confirmation(event.channel, 'Ready to start looking?');
      case 'all-the-things_photo':
        return photoTakingScreen(event.channel, getThing, rtcConnection).then(canvas => photoCanvas = canvas);
      case 'all-the-things_photo-self-judgement':
        return photoSelfJudgement(event.channel, getThing, photoCanvas);
      case 'all-the-things_photo-judgement':
        return photoJudgement(event.channel, getThing);
      case 'all-the-things_another-round':
        return confirmation(event.channel, 'Play another round?');
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
