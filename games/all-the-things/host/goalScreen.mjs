import {waitForNSeconds, waitForKeypress} from '/shared/utils.mjs';
import {players, listenForAllPlayers, stopListeningForAllPlayers, listenForLeavingPlayer, stopListeningForLeavingPlayer} from '/host/players.mjs';
import {addSpeechBubbleToPlayer} from '/host/messaging.mjs';

export default async function goalScreen(chosenThingElement) {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things goal-screen">
      <h1>THE GOAL:</h1>
      <div class="goal-container">
        <span class="goal-text">
          <div class="find-a-peice-of">Find a peice of</div>
          <div class="thing-text">${chosenThingElement.dataset.name}</div>
        </span>
        <span class="all-the-things phone">
          <div class="phone-background"></div>
          <div class="phone-foreground"></div>
        </span>
      </div>
      <h2>Ready to start looking?</h2>
    </div>
  `);
  const goalScreen = document.body.lastElementChild;
  const phoneBackground = goalScreen.querySelector('.phone-background');
  const phoneBackgroundContent = document.createElement('img');
  phoneBackgroundContent.src = chosenThingElement.querySelector('img').src;
  phoneBackgroundContent.dataset.name = chosenThingElement.dataset.name;
  phoneBackgroundContent.classList.add('thing');
  phoneBackground.appendChild(phoneBackgroundContent);

  await Promise.race([waitForNSeconds(1), waitForKeypress(' ')]);
  goalScreen.querySelector('h1').classList.add('fade-in-text');

  await Promise.race([waitForNSeconds(1.2), waitForKeypress(' ')]);
  goalScreen.querySelector('.goal-text').classList.add('fade-in-text');

  await Promise.race([waitForNSeconds(0.5), waitForKeypress(' ')]);
  goalScreen.querySelector('.phone').classList.add('reveal');

  await Promise.race([waitForNSeconds(4.5), waitForKeypress(' ')]);

  for (const player of players) {
    const speechBubble = player.querySelector('.speech-bubble:not(.cleared)');
    if (speechBubble) {
      speechBubble.classList.add('cleared');
      setTimeout(() => speechBubble.remove(), 500);
    }
  }

  goalScreen.querySelector('h2').classList.add('fade-in-text');

  // Wait for players to be ready
  await new Promise(resolve => {
    const confirmedPlayers = new Set();
    const channels = [];
    function checkIfPlayersReady() {
      if (players.length >= 2 && players.every(p => confirmedPlayers.has(p))) {
        resolve();
        stopListeningForAllPlayers(handlePlayer);
        stopListeningForLeavingPlayer(checkIfPlayersReady);
        for (const channel of channels) {
          channel.close();
        }
      }
    }
    function handlePlayer(player) {
      const channel = player.rtcConnection.createDataChannel('all-the-things_ready-to-start-looking');
      channel.onmessage = () => {
        confirmedPlayers.add(player);
        addSpeechBubbleToPlayer(player, '👍');
        checkIfPlayersReady();
      }
      channels.push(channel);
    }
    listenForAllPlayers(handlePlayer);
    listenForLeavingPlayer(checkIfPlayersReady);
  });

  // Highlight all the 'thumbs up' speech bubbles
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

  goalScreen.remove();
}
