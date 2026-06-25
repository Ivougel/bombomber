/** Отрисовка карты и сущностей */

function drawMap(ctx, map, camBounds) {
  const minCol = Math.max(0, Math.floor((-camBounds?.camX || 0) / TILE_SIZE) - 1);
  const maxCol = Math.min(MAP_W - 1, minCol + Math.ceil((camBounds?.worldW || WORLD_W) / TILE_SIZE) + 2);
  const minRow = Math.max(0, Math.floor((-camBounds?.camY || 0) / TILE_SIZE) - 1);
  const maxRow = Math.min(MAP_H - 1, minRow + Math.ceil((camBounds?.worldH || WORLD_H) / TILE_SIZE) + 2);

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const i = row * MAP_W + col;
      const tile = map.tiles[i];
      if (tile === TILE.VOID) continue;

      const biome = map.biomes[i] || BIOME.MINE;
      const colors = BIOME_COLORS[biome];
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;

      if (tile === TILE.FLOOR || tile === TILE.EXIT) {
        const alt = (col + row) % 2 === 0;
        ctx.fillStyle = tile === TILE.EXIT ? colors.exit : (alt ? colors.floor : colors.floorAlt);
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        if (tile === TILE.EXIT) {
          ctx.strokeStyle = "#aaffaa";
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
          ctx.font = "14px sans-serif";
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.fillText("🚪", x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 5);
        }
      } else if (tile === TILE.WALL) {
        ctx.fillStyle = colors.wall;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.fillRect(x, y + TILE_SIZE - 4, TILE_SIZE, 4);
      } else if (tile === TILE.COLUMN) {
        ctx.fillStyle = colors.floor;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = colors.column;
        ctx.fillRect(x + 8, y + 4, TILE_SIZE - 16, TILE_SIZE - 8);
      }
    }
  }
}

function drawPlayer(ctx, p) {
  if (!p.alive) return;

  if (p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + p.radius * 0.8, p.radius * 0.9, p.radius * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();

  const ax = p.x + p.aimDir.x * (p.radius + 8);
  const ay = p.y + p.aimDir.y * (p.radius + 8);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(ax, ay);
  ctx.stroke();

  const barW = 32;
  const hpPct = p.hp / p.maxHp;
  ctx.fillStyle = "#222";
  ctx.fillRect(p.x - barW / 2, p.y - p.radius - 12, barW, 5);
  ctx.fillStyle = hpPct > 0.3 ? "#4c4" : "#c44";
  ctx.fillRect(p.x - barW / 2, p.y - p.radius - 12, barW * hpPct, 5);

  if (!isSoloMode()) {
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(`P${p.id + 1}`, p.x, p.y + 4);
  }
  ctx.globalAlpha = 1;
}

function drawDropZones(ctx, mobs) {
  for (const mob of mobs) {
    if (mob.alive || !mob.dropZone) continue;
    const dz = mob.dropZone;
    ctx.strokeStyle = "rgba(255,215,0,0.35)";
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(dz.x - 14, dz.y - 14, 28, 28);
    ctx.setLineDash([]);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#ffd700";
    ctx.textAlign = "center";
    ctx.fillText("?", dz.x, dz.y + 4);
  }
}

function drawWorld(ctx, map, players, mobs, projectiles, bombs, effects, camera, pixelRatio, cssW, cssH) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#0a0a0c";
  ctx.fillRect(0, 0, cssW * pixelRatio, cssH * pixelRatio);

  ctx.save();
  const camBounds = applyWorldTransform(ctx, camera, pixelRatio);

  drawMap(ctx, map, camBounds);
  drawExplosions(ctx, effects);
  drawBombs(ctx, bombs);
  for (const mob of mobs) drawMob(ctx, mob);
  drawDropZones(ctx, mobs);

  for (const p of players) {
    const auraDef = p.loadout?.passive ? getItemDef(p.loadout.passive) : null;
    if (p.alive && auraDef) drawAuraZone(ctx, p, auraDef, effects);
  }

  for (const proj of projectiles) {
    if (proj.alive) drawProjectile(ctx, proj);
  }

  for (const p of players) {
    drawPlayerRespawnGhost(ctx, p);
    if (p.alive) {
      if (p.loadout?.passive) drawPlayerAuraGlow(ctx, p, effects);
      drawPlayer(ctx, p);
    }
  }

  drawDamageArrows(ctx, effects);
  ctx.restore();
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function updateHud(dom, match, roundState) {
  const { timerEl, scoreEl, roundEl, seedEl, phaseEl, hpEl } = dom;
  if (timerEl) timerEl.textContent = formatTime(roundState.timeLeft);
  if (roundEl) roundEl.textContent = `Раунд ${match.round} / ${MAX_ROUNDS}`;
  if (seedEl && roundState.map) seedEl.textContent = `Seed: ${roundState.map.seed}`;
  if (phaseEl) phaseEl.textContent = phaseLabel(match.phase);

  if (scoreEl) {
    if (isSoloMode()) {
      scoreEl.textContent = `Побед: ${match.roundWins} · Поражений: ${match.roundLosses}`;
    } else {
      scoreEl.textContent = `${match.scores[0]} : ${match.scores[1]}`;
    }
  }

  if (hpEl && roundState.players?.[0]) {
    const p = roundState.players[0];
    if (p.respawnTimer > 0) {
      hpEl.textContent = `💀 Респавн ${p.respawnTimer.toFixed(1)}с`;
    } else {
      hpEl.textContent = `❤️ ${Math.ceil(p.hp)} / ${p.maxHp}`;
    }
  }
}

function phaseLabel(phase) {
  const labels = {
    classSelect: "Выбор класса",
    shop: "Магазин",
    playing: "Бой",
    results: "Итоги раунда",
    intermission: "Перерыв",
    matchEnd: "Конец матча",
  };
  return labels[phase] || phase;
}

function showOverlay(id, visible) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle("hidden", !visible);
}

