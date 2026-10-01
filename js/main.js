(() => {
'use strict';
const R = window.Recinto;

R.initCanvas();
R.init();
R.readColors();
R.buildSpeeds();
R.bindControls();
R.resize();
R.updatePanel();

let last = performance.now(), acc = 0, lastUI = 0;
function loop(now){
  const dt = Math.min(0.1, (now - last)/1000); last = now;
  if (R.S.running){
    acc += dt*R.SPEEDS[R.S.speed].tps; let n = 0;
    while (acc >= 1 && n < 400){ R.tick(); acc -= 1; n++; }
    if (n >= 400) acc = 0;
  }
  R.drawScene();
  if (now - lastUI > 120){ lastUI = now; R.updatePanel(); }
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
})();
