function startAudienceMode() {

  let possibleMessages = ['👍', '👎', ':)', ':(', ':P'];
  
  const background = document.createElement('div');
  background.classList.add('audience-mode-background');
  document.body.appendChild(background);

  const messageCallbacks = new Set();

  const popSoundInstances = [new Audio('/assets/pop.mp3'), new Audio('/assets/pop.mp3'), new Audio('/assets/pop.mp3')];
  function playPopSound() {
    const popSound = popSoundInstances.shift();
    popSound.play();
    popSoundInstances.push(popSound);
  }

  const swooshSound = new Audio('/assets/swoosh.mp3');

  const channels = [];
  let timerId = null;
  acceptAllPlayers(player => {
    const channel = player.rtcConnection.createDataChannel('audienceMode');
    channels.push(channel);
    player.classList.add('bubble');
    player.classList.add('audience-mode');
    player.classList.add('wiggleable');
    player.classList.remove('hide');
    layoutPlayers();
    if (!player.parentElement) {
      document.body.appendChild(player);
    }
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
    const playerWidth = Math.min(100 / players.length, 10)
    for (const [index, player] of players.entries()) {
      player.classList.add('transition-position');
      player.style.top = `calc(100vh - ${playerWidth}vw)`;
      player.style.left = ((50 - ((playerWidth * players.length) / 2)) + (playerWidth * index)) + 'vw';
      player.style.width  = playerWidth + 'vw';
      player.style.height = playerWidth + 'vw';
    }
    if (timerId) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      for (const player of players) {
        player.classList.remove('transition-position');
      }
    }, 1000);
  }

  return {
    listenForMessage: callback => {
      messageCallbacks.add(callback);
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
      for (const player of players) {
        player.classList.remove('audience-mode');
        player.classList.remove('transition-position');
      }
      if (timerId) {
        clearTimeout(timerId);
      }
      for (const channel of channels) {
        channel.close();
      }
    }
  }
}
