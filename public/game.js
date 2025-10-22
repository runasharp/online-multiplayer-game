// ========================
// game.js
// ========================

const game = document.getElementById("game");
let myId;
let players = {}; // stores Player instances
const speed = 5; // pixels per frame
const GAME_WIDTH = 1100;
const GAME_HEIGHT = 700;

// Locations with initial coordinates and background
const LOCATIONS = {
  city: {
    x: 100,
    y: 200,
    background: "background.png",
  },
  forest: {
    x: 500,
    y: 300,
    background: "background2.png",
  },
};

// ------------------------
// Background handling
// ------------------------
let currentBackground = null; // track last applied background

function updateBackgroundForPlayer(player) {
  if (!player.location) return;

  const loc = LOCATIONS[player.location];
  if (!loc) {
    console.warn("No location found for player:", player.location);
    return;
  }

  // Only update if background changed
  if (loc.background !== currentBackground) {
    game.style.background = `url('${loc.background}') no-repeat center center`;
    game.style.backgroundSize = "contain";
    console.log("Setting background to:", loc.background); // logs only once per change
    currentBackground = loc.background;
  }
}

// ------------------------
// Utility
// ------------------------
function getScaleFactor() {
  const gameEl = document.getElementById("game");
  return {
    x: gameEl.clientWidth / GAME_WIDTH,
    y: gameEl.clientHeight / GAME_HEIGHT,
  };
}

// ------------------------
// JWT & authentication
// ------------------------
const urlParams = new URLSearchParams(window.location.search);
const myUsername = urlParams.get("username") || "Guest";
const token = urlParams.get("token");
if (!token) window.location.href = "/login";

try {
  const payload = JSON.parse(atob(token.split(".")[1]));
  const exp = payload.exp * 1000;
  if (Date.now() > exp) {
    alert("Session expired, please log in again.");
    window.location.href = "/login";
  }
} catch (err) {
  console.error("Invalid token:", err);
  window.location.href = "/login";
}

// ------------------------
// WebSocket connection
// ------------------------
const protocol = window.location.protocol === "https:" ? "wss" : "ws";
const host = window.location.hostname;
const port = window.location.port ? `:${window.location.port}` : "";
const wsUrl = `${protocol}://${host}${port}/?token=${token}`;
const ws = new WebSocket(wsUrl);
window.ws = ws;

ws.onopen = () => console.log("WebSocket opened");
ws.onclose = (e) => console.warn("WebSocket closed", e);
ws.onerror = (e) => console.error("WebSocket error", e);

ws.onmessage = (msg) => {
  const data = JSON.parse(msg.data);

  if (data.type === "init") {
    myId = data.id;

    // Initialize players
    for (let pid in data.players) {
      players[pid] = new Player(pid, data.players[pid]);
    }

    renderPlayers();
    renderCoins();

    // Set initial background for local player
    if (players[myId].location) {
      updateBackgroundForPlayer(players[myId]);
    }
  }

  if (data.type === "update") {
    for (let pid in data.players) {
      const serverP = data.players[pid];
      if (!players[pid]) {
        players[pid] = new Player(pid, serverP);
      } else {
        players[pid].update(serverP);
      }
    }

    renderPlayers();
    renderCoins();

    // Update background if local player changed location
    if (players[myId]) updateBackgroundForPlayer(players[myId]);
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

// ------------------------
// Move click handler
// ------------------------
game.addEventListener("click", (e) => {
  const rect = game.getBoundingClientRect();
  const scale = getScaleFactor();
  const targetX = (e.clientX - rect.left) / scale.x - 10;
  const targetY = (e.clientY - rect.top) / scale.y - 10;

  if (players[myId]) players[myId].setTarget(targetX, targetY);

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "setTarget",
        targetX: targetX,
        targetY: targetY,
      })
    );
  }

  if (window.chatActive) setTimeout(() => chatInput.focus(), 0);
});

// ------------------------
// Movement loop
// ------------------------
let lastFrameTime = performance.now();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) lastFrameTime = performance.now();
});

function moveLoop(currentTime) {
  const deltaTime = Math.min((currentTime - lastFrameTime) / 16.67, 6);
  lastFrameTime = currentTime;

  for (let id in players) {
    players[id].move(speed, deltaTime);
  }

  renderPlayers();
  requestAnimationFrame(moveLoop);
}

requestAnimationFrame(moveLoop);

// ------------------------
// Rendering
// ------------------------
function renderPlayers() {
  const scale = getScaleFactor();

  // Remove old DOM elements
  const wrappers = Array.from(
    document.querySelectorAll("[id^='player-wrapper-']")
  );
  wrappers.forEach((wrapper) => {
    const pid = wrapper.id.replace("player-wrapper-", "");
    if (!players[pid]) wrapper.remove();
  });

  for (let id in players) {
    players[id].render(scale, window.bubbles);
  }
}

function renderCoins() {
  const coinsDisplay = document.getElementById("coins-display");
  if (!coinsDisplay || !players[myId]) return;
  coinsDisplay.textContent = `Coins: ${players[myId].coins}`;
}

// ------------------------
// Logout
// ------------------------
document.getElementById("logoutButton").addEventListener("click", () => {
  localStorage.removeItem("token");
  window.location.href = "/login";
});

// ------------------------
// Location movement helper
// ------------------------
function moveToLocation(locId) {
  if (!LOCATIONS[locId] || !players[myId]) return;

  const coords = LOCATIONS[locId];
  players[myId].location = locId;
  players[myId].x = coords.x;
  players[myId].y = coords.y;
  players[myId].targetX = undefined;
  players[myId].targetY = undefined;

  updateBackgroundForPlayer(players[myId]);

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "changeLocation",
        location: locId,
        x: coords.x,
        y: coords.y,
      })
    );
  }
}
