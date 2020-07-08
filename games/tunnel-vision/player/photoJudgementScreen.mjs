import routes from '/player/routes.mjs';

import * as photoTakingScreen from './photoTakingScreen.mjs';

routes['#games/tunnel-vision/photo-judgement'] = async function photoJudgement({params, waitForEnd, listenForChannel}) {
  const thing = params.get('thing');

  document.body.style.backgroundColor = '#98947f';

  const panelA = document.createElement('div');
  panelA.classList.add('tunnel-vision', 'photo-judgement-panel-A');

  const panelB = document.createElement('div');
  panelB.classList.add('tunnel-vision', 'photo-judgement-panel-B');

  listenForChannel((channel, channelName) => {
    panelB.innerHTML = `
      <h1>Is ${channelName === 'self-judgement' ? 'your' : 'this'} photo really of:</h1>
      <img>
      <label></label>
      <div class="real-or-fake">
        <push-button data-option="real">real</push-button>
        <push-button data-option="fake">fake</push-button>
      </div>
    `;
    panelB.querySelector('label').textContent = thing;
    panelB.querySelector('img').src = `/games/tunnel-vision/things/${thing}.svg`;
    document.getElementById('panel-B').append(panelB);

    if (channelName === 'self-judgement') {
      panelB.classList.add('self-judgement');
      panelB.querySelector('label').insertAdjacentHTML('afterend', '<div class="be-honest">be honest</div>');
      photoTakingScreen.canvas.classList.add('photo-judgement-image');
      panelA.append(photoTakingScreen.canvas);
    } else {
      panelA.innerHTML = '<img class="photo-judgement-image"></img>';
      const img = panelA.lastElementChild;
      channel.onmessage = event => {
        const arrayBuffer = event.data;
        const blob = new Blob([arrayBuffer], {type: 'image/jpeg'});
        img.src = URL.createObjectURL(blob);
      }
    }
    document.getElementById('panel-A').append(panelA);

    panelB.querySelector('.real-or-fake').onclick = event => {
      const buttons = panelB.querySelectorAll('.real-or-fake push-button');
      buttons.forEach(button => button.classList.remove('selected'));
      if (event.target.tagName === 'PUSH-BUTTON') {
        channel.send(event.target.dataset.option);
        event.target.classList.add('selected');
      }
    }
  });

  await waitForEnd();

  panelA.remove();
  panelB.remove();
}
