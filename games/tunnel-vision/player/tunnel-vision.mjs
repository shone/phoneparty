import './titleScreen.mjs';
import './thingChoosingScreen.mjs';
import './photoTakingScreen.mjs';
import './photoJudgementScreen.mjs';

import routes, {
  listenForChannelOnCurrentRoute,
  waitForRouteToEnd,
} from '/routes.mjs';

import {waitForNSeconds} from '/shared/utils.mjs';

routes['#games/tunnel-vision/goal'] = async function goalScreen() {
  document.body.style.backgroundColor = '#98947f';
  await confirmation('Ready to start looking?');
}

routes['#games/tunnel-vision/another-round'] = async function anotherRoundScreen() {
  document.body.style.backgroundColor = '#98947f';
  await confirmation('Play another round?');
}

async function confirmation(text) {

  const subjectPanel = document.getElementById('subject-panel');
  subjectPanel.insertAdjacentHTML('beforeend', `
    <h1 class="tunnel-vision confirmation active flash">
      ${text}
    </h1>
  `);
  const heading = subjectPanel.lastElementChild;

  const messagingPanel = document.getElementById('messaging-panel');
  messagingPanel.insertAdjacentHTML('beforeend', `
    <push-button class="tunnel-vision yes-button active"></push-button>
  `);
  const yesButton = messagingPanel.lastElementChild;

  listenForChannelOnCurrentRoute(channel => {
    yesButton.onclick = () => {
      channel.send(true);
      yesButton.classList.add('selected');
      heading.classList.remove('flash');
    }
  });

  await waitForRouteToEnd();

  heading.classList.remove('active', 'flash');
  yesButton.classList.remove('active');

  await waitForNSeconds(0.5);

  heading.remove();
  yesButton.remove();
}
