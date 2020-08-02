const host = document.getElementById('host');
const splitter = document.getElementById('splitter');
const playersPanel = document.getElementById('players-panel');
const playersContainer = document.getElementById('players');
const addPlayerPanel = document.getElementById('add-player-panel');
const routeInput = document.getElementById('route');

host.src = "/host" + location.hash;

routeInput.value = location.hash;

host.onload = () => {
  host.contentWindow.addEventListener('hashchange', () => {
    const route = host.contentWindow.location.hash;
    routeInput.value = route;
    location.hash = route;
  });
}

window.onhashchange = () => {
  host.contentWindow.location.hash = location.hash;
}

splitter.onpointerdown = event => {
  event.preventDefault();

  if (splitter.onpointermove) return;

  const pointerId = event.pointerId;
  splitter.setPointerCapture(pointerId);

  splitter.onpointermove = event => {
    if (event.pointerId !== pointerId) return;
    let panelHeight = (1 - (event.pageY / window.innerHeight)) * 100;
    panelHeight = Math.min(panelHeight, 70);
    panelHeight = Math.max(panelHeight, 20);
    playersPanel.style.setProperty('--panel-height', `${panelHeight}vh`);
    layoutPlayerIframes();
  }

  splitter.onpointerup = splitter.onpointercancel = event => {
    if (event.pointerId !== pointerId) return;
    splitter.onpointermove = null;
    splitter.onpointerup = null;
    splitter.onpointercancel = null;
  }
}

addPlayerPanel.onclick = ({target}) => {
  if (target.tagName === 'BUTTON') {
    const deviceName = target.textContent.trim();
    addPlayer(deviceName);
  }
}

function addPlayer(deviceName) {
  playersContainer.insertAdjacentHTML('beforeend', `
    <span class="player-container" data-device='${deviceName}' data-orientation="portrait">
      <div class="phone">
        <div class="screen-content">
          <iframe src="/player"></iframe>
        </div>
      </div>
      <div class="controls">
        <button class="rotate-button"></button>
        <button class="remove-button"></button>
      </div>
    </span>
  `);
  layoutPlayerIframes();
}

addPlayer('Pixel 4');
addPlayer('iPhone 11');
addPlayer('iPad Pro 2020 11"');

function layoutPlayerIframes() {
  for (const playerContainer of playersContainer.querySelectorAll('.player-container')) {
    const screenContent = playerContainer.querySelector('.screen-content');
    const iframe = playerContainer.querySelector('iframe');
    const screenContentHeight = screenContent.getBoundingClientRect().height;
    const scale = screenContentHeight / iframe.contentWindow.innerHeight;
    iframe.style.transform = `scale(${scale})`;
  }
}

layoutPlayerIframes();
window.addEventListener('resize', layoutPlayerIframes);

playersContainer.onclick = event => {
  if (event.target.classList.contains('rotate-button')) {
    const playerContainer = event.target.closest('.player-container');
    playerContainer.dataset.orientation = playerContainer.dataset.orientation === 'portrait' ? 'landscape' : 'portrait';
    layoutPlayerIframes();
  } else if (event.target.classList.contains('remove-button')) {
    event.target.closest('.player-container').remove();
  }
}
