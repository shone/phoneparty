"use strict";

function startMessaging(possibleMessages = []) {
  const messageCallbacks = new Set();

  const popSoundInstances = [new Audio('/sounds/pop.mp3'), new Audio('/sounds/pop.mp3'), new Audio('/sounds/pop.mp3')];
  function playPopSound() {
    const popSound = popSoundInstances.shift();
    popSound.play();
    popSoundInstances.push(popSound);
  }

  const swooshSound = new Audio('/sounds/swoosh.mp3');

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
          swooshSound.play();
          previousSpeechBubble.classList.add('cleared');
          setTimeout(() => previousSpeechBubble.remove(), 1000);
        } else {
          previousSpeechBubble.remove();
        }
      }
      if (event.data !== 'clear') {
        const speechBubble = document.createElement('div');
        speechBubble.classList.add('speech-bubble');
        speechBubble.textContent = event.data;
        player.appendChild(speechBubble);
        playPopSound();
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
    },
  }
}
