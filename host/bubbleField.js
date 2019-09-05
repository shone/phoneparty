function startBubbleField() {
  const channels = [];
  acceptAllPlayers(player => {
    const channel = player.rtcConnection.createDataChannel('bubbleField');
    player.classList.add('bubble');
    player.classList.add('wiggleable');
    player.style.left = (Math.random() * 100) + 'vw';
    player.style.top  = 30 + (Math.random() * 70) + 'vh';
    document.body.appendChild(player);
    player.momentum = {x: 0, y: 0};
    player.buttonStates = {};
    channel.onmessage = event => {
      const [button, state] = event.data.split(' ');
      player.buttonStates[button] = state === 'true';
      if (button === 'ping') {
        player.classList.toggle('pinging', state === 'true');
      }
    }
    channels.push(channel);
    player.addEventListener('pointerdown', handlePlayerPointerdown);
  });
  let lastTimestamp = performance.now();
  let frameRequestId = window.requestAnimationFrame(function handleFrame(timestamp) {
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
      if (player.buttonStates['left'])  player.momentum.x -= playerMovementSpeed * delta;
      if (player.buttonStates['right']) player.momentum.x += playerMovementSpeed * delta;
      if (player.buttonStates['down'])  player.momentum.y -= playerMovementSpeed * delta;
      if (player.buttonStates['up'])    player.momentum.y += playerMovementSpeed * delta;

      player.style.left = ((parseFloat(player.style.left) || 0) + player.momentum.x) + 'vw';
      player.style.top  = ((parseFloat(player.style.top)  || 0) - player.momentum.y) + 'vh';

      // Apply friction
      const friction = 0.005;
      player.momentum.x *= Math.max(0, 1 - (delta * friction));
      player.momentum.y *= Math.max(0, 1 - (delta * friction));
    }
    lastTimestamp = timestamp;
    frameRequestId = window.requestAnimationFrame(handleFrame);
  });

  function handlePlayerPointerdown(event) {
    const player = event.target.closest('.player');
    player.setPointerCapture(event.pointerId);
    if (player.hostInteractionChannel.readyState === 'open') {
      player.hostInteractionChannel.send('drag start');
    }
    function mousemove(event) {
      player.style.left = ((event.pageX / window.innerWidth)  * 100) + 'vw';
      player.style.top  = ((event.pageY / window.innerHeight) * 100) + 'vh';
    }
    window.addEventListener('pointermove', mousemove);
    window.addEventListener('pointerup', event => {
      window.removeEventListener('pointermove', mousemove);
      if (player.hostInteractionChannel.readyState === 'open') {
        player.hostInteractionChannel.send('drag end');
      }
    });
  }

  return function stopBubbleField() {
    stopAcceptingPlayers();
    cancelAnimationFrame(frameRequestId);
    for (const player of players) {
      player.removeEventListener('pointerdown', handlePlayerPointerdown);
    }
    for (const channel of channels) {
      channel.close();
    }
  }
}
