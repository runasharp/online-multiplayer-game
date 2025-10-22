// server/wsManager.js
function setupWS({ wss, players }) {
  function broadcast(msg, excludeWs = null) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
        client.send(msg);
      }
    });
  }

  // Heartbeat
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        ws.terminate();
      } else {
        ws.isAlive = false;
        ws.ping();
      }
    });
  }, 10000);

  // Periodic sync
  setInterval(() => {
    if (Object.keys(players).length === 0) return;
    const syncPayload = { type: "update", players: {} };
    for (const pid in players) {
      const p = players[pid];
      syncPayload.players[pid] = {
        x: p.x,
        y: p.y,
        targetX: p.targetX,
        targetY: p.targetY,
        coins: p.coins,
        username: p.username,
        color: p.color || "green",
      };
    }
    broadcast(JSON.stringify(syncPayload));
  }, 100);

  return { broadcast };
}

module.exports = { setupWS };
