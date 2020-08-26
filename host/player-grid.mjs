import {players} from './players.mjs';

document.head.insertAdjacentHTML('beforeend', `
  <link rel="stylesheet" href="/host/player-grid.css">
`);

export default class PlayerGrid extends HTMLElement {
  constructor(routeContext) {
    super();

    const {listenForPlayers, listenForLeavingPlayers} = routeContext;

    this.playerSlotMap = new Map();

    listenForPlayers(player => {
      const slot = document.createElement('div');
      slot.classList.add('slot');
      setTimeout(() => slot.classList.add('open'), 100);

      this.append(slot);
      this.playerSlotMap.set(player, slot);
      this.style.setProperty('--player-count', players.length);
      this.style.setProperty('--player-sqrt', Math.floor(Math.sqrt(players.length)));
    });

    listenForLeavingPlayers(player => {
      const slot = this.playerSlotMap.get(player);
      if (slot) {
        slot.classList.remove('open');
        setTimeout(() => slot.remove(), 500);
        this.playerSlotMap.delete(player);
      }
      this.style.setProperty('--player-count', players.length);
      this.style.setProperty('--player-sqrt', Math.floor(Math.sqrt(players.length)));
    });
  }
}

customElements.define('player-grid', PlayerGrid);
