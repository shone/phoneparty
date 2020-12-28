import {clamp} from '/common/utils.mjs';

const routes = {};
export default routes;

export async function startRouting(rtcConnection, routeChannel) {
  let currentRouteCounter = -1;

  let nextRoute = null;
  let nextRouteCounter = null;
  let waitOnNextRouteCallback = null;

  const routeEndListeners = [];

  let routeChannels = [];
  let routeChannelListeners = [];

  // Routes received from routeChannel tells us what the current route on the host is
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

  // Listen for channels that are bound to routes
  function onChannel({channel}) {
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
      // The channel is for a route that has already ended, so close it
      channel.close();
    }
  }
  rtcConnection.addEventListener('datachannel', onChannel);

  while (true) {
    if (routeChannel.readyState === 'closing' || routeChannel.readyState === 'closed') {
      currentRouteCounter = -1;
      history.replaceState('', '', '');
      return;
    }

    if (!nextRoute) {
      const result = await new Promise(resolve => waitOnNextRouteCallback = resolve);
      if (result === 'routing-ended') {
        currentRouteCounter = -1;
        history.replaceState('', '', '');
        return;
      }
    }

    routeChannelListeners = [];

    const route = nextRoute;
    const routeCounter = nextRouteCounter;
    // Use replaceState to avoid adding to history and affecting parent history when in sandbox
    history.replaceState('', '', route);

    currentRouteCounter = routeCounter;

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

    const routeContext = {
      route: route,
      params: new URLSearchParams(route.split('?')[1]),

      waitForEnd: async () => {
        switch (routeChannel.readyState) {
          case 'closing': case 'closed':
            return 'route-ended';
        }
        if (currentRouteCounter !== routeCounter) {
          return 'route-ended';
        }
        return new Promise(resolve => routeEndListeners.push(() => resolve('route-ended')));
      },

      listenForChannel: callback => {
        for (const channel of routeChannels) {
          const [channelRoute, channelCounterAndName] = channel.label.split('@');
          let [channelCounter, channelName] = channelCounterAndName.split('%');
          channelCounter = parseInt(channelCounter);
          if (channelRoute === route && channelCounter === routeCounter) {
            callback(channel, channelName);
          }
        }
        routeChannelListeners.push(callback);
      },

      animate: async (frameCallback, durationMs) => {
        switch (routeChannel.readyState) {
          case 'closing': case 'closed':
            return 'route-ended';
        }
        if (currentRouteCounter !== routeCounter) {
          return 'route-ended';
        }

        const startTimestamp = performance.now();
        let t = 0;
        let frameId = requestAnimationFrame(function callback(timestamp) {
          t = clamp((timestamp - startTimestamp) / durationMs, 0, 1);
          frameCallback(t);
          if (timestamp - startTimestamp < durationMs) {
            frameId = requestAnimationFrame(callback);
          }
        });

        return new Promise(resolve => {
          const timerId = setTimeout(() => {
            cancelAnimationFrame(frameId);
            if (t < 1) {
              frameCallback(1);
            }
            resolve('animation-finished');
          }, durationMs);

          routeEndListeners.push(() => {
            cancelAnimationFrame(frameId);
            clearTimeout(timerId);
            resolve('route-ended');
          });
        });
      }
    }

    // Call handler for this route
    const routeHandler = routes[route.split('?')[0]] || routeNotFoundScreen;
    await routeHandler(routeContext);
  }

  function endRouting() {
    rtcConnection.removeEventListener('datachannel', onChannel);
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

async function routeNotFoundScreen({route, waitForEnd}) {
  document.body.style.backgroundColor = '#fff';
  document.body.insertAdjacentHTML('beforeend', `
    <div id="route-not-found">
      <h1>404</h1>
      <p>No handler found for route: <b class="route"></b></p>
    </div>
  `);
  const div = document.body.lastElementChild;
  div.querySelector('.route').textContent = route;

  await waitForEnd();
  div.remove();
}
