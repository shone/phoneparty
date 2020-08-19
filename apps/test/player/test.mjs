import routes from '/player/routes.mjs';

import startMessaging from '/player/messaging.mjs';

routes['#apps/test'] = async function panelTest({waitForEnd, listenForChannel}) {
  const testPanelA = document.createElement('div');
  const testPanelB = document.createElement('div');

  testPanelA.id = 'test-panel-A';
  testPanelB.id = 'test-panel-B';

  testPanelA.textContent = 'A';
  testPanelB.textContent = 'B';

  listenForChannel((channel, channelName) => {
    if (channelName === 'panels') {
      channel.onmessage = event => {
        switch (event.data) {
          case 'a activate':   document.getElementById('panel-A').append(testPanelA); break;
          case 'a deactivate': testPanelA.remove(); break;
          case 'b activate':   document.getElementById('panel-B').append(testPanelB); break;
          case 'b deactivate': testPanelB.remove(); break;
        }
      }
    } else if (channelName === 'messaging') {
      startMessaging(channel);
    }
  });

  await waitForEnd();

  testPanelA.remove();
  testPanelB.remove();
}
