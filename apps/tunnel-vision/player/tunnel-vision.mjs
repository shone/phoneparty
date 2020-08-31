import './intro.mjs';
import './choose.mjs';
import './shoot.mjs';
// import './photoJudgement.mjs';

import routes from '/player/routes.mjs';

import '/common/push-button.mjs';

import {waitForNSeconds} from '/common/utils.mjs';

import startMessaging from '/player/messaging.mjs';

document.head.insertAdjacentHTML('beforeend', `
  <link rel="stylesheet" href="/apps/tunnel-vision/timothy.css">
`);

routes['#apps/tunnel-vision/goal'] = async function goal(routeContext) {
  routeContext.listenForChannel((channel, channelName) => {
    if (channelName === 'messaging') {
      startMessaging(channel);
    }
  });
  await confirmation('Ready to start looking?', routeContext);
}

routes['#apps/tunnel-vision/end'] = async function end(routeContext) {
  await confirmation('Play another round?', routeContext);
}

async function confirmation(text, routeContext) {

  const panelA = document.createElement('div');
  panelA.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/apps/tunnel-vision/player/confirmation.css">

    <h1>${text}</h1>
  `;

  const panelB = document.createElement('div');
  panelB.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/apps/tunnel-vision/player/confirmation.css">

    <push-button id="confirm-button"></push-button>
  `;

  routeContext.listenForChannel((channel, channelName) => {
    if (channelName === 'confirm') {
      document.getElementById('panel-A').append(panelA);
      document.getElementById('panel-B').append(panelB);
      panelB.shadowRoot.getElementById('confirm-button').onclick = () => {
        panelA.classList.add('confirmed');
        panelB.classList.add('confirmed');
        channel.send(true);
      }
    }
  });

  await routeContext.waitForEnd();

  panelA.remove();
  panelB.remove();
}
