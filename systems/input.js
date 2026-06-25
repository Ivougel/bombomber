/** Ввод: solo (WASD + мышь/стрелки), задел под P2 */

const SOLO_BINDINGS = {
  up: ["KeyW"],
  down: ["KeyS"],
  left: ["KeyA"],
  right: ["KeyD"],
  aimUp: ["ArrowUp"],
  aimDown: ["ArrowDown"],
  aimLeft: ["ArrowLeft"],
  aimRight: ["ArrowRight"],
  attack: ["Space"],
  bomb: ["KeyB"],
};

const VERSUS_BINDINGS = [
  {
    up: ["KeyW"],
    down: ["KeyS"],
    left: ["KeyA"],
    right: ["KeyD"],
    aimUp: ["KeyQ"],
    aimDown: ["KeyC"],
    aimLeft: ["KeyE"],
    aimRight: ["KeyR"],
    attack: ["Space"],
  },
  {
    up: ["ArrowUp"],
    down: ["ArrowDown"],
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
    aimUp: ["KeyI"],
    aimDown: ["KeyK"],
    aimLeft: ["KeyJ"],
    aimRight: ["KeyL"],
    attack: ["Enter", "NumpadEnter"],
  },
];

function createInputSystem() {
  const keys = new Set();
  const attackPressed = [false, false];
  const bombPressed = [false, false];
  const mouse = { x: 0, y: 0, active: false };

  window.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (e.code === "Space" || e.code === "KeyB") e.preventDefault();
    const count = getActivePlayerCount();
    for (let i = 0; i < count; i++) {
      const bindings = isSoloMode() ? SOLO_BINDINGS : VERSUS_BINDINGS[i];
      if (bindings.attack.includes(e.code)) attackPressed[i] = true;
      if (bindings.bomb?.includes(e.code)) bombPressed[i] = true;
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));

  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  });
  window.addEventListener("mousedown", () => { mouse.active = true; });

  function isDown(bindings) {
    return bindings.some((k) => keys.has(k));
  }

  function makePlayerInput(playerIndex, bindings) {
    return {
      getMoveDir() {
        let x = 0;
        let y = 0;
        if (isDown(bindings.left)) x -= 1;
        if (isDown(bindings.right)) x += 1;
        if (isDown(bindings.up)) y -= 1;
        if (isDown(bindings.down)) y += 1;
        return normalizeDir(x, y);
      },
      getAimDir(playerPos, camera) {
        if (isSoloMode() && playerIndex === 0 && mouse.active && playerPos && camera) {
          const world = screenToWorld(camera, mouse.x, mouse.y);
          const dx = world.x - playerPos.x;
          const dy = world.y - playerPos.y;
          const kb = normalizeDir(
            (isDown(bindings.aimLeft) ? -1 : 0) + (isDown(bindings.aimRight) ? 1 : 0),
            (isDown(bindings.aimUp) ? -1 : 0) + (isDown(bindings.aimDown) ? 1 : 0),
          );
          if (kb.x !== 0 || kb.y !== 0) return kb;
          return normalizeDir(dx, dy);
        }
        let x = 0;
        let y = 0;
        if (isDown(bindings.aimLeft)) x -= 1;
        if (isDown(bindings.aimRight)) x += 1;
        if (isDown(bindings.aimUp)) y -= 1;
        if (isDown(bindings.aimDown)) y += 1;
        return normalizeDir(x, y);
      },
      consumeAttack() {
        if (attackPressed[playerIndex]) {
          attackPressed[playerIndex] = false;
          return true;
        }
        return false;
      },
      consumeBomb() {
        if (bombPressed[playerIndex]) {
          bombPressed[playerIndex] = false;
          return true;
        }
        return false;
      },
    };
  }

  const soloInput = makePlayerInput(0, SOLO_BINDINGS);
  const p0 = makePlayerInput(0, VERSUS_BINDINGS[0]);
  const p1 = makePlayerInput(1, VERSUS_BINDINGS[1]);

  return {
    getPlayer(index) {
      if (isSoloMode()) return soloInput;
      return index === 0 ? p0 : p1;
    },
    player0: soloInput,
    player1: p1,
  };
}
