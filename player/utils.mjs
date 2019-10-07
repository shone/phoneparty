export function waitForHost(websocket) {
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
