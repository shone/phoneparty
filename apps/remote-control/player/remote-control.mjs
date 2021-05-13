import routes from '/player/routes.mjs';

const getDirection = deadZone => position => {
  if (position.y > deadZone && position.y > Math.abs(position.x))
    return "forward";
  else if (-position.y > deadZone && -position.y > Math.abs(position.x))
    return "backward";
  else if (position.x > deadZone && position.x > Math.abs(position.y))
    return "right";
  else if (-position.x > deadZone && -position.x > Math.abs(position.y))
    return "left";
  else return "static";
}

routes['#apps/remote-control'] = async function remoteControl({waitForEnd, listenForChannel}) {
  const container = document.createElement('div');
  container.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/apps/remote-control/player/main.css">
    <div class="panel">
      <p id="direction"></p>
    </div>
    <div class="panel">
      <pp-joystick></pp-joystick>
    </div>
  `;
  const shadowRoot = container.shadowRoot;

  document.body.append(container);

  const joystick = shadowRoot.querySelector('pp-joystick');
  joystick.onthumbmove = position => {
    shadowRoot.getElementById("direction").textContent =
      getDirection(0.2)(position);
  }

  await waitForEnd();
  container.remove();
}
