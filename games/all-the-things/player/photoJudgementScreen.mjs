import routes, {
  waitForRouteToEnd,
  listenForChannelOnCurrentRoute
} from '/routes.mjs';

routes['#games/all-the-things/photo-judgement'] = async function photoJudgement() {
  const thing = 'sock';// await getThing();

  const subjectPanel = document.getElementById('subject-panel');
  const image = document.createElement('img');
  image.classList.add('photo-judgement-image');
  subjectPanel.appendChild(image);
  image.classList.add('active');
  listenForChannelOnCurrentRoute(channel => channel.onmessage = event => {
    const arrayBuffer = event.data;
    const blob = new Blob([arrayBuffer], {type: 'image/jpeg'});
    image.src = URL.createObjectURL(blob);
  });

  const messagingPanel = document.getElementById('messaging-panel');
  const judgementScreen = document.createElement('div');
  judgementScreen.classList.add('all-the-things', 'photo-judgement-screen');
  judgementScreen.insertAdjacentHTML('beforeend', `
    <h1>Is this photo really of:</h1>
    <img src="/games/all-the-things/things/${thing}.svg">
    <div class="label">${thing}</div>
    <div class="real-or-fake">
      <button class="push-button" data-option="real">real</button>
      <button class="push-button" data-option="fake">fake</button>
    </div>
  `);
  messagingPanel.appendChild(judgementScreen);
  judgementScreen.classList.add('active');
  judgementScreen.querySelector('.real-or-fake').onclick = event => {
    const buttons = judgementScreen.querySelectorAll('.real-or-fake button');
    for (const button of buttons) {
      button.classList.remove('selected');
    }
    if (event.target.tagName === 'BUTTON') {
      channel.send(event.target.dataset.option);
      event.target.classList.add('selected');
    }
  }

  await waitForRouteToEnd();
  image.classList.remove('active');
  judgementScreen.classList.remove('active');
  setTimeout(() => {
    image.remove();
    judgementScreen.remove();
  }, 500);
}

export async function photoSelfJudgement(channel, getThing, photoCanvas) {
  const thing = await getThing();

  const subjectPanel = document.getElementById('subject-panel');
  photoCanvas.classList.add('photo-judgement-image');
  subjectPanel.appendChild(photoCanvas);
  photoCanvas.classList.add('active');

  const messagingPanel = document.getElementById('messaging-panel');
  const selfJudgementScreen = document.createElement('div');
  selfJudgementScreen.classList.add('all-the-things', 'photo-self-judgement-screen');
  selfJudgementScreen.insertAdjacentHTML('beforeend', `
    <h1>Is your photo really of:</h1>
    <img src="/games/all-the-things/things/${thing}.svg">
    <div class="label">${thing}</div>
    <div class="be-honest">be honest</div>
    <div class="buttons">
      <button class="push-button" data-response="real">yes</button>
      <button class="push-button" data-response="fake">no</button>
    </div>
  `);
  messagingPanel.appendChild(selfJudgementScreen);
  selfJudgementScreen.classList.add('active');
  selfJudgementScreen.onclick = event => {
    if (event.target.tagName === 'BUTTON') {
      channel.send(event.target.dataset.response);
      const buttons = selfJudgementScreen.querySelectorAll('button');
      for (const button of buttons) {
        button.classList.remove('selected');
      }
      event.target.classList.add('selected');
    }
  }

  await waitForDataChannelClose(channel);
  photoCanvas.classList.remove('active');
  selfJudgementScreen.classList.remove('active');
  setTimeout(() => {
    photoCanvas.remove();
    selfJudgementScreen.remove();
  }, 500);
}
