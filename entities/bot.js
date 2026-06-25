/** Боты-противники с loadout как у игрока */

let botIdCounter = 100;

function createBotLoadout() {
  return copyLoadout({
    passive: "aura_ring",
    weapon: "blaster",
    hasBombs: true,
  });
}

function createBotEntity(x, y) {
  return {
    id: botIdCounter++,
    isBot: true,
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
    aimDir: { x: -1, y: 0 },
    loadout: createBotLoadout(),
    weaponCooldown: 0,
    bombCooldown: 2.5,
    auraTimer: 0,
    auraActive: false,
    invuln: 0,
    alive: true,
    color: "#e85d7a",
    emoji: "🤖",
    gold: 12,
    dropZone: null,
  };
}

function spawnBots(map, count, rng) {
  const bots = [];
  const rooms = [...map.mobRooms];
  shuffleArray(rooms, rng);

  for (let i = 0; i < count && rooms.length; i++) {
    const room = rooms[i % rooms.length];
    const pos = randomFloorInRoom(map, room, rng);
    if (!pos) continue;
    const bot = createBotEntity(pos.x, pos.y);
    bot.dropZone = { x: pos.x, y: pos.y, item: rollDrop(rng) };
    bots.push(bot);
  }
  return bots;
}

function updateBots(bots, players, projectiles, bombs, map, dt, effects, onBotKilled) {
  const target = players.find((p) => p.alive && !p.isBot);
  for (const bot of bots) {
    if (!bot.alive) continue;
    updateBotEntity(bot, target, projectiles, bombs, map, dt, effects);
    updateBotAura(bot, players, dt, effects);
  }
}

function updateBotEntity(bot, target, projectiles, bombs, map, dt, effects) {
  if (!target) return;
  if (bot.weaponCooldown > 0) bot.weaponCooldown -= dt;
  if (bot.bombCooldown > 0) bot.bombCooldown -= dt;

  const d = dist(bot.x, bot.y, target.x, target.y);
  const dir = normalizeDir(target.x - bot.x, target.y - bot.y);
  bot.aimDir = dir.x || dir.y ? dir : bot.aimDir;

  const chaseSpeed = d > 140 ? bot.baseSpeed * 1.35 : bot.baseSpeed * 0.75;
  if (d > 70) {
    const vx = dir.x * chaseSpeed * dt;
    const vy = dir.y * chaseSpeed * dt;
    const resolved = resolveCircleMovement(bot.x, bot.y, vx, vy, bot.radius);
    bot.x = resolved.x;
    bot.y = resolved.y;
  }

  if (bot.loadout.weapon && bot.weaponCooldown <= 0 && d < 420 && d > 55) {
    tryFireWeapon(bot, projectiles, dir);
  }

  if (bot.loadout.hasBombs && bot.bombCooldown <= 0 && d < 160 && d > 48) {
    const detDef = getItemDef("detonator");
    if (tryPlaceBomb(bot, bombs, map, detDef.fuseTime)) {
      bot.bombCooldown = 5;
    }
  }
}

function updateBotAura(bot, players, dt, effects) {
  bot.auraActive = false;
  if (!bot.alive || !bot.loadout.passive) return;

  const def = getItemDef(bot.loadout.passive);
  if (!def) return;

  bot.auraActive = true;
  bot.auraTimer -= dt;
  if (bot.auraTimer > 0) return;

  bot.auraTimer = def.auraTick;
  pulseAura(effects);

  for (const pl of players) {
    if (!pl.alive || pl.isBot || pl.invuln > 0) continue;
    if (dist(pl.x, pl.y, bot.x, bot.y) <= def.auraRadius + pl.radius) {
      playerTakeDamage(pl, def.auraDamage, effects, bot.x, bot.y);
    }
  }
}

function botTakeDamage(bot, amount, attacker, effects) {
  if (!bot.alive) return false;
  const dmg = Math.min(amount, MAX_DAMAGE_PER_HIT);
  bot.hp = Math.max(0, bot.hp - dmg);

  if (effects && attacker) {
    spawnDamageArrow(effects, bot.x, bot.y, attacker.x, attacker.y, dmg, "deal");
  }

  if (bot.hp <= 0) {
    bot.alive = false;
    if (attacker) attacker.killsThisRound++;
    return true;
  }
  return false;
}

function drawBot(ctx, bot, fogMap) {
  if (!bot.alive) return;
  if (fogMap && !isWorldVisible(fogMap, bot.x, bot.y)) return;

  const auraDef = bot.loadout?.passive ? getItemDef(bot.loadout.passive) : null;
  if (auraDef) drawAuraZone(ctx, bot, auraDef, { auraPulse: 0 });

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(bot.x, bot.y + bot.radius * 0.8, bot.radius * 0.9, bot.radius * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = bot.color;
  ctx.beginPath();
  ctx.arc(bot.x, bot.y, bot.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffb3c6";
  ctx.lineWidth = 2;
  ctx.stroke();

  const ax = bot.x + bot.aimDir.x * (bot.radius + 8);
  const ay = bot.y + bot.aimDir.y * (bot.radius + 8);
  ctx.strokeStyle = "rgba(255,180,200,0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bot.x, bot.y);
  ctx.lineTo(ax, ay);
  ctx.stroke();

  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(bot.emoji, bot.x, bot.y - 1);

  const barW = 32;
  const hpPct = bot.hp / bot.maxHp;
  ctx.fillStyle = "#222";
  ctx.fillRect(bot.x - barW / 2, bot.y - bot.radius - 12, barW, 5);
  ctx.fillStyle = hpPct > 0.3 ? "#e44" : "#a22";
  ctx.fillRect(bot.x - barW / 2, bot.y - bot.radius - 12, barW * hpPct, 5);
}

function drawBotDropZones(ctx, bots, fogMap) {
  for (const bot of bots) {
    if (bot.alive || !bot.dropZone) continue;
    const dz = bot.dropZone;
    if (fogMap && !isWorldVisible(fogMap, dz.x, dz.y)) continue;
    ctx.strokeStyle = "rgba(255,100,120,0.4)";
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(dz.x - 14, dz.y - 14, 28, 28);
    ctx.setLineDash([]);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#ff8899";
    ctx.textAlign = "center";
    ctx.fillText("🤖", dz.x, dz.y + 4);
  }
}

function resetBotIdCounter() {
  botIdCounter = 100;
}
