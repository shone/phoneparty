async function phase1() {
  const phase1Element = document.getElementById('phase1');
  phase1Element.querySelector('.remaining-time').textContent = '';
  phase1Element.classList.remove('hide');
  
  phase1Element.querySelector('h1').textContent = 'Choosing object...';
  await Promise.race([waitForNSeconds(3), waitForKeypress(' ')]);
  
  phase1Element.querySelector('h1').textContent = 'You must find:';
  const objects = [
    {name: 'lamp',   color: 'red',    colorCode: '#ff0000'},
    {name: 'bottle', color: 'blue',   colorCode: '#0000ff'},
    {name: 'jacket', color: 'orange', colorCode: '#ffa500'},
  ];
  const object = randomInArray(objects);
  phase1Element.querySelector('.item').textContent = `A ${object.color} ${object.name}`;
  for (const player of players) {
    player.phaseOne.send(JSON.stringify(object));
  }
  let secondsRemaining = 10;
  while (secondsRemaining > 0) {
    phase1Element.querySelector('.remaining-time').textContent = `The search begins in ${secondsRemaining} seconds...`;
    const result = await Promise.race([waitForNSeconds(1), waitForKeypress(' ')]);
    if (result && result.type === 'keypress') {
      break;
    }
    secondsRemaining--;
  }
  phase1Element.querySelector('.remaining-time').textContent = 'GO!!!!';
  await Promise.race([waitForNSeconds(3), waitForKeypress(' ')]);
  phase1Element.classList.add('hide');
}
