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

// Redirect to login if no token
if (!token) {
  window.location.href = "/login";
}

try {
  const payload = JSON.parse(atob(token.split(".")[1])); // decode JWT payload
  const exp = payload.exp * 1000; // JWT exp is in seconds
  if (Date.now() > exp) {
    alert("Session expired, please log in again.");
    window.location.href = "/login";
  }
} catch (err) {
  console.error("Invalid token:", err);
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
    renderCoins();
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

let lastSent = 0;

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

    const sendInterval = 50; // ms, 20 updates/sec

    if (Date.now() - lastSent > sendInterval) {
      ws.send(JSON.stringify({ type: "move", x: p.x, y: p.y }));
      lastSent = Date.now();
    }
    console.log(`Player position: x=${p.x.toFixed(1)}, y=${p.y.toFixed(1)}`);
  }

  renderPlayers();
  requestAnimationFrame(moveLoop);
}

moveLoop();

function renderPlayers() {
  const dt = 0.2;

  // Remove DOM elements for players that no longer exist
  const currentWrappers = Array.from(
    document.querySelectorAll("[id^='player-wrapper-']")
  );
  currentWrappers.forEach((wrapper) => {
    const pid = wrapper.id.replace("player-wrapper-", "");
    if (!players[pid]) {
      wrapper.remove();
    }
  });

  for (let id in players) {
    const p = players[id];

    // PLAYER WRAPPER
    let wrapper = document.getElementById(`player-wrapper-${id}`);
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.id = `player-wrapper-${id}`;
      wrapper.style.position = "absolute";
      game.appendChild(wrapper);
    }

    // DOT inside wrapper
    let dot = wrapper.querySelector(".player");
    if (!dot) {
      dot = document.createElement("div");
      dot.className = "player";
      wrapper.appendChild(dot);
    }
    dot.style.background = id == myId ? "green" : "red";

    // LABEL inside wrapper
    let label = wrapper.querySelector(".player-label");
    if (!label) {
      label = document.createElement("div");
      label.className = "player-label";
      wrapper.appendChild(label);
    }
    label.style.position = "absolute";
    label.style.left = "0px";
    label.style.top = "25px";
    label.textContent = p.username;

    // Initialize display positions if not exist
    if (p.displayX === undefined) p.displayX = p.x;
    if (p.displayY === undefined) p.displayY = p.y;

    // Interpolate toward server position
    p.displayX += (p.x - p.displayX) * dt;
    p.displayY += (p.y - p.displayY) * dt;

    // Move wrapper smoothly
    wrapper.style.transform = `translate3d(${p.displayX}px, ${p.displayY}px, 0)`;

    // Optional bubble
    const bubble = bubbles?.[p.username];
    if (bubble) {
      bubble.style.left = p.displayX + "px";
      bubble.style.top = p.displayY - 30 + "px";
    }
  }
}

function renderCoins() {
  const coinsDisplay = document.getElementById("coins-display");
  if (!coinsDisplay) return;

  if (players[myId]) {
    coinsDisplay.textContent = `Coins: ${players[myId].coins}`;
  }
}
