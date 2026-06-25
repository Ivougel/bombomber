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

let menuNav = null;
let network = null;
let networkMode = false;

function init() {
  canvas = document.getElementById("game-canvas");
  ctx = canvas.getContext("2d");
  input = createInputSystem();
  menuNav = createMenuNav();
  network = createNetwork();
  initNetwork();

  hud.timerEl = document.getElementById("hud-timer");
  hud.scoreEl = document.getElementById("hud-score");
  hud.roundEl = document.getElementById("hud-round");
  hud.seedEl = document.getElementById("hud-seed");
  hud.phaseEl = document.getElementById("hud-phase");
  hud.hpEl = document.getElementById("hud-hp");
  hud.intermissionTimer = document.getElementById("intermission-timer");

  resize();
  window.addEventListener("resize", resize);
  window.visualViewport?.addEventListener("resize", resize);
  window.visualViewport?.addEventListener("scroll", resize);

  renderClassSelect(match);
  bindClassSelect();
  bindShopEvents(onShopBuy, onShopStart);
  bindMatchEndButtons();
  menuNav.reset();

  match.phase = "classSelect";
  showOverlay("class-overlay", true);
  requestAnimationFrame(gameLoop);
}

function getViewportSize() {
  const vv = window.visualViewport;
  return {
    w: Math.round(vv?.width ?? window.innerWidth),
    h: Math.round(vv?.height ?? window.innerHeight),
  };
}

function resize() {
  const { w, h } = getViewportSize();
  viewW = w;
  viewH = h;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  recalcCamera(camera, w, h, WORLD_W, WORLD_H);
}

function initNetwork() {
  document.getElementById("class-select-content")?.addEventListener("click", (e) => {
    if (e.target.id === "btn-create-room") {
      network.createRoom();
      showOverlay("class-overlay", false);
      showOverlay("network-wait-overlay", true);
      renderNetworkWaiting("...", "Подключаемся к серверу…", { phase: "waiting" });
      return;
    }
    if (e.target.id === "btn-join-room") {
      const code = document.getElementById("join-room-code")?.value?.trim();
      if (!code) {
        const status = document.getElementById("network-status");
        if (status) status.textContent = "Введите код комнаты";
        return;
      }
      network.joinRoom(code);
      showOverlay("class-overlay", false);
      showOverlay("network-wait-overlay", true);
      renderNetworkWaiting(code.toUpperCase(), "Подключаемся…", { phase: "waiting" });
    }
  });

  document.getElementById("network-wait-overlay")?.addEventListener("click", async (e) => {
    if (e.target.id === "btn-copy-room-code") {
      const code = document.getElementById("room-code-display")?.textContent?.trim();
      const ok = await copyRoomCode(code);
      const btn = e.target;
      if (ok) {
        btn.textContent = "✓ Скопировано";
        btn.classList.add("copied");
        setTimeout(() => {
          btn.textContent = "📋 Копировать";
          btn.classList.remove("copied");
        }, 1800);
      }
      return;
    }
    if (e.target.id === "btn-network-start-run") {
      if ((network.getLobby() || []).length < 2) return;
      enterNetworkPregame();
      return;
    }
    if (e.target.id === "btn-network-leave") {
      leaveNetworkRoom();
    }
  });

  document.getElementById("shop-overlay")?.addEventListener("click", (e) => {
    if (e.target.id === "btn-network-ready") network.sendReady();
  });

  network.onJoined((payload) => {
    renderNetworkLobbyView(payload, payload.players?.length >= 2
      ? "Оба игрока в комнате — можно начинать забег"
      : "Ждём второго игрока…");
    showOverlay("network-wait-overlay", true);
    showOverlay("class-overlay", false);
  });

  network.onRoomReady((payload) => {
    renderNetworkLobbyView(payload, "Оба игрока в комнате — можно начинать забег");
    showOverlay("network-wait-overlay", true);
    showOverlay("class-overlay", false);
    menuNav?.reset();
  });

  network.onGameState((state) => {
    if (state.lobby) {
      syncLobbyToMatch(state.lobby);
      if (networkMode && match.phase === "classSelect") {
        renderNetworkClassSelect(match, {
          mySlot: network.getSlot(),
          lobby: state.lobby,
          code: network.getRoomCode(),
        });
        menuNav?.reset();
      } else if (networkMode && match.phase === "shop") {
        renderNetworkShopFooter(state.lobby, network.getSlot());
        renderShopOverlay(match.players[network.getSlot()], {
          title: "🛒 Магазин · Сеть",
          startLabel: "Готов к бою",
          isNetwork: true,
        });
        menuNav?.reset();
      }
    }
    if (state.phase === "playing" && state.players?.length && !roundState) {
      enterNetworkRoundFromServer({
        seed: state.seed,
        round: state.round,
        timeLeft: state.timeLeft,
      });
    }
    if (state.players && roundState?.networkMode) {
      applyServerGameState(state);
    }
  });

  network.onRoundStart((payload) => {
    enterNetworkRoundFromServer(payload);
  });

  network.onRoundEnd(() => {
    match.phase = "shop";
    shopContext = "intermission";
    closeShopOverlay();
    openNetworkShop();
  });

  network.onError((err) => {
    const msg = err?.message || "Ошибка сети";
    const el = document.getElementById("network-status");
    if (el) el.textContent = msg;
    renderNetworkWaiting(network.getRoomCode() || "—", msg, {
      lobby: network.getLobby(),
      mySlot: network.getSlot(),
      isHost: network.isHost(),
      phase: network.getPhase(),
      errorMessage: msg,
    });
    showOverlay("network-wait-overlay", true);
    showOverlay("class-overlay", false);
  });
}

