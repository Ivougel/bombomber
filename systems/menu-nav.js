/** Навигация по меню: геймпад + клавиатура */

function createMenuNav() {
  let focusIndex = 0;
  let lastNavAt = 0;
  let prevMenuButtons = {};
  const menuKeys = new Set();
  const NAV_COOLDOWN = 0.16;

  window.addEventListener("keydown", (e) => {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(e.code)) return;
    e.preventDefault();
    menuKeys.add(e.code);
  });
  window.addEventListener("keyup", (e) => menuKeys.delete(e.code));

  function getActiveOverlay() {
    return document.querySelector(".overlay:not(.hidden)");
  }

  function getFocusables() {
    const overlay = getActiveOverlay();
    if (!overlay) return [];
    return [...overlay.querySelectorAll(
      ".menu-focusable:not([disabled]), .class-card, .mode-card, .shop-item-card, .btn:not([disabled]), .btn-shop-buy:not([disabled])",
    )].filter((el) => {
      if (el.disabled) return false;
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    });
  }

  function applyFocus(index) {
    const items = getFocusables();
    if (!items.length) {
      focusIndex = 0;
      return;
    }
    focusIndex = ((index % items.length) + items.length) % items.length;
    items.forEach((el, i) => el.classList.toggle("gamepad-focus", i === focusIndex));
    items[focusIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function readMenuPad() {
    const pad = pollGamepad();
    if (!pad) {
      prevMenuButtons = {};
      return { dx: 0, dy: 0, confirm: false, back: false };
    }

    const btn = (i) => !!pad.buttons[i]?.pressed;
    let dx = 0;
    let dy = 0;

    if (btn(12)) dy = -1;
    if (btn(13)) dy = 1;
    if (btn(14)) dx = -1;
    if (btn(15)) dx = 1;

    const lx = applyDeadzone(pad.axes[0] ?? 0);
    const ly = applyDeadzone(pad.axes[1] ?? 0);
    if (!dx && !dy) {
      if (Math.abs(lx) > 0.55) dx = Math.sign(lx);
      else if (Math.abs(ly) > 0.55) dy = Math.sign(ly);
    }

    const held = { confirm: btn(0), back: btn(1) };
    const edge = {
      confirm: held.confirm && !prevMenuButtons.confirm,
      back: held.back && !prevMenuButtons.back,
    };
    prevMenuButtons = { ...held };

    return { dx, dy, confirm: edge.confirm, back: edge.back };
  }

  function moveFocus(dx, dy) {
    const items = getFocusables();
    if (!items.length) return;

    const current = items[focusIndex];
    const rect = current?.getBoundingClientRect();
    if (!rect) {
      applyFocus(focusIndex + (dy || dx));
      return;
    }

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let best = focusIndex;
    let bestScore = Infinity;

    items.forEach((el, i) => {
      if (i === focusIndex) return;
      const r = el.getBoundingClientRect();
      const ox = r.left + r.width / 2 - cx;
      const oy = r.top + r.height / 2 - cy;
      if (dx < 0 && ox >= -4) return;
      if (dx > 0 && ox <= 4) return;
      if (dy < 0 && oy >= -4) return;
      if (dy > 0 && oy <= 4) return;
      const score = Math.hypot(ox, oy);
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    });

    if (best !== focusIndex) applyFocus(best);
    else applyFocus(focusIndex + (dy || dx || 1));
  }

  function activateFocused() {
    const items = getFocusables();
    const el = items[focusIndex];
    if (!el) return;
    if (el.classList.contains("shop-item-card")) {
      el.querySelector(".btn-shop-buy")?.click();
      return;
    }
    el.click();
  }

  function update() {
    const items = getFocusables();
    if (!items.length) return;

    if (focusIndex >= items.length) applyFocus(0);
    if (!items[focusIndex]?.classList.contains("gamepad-focus")) applyFocus(focusIndex);

    const now = performance.now();
    const pad = readMenuPad();

    let dx = pad.dx;
    let dy = pad.dy;
    if (menuKeys.has("ArrowLeft")) dx = -1;
    if (menuKeys.has("ArrowRight")) dx = 1;
    if (menuKeys.has("ArrowUp")) dy = -1;
    if (menuKeys.has("ArrowDown")) dy = 1;

    if ((dx || dy) && now - lastNavAt > NAV_COOLDOWN * 1000) {
      moveFocus(dx, dy);
      lastNavAt = now;
    }

    if (pad.confirm || menuKeys.has("Enter")) activateFocused();
    if (pad.back) {
      if (match?.phase === "matchEnd") {
        document.getElementById("btn-new-game")?.click();
      } else if (match?.phase === "shop" && shopContext === "pregame") {
        closeShopOverlay();
        match.phase = "classSelect";
        showOverlay("class-overlay", true);
        showOverlay("shop-overlay", false);
        reset();
      }
    }
  }

  function reset() {
    focusIndex = 0;
    lastNavAt = 0;
    prevMenuButtons = {};
    requestAnimationFrame(() => applyFocus(0));
  }

  return { reset, refresh: () => applyFocus(focusIndex), update };
}
