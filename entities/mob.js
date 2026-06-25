/** Мобы: бродяга, стрелок, берсерк */

let mobIdCounter = 0;

function spawnMobs(map, budget, rng) {
  const mobs = [];
  const queue = [];
  for (const [type, count] of Object.entries(budget)) {
    for (let i = 0; i < count; i++) queue.push(type);
  }
  rng.pick; // keep rng hot
  shuffleArray(queue, rng);

  const rooms = [...map.mobRooms];
  shuffleArray(rooms, rng);

  const roomCounts = new Array(rooms.length).fill(0);
  let qi = 0;
  for (const type of queue) {
    if (!rooms.length) break;
    let placed = false;
    for (let attempt = 0; attempt < rooms.length && !placed; attempt++) {
      const ri = (qi + attempt) % rooms.length;
      if (roomCounts[ri] >= 5) continue;
      const room = rooms[ri];
      const pos = randomFloorInRoom(map, room, rng);
      if (!pos) continue;

      const def = MOB_DEFS[type];
      mobs.push({
        id: mobIdCounter++,
        type,
        emoji: def.emoji,
        x: pos.x,
        y: pos.y,
        spawnX: pos.x,
        spawnY: pos.y,
        hp: def.hp,
        maxHp: def.hp,
        speed: def.speed,
        baseSpeed: def.speed,
        damage: def.damage,
        touchRadius: def.touchRadius,
        radius: 14,
        gold: def.gold,
        alive: true,
        aggro: false,
        aggroTarget: null,
        state: type === "berserker" ? "sleep" : type === "wanderer" ? "patrol" : "idle",
        patrolAngle: rng.next() * Math.PI * 2,
        shootTimer: ARCHER_SHOOT_INTERVAL * rng.next(),
        roomId: ri,
        dropZone: { x: pos.x, y: pos.y, item: rollDrop(rng) },
      });
      roomCounts[ri]++;
      placed = true;
      qi = ri + 1;
    }
  }
  return mobs;
}

function shuffleArray(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function randomFloorInRoom(map, room, rng) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const col = rng.int(room.x + 1, room.x + room.w - 2);
    const row = rng.int(room.y + 1, room.y + room.h - 2);
    const tile = tileAt(map, col, row);
    if (tile === TILE.FLOOR) {
      return { x: (col + 0.5) * TILE_SIZE, y: (row + 0.5) * TILE_SIZE };
    }
  }
  return roomCenter(room);
}

function rollDrop(rng) {
  const items = ["⚔️ Клинок", "🛡 Щит", "👢 Сапоги", "💍 Кольцо", "🧪 Зелье"];
  return rng.pick(items);
}

function updateMobs(mobs, players, projectiles, dt, effects) {
  for (const mob of mobs) {
    if (!mob.alive) continue;
    updateMob(mob, players, projectiles, dt, effects);
  }
}

function updateMob(mob, players, projectiles, dt, effects) {
  const target = findAggroTarget(mob, players);
  if (target) {
    mob.aggro = true;
    mob.aggroTarget = target.id;
  } else if (mob.aggro) {
    const t = players.find((p) => p.id === mob.aggroTarget && p.alive);
    if (!t || dist(mob.x, mob.y, t.x, t.y) > MOB_DEAGRO_RADIUS) {
      mob.aggro = false;
      mob.aggroTarget = null;
      if (mob.type === "berserker") mob.state = "sleep";
    }
  }

  const tgt = players.find((p) => p.id === mob.aggroTarget && p.alive);

  if (mob.type === "wanderer") {
    updateWanderer(mob, tgt, dt);
  } else if (mob.type === "archer") {
    updateArcher(mob, tgt, projectiles, dt);
  } else if (mob.type === "berserker") {
    updateBerserker(mob, tgt, dt);
  }

  applyMobTouchDamage(mob, players, effects, dt);
}

