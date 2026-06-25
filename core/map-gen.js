/** BSP-генерация карты 80×60 */

const BSP_MIN_LEAF_W = 12;
const BSP_MIN_LEAF_H = 10;
const ROOM_MIN_W = 6;
const ROOM_MIN_H = 5;
const CORRIDOR_W = 2;

function biomeAtCol(col, row) {
  const wave = Math.sin(row * 0.12) * 5 + Math.cos(col * 0.08) * 3 + Math.sin((col + row) * 0.05) * 2;
  return col < MAP_W * 0.5 + wave ? BIOME.MINE : BIOME.RUINS;
}

function generateMap(seed) {
  const rng = createRng(seed);
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const biomes = new Array(MAP_W * MAP_H);

  const root = { x: 0, y: 0, w: MAP_W, h: MAP_H, left: null, right: null, room: null };
  splitBsp(root, rng);
  const leaves = [];
  collectLeaves(root, leaves);

  for (const leaf of leaves) {
    leaf.room = carveRoom(leaf, rng);
  }

  connectBspRooms(root, tiles, rng);

  for (const leaf of leaves) {
    const room = leaf.room;
    if (!room) continue;
    for (let row = room.y; row < room.y + room.h; row++) {
      for (let col = room.x; col < room.x + room.w; col++) {
        const i = row * MAP_W + col;
        tiles[i] = TILE.FLOOR;
        biomes[i] = biomeAtCol(col, row);
      }
    }
  }

  finalizeWalls(tiles, biomes, rng);

  const rooms = leaves.map((l) => l.room).filter(Boolean);
  const p1Room = pickRoomInQuarter(rooms, 0, 0.25, rng);
  const p2Room = pickRoomInQuarter(rooms, 0.75, 1, rng);
  const exitRoom = pickFarthestRoom(rooms);
  const mobRooms = rooms.filter((r) => r !== p1Room && r !== p2Room && r !== exitRoom);
  if (exitRoom) {
    const ecx = exitRoom.cx;
    const ecy = exitRoom.cy;
    tiles[ecy * MAP_W + ecx] = TILE.EXIT;
  }

  return {
    seed,
    tiles,
    biomes,
    rooms,
    spawnP1: roomCenter(p1Room),
    spawnP2: roomCenter(p2Room),
    exitPos: exitRoom ? roomCenter(exitRoom) : { x: WORLD_W * 0.5, y: WORLD_H * 0.5 },
    mobRooms,
  };
}

function splitBsp(node, rng) {
  if (node.w <= BSP_MIN_LEAF_W && node.h <= BSP_MIN_LEAF_H) return;
  if (node.w < BSP_MIN_LEAF_W * 2 && node.h < BSP_MIN_LEAF_H * 2) return;

  const splitH = node.w > node.h
    ? (node.w >= BSP_MIN_LEAF_W * 2 && (node.h < BSP_MIN_LEAF_H * 2 || rng.chance(0.55)))
    : false;
  const splitV = !splitH && node.h >= BSP_MIN_LEAF_H * 2;

  if (!splitH && !splitV) return;

  if (splitH) {
    const min = Math.max(BSP_MIN_LEAF_W, Math.floor(node.w * 0.35));
    const max = node.w - BSP_MIN_LEAF_W;
    if (max <= min) return;
    const cut = rng.int(min, max);
    node.left = { x: node.x, y: node.y, w: cut, h: node.h, left: null, right: null, room: null };
    node.right = { x: node.x + cut, y: node.y, w: node.w - cut, h: node.h, left: null, right: null, room: null };
  } else {
    const min = Math.max(BSP_MIN_LEAF_H, Math.floor(node.h * 0.35));
    const max = node.h - BSP_MIN_LEAF_H;
    if (max <= min) return;
    const cut = rng.int(min, max);
    node.left = { x: node.x, y: node.y, w: node.w, h: cut, left: null, right: null, room: null };
    node.right = { x: node.x, y: node.y + cut, w: node.w, h: node.h - cut, left: null, right: null, room: null };
  }

  splitBsp(node.left, rng);
  splitBsp(node.right, rng);
}

function collectLeaves(node, out) {
  if (!node.left && !node.right) {
    out.push(node);
    return;
  }
  if (node.left) collectLeaves(node.left, out);
  if (node.right) collectLeaves(node.right, out);
}

function carveRoom(leaf, rng) {
  const pad = 2;
  const maxW = leaf.w - pad * 2;
  const maxH = leaf.h - pad * 2;
  if (maxW < ROOM_MIN_W || maxH < ROOM_MIN_H) return null;

  const isMine = biomeAtCol(Math.floor(leaf.x + leaf.w * 0.5), Math.floor(leaf.y + leaf.h * 0.5)) === BIOME.MINE;
  const w = isMine
    ? rng.int(ROOM_MIN_W, Math.min(maxW, ROOM_MIN_W + 3))
    : rng.int(Math.max(ROOM_MIN_W, 6), Math.min(maxW, 10));
  const h = isMine
    ? rng.int(ROOM_MIN_H, Math.min(maxH, ROOM_MIN_H + 2))
    : rng.int(Math.max(ROOM_MIN_H, 6), Math.min(maxH, 10));

  const rx = leaf.x + rng.int(pad, Math.max(pad, leaf.w - w - pad));
  const ry = leaf.y + rng.int(pad, Math.max(pad, leaf.h - h - pad));

  return {
    x: rx,
    y: ry,
    w,
    h,
    cx: Math.floor(rx + w * 0.5),
    cy: Math.floor(ry + h * 0.5),
    biome: isMine ? BIOME.MINE : BIOME.RUINS,
  };
}

