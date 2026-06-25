/** Снаряды: мобы, игрок и боты */

function createProjectile(x, y, dirX, dirY, ownerId) {
  const n = normalizeDir(dirX, dirY);
  return {
    x,
    y,
    vx: n.x * PROJECTILE_SPEED,
    vy: n.y * PROJECTILE_SPEED,
    radius: 5,
    ownerId,
    damage: PROJECTILE_DAMAGE,
    fromMob: true,
    alive: true,
    life: 3,
  };
}

function createPlayerProjectile(x, y, dirX, dirY, ownerId, weaponDef) {
  const n = normalizeDir(dirX, dirY);
  return {
    x,
    y,
    vx: n.x * weaponDef.speed,
    vy: n.y * weaponDef.speed,
    radius: weaponDef.radius || 6,
    ownerId,
    damage: weaponDef.damage,
    fromMob: false,
    alive: true,
    life: 2.5,
  };
}

function isBotOwner(ownerId, bots) {
  return (bots || []).some((b) => b.id === ownerId);
}

function updateProjectile(proj, dt, players, mobs, bots, effects, onMobKilled, onBotKilled) {
  if (!proj.alive) return;
  proj.life -= dt;
  if (proj.life <= 0) {
    proj.alive = false;
    return;
  }

  const nx = proj.x + proj.vx * dt;
  const ny = proj.y + proj.vy * dt;
  const resolved = resolveCircleMovement(proj.x, proj.y, nx - proj.x, ny - proj.y, proj.radius);
  proj.x = resolved.x;
  proj.y = resolved.y;

  const col = Math.floor(proj.x / TILE_SIZE);
  const row = Math.floor(proj.y / TILE_SIZE);
  const tile = mapRef ? tileAt(mapRef, col, row) : TILE.FLOOR;
  if (isSolidTile(tile)) {
    proj.alive = false;
    return;
  }

  const ownerIsBot = isBotOwner(proj.ownerId, bots);

  if (ownerIsBot) {
    for (const pl of players) {
      if (!pl.alive || pl.isBot || pl.invuln > 0) continue;
      if (distSq(proj.x, proj.y, pl.x, pl.y) < (proj.radius + pl.radius) ** 2) {
        playerTakeDamage(pl, proj.damage, effects, proj.x, proj.y);
        proj.alive = false;
        return;
      }
    }
    return;
  }

  if (proj.fromMob) {
    for (const pl of players) {
      if (!pl.alive || pl.invuln > 0) continue;
      if (distSq(proj.x, proj.y, pl.x, pl.y) < (proj.radius + pl.radius) ** 2) {
        playerTakeDamage(pl, proj.damage, effects, proj.x, proj.y);
        proj.alive = false;
        return;
      }
    }
    return;
  }

  const attacker = players.find((pl) => pl.id === proj.ownerId);

  for (const bot of bots || []) {
    if (!bot.alive) continue;
    if (distSq(proj.x, proj.y, bot.x, bot.y) < (proj.radius + bot.radius) ** 2) {
      const killed = botTakeDamage(bot, proj.damage, attacker, effects);
      proj.alive = false;
      if (killed && onBotKilled) onBotKilled(attacker, bot);
      return;
    }
  }

  for (const mob of mobs) {
    if (!mob.alive) continue;
    if (distSq(proj.x, proj.y, mob.x, mob.y) < (proj.radius + mob.radius) ** 2) {
      const killed = mobTakeDamage(mob, proj.damage, attacker, effects);
      proj.alive = false;
      if (killed && onMobKilled) onMobKilled(attacker, mob);
      return;
    }
  }
}

function drawProjectile(ctx, proj, fogMap) {
  if (fogMap && !isWorldVisible(fogMap, proj.x, proj.y)) return;
  if (proj.fromMob) {
    ctx.fillStyle = "#ffdd44";
  } else {
    ctx.fillStyle = "#66ccff";
    ctx.shadowColor = "#66ccff";
    ctx.shadowBlur = 8;
  }
  ctx.beginPath();
  ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}
