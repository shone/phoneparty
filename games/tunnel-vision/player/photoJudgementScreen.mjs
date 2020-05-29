import routes, {
  currentRoute,
  waitForRouteToEnd,
  listenForChannelOnCurrentRoute
} from '/routes.mjs';

import * as photoTakingScreen from './photoTakingScreen.mjs';

routes['#games/tunnel-vision/photo-judgement'] = async function photoJudgement() {
  const routeParams = new URLSearchParams(currentRoute.split('?')[1]);
  const thing = routeParams.get('thing');

  document.body.style.backgroundColor = '#98947f';

  const subjectPanel = document.getElementById('subject-panel');
  let subject = null;

  const messagingPanel = document.getElementById('messaging-panel');
  const judgementScreen = document.createElement('div');
  judgementScreen.classList.add('tunnel-vision', 'photo-judgement-screen');

  listenForChannelOnCurrentRoute((channel, channelName) => {
    judgementScreen.insertAdjacentHTML('beforeend', `
      <h1>Is ${channelName === 'self-judgement' ? 'your' : 'this'} photo really of:</h1>
      <img>
      <label></label>
      <div class="real-or-fake">
        <button class="push-button" data-option="real">real</button>
        <button class="push-button" data-option="fake">fake</button>
      </div>
    `);
    judgementScreen.querySelector('label').textContent = thing;
    judgementScreen.querySelector('img').src = `/games/tunnel-vision/things/${thing}.svg`;
    messagingPanel.appendChild(judgementScreen);
    judgementScreen.classList.add('active');

    if (channelName === 'self-judgement') {
      judgementScreen.classList.add('self-judgement');
      judgementScreen.querySelector('label').insertAdjacentHTML('afterend', '<div class="be-honest">be honest</div>');
      photoTakingScreen.canvas.classList.add('photo-judgement-image', 'active');
      subjectPanel.appendChild(photoTakingScreen.canvas);
      subject = subjectPanel.lastElementChild;
    } else {
      subjectPanel.insertAdjacentHTML('beforeend', '<img class="photo-judgement-image active"></img');
      subject = subjectPanel.lastElementChild;
      channel.onmessage = event => {
        const arrayBuffer = event.data;
        const blob = new Blob([arrayBuffer], {type: 'image/jpeg'});
        subject.src = URL.createObjectURL(blob);
      }
    }

    judgementScreen.querySelector('.real-or-fake').onclick = event => {
      const buttons = judgementScreen.querySelectorAll('.real-or-fake button');
      buttons.forEach(button => button.classList.remove('selected'));
      if (event.target.tagName === 'BUTTON') {
        channel.send(event.target.dataset.option);
        event.target.classList.add('selected');
      }
    }
  });

  await waitForRouteToEnd();

  judgementScreen.classList.remove('active');
  setTimeout(() => judgementScreen.remove(), 500);

  if (subject) {
    subject.classList.remove('active');
    setTimeout(() => subject.remove(), 500);
  }
}