function renderNetworkLobbyView(payload, message) {
  renderNetworkWaiting(payload?.code || network.getRoomCode(), message, {
    lobby: payload?.players || network.getLobby(),
    mySlot: network.getSlot(),
    isHost: network.isHost(),
    phase: payload?.phase || network.getPhase(),
  });
}

function enterNetworkPregame() {
  networkMode = true;
  match = createGameState(MATCH_MODE.SOLO);
  match.matchMode = MATCH_MODE.SOLO;
  match.players = [createPlayerState(0, "miner"), createPlayerState(1, "scout")];
  for (const p of match.players) {
    p.gold = START_GOLD;
    p.loadout = createEmptyLoadout();
  }
  syncLobbyToMatch(network.getLobby());
  match.phase = "classSelect";
  const mySlot = network.getSlot();
  classPick = match.players[mySlot].class;
  showOverlay("network-wait-overlay", false);
  showOverlay("class-overlay", true);
  renderNetworkClassSelect(match, {
    mySlot,
    lobby: network.getLobby(),
    code: network.getRoomCode(),
  });
  menuNav?.reset();
}

function returnToNetworkLobby() {
  renderNetworkLobbyView({
    code: network.getRoomCode(),
    players: network.getLobby(),
    phase: network.getPhase(),
  }, "Оба игрока в комнате — можно начинать забег");
  showOverlay("class-overlay", false);
  showOverlay("network-wait-overlay", true);
  menuNav?.reset();
}

function leaveNetworkRoom() {
  network.leaveRoom();
  networkMode = false;
  showOverlay("network-wait-overlay", false);
  showOverlay("class-overlay", true);
  match.phase = "classSelect";
  renderClassSelect(match);
  const status = document.getElementById("network-status");
  if (status) status.textContent = "";
  menuNav?.reset();
}

function syncLobbyToMatch(lobby) {
  for (const lp of lobby || []) {
    const p = match.players[lp.slot];
    if (!p) continue;
    p.class = lp.class;
    p.gold = lp.gold ?? START_GOLD;
    p.loadout = copyLoadout(lp.loadout || createEmptyLoadout());
    p.ready = lp.ready;
  }
}

function ensureNetworkMatchPlayers() {
  if (!match.players || match.players.length < 2) {
    match.players = [
      createPlayerState(0, "miner"),
      createPlayerState(1, "scout"),
    ];
  }
  syncLobbyToMatch(network.getLobby());
}

function enterNetworkRoundFromServer(payload) {
  networkMode = true;
  ensureNetworkMatchPlayers();
  showOverlay("network-wait-overlay", false);
  showOverlay("class-overlay", false);
  showOverlay("shop-overlay", false);
  startNetworkRound(payload);
}

function openNetworkShop() {
  shopContext = "pregame";
  match.phase = "shop";
  showOverlay("class-overlay", false);
  const player = match.players[network.getSlot()];
  openShopOverlay(player, {
    title: "🛒 Магазин · Сеть",
    startLabel: "Готов к бою",
    isNetwork: true,
  });
  renderNetworkShopFooter(network.getLobby(), network.getSlot());
  menuNav?.reset();
}

