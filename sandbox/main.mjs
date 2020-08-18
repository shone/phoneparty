const host = document.getElementById('host');
const splitter = document.getElementById('splitter');
const devicesPanel = document.getElementById('devices-panel');
const devicesContainer = document.getElementById('devices');
const addDevicePanel = document.getElementById('add-device-panel');
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
    layoutDeviceIframes();
  }

  splitter.onpointerup = splitter.onpointercancel = event => {
    if (event.pointerId !== pointerId) return;
    splitter.releasePointerCapture(pointerId);
    splitter.onpointermove = null;
    splitter.onpointerup = null;
    splitter.onpointercancel = null;
  }
}

let devices = [];

const localStorageDevices = localStorage.getItem('sandbox_devices');
if (localStorageDevices) {
  devices = JSON.parse(localStorageDevices);
} else {
  devices = [
    {name: 'Pixel 4',           orientation: 'portrait'},
    {name: 'iPhone 11',         orientation: 'portrait'},
    {name: 'iPad Pro 2020 11"', orientation: 'portrait'},
  ];
}

for (const device of devices) {
  addDevice(device);
}

addDevicePanel.onclick = ({target}) => {
  if (target.tagName === 'BUTTON') {
    const device = {name: target.textContent.trim(), orientation: 'portrait'};
    addDevice(device);
    devices.push(device);
    localStorage.setItem('sandbox_devices', JSON.stringify(devices));
  }
}

function addDevice(device) {
  devicesContainer.insertAdjacentHTML('beforeend', `
    <span class="device-container" data-device='${device.name}' data-orientation="${device.orientation}">
      <div class="device">
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
  layoutDeviceIframes();
  devicesContainer.scrollTo({left: devicesContainer.scrollWidth, behavior: 'smooth'});
}

function layoutDeviceIframes() {
  for (const deviceContainer of devicesContainer.querySelectorAll('.device-container')) {
    const screenContent = deviceContainer.querySelector('.screen-content');
    const iframe = deviceContainer.querySelector('iframe');
    const scale = screenContent.offsetHeight / iframe.contentWindow.innerHeight;
    iframe.style.transform = `scale(${scale})`;
  }
}

layoutDeviceIframes();
window.addEventListener('resize', layoutDeviceIframes);

devicesContainer.onclick = event => {
  const deviceContainer = event.target.closest('.device-container');
  if (!deviceContainer) return;

  const index = [...devicesContainer.querySelectorAll('.device-container')].indexOf(deviceContainer);

  if (event.target.classList.contains('rotate-button')) {
    const orientation = deviceContainer.dataset.orientation === 'portrait' ? 'landscape' : 'portrait';
    deviceContainer.dataset.orientation = orientation;
    layoutDeviceIframes();
    deviceContainer.scrollIntoView({behavior: 'smooth'});
    devices[index].orientation = orientation;
    localStorage.setItem('sandbox_devices', JSON.stringify(devices));
  } else if (event.target.classList.contains('remove-button')) {
    event.target.closest('.device-container').remove();
    devices.splice(index, 1);
    localStorage.setItem('sandbox_devices', JSON.stringify(devices));
  }
}
