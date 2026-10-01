(() => {
'use strict';
const R = window.Recinto;

R.S = null;

R.others = m => R.S.monkeys.filter(o => o !== m);

R.addLog = function addLog(text, kind){
  R.S.log.unshift({t:R.S.t, text, kind});
  if (R.S.log.length > 60) R.S.log.pop();
  R.S.logDirty = true;
};

R.addFx = function addFx(f){
  R.S.fx.push(f);
  if (R.S.fx.length > 24) R.S.fx.shift();
};

R.newMonkey = function newMonkey(slot, gen){
  const net = R.makeNet();
  const x = 480 + slot*70;
  return {slot, gen, name:R.NAMES[R.S.nameIdx++ % R.NAMES.length], fur:R.FURS[Math.floor(Math.random()*R.FURS.length)],
    net, target:R.copyNet(net), buf:[], strong:[], steps:0, age:0,
    fome:25+Math.random()*20, energia:70+Math.random()*20, vida:100, fel:55,
    climb:0, fell:false, sleeping:false, act:0, lastExp:null, raiva:{}, medo:{}, path:[], goal:null, counts:new Map(),
    restFor:0, recoverFor:0,
    obsClimb:[], obsFree:[], showers:0, hitClimbing:0, punisher:0, bananas:0,
    px:x, py:R.FLOOR, tx:x, ty:R.FLOOR, flash:0, dead:false};
};

R.init = function init(){
  R.S = {t:0, running:false, speed:0, water:true, conf:0.4, cur:0.5, banana:true, bananaTimer:0,
       monkeys:[], sel:0, nameIdx:0, gen:1,
       stats:{climbs:0, inter:0, bananas:0, showers:0}, win:{climbs:0, inter:0}, series:[], log:[], fx:[], logDirty:true};
  for (let i = 0; i < 3; i++) R.S.monkeys.push(R.newMonkey(i, 0));
  R.addLog('Três macacos entram no recinto. Nenhum deles sabe nada ainda.', 'info');
};

R.replace = function replace(slot, fromDeath){
  const old = R.S.monkeys[slot];
  const nm = R.newMonkey(slot, R.S.gen++);
  nm.px = 30; nm.tx = 480 + slot*70;
  R.S.monkeys[slot] = nm;
  R.S.monkeys.forEach(o => {
    if (o !== nm){ o.raiva[slot] = 0; o.medo[slot] = 0; }
  });
  if (!fromDeath) R.addLog(`${old.name} saiu do recinto. Entrou ${nm.name}, que nunca levou água fria.`, 'info');
  else R.addLog(`Entrou ${nm.name} no lugar de ${old.name}.`, 'info');
};

R.tick = function tick(){
  const ms = R.S.monkeys;
  const climbers = ms.filter(m => m.climb > 0);
  const states = ms.map(R.getState);
  const keys = ms.map(R.coarseKey);
  const acts = ms.map((m, i) => R.choose(m, states[i]));
  const f0 = ms.map(m => m.fel), v0 = ms.map(m => m.vida);
  ms.forEach(m => { m.fell = false; m.sleeping = false; });

  ms.forEach((m, i) => {
    if (m.restFor > 0 || m.recoverFor > 0) return;
    const a = acts[i];
    if (a === 4 || a === 5){
      const t = R.others(m)[a - 4];
      if (t && t !== m) R.hit(m, t);
    }
  });

  ms.forEach((m, i) => {
    // Energia acabou → 10 tempos dormindo parado
    if (m.restFor <= 0 && m.energia < 5){
      m.restFor = R.REST_TICKS;
      R.clearPath(m);
      R.addLog(`${m.name} desabou de cansaço e vai dormir um tempo.`, 'info');
    }
    // Vida baixa → 10 tempos parado se recuperando
    if (m.recoverFor <= 0 && m.restFor <= 0 && m.vida < 10){
      m.recoverFor = R.RECOVER_TICKS;
      R.clearPath(m);
      R.addLog(`${m.name} está ferido e para para se recuperar.`, 'info');
    }

    if (m.restFor > 0){
      m.act = 2;
      R.sleep(m);
      m.restFor--;
      return;
    }
    if (m.recoverFor > 0){
      m.act = 0;
      R.recover(m);
      m.recoverFor--;
      return;
    }

    const a = acts[i]; m.act = a;
    if (a !== 3 && m.climb > 0) m.climb = 0;
    switch (a){
      case 0: {
        m.energia += 1.2;
        if (!m.path || !m.path.length){
          const spot = R.awaySpot(m);
          R.goTo(m, spot.x, spot.y);
        }
        break;
      }
      case 1: R.eat(m); break;
      case 2: R.sleep(m); break;
      case 3:
        if (m.fell) break;
        if (!R.readyToClimbBanana(m) && m.climb === 0){
          R.goTo(m, R.LADDER_X, R.FLOOR);
          break;
        }
        R.clearPath(m);
        if (m.climb === 0){
          m.climb = 1;
          R.S.stats.climbs++; R.S.win.climbs++;
          R.addLog(`${m.name} começou a subir a escada.`, 'climb');
        } else if (R.atClimbRung(m)){
          if (m.climb >= 3){ R.reachTop(m); m.climb = 0; }
          else m.climb++;
        }
        break;
      case 6: case 7: {
        const t = R.others(m)[a - 6];
        if (t && t !== m) R.groom(m, t);
        else m.act = 0;
        break;
      }
    }
  });

  ms.forEach(R.stepMove);

  ms.forEach(R.needs);

  ms.forEach((m, i) => {
    const r = R.computeReward(m, i, f0, v0, acts, keys, climbers);
    const e = {s:states[i], a:acts[i], r, s2:R.getState(m), done:m.dead};
    R.pushWin(m.buf, e, R.BUF); m.lastExp = e;
    if (Math.abs(r) > 0.6) R.pushWin(m.strong, e, 600);
    R.learnOne(m, e); R.learn(m);
  });

  ms.forEach(obs => ms.forEach((k, ki) => {
    if (k === obs) return;
    const a = acts[ki];
    const cl = climbers.find(c => c !== k);
    if (cl){
      const hit = (a === 4 || a === 5) && R.others(k)[a - 4] === cl;
      // Não dilui a norma de punir se o macaco estava em fome alta / sono forçado
      if (hit || (k.fome < 90 && k.energia >= 5 && !(k.restFor > 0))){
        R.pushWin(obs.obsClimb, hit ? 1 : 0, 150);
      }
    } else {
      R.pushWin(obs.obsFree, R.CATS[a], 150);
    }
  }));

  ms.forEach(m => { if (m.dead){ R.addLog(`${m.name} morreu de fraqueza.`, 'hit'); R.replace(m.slot, true); } });

  if (!R.S.banana && --R.S.bananaTimer <= 0){ R.S.banana = true; }
  R.S.t++;
  if (R.S.t % 100 === 0){ R.S.series.push({c:R.S.win.climbs, i:R.S.win.inter}); if (R.S.series.length > 80) R.S.series.shift(); R.S.win = {climbs:0, inter:0}; }
};
})();
