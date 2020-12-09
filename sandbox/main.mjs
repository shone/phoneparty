const host             = document.getElementById('host'),
      splitter         = document.getElementById('splitter'),
      devicesPanel     = document.getElementById('devices-panel'),
      devicesContainer = document.getElementById('devices'),
      addDevicePanel   = document.getElementById('add-device-panel');

// Keep the host IFrame and the parent sandbox hash location in sync
host.contentWindow.location.replace("/host" + location.hash)
host.onload = () => {
  host.contentWindow.addEventListener('hashchange', event => {
    history.replaceState('', '', host.contentWindow.location.hash);
  });
}
window.onhashchange = () => host.contentWindow.location.hash = location.hash;

devicesPanel.style.setProperty('--panel-height', `${localStorage.getItem('sandbox-panel-height') || '45'}vh`);

splitter.onpointerdown = event => {
  event.preventDefault();

  if (event.button && event.button > 0) return;
  if (splitter.onpointermove) return;

  const pointerId = event.pointerId;
  splitter.setPointerCapture(pointerId);

  splitter.onpointermove = event => {
    if (event.pointerId !== pointerId) return;
    let panelHeight = (1 - (event.pageY / window.innerHeight)) * 100;
    panelHeight = Math.min(panelHeight, 70);
    panelHeight = Math.max(panelHeight, 20);
    devicesPanel.style.setProperty('--panel-height', `${panelHeight}vh`);
    localStorage.setItem('sandbox-panel-height', panelHeight);
    devicesContainer.childNodes.forEach(layoutDeviceIframe);
  }

  splitter.onpointerup = splitter.onpointercancel = event => {
    if (event.pointerId !== pointerId) return;
    splitter.releasePointerCapture(pointerId);
    splitter.onpointermove = null;
    splitter.onpointerup = null;
    splitter.onpointercancel = null;
  }
}

const devices = JSON.parse(localStorage.getItem('sandbox_devices')) || [
  {name: 'Pixel 4',           orientation: 'portrait'},
  {name: 'iPhone 11',         orientation: 'portrait'},
  {name: 'iPad Pro 2020 11"', orientation: 'portrait'},
];

devicesContainer.append(...devices.map(createDeviceContainer));

addDevicePanel.onclick = ({target}) => {
  if (target.tagName === 'BUTTON') {
    const device = {name: target.textContent.trim(), orientation: 'portrait'};
    const deviceElement = createDeviceContainer(device);
    devicesContainer.append(deviceElement);
    layoutDeviceIframe(deviceElement);
    deviceElement.scrollIntoView({behavior: 'smooth'});
    devices.push(device);
    localStorage.setItem('sandbox_devices', JSON.stringify(devices));
  }
}

function createDeviceContainer(device) {
  const element = document.createElement('span');

  element.classList.add('device-container');

  element.dataset.device = device.name;
  element.dataset.orientation = device.orientation;

  element.innerHTML = `
    <div class="device">
      <div class="screen-content">
        <iframe src="/player"></iframe>
      </div>
    </div>
    <div class="controls">
      <button data-action="rotate"></button>
      <button data-action="remove"></button>
    </div>
  `;

  return element;
}

function layoutDeviceIframe(deviceContainer) {
  const screenContent = deviceContainer.querySelector('.screen-content');
  const iframe = deviceContainer.querySelector('iframe');
  const scale = screenContent.offsetHeight / iframe.contentWindow.innerHeight;
  iframe.style.transform = `scale(${scale})`;
}

devicesContainer.childNodes.forEach(layoutDeviceIframe);
window.addEventListener('resize', () => devicesContainer.childNodes.forEach(layoutDeviceIframe));

devicesContainer.onclick = ({target}) => {
  const deviceContainer = target.closest('.device-container');
  const action = target.dataset.action;
  if (!(deviceContainer && action)) return;

  const index = [...devicesContainer.childNodes].indexOf(deviceContainer);

  switch (action) {
    case 'rotate':
      const orientation = deviceContainer.dataset.orientation === 'portrait' ? 'landscape' : 'portrait';
      deviceContainer.dataset.orientation = orientation;
      layoutDeviceIframe(deviceContainer);
      deviceContainer.scrollIntoView({behavior: 'smooth'});
      devices[index].orientation = orientation;
      break;
    case 'remove':
      deviceContainer.remove();
      devices.splice(index, 1);
      break;
  }
  localStorage.setItem('sandbox_devices', JSON.stringify(devices));
}
