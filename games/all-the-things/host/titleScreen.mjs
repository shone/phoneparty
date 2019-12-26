import {waitForNSeconds, waitForKeypress} from '/shared/utils.mjs';

export default async function titleScreen() {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things title-screen">
      <div class="title-image-background"></div>
      <div class="title-image"></div>
      <h1>All The Things</h1>
      <h2>the object finding game</h2>
    </div>
  `);
  const titleScreen = document.body.lastElementChild;

  await waitForKeypress(' ');
  titleScreen.classList.add('finished');
  setTimeout(() => { titleScreen.remove() }, 2000);
  await Promise.race([waitForNSeconds(2), waitForKeypress(' ')]);
}
