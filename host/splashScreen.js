async function splashScreen() {
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

  const timeAtSplashStart = performance.now();
  
  await waitForKeypress(' ');
  splashScreen.classList.add('finished');

  if ((performance.now() - timeAtSplashStart) > 2000) {
    await waitForNSeconds(2);
  }
  splashScreen.remove();
}
