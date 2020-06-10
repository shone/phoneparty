import {
  players,
  listenForAllPlayers, stopListeningForAllPlayers,
  acceptAllPlayers, stopAcceptingPlayers,
  listenForLeavingPlayers, stopListeningForLeavingPlayers,
} from '/host/players.mjs';

const routes = {};
export default routes;

export let currentRoute = null;
export let currentRouteCounter = null;

export async function startRouting({defaultRoute}) {

  currentRoute = location.hash || defaultRoute;
  currentRouteCounter = 0;

  while (true) {

    location.hash = currentRoute;

    // Send current route to all players
    function handlePlayer(player) {
      const message = currentRoute + '@' + currentRouteCounter;
      if (player.routeChannel.readyState === 'open') {
        player.routeChannel.send(message);
      } else {
        player.routeChannel.onopen = () => {
          player.routeChannel.send(message)
        }
      }
    }
    listenForAllPlayers(handlePlayer);

    let hasRouteEnded = false;
    const routeEndListeners = new Set();

    function onHashChange() {
      if (location.hash !== currentRoute) {
        hasRouteEnded = true;
        routeEndListeners.forEach(callback => callback());
        routeEndListeners.clear();
        window.removeEventListener('hashchange', onHashChange);
      }
    }
    window.addEventListener('hashchange', onHashChange);

    const routeContext = {
      params: new URLSearchParams(currentRoute.split('?')[1]),

      waitForEnd: async () => {
        // Wait for the browser to be navigated to a different URL hash, or for the
        // the current route to be skipped by pressing spacebar.
        if (hasRouteEnded) return 'route-ended';
        return new Promise(resolve => routeEndListeners.add(() => resolve('route-ended')));
      },

      acceptAllPlayers: callback => {
        if (hasRouteEnded) throw 'Route has ended';
        acceptAllPlayers(callback);
        routeEndListeners.add(() => stopAcceptingPlayers());
      },

      listenForPlayers: callback => {
        if (hasRouteEnded) throw 'Route has ended';
        listenForAllPlayers(callback);
        routeEndListeners.add(() => stopListeningForAllPlayers(callback));
      },

      listenForLeavingPlayers: callback => {
        if (hasRouteEnded) throw 'Route has ended';
        listenForLeavingPlayers(callback);
        routeEndListeners.add(() => stopListeningForLeavingPlayers(callback));
      },
    };

    // Call route handler
    const routeHandler = routes[currentRoute.split('?')[0]] || routeNotFoundScreen;
    const nextRouteFromHandler = await routeHandler(routeContext);

    window.removeEventListener('hashchange', onHashChange);

    hasRouteEnded = true;
    routeEndListeners.forEach(callback => callback());
    routeEndListeners.clear();

    // Stop sending current route to all players
    stopListeningForAllPlayers(handlePlayer);
    players.forEach(player => player.routeChannel.onopen = null);

    // Set the new current route
    if (location.hash !== currentRoute) {
      // If another route (hash) has been typed into the browser URL bar, use
      // that as the next route
      currentRoute = location.hash;
    } else if (nextRouteFromHandler) {
      // If the route handler has returned a new route (hash), go to that
      currentRoute = nextRouteFromHandler;
    } else {
      // Otherwise, wait for the browser to be navigated to a new hash (route)
      await new Promise(resolve => window.addEventListener('hashchange', resolve, {once: true}));
      currentRoute = location.hash;
    }

    currentRouteCounter++;
  }
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
