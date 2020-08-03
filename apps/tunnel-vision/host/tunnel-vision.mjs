import './intro.mjs';
import './thingChoosing.mjs';
import './goal.mjs';
import './photoTaking.mjs';
import './presentingPhotos.mjs';
import './anotherRound.mjs';

export const playerPhotos = [];

let nextPhotoId = 1;
export function getNextPhotoId() { return nextPhotoId++ };

export const routesWithPlayerGrid = new Set([
  '#apps/tunnel-vision/photo-taking',
  '#apps/tunnel-vision/present-photos',
  '#apps/tunnel-vision/photo-judgement',
]);

export function setupCurrentThingIndicator(routeParams) {
  let chosenThingElement = document.querySelector('.tunnel-vision.thing.show-in-top-right');
  if (!chosenThingElement) {
    const thingName = routeParams.get('thing');
    document.body.insertAdjacentHTML('beforeend', `
      <div class="tunnel-vision thing show-in-top-right">
        <img>
        <label class="thing-label"></label>
      </div>
    `);
    chosenThingElement = document.body.lastElementChild;
    chosenThingElement.dataset.name = thingName;
    chosenThingElement.querySelector('img').src = `/apps/tunnel-vision/things/${thingName}.svg`;
    chosenThingElement.querySelector('label').textContent = thingName;
  }
  return chosenThingElement;
}

export function currentThingIndicatorRouteEnd() {
  switch (location.hash.split('?')[0]) {
    case '#apps/tunnel-vision/thing-choosing':
    case '#apps/tunnel-vision/goal':
    case '#apps/tunnel-vision/photo-taking':
    case '#apps/tunnel-vision/present-photos':
    case '#apps/tunnel-vision/photo-judgement':
      return;
    default:
      const chosenThingElement = document.querySelector('.tunnel-vision.thing.show-in-top-right');
      if (chosenThingElement) {
        chosenThingElement.remove();
      }
  }
}
