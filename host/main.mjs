import {splashScreen} from './splashScreen.mjs';
import {joinGameInstructions} from './joinGameInstructions.mjs';
import {players, handleNewPlayer} from './players.mjs';
import {AllTheThings} from '/games/all-the-things/host/allTheThings.mjs';

// Redirect to HTTPS
if (location.protocol !== 'https:' && location.hostname !== 'localhost' && !location.hostname.startsWith('192.168.') && location.protocol !== 'file:') {
  location.href = 'https:' + window.location.href.substring(window.location.protocol.length);
}

const connectionStatus = document.getElementById('connection-status');
const warningIndicator = document.getElementById('warning-indicator');

if (location.protocol === 'file:') {
  const message = 'Cannot open websocket because this page is loaded with the file protocol.';
  connectionStatus.className = 'error';
  connectionStatus.textContent = message;
  throw message;
}

// Open websocket and receive players
(async function() {
  connectionStatus.className = 'connecting';
  while (true) {
    const websocket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:${location.port}/host/ws`);
    websocket.onopen = () => connectionStatus.className = '';

    websocket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.type !== 'playerDisconnected' && JSON.parse(message.message).sdp) {
        handleNewPlayer(message.playerId, JSON.parse(message.message).sdp, websocket);
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

(async function() {
  await splashScreen();
  await joinGameInstructions();

  await AllTheThings();
})();

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
