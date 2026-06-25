/** Лёгкий polling геймпада для solo */

const GP_DEADZONE = 0.15;
let activePad = null;
let prevButtons = {};

function pollGamepad() {
  const pads = navigator.getGamepads?.();
  if (!pads) return null;
  for (const pad of pads) {
    if (pad?.connected) return pad;
  }
  return null;
}

function applyDeadzone(v) {
  if (Math.abs(v) < GP_DEADZONE) return 0;
  const sign = v < 0 ? -1 : 1;
  return sign * (Math.abs(v) - GP_DEADZONE) / (1 - GP_DEADZONE);
}

function readGamepadState() {
  const pad = pollGamepad();
  activePad = pad;
  if (!pad) {
    prevButtons = {};
    return {
      connected: false,
      moveDir: { x: 0, y: 0 },
      aimDir: { x: 0, y: 0 },
      sprint: false,
      edgeShoot: false,
      edgeBomb: false,
      edgeBackpack: false,
      edgeCancel: false,
      edgeZoom: false,
    };
  }

  const lx = applyDeadzone(pad.axes[0] ?? 0);
  const ly = applyDeadzone(pad.axes[1] ?? 0);
  const rx = applyDeadzone(pad.axes[2] ?? 0);
  const ry = applyDeadzone(pad.axes[3] ?? 0);

  const btn = (i) => !!pad.buttons[i]?.pressed;
  const held = {
    sprint: btn(10),
    shoot: btn(7),
    bomb: btn(5),
    backpack: btn(3),
    zoom: btn(4),
    cancel: btn(1),
  };
  const edge = {
    shoot: held.shoot && !prevButtons.shoot,
    bomb: held.bomb && !prevButtons.bomb,
    backpack: held.backpack && !prevButtons.backpack,
    cancel: held.cancel && !prevButtons.cancel,
    zoom: held.zoom && !prevButtons.zoom,
  };
  prevButtons = { ...held };

  return {
    connected: true,
    moveDir: normalizeDir(lx, ly),
    aimDir: normalizeDir(rx, ry),
    sprint: held.sprint,
    edgeShoot: edge.shoot,
    edgeBomb: edge.bomb,
    edgeBackpack: edge.backpack,
    edgeCancel: edge.cancel,
    edgeZoom: edge.zoom,
  };
}
