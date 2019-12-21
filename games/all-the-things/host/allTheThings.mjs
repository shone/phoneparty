import titleScreen from './titleScreen.mjs';
import thingChoosingScreen, {chooseThing} from './thingChoosingScreen.mjs';
import goalScreen from './goalScreen.mjs';
import photoTakingScreen from './photoTakingScreen.mjs';
import presentingPhotosScreen from './presentingPhotosScreen.mjs';
import anotherRoundScreen from './anotherRoundScreen.mjs';

import * as audienceMode from '/host/audienceMode.mjs';
import * as messaging from '/host/messaging.mjs';
import {players, listenForAllPlayers, stopListeningForAllPlayers, listenForNewPlayers, stopListeningForNewPlayers, listenForLeavingPlayer, stopListeningForLeavingPlayer} from '/host/players.mjs';
import {waitForNSeconds} from '/shared/utils.mjs';

export async function AllTheThings() {
  let chosenThingElement = null;

  const channels = [];
  function handlePlayer(player) {
    const channel = player.rtcConnection.createDataChannel('all-the-things');
    channels.push(channel);
    channel.onopen = () => {
      if (chosenThingElement !== null) {
        channel.send(chosenThingElement.dataset.name);
      }
    }
  }
  listenForAllPlayers(handlePlayer);

  document.body.style.backgroundColor = '#98947f';
  await waitForNSeconds(1);

  audienceMode.start();
  messaging.start();

  await titleScreen();

  while(true) {
    chosenThingElement = await thingChoosingScreen();
//     chosenThingElement = chooseThing('sock');
    for (const channel of channels) {
      if (channel.readyState === 'open') {
        channel.send(chosenThingElement.dataset.name);
      }
    }

    messaging.stop();

    await goalScreen(chosenThingElement);

    audienceMode.stop();

    const [playerPhotos, playerGrid] = await photoTakingScreen();

    audienceMode.start();

    await presentingPhotosScreen(playerPhotos);

    for (const channel of channels) {
      if (channel.readyState === 'open') {
        channel.send(null);
      }
    }

    playerGrid.stop();
    chosenThingElement.remove();

    await anotherRoundScreen();
    messaging.start();
  }

  stopListeningForAllPlayers(handlePlayer);
  for (const channel of channels) {
    channel.close();
  }
}

export function startPlayerGrid(playerPhotos) {

//   const debugBlocks = [];

  function updateLayout() {
    const gridPadding = Math.min(window.innerWidth, window.innerHeight) * 0.15;
    const gridBottomPadding = Math.min(window.innerWidth, window.innerHeight) * 0.3;
    const gridWidth  = window.innerWidth  - (gridPadding * 2);
    const gridHeight = window.innerHeight - (gridBottomPadding + gridPadding);
    const gridAspectRatio = gridWidth / gridHeight;
    let gridColumnCount = Math.round(Math.sqrt(players.length) * gridAspectRatio);
    let gridRowCount    = Math.round(Math.sqrt(players.length) * (1/gridAspectRatio));
    gridColumnCount = Math.max(gridColumnCount, 1);
    gridRowCount    = Math.max(gridRowCount, 1);
    if (gridColumnCount > gridRowCount) {
      gridColumnCount = Math.ceil(players.length / gridRowCount);
    } else {
      gridRowCount = Math.ceil(players.length / gridColumnCount);
    }
    const cellWidth  = gridWidth  / gridColumnCount;
    const cellHeight = gridHeight / gridRowCount;
    const cellPadding = Math.min(cellWidth, cellHeight) * 0.03;
    const playerSize = Math.min(cellWidth, cellHeight) - (cellPadding * 2);
//     while (debugBlocks.length > 0) {
//       const block = debugBlocks.pop();
//       block.remove();
//     }
    let playerIndex = 0;
    for (let gridRow = 0; gridRow < gridRowCount; gridRow++) {
      const rowPlayerCount = Math.min(gridColumnCount, players.length - playerIndex);
      const rowWidth = rowPlayerCount * cellWidth;
      const rowLeft = gridPadding + ((gridWidth / 2) - (rowWidth / 2));
      for (let gridColumn = 0; gridColumn < gridColumnCount; gridColumn++) {
        if (playerIndex >= players.length) {
          break;
        }
        const player = players[playerIndex];
        const cellLeft = rowLeft + (cellWidth  * gridColumn) + cellPadding;
        const cellTop   = gridPadding + (cellHeight * gridRow) + cellPadding;
//         const debugBlock = document.createElement('div');
//         debugBlock.classList.add('grid-debug-block');
//         debugBlock.style.left = cellLeft + 'px';
//         debugBlock.style.top  = cellTop  + 'px';
//         debugBlock.style.width  = cellWidth  + 'px';
//         debugBlock.style.height = cellHeight + 'px';
//         debugBlock.style.borderWidth = cellPadding + 'px';
//         debugBlocks.push(debugBlock);
//         document.body.appendChild(debugBlock);
        if (player.classList.contains('moving-to-grid')) {
          player.style.left = (cellLeft + ((cellWidth  - playerSize) / 2)) + 'px';
          player.style.top  = (cellTop  + ((cellHeight - playerSize) / 2)) + 'px';
          player.style.width  = playerSize + 'px';
          player.style.height = playerSize + 'px';
        }
        if (playerPhotos.has(player)) {
          const photo = playerPhotos.get(player);
          photo.style.left   = (cellLeft + ((cellWidth  - playerSize) / 2)) + 'px';
          photo.style.top    = (cellTop  + ((cellHeight - playerSize) / 2)) + 'px';
          photo.style.width  = playerSize + 'px';
          photo.style.height = playerSize + 'px';
        }
        playerIndex++;
      }
    }
  }
  updateLayout();
  window.addEventListener('resize', updateLayout);
  listenForNewPlayers(updateLayout);
  listenForLeavingPlayer(updateLayout);

  return {
    updateLayout: updateLayout,
    stop: () => {
      window.removeEventListener('resize', updateLayout);
      stopListeningForNewPlayers(updateLayout);
      stopListeningForLeavingPlayer(updateLayout);
    }
  }
}
