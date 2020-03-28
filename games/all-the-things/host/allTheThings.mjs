import './titleScreen.mjs';
import './thingChoosingScreen.mjs';
import './goalScreen.mjs';
import './photoTakingScreen.mjs';
import './presentingPhotosScreen.mjs';
import './anotherRoundScreen.mjs';

export const playerPhotos = [];

let nextPhotoId = 1;
export function getNextPhotoId() { return nextPhotoId++ };

export const routesWithPlayerGrid = new Set([
  '#games/all-the-things/photo-taking',
  '#games/all-the-things/photo-judgement',
]);