function startNetworkRound(payload) {
  const seed = payload?.seed ?? network.getSeed();
  if (seed == null) return;

  if (roundState?.networkMode && roundState.map?.seed === seed && match.phase === "playing") {
    const state = network.getLatestState();
    if (state) applyServerGameState(state);
    return;
  }

  ensureNetworkMatchPlayers();

  const map = generateMap(seed);
  setCollisionMap(map);
  syncLobbyToMatch(network.getLobby());

  const mySlot = network.getSlot();
  const players = [0, 1].map((i) => {
    const statePlayer = match.players[i] || createPlayerState(i, i === 0 ? "miner" : "scout");
    const spawn = i === 0 ? map.spawnP1 : map.spawnP2;
    const ent = createPlayerEntity(statePlayer, spawn.x, spawn.y);
    ent.loadout = copyLoadout(statePlayer.loadout);
    ent.authX = spawn.x;
    ent.authY = spawn.y;
    return ent;
  });

  roundState = {
    map,
    players,
    mobs: [],
    bots: [],
    projectiles: [],
    bombs: [],
    effects: createEffectsState(),
    fogState: createFogState(map.fogMap),
    timeLeft: payload?.timeLeft ?? ROUND_DURATION,
    resultsTimer: 0,
    intermissionTimer: 0,
    roundWon: false,
    stats: match.players.map(() => ({ kills: 0, damage: 0, items: 0 })),
    inventoryOpen: false,
    paused: false,
    networkMode: true,
    mySlot,
  };

  match.phase = "playing";
  match.round = payload?.round ?? 1;
  showOverlay("network-wait-overlay", false);
  showOverlay("class-overlay", false);
  showOverlay("shop-overlay", false);
  showOverlay("results-overlay", false);
  showOverlay("intermission-overlay", false);
  input.getPlayer(0).resetZoom();
  mobIdCounter = 0;

  updateFog(roundState.fogState, collectVisionSources(players, []));
  markFogDirty(roundState.fogState);

  const state = network.getLatestState();
  if (state) applyServerGameState(state);
}

function ensureNetworkMap(state) {
  if (!roundState || !state?.seed) return false;
  if (roundState.map?.seed === state.seed) return false;

  const map = generateMap(state.seed);
  setCollisionMap(map);
  roundState.map = map;
  roundState.fogState = createFogState(map.fogMap);
  markFogDirty(roundState.fogState);
  return true;
}

function syncNetworkPlayerFromServer(slot, serverPlayer) {
  if (!roundState || !serverPlayer) return;
  if (!match.players[slot]) {
    match.players[slot] = createPlayerState(slot, slot === 0 ? "miner" : "scout");
  }
  let ent = roundState.players[slot];
  if (!ent) {
    const spawn = slot === 0 ? roundState.map.spawnP1 : roundState.map.spawnP2;
    ent = createPlayerEntity(match.players[slot], spawn.x, spawn.y);
    roundState.players[slot] = ent;
  }
  ent.x = serverPlayer.x;
  ent.y = serverPlayer.y;
  ent.hp = serverPlayer.hp;
  ent.maxHp = serverPlayer.maxHp;
  ent.alive = serverPlayer.alive;
  ent.invuln = serverPlayer.invuln || 0;
  ent.respawnTimer = serverPlayer.respawnTimer || 0;
  ent.aimDir = { ...(serverPlayer.aimDir || { x: 1, y: 0 }) };
  ent.loadout = copyLoadout(serverPlayer.loadout || match.players[slot].loadout);
  ent.color = serverPlayer.color || PLAYER_COLORS[slot];
}

function applyServerGameState(state) {
  if (!roundState) return;

  ensureNetworkMap(state);
  if (state.timeLeft != null) {
    const drift = state.timeLeft - roundState.timeLeft;
    if (Math.abs(drift) > 0.25) roundState.timeLeft = state.timeLeft;
  }

  const mySlot = roundState.mySlot ?? network.getSlot();
  const serverMe = state.players?.find((p) => p.id === mySlot);
  const remoteSlot = mySlot === 0 ? 1 : 0;
  const serverRemote = state.players?.find((p) => p.id === remoteSlot);

  if (serverRemote) syncNetworkPlayerFromServer(remoteSlot, serverRemote);

  const local = roundState.players[mySlot];
  if (local && serverMe) {
    local.authX = serverMe.x;
    local.authY = serverMe.y;
    const dx = serverMe.x - local.x;
    const dy = serverMe.y - local.y;
    if (dx * dx + dy * dy > 120 * 120) {
      local.x = serverMe.x;
      local.y = serverMe.y;
    }
    local.hp = serverMe.hp;
    local.maxHp = serverMe.maxHp;
    local.alive = serverMe.alive;
    local.invuln = serverMe.invuln || 0;
    local.respawnTimer = serverMe.respawnTimer || 0;
    local.aimDir = { ...(serverMe.aimDir || local.aimDir) };
    local.loadout = copyLoadout(serverMe.loadout || local.loadout);
  }

  roundState.mobs = (state.mobs || []).map((m) => ({ ...m, radius: m.radius || 14 }));
  roundState.projectiles = (state.projectiles || []).map((p) => ({ ...p, alive: true }));
  roundState.bombs = (state.bombs || []).map((b) => ({ ...b, alive: true }));

  for (const patch of state.tilePatches || []) {
    const i = patch.row * MAP_W + patch.col;
    roundState.map.tiles[i] = patch.tile;
  }

  if (applyFogPatches(roundState.fogState.map, state.fogPatches)) {
    markFogDirty(roundState.fogState);
  }
}

