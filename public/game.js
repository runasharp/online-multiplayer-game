const game = document.getElementById("game");
let myId;
let players = {}; // Now stores Player instances
const speed = 5; // pixels per frame
const GAME_WIDTH = 1100;
const GAME_HEIGHT = 700;

function getScaleFactor() {
  const gameEl = document.getElementById("game");
  return {
    x: gameEl.clientWidth / GAME_WIDTH,
    y: gameEl.clientHeight / GAME_HEIGHT,
  };
}

// Get username from URL query string
const urlParams = new URLSearchParams(window.location.search);
const myUsername = urlParams.get("username") || "Guest";

// Get JWT token from query string
const token = urlParams.get("token");
console.log("Token from URL:", token);
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

    // Initialize all players with Player class instances
    for (let pid in data.players) {
      players[pid] = new Player(pid, data.players[pid]);
    }

    renderPlayers();
    renderCoins();
  }

  if (data.type === "update") {
    for (let pid in data.players) {
      const serverP = data.players[pid];

      if (!players[pid]) {
        // First time seeing this player
        players[pid] = new Player(pid, serverP);
      } else {
        // Update existing player
        players[pid].update(serverP);
      }
    }

    renderPlayers();
    renderCoins();
  }

  if (data.type === "remove") {
    if (players[data.playerId]) {
      players[data.playerId].removeDOM();
      delete players[data.playerId];
    }
    renderPlayers();
    renderCoins();
  }
};

// Click to move - now just sends target once
game.addEventListener("click", (e) => {
  const rect = game.getBoundingClientRect();
  const scale = getScaleFactor();

  // Convert screen pixels to logical game coordinates
  const targetX = (e.clientX - rect.left) / scale.x - 10;
  const targetY = (e.clientY - rect.top) / scale.y - 10;

  if (players[myId]) {
    players[myId].setTarget(targetX, targetY);
  }

  ws.send(
    JSON.stringify({
      type: "setTarget",
      targetX: targetX,
      targetY: targetY,
    })
  );

  console.log(
    `Player ${myUsername} new target: x=${targetX.toFixed(
      1
    )}, y=${targetY.toFixed(1)}`
  );

  if (window.chatActive) {
    setTimeout(() => chatInput.focus(), 0);
  }
});

let lastFrameTime = performance.now();
let isTabActive = true;

// Detect tab visibility changes
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    isTabActive = false;
  } else {
    isTabActive = true;
    lastFrameTime = performance.now(); // Reset time to avoid huge delta
  }
});

function moveLoop(currentTime) {
  // Calculate delta time (cap at 100ms to avoid huge jumps after tab switch)
  const deltaTime = Math.min((currentTime - lastFrameTime) / 16.67, 6); // 16.67ms = 60fps
  lastFrameTime = currentTime;

  // Move all players locally based on their targets
  for (let id in players) {
    players[id].move(speed, deltaTime);
  }

  renderPlayers();
  requestAnimationFrame(moveLoop);
}

requestAnimationFrame(moveLoop);

function renderPlayers() {
  const scale = getScaleFactor();

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

  // Render each player
  for (let id in players) {
    players[id].render(scale, window.bubbles);
  }
}

function renderCoins() {
  const coinsDisplay = document.getElementById("coins-display");
  if (!coinsDisplay) return;

  if (players[myId]) {
    coinsDisplay.textContent = `Coins: ${players[myId].coins}`;
  }
}

document.getElementById("logoutButton").addEventListener("click", () => {
  localStorage.removeItem("token");
  window.location.href = "/login";
});
