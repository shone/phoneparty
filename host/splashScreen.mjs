import {acceptAllPlayers, stopAcceptingPlayers} from './players.mjs';
import * as utils from '/shared/utils.mjs';
import * as audienceMode from '/host/audienceMode.mjs';

import routes from '/host/routes.mjs';

import '/shared/splashScreen.mjs';

routes['#splash-screen'] = async function splashScreen({waitForEnd}) {
  document.body.style.backgroundColor = 'black';

  const splashScreen = document.createElement('splash-screen');
  document.body.append(splashScreen);

  audienceMode.stop();

  const channels = [];
  acceptAllPlayers(player => { // TODO: acceptPlayersOnCurrentRoute
    player.remove();
    channels.push(player.createChannelOnCurrentRoute());
  });

  const timeAtSplashStart = performance.now();

  await Promise.race([waitForEnd(), utils.waitForKeypress(' ')]);

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
