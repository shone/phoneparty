import {players} from './players.mjs';

import PlayerBubble from './player-bubble.mjs';

document.head.insertAdjacentHTML('beforeend', `
  <link rel="stylesheet" href="/host/audience.css">
`);

export default class Audience extends HTMLElement {
  constructor(routeContext) {
    super();

    const {listenForPlayers, listenForLeavingPlayers} = routeContext;

    const playerSlotMap = new Map();

    listenForPlayers(player => {
      const slot = document.createElement('div');
      slot.classList.add('slot');
      slot.style.animation = '.5s forwards audience-slot-open';

      const playerBubble = new PlayerBubble(player);
      slot.append(playerBubble);
      slot.playerBubble = playerBubble;

      this.append(slot);
      playerSlotMap.set(player, slot);
      this.style.setProperty('--player-count', players.length);
    });

    listenForLeavingPlayers(player => {
      const playerSlot = playerSlotMap.get(player);
      if (playerSlot) {
        playerSlot.style.animation = '.5s forwards audience-slot-close';
        playerSlot.onanimationend = playerSlot.onanimationcancel = () => playerSlot.remove();
        playerSlotMap.delete(player);
      }
      this.style.setProperty('--player-count', players.length);
    });
  }
}

customElements.define('audience-el', Audience);
