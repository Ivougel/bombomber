/** Серверный тик симуляции */

const { loadGameCore } = require("./load-core");

function createServerPlayer(G, slot, x, y, klass) {
  const state = G.createPlayerState(slot, klass || "miner");
  state.loadout = G.createEmptyLoadout();
  state.gold = G.START_GOLD;
  const entity = G.createPlayerEntity(state, x, y);
  entity.class = klass || "miner";
  return { state, entity };
}

function fireDirFromInput(inp) {
  if (inp.aimDir && (inp.aimDir.x || inp.aimDir.y)) return inp.aimDir;
  if (inp.lastAimDir && (inp.lastAimDir.x || inp.lastAimDir.y)) return inp.lastAimDir;
  return { x: 1, y: 0 };
}

function applyInputToPlayer(G, player, inp, dt, map, projectiles, bombs, mobs, effects) {
  if (!player.alive || player.respawnTimer > 0) return;

  const moveDir = inp.moveDir || { x: 0, y: 0 };
  const aim = inp.aimDir || { x: 0, y: 0 };
  if (aim.x || aim.y) player.aimDir = { ...aim };
  else if (moveDir.x || moveDir.y) player.aimDir = { ...moveDir };

  const speed = inp.sprint ? player.baseSpeed * 1.8 : player.baseSpeed;
  player.speed = speed;
  const vx = moveDir.x * speed * dt;
  const vy = moveDir.y * speed * dt;
  const resolved = G.resolveCircleMovement(player.x, player.y, vx, vy, player.radius);
  player.x = resolved.x;
  player.y = resolved.y;

  if (player.weaponCooldown > 0) player.weaponCooldown -= dt;
  if (player.invuln > 0) player.invuln -= dt;

  G.updatePlayerAura(player, mobs, dt, effects, onMobKilledStub);

  if (inp.shoot) {
    G.tryFireWeapon(player, projectiles, fireDirFromInput(inp));
  }
  if (inp.bomb && player.loadout?.hasBombs) {
    const det = G.getItemDef("detonator");
    G.tryPlaceBomb(player, bombs, map, det.fuseTime);
  }
}

function onMobKilledStub() {}

function startRoundOnRoom(room) {
  const G = loadGameCore();
  const seed = room.seed;
  const map = G.generateMap(seed);
  G.setCollisionMap(map);
  room.map = map;
  room.tilePatches = [];

  const rng = G.createRng(seed);
  room.mobs = G.spawnMobs(map, G.getRoundBudget(room.round, "solo"), rng);
  room.projectiles = [];
  room.bombs = [];
  room.effects = G.createEffectsState();
  room.timeLeft = G.ROUND_DURATION;
  room.tick = 0;

  const slots = [...room.players.values()].sort((a, b) => a.slot - b.slot);
  room.entities = [];
  for (const pl of slots) {
    const spawn = pl.slot === 0 ? map.spawnP1 : map.spawnP2;
    const { state, entity } = createServerPlayer(G, pl.slot, spawn.x, spawn.y, pl.class);
    state.loadout = { ...pl.loadout };
    state.gold = pl.gold;
    entity.loadout = G.copyLoadout(state.loadout);
    pl.state = state;
    pl.entity = entity;
    room.entities.push(entity);
  }

  room.fogState = G.createFogState(map.fogMap);
  room.fogPatches = G.updateFogWithPatches(room.fogState, room.entities);

  G.mobIdCounter = 0;
}

