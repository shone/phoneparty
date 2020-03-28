import {waitForNSeconds, waitForKeypress} from '/shared/utils.mjs';

import routes, {
  currentRoute,
  waitForRouteToEnd,
  listenForPlayersOnCurrentRoute,
  listenForLeavingPlayersOnCurrentRoute,
} from '/host/routes.mjs';

import {
  players,
  listenForAllPlayers,
  stopListeningForAllPlayers,
  listenForLeavingPlayer,
  stopListeningForLeavingPlayer
} from '/host/players.mjs';

import {addSpeechBubbleToPlayer, clearAllSpeechBubbles} from '/host/messaging.mjs';
import * as audienceMode from '/host/audienceMode.mjs';

import {
  setupCurrentThingIndicator,
  currentThingIndicatorRouteEnd
} from './allTheThings.mjs';

routes['#games/all-the-things/goal'] = async function goalScreen() {

  const chosenThingElement = setupCurrentThingIndicator();

  audienceMode.start();

  document.body.style.backgroundColor = '#98947f';
  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things goal-screen">
      <h1>THE GOAL:</h1>
      <div class="goal-container">
        <span class="goal-text">
          <div class="find-a-piece-of">Find a piece of</div>
          <div class="thing-text">${chosenThingElement.dataset.name}</div>
        </span>
        <span class="all-the-things phone">
          <div class="phone-background"></div>
          <div class="phone-foreground"></div>
        </span>
      </div>
      <h2>Ready to start looking?</h2>
    </div>
  `);
  const goalScreen = document.body.lastElementChild;
  const phoneBackground = goalScreen.querySelector('.phone-background');
  const phoneBackgroundContent = document.createElement('img');
  phoneBackgroundContent.src = chosenThingElement.querySelector('img').src;
  phoneBackgroundContent.dataset.name = chosenThingElement.dataset.name;
  phoneBackgroundContent.classList.add('thing');
  phoneBackground.appendChild(phoneBackgroundContent);

  await Promise.race([waitForNSeconds(1), waitForKeypress(' ')]);
  goalScreen.querySelector('h1').classList.add('fade-in-text');

  await Promise.race([waitForNSeconds(1.2), waitForKeypress(' ')]);
  goalScreen.querySelector('.goal-text').classList.add('fade-in-text');

  await Promise.race([waitForNSeconds(0.5), waitForKeypress(' ')]);
  goalScreen.querySelector('.phone').classList.add('reveal');

  await Promise.race([waitForNSeconds(4.5), waitForKeypress(' ')]);

  clearAllSpeechBubbles();

  goalScreen.querySelector('h2').classList.add('fade-in-text');

  audienceMode.setMinPlayers(2);

  // Wait for players to be ready
  const waitForPlayersResult = await new Promise(resolve => {
    const confirmedPlayers = new Set();
    listenForPlayersOnCurrentRoute(handlePlayer);
    listenForLeavingPlayersOnCurrentRoute(checkIfPlayersReady);
    function handlePlayer(player) {
      player.createChannelOnCurrentRoute().onmessage = () => {
        confirmedPlayers.add(player);
        addSpeechBubbleToPlayer(player, '👍');
        checkIfPlayersReady();
      }
    }
    function checkIfPlayersReady() {
      // If there's at least two players and all players have confirmed
      if (players.length >= 2 && players.every(player => confirmedPlayers.has(player))) {
        resolve('got-players');
        stopListeningForAllPlayers(handlePlayer);
        stopListeningForLeavingPlayer(checkIfPlayersReady);
      }
    }
    waitForRouteToEnd().then(() => {
      resolve('route-ended');
      stopListeningForAllPlayers(handlePlayer);
      stopListeningForLeavingPlayer(checkIfPlayersReady);
    });
  });

  if (waitForPlayersResult === 'got-players') {
    // Highlight all the 'thumbs up' speech bubbles
    const speechBubbles = [...document.querySelectorAll('.player .speech-bubble:not(.cleared)')];
    for (const speechBubble of speechBubbles) {
      speechBubble.classList.add('highlight');
    }
    await waitForNSeconds(1.5);
  }

  clearAllSpeechBubbles();
  await waitForNSeconds(0.5);

  goalScreen.remove();

  currentThingIndicatorRouteEnd();

  return `#games/all-the-things/photo-taking?thing=${chosenThingElement.dataset.name}`;
}
