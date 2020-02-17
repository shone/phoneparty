import {players, listenForAllPlayers, stopListeningForAllPlayers} from '/host/players.mjs';

const routes = {};
export default routes;

export let currentRoute = null;
export let currentRouteCounter = null;

async function notFoundRouteHandler() {
  document.body.style.backgroundColor = '#fff';
  document.body.insertAdjacentHTML('beforeend', `
    <div id="route-404">
      <h1>404</h1>
      <p>No handler found for route: <b>${currentRoute}</b></p>
    </div>
  `);
  const div = document.body.lastElementChild;

  await waitForRouteToEnd();
  div.remove();
}

export async function waitForRouteToEnd() {
  if (location.hash !== currentRoute) {
    return;
  } else {
    await new Promise(resolve => {
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
        resolve();
      }
    });
  }
}

export function listenForPlayersOnCurrentRoute(callback) {
  listenForAllPlayers(callback);
  waitForRouteToEnd().then(() => {
    stopListeningForAllPlayers(callback);
  });
}

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

    // Call route handler
    const routeHandler = routes[currentRoute] || notFoundRouteHandler;
    const routeHandlerNextRoute = await routeHandler();

    // Stop sending current route to all players
    stopListeningForAllPlayers(handlePlayer);
    for (const player of players) {
      player.routeChannel.onopen = null;
    }

    // If another route has been typed into the browser URL bar, use
    // that as the next route
    if (location.hash !== currentRoute) {
      currentRoute = location.hash;
    } else if (routeHandlerNextRoute) {
      currentRoute = routeHandlerNextRoute;
    } else {
      await new Promise(resolve => window.addEventListener('hashchange', resolve, {once: true}));
      currentRoute = location.hash;
    }

    currentRouteCounter++;
  }
}
