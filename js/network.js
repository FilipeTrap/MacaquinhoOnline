(() => {
'use strict';
const R = window.Recinto;

R.makeNet = function makeNet(){
  const layers = [];
  for (let l = 0; l < R.SIZES.length - 1; l++){
    const nin = R.SIZES[l], nout = R.SIZES[l+1], lim = Math.sqrt(6/(nin+nout));
    const Wt = new Float32Array(nin*nout);
    for (let k = 0; k < Wt.length; k++) Wt[k] = (Math.random()*2-1)*lim;
    layers.push({nin, nout, W:Wt, b:new Float32Array(nout)});
  }
  return {layers};
};

R.copyNet = function copyNet(n){
  return {layers:n.layers.map(L => ({nin:L.nin,nout:L.nout,W:new Float32Array(L.W),b:new Float32Array(L.b)}))};
};

R.forward = function forward(net, x){
  const acts = [x]; let a = x; const last = net.layers.length - 1;
  net.layers.forEach((L, l) => {
    const z = new Float32Array(L.nout);
    for (let j = 0; j < L.nout; j++){
      let s = L.b[j]; const o = j*L.nin;
      for (let i = 0; i < L.nin; i++) s += L.W[o+i]*a[i];
      z[j] = l < last ? (s > 0 ? s : 0.01*s) : s;
    }
    acts.push(z); a = z;
  });
  return acts;
};

R.predict = function predict(net, x){ const a = R.forward(net, x); return a[a.length-1]; };

R.trainStep = function trainStep(net, x, act, target){
  const acts = R.forward(net, x), L = net.layers.length;
  const out = acts[L];
  let err = out[act] - target; err = Math.max(-1, Math.min(1, err));
  let delta = new Float32Array(out.length); delta[act] = err;
  for (let l = L-1; l >= 0; l--){
    const Ly = net.layers[l], ain = acts[l];
    const prev = l > 0 ? new Float32Array(Ly.nin) : null;
    for (let j = 0; j < Ly.nout; j++){
      const d = delta[j]; if (d === 0) continue; const o = j*Ly.nin;
      for (let i = 0; i < Ly.nin; i++){
        if (prev) prev[i] += Ly.W[o+i]*d;
        Ly.W[o+i] -= R.LR*d*ain[i];
      }
      Ly.b[j] -= R.LR*d;
    }
    if (prev){ for (let i = 0; i < prev.length; i++) prev[i] *= acts[l][i] > 0 ? 1 : 0.01; }
    delta = prev;
  }
};

R.argmax = q => { let b = 0; for (let i = 1; i < q.length; i++) if (q[i] > q[b]) b = i; return b; };
R.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
R.mean = arr => arr.reduce((s, v) => s + v, 0) / arr.length;

R.learnOne = function learnOne(m, e){
  let next = 0;
  if (!e.done){ const q2 = R.predict(m.target, e.s2); next = e.s2[4] > 0 ? q2[3] : Math.max(...q2); }
  const tgt = e.r + R.GAMMA*next;
  R.trainStep(m.net, e.s, e.a, tgt);
};

R.learn = function learn(m){
  if (m.buf.length < 50) return;
  for (let k = 0; k < R.BATCH; k++){
    const pool = (k % 2 === 0 && m.strong.length > 20) ? m.strong : m.buf;
    R.learnOne(m, pool[Math.floor(Math.random()*pool.length)]);
  }
  if (++m.steps % 250 === 0) m.target = R.copyNet(m.net);
};

R.pushWin = function pushWin(arr, v, max){ arr.push(v); if (arr.length > max) arr.shift(); };
})();
