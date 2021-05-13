import routes from '/host/routes.mjs';

routes['#apps/remote-control'] = async function bubbleland({waitForEnd, createChannel, listenForPlayers, listenForLeavingPlayers}) {
  const container = document.createElement('div');
  container.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/apps/remote-control/host/main.css">
    <video autoplay muted></video>
    <h1>Remote Control</h1>
  `;
  document.body.append(container);

  const joystickChannels = new Map();

  listenForPlayers(player => {
    const joystickChannel = createChannel(player, 'joystick');
    joystickChannel.onmessage = async ({data}) => {
      if (data === 'puppet') {
        const avatarStream = await player.getAvatarStream()
        container.shadowRoot.querySelector('video').srcObject = avatarStream;
      } else {
        // Relay joystick direction to all players
        for (const channel of joystickChannels.values()) {
          try {
            channel.send(data);
          } catch(error) {}
        }
      }
    }
    joystickChannels.set(player, joystickChannel);
  });

  listenForLeavingPlayers(player => {
    joystickChannels.delete(player);
  });

  await waitForEnd();

  container.remove();
}
