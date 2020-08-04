const connectionStatus = document.getElementById('connection-status');
const warningIndicator = document.getElementById('warning-indicator');

if (location.protocol === 'file:') {
  const message = 'Cannot open websocket because this page is loaded with the file protocol.';
  connectionStatus.className = 'error';
  connectionStatus.textContent = message;
  throw message;
}

import {players, handleNewPlayer} from './players.mjs';

import './splash-screen.mjs';
import '/apps/index.mjs';
import './test.mjs';

import {startRouting} from './routes.mjs';
startRouting({defaultRoute: '#splash-screen'});

setupMenu();

// Open websocket and receive players
(async function() {
  connectionStatus.className = 'connecting';
  while (true) {
    const websocket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:${location.port}/host/ws`);
    websocket.onopen = () => connectionStatus.className = '';

    websocket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.sdp) {
        handleNewPlayer(message.playerId, message.sdp, websocket);
      }
    }

    // If the websocket disconnects, continue the loop and try to connect again
    await new Promise(resolve => websocket.onclose = resolve);
    warningIndicator.textContent = 'Websocket disconnected, reconnecting in 5 seconds';
    await new Promise(resolve => setTimeout(() => resolve(), 5000));
    warningIndicator.textContent = 'Websocket reconnecting..';
    await new Promise(resolve => setTimeout(() => resolve(), 1000));
    warningIndicator.textContent = '';
  }
})();

function setupMenu() {
  const menu = document.getElementById('menu');
  menu.querySelector('.toggle').onclick = () => {
    menu.classList.toggle('visible');
  }

  setupFullscreenButton();

  menu.querySelector('.player').onclick = () => {
    location.pathname = 'player';
  }

  menu.querySelector('.apps').onclick = () => {
    location.hash = 'apps';
    menu.classList.remove('visible');
  }

  let installButton = null;
  window.onbeforeinstallprompt = event => {
    event.preventDefault();
    if (!installButton) {
      installButton = document.createElement('push-button');
      installButton.textContent = 'Install';
      menu.querySelector('.items').append(installButton);
    }
    installButton.onclick = () => {
      event.prompt();
    }
    event.userChoice.then(result => {
      if (result.outcome === 'accepted') {
        installButton.remove();
      }
    });
  }
}

function setupFullscreenButton() {
  // - Only show the fullscreen button if the fullscreen API is available.
  // - If the app was started in fullscreen mode, assume that it's running as an installed PWA and therefore doesn't
  // need a fullscreen button.
  if (!document.documentElement.requestFullscreen || window.matchMedia('(display-mode: fullscreen)').matches) {
    return;
  }

  const fullscreenButton = document.querySelector('#menu .fullscreen');

  const clickSound = new Audio('/sounds/click.wav');
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen({navigationUI: "hide"});
    } else {
      document.exitFullscreen();
    }
    clickSound.play();
  }
  fullscreenButton.onclick = () => {
    toggleFullscreen();
    document.getElementById('menu').classList.remove('visible');
  }

  fullscreenButton.classList.remove('unimplemented');
}

window.onbeforeunload = () => {
  for (const player of players) {
    if (player.closeChannel.readyState === 'open') {
      player.closeChannel.send('true');
    }
  }
}

export let paused = false;
window.addEventListener('keydown', event => {
  if (event.key === 'p') {
    paused = !paused;
    document.getElementById('pause-indicator').classList.toggle('activated', paused);
  }
});
