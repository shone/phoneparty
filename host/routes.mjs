import {players, listenForAllPlayers, stopListeningForAllPlayers} from '/host/players.mjs';

const routes = {};
export default routes;

export let currentRoute = null;
export let currentRouteCounter = null;

export async function waitForRouteChange() {
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
  waitForRouteChange().then(() => {
    stopListeningForAllPlayers(callback);
  });
}

export async function startRouting({defaultRoute}) {
  currentRouteCounter = 0;

  if (!location.hash) {
    location.hash = defaultRoute;
  }
  currentRoute = location.hash;

  while (true) {

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
    const func = routes[currentRoute];
    if (func) {
      const nextRoute = await func();
      if (nextRoute !== null && location.hash === currentRoute) {
        location.hash = nextRoute;
      }
    }

    stopListeningForAllPlayers(handlePlayer);
    for (const player of players) {
      player.routeChannel.onopen = null;
    }

    if (location.hash === currentRoute) {
      await new Promise(resolve => {
        window.addEventListener('hashchange', resolve, {once: true});
      });
    }
    currentRoute = location.hash;

    currentRouteCounter++;
  }
}
