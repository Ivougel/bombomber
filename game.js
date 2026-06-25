/**
 * Mine Ruins Duel — solo fullscreen, магазин, предметы
 */

let canvas, ctx;
let match = createGameState();
let roundState = null;
let camera = createCameraSystem();
let input = null;
let lastTs = 0;
let classPick = null;
let shopContext = "pregame";

const hud = {};
let viewW = 0;
let viewH = 0;

function init() {
  canvas = document.getElementById("game-canvas");
  ctx = canvas.getContext("2d");
  input = createInputSystem();

  hud.timerEl = document.getElementById("hud-timer");
  hud.scoreEl = document.getElementById("hud-score");
  hud.roundEl = document.getElementById("hud-round");
  hud.seedEl = document.getElementById("hud-seed");
  hud.phaseEl = document.getElementById("hud-phase");
  hud.hpEl = document.getElementById("hud-hp");
  hud.intermissionTimer = document.getElementById("intermission-timer");

  resize();
  window.addEventListener("resize", resize);

  renderClassSelect();
  bindClassSelect();
  bindShopEvents(onShopBuy, onShopStart);
  bindMatchEndButtons();

  match.phase = "classSelect";
  showOverlay("class-overlay", true);
  requestAnimationFrame(gameLoop);
}

function resize() {
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(viewW * dpr);
  canvas.height = Math.floor(viewH * dpr);
  canvas.style.width = `${viewW}px`;
  canvas.style.height = `${viewH}px`;
  recalcCamera(camera, viewW, viewH, WORLD_W, WORLD_H);
}

function bindClassSelect() {
  document.getElementById("class-select-content")?.addEventListener("click", (e) => {
    const card = e.target.closest(".class-card");
    if (card?.dataset.class) {
      classPick = card.dataset.class;
      match.players[0].class = classPick;
      document.querySelectorAll(".class-card").forEach((c) => {
        c.classList.toggle("selected", c.dataset.class === classPick);
      });
      const btn = document.getElementById("btn-to-shop");
      if (btn) btn.disabled = !classPick;
      return;
    }
    if (e.target.id === "btn-to-shop") openPregameShop();
  });
}

function openPregameShop() {
  shopContext = "pregame";
  match.phase = "shop";
  showOverlay("class-overlay", false);
  openShopOverlay(match.players[0], { title: "🛒 Магазин перед забегом", startLabel: "В бой!" });
}

function onShopBuy(itemId) {
  const player = match.players[0];
  if (tryBuyItem(player, itemId)) {
    renderShopOverlay(player, shopContext === "pregame"
      ? { title: "🛒 Магазин перед забегом", startLabel: "В бой!" }
      : { title: "🛒 Магазин между раундами", startLabel: "Продолжить" });
  }
}

function onShopStart() {
  closeShopOverlay();
  if (shopContext === "pregame") {
    startMatch();
  } else {
    showOverlay("intermission-overlay", false);
    match.round++;
    startRound();
  }
}

function bindMatchEndButtons() {
  document.getElementById("match-end-overlay")?.addEventListener("click", (e) => {
    if (e.target.id === "btn-rematch") rematch();
    else if (e.target.id === "btn-new-game") newGame();
  });
}

function startMatch() {
  match.round = 1;
  match.roundWins = 0;
  match.roundLosses = 0;
  match.scores = [0];
  match.matchOver = false;
  match.matchWinner = null;
  startRound();
}

function rematch() {
  match = createGameState();
  if (classPick) match.players[0].class = classPick;
  showOverlay("match-end-overlay", false);
  openPregameShop();
}

function newGame() {
  match = createGameState();
  classPick = null;
  showOverlay("match-end-overlay", false);
  renderClassSelect();
  bindClassSelect();
  match.phase = "classSelect";
  showOverlay("class-overlay", true);
}

function startRound() {
  const seed = randomSeed();
  const map = generateMap(seed);
  setCollisionMap(map);
  resetPlayerHp(match);

  const statePlayer = match.players[0];
  const players = [createPlayerEntity(statePlayer, map.spawnP1.x, map.spawnP1.y)];

  recalcCamera(camera, viewW, viewH, WORLD_W, WORLD_H);

  const rng = createRng(seed);
  const mobs = spawnMobs(map, getRoundBudget(match.round), rng);

  roundState = {
    map,
    players,
    mobs,
    projectiles: [],
    bombs: [],
    effects: createEffectsState(),
    fogState: createFogState(map.fogMap),
    timeLeft: ROUND_DURATION,
    resultsTimer: 0,
    intermissionTimer: 0,
    roundWon: false,
    stats: [{ kills: 0, damage: 0, items: 0 }],
    inventoryOpen: false,
    paused: false,
  };

  match.phase = "playing";
  showOverlay("results-overlay", false);
  showOverlay("intermission-overlay", false);
  input.getPlayer(0).resetZoom();
  mobIdCounter = 0;

  updateFog(roundState.fogState, players[0], map);
  markFogDirty(roundState.fogState);
}

