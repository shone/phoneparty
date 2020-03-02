import {waitForNSeconds, waitForKeypress} from '/shared/utils.mjs';

import {
  players,
  waitForPlayerToLeave,
  listenForAllPlayers,
  listenForLeavingPlayer,
  stopListeningForAllPlayers,
  stopListeningForLeavingPlayer
} from '/host/players.mjs';

import {addSpeechBubbleToPlayer, clearSpeechBubblesFromPlayer} from '/host/messaging.mjs';

import routes from '/host/routes.mjs';

import {playerPhotos} from './allTheThings.mjs';

routes['#games/all-the-things/photo-judgement'] = async function presentingPhotosScreen() {
  await waitForNSeconds(2);

  if (playerPhotos.length === 0) {
    //await waitForNSeconds(2);
    // TODO: show message about there being no photos to present
    return '#games/all-the-things';
  }

  for (const photo of playerPhotos) {
    routes[`#games/all-the-things/photo-judgement/${photo.id}`] = async () => presentPhoto(photo.player, photo.photoContainer, photo.id);
  }

  return `#games/all-the-things/photo-judgement/${playerPhotos[0].id}`;

//   const playersWithPhotos = players.filter(player => playerPhotos.has(player));
// 
//   for (const playerPresentingPhoto of playersWithPhotos) {
//     if (players.indexOf(playerPresentingPhoto) === -1) {
//       continue; // Player has left, continue to next player
//     }
// 
//     playerPresentingPhoto.classList.remove('wiggleable');
//     playerPresentingPhoto.style.transform = '';
//     playerPresentingPhoto.classList.add('highlight-in-audience');
// 
//     const photo = playerPhotos.get(playerPresentingPhoto);
//     await presentPhoto(playerPresentingPhoto, photo);
// 
//     playerPresentingPhoto.classList.remove('highlight-in-audience');
//     playerPresentingPhoto.classList.add('wiggleable');
//     photo.classList.remove('reveal-full-photo');
//     await waitForNSeconds(2);
//     photo.classList.remove('fullscreen');
//     for (const otherPhoto of [...document.getElementsByClassName('photo-container')]) {
//       otherPhoto.classList.remove('de-emphasize');
//     }
//     await waitForNSeconds(2);
//   }
// 
//   for (const photoContainer of [...document.getElementsByClassName('photo-container')]) {
//     photoContainer.remove();
//   }
// 
//   return '#games/all-the-things/another-round';
}

const fooledSound    = new Audio('/games/all-the-things/sounds/fooled.mp3');
const notFooledSound = new Audio('/games/all-the-things/sounds/not-fooled.mp3');

async function presentPhoto(playerPresentingPhoto, photo, photoId) {

  function getNextRoute() {
    const photoIndex = playerPhotos.findIndex(photo => photo.id === photoId);
    if (photoIndex !== -1 && photoIndex < playerPhotos.length - 1) {
      // TODO skip players that have left?
      return `#games/all-the-things/photo-judgement/${playerPhotos[photoIndex + 1].id}`;
    } else {
      return '#games/all-the-things/another-round';
    }
  }

  // If the player has left, move on to the next player
  if (players.indexOf(playerPresentingPhoto) === -1) {
    return getNextRoute();
  }

  playerPresentingPhoto.classList.remove('wiggleable');
  playerPresentingPhoto.style.transform = '';
  playerPresentingPhoto.classList.add('highlight-in-audience');

  // Show photo full-screen
  photo.classList.add('fullscreen');
  for (const otherPhoto of [...document.getElementsByClassName('photo-container')]) {
    otherPhoto.classList.toggle('de-emphasize', otherPhoto.player !== playerPresentingPhoto);
  }
  let result = await Promise.race([waitForNSeconds(2), waitForPlayerToLeave(playerPresentingPhoto)]);
  if (result === 'player_left') {
    return;
  }

  result = await judgePhoto(playerPresentingPhoto, photo);

  if (result === 'player_left') {
    for (const player of players) {
      clearSpeechBubblesFromPlayer(player);
    }
    return;
  }
  const [selfJudgementResult, otherPlayerResponses] = result;

  const otherPlayersWithResponses = players.filter(player => otherPlayerResponses.has(player));

  // Highlight responses
  for (const otherPlayer of otherPlayersWithResponses) {
    const speechBubble = otherPlayer.querySelector('.speech-bubble:not(.cleared)');
    if (speechBubble) {
      speechBubble.classList.add('highlight');
    }
  }
  await waitForNSeconds(1);
  for (const otherPlayer of otherPlayersWithResponses) {
    const speechBubble = otherPlayer.querySelector('.speech-bubble:not(.cleared)');
    if (speechBubble) {
      speechBubble.classList.remove('highlight');
    }
  }

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

  return getNextRoute();
}

