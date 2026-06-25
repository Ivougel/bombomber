/** Отрисовка карты и сущностей */

function drawWallHard(ctx, x, y) {
  ctx.fillStyle = "#4a4a4a";
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(x, y + TILE_SIZE - 4, TILE_SIZE, 4);
}

function drawWallSoft(ctx, x, y) {
  ctx.fillStyle = "#7a6a5a";
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1;
  const cracks = [
    [x + 6, y + 8, x + 18, y + 14],
    [x + 12, y + 20, x + 22, y + 26],
    [x + 4, y + 22, x + 14, y + 28],
  ];
  for (const [x1, y1, x2, y2] of cracks) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

function drawMap(ctx, map, camBounds, fogMap) {
  const minCol = Math.max(0, Math.floor((-camBounds?.camX || 0) / TILE_SIZE) - 1);
  const maxCol = Math.min(MAP_W - 1, minCol + Math.ceil((camBounds?.worldW || WORLD_W) / TILE_SIZE) + 2);
  const minRow = Math.max(0, Math.floor((-camBounds?.camY || 0) / TILE_SIZE) - 1);
  const maxRow = Math.min(MAP_H - 1, minRow + Math.ceil((camBounds?.worldH || WORLD_H) / TILE_SIZE) + 2);

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (fogMap && !isTileRevealed(fogMap, col, row)) continue;

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
      } else if (tile === TILE.WALL_HARD || tile === TILE.WALL) {
        drawWallHard(ctx, x, y);
      } else if (tile === TILE.WALL_SOFT) {
        drawWallSoft(ctx, x, y);
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

function drawDropZones(ctx, mobs, fogMap) {
  for (const mob of mobs) {
    if (mob.alive || !mob.dropZone) continue;
    const dz = mob.dropZone;
    if (fogMap && !isWorldVisible(fogMap, dz.x, dz.y)) continue;
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

function drawWorldScene(ctx, map, players, mobs, bots, projectiles, bombs, effects, fogState, camBounds) {
  const fogMap = fogState?.map ?? null;

  drawMap(ctx, map, camBounds, fogMap);
  drawExplosions(ctx, effects, fogMap);
  drawBombs(ctx, bombs, fogMap);
  for (const mob of mobs) drawMob(ctx, mob, fogMap);
  drawDropZones(ctx, mobs, fogMap);
  drawBotDropZones(ctx, bots, fogMap);

  for (const bot of bots || []) {
    const auraDef = bot.loadout?.passive ? getItemDef(bot.loadout.passive) : null;
    if (bot.alive && auraDef) drawAuraZone(ctx, bot, auraDef, effects);
  }

  for (const p of players) {
    const auraDef = p.loadout?.passive ? getItemDef(p.loadout.passive) : null;
    if (p.alive && auraDef) drawAuraZone(ctx, p, auraDef, effects);
  }

  for (const proj of projectiles) {
    if (proj.alive) drawProjectile(ctx, proj, fogMap);
  }

  for (const bot of bots || []) {
    if (bot.alive) drawBot(ctx, bot, fogMap);
  }

  for (const p of players) {
    drawPlayerRespawnGhost(ctx, p);
    if (p.alive) {
      if (p.loadout?.passive) drawPlayerAuraGlow(ctx, p, effects);
      drawPlayer(ctx, p);
    }
  }

  drawDamageArrows(ctx, effects, fogMap);
  drawFloatingTexts(ctx, effects, fogMap);
  renderFog(ctx, fogState);
}

function drawMagnifier(ctx, player, camera, pixelRatio, sceneArgs) {
  const screen = worldToScreen(camera, player.x, player.y);
  const cx = screen.x * pixelRatio;
  const cy = screen.y * pixelRatio;
  const radius = 220 * pixelRatio;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  const zoomScale = camera.scale * pixelRatio * 3;
  const offsetX = cx - player.x * zoomScale;
  const offsetY = cy - player.y * zoomScale;
  ctx.setTransform(zoomScale, 0, 0, zoomScale, offsetX, offsetY);

  const camBounds = { camX: 0, camY: 0, worldW: camera.mapPixelW, worldH: camera.mapPixelH };
  drawWorldScene(ctx, ...sceneArgs, camBounds);

  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = "#ffd56a";
  ctx.lineWidth = 3 * pixelRatio;
  ctx.shadowColor = "#ffd56a";
  ctx.shadowBlur = 12 * pixelRatio;
  ctx.stroke();
  ctx.restore();
}

function drawWorld(ctx, map, players, mobs, bots, projectiles, bombs, effects, fogState, camera, pixelRatio, cssW, cssH, zoomActive) {
  const sceneArgs = [map, players, mobs, bots, projectiles, bombs, effects, fogState];

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#0a0a0c";
  ctx.fillRect(0, 0, cssW * pixelRatio, cssH * pixelRatio);

  ctx.save();
  const camBounds = applyWorldTransform(ctx, camera, pixelRatio);
  drawWorldScene(ctx, ...sceneArgs, camBounds);
  ctx.restore();

  if (zoomActive && players[0]?.alive) {
    drawMagnifier(ctx, players[0], camera, pixelRatio, sceneArgs);
  }
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

  if (hpEl && roundState.players?.length) {
    const p = roundState.networkMode
      ? roundState.players[roundState.mySlot ?? 0]
      : roundState.players[0];
    if (!p) return;
    if (p.respawnTimer > 0) {
      hpEl.textContent = `💀 Респавн ${p.respawnTimer.toFixed(1)}с`;
    } else {
      let hpText = `❤️ ${Math.ceil(p.hp)} / ${p.maxHp}`;
      if (isVsBotsMode(match) && roundState.bots) {
        const aliveBots = roundState.bots.filter((b) => b.alive).length;
        hpText += ` · 🤖 ${aliveBots}`;
      }
      hpEl.textContent = hpText;
    }
  }

  if (scoreEl && roundState.networkMode) {
    scoreEl.textContent = "P1 vs P2 · Сеть";
  }
}

function phaseLabel(phase) {
  const labels = {
    classSelect: "Выбор режима",
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

function renderBackpackPanel(player, heading) {
  const title = heading || `Рюкзак — ${player.class}`;
  return `
    <div class="backpack-panel">
      <h3>${title}</h3>
      <p>💰 ${player.gold} · Предметов: ${player.backpack.length}</p>
      <ul class="backpack-list">${player.backpack.length
        ? player.backpack.map((item) => `<li>${item}</li>`).join("")
        : "<li class='empty'>Рюкзак пуст</li>"}</ul>
    </div>
  `;
}

function renderBackpackOverlay(player) {
  const el = document.getElementById("backpack-content");
  if (!el) return;
  el.innerHTML = `
    <h2>🎒 Рюкзак</h2>
    <p class="backpack-hint">Tab или Escape — закрыть</p>
    ${renderBackpackPanel(player)}
  `;
}

function renderIntermissionOverlay(match) {
  const el = document.getElementById("intermission-content");
  if (!el) return;
  el.innerHTML = match.players.map((p, i) =>
    renderBackpackPanel(p, isSoloMode() ? `Рюкзак — ${p.class}` : `Игрок ${i + 1} — ${p.class}`)
  ).join("");
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
      <button type="button" class="btn menu-focusable" id="btn-rematch">Реванш</button>
      <button type="button" class="btn btn-secondary menu-focusable" id="btn-new-game">Новая игра</button>
    </div>
  `;
}

function renderClassSelect(match) {
  const el = document.getElementById("class-select-content");
  if (!el) return;

  const mode = match?.matchMode || MATCH_MODE.SOLO;
  const selectedClass = classPick || match?.players?.[0]?.class;

  el.innerHTML = `
    <div class="mode-cards">
      <div class="mode-card menu-focusable ${mode === MATCH_MODE.SOLO ? "selected" : ""}" data-mode="solo">
        <span class="class-emoji">🗺️</span>
        <strong>Solo забег</strong>
        <span>Обычные мобы · магазин · 5 раундов</span>
      </div>
      <div class="mode-card menu-focusable ${mode === MATCH_MODE.VS_BOTS ? "selected" : ""}" data-mode="vs_bots">
        <span class="class-emoji">🤖</span>
        <strong>Против ботов</strong>
        <span>Боты с аурой, бластером и бомбами</span>
      </div>
    </div>

    <div class="class-cards solo">
      <div class="class-card menu-focusable ${match?.players?.[0]?.class === "miner" ? "selected" : ""}" data-class="miner">
        <span class="class-emoji">⛏️</span>
        <strong>Шахтёр</strong>
        <span>Ближний бой · выносливость</span>
      </div>
      <div class="class-card menu-focusable ${match?.players?.[0]?.class === "scout" ? "selected" : ""}" data-class="scout">
        <span class="class-emoji">🏹</span>
        <strong>Разведчик</strong>
        <span>Мобильность · дальний урон</span>
      </div>
    </div>
    <p class="class-hint">Стрелки / геймпад — навигация · A / Enter — выбор · WASD в бою · Q — лупа · Tab — рюкзак</p>
    <button type="button" class="btn menu-focusable" id="btn-to-shop" ${selectedClass ? "" : "disabled"}>В магазин →</button>

    <div class="network-section">
      <h3>🌐 Сетевая игра</h3>
      <div class="network-actions">
        <button type="button" class="btn menu-focusable" id="btn-create-room">Создать комнату</button>
        <div class="join-row">
          <input type="text" id="join-room-code" class="join-code-input menu-focusable" maxlength="6" placeholder="ABC123" autocomplete="off" />
          <button type="button" class="btn menu-focusable" id="btn-join-room">Войти по коду</button>
        </div>
      </div>
      <p class="network-hint" id="network-status"></p>
    </div>
  `;
}

function renderNetworkWaiting(code, message) {
  const codeEl = document.getElementById("room-code-display");
  const msgEl = document.getElementById("network-wait-msg");
  if (codeEl) codeEl.textContent = code || "------";
  if (msgEl) msgEl.textContent = message || "Ждём второго игрока...";
}

function renderNetworkShopFooter(lobby, mySlot) {
  const el = document.getElementById("shop-network-footer");
  if (!el) return;
  const lines = (lobby || []).map((p) => {
    const label = p.slot === mySlot ? "Вы" : `Игрок ${p.slot + 1}`;
    return `${label}: ${p.ready ? "✅ Готов" : "⏳ Не готов"}`;
  }).join(" · ");
  el.innerHTML = `
    <p class="network-ready-status">${lines}</p>
    <button type="button" class="btn menu-focusable" id="btn-network-ready">Готов к бою</button>
  `;
}
