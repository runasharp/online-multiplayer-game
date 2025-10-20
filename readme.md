# Mini Multiplayer Click-to-Move

A simple multiplayer browser game where players can move around a shared canvas, chat in real-time, and have customizable avatars.

## Preview

In this preview, we first register a new user `someUser`. You can see the MongoDB database being updated with this new user. After registration, we log in with `someUser` and see it appear in the game.

Next, in a separate tab, we log in with another pre-existing user. Switching between the tabs allows us to test the chat functionality: sending messages, viewing chat history, and confirming real-time updates between users.

![Demo](public/assets/github/demo.gif)

---

## Architecture Overview

### Client-side

- **HTML/CSS/JS** front-end
- Main elements:
  - `#game`: the game canvas
  - `#chatContainer`: chat UI with input, toggle button, and message history
  - Player dots (`.player`) represent users
  - Player labels (`.player-label`) show usernames
- **WebSocket connection** to server for real-time updates:
  - Sends `move` messages when player clicks
  - Sends `chat` messages from input
  - Receives updates about all players and their messages
- Chat features:
  - Input stays focused after sending first message
  - History expands upwards
  - Toggle button shows/hides chat history
  - Bubbles appear above players temporarily for each message
- Avatar customization (planned)
- Coins and other game elements can be added in the `players` object

### Server-side

- Node.js + Express + WebSocket
- MongoDB stores user data (optional: avatar, color, stats)
- Handles:
  - JWT authentication for secure WebSocket connections
  - Broadcasting player positions and chat messages
  - Optional future features: coins, avatar customization

### Data Flow

- **Clicking on the canvas** sends a `move` message with the target coordinates.
- **Sending a chat message** sends a `chat` message to the server.
- The server broadcasts updates about all players and chat messages.
- Each client updates the game canvas and chat UI accordingly.
