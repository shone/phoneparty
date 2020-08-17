export default class Joystick extends HTMLElement {
  constructor() {
    super();

    this.onthumbmove = position => {};

    this.attachShadow({mode: 'open'}).innerHTML = `
      <link rel="stylesheet" href="/common/joystick.css">
      <div id="thumb"></div>
    `;
    const thumb = this.shadowRoot.getElementById('thumb');

    this.position = {x: 0, y: 0};

    thumb.onpointerdown = event => {
      event.preventDefault();
      if (thumb.onpointermove) return;

      if (event.button && event.button > 0) return;

      const pointerId = event.pointerId;
      thumb.setPointerCapture(pointerId);
      thumb.style.cursor = 'grabbing';

      const boundingBox = this.getBoundingClientRect();

      const initialOffset = {
        x: event.clientX - (boundingBox.x + (boundingBox.width  / 2)),
        y: event.clientY - (boundingBox.y + (boundingBox.height / 2)),
      }

      thumb.onpointermove = event => {
        if (event.pointerId !== pointerId) return;

        const offset = {
          x: event.pageX - (boundingBox.left + (boundingBox.width  / 2)),
          y: event.pageY - (boundingBox.top  + (boundingBox.height / 2)),
        }

        this.position.x =  (offset.x - initialOffset.x) / (boundingBox.width / 2);
        this.position.y = -(offset.y - initialOffset.y) / (boundingBox.height / 2);

        const length = vectorLength(this.position);
        if (length > 1) {
          this.position.x /= length;
          this.position.y /= length;
        }

        if (this.onthumbmove) {
          this.onthumbmove(this.position);
        }

        thumb.style.transform = `translate(${this.position.x * 50}%, ${-this.position.y * 50}%)`;
      }

      thumb.onpointerup = thumb.onpointercancel = event => {
        if (event.pointerId !== pointerId) return;
        thumb.releasePointerCapture(pointerId);
        thumb.style.cursor = '';
        this.position = {x: 0, y: 0};
        if (this.onthumbmove) {
          this.onthumbmove(this.position);
        }
        thumb.style.transform = 'translate(0,0)';
        thumb.onpointermove = null;
        thumb.onpointerup = null;
        thumb.onpointercancel = null;
      }
    }
  }
}

function vectorLength(v) {
  return Math.sqrt((v.x * v.x) + (v.y * v.y));
}

customElements.define('pp-joystick', Joystick);
