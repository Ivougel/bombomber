/** Комната мультиплеера */

const { loadGameCore } = require("./load-core");
const { startRoundOnRoom, serializeGameState } = require("./simulation");

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const NET_START_GOLD = 40;

function randomCode() {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return s;
}

class Room {
  constructor(id, hostSocketId) {
    this.id = id;
    this.seed = Math.floor(Math.random() * 1e9);
    this.hostSocketId = hostSocketId;
    this.players = new Map();
    this.phase = "waiting";
    this.round = 0;
    this.timeLeft = 0;
    this.mobs = [];
    this.projectiles = [];
    this.bombs = [];
    this.entities = [];
    this.map = null;
    this.tick = 0;
    this.tilePatches = [];
    this.fogPatches = [];
    this.fogState = null;
    this.effects = null;
  }

  playersBySlot(slot) {
    for (const p of this.players.values()) {
      if (p.slot === slot) return p;
    }
    return null;
  }

  isFull() {
    return this.players.size >= 2;
  }

  addPlayer(socketId, name) {
    const slot = this.players.size;
    const G = loadGameCore();
    const pl = {
      socketId,
      slot,
      name: name || `Player ${slot + 1}`,
      class: slot === 0 ? "miner" : "scout",
      ready: false,
      gold: NET_START_GOLD,
      loadout: G.createEmptyLoadout(),
      pendingInput: null,
      state: null,
      entity: null,
    };
    this.players.set(socketId, pl);
    return pl;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  allReady() {
    if (this.players.size < 2) return false;
    for (const p of this.players.values()) {
      if (!p.ready) return false;
    }
    return true;
  }

  resetReady() {
    for (const p of this.players.values()) {
      p.ready = false;
    }
  }

  toJoinedPayload(socketId) {
    const pl = this.players.get(socketId);
    return {
      code: this.id,
      seed: this.seed,
      slot: pl?.slot ?? 0,
      isHost: socketId === this.hostSocketId,
      phase: this.phase,
      players: serializeGameState(this).lobby,
    };
  }
}

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.socketToRoom = new Map();
  }

  getRoom(socket) {
    const id = this.socketToRoom.get(socket.id);
    return id ? this.rooms.get(id) : null;
  }

  emitRoomJoined(room) {
    for (const socketId of room.players.keys()) {
      const peer = this.io.sockets.sockets.get(socketId);
      if (peer) peer.emit("room:joined", room.toJoinedPayload(socketId));
    }
  }

  createRoom(socket) {
    if (this.socketToRoom.has(socket.id)) return;
    let code;
    do {
      code = randomCode();
    } while (this.rooms.has(code));

    const room = new Room(code, socket.id);
    room.addPlayer(socket.id);
    this.rooms.set(code, room);
    this.socketToRoom.set(socket.id, code);
    socket.join(code);
    socket.emit("room:joined", room.toJoinedPayload(socket.id));
  }

  joinRoom(socket, code) {
    const roomId = String(code || "").toUpperCase().trim();
    const room = this.rooms.get(roomId);
    if (!room) {
      socket.emit("room:error", { message: "Комната не найдена" });
      return;
    }
    if (room.isFull()) {
      socket.emit("room:error", { message: "Комната заполнена" });
      return;
    }
    if (this.socketToRoom.has(socket.id)) {
      socket.emit("room:error", { message: "Вы уже в комнате" });
      return;
    }

    room.addPlayer(socket.id);
    this.socketToRoom.set(socket.id, roomId);
    socket.join(roomId);

    this.emitRoomJoined(room);
    if (room.isFull()) {
      room.phase = "pregame";
      const G = loadGameCore();
      for (const p of room.players.values()) {
        p.gold = NET_START_GOLD;
        p.loadout = G.createEmptyLoadout();
        p.ready = false;
      }
      this.io.to(roomId).emit("room:ready", {
        code: roomId,
        seed: room.seed,
        players: serializeGameState(room).lobby,
      });
    }
  }

  handleInput(socket, input) {
    const room = this.getRoom(socket);
    if (!room || room.phase !== "playing") return;
    const pl = room.players.get(socket.id);
    if (!pl) return;
    pl.pendingInput = input;
  }

  handleReady(socket) {
    const room = this.getRoom(socket);
    if (!room) return;
    const pl = room.players.get(socket.id);
    if (!pl) return;
    pl.ready = true;

    const lobby = serializeGameState(room).lobby;
    this.io.to(room.id).emit("game:state", { lobby, phase: room.phase });

    if (room.phase === "pregame" && room.allReady()) {
      this.startRound(room);
    } else if (room.phase === "intermission" && room.allReady()) {
      room.round++;
      this.startRound(room);
    }
  }

  handleClass(socket, klass) {
    const room = this.getRoom(socket);
    if (!room) return;
    const pl = room.players.get(socket.id);
    if (!pl) return;
    pl.class = klass;
    this.broadcastLobby(room);
  }

  handleShopBuy(socket, itemId) {
    const room = this.getRoom(socket);
    if (!room) return;
    const pl = room.players.get(socket.id);
    if (!pl) return;
    const G = loadGameCore();
    const def = G.getItemDef(itemId);
    if (!def || pl.gold < def.price) return;

    if (def.slot === "detonator") {
      if (pl.loadout.hasBombs) return;
      pl.gold -= def.price;
      pl.loadout.hasBombs = true;
    } else if (pl.loadout[def.slot] === itemId) {
      return;
    } else {
      pl.gold -= def.price;
      pl.loadout[def.slot] = itemId;
    }
    this.broadcastLobby(room);
  }

  handleBackpack(socket, backpack) {
    const room = this.getRoom(socket);
    if (!room) return;
    const pl = room.players.get(socket.id);
    if (!pl || !pl.state) return;
    pl.state.backpack = Array.isArray(backpack) ? backpack : [];
    this.broadcastLobby(room);
  }

  startRound(room) {
    room.resetReady();
    if (room.round === 0) room.round = 1;
    room.phase = "playing";
    room.seed = Math.floor(Math.random() * 1e9);
    startRoundOnRoom(room);
    this.io.to(room.id).emit("round:start", {
      round: room.round,
      seed: room.seed,
      timeLeft: room.timeLeft,
    });
    this.io.to(room.id).emit("game:state", serializeGameState(room));
    room.fogPatches = [];
  }

  broadcastLobby(room) {
    this.io.to(room.id).emit("game:state", {
      lobby: serializeGameState(room).lobby,
      phase: room.phase,
      seed: room.seed,
      code: room.id,
    });
  }

  leave(socket) {
    const room = this.getRoom(socket);
    if (!room) return;
    const code = room.id;
    room.removePlayer(socket.id);
    this.socketToRoom.delete(socket.id);
    socket.leave(code);

    if (room.players.size === 0) {
      this.rooms.delete(code);
    } else {
      room.phase = "waiting";
      room.resetReady();
      this.emitRoomJoined(room);
    }
  }

  tickAll(dt) {
    for (const room of this.rooms.values()) {
      if (room.phase !== "playing") continue;
      const { simTick } = require("./simulation");
      const events = simTick(room, dt);
      this.io.to(room.id).emit("game:state", serializeGameState(room));
      room.fogPatches = [];
      for (const ev of events) {
        this.io.to(room.id).emit("game:event", ev);
        if (ev.type === "round_end") {
          room.phase = "intermission";
          room.resetReady();
          this.io.to(room.id).emit("round:end", {
            round: room.round,
            stats: serializeGameState(room).players,
          });
        }
      }
    }
  }
}

module.exports = { Room, RoomManager };
