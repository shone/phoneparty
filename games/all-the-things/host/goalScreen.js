"use strict";

async function goalScreen(chosenThingElement, messaging) {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things goal-screen">
      <h1>THE GOAL:</h1>
      <div class="goal-container">
        <span class="goal-text">
          <div class="find-a-peice-of">Find a peice of</div>
          <div class="thing-text"></div>
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
  goalScreen.querySelector('.thing-text').textContent = chosenThingElement.dataset.name;
  const phoneBackground = goalScreen.querySelector('.phone-background');
  const phoneBackgroundContent = document.createElement('img');
  phoneBackgroundContent.src = chosenThingElement.querySelector('img').src;
  phoneBackgroundContent.dataset.name = chosenThingElement.dataset.name;
  phoneBackgroundContent.classList.add('thing');
  phoneBackground.appendChild(phoneBackgroundContent);

  await Promise.race([waitForNSeconds(2), waitForKeypress(' ')]);
  goalScreen.querySelector('h1').classList.add('fade-in-text');

  await Promise.race([waitForNSeconds(2), waitForKeypress(' ')]);
  goalScreen.querySelector('.goal-text').classList.add('fade-in-text');

  await Promise.race([waitForNSeconds(2), waitForKeypress(' ')]);
  goalScreen.querySelector('.phone').classList.add('reveal');

  await Promise.race([waitForNSeconds(7), waitForKeypress(' ')]);
  
  goalScreen.querySelector('h2').classList.add('fade-in-text');

  for (const player of players) {
    const speechBubble = player.querySelector('.speech-bubble:not(.cleared)');
    if (speechBubble) {
      speechBubble.classList.add('cleared');
      setTimeout(() => speechBubble.remove(), 500);
    }
  }

  messaging.setPossibleMessages(['👍', '👎']);

  await new Promise(resolve => {
    messaging.listenForMessage((message, player) => {
      player.allTheThingsGoalResponse = message;
      if (players.every(p => p.allTheThingsGoalResponse === '👍')) {
        resolve();
      }
    });
  });

  for (const player of players) {
    const speechBubble = player.querySelector('.speech-bubble:not(.cleared)');
    speechBubble.classList.add('highlight');
  }

  await waitForNSeconds(1.5);

  for (const player of players) {
    const speechBubble = player.querySelector('.speech-bubble:not(.cleared)');
    speechBubble.classList.remove('highlight');
    speechBubble.classList.add('cleared');
    setTimeout(() => speechBubble.remove(), 500);
  }
  await waitForNSeconds(0.5);

  goalScreen.remove();
}
