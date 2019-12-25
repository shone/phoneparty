export default function handleMessaging(channel) {
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

  const existingSpeechBubbles = [...options.getElementsByClassName('speech-bubble')];
  for (const speechBubble of existingSpeechBubbles) {
    speechBubble.remove();
  }

  const possibleMessages = ['👍', '👎', '👌', '😄', '😆', '😅', '🤣', '😂', '🙂', '😉', '😇', '☺️', '😛', '🥰', '🤔', '🤫', '🤨', '😬', '😏', '😌', '😴', '😟', '🙁', '😯', '😥', '👋', '✌️', '🤞'];
  const revealDurationSecs = 0.8;
  for (const [index, message] of possibleMessages.entries()) {
    options.insertAdjacentHTML('beforeend', `
      <div class="speech-bubble" style="animation-delay: ${0.7 + (revealDurationSecs * (index / possibleMessages.length))}s">
        ${message}
      </div>
    `);
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
