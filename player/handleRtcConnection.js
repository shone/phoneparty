"use strict";

async function handleRtcConnection(rtcConnection, channels) {

  rtcConnection.ondatachannel = event => {
    if (event.channel.label === 'bubbleField') {
      handleBubbleField(event.channel);
    }
  }
  
  channels.wheel.onmessage = event => {
    document.body.classList.toggle('chosen',       event.data.startsWith('chosen'));
    document.body.classList.toggle('chosen-final', event.data.endsWith('final'));
    if (event.data.startsWith('chosen')) {
      if (event.data.endsWith('final')) {
        for (let i=0; i<5; i++) {
          playTone(i*0.2);
        }
      } else {
        playTone();
      }
      if (navigator.vibrate) {
        try { navigator.vibrate(200); } catch(error) { }
      }
    }
  }
  channels.wheel.onclose = () => {
    document.body.classList.remove('chosen');
    document.body.classList.remove('chosen-final');
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

  // Games
  allTheThings(rtcConnection);
}