function renderResultsOverlay(match, roundState, stats) {
  const el = document.getElementById("results-content");
  if (!el) return;

  let title;
  if (isSoloMode()) {
    title = roundState.roundWon ? "Раунд пройден!" : "Раунд провален";
  } else {
    const winner = roundState.roundWinner;
    title = winner === 0 ? "Победил игрок 1" : winner === 1 ? "Победил игрок 2" : "Ничья!";
  }

  const stat = stats[0];
  el.innerHTML = `
    <h2>${title}</h2>
    ${isSoloMode()
      ? `<p class="results-score">Побед: ${match.roundWins} · Поражений: ${match.roundLosses}</p>`
      : `<p class="results-score">Счёт: ${match.scores[0]} : ${match.scores[1]}</p>`}
    <div class="results-stats ${isSoloMode() ? "solo" : ""}">
      <div><strong>${isSoloMode() ? "Статистика" : "Игрок 1"}</strong><br>
        Мобов: ${stat.kills} · Урон: ${Math.round(stat.damage)} · Предметов: ${stat.items}</div>
      ${isSoloMode() ? "" : `<div><strong>Игрок 2</strong><br>Мобов: ${stats[1].kills} · Урон: ${Math.round(stats[1].damage)} · Предметов: ${stats[1].items}</div>`}
    </div>
    <p class="results-seed">Seed: ${roundState.map?.seed ?? "—"}</p>
  `;
}

function renderIntermissionOverlay(match) {
  const el = document.getElementById("intermission-content");
  if (!el) return;
  el.innerHTML = match.players.map((p, i) => `
    <div class="backpack-panel">
      <h3>${isSoloMode() ? "Рюкзак" : `Игрок ${i + 1}`} — ${p.class}</h3>
      <p>💰 ${p.gold} · Предметов: ${p.backpack.length}</p>
      <ul class="backpack-list">${p.backpack.length
        ? p.backpack.map((item) => `<li>${item}</li>`).join("")
        : "<li class='empty'>Рюкзак пуст</li>"}</ul>
    </div>
  `).join("");
}

function renderMatchEndOverlay(match) {
  const el = document.getElementById("match-end-content");
  if (!el) return;

  let title;
  if (isSoloMode()) {
    title = match.roundWins >= 3 ? "Победа в матче!" : "Матч завершён";
  } else {
    title = match.matchWinner === 0 ? "Победитель: Игрок 1"
      : match.matchWinner === 1 ? "Победитель: Игрок 2" : "Ничья!";
  }

  el.innerHTML = `
    <h2>${title}</h2>
    <p class="results-score">${isSoloMode()
      ? `Побед: ${match.roundWins} из ${MAX_ROUNDS}`
      : `Финальный счёт: ${match.scores[0]} : ${match.scores[1]}`}</p>
    <div class="match-end-actions">
      <button type="button" class="btn" id="btn-rematch">Реванш</button>
      <button type="button" class="btn btn-secondary" id="btn-new-game">Новая игра</button>
    </div>
  `;
}

function renderClassSelect() {
  const el = document.getElementById("class-select-content");
  if (!el) return;

  if (isSoloMode()) {
    el.innerHTML = `
      <div class="class-cards solo">
        <div class="class-card" data-class="miner">
          <span class="class-emoji">⛏️</span>
          <strong>Шахтёр</strong>
          <span>Ближний бой · выносливость</span>
        </div>
        <div class="class-card" data-class="scout">
          <span class="class-emoji">🏹</span>
          <strong>Разведчик</strong>
          <span>Мобильность · дальний урон</span>
        </div>
      </div>
      <p class="class-hint">WASD — движение · мышь — прицел · Space — оружие · B — бомба</p>
      <button type="button" class="btn" id="btn-to-shop" disabled>В магазин →</button>
    `;
    return;
  }

  el.innerHTML = `
    <div class="class-cards">
      <div class="class-card" data-player="0" data-class="miner">
        <span class="class-emoji">⛏️</span>
        <strong>Шахтёр</strong>
        <span>Игрок 1 · WASD</span>
      </div>
      <div class="class-card" data-player="1" data-class="scout">
        <span class="class-emoji">🏹</span>
        <strong>Разведчик</strong>
        <span>Игрок 2 · Стрелки</span>
      </div>
    </div>
    <p class="class-hint">Выберите класс для каждого игрока</p>
    <button type="button" class="btn" id="btn-start-match" disabled>Начать матч</button>
  `;
}
