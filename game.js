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
  recalcCamera(camera, viewW, viewH);
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

  camera.viewport.leadX = players[0].x;
  camera.viewport.leadY = players[0].y;

  const rng = createRng(seed);
  const mobs = spawnMobs(map, getRoundBudget(match.round), rng);

  roundState = {
    map,
    players,
    mobs,
    projectiles: [],
    bombs: [],
    effects: createEffectsState(),
    timeLeft: ROUND_DURATION,
    resultsTimer: 0,
    intermissionTimer: 0,
    roundWon: false,
    stats: [{ kills: 0, damage: 0, items: 0 }],
  };

  match.phase = "playing";
  showOverlay("results-overlay", false);
  showOverlay("intermission-overlay", false);
  mobIdCounter = 0;
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

function onMobKilled(player, mob) {
  if (mob.dropZone) collectDrop(player, mob);
}

function updatePlaying(dt) {
  const { players, mobs, projectiles, bombs, effects, map } = roundState;
  roundState.timeLeft -= dt;

  const p = players[0];
  const inp = input.getPlayer(0);
  updatePlayerEntity(p, dt, inp, camera);

  updatePlayerAura(p, mobs, dt, effects, onMobKilled);

  if (inp.consumeAttack()) tryFireWeapon(p, projectiles);

  if (inp.consumeBomb() && p.loadout.bombs > 0) {
    const bombDef = getItemDef("bomb");
    tryPlaceBomb(p, bombs, map, bombDef.fuseTime);
  }

  updateMobs(mobs, players, projectiles, dt, effects);

  for (const proj of projectiles) {
    updateProjectile(proj, dt, players, mobs, effects, onMobKilled);
  }
  roundState.projectiles = projectiles.filter((pr) => pr.alive);

  const bombDef = getItemDef("bomb");
  roundState.bombs = updateBombs(
    bombs, map, mobs, players, effects,
    bombDef?.blastRange || 5,
    bombDef?.damage || 40,
    dt,
    onMobKilled,
  );

  updateEffects(effects, dt);
  updateCameras(camera, players, dt, viewW, viewH);
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

  drawWorld(
    ctx,
    roundState.map,
    roundState.players,
    roundState.mobs,
    roundState.projectiles,
    roundState.bombs,
    roundState.effects,
    camera,
    camera.pixelRatio,
    viewW,
    viewH,
  );
}

init();