function connectBspRooms(node, tiles, rng) {
  if (!node.left || !node.right) return;

  connectBspRooms(node.left, tiles, rng);
  connectBspRooms(node.right, tiles, rng);

  const a = getRoomCenter(node.left);
  const b = getRoomCenter(node.right);
  if (!a || !b) return;

  carveCorridor(tiles, a.cx, a.cy, b.cx, b.cy, rng);
}

function getRoomCenter(node) {
  if (node.room) return node.room;
  const lc = node.left ? getRoomCenter(node.left) : null;
  const rc = node.right ? getRoomCenter(node.right) : null;
  if (lc && rc) return distSq(lc.cx, lc.cy, MAP_W * 0.5, MAP_H * 0.5) < distSq(rc.cx, rc.cy, MAP_W * 0.5, MAP_H * 0.5) ? lc : rc;
  return lc || rc;
}

function carveCorridor(tiles, x1, y1, x2, y2, rng) {
  const horizFirst = rng.chance(0.5);
  if (horizFirst) {
    carveH(tiles, x1, x2, y1);
    carveV(tiles, y1, y2, x2);
  } else {
    carveV(tiles, y1, y2, x1);
    carveH(tiles, x1, x2, y2);
  }
}

function carveH(tiles, x1, x2, y) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  for (let col = minX; col <= maxX; col++) {
    for (let w = 0; w < CORRIDOR_W; w++) {
      const row = y + w;
      if (col >= 0 && col < MAP_W && row >= 0 && row < MAP_H) {
        tiles[row * MAP_W + col] = TILE.FLOOR;
      }
    }
  }
}

function carveV(tiles, y1, y2, x) {
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  for (let row = minY; row <= maxY; row++) {
    for (let w = 0; w < CORRIDOR_W; w++) {
      const col = x + w;
      if (col >= 0 && col < MAP_W && row >= 0 && row < MAP_H) {
        tiles[row * MAP_W + col] = TILE.FLOOR;
      }
    }
  }
}

function finalizeWalls(tiles, biomes, rng) {
  for (let row = 0; row < MAP_H; row++) {
    for (let col = 0; col < MAP_W; col++) {
      const i = row * MAP_W + col;
      const biome = biomeAtCol(col, row);
      if (row === 0 || col === 0 || row === MAP_H - 1 || col === MAP_W - 1) {
        tiles[i] = TILE.WALL;
        biomes[i] = biome;
        continue;
      }
      if (tiles[i] !== TILE.FLOOR && tiles[i] !== TILE.EXIT) {
        tiles[i] = TILE.WALL;
        biomes[i] = biome;
      } else if (!biomes[i]) {
        biomes[i] = biome;
      }
    }
  }

  for (let row = 1; row < MAP_H - 1; row++) {
    for (let col = 1; col < MAP_W - 1; col++) {
      const i = row * MAP_W + col;
      if (tiles[i] !== TILE.FLOOR) continue;
      const biome = biomes[i];
      if (biome !== BIOME.RUINS) continue;
      const roomSize = countFloorBlob(tiles, col, row);
      if (roomSize < 36) continue;
      if (!rng.chance(0.08)) continue;
      if (hasNeighborFloor(tiles, col, row, 2)) {
        tiles[i] = TILE.COLUMN;
      }
    }
  }

  let columnsAdded = 0;
  const targetColumns = rng.int(3, 5);
  for (let attempt = 0; attempt < 200 && columnsAdded < targetColumns; attempt++) {
    const col = rng.int(2, MAP_W - 3);
    const row = rng.int(2, MAP_H - 3);
    const i = row * MAP_W + col;
    if (biomes[i] !== BIOME.RUINS || tiles[i] !== TILE.FLOOR) continue;
    if (!hasNeighborFloor(tiles, col, row, 2)) continue;
    tiles[i] = TILE.COLUMN;
    columnsAdded++;
  }
}

function hasNeighborFloor(tiles, col, row, minCount) {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const t = tileAtLocal(tiles, col + dx, row + dy);
      if (t === TILE.FLOOR) n++;
    }
  }
  return n >= minCount;
}

function countFloorBlob(tiles, col, row) {
  return hasNeighborFloor(tiles, col, row, 4) ? 40 : 10;
}

function tileAtLocal(tiles, col, row) {
  if (col < 0 || row < 0 || col >= MAP_W || row >= MAP_H) return TILE.WALL;
  return tiles[row * MAP_W + col];
}

function pickRoomInQuarter(rooms, qMin, qMax, rng) {
  const cxMin = MAP_W * qMin;
  const cxMax = MAP_W * qMax;
  const filtered = rooms.filter((r) => r.cx >= cxMin && r.cx <= cxMax);
  return filtered.length ? rng.pick(filtered) : rng.pick(rooms);
}

function pickFarthestRoom(rooms) {
  let best = rooms[0];
  let bestD = -1;
  const mx = MAP_W * 0.5;
  const my = MAP_H * 0.5;
  for (const r of rooms) {
    const d = distSq(r.cx, r.cy, mx, my);
    if (d > bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

function roomCenter(room) {
  if (!room) return { x: TILE_SIZE * 2, y: TILE_SIZE * 2 };
  return {
    x: (room.cx + 0.5) * TILE_SIZE,
    y: (room.cy + 0.5) * TILE_SIZE,
  };
}
