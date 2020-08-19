import routes from '/player/routes.mjs';

import '/common/joystick.mjs';

import startMessaging from '/player/messaging.mjs';

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
    switch (channelName) {
      case 'joystick':
        joystick.onthumbmove = position => {
          channel.send(JSON.stringify(position));
        }
        break;
      case 'messaging':
        startMessaging(channel);
        break;
    }
  });

  document.getElementById('panel-A').append(panel);

  await waitForEnd();

  panel.remove();
}
