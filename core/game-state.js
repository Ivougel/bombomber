/** Состояние матча — solo: 1 игрок, versus: 2 (будущее) */

function createGameState() {
  const count = getActivePlayerCount();
  return {
    round: 1,
    roundWins: 0,
    roundLosses: 0,
    scores: count === 1 ? [0] : [0, 0],
    players: Array.from({ length: count }, (_, i) => createPlayerState(i, i === 0 ? "miner" : "scout")),
    phase: "classSelect",
    matchOver: false,
    matchWinner: null,
    needsTiebreaker: false,
  };
}

function createPlayerState(id, klass) {
  return {
    id,
    class: klass || "miner",
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    loadout: createEmptyLoadout(),
    backpack: [],
    gold: START_GOLD,
    kills: 0,
    damageDealt: 0,
    itemsCollected: 0,
  };
}

function resetPlayerHp(state) {
  for (const p of state.players) {
    p.hp = PLAYER_MAX_HP;
    p.maxHp = PLAYER_MAX_HP;
  }
}

function getRoundBudget(round) {
  const idx = Math.min(Math.max(round - 1, 0), MOB_BUDGET.length - 1);
  return MOB_BUDGET[idx];
}
