// server/coinUpdater.js
function setupCoinUpdates(UserModel, players, broadcast) {
  const changeStream = UserModel.watch();

  changeStream.on("change", (change) => {
    if (
      change.operationType === "update" &&
      change.updateDescription.updatedFields.coins !== undefined
    ) {
      const updatedUserId = change.documentKey._id.toString();
      const newCoins = change.updateDescription.updatedFields.coins;

      // Broadcast coin update
      const coinUpdate = {
        type: "update",
        players: {
          [updatedUserId]: {
            coins: newCoins,
            username: players[updatedUserId]?.username || "Unknown",
            x: players[updatedUserId]?.x || 0,
            y: players[updatedUserId]?.y || 0,
          },
        },
      };
      broadcast(JSON.stringify(coinUpdate));

      // Update local player object if present
      if (players[updatedUserId]) {
        players[updatedUserId].coins = newCoins;
      }
    }
  });

  return changeStream;
}

module.exports = { setupCoinUpdates };
