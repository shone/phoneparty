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

export default function handleMessaging(channel) {
  document.getElementById('panel-B').append(panel);

  emojiButtons.onclick = event => {
    if (event.target.tagName === 'BUTTON') {
      event.preventDefault();
      channel.send(event.target.textContent);
    }
  }
  clearButton.onmousedown = clearButton.ontouchstart = event => {
    event.preventDefault();
    channel.send('clear');
  }

  channel.onclose = () => {
    emojiButtons.onclick = null;
    clearButton.onclick = null;
    clearButton.ontouchstart = null;
    panel.remove();
  }
}
