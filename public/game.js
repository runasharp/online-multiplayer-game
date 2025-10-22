const game = document.getElementById("game");
let myId;
let players = {};
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

    // Initialize all players with their current positions
    for (let pid in players) {
      const p = players[pid];
      if (p.displayX === undefined) p.displayX = p.x;
      if (p.displayY === undefined) p.displayY = p.y;
    }

    renderPlayers();
    renderCoins();
  }

  if (data.type === "update") {
    for (let pid in data.players) {
      if (!players[pid]) players[pid] = {};
      const serverP = data.players[pid];

      if (pid === myId) {
        // Only update position to correct drift; never touch targetX/Y
        players[pid].x = serverP.x;
        players[pid].y = serverP.y;
      } else {
        // Other players: update everything from server
        Object.assign(players[pid], serverP);
      }
    }
    renderPlayers();
    renderCoins();
  }

  if (data.type === "remove") {
    delete players[data.playerId];
    renderPlayers();
    renderCoins();
  }
};

// Click to move - now just sends target once
game.addEventListener("click", (e) => {
  const rect = game.getBoundingClientRect();
  const targetX = e.clientX - rect.left - 10;
  const targetY = e.clientY - rect.top - 10;

  // Always set local target for this tab
  if (players[myId]) {
    players[myId].targetX = targetX;
    players[myId].targetY = targetY;
  }

  // Send target to server ONCE
  ws.send(
    JSON.stringify({
      type: "setTarget",
      targetX: targetX,
      targetY: targetY,
    })
  );

  console.log(
    `New target set: x=${targetX.toFixed(1)}, y=${targetY.toFixed(1)}`
  );

  // Refocus chat if active
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
    const p = players[id];

    // Skip if no target set
    if (p.targetX === undefined || p.targetY === undefined) continue;

    let dx = p.targetX - p.x;
    let dy = p.targetY - p.y;
    let dist = Math.sqrt(dx * dx + dy * dy);

    // Use deltaTime to ensure consistent speed regardless of frame rate
    const moveAmount = speed * deltaTime;

    if (dist < moveAmount) {
      // Reached target
      p.x = p.targetX;
      p.y = p.targetY;
      p.targetX = undefined;
      p.targetY = undefined;
    } else {
      // Move towards target
      p.x += (dx / dist) * moveAmount;
      p.y += (dy / dist) * moveAmount;
    }
  }

  renderPlayers();
  requestAnimationFrame(moveLoop);
}

requestAnimationFrame(moveLoop);

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
    dot.removeAttribute("title");
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

    // Interpolate toward current position (for smooth rendering)
    p.displayX += (p.x - p.displayX) * dt;
    p.displayY += (p.y - p.displayY) * dt;

    // Move wrapper smoothly
    const scale = getScaleFactor();
    wrapper.style.transform = `translate3d(${p.displayX * scale.x}px, ${
      p.displayY * scale.y
    }px, 0)`;
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
