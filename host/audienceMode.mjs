import {players, acceptAllPlayers, stopAcceptingPlayers, listenForLeavingPlayer, stopListeningForLeavingPlayer} from './players.mjs';
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

audienceMode();

async function audienceMode() {

  while (true) {
    // Wait for start()
    await new Promise(resolve => {
      if (started) {
        resolve();
      } else {
        startCallback = resolve;
      }
    });

    const background = document.createElement('div');
    background.classList.add('audience-mode-background');
    document.body.appendChild(background);

    let timerForLayoutAnimation = null;

    function addPlayerPlaceholder() {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="player-bubble-placeholder">
          <span>Waiting for player...</span>
        </div>
      `);
      const playerPlaceholder = document.body.lastElementChild;
      playerSlots.push(playerPlaceholder);
    }

    const playerSlots = [];
    const minPlayers = 2;
    for (let i=0; i<Math.max(players.length, minPlayers); i++) {
      addPlayerPlaceholder();
    }
    layoutPlayers();

    const newPlayerTimers = new Set();
    let timeOnLastNewPlayer = null;
    acceptAllPlayers(player => {
      const emptySlotIndex = playerSlots.findIndex(p => p.classList.contains('player-bubble-placeholder'));
      if (emptySlotIndex === -1) {
        playerSlots.push(player);
      } else {
        playerSlots[emptySlotIndex].remove();
        playerSlots[emptySlotIndex] = player;
      }

      player.classList.add('bubble');
      player.classList.add('audience-mode');
      player.classList.remove('hide');

      let revealDelayMs = 0;
      const now = performance.now();
      if (timeOnLastNewPlayer !== null && ((now - timeOnLastNewPlayer) < 80)) {
        revealDelayMs = (timeOnLastNewPlayer + 80) - now;
      }
      timeOnLastNewPlayer = now + revealDelayMs;
      player.style.animationDelay =  (revealDelayMs / 1000) + 's';
      player.style.transitionDelay = (revealDelayMs / 1000) + 's';
      newPlayerTimers.add(setTimeout(() => {
        player.classList.add('wiggleable');
        player.style.animationDelay = '';
        player.style.transitionDelay = '';
      }, revealDelayMs));

      layoutPlayers();
      if (!player.parentElement) {
        document.body.appendChild(player);
      }
      player.video.play();
    });
    function handlePlayerLeaving(player) {
      const slotIndex = playerSlots.indexOf(player);
      playerSlots.splice(slotIndex, 1);
      if (playerSlots.length < minPlayers) {
        addPlayerPlaceholder();
      }
      layoutPlayers();
    }
    listenForLeavingPlayer(handlePlayerLeaving);

    function layoutPlayers() {
      if (playerSlots.length === 0) {
        return;
      }
      const playerSize = Math.min(100 / playerSlots.length, 10);
      const playerMargin = 6;
      for (const [index, playerSlot] of playerSlots.entries()) {
        playerSlot.classList.add('audience-mode-layout-animation');
        if (!playerSlot.classList.contains('fullscreen-in-audience')) {
          playerSlot.style.top  = `calc((100vh - ${playerSize}vw) + ${playerMargin}vw)`;
          playerSlot.style.left = (((50 - ((playerSize * playerSlots.length) / 2)) + (playerSize * index)) + playerMargin) + 'vw';
          playerSlot.style.width  = playerSize + 'vw';
          playerSlot.style.height = playerSize + 'vw';
          playerSlot.style.fontSize = playerSize + 'vw';
        }
      }
      if (timerForLayoutAnimation) {
        clearTimeout(timerForLayoutAnimation);
      }
      timerForLayoutAnimation = setTimeout(() => {
        for (const player of players) {
          player.classList.remove('audience-mode-layout-animation');
        }
      }, (Math.max(...players.map(p => parseFloat(p.style.transitionDelay || 0) * 1000))) + 1000);
    }

    // Wait for stop()
    await new Promise(resolve => {
      if (!started) {
        resolve();
      } else {
        stopCallback = resolve;
      }
    });

    background.classList.add('fade-out');
    stopAcceptingPlayers();
    stopListeningForLeavingPlayer(handlePlayerLeaving);
    for (const player of players) {
      player.classList.remove('audience-mode');
      player.classList.remove('audience-mode-layout-animation');
      player.classList.remove('highlight-in-audience');
      player.style.animationDelay = '';
      player.style.transitionDelay = '';
    }
    if (timerForLayoutAnimation) {
      clearTimeout(timerForLayoutAnimation);
    }
    for (const timerId of newPlayerTimers) {
      clearTimeout(timerId);
    }

    await waitForNSeconds(0.5);
    background.remove();
  }
}
