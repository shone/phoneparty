import routes from '/host/routes.mjs';

import * as audienceMode from '/host/audienceMode.mjs';
import * as messaging from '/host/messaging.mjs';

import {receiveLargeBlobOnChannel} from '/shared/utils.mjs';

document.head.insertAdjacentHTML('beforeend', `
  <link rel="stylesheet" href="/games/show-and-tell/host/show-and-tell.css">
`);

routes['#games/show-and-tell'] = async function showAndTell({waitForEnd, listenForPlayers}) {
  document.body.style.backgroundColor = '#fff';

  document.body.insertAdjacentHTML('beforeend', `
    <div class="show-and-tell">
      <img>
    </div>
  `);
  const element = document.body.lastElementChild;

  const image = element.querySelector('img');

  audienceMode.start();
  messaging.start();

  listenForPlayers(async player => {
    const channel = player.createChannelOnCurrentRoute();
    while (true) {
      const blob = await receiveLargeBlobOnChannel(channel);
      if (blob) {
        image.src = URL.createObjectURL(blob);
      }
    }
  });

  await waitForEnd();

  audienceMode.stop();
  messaging.stop();
  element.remove();
}
