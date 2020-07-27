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

export function sendOnChannelWhenOpen(channel, message) {
  if (channel.readyState === 'open') {
    channel.send(message);
  } else {
    channel.addEventListener('open', () => channel.send(message), {once: true});
  }
}

export async function sendLargeBlobOnChannel(channel, blob) {
  channel.send(JSON.stringify({size: blob.size, type: blob.type}));

  const fileReader = new FileReader();
  fileReader.readAsArrayBuffer(blob); // Can't use blob.arrayBuffer() because it's not supported on Safari
  const arrayBuffer = await new Promise(resolve => fileReader.onloadend = () => resolve(fileReader.result));

  const messageSize = 1024 * 64;
  for (let i=0; i < arrayBuffer.byteLength; i += messageSize) {
    const slice = arrayBuffer.slice(i, Math.min(i + messageSize, arrayBuffer.byteLength));
    channel.send(slice);
  }
}

export async function receiveLargeBlobOnChannel(channel) {
  const {size, type} = await new Promise(resolve => {
    channel.addEventListener('message', ({data}) => resolve(JSON.parse(data)), {once: true})
  });

  return new Promise(resolve => {
    const parts = [];
    let partsSize = 0;

    function onMessage({data}) {
      parts.push(data);
      partsSize += data.byteLength;
      if (partsSize >= size) {
        channel.removeEventListener('message', onMessage);
        resolve(new Blob(parts, {type}));
      }
    }

    channel.addEventListener('message', onMessage);
    channel.addEventListener('close', () => {
      channel.removeEventListener('message', onMessage);
      resolve(null);
    }, {once: true});
  });
}
