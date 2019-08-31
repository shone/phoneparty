"use strict";

async function handleRtcConnection(rtcConnection, channels) {

  channels.mode.onmessage = event => {
    const mode = event.data;
    if (document.body.dataset.mode !== mode) {
      document.body.dataset.mode = mode;
      for (const elementWithMode of document.querySelectorAll('[data-formode]')) {
        const matchesMode = elementWithMode.dataset.formode === mode;
        elementWithMode.style.visibility = matchesMode ? 'visible' : 'hidden';
      }
    }
  }

  channels.currentPhaseChannel.onmessage = function(event) {
    console.log("New Phase", event.data);
    switch (parseInt(event.data)) {
      case 1:
        phase1(channels);
        break;
      case 2:
        phase2(channels);
        break;
      case 3:
        phase3(channels);
        break;
      case 4:
        phase4(channels);
        break;
    }

  };

  channels.phaseTwo.onmessage = event => {
    if (event.data === "COUNTDOWN") {
      alert("COUNTDOWN 30s!");
    }
  };

  document.getElementById('take-photo-button').onclick = () => {
    playTone();
    const video = document.getElementById('video');
    const canvas = document.getElementById('camera-canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    document.body.querySelector('[data-formode="camera"]').classList.add('photo-taken');

    channels.phaseTwo.send("TAKE");
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
}
