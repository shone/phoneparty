"use strict";

const audioContext = new (window.AudioContext || window.webkitAudioContext);
const personalToneFrequency = 180 + (200 * Math.random());

const envelope = audioContext.createGain();
envelope.gain.setValueAtTime(0, audioContext.currentTime);
envelope.connect(audioContext.destination);

const oscillator = audioContext.createOscillator();
oscillator.frequency.setValueAtTime(personalToneFrequency, audioContext.currentTime);
oscillator.type = 'square';
oscillator.connect(envelope);
oscillator.start();

function resumeAudio() {
  if (audioContext.state === 'suspended') {
    // The AudioContext will initially be in a suspended state, and is only allowed
    // to be resumed in response to a user gesture.
    // See https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices#Autoplay_policy
    audioContext.resume();
  }
}
window.addEventListener('mousedown',  resumeAudio);
window.addEventListener('touchstart', resumeAudio);
window.addEventListener('keydown',    resumeAudio);

function playTone(timeOffset = 0) {
  envelope.gain.setValueAtTime(0, audioContext.currentTime);
  envelope.gain.setValueAtTime(0.02, audioContext.currentTime + timeOffset);
  envelope.gain.setTargetAtTime(0, audioContext.currentTime + timeOffset, 0.2);
}
