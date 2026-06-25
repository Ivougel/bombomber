/** Интерполяция / экстраполяция сетевых снапшотов для плавного рендера */

const NETWORK_TICK_MS = 33; // ~30 TPS, синхронно с server/game-loop.js

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function interpolateById(prevList, curList, t, fields = ["x", "y"]) {
  if (!curList?.length) return [];
  if (!prevList?.length || t >= 1) return curList.map((e) => ({ ...e }));

  const prevMap = new Map(prevList.map((e) => [e.id, e]));
  return curList.map((cur) => {
    const prev = prevMap.get(cur.id);
    if (!prev) return { ...cur };
    const out = { ...cur };
    for (const f of fields) {
      if (typeof cur[f] === "number" && typeof prev[f] === "number") {
        out[f] = lerp(prev[f], cur[f], t);
      }
    }
    return out;
  });
}

function interpolateBombs(prevList, curList, t) {
  if (!curList?.length) return [];
  if (!prevList?.length || t >= 1) return curList.map((b) => ({ ...b }));

  const key = (b) => `${b.col},${b.row}`;
  const prevMap = new Map(prevList.map((b) => [key(b), b]));
  return curList.map((cur) => {
    const prev = prevMap.get(key(cur));
    if (!prev) return { ...cur };
    return {
      ...cur,
      x: lerp(prev.x, cur.x, t),
      y: lerp(prev.y, cur.y, t),
    };
  });
}

function extrapolateProjectiles(projectiles, sec) {
  if (!projectiles?.length || sec <= 0) return projectiles || [];
  const cap = NETWORK_TICK_MS / 1000;
  const dt = Math.min(sec, cap);
  return projectiles.map((p) => ({
    ...p,
    x: p.x + (p.vx || 0) * dt,
    y: p.y + (p.vy || 0) * dt,
  }));
}

function interpolatePlayers(prevPlayers, curPlayers, remoteSlot, t) {
  if (!curPlayers?.length) return null;
  const cur = curPlayers.find((p) => p.id === remoteSlot);
  if (!cur) return null;
  if (!prevPlayers?.length || t >= 1) return { ...cur };

  const prev = prevPlayers.find((p) => p.id === remoteSlot);
  if (!prev) return { ...cur };
  return {
    ...cur,
    x: lerp(prev.x, cur.x, t),
    y: lerp(prev.y, cur.y, t),
  };
}

function buildNetworkRenderEntities(prevState, curState, alpha, mySlot, localEntities, extrapolateSec) {
  const remoteSlot = mySlot === 0 ? 1 : 0;
  const t = Math.min(1, Math.max(0, alpha));

  let drawPlayers = localEntities;
  const remoteInterp = interpolatePlayers(prevState?.players, curState?.players, remoteSlot, t);
  if (remoteInterp && localEntities[remoteSlot]) {
    drawPlayers = localEntities.slice();
    drawPlayers[remoteSlot] = {
      ...localEntities[remoteSlot],
      x: remoteInterp.x,
      y: remoteInterp.y,
      aimDir: remoteInterp.aimDir || localEntities[remoteSlot].aimDir,
    };
  }

  const drawMobs = interpolateById(prevState?.mobs, curState?.mobs, t);
  const drawProjectiles = extrapolateProjectiles(curState?.projectiles, extrapolateSec);
  const drawBombs = interpolateBombs(prevState?.bombs, curState?.bombs, t);

  return { drawPlayers, drawMobs, drawProjectiles, drawBombs };
}
