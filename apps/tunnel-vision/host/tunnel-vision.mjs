import './intro.mjs';
import './choose.mjs';
import './goal.mjs';
import './shoot.mjs';
// import './present.mjs';
import './end.mjs';

document.head.insertAdjacentHTML('beforeend', `
  <link rel="stylesheet" href="/apps/tunnel-vision/host/app-index.css">
  <link rel="stylesheet" href="/apps/tunnel-vision/timothy.css">
`);

export const playerPhotos = [];

let nextPhotoId = 1;
export function getNextPhotoId() { return nextPhotoId++ };
