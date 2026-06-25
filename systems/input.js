/** Ввод: клавиатура + мышь + геймпад */

function createInputSystem() {
  const keys = new Set();
  const edge = {
    shoot: false,
    bomb: false,
    backpack: false,
    cancel: false,
    zoom: false,
  };
  const mouse = { x: 0, y: 0, active: false };
  let lastAimDir = { x: 1, y: 0 };
  let zoomActive = false;

  window.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (["Space", "KeyB", "Tab", "KeyQ"].includes(e.code)) e.preventDefault();
    if (e.code === "Space") edge.shoot = true;
    if (e.code === "KeyB") edge.bomb = true;
    if (e.code === "Tab") edge.backpack = true;
    if (e.code === "KeyQ" && !e.repeat) edge.zoom = true;
    if (e.code === "Escape") edge.cancel = true;
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  });
  window.addEventListener("mousedown", () => { mouse.active = true; });

  function isDown(codes) {
    return codes.some((k) => keys.has(k));
  }

  function buildState(playerPos, camera) {
    const gp = readGamepadState();

    let moveX = 0;
    let moveY = 0;
    if (isDown(["KeyA"])) moveX -= 1;
    if (isDown(["KeyD"])) moveX += 1;
    if (isDown(["KeyW"])) moveY -= 1;
    if (isDown(["KeyS"])) moveY += 1;
    let moveDir = normalizeDir(moveX, moveY);
    if (gp.connected && (gp.moveDir.x || gp.moveDir.y)) moveDir = gp.moveDir;

    let aimDir = { x: 0, y: 0 };
    if (mouse.active && playerPos && camera) {
      const world = screenToWorld(camera, mouse.x, mouse.y);
      aimDir = normalizeDir(world.x - playerPos.x, world.y - playerPos.y);
    }
    if (gp.connected && (gp.aimDir.x || gp.aimDir.y)) aimDir = gp.aimDir;

    if (aimDir.x !== 0 || aimDir.y !== 0) lastAimDir = { ...aimDir };

    const sprint = isDown(["ShiftLeft", "ShiftRight"]) || gp.sprint;

    return {
      moveDir,
      aimDir,
      lastAimDir: { ...lastAimDir },
      sprint,
      edgeShoot: edge.shoot || gp.edgeShoot,
      edgeBomb: edge.bomb || gp.edgeBomb,
      edgeBackpack: edge.backpack || gp.edgeBackpack,
      edgeCancel: edge.cancel || gp.edgeCancel,
      edgeZoom: edge.zoom || gp.edgeZoom,
    };
  }

  const soloInput = {
    _state: null,
    refresh(playerPos, camera) {
      this._state = buildState(playerPos, camera);
    },
    getMoveDir() {
      return this._state?.moveDir ?? { x: 0, y: 0 };
    },
    getAimDir() {
      return this._state?.aimDir ?? { x: 0, y: 0 };
    },
    getFireDir() {
      const s = this._state;
      if (!s) return lastAimDir;
      if (s.aimDir.x !== 0 || s.aimDir.y !== 0) return s.aimDir;
      return s.lastAimDir;
    },
    isSprintHeld() {
      return !!this._state?.sprint;
    },
    isZoomActive() {
      return zoomActive;
    },
    resetZoom() {
      zoomActive = false;
    },
    consumeZoomToggle() {
      if (!this._state?.edgeZoom) return false;
      if (edge.zoom) edge.zoom = false;
      zoomActive = !zoomActive;
      return true;
    },
    consumeShoot() {
      const v = this._state?.edgeShoot;
      if (edge.shoot) edge.shoot = false;
      return !!v;
    },
    consumeBomb() {
      const v = this._state?.edgeBomb;
      if (edge.bomb) edge.bomb = false;
      return !!v;
    },
    consumeBackpack() {
      const v = this._state?.edgeBackpack;
      if (edge.backpack) edge.backpack = false;
      return !!v;
    },
    consumeCancel() {
      const v = this._state?.edgeCancel;
      if (edge.cancel) edge.cancel = false;
      return !!v;
    },
    consumeAttack() { return this.consumeShoot(); },
    captureNetworkInput() {
      const s = this._state;
      if (!s) return null;
      const packet = {
        moveDir: { ...s.moveDir },
        aimDir: { ...s.aimDir },
        lastAimDir: { ...s.lastAimDir },
        sprint: !!s.sprint,
        shoot: !!s.edgeShoot,
        bomb: !!s.edgeBomb,
      };
      if (edge.shoot) edge.shoot = false;
      if (edge.bomb) edge.bomb = false;
      return packet;
    },
  };

  return {
    getPlayer() {
      return soloInput;
    },
    player0: soloInput,
    player1: soloInput,
  };
}
