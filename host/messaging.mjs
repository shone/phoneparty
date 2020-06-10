import {
  players,
  listenForAllPlayers,
  stopListeningForAllPlayers,
  listenForLeavingPlayers,
  stopListeningForLeavingPlayers
} from './players.mjs';

let started = false;
const channels = new Map();

export function start() {
  if (!started) {
    listenForAllPlayers(handlePlayer);
    listenForLeavingPlayers(handleLeavingPlayer);
    started = true;
  }
}

export function stop() {
  if (started) {
    stopListeningForAllPlayers(handlePlayer);
    stopListeningForLeavingPlayers(handleLeavingPlayer);

    for (const channel of channels.values()) {
      channel.onmessage = null;
      channel.close();
    }
    channels.clear();

    for (const player of players) {
      clearSpeechBubblesFromPlayer(player, {playSwooshSound: false});
    }

    started = false;
  }
}

const popSoundInstances = [new Audio('/sounds/pop.mp3'), new Audio('/sounds/pop.mp3'), new Audio('/sounds/pop.mp3')];
function playPopSound() {
  const popSound = popSoundInstances.shift();
  popSound.play().catch(() => {});
  popSoundInstances.push(popSound);
}
const swooshSound = new Audio('/sounds/swoosh.mp3');

export function addSpeechBubbleToPlayer(player, text) {
  clearSpeechBubblesFromPlayer(player, {playSwooshSound: false});

  const speechBubble = document.createElement('div');
  speechBubble.classList.add('speech-bubble');
  speechBubble.textContent = text;
  player.appendChild(speechBubble);
  playPopSound();
}

export function clearSpeechBubblesFromPlayer(player, options={}) {
  if (options.playSwooshSound === undefined) options.playSwooshSound = true;

  const speechBubbles = [...player.querySelectorAll('.speech-bubble:not(.cleared)')];
  if (speechBubbles.length > 0) {
    for (const speechBubble of speechBubbles) {
      speechBubble.classList.add('cleared');
    }
    if (options.playSwooshSound) {
      swooshSound.play().catch(() => {});
    }
    setTimeout(() => {
      for (const speechBubble of speechBubbles) {
        speechBubble.remove();
      }
    }, 1000);
  }
}

export function clearAllSpeechBubbles() {
  const speechBubbles = [...document.querySelectorAll('.player .speech-bubble:not(.cleared)')];
  for (const speechBubble of speechBubbles) {
    speechBubble.classList.add('cleared');
    setTimeout(() => speechBubble.remove(), 500);
  }
}

function handlePlayer(player) {
  const channel = player.rtcConnection.createDataChannel('messaging');
  channels.set(player, channel);
  channel.onmessage = event => {
    const previousSpeechBubble = player.querySelector('.speech-bubble:not(.cleared)');
    if (previousSpeechBubble) {
      if (event.data === 'clear') {
        clearSpeechBubblesFromPlayer(player);
      } else {
        previousSpeechBubble.remove();
      }
    }
    if (event.data !== 'clear') {
      addSpeechBubbleToPlayer(player, event.data);
    }
  }
}

function handleLeavingPlayer(player) {
  const channel = channels.get(player);
  if (channel) {
    channel.onmessage = null;
    channel.close();
    channels.delete(player);
  }
}
