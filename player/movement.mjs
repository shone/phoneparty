export default function handleMovement(channel) {
  const subjectPanel = document.getElementById('subject-panel');
  const container = document.createElement('div');
  container.classList.add('movement');
  container.classList.add('active');
  container.insertAdjacentHTML('beforeend', `
    <div class="arrow-buttons">
      <button data-button="up"    class="arrow-button push-button" data-key="ArrowUp">   </button>
      <button data-button="down"  class="arrow-button push-button" data-key="ArrowDown"> </button>
      <button data-button="left"  class="arrow-button push-button" data-key="ArrowLeft"> </button>
      <button data-button="right" class="arrow-button push-button" data-key="ArrowRight"></button>
    </div>
  `);
  subjectPanel.appendChild(container);

  const buttons = container.querySelector('.arrow-buttons');
  function updateContainerSize() {
    const size = Math.min(Math.min(window.innerWidth, window.innerHeight), Math.max(window.innerWidth, window.innerHeight) / 2) + 'px';
    buttons.style.width  = size;
    buttons.style.height = size;
  }
  updateContainerSize();
  window.addEventListener('resize', updateContainerSize);

  for (const button of buttons.getElementsByTagName('button')) {
    button.addEventListener('pressed',   () => channel.send(button.dataset.button + ' true'));
    button.addEventListener('unpressed', () => channel.send(button.dataset.button + ' false'));
  }

  channel.onclose = event => {
    container.classList.remove('active');
    window.removeEventListener('resize', updateContainerSize);
    setTimeout(() => {
      container.remove();
    }, 500);
  }
}
