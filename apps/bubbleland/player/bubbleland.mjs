import routes from '/player/routes.mjs';

import '/common/joystick.mjs';

routes['#apps/bubbleland'] = async function bubbleland({waitForEnd, listenForChannel}) {
  document.body.style.backgroundColor = '#000';

  const panel = document.createElement('div');
  panel.attachShadow({mode: 'open'}).innerHTML = `
    <style>
      :host {
        display: flex;
        justify-content: center;
        align-items: center;
      }
    </style>
    <pp-joystick></pp-joystick>
  `;

  const joystick = panel.shadowRoot.querySelector('pp-joystick');

  listenForChannel((channel, channelName) => {
    joystick.onthumbmove = position => {
      channel.send(JSON.stringify(position));
    }
  });

  document.getElementById('panel-A').append(panel);

  await waitForEnd();

  panel.remove();
}
