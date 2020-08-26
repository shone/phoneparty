import routes from '/player/routes.mjs';

import startMessaging from '/player/messaging.mjs';

routes['#apps/tunnel-vision'] = async function intro({listenForChannel}) {
  document.body.style.backgroundColor = '#98947f';

  listenForChannel((channel, channelName) => {
    if (channelName === 'messaging') {
      startMessaging(channel);
    }
  });
}
