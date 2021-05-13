export function clamp(f, min, max) {
  f = Math.min(f, max);
  f = Math.max(f, min);
  return f;
}

export function lerp(a, b, t) {
  return a + ((b - a) * t);
}

export function easeInOutQuad(t) {
  return t<.5 ? 2*t*t : -1+(4-2*t)*t;
}

export function waitForNSeconds(seconds) {
  return new Promise(resolve => setTimeout(resolve, 1000 * seconds));
}

export function randomInArray(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
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

export function sendOnChannelWhenOpen(channel, message) {
  if (channel.readyState === 'open') {
    channel.send(message);
  } else {
    channel.addEventListener('open', () => channel.send(message), {once: true});
  }
}

export function getMessageFromChannel(channel) {
  return new Promise(resolve => {
    function onmessage({data}) {
      channel.removeEventListener('close', onclose);
      resolve([data, null]);
    }
    channel.addEventListener('message', onmessage, {once: true});
    channel.addEventListener('close', () => {
      channel.removeEventListener('message', onmessage);
      resolve([null, new Error('Channel closed before message received.')]);
    }, {once: true});
  });
}

export async function* createChannelQueue(channel) {
  const messages = [];
  let newMessageCallback = null;
  channel.addEventListener('message', ({data}) => {
    messages.push(data);
    if (newMessageCallback) {
      newMessageCallback();
    }
  });
  channel.addEventListener('close', () => {
    if (newMessageCallback) {
      newMessageCallback('closed');
    }
  });

  while (channel.readyState !== 'closed') {
    if (messages.length === 0) {
      if (await new Promise(resolve => {newMessageCallback = resolve}) === 'closed') {
        return;
      }
    }
    yield messages.shift();
  }
}

export async function sendBlobOnChannel(channel, blob) {
  try {
    channel.send(JSON.stringify({size: blob.size, type: blob.type}));
  } catch (e) {
    return new Error(`Could not send blob on channel: ${e.message}`);
  }

  const fileReader = new FileReader();
  fileReader.readAsArrayBuffer(blob); // Can't use blob.arrayBuffer() because it's not supported on Safari
  const [arrayBuffer, error] = await new Promise(resolve => {
    fileReader.onloadend = () => resolve([fileReader.result, null]);
    fileReader.onerror = error => resolve([null, error]);
  });
  if (error !== null) {
    return new Error(`Unable to send blob on channel because the blob couldn't be converted to an array buffer: ${error}`);
  }

  const messageSize = 1024 * 64;
  for (let i=0; i < arrayBuffer.byteLength; i += messageSize) {
    const slice = arrayBuffer.slice(i, Math.min(i + messageSize, arrayBuffer.byteLength));
    try {
      channel.send(slice);
    } catch (e) {
      return new Error(`Could not send blob on channel: ${e.message}`);
    }
  }

  return null;
}

export async function getBlobOnChannel(channel) {
  const [message, error] = await getMessageFromChannel(channel);
  if (error !== null) {
    return [null, error];
  }

  try {
    var {size, type} = JSON.parse(message);
  } catch (e) {
    return [null, new Error(`Unable to get blob on channel '${channel.label}' because the initial message '${message}' could not be parsed as JSON: ${e.message}`)];
  }

  if (typeof size !== 'number' || size <= 0) {
    return [null, new Error(`Unable to get blob on channel '${channel.label}' because the declared size (${size}) is invalid.`)];
  }

  return new Promise(resolve => {
    const parts = [];
    let partsSize = 0;

    function onMessage({data}) {
      parts.push(data);
      partsSize += data.byteLength;
      if (partsSize >= size) {
        channel.removeEventListener('message', onMessage);
        resolve([new Blob(parts, {type}), null]);
      }
    }

    channel.addEventListener('message', onMessage);
    channel.addEventListener('close', () => {
      channel.removeEventListener('message', onMessage);
      resolve([null, new Error('Channel was closed before the entire blob could be received.')]);
    }, {once: true});
  });
}
