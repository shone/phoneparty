import {waitForNSeconds, waitForKeypress} from '/common/utils.mjs';

import routes from '/host/routes.mjs';

import {
  players,
  stopListeningForAllPlayers,
  stopListeningForLeavingPlayers
} from '/host/players.mjs';

import startMessaging from '/host/messaging.mjs';
import SpeechBubble from '/host/speech-bubble.mjs';
import Audience from '/host/audience.mjs';

routes['#apps/tunnel-vision/goal'] = async function goal(routeContext) {
  const {waitForEnd, params, createChannel, listenForPlayers, listenForLeavingPlayers} = routeContext;

  const thingName = params.get('thing');

  const container = document.createElement('div');
  container.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/apps/tunnel-vision/host/goal.css">

    <div id="centered-content">
      <h1>THE GOAL:</h1>

      <div id="goal-container">
        <span class="text">
          <div class="find-a-piece-of">Find a piece of</div>
          <div class="thing-text">${thingName}</div>
        </span>
        <span class="phone">
          <div class="background"></div>
          <div class="foreground"></div>
        </span>
      </div>

      <div id="start-looking">Ready to start looking?</div>
    </div>
  `;
  document.body.append(container);

  const audience = new Audience(routeContext);
  container.shadowRoot.append(audience);

  const messagingChannels = new Set();
  function onPlayer(player) {
    const channel = createChannel(player, 'messaging');
    startMessaging(channel, audience.getPlayerBubble(player));
    messagingChannels.add(channel);
  }
  listenForPlayers(onPlayer);

  const phoneBackground = container.shadowRoot.querySelector('.phone .background');
  const phoneBackgroundContent = document.createElement('img');
  phoneBackgroundContent.src = `/apps/tunnel-vision/things/${thingName}.svg`;
  phoneBackgroundContent.dataset.name = thingName;
  phoneBackgroundContent.classList.add('thing');
  phoneBackground.append(phoneBackgroundContent);

  await Promise.race([waitForNSeconds(1), waitForKeypress(' ')]);
  container.shadowRoot.querySelector('h1').classList.add('fade-in-text');

  await Promise.race([waitForNSeconds(1.2), waitForKeypress(' ')]);
  container.shadowRoot.querySelector('#goal-container .text').classList.add('fade-in-text');

  await Promise.race([waitForNSeconds(0.5), waitForKeypress(' ')]);
  container.shadowRoot.querySelector('.phone').classList.add('reveal');

  await Promise.race([waitForNSeconds(4.5), waitForKeypress(' ')]);

  container.shadowRoot.getElementById('start-looking').classList.add('fade-in-text');

  [...messagingChannels].forEach(channel => channel.close());
  stopListeningForAllPlayers(onPlayer);

  audience.setMinPlayerCount(2);

  const speechBubbles = new Set();

  // Wait for players to be ready
  const waitForPlayersResult = await new Promise(resolve => {
    const confirmedPlayers = new Set();
    listenForPlayers(handlePlayer);
    listenForLeavingPlayers(checkIfPlayersReady);
    function handlePlayer(player) {
      createChannel(player, 'confirm').onmessage = () => {
        confirmedPlayers.add(player);
        const speechBubble = new SpeechBubble('👍');
        audience.getPlayerBubble(player).append(speechBubble);
        speechBubbles.add(speechBubble);
        checkIfPlayersReady();
      }
    }
    function checkIfPlayersReady() {
      // If there's at least two players and all players have confirmed
      if (players.length >= 2 && players.every(player => confirmedPlayers.has(player))) {
        resolve('got-players');
        stopListeningForAllPlayers(handlePlayer);
        stopListeningForLeavingPlayers(checkIfPlayersReady);
      }
    }
    waitForEnd().then(() => {
      resolve('route-ended');
      stopListeningForAllPlayers(handlePlayer);
      stopListeningForLeavingPlayers(checkIfPlayersReady);
    });
  });

  if (waitForPlayersResult === 'got-players') {
    // Highlight all the 'thumbs up' speech bubbles
    [...speechBubbles].forEach(speechBubble => speechBubble.classList.add('highlight'));
    await waitForNSeconds(1.5);
  }

  [...speechBubbles].forEach(speechBubble => speechBubble.classList.add('cleared'));
  await waitForNSeconds(0.5);

  container.remove();

  return `#apps/tunnel-vision/shoot?thing=${thingName}`;
}
