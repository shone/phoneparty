import routes, {waitForRouteChange, listenForChannelOnCurrentRoute} from './routes.mjs';

routes['#splash-screen'] = async function splashScreen() {
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

  listenForChannelOnCurrentRoute(channel => {
    channel.onmessage = () => {
      splashScreen.classList.add('finished');
    }
  });

  await waitForRouteChange();
  splashScreen.remove();
}
