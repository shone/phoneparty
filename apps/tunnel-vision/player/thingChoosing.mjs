import routes from '/player/routes.mjs';

routes['#apps/tunnel-vision/thing-choosing'] = async function thingChoosing({waitForEnd, listenForChannel}) {
  document.body.style.backgroundColor = '#98947f';

  const panelA = document.getElementById('panel-A');
  panelA.insertAdjacentHTML('beforeend', `
    <div class="tunnel-vision thing-choosing-screen active">
      <h1>Choosing thing...</h1>
      <div class="thinking-emoji"></div>
    </div>
  `);
  const thingChoosingScreen = panelA.lastElementChild;

  listenForChannel(channel => {
    channel.onmessage = () => {
      thingChoosingScreen.querySelector('h1').remove();
      thingChoosingScreen.querySelector('.thinking-emoji').remove();
      const thingName = event.data;
      thingChoosingScreen.insertAdjacentHTML('beforeend', `
        <div class="thing">
          <img src="/apps/tunnel-vision/things/${thingName}.svg">
          <label>${thingName}</label>
        </div>
      `);
    }
  });

  await waitForEnd();
  thingChoosingScreen.remove();
}