async function judgePhoto(playerPresentingPhoto, photo) {
  const croppedPhotoArrayBuffer = await makeCroppedImageArrayBuffer(photo.image);

  const selfJudgementChannel = playerPresentingPhoto.createChannelOnCurrentRoute();
  const otherPlayerChannels = [];

  const getAllPlayerResponses = new Promise(resolve => {
    let selfJudgementResult = null;
    const otherPlayerResponses = new Map();
    function checkAllPlayersResponded() {
      const otherPlayers = players.filter(player => player !== playerPresentingPhoto);
      if (selfJudgementResult !== null && otherPlayers.length >= 1 && otherPlayers.every(player => otherPlayerResponses.has(player))) {
        resolve([selfJudgementResult, otherPlayerResponses]);
        stopListeningForAllPlayers(handlePlayer);
        stopListeningForLeavingPlayer(checkAllPlayersResponded);
      } else if (players.indexOf(playerPresentingPhoto) === -1) {
        stopListeningForAllPlayers(handlePlayer);
        stopListeningForLeavingPlayer(checkAllPlayersResponded);
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
      const channel = player.createChannelOnCurrentRoute();//'all-the-things_photo-judgement'
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
    listenForLeavingPlayer(checkAllPlayersResponded);
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
//   const fooledStamp = document.createElement('div');
//   fooledStamp.classList.add('all-the-things', 'fooled-stamp');
//   fooledStamp.textContent = 'FOOLED';
//   player.appendChild(fooledStamp);
//   const fooledOverlay = document.createElement('div');
//   fooledOverlay.classList.add('all-the-things', 'fooled-overlay');
//   player.appendChild(fooledOverlay);
  player.insertAdjacentHTML('beforeend', `
    <div class="all-the-things fooled-overlay"></div>
    <div class="all-the-things fooled-stamp">FOOLED</div>
  `);
}

function setPlayerNotFooled(player) {
  notFooledSound.play().catch(() => {});
//   const notFooledStamp = document.createElement('div');
//   notFooledStamp.classList.add('all-the-things', 'not-fooled-stamp');
//   notFooledStamp.textContent = 'not fooled';
//   player.appendChild(notFooledStamp);
  player.insertAdjacentHTML('beforeend', '<div class="all-the-things not-fooled-stamp">not fooled</div>');
  const lightbulbsCount = 6;
  for (let i=0; i < lightbulbsCount; i++) {
    const lightbulb = document.createElement('div');
    lightbulb.classList.add('all-the-things', 'lightbulb');
    lightbulb.style.animationDelay = (0.7 * (i / lightbulbsCount)) + 's';
    lightbulb.style.transform = `translate(${((Math.random() - 0.5) * 2) * 250}%, ${((Math.random() - 0.5) * 2) * 250}%) rotate(${((Math.random() - 0.5) * 2) * 40}deg)`;
    player.appendChild(lightbulb);
  }
}

function clearPlayerFooledState(player) {
  const elements = player.querySelectorAll('.fooled-stamp, .fooled-overlay, .not-fooled-stamp, .lightbulb');
  for (const element of [...elements]) {
    element.remove();
  }
//   const fooledStamp = player.querySelector('.fooled-stamp');
//   if (fooledStamp) {
//     fooledStamp.remove();
//   }
//   const fooledOverlay = player.querySelector('.fooled-overlay');
//   if (fooledOverlay) {
//     fooledOverlay.remove();
//   }
//   const notFooledStamp = player.querySelector('.not-fooled-stamp');
//   if (notFooledStamp) {
//     notFooledStamp.remove();
//   }
//   for (const lightbulb of [...player.getElementsByClassName('lightbulb')]) {
//     lightbulb.remove();
//   }
}

async function makeCroppedImageArrayBuffer(image) {
  const canvas = document.createElement('canvas');
  const croppedSize = Math.min(image.naturalWidth, image.naturalHeight) / 3;
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
