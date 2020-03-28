import './titleScreen.mjs';
import './thingChoosingScreen.mjs';
import './goalScreen.mjs';
import './photoTakingScreen.mjs';
import './presentingPhotosScreen.mjs';
import './anotherRoundScreen.mjs';

import {currentRoute} from '/host/routes.mjs';

export const playerPhotos = [];

let nextPhotoId = 1;
export function getNextPhotoId() { return nextPhotoId++ };

export const routesWithPlayerGrid = new Set([
  '#games/all-the-things/photo-taking',
  '#games/all-the-things/photo-judgement',
]);

export function setupCurrentThingIndicator() {
  let chosenThingElement = document.querySelector('.all-the-things.thing.show-in-top-right');
  if (!chosenThingElement) {
    const routeParams = new URLSearchParams(currentRoute.split('?')[1]);
    const thingName = routeParams.get('thing');
    document.body.insertAdjacentHTML('beforeend', `
      <div class="all-the-things thing show-in-top-right">
        <img>
        <label class="thing-label"></label>
      </div>
    `);
    chosenThingElement = document.body.lastElementChild;
    chosenThingElement.dataset.name = thingName;
    chosenThingElement.querySelector('img').src = `/games/all-the-things/things/${thingName}.svg`;
    chosenThingElement.querySelector('label').textContent = thingName;
  }
  return chosenThingElement;
}

export function currentThingIndicatorRouteEnd() {
  switch (location.hash.split('?')[0]) {
    case '#games/all-the-things/goal':
    case '#games/all-the-things/photo-taking':
    case '#games/all-the-things/photo-judgement':
      return;
    default:
      const chosenThingElement = document.querySelector('.all-the-things.thing.show-in-top-right');
      if (chosenThingElement) {
        chosenThingElement.remove();
      }
  }
}
