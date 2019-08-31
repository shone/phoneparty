async function phase1(channels) {
  console.log("Phase 1 function called");
  const phaseElement = document.getElementById('phase1')
  phaseElement.querySelector('h1').textContent = 'Choosing object...';
  phaseElement.classList.remove('hide');
  const object = await new Promise(resolve => {
    channels.phaseOne.onmessage = event => resolve(event.data);
  });
  phaseElement.querySelector('h1').textContent = `You must find: ${object}!`;
}
