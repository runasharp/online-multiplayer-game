require("dotenv").config();
const { dbUser, dbPass, dbHost, PORT, JWT_SECRET } = require("./server/config");
const { setupWebSocket } = require("./server/wsHandler");
const express = require("express");
const { authRoutes } = require("./server/routes/auth");
const { connectDB } = require("./server/db");

// import User model (already uses mongoose instance from db.js)
const User = require("./server/models/User");

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

// Periodic position sync to correct client drift
setInterval(() => {
  if (Object.keys(players).length > 0) {
    const syncPayload = { type: "update", players: {} };
    for (let pid in players) {
      const p = players[pid];
      syncPayload.players[pid] = {
        x: p.x,
        y: p.y,
        targetX: p.targetX,
        targetY: p.targetY,
        coins: p.coins,
        username: p.username,
      };
    }
    broadcast(JSON.stringify(syncPayload));
  }
}, 2000);

// Heartbeat to detect dead sockets
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      console.log("Terminating dead socket:", ws.userId);
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 10000);

// Coin update via MongoDB change stream
const userChangeStream = User.watch();

userChangeStream.on("change", (change) => {
  if (
    change.operationType === "update" &&
    change.updateDescription.updatedFields.coins !== undefined
  ) {
    const updatedUserId = change.documentKey._id.toString();
    const newCoins = change.updateDescription.updatedFields.coins;

    // Always broadcast coin update, include x/y/username if available
    const coinUpdate = {
      type: "update",
      players: {
        [updatedUserId]: {
          coins: newCoins,
          username: players[updatedUserId]?.username || "Unknown",
          x: players[updatedUserId]?.x || 0,
          y: players[updatedUserId]?.y || 0,
        },
      },
    };
    broadcast(JSON.stringify(coinUpdate));

    // Update local players object if the player exists
    if (players[updatedUserId]) {
      players[updatedUserId].coins = newCoins;
    }
  }
});

// Broadcast helper
function broadcast(msg, excludeWs = null) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
      client.send(msg);
    }
  });
}

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
