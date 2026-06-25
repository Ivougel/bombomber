/** Каталог предметов магазина */

const ITEM_SLOT = {
  PASSIVE: "passive",
  WEAPON: "weapon",
  BOMB: "bomb",
};

const SHOP_CATALOG = {
  aura_ring: {
    id: "aura_ring",
    name: "Кольцо ауры",
    emoji: "💫",
    slot: ITEM_SLOT.PASSIVE,
    price: 12,
    auraRadius: 72,
    auraDamage: 10,
    auraTick: 0.45,
    desc: "Пассивный урон вокруг · подсветка зоны",
  },
  blaster: {
    id: "blaster",
    name: "Бластер",
    emoji: "🔫",
    slot: ITEM_SLOT.WEAPON,
    price: 15,
    damage: 20,
    speed: 420,
    cooldown: 1.0,
    radius: 6,
    desc: "Стрельба по прицелу · Space · КД 1с",
  },
  bomb: {
    id: "bomb",
    name: "Бомба",
    emoji: "💣",
    slot: ITEM_SLOT.BOMB,
    price: 8,
    stackable: true,
    maxStack: 5,
    fuseTime: 2.2,
    blastRange: 5,
    damage: 40,
    desc: "Крест 5 клеток · B — установить",
  },
};

const SHOP_ITEM_ORDER = ["aura_ring", "blaster", "bomb"];

const START_GOLD = 40;
const MAX_DAMAGE_PER_HIT = 22;
const PLAYER_RESPAWN_TIME = 2.5;
const PLAYER_INVULN_TIME = 2.0;

function getItemDef(itemId) {
  return SHOP_CATALOG[itemId] || null;
}

function createEmptyLoadout() {
  return { passive: null, weapon: null, bombs: 0 };
}

function copyLoadout(loadout) {
  return {
    passive: loadout.passive,
    weapon: loadout.weapon,
    bombs: loadout.bombs || 0,
  };
}
