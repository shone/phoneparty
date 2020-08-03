const emojis = ['👍','👎','👌','😄','😆','😅','🤣','😂','🙂','😉','😇','☺️','😛','🥰','🤔','🤫','🤨','😬','😏','😌','😴','😟','🙁','😯','😥','👋','✌️','🤞'];

const panel = document.createElement('div');
panel.id = 'messaging-panel';
panel.innerHTML = `
  <div class="emoji-buttons">
    ${emojis.map(emoji => `<button>${emoji}</button>`).join('')}
  </div>
  <div class="bottom-row">
    <button class="shout"></button>
    <button class="clear"></button>
  </div>
`;

const emojiButtons = panel.querySelector('.emoji-buttons');
const clearButton = panel.querySelector('.bottom-row .clear');
const shoutButton = panel.querySelector('.bottom-row .shout');

export default function handleMessaging(channel) {
  document.getElementById('panel-B').append(panel);

  emojiButtons.onpointerdown = event => {
    if (event.target.tagName === 'BUTTON') {
      event.preventDefault();
      channel.send(event.target.textContent);
    }
  }

  clearButton.onpointerdown = event => {
    event.preventDefault();
    channel.send('clear');
  }

  shoutButton.onpointerdown = event => {
    event.preventDefault();
    const pointerId = event.pointerId;
    channel.send('shout-on');
    function onPointerEnd(event) {
      if (event.pointerId !== pointerId) {
        return;
      }
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      channel.send('shout-off');
    }
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
  }

  channel.onclose = () => {
    emojiButtons.onpointerdown = null;
    clearButton.onpointerdown = null;
    shoutButton.onpointerdown = null;
    panel.remove();
  }
}
