/** Ввод: клавиатура + мышь + до двух геймпадов */

function createInputSystem() {
  const keys = new Set();
  const kbEdge = {
    shoot: false,
    bomb: false,
    backpack: false,
    cancel: false,
    zoom: false,
  };
  const mouse = { x: 0, y: 0, active: false };
  let kbLastAimDir = { x: 1, y: 0 };

  window.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (["Space", "KeyB", "Tab", "KeyQ"].includes(e.code)) e.preventDefault();
    if (e.code === "Space") kbEdge.shoot = true;
    if (e.code === "KeyB") kbEdge.bomb = true;
    if (e.code === "Tab") kbEdge.backpack = true;
    if (e.code === "KeyQ" && !e.repeat) kbEdge.zoom = true;
    if (e.code === "Escape") kbEdge.cancel = true;
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

  function createPlayerInput(slot) {
    const padIndex = slot;
    let zoomActive = false;
    let lastAimDir = { x: 1, y: 0 };

    function buildState(playerPos, camera) {
      const gp = readGamepadState(padIndex);
      const useKeyboard = slot === 0;

      let moveX = 0;
      let moveY = 0;
      if (useKeyboard) {
        if (isDown(["KeyA"])) moveX -= 1;
        if (isDown(["KeyD"])) moveX += 1;
        if (isDown(["KeyW"])) moveY -= 1;
        if (isDown(["KeyS"])) moveY += 1;
      }
      let moveDir = normalizeDir(moveX, moveY);
      if (gp.connected && (gp.moveDir.x || gp.moveDir.y)) moveDir = gp.moveDir;

      let aimDir = { x: 0, y: 0 };
      if (useKeyboard && mouse.active && playerPos && camera) {
        const world = screenToWorld(camera, mouse.x, mouse.y);
        aimDir = normalizeDir(world.x - playerPos.x, world.y - playerPos.y);
      }
      if (gp.connected && (gp.aimDir.x || gp.aimDir.y)) aimDir = gp.aimDir;

      if (aimDir.x !== 0 || aimDir.y !== 0) lastAimDir = { ...aimDir };
      else if (useKeyboard && (kbLastAimDir.x || kbLastAimDir.y)) lastAimDir = { ...kbLastAimDir };
      if (useKeyboard && (aimDir.x !== 0 || aimDir.y !== 0)) kbLastAimDir = { ...aimDir };

      const sprint = (useKeyboard && isDown(["ShiftLeft", "ShiftRight"])) || gp.sprint;

      return {
        moveDir,
        aimDir,
        lastAimDir: { ...lastAimDir },
        sprint,
        edgeShoot: (useKeyboard && kbEdge.shoot) || gp.edgeShoot,
        edgeBomb: (useKeyboard && kbEdge.bomb) || gp.edgeBomb,
        edgeBackpack: (useKeyboard && kbEdge.backpack) || gp.edgeBackpack,
        edgeCancel: (useKeyboard && kbEdge.cancel) || gp.edgeCancel,
        edgeZoom: (useKeyboard && kbEdge.zoom) || gp.edgeZoom,
      };
    }

    const input = {
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
        if (slot === 0 && kbEdge.zoom) kbEdge.zoom = false;
        zoomActive = !zoomActive;
        return true;
      },
      consumeShoot() {
        const v = this._state?.edgeShoot;
        if (slot === 0 && kbEdge.shoot) kbEdge.shoot = false;
        return !!v;
      },
      consumeBomb() {
        const v = this._state?.edgeBomb;
        if (slot === 0 && kbEdge.bomb) kbEdge.bomb = false;
        return !!v;
      },
      consumeBackpack() {
        const v = this._state?.edgeBackpack;
        if (slot === 0 && kbEdge.backpack) kbEdge.backpack = false;
        return !!v;
      },
      consumeCancel() {
        const v = this._state?.edgeCancel;
        if (slot === 0 && kbEdge.cancel) kbEdge.cancel = false;
        return !!v;
      },
      consumeAttack() { return this.consumeShoot(); },
      captureNetworkInput() {
        const s = this._state;
        if (!s || slot !== 0) return null;
        const packet = {
          moveDir: { ...s.moveDir },
          aimDir: { ...s.aimDir },
          lastAimDir: { ...s.lastAimDir },
          sprint: !!s.sprint,
          shoot: !!s.edgeShoot,
          bomb: !!s.edgeBomb,
        };
        if (kbEdge.shoot) kbEdge.shoot = false;
        if (kbEdge.bomb) kbEdge.bomb = false;
        return packet;
      },
    };
    return input;
  }

  const player0 = createPlayerInput(0);
  const player1 = createPlayerInput(1);

  return {
    getPlayer(slot = 0) {
      return slot === 1 ? player1 : player0;
    },
    player0,
    player1,
  };
}
