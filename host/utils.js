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
