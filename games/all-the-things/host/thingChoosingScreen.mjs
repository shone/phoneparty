import {waitForNSeconds, waitForKeypress} from '/host/utils.mjs';
import {randomInArray} from '/shared/utils.mjs';

export default async function thingChoosingScreen() {
  // Thing choosing screen
  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things thing-choosing-screen">
      <h1>Choosing thing...</h1>
      <div class="timer">
        <div class="pie-slice pie-slice1 hide"></div>
        <div class="pie-slice pie-slice2 hide"></div>
        <div class="pie-slice pie-slice3 hide"></div>
        <div class="pie-slice pie-slice4 hide"></div>
        <div class="pie-slice pie-slice5 hide"></div>
        <div class="pie-slice pie-slice6 hide"></div>
        <div class="pie-slice pie-slice7 hide"></div>
        <div class="pie-slice pie-slice8 hide"></div>
        <div class="thinking-emoji"></div>
      </div>
    </div>
  `);
  const thingChoosingScreen = document.body.lastElementChild;

  const thingNames = ['bag', 'wallet', 'nose', 'toe', 'sock', 'food']; // 'person', 'underwear', 'key', 'shirt', 'pants'
  const thingElements = thingNames.map(thingName => {
    const element = document.createElement('div');
    element.classList.add('thing');
    element.dataset.name = thingName;
    const img = document.createElement('img');
    img.src = `/games/all-the-things/things/${thingName}.svg`;
    element.appendChild(img);
    document.body.appendChild(element);
    return element;
  });

  const stopJuggling = juggleElements(thingElements);

  await Promise.race([waitForNSeconds(4), waitForKeypress(' ')]);

  const thinkingEmoji = thingChoosingScreen.querySelector('.thinking-emoji');
  thinkingEmoji.classList.add('appear');

  await Promise.race([waitForNSeconds(2), waitForKeypress(' ')]);

  await countdownPieTimer(thingChoosingScreen.querySelector('.timer'), 5);

  stopJuggling();

  const chosenThingElement = getClosestThingToCenterOfScreen(thingElements);
  chosenThingElement.classList.add('chosen');

  await Promise.race([waitForNSeconds(1), waitForKeypress(' ')]);

  thingChoosingScreen.classList.add('fade-out');
  setTimeout(() => thingChoosingScreen.remove(), 1000);

  for (const thingElement of thingElements) {
    if (thingElement !== chosenThingElement) {
      thingElement.remove();
    }
  }

  chosenThingElement.classList.add('present-in-center');

  const thingLabel = document.createElement('label');
  thingLabel.classList.add('thing-label');
  thingLabel.textContent = chosenThingElement.dataset.name;
  chosenThingElement.appendChild(thingLabel);

  await Promise.race([waitForNSeconds(2), waitForKeypress(' ')]);

  chosenThingElement.classList.remove('chosen');  
  chosenThingElement.classList.add('show-in-top-right');
  chosenThingElement.classList.remove('present-in-center');

  return chosenThingElement;
}

export function chooseThing(thingName) {
  const element = document.createElement('div');
  element.classList.add('thing');
  element.dataset.name = thingName;
  const img = document.createElement('img');
  img.src = `/games/all-the-things/things/${thingName}.svg`;
  element.appendChild(img);
  element.classList.add('show-in-top-right');
  document.body.appendChild(element);
  return element;
}

function juggleElements(elements) {
  for (const element of elements) {
    element.momentum = {x: 0, y: 0};
    element.style.left = (Math.random() * 100) + 'vw';
    element.style.bottom = '-10vh';
  }
  let lastTimestamp = performance.now();
  let frameId = window.requestAnimationFrame(function callback(timestamp) {
    const delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    const gravity = 0.00012;

    for (const element of elements) {
      element.momentum.y -= gravity * delta;
      element.style.left    = (parseFloat(element.style.left)    + (element.momentum.x * delta)) + 'vw';
      element.style.bottom  = (parseFloat(element.style.bottom)  + (element.momentum.y * delta)) + 'vh';
      if (parseFloat(element.style.bottom) < -10) {
        element.style.bottom = '-10vh';
        element.momentum.y = 0;
      }
      if (parseFloat(element.style.left) < 0) {
        element.style.left = '0vw';
        element.momentum.x = -element.momentum.x;
      } else if (parseFloat(element.style.left) > 100) {
        element.style.left = '100vw';
        element.momentum.x = -element.momentum.x;
      }
    }

    frameId = window.requestAnimationFrame(callback);
  });

  const throwInterval = setInterval(() => {
    const element = randomInArray(elements.filter(element => parseFloat(element.style.bottom) < 0));
    if (element) {
      element.momentum.x = (Math.random() - 0.5) * 0.02;
      element.momentum.y = 0.1 + (Math.random() * 0.05);
    }
  }, 1000);

  return function stopJuggling() {
    clearInterval(throwInterval);
    window.cancelAnimationFrame(frameId);
  }
}

async function countdownPieTimer(timerElement, seconds) {
  let currentPieSlice = 1;
  while (currentPieSlice <= 8) {
    const result = await Promise.race([waitForNSeconds(seconds / 8), waitForKeypress(' ')]);
    if (result && result.type === 'keypress') {
      break;
    }
    timerElement.querySelector(`.pie-slice${currentPieSlice}`).classList.remove('hide');
    currentPieSlice++;
  }

  for (const slice of timerElement.getElementsByClassName('pie-slice')) {
    slice.classList.remove('hide');
  }
}

function getClosestThingToCenterOfScreen(thingElements) {
  let closestThing = null;
  let closestThingDistance = null;
  for (const thingElement of thingElements) {
    const deltaX = parseFloat(thingElement.style.left)   - 50;
    const deltaY = parseFloat(thingElement.style.bottom) - 50;
    const distance = (deltaX*deltaX) + (deltaY*deltaY);
    if (!closestThingDistance || (distance < closestThingDistance)) {
      closestThingDistance = distance;
      closestThing = thingElement;
    }
  }
  return closestThing;
}
