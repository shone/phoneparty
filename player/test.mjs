import routes, {waitForRouteToEnd, listenForChannelOnCurrentRoute} from './routes.mjs';

routes['#test'] = async function panelTest() {
  const testPanelA = document.createElement('div');
  const testPanelB = document.createElement('div');

  testPanelA.id = 'test-panel-A';
  testPanelB.id = 'test-panel-B';

  testPanelA.textContent = 'A';
  testPanelB.textContent = 'B';

  listenForChannelOnCurrentRoute(channel => {
    channel.onmessage = event => {
      switch (event.data) {
        case 'a activate':   document.getElementById('panel-A').append(testPanelA); break;
        case 'a deactivate': testPanelA.remove(); break;
        case 'b activate':   document.getElementById('panel-B').append(testPanelB); break;
        case 'b deactivate': testPanelB.remove(); break;
      }
    }
  });

  await waitForRouteToEnd();

  testPanelA.remove();
  testPanelB.remove();
}
