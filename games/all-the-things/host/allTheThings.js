"use strict";

async function AllTheThings() {
  document.body.style.backgroundColor = '#98947f';
  await waitForNSeconds(1);

  for (const player of players) {
    player.classList.add('hide');
  }
  
  // Title screen
  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things title-screen">
      <div class="title-image"></div>
      <h1>All The Things</h1>
      <h2>the object finding game</h2>
    </div>
  `);
  const titleScreen = document.body.lastElementChild;
  await waitForKeypress(' ');
  titleScreen.classList.add('finished');
  setTimeout(() => { titleScreen.remove() }, 2000);

  await Promise.race([waitForNSeconds(2), waitForKeypress(' ')]);

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

  const things = [
    {name: 'bag'},
    {name: 'wallet'},
  ];//, 'underwear', 'sock', 'key', 'shirt', 'pants'];

  const colors = ['green', 'purple', 'orange', 'grey'];

  await Promise.all(things.map(async function(thing) {
    const response = await fetch(`/games/all-the-things/things/${thing.name}.svg`);
    thing.svgString = await response.text();
  }));

  const thingElements = [];
  for (const thing of things) {
    for (const color of colors) {
      const thingElement = document.createElement('div');
      const parser = new DOMParser();
      const svg = parser.parseFromString(thing.svgString, 'image/svg+xml').documentElement;
      for (const colorableElement of svg.getElementsByClassName('colorable')) {
        colorableElement.style.fill = color;
      }
      thingElement.appendChild(svg);
      thingElement.classList.add('thing');
      thingElement.thing = thing;
      thingElement.color = color;
      thingElement.style.left = (Math.random() * 100) + 'vw';
      thingElement.style.bottom = '-10vh';
      document.body.appendChild(thingElement);
      thingElements.push(thingElement);
    }
  }

  const stopJuggling = juggleElements(thingElements);

  await Promise.race([waitForNSeconds(3), waitForKeypress(' ')]);
  
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
  thingLabel.textContent = `${chosenThingElement.color} ${chosenThingElement.thing.name}`;
  document.body.appendChild(thingLabel);

  await Promise.race([waitForNSeconds(2), waitForKeypress(' ')]);

  chosenThingElement.classList.remove('chosen');  
  chosenThingElement.classList.add('show-in-top-right');
  chosenThingElement.classList.remove('present-in-center');
  thingLabel.remove();

  // Goal screen
  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things goal-screen">
      <h1>THE GOAL:</h1>
      <div class="goal-container">
        <span class="goal-text">
          <div class="find-a-peice-of">You must find a peice of</div>
          <div class="thing-text"></div>
        </span>
        <span class="phone">
          <div class="phone-background"></div>
          <div class="phone-foreground"></div>
        </span>
      </div>
      <h2>Ready to start looking?</h2>
      <div class="players-container"></div>
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

  const playersContainer = goalScreen.querySelector('.players-container');

  for (const [index, player] of players.entries()) {
    player.classList.remove('hide');
    player.style.transform = '';
    playersContainer.appendChild(player);
    setTimeout(() => player.classList.add('slide-in'), index * 500);
  }

  const goalConfirmations = players.map(player => {
    return [player, player.rtcConnection.createDataChannel('all-the-things_goal-confirm')];
  });
  
  function waitForPlayerGoalConfirm(player, channel) {
    return new Promise(resolve => {
      channel.onmessage = event => {
        const speechBubble = document.createElement('div');
        speechBubble.classList.add('speech-bubble');
        speechBubble.textContent = event.data;
        player.appendChild(speechBubble);
        if (event.data === 'yes') {
          resolve();
        }
      }
    });
  }
  
  await Promise.all(goalConfirmations.map(playerAndChannel => waitForPlayerGoalConfirm(playerAndChannel[0], playerAndChannel[1])));

  for (const [player, channel] of goalConfirmations) {
    channel.close();
    player.querySelector('.speech-bubble').remove();
  }

  goalScreen.remove();

  // Photo taking screen
  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things photo-taking-screen">
      <h1>Take your photos!</h1>
      <div class="players"></div>
    </div>
  `);
  const photoTakingScreen = document.body.lastElementChild;
  await new Promise(resolve => {
    for (const player of players) {
      photoTakingScreen.querySelector('.players').appendChild(player);
      const cropGuide = document.createElement('div');
      cropGuide.classList.add('crop-guide');
      player.appendChild(cropGuide);
      const photoChannel = player.rtcConnection.createDataChannel('all-the-things_photo');
      photoChannel.onmessage = async function(event) {
        const arrayBuffer = event.data;
        const blob = new Blob([arrayBuffer], {type: 'image/jpeg'});
        const image = new Image();
        image.src = URL.createObjectURL(blob);
        player.appendChild(image);
        player.classList.add('taken-photo');
        if (players.every(player => player.classList.contains('taken-photo'))) {
          resolve();
        }

//         const croppedCanvas = document.createElement('canvas');
//         croppedCanvas.width  = croppedSize;
//         croppedCanvas.height = croppedSize;
//         const croppedContext = croppedCanvas.getContext('2d');
//         croppedContext.drawImage(
//           image,
//           (image.width - croppedSize) / 2, (image.height - croppedSize) / 2, // source position
//           croppedSize, croppedSize, // source dimensions
//           0, 0, // destination position
//           croppedSize, croppedSize // destination dimensions
//         )
// 
//         const croppedBlob = await new Promise(resolve => croppedCanvas.toBlob(resolve, 'image/jpeg'));
//         const croppedArrayBuffer = await new Response(croppedBlob).arrayBuffer();
//         playerImages.push({
//           playerId: player.id,
//           croppedImage: croppedArrayBuffer
//         });
      }
    }
  });
  photoTakingScreen.querySelector('h1').textContent = 'All photos taken';
  await waitForKeypress(' ');

  for (const player of players) {
    player.classList.add('hide');
  }

  for (const player of players) {
    player.classList.add('presenting-photo');
    player.classList.remove('hide');
    await waitForKeypress(' ');
    player.classList.add('reveal-full-photo');
    await waitForKeypress(' ');
    player.classList.add('hide');
    player.classList.remove('presenting-photo');
  }
}

function juggleElements(elements) {
  for (const element of elements) {
    element.momentum = {x: 0, y: 0};
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
