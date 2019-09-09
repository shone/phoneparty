"use strict";

function startAudienceMode() {

  let possibleMessages = ['👍', '👎', ':)', ':(', ':P'];

  const background = document.createElement('div');
  background.classList.add('audience-mode-background');
  document.body.appendChild(background);

  const messageCallbacks = new Set();

  const popSoundInstances = [new Audio('/sounds/pop.mp3'), new Audio('/sounds/pop.mp3'), new Audio('/sounds/pop.mp3')];
  function playPopSound() {
    const popSound = popSoundInstances.shift();
    popSound.play();
    popSoundInstances.push(popSound);
  }

  const swooshSound = new Audio('/sounds/swoosh.mp3');

  const channels = [];
  let transitionPositionTimer = null;
  const newPlayerTimers = new Set();
  let timeOnLastNewPlayer = null;
  acceptAllPlayers(player => {
    const channel = player.rtcConnection.createDataChannel('audienceMode');
    channels.push(channel);
    player.classList.add('bubble');
    player.classList.add('audience-mode');
    player.classList.remove('hide');
    if (!player.parentElement) {
      player.classList.add('new-player-in-audience');
      let revealDelayMs = 0;
      const now = performance.now();
      if (timeOnLastNewPlayer !== null && ((now - timeOnLastNewPlayer) < 80)) {
        revealDelayMs = (timeOnLastNewPlayer + 80) - now;
      }
      timeOnLastNewPlayer = now + revealDelayMs;
      player.classList.add('revealing');
      player.style.animationDelay = (revealDelayMs / 1000) + 's';
      newPlayerTimers.add(setTimeout(() => {
        player.classList.remove('new-player-in-audience');
        player.classList.remove('revealing');
        player.classList.add('wiggleable');
      }, 1500));
    } else {
      player.classList.add('wiggleable');
    }
    layoutPlayers();
    if (!player.parentElement) {
      document.body.appendChild(player);
    }
    player.video.play();
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
  });
  function handlePlayerLeaving() {
    layoutPlayers();
  }
  listenForLeavingPlayer(handlePlayerLeaving);

  function layoutPlayers() {
    if (players.length === 0) {
      return;
    }
    const playerSize = Math.min(100 / players.length, 10);
    for (const [index, player] of players.entries()) {
      player.classList.add('transition-position');
      player.style.top  = `calc(100vh - ${playerSize}vw)`;
      player.style.left = ((50 - ((playerSize * players.length) / 2)) + (playerSize * index)) + 'vw';
      player.style.width  = playerSize + 'vw';
      player.style.height = playerSize + 'vw';
      player.style.fontSize = playerSize + 'vw';
    }
    if (transitionPositionTimer) {
      clearTimeout(transitionPositionTimer);
    }
    transitionPositionTimer = setTimeout(() => {
      for (const player of players) {
        player.classList.remove('transition-position');
      }
    }, 1000);
  }

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
      background.remove();
      stopAcceptingPlayers();
      stopListeningForLeavingPlayer(handlePlayerLeaving);
      messageCallbacks.clear();
      for (const player of players) {
        player.classList.remove('audience-mode');
        player.classList.remove('transition-position');
        player.classList.remove('revealing');
        player.classList.remove('highlight-in-audience');
        player.classList.remove('new-player-in-audience');
        player.style.animationDelay = '';
      }
      if (transitionPositionTimer) {
        clearTimeout(transitionPositionTimer);
      }
      for (const timerId of newPlayerTimers) {
        clearTimeout(timerId);
      }
      for (const channel of channels) {
        channel.close();
      }
    }
  }
}
