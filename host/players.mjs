import {
  currentRoute,
  currentRouteCounter,
  listenForPlayersOnCurrentRoute,
  listenForLeavingPlayersOnCurrentRoute
} from './routes.mjs';

import {waitForRtcClose} from '/shared/utils.mjs';

export const players = [];

const playersWaitingToBeAccepted = [];

let acceptedPlayerHandler = null;
export function acceptAllPlayers(handler = () => {}) {
  while (playersWaitingToBeAccepted.length > 0) {
    const callback = playersWaitingToBeAccepted.pop();
    callback();
  }
  listenForAllPlayers(handler);
  acceptedPlayerHandler = handler;
}
export function stopAcceptingPlayers() {
  stopListeningForAllPlayers(acceptedPlayerHandler);
  acceptedPlayerHandler = null;
}

const listenForNewPlayersCallbacks = [];
export function listenForNewPlayers(callback) {
  if (!listenForNewPlayersCallbacks.includes(callback)) {
    listenForNewPlayersCallbacks.push(callback);
  }
}
export function stopListeningForNewPlayers(callback) {
  const index = listenForNewPlayersCallbacks.indexOf(callback);
  if (index !== -1) {
    listenForNewPlayersCallbacks.splice(index, 1);
  }
}

const listenForAllPlayersCallbacks = [];
export function listenForAllPlayers(callback) {
  for (const player of players) {
    callback(player);
  }
  if (!listenForAllPlayersCallbacks.includes(callback)) {
    listenForAllPlayersCallbacks.push(callback);
  }
}
export function stopListeningForAllPlayers(callback) {
  const index = listenForAllPlayersCallbacks.indexOf(callback);
  if (index !== -1) {
    listenForAllPlayersCallbacks.splice(index, 1);
  }
}

const leavingPlayerCallbacks = new Set();
export function listenForLeavingPlayer(callback) {
  leavingPlayerCallbacks.add(callback);
}
export function stopListeningForLeavingPlayer(callback) {
  leavingPlayerCallbacks.delete(callback);
}

export async function waitForPlayerToLeave(player) {
  if (players.indexOf(player) === -1) {
    return 'player_left';
  } else {
    return new Promise(resolve => {
      listenForLeavingPlayer(function handlePlayerLeaving(p) {
        if (p === player) {
          resolve('player_left');
          stopListeningForLeavingPlayer(handlePlayerLeaving);
        }
      });
    });
  }
}

export function openChannelsOnAllPlayersForCurrentRoute() {
  const playerChannels = new Map();
  listenForPlayersOnCurrentRoute(player => {
    playerChannels.set(player, player.createChannelOnCurrentRoute());
  });
  listenForLeavingPlayersOnCurrentRoute(player => {
    playerChannels.delete(player);
  });
  return playerChannels;
}

const newPlayerSound  = new Audio('/sounds/new_player.mp3');
const playerLeftSound = new Audio('/sounds/player_left.mp3');

