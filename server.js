require("dotenv").config();

const wsUrlProduction = process.env.WS_URL_PRODUCTION;
const dbUser = process.env.DB_USER;
const dbPass = process.env.DB_PASSWORD;
const dbHost = process.env.DB_HOST;

const PORT = process.env.PORT || 3000;

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const path = require("path");

const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

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

    userConnections[id] = (userConnections[id] || 0) + 1;
    console.log(`User ${id} connected. Active tabs: ${userConnections[id]}`);

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
        x: 665.3, // default start if no previous data
        y: 322.4,
        username: user.username,
        coins: user.coins,
      };
    }

    // send initial state
    ws.send(JSON.stringify({ type: "init", players, id }));

    ws.on("message", (message) => {
      const data = JSON.parse(message);

      // handle target setting instead of continuous move updates
      if (data.type === "setTarget" && players[id]) {
        players[id].targetX = data.targetX;
        players[id].targetY = data.targetY;

        // Broadcast the new target to all clients
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
        broadcast(JSON.stringify(targetMsg));

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
      userConnections[id] = (userConnections[id] || 1) - 1;
      console.log(`User ${id} closed a tab. Remaining: ${userConnections[id]}`);

      if (userConnections[id] <= 0) {
        delete userConnections[id];
        if (players[id]) {
          delete players[id];
          broadcast(JSON.stringify({ type: "update", players }));
          console.log(`Player ${id} removed (last tab closed)`);
        }
      }
    });
  } catch (err) {
    console.error("Invalid JWT:", err);
    ws.close();
  }
});

// Periodic position sync to correct any client drift
// This sends the authoritative server positions every second
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
}, 1000); // Sync every 1 second

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
      changedPlayers.add(updatedUserId); // mark for delta update
    }
  }
});

function broadcast(msg) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
