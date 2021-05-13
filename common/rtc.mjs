export function negotiateRtcConnection(rtcPeerConnection, signalling, rtcSessionDescription = null) {
  // Connects rtcPeerConnection to a remote peer using the given signalling method.
  // Based on https://blog.mozilla.org/webrtc/perfect-negotiation-in-webrtc/

  return new Promise((resolve, reject) => {
    const errors = [];

    async function onSignal(signal) {
      switch (signal.type) {

      case 'sessionDescription':
        try {
          await rtcPeerConnection.setRemoteDescription(signal.sessionDescription)
        } catch(error) {
          errors.push(`Could not use WebRTC session description ('${JSON.stringify(signal.sessionDescription)}') to set remote description: ${error}`);
          reject(errors);
          return;
        }
        if (signal.sessionDescription.type === 'offer') {
          try {
            var answer = await rtcPeerConnection.createAnswer();
          } catch(error) {
            errors.push(`Error while creating WebRTC session answer: ${error}`);
            reject(errors);
            return;
          }
          try {
            await rtcPeerConnection.setLocalDescription(answer);
          } catch(error) {
            errors.push(`Error while attempting to use WebRTC session answer as local description: ${answer}`);
            reject(errors);
            return;
          }
          try {
            signalling.send({type: 'sessionDescription', sessionDescription: rtcPeerConnection.localDescription.toJSON()});
          } catch(error) {
            errors.push(`Error while attempting to send WebRTC session answer: ${error}`);
            reject(errors);
            return;
          }
        }
        break;

      case 'iceCandidate':
        try {
          await rtcPeerConnection.addIceCandidate(signal.iceCandidate)
        } catch(error) {
          errors.push(`Error while adding ICE candidate ('${signal.iceCandidate}'): ${error}`);
          // Even if adding one ICE candidate fails, others might succeed, so don't stop here.
        }
        break;

      case 'disconnected':
        errors.push('Disconnected');
        rtcPeerConnection.close();
        break;

      default:
        errors.push(`Got unknown signal type '${signal.type}'`);
        reject(errors);
      }
    }
    signalling.onsignal = onSignal;

    signalling.onclose = () => {
      errors.push('Signalling closed before RTC connection could be established.');
      reject(errors);
      rtcPeerConnection.close();
    }

    rtcPeerConnection.onicecandidate = ({candidate}) => {
      if (candidate) {
        try {
          signalling.send({
            type: 'iceCandidate',
            iceCandidate: candidate.toJSON(),
          });
        } catch (error) {
          errors.push(`Error while attempting to send ICE candidate: ${error}`);
        }
      }
    }

    rtcPeerConnection.onicecandidateerror = event => {
      errors.push(`Got ICE candidate error: ${event.errorCode} - '${event.errorText}'`);
    }

    async function onNegotiationNeeded() {
      try {
        var offer = await rtcPeerConnection.createOffer();
      } catch(error) {
        errors.push(`Error while creating RTC offer during renegotiation: ${error}`);
        reject(errors);
        return;
      }
      if (rtcPeerConnection.signalingState !== "stable") {
        // onnegotiationneeded should only have been called when the signalling state was 'stable', but
        // by the time createOffer() finishes the state may have changed.
        return;
      }
      try {
        await rtcPeerConnection.setLocalDescription(offer);
      } catch(error) {
        errors.push(`Error while setting RTC local description to offer during renegotiation: ${error}`);
        reject(errors);
        return;
      }
      try {
        signalling.send({type: 'sessionDescription', sessionDescription: rtcPeerConnection.localDescription});
      } catch(error) {
        errors.push(`Error while sending RTC session description during renegotiation: ${error}`);
        reject(error);
        return;
      }
    }

    rtcPeerConnection.addEventListener('iceconnectionstatechange', event => {
      switch (rtcPeerConnection.iceConnectionState) {
        case 'connected': case 'completed': resolve(); break;
        case 'failed': case 'closed':       reject(errors);    break;
      }
    });

    (async function() {
      if (rtcSessionDescription) {
        await onSignal({type: 'sessionDescription', sessionDescription: rtcSessionDescription});
      }
      rtcPeerConnection.onnegotiationneeded = onNegotiationNeeded;
    })()
  });
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

export function setupKeepaliveChannel(channel) {
  let sendInterval = null;
  let receiveInterval = null;
  let onKeepaliveTimeout = null;
  channel.addEventListener('open', () => {
    sendInterval = setInterval(() => channel.send(performance.now()), 1000);
    let lastKeepaliveTimestamp = performance.now();
    channel.addEventListener('message', event => {
      lastKeepaliveTimestamp = performance.now();
    });
    receiveInterval = setInterval(() => {
      const timeSinceLastKeepalive = performance.now() - lastKeepaliveTimestamp;
      if (timeSinceLastKeepalive > 6000) {
        if (onKeepaliveTimeout) {
          onKeepaliveTimeout();
        }
        clearInterval(sendInterval);
        clearInterval(receiveInterval);
        channel.close();
      }
    }, 1000);
  });
  channel.addEventListener('close', () => {
    clearInterval(sendInterval);
    clearInterval(receiveInterval);
  });
  const onBeforeUnload = () => channel.close();
  channel.addEventListener('open', window.addEventListener('beforeunload', onBeforeUnload));
  channel.addEventListener('close', window.removeEventListener('beforeunload', onBeforeUnload));

  const waitForKeepaliveEnd = new Promise(resolve => {
    channel.addEventListener('close', () => resolve('keepalive-end'));
    onKeepaliveTimeout = () => resolve('keepalive-end');
  });
  return waitForKeepaliveEnd;
}
