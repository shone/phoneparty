import './titleScreen.mjs';
import './thingChoosingScreen.mjs';
import './photoTakingScreen.mjs';
import './photoJudgementScreen.mjs';

import routes, {
  listenForChannelOnCurrentRoute,
  waitForRouteToEnd,
} from '/routes.mjs';

routes['#games/all-the-things/goal'] = async function goalScreen() {
  document.body.style.backgroundColor = '#98947f';
  await confirmation('Ready to start looking?');
}

routes['#games/all-the-things/another-round'] = async function anotherRoundScreen() {
  document.body.style.backgroundColor = '#98947f';
  await confirmation('Play another round?');
}

async function confirmation(text) {

  let heading = null;
  let yesButton = null;

  listenForChannelOnCurrentRoute(channel => {
    const subjectPanel = document.getElementById('subject-panel');
    subjectPanel.insertAdjacentHTML('beforeend', `
      <h1 class="all-the-things confirmation active flash">
        ${text}
      </h1>
    `);
    heading = subjectPanel.lastElementChild;

    const messagingPanel = document.getElementById('messaging-panel');
    messagingPanel.insertAdjacentHTML('beforeend', `
      <button class="all-the-things yes-button push-button active"></button>
    `);
    yesButton = messagingPanel.lastElementChild;

    yesButton.onclick = () => {
      channel.send(true);
      yesButton.classList.add('selected');
      heading.classList.remove('flash');
    }
  });

  await waitForRouteToEnd();

  if (heading) {
    heading.classList.remove('active', 'flash');
    setTimeout(() => heading.remove(), 500);
  }

  if (yesButton) {
    yesButton.classList.remove('active');
    setTimeout(() => yesButton.remove(), 500);
  }
}
