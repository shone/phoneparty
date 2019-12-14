export const players = [];

let acceptAllPlayersCallback = null;
let nowAcceptingPlayersCallbacks = new Set();
export function acceptAllPlayers(callback) {
  for (const callback of nowAcceptingPlayersCallbacks) {
    callback();
  }
  listenForAllPlayers(callback);
  acceptAllPlayersCallback = callback;
}
export function stopAcceptingPlayers() {
  stopListeningForAllPlayers(acceptAllPlayersCallback);
  acceptAllPlayersCallback = null;
}

const listenForNewPlayersCallbacks = [];
export function listenForNewPlayers(callback) {
  listenForNewPlayersCallbacks.push(callback);
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
  listenForAllPlayersCallbacks.push(callback);
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

  accelerometerChannel.onmessage = event => {
    if (player.classList.contains('wiggleable')) {
      const acceleration = JSON.parse(event.data);
      const wiggle = 0.5;
      player.style.transform = `translate(${(acceleration.x * wiggle) + 'vw'}, ${(acceleration.y * -wiggle) + 'vw'})`;
    }
  }

  visibilityChannel.onmessage = event => player.dataset.visibility = event.data;

  if (!acceptAllPlayersCallback) {
    await new Promise(resolve => {
      nowAcceptingPlayersCallbacks.add(function callback() {
        resolve();
        nowAcceptingPlayersCallbacks.delete(callback);
      });
    });
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

  const rtcConnectionClosed = new Promise(resolve => {
    rtcConnection.addEventListener('connectionstatechange', function callback() {
      if (rtcConnection.connectionState === 'failed' || rtcConnection.connectionState === 'closed') {
        resolve();
        rtcConnection.removeEventListener('connectionstatechange', callback);
      }
    });
  });

  const rtcCloseSignalReceived = new Promise(resolve => player.closeChannel.onmessage = resolve);

  const waitForPlayerKicked = new Promise(resolve => {
    player.addEventListener('contextmenu', event => {
      resolve();
      event.preventDefault();
    }, {once: true});
  });

  await Promise.race([rtcConnectionClosed, rtcCloseSignalReceived, waitForPlayerKicked]);

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
