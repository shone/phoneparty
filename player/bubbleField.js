function handleBubbleField(channel) {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="bubble-field-buttons">
      <div class="arrow-buttons">
        <button data-button="up"    class="arrow-button" data-key="ArrowUp">   </button>
        <button data-button="down"  class="arrow-button" data-key="ArrowDown"> </button>
        <button data-button="left"  class="arrow-button" data-key="ArrowLeft"> </button>
        <button data-button="right" class="arrow-button" data-key="ArrowRight"></button>
      </div>
      <button data-button="ping" data-key=" "></button>
    </div>
  `);
  const buttons = document.body.lastElementChild;
  
  for (const button of buttons.getElementsByTagName('button')) {
    button.ontouchstart = event => {
      event.preventDefault();
      if (!button.classList.contains('pressed')) {
        button.classList.add('pressed');
        channel.send(button.dataset.button + ' true');
        function handleTouchend(event) {
          if (![...event.touches].some(touch => touch.target === button)) {
            button.classList.remove('pressed');
            if (channel.readyState === 'open') {
              channel.send(button.dataset.button + ' false');
            }
            window.removeEventListener('touchend',    handleTouchend);
            window.removeEventListener('touchcancel', handleTouchend);
          }
        }
        window.addEventListener('touchend',    handleTouchend);
        window.addEventListener('touchcancel', handleTouchend);
      }
      return false;
    }
  }
  for (const button of buttons.getElementsByTagName('button')) {
    button.onmousedown = event => {
      button.classList.add('pressed');
      channel.send(button.dataset.button + ' true');
      window.addEventListener('mouseup', event => {
        button.classList.remove('pressed');
        if (channel.readyState === 'open') {
          channel.send(button.dataset.button + ' false');
        }
      }, {once: true});
    }
  }
  function handleKey(event) {
    const button = document.querySelector(`button[data-key="${event.key}"]`);
    if (button) {
      event.preventDefault();
      button.classList.toggle('pressed', event.type === 'keydown');
      channel.send(button.dataset.button + ((event.type === 'keydown') ? ' true' : ' false'));
      return false;
    }
  }
  window.addEventListener('keydown', handleKey);
  window.addEventListener('keyup',   handleKey);

  channel.onclose = event => {
    buttons.remove();
    window.removeEventListener('keydown', handleKey);
    window.removeEventListener('keyup',   handleKey);
  }
}
