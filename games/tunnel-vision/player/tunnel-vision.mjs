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

  const panelA = document.createElement('div');
  panelA.classList.add('tunnel-vision', 'confirmation-panel-A', 'flash');
  panelA.innerHTML = `
    <h1>${text}</h1>
  `;

  const panelB = document.createElement('div');
  panelB.classList.add('tunnel-vision', 'confirmation-panel-B');
  panelB.innerHTML = `
    <push-button class="tunnel-vision"></push-button>
  `;

  listenForChannelOnCurrentRoute(channel => {
    document.getElementById('panel-A').append(panelA);
    document.getElementById('panel-B').append(panelB);
    panelB.querySelector('push-button').onclick = () => {
      channel.send(true);
      panelA.classList.remove('flash');
      panelB.classList.add('selected');
    }
  });

  await waitForRouteToEnd();

  panelA.remove();
  panelB.remove();
}
