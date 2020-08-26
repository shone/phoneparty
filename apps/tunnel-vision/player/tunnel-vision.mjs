import './intro.mjs';
import './thingChoosing.mjs';
// import './photoTaking.mjs';
// import './photoJudgement.mjs';

import routes from '/player/routes.mjs';

import '/common/push-button.mjs';

import {waitForNSeconds} from '/common/utils.mjs';

import startMessaging from '/player/messaging.mjs';

routes['#apps/tunnel-vision/goal'] = async function goal(routeContext) {
  document.body.style.backgroundColor = '#98947f';
  routeContext.listenForChannel((channel, channelName) => {
    startMessaging(channel);
  });
  await confirmation('Ready to start looking?', routeContext);
}

routes['#apps/tunnel-vision/another-round'] = async function anotherRound(routeContext) {
  document.body.style.backgroundColor = '#98947f';
  await confirmation('Play another round?', routeContext);
}

async function confirmation(text, routeContext) {

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

  routeContext.listenForChannel((channel, channelName) => {
    if (channelName === 'confirm') {
      document.getElementById('panel-A').append(panelA);
      document.getElementById('panel-B').append(panelB);
      panelB.querySelector('push-button').onclick = () => {
        channel.send(true);
        panelA.classList.remove('flash');
        panelB.classList.add('selected');
      }
    }
  });

  await routeContext.waitForEnd();

  panelA.remove();
  panelB.remove();
}
