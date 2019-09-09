"use strict";

async function presentingPhotosScreen(messaging) {
  await waitForNSeconds(2);

  messaging.setPossibleMessages(['real', 'fake']);

  const fooledSound    = new Audio('/games/all-the-things/sounds/fooled.mp3');
  const notFooledSound = new Audio('/games/all-the-things/sounds/not-fooled.mp3');

  for (const playerPresentingPhoto of players) {
    playerPresentingPhoto.photo.player.classList.add('highlight-in-audience');
    await waitForNSeconds(0.7);
    playerPresentingPhoto.photo.classList.add('fullscreen');
    for (const photo of [...document.getElementsByClassName('photo-container')]) {
      photo.classList.toggle('de-emphasize', photo.player !== playerPresentingPhoto);
    }
    await waitForNSeconds(2);

    const selfJudgementChannel = playerPresentingPhoto.rtcConnection.createDataChannel('all-the-things_photo-self-judgement');
    let selfJudgementResult = null;
    const waitForPresentingPlayer = new Promise(resolve => {
      selfJudgementChannel.onmessage = event => {
        selfJudgementResult = event.data;
        resolve();
      }
    });

    const otherPlayerResponses = new Map();
    const waitForOtherPlayers = new Promise(resolve => {
      messaging.listenForMessage(function callback(message, playerWithMessage) {
        otherPlayerResponses.set(playerWithMessage, message);
        const otherPlayers = players.filter(p => p !== playerPresentingPhoto);
        if (otherPlayers.every(p => otherPlayerResponses.has(p))) {
          resolve();
          messaging.stopListeningForMessage(callback);
        }
      });
    });

    await Promise.all([waitForPresentingPlayer, waitForOtherPlayers]);

    const otherPlayers = players.filter(p => p !== playerPresentingPhoto);
    for (const otherPlayer of otherPlayers) {
      const speechBubble = otherPlayer.querySelector('.speech-bubble:not(.cleared)');
      speechBubble.classList.add('highlight');
    }
    await waitForNSeconds(1);
    for (const otherPlayer of otherPlayers) {
      const speechBubble = otherPlayer.querySelector('.speech-bubble:not(.cleared)');
      speechBubble.classList.remove('highlight');
    }

    playerPresentingPhoto.photo.classList.add('reveal-full-photo');
    await waitForNSeconds(1);

    for (const player of otherPlayers) {
      const speechBubble = player.querySelector('.speech-bubble:not(.cleared)');
      speechBubble.classList.add('cleared');
      await waitForNSeconds(0.5);
      speechBubble.remove();

      if (otherPlayerResponses.get(player) !== selfJudgementResult) {
        fooledSound.play();
        const fooledElement = document.createElement('div');
        fooledElement.classList.add('all-the-things');
        fooledElement.classList.add('fooled');
        fooledElement.textContent = 'FOOLED';
        player.appendChild(fooledElement);
      } else {
        notFooledSound.play();
        const notFooledElement = document.createElement('div');
        notFooledElement.classList.add('all-the-things');
        notFooledElement.classList.add('not-fooled');
        notFooledElement.textContent = 'not fooled';
        player.appendChild(notFooledElement);
      }
      await waitForNSeconds(1);
    }

    await waitForNSeconds(2);

    selfJudgementChannel.close();
    for (const otherPlayer of players) {
      const fooled = otherPlayer.querySelector('.fooled');
      if (fooled) {
        fooled.remove();
      }
      const notFooled = otherPlayer.querySelector('.not-fooled');
      if (notFooled) {
        notFooled.remove();
      }
    }

    playerPresentingPhoto.classList.remove('highlight-in-audience');
    playerPresentingPhoto.photo.classList.remove('reveal-full-photo');
    await waitForNSeconds(2);
    playerPresentingPhoto.photo.classList.remove('fullscreen');
    for (const photo of [...document.getElementsByClassName('photo-container')]) {
      photo.classList.remove('de-emphasize');
    }
    await waitForNSeconds(2);
  }

  for (const photoContainer of [...document.getElementsByClassName('photo-container')]) {
    photoContainer.remove();
  }
}
