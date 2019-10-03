"use strict";

function waitForNSeconds(seconds) {
  return new Promise(resolve => setTimeout(resolve, 1000 * seconds));
}

function randomInArray(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function waitForPageToBeVisible() {
  return new Promise(resolve => {
    if (document.visibilityState === 'visible') {
      resolve();
    } else {
      document.addEventListener('visibilitychange', function callback() {
        if (document.visibilityState === 'visible') {
          resolve();
          document.removeEventListener('visibilitychange', callback);
        }
      });
    }
  });
}

function waitForWebsocketToConnect(websocket) {
  return new Promise((resolve, reject) => {
    if (websocket.readyState === websocket.OPEN) {
      resolve();
    } else if (websocket.readyState === websocket.CLOSING || websocket.readyState === websocket.CLOSED) {
      reject();
    } else {
      websocket.addEventListener('open',  resolve, {once: true});
      websocket.addEventListener('close', reject,  {once: true});
      websocket.addEventListener('error', reject,  {once: true});
    }
  });
}

function waitForWebsocketToDisconnect(websocket) {
  return new Promise(resolve => {
    if (websocket.readyState === websocket.CLOSING || websocket.readyState === websocket.CLOSED) {
      resolve('websocket_disconnected');
    } else {
      websocket.addEventListener('close', () => resolve('websocket_disconnected'), {once: true});
      websocket.addEventListener('error', () => resolve('websocket_disconnected'), {once: true});
    }
  });
}

function waitForHost(websocket) {
  return new Promise((resolve, reject) => {
    if (websocket.readyState === websocket.CLOSING || websocket.readyState === websocket.CLOSED) {
      reject('websocket_disconnected');
    } else {
      function callback(event) {
        const message = JSON.parse(event.data);
        if (message.type === 'host' && message.message === 'connected') {
          resolve('host_connected');
          websocket.removeEventListener('message', callback);
        }
      }
      websocket.addEventListener('message', callback);
      websocket.addEventListener('close', () => { reject('websocket_disconnected'); websocket.removeEventListener('message', callback) }, {once: true});
      websocket.addEventListener('error', () => { reject('websocket_disconnected'); websocket.removeEventListener('message', callback) }, {once: true});
    }
  });
}

function waitForRtcConnection(rtcConnection) {
  return new Promise((resolve, reject) => {
    if (rtcConnection.iceConnectionState in {connected: true, completed: true}) {
      resolve();
    } else if (rtcConnection.iceConnectionState in {disconnected: true, failed: true, closed: true}) {
      reject('rtc_disconnected');
    } else {
      rtcConnection.addEventListener('iceconnectionstatechange', function callback(event) {
        if (rtcConnection.iceConnectionState in {connected: true, completed: true}) {
          resolve();
          rtcConnection.removeEventListener('iceconnectionstatechange', callback);
        } else if (rtcConnection.iceConnectionState in {disconnected: true, failed: true, closed: true}) {
          reject();
          rtcConnection.removeEventListener('iceconnectionstatechange', callback);
        }
      });
    }
  });
}

function waitForRtcToDisconnect(rtcConnection) {
  return new Promise((resolve, reject) => {
    if (rtcConnection.iceConnectionState in {disconnected: true, failed: true, closed: true}) {
      resolve('webrtc_disconnected');
    } else {
      rtcConnection.addEventListener('iceconnectionstatechange', function callback(event) {
        if (rtcConnection.iceConnectionState in {disconnected: true, failed: true, closed: true}) {
          resolve('webrtc_disconnected');
          rtcConnection.removeEventListener('iceconnectionstatechange', callback);
        }
      });
    }
  });
}

async function getMessageFromDataChannelOrClose(channel) {
  if (channel.readyState === 'closing' || channel.readyState === 'closed') {
    return [null, true];
  } else {
    return new Promise(resolve => {
      channel.addEventListener('message', event => resolve([event.data, false]), {once: true});
      channel.addEventListener('close', () => resolve([null, true]), {once: true});
      channel.addEventListener('error', () => resolve([null, true]), {once: true});
    });
  }
}

async function waitForDataChannelClose(channel) {
  if (channel.readyState === 'closing' || channel.readyState === 'closed') {
    return;
  } else {
    return new Promise(resolve => {
      channel.addEventListener('close', resolve, {once: true});
      channel.addEventListener('error', resolve, {once: true});
    });
  }
}
