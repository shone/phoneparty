"use strict";

(async function() {
  await splashScreen();
  await showJoinGameInstructions();

  await AllTheThings();
})();

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
