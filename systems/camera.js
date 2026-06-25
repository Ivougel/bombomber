/** Камера: solo fullscreen (desktop/mobile), задел под split/shared */

function createCameraSystem() {
  return {
    scale: 1,
    pixelRatio: 1,
    profile: null,
    layout: LAYOUT.SOLO_FULLSCREEN,
    viewport: {
      camX: 0,
      camY: 0,
      leadX: 0,
      leadY: 0,
      viewW: VIEWPORT_DESIGN_W,
      viewH: VIEWPORT_DESIGN_H,
      zoom: 1,
    },
    /** @future versus split — [{ camX, camY, leadX, leadY }] */
    splitViewports: null,
  };
}

function recalcCamera(camera, viewportW, viewportH) {
  camera.profile = detectDisplayProfile(viewportW, viewportH);
  camera.layout = getActiveLayout(camera.profile);
  camera.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  syncDisplayDataset(camera.profile, camera.layout);

  const { designW, designH } = camera.profile;
  camera.scale = Math.min(viewportW / designW, viewportH / designH);
}

function updateCameras(camera, players, dt, viewportW, viewportH) {
  switch (camera.layout) {
    case LAYOUT.SOLO_FULLSCREEN:
      updateSoloCamera(camera, players[0], dt, viewportW, viewportH);
      break;
    case LAYOUT.SPLIT_HORIZONTAL:
      updateSplitCamera(camera, players, dt, viewportW, viewportH);
      break;
    case LAYOUT.SHARED_MOBILE:
      updateSharedMobileCamera(camera, players, dt, viewportW, viewportH);
      break;
    default:
      updateSoloCamera(camera, players[0], dt, viewportW, viewportH);
  }
}

function updateSoloCamera(camera, player, dt, viewportW, viewportH) {
  if (!player) return;

  const lead = camera.profile?.cameraLead ?? 40;
  const viewW = viewportW / camera.scale;
  const viewH = viewportH / camera.scale;
  const vp = camera.viewport;

  const targetX = player.x + player.aimDir.x * lead;
  const targetY = player.y + player.aimDir.y * lead;
  vp.leadX += (targetX - vp.leadX) * Math.min(1, dt * 6);
  vp.leadY += (targetY - vp.leadY) * Math.min(1, dt * 6);

  let camX = -vp.leadX + viewW * 0.5;
  let camY = -vp.leadY + viewH * 0.5;
  camX = Math.min(0, Math.max(camX, viewW - WORLD_W));
  camY = Math.min(0, Math.max(camY, viewH - WORLD_H));

  vp.camX = camX;
  vp.camY = camY;
  vp.viewW = viewW;
  vp.viewH = viewH;
  vp.zoom = 1;
}

/** @future — горизонтальный сплит для versus на десктопе */
function updateSplitCamera(camera, players, dt, viewportW, viewportH) {
  updateSoloCamera(camera, players[0], dt, viewportW, viewportH);
}

/** @future — общая камера с зумом для versus на телефоне */
function updateSharedMobileCamera(camera, players, dt, viewportW, viewportH) {
  const alive = players.filter((p) => p?.alive);
  if (!alive.length) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of alive) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  const pad = 80;
  const spanX = maxX - minX + pad * 2;
  const spanY = maxY - minY + pad * 2;
  const viewW = viewportW / camera.scale;
  const viewH = viewportH / camera.scale;
  const minZoom = camera.profile?.minZoom ?? MOBILE_MIN_ZOOM;

  let zoom = Math.min(viewW / spanX, viewH / spanY, 1);
  zoom = Math.max(zoom, minZoom);

  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const vp = camera.viewport;
  const targetCamX = -cx * zoom + viewW * 0.5;
  const targetCamY = -cy * zoom + viewH * 0.5;

  vp.zoom += (zoom - vp.zoom) * Math.min(1, dt * 4);
  vp.camX += (targetCamX - vp.camX) * Math.min(1, dt * 5);
  vp.camY += (targetCamY - vp.camY) * Math.min(1, dt * 5);
  vp.viewW = viewW / vp.zoom;
  vp.viewH = viewH / vp.zoom;
}

function getCameraTransform(camera) {
  const vp = camera.viewport;
  const zoom = vp.zoom ?? 1;
  return {
    scale: camera.scale * zoom,
    camX: vp.camX,
    camY: vp.camY,
    worldW: vp.viewW,
    worldH: vp.viewH,
  };
}

function applyWorldTransform(ctx, camera, pixelRatio) {
  const t = getCameraTransform(camera);
  const s = t.scale * pixelRatio;
  ctx.setTransform(s, 0, 0, s, t.camX * s, t.camY * s);
  return { camX: t.camX, camY: t.camY, worldW: t.worldW, worldH: t.worldH };
}

function screenToWorld(camera, screenX, screenY) {
  const t = getCameraTransform(camera);
  return {
    x: (screenX - t.camX * t.scale) / t.scale,
    y: (screenY - t.camY * t.scale) / t.scale,
  };
}
