(() => {
'use strict';
const R = window.Recinto;
const T = R.Tile;

R.world = null;

R.buildWorld = function buildWorld(){
  const tiles = new Uint8Array(R.TILES_X * R.TILES_Y);
  tiles.fill(T.Floor);

  // walls
  for (let tx = 0; tx < R.TILES_X; tx++){
    tiles[tx] = T.Wall;
    tiles[(R.TILES_Y - 1) * R.TILES_X + tx] = T.Wall;
  }
  for (let ty = 0; ty < R.TILES_Y; ty++){
    tiles[ty * R.TILES_X] = T.Wall;
    tiles[ty * R.TILES_X + R.TILES_X - 1] = T.Wall;
  }

  // left: bed (cols 2-4, rows 3-4) and cucumber (cols 2-4, rows 6-7)
  for (let ty = 3; ty <= 4; ty++) for (let tx = 2; tx <= 4; tx++) tiles[ty * R.TILES_X + tx] = T.Bed;
  for (let ty = 6; ty <= 7; ty++) for (let tx = 2; tx <= 4; tx++) tiles[ty * R.TILES_X + tx] = T.Cucumber;

  // right bridge eastward along row 5: start 13 → mid 14-16 → end 17
  // floor under those cells is UnderBridge; elevated path uses Bridge* types
  const bridgeRow = 5;
  const path = [];
  const startCol = 13, endCol = 17;
  for (let tx = startCol; tx <= endCol; tx++){
    let kind = T.Bridge;
    if (tx === startCol) kind = T.BridgeStart;
    if (tx === endCol) kind = T.BridgeEnd;
    tiles[bridgeRow * R.TILES_X + tx] = kind;
    path.push({tx, ty:bridgeRow});
  }
  // approach tile west of start stays Floor (walk onto BridgeStart from west)
  // mark cells directly south of bridge as UnderBridge walkable floor (below the span)
  for (let tx = startCol; tx <= endCol; tx++){
    const under = (bridgeRow + 1) * R.TILES_X + tx;
    if (tiles[under] === T.Floor) tiles[under] = T.UnderBridge;
  }

  const bedCx = (2 + 4 + 1) / 2 * R.TILE;
  const bedCy = (3 + 4 + 1) / 2 * R.TILE;
  const cucCx = (2 + 4 + 1) / 2 * R.TILE;
  const cucCy = (6 + 7 + 1) / 2 * R.TILE;
  const bridgeEntry = {
    x: (startCol + 0.5) * R.TILE,
    y: (bridgeRow + 0.5) * R.TILE
  };
  const approach = {
    x: (startCol - 0.5) * R.TILE,
    y: (bridgeRow + 0.5) * R.TILE
  };
  const bananaPos = {
    x: (endCol + 0.5) * R.TILE,
    y: (bridgeRow + 0.5) * R.TILE
  };

  R.world = {
    tiles,
    bridgePath: path,
    bridgeLen: path.length,
    bed: {x: bedCx, y: bedCy},
    cucumber: {x: cucCx, y: cucCy},
    bridgeEntry,
    approach,
    bananaPos,
    bridgeRow,
    startCol,
    endCol
  };
  return R.world;
};

R.tileIndex = (tx, ty) => ty * R.TILES_X + tx;

R.tileAt = function tileAt(x, y){
  const tx = Math.floor(x / R.TILE);
  const ty = Math.floor(y / R.TILE);
  if (tx < 0 || ty < 0 || tx >= R.TILES_X || ty >= R.TILES_Y) return T.Wall;
  return R.world.tiles[R.tileIndex(tx, ty)];
};

R.tileAtCell = function tileAtCell(tx, ty){
  if (tx < 0 || ty < 0 || tx >= R.TILES_X || ty >= R.TILES_Y) return T.Wall;
  return R.world.tiles[R.tileIndex(tx, ty)];
};

R.isBridgeTile = function isBridgeTile(t){
  return t === T.BridgeStart || t === T.Bridge || t === T.BridgeEnd;
};

R.bridgeStepAt = function bridgeStepAt(tx, ty){
  const path = R.world.bridgePath;
  for (let i = 0; i < path.length; i++) if (path[i].tx === tx && path[i].ty === ty) return i;
  return -1;
};

/** Passable for a monkey on a given layer. Jump landing uses allowBridge=false. */
R.isPassable = function isPassable(x, y, layer, opts){
  opts = opts || {};
  const tx = Math.floor(x / R.TILE);
  const ty = Math.floor(y / R.TILE);
  if (tx < 1 || ty < 1 || tx >= R.TILES_X - 1 || ty >= R.TILES_Y - 1) return false;
  const t = R.tileAtCell(tx, ty);
  if (t === T.Wall) return false;

  if (layer === 'bridge'){
    return R.isBridgeTile(t);
  }

  // floor layer
  if (opts.jump){
    // cannot land on or over bridge tiles
    if (R.isBridgeTile(t)) return false;
    return t === T.Floor || t === T.Bed || t === T.Cucumber || t === T.UnderBridge;
  }

  // walking on floor: can step onto BridgeStart only from approach (handled in tryMove)
  if (R.isBridgeTile(t)){
    // mid/end never enterable from floor
    if (t !== T.BridgeStart) return false;
    return !!opts.enterBridge;
  }
  return t === T.Floor || t === T.Bed || t === T.Cucumber || t === T.UnderBridge;
};

R.cellCenter = function cellCenter(tx, ty){
  return {x: (tx + 0.5) * R.TILE, y: (ty + 0.5) * R.TILE};
};

R.syncVisual = function syncVisual(m){
  const lift = m.layer === 'bridge' ? 28 : 0;
  m.tx = m.x;
  m.ty = m.y - lift;
};

R.spawnPoint = function spawnPoint(slot){
  // open floor mid-left of center
  const spots = [
    {x: 7.5 * R.TILE, y: 4.5 * R.TILE},
    {x: 9.5 * R.TILE, y: 5.5 * R.TILE},
    {x: 8.5 * R.TILE, y: 7.5 * R.TILE}
  ];
  return spots[slot % spots.length];
};

R.underBridgeCellOf = function underBridgeCellOf(bridgeStep){
  const p = R.world.bridgePath[bridgeStep];
  if (!p) return null;
  return {tx: p.tx, ty: p.ty + 1};
};

R.isUnderTarget = function isUnderTarget(h, t){
  if (t.layer !== 'bridge' || h.layer !== 'floor') return false;
  const under = R.underBridgeCellOf(t.bridgeStep);
  if (!under) return false;
  const hx = Math.floor(h.x / R.TILE), hy = Math.floor(h.y / R.TILE);
  return hx === under.tx && hy === under.ty;
};
})();
