async function phase1() {
//   await showText('Phase 1', 999, 'green');
  const phase1Element = document.getElementById('phase1');
  phase1Element.classList.remove('hide');
  const objects = ['red lamp', 'blue chair', 'orange bottle'];
  const object = randomInArray(objects);
  phase1Element.querySelector('.item').textContent = object;
  let secondsRemaining = 30;
  while (secondsRemaining > 0) {
    phase1Element.querySelector('.remaining-time').textContent = `${secondsRemaining} seconds remaining`;
    const result = await Promise.race([waitForNSeconds(1), waitForKeypress(' ')]);
    if (result && result.type === 'keypress') {
      break;
    }
    secondsRemaining--;
  }
  phase1Element.querySelector('.remaining-time').textContent = 'TIMES UP!';
  await Promise.race([waitForNSeconds(3), waitForKeypress(' ')]);
  phase1Element.classList.add('hide');
}
