"use strict";

function handleMessaging(channel) {
  const messagingPanel = document.getElementById('messaging-panel');
  const container = document.createElement('div');
  container.classList.add('container');
  container.classList.add('active');
  container.insertAdjacentHTML('beforeend', `
    <button class="clear-button push-button">clear</button>
    <div class="options"></div>
  `);
  messagingPanel.appendChild(container);

  const clearButton = container.querySelector('.clear-button');
  const options = container.querySelector('.options');

  channel.onmessage = event => {
    const existingSpeechBubbles = [...options.getElementsByClassName('speech-bubble')];
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
      options.appendChild(speechBubble);
    }
  }

  options.onclick = event => {
    if (event.target.classList.contains('speech-bubble')) {
      event.preventDefault();
      channel.send(event.target.textContent);
      const selectedBubble = options.querySelector('.speech-bubble.selected');
      if (selectedBubble) {
        selectedBubble.classList.remove('selected');
      }
      event.target.classList.add('selected');
    }
  }
  clearButton.onmousedown = clearButton.ontouchstart = event => {
    event.preventDefault();
    channel.send('clear');
    const selectedBubble = container.querySelector('.speech-bubble.selected');
    if (selectedBubble) {
      selectedBubble.classList.remove('selected');
    }
  }

  channel.onclose = () => {
    container.classList.remove('active');
    setTimeout(() => {
      container.remove();
    });
  }
}
