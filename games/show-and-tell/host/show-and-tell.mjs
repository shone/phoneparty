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
      <iframe class="youtube-iframe" allow="autoplay">
    </div>
  `);
  const element = document.body.lastElementChild;

  const image = element.querySelector('img');
  const youtubeIframe = element.querySelector('.youtube-iframe');

  audienceMode.start();
  messaging.start();

  listenForPlayers(async player => {
    const channel = player.createChannelOnCurrentRoute('upload');
    while (channel.readyState !== 'closed') {
      const blob = await receiveLargeBlobOnChannel(channel);
      if (blob) {
        image.src = URL.createObjectURL(blob);
      }
    }
  });

  listenForPlayers(async player => {
    const channel = player.createChannelOnCurrentRoute('youtube');
    channel.onmessage = ({data}) => {
      const message = JSON.parse(data);
      switch (message.command) {
        case 'load':  youtubeIframe.src = `https://www.youtube.com/embed/${message.videoId}?enablejsapi=1&autoplay=1`; break;
        case 'close': youtubeIframe.src = ''; break;
        case 'play':  youtubeIframe.contentWindow.postMessage('{"event":"command","func":"playVideo"}', '*'); break;
        case 'pause': youtubeIframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo"}', '*'); break;
      }
    }
    channel.onclose = () => {
      youtubeIframe.src = '';
    }
  });

  await waitForEnd();

  audienceMode.stop();
  messaging.stop();
  element.remove();
}
