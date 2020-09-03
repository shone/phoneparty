import {waitForNSeconds, waitForKeypress} from '/common/utils.mjs';

import {
  players,
  waitForPlayerToLeave,
  listenForAllPlayers,
  listenForLeavingPlayers,
  stopListeningForAllPlayers,
  stopListeningForLeavingPlayers
} from '/host/players.mjs';

import {addSpeechBubbleToPlayer, clearSpeechBubblesFromPlayer} from '/host/messaging.mjs';

import routes from '/host/routes.mjs';

import {photos} from './shoot.mjs';

import * as playerGrid from './playerGrid.mjs';
import Audience from '/host/audience.mjs';

routes['#apps/tunnel-vision/present'] = async function present({params}) {
  const thingName = params.get('thing');

  audienceMode.start();

  await waitForNSeconds(2);

  if (playerPhotos.length === 0) {
    //await waitForNSeconds(2);
    // TODO: show message about there being no photos to present
    playerGrid.stop();
    return '#apps/tunnel-vision';
  }

  playerGrid.start();

  return `#apps/tunnel-vision/photo-judgement?thing=${thingName}&index=0`;
}

const fooledSound    = new Audio('/apps/tunnel-vision/sounds/fooled.mp3');
const notFooledSound = new Audio('/apps/tunnel-vision/sounds/not-fooled.mp3');

routes['#apps/tunnel-vision/photo-judgement'] = async function presentPhoto({route, params, createChannel}) {

  const index = parseInt(params.get('index'));
  const thing = params.get('thing');

  if (index >= playerPhotos.length) {
    // TODO: show message about invalid index?
    return '#apps/tunnel-vision/another-round';
  }

  const playerPresentingPhoto = playerPhotos[index].player;
  const photo = playerPhotos[index].photoContainer;
  if (!playerPresentingPhoto) {
    // Player has left, continue to next player
    return finish();
  }

  audienceMode.start();

  function finish() {
    if ((index < playerPhotos.length - 1) && (location.hash.split('?')[0] === route.split('?')[0])) {
      return `#apps/tunnel-vision/photo-judgement?thing=${thing}&index=${index+1}`;
    } else {
      playerGrid.stop();
      document.querySelectorAll('.photo-container').forEach(photo => photo.remove());
      while (playerPhotos.length) playerPhotos.pop();
      const thingIndicator = document.querySelector('.tunnel-vision.thing.show-in-top-right');
      if (thingIndicator) {
        thingIndicator.remove();
      }
      return '#apps/tunnel-vision/another-round';
    }
  }

  playerPresentingPhoto.classList.remove('wiggleable');
  playerPresentingPhoto.style.transform = '';
  playerPresentingPhoto.classList.add('highlight-in-audience');

  // Show photo full-screen
  photo.classList.add('fullscreen');
  document.querySelectorAll('.photo-container:not(.fullscreen').forEach(otherPhoto => otherPhoto.classList.add('de-emphasize'));
  let result = await Promise.race([waitForNSeconds(2), waitForPlayerToLeave(playerPresentingPhoto)]);
  if (result === 'player_left') {
    return finish();
  }

  result = await judgePhoto(playerPresentingPhoto, photo, createChannel);

  if (result === 'player_left') {
    players.forEach(player => clearSpeechBubblesFromPlayer(player));
    return finish();
  }

  const [selfJudgementResult, otherPlayerResponses] = result;

  const otherPlayersWithResponses = players.filter(player => otherPlayerResponses.has(player));

  // Highlight responses
  for (const otherPlayer of otherPlayersWithResponses) {
    const speechBubble = otherPlayer.querySelector('.speech-bubble:not(.cleared)');
    if (speechBubble) {
      speechBubble.classList.add('highlight');
      setTimeout(() => speechBubble.classList.remove('highlight'), 1000);
    }
  }
  await waitForNSeconds(1);

  photo.classList.add('reveal-full-photo');
  await Promise.race([waitForNSeconds(5), waitForKeypress(' ')]);

  // Reveal fooled/not-fooled state for each player
  for (const player of otherPlayersWithResponses) {
    if (players.indexOf(player) === -1) {
      continue;
    }
    const speechBubble = player.querySelector('.speech-bubble:not(.cleared)');
    if (speechBubble) {
      speechBubble.classList.add('cleared');
      await waitForNSeconds(0.5);
      speechBubble.remove();
    }

    for (const otherPhoto of [...document.getElementsByClassName('photo-container')]) {
      otherPhoto.classList.add('de-emphasize');
    }

    player.classList.add('fullscreen-in-audience', 'transitioning-to-fullscreen-in-audience');
    await waitForNSeconds(1);

    if (otherPlayerResponses.get(player) === selfJudgementResult) {
      setPlayerNotFooled(player);
    } else {
      setPlayerFooled(player);
    }
    await waitForNSeconds(2.5);

    player.classList.remove('fullscreen-in-audience');
    setTimeout(() => player.classList.remove('transitioning-to-fullscreen-in-audience'), 500);
    await waitForNSeconds(0.5);

    for (const otherPhoto of [...document.getElementsByClassName('photo-container')]) {
      otherPhoto.classList.toggle('de-emphasize', otherPhoto.player !== playerPresentingPhoto);
    }
  }

  await waitForNSeconds(2);

  for (const otherPlayer of players) {
    clearPlayerFooledState(otherPlayer);
  }

  playerPresentingPhoto.classList.remove('highlight-in-audience');
  playerPresentingPhoto.classList.add('wiggleable');
  photo.classList.remove('reveal-full-photo');
  await waitForNSeconds(2);
  photo.classList.remove('fullscreen');
  for (const otherPhoto of [...document.getElementsByClassName('photo-container')]) {
    otherPhoto.classList.remove('de-emphasize');
  }
  await waitForNSeconds(2);

  return finish();
}

