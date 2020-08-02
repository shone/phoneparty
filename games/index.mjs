import routes from '/host/routes.mjs';

import '/games/tunnel-vision/host/tunnel-vision.mjs';
import '/games/show-and-tell/host/show-and-tell.mjs';
import '/games/bubbleland/host/bubbleland.mjs';

const container = document.createElement('div');
container.id = 'games-index';
container.innerHTML = `
  <a href="#games/show-and-tell"><span>Show and Tell</span></a>
  <a href="#games/tunnel-vision">Tunnel Vision</a>
  <a href="#games/bubbleland">Bubbleland</a>
`;

document.head.insertAdjacentHTML('beforeend', `
  <link rel="stylesheet" href="/games/index.css">
`);

routes['#games'] = async function gamesIndex({waitForEnd}) {
  document.body.style.backgroundColor = 'black';
  document.body.append(container);

  await waitForEnd();

  container.remove();
}
