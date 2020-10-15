import {players} from './players.mjs';

import PlayerBubble from './player-bubble.mjs';

document.head.insertAdjacentHTML('beforeend', `
  <link rel="stylesheet" href="/host/audience.css">
`);

export default class Audience extends HTMLElement {
  constructor(routeContext) {
    super();

    const {listenForPlayers, listenForLeavingPlayers} = routeContext;

    this.playerSlotMap = new Map();
    this.emptySlots = [];
    this.minPlayerCount = 0;

    listenForPlayers(player => {
      let slot = this.emptySlots.shift();
      if (!slot) {
        slot = document.createElement('div');
        slot.classList.add('slot');
        this.append(slot);
        setTimeout(() => slot.classList.add('open'), 100);
      }

      const playerBubble = new PlayerBubble(player);
      slot.append(playerBubble);
      slot.playerBubble = playerBubble;

      this.playerSlotMap.set(player, slot);
      this.style.setProperty('--slot-count', this.getSlotCount());
    });

    listenForLeavingPlayers(player => {
      const slot = this.playerSlotMap.get(player);
      if (slot) {
        slot.classList.remove('open');
        setTimeout(() => slot.remove(), 500);
        this.playerSlotMap.delete(player);
      }
      if (this.getSlotCount() < this.minPlayerCount) {
        const slot = document.createElement('div');
        slot.classList.add('slot', 'open');
        this.append(slot);
        this.emptySlots.push(slot);
      }
      this.style.setProperty('--slot-count', this.getSlotCount());
    });
  }

  getPlayerBubble(player) {
    const slot = this.playerSlotMap.get(player);
    return slot && slot.playerBubble;
  }

  getSlotCount() {
    return this.playerSlotMap.size + this.emptySlots.length;
  }

  setMinPlayerCount(minPlayerCount) {
    this.minPlayerCount = minPlayerCount;
    const slotCount = this.getSlotCount();
    if (slotCount < minPlayerCount) {
      const newSlotCount = minPlayerCount - slotCount;
      const template = document.createElement('template');
      template.innerHTML = '<div class="slot open"></div>'.repeat(newSlotCount);
      this.emptySlots.push(...template.content.children);
      this.append(template.content);
      this.style.setProperty('--slot-count', newSlotCount);
    }
  }
}

customElements.define('audience-el', Audience);
