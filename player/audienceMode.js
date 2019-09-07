function handleAudienceMode(channel) {
  const audienceMode = document.createElement('div');
  audienceMode.classList.add('audience-mode');

  const clearButton = document.createElement('button');
  clearButton.classList.add('clear-button');
  clearButton.textContent = 'clear';

  audienceMode.appendChild(clearButton);
  document.body.appendChild(audienceMode);
  channel.onmessage = event => {
    const existingSpeechBubbles = [...audienceMode.getElementsByClassName('speech-bubble')];
    for (const speechBubble of existingSpeechBubbles) {
      speechBubble.remove();
    }
    const possibleMessages = JSON.parse(event.data);
    for (const message of possibleMessages) {
      const speechBubble = document.createElement('div');
      speechBubble.classList.add('speech-bubble');
      speechBubble.textContent = message;
      audienceMode.appendChild(speechBubble);
    }
  }

  audienceMode.onmousedown = audienceMode.ontouchstart = event => {
    if (event.target.classList.contains('speech-bubble')) {
      event.preventDefault();
      channel.send(event.target.textContent);
      const selectedBubble = audienceMode.querySelector('.speech-bubble.selected');
      if (selectedBubble) {
        selectedBubble.classList.remove('selected');
      }
      event.target.classList.add('selected');
    }
  }
  clearButton.onmousedown = clearButton.ontouchstart = event => {
    event.preventDefault();
    channel.send('clear');
    const selectedBubble = audienceMode.querySelector('.speech-bubble.selected');
    if (selectedBubble) {
      selectedBubble.classList.remove('selected');
    }
  }

  channel.onclose = () => {
    audienceMode.remove();
  }
}
