import '/common/push-button.mjs';

export default class SplashScreen extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode:'open'}).innerHTML = `
      <link rel="stylesheet" href="/common/splash-screen.css">

      <div class="inner-container">
        <div class="phone-party-text"></div>
        <div class="white-box"></div>
        <div class="phones">
          <div class="phone"></div>
          <div class="phone"></div>
          <div class="phone"></div>
          <div class="phone"></div>
        </div>
        <div class="bubbles">
          <div class="bubble"></div>
          <div class="bubble"></div>
          <div class="bubble"></div>
          <div class="bubble"></div>
        </div>
      </div>
    `;
  }
}
customElements.define('splash-screen', SplashScreen);
