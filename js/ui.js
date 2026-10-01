(() => {
'use strict';
const R = window.Recinto;

R.lastTabsKey = '';

R.barHTML = function barHTML(label, val, color, main){
  return `<div class="bar${main ? ' main' : ''}"><div class="lab"><span>${label}</span><span>${Math.round(val)}</span></div><div class="tr"><div class="fi" style="width:${R.clamp(val,0,100)}%;background:${color}"></div></div></div>`;
};

R.updatePanel = function updatePanel(){
  const S = R.S, $ = R.$;
  const days = Math.floor(S.t/100) + 1;
  $('clock').textContent = `Dia ${days}, instante ${S.t}`;
  $('s-climbs').textContent = S.stats.climbs; $('s-inter').textContent = S.stats.inter;
  $('s-bananas').textContent = S.stats.bananas; $('s-showers').textContent = S.stats.showers;
  $('s-wet').textContent = `${S.monkeys.filter(m => m.showers > 0).length} de 3`;

  const tabsKey = S.monkeys.map(m => m.name).join('|') + S.sel;
  if (tabsKey !== R.lastTabsKey){
    R.lastTabsKey = tabsKey;
    $('tabs').innerHTML = S.monkeys.map(m => `<button class="tab" data-slot="${m.slot}" aria-pressed="${m.slot === S.sel}"><span class="dot" style="background:${R.COLLARS[m.slot]}"></span>${m.name}</button>`).join('');
    $('swap').textContent = `Trocar ${S.monkeys[S.sel].name}`;
  }
  const m = S.monkeys[S.sel], o = R.others(m);
  $('m-name').textContent = m.name;
  $('m-gen').textContent = m.gen === 0 ? `do grupo original, ${m.age} instantes no recinto` : `novato nº ${m.gen}, ${m.age} instantes no recinto`;
  $('m-doing').textContent = m.climb > 0 ? 'Subindo a escada' : `Última ação: ${R.actionLabel(m, m.act)}`;
  if (m.restFor > 0) $('m-doing').textContent = `Dormindo fundo (${m.restFor})`;
  else if (m.recoverFor > 0) $('m-doing').textContent = `Se recuperando (${m.recoverFor})`;
  else if (m.act === 1 && m.path && m.path.length) $('m-doing').textContent = 'Indo comer pepino';
  else if ((m.act === 6 || m.act === 7) && m.path && m.path.length){
    const t = R.others(m)[m.act - 6];
    if (t) $('m-doing').textContent = `Indo catar ${t.name}`;
  }
  else if ((m.act === 4 || m.act === 5) && m.path && m.path.length){
    const t = R.others(m)[m.act - 4];
    if (t && (t.climb > 0 || R.isOnBananaLadder(t))) $('m-doing').textContent = `Indo sacudir a escada (${t.name})`;
  }
  $('m-bars').innerHTML =
    R.barHTML('Felicidade', m.fel, R.C.banana, true) + R.barHTML('Vida', m.vida, R.C.moss, true) +
    R.barHTML('Energia', m.energia, R.C.water) + R.barHTML('Fome', m.fome, R.C.muted) +
    R.barHTML(`Raiva de ${o[0].name}`, R.anger(m, o[0]), R.C.bruise) + R.barHTML(`Raiva de ${o[1].name}`, R.anger(m, o[1]), R.C.bruise) +
    R.barHTML(`Medo de ${o[0].name}`, R.fear(m, o[0]), R.C.water) + R.barHTML(`Medo de ${o[1].name}`, R.fear(m, o[1]), R.C.water);
  $('m-hist').innerHTML =
    `<div><span>Levou água fria</span><b>${m.showers}×</b></div>` +
    `<div><span>Apanhou enquanto subia</span><b>${m.hitClimbing}×</b></div>` +
    `<div><span>Bateu em quem subia</span><b>${m.punisher}×</b></div>` +
    `<div><span>Pegou a banana</span><b>${m.bananas}×</b></div>`;
  const q = R.predict(m.net, R.getState(m)), mn = Math.min(...q), mx = Math.max(...q), top = R.argmax(q);
  $('m-q').innerHTML = [...q].map((v, i) => `<div class="q${i === top ? ' top' : ''}"><span>${R.actionLabel(m, i)}</span><div class="tr"><div class="fi" style="width:${mx > mn ? 6 + (v - mn)/(mx - mn)*94 : 50}%"></div></div></div>`).join('');

  if (S.logDirty){
    S.logDirty = false;
    $('log').innerHTML = S.log.slice(0, 40).map(l => `<li class="${l.kind}"><small>${l.t}</small>${l.text}</li>`).join('');
  }
  R.drawChart();
};

R.setRunning = function setRunning(v){
  R.S.running = v;
  R.$('play').textContent = v ? '❚❚ Pausar' : '▶ Rodar';
};

R.buildSpeeds = function buildSpeeds(){
  R.$('speeds').innerHTML = R.SPEEDS.map((s, i) => `<button data-i="${i}" aria-pressed="${i === R.S.speed}">${s.l}</button>`).join('');
};

R.train = function train(sign){
  const m = R.S.monkeys[R.S.sel], e = m.lastExp; if (!e) return;
  e.r = R.clamp(e.r + sign*1.2, -4, 4);
  for (let k = 0; k < 12; k++) R.learnOne(m, e);
  m.fel = R.clamp(m.fel + sign*3, 0, 100);
  R.addLog(`Você ${sign > 0 ? 'recompensou' : 'puniu'} ${m.name} por: ${R.actionLabel(m, e.a).toLowerCase()}.`, 'train');
  R.updatePanel();
};

R.bindControls = function bindControls(){
  const $ = R.$;
  $('play').onclick = () => R.setRunning(!R.S.running);
  $('step').onclick = () => { R.setRunning(false); R.tick(); R.updatePanel(); };
  $('speeds').onclick = e => { const b = e.target.closest('button'); if (!b) return; R.S.speed = +b.dataset.i; R.buildSpeeds(); };
  $('tabs').onclick = e => { const b = e.target.closest('.tab'); if (!b) return; R.S.sel = +b.dataset.slot; R.updatePanel(); };
  $('water').onchange = e => { R.S.water = e.target.checked; R.addLog(R.S.water ? 'Você ligou a água fria.' : 'Você desligou a água fria. Ninguém mais vai se molhar.', 'info'); };
  $('conf').oninput = e => { R.S.conf = e.target.value/100; $('conf-v').textContent = e.target.value + '%'; };
  $('cur').oninput = e => { R.S.cur = e.target.value/100; $('cur-v').textContent = e.target.value + '%'; };
  $('swap').onclick = () => { R.replace(R.S.sel); R.lastTabsKey = ''; R.updatePanel(); };
  $('reset').onclick = () => {
    const keep = {water:R.S.water, conf:R.S.conf, cur:R.S.cur, speed:R.S.speed};
    R.init(); Object.assign(R.S, keep); R.setRunning(false); R.lastTabsKey = ''; R.buildSpeeds(); R.updatePanel();
  };
  $('reward').onclick = () => R.train(1);
  $('punish').onclick = () => R.train(-1);
  R.scene.addEventListener('click', e => {
    const r = R.scene.getBoundingClientRect(), x = (e.clientX - r.left)/R.scale, y = (e.clientY - r.top)/R.scale;
    let best = null, bd = 60;
    R.S.monkeys.forEach(m => { const d = Math.hypot(m.px - x, m.py - 30 - y); if (d < bd){ bd = d; best = m; } });
    if (best){ R.S.sel = best.slot; R.updatePanel(); }
  });
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !['INPUT','BUTTON'].includes(document.activeElement.tagName)){ e.preventDefault(); R.setRunning(!R.S.running); }
  });
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener && mq.addEventListener('change', () => { R.readColors(); R.updatePanel(); });
  window.addEventListener('resize', R.resize);
};
})();
