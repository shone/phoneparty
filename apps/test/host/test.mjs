import routes from '/host/routes.mjs';

import {sendOnChannelWhenOpen} from '/common/utils.mjs';

import startMessaging from '/host/messaging.mjs';
import PlayerBubble from '/host/player-bubble.mjs';
import Audience from '/host/audience.mjs';

routes['#apps/test'] = async function test(routeContext) {
  const {waitForEnd, listenForPlayers, createChannel, listenForLeavingPlayers} = routeContext;

  document.body.style.backgroundColor = '#fff';

  const container = document.createElement('div');
  container.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/common/base.css">
    <link rel="stylesheet" href="/host/player-bubble.css">
    <link rel="stylesheet" href="/host/speech-bubble.css">
    <link rel="stylesheet" href="/host/audience.css">
    <link rel="stylesheet" href="/apps/test/host/test.css">

    <h1>Test</h1>

    <h2>Players</h2>

    <label>
      <input type="checkbox" id="audience-checkbox">
      Audience
    </label>

    <table id="players-table">
      <thead>
        <tr>
          <td></td> <td>ID</td> <td>Panel A</td> <td>Panel B</td> <td>Messaging</td>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;
  document.body.append(container);

  const playersTable = container.shadowRoot.getElementById('players-table');
  const playerTableRowMap = new Map();

  listenForPlayers(player => {
    const tr = playersTable.tBodies[0].insertRow();
    tr.player = player;
    tr.innerHTML = `
      <td class="bubble"></td>
      <td>${player.playerId}</td>
      <td data-panel="a"> <input type="checkbox"> </td>
      <td data-panel="b"> <input type="checkbox"> </td>
      <td class="messaging"> <input type="checkbox"> </td>
    `;
    const playerBubble = new PlayerBubble(player);
    tr.querySelector('.bubble').append(playerBubble);
    playerTableRowMap.set(player, tr);
  });

  listenForLeavingPlayers(player => {
    const tr = playerTableRowMap.get(player);
    if (tr) {
      tr.remove();
      playerTableRowMap.delete(player);
    }
  });

  const panelChannels = new Map();
  listenForPlayers(player => {
    const panelChannel = createChannel(player, 'panels');
    panelChannels.set(player, panelChannel);
  });
  listenForLeavingPlayers(player => panelChannels.delete(player));
  playersTable.addEventListener('change', event => {
    const tr = event.target.closest('tr');
    const td = event.target.closest('td');
    if (!tr || !td) return;
    if (event.target.type === 'checkbox' && td.dataset.panel) {
      const panelChannel = panelChannels.get(tr.player);
      panelChannel.send(`${td.dataset.panel} ${event.target.checked ? 'activate' : 'deactivate'}`);
    }
  });

  const messagingChannels = new Map();
  playersTable.addEventListener('change', event => {
    const tr = event.target.closest('tr');
    const td = event.target.closest('td');
    if (!tr || !td) return;
    if (event.target.type === 'checkbox' && td.classList.contains('messaging')) {
      if (event.target.checked) {
        const messagingChannel = createChannel(tr.player, 'messaging');
        startMessaging(messagingChannel, tr.querySelector('player-bubble'));
        messagingChannels.set(tr.player, messagingChannel);
      } else {
        const messagingChannel = messagingChannels.get(tr.player);
        if (messagingChannel) {
          messagingChannel.close();
          messagingChannels.delete(tr.player);
        }
      }
    }
  });

  let audience = null;
  container.shadowRoot.getElementById('audience-checkbox').onchange = ({target}) => {
    if (target.checked) {
      audience = new Audience(routeContext);
      container.shadowRoot.append(audience);
    } else {
      audience.remove();
      audience = null;
    }
  };

  await waitForEnd();

  container.remove();
}
