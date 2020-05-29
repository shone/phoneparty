import startBubbleField from './bubbleField.mjs';
import * as messaging from './messaging.mjs';
import {waitForNSeconds, waitForKeypress} from '/shared/utils.mjs';

let instructionsElement = null;

import routes, {waitForRouteToEnd} from '/host/routes.mjs';

routes['#join-game-instructions'] = async function joinGameInstructions() {
  document.body.style.backgroundColor = 'black';
  if (instructionsElement === null) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="join-game-instructions">
        <h1>Join in!</h1>
        <h2>1. connect to the wifi</h2>
        <div class="wifi-details">
          <span class="wifi-ssid">co_up</span>
          <span class="wifi-password">clubmate</span>
        </div>
        <h2>2. go to:</h2>
        <div class="url">jam.joshshone.com</div>
      </div>
    `);
    instructionsElement = document.body.lastElementChild;
  } else {
    instructionsElement.classList.remove('in-corner');
  }

  const bubbleField = startBubbleField();
  messaging.start();

  await waitForRouteToEnd();

  instructionsElement.classList.add('in-corner');
  await waitForNSeconds(1);

  bubbleField.stop();
  messaging.stop();

  messaging.clearAllSpeechBubbles();

  return '#games/tunnel-vision';
};
