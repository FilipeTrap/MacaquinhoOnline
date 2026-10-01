(() => {
'use strict';
const R = window.Recinto = window.Recinto || {};

R.W = 1100;
R.H = 460;
R.FLOOR = 402;
R.LADDER_X = 900;
R.TOP_Y = 150;
R.LOFT_Y = 260;
R.LOFT_X0 = 80;
R.LOFT_X1 = 520;
R.EMPTY_LADDER_X = 300;
R.PEPINO_X0 = 55;
R.PEPINO_X1 = 195;
R.PEPINO_X = 120;
R.ANGER_DECAY = 0.12;
R.FEAR_DECAY = 0.06;
R.FEAR_HIT = 28;
R.FEAR_AVOID = 55;
R.FEAR_NEAR = 120;
R.REST_TICKS = 10;
R.RECOVER_TICKS = 10;
R.RUN_MULT = 2;       // correndo, cada pulo vale 2 passos
R.RUN_EXTRA = 1.2;    // energia extra por pulo (base 0.6 → 3×)
R.SIDE_GAP = 45;      // distância do pé da escada onde o atacante fica
R.NAMES = ['Kiko','Nina','Tuca','Bento','Lia','Zeca','Pipa','Juca','Mel','Téo','Dora','Nico','Bia','Caco','Lulu','Dudu','Rita','Gabi','Tom','Iara','Fubá','Chico','Nana','Beto'];
R.COLLARS = ['#2F86A6','#C2502F','#6A8F2E'];
R.FURS = ['#8E5E34','#6F4A2C','#A87A45','#7C5536','#9A6A3D'];
R.SPEEDS = [{l:'1×',tps:2},{l:'5×',tps:10},{l:'25×',tps:50},{l:'200×',tps:400}];
R.CATS = ['descansar','comer','dormir','subir','bater','bater','catar','catar'];

R.SIZES = [18, 32, 24, 8];
R.GAMMA = 0.9;
R.LR = 0.008;
R.BATCH = 12;
R.BUF = 4000;
R.RW = [1,1,1,1,0.35,0.35,1,1];
R.RWS = R.RW.reduce((a, b) => a + b, 0);
})();
