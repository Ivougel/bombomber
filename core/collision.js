/** Коллизия круга с тайловой картой (скользящая) */

function isSolidTile(tile) {
  return tile === TILE.WALL_HARD
    || tile === TILE.WALL_HARD_CRACKED
    || tile === TILE.WALL_SOFT
    || tile === TILE.COLUMN
    || tile === TILE.COLUMN_CRACKED;
}

function isDestructibleWall(tile) {
  return tile === TILE.WALL_SOFT
    || tile === TILE.WALL_HARD
    || tile === TILE.WALL_HARD_CRACKED
    || tile === TILE.COLUMN
    || tile === TILE.COLUMN_CRACKED;
}

function isColumnTile(tile) {
  return tile === TILE.COLUMN || tile === TILE.COLUMN_CRACKED;
}

function isWalkableTile(tile) {
  return tile === TILE.FLOOR || tile === TILE.EXIT;
}

function tileAt(map, col, row) {
  if (col < 0 || row < 0 || col >= MAP_W || row >= MAP_H) return TILE.WALL_HARD;
  return map.tiles[row * MAP_W + col];
}

function biomeAt(map, col, row) {
  if (col < 0 || row < 0 || col >= MAP_W || row >= MAP_H) return BIOME.MINE;
  return map.biomes[row * MAP_W + col];
}

function circleIntersectsTile(px, py, radius, col, row) {
  const tile = tileAt(mapRef, col, row);
  if (!isSolidTile(tile)) return false;
  const shrink = isColumnTile(tile) ? 6 : 0;
  const tx = col * TILE_SIZE + shrink;
  const ty = row * TILE_SIZE + shrink;
  const tw = TILE_SIZE - shrink * 2;
  const th = TILE_SIZE - shrink * 2;
  const cx = Math.max(tx, Math.min(px, tx + tw));
  const cy = Math.max(ty, Math.min(py, ty + th));
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy < radius * radius;
}

let mapRef = null;

function setCollisionMap(map) {
  mapRef = map;
}

function resolveCircleMovement(px, py, vx, vy, radius) {
  if (!mapRef) return { x: px + vx, y: py + vy };

  let x = px + vx;
  let y = py + vy;

  const minCol = Math.floor((x - radius) / TILE_SIZE) - 1;
  const maxCol = Math.floor((x + radius) / TILE_SIZE) + 1;
  const minRow = Math.floor((y - radius) / TILE_SIZE) - 1;
  const maxRow = Math.floor((y + radius) / TILE_SIZE) + 1;

  for (let pass = 0; pass < 3; pass++) {
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const tile = tileAt(mapRef, col, row);
        if (!isSolidTile(tile)) continue;

        const shrink = isColumnTile(tile) ? 6 : 0;
        const tx = col * TILE_SIZE + shrink;
        const ty = row * TILE_SIZE + shrink;
        const tw = TILE_SIZE - shrink * 2;
        const th = TILE_SIZE - shrink * 2;

        const cx = Math.max(tx, Math.min(x, tx + tw));
        const cy = Math.max(ty, Math.min(y, ty + th));
        const dx = x - cx;
        const dy = y - cy;
        const distSq = dx * dx + dy * dy;
        if (distSq >= radius * radius || distSq === 0) continue;

        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        x += nx * push;
        y += ny * push;
      }
    }
  }

  x = Math.max(radius, Math.min(WORLD_W - radius, x));
  y = Math.max(radius, Math.min(WORLD_H - radius, y));
  return { x, y };
}

function distSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function dist(ax, ay, bx, by) {
  return Math.sqrt(distSq(ax, ay, bx, by));
}

function normalizeDir(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}
