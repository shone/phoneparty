import routes from './routes.mjs';

import '/common/splash-screen.mjs';

routes['#splash-screen'] = async function splashScreen({waitForEnd, listenForChannel}) {
  document.body.style.backgroundColor = 'black';

  const splashScreen = document.createElement('splash-screen');
  document.body.append(splashScreen);

  listenForChannel(channel => {
    channel.onmessage = () => {
      splashScreen.classList.add('finished');
    }
  });

  await waitForEnd();
  splashScreen.remove();
}
