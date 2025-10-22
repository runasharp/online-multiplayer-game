require("dotenv").config();
const { dbUser, dbPass, dbHost, PORT, JWT_SECRET } = require("./server/config");
console.log(dbUser, dbHost, PORT);

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const path = require("path");

const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
console.log("WebSocket attached to HTTP server");

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

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // hashed
  coins: { type: Number, default: 0 },
});

const User = mongoose.model("User", userSchema, "users");
app.use(bodyParser.json());

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login.html"));
});

app.get("/index.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// --------------------
// Registration endpoint
// --------------------
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).send({ error: "Missing fields" });

  try {
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).send({ error: "Username exists" });

    const hash = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hash });
    await user.save();

    res.send({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Server error" });
  }
});

// --------------------
// Login endpoint
// --------------------
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).send({ error: "Missing fields" });

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).send({ error: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).send({ error: "Wrong password" });

    const token = jwt.sign(
      { id: user._id, username: user.username },
      JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );

    res.send({ success: true, token });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Server error" });
  }
});

// Middlewares
app.use(express.static("public"));

// Player storage
let players = {};

// Serve login page by default
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login.html"));
});

// --------------------
// WebSocket multiplayer with target-based movement
// --------------------

const userConnections = {};
const speed = 5; // Must match client speed exactly

// Server-side movement simulation runs independently
function serverMoveLoop() {
  for (let id in players) {
    const p = players[id];

    // Skip if no target set
    if (p.targetX === undefined || p.targetY === undefined) continue;

    let dx = p.targetX - p.x;
    let dy = p.targetY - p.y;
    let dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < speed) {
      // Reached target
      p.x = p.targetX;
      p.y = p.targetY;
      p.targetX = undefined;
      p.targetY = undefined;
    } else {
      // Move towards target
      p.x += (dx / dist) * speed;
      p.y += (dy / dist) * speed;
    }
  }
}

// Run server movement at ~60fps to match client
setInterval(serverMoveLoop, 16); // approximately 60 times per second

wss.on("connection", async (ws, req) => {
  try {
    const urlParams = new URLSearchParams(req.url.split("?")[1]);
    const token = urlParams.get("token");
    if (!token) return ws.close();

    const payload = jwt.verify(token, JWT_SECRET);
    const username = payload.username;

    // Fetch user document from MongoDB to get coins
    const user = await User.findOne({ username });
    if (!user) return ws.close(); // safety check

    const id = user._id.toString(); // MongoDB _id as string
    ws.userId = id; // attach _id to ws for later reference

    userConnections[id] = userConnections[id] || [];
    userConnections[id].push(ws);
    console.log(
      `User ${id} connected. Active tabs: ${userConnections[id].length}`
    );

    ws.isAlive = true; // mark alive for heartbeat

    if (players[id]) {
      // restore existing player, keep previous x/y
      players[id].disconnected = false;
      players[id].username = user.username;
      players[id].coins = user.coins;
    } else {
      // new player
      players[id] = {
        _id: user._id,
        x: 665.3,
        y: 322.4,
        username: user.username,
        coins: user.coins,
      };
    }

    // send initial state with ALL players
    ws.send(JSON.stringify({ type: "init", players, id }));

    // Also broadcast to others that this player joined/reconnected
    const joinMsg = {
      type: "update",
      players: {
        [id]: {
          x: players[id].x,
          y: players[id].y,
          targetX: players[id].targetX,
          targetY: players[id].targetY,
          coins: players[id].coins,
          username: players[id].username,
        },
      },
    };
    broadcast(JSON.stringify(joinMsg), ws); // exclude sender

    ws.on("message", (message) => {
      const data = JSON.parse(message);

      // Handle target setting instead of continuous move updates
      if (data.type === "setTarget" && players[id]) {
        players[id].targetX = data.targetX;
        players[id].targetY = data.targetY;

        // Broadcast the new target to all OTHER clients
        const targetMsg = {
          type: "update",
          players: {
            [id]: {
              targetX: data.targetX,
              targetY: data.targetY,
              x: players[id].x,
              y: players[id].y,
              coins: players[id].coins,
              username: players[id].username,
            },
          },
        };
        broadcast(JSON.stringify(targetMsg), ws); // exclude sender

        console.log(
          `Player ${username} new target: x=${data.targetX.toFixed(
            1
          )}, y=${data.targetY.toFixed(1)}`
        );
      }

      if (data.type === "chat") {
        const chatMsg = { type: "chat", username, text: data.text };
        broadcast(JSON.stringify(chatMsg));
      }

      if (data.type === "disconnect" && players[id]) {
        delete players[id];
        broadcast(JSON.stringify({ type: "remove", playerId: id }));
        ws.close();
      }
    });

    // Mark socket alive on pong
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    // Remove player when socket closes
    ws.on("close", () => {
      if (!ws.userId) return;

      const id = ws.userId;
      const connections = userConnections[id];
      if (connections) {
        const index = connections.indexOf(ws);
        if (index > -1) connections.splice(index, 1);

        console.log(
          `User ${id} closed a tab. Remaining: ${connections.length}`
        );

        if (connections.length === 0) {
          delete userConnections[id];
          if (players[id]) {
            delete players[id];
            broadcast(JSON.stringify({ type: "remove", playerId: id }));
            console.log(`Player ${id} removed (last tab closed)`);
          }
        }
      }
    });
  } catch (err) {
    console.error("WebSocket connection error:", err);
    ws.close();
  }
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
