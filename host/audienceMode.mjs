import {
  players,
  acceptAllPlayers,
  stopAcceptingPlayers,
  listenForLeavingPlayers,
  stopListeningForLeavingPlayers
} from './players.mjs';

import {waitForNSeconds} from '/shared/utils.mjs';

let started = false;
let startCallback = null;
let stopCallback = null;

export function start() {
  started = true;
  if (startCallback) {
    startCallback();
    startCallback = null;
  }
}
export function stop() {
  started = false;
  if (stopCallback) {
    stopCallback();
    stopCallback = null;
  }
}

let minPlayers = 0;
let setMinPlayersCallback = null;
export function setMinPlayers(numberOfPlayers) {
  if (minPlayers === numberOfPlayers) return;
  minPlayers = numberOfPlayers;
  if (setMinPlayersCallback) {
    setMinPlayersCallback();
  }
}

let timerForLayoutAnimation = null;

audienceMode();

async function audienceMode() {

  while (true) {
    if (!started) {
      // Wait for start()
      await new Promise(resolve => startCallback = resolve);
    }

    const background = document.createElement('div');
    background.classList.add('audience-mode-background');
    document.body.appendChild(background);

    const initialPlayerSlotCount = Math.max(players.length, minPlayers);
    let playerSlots = [];
    for (let i=0; i < initialPlayerSlotCount; i++) {
      playerSlots.push(createPlayerPlaceholder());
    }
    layoutPlayerSlots(playerSlots);

    setMinPlayersCallback = () => {
      const placeholdersRequired = Math.max(minPlayers - players.length, 0);
      let placeholdersFound = 0;

      playerSlots = playerSlots.filter(slot => {
        if (slot.classList.contains('player-bubble-placeholder')) {
          placeholdersFound++;
          if (placeholdersFound > placeholdersRequired) {
            slot.classList.add('removing');
            setTimeout(() => slot.remove(), 3000);
            return false;
          }
        }
        return true;
      });

      for (let i=0; i < placeholdersRequired - placeholdersFound; i++) {
        playerSlots.push(createPlayerPlaceholder());
      }

      layoutPlayerSlots(playerSlots);
    }

    const newPlayerTimers = new Set();
    let timeOnLastNewPlayer = null;
    acceptAllPlayers(player => {
      player.classList.add('audience-mode', 'bubble');
      player.classList.remove('hide');

      // Put the player into a slot
      const emptySlotIndex = playerSlots.findIndex(p => p.classList.contains('player-bubble-placeholder'));
      if (emptySlotIndex === -1) {
        playerSlots.push(player);
      } else {
        playerSlots[emptySlotIndex].remove(); // Remove placeholder
        playerSlots[emptySlotIndex] = player; // Placeholder replaced with player
      }
      layoutPlayerSlots(playerSlots);

      // Do reveal animation
      let revealDelayMs = 0;
      const now = performance.now();
      if (timeOnLastNewPlayer !== null && ((now - timeOnLastNewPlayer) < 80)) {
        revealDelayMs = (timeOnLastNewPlayer + 80) - now;
      }
      timeOnLastNewPlayer = now + revealDelayMs;
      player.style.animationDelay  = revealDelayMs + 'ms';
      player.style.transitionDelay = revealDelayMs + 'ms';
      newPlayerTimers.add(setTimeout(() => {
        player.classList.add('wiggleable');
        player.style.animationDelay = '';
        player.style.transitionDelay = '';
      }, revealDelayMs));

      if (!player.parentElement) {
        document.body.appendChild(player);
      }
      player.video.play();
    });

    function handlePlayerLeaving(player) {
      const slotIndex = playerSlots.indexOf(player);
      playerSlots.splice(slotIndex, 1);
      if (playerSlots.length < minPlayers) {
        playerSlots.push(createPlayerPlaceholder());
      }
      layoutPlayerSlots(playerSlots);
    }
    listenForLeavingPlayers(handlePlayerLeaving);

    // Wait for stop()
    if (started) {
      await new Promise(resolve => stopCallback = resolve);
    }

    stopAcceptingPlayers();
    stopListeningForLeavingPlayers(handlePlayerLeaving);
    setMinPlayersCallback = null;
    for (const player of players) {
      player.classList.remove('audience-mode', 'audience-mode-layout-animation', 'highlight-in-audience');
      player.style.animationDelay = '';
      player.style.transitionDelay = '';
    }

    if (timerForLayoutAnimation) {
      clearTimeout(timerForLayoutAnimation);
      timerForLayoutAnimation = null;
    }
    for (const timerId of newPlayerTimers) {
      clearTimeout(timerId);
    }
    newPlayerTimers.clear();

    background.classList.add('fade-out');
    await waitForNSeconds(0.5);
    background.remove();
  }
}

function createPlayerPlaceholder() {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="player-bubble-placeholder">
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="47">
      </svg>
      <label>waiting for player...</label>
    </div>
  `);
  const playerPlaceholder = document.body.lastElementChild;
  return playerPlaceholder;
}

function layoutPlayerSlots(playerSlots) {
  if (playerSlots.length === 0) {
    return;
  }

  const spacing = 1;
  const playerSize = Math.min((100 / playerSlots.length) - spacing, 10);
  const slotSize = playerSize + spacing;
  const slotsLeftEdge = 50 - ((slotSize * playerSlots.length) / 2);
  const playerMargin = 6;
  for (const [index, playerSlot] of playerSlots.entries()) {
    playerSlot.classList.add('audience-mode-layout-animation');
    if (!playerSlot.classList.contains('fullscreen-in-audience')) {
      playerSlot.style.top  = `calc((100vh - ${playerSize}vw) + ${playerMargin}vw)`;
      playerSlot.style.left = ((slotsLeftEdge + (slotSize * index)) + playerMargin + (spacing / 2)) + 'vw';
      playerSlot.style.width  = playerSize + 'vw';
      playerSlot.style.height = playerSize + 'vw';
      playerSlot.style.fontSize = playerSize + 'vw';
    }
  }

  if (timerForLayoutAnimation) {
    clearTimeout(timerForLayoutAnimation);
    timerForLayoutAnimation = null;
  }
  timerForLayoutAnimation = setTimeout(() => {
    for (const slot of playerSlots) {
      slot.classList.remove('audience-mode-layout-animation');
    }
  }, Math.max(...players.map(p => parseFloat(p.style.transitionDelay || 0))) + 1000);
}
