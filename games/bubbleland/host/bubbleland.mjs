import routes from '/host/routes.mjs';
import {players} from '/host/players.mjs';

import * as messaging from '/host/messaging.mjs';
import * as audienceMode from '/host/audienceMode.mjs';

document.head.insertAdjacentHTML('beforeend', `
  <link rel="stylesheet" href="/games/bubbleland/host/bubbleland.css">
`);

routes['#games/bubbleland'] = async function bubbleland({waitForEnd, createChannel, acceptAllPlayers}) {
  document.body.style.backgroundColor = 'purple';

  audienceMode.stop(); // TODO: wait for audience mode to stop

  messaging.start();

  acceptAllPlayers(player => {
    player.classList.add('bubble', 'wiggleable');

    player.style.left = `${Math.random() * 100}vw`;
    player.style.top  = `${30 + (Math.random() * 70)}vh`;

    player.momentum = {x: 0, y: 0};

    document.body.appendChild(player);

    player.buttonStates = {};
    createChannel(player).onmessage = event => {
      const [button, state] = event.data.split(' ');
      player.buttonStates[button] = state === 'true';
    }

    player.addEventListener('pointerdown', onPlayerPointerdown);
  });

  let lastTimestamp = performance.now();
  let frameRequestId = window.requestAnimationFrame(function onFrame(timestamp) {
    const delta = timestamp - lastTimestamp;
    const playerRadius = 6;
    for (const player of players) {

      // Bounce back from edges of screen
      const bounceBack = 0.015;
      if (parseFloat(player.style.left) < playerRadius)       player.momentum.x += bounceBack * delta;
      if (parseFloat(player.style.top)  < playerRadius)       player.momentum.y -= bounceBack * delta;
      if (parseFloat(player.style.left) > 100 - playerRadius) player.momentum.x -= bounceBack * delta;
      if (parseFloat(player.style.top)  > 100 - playerRadius) player.momentum.y += bounceBack * delta;

      const playerMovementSpeed = 0.012;
      if (player.buttonStates.left)  player.momentum.x -= playerMovementSpeed * delta;
      if (player.buttonStates.right) player.momentum.x += playerMovementSpeed * delta;
      if (player.buttonStates.down)  player.momentum.y -= playerMovementSpeed * delta;
      if (player.buttonStates.up)    player.momentum.y += playerMovementSpeed * delta;

      player.style.left = `${(parseFloat(player.style.left) || 0) + player.momentum.x}vw`;
      player.style.top  = `${(parseFloat(player.style.top)  || 0) - player.momentum.y}vh`;

      // Apply friction
      const friction = 0.005;
      player.momentum.x *= Math.max(0, 1 - (delta * friction));
      player.momentum.y *= Math.max(0, 1 - (delta * friction));
    }
    lastTimestamp = timestamp;
    frameRequestId = window.requestAnimationFrame(onFrame);
  });

  function onPlayerPointerdown(event) {
    event.preventDefault();
    const player = event.target.closest('.player');
    const pointerId = event.pointerId;
    player.setPointerCapture(pointerId);
    if (player.hostInteractionChannel.readyState === 'open') {
      player.hostInteractionChannel.send('drag start');
    }
    function onPointerMove(event) {
      if (event.pointerId !== pointerId) return;
      player.style.left = ((event.pageX / window.innerWidth)  * 100) + 'vw';
      player.style.top  = ((event.pageY / window.innerHeight) * 100) + 'vh';
    }
    function onPointerEnd(event) {
      if (event.pointerId !== pointerId) return;
      player.removeEventListener('pointermove', onPointerMove);
      player.removeEventListener('pointerup', onPointerEnd);
      player.removeEventListener('pointercancel', onPointerEnd);
      if (player.hostInteractionChannel.readyState === 'open') {
        player.hostInteractionChannel.send('drag end');
      }
    }
    player.addEventListener('pointermove', onPointerMove);
    player.addEventListener('pointerup', onPointerEnd);
    player.addEventListener('pointercancel', onPointerEnd);
  }

  await waitForEnd();

  messaging.stop();

  cancelAnimationFrame(frameRequestId);

  for (const player of players) {
    player.remove();
    player.removeEventListener('pointerdown', onPlayerPointerdown);
    // TODO: Remove pointermove/pointerup/pointerend handlers
  }
}