async function judgePhoto(playerPresentingPhoto, photo, createChannel) {
  const croppedPhotoArrayBuffer = await makeCroppedImageArrayBuffer(photo.querySelector('img'));

  const selfJudgementChannel = createChannel(playerPresentingPhoto, 'self-judgement');
  const otherPlayerChannels = [];

  const getAllPlayerResponses = new Promise(resolve => {
    let selfJudgementResult = null;
    const otherPlayerResponses = new Map();
    function checkAllPlayersResponded() {
      const otherPlayers = players.filter(player => player !== playerPresentingPhoto);
      if (selfJudgementResult !== null && otherPlayers.length >= 1 && otherPlayers.every(player => otherPlayerResponses.has(player))) {
        resolve([selfJudgementResult, otherPlayerResponses]);
        stopListeningForAllPlayers(handlePlayer);
        stopListeningForLeavingPlayers(checkAllPlayersResponded);
      } else if (players.indexOf(playerPresentingPhoto) === -1) {
        stopListeningForAllPlayers(handlePlayer);
        stopListeningForLeavingPlayers(checkAllPlayersResponded);
      }
    }
    selfJudgementChannel.onmessage = event => {
      selfJudgementResult = event.data;
      checkAllPlayersResponded();
    }
    function handlePlayer(player) {
      if (player === playerPresentingPhoto) {
        return;
      }
      const channel = createChannel(player, 'judgement');
      channel.onopen = () => channel.send(croppedPhotoArrayBuffer);
      channel.onmessage = event => {
        otherPlayerResponses.set(player, event.data);
        checkAllPlayersResponded();
        clearSpeechBubblesFromPlayer(player);
        addSpeechBubbleToPlayer(player, event.data);
      }
      otherPlayerChannels.push(channel);
    }
    listenForAllPlayers(handlePlayer);
    listenForLeavingPlayers(checkAllPlayersResponded);
  });

  const result = await Promise.race([
    getAllPlayerResponses,
    waitForPlayerToLeave(playerPresentingPhoto)
  ]);
  selfJudgementChannel.close();
  for (const channel of otherPlayerChannels) {
    channel.close();
  }

  return result;
}

function setPlayerFooled(player) {
  fooledSound.play().catch(() => {});

  player.insertAdjacentHTML('beforeend', `
    <div class="tunnel-vision fooled-overlay"></div>
    <div class="tunnel-vision fooled-stamp">FOOLED</div>
  `);
}

function setPlayerNotFooled(player) {
  notFooledSound.play().catch(() => {});

  player.insertAdjacentHTML('beforeend', '<div class="tunnel-vision not-fooled-stamp">not fooled</div>');

  const lightbulbsCount = 6;
  for (let i=0; i < lightbulbsCount; i++) {
    const lightbulb = document.createElement('div');
    lightbulb.classList.add('tunnel-vision', 'lightbulb');
    const x     = ((Math.random() - 0.5) * 2) * 250;
    const y     = ((Math.random() - 0.5) * 2) * 250;
    const angle = ((Math.random() - 0.5) * 2) * 40;
    lightbulb.style.transform = `translate(${x}%, ${y}%) rotate(${angle}deg)`;
    lightbulb.style.animationDelay = `${0.7 * (i / lightbulbsCount)}s`;
    player.appendChild(lightbulb);
  }
}

function clearPlayerFooledState(player) {
  const elements = player.querySelectorAll('.fooled-stamp, .fooled-overlay, .not-fooled-stamp, .lightbulb');
  elements.forEach(element => element.remove());
}

async function makeCroppedImageArrayBuffer(image) {
  const croppedSize = Math.min(image.naturalWidth, image.naturalHeight) / 3;

  const canvas = document.createElement('canvas');
  canvas.width  = croppedSize;
  canvas.height = croppedSize;

  const context = canvas.getContext('2d');
  context.drawImage(
    image,
    (image.naturalWidth  / 2) - (croppedSize / 2), // Source X
    (image.naturalHeight / 2) - (croppedSize / 2), // Source Y
    croppedSize, croppedSize, // Source dimensions
    0, 0, // Destination position
    croppedSize, croppedSize // Destination dimensions
  );

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
  const arrayBuffer = await new Response(blob).arrayBuffer();
  return arrayBuffer;
}
