function addTouchToButton(button) {
  button.touches = button.touches || 0;
  button.touches++;
  button.dataset.touches = button.touches;
  if (button.touches === 1) {
    button.classList.add('pressed');
    button.dispatchEvent(new Event('pressed'));
  }
}
function removeTouchFromButton(button) {
  button.touches--;
  button.dataset.touches = button.touches;
  if (button.touches === 0) {
    button.classList.remove('pressed');
    button.dispatchEvent(new Event('unpressed'));
  }
}

const touchMap = new Map();
function handleTouchStartAndMove(event) {
  for (const touch of event.changedTouches) {
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element && element.classList.contains('push-button')) {
      const previousButton = touchMap.get(touch.identifier);
      if (previousButton !== element) {
        if (previousButton) {
          removeTouchFromButton(previousButton);
        }
        touchMap.set(touch.identifier, element);
        addTouchToButton(element);
      }
    }
  }
}
function handleTouchEndAndCancel(event) {
  for (const touch of event.changedTouches) {
    const button = touchMap.get(touch.identifier);
    if (button) {
      removeTouchFromButton(button);
    }
    touchMap.delete(touch.identifier);
  }
}
document.body.addEventListener('touchstart',  handleTouchStartAndMove);
document.body.addEventListener('touchmove',   handleTouchStartAndMove);
document.body.addEventListener('touchend',    handleTouchEndAndCancel);
document.body.addEventListener('touchcancel', handleTouchEndAndCancel);

document.body.addEventListener('mousedown', event => {
  if (event.target.classList.contains('push-button')) {
    addTouchToButton(event.target);
    window.addEventListener('mouseup', () => {
      removeTouchFromButton(event.target);
    }, {once: true});
  }
});

function handleKey(event) {
  const button = document.querySelector(`.push-button[data-key="${event.key}"]`);
  if (button) {
    event.preventDefault();
    if (event.type === 'keydown' && !button.isKeyDown) {
      button.isKeyDown = true; // To debounce repeated keydown events, from keys held down
      addTouchToButton(button);
    } else if (event.type === 'keyup') {
      button.isKeyDown = false;
      removeTouchFromButton(button);
    }
    return false;
  }
}
window.addEventListener('keydown', handleKey);
window.addEventListener('keyup',   handleKey);
