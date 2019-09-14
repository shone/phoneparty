async function anotherRoundScreen(messaging) {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things another-round-screen">
      <h1>Play another round?</h1>
    </div>
  `);
  const anotherRoundScreen = document.body.lastElementChild;
  messaging.setPossibleMessages(['yes', 'no']);
  const responses = new Map();
  await new Promise(resolve => {
    messaging.listenForMessage(function handleMessage(message, player) {
      responses.set(player, message);
      if (players.every(player => responses.get(player) === 'yes')) {
        resolve(true);
        messaging.stopListeningForMessage(handleMessage);
      }
    });
  });

  for (const player of players) {
    const speechBubble = player.querySelector('.speech-bubble:not(.cleared)');
    speechBubble.classList.add('highlight');
  }
  await waitForNSeconds(1);
  for (const player of players) {
    const speechBubble = player.querySelector('.speech-bubble:not(.cleared)');
    if (speechBubble) {
      speechBubble.classList.add('cleared');
      setTimeout(() => speechBubble.remove(), 500);
    }
  }
  await waitForNSeconds(1);

  anotherRoundScreen.remove();
  messaging.setPossibleMessages(Array.from('👍👎👌😀😃😄😁😆😅🤣😂🙂😉😇☺️😋😛🥰🤔🤫🤨😬😏😌😔😴😟🙁😯😥👋✌️🤞'));
}
