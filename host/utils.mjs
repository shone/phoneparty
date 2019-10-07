import {paused} from './main.mjs';

export function waitForNSeconds(seconds) {
  return new Promise(resolve => {
    setTimeout(() => {
      if (paused) {
        waitForKeypress('p').then(() => resolve());
      } else {
        resolve();
      }
    }, 1000 * seconds);
  });
}

export function waitForKeypress(key) {
  return new Promise(resolve => {
    window.addEventListener('keypress', function handleKeypress(event) {
      if (event.key === key) {
        resolve(event);
        window.removeEventListener('keypress', handleKeypress);
      }
    });
  });
}

export async function waitForDataChannelOpen(dataChannel) {
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

export async function waitForRtcConnectionClose(rtcConnection) {
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
