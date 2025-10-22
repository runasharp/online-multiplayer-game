require("dotenv").config();
const { dbUser, dbPass, dbHost, PORT, JWT_SECRET } = require("./server/config");
const { setupWebSocket } = require("./server/wsHandler");
const express = require("express");
const { authRoutes } = require("./server/routes/auth");

// define User first
const User = require("./server/models/User");

const http = require("http");
const WebSocket = require("ws");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
app.use(express.json());
app.use(authRoutes({ User, JWT_SECRET }));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const mongoose = require("mongoose");

const mongoURI = `mongodb+srv://${dbUser}:${dbPass}@${dbHost}/`;

let changedPlayers = new Set();

mongoose
  .connect(mongoURI + "user_data?retryWrites=true&w=majority", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use(bodyParser.json());

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login.html"));
});

app.get("/index.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// Middlewares
app.use(express.static("public"));

// Player storage

// Serve login page by default
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login.html"));
});

// --------------------
// WebSocket multiplayer with target-based movement
// --------------------

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

// Periodic position sync to correct any client drift (less frequent now)
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
}, 2000); // Sync every 2 seconds (reduced from 1s to avoid glitching)

// Heartbeat interval to detect dead sockets
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      console.log("Terminating dead socket:", ws.userId);
      ws.terminate(); // triggers 'close'
      return;
    }
    ws.isAlive = false;
    ws.ping(); // request pong from client
  });
}, 10000); // every 10 seconds

const userChangeStream = User.watch();

userChangeStream.on("change", (change) => {
  if (
    change.operationType === "update" &&
    change.updateDescription.updatedFields.coins !== undefined
  ) {
    const updatedUserId = change.documentKey._id.toString();
    const newCoins = change.updateDescription.updatedFields.coins;

    if (players[updatedUserId]) {
      players[updatedUserId].coins = newCoins;

      // Broadcast coin update
      const coinUpdate = {
        type: "update",
        players: {
          [updatedUserId]: {
            coins: newCoins,
            username: players[updatedUserId].username,
            x: players[updatedUserId].x,
            y: players[updatedUserId].y,
          },
        },
      };
      broadcast(JSON.stringify(coinUpdate));
    }
  }
});

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
