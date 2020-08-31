import routes from '/player/routes.mjs';

import startMessaging from '/player/messaging.mjs';

routes['#apps/tunnel-vision/choose'] = async function thingChoosing({waitForEnd, listenForChannel}) {
  const panelA = document.createElement('div');
  panelA.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/apps/tunnel-vision/player/choose.css">

    <h1>Choosing thing...</h1>
    <div id="thinking-emoji"></div>
  `;
  document.getElementById('panel-A').append(panelA);

  listenForChannel((channel, channelName) => {
    if (channelName === 'thing') {
      channel.onmessage = event => {
        panelA.shadowRoot.querySelector('h1').remove();
        panelA.shadowRoot.getElementById('thinking-emoji').remove();

        const thingName = event.data;

        const thingImg = new Image();
        thingImg.src = `/apps/tunnel-vision/things/${thingName}.svg`;
        panelA.shadowRoot.append(thingImg);

        const label = document.createElement('label');
        label.textContent = thingName;
        panelA.shadowRoot.append(label);
      }
    } else if (channelName === 'messaging') {
      startMessaging(channel);
    }
  });

  await waitForEnd();
  panelA.remove();
}
