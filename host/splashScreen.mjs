import {acceptAllPlayers, stopAcceptingPlayers} from './players.mjs';
import * as utils from '/shared/utils.mjs';

export async function splashScreen() {
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
  acceptAllPlayers(player => {
    channels.push(player.rtcConnection.createDataChannel('splash-screen'));
  });

  const timeAtSplashStart = performance.now();

  await utils.waitForKeypress(' ');
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
}
