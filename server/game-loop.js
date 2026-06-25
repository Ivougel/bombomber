/** Серверный игровой цикл — 20 TPS */

const TICK_MS = 50;
const DT = TICK_MS / 1000;

function startGameLoop(roomManager) {
  setInterval(() => {
    roomManager.tickAll(DT);
  }, TICK_MS);
}

module.exports = { startGameLoop, TICK_MS, DT };
