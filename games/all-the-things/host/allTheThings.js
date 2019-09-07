"use strict";

async function AllTheThings() {
  let audience = startAudienceMode();

  document.body.style.backgroundColor = '#98947f';
  await waitForNSeconds(1);

  await titleScreen();

  const chosenThingElement = await thingChoosingScreen();

  await goalScreen(chosenThingElement, audience);

  audience.stop();

  const playerGrid = await photoTakingScreen();

  audience = startAudienceMode();

  await presentingPhotosScreen();
  await waitForKeypress(' ');
  playerGrid.stop();
}

function startPlayerGrid() {

  function updateLayout() {
    const gridAspectRatio = window.innerWidth / window.innerHeight;
    let gridColumnCount = Math.round(Math.sqrt(players.length) * gridAspectRatio);
    let gridRowCount    = Math.round(Math.sqrt(players.length) * (1/gridAspectRatio));
    if ((gridColumnCount * gridRowCount) < players.length) {
      gridColumnCount++;
    }
    if ((gridColumnCount * gridRowCount) < players.length) {
      gridRowCount++;
    }
    const gridPadding = Math.min(window.innerWidth, window.innerHeight) * 0.15;
    const gridBottomPadding = Math.min(window.innerWidth, window.innerHeight) * 0.3;
    const gridWidth  = window.innerWidth  - (gridPadding * 2);
    const gridHeight = window.innerHeight - (gridBottomPadding + gridPadding);
    const cellWidth  = gridWidth  / gridColumnCount;
    const cellHeight = gridHeight / gridRowCount;
    const cellPadding = Math.min(cellWidth, cellHeight) * 0.1;
    const playerSize = Math.min(cellWidth, cellHeight) - (cellPadding * 2);
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
        const celTop   = gridPadding + (cellHeight * gridRow) + cellPadding;
        if (player.classList.contains('moving-to-grid')) {
          player.style.left = (cellLeft + ((cellWidth  - playerSize) / 2)) + 'px';
          player.style.top  = (celTop  + ((cellHeight - playerSize) / 2)) + 'px';
          player.style.width  = playerSize + 'px';
          player.style.height = playerSize + 'px';
        }
        if (player.photo) {
          player.photo.style.left   = (cellLeft + ((cellWidth  - playerSize) / 2)) + 'px';
          player.photo.style.top    = (celTop  + ((cellHeight - playerSize) / 2)) + 'px';
          player.photo.style.width  = playerSize + 'px';
          player.photo.style.height = playerSize + 'px';
        }
        playerIndex++;
      }
    }
  }
  updateLayout();
  window.addEventListener('resize', updateLayout);
  listenForLeavingPlayer(updateLayout);

  return {
    updateLayout: updateLayout,
    stop: () => {
      window.removeEventListener('resize', updateLayout);
      stopListeningForLeavingPlayer(updateLayout);
    }
  }
}
