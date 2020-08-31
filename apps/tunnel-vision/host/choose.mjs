import {
  waitForNSeconds,
  waitForKeypress,
  randomInArray
} from '/common/utils.mjs';

import routes from '/host/routes.mjs';

import Audience from '/host/audience.mjs';
import startMessaging from '/host/messaging.mjs';

routes['#apps/tunnel-vision/choose'] = async function choose(routeContext) {
  const {waitForEnd, createChannel, listenForPlayers} = routeContext;

  const container = document.createElement('div');
  container.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/apps/tunnel-vision/host/choose.css">

    <div id="centered-content">
      <h1>Choosing thing...</h1>

      <div id="timer">
        <div class="pie-slice hide"></div>
        <div class="pie-slice hide"></div>
        <div class="pie-slice hide"></div>
        <div class="pie-slice hide"></div>
        <div class="pie-slice hide"></div>
        <div class="pie-slice hide"></div>
        <div class="pie-slice hide"></div>
        <div class="pie-slice hide"></div>
        <div class="thinking-emoji"></div>
      </div>

      <div id="juggle-field"></div>
    </div>
  `;
  document.body.append(container);

  const existingThingIndicator = document.querySelector('.tunnel-vision.thing.show-in-top-right');
  if (existingThingIndicator) {
    existingThingIndicator.remove();
  }

  const audience = new Audience(routeContext);
  container.shadowRoot.append(audience);

  listenForPlayers(player => {
    const channel = createChannel(player, 'messaging');
    startMessaging(channel, audience.getPlayerBubble(player));
  });

  await waitForNSeconds(0.5);

  const thinkingEmoji = container.shadowRoot.querySelector('.thinking-emoji');
  thinkingEmoji.classList.add('appear');

  await Promise.race([waitForNSeconds(1), waitForKeypress(' ')]);

  const juggleField = container.shadowRoot.getElementById('juggle-field');

  const thingNames = ['bag', 'wallet', 'nose', 'toe', 'sock', 'food']; // 'person', 'underwear', 'key', 'shirt', 'pants'
  juggleField.innerHTML = thingNames.map(thingName => `
    <div class="thing" data-name="${thingName}">
      <img src="/apps/tunnel-vision/things/${thingName}.svg">
    </div>
  `).join('');
  const thingElements = [...juggleField.children];

  const stopJuggling = juggleElements(thingElements);

  await Promise.race([waitForNSeconds(3), waitForKeypress(' ')]);

  const waitForCountdown = countdownPieTimer(container.shadowRoot.getElementById('timer'), 5);

  const result = await Promise.race([waitForCountdown, waitForEnd()]);

  stopJuggling();

  if (result === 'route-ended') {
    container.remove();
    return;
  }

  const chosenThingElement = getClosestThingToCenterOfScreen(thingElements);
  chosenThingElement.classList.add('chosen');

  // Send thing name to all players
  listenForPlayers(player => {
    createChannel(player, 'thing').onopen = ({target}) => target.send(chosenThingElement.dataset.name);
  });

  await Promise.race([waitForNSeconds(1), waitForKeypress(' ')]);

  for (const thingElement of thingElements) {
    if (thingElement !== chosenThingElement) {
      thingElement.remove();
    }
  }

  container.shadowRoot.querySelector('h1').style.animation = '1s fade-out forwards';
  container.shadowRoot.getElementById('timer').style.animation = '1s fade-out forwards';

  chosenThingElement.classList.add('present-in-center');
  chosenThingElement.style.left = null;
  chosenThingElement.style.bottom = null;

  const thingLabel = document.createElement('label');
  thingLabel.classList.add('thing-label');
  thingLabel.textContent = chosenThingElement.dataset.name;
  chosenThingElement.appendChild(thingLabel);

  await Promise.race([waitForNSeconds(2), waitForKeypress(' ')]);

  container.classList.add('fade-out');
  await waitForNSeconds(1);

  return `#apps/tunnel-vision/goal?thing=${chosenThingElement.dataset.name}`;
}

function juggleElements(elements) {
  const gravity = 0.00012;
  const floorY = -20;

  for (const element of elements) {
    element.momentum = {x: 0, y: 0};
    element.position = {x: Math.random() * 100, y: floorY};
  }
  let lastTimestamp = performance.now();
  let frameId = window.requestAnimationFrame(function callback(timestamp) {
    const delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    for (const element of elements) {
      element.momentum.y -= gravity * delta;
      element.position.x += element.momentum.x * delta;
      element.position.y += element.momentum.y * delta;
      if (element.position.y < floorY) {
        element.position.y = floorY;
        element.momentum.y = 0;
      }
      if (element.position.x < 0) {
        element.position.x = 0;
        element.momentum.x = -element.momentum.x;
      } else if (element.position.x > 95) {
        element.position.x = 95;
        element.momentum.x = -element.momentum.x;
      }
      element.style.left   = `${element.position.x}%`;
      element.style.bottom = `${element.position.y}%`;
    }

    frameId = window.requestAnimationFrame(callback);
  });

  // Every second, throw a random element on the floor into the air
  const throwInterval = setInterval(() => {
    const element = randomInArray(elements.filter(element => element.position.y < 0));
    if (element) {
      element.momentum.x = (Math.random() - 0.5) * 0.02;
      element.momentum.y = 0.1 + (Math.random() * 0.06);
    }
  }, 1000);

  return function stopJuggling() {
    clearInterval(throwInterval);
    window.cancelAnimationFrame(frameId);
  }
}

async function countdownPieTimer(timerElement, seconds) {
  const slices = [...timerElement.getElementsByClassName('pie-slice')];

  for (let i=0; i < slices.length; i++) {
    const result = await Promise.race([waitForNSeconds(seconds / slices.length), waitForKeypress(' ')]);
    if (result && result.type === 'keypress') {
      break;
    }
    slices[i].classList.remove('hide');
  }

  slices.forEach(slice => slice.classList.remove('hide'));
}

function getClosestThingToCenterOfScreen(thingElements) {
  let closestThing = null;
  let closestThingDistance = null;
  for (const thingElement of thingElements) {
    const deltaX = thingElement.position.x - 50;
    const deltaY = thingElement.position.y - 50;
    const distance = (deltaX*deltaX) + (deltaY*deltaY);
    if (!closestThingDistance || (distance < closestThingDistance)) {
      closestThingDistance = distance;
      closestThing = thingElement;
    }
  }
  return closestThing;
}
