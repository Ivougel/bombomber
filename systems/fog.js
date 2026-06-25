/** Fog of War — UNSEEN / VISIBLE (открыто навсегда) */

const FOG = {
  UNSEEN: 0,
  VISIBLE: 1,
};

const FOG_RADIUS = 8;
const FOG_RADIUS_SQ = FOG_RADIUS * FOG_RADIUS;

function createFogMap() {
  const fogMap = new Array(MAP_H);
  for (let row = 0; row < MAP_H; row++) {
    fogMap[row] = new Uint8Array(MAP_W);
  }
  return fogMap;
}

function createFogState(fogMap) {
  return {
    map: fogMap,
    dirty: true,
    canvas: null,
    ctx: null,
  };
}

function ensureFogCanvas(fogState) {
  if (fogState.canvas) return;
  fogState.canvas = document.createElement("canvas");
  fogState.canvas.width = WORLD_W;
  fogState.canvas.height = WORLD_H;
  fogState.ctx = fogState.canvas.getContext("2d");
}

function isTileVisible(fogMap, tileX, tileY) {
  if (tileX < 0 || tileY < 0 || tileX >= MAP_W || tileY >= MAP_H) return false;
  return fogMap[tileY][tileX] === FOG.VISIBLE;
}

function isTileRevealed(fogMap, tileX, tileY) {
  return isTileVisible(fogMap, tileX, tileY);
}

function isWorldVisible(fogMap, worldX, worldY) {
  return isTileVisible(fogMap, Math.floor(worldX / TILE_SIZE), Math.floor(worldY / TILE_SIZE));
}

function revealFogAround(fogMap, centerCol, centerRow) {
  let revealedNew = false;
  const r = FOG_RADIUS;
  const minRow = Math.max(0, centerRow - r);
  const maxRow = Math.min(MAP_H - 1, centerRow + r);
  const minCol = Math.max(0, centerCol - r);
  const maxCol = Math.min(MAP_W - 1, centerCol + r);

  for (let row = minRow; row <= maxRow; row++) {
    const dy = row - centerRow;
    const rowData = fogMap[row];
    for (let col = minCol; col <= maxCol; col++) {
      const dx = col - centerCol;
      if (dx * dx + dy * dy > FOG_RADIUS_SQ) continue;
      if (rowData[col] === FOG.UNSEEN) {
        rowData[col] = FOG.VISIBLE;
        revealedNew = true;
      }
    }
  }
  return revealedNew;
}

/** Источники обзора: игроки и боты (не простые мобы). */
function collectVisionSources(players, bots) {
  const sources = [];
  for (const p of players || []) {
    if (p.alive) sources.push(p);
  }
  for (const bot of bots || []) {
    if (bot.alive) sources.push(bot);
  }
  return sources;
}

function updateFog(fogState, visionSources) {
  const fogMap = fogState.map;
  let revealedNew = false;

  for (const source of visionSources || []) {
    if (!source?.alive) continue;
    const col = Math.floor(source.x / TILE_SIZE);
    const row = Math.floor(source.y / TILE_SIZE);
    if (revealFogAround(fogMap, col, row)) revealedNew = true;
  }

  if (revealedNew) fogState.dirty = true;
}

function rebuildFogCanvas(fogState) {
  ensureFogCanvas(fogState);
  const fctx = fogState.ctx;
  const fogMap = fogState.map;

  fctx.clearRect(0, 0, WORLD_W, WORLD_H);

  for (let row = 0; row < MAP_H; row++) {
    const rowData = fogMap[row];
    for (let col = 0; col < MAP_W; col++) {
      if (rowData[col] === FOG.VISIBLE) continue;
      fctx.fillStyle = "rgba(0,0,0,1)";
      fctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
}

function renderFog(ctx, fogState) {
  if (!fogState?.map) return;
  if (fogState.dirty) {
    rebuildFogCanvas(fogState);
    fogState.dirty = false;
  }
  if (fogState.canvas) {
    ctx.drawImage(fogState.canvas, 0, 0);
  }
}

function markFogDirty(fogState) {
  if (fogState) fogState.dirty = true;
}
