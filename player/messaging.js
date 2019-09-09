"use strict";

function handleMessaging(channel) {
  const messagingPanel = document.getElementById('messaging-panel');
  messagingPanel.classList.add('active');

  const clearButton = messagingPanel.querySelector('.clear-button');

  channel.onmessage = event => {
    const existingSpeechBubbles = [...messagingPanel.getElementsByClassName('speech-bubble')];
    for (const speechBubble of existingSpeechBubbles) {
      speechBubble.remove();
    }
    const possibleMessages = JSON.parse(event.data);
    const now = performance.now();
    const revealDurationSecs = 0.5;
    for (const [index, message] of possibleMessages.entries()) {
      const speechBubble = document.createElement('div');
      speechBubble.classList.add('speech-bubble');
      speechBubble.textContent = message;
      speechBubble.style.animationDelay = (revealDurationSecs * (index / possibleMessages.length)) + 's';
      messagingPanel.appendChild(speechBubble);
    }
  }

  messagingPanel.onmousedown = messagingPanel.ontouchstart = event => {
    if (event.target.classList.contains('speech-bubble')) {
      event.preventDefault();
      channel.send(event.target.textContent);
      const selectedBubble = messagingPanel.querySelector('.speech-bubble.selected');
      if (selectedBubble) {
        selectedBubble.classList.remove('selected');
      }
      event.target.classList.add('selected');
    }
  }
  clearButton.onmousedown = clearButton.ontouchstart = event => {
    event.preventDefault();
    channel.send('clear');
    const selectedBubble = messagingPanel.querySelector('.speech-bubble.selected');
    if (selectedBubble) {
      selectedBubble.classList.remove('selected');
    }
  }

  channel.onclose = () => {
    messagingPanel.classList.remove('active');
    for (const speechBubble of [...messagingPanel.getElementsByClassName('speech-bubble')]) {
      speechBubble.remove();
    }
  }
}
