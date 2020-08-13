import routes from '/host/routes.mjs';

import {getMessageFromChannel} from '/common/utils.mjs';

import * as audienceMode from '/host/audienceMode.mjs';
import * as messaging from '/host/messaging.mjs';

import {getBlobOnChannel} from '/common/utils.mjs';

document.head.insertAdjacentHTML('beforeend', `
  <link rel="stylesheet" href="/apps/show-and-tell/host/app-index.css">
`);

routes['#apps/show-and-tell'] = async function showAndTell({waitForEnd, listenForPlayers, createChannel}) {
  document.body.style.backgroundColor = '#fff';

  const container = document.createElement('div');
  container.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/common/base.css">
    <link rel="stylesheet" href="/apps/show-and-tell/host/show-and-tell.css">
    <button id="close-button" class="hide"></button>
  `;
  document.body.append(container);

  audienceMode.start();
  messaging.start();

  const closeButton = container.shadowRoot.getElementById('close-button');

  let subject = null;
  let subjectOwner = null;
  function setSubject(element, owner) {
    if (subject !== null) {
      subject.remove();
    }
    if (element !== null) {
      container.shadowRoot.append(element);
    }
    subject = element;
    subjectOwner = owner;
    closeButton.classList.toggle('hide', element === null);
  }

  closeButton.onclick = () => {
    setSubject(null, null);
  }

  listenForPlayers(async player => {
    const channel = createChannel(player, 'upload');
    while (channel.readyState !== 'closed') {
      const [message, error] = await getMessageFromChannel(channel);
      if (error !== null) {
        console.error(error);
        // TODO: Recreate channel or kick player
        break;
      }
      try {
        var command = JSON.parse(message);
      } catch (e) {
        console.error(e);
        // TODO: recreate channel
        break;
      }
      if (command.command === 'load') {
        if (command.type === 'upload') {
          const [blob, error] = await getBlobOnChannel(channel);
          if (error !== null) {
            console.error(error);
            // TODO: Recreate channel or kick player
            break;
          }
          const image = new Image();
          image.src = URL.createObjectURL(blob);
          setSubject(image, player);
        } else if (command.type === 'youtube') {
          const iframe = document.createElement('iframe');
          iframe.setAttribute('allow', 'autoplay');
          iframe.src = `https://www.youtube.com/embed/${command.videoId}?enablejsapi=1&autoplay=1`;
          setSubject(iframe, player);
        }
      } else if (subjectOwner === player) {
        switch (command.command) {
          case 'close': setSubject(null, null); break;
          case 'play':
            if (subject.tagName === 'IFRAME') {
              subject.contentWindow.postMessage('{"event":"command","func":"playVideo"}', '*');
            }
            break;
          case 'pause':
            if (subject.tagName === 'IFRAME') {
              subject.contentWindow.postMessage('{"event":"command","func":"pauseVideo"}', '*');
            }
            break;
        }
      }
    }
  });

  await waitForEnd();

  audienceMode.stop();
  messaging.stop();
  container.remove();
}
