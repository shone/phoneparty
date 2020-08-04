import {
  waitForNSeconds,
  waitForPageToBeVisible,
  waitForWebsocketOpen,
  waitForWebsocketClose,
  waitForRtcConnect,
  waitForRtcClose
} from '/common/utils.mjs';

import {playTone} from './audio.mjs';
import {startRouting} from './routes.mjs';

import handleMessaging from './messaging.mjs';

import './splash-screen.mjs';

import '/apps/tunnel-vision/player/tunnel-vision.mjs';
import '/apps/show-and-tell/player/show-and-tell.mjs';
import '/apps/bubbleland/player/bubbleland.mjs';

import './test.mjs';

async function showStatus(status, description='', detail='') {
  document.getElementById('status-container').className = status;
  document.getElementById('status-description').textContent = description;
  document.getElementById('status-detail').textContent = detail;
  if (status === 'error') {
    await waitForNSeconds(2);
  }
}

if (navigator.serviceWorker) {
  navigator.serviceWorker.register('/common/service-worker.js', {scope: '/'});
}

location.hash = '';

export let stream = null;
export let rtcConnection = null;

(async function main() {

  setupMenu();

  stream = await getCameraStream();

  while (true) {
    await waitForPageToBeVisible();

    showStatus('waiting', 'Connecting..', 'Opening websocket');

    const websocket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:${location.port}/player/ws`);

    let hasHost = false;
    let waitingOnHostCallback = null;
    websocket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.host) {
        hasHost = message.host === 'connected';
        if (hasHost && waitingOnHostCallback) {
          waitingOnHostCallback('host-connected');
        }
      }
    });
    websocket.addEventListener('close', () => {
      hasHost = false;
      if (waitingOnHostCallback) {
        waitingOnHostCallback('websocket-closed');
      }
    });

    if (await waitForWebsocketOpen(websocket) !== 'websocket-open') {
      await showStatus('error', 'failed to connect', 'Could not establish websocket, retrying in 2 seconds..');
      showStatus('waiting', 'Connecting..', 'Opening websocket');
      await waitForNSeconds(1);
      continue;
    }

    while (true) {
      await waitForPageToBeVisible();

      if (websocket.readyState !== websocket.OPEN) {
        break;
      }

      if (!hasHost) {
        showStatus('waiting', 'Waiting for host...');
        const waitForHostResult = await new Promise(resolve => waitingOnHostCallback = resolve);
        waitingOnHostCallback = null;
        if (waitForHostResult !== 'host-connected') {
          await showStatus('error', 'failed to connect', 'Websocket closed before a host could be found');
          break;
        }
      }

      await connectRtcAndStartRouting(websocket);
      if (websocket.readyState !== websocket.OPEN) {
        break;
      }
    }
  }
})();

async function getCameraStream() {
  while (true) {
    showStatus('waiting', 'Accessing camera..');
    if (!navigator.mediaDevices) {
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
      showStatus('');
      return stream;
    } catch(error) {
      if (location.hostname === 'localhost') {
        return null;
      }
      if (error && error.name === 'NotFoundError') {
        showStatus('error', 'no camera found');
      } else {
        showStatus('error', 'Could not get camera', error);
      }
      const statusDetail = document.getElementById('status-detail');
      statusDetail.insertAdjacentHTML('beforeend', `
        <push-button class="camera-retry-button">
          retry
        </push-button>
      `);
      const retryButton = statusDetail.lastElementChild;
      await new Promise(resolve => retryButton.onclick = resolve);
      retryButton.remove();
      showStatus('waiting', 'Accessing camera..');
      await waitForNSeconds(1);
    }
  }
}

function setupMenu() {
  const menu = document.getElementById('menu');
  menu.querySelector('.toggle').onclick = () => {
    menu.classList.toggle('visible');
  }

  setupFullscreenButton();

  menu.querySelector('.host').onclick = () => {
    location.pathname = 'host';
  }
}

function setupFullscreenButton() {
  // - Only show the fullscreen button if the fullscreen API is available.
  // - If the app was started in fullscreen mode, assume that it's running as an installed PWA and therefore doesn't
  // need a fullscreen button.
  if (!document.documentElement.requestFullscreen || window.matchMedia('(display-mode: fullscreen)').matches) {
    return;
  }

  const fullscreenButton = document.querySelector('#menu .fullscreen');

  const clickSound = new Audio('/sounds/click.wav');
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen({navigationUI: "hide"});
    } else {
      document.exitFullscreen();
    }
    clickSound.play();
  }
  fullscreenButton.onclick = () => {
    toggleFullscreen();
    document.getElementById('menu').classList.remove('visible');
  }

  fullscreenButton.classList.remove('unimplemented');
}

async function connectRtcAndStartRouting(websocket) {
  showStatus('waiting', 'Establishing WebRTC connection', 'Setting up connection object');

  rtcConnection = new RTCPeerConnection();

  if (stream) {
    stream.getTracks().forEach(track => rtcConnection.addTrack(track, stream));
  }

  rtcConnection.ondatachannel = event => {
    switch (event.channel.label) {
      case 'messaging': handleMessaging(event.channel); break;
    }
  }

  const accelerometerChannel = rtcConnection.createDataChannel('accelerometer', {negotiated: true, id: 3, ordered: false, maxRetransmits: 0});
  function handleDeviceMotion(event) { accelerometerChannel.send(`{"x": ${event.acceleration.x}, "y": ${event.acceleration.y}}`); }
  accelerometerChannel.onopen  = () => window.addEventListener(   'devicemotion', handleDeviceMotion);
  accelerometerChannel.onclose = () => window.removeEventListener('devicemotion', handleDeviceMotion);

  const visibilityChannel = rtcConnection.createDataChannel('visibility', {negotiated: true, id: 5, ordered: true});
  function handleVisibilityChange() { visibilityChannel.send(document.visibilityState); }
  visibilityChannel.onopen  = () => document.addEventListener(   'visibilitychange', handleVisibilityChange);
  visibilityChannel.onclose = () => document.removeEventListener('visibilitychange', handleVisibilityChange);

  const acceptPlayerChannel = rtcConnection.createDataChannel('acceptPlayer', {negotiated: true, id: 8, ordered: true});
  const waitForPlayerAccepted = new Promise(resolve => {
    acceptPlayerChannel.onmessage = () => resolve('accepted');
    acceptPlayerChannel.onclose = () => resolve('channel-closed');
  });

  const routeChannel = rtcConnection.createDataChannel('route', {negotiated: true, id: 9, ordered: true});

  const closeChannel = rtcConnection.createDataChannel('close', {negotiated: true, id: 7, ordered: true});
  function handleUnload() { closeChannel.send('true'); }
  closeChannel.onopen = () => {
    window.addEventListener('unload', handleUnload);
    window.addEventListener('beforeunload', handleUnload);
  }
  closeChannel.onclose = () => {
    window.removeEventListener('unload', handleUnload);
    window.removeEventListener('beforeunload', handleUnload);
  }

  let hasSentSdp = false;
  const iceCandidatesToSend = [];
  rtcConnection.onicecandidate = event => {
    if (event.candidate) {
      iceCandidatesToSend.push(JSON.stringify(event.candidate.toJSON()));
      if (websocket.readyState === websocket.OPEN && hasSentSdp) {
        while (iceCandidatesToSend.length) websocket.send(JSON.stringify({iceCandidate: iceCandidatesToSend.pop()}));
      }
    }
  };
  rtcConnection.onicegatheringstatechange = event => {
    showStatus('waiting', 'Establishing WebRTC connection', 'ICE gathering state: ' + rtcConnection.iceGatheringState);
  }

  try {
    var rtcOffer = await rtcConnection.createOffer();
  } catch(error) {
    await showStatus('error', 'failed to connect', 'WebRTC offer creation failed');
    return;
  }

  try {
    await rtcConnection.setLocalDescription(rtcOffer);
  } catch(error) {
    await showStatus('error', 'failed to connect', 'failed to set RTC local description: ' + error);
    return;
  }

  try {
    websocket.send(JSON.stringify({sdp: rtcOffer.sdp}));
  } catch(error) {
    await showStatus('error', 'failed to connect', 'failed to send SDP over websocket: ' + error);
    return;
  }
  hasSentSdp = true;

  try {
    while (iceCandidatesToSend.length) websocket.send(JSON.stringify({iceCandidate: iceCandidatesToSend.pop()}));
  } catch(error) {
    await showStatus('error', 'failed to connect', 'failed to send ICE candidates over websocket: ' + error);
    return;
  }

  websocket.addEventListener('message', function callback(event) {
    const message = JSON.parse(event.data);
    if (message.sdp) {
      rtcConnection.setRemoteDescription({type: 'answer', sdp: message.sdp});
    } else if (message.iceCandidate) {
      rtcConnection.addIceCandidate(JSON.parse(message.iceCandidate));
    } else if (message.host === 'disconnected') {
      websocket.removeEventListener('message', callback);
      rtcConnection.close();
    }
  });

  var connectResult = await Promise.race([waitForRtcConnect(rtcConnection), waitForWebsocketClose(websocket)]);
  rtcConnection.onicegatheringstatechange = null;
  if (connectResult === 'websocket-closed') {
    await showStatus('error', 'failed to connect', 'websocket closed before RTC connection could be established');
    return;
  }
  if (connectResult !== 'rtc-connected') {
    await showStatus('error', 'failed to connect', 'RTC connection could not be established');
    return;
  }

  // TODO: handle renegotion
//   rtcConnection.onnegotiationneeded = async () => {
//     var rtcOffer = await rtcConnection.createOffer();
//     await rtcConnection.setLocalDescription(rtcOffer);
//     try {
//       websocket.send(JSON.stringify({sdp: rtcOffer.sdp}));
//     } catch(error) {
//       rtcConnection.close();
//     }
//   }

  showStatus('');

  const waitForCloseChannel = new Promise(resolve => closeChannel.onmessage = () => resolve('close-channel'));

  const waitForRouting = startRouting(rtcConnection, routeChannel);

  showStatus('waiting', 'Waiting to be accepted');
  const acceptResult = await waitForPlayerAccepted;
  if (acceptResult === 'channel-closed') {
    rtcConnection.close();
    await showStatus('error', 'failed to connect', 'The RTC channel was closed before the player was accepted');
    return;
  }
  showStatus('');

  var result = await Promise.race([waitForRtcClose(rtcConnection), waitForCloseChannel]);
  rtcConnection.close();
  await waitForRouting;
  await showStatus('error', 'Host disconnected', 'reconnecting in 2 seconds..');
}
