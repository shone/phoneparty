"use strict";

async function presentingPhotosScreen() {
  await waitForNSeconds(2);

  let previousPhotoContainer = null;
  for (const photoContainer of [...document.getElementsByClassName('photo-container')]) {
    if (previousPhotoContainer) {
      previousPhotoContainer.classList.remove('fullscreen');
    }
    photoContainer.classList.add('fullscreen');
    await waitForKeypress(' ');
    photoContainer.classList.add('reveal-full-photo');
    await waitForKeypress(' ');
    photoContainer.classList.remove('reveal-full-photo');
    await waitForNSeconds(2);
    photoContainer.classList.remove('fullscreen');
    await waitForKeypress(' ');
    previousPhotoContainer = photoContainer;
  }
}
