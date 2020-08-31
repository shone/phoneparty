const emojis = [
  '👍','👎','👌','😄','😆','😅','🤣'
  ,'😂','🙂','😉','😇','☺️','😛','🥰',
  '🤔','🤫','🤨','😬','😏','😌','😴',
  '😟','🙁','😯','😥','👋','✌️','🤞'
];

export default function startMessaging(channel) {
  const panel = document.createElement('div');
  panel.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/player/messaging.css">
    <link rel="stylesheet" href="/common/base.css">

    <div id="emoji-buttons">
      ${emojis.map(emoji => `<button>${emoji}</button>`).join('')}
    </div>

    <div id="bottom-row">
      <button id="shout-button"></button>
      <button id="clear-button"></button>
    </div>
  `;
  document.getElementById('panel-B').append(panel);

  const emojiButtons = panel.shadowRoot.getElementById('emoji-buttons');
  const clearButton  = panel.shadowRoot.getElementById('clear-button');
  const shoutButton  = panel.shadowRoot.getElementById('shout-button');

  emojiButtons.onpointerdown = event => {
    if (event.target.tagName === 'BUTTON') {
      event.preventDefault();
      channel.send(JSON.stringify({type: 'message', message: event.target.textContent}));
    }
  }

  clearButton.onpointerdown = event => {
    event.preventDefault();
    channel.send(JSON.stringify({type: 'clear'}));
  }

  shoutButton.onpointerdown = event => {
    event.preventDefault();

    if (shoutButton.onpointerup) return;
    if (event.button && event.button > 0) return;

    const pointerId = event.pointerId;
    shoutButton.setPointerCapture(pointerId);

    channel.send(JSON.stringify({type: 'shout', shout: true}));

    shoutButton.onpointerup = shoutButton.onpointercancel = event => {
      if (event.pointerId !== pointerId) return;
      shoutButton.onpointerup = null;
      shoutButton.onpointercancel = null;
      channel.send(JSON.stringify({type: 'shout', shout: false}));
    }
  }

  channel.addEventListener('close', () => panel.remove(), {once: true});
}
