(() => {
'use strict';
const R = window.Recinto;

R.$ = id => document.getElementById(id);
R.scene = null;
R.ctx = null;
R.chart = null;
R.cctx = null;
R.C = {};
R.scale = 1;
R.dpr = 1;

R.readColors = function readColors(){
  const cs = getComputedStyle(document.documentElement);
  ['paper','panel','ink','muted','moss','banana','water','bruise','wall','floor','line','track'].forEach(k => R.C[k] = cs.getPropertyValue('--'+k).trim());
};

R.resize = function resize(){
  R.dpr = window.devicePixelRatio || 1;
  const w = R.scene.clientWidth; R.scale = w / R.W;
  R.scene.width = Math.round(w*R.dpr); R.scene.height = Math.round(w*R.H/R.W*R.dpr);
  R.chart.width = Math.round(R.chart.clientWidth*R.dpr); R.chart.height = Math.round(R.chart.clientHeight*R.dpr);
  R.drawChart();
};

R.drawLadder = function drawLadder(x, yBottom, yTop){
  const ctx = R.ctx, C = R.C;
  ctx.strokeStyle = C.ink; ctx.globalAlpha = .75; ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x - 24, yBottom); ctx.lineTo(x - 16, yTop - 8);
  ctx.moveTo(x + 24, yBottom); ctx.lineTo(x + 16, yTop - 8);
  ctx.stroke();
  ctx.lineWidth = 3;
  for (let y = yBottom - 26; y > yTop; y -= 28){
    const k = (yBottom - y)/(yBottom - yTop)*8;
    ctx.beginPath(); ctx.moveTo(x - 24 + k, y); ctx.lineTo(x + 24 - k, y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
};

R.drawMonkey = function drawMonkey(m, sel){
  const ctx = R.ctx, C = R.C;
  const x = m.px, y = m.py, face = '#EBCB9F';
  ctx.save(); ctx.translate(x, y);
  if (sel){ ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.setLineDash([5,4]); ctx.beginPath(); ctx.ellipse(0, 2, 30, 8, 0, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]); }
  ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(0, 2, 22, 5, 0, 0, Math.PI*2); ctx.fill();
  const fur = m.flash > 0 ? C.bruise : m.fur;
  ctx.strokeStyle = fur; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-12, -14); ctx.bezierCurveTo(-34, -10, -40, -36, -26, -46); ctx.stroke();
  ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(0, -22, 16, 20, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = face; ctx.beginPath(); ctx.ellipse(3, -18, 9, 12, 0, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = R.COLLARS[m.slot]; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(2, -46, 12, 0.25*Math.PI, 0.75*Math.PI); ctx.stroke();
  ctx.fillStyle = fur; ctx.beginPath(); ctx.arc(4, -50, 13, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(-9, -52, 5, 0, Math.PI*2); ctx.arc(17, -52, 5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = face; ctx.beginPath(); ctx.ellipse(6, -47, 9, 8, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#1D2A1B'; ctx.strokeStyle = '#1D2A1B'; ctx.lineWidth = 1.6;
  const maxFear = Math.max(0, ...Object.values(m.medo));
  const scared = maxFear > 55 && !m.sleeping;
  if (m.sleeping){ ctx.beginPath(); ctx.moveTo(0,-49); ctx.lineTo(5,-49); ctx.moveTo(8,-49); ctx.lineTo(13,-49); ctx.stroke(); }
  else if (scared){
    ctx.beginPath(); ctx.arc(2.5, -49, 2.6, 0, Math.PI*2); ctx.arc(10, -49, 2.6, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = C.water; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-1,-56); ctx.lineTo(5,-54); ctx.moveTo(13,-56); ctx.lineTo(8,-54); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(2.5, -49, 1.9, 0, Math.PI*2); ctx.arc(10, -49, 1.9, 0, Math.PI*2); ctx.fill();
  }
  const maxAnger = Math.max(0, ...Object.values(m.raiva));
  if (maxAnger > 55 && !m.sleeping && !scared){ ctx.strokeStyle = C.bruise; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-1,-55); ctx.lineTo(5,-53); ctx.moveTo(13,-55); ctx.lineTo(8,-53); ctx.stroke(); }
  ctx.strokeStyle = '#1D2A1B'; ctx.lineWidth = 1.4; ctx.beginPath();
  const mood = (m.fel - 50)/50*3; ctx.moveTo(2, -43); ctx.quadraticCurveTo(6, -43 + mood, 10, -43); ctx.stroke();
  const icon = ['','🍽️','💤','🧗','👊','👊','🤲','🤲'][m.act];
  if (icon){ ctx.font = '16px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(icon, 4, -70); }
  ctx.font = '600 13px "Bricolage Grotesque", system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = R.COLLARS[m.slot]; ctx.fillText(m.name, 2, 20);
  ctx.restore();
};

R.sameLevel = function sameLevel(a, c){
  const la = R.levelOf(a), lc = R.levelOf(c);
  if (la === 'banana' || lc === 'banana' || la === 'empty' || lc === 'empty') return false;
  if (la === 'bananaTop' || lc === 'bananaTop') return la === lc;
  return la === lc;
};

R.drawScene = function drawScene(){
  const ctx = R.ctx, C = R.C, S = R.S;
  const {W, H, FLOOR, LADDER_X, TOP_Y, LOFT_Y, LOFT_X0, LOFT_X1, EMPTY_LADDER_X} = R;
  ctx.setTransform(R.scale*R.dpr, 0, 0, R.scale*R.dpr, 0, 0);
  ctx.fillStyle = C.wall; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.floor; ctx.fillRect(0, FLOOR, W, H - FLOOR);

  // loft platform
  ctx.fillStyle = C.floor; ctx.fillRect(LOFT_X0, LOFT_Y, LOFT_X1 - LOFT_X0, 10);
  ctx.fillStyle = C.ink; ctx.globalAlpha = .35;
  ctx.fillRect(LOFT_X0, LOFT_Y, LOFT_X1 - LOFT_X0, 3);
  ctx.globalAlpha = 1;
  // loft posts
  ctx.strokeStyle = C.ink; ctx.globalAlpha = .4; ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(LOFT_X0 + 8, LOFT_Y + 10); ctx.lineTo(LOFT_X0 + 8, FLOOR);
  ctx.moveTo(LOFT_X1 - 8, LOFT_Y + 10); ctx.lineTo(LOFT_X1 - 8, FLOOR);
  ctx.stroke(); ctx.globalAlpha = 1;

  R.drawLadder(EMPTY_LADDER_X, FLOOR, LOFT_Y);
  R.drawLadder(LADDER_X, FLOOR, TOP_Y);

  const wetOn = S.fx.some(f => f.type === 'water');
  ctx.fillStyle = C.muted; ctx.fillRect(30, 22, W - 60, 7);
  for (let x = 70; x < W - 40; x += 88){ ctx.fillStyle = wetOn ? C.water : C.muted; ctx.fillRect(x - 5, 29, 10, 9); }
  ctx.fillStyle = C.muted; ctx.fillRect(48, FLOOR - 24, 150, 24);
  ctx.fillStyle = C.moss; for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.arc(58 + i*10, FLOOR - 25, 4, 0, Math.PI*2); ctx.fill(); }
  ctx.strokeStyle = C.banana; ctx.globalAlpha = .55; ctx.lineWidth = 2;
  for (let i = 0; i < 28; i++){ ctx.beginPath(); ctx.moveTo(240 + i*7, FLOOR - 2); ctx.lineTo(236 + i*7 + (i%3)*6, FLOOR - 16 - (i%4)*3); ctx.stroke(); }
  ctx.globalAlpha = 1;

  ctx.fillStyle = C.ink; ctx.fillRect(LADDER_X - 46, TOP_Y - 14, 92, 6);
  if (S.banana){
    ctx.save(); ctx.translate(LADDER_X, TOP_Y - 30);
    ctx.fillStyle = C.banana; ctx.strokeStyle = '#7A5A10'; ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++){ ctx.save(); ctx.rotate(i*0.35); ctx.beginPath(); ctx.moveTo(-3, -12); ctx.quadraticCurveTo(16, -2, 4, 14); ctx.quadraticCurveTo(10, -1, -3, -12); ctx.fill(); ctx.stroke(); ctx.restore(); }
    ctx.restore();
  }
  S.monkeys.forEach(m => { if (m.flash > 0) m.flash--; });
  // Separação bem suave: dá pra passar por 1 ou 2 sem formar parede
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++){
    const a = S.monkeys[i], c = S.monkeys[j];
    if (!R.sameLevel(a, c)) continue;
    if (a.restFor > 0 || a.recoverFor > 0 || c.restFor > 0 || c.recoverFor > 0) continue;
    const d = c.px - a.px, gap = 26;
    if (Math.abs(d) < gap && Math.abs(d) > 0.1){
      const push = (gap - Math.abs(d)) * 0.12 * (d >= 0 ? 1 : -1);
      a.px -= push; c.px += push;
    }
  }
  [...S.monkeys].sort((a, b) => (a.slot === S.sel) - (b.slot === S.sel)).forEach(m => R.drawMonkey(m, m.slot === S.sel));
  S.fx.forEach(f => {
    if (f.type === 'water'){
      ctx.strokeStyle = C.water; ctx.lineWidth = 2; ctx.globalAlpha = Math.min(1, f.life/20);
      f.slots.forEach(sl => { const m = S.monkeys[sl]; if (!m) return;
        for (let i = 0; i < 9; i++){ const x = m.px - 26 + Math.random()*52, y = 40 + Math.random()*Math.max(20, m.py - 90); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 12); ctx.stroke(); } });
      ctx.globalAlpha = 1;
    } else if (f.type === 'hit'){
      const m = S.monkeys[f.slot]; if (!m) return;
      ctx.strokeStyle = C.bruise; ctx.lineWidth = 3; ctx.globalAlpha = f.life/18;
      const r = 12 + (18 - f.life);
      for (let i = 0; i < 8; i++){ const a = i*Math.PI/4; ctx.beginPath(); ctx.moveTo(m.px + Math.cos(a)*r*.5, m.py - 50 + Math.sin(a)*r*.5); ctx.lineTo(m.px + Math.cos(a)*r, m.py - 50 + Math.sin(a)*r); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    f.life--;
  });
  S.fx = S.fx.filter(f => f.life > 0);
};

R.drawChart = function drawChart(){
  const chart = R.chart, cctx = R.cctx, C = R.C, dpr = R.dpr;
  const w = chart.width, h = chart.height; cctx.setTransform(1,0,0,1,0,0); cctx.clearRect(0, 0, w, h);
  cctx.strokeStyle = C.line; cctx.lineWidth = dpr; cctx.beginPath(); cctx.moveTo(0, h - 1); cctx.lineTo(w, h - 1); cctx.stroke();
  const d = R.S.series; if (!d.length){ cctx.fillStyle = C.muted; cctx.font = (13*dpr) + 'px "Bricolage Grotesque", system-ui, sans-serif'; cctx.fillText('O gráfico começa depois do primeiro dia (100 instantes).', 6*dpr, h/2); return; }
  const n = 80, bw = w/n, maxC = Math.max(5, ...d.map(p => p.c));
  d.forEach((p, i) => { const bh = (p.c/maxC)*(h - 10*dpr); cctx.fillStyle = C.banana; cctx.globalAlpha = .75; cctx.fillRect(i*bw + 1, h - bh, bw - 2, bh); });
  cctx.globalAlpha = 1; cctx.strokeStyle = C.bruise; cctx.lineWidth = 2.2*dpr; cctx.beginPath();
  let started = false;
  d.forEach((p, i) => { if (!p.c) return; const y = h - (p.i/p.c)*(h - 10*dpr) - 2; const x = i*bw + bw/2; started ? cctx.lineTo(x, y) : (cctx.moveTo(x, y), started = true); });
  cctx.stroke();
};

R.initCanvas = function initCanvas(){
  R.scene = R.$('scene');
  R.ctx = R.scene.getContext('2d');
  R.chart = R.$('chart');
  R.cctx = R.chart.getContext('2d');
};
})();
