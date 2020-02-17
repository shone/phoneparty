const routes = {};
export default routes;

let currentRoute = null;
let currentRouteCounter = -1;

const routeChangeListeners = [];

let routeChannels = [];
let routeChannelListeners = [];

let waitingOnRouteHandler = false;
const waitForRouteHandlerCallbacks = [];

export function startRouting(rtcConnection, routeChannel) {
  routeChannel.onmessage = async event => {
    while (routeChangeListeners.length > 0) routeChangeListeners.pop()();

    if (waitingOnRouteHandler) {
      await new Promise(resolve => waitForRouteHandlerCallbacks.push(resolve));
    }

    routeChannelListeners = [];

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

    [currentRoute, currentRouteCounter] = event.data.split('@');
    currentRouteCounter = parseInt(currentRouteCounter);
    location.hash = currentRoute;

    // Call handler for this route
    const func = routes[currentRoute];
    if (func) {
      waitingOnRouteHandler = true;
      await func();
      waitingOnRouteHandler = false;
      while (waitForRouteHandlerCallbacks.length > 0) waitForRouteHandlerCallbacks.pop()();
    }
  }

  rtcConnection.addEventListener('datachannel', event => {
    if (!event.channel.label.startsWith('#')) {
      return;
    }
    let [route, counter] = event.channel.label.split('@');
    counter = parseInt(counter);
    if (counter < currentRouteCounter) {
      event.channel.close();
      return;
    } else {
      routeChannels.push(event.channel);
      event.channel.addEventListener('close', () => {
        routeChannels = routeChannels.filter(channel => channel !== event.channel);
      });
      if (counter === currentRouteCounter) {
        for (const callback of routeChannelListeners) {
          callback(event.channel);
        }
      }
    }
  });
}

export function waitForRouteToEnd() {
  return new Promise(resolve => routeChangeListeners.push(resolve));
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
