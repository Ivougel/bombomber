/** Мировые константы */
const TILE_SIZE = 32;
const MAP_W = 80;
const MAP_H = 60;
const WORLD_W = MAP_W * TILE_SIZE;
const WORLD_H = MAP_H * TILE_SIZE;
const MAP_CENTER_X = WORLD_W * 0.5;
const MAP_CENTER_Y = WORLD_H * 0.5;

const TILE = {
  VOID: 0,
  FLOOR: 1,
  WALL_HARD: 2,
  COLUMN: 3,
  EXIT: 4,
  WALL_SOFT: 5,
  WALL_HARD_CRACKED: 6,
  COLUMN_CRACKED: 7,
};
TILE.WALL = TILE.WALL_HARD;

const BIOME = {
  MINE: "mine",
  RUINS: "ruins",
};

const PLAYER_RADIUS = 14;
const PLAYER_BASE_SPEED = 180;
const PLAYER_MAX_HP = 100;
const PLAYER_MELEE_RANGE = 28;
const PLAYER_MELEE_DAMAGE = 12;
const PLAYER_MELEE_COOLDOWN = 0.45;

const MOB_AGRO_RADIUS = 200;
const MOB_DEAGRO_RADIUS = 400;
const ARCHER_FLEE_RADIUS = 80;
const ARCHER_SHOOT_INTERVAL = 2;
const PROJECTILE_SPEED = 280;
const PROJECTILE_DAMAGE = 6;

const NETWORK_TICK_MS = 33;
const NETWORK_TICK_RATE = 30;

const ROUND_DURATION = 300;
const RESULTS_DURATION = 5;
const INTERMISSION_DURATION = 30;
const MAX_ROUNDS = 5;

const VIEWPORT_DESIGN_W = 480;
const VIEWPORT_DESIGN_H = 360;
const MOBILE_MIN_ZOOM = 0.5;

const MOB_BUDGET = [
  { wanderer: 15, archer: 3, berserker: 0 },
  { wanderer: 12, archer: 6, berserker: 2 },
  { wanderer: 10, archer: 8, berserker: 4 },
  { wanderer: 8, archer: 10, berserker: 6 },
  { wanderer: 6, archer: 8, berserker: 8 },
];

const BOT_COUNT = [1, 2, 2, 3, 4];

function getBotCount(round) {
  const idx = Math.min(Math.max(round - 1, 0), BOT_COUNT.length - 1);
  return BOT_COUNT[idx];
}

function scaleMobBudgetForMode(budget, matchMode) {
  if (matchMode !== "vs_bots") return budget;
  return {
    wanderer: Math.max(2, Math.floor(budget.wanderer * 0.35)),
    archer: Math.max(1, Math.floor(budget.archer * 0.5)),
    berserker: Math.max(0, Math.floor(budget.berserker * 0.5)),
  };
}

const MOB_DEFS = {
  wanderer: { emoji: "🧟", hp: 40, speed: 90, damage: 5, touchRadius: 22, gold: 2 },
  archer: { emoji: "🏹", hp: 30, speed: 70, damage: 6, touchRadius: 18, gold: 3 },
  berserker: { emoji: "💀", hp: 80, speed: 180, damage: 8, touchRadius: 24, gold: 5 },
};

const BIOME_COLORS = {
  mine: {
    floor: "#3a3f47",
    floorAlt: "#34383f",
    wall: "#1e2228",
    column: "#4a5058",
    exit: "#5a8a6a",
  },
  ruins: {
    floor: "#c4a882",
    floorAlt: "#b89a74",
    wall: "#8a7358",
    column: "#6e5c48",
    exit: "#5a8a6a",
  },
};

const PLAYER_COLORS = ["#4a9eff", "#ff6b4a"];
