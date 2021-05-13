import {
  negotiateRtcConnection,
  waitForRtcClose,
  setupKeepaliveChannel
} from '/common/rtc.mjs';

export const players = [];

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
export function listenForLeavingPlayers(callback) {
  leavingPlayerCallbacks.add(callback);
}
export function stopListeningForLeavingPlayers(callback) {
  leavingPlayerCallbacks.delete(callback);
}

export async function waitForPlayerToLeave(player) {
  if (players.indexOf(player) === -1) {
    return 'player_left';
  } else {
    return new Promise(resolve => {
      listenForLeavingPlayers(function handlePlayerLeaving(p) {
        if (p === player) {
          resolve('player_left');
          stopListeningForLeavingPlayers(handlePlayerLeaving);
        }
      });
    });
  }
}

const newPlayerSound  = new Audio('/sounds/new_player.mp3');
const playerLeftSound = new Audio('/sounds/player_left.mp3');

export async function handleNewPlayer(playerId, rtcSessionDescription, signalling) {

  const rtcConnection = new RTCPeerConnection();

  const keepaliveChannel = rtcConnection.createDataChannel('keepalive', {negotiated: true, id: 7, ordered: false});
  const waitForKeepaliveEnd = setupKeepaliveChannel(keepaliveChannel);

  const visibilityChannel = rtcConnection.createDataChannel('visibility', {negotiated: true, id: 5, ordered: true});

  const avatarChannel = rtcConnection.createDataChannel('avatar', {negotiated: true, id: 10, ordered: true});

  const routeChannel = rtcConnection.createDataChannel('route', {negotiated: true, id: 9, ordered: true});

  await negotiateRtcConnection(rtcConnection, signalling, rtcSessionDescription);

  const player = {
    playerId,
    rtcConnection,
    routeChannel,
  };

  let avatarStreamId = null;
  let avatarStream = null;
  let isWaitingForAvatarStream = false;
  const avatarStreamCallbacks = [];
  avatarChannel.onmessage = ({data}) => {
    const message = JSON.parse(data);
    if (message.error) {
      console.error(`Got error while requesting avatar stream for player: ${message.error}`);
      return;
    }
    avatarStreamId = message.streamId;
  }
  player.rtcConnection.addEventListener('track', ({streams}) => {
    const stream = streams.find(stream => stream.id === avatarStreamId);
    if (stream) {
      avatarStream = stream;
      isWaitingForAvatarStream = false;
      while (avatarStreamCallbacks.length > 0) {
        avatarStreamCallbacks.pop()(stream);
      }
    }
  });
  player.getAvatarStream = async () => {
    if (avatarStream) {
      return avatarStream;
    } else {
      if (!isWaitingForAvatarStream) {
        if (avatarChannel.readyState === 'open') {
          avatarChannel.send('request');
        } else {
          avatarChannel.onopen = () => {
            avatarChannel.send('request');
          }
        }
        isWaitingForAvatarStream = true;
      }
      return new Promise(resolve => {
        avatarStreamCallbacks.push(resolve);
      });
    }
  }

  players.push(player);
  listenForAllPlayersCallbacks.forEach(callback => callback(player));
  listenForNewPlayersCallbacks.forEach(callback => callback(player));

//   newPlayerSound.play().catch(() => {});

  await Promise.race([waitForRtcClose(rtcConnection), waitForKeepaliveEnd]);

  keepaliveChannel.close();
  rtcConnection.close();

//   playerLeftSound.play().catch(() => {});

  players.splice(players.indexOf(player), 1);

  leavingPlayerCallbacks.forEach(callback => callback(player));
}
