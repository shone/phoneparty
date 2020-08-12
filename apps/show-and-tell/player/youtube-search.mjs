export default async function youtubeSearch(waitForEnd) {
  const container = document.createElement('div');
  container.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/common/base.css">
    <link rel="stylesheet" href="/apps/show-and-tell/player/youtube-search.css">

    <button class="back-button"></button>
    <iframe src="https://www.youtube.com/embed?listType=search&enablejsapi=1"></iframe>
    <div class="youtube-logo"></div>
    <ul class="search-results"></ul>
    <form>
      <input type="search" name="query" autocomplete="off">
      <button type="submit"></button>
    </form>
  `;

  const iframe = container.shadowRoot.querySelector('iframe');
  const waitForIframeLoad = new Promise(resolve => iframe.onload = () => resolve('iframe-loaded'));

  const form = container.shadowRoot.querySelector('form');
  const searchResultsElement = container.shadowRoot.querySelector('.search-results');

  const backButton = container.shadowRoot.querySelector('.back-button');
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
  container.shadowRoot.querySelector('input').focus();

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
