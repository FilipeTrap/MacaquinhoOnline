(() => {
'use strict';
const R = window.Recinto;

R.anger = (m, o) => m.raiva[o.slot] || 0;
R.fear = (m, o) => m.medo[o.slot] || 0;

R.needs = function needs(m){
  if (!m.sleeping) m.energia -= 0.6;
  m.fome += 0.7;
  m.fel += (50 - m.fel)*0.01;
  if (m.fome > 60) m.fel -= (m.fome - 60)/40;
  if (m.energia < 30) m.fel -= (30 - m.energia)/15;
  if (m.fome >= 95) m.vida -= 0.8;
  if (m.energia <= 2) m.vida -= 1;
  if (m.fome < 70 && m.energia > 20) m.vida += 0.4;
  for (const k in m.raiva) m.raiva[k] = Math.max(0, m.raiva[k] - R.ANGER_DECAY);
  for (const k in m.medo) m.medo[k] = Math.max(0, m.medo[k] - R.FEAR_DECAY);
  m.fome = R.clamp(m.fome, 0, 100); m.energia = R.clamp(m.energia, 0, 100);
  m.vida = R.clamp(m.vida, 0, 100); m.fel = R.clamp(m.fel, 0, 100);
  for (const k in m.raiva) m.raiva[k] = R.clamp(m.raiva[k], 0, 100);
  for (const k in m.medo) m.medo[k] = R.clamp(m.medo[k], 0, 100);
  m.age++;
  if (m.vida <= 0) m.dead = true;
};

R.computeReward = function computeReward(m, i, f0, v0, acts, keys, climbers){
  let r = ((m.fel - f0[i]) + 1.5*(m.vida - v0[i]))/20;
  const ck = keys[i] + ':' + acts[i];
  const n = (m.counts.get(ck) || 0) + 1; m.counts.set(ck, n);
  r += R.S.cur*0.4/Math.sqrt(n);
  r += R.socialBonus(m, acts[i], climbers);
  if (m.dead) r -= 3;
  return R.clamp(r, -4, 3);
};
})();
