import {waitForNSeconds} from '/shared/utils.mjs';

export default function thingChoosingScreen(channel) {
  const subjectPanel = document.getElementById('subject-panel');
  subjectPanel.insertAdjacentHTML('beforeend', `
    <div class="all-the-things thing-choosing-screen active">
      <h1>Choosing thing...</h1>
      <div class="thinking-emoji"></div>
    </div>
  `);
  const thingChoosingScreen = subjectPanel.lastElementChild;

  channel.addEventListener('message', event => {
    thingChoosingScreen.querySelector('h1').remove();
    thingChoosingScreen.querySelector('.thinking-emoji').remove();
    const thingName = event.data;
    thingChoosingScreen.insertAdjacentHTML('beforeend', `
      <div class="thing">
        <img src="/games/all-the-things/things/${thingName}.svg">
        <label>${thingName}</label>
      </div>
    `);
  });

  channel.onclose = () => {
    thingChoosingScreen.classList.remove('active');
    setTimeout(() => {
      thingChoosingScreen.remove();
    }, 500);
  }
}
