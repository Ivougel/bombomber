/** Серверный игровой цикл — 30 TPS */

const TICK_MS = 33;
const DT = TICK_MS / 1000;

function startGameLoop(roomManager) {
  setInterval(() => {
    roomManager.tickAll(DT);
  }, TICK_MS);
}

module.exports = { startGameLoop, TICK_MS, DT };
