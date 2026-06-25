/** Режим игры и раскладка экрана (solo сейчас, versus — позже) */

const GAME_MODE = {
  SOLO: "solo",
  VERSUS: "versus",
};

const MATCH_MODE = {
  SOLO: "solo",
  VS_BOTS: "vs_bots",
};

/** Активный режим — переключить на VERSUS когда добавим сплит */
const ACTIVE_GAME_MODE = GAME_MODE.SOLO;

const LAYOUT = {
  SOLO_FULLSCREEN: "solo-fullscreen",
  SPLIT_HORIZONTAL: "split-horizontal",
  SHARED_MOBILE: "shared-mobile",
};

const DISPLAY_PROFILES = {
  desktop: {
    id: "desktop",
    designW: 960,
    designH: 540,
    cameraLead: 48,
    hudSafeTop: 52,
  },
  mobile: {
    id: "mobile",
    designW: 480,
    designH: 360,
    cameraLead: 32,
    minZoom: 0.5,
    hudSafeTop: 44,
  },
};

function isCoarsePointer() {
  return window.matchMedia("(pointer: coarse)").matches
    && !window.matchMedia("(pointer: fine)").matches;
}

function detectDisplayProfile(viewportW, viewportH) {
  const narrow = viewportW < 768;
  const phone = narrow || (isCoarsePointer() && viewportW < 1024);
  return { ...(phone ? DISPLAY_PROFILES.mobile : DISPLAY_PROFILES.desktop) };
}

function getActiveLayout(profile) {
  if (ACTIVE_GAME_MODE === GAME_MODE.SOLO) {
    return LAYOUT.SOLO_FULLSCREEN;
  }
  if (profile.id === "mobile") {
    return LAYOUT.SHARED_MOBILE;
  }
  return LAYOUT.SPLIT_HORIZONTAL;
}

function isSoloMode() {
  return ACTIVE_GAME_MODE === GAME_MODE.SOLO;
}

function isVsBotsMode(match) {
  return match?.matchMode === MATCH_MODE.VS_BOTS;
}

function getMatchModeLabel(matchMode) {
  if (matchMode === MATCH_MODE.VS_BOTS) return "Против ботов";
  return "Solo забег";
}

function getActivePlayerCount() {
  return isSoloMode() ? 1 : 2;
}

function syncDisplayDataset(profile, layout) {
  document.documentElement.dataset.gameMode = ACTIVE_GAME_MODE;
  document.documentElement.dataset.display = profile.id;
  document.documentElement.dataset.layout = layout;
}
