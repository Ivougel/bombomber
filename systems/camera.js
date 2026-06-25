/** Статичная камера — вся карта на экране, без следования за игроком */

function createCameraSystem() {
  return {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    pixelRatio: 1,
    mapPixelW: WORLD_W,
    mapPixelH: WORLD_H,
  };
}

function recalcCamera(camera, viewW, viewH, mapPixelW, mapPixelH) {
  camera.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  camera.mapPixelW = mapPixelW ?? WORLD_W;
  camera.mapPixelH = mapPixelH ?? WORLD_H;

  const scaleX = viewW / camera.mapPixelW;
  const scaleY = viewH / camera.mapPixelH;
  camera.scale = Math.max(scaleX, scaleY);
  camera.offsetX = (viewW - camera.mapPixelW * camera.scale) / 2;
  camera.offsetY = (viewH - camera.mapPixelH * camera.scale) / 2;
}

function applyWorldTransform(ctx, camera, pixelRatio) {
  const s = camera.scale * pixelRatio;
  ctx.setTransform(s, 0, 0, s, camera.offsetX * pixelRatio, camera.offsetY * pixelRatio);
  return { camX: 0, camY: 0, worldW: camera.mapPixelW, worldH: camera.mapPixelH };
}

function viewportClientPoint(screenX, screenY) {
  const vv = window.visualViewport;
  if (!vv) return { x: screenX, y: screenY };
  return {
    x: screenX - vv.offsetLeft,
    y: screenY - vv.offsetTop,
  };
}

function worldToScreen(camera, worldX, worldY) {
  return {
    x: worldX * camera.scale + camera.offsetX,
    y: worldY * camera.scale + camera.offsetY,
  };
}

function screenToWorld(camera, screenX, screenY) {
  const pt = viewportClientPoint(screenX, screenY);
  return {
    x: (pt.x - camera.offsetX) / camera.scale,
    y: (pt.y - camera.offsetY) / camera.scale,
  };
}
