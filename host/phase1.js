async function phase1() {
  await showText('Phase 1', 999, 'green');
  const objects = ['red lamp', 'blue chair', 'orange bottle'];
  await countdown(30, 'You must find: ' + randomInArray(objects));
}
