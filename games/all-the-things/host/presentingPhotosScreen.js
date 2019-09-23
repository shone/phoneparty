"use strict";

async function presentingPhotosScreen(messaging) {
  await waitForNSeconds(2);

  const fooledSound    = new Audio('/games/all-the-things/sounds/fooled.mp3');
  const notFooledSound = new Audio('/games/all-the-things/sounds/not-fooled.mp3');

  for (const playerPresentingPhoto of players) {
    playerPresentingPhoto.classList.remove('wiggleable');
    playerPresentingPhoto.style.transform = '';
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

    for (const player of players) {
      const speechBubble = player.querySelector('.speech-bubble:not(.cleared)');
      if (speechBubble) {
        speechBubble.classList.add('cleared');
        setTimeout(() => speechBubble.remove(), 500);
      }
    }
    const judgementChannels = players.map(player => {
      const channel = player.rtcConnection.createDataChannel('all-the-things_photo-judgement');
      const arrayBuffer = playerPresentingPhoto.photo.arrayBuffer;
      channel.onopen = () => channel.send(arrayBuffer);
      return channel;
    });
    messaging.setPossibleMessages(['real', 'fake']);
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
    selfJudgementChannel.close();
    for (const channel of judgementChannels) {
      channel.close();
    }
    messaging.stop();

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

    // Reveal fooled/not-fooled state for each player
    for (const player of otherPlayers) {
      const speechBubble = player.querySelector('.speech-bubble:not(.cleared)');
      speechBubble.classList.add('cleared');
      await waitForNSeconds(0.5);
      speechBubble.remove();

      for (const photo of [...document.getElementsByClassName('photo-container')]) {
        photo.classList.add('de-emphasize');
      }

      player.classList.add('transitioning-to-fullscreen-in-audience');
      player.classList.add('fullscreen-in-audience');
      await waitForNSeconds(1);

      if (otherPlayerResponses.get(player) !== selfJudgementResult) {
        fooledSound.play();
        const fooledStamp = document.createElement('div');
        fooledStamp.classList.add('all-the-things');
        fooledStamp.classList.add('fooled-stamp');
        fooledStamp.textContent = 'FOOLED';
        player.appendChild(fooledStamp);
        const fooledOverlay = document.createElement('div');
        fooledOverlay.classList.add('all-the-things');
        fooledOverlay.classList.add('fooled-overlay');
        player.appendChild(fooledOverlay);
      } else {
        notFooledSound.play();
        const notFooledStamp = document.createElement('div');
        notFooledStamp.classList.add('all-the-things');
        notFooledStamp.classList.add('not-fooled-stamp');
        notFooledStamp.textContent = 'not fooled';
        player.appendChild(notFooledStamp);
        const lightbulbsCount = 6;
        for (let i=0; i < lightbulbsCount; i++) {
          const lightbulb = document.createElement('div');
          lightbulb.classList.add('all-the-things');
          lightbulb.classList.add('lightbulb');
          lightbulb.style.animationDelay = (0.7 * (i / lightbulbsCount)) + 's';
          lightbulb.style.transform = `translate(${((Math.random() - 0.5) * 2) * 250}%, ${((Math.random() - 0.5) * 2) * 250}%) rotate(${((Math.random() - 0.5) * 2) * 40}deg)`;
          player.appendChild(lightbulb);
        }
      }
      await waitForNSeconds(2.5);

      player.classList.remove('fullscreen-in-audience');
      setTimeout(() => player.classList.remove('transitioning-to-fullscreen-in-audience'), 500);
      await waitForNSeconds(0.5);

      for (const photo of [...document.getElementsByClassName('photo-container')]) {
        photo.classList.toggle('de-emphasize', photo.player !== playerPresentingPhoto);
      }
    }

    messaging = startMessaging(Array.from('👍👎👌😀😃😄😁😆😅🤣😂🙂😉😇☺️😋😛🥰🤔🤫🤨😬😏😌😔😴😟🙁😯😥👋✌️🤞'));

    await waitForNSeconds(2);

    for (const otherPlayer of players) {
      const fooledStamp = otherPlayer.querySelector('.fooled-stamp');
      if (fooledStamp) {
        fooledStamp.remove();
      }
      const fooledOverlay = otherPlayer.querySelector('.fooled-overlay');
      if (fooledOverlay) {
        fooledOverlay.remove();
      }
      const notFooledStamp = otherPlayer.querySelector('.not-fooled-stamp');
      if (notFooledStamp) {
        notFooledStamp.remove();
      }
      for (const lightbulb of [...otherPlayer.getElementsByClassName('lightbulb')]) {
        lightbulb.remove();
      }
    }

    playerPresentingPhoto.classList.remove('highlight-in-audience');
    playerPresentingPhoto.classList.add('wiggleable');
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

  return messaging;
}
