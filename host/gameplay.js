"use strict";

let gameStarted = false;
let playerImages = [];
let imageResults = {};
let searchedItem = {};

(async function() {
  await splashScreen();

  await showElement(document.getElementById('introduction-page'));

  await AllTheThings();
})();

function setAllPlayersToPhase(phaseNumber) {
  for (const player of players) {
    player.currentPhaseChannel.send(phaseNumber);
  }
}

async function showElement(element) {
  element.classList.remove('hide');
  await waitForKeypress(' ');
  element.classList.add('hide');
}

async function countdown(seconds = 10, title = '', detail = '') {
  const div = document.createElement('div');
  div.classList.add('countdown');
  document.body.appendChild(div);
  const titleDiv = document.createElement('div');
  titleDiv.classList.add('countdown-title');
  titleDiv.textContent = title;
  document.body.appendChild(titleDiv);
  const detailDiv = document.createElement('div');
  detailDiv.classList.add('countdown-detail');
  if (detail) {
    detailDiv.innerHTML = detail;
  }
  document.body.appendChild(detailDiv);
  for (let n = seconds; n > 0; n--) {
    div.textContent = '⏲' + n;
    const result = await Promise.race([waitForNSeconds(1), waitForKeypress(' ')]);
    if (result && result.type === 'keypress') {
      break;
    }
  }
  titleDiv.remove();
  detailDiv.remove();
  div.textContent = "Let's go!";
  await Promise.race([waitForNSeconds(3), waitForKeypress(' ')]);
  div.remove();
}

async function randomPlayerSelection(title) {
  const titleDiv = document.createElement('div');
  titleDiv.classList.add('wheel-title');
  titleDiv.textContent = title;
  document.body.appendChild(titleDiv);
  const wheelTicker = document.createElement('div');
  wheelTicker.classList.add('wheel-ticker');
  document.body.appendChild(wheelTicker);

  const result = await Promise.race([waitForPlayers(), waitForKeypress(' ')]);
  if (result && result.type === 'keypress') {
    titleDiv.remove();
    wheelTicker.remove();
    return null;
  }

  for (const player of players) player.classList.add('not-player-moveable');

  const wheelRevolutions = 5;
  const wheelSpinTimeMs = 10000;
  const wheelStartingAngle = Math.PI*2*Math.random();
  const firstTimestamp = performance.now();
  let skipped = false;
  let lastPlayerChosen = null;
  waitForKeypress(' ').then(event => {
    skipped = true;
  });
  const player = await new Promise(resolve => {
    window.requestAnimationFrame(function handleFrame(timestamp) {
      const timeSinceStart = timestamp - firstTimestamp;
      const spinCompletionRatio = timeSinceStart / wheelSpinTimeMs;
      function easeOutCubic(t) { return (--t)*t*t+1 }
      const wheelAngle = wheelStartingAngle + (Math.PI*2*wheelRevolutions * easeOutCubic(spinCompletionRatio));
      for (const [index, player] of players.entries()) {
        const playerAngle = wheelAngle + (Math.PI*2*(index / players.length));
        player.style.left = (50 + (30 * Math.cos(playerAngle - (Math.PI/2)))) + 'vw';
        player.style.top  = (60 + (30 * Math.sin(playerAngle - (Math.PI/2)))) + 'vh';
      }
      const chosenPlayer = players.length > 0 ? players[(players.length-1) - ((Math.floor(players.length * (wheelAngle / (Math.PI*2))) + (players.length-1)) % players.length)] : null;
      if (chosenPlayer !== lastPlayerChosen) {
        if (lastPlayerChosen !== null) {
          lastPlayerChosen.classList.remove('chosen');
          if (lastPlayerChosen.wheelChannel.readyState === 'open') {
            lastPlayerChosen.wheelChannel.send('not chosen');
          }
        }
        if (chosenPlayer !== null) {
          chosenPlayer.classList.add('chosen');
          if (chosenPlayer.wheelChannel.readyState === 'open') {
            chosenPlayer.wheelChannel.send('chosen');
          }
        }
      }
      lastPlayerChosen = chosenPlayer;
      if (timeSinceStart >= wheelSpinTimeMs || skipped) {
        if (chosenPlayer !== null) {
          chosenPlayer.classList.remove('chosen');
          chosenPlayer.classList.add('flash');
          setTimeout(() => chosenPlayer.classList.remove('flash'), 1000);
          if (chosenPlayer.wheelChannel.readyState === 'open') {
            chosenPlayer.wheelChannel.send('chosen final');
            setTimeout(() => {
              if (chosenPlayer.wheelChannel.readyState === 'open') {
                chosenPlayer.wheelChannel.send('not chosen');
              }
            }, 1000);
          }
          resolve(chosenPlayer);
        } else {
          resolve(null);
        }
        return;
      }
      window.requestAnimationFrame(handleFrame);
    });
  });
  await Promise.race([waitForNSeconds(1), waitForKeypress(' ')]);
  for (const player of players) {
    player.classList.remove('not-player-moveable');
    player.classList.remove('chosen');
  }
  titleDiv.remove();
  wheelTicker.remove();
  return player;
}

async function vote(topic = '', optionA = 'no', optionB = 'yes', countdownSeconds = 20) {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="voting-field">
      <div class="option-a">${optionA}</div>
      <div class="option-b">${optionB}</div>
      <div class="swing-arrow"></div>
      <div class="voting-text">${topic}</div>
      <div class="voting-countdown"></div>
      <div class="you-selected">You selected:</div>
    </div>
  `);
  const field = document.body.lastElementChild;

  if (players.length === 0) {
    const result = await Promise.race([waitForPlayers(), waitForKeypress(' ')]);
    if (result && result.type === 'keypress') {
      field.remove();
      return null;
    }
  }

  let isVoting = true;
  window.requestAnimationFrame(function handleFrame() {
    if (!isVoting) return;
    const swing = players.map(player => (parseFloat(player.style.left) - 50) / 50).reduce((a, swing) => a + swing, 0) / players.length;
    field.querySelector('.swing-arrow').style.transform = `rotate(${45 * -swing}deg)`;
    field.classList.toggle('option-a', swing <  0);
    field.classList.toggle('option-b', swing >= 0);
    window.requestAnimationFrame(handleFrame);
  });

  for (let n=countdownSeconds; n>0; n--) {
    field.querySelector('.voting-countdown').textContent = n;
    const result = await Promise.race([waitForNSeconds(1), waitForKeypress(' ')]);
    if (result && result.type === 'keypress') {
      break;
    }
  }
  isVoting = false;
  field.classList.add('finished');
  field.querySelector('.swing-arrow').remove();
  await Promise.race([waitForNSeconds(5), waitForKeypress(' ')]);

  field.remove();
  return field.classList.contains('option-a') ? 'a' : 'b';
}

async function showText(text, seconds, backgroundColor) {
  const textDiv = document.createElement('div');
  textDiv.classList.add('fullscreen-text');
  if (backgroundColor) {
    textDiv.style.backgroundColor = backgroundColor;
    textDiv.style.color = 'white';
  }
  textDiv.textContent = text;
  document.body.appendChild(textDiv);
  await Promise.race([waitForNSeconds(seconds), waitForKeypress(' ')]);
  textDiv.remove();
}

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

async function cameraMode(player) {
  player.classList.add('camera-mode');
  player.classList.add('not-player-moveable')
  player.style.left = '';
  player.style.top  = '';
  player.style.transform = '';
}
