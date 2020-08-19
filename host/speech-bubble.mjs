export default class SpeechBubble extends HTMLElement {
  constructor(text) {
    super();
    this.textContent = text;
  }
}

customElements.define('speech-bubble', SpeechBubble);
