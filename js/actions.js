(() => {
'use strict';
const R = window.Recinto;

R.PATH_SNAP = 20;
R.STEP = 32;

R.centerSpot = function centerSpot(m){ return 480 + m.slot*75; };

R.mostFeared = function mostFeared(m){
  const o = R.others(m);
  let best = null, v = 0;
  o.forEach(k => { const f = R.fear(m, k); if (f > v){ v = f; best = k; } });
  return best ? {target:best, fear:v} : null;
};

R.isOnEmptyLadder = function isOnEmptyLadder(m){
  return Math.abs(m.px - R.EMPTY_LADDER_X) < 28 && m.py < R.FLOOR - 35 && m.py > R.LOFT_Y + 12;
};

R.isOnBananaLadder = function isOnBananaLadder(m){
  if (m.climb > 0) return true;
  return Math.abs(m.px - R.LADDER_X) < 40 && m.py < R.FLOOR - 35 && m.py > R.TOP_Y - 15;
};

R.levelOf = function levelOf(m){
  if (m.climb > 0 || R.isOnBananaLadder(m)) return 'banana';
  if (Math.abs(m.py - R.TOP_Y) < 35 && Math.abs(m.px - R.LADDER_X) < 70) return 'bananaTop';
  if (R.isOnEmptyLadder(m)) return 'empty';
  if (Math.abs(m.py - R.LOFT_Y) < 28) return 'loft';
  return 'floor';
};

R.clearPath = function clearPath(m){
  m.path = [];
  m.goal = null;
};

R.buildPath = function buildPath(m, gx, gy){
  const wantLoft = Math.abs(gy - R.LOFT_Y) < 20;
  const yGoal = wantLoft ? R.LOFT_Y : R.FLOOR;
  const path = [];
  let x = m.px, y = m.py;
  const level = R.levelOf(m);

  if (level === 'banana' || level === 'bananaTop'){
    path.push({x:R.LADDER_X, y:R.FLOOR});
    x = R.LADDER_X; y = R.FLOOR;
    if (wantLoft){
      path.push({x:R.EMPTY_LADDER_X, y:R.FLOOR});
      path.push({x:R.EMPTY_LADDER_X, y:R.LOFT_Y});
      x = R.EMPTY_LADDER_X; y = R.LOFT_Y;
    }
  } else if (level === 'empty'){
    if (wantLoft){
      path.push({x:R.EMPTY_LADDER_X, y:R.LOFT_Y});
      x = R.EMPTY_LADDER_X; y = R.LOFT_Y;
    } else {
      path.push({x:R.EMPTY_LADDER_X, y:R.FLOOR});
      x = R.EMPTY_LADDER_X; y = R.FLOOR;
    }
  } else if (level === 'loft' && !wantLoft){
    if (Math.abs(x - R.EMPTY_LADDER_X) > 12) path.push({x:R.EMPTY_LADDER_X, y:R.LOFT_Y});
    path.push({x:R.EMPTY_LADDER_X, y:R.FLOOR});
    x = R.EMPTY_LADDER_X; y = R.FLOOR;
  } else if (level === 'floor' && wantLoft){
    if (Math.abs(x - R.EMPTY_LADDER_X) > 12) path.push({x:R.EMPTY_LADDER_X, y:R.FLOOR});
    path.push({x:R.EMPTY_LADDER_X, y:R.LOFT_Y});
    x = R.EMPTY_LADDER_X; y = R.LOFT_Y;
  }

  if (Math.abs(x - gx) > 8 || Math.abs(y - yGoal) > 8) path.push({x:gx, y:yGoal});
  return path;
};

R.goTo = function goTo(m, gx, gy){
  const yGoal = Math.abs(gy - R.LOFT_Y) < 20 ? R.LOFT_Y : R.FLOOR;
  if (m.goal && Math.abs(m.goal.x - gx) < 24 && Math.abs(m.goal.y - yGoal) < 12){
    if (m.path && m.path.length) return;
    if (Math.hypot(m.px - gx, m.py - yGoal) < R.PATH_SNAP) return;
  }
  m.goal = {x:gx, y:yGoal};
  m.path = R.buildPath(m, gx, yGoal);
};

R.stepMove = function stepMove(m){
  if (m.restFor > 0 || m.recoverFor > 0){
    m.tx = m.px; m.ty = m.py;
    return;
  }
  if (m.climb > 0){
    const targetY = R.FLOOR - m.climb * 84;
    const dx = R.LADDER_X - m.px;
    const dy = targetY - m.py;
    const dist = Math.hypot(dx, dy);
    if (dist <= R.STEP){ m.px = R.LADDER_X; m.py = targetY; }
    else { m.px += dx / dist * R.STEP; m.py += dy / dist * R.STEP; }
    m.tx = m.px; m.ty = m.py;
    return;
  }
  if (!m.path || !m.path.length){
    m.tx = m.px; m.ty = m.py;
    return;
  }
  // Correndo: pulo de 2 passos. Se o destino está a 1 passo ou menos, anda normal.
  const run = m.running && R.pathRemaining(m) > R.STEP;
  let budget = run ? R.STEP * R.RUN_MULT : R.STEP;
  const x0 = m.px, y0 = m.py;
  while (budget > 0 && m.path.length){
    const n = m.path[0];
    const dx = n.x - m.px, dy = n.y - m.py;
    const dist = Math.hypot(dx, dy);
    if (dist <= budget){
      m.px = n.x; m.py = n.y;
      m.path.shift();
      budget -= dist;
      if (!run) break;
    } else {
      m.px += dx / dist * budget;
      m.py += dy / dist * budget;
      budget = 0;
    }
  }
  if (run){
    m.energia -= R.RUN_EXTRA;
    m.anim = {kind:'jump', x0, y0, t0:performance.now(), dur:Math.min(350, R.tickMs()*0.9)};
    if (R.tickMs() >= 30) R.addFx({type:'dust', x:x0, y:y0, life:14});
  }
  m.tx = m.px; m.ty = m.py;
};

R.pathRemaining = function pathRemaining(m){
  let d = 0, x = m.px, y = m.py;
  (m.path || []).forEach(n => { d += Math.hypot(n.x - x, n.y - y); x = n.x; y = n.y; });
  return d;
};

R.tickMs = function tickMs(){
  return 1000 / R.SPEEDS[R.S.speed].tps;
};

R.awaySpot = function awaySpot(m){
  const feared = R.mostFeared(m);
  const useLoft = !!(feared && feared.fear >= R.FEAR_AVOID);
  const y = useLoft ? R.LOFT_Y : R.FLOOR;
  const x0 = useLoft ? R.LOFT_X0 + 30 : 60;
  const x1 = useLoft ? R.LOFT_X1 - 30 : Math.min(R.LADDER_X - 80, R.W - 80);
  let tx = useLoft
    ? x0 + m.slot * ((x1 - x0) / 3)
    : R.centerSpot(m);
  if (feared && feared.fear >= R.FEAR_AVOID){
    const fx = feared.target.px;
    if (m.px < fx) tx = Math.max(x0, Math.min(tx, fx - 160));
    else tx = Math.min(x1, Math.max(tx, fx + 160));
    if (Math.abs(tx - fx) < 100) tx = fx < (x0 + x1) / 2 ? x1 - m.slot * 40 : x0 + m.slot * 40;
  }
  return {x: tx, y};
};

// side: -1 cai à esquerda da escada, 1 cai à direita
R.fallBeside = function fallBeside(m, ladderX, side){
  const x0 = m.px, y0 = m.py;
  R.clearPath(m);
  m.climb = 0;
  m.fell = true;
  m.px = ladderX + side * 50;
  m.py = R.FLOOR;
  m.tx = m.px;
  m.ty = m.py;
  m.anim = {kind:'fall', x0, y0, side, t0:performance.now(), dur:Math.min(650, R.tickMs()*0.95)};
};

// Lado da escada mais perto de h: -1 esquerda, 1 direita
R.ladderSide = function ladderSide(h, ladderX){
  return h.px < ladderX ? -1 : 1;
};

// Parado no chão, colado ao lado da escada (não serve de longe)
R.besideLadder = function besideLadder(h, ladderX){
  return R.levelOf(h) === 'floor'
    && Math.abs(h.py - R.FLOOR) < 10
    && Math.abs(Math.abs(h.px - ladderX) - R.SIDE_GAP) <= 16
    && (!h.path || !h.path.length);
};

R.runToLadder = function runToLadder(h, ladderX){
  h.running = true;
  R.goTo(h, ladderX + R.ladderSide(h, ladderX) * R.SIDE_GAP, R.FLOOR);
};

R.hit = function hit(h, t){
  const onBanana = t.climb > 0 || (Math.abs(t.px - R.LADDER_X) < 40 && t.py < R.FLOOR - 40);
  const onEmpty = R.isOnEmptyLadder(t);

  // Sacudir a escada da banana: só do lado dela
  if (onBanana){
    if (!R.besideLadder(h, R.LADDER_X)){
      R.runToLadder(h, R.LADDER_X);
      return;
    }
    t.fel -= 18; t.vida -= 8;
    t.raiva[h.slot] = R.anger(t, h) + 25;
    t.medo[h.slot] = R.fear(t, h) + R.FEAR_HIT;
    t.flash = 14;
    h.energia -= 3; h.fel -= 2;
    t.hitClimbing++; h.punisher++;
    R.S.stats.inter++; R.S.win.inter++;
    R.fallBeside(t, R.LADDER_X, -R.ladderSide(h, R.LADDER_X));
    R.addLog(`${h.name} sacudiu a escada e ${t.name} caiu.`, 'hit');
    R.addFx({type:'hit', slot:t.slot, life:18});
    return;
  }

  // Sacudir escada vazia
  if (onEmpty){
    if (!R.besideLadder(h, R.EMPTY_LADDER_X)){
      R.runToLadder(h, R.EMPTY_LADDER_X);
      return;
    }
    t.fel -= 18; t.vida -= 8;
    t.raiva[h.slot] = R.anger(t, h) + 25;
    t.medo[h.slot] = R.fear(t, h) + R.FEAR_HIT;
    t.flash = 14;
    h.energia -= 3; h.fel -= 2;
    R.fallBeside(t, R.EMPTY_LADDER_X, -R.ladderSide(h, R.EMPTY_LADDER_X));
    R.addLog(`${h.name} sacudiu a escada e ${t.name} caiu.`, 'hit');
    R.addFx({type:'hit', slot:t.slot, life:18});
    return;
  }

  // Briga no chão / loft: precisa chegar perto
  const ty = R.levelOf(t) === 'loft' ? R.LOFT_Y : R.FLOOR;
  h.running = true;
  if (Math.hypot(h.px - t.px, h.py - t.py) > 55){
    R.goTo(h, t.px + (h.px < t.px ? -34 : 34), ty);
    return;
  }
  t.fel -= 10; t.vida -= 2;
  t.raiva[h.slot] = R.anger(t, h) + 25;
  t.medo[h.slot] = R.fear(t, h) + R.FEAR_HIT;
  t.flash = 14;
  h.energia -= 3; h.fel -= 4;
  R.goTo(h, t.px + (h.px < t.px ? -34 : 34), ty);
  R.addLog(`${h.name} bateu em ${t.name}.`, 'hit');
  R.addFx({type:'hit', slot:t.slot, life:18});
};

R.eat = function eat(m){
  const spotX = R.PEPINO_X0 + 25 + m.slot * 40;
  R.goTo(m, spotX, R.FLOOR);
  if (!R.atPepino(m)) return;
  if (m.fome < 20){ m.fel -= 1; m.fome -= 4; }
  else { m.fel += 1 + m.fome/100*6; m.fome -= 25; }
};

R.atPepino = function atPepino(m){
  return m.px >= R.PEPINO_X0 && m.px <= R.PEPINO_X1
    && Math.abs(m.py - R.FLOOR) < 28;
};

R.sleep = function sleep(m){
  m.fel += Math.max(0, 100 - m.energia)/15; m.energia += 10; m.fome -= 0.4; m.sleeping = true;
  // sono forçado: fica parado; sono normal pode ir a um cantinho
  if (m.restFor > 0){
    R.clearPath(m);
    m.tx = m.px; m.ty = m.py;
    return;
  }
  if (!m.path || !m.path.length){
    const spot = R.awaySpot(m);
    R.goTo(m, spot.x, spot.y);
  }
};

R.recover = function recover(m){
  m.vida += 4;
  m.fel += 0.8;
  m.energia += 1;
  R.clearPath(m);
  m.tx = m.px; m.ty = m.py;
};

R.groom = function groom(m, o){
  if (!o || o === m) return;
  const oy = R.levelOf(o) === 'loft' ? R.LOFT_Y : R.FLOOR;
  R.goTo(m, o.px + (m.px < o.px ? -30 : 30), oy);
  if (o.climb > 0 || R.isOnEmptyLadder(o) || R.isOnBananaLadder(o)) return;
  if (Math.hypot(m.px - o.px, m.py - o.py) > 55) return;
  m.fel += 3; o.fel += 3; m.energia -= 0.5;
  o.raiva[m.slot] = Math.max(0, R.anger(o, m) - 12);
  m.raiva[o.slot] = Math.max(0, R.anger(m, o) - 6);
  o.medo[m.slot] = Math.max(0, R.fear(o, m) - 8);
  m.medo[o.slot] = Math.max(0, R.fear(m, o) - 4);
};

R.readyToClimbBanana = function readyToClimbBanana(m){
  return R.levelOf(m) === 'floor'
    && Math.abs(m.px - R.LADDER_X) < 40
    && Math.abs(m.py - R.FLOOR) < 24
    && (!m.path || !m.path.length);
};

R.atClimbRung = function atClimbRung(m){
  const targetY = R.FLOOR - m.climb * 84;
  return Math.abs(m.px - R.LADDER_X) < 16 && Math.abs(m.py - targetY) < 16;
};

R.reachTop = function reachTop(m){
  if (!R.S.banana){ R.addLog(`${m.name} subiu, mas a banana ainda não voltou.`, 'climb'); return; }
  const f = m.fome;
  m.fel += 6 + f/100*10; m.fome = Math.max(0, f - 30); m.bananas++;
  R.S.banana = false; R.S.bananaTimer = 15; R.S.stats.bananas++;
  m.px = R.LADDER_X; m.py = R.TOP_Y; m.tx = m.px; m.ty = m.py;
  if (R.S.water){
    const wet = R.others(m);
    wet.forEach(o => { o.fel -= 35; o.energia -= 6; o.raiva[m.slot] = R.anger(o, m) + 35; o.showers++; });
    R.S.stats.showers++;
    R.addFx({type:'water', slots:wet.map(o => o.slot), life:55});
    R.addLog(`${m.name} pegou a banana. Água fria em ${wet.map(o => o.name).join(' e ')}.`, 'water');
  } else {
    R.addLog(`${m.name} pegou a banana. Sem água desta vez.`, 'climb');
  }
};
})();
