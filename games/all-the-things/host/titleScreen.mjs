import {acceptAllPlayers} from '/host/players.mjs';
import {waitForNSeconds, waitForKeypress} from '/shared/utils.mjs';

import * as audienceMode from '/host/audienceMode.mjs';
import * as messaging from '/host/messaging.mjs';

import routes, {waitForRouteToEnd} from '/host/routes.mjs';

routes['#games/all-the-things'] = async function titleScreen() {
  document.body.style.backgroundColor = '#98947f';
  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things title-screen">
      <div class="title-image-background"></div>
      <div class="title-image"></div>
      <h1>All The Things</h1>
      <h2>the object finding game</h2>
    </div>
  `);
  const titleScreen = document.body.lastElementChild;

  audienceMode.start();
  messaging.start();

  await waitForRouteToEnd();

  titleScreen.classList.add('finished');
  setTimeout(() => { titleScreen.remove() }, 2000);
  await Promise.race([waitForNSeconds(2), waitForKeypress(' ')]);

  messaging.stop();

  if (!location.hash.startsWith('#games/all-the-things')) {
    audienceMode.stop();
  }
  return '#games/all-the-things/thing-choosing';
}
