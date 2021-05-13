import routes from '/player/routes.mjs';
import '/common/push-button.mjs';

const getDirection = deadZone => position => {
  if (position.y > deadZone && position.y > Math.abs(position.x))
    return "forward";
  else if (-position.y > deadZone && -position.y > Math.abs(position.x))
    return "backward";
  else if (position.x > deadZone && position.x > Math.abs(position.y))
    return "right";
  else if (-position.x > deadZone && -position.x > Math.abs(position.y))
    return "left";
  else return "static";
}

routes['#apps/remote-control'] = async function remoteControl({waitForEnd, listenForChannel}) {
  const container = document.createElement('div');
  container.attachShadow({mode: 'open'}).innerHTML = `
    <link rel="stylesheet" href="/common/base.css">
    <link rel="stylesheet" href="/apps/remote-control/player/main.css">
    <link rel="stylesheet" href="/common/push-button.css">
    <div id="puppet-choice">
      <push-button data-choice="puppet">Puppet</push-button>
      <push-button data-choice="master">Master</push-button>
    </div>
    <div id="puppet" class="hide">
      <div class="eye left" > <span class="pupil"></span> </div>
      <div class="eye right"> <span class="pupil"></span> </div>
      <h2></h2>
    </div>
    <div id="master" class="hide">
      <div class="panel">
        <p id="direction">static</p>
      </div>
      <div class="panel joystick-panel">
        <div id="indicators">
          <div id="forward"></div>
          <div id="right"></div>
          <div id="backward"></div>
          <div id="left"></div>
        </div>
        <pp-joystick></pp-joystick>
    </div>
  `;
  const shadowRoot = container.shadowRoot;

  document.body.append(container);

  container.shadowRoot.getElementById('puppet-choice').onclick = async event => {
    switch (event.target.dataset.choice) {
      case 'puppet':
        container.shadowRoot.getElementById('puppet').classList.remove('hide');
        const forwardSound = new Audio('/apps/remote-control/forward.mp3');
        const leftSound = new Audio('/apps/remote-control/left.mp3');
        const rightSound = new Audio('/apps/remote-control/right.mp3');
        const stopSound = new Audio('/apps/remote-control/stop.mp3');
        listenForChannel((channel, channelName) => {
          channel.send('puppet');
          channel.onmessage = ({data}) => {
            switch(data) {
            case 'forward': forwardSound.play(); break;
            case 'left': leftSound.play(); break;
            case 'right': rightSound.play(); break;
            case 'backward': stopSound.play(); break;
            }
          }
        });
        if (DeviceMotionEvent.requestPermission) {
          try {
            await DeviceMotionEvent.requestPermission()
          } catch(error) {}
        }
        window.addEventListener("devicemotion", event => {
          const transform = `translate(${(-event.rotationRate.alpha / 120) * 12}vw, ${(event.rotationRate.beta / 120) * 12}vw)`;
          container.shadowRoot.querySelector('#puppet .eye.left .pupil').style.transform = transform;
          container.shadowRoot.querySelector('#puppet .eye.right .pupil').style.transform = transform;
        });
        break;
      case 'master':
        container.shadowRoot.getElementById('master').classList.remove('hide');
        const joystick = shadowRoot.querySelector('pp-joystick');
        listenForChannel((channel, channelName) => {
          joystick.onthumbmove = position => {
            const d = getDirection(0.2)(position);
            shadowRoot.getElementById("direction").textContent = d;
            channel.send(d);
          }
        });
        break;
    }
    container.shadowRoot.getElementById('puppet-choice').remove();
  }

  await waitForEnd();
  container.remove();
}
