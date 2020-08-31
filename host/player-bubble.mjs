document.head.insertAdjacentHTML('beforeend', `
  <link rel="stylesheet" href="/host/player-bubble.css">
`);

export default class PlayerBubble extends HTMLElement {
  constructor(player) {
    super();

    this.player = player;

    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    if (player.stream) {
      video.srcObject = player.stream;
    } else {
      player.rtcConnection.addEventListener('track', ({streams}) => {
        video.srcObject = streams[0];
      }); // TODO: clean up listener with disconnectedCallback
    }
    this.append(video);
  }
}

customElements.define('player-bubble', PlayerBubble);