export async function handleNewPlayer(playerId, sdp, websocket) {
  const player = document.createElement('div');

  const rtcConnection = new RTCPeerConnection();
  let hasSentSdp = false;
  const iceCandidatesToSend = [];
  rtcConnection.onicecandidate = event => {
    if (event.candidate) {
      iceCandidatesToSend.push(JSON.stringify(event.candidate.toJSON()));
      if (hasSentSdp) {
        while (iceCandidatesToSend.length) websocket.send(JSON.stringify({playerId: playerId, iceCandidate: iceCandidatesToSend.pop()}));
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
      if (message.connectionState === 'disconnected') {
        websocket.removeEventListener('message', callback);
      } else if (message.iceCandidate) {
        rtcConnection.addIceCandidate(JSON.parse(message.iceCandidate));
      }
    }
  });

  await rtcConnection.setRemoteDescription({type: 'offer', sdp: sdp});

  const accelerometerChannel    = rtcConnection.createDataChannel('accelerometer',   {negotiated: true, id: 3, ordered: false, maxRetransmits: 0});
  const visibilityChannel       = rtcConnection.createDataChannel('visibility',      {negotiated: true, id: 5, ordered: true});
  player.hostInteractionChannel = rtcConnection.createDataChannel('hostInteraction', {negotiated: true, id: 6, ordered: true});
  player.closeChannel           = rtcConnection.createDataChannel('close',           {negotiated: true, id: 7, ordered: true});
  const acceptPlayerChannel     = rtcConnection.createDataChannel('acceptPlayer',    {negotiated: true, id: 8, ordered: true});
  player.routeChannel           = rtcConnection.createDataChannel('route',           {negotiated: true, id: 9, ordered: true});

  const answer = await rtcConnection.createAnswer();
  rtcConnection.setLocalDescription(answer);
  websocket.send(JSON.stringify({playerId: playerId, sdp: answer.sdp}));
  hasSentSdp = true;
  while (iceCandidatesToSend.length) websocket.send(JSON.stringify({playerId: playerId, iceCandidate: iceCandidatesToSend.pop()}));

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

  player.wigglePosition = {x: 0, y: 0};
//   player.acceleration   = {x: 0, y: 0};
  player.wiggleMomentum = {x: 0, y: 0};
  accelerometerChannel.onmessage = event => {
    if (player.classList.contains('wiggleable')) {
      const acceleration = JSON.parse(event.data);
      player.wiggleMomentum.x += acceleration.x;
      player.wiggleMomentum.y -= acceleration.y;
//       const wiggle = 0.5;
//       player.wiggleMomentum.x += acceleration.x;
//       player.wiggleMomentum.y += acceleration.y;
    }
  }
  accelerometerChannel.onopen = () => {
    let timeOnLastWiggleUpdate = performance.now();
    const wiggliness = 0.002;
    const antiWiggliness = 0.02;
    window.requestAnimationFrame(function callback(timestamp) {
      if (player.classList.contains('wiggleable')) {
        const delta = timestamp - timeOnLastWiggleUpdate;
        player.wigglePosition.x += player.wiggleMomentum.x * delta * wiggliness;
        player.wigglePosition.y += player.wiggleMomentum.y * delta * wiggliness;

        player.wiggleMomentum.x -= player.wigglePosition.x * delta * antiWiggliness * 2;
        player.wiggleMomentum.y -= player.wigglePosition.y * delta * antiWiggliness * 2;

        player.wiggleMomentum.x *= Math.max(0, 1 - (delta * antiWiggliness));
        player.wiggleMomentum.y *= Math.max(0, 1 - (delta * antiWiggliness));

        player.style.transform = `translate(${(player.wigglePosition.x) + 'vw'}, ${(player.wigglePosition.y) + 'vw'})`;
        timeOnLastWiggleUpdate = timestamp;
      }
      if (accelerometerChannel.readyState === 'open') {
        window.requestAnimationFrame(callback);
      }
    });
  }

  visibilityChannel.onmessage = event => player.dataset.visibility = event.data;

  player.createChannelOnCurrentRoute = name => {
    let channelLabel = currentRoute + '@' + currentRouteCounter;
    if (name) {
      channelLabel += '%' + name;
    }
    return rtcConnection.createDataChannel(channelLabel);
  }

  if (!acceptedPlayerHandler) {
    const waitToBeAccepted = new Promise(resolve => playersWaitingToBeAccepted.push(() => resolve('accepted')));
    const waitResult = Promise.race([waitToBeAccepted, waitForRtcClose(rtcConnection)]);
    if (waitResult === 'rtc-closed') {
      players.splice(players.indexOf(player), 1);
      return;
    }
  }
  if (acceptPlayerChannel.readyState === 'open') {
    acceptPlayerChannel.send(true);
  } else {
    acceptPlayerChannel.onopen = () => {
      acceptPlayerChannel.send(true);
    }
  }

  player.classList.add('player', 'new');
  setTimeout(() => player.classList.remove('new'), 500);

  players.push(player);

  for (const callback of listenForAllPlayersCallbacks) {
    callback(player);
  }
  for (const callback of listenForNewPlayersCallbacks) {
    callback(player);
  }

  newPlayerSound.play().catch(() => {});

  const waitForCloseChannel = new Promise(resolve => player.closeChannel.onmessage = resolve);

  const waitForPlayerKicked = new Promise(resolve => {
    player.addEventListener('contextmenu', event => {
      resolve();
      event.preventDefault();
    }, {once: true});
  });

  await Promise.race([waitForRtcClose(rtcConnection), waitForCloseChannel, waitForPlayerKicked]);

  player.closeChannel.send('true');
  rtcConnection.close();

  playerLeftSound.play().catch(() => {});

  player.classList.remove('new');
  player.classList.add('leaving');
  player.dataset.visibility = '';
  setTimeout(() => player.remove(), 200);
  players.splice(players.indexOf(player), 1);

  for (const callback of leavingPlayerCallbacks) {
    callback(player);
  }
}
