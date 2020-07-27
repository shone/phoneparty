document.head.insertAdjacentHTML('beforeend', `
  <link rel="stylesheet" href="/common/push-button.css">
`);

class PushButton extends HTMLElement {
  constructor() {
    super();

    this.touches = 0;

    this.addEventListener('mousedown', event => {
      this.addTouch();
      window.addEventListener('mouseup', () => {
        this.removeTouch();
      }, {once: true});
    });
  }

  addTouch() {
    this.touches++;
    if (this.touches === 1) {
      this.classList.add('pressed');
      this.dispatchEvent(new Event('pressed'));
    }
  }

  removeTouch() {
    this.touches--;
    if (this.touches === 0) {
      this.classList.remove('pressed');
      this.dispatchEvent(new Event('unpressed'));
    }
  }
}

customElements.define('push-button', PushButton);

const touchMap = new Map();
function handleTouchStartAndMove(event) {
  for (const touch of event.changedTouches) {
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element && element.tagName === 'PUSH-BUTTON') {
      const previousButton = touchMap.get(touch.identifier);
      if (previousButton !== element) {
        if (previousButton) {
          previousButton.removeTouch();
        }
        touchMap.set(touch.identifier, element);
        element.addTouch();
      }
    }
  }
}
function handleTouchEndAndCancel(event) {
  for (const touch of event.changedTouches) {
    const button = touchMap.get(touch.identifier);
    if (button) {
      button.removeTouch();
    }
    touchMap.delete(touch.identifier);
  }
}
document.body.addEventListener('touchstart',  handleTouchStartAndMove);
document.body.addEventListener('touchmove',   handleTouchStartAndMove);
document.body.addEventListener('touchend',    handleTouchEndAndCancel);
document.body.addEventListener('touchcancel', handleTouchEndAndCancel);

function handleKey(event) {
  const button = document.querySelector(`push-button[data-key="${event.key}"]`);
  if (button) {
    event.preventDefault();
    if (event.type === 'keydown' && !button.isKeyDown) {
      button.isKeyDown = true; // To debounce repeated keydown events, from keys held down
      button.addTouch();
    } else if (event.type === 'keyup') {
      button.isKeyDown = false;
      button.removeTouch();
    }
    return false;
  }
}
window.addEventListener('keydown', handleKey);
window.addEventListener('keyup',   handleKey);