function bindClassSelect() {
  const root = document.getElementById("class-select-content");
  if (!root || root.dataset.bound) return;
  root.dataset.bound = "1";
  root.addEventListener("click", (e) => {
    const modeCard = e.target.closest(".mode-card");
    if (modeCard?.dataset.mode) {
      match.matchMode = modeCard.dataset.mode;
      document.querySelectorAll(".mode-card").forEach((c) => {
        c.classList.toggle("selected", c.dataset.mode === match.matchMode);
      });
      menuNav?.refresh();
      return;
    }
    const card = e.target.closest(".class-card");
    if (card?.dataset.class) {
      classPick = card.dataset.class;
      match.players[0].class = classPick;
      if (networkMode) {
        match.players[network.getSlot()].class = classPick;
        network.sendClass(classPick);
      }
      document.querySelectorAll(".class-card").forEach((c) => {
        c.classList.toggle("selected", c.dataset.class === classPick);
      });
      const btn = document.getElementById("btn-to-shop");
      if (btn) btn.disabled = !classPick;
      menuNav?.refresh();
      return;
    }
    if (e.target.id === "btn-to-shop") {
      if (networkMode) openNetworkShop();
      else openPregameShop();
      return;
    }
    if (e.target.id === "btn-back-to-lobby") {
      returnToNetworkLobby();
    }
  });
}

function openPregameShop() {
  shopContext = "pregame";
  match.phase = "shop";
  showOverlay("class-overlay", false);
  const modeLabel = getMatchModeLabel(match.matchMode);
  openShopOverlay(match.players[0], {
    title: `🛒 Магазин · ${modeLabel}`,
    startLabel: "В бой!",
  });
  menuNav?.reset();
}

function onShopBuy(itemId) {
  if (networkMode && network.isConnected()) {
    network.sendShopBuy(itemId);
    return;
  }
  const player = match.players[0];
  if (tryBuyItem(player, itemId)) {
    renderShopOverlay(player, shopContext === "pregame"
      ? { title: `🛒 Магазин · ${getMatchModeLabel(match.matchMode)}`, startLabel: "В бой!" }
      : { title: "🛒 Магазин между раундами", startLabel: "Продолжить" });
    menuNav?.reset();
  }
}

function onShopStart() {
  if (networkMode && network.isConnected()) {
    network.sendReady();
    return;
  }
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
  const prevMode = match.matchMode;
  match = createGameState(prevMode);
  if (classPick) match.players[0].class = classPick;
  showOverlay("match-end-overlay", false);
  openPregameShop();
}

