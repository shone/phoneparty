import {waitForNSeconds, waitForPageToBeVisible, waitForWebsocketToConnect, waitForWebsocketToDisconnect, waitForRtcConnection, waitForRtcConnectionClose} from '/shared/utils.mjs';
import {playTone} from './audio.mjs';
import './push-buttons.mjs';
import handleMessaging from './messaging.mjs';
import handleMovement from './movement.mjs';
import splashScreen from './splashScreen.mjs';
import allTheThings from '/games/all-the-things/player/allTheThings.mjs';

// HTTPS redirect
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  location.href = 'https:' + window.location.href.substring(window.location.protocol.length);
}

const statusContainer = document.getElementById('status-container');
const status          = document.getElementById('status');
const statusDetail    = document.getElementById('status-detail');

export let stream = null;

(async function() {

  // Setup video
  while (!stream) {
    statusContainer.className = 'waiting';
    status.textContent = 'Accessing camera..';
    statusDetail.textContent = '';
    try {
      stream = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
    } catch(error) {
      if (location.hostname === 'localhost') {
        break;
      }
      statusContainer.className = 'error';
      if (error && error.name === 'NotFoundError') {
        status.textContent = 'no camera found';
      } else {
        status.textContent = 'Could not get camera';
      }
      const retryButton = document.createElement('button');
      retryButton.className = 'push-button';
      retryButton.textContent = 'retry';
      statusDetail.appendChild(retryButton);
      await new Promise(resolve => retryButton.onclick = resolve);
      retryButton.remove();
      break;
    }
  }

  // Setup fullscreen button
  if (document.documentElement.requestFullscreen) {
    const fullscreenButton = document.getElementById('fullscreen-button');
    const clickSound = new Audio('/sounds/click.wav');
    function toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen({navigationUI: "hide"});
      } else {
        document.exitFullscreen();
      }
      clickSound.play();
    }
    fullscreenButton.onclick = toggleFullscreen;
    const touches = new Set();
    fullscreenButton.ontouchstart = event => {
      fullscreenButton.classList.add('active');
      for (const touch of event.changedTouches) {
        touches.add(touch.identifier);
      }
    }
    function onTouchEndOrCancel(event) {
      for (const touch of event.changedTouches) {
        touches.delete(touch.identifier);
        if (touches.size === 0) {
          fullscreenButton.classList.remove('active');
        }
      }
    }
    window.addEventListener('touchend',    onTouchEndOrCancel);
    window.addEventListener('touchcancel', onTouchEndOrCancel);
    fullscreenButton.classList.remove('unimplemented');
  }

  while (true) {
    await waitForPageToBeVisible();
    statusContainer.className = 'waiting';
    status.textContent = 'Connecting..';
    statusDetail.textContent = 'Opening websocket';

    const websocket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:${location.port}/player/ws`);

    let hasHost = false;
    websocket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.host) {
        hasHost = message.host === 'connected';
      }
    });
    websocket.addEventListener('close', event => hasHost = false);
    websocket.addEventListener('error', event => hasHost = false);

    try {
      await waitForWebsocketToConnect(websocket);
    } catch(error) {
      statusContainer.className = 'error';
      status.textContent = 'failed to connect';
      statusDetail.textContent = 'Could not establish websocket, retrying in 2 seconds..';
      await waitForNSeconds(2);
      continue;
    }

    while (true) {
      await waitForPageToBeVisible();

      try {
        if (!hasHost) {
          statusContainer.className = 'waiting';
          status.textContent = 'Waiting for host...';
          statusDetail.textContent = '';
          await waitForHost(websocket);
        }

        statusContainer.className = 'waiting';
        status.textContent = 'Connecting..';
        statusDetail.textContent = 'Establishing WebRTC connection';

        var rtcConnection = new RTCPeerConnection();
        if (stream) {
          stream.getTracks().forEach(track => rtcConnection.addTrack(track, stream));
        }
        let hasSentSdp = false;
        const iceCandidatesToSend = [];
        rtcConnection.addEventListener('icecandidate', event => {
          if (event.candidate) {
            iceCandidatesToSend.push(JSON.stringify(event.candidate.toJSON()));
            if (websocket.readyState === websocket.OPEN && hasSentSdp) {
              while (iceCandidatesToSend.length) websocket.send(JSON.stringify({iceCandidate: iceCandidatesToSend.pop()}));
            }
          }
        });
        // TODO: handle rtcConnection.onicecandidateerror

        var channels = {
          accelerometer:    rtcConnection.createDataChannel('accelerometer',   {negotiated: true, id: 3, ordered: false, maxRetransmits: 0}),
          visibility:       rtcConnection.createDataChannel('visibility',      {negotiated: true, id: 5, ordered: true}),
          hostInteraction:  rtcConnection.createDataChannel('hostInteraction', {negotiated: true, id: 6, ordered: true}),
          close:            rtcConnection.createDataChannel('close',           {negotiated: true, id: 7, ordered: true}),
          acceptPlayer:     rtcConnection.createDataChannel('acceptPlayer',    {negotiated: true, id: 8, ordered: true}),
        }

        var waitToBeAccepted = new Promise(resolve => {
          channels.acceptPlayer.onmessage = resolve;
        });

        try {
          var rtcOffer = await rtcConnection.createOffer();
        } catch(error) {
          statusContainer.className = 'error';
          status.textContent = 'Could not connect';
          statusDetail.textContent = 'WebRTC offer creation failed';
          return;
        }

        rtcConnection.setLocalDescription(rtcOffer);
        websocket.send(JSON.stringify({sdp: rtcOffer.sdp}));
        hasSentSdp = true;

        while (iceCandidatesToSend.length) websocket.send(JSON.stringify({iceCandidate: iceCandidatesToSend.pop()}));

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

        try {
          var result = await Promise.race([waitForRtcConnection(rtcConnection), waitForWebsocketToDisconnect(websocket)]);
        } catch(error) {
          if (error === 'rtc_closed') {
            statusContainer.className = 'error';
            status.textContent = 'Could not connect';
            statusDetail.textContent = 'WebRTC disconnected. Retrying in 2 seconds..';
            await waitForNSeconds(2);
            continue;
          } else {
            throw error;
          }
        }
        if (result === 'websocket_disconnected') {
          throw 'websocket disconnected before RTC connection could be established';
        }
      } catch(error) {
        if (websocket.readyState === websocket.CLOSING || websocket.readyState === websocket.CLOSED) {
          rtcConnection.close();
          statusContainer.className = 'error';
          status.textContent = 'Could not connect';
          statusDetail.textContent = 'Websocket disconnected, reconnecting in 2 seconds..';
          await waitForNSeconds(2);
          break;
        } else {
          throw error;
        }
      }

      rtcConnection.ondatachannel = event => {
        if (event.channel.label === 'movement') {
          handleMovement(event.channel);
        } else if (event.channel.label === 'messaging') {
          handleMessaging(event.channel);
        } else if (event.channel.label === 'splash-screen') {
          splashScreen(event.channel);
        } else if (event.channel.label === 'all-the-things') {
          allTheThings(event.channel, rtcConnection);
        }
      }

      function handleDeviceMotion(event) { channels.accelerometer.send(`{"x": ${event.acceleration.x}, "y": ${event.acceleration.y}}`); }
      channels.accelerometer.onopen  = () => window.addEventListener(   'devicemotion', handleDeviceMotion);
      channels.accelerometer.onclose = () => window.removeEventListener('devicemotion', handleDeviceMotion);

      function handleVisibilityChange() { channels.visibility.send(document.visibilityState); }
      channels.visibility.onopen  = () => document.addEventListener(   'visibilitychange', handleVisibilityChange);
      channels.visibility.onclose = () => document.removeEventListener('visibilitychange', handleVisibilityChange);

      channels.hostInteraction.onmessage = event => {
        if (event.data === 'drag start') {
          document.body.classList.add('host-dragging');
          playTone();
          if (navigator.vibrate) {
            try { navigator.vibrate(200); } catch(error) { }
          }
        } else if (event.data === 'drag end') {
          document.body.classList.remove('host-dragging');
        }
      }
      channels.hostInteraction.onclose = () => {
        document.body.classList.remove('host-dragging');
      }

      statusContainer.className = 'waiting';
      status.textContent = 'Waiting to be accepted';
      statusDetail.textContent = '';
      await waitToBeAccepted;

      statusContainer.className = '';
      status.textContent = '';
      statusDetail.textContent = '';

      window.onunload = window.onbeforeunload = () => {
        if (channels.close.readyState === 'open') {
          channels.close.send('true');
        }
      }

      const waitForCloseChannel = new Promise(resolve => channels.close.onmessage = () => resolve('close_channel'));

      var result = await Promise.race([waitForRtcConnectionClose(rtcConnection), waitForCloseChannel]);
      if (result === 'close_channel') {
        rtcConnection.close();
        hasHost = false;
        statusContainer.className = 'error';
        status.textContent = 'Host disconnected';
        statusDetail.textContent = '';
        await waitForNSeconds(2);
        continue;
      } else {
        statusContainer.className = 'error';
        status.textContent = 'Disconnected';
        status.textContent = 'WebRTC disconnected, reconnecting in 5 seconds..';
        await waitForNSeconds(5);
        continue;
      }
    }
  }
})();

function waitForHost(websocket) {
  return new Promise((resolve, reject) => {
    if (websocket.readyState === websocket.CLOSING || websocket.readyState === websocket.CLOSED) {
      reject('websocket_disconnected');
    } else {
      function callback(event) {
        const message = JSON.parse(event.data);
        if (message.host === 'connected') {
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
