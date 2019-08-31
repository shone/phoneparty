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
  }

  channels.phaseTwo.onmessage = event => {
    if (event.data === "COUNTDOWN") {
      phase2.showCamera();
      phase2.countDown();
    }
  };

  class Phase2 {
    timeLeft = 30;

    showCamera() {
      const mode = 'camera';
      document.body.dataset.mode = mode;
      for (const elementWithMode of document.querySelectorAll('[data-formode]')) {
        const matchesMode = elementWithMode.dataset.formode === mode;
        elementWithMode.style.visibility = matchesMode ? 'visible' : 'hidden';
      }
    }

    countDown() {
      if (this.timeLeft > 0) {
        $("#photo-mode-headline").text(`Hurry! ${this.timeLeft}s left!`);
        this.timeLeft--;

        window.setTimeout(() => { this.countDown() }, 1000);
      }
    }

    pictureTaken() {
      this.timeLeft = 0;
      $("#photo-mode-headline").text(`Picture taken!`);
    }
  }

  let phase2 = new Phase2();


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

    phase2.pictureTaken();
  }

  channels.buttons.onopen = () => {
    for (const button of document.getElementById('movement-buttons').getElementsByTagName('button')) {
      button.ontouchstart = event => {
        event.preventDefault();
        if (!button.classList.contains('pressed')) {
          button.classList.add('pressed');
          channels.buttons.send(button.dataset.button + ' true');
          function handleTouchend(event) {
            if (![...event.touches].some(touch => touch.target === button)) {
              button.classList.remove('pressed');
              if (channels.buttons.readyState === 'open') {
                channels.buttons.send(button.dataset.button + ' false');
              }
              window.removeEventListener('touchend',    handleTouchend);
              window.removeEventListener('touchcancel', handleTouchend);
            }
          }
          window.addEventListener('touchend',    handleTouchend);
          window.addEventListener('touchcancel', handleTouchend);
        }
        return false;
      }
    }
    for (const button of document.getElementById('movement-buttons').getElementsByTagName('button')) {
      button.onmousedown = event => {
        button.classList.add('pressed');
        channels.buttons.send(button.dataset.button + ' true');
        window.addEventListener('mouseup', event => {
          button.classList.remove('pressed');
          if (channels.buttons.readyState === 'open') {
            channels.buttons.send(button.dataset.button + ' false');
          }
        }, {once: true});
      }
    }
    function handleKey(event) {
      const button = document.querySelector(`button[data-key="${event.key}"]`);
      if (button) {
        event.preventDefault();
        button.classList.toggle('pressed', event.type === 'keydown');
        channels.buttons.send(button.dataset.button + ((event.type === 'keydown') ? ' true' : ' false'));
        return false;
      }
    }
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup',   handleKey);
    channels.buttons.onclose = event => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup',   handleKey);
      for (const button of document.getElementById('movement-buttons').getElementsByTagName('button')) {
        button.onmousedown  = null;
        button.ontouchstart = null;
        button.classList.remove('pressed');
      }
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
}
