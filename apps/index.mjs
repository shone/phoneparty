import routes from '/host/routes.mjs';

// import '/apps/tunnel-vision/host/tunnel-vision.mjs';
import '/apps/show-and-tell/host/show-and-tell.mjs';
import '/apps/bubbleland/host/bubbleland.mjs';
import '/apps/test/host/test.mjs';

const container = document.createElement('div');
container.id = 'apps-index';
container.innerHTML = `
  <a href="#apps/show-and-tell"><span>Show and Tell</span></a>
  <a href="#apps/tunnel-vision">Tunnel Vision</a>
  <a href="#apps/bubbleland">Bubbleland</a>
  <a href="#apps/test">Test</a>
`;

document.head.insertAdjacentHTML('beforeend', `
  <link rel="stylesheet" href="/apps/index.css">
`);

routes['#apps'] = async function appsIndex({waitForEnd}) {
  document.body.style.backgroundColor = 'black';
  document.body.append(container);

  await waitForEnd();

  container.remove();
}
