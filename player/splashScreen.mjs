export default function splashScreen(channel) {
  const previousBackgroundColor = document.body.style.backgroundColor;
  document.body.style.backgroundColor = 'black';
  document.body.insertAdjacentHTML('beforeend', `
    <div class="phone-party-splash-screen">
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
    </div>
  `);
  const splashScreen = document.body.lastElementChild;

  channel.onmessage = event => {
    if (event.data === 'finished') {
      splashScreen.classList.add('finished');
    }
  }

  channel.onclose = () => {
    splashScreen.remove();
    document.body.style.backgroundColor = previousBackgroundColor;
  }
}
