"use strict";

const listenPlayersCallbacks = [];

let acceptPlayersCallback = null;
function acceptAllPlayers(callback) {
  listenForAllPlayers(callback);
  acceptPlayersCallback = callback;
}
function stopAcceptingPlayers() {
  stopListeningForAllPlayers(acceptPlayersCallback);
  acceptPlayersCallback = null;
}

function listenForAllPlayers(callback) {
  for (const player of players) {
    callback(player);
  }
  listenPlayersCallbacks.push(callback);
}
function stopListeningForAllPlayers(callback) {
  const index = listenPlayersCallbacks.indexOf(callback);
  if (index !== -1) {
    listenPlayersCallbacks.splice(index, 1);
  }
}

const newPlayerSound  = new Audio('/sounds/new_player.mp3');
const playerLeftSound = new Audio('/sounds/player_left.mp3');

const leavingPlayerCallbacks = new Set();
function listenForLeavingPlayer(callback) {
  leavingPlayerCallbacks.add(callback);
}
function stopListeningForLeavingPlayer(callback) {
  leavingPlayerCallbacks.delete(callback);
}

async function handleNewPlayer(playerId, sdp, websocket) {
  const player = document.createElement('div');

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

  const accelerometerChannel    = rtcConnection.createDataChannel('accelerometer',   {negotiated: true, id: 3, ordered: false, maxRetransmits: 0});
  const visibilityChannel       = rtcConnection.createDataChannel('visibility',      {negotiated: true, id: 5, ordered: true});
  player.hostInteractionChannel = rtcConnection.createDataChannel('hostInteraction', {negotiated: true, id: 6, ordered: true});
  player.closeChannel           = rtcConnection.createDataChannel('close',           {negotiated: true, id: 7, ordered: true});

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

  player.rtcConnection = rtcConnection;

  player.classList.add('player', 'new');
  setTimeout(() => player.classList.remove('new'), 4000);

  accelerometerChannel.onmessage = event => {
    if (player.classList.contains('wiggleable')) {
      const acceleration = JSON.parse(event.data);
      const wiggle = 0.5;
      player.style.transform = `translate(${(acceleration.x * wiggle) + 'vw'}, ${(acceleration.y * -wiggle) + 'vw'})`;
    }
  }

  visibilityChannel.onmessage = event => player.dataset.visibility = event.data;

  players.push(player);
  for (const callback of listenPlayersCallbacks) {
    callback(player);
  }
  document.body.dispatchEvent(new Event('playerAdded'));

  newPlayerSound.play();

  const rtcConnectionClosed = new Promise(resolve => {
    rtcConnection.addEventListener('connectionstatechange', function callback() {
      if (rtcConnection.connectionState === 'failed' || rtcConnection.connectionState === 'closed') {
        resolve();
        rtcConnection.removeEventListener('connectionstatechange', callback);
      }
    });
  });

  const rtcCloseSignalReceived = new Promise(resolve => player.closeChannel.onmessage = resolve);

  await Promise.race([rtcConnectionClosed, rtcCloseSignalReceived]);

  rtcConnection.close();

  playerLeftSound.play();

  player.classList.add('leaving');
  player.dataset.visibility = '';
  setTimeout(() => player.remove(), 200);
  players.splice(players.indexOf(player), 1);

  for (const callback of leavingPlayerCallbacks) {
    callback(player);
  }
}
