import routes from './routes.mjs';

import {sendOnChannelWhenOpen} from '/common/utils.mjs';

import * as messaging from './messaging.mjs';
import * as audienceMode from './audienceMode.mjs';

routes['#test'] = async function test({waitForEnd, listenForPlayers, createChannel, listenForLeavingPlayers}) {
  document.body.style.backgroundColor = '#fff';
  document.body.insertAdjacentHTML('beforeend', `
    <div>
      <h1>Test</h1>

      <h2>Panels</h2>
      <table>
        <tbody>
          <tr>
            <td>Panel A</td>
            <td> <button data-panel="a" data-action="activate"  > Activate   </button> </td>
            <td> <button data-panel="a" data-action="deactivate"> Deactivate </button> </td>
          </tr>
          <tr>
            <td>Panel B</td>
            <td> <button data-panel="b" data-action="activate"  > Activate   </button> </td>
            <td> <button data-panel="b" data-action="deactivate"> Deactivate </button> </td>
          </tr>
        </tbody>
      </table>

      <h2>Messaging</h2>
      <button data-action="start-messaging">Start</button>
      <button data-action="stop-messaging">Stop</button>

      <h2>Audience Mode</h2>
      <button data-action="start-audience-mode">Start</button>
      <button data-action="stop-audience-mode">Stop</button>
    </div>
  `);
  const element = document.body.lastElementChild;

  const channels = new Map();
  listenForPlayers(player => channels.set(player, createChannel(player)));
  listenForLeavingPlayers(player => channels.delete(player));

  element.onclick = event => {
    if (event.target.tagName === 'BUTTON' && event.target.dataset.panel) {
      for (const [player, channel] of channels) {
        sendOnChannelWhenOpen(channel, event.target.dataset.panel + ' ' + event.target.dataset.action);
      }
    }
  }

  element.querySelector('[data-action="start-messaging"]').onclick = () => messaging.start();
  element.querySelector('[data-action="stop-messaging"]').onclick  = () => messaging.stop();

  element.querySelector('[data-action="start-audience-mode"]').onclick = () => audienceMode.start();
  element.querySelector('[data-action="stop-audience-mode"]').onclick  = () => audienceMode.stop();

  await waitForEnd();

  element.remove();
  messaging.stop()
}
