import routes from '/player/routes.mjs';

routes['#apps/remote-control'] = async function remoteControl({waitForEnd, listenForChannel}) {
  const container = document.createElement('div');
  container.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/apps/remote-control/player/main.css">
    <h1>Hello remote control buddy!</h1>
  `;
  document.body.append(container);

  await waitForEnd();
  container.remove();
}
