"use strict";

async function handleNewPlayer(playerId, sdp, websocket) {
  const player = document.createElement('div');

  player.id = idCounter.getUniqueId();

  const rtcConnection = new RTCPeerConnection();
  let hasSentSdp = false;
  const iceCandidatesToSend = [];
  rtcConnection.onicecandidate = event => {
    if (event.candidate) {
      iceCandidatesToSend.push(JSON.stringify(event.candidate.toJSON()));
      if (hasSentSdp) {
        while (iceCandidatesToSend.length) websocket.send(JSON.stringify({playerId: playerId, type: 'ice', message: iceCandidatesToSend.pop()}));
      }
    }
  }

  const video = document.createElement('video');
  player.video = video;
  video.autoplay = true;
  video.muted = true;
  rtcConnection.ontrack = event => {
    if (video.srcObject !== event.streams[0]) {
      video.srcObject = event.streams[0];
      player.appendChild(video);
    }
  }

  websocket.addEventListener('message', function callback(event) {
    const message = JSON.parse(event.data);
    if (message.playerId === playerId) {
      if (message.type === 'playerDisconnected') {
        websocket.removeEventListener('message', callback);
      } else if (message.type === 'ice') {
        rtcConnection.addIceCandidate(JSON.parse(JSON.parse(message.message).iceCandidate));
      }
    }
  });

  await rtcConnection.setRemoteDescription({type: 'offer', sdp: sdp});

  const buttonsChannel          = rtcConnection.createDataChannel('buttons',         {negotiated: true, id: 1, ordered: true});
  player.wheelChannel           = rtcConnection.createDataChannel('wheel',           {negotiated: true, id: 2, ordered: true});
  const accelerometerChannel    = rtcConnection.createDataChannel('accelerometer',   {negotiated: true, id: 3, ordered: false, maxRetransmits: 0});
  const visibilityChannel       = rtcConnection.createDataChannel('visibility',      {negotiated: true, id: 5, ordered: true});
  player.hostInteractionChannel = rtcConnection.createDataChannel('hostInteraction', {negotiated: true, id: 6, ordered: true});
  const closeChannel            = rtcConnection.createDataChannel('close',           {negotiated: true, id: 7, ordered: true});
  const modeChannel             = rtcConnection.createDataChannel('mode',            {negotiated: true, id: 8, ordered: true});
  player.currentPhaseChannel    = rtcConnection.createDataChannel('currentPhaseChannel',{negotiated: true, id: 9, ordered: true});
  player.phaseTwo               = rtcConnection.createDataChannel('phaseTwo',        {negotiated: true, id: 10, ordered: true});
  player.phaseThree             = rtcConnection.createDataChannel('phaseThree',        {negotiated: true, id: 12, ordered: true});

  const answer = await rtcConnection.createAnswer();
  rtcConnection.setLocalDescription(answer);
  websocket.send(JSON.stringify({playerId: playerId, type: 'sdp', message: answer.sdp}));
  hasSentSdp = true;
  while (iceCandidatesToSend.length) websocket.send(JSON.stringify({playerId: playerId, type: 'ice', message: iceCandidatesToSend.pop()}));

  // Wait for RTC connection to connect
  await new Promise((resolve, reject) => {
    rtcConnection.onconnectionstatechange = () => {
      if (rtcConnection.connectionState === 'connected') {
        resolve();
      } else if (rtcConnection.connectionState === 'failed') {
        reject();
      }
    }
  });

  player.classList.add('player', 'new');
  setTimeout(() => player.classList.remove('new'), 4000);
  player.style.left = (Math.random() * 100) + 'vw';
  player.style.top  = 30 + (Math.random() * 70) + 'vh';

  player.onpointerdown = event => {
    player.setMode('camera');
//     player.setPointerCapture(event.pointerId);
//     if (player.hostInteractionChannel.readyState === 'open') {
//       player.hostInteractionChannel.send('drag start');
//     }
//     function mousemove(event) {
//       player.style.left = ((event.pageX / window.innerWidth)  * 100) + 'vw';
//       player.style.top  = ((event.pageY / window.innerHeight) * 100) + 'vh';
//     }
//     window.addEventListener('pointermove', mousemove);
//     window.addEventListener('pointerup', event => {
//       window.removeEventListener('pointermove', mousemove);
//       if (player.hostInteractionChannel.readyState === 'open') {
//         player.hostInteractionChannel.send('drag end');
//       }
//     });
  }

  document.body.appendChild(player);

  const buttonStates = {};
  buttonsChannel.onmessage = event => {
    const [button, state] = event.data.split(' ');
    buttonStates[button] = state === 'true';
    if (button === 'ping') {
      player.classList.toggle('pinging', state === 'true');
    }
  }

  player.setMode = mode => {
    if (player.dataset.mode !== mode) {
      player.dataset.mode = mode;
      if (modeChannel.readyState === 'open') {
        modeChannel.send(mode);
      }
      if (mode === 'moving') {
        handleMovingMode();
      }
    }
  }
  player.setMode('moving');

  modeChannel.onopen = () => {
    if (player.dataset.mode) {
      modeChannel.send(player.dataset.mode);
    }
  }

  function handleMovingMode() {
    const momentum = {x: 0, y: 0};
    let lastTimestamp = performance.now();
    window.requestAnimationFrame(function handleFrame(timestamp) {
      if (player.dataset.mode !== 'moving' || !player.parentElement) {
        return;
      }
      const delta = timestamp - lastTimestamp;
      const playerRadius = 6;

      // Bounce back from edges of screen
      const bounceBack = 0.015;
      if (parseFloat(player.style.left) < playerRadius)       momentum.x += bounceBack * delta;
      if (parseFloat(player.style.top)  < playerRadius)       momentum.y -= bounceBack * delta;
      if (parseFloat(player.style.left) > 100 - playerRadius) momentum.x -= bounceBack * delta;
      if (parseFloat(player.style.top)  > 100 - playerRadius) momentum.y += bounceBack * delta;

      const playerMovementSpeed = 0.012;
      if (buttonStates['left'])  momentum.x -= playerMovementSpeed * delta;
      if (buttonStates['right']) momentum.x += playerMovementSpeed * delta;
      if (buttonStates['down'])  momentum.y -= playerMovementSpeed * delta;
      if (buttonStates['up'])    momentum.y += playerMovementSpeed * delta;

      if (!(player.classList.contains('not-player-moveable') || player.classList.contains('fullscreen'))) {
        player.style.left = ((parseFloat(player.style.left) || 0) + momentum.x) + 'vw';
        player.style.top  = ((parseFloat(player.style.top) || 0) - momentum.y) + 'vh';
      }

      // Apply friction
      const friction = 0.005;
      momentum.x *= Math.max(0, 1 - (delta * friction));
      momentum.y *= Math.max(0, 1 - (delta * friction));
      lastTimestamp = timestamp;
      window.requestAnimationFrame(handleFrame);
    });
  }

  accelerometerChannel.onmessage = event => {
    if (player.classList.contains('not-player-moveable')) {
      return;
    }
    const acceleration = JSON.parse(event.data);
    const wiggle = 0.5;
    player.style.transform = `translate(${(acceleration.x * wiggle) + 'vw'}, ${(acceleration.y * -wiggle) + 'vw'})`;
  }

  visibilityChannel.onmessage = event => player.dataset.visibility = event.data;

  window.onbeforeunload = () => {
    if (closeChannel.readyState === 'open') {
      closeChannel.send('true');
    }
  }

  await waitForDataChannelOpen(player.currentPhaseChannel);
  players.push(player);
  document.body.dispatchEvent(new Event('playerAdded'));

  const rtcConnectionClosed = new Promise(resolve => {
    rtcConnection.addEventListener('connectionstatechange', function callback() {
      if (rtcConnection.connectionState === 'failed' || rtcConnection.connectionState === 'closed') {
        resolve();
        rtcConnection.removeEventListener('connectionstatechange', callback);
      }
    });
  });

  const rtcCloseSignalReceived = new Promise(resolve => closeChannel.onmessage = resolve);

  await Promise.race([rtcConnectionClosed, rtcCloseSignalReceived]);

  rtcConnection.close();

  player.classList.add('leaving');
  player.dataset.visibility = '';
  setTimeout(() => player.remove(), 200);
  players.splice(players.indexOf(player), 1);
}