function gameLoop(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

function update(dt) {
  if (!roundState) return;

  if (match.phase === "playing") {
    updatePlaying(dt);
  } else if (match.phase === "results") {
    roundState.resultsTimer -= dt;
    if (roundState.resultsTimer <= 0) beginIntermission();
  } else if (match.phase === "intermission") {
    roundState.intermissionTimer -= dt;
    if (hud.intermissionTimer) {
      hud.intermissionTimer.textContent = `${Math.ceil(roundState.intermissionTimer)}`;
    }
    if (roundState.intermissionTimer <= 0) openIntermissionShop();
  }

  if (match.phase === "playing") updateHud(hud, match, roundState);
}

function toggleInventory() {
  if (!roundState) return;
  roundState.inventoryOpen = !roundState.inventoryOpen;
  roundState.paused = roundState.inventoryOpen;
  if (roundState.inventoryOpen) {
    renderBackpackOverlay(match.players[0]);
    showOverlay("backpack-overlay", true);
  } else {
    showOverlay("backpack-overlay", false);
  }
}

function closeInventory() {
  if (!roundState?.inventoryOpen) return;
  roundState.inventoryOpen = false;
  roundState.paused = false;
  showOverlay("backpack-overlay", false);
}

function onMobKilled(player, mob) {
  if (mob.dropZone) collectDrop(player, mob);
}

function updatePlaying(dt) {
  const { players, mobs, projectiles, bombs, effects, map } = roundState;

  const p = players[0];
  const inp = input.getPlayer(0);
  inp.refresh({ x: p.x, y: p.y }, camera);

  if (inp.consumeBackpack()) toggleInventory();
  if (inp.consumeCancel() && roundState.inventoryOpen) closeInventory();
  inp.consumeZoomToggle();

  if (roundState.paused) {
    updateEffects(effects, dt);
    return;
  }

  roundState.timeLeft -= dt;

  updatePlayerEntity(p, dt, inp, camera);

  updatePlayerAura(p, mobs, dt, effects, onMobKilled);

  const fireDir = inp.getFireDir();
  if (inp.consumeShoot()) tryFireWeapon(p, projectiles, fireDir);

  if (inp.consumeBomb()) {
    if (p.loadout.hasBombs) {
      const detDef = getItemDef("detonator");
      tryPlaceBomb(p, bombs, map, detDef.fuseTime);
    } else {
      spawnFloatingText(effects, p.x, p.y - 24, "Нужен детонатор", 1.5);
    }
  }

  updateMobs(mobs, players, projectiles, dt, effects);

  for (const proj of projectiles) {
    updateProjectile(proj, dt, players, mobs, effects, onMobKilled);
  }
  roundState.projectiles = projectiles.filter((pr) => pr.alive);

  const detDef = getItemDef("detonator");
  roundState.bombs = updateBombs(
    bombs, map, mobs, players, effects,
    detDef?.blastRange || 5,
    detDef?.damage || 40,
    dt,
    onMobKilled,
  );

  updateEffects(effects, dt);
  updateFog(roundState.fogState, p, map);
  checkRoundEnd();
}

function collectDrop(player, mob) {
  if (!mob.dropZone?.item) return;
  const state = match.players[player.id];
  state.backpack.push(mob.dropZone.item);
  state.gold += mob.gold || 0;
  state.itemsCollected++;
  player.itemsThisRound++;
  mob.dropZone = null;
}

function checkRoundEnd() {
  if (roundState.timeLeft <= 0) endRound(true);
}

function endRound(won) {
  roundState.roundWon = won;
  if (won) match.roundWins++;
  else match.roundLosses++;

  roundState.stats = roundState.players.map((p) => ({
    kills: p.killsThisRound,
    damage: p.damageThisRound,
    items: p.itemsThisRound,
  }));

  syncPlayerFromEntity(match.players[0], roundState.players[0]);
  match.players[0].kills += roundState.stats[0].kills;
  match.players[0].damageDealt += roundState.stats[0].damage;

  match.phase = "results";
  roundState.resultsTimer = RESULTS_DURATION;
  renderResultsOverlay(match, roundState, roundState.stats);
  showOverlay("results-overlay", true);

  if (match.round >= MAX_ROUNDS) finishMatch(won ? 0 : null);
}

function beginIntermission() {
  if (match.matchOver) return;
  match.phase = "intermission";
  roundState.intermissionTimer = INTERMISSION_DURATION;
  renderIntermissionOverlay(match);
  showOverlay("results-overlay", false);
  showOverlay("intermission-overlay", true);
}

function openIntermissionShop() {
  shopContext = "intermission";
  match.phase = "shop";
  showOverlay("intermission-overlay", false);
  openShopOverlay(match.players[0], {
    title: "🛒 Магазин между раундами",
    startLabel: "Следующий раунд →",
  });
}

function finishMatch(winner) {
  match.matchOver = true;
  match.matchWinner = winner;
  match.phase = "matchEnd";
  showOverlay("intermission-overlay", false);
  closeShopOverlay();
  renderMatchEndOverlay(match);
  showOverlay("match-end-overlay", true);
}

function draw() {
  const menuPhase = match.phase === "classSelect" || match.phase === "shop";
  if (!roundState || menuPhase) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#0a0a0c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const p = roundState.players[0];
  input.getPlayer(0).refresh({ x: p.x, y: p.y }, camera);
  const zoomActive = match.phase === "playing" && input.getPlayer(0).isZoomActive();

  drawWorld(
    ctx,
    roundState.map,
    roundState.players,
    roundState.mobs,
    roundState.projectiles,
    roundState.bombs,
    roundState.effects,
    roundState.fogState,
    camera,
    camera.pixelRatio,
    viewW,
    viewH,
    zoomActive,
  );
}

init();
