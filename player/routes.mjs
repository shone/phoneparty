const routes = {};
export default routes;

export let currentRoute = null;
let currentRouteCounter = -1;

const routeEndListeners = [];

let routeChannel = null;

let routeChannels = [];
let routeChannelListeners = [];

export async function startRouting(rtcConnection, routeChannel_) {
  routeChannel = routeChannel_;

  let nextRoute = null;
  let nextRouteCounter = null;
  let waitOnNextRouteCallback = null;

  routeChannel.onmessage = ({data}) => {
    [nextRoute, nextRouteCounter] = data.split('@');
    nextRouteCounter = parseInt(nextRouteCounter);
    while (routeEndListeners.length > 0) {
      const callback = routeEndListeners.pop();
      callback();
    }
    routeChannelListeners = [];
    if (waitOnNextRouteCallback) {
      waitOnNextRouteCallback();
      waitOnNextRouteCallback = null;
    }
  }
  routeChannel.onclose = endRouting;

  rtcConnection.addEventListener('datachannel', ({channel}) => {
    if (!channel.label.startsWith('#')) {
      return;
    }

    let [route, counter] = channel.label.split('@');
    counter = parseInt(counter);

    if (counter >= currentRouteCounter) {
      routeChannels.push(channel);
      channel.addEventListener('close', () => {
        routeChannels = routeChannels.filter(channel => channel !== channel);
      });
      if (counter === currentRouteCounter) {
        for (const callback of routeChannelListeners) {
          const name = channel.label.split('%')[1];
          callback(channel, name);
        }
      }
    } else {
      channel.close();
    }
  });

  while (true) {
    if (routeChannel.readyState === 'closing' || routeChannel.readyState === 'closed') {
      return;
    }

    if (!nextRoute) {
      const result = await new Promise(resolve => waitOnNextRouteCallback = resolve);
      if (result === 'routing-ended') {
        currentRoute = null;
        currentRouteCounter = -1;
        location.hash = '';
        return;
      }
    }

    routeChannelListeners = [];

    currentRoute = nextRoute;
    currentRouteCounter = nextRouteCounter;
    location.hash = currentRoute;
    const params = new URLSearchParams(currentRoute.split('?')[1]);

    nextRoute = null;
    nextRouteCounter = null;

    // Close channels from previous routes
    routeChannels = routeChannels.filter(channel => {
      let [route, counter] = channel.label.split('@');
      counter = parseInt(counter);
      if (counter < currentRouteCounter) {
        channel.close();
        return false;
      } else {
        return true;
      }
    });

    // Call handler for this route
    const routeHandler = routes[currentRoute.split('?')[0]] || routeNotFoundScreen;
    await routeHandler({params});
  }

  function endRouting() {
    if (waitOnNextRouteCallback) {
      waitOnNextRouteCallback('routing-ended');
      waitOnNextRouteCallback = null;
    }
    while (routeEndListeners.length > 0) {
      const callback = routeEndListeners.pop();
      callback();
    }
    while (routeChannels.length > 0) {
      const channel = routeChannels.pop();
      channel.close();
    }
  }
}

export function waitForRouteToEnd() {
  if (!routeChannel || (routeChannel.readyState === 'closing' || routeChannel.readyState === 'closed')) {
    return 'route-ended';
  }
  return new Promise(resolve => routeEndListeners.push(() => resolve('route-ended')));
}

export function listenForChannelOnCurrentRoute(callback) {
  for (const channel of routeChannels) {
    const [route, counterAndName] = channel.label.split('@');
    let [counter, name] = counterAndName.split('%');
    counter = parseInt(counter);
    if (route === currentRoute && counter === currentRouteCounter) {
      callback(channel, name);
    }
  }
  routeChannelListeners.push(callback);
}

async function routeNotFoundScreen() {
  document.body.style.backgroundColor = '#fff';
  document.body.insertAdjacentHTML('beforeend', `
    <div id="route-not-found">
      <h1>404</h1>
      <p>No handler found for route: <b class="route"></b></p>
    </div>
  `);
  const div = document.body.lastElementChild;
  div.querySelector('.route').textContent = currentRoute;

  await waitForRouteToEnd();
  div.remove();
}
