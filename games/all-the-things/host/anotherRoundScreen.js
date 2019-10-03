async function anotherRoundScreen() {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things another-round-screen">
      <h1>Play another round?</h1>
    </div>
  `);
  const anotherRoundScreen = document.body.lastElementChild;

  // Wait for all players to confirm
  await new Promise(resolve => {
    const confirmedPlayers = new Set();
    const channels = [];
    function checkIfAllPlayersConfirmed() {
      if (players.length > 0 && players.every(p => confirmedPlayers.has(p))) {
        resolve();
        stopListeningForAllPlayers(handlePlayer);
        stopListeningForLeavingPlayer(checkIfAllPlayersConfirmed);
        for (const channel of channels) {
          channel.close();
        }
      }
    }
    function handlePlayer(player) {
      const channel = player.rtcConnection.createDataChannel('all-the-things_another-round');
      channel.onmessage = () => {
        confirmedPlayers.add(player);
        addSpeechBubbleToPlayer(player, '👍');
        checkIfAllPlayersConfirmed();
      }
      channels.push(channel);
    }
    listenForAllPlayers(handlePlayer);
    listenForLeavingPlayer(checkIfAllPlayersConfirmed);
  });
  for (const player of players) {
    const speechBubble = player.querySelector('.speech-bubble:not(.cleared)');
    if (speechBubble) {
      speechBubble.classList.add('highlight');
    }
  }

  await waitForNSeconds(1.5);

  for (const player of players) {
    const speechBubble = player.querySelector('.speech-bubble:not(.cleared)');
    if (speechBubble) {
      speechBubble.classList.remove('highlight');
      speechBubble.classList.add('cleared');
      setTimeout(() => speechBubble.remove(), 500);
    }
  }
  await waitForNSeconds(0.5);

  anotherRoundScreen.remove();
}
