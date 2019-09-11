"use strict";

async function handleRtcConnection(rtcConnection, channels) {

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
}
