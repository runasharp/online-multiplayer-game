const jwt = require("jsonwebtoken");

function setupWebSocket({ wss, User, JWT_SECRET, broadcast }) {
  const players = {};
  const userConnections = {};
  const speed = 5;

  // Server-side movement simulation
  function serverMoveLoop() {
    for (let id in players) {
      const p = players[id];

      if (p.targetX === undefined || p.targetY === undefined) continue;

      let dx = p.targetX - p.x;
      let dy = p.targetY - p.y;
      let dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < speed) {
        p.x = p.targetX;
        p.y = p.targetY;
        p.targetX = undefined;
        p.targetY = undefined;
      } else {
        p.x += (dx / dist) * speed;
        p.y += (dy / dist) * speed;
      }
    }
  }

  setInterval(serverMoveLoop, 16); // ~60fps

  wss.on("connection", async (ws, req) => {
    try {
      const urlParams = new URLSearchParams(req.url.split("?")[1]);
      const token = urlParams.get("token");
      if (!token) return ws.close();

      const payload = jwt.verify(token, JWT_SECRET);
      const username = payload.username;

      const user = await User.findOne({ username });
      if (!user) return ws.close();

      const id = user._id.toString();
      ws.userId = id;

      userConnections[id] = userConnections[id] || [];
      userConnections[id].push(ws);
      ws.isAlive = true;

      if (players[id]) {
        players[id].disconnected = false;
        players[id].username = user.username;
        players[id].coins = user.coins;
        players[id].color = user.color;
      } else {
        players[id] = {
          _id: user._id,
          x: 665.3,
          y: 322.4,
          username: user.username,
          coins: user.coins,
          color: user.color,
        };
      }

      ws.send(JSON.stringify({ type: "init", players, id }));

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
            color: players[id].color || "green",
          },
        },
      };
      broadcast(JSON.stringify(joinMsg), ws);

      ws.on("message", (message) => {
        const data = JSON.parse(message);

        if (data.type === "setTarget" && players[id]) {
          players[id].targetX = data.targetX;
          players[id].targetY = data.targetY;

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
                color: players[id].color || "green",
              },
            },
          };
          broadcast(JSON.stringify(targetMsg), ws);
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

      ws.on("pong", () => (ws.isAlive = true));

      ws.on("close", () => {
        if (!ws.userId) return;

        const id = ws.userId;
        const connections = userConnections[id];
        if (connections) {
          const index = connections.indexOf(ws);
          if (index > -1) connections.splice(index, 1);

          if (connections.length === 0) {
            delete userConnections[id];
            if (players[id]) {
              delete players[id];
              broadcast(JSON.stringify({ type: "remove", playerId: id }));
            }
          }
        }
      });
    } catch (err) {
      console.error("WebSocket connection error:", err);
      ws.close();
    }
  });

  return { players, userConnections };
}

module.exports = { setupWebSocket };
