import startBubbleField from './bubbleField.mjs';
import startMessaging from './messaging.mjs';
import {waitForKeypress} from '/shared/utils.mjs';

export async function joinGameInstructions() {
  document.body.style.backgroundColor = 'black';
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
  const joinGameInstructions = document.body.lastElementChild;

  const bubbleField = startBubbleField();
  const messaging = startMessaging();

  await waitForKeypress(' ');
  joinGameInstructions.classList.add('in-corner');

  await waitForKeypress(' ');
  bubbleField.stop();
  messaging.stop();
}
