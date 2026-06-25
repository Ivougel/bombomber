/** Магазин и рюкзак перед боем / между раундами */

function renderShopOverlay(player, options = {}) {
  const el = document.getElementById("shop-content");
  if (!el) return;

  const { title = "🛒 Магазин", showStart = true, startLabel = "В бой!" } = options;
  const loadout = player.loadout;
  const passive = loadout.passive ? getItemDef(loadout.passive) : null;
  const weapon = loadout.weapon ? getItemDef(loadout.weapon) : null;

  const itemCards = SHOP_ITEM_ORDER.map((id) => {
    const def = SHOP_CATALOG[id];
    const owned = id === "bomb"
      ? loadout.bombs > 0
      : loadout[def.slot] === id;
    const canBuy = id === "bomb"
      ? player.gold >= def.price && loadout.bombs < def.maxStack
      : player.gold >= def.price && (!loadout[def.slot] || loadout[def.slot] !== id);

    return `
      <div class="shop-item-card ${owned ? "owned" : ""}" data-buy="${id}">
        <div class="shop-item-head">
          <span class="shop-item-emoji">${def.emoji}</span>
          <strong>${def.name}</strong>
        </div>
        <p class="shop-item-desc">${def.desc}</p>
        <div class="shop-item-foot">
          <span class="shop-price">💰 ${def.price}</span>
          <button type="button" class="btn-shop-buy" data-buy="${id}" ${canBuy ? "" : "disabled"}>
            ${id === "bomb" && loadout.bombs > 0 ? `+1 (${loadout.bombs}/${def.maxStack})` : "Купить"}
          </button>
        </div>
      </div>
    `;
  }).join("");

  el.innerHTML = `
    <h2>${title}</h2>
    <p class="shop-gold">💰 Золото: <strong id="shop-gold-val">${player.gold}</strong></p>

    <div class="loadout-panel">
      <h3>Экипировка</h3>
      <div class="loadout-slots">
        <div class="loadout-slot">
          <span class="slot-label">Пассив</span>
          <span class="slot-value">${passive ? `${passive.emoji} ${passive.name}` : "—"}</span>
        </div>
        <div class="loadout-slot">
          <span class="slot-label">Оружие</span>
          <span class="slot-value">${weapon ? `${weapon.emoji} ${weapon.name}` : "—"}</span>
        </div>
        <div class="loadout-slot">
          <span class="slot-label">Бомбы</span>
          <span class="slot-value">${loadout.bombs > 0 ? `💣 ×${loadout.bombs}` : "—"}</span>
        </div>
      </div>
    </div>

    <div class="shop-grid">${itemCards}</div>

    ${showStart ? `<button type="button" class="btn" id="btn-shop-start">${startLabel}</button>` : ""}
  `;
}

function tryBuyItem(player, itemId) {
  const def = getItemDef(itemId);
  if (!def || player.gold < def.price) return false;

  if (def.slot === ITEM_SLOT.BOMB) {
    if (player.loadout.bombs >= def.maxStack) return false;
    player.gold -= def.price;
    player.loadout.bombs++;
    return true;
  }

  if (player.loadout[def.slot] === itemId) return false;
  player.gold -= def.price;
  player.loadout[def.slot] = itemId;
  return true;
}

function bindShopEvents(onBuy, onStart) {
  const root = document.getElementById("shop-overlay");
  if (!root || root.dataset.bound) return;
  root.dataset.bound = "1";

  root.addEventListener("click", (e) => {
    const buyId = e.target.closest("[data-buy]")?.dataset?.buy;
    if (buyId && e.target.closest(".shop-item-card, .btn-shop-buy")) {
      onBuy(buyId);
      return;
    }
    if (e.target.id === "btn-shop-start") onStart();
  });
}

function openShopOverlay(player, options) {
  renderShopOverlay(player, options);
  showOverlay("shop-overlay", true);
}

function closeShopOverlay() {
  showOverlay("shop-overlay", false);
}
