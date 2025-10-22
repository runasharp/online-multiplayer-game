const chatInput = document.getElementById("chatInput");
const chatHistory = document.getElementById("chatHistory");
const toggleBtn = document.getElementById("toggleChatHistory");
let chatMessages = [];
window.chatActive = false;
chatHistory.style.display = "none"; // explicitly hidden
updateToggleBtn();

// Make bubbles accessible globally for Player class
window.bubbles = {};
const bubbleTimeouts = {};

// Function to send chat
function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = "";
  if (window.ws && window.ws.readyState === WebSocket.OPEN) {
    window.ws.send(JSON.stringify({ type: "chat", text }));
    console.log("Sent chat:", text);
  } else {
    console.warn("WebSocket not ready, cannot send chat");
  }
  window.chatActive = true;
  chatInput.focus();
}

// Button click
document.getElementById("sendChat").addEventListener("click", sendChat);

// Press Enter in input
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChat();
});

function addMessage(username, text) {
  chatMessages.push({ username, text });
  if (chatMessages.length > 5) chatMessages.shift();
  chatHistory.innerHTML = "";
  chatMessages.forEach((msg) => {
    const div = document.createElement("div");
    div.textContent = `${msg.username}: ${msg.text}`;
    chatHistory.appendChild(div);
  });
  updateToggleBtn();

  // Create bubble if it doesn't exist
  if (!window.bubbles[username]) {
    const bubble = document.createElement("div");
    bubble.innerText = text;
    bubble.style.position = "absolute";
    bubble.style.background = "white";
    bubble.style.border = "1px solid black";
    bubble.style.padding = "4px 8px";
    bubble.style.borderRadius = "5px";
    bubble.style.zIndex = 1000;
    bubble.style.pointerEvents = "none"; // clicks pass through
    bubble.style.whiteSpace = "nowrap";
    bubble.style.fontSize = "16px";
    bubble.style.transform = "translateX(-50%)"; // center horizontally
    game.appendChild(bubble);
    window.bubbles[username] = bubble;
  } else {
    window.bubbles[username].innerText = text; // update text
  }

  // Clear previous timeout (if any) and set a new one
  if (bubbleTimeouts[username]) clearTimeout(bubbleTimeouts[username]);
  bubbleTimeouts[username] = setTimeout(() => {
    if (window.bubbles[username]) {
      window.bubbles[username].remove();
      delete window.bubbles[username];
      delete bubbleTimeouts[username];
    }
  }, 4000); // 4 seconds
}

// Handle incoming messages from server
ws.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "chat") {
    addMessage(data.username, data.text);
  }
});

function updateToggleBtn() {
  if (chatMessages.length === 0) {
    toggleBtn.disabled = true;
    toggleBtn.style.opacity = 0.5;
    toggleBtn.textContent = "▲"; // default
  } else {
    toggleBtn.disabled = false;
    toggleBtn.style.opacity = 1;
    // check actual visibility; if empty string, treat as hidden
    const isHidden =
      chatHistory.style.display === "none" || chatHistory.style.display === "";
    toggleBtn.textContent = isHidden ? "▲" : "▼";
  }
}

// Call once at startup to set initial state
updateToggleBtn();

toggleBtn.addEventListener("click", () => {
  if (chatHistory.style.display === "none") {
    chatHistory.style.display = "block";
  } else {
    chatHistory.style.display = "none";
  }
  updateToggleBtn();
  // Keep input focused
  if (window.chatActive) chatInput.focus();
});
