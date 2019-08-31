async function phase1(channels) {
  console.log("Phase 1 function called");
  const phaseElement = document.getElementById('phase1')
  phaseElement.querySelector('h1').textContent = 'Choosing object...';
  phaseElement.classList.remove('hide');
  let object = await new Promise(resolve => {
    channels.phaseOne.onmessage = event => resolve(event.data);
  });
  object = JSON.parse(object);
  phaseElement.querySelector('h1').textContent = `You must find: a ${object.color} ${object.name}!`;
  
  // Wait for phase to change
  await new Promise(resolve => {
    channels.currentPhaseChannel.addEventListener('message', function callback(event) {
      if (event.data !== 1) {
        resolve();
        channels.currentPhaseChannel.removeEventListener('message', callback);
      }
    });
  });
  phaseElement.classList.add('hide');
}
