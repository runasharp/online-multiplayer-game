require("dotenv").config();
const { dbUser, dbPass, dbHost, PORT, JWT_SECRET } = require("./server/config");
const { setupWebSocket } = require("./server/wsHandler");
const express = require("express");
const { authRoutes } = require("./server/routes/auth");
const { connectDB } = require("./server/db");
const { setupWS } = require("./server/wsManager");
const User = require("./server/models/User");
const { setupCoinUpdates } = require("./server/coinUpdater");

const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();

// Connect to MongoDB once
connectDB();

// Middlewares
app.use(express.json());
app.use(authRoutes({ User, JWT_SECRET }));
app.use(express.static("public"));

// HTTP routes
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login.html"));
});

app.get("/index.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login.html"));
});

// HTTP + WebSocket setup
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Player storage
let changedPlayers = new Set();

const { players, userConnections } = setupWebSocket({
  wss,
  User,
  JWT_SECRET,
  broadcast: (msg, excludeWs = null) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
        client.send(msg);
      }
    });
  },
});

const { broadcast } = setupWS({ wss, players, User }); // handles heartbeat, sync, and coin updates

setupCoinUpdates(User, players, broadcast);

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
