import routes from '/routes.mjs';

import {sendLargeBlobOnChannel} from '/shared/utils.mjs';

document.head.insertAdjacentHTML('beforeend', `
  <link rel="stylesheet" href="/games/show-and-tell/player/show-and-tell.css">
`);

routes['#games/show-and-tell'] = async function showAndTell({waitForEnd, listenForChannel}) {
  document.body.style.backgroundColor = '#000';

  const panelA = document.createElement('div');
  panelA.classList.add('show-and-tell');
  panelA.innerHTML = `
    <push-button class="upload-button">Upload</push-button>
    <input type="file" accept="image/*">
  `;

  const fileInput = panelA.querySelector('input[type="file"]');
  const uploadButton = panelA.querySelector('.upload-button');
  uploadButton.onclick = () => fileInput.click();

  listenForChannel(channel => {
    fileInput.onchange = async event => {
      const files = event.target.files;
      if (files.length === 1) {
        sendLargeBlobOnChannel(channel, files[0]);
      }
    }
  });

  document.getElementById('panel-A').append(panelA);

  await waitForEnd();

  panelA.remove();
}
