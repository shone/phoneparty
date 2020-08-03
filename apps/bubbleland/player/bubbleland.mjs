import routes from '/player/routes.mjs';

routes['#apps/bubbleland'] = async function bubbleland({waitForEnd, listenForChannel}) {
  document.body.style.backgroundColor = '#000';

  const panel = document.createElement('div');
  panel.id = 'movement-panel';
  panel.innerHTML = `
    <div class="arrow-buttons">
      <push-button data-button="up"    data-key="ArrowUp">   </push-button>
      <push-button data-button="down"  data-key="ArrowDown"> </push-button>
      <push-button data-button="left"  data-key="ArrowLeft"> </push-button>
      <push-button data-button="right" data-key="ArrowRight"></push-button>
    </div>
  `;

  const buttons = panel.querySelector('.arrow-buttons');

  listenForChannel((channel, channelName) => {
    for (const button of buttons.getElementsByTagName('push-button')) {
      button.addEventListener('pressed',   () => channel.send(button.dataset.button + ' true'));
      button.addEventListener('unpressed', () => channel.send(button.dataset.button + ' false'));
    }
  });

  document.getElementById('panel-A').append(panel);

  await waitForEnd();

  panel.remove();
}
