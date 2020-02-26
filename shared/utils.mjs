export function waitForNSeconds(seconds) {
  return new Promise(resolve => setTimeout(resolve, 1000 * seconds));
}

export function randomInArray(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export async function waitForPageToBeVisible() {
  if (document.visibilityState === 'visible') {
    return;
  }
  return new Promise(resolve =>
    document.addEventListener('visibilitychange', function callback() {
      if (document.visibilityState === 'visible') {
        resolve();
        document.removeEventListener('visibilitychange', callback);
      }
    })
  );
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

export async function waitForWebsocketOpen(websocket) {
  switch (websocket.readyState) {
    case websocket.OPEN:
      return 'websocket-open';
    case websocket.CLOSING: case websocket.CLOSED:
      return 'websocket-closed';
    default:
      return new Promise(resolve => {
        websocket.addEventListener('open',  () => resolve('websocket-open'),   {once: true});
        websocket.addEventListener('close', () => resolve('websocket-closed'), {once: true});
        websocket.addEventListener('error', () => resolve('websocket-error'),  {once: true});
      });
  }
}

export async function waitForWebsocketClose(websocket) {
  switch (websocket.readyState) {
    case websocket.CLOSING: case websocket.CLOSED:
      return 'websocket-closed';
    default:
      return new Promise(resolve => {
        websocket.addEventListener('close', () => resolve('websocket-closed'), {once: true});
        websocket.addEventListener('error', () => resolve('websocket-closed'), {once: true});
      });
  }
}

export async function waitForRtcConnect(rtcConnection) {
  switch (rtcConnection.iceConnectionState) {
    case 'connected': case 'completed':
      return 'rtc-connected';
    case 'failed': return 'rtc-failed';
    case 'closed': return 'rtc-closed';
    default:
      return new Promise(resolve =>
        rtcConnection.addEventListener('iceconnectionstatechange', function callback(event) {
          switch (rtcConnection.iceConnectionState) {
            case 'connected': case 'completed':
              resolve('rtc-connected');
              break;
            case 'failed': resolve('rtc-failed'); break;
            case 'closed': resolve('rtc-closed'); break;
            default:
              return;
          }
          rtcConnection.removeEventListener('iceconnectionstatechange', callback);
        })
      );
  }
}

export function waitForRtcClose(rtcConnection) {
  switch (rtcConnection.connectionState) {
    case 'failed': case 'closed':
      return 'rtc-closed';
    default:
      return new Promise(resolve => {
        rtcConnection.addEventListener('iceconnectionstatechange', function callback(event) {
          switch (rtcConnection.iceConnectionState) {
            case 'failed': case 'closed':
              resolve('rtc-closed');
              rtcConnection.removeEventListener('iceconnectionstatechange', callback);
          }
        });
      });
  }
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

export async function waitForDataChannelClose(channel) {
  if (channel.readyState === 'closing' || channel.readyState === 'closed') {
    return;
  } else {
    return new Promise(resolve => {
      channel.addEventListener('close', resolve, {once: true});
      channel.addEventListener('error', resolve, {once: true});
    });
  }
}

export async function getMessageFromDataChannelOrClose(channel) {
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
