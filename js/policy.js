(() => {
'use strict';
const R = window.Recinto;

R.getState = function getState(m){
  const o = R.others(m), x = new Float32Array(18);
  x[0]=m.fome/100; x[1]=m.energia/100; x[2]=m.vida/100; x[3]=m.fel/100; x[4]=m.climb/3; x[5]=R.S.banana?1:0;
  o.forEach((k, i) => {
    const b = 6 + i*6;
    x[b]=k.climb/3;
    x[b+1]=R.anger(m,k)/100;
    x[b+2]=R.anger(k,m)/100;
    x[b+3]=R.fear(m,k)/100;
    x[b+4]=R.fear(k,m)/100;
    x[b+5]=k.sleeping?1:0;
  });
  return x;
};

R.coarseKey = function coarseKey(m){
  const f = Math.min(2, Math.floor(m.fome/34)), e = Math.min(2, Math.floor(m.energia/34));
  const any = R.others(m).some(o => o.climb > 0) ? 1 : 0;
  return `${f}${e}${any}${m.climb>0?1:0}`;
};

R.actionLabel = function actionLabel(m, a){
  const o = R.others(m);
  if (a === 4 || a === 5){
    const t = o[a - 4];
    if (t && (t.climb > 0 || R.isOnBananaLadder(t))) return `Sacudir escada (${t.name})`;
  }
  return ['Descansar','Comer pepino','Dormir','Subir a escada',`Bater em ${o[0].name}`,`Bater em ${o[1].name}`,`Catar ${o[0].name}`,`Catar ${o[1].name}`][a];
};

R.randomAction = function randomAction(){
  let r = Math.random()*R.RWS;
  for (let i = 0; i < 8; i++){ r -= R.RW[i]; if (r <= 0) return i; }
  return 0;
};

R.choose = function choose(m, s){
  if (m.restFor > 0) return 2;
  if (m.recoverFor > 0) return 0;
  if (m.climb > 0) return 3;
  if (m.path && m.path.length && m.act === 3 && m.goal && Math.abs(m.goal.x - R.LADDER_X) < 40) return 3;
  if (m.path && m.path.length && (m.act === 4 || m.act === 5)){
    const t = R.others(m)[m.act - 4];
    if (t && t !== m && (t.climb > 0 || R.isOnBananaLadder(t) || R.isOnEmptyLadder(t))) return m.act;
  }
  if (m.path && m.path.length && m.act === 1) return 1;
  if (m.energia < 5 && m.restFor <= 0) return 2;

  const o = R.others(m);
  const climber = o.find(k => k.climb > 0 || R.isOnBananaLadder(k));

  // Punir quem sobe tem prioridade sobre fome leve (senão a norma some)
  if (climber && m.fome < 90){
    const hitAct = 4 + o.indexOf(climber);
    if (R.anger(m, climber) >= 25) return hitAct;
    if (m.showers > 0 && R.S.conf > 0 && Math.random() < 0.25 + R.S.conf * 0.55) return hitAct;
    if (m.obsClimb.length >= 5 && Math.random() < R.mean(m.obsClimb) * Math.max(0.35, R.S.conf)) return hitAct;
  }

  // Fome: 70 procura, 90 alta, 100 desespero
  if (m.fome >= 100){
    if (R.S.banana) return 3;
    return 1;
  }
  if (m.fome >= 90) return 1;
  if (m.fome >= 70){
    if (Math.random() < 0.45 + (m.fome - 70) / 40) return 1;
  }

  const feared = R.mostFeared(m);
  if (m.fome < 70 && feared && feared.fear >= R.FEAR_AVOID && Math.abs(m.px - feared.target.px) < R.FEAR_NEAR){
    return 0;
  }
  const eps = 0.05 + 0.55*Math.exp(-m.age/600);
  if (Math.random() < eps) return R.randomAction();
  if (climber && Math.random() < R.S.conf){
    if (m.obsClimb.length >= 5 && Math.random() < R.mean(m.obsClimb)) return 4 + o.indexOf(climber);
  }
  let a = R.argmax(R.predict(m.net, s));
  // Catar só faz sentido contra outro macaco
  if (a === 6 || a === 7){
    const t = o[a - 6];
    if (!t || t === m) a = 0;
  }
  if (a === 4 || a === 5){
    const t = o[a - 4];
    if (!t || t === m) a = 0;
  }
  return a;
};

R.socialBonus = function socialBonus(m, a, climbers){
  if (!R.S.conf || m.climb > 0) return 0;
  const cl = climbers.find(c => c !== m);
  let freq, base;
  if (cl){
    if (m.obsClimb.length < 5) return 0;
    const p = R.mean(m.obsClimb), isHit = (a === 4 || a === 5) && R.others(m)[a-4] === cl;
    return isHit ? R.S.conf*2.5*Math.max(0, p - 0.25) : 0;
  } else {
    if (m.obsFree.length < 10) return 0;
    freq = m.obsFree.filter(c => c === R.CATS[a]).length / m.obsFree.length; base = 0.2;
  }
  return R.S.conf*0.7*(freq - base);
};
})();
