/** Игрок в мире */

function createPlayerEntity(state, x, y) {
  const loadout = copyLoadout(state.loadout || createEmptyLoadout());
  return {
    id: state.id,
    x,
    y,
    spawnX: x,
    spawnY: y,
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    baseSpeed: PLAYER_BASE_SPEED,
    speed: PLAYER_BASE_SPEED,
    radius: PLAYER_RADIUS,
    moveDir: { x: 0, y: 0 },
    aimDir: { x: 1, y: 0 },
    loadout,
    weaponCooldown: 0,
    auraTimer: 0,
    auraActive: false,
    invuln: 0,
    respawnTimer: 0,
    alive: true,
    class: state.class,
    color: PLAYER_COLORS[state.id],
    killsThisRound: 0,
    damageThisRound: 0,
    itemsThisRound: 0,
  };
}

function updatePlayerEntity(p, dt, input, camera) {
  if (p.respawnTimer > 0) {
    p.respawnTimer -= dt;
    if (p.respawnTimer <= 0) {
      p.alive = true;
      p.hp = p.maxHp;
      p.x = p.spawnX;
      p.y = p.spawnY;
      p.invuln = PLAYER_INVULN_TIME;
    }
    return;
  }
  if (!p.alive) return;

  if (p.invuln > 0) p.invuln -= dt;
  if (p.weaponCooldown > 0) p.weaponCooldown -= dt;

  const dir = input.getMoveDir();
  p.moveDir = dir;
  const aim = input.getAimDir();
  if (aim.x !== 0 || aim.y !== 0) {
    p.aimDir = aim;
  } else {
    const fire = input.getFireDir();
    if (fire.x !== 0 || fire.y !== 0) p.aimDir = { ...fire };
    else if (dir.x !== 0 || dir.y !== 0) p.aimDir = { ...dir };
  }

  const speed = input.isSprintHeld() ? p.baseSpeed * 1.8 : p.baseSpeed;
  p.speed = speed;
  const vx = dir.x * speed * dt;
  const vy = dir.y * speed * dt;
  const resolved = resolveCircleMovement(p.x, p.y, vx, vy, p.radius);
  p.x = resolved.x;
  p.y = resolved.y;
}

function playerTakeDamage(p, amount, effects, sourceX, sourceY) {
  if (!p.alive || p.invuln > 0 || p.respawnTimer > 0) return 0;
  const dmg = Math.min(amount, MAX_DAMAGE_PER_HIT);
  p.hp = Math.max(0, p.hp - dmg);

  if (effects && sourceX != null) {
    spawnDamageArrow(effects, p.x, p.y, sourceX, sourceY, dmg, "take");
  }

  if (p.hp <= 0) {
    p.alive = false;
    p.respawnTimer = PLAYER_RESPAWN_TIME;
  }
  return dmg;
}

function updatePlayerAura(p, mobs, dt, effects, onMobKilled, bots, onBotKilled) {
  p.auraActive = false;
  if (!p.alive || !p.loadout.passive) return;

  const def = getItemDef(p.loadout.passive);
  if (!def) return;

  p.auraActive = true;
  p.auraTimer -= dt;
  if (p.auraTimer > 0) return;

  p.auraTimer = def.auraTick;
  pulseAura(effects);

  for (const mob of mobs) {
    if (!mob.alive) continue;
    if (dist(p.x, p.y, mob.x, mob.y) <= def.auraRadius + mob.radius) {
      const killed = mobTakeDamage(mob, def.auraDamage, p, effects);
      if (killed && onMobKilled) onMobKilled(p, mob);
    }
  }

  for (const bot of bots || []) {
    if (!bot.alive) continue;
    if (dist(p.x, p.y, bot.x, bot.y) <= def.auraRadius + bot.radius) {
      const killed = botTakeDamage(bot, def.auraDamage, p, effects);
      if (killed && onBotKilled) onBotKilled(p, bot);
    }
  }
}

function tryFireWeapon(p, projectiles, fireDir) {
  if (!p.alive || !p.loadout.weapon || p.weaponCooldown > 0) return false;
  if (!fireDir || (fireDir.x === 0 && fireDir.y === 0)) return false;

  const def = getItemDef(p.loadout.weapon);
  if (!def) return false;

  projectiles.push(createPlayerProjectile(p.x, p.y, fireDir.x, fireDir.y, p.id, def));
  p.weaponCooldown = def.cooldown;
  return true;
}

function syncPlayerFromEntity(statePlayer, entity) {
  statePlayer.hp = entity.hp;
  statePlayer.maxHp = entity.maxHp;
  statePlayer.loadout = copyLoadout(entity.loadout);
}

function drawPlayerRespawnGhost(ctx, p) {
  if (p.respawnTimer <= 0) return;
  ctx.globalAlpha = 0.35 + Math.sin(p.respawnTimer * 6) * 0.15;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.spawnX, p.spawnY, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
