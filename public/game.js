const game = document.getElementById("game");
let myId;
let players = {};
let target = null;
const speed = 5; // pixels per frame

// Get username from URL query string
const urlParams = new URLSearchParams(window.location.search);
const myUsername = urlParams.get("username") || "Guest";

// get JWT token from query string
const token = urlParams.get("token");
console.log("Token from URL:", token);
if (!token) {
  window.location.href = "/login";
}

// Determine WebSocket URL based on MODE
const protocol = window.location.protocol === "https:" ? "wss" : "ws";
const host = window.location.hostname;
const port = window.location.port ? `:${window.location.port}` : ""; // optional local port
let wsUrl = `${protocol}://${host}${port}/?token=${token}`;

console.log("Connecting WebSocket to:", wsUrl);

// Create WebSocket and attach globally
const ws = new WebSocket(wsUrl);
window.ws = ws;

ws.onopen = () => console.log("WebSocket opened");
ws.onclose = (e) => console.warn("WebSocket closed", e);
ws.onerror = (e) => console.error("WebSocket error", e);

ws.onmessage = (msg) => {
  console.log("Received message from server:", msg.data);
  const data = JSON.parse(msg.data);

  if (data.type === "init") {
    myId = data.id;
    players = data.players;
    console.log("Init received:", data);
    renderPlayers();
  }
  if (data.type === "update") {
    players = data.players;
    console.log("Update received:", players);
    renderPlayers();
  }
};

// Click to move
game.addEventListener("click", (e) => {
  const rect = game.getBoundingClientRect();
  target = {
    x: e.clientX - rect.left - 10,
    y: e.clientY - rect.top - 10,
  };

  // теперь сработает корректно после первого сообщения
  if (window.chatActive) {
    setTimeout(() => chatInput.focus(), 0);
  }
});

function moveLoop() {
  if (players[myId] && target) {
    let p = players[myId];
    let dx = target.x - p.x;
    let dy = target.y - p.y;
    let dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < speed) {
      p.x = target.x;
      p.y = target.y;
      target = null;
    } else {
      p.x += (dx / dist) * speed;
      p.y += (dy / dist) * speed;
    }

    ws.send(JSON.stringify({ type: "move", x: p.x, y: p.y }));

    console.log(`Player position: x=${p.x.toFixed(1)}, y=${p.y.toFixed(1)}`);
  }

  renderPlayers();
  requestAnimationFrame(moveLoop);
}

moveLoop();

function renderPlayers() {
  // Remove old elements
  document
    .querySelectorAll(".player, .player-label")
    .forEach((el) => el.remove());

  for (let id in players) {
    const p = players[id];

    // Player dot
    const div = document.createElement("div");
    div.className = "player";
    div.style.left = p.x + "px";
    div.style.top = p.y + "px";
    if (id == myId) div.style.background = "green";
    game.appendChild(div);

    // Username below
    const label = document.createElement("div");
    label.className = "player-label";
    label.style.position = "absolute";
    label.style.left = p.x + "px";
    label.style.top = p.y + 25 + "px";
    label.textContent = p.username;
    game.appendChild(label);

    const bubble = bubbles[p.username];
    if (bubble) {
      bubble.style.left = p.x + "px";
      bubble.style.top = p.y - 30 + "px";
    }
  }
}
