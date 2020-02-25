const routes = {};
export default routes;

let currentRoute = null;
let currentRouteCounter = -1;

const routeEndListeners = [];

let routeChannel = null;

let routeChannels = [];
let routeChannelListeners = [];

let waitingOnRouteHandler = false;
const waitForRouteHandlerCallbacks = [];

export async function startRouting(rtcConnection, routeChannel_) {
  routeChannel = routeChannel_;

  let nextRoute = null;
  let nextRouteCounter = null;
  let waitOnNextRouteCallback = null;

  routeChannel.onmessage = event => {
    [nextRoute, nextRouteCounter] = event.data.split('@');
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

  rtcConnection.addEventListener('datachannel', event => {
    if (!event.channel.label.startsWith('#')) {
      return;
    }

    let [route, counter] = event.channel.label.split('@');
    counter = parseInt(counter);

    if (counter >= currentRouteCounter) {
      routeChannels.push(event.channel);
      event.channel.addEventListener('close', () => {
        routeChannels = routeChannels.filter(channel => channel !== event.channel);
      });
      if (counter === currentRouteCounter) {
        for (const callback of routeChannelListeners) {
          callback(event.channel);
        }
      }
    } else {
      event.channel.close();
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
    const routeHandler = routes[currentRoute] || notFoundRouteHandler;
    await routeHandler();
  }

  function endRouting() {
    if (waitOnNextRouteCallback) {
      waitOnNextRouteCallback('routing-ended');
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
    return;
  }
  return new Promise(resolve => routeEndListeners.push(resolve));
}

export function listenForChannelOnCurrentRoute(callback) {
  for (const channel of routeChannels) {
    let [route, counter] = channel.label.split('@');
    counter = parseInt(counter);
    if (route === currentRoute && counter === currentRouteCounter) {
      callback(channel);
    }
  }
  routeChannelListeners.push(callback);
}

async function notFoundRouteHandler() {
  document.body.style.backgroundColor = '#fff';
  document.body.insertAdjacentHTML('beforeend', `
    <div id="route-not-found">
      <h1>404</h1>
      <p>No handler found for route: <b>${currentRoute}</b></p>
    </div>
  `);
  const div = document.body.lastElementChild;

  await waitForRouteToEnd();
  div.remove();
}
