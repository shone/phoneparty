import routes from '/player/routes.mjs';

import '/common/push-button.mjs';

import youtubeSearch from './youtube-search.mjs';
import {sendBlobOnChannel} from '/common/utils.mjs';

routes['#apps/show-and-tell'] = async function showAndTell({waitForEnd, listenForChannel}) {
  document.body.style.backgroundColor = '#000';

  const panelA = document.createElement('div');
  panelA.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/common/base.css">
    <link rel="stylesheet" href="/common/push-button.css">
    <link rel="stylesheet" href="/apps/show-and-tell/player/panel-a.css">

    <div class="youtube">
      <img>
      <label></label>
      <button class="play-button"></button>
      <button class="pause-button"></button>
      <button class="close-button"></button>
    </div>

    <div class="sources">
      <push-button class="upload-button">Upload</push-button> <input type="file" accept="image/*">
      <button class="youtube-button" disabled></button>
    </div>
  `;

  listenForChannel(channel => {
    const uploadButton = panelA.shadowRoot.querySelector('.upload-button');
    const fileInput = panelA.shadowRoot.querySelector('input[type="file"]');
    uploadButton.onclick = () => fileInput.click();
    fileInput.onchange = async event => {
      const files = event.target.files;
      if (files.length === 1) {
        channel.send(JSON.stringify({command: 'load', type: 'upload'}));
        const error = await sendBlobOnChannel(channel, files[0]);
        if (error !== null) {
          console.log(error);
          // TODO: recreate channel
        }
        fileInput.value = '';
      }
    }

    const youtubeButton = panelA.shadowRoot.querySelector('.youtube-button');
    youtubeButton.disabled = false;
    channel.onclose = () => youtubeButton.disabled = true;
    youtubeButton.onclick = async () => {
      const videoInfo = await youtubeSearch(waitForEnd);
      if (videoInfo) {
        channel.send(JSON.stringify({command: 'load', type: 'youtube', videoId: videoInfo.videoId}));

        const container = panelA.shadowRoot.querySelector('.youtube');
        container.classList.add('visible');

        container.querySelector('img').src = `https://img.youtube.com/vi/${videoInfo.videoId}/default.jpg`;
        container.querySelector('label').textContent = videoInfo.title;

        container.querySelector('.play-button').onclick  = () => channel.send('{"command": "play"}');
        container.querySelector('.pause-button').onclick = () => channel.send('{"command": "pause"}');
        container.querySelector('.close-button').onclick = () => {
          channel.send('{"command": "close"}');
          container.classList.remove('visible');
        }
      }
    }
  });

  document.getElementById('panel-A').append(panelA);

  await waitForEnd();

  panelA.remove();
}