function simTick(room, dt) {
  if (room.phase !== "playing" || !room.map) return [];

  const G = loadGameCore();
  const map = room.map;
  const events = [];
  const players = room.entities || [];
  const mobs = room.mobs;
  const projectiles = room.projectiles;
  const bombs = room.bombs;
  const effects = room.effects;

  for (const pl of room.players.values()) {
    if (!pl.entity || !pl.pendingInput) continue;
    applyInputToPlayer(G, pl.entity, pl.pendingInput, dt, map, projectiles, bombs, mobs, effects);
    pl.pendingInput = null;
  }

  for (const p of players) {
    if (p.respawnTimer > 0) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) {
        p.alive = true;
        p.hp = p.maxHp;
        p.x = p.spawnX;
        p.y = p.spawnY;
        p.invuln = G.PLAYER_INVULN_TIME;
      }
    }
  }

  G.updateMobs(mobs, players, projectiles, dt, effects);

  for (const proj of projectiles) {
    G.updateProjectile(proj, dt, players, mobs, [], effects, (attacker, mob) => {
      events.push({ type: "mob_killed", mobId: mob.id, killerSlot: attacker?.id });
      const slotPl = room.playersBySlot(attacker?.id);
      if (slotPl?.state) {
        slotPl.state.gold += mob.gold || 0;
        if (mob.dropZone?.item) slotPl.state.backpack.push(mob.dropZone.item);
      }
    });
  }
  room.projectiles = projectiles.filter((p) => p.alive);

  const det = G.getItemDef("detonator");
  const tilesBefore = room.map.tiles.slice();
  room.bombs = G.updateBombs(
    bombs, map, mobs, players, [], effects,
    det?.blastRange || 5,
    det?.damage || 40,
    dt,
    (attacker, mob) => {
      events.push({ type: "mob_killed", mobId: mob.id, killerSlot: attacker?.id });
    },
  );

  for (let i = 0; i < room.map.tiles.length; i++) {
    if (tilesBefore[i] === room.map.tiles[i]) continue;
    const col = i % G.MAP_W;
    const row = Math.floor(i / G.MAP_W);
    const patch = { col, row, tile: room.map.tiles[i] };
    const key = `${col},${row}`;
    const existing = room.tilePatches.find((t) => `${t.col},${t.row}` === key);
    if (existing) existing.tile = patch.tile;
    else room.tilePatches.push(patch);
  }

  room.timeLeft -= dt;
  room.tick++;

  const fogPatches = G.updateFogWithPatches(room.fogState, players);
  if (fogPatches.length) room.fogPatches.push(...fogPatches);

  if (room.timeLeft <= 0) {
    room.phase = "round_end";
    events.push({ type: "round_end", timeLeft: 0 });
  }

  return events;
}

function serializeGameState(room) {
  const players = (room.entities || []).map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    hp: p.hp,
    maxHp: p.maxHp,
    aimDir: { ...p.aimDir },
    moveDir: { ...p.moveDir },
    alive: p.alive,
    invuln: p.invuln,
    respawnTimer: p.respawnTimer,
    class: p.class,
    color: p.color,
    loadout: p.loadout,
    killsThisRound: p.killsThisRound,
  }));

  const mobs = (room.mobs || []).map((m) => ({
    id: m.id,
    type: m.type,
    x: m.x,
    y: m.y,
    hp: m.hp,
    maxHp: m.maxHp,
    alive: m.alive,
    emoji: m.emoji,
    state: m.state,
  }));

  const projectiles = (room.projectiles || []).filter((p) => p.alive).map((p) => ({
    x: p.x, y: p.y, vx: p.vx, vy: p.vy, radius: p.radius,
    ownerId: p.ownerId, fromMob: p.fromMob, alive: p.alive,
  }));

  const bombs = (room.bombs || []).filter((b) => b.alive).map((b) => ({
    x: b.x, y: b.y, col: b.col, row: b.row, fuse: b.fuse, alive: b.alive,
  }));

  return {
    tick: room.tick,
    phase: room.phase,
    round: room.round,
    seed: room.seed,
    timeLeft: room.timeLeft,
    players,
    mobs,
    projectiles,
    bombs,
    tilePatches: room.tilePatches || [],
    fogPatches: room.fogPatches || [],
    lobby: serializeLobby(room),
  };
}

function serializeLobby(room) {
  return [...room.players.values()].map((p) => ({
    slot: p.slot,
    class: p.class,
    ready: p.ready,
    gold: p.state?.gold ?? p.gold ?? G_START_GOLD,
    loadout: p.loadout,
    name: p.name,
  }));
}

const G_START_GOLD = 40;

module.exports = {
  startRoundOnRoom,
  simTick,
  serializeGameState,
  createServerPlayer,
};
