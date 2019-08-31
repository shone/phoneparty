async function showVotingResult(text, seconds, backgroundColor) {

  const textDiv = document.createElement('div');
  const worstImg = document.createElement('div');
  const fakeImg = document.createElement('div');

  textDiv.classList.add('fullscreen-text');
  if (backgroundColor) {
    textDiv.style.backgroundColor = backgroundColor;
    textDiv.style.color = 'white';
  }

  worstImg.innerHTML = "<div style='font-size:24px' >Worst Image</div><img width='200px' id='worstimage'/>";
  fakeImg.innerHTML  =  "<div style='font-size:24px' >Worst Image Cam</div><canvas width='200px' id='worstplayer'/>";
  textDiv.appendChild(worstImg);
  textDiv.appendChild(fakeImg);

//  textDiv.textContent = text;
  document.body.appendChild(textDiv);
  var worstimage = document.getElementById("worstimage");
  var workplayercanvas = document.getElementById("worstplayer");

  //workimage.src =
  var worstplayerid     = imageResults.worstPlayerIds;
  var worstplayervideoin  = null;


  //players[imageResults.worstPlayerIds - 1].firstChild;




 for( var i = 0; i < players.length; ++i)
 {
   var children = players[i].children;

   for (var k = 0; k < children.length; k++) {
     if(children[k].tagName == "CANVAS")
     {
       children[k].style.display = "none";
       break;
     }
     // Do stuff
   }

 }

 var children = players[imageResults.worstPlayerIds - 1].children;

 for (var i = 0; i < children.length; i++) {
   if(children[i].tagName == "VIDEO")
   {
     worstplayervideoin = children[i];
     break;
   }
   // Do stuff
 }
   //console.log(element);
  //var fakeimageplayerid = players[imageResults.].id;
  var context = workplayercanvas.getContext("2d");
  context.drawImage(worstplayervideoin, 0, 0, 200, 200);

/*  worstplayervideoin.addEventListener('play', function () {
      var $this = this; //cache
      (function loop() {
          if (!$this.paused && !$this.ended) {
              workplayercanvas.getContext("2d").drawImage($this, 0, 0);
              setTimeout(loop, 1000 / 30); // drawing at 30fps
          }
      })();
  }, 0);
*/
  worstimage.src = playerImages[worstplayerid - 1].image;
  //fakeimage.src =  playerImages[fakeimageplayerid - 1].image;

  await Promise.race([waitForNSeconds(seconds), waitForKeypress(' ')]);
  textDiv.remove();
}

async function phase4() {

  await showVotingResult('Phase 4', 999, 'purple');

}
