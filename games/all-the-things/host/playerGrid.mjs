import {
  players,
  listenForNewPlayers,
  stopListeningForNewPlayers,
  listenForLeavingPlayer,
  stopListeningForLeavingPlayer
} from '/host/players.mjs';

import {playerPhotos} from './allTheThings.mjs';

export function start() {
  updateLayout();
  window.addEventListener('resize', updateLayout);
  listenForNewPlayers(updateLayout);
  listenForLeavingPlayer(updateLayout);
}

export function stop() {
  window.removeEventListener('resize', updateLayout);
  stopListeningForNewPlayers(updateLayout);
  stopListeningForLeavingPlayer(updateLayout);
}

// const debugBlocks = [];

export function updateLayout() {

  const gridPadding    = Math.min(window.innerWidth, window.innerHeight) * 0.08;
  const gridTopPadding = Math.min(window.innerWidth, window.innerHeight) * 0.2;

  const gridWidth  = window.innerWidth  - (gridPadding * 2);
  const gridHeight = window.innerHeight - (gridTopPadding + gridPadding);

  const gridAspectRatio = gridWidth / gridHeight;

  // Choose the number of rows and columns for the grid such that the players are evenly distributed
  // over the screen
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
      const cellLeft = rowLeft        + (cellWidth  * gridColumn) + cellPadding;
      const cellTop  = gridTopPadding + (cellHeight * gridRow   ) + cellPadding;
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
      const photo = playerPhotos.find(photo => photo.player === player);
      if (photo) {
        photo.photoContainer.style.left   = (cellLeft + ((cellWidth  - playerSize) / 2)) + 'px';
        photo.photoContainer.style.top    = (cellTop  + ((cellHeight - playerSize) / 2)) + 'px';
        photo.photoContainer.style.width  = playerSize + 'px';
        photo.photoContainer.style.height = playerSize + 'px';
      }
      playerIndex++;
    }
  }
}
