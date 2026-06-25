/** Визуальные эффекты: стрелки урона, вспышки ауры */

function createEffectsState() {
  return { damageArrows: [], explosions: [], auraPulse: 0 };
}

function spawnDamageArrow(effects, targetX, targetY, sourceX, sourceY, amount, type) {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const dir = normalizeDir(dx, dy);
  effects.damageArrows.push({
    x: targetX,
    y: targetY,
    dirX: dir.x,
    dirY: dir.y,
    amount: Math.round(amount),
    type,
    life: 0.85,
    maxLife: 0.85,
  });
}

function spawnExplosion(effects, tiles, damage, owner) {
  effects.explosions.push({
    tiles: tiles.map((t) => ({ ...t })),
    life: 0.55,
    maxLife: 0.55,
    damage,
    owner,
    hitMobs: new Set(),
  });
}

function pulseAura(effects) {
  effects.auraPulse = 1;
}

function updateEffects(effects, dt) {
  if (effects.auraPulse > 0) effects.auraPulse = Math.max(0, effects.auraPulse - dt * 3);

  for (const a of effects.damageArrows) a.life -= dt;
  effects.damageArrows = effects.damageArrows.filter((a) => a.life > 0);

  for (const ex of effects.explosions) ex.life -= dt;
  effects.explosions = effects.explosions.filter((ex) => ex.life > 0);
}

function drawDamageArrows(ctx, effects) {
  for (const a of effects.damageArrows) {
    const t = 1 - a.life / a.maxLife;
    const alpha = 1 - t;
    const len = 22 + t * 14;
    const tx = a.x - a.dirX * len;
    const ty = a.y - a.dirY * len;

    const color = a.type === "deal" ? `rgba(255,210,80,${alpha})` : `rgba(255,90,90,${alpha})`;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(a.x, a.y);
    ctx.stroke();

    const ax = a.x - a.dirX * 8;
    const ay = a.y - a.dirY * 8;
    const px = -a.dirY;
    const py = a.dirX;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(ax + px * 5, ay + py * 5);
    ctx.lineTo(ax - px * 5, ay - py * 5);
    ctx.closePath();
    ctx.fill();

    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`-${a.amount}`, a.x + px * 10, a.y + py * 10 - 6);
  }
}

function drawAuraZone(ctx, player, itemDef, effects) {
  if (!itemDef || !player.alive) return;
  const r = itemDef.auraRadius;
  const pulse = 0.15 + (effects.auraPulse || 0) * 0.35;

  ctx.save();
  ctx.beginPath();
  ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(120,180,255,${0.08 + pulse * 0.12})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(140,200,255,${0.35 + pulse * 0.4})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawPlayerAuraGlow(ctx, player, effects) {
  if (!player.auraActive || !player.alive) return;
  const glow = 0.4 + (effects.auraPulse || 0) * 0.5;
  ctx.save();
  ctx.shadowColor = "#7ec8ff";
  ctx.shadowBlur = 18 + glow * 12;
  ctx.fillStyle = `rgba(126,200,255,${0.25 + glow * 0.2})`;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawExplosions(ctx, effects) {
  for (const ex of effects.explosions) {
    const alpha = ex.life / ex.maxLife;
    for (const tile of ex.tiles) {
      const x = tile.col * TILE_SIZE;
      const y = tile.row * TILE_SIZE;
      ctx.fillStyle = `rgba(255,140,40,${alpha * 0.75})`;
      ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.strokeStyle = `rgba(255,220,100,${alpha})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    }
  }
}
