import {acceptAllPlayers, stopAcceptingPlayers} from './players.mjs';
import * as utils from '/shared/utils.mjs';

import routes, {waitForRouteToEnd} from '/host/routes.mjs';

routes['#splash-screen'] = async function splashScreen() {
  document.body.style.backgroundColor = 'black';
  document.body.insertAdjacentHTML('beforeend', `
    <div class="phone-party-splash-screen">
      <div class="inner-container">
        <div class="phone-party-text"></div>
        <div class="white-box"></div>
        <div class="phones">
          <div class="phone"></div>
          <div class="phone"></div>
          <div class="phone"></div>
          <div class="phone"></div>
        </div>
        <div class="bubbles">
          <div class="bubble"></div>
          <div class="bubble"></div>
          <div class="bubble"></div>
          <div class="bubble"></div>
        </div>
      </div>
    </div>
  `);
  const splashScreen = document.body.lastElementChild;

  const channels = [];
  acceptAllPlayers(player => { // TODO: acceptPlayersOnCurrentRoute
    player.remove();
    channels.push(player.createChannelOnCurrentRoute());
  });

  const timeAtSplashStart = performance.now();

  await waitForRouteToEnd();

  splashScreen.classList.add('finished');
  for (const channel of channels) {
    if (channel.readyState === 'open') {
      channel.send('finished');
    }
  }

  if ((performance.now() - timeAtSplashStart) > 2000) {
    await utils.waitForNSeconds(2);
  }

  splashScreen.remove();
  stopAcceptingPlayers();
  for (const channel of channels) {
    channel.close();
  }

  return '#join-game-instructions';
};
