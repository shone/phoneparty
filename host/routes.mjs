import {
  players,
  listenForAllPlayers, stopListeningForAllPlayers,
  acceptAllPlayers, stopAcceptingPlayers,
  listenForLeavingPlayer, stopListeningForLeavingPlayer,
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
    const params = new URLSearchParams(currentRoute.split('?')[1]);

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

    // Call route handler
    const routeHandler = routes[currentRoute.split('?')[0]] || routeNotFoundScreen;
    const nextRouteFromHandler = await routeHandler({params});

    // Stop sending current route to all players
    stopListeningForAllPlayers(handlePlayer);
    for (const player of players) {
      player.routeChannel.onopen = null;
    }

    // If another route has been typed into the browser URL bar, use
    // that as the next route
    if (location.hash !== currentRoute) {
      currentRoute = location.hash;
    } else if (nextRouteFromHandler) {
      currentRoute = nextRouteFromHandler;
    } else {
      await new Promise(resolve => window.addEventListener('hashchange', resolve, {once: true}));
      currentRoute = location.hash;
    }

    currentRouteCounter++;
  }
}

export async function waitForRouteToEnd() {
  // Wait for the browser to be navigated to a different URL hash, or for the
  // the current route to be skipped by pressing spacebar.
  if (location.hash !== currentRoute) {
    return 'route-ended';
  } else {
    return new Promise(resolve => {
      function onHashchange() {
        if (location.hash !== currentRoute) finish();
      }
      function onKeypress(event) {
        if (event.key === ' ') finish();
      }
      window.addEventListener('hashchange', onHashchange);
      window.addEventListener('keypress', onKeypress);
      function finish() {
        window.removeEventListener('hashchange', onHashchange);
        window.removeEventListener('keypress', onKeypress);
        resolve('route-ended');
      }
    });
  }
}

export function acceptAllPlayersOnCurrentRoute(callback) {
  acceptAllPlayers(callback);
  waitForRouteToEnd().then(() => {
    stopAcceptingPlayers();
  });
}

export function listenForPlayersOnCurrentRoute(callback) {
  listenForAllPlayers(callback);
  waitForRouteToEnd().then(() => {
    stopListeningForAllPlayers(callback);
  });
}

export function listenForLeavingPlayersOnCurrentRoute(callback) {
  listenForLeavingPlayer(callback);
  waitForRouteToEnd().then(() => {
    stopListeningForLeavingPlayer(callback);
  });
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
