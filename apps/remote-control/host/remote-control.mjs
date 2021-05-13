import routes from '/host/routes.mjs';

routes['#apps/remote-control'] = async function bubbleland({waitForEnd, createChannel, listenForPlayers, listenForLeavingPlayers}) {
  const container = document.createElement('div');
  container.attachShadow({mode: 'open'}).innerHTML = `
    <h1>Remote Control</h1>
  `;
  document.body.append(container);

  await waitForEnd();

  container.remove();
}
