/** Mine Ruins Duel — WebSocket сервер */

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { RoomManager } = require("./room");
const { startGameLoop } = require("./game-loop");

const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors({ origin: "*" }));
app.get("/", (_req, res) => {
  res.json({ ok: true, service: "mine-ruins-server" });
});
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const rooms = new RoomManager(io);

io.on("connection", (socket) => {
  socket.on("room:create", () => rooms.createRoom(socket));
  socket.on("room:join", (code) => rooms.joinRoom(socket, code));
  socket.on("player:input", (input) => rooms.handleInput(socket, input));
  socket.on("player:ready", () => rooms.handleReady(socket));
  socket.on("player:class", (klass) => rooms.handleClass(socket, klass));
  socket.on("shop:buy", (itemId) => rooms.handleShopBuy(socket, itemId));
  socket.on("backpack:update", (backpack) => rooms.handleBackpack(socket, backpack));
  socket.on("disconnect", () => rooms.leave(socket));
});

startGameLoop(rooms);

server.listen(PORT, () => {
  console.log(`Mine Ruins server listening on :${PORT}`);
});
