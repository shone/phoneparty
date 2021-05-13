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
    this.append(video);

    player.getAvatarStream().then(stream => {
      // Firefox supports assigning the track directly to srcObject, but Chrome needs a MediaStream.
      video.srcObject = stream;
    });
  }
}

customElements.define('player-bubble', PlayerBubble);
