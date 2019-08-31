function randomInArray(array) {
  return array[Math.floor(Math.random() * array.length)];
}

async function waitForDataChannelOpen(dataChannel) {
  return new Promise((resolve, reject) => {
    dataChannel.addEventListener('open', resolve, {once: true});
    dataChannel.addEventListener('error', reject, {once: true});
    dataChannel.addEventListener('close', reject, {once: true});
  });
}
