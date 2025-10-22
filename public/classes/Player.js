class Player {
  constructor(id, data = {}) {
    this.id = id;
    this.x = data.x || 0;
    this.y = data.y || 0;
    this.displayX = data.displayX !== undefined ? data.displayX : this.x;
    this.displayY = data.displayY !== undefined ? data.displayY : this.y;
    this.targetX = data.targetX;
    this.targetY = data.targetY;
    this.coins = data.coins || 0;
    this.username = data.username || "Guest";
    this.color = data.color || "green";
    this.location = data.location || null;
    this.wrapper = null;
    this.dot = null;
    this.label = null;
  }

  // Update player data from server
  update(serverData) {
    this.x = serverData.x;
    this.y = serverData.y;
    this.coins = serverData.coins;
    if (serverData.username) this.username = serverData.username;
    if (serverData.color) this.color = serverData.color;
    if (serverData.location !== undefined) this.location = serverData.location;
  }

  // Set movement target
  setTarget(targetX, targetY) {
    this.targetX = targetX;
    this.targetY = targetY;
  }

  // Move towards target based on speed and deltaTime
  move(speed, deltaTime) {
    if (this.targetX === undefined || this.targetY === undefined) return;

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const moveAmount = speed * deltaTime;

    if (dist < moveAmount) {
      // Reached target
      this.x = this.targetX;
      this.y = this.targetY;
      this.targetX = undefined;
      this.targetY = undefined;
    } else {
      // Move towards target
      this.x += (dx / dist) * moveAmount;
      this.y += (dy / dist) * moveAmount;
    }
  }

  // Smooth interpolation for rendering
  interpolateDisplay(dt = 0.2) {
    this.displayX += (this.x - this.displayX) * dt;
    this.displayY += (this.y - this.displayY) * dt;
  }

  // Create DOM elements for this player
  createDOM(gameElement) {
    // Create wrapper
    this.wrapper = document.createElement("div");
    this.wrapper.id = `player-wrapper-${this.id}`;
    this.wrapper.style.position = "absolute";
    this.wrapper.style.width = "20px";
    this.wrapper.style.height = "20px";
    gameElement.appendChild(this.wrapper);

    // Create dot
    this.dot = document.createElement("div");
    this.dot.className = "player";
    this.dot.style.width = "20px";
    this.dot.style.height = "20px";
    this.dot.style.borderRadius = "50%";
    this.wrapper.appendChild(this.dot);

    // Create label
    this.label = document.createElement("div");
    this.label.className = "player-label";
    this.label.style.position = "absolute";
    this.label.style.left = "50%";
    this.label.style.top = "22px";
    this.label.style.transform = "translateX(-50%)";
    this.label.style.whiteSpace = "nowrap";
    this.label.style.pointerEvents = "none";
    this.wrapper.appendChild(this.label);
  }

  // Render player on screen
  render(scale, bubbles = {}) {
    // Ensure DOM exists
    if (!this.wrapper) {
      const gameElement = document.getElementById("game");
      this.createDOM(gameElement);
    }

    // Update visual properties
    this.dot.style.background = this.color;
    this.label.textContent = this.username;

    // Interpolate display position
    this.interpolateDisplay();

    // Update position
    this.wrapper.style.transform = `translate3d(${this.displayX * scale.x}px, ${
      this.displayY * scale.y
    }px, 0)`;

    // Update bubble if exists (with scale applied)
    const bubble = bubbles?.[this.username];
    if (bubble) {
      bubble.style.position = "absolute";
      bubble.style.left = this.displayX * scale.x + "px";
      bubble.style.top = (this.displayY - 37) * scale.y + "px";
      // Slightly to the right: change translateX from -50% to -45%
      bubble.style.transform = "translateX(-45%)";
    }
  }

  // Remove DOM elements
  removeDOM() {
    if (this.wrapper) {
      this.wrapper.remove();
      this.wrapper = null;
      this.dot = null;
      this.label = null;
    }
  }
}

// Export for use in other files
if (typeof module !== "undefined" && module.exports) {
  module.exports = Player;
}
