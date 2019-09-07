"use strict";

async function goalScreen(chosenThingElement, audience) {
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
  goalScreen.querySelector('.thing-text').textContent = `${chosenThingElement.color} ${chosenThingElement.thing.name}`;
  const phoneBackground = goalScreen.querySelector('.phone-background');
  const parser = new DOMParser();
  const phoneBackgroundContent = parser.parseFromString(chosenThingElement.thing.svgString, 'image/svg+xml').documentElement;
  for (const colorableElement of phoneBackgroundContent.getElementsByClassName('colorable')) {
    colorableElement.style.fill = chosenThingElement.color;
  }
  phoneBackground.appendChild(phoneBackgroundContent);
  phoneBackgroundContent.classList.remove('hide');
  phoneBackgroundContent.classList.remove('show-in-top-right');
  phoneBackgroundContent.classList.remove('chosen');
  phoneBackgroundContent.style.left   = '';
  phoneBackgroundContent.style.bottom = '';

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

  audience.setPossibleMessages(['👍', '👎']);

  await new Promise(resolve => {
    audience.listenForMessage((message, player) => {
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
