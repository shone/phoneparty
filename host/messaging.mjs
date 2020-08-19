import SpeechBubble from '/host/speech-bubble.mjs';

export default function startMessaging(channel, container) {
  let speechBubbles = [];

  function clearSpeechBubbles() {
    if (speechBubbles.length > 0) {
      const bubblesToClear = speechBubbles;
      speechBubbles = [];
      bubblesToClear.forEach(speechBubble => speechBubble.classList.add('cleared'));
      setTimeout(() => {
        bubblesToClear.forEach(speechBubble => speechBubble.remove());
      }, 1000);
    }
  }

  function addSpeechBubble(text) {
    const speechBubble = new SpeechBubble(text);
    container.append(speechBubble);
    speechBubbles.push(speechBubble);
  }

  function onmessage({data}) {
    const command = JSON.parse(data);
    switch (command.type) {
      case 'message':
        while (speechBubbles.length > 0) speechBubbles.pop().remove();
        addSpeechBubble(command.message);
        playPopSound();
        break;
      case 'clear':
        if (speechBubbles.length > 0) {
          clearSpeechBubbles();
          swooshSound.play().catch(() => {});
        }
        break;
      case 'shout': container.classList.toggle('shout', command.shout); break;
    }
  }

  channel.addEventListener('message', onmessage);
  channel.addEventListener('close', () => {
    channel.removeEventListener('message', onmessage);
    while (speechBubbles.length > 0) speechBubbles.pop().remove();
  }, {once: true});
}

const popSoundInstances = [new Audio('/sounds/pop.mp3'), new Audio('/sounds/pop.mp3'), new Audio('/sounds/pop.mp3')];
function playPopSound() {
  const popSound = popSoundInstances.shift();
  popSound.play().catch(() => {});
  popSoundInstances.push(popSound);
}
const swooshSound = new Audio('/sounds/swoosh.mp3');
