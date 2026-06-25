/** Polling геймпада — до двух падов для hotseat */

const GP_DEADZONE = 0.15;
const prevButtons = [{}, {}];

function pollGamepad(index = 0) {
  const pads = navigator.getGamepads?.();
  if (!pads) return null;
  const connected = [];
  for (const pad of pads) {
    if (pad?.connected) connected.push(pad);
  }
  return connected[index] ?? null;
}

function applyDeadzone(v) {
  if (Math.abs(v) < GP_DEADZONE) return 0;
  const sign = v < 0 ? -1 : 1;
  return sign * (Math.abs(v) - GP_DEADZONE) / (1 - GP_DEADZONE);
}

function readGamepadState(padIndex = 0) {
  const pad = pollGamepad(padIndex);
  if (!pad) {
    prevButtons[padIndex] = {};
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
  const prev = prevButtons[padIndex] || {};
  const edge = {
    shoot: held.shoot && !prev.shoot,
    bomb: held.bomb && !prev.bomb,
    backpack: held.backpack && !prev.backpack,
    cancel: held.cancel && !prev.cancel,
    zoom: held.zoom && !prev.zoom,
  };
  prevButtons[padIndex] = { ...held };

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
