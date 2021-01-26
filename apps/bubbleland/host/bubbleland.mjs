import routes from '/host/routes.mjs';
import {players} from '/host/players.mjs';

import startMessaging from '/host/messaging.mjs';

import PlayerBubble from '/host/player-bubble.mjs';

document.head.insertAdjacentHTML('beforeend', `
  <link rel="stylesheet" href="/apps/bubbleland/host/app-index.css">
`);

routes['#apps/bubbleland'] = async function bubbleland({waitForEnd, createChannel, acceptAllPlayers, listenForLeavingPlayers}) {
  document.body.style.backgroundColor = 'purple';

  const container = document.createElement('div');
  container.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/common/base.css">
    <link rel="stylesheet" href="/apps/bubbleland/host/bubbleland.css">
    <link rel="stylesheet" href="/host/speech-bubble.css">
    <link rel="stylesheet" href="/host/player-bubble.css">
  `;
  document.body.append(container);

  const playerMap = new Map();

  acceptAllPlayers(player => {
    const playerBubble = new PlayerBubble(player);
    container.shadowRoot.append(playerBubble);

//     player.classList.add('bubble', 'wiggleable');

    playerMap.set(player, {
      bubble: playerBubble,
      position: {x: Math.random() * 100, y: 30 + (Math.random() * 70)},
      momentum: {x: 0, y: 0},
      joystick: {x: 0, y: 0},
      isDragging: false,
    });

    createChannel(player, 'joystick').onmessage = ({data}) => {
      playerMap.get(player).joystick = JSON.parse(data);
    }

    startMessaging(createChannel(player, 'messaging'), playerBubble);

    playerBubble.addEventListener('pointerdown', onPlayerPointerdown);
  });

  listenForLeavingPlayers(player => {
    const mappedPlayer = playerMap.get(player);
    if (mappedPlayer) {
      mappedPlayer.bubble.remove();
      playerMap.delete(player);
    }
  });

  let lastTimestamp = performance.now();
  let frameRequestId = window.requestAnimationFrame(function onFrame(timestamp) {
    const delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    const playerRadius = 3;
    for (const player of playerMap.values()) {

      // Bounce back from edges of screen
      const bounceBack = 0.015;
      if (player.position.x < playerRadius)       player.momentum.x += bounceBack * delta;
      if (player.position.y < playerRadius)       player.momentum.y += bounceBack * delta;
      if (player.position.x > 100 - playerRadius) player.momentum.x -= bounceBack * delta;
      if (player.position.y > 100 - playerRadius) player.momentum.y -= bounceBack * delta;

      const playerMovementSpeed = 0.012;
      player.momentum.x += player.joystick.x * playerMovementSpeed * delta;
      player.momentum.y += player.joystick.y * playerMovementSpeed * delta;

      player.position.x += player.momentum.x;
      player.position.y += player.momentum.y;

      player.bubble.style.left = `${player.position.x}vw`;
      player.bubble.style.top  = `${100 - player.position.y}vh`;

      const friction = 0.005;
      player.momentum.x *= Math.max(0, 1 - (delta * friction));
      player.momentum.y *= Math.max(0, 1 - (delta * friction));
    }
    frameRequestId = window.requestAnimationFrame(onFrame);
  });

  function onPlayerPointerdown(event) {
    event.preventDefault();

    if (event.button && event.button > 0) {
      return;
    }

    const playerBubble = event.target.closest('player-bubble');
    const mappedPlayer = playerMap.get(playerBubble.player);

    if (mappedPlayer.isDragging) {
      return;
    }
    mappedPlayer.isDragging = true;
    playerBubble.style.cursor = 'grabbing';

    const pointerId = event.pointerId;
    playerBubble.setPointerCapture(pointerId);

    const boundingBox = playerBubble.getBoundingClientRect();
    const offset = {
      x: event.clientX - (boundingBox.x + (boundingBox.width / 2)),
      y: event.clientY - (boundingBox.y + (boundingBox.height / 2)),
    };

    function onPointerMove(event) {
      if (event.pointerId !== pointerId) return;
      mappedPlayer.position = {
        x: ((event.clientX - offset.x) / window.innerWidth) * 100,
        y: (1 - ((event.clientY - offset.y) / window.innerHeight)) * 100,
      }
      mappedPlayer.momentum = {x: 0, y: 0};
    }
    function onPointerEnd(event) {
      if (event.pointerId !== pointerId) return;
      playerBubble.releasePointerCapture(pointerId);
      mappedPlayer.isDragging = false;
      playerBubble.style.cursor = null;
      playerBubble.removeEventListener('pointermove', onPointerMove);
      playerBubble.removeEventListener('pointerup', onPointerEnd);
      playerBubble.removeEventListener('pointercancel', onPointerEnd);
    }
    playerBubble.addEventListener('pointermove', onPointerMove);
    playerBubble.addEventListener('pointerup', onPointerEnd);
    playerBubble.addEventListener('pointercancel', onPointerEnd);
  }

  await waitForEnd();

  cancelAnimationFrame(frameRequestId);

  container.remove();
}
