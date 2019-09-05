"use strict";

(async function() {
  await splashScreen();
  await showJoinGameInstructions();

  await AllTheThings();
})();

async function waitForPlayers(n = 1) {
  document.getElementById('waiting-for-players').classList.remove('hide');
  const result = await new Promise(resolve => {
    if (players.length >= n) {
      resolve();
    } else {
      document.body.addEventListener('playerAdded', function callback() {
        if (players.length >= n) {
          resolve();
          document.body.removeEventListener('playerAdded', callback);
        }
      });
    }
  });
  document.getElementById('waiting-for-players').classList.add('hide');
  return result;
}

function waitForNSeconds(seconds) {
  return new Promise(resolve => {
    setTimeout(() => {
      if (paused) {
        waitForKeypress('p').then(() => resolve());
      } else {
        resolve();
      }
    }, 1000 * seconds);
  });
}

function waitForKeypress(key) {
  return new Promise(resolve => {
    window.addEventListener('keypress', function handleKeypress(event) {
      if (event.key === key) {
        resolve(event);
        window.removeEventListener('keypress', handleKeypress);
      }
    });
  });
}
