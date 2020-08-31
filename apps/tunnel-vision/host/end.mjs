import {players} from '/host/players.mjs';

import {waitForNSeconds} from '/common/utils.mjs';

import SpeechBubble from '/host/speech-bubble.mjs';

import routes from '/host/routes.mjs';

import Audience from '/host/audience.mjs';

routes['#apps/tunnel-vision/end'] = async function end(routeContext) {

  const {waitForEnd, createChannel, listenForPlayers, listenForLeavingPlayers} = routeContext;

  const container = document.createElement('div');
  container.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/apps/tunnel-vision/host/end.css">

    <h1>Play another round?</h1>
  `;
  document.body.append(container);

  const audience = new Audience(routeContext);
  container.shadowRoot.append(audience);

  const speechBubbles = new Set();

  const waitForAllPlayers = new Promise(resolve => {
    const confirmedPlayers = new Set();
    function checkIfAllPlayersConfirmed() {
      if (players.length > 0 && players.every(player => confirmedPlayers.has(player))) {
        resolve();
      }
    }
    listenForPlayers(player => {
      createChannel(player, 'confirm').onmessage = () => {
        confirmedPlayers.add(player);
        const speechBubble = new SpeechBubble('👍');
        audience.getPlayerBubble(player).append(speechBubble);
        speechBubbles.add(speechBubble);
        checkIfAllPlayersConfirmed();
      }
    })
    listenForLeavingPlayers(checkIfAllPlayersConfirmed);
  });

  const result = await Promise.race([waitForAllPlayers, waitForEnd()]);
  if (result === 'route-ended') {
    container.remove();
    return;
  }

  [...speechBubbles].forEach(speechBubble => speechBubble.classList.add('highlight'));
  await waitForNSeconds(1.5);
  [...speechBubbles].forEach(speechBubble => speechBubble.classList.add('cleared'));
  await waitForNSeconds(0.5);

  container.remove();

  return '#apps/tunnel-vision/thing-choosing';
}