function findAggroTarget(mob, players) {
  let best = null;
  let bestD = MOB_AGRO_RADIUS * MOB_AGRO_RADIUS;
  for (const p of players) {
    if (!p.alive) continue;
    const d = distSq(mob.x, mob.y, p.x, p.y);
    if (mob.aggro && p.id === mob.aggroTarget) return p;
    if (d <= bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function updateWanderer(mob, target, dt) {
  if (target) {
    moveMobToward(mob, target.x, target.y, mob.speed, dt);
  } else {
    mob.patrolAngle += dt * 0.8;
    const px = mob.spawnX + Math.cos(mob.patrolAngle) * 40;
    const py = mob.spawnY + Math.sin(mob.patrolAngle) * 40;
    moveMobToward(mob, px, py, mob.speed * 0.5, dt);
  }
}

function updateArcher(mob, target, projectiles, dt) {
  if (!target) return;

  const d = dist(mob.x, mob.y, target.x, target.y);
  if (d < ARCHER_FLEE_RADIUS) {
    const away = normalizeDir(mob.x - target.x, mob.y - target.y);
    moveMobDir(mob, away.x, away.y, mob.speed, dt);
  }

  mob.shootTimer -= dt;
  if (mob.shootTimer <= 0 && d > ARCHER_FLEE_RADIUS) {
    mob.shootTimer = ARCHER_SHOOT_INTERVAL;
    const dir = normalizeDir(target.x - mob.x, target.y - mob.y);
    projectiles.push(createProjectile(mob.x, mob.y, dir.x, dir.y, -1));
  }
}

function updateBerserker(mob, target, dt) {
  if (mob.state === "sleep") {
    if (target) mob.state = "charge";
    return;
  }
  if (target) {
    const speed = mob.baseSpeed * 2;
    moveMobToward(mob, target.x, target.y, speed, dt);
  }
}

function moveMobToward(mob, tx, ty, speed, dt) {
  const dir = normalizeDir(tx - mob.x, ty - mob.y);
  moveMobDir(mob, dir.x, dir.y, speed, dt);
}

function moveMobDir(mob, dx, dy, speed, dt) {
  const vx = dx * speed * dt;
  const vy = dy * speed * dt;
  const r = resolveCircleMovement(mob.x, mob.y, vx, vy, mob.radius);
  mob.x = r.x;
  mob.y = r.y;
}

function applyMobTouchDamage(mob, players, effects, dt) {
  if (!mob.aggro && mob.type !== "berserker") return;
  if (mob.type === "archer") return;
  for (const p of players) {
    if (!p.alive || p.invuln > 0) continue;
    if (dist(p.x, p.y, mob.x, mob.y) < mob.touchRadius + p.radius) {
      const tickDmg = Math.min(mob.damage * dt * 1.8, MAX_DAMAGE_PER_HIT * 0.35);
      playerTakeDamage(p, tickDmg, effects, mob.x, mob.y);
    }
  }
}

function mobTakeDamage(mob, amount, attacker, effects) {
  if (!mob.alive) return false;
  mob.hp -= amount;
  if (attacker) {
    attacker.damageThisRound += amount;
    if (effects) spawnDamageArrow(effects, mob.x, mob.y, attacker.x, attacker.y, amount, "deal");
  }
  if (mob.hp <= 0) {
    mob.alive = false;
    if (attacker) attacker.killsThisRound++;
    return true;
  }
  mob.aggro = true;
  if (attacker) mob.aggroTarget = attacker.id;
  if (mob.type === "berserker") mob.state = "charge";
  return false;
}

function drawMob(ctx, mob, fogMap) {
  if (!mob.alive) return;
  if (fogMap && !isWorldVisible(fogMap, mob.x, mob.y)) return;
  const sleeping = mob.type === "berserker" && mob.state === "sleep";

  ctx.fillStyle = sleeping ? "#555" : "#884444";
  ctx.beginPath();
  ctx.arc(mob.x, mob.y, mob.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "18px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(mob.emoji, mob.x, mob.y - 1);

  const barW = 28;
  const hpPct = mob.hp / mob.maxHp;
  ctx.fillStyle = "#222";
  ctx.fillRect(mob.x - barW / 2, mob.y - mob.radius - 10, barW, 4);
  ctx.fillStyle = "#e44";
  ctx.fillRect(mob.x - barW / 2, mob.y - mob.radius - 10, barW * hpPct, 4);
}
