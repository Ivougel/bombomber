/** Клиентский WebSocket слой (socket.io) */

const SERVER_URL_KEY = "bombomber_server_url";
const DEFAULT_PROD_SERVER = "https://bombomber-ivougel.loca.lt";

function resolveServerUrl() {
  if (typeof window === "undefined") return "";

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("server");
  if (fromQuery) {
    try {
      localStorage.setItem(SERVER_URL_KEY, fromQuery);
    } catch (_) {}
    return fromQuery.replace(/\/$/, "");
  }

  try {
    const stored = localStorage.getItem(SERVER_URL_KEY);
    if (stored) return stored.replace(/\/$/, "");
  } catch (_) {}

  const { hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:3000";
  }

  return DEFAULT_PROD_SERVER;
}

const SERVER_URL = resolveServerUrl();

function createNetwork() {
  let socket = null;
  let connected = false;
  let roomCode = null;
  let slot = 0;
  let host = false;
  let seed = 0;
  let phase = "offline";
  let latestState = null;
  let prevState = null;
  let stateTime = 0;
  let lobby = [];
  const stateHandlers = [];
  const eventHandlers = [];
  const joinHandlers = [];
  const readyHandlers = [];
  const roundHandlers = { start: [], end: [] };
  const errorHandlers = [];

  function connect() {
    if (socket || typeof io === "undefined") return;
    socket = io(SERVER_URL, { transports: ["websocket", "polling"], autoConnect: true });

    socket.on("connect", () => {
      connected = true;
    });
    socket.on("disconnect", () => {
      connected = false;
    });
    socket.on("room:joined", (payload) => {
      roomCode = payload.code;
      slot = payload.slot;
      host = !!payload.isHost;
      seed = payload.seed;
      phase = payload.phase;
      lobby = payload.players || [];
      joinHandlers.forEach((cb) => cb(payload));
    });
    socket.on("room:ready", (payload) => {
      phase = "pregame";
      seed = payload.seed;
      lobby = payload.players || [];
      readyHandlers.forEach((cb) => cb(payload));
    });
    socket.on("room:error", (err) => {
      errorHandlers.forEach((cb) => cb(err));
    });
    socket.on("room:player_left", (payload) => {
      lobby = payload.players || [];
      phase = lobby.length >= 2 ? "pregame" : "waiting";
      joinHandlers.forEach((cb) => cb({
        code: roomCode,
        slot,
        isHost: host,
        seed,
        phase,
        players: lobby,
      }));
    });
    socket.on("game:state", (state) => {
      prevState = latestState;
      latestState = state;
      stateTime = performance.now();
      if (state.lobby) lobby = state.lobby;
      if (state.seed) seed = state.seed;
    if (state.phase) phase = state.phase;
      stateHandlers.forEach((cb) => cb(state, prevState));
    });
    socket.on("game:event", (ev) => {
      eventHandlers.forEach((cb) => cb(ev));
    });
    socket.on("round:start", (payload) => {
      phase = "playing";
      seed = payload.seed;
      roundHandlers.start.forEach((cb) => cb(payload));
    });
    socket.on("round:end", (payload) => {
      phase = "intermission";
      roundHandlers.end.forEach((cb) => cb(payload));
    });
  }

  function whenConnected(cb) {
    connect();
    if (!socket) {
      errorHandlers.forEach((fn) => fn({ message: "Сеть недоступна (socket.io не загрузился)" }));
      return;
    }
    if (connected) {
      cb();
      return;
    }
    socket.once("connect", cb);
    socket.once("connect_error", (err) => {
      const hint = SERVER_URL.includes("loca.lt")
        ? " Хост должен запустить сервер и туннель (scripts/start-network.sh)."
        : "";
      errorHandlers.forEach((fn) => fn({
        message: (err?.message || "Не удалось подключиться к серверу") + hint,
      }));
    });
  }

  function createRoom() {
    whenConnected(() => socket.emit("room:create"));
  }

  function joinRoom(code) {
    whenConnected(() => socket.emit("room:join", code));
  }

  function sendInput(input) {
    if (!connected || !socket) return;
    socket.emit("player:input", input);
  }

  function sendReady() {
    if (!connected || !socket) return;
    socket.emit("player:ready");
  }

  function sendClass(klass) {
    if (!connected || !socket) return;
    socket.emit("player:class", klass);
  }

  function sendShopBuy(itemId) {
    if (!connected || !socket) return;
    socket.emit("shop:buy", itemId);
  }

  function sendBackpackUpdate(backpack) {
    if (!connected || !socket) return;
    socket.emit("backpack:update", backpack);
  }

  function onGameState(cb) {
    stateHandlers.push(cb);
    return () => stateHandlers.splice(stateHandlers.indexOf(cb), 1);
  }

  function onGameEvent(cb) {
    eventHandlers.push(cb);
    return () => eventHandlers.splice(eventHandlers.indexOf(cb), 1);
  }

  function onJoined(cb) {
    joinHandlers.push(cb);
    return () => joinHandlers.splice(joinHandlers.indexOf(cb), 1);
  }

  function onRoomReady(cb) {
    readyHandlers.push(cb);
    return () => readyHandlers.splice(readyHandlers.indexOf(cb), 1);
  }

  function onRoundStart(cb) {
    roundHandlers.start.push(cb);
    return () => roundHandlers.start.splice(roundHandlers.start.indexOf(cb), 1);
  }

  function onRoundEnd(cb) {
    roundHandlers.end.push(cb);
    return () => roundHandlers.end.splice(roundHandlers.end.indexOf(cb), 1);
  }

  function onError(cb) {
    errorHandlers.push(cb);
    return () => errorHandlers.splice(errorHandlers.indexOf(cb), 1);
  }

  function isConnected() {
    return connected && !!roomCode;
  }

  function isHost() {
    return host;
  }

  function getSlot() {
    return slot;
  }

  function getRoomCode() {
    return roomCode;
  }

  function getSeed() {
    return seed;
  }

  function getPhase() {
    return phase;
  }

  function getLobby() {
    return lobby;
  }

  function getLatestState() {
    return latestState;
  }

  function getStateAlpha() {
    if (!latestState) return 1;
    const tickMs = typeof NETWORK_TICK_MS !== "undefined" ? NETWORK_TICK_MS : 33;
    return Math.min(1, (performance.now() - stateTime) / tickMs);
  }

  function getExtrapolateSec() {
    return Math.max(0, (performance.now() - stateTime) / 1000);
  }

  function getPrevState() {
    return prevState;
  }

  function interpolateRemotePlayer(alpha) {
    if (!latestState?.players) return null;
    const remoteSlot = slot === 0 ? 1 : 0;
    const t = Math.min(1, alpha ?? getStateAlpha());
    return interpolatePlayers(prevState?.players, latestState.players, remoteSlot, t);
  }

  function leaveRoom() {
    if (socket?.connected) socket.disconnect();
    socket = null;
    connected = false;
    roomCode = null;
    slot = 0;
    host = false;
    phase = "offline";
    lobby = [];
    latestState = null;
    prevState = null;
  }

  function disconnect() {
    leaveRoom();
  }

  return {
    SERVER_URL,
    connect,
    createRoom,
    joinRoom,
    sendInput,
    sendReady,
    sendClass,
    sendShopBuy,
    sendBackpackUpdate,
    onGameState,
    onGameEvent,
    onJoined,
    onRoomReady,
    onRoundStart,
    onRoundEnd,
    onError,
    isConnected,
    isHost,
    getSlot,
    getRoomCode,
    getSeed,
    getPhase,
    getLobby,
    getLatestState,
    getPrevState,
    getStateAlpha,
    getExtrapolateSec,
    interpolateRemotePlayer,
    leaveRoom,
    disconnect,
  };
}
