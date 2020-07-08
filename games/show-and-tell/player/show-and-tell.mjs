import routes from '/player/routes.mjs';

import {sendLargeBlobOnChannel} from '/shared/utils.mjs';

document.head.insertAdjacentHTML('beforeend', `
  <link rel="stylesheet" href="/games/show-and-tell/player/show-and-tell.css">
`);

routes['#games/show-and-tell'] = async function showAndTell({waitForEnd, listenForChannel}) {
  document.body.style.backgroundColor = '#000';

  const panelA = document.createElement('div');
  panelA.className = 'show-and-tell';
  panelA.innerHTML = `
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

  const fileInput = panelA.querySelector('input[type="file"]');
  const uploadButton = panelA.querySelector('.upload-button');
  uploadButton.onclick = () => fileInput.click();

  const youtubeButton = panelA.querySelector('.youtube-button');

  listenForChannel((channel, channelName) => {
    if (channelName === 'upload') {
      fileInput.onchange = async event => {
        const files = event.target.files;
        if (files.length === 1) {
          sendLargeBlobOnChannel(channel, files[0]);
        }
      }
    } else if (channelName === 'youtube') {
      youtubeButton.disabled = false;
      channel.onclose = () => youtubeButton.disabled = true;
      youtubeButton.onclick = async () => {
        const videoInfo = await youtubePopup(waitForEnd);
        if (videoInfo) {
          channel.send(JSON.stringify({command: 'load', videoId: videoInfo.videoId}));

          const container = panelA.querySelector('.youtube');
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
    }
  });

  document.getElementById('panel-A').append(panelA);

  await waitForEnd();

  panelA.remove();
}

async function youtubePopup(waitForEnd) {
  const container = document.createElement('div');
  container.className = 'show-and-tell youtube-popup';
  container.innerHTML = `
    <button class="back-button"></button>
    <iframe src="https://www.youtube.com/embed?listType=search&enablejsapi=1"></iframe>
    <div class="youtube-logo"></div>
    <ul class="search-results"></ul>
    <form>
      <input type="search" name="query" autocomplete="off">
      <button type="submit"></button>
    </form>
  `;

  const iframe = container.querySelector('iframe');
  const waitForIframeLoad = new Promise(resolve => iframe.onload = () => resolve('iframe-loaded'));

  const form = container.querySelector('form');
  const searchResultsElement = container.querySelector('.search-results');

  const backButton = container.querySelector('.back-button');
  const waitForBackButtonClick = new Promise(resolve => backButton.onclick = () => resolve('back-button'));

  let fetchAbortController = null;
  waitForEnd().then(() => {
    if (fetchAbortController) {
      fetchAbortController.abort();
      fetchAbortController = null;
    }
  });

  form.onsubmit = async event => {
    event.preventDefault();

    if (form.elements['query'].value.trim() === '') {
      return;
    }

    if (fetchAbortController) {
      fetchAbortController.abort();
      fetchAbortController = null;
    }

    form.elements['query'].disabled = true;
    form.querySelector('button[type="submit"]').disabled = true;

    const query = encodeURIComponent(form.elements['query'].value.trim());
    container.classList.add('has-query');

    searchResultsElement.innerHTML = '';
    searchResultsElement.classList.add('loading');
    searchResultsElement.classList.remove('no-results');

    const result = await Promise.race([waitForIframeLoad, waitForBackButtonClick, waitForEnd()]);
    if (result !== 'iframe-loaded') {
      return;
    }

    iframe.contentWindow.postMessage('{"event": "listening", "id": 0 }', 'https://www.youtube.com');

    iframe.contentWindow.postMessage(JSON.stringify({
      event: 'command',
      func: 'loadPlaylist',
      args: [{
        listType: 'search',
        list: form.elements['query'].value.trim(),
      }]
    }), 'https://www.youtube.com');

    const playlist = await new Promise(resolve => {
      function onMessage(event) {
        if (event.source === iframe.contentWindow) {
          const messageObject = JSON.parse(event.data);
          if (messageObject.event === 'infoDelivery' && messageObject.info.playlist.length > 0) {
            window.removeEventListener('message', onMessage);
            resolve(messageObject.info.playlist);
          }
        }
      }
      window.addEventListener('message', onMessage);

      function cancel() {
        window.removeEventListener('message', onMessage);
        resolve(null);
      }

      setTimeout(cancel, 3000);
      waitForBackButtonClick.then(cancel);
      waitForEnd().then(cancel);
    });

    searchResultsElement.classList.remove('loading');

    form.elements['query'].disabled = false;
    form.querySelector('button[type="submit"]').disabled = false;

    if (playlist === null || playlist.length === 0) {
      searchResultsElement.innerHTML = '';
      searchResultsElement.classList.add('no-results');
      return;
    }

    searchResultsElement.innerHTML = '<li class="loading"> <img> <span></span> </li>'.repeat(playlist.length);
    [...searchResultsElement.children].forEach((li, index) => {
      li.dataset.videoId = playlist[index];
      li.querySelector('img').src = `https://img.youtube.com/vi/${playlist[index]}/default.jpg`;
    });

    const fetchParams = {};

    if (AbortController) {
      fetchAbortController = new AbortController();
      fetchParams.signal = fetchAbortController.signal;
    }

    playlist.forEach(async (videoId, index) => {
      const li = searchResultsElement.children[index];
      const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`, fetchParams);
      const json = await response.json();
      li.dataset.videoTitle = json.title;
      li.querySelector('span').textContent = json.title;
      li.classList.remove('loading');
    });
  }

  document.body.append(container);
  container.querySelector('input').focus();

  const result = await new Promise(resolve => {
    searchResultsElement.onclick = ({target}) => {
      const li = target.closest('li');
      if (li && !li.classList.contains('loading')) {
        resolve({videoId: li.dataset.videoId, title: li.dataset.videoTitle});
      }
    }
    waitForBackButtonClick.then(() => resolve(null));
    waitForEnd().then(() => resolve(null));
  });

  container.remove();
  if (fetchAbortController) {
    fetchAbortController.abort();
    fetchAbortController = null;
  }

  return result;
}
