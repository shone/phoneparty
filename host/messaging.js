"use strict";

const popSoundInstances = [new Audio('/sounds/pop.mp3'), new Audio('/sounds/pop.mp3'), new Audio('/sounds/pop.mp3')];
function playPopSound() {
  const popSound = popSoundInstances.shift();
  popSound.play().catch(() => {});
  popSoundInstances.push(popSound);
}
const swooshSound = new Audio('/sounds/swoosh.mp3');

function addSpeechBubbleToPlayer(player, text) {
  const speechBubble = document.createElement('div');
  speechBubble.classList.add('speech-bubble');
  speechBubble.textContent = text;
  player.appendChild(speechBubble);
  playPopSound();
}

function clearSpeechBubblesFromPlayer(player) {
  const speechBubbles = [...player.querySelectorAll('.speech-bubble:not(.cleared)')];
  if (speechBubbles.length > 0) {
    for (const speechBubble of speechBubbles) {
      speechBubble.classList.add('cleared');
    }
    swooshSound.play().catch(() => {});
    setTimeout(() => {
      for (const speechBubble of speechBubbles) {
        speechBubble.remove();
      }
    }, 1000);
  }
}

const defaultPossibleMessages = ['👍', '👎', '👌', '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😇', '☺️', '😛', '🥰', '🤔', '🤫', '🤨', '😬', '😏', '😌', '😔', '😴', '😟', '🙁', '😯', '😥', '👋', '✌️', '🤞'];

function startMessaging(possibleMessages = defaultPossibleMessages) {
  const messageCallbacks = new Set();

  const channels = [];
  function handlePlayer(player) {
    const channel = player.rtcConnection.createDataChannel('messaging');
    channels.push(channel);
    channel.onopen = () => {
      channel.send(JSON.stringify(possibleMessages));
    }
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
      for (const callback of messageCallbacks) {
        callback(event.data, player);
      }
    }
  }
  listenForAllPlayers(handlePlayer);

  return {
    listenForMessage: callback => {
      messageCallbacks.add(callback);
    },
    stopListeningForMessage: callback => {
      messageCallbacks.delete(callback);
    },
    setPossibleMessages: messages => {
      possibleMessages = messages;
      for (const channel of channels) {
        if (channel.readyState === 'open') {
          channel.send(JSON.stringify(messages));
        }
      }
    },
    stop: () => {
      stopListeningForAllPlayers(handlePlayer);
      for (const channel of channels) {
        channel.close();
      }
    },
  }
}
