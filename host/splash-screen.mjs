import * as utils from '/common/utils.mjs';
import * as audienceMode from '/host/audienceMode.mjs';

import routes from '/host/routes.mjs';

import '/common/splash-screen.mjs';

routes['#splash-screen'] = async function splashScreen({waitForEnd, acceptAllPlayers}) {
  document.body.style.backgroundColor = 'black';

  const splashScreen = document.createElement('splash-screen');
  document.body.append(splashScreen);

  const continueButton = document.createElement('push-button');
  continueButton.id = 'continue-button';
  splashScreen.shadowRoot.append(continueButton);

  audienceMode.stop();

  const channels = [];
  acceptAllPlayers(player => {
    player.remove();
    channels.push(player.createChannelOnCurrentRoute());
  });

  const timeAtSplashStart = performance.now();

  const waitForContinueButton = new Promise(resolve => continueButton.onclick = resolve);
  await Promise.race([waitForEnd(), waitForContinueButton]);

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

  return '#games';
};