function newGame() {
  match = createGameState(MATCH_MODE.SOLO);
  classPick = null;
  showOverlay("match-end-overlay", false);
  renderClassSelect(match);
  match.phase = "classSelect";
  showOverlay("class-overlay", true);
  menuNav?.reset();
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
  const mobs = spawnMobs(map, getRoundBudget(match.round, match.matchMode), rng);
  const bots = isVsBotsMode(match) ? spawnBots(map, getBotCount(match.round), rng) : [];

  roundState = {
    map,
    players,
    mobs,
    bots,
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
  resetBotIdCounter();

  updateFog(roundState.fogState, collectVisionSources(players, bots));
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
  if (match.phase === "classSelect" || match.phase === "shop" || match.phase === "matchEnd") {
    menuNav?.update();
  }

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

function onBotKilled(player, bot) {
  if (!bot.dropZone?.item || !player) return;
  const state = match.players[player.id];
  state.backpack.push(bot.dropZone.item);
  state.gold += bot.gold || 0;
  state.itemsCollected++;
  player.itemsThisRound++;
  bot.dropZone = null;
}

function onMobKilled(player, mob) {
  if (mob.dropZone) collectDrop(player, mob);
}

function updatePlaying(dt) {
  if (roundState?.networkMode) {
    updatePlayingNetwork(dt);
    return;
  }
  updatePlayingLocal(dt);
}

function updatePlayingLocal(dt) {
  const { players, mobs, bots, projectiles, bombs, effects, map } = roundState;

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

  updatePlayerAura(p, mobs, dt, effects, onMobKilled, bots, onBotKilled);

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
  updateBots(bots, players, projectiles, bombs, map, dt, effects, onBotKilled);

  for (const proj of projectiles) {
    updateProjectile(proj, dt, players, mobs, bots, effects, onMobKilled, onBotKilled);
  }
  roundState.projectiles = projectiles.filter((pr) => pr.alive);

  const detDef = getItemDef("detonator");
  roundState.bombs = updateBombs(
    bombs, map, mobs, players, bots, effects,
    detDef?.blastRange || 5,
    detDef?.damage || 40,
    dt,
    onMobKilled,
    onBotKilled,
  );

  updateEffects(effects, dt);
  updateFog(roundState.fogState, collectVisionSources(players, bots));
  checkRoundEnd();
}

function updatePlayingNetwork(dt) {
  const { players, effects } = roundState;
  const mySlot = roundState.mySlot ?? network.getSlot();
  const p = players[mySlot];
  if (!p) return;

  const inp = input.getPlayer(0);
  inp.refresh({ x: p.x, y: p.y }, camera);

  const packet = inp.captureNetworkInput();
  if (packet) network.sendInput(packet);

  if (inp.consumeBackpack()) toggleInventory();
  if (inp.consumeCancel() && roundState.inventoryOpen) closeInventory();
  inp.consumeZoomToggle();

  if (roundState.paused) {
    updateEffects(effects, dt);
    return;
  }

  roundState.timeLeft -= dt;

  const fakeInput = {
    getMoveDir: () => packet?.moveDir || { x: 0, y: 0 },
    getAimDir: () => packet?.aimDir || p.aimDir,
    getFireDir: () => {
      const a = packet?.aimDir;
      if (a?.x || a?.y) return a;
      return packet?.lastAimDir || p.aimDir;
    },
    isSprintHeld: () => !!packet?.sprint,
  };
  updatePlayerEntity(p, dt, fakeInput, camera);

  if (typeof p.authX === "number" && typeof p.authY === "number") {
    const blend = Math.min(1, dt * 12);
    p.x += (p.authX - p.x) * blend;
    p.y += (p.authY - p.y) * blend;
  }

  updateEffects(effects, dt);
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
  if (isVsBotsMode(match) && roundState.bots?.length && roundState.bots.every((b) => !b.alive)) {
    endRound(true);
  }
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
  menuNav?.reset();
}

function finishMatch(winner) {
  match.matchOver = true;
  match.matchWinner = winner;
  match.phase = "matchEnd";
  showOverlay("intermission-overlay", false);
  closeShopOverlay();
  renderMatchEndOverlay(match);
  showOverlay("match-end-overlay", true);
  menuNav?.reset();
}

function draw() {
  const menuPhase = match.phase === "classSelect" || match.phase === "shop";
  if (!roundState || menuPhase) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#0a0a0c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const mySlot = roundState.networkMode ? (roundState.mySlot ?? network.getSlot()) : 0;
  const p = roundState.players[mySlot] || roundState.players[0];
  if (!p) return;
  input.getPlayer(0).refresh({ x: p.x, y: p.y }, camera);
  const zoomActive = match.phase === "playing" && input.getPlayer(0).isZoomActive();

  let drawPlayers = roundState.players;
  let drawMobs = roundState.mobs;
  let drawProjectiles = roundState.projectiles;
  let drawBombs = roundState.bombs;

  if (roundState.networkMode && typeof buildNetworkRenderEntities === "function") {
    const alpha = network.getStateAlpha();
    const rendered = buildNetworkRenderEntities(
      network.getPrevState(),
      network.getLatestState(),
      alpha,
      mySlot,
      roundState.players,
      network.getExtrapolateSec(),
    );
    drawPlayers = rendered.drawPlayers;
    drawMobs = rendered.drawMobs.length ? rendered.drawMobs : roundState.mobs;
    drawProjectiles = rendered.drawProjectiles.length ? rendered.drawProjectiles : roundState.projectiles;
    drawBombs = rendered.drawBombs.length ? rendered.drawBombs : roundState.bombs;
  }

  drawWorld(
    ctx,
    roundState.map,
    drawPlayers,
    drawMobs,
    roundState.bots,
    drawProjectiles,
    drawBombs,
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
