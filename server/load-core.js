/** Загрузка игровой логики из ../core и ../entities в sandbox Node */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

const STUBS = `
var document = { createElement: function() { return { width: 0, height: 0, getContext: function() { return { clearRect: function() {}, fillRect: function() {} }; } }; } };
function isSoloMode() { return false; }
function isVsBotsMode() { return false; }
function getMatchModeLabel() { return ""; }
function getActivePlayerCount() { return 2; }
function getActiveLayout() { return "solo-fullscreen"; }
function detectDisplayProfile() { return { id: "desktop" }; }
function syncDisplayDataset() {}
const GAME_MODE = { SOLO: "solo", VERSUS: "versus" };
const ACTIVE_GAME_MODE = GAME_MODE.SOLO;
const MATCH_MODE = { SOLO: "solo", VS_BOTS: "vs_bots" };
function createEffectsState() {
  return { damageArrows: [], explosions: [], auraPulse: 0, floatingTexts: [] };
}
function spawnDamageArrow() {}
function spawnFloatingText() {}
function spawnExplosion() {}
function pulseAura() {}
function drawPlayerRespawnGhost() {}
function drawMob() {}
function drawBot() {}
function drawBotDropZones() {}
function resetBotIdCounter() {}
`;

const FILES = [
  "core/constants.js",
  "core/items.js",
  "core/rng.js",
  "core/collision.js",
  "core/map-gen.js",
  "core/game-state.js",
  "systems/fog.js",
  "entities/player.js",
  "entities/projectile.js",
  "entities/bomb.js",
  "entities/mob.js",
];

let cached = null;

function loadGameCore() {
  if (cached) return cached;

  const sandbox = {
    console,
    Math,
    Uint8Array,
    Array,
    Map,
    Set,
    Object,
    JSON,
  };

  vm.createContext(sandbox);
  vm.runInContext(STUBS, sandbox);

  for (const rel of FILES) {
    const filePath = path.join(ROOT, rel);
    const code = fs.readFileSync(filePath, "utf8");
    vm.runInContext(code, sandbox, { filename: filePath });
  }

  cached = sandbox;
  return sandbox;
}

module.exports = { loadGameCore };
