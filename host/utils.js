"use strict";

function randomInArray(array) {
  return array[Math.floor(Math.random() * array.length)];
}

async function waitForDataChannelOpen(dataChannel) {
  if (dataChannel.readyState === 'open') {
    return;
  } else if (dataChannel.readyState === 'closing' || dataChannel.readyState === 'closed') {
    throw 'Data channel is closing or closed';
  } else {
    return new Promise((resolve, reject) => {
      dataChannel.addEventListener('open', resolve, {once: true});
      dataChannel.addEventListener('error', reject, {once: true});
      dataChannel.addEventListener('close', reject, {once: true});
    });
  }
}

async function waitForRtcConnectionClose(rtcConnection) {
  if (rtcConnection.connectionState === 'closed' || rtcConnection.connectionState === 'failed') {
    return;
  }
  return new Promise(resolve => {
    rtcConnection.addEventListener('connectionstatechange', function callback() {
      if (rtcConnection.connectionState === 'closed' || rtcConnection.connectionState === 'failed') {
        resolve();
        rtcConnection.removeEventListener('connectionstatechange', callback);
      }
    });
  });
}

async function waitForPlayerToLeave(player) {
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
